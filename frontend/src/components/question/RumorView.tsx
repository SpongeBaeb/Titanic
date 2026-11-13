'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { WALK_SHEETS, type WalkSheet } from './rumor/walkSprites';
import { GENT_REF_SHEET, type FallSheet } from './rumor/gentRefSprites';
import { GENT_PAINT_SHEET } from './rumor/gentPaintSprites';
import { LADY_PAINT_SHEET } from './rumor/ladyPaintSprites';
import { LADY_REF_SHEET } from './rumor/ladyRefSprites';
import { CHILD_REF_SHEET } from './rumor/childRefSprites';
import { CHILD_PAINT_SHEET } from './rumor/childPaintSprites';
import { OLDMAN_PAINT_SHEET } from './rumor/oldManPaintSprites';
import { YOUNGMAN_PAINT_SHEET } from './rumor/youngManPaintSprites';
import { OLDWOMAN_PAINT_SHEET } from './rumor/oldWomanPaintSprites';
import { YOUNGWOMAN_PAINT_SHEET } from './rumor/youngWomanPaintSprites';
import { CHILDGIRL_PAINT_SHEET } from './rumor/childGirlPaintSprites';
import { OLDMAN_REF_SHEET } from './rumor/oldManRefSprites';
import { OLDWOMAN_REF_SHEET } from './rumor/oldWomanRefSprites';
import { YOUNGMAN_REF_SHEET } from './rumor/youngManRefSprites';
import { YOUNGWOMAN_REF_SHEET } from './rumor/youngWomanRefSprites';
import { Question } from '@/data/questions';
import ProgressLine from '@/components/ui/ProgressLine';
import AnalogClock from '@/components/cinematic/AnalogClock';
import { wallClock } from '@/engine/cinematic';
import { scenes } from '@/engine/scenes';
import { cutEngine } from '@/lib/ambience';
import { playGlassRattle, startMurmur, playThud, playChildWail, type Murmur } from '@/lib/synth';

/**
 * Q6 "이상한 소문이 돌기 시작합니다"
 *
 * 1) 항해 내내 깔려 있던 엔진 소리가 뚝 끊기고(정적), 유리잔이 달그락거린다.
 * 2) 어두운 갑판에 사람들이 한 방향(구명정 쪽)으로 흘러가고, 소문이 사람들 사이를 옮겨 다니며 변형된다.
 * 3) 클릭하지 않는다. 군중 속의 한 사람이 되어 움직이고, 한 곳에 머물면 그것이 선택이 된다.
 *    가만히 있으면 군중에 실려 "따라간다"에 닿는다. 거스르려면 힘이 든다.
 *
 * 키보드 1~4 로도 고를 수 있다. 동작 줄이기 설정에서는 카드만 보여 준다.
 */

const IMG = { w: 1918, h: 820 }; // rumor_q6.webp (밤 갑판, 오른쪽에 빙산)
const FLOOR_Y = 455; // 갑판 바닥이 시작되는 높이
const DOOR = { x: 1235, y: 478 }; // 선내로 들어가는 입구(갑판실 왼쪽 끝): 일부 사람들이 이쪽으로 들어간다
const GOAL = DOOR;

/** 갑판 바닥의 오른쪽 끝(난간 안쪽). 이보다 오른쪽은 바다다 */
const xMax = (y: number) => Math.min(1720, 1450 + 0.68 * (y - 450));
/** 걸을 수 있는 곳으로 밀어 넣는다 (왼쪽 위의 환기구 상자와 난간 밖 바다는 제외) */
function walk(x: number, y: number, bottom = BOTTOM): [number, number] {
  const yy = clamp(y, FLOOR_Y + 20, bottom);
  const minX = yy < 580 ? 330 : yy < 720 ? 170 : 40; // 왼쪽 위의 밧줄 통과 상자, 닻감개를 피한다
  return [clamp(x, minX, xMax(yy) - 10), yy];
}

interface Zone { key: string; x: number; y: number; r: number }
/** 등불을 든 승무원이 서 있는 곳: 구역을 앞뒤(원근)로 펼치려고 가운데 앞쪽으로 옮겼다 */
const CREW = { x: 760, y: 690 };
const ZONES: Zone[] = [
  { key: 'check_crew', x: CREW.x, y: CREW.y, r: 120 }, // 갑판 가운데, 등불을 든 승무원
  { key: 'check_escape', x: 450, y: 545, r: 100 }, // 구명정 쪽 (구명조끼와 탈출 경로)
  { key: 'calm_others', x: 1380, y: 730, r: 125 }, // 갑판 왼쪽 아래, 웅크린 사람들
  { key: 'follow_crowd', x: DOOR.x, y: DOOR.y + 12, r: 105 }, // 선내로 들어가는 사람들을 따라간다
];
/** 구명환을 챙겨 든 사람에게 군중이 하는 말 */
const BUOY_QUIPS = ['벌써부터 구명환이라니?', '그건 수영장에서나 쓰는 거요.', '농담이죠? 구명환이라니.', '신중한 분이시군.', '저런 건 어디서 났대요?', '혹시 뭔가 아는 거 아니오?'];
const DWELL = 1.8;
/** 우는 아이가 크게 우는 주기와 길이(초) */
const CRY_PERIOD = 7.5;
const CRY_LEN = 1.4;

/**
 * 군중의 혼잣말. 1912년 4월 14일 일요일 밤, 충돌 직후 갑판의 분위기를 담았다.
 * 아직 아무도 침몰을 믿지 않는다: 엔진이 멎었고, 앞 갑판에 얼음 조각이 떨어졌고, 바다는 거울처럼 고요하다.
 * 악단은 아직 갑판에서 연주하지 않는다(구명정을 내리기 시작할 즈음에야 연주를 시작했다).
 */
const ATMOS: string[] = [
  // 누구나 하는 말: 아직 걱정보다는 어리둥절한 분위기
  '엔진이 멎으니 파도 소리가 들리네.',
  '별은 참 맑은데.',
  '바다가 거울 같아. 너무 고요하네.',
  '공기가 유난히 차갑군.',
  '한 시간 전만 해도 음악을 들었는데.',
  '이 배는 가라앉지 않는다더니.',
  '구명정 훈련은 한 번도 없었지.',
  '얼음 조각이 공짜 기념품이래.',
];
/** 인물 종류별 혼잣말. 침몰을 믿는 사람은 아직 없어서 말투가 가볍다 (기념품, 카드, 잠, 날씨 같은 이야기) */
const CHATTER_BY: Record<string, string[]> = {
  gentpaint: [
    '브리지 한 판 더 합시다. 이깟 일로 판이 깨질 순 없지.',
    '얼음이라니, 위스키에 넣을 건 마침 떨어졌는데.',
    '선장이 알아서 하겠지. 그러라고 있는 사람 아니오.',
    '화이트 스타 라인이 이럴 리 없소.',
    '내일 아침 뉴욕 신문에 실릴 이야기가 하나 생겼군.',
    '내 시가가 꺼졌소. 배가 멈추니 불도 안 붙는군.',
    '이 시각에 갑판이라니, 아내가 알면 웃겠소.',
    '흡연실 친구들은 아직 카드를 친다더군.',
    '배가 멈춘 건 처음 보는군.',
    '무선 전신이 있으니 걱정 마시오.',
  ],
  ladypaint: [
    '실내화 차림으로 나오고 말았어요.',
    '모피 코트를 챙겨 올 걸 그랬네요.',
    '여보, 먼저 들어가 주무세요. 금방 갈게요.',
    '차가 식어 가는데 이게 무슨 소란이람.',
    '내일 아침 식사엔 늦겠어요.',
    '내 강아지는 어디 있죠?',
    '악단이 연주라도 하면 좋을 텐데요.',
    '다들 왜 이렇게 웅성거리는지 모르겠어요.',
    '저녁에 마신 샴페인이 아직 안 깼나 봐요.',
  ],
  childpaint: [
    '엄마, 갑판에 얼음이 있어!',
    '배가 멈췄어! 왜 멈췄어요?',
    '얼음 조각 주워도 돼요?',
    '엄마, 나 잠 안 와요.',
    '밤인데 밖에 나와도 돼요?',
    '저 별 좀 봐요!',
    '아빠, 우리 아직 도착 안 했어요?',
  ],
  childgirlpaint: [
    '엄마, 별이 엄청 많아요.',
    '얼음이 반짝여요. 하나만 가져도 돼요?',
    '인형을 두고 나왔어요.',
    '엄마 손 안 놓을게요.',
    '배가 쉬는 거예요?',
    '나 하나도 안 무서워요.',
  ],
  oldmanpaint: [
    '바다에선 이런 일이 종종 있지. 별일 아닐 걸세.',
    '내 무릎이 그러더군, 오늘 밤은 날이 차다고.',
    '젊을 땐 더한 일도 겪었지.',
    '이 늙은이는 침대로 돌아가고 싶구먼.',
    '지팡이가 갑판에 자꾸 미끄러지는구먼.',
    '여보게, 젊은이. 무슨 일인지 아는가?',
    '배가 이렇게 큰데 설마 무슨 일이야 있겠나.',
  ],
  oldwomanpaint: [
    '아이고, 밤바람이 차네.',
    '숄을 더 여며야겠구먼.',
    '다들 왜 이렇게 서두르누.',
    '내 약은 객실에 두고 나왔는데.',
    '무슨 소동인지 모르겠구려.',
    '영감, 어디 갔수?',
    '오래 살다 보니 별일을 다 보네.',
  ],
  youngmanpaint: [
    '얼음이 갑판에? 이거 이야깃거리군.',
    '고향 친구들한테 자랑해야겠다.',
    '우리, 아직 아메리카에 도착한 건 아니지?',
    '내 모자 어디 갔지? 바람에 날아갔나.',
    '배가 멈추니 심심하군. 카드나 칠까.',
    '난 아무 소리도 못 들었는데.',
    '뉴욕에 닿으면 제일 먼저 일자리부터 알아봐야지.',
  ],
  youngwomanpaint: [
    '다들 왜 이렇게 웅성거릴까요?',
    '내일 일찍 일어나야 하는데…',
    '언니, 우리도 가서 구경해 봐요.',
    '이렇게 별이 많은 밤은 처음이에요.',
    '손이 시려요. 장갑을 두고 왔나 봐요.',
    '승무원에게 물어볼까요?',
    '뉴욕에 닿으면 제일 먼저 편지부터 쓸 거예요.',
  ],
};
/** 등불을 든 선원의 말(가끔): 아직 급할 것 없다는 투 */
/** 달리는 사람에게 하는 호통 */
const SHOUTS = ['거기 당신! 뛰지 마시오!', '갑판에서 뛰면 안 됩니다!', '뛰지 마십시오! 다칩니다!'];
const OFFICER_LINES = ['여러분, 침착하십시오. 곧 안내가 있을 겁니다.', '아직 급한 일은 없습니다. 선실로 돌아가 주십시오.', '별일 아닙니다. 점검 중입니다.', '갑판이 미끄럽습니다. 조심하십시오.'];

// 소문이 퍼지며 바뀌는 말 (문구는 초안)
const RUMORS = [
  '빙산이래.',
  '뭔가 긁고 지나갔대.',
  '배가 부딪혔대.',
  '별일 아니래, 곧 출발한대.',
  '앞 갑판에 얼음이 쌓였대.',
  '물이 들어온대.',
  '화물칸이 잠겼대.',
  '구명정이 모자란대.',
  '선장은 이미 알고 있었대.',
  '올림픽호가 오고 있대.',
];

/**
 * 원근: 난간 기둥을 기준으로 삼는다. crash.webp 에서 난간 기둥의 높이는 바닥에 닿는 y 가 내려갈수록 거의 일정한 비율로
 * 커진다(대략 (y-520)*0.79: 먼 끝 y≈545 에서 30px, y≈750 에서 190px, y≈1010 에서 370px). 사람은 난간(약 1m)보다 크므로
 * 키는 같은 y 의 난간 높이에 비례해 (y-495) 로 잡는다. 화면 가까이(아래)일수록 훨씬 크고, 멀수록 작아진다.
 */
const personH = (y: number) => Math.max(36, 0.49 * y - 170);
/** 예전 기준(키 110px)에 대한 배율: 걸음 속도, 간격 같은 값에 곱한다 */
const depth = (y: number) => personH(y) / 110;
/** 구역 표시(바닥의 원)와 이름 글자 크기에 쓰는 완만한 배율 */
const zs = (y: number) => Math.min(1.3, Math.max(0.6, personH(y) / 200));
/** 사람이 서 있을 수 있는 가장 아래쪽 (이보다 아래는 너무 커진다) */
const BOTTOM = 795;
/** 부딪혀 쓰러진 사람들이 하는 말 */
const OUCH = [
  '아야!', '밀지 마세요!', '조심해요!', '어디 보고 다니는 거요!', '제발 진정해요!', '내 모자!', '아이가 있어요!', '무슨 짓이오!',
  '왜 뛰는 거요?', '아이고 허리야…', '이러다 다 넘어져요!', '다들 침착해요!',
  '신사한테 이게 무슨 짓이오!', '내 안경! 내 안경!', '숙녀가 있소, 조심하시오!', '런던에서 산 모자인데…', '이런 무례한 사람 같으니!',
  '아이가 밟히겠어요!', '손목시계가!', '아직 배가 가라앉은 것도 아닌데!', '뛰면 더 위험해요!', '어이쿠, 바닥이 얼음이네!', '진주 목걸이가!',
];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** 군중 그림(crowd_N) 번호 -> 걷기 그림 띠 이름 (rumor/walkSprites). 아직 없는 인물은 한 장짜리 그림을 쓴다 */
const CROWD_WALK: (string | undefined)[] = ['bowler', 'flowerhat', 'tophat', 'updo'];
/** 걷기 그림이 있는 인물이 넘어졌을 때 쓰는 누운 그림 (fall_N) */
const WALK_FALL: Record<string, number> = { bowler: 0, flowerhat: 1, tophat: 2 };
/** 개발용: 주소에 ?gentref 가 있으면 중년 남자(0번) 자리에 신사, 중년 여자(7번) 자리에 숙녀 레퍼런스 시트(rumor/gentRefSprites, ladyRefSprites)를 쓴다. 걷기 4장, 앞뒤로 넘어짐, 일어나기가 들어 있다 */
const GENT_REF = typeof window !== 'undefined' && /[?&]gent(ref|paint)(&|=|$)/.test(window.location.search);
/** 개발용: 주소에 ?gentpaint 가 있으면 신사(0번)를 실루엣 대신 그려 받은 그림 시트(rumor/gentPaintSprites)로 쓴다 (?gentref 도 함께 켜진다) */
const GENT_PAINT = typeof window !== 'undefined' && /[?&]gentpaint(&|=|$)/.test(window.location.search);
/** 개발용: 주소에 ?gentref 만 있으면(?gentpaint 없이) 신사도 실루엣 시트로 본다. ?oldbowler 이면 신사를 예전 그림(bowler)으로 되돌린다 */
const GENT_SIL = typeof window !== 'undefined' && /[?&]gentref(&|=|$)/.test(window.location.search) && !GENT_PAINT;
const OLD_BOWLER = typeof window !== 'undefined' && /[?&]oldbowler(&|=|$)/.test(window.location.search);
/** 그림자 시트(sheet.shadow)가 있는 인물은 스프라이트 밑에 그림자를 깐다. 주소에 ?noshadow 가 있으면 끈다 */
/** 군중은 어두운 밤 그림(시트의 nightSrc: 어둡고 푸르며 얼굴이 가라앉은 버전)으로 그리고, 주인공만 원래 밝은 그림에 따뜻한 빛을 두른다. 주소에 ?nonight 가 있으면 군중도 원래 그림으로 본다 */
const NO_NIGHT = typeof window !== 'undefined' && /[?&]nonight(&|=|$)/.test(window.location.search);
const NO_SHADOW = typeof window !== 'undefined' && /[?&]noshadow(&|=|$)/.test(window.location.search);
const SHEETS: Record<string, WalkSheet> = { ...WALK_SHEETS, gentpaint: GENT_PAINT_SHEET, ladypaint: LADY_PAINT_SHEET, childpaint: CHILD_PAINT_SHEET, oldmanpaint: OLDMAN_PAINT_SHEET, youngmanpaint: YOUNGMAN_PAINT_SHEET, oldwomanpaint: OLDWOMAN_PAINT_SHEET, youngwomanpaint: YOUNGWOMAN_PAINT_SHEET, childgirlpaint: CHILDGIRL_PAINT_SHEET, ...(GENT_REF ? { gentref: GENT_REF_SHEET, ladyref: LADY_REF_SHEET, childref: CHILD_REF_SHEET, oldmanref: OLDMAN_REF_SHEET, oldwomanref: OLDWOMAN_REF_SHEET, youngmanref: YOUNGMAN_REF_SHEET, youngwomanref: YOUNGWOMAN_REF_SHEET } : {}) };
/** 어린이 시트 번호: 남자아이·여자아이가 같은 시트를 쓴다(내 모습 전용, 군중에는 섞지 않는다) */
const KID_SP = 8;
/** 노인 남성 시트 번호(지팡이를 짚는 굽은 걸음): 60세 이상 남자 플레이어 전용 */
const OLD_M_SP = 9;
/** 노인 여성 시트 번호(숄을 두른 굽은 걸음): 60세 이상 여자 플레이어 전용 */
const OLD_F_SP = 10;
/** 청년(18~29세) 시트 번호: 남자는 납작모자와 짧은 재킷, 여자는 올림머리와 슬림 치마. 내 모습 전용 */
const YOUNG_M_SP = 11;
const YOUNG_F_SP = 12;
/** 어린 여자아이 시트 번호(땋은 머리, 멜빵 원피스): 군중과 17세 이하 여자 플레이어(?gentref) */
const GIRL_SP = 13;
const PLAYER_ONLY_SP = new Set<number>([1, 2, 3]); // 군중에서 뺀 번호: 옛 그림체 시트(flowerhat, tophat, updo)는 새로 그려 받은 인물들과 그림체가 맞지 않는다. 새 그림 시트가 모든 인물에 생겨서 군중은 그것만 쓴다 // 군중에는 섞지 않는 번호(아직 그림 시트가 없고 실루엣뿐이다: 청년 여성). 어린이·노인 남녀·청년 남성은 그려 받은 시트가 있어 군중에도 나온다
/** 군중 속 크기 배율(키 기준): 어린이는 작게. 노인 남성은 시트에 굽은 키가 이미 반영돼 있다 */
const CROWD_SIZE: Record<string, number> = { childpaint: 0.72, childgirlpaint: 0.72 };
/** 신사(중년 남성 내 모습, 군중 속 신사)는 그려 받은 그림 시트(rumor/gentPaintSprites)를 기본으로 쓴다 */
if (!OLD_BOWLER) CROWD_WALK[0] = 'gentpaint';
if (GENT_SIL) CROWD_WALK[0] = 'gentref';
/** 숙녀(중년 여성 내 모습, 군중 속 숙녀)도 그려 받은 그림 시트(rumor/ladyPaintSprites)를 기본으로 쓴다 */
while (CROWD_WALK.length < 8) CROWD_WALK.push(undefined);
CROWD_WALK[7] = 'ladypaint';
/** 어린이·노인 남성·청년 남성도 그려 받은 시트가 있어 군중에 섞는다(?gentref 없이도) */
while (CROWD_WALK.length < 14) CROWD_WALK.push(undefined);
CROWD_WALK[GIRL_SP] = 'childgirlpaint';
CROWD_WALK[KID_SP] = 'childpaint'; CROWD_WALK[OLD_M_SP] = 'oldmanpaint'; CROWD_WALK[YOUNG_M_SP] = 'youngmanpaint'; CROWD_WALK[OLD_F_SP] = 'oldwomanpaint'; CROWD_WALK[YOUNG_F_SP] = 'youngwomanpaint';
if (GENT_REF) { while (CROWD_WALK.length < 13) CROWD_WALK.push(undefined); CROWD_WALK[7] = GENT_PAINT ? 'ladypaint' : 'ladyref'; }
/** 넘어짐·일어남 한 칸이 보이는 시간(초): 휘청 0.16 + 쏠림 0.16 -> 누워 있음 -> 일어나는 중 0.45 (한 동작에 한 장씩 추린 6자세) */
const SHOVE_BY_SHEET: Record<string, number> = { childref: 0.6, childpaint: 0.6, childgirlpaint: 0.6, oldmanref: 0.8, oldmanpaint: 0.8, oldwomanref: 0.75, oldwomanpaint: 0.75, ladyref: 0.9, ladypaint: 0.9, youngwomanref: 0.95 }; // 부딪혀 넘어질 때 밀려나는 거리 배율(없으면 1)
const FALL_FRAME = 0.16;
const GETUP_FRAME = 0.45;
/** 걸음 한 프레임이 나아가는 거리 (키에 대한 비율): 발이 바닥에서 미끄러지지 않게 걸음 프레임을 이동 거리에 묶는다 */
const GAIT_STEP = 0.11;

interface Agent {
  x: number; y: number; vx: number; vy: number;
  speed: number; phase: number; kind: number; // kind: 0 남자 1 여자 2 중절모 3 아이
  mill: boolean; tx: number; ty: number; a: number; wait: number; enter: boolean; sp: number;
  down: number; downT: number; dir: number; say: string; sayT: number; delay: number; fs: number;
  gait: number; face: number; // 걸음 진행(프레임 단위), 바라보는 방향(1 오른쪽, -1 왼쪽)
  fvx: number; walking: boolean; // 천천히 따라가는 가로 속도(몸을 돌릴지 정할 때만 쓴다), 걷는 중인지 (멈춤/걸음 사이에 여유를 둔다)
}
interface Phrase { agent: number; text: string; gen: number; age: number; life: number; src: number; chat?: boolean }

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, phase: number, kind: number, rim: string, body = '#07090f') {
  const bob = Math.abs(Math.sin(phase)) * h * 0.012;
  const by = y - bob;
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.01, h * 0.18, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  const draw = (dx: number, color: string) => {
    ctx.fillStyle = color;
    const w = kind === 1 ? 0.27 : 0.21;
    // 몸통(코트)
    ctx.beginPath();
    ctx.moveTo(x + dx - h * 0.15, by - h * 0.78);
    ctx.quadraticCurveTo(x + dx, by - h * 0.84, x + dx + h * 0.15, by - h * 0.78);
    ctx.lineTo(x + dx + h * w, by - h * 0.06);
    ctx.lineTo(x + dx - h * w, by - h * 0.06);
    ctx.closePath();
    ctx.fill();
    // 다리
    ctx.fillRect(x + dx - h * 0.09, by - h * 0.07, h * 0.07, h * 0.07);
    ctx.fillRect(x + dx + h * 0.02, by - h * 0.07, h * 0.07, h * 0.07);
    // 머리
    ctx.beginPath();
    ctx.arc(x + dx, by - h * 0.9, h * (kind === 3 ? 0.085 : 0.07), 0, Math.PI * 2);
    ctx.fill();
    if (kind === 2) ctx.fillRect(x + dx - h * 0.075, by - h * 0.99, h * 0.15, h * 0.05); // 중절모
    if (kind === 1) { ctx.beginPath(); ctx.ellipse(x + dx, by - h * 0.95, h * 0.1, h * 0.03, 0, 0, Math.PI * 2); ctx.fill(); } // 챙 넓은 모자
  };
  draw(-h * 0.018, rim); // 왼쪽에서 비치는 가장자리 빛
  draw(0, body);
}

interface RumorViewProps {
  question: Question;
  onAnswer: (value: string, extra?: Record<string, unknown>) => void;
  extras?: Record<string, unknown>;
  onBack?: () => void;
  onBeaten?: () => void;
  answers?: Record<string, unknown>;
}

/** 이만큼 쓰러뜨리면 성난 승객들에게 맞는 히든 엔딩 */
export const BEATEN_AT = 100;

/**
 * 갑판을 걸어 다니는 '나'의 모습: 성별과 나이에 따라 그려 받은 시트(어린이·청년·중년·노인) 중 알맞은 것을 고르고 키를 조절한다. 옛 군중 그림은 쓰지 않는다. 등급은 모습으로 드러내지 않는다(성별과 나이만).
 */
function meLook(sex: unknown, age: unknown): { k: number; scale: number } {
  const a = typeof age === 'number' ? age : 25;
  if (a < 18) return { k: sex === 'female' ? GIRL_SP : KID_SP, scale: a < 12 ? 0.58 : a < 16 ? 0.76 : 0.86 }; // 열일곱 살까지는 성별 없이 같은 어린이 시트(나이가 많을수록 크게)
  if (a >= 18 && a < 30) return { k: sex === 'female' ? YOUNG_F_SP : YOUNG_M_SP, scale: 1 }; // 청년 남녀
  if (sex !== 'female' && a >= 60) return { k: OLD_M_SP, scale: 1 }; // 굽은 노인 남성(키는 시트에서 이미 작게 그려져 있다)
  if (sex === 'female' && a >= 60) return { k: OLD_F_SP, scale: 1 }; // 굽은 노인 여성
  // 30~59세: 그려 받은 숙녀(7번)와 신사(0번) 시트
  return { k: sex === 'female' ? 7 : 0, scale: 1 };
}

export default function RumorView({ question, onAnswer, onBack, extras, onBeaten, answers }: RumorViewProps) {
  const lookRef = useRef(meLook(answers?.sex, extras?.age));
  lookRef.current = meLook(answers?.sex, extras?.age);
  const buoyRef = useRef(false); // Q5 에서 구명환을 챙겼는지
  buoyRef.current = !!extras?.lifebuoy;
  const knockTotal = useRef(0); // 이 장면에서 쓰러뜨린 사람 수(같은 사람을 다시 쓰러뜨려도 센다)
  const onBeatenRef = useRef(onBeaten);
  onBeatenRef.current = onBeaten;
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(reduce);
  const [chosen, setChosen] = useState<string | null>(null);
  const [title, setTitle] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null); // 지금 올라서 있는 구역
  const focusRef = useRef<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const answered = useRef(false);
  const chosenRef = useRef<{ key: string; at: number } | null>(null);
  const activeRef = useRef(false);
  const sizeRef = useRef({ vw: 1280, vh: 720, dpr: 1 });
  const target = useRef({ x: 960, y: 740 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const choose = useCallback((key: string) => {
    if (answered.current) return;
    answered.current = true;
    setChosen(key);
    chosenRef.current = { key, at: performance.now() };
    playThud();
    timers.current.push(setTimeout(() => onAnswer(key, { knocked: knockTotal.current }), reduce ? 350 : 2000));
  }, [onAnswer, reduce]);

  // 키보드 1~4: 언제든 직접 고를 수 있다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < question.options.length) choose(question.options[i].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, choose]);

  // ── 타임라인: 제목 → 엔진 끊김 → 유리잔 → 정적 → 웅성거림 → 조작 가능 ──
  useEffect(() => {
    if (reduce) {
      cutEngine();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(1500, () => setTitle(true));
    at(3000, () => cutEngine());
    at(3400, () => playGlassRattle());
    at(6000, () => { activeRef.current = true; setActive(true); });
    return undefined;
  }, [reduce]);

  // ── 캔버스: 갑판, 군중, 소문, 나 ──
  useEffect(() => {
    if (reduce) return;
    const root = rootRef.current;
    const cv = cvRef.current;
    if (!root || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const bg = new Image();
    bg.src = '/bg/rumor_q6.webp';
    const loadImg = (src: string) => { const i = new Image(); i.src = src; return i; };
    const buoyImg = loadImg('/q5/obj_lifebuoy.webp');
    const crowdImgs = Array.from({ length: 8 }, (_, k) => loadImg(`/q6/crowd_${k}.webp`));
    const officerImg = loadImg('/q6/officer_lantern.webp');
    const officerShoutImg = loadImg('/q6/officer_shout.webp'); // 뛰는 사람에게 호통치는 모습
    const calmImgs = [loadImg('/q6/calm_child_0.webp'), loadImg('/q6/calm_child_1.webp')]; // 우는 아이 두 칸: 훌쩍이며 눈을 비빔 / 크게 우는 중
    const doorImg = loadImg('/q6/deck_door.webp');
    // 쓰러진 사람 그림(선택): q6/fall_0~3.webp 가 있으면 쓰러져 누운 동안 이 그림을 쓰고, 없으면 서 있는 그림을 기울여 쓴다
    const fallImgs = [0, 1, 2, 3].map((k) => loadImg(`/q6/fall_${k}.webp`));
    const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
    // 걷기 그림 띠 (인물마다 한 장): 서 있기, 걷기 4장, 뒷모습 2장, 비틀거림, 일어나기
    const walkImgs: Record<string, HTMLImageElement> = {};
    for (const name of new Set(CROWD_WALK)) { const sh = name ? SHEETS[name] : undefined; if (name && sh) walkImgs[name] = loadImg(sh.src); } // 쓰는 시트만 불러온다(옛 bowler 시트는 ?oldbowler 일 때만)
    const nightImgs: Record<string, HTMLImageElement> = {};
    if (!NO_NIGHT) for (const name of new Set(CROWD_WALK)) { const ns = name ? (SHEETS[name] as FallSheet | undefined)?.nightSrc : undefined; if (name && ns) nightImgs[name] = loadImg(ns); }
    // 칸별 그림자 그림(같은 순번): 스프라이트를 그릴 때 그 칸의 그림자를 먼저 그린다 (rects 배열 자체를 열쇠로 쓴다)
    const shadowImgs: Record<string, HTMLImageElement> = {};
    const shadowByRect = new Map<unknown, { name: string; q: [number, number, number, number, number, number]; qf?: [number, number, number, number, number, number] }>();
    if (!NO_SHADOW) {
      for (const name of new Set(CROWD_WALK)) {
        const sh = name ? (SHEETS[name] as FallSheet | undefined) : undefined;
        if (!name || !sh || !sh.shadow) continue;
        shadowImgs[name] = loadImg(sh.shadow.src);
        sh.rects.forEach((r, i) => { const q = sh.shadow!.rects[i]; if (q) shadowByRect.set(r, { name, q, qf: sh.shadow!.rectsFlip?.[i] }); });
      }
    }
    const sheetOf = (sp: number, night = false): [WalkSheet, HTMLImageElement] | null => {
      const name = CROWD_WALK[sp];
      if (!name) return null;
      const sh = SHEETS[name]; const nim = night ? nightImgs[name] : undefined;
      const im = nim && ready(nim) ? nim : walkImgs[name];
      return sh && im && ready(im) ? [sh, im] : null;
    };
    /** 띠에서 프레임 하나를 발 위치(x, y)에 그린다. k: 그림 1px 당 월드 크기. 몸통 중심을 x 에 맞춰 프레임이 바뀌어도 떨리지 않는다 */
    const frameAt = (im: HTMLImageElement, r: [number, number, number, number, number], x: number, y: number, k: number, flip: boolean, glowC?: string) => {
      const [sx, sy, sw, shh, ax] = r;
      const sd = shadowByRect.get(r);
      if (sd) {
        const sim = shadowImgs[sd.name];
        if (sim && ready(sim)) {
          // 광원은 오른쪽 뒤로 고정: 왼쪽을 볼 때는 그림을 뒤집지 않고 뒤집힌 인물용 그림자(qf)를 그대로 놓는다
          const [qx, qy, qw, qh, qax, qup] = flip && sd.qf ? sd.qf : sd.q;
          ctx.save();
          ctx.translate(x, y);
          if (flip && !sd.qf) ctx.scale(-1, 1);
          ctx.drawImage(sim, qx, qy, qw, qh, -qax * k, -qup * k, qw * k, qh * k);
          ctx.restore();
        }
      }
      ctx.save();
      ctx.translate(x, y);
      if (flip) ctx.scale(-1, 1);
      if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 26; }
      ctx.drawImage(im, sx, sy, sw, shh, -ax * k, -shh * k, sw * k, shh * k);
      ctx.restore();
    };
    /** 움직임에 맞는 프레임: 멈추면 서 있기, 화면 안쪽(위)으로 가면 뒷모습, 그 밖에는 걷기 순환 */
    /** 걷는 사람 그리기: 한 번에 프레임 하나만 그린다 (두 프레임을 겹치면 다리가 여러 개로 보인다).
     *  4칸짜리 그림에만 다리가 모이는 순간 몸이 살짝 오르게 한다(8칸 그림에는 오르내림이 이미 그려져 있다) */
    const drawWalker = (sh: WalkSheet, im: HTMLImageElement, x: number, y: number, k: number, vx: number, vy: number, gait: number, walking: boolean, flip: boolean, glowC?: string) => {
      if (!walking) { frameAt(im, sh.rects[sh.stand[0]], x, y, k, flip, glowC); return; }
      const back = sh.back.length > 0 && vy < -Math.abs(vx) * 0.9;
      const seq = back ? sh.back : sh.walk;
      const g = back ? gait / 2 : gait;
      const i0 = Math.floor(g) % seq.length;
      const rect = sh.rects[seq[i0]];
      if (!rect) { frameAt(im, sh.rects[sh.stand[0]], x, y, k, flip, glowC); return; } // 그림 표가 바뀌는 중(개발 중 새로고침)에도 멈추지 않게
      const H = rect[3] * k;
      const bob = back || seq.length >= 8 || (sh as { noBob?: boolean }).noBob ? 0 : -H * 0.014 * (0.5 - 0.5 * Math.cos(((g % 4) / 4) * Math.PI * 2));
      frameAt(im, sh.rects[seq[i0]], x, y + bob, k, flip, glowC);
    };
    /** 걸음 진행: 걸은 거리(키에 대한 비율)만큼 프레임을 넘긴다. 프레임마다 그림 속 디딘 발이 물러나는 거리(walkDist)가 다르므로
     *  그 거리를 다 걸어야 다음 프레임으로 간다 → 디딘 발이 바닥에서 미끄러지지 않는다 */
    const advanceGait = (sp: number, gait: number, distH: number) => {
      const name = CROWD_WALK[sp];
      const dist = name ? SHEETS[name]?.walkDist : undefined;
      if (!dist || !dist.length) return gait + distH / GAIT_STEP;
      let g = gait; let d = distH;
      for (let guard = 0; d > 0 && guard < 16; guard++) {
        const i = Math.floor(g) % dist.length; const frac = g - Math.floor(g);
        const need = (1 - frac) * dist[i];
        if (d >= need) { d -= need; g = Math.floor(g) + 1; } else { g += d / dist[i]; d = 0; }
      }
      return g;
    };
    // 군중 그림은 모두 같은 비율로 줄여 두었다(키 차이가 그대로 남는다). 가장 큰 그림의 높이를 기준으로 맞춘다
    const CROWD_REF = 380;
    /** 발 위치(x, y)를 기준으로 그림을 그린다. h 는 월드 높이, flip 이면 왼쪽을 본다 */
    const sprite = (im: HTMLImageElement, x: number, y: number, h: number, flip = false, sway = 0, glowC?: string) => {
      const w = h * (im.naturalWidth / im.naturalHeight);
      ctx.save();
      ctx.translate(x, y);
      if (sway) ctx.rotate(sway);
      if (flip) ctx.scale(-1, 1);
      if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 26; }
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    };

    const fit = () => {
      const r = root.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      sizeRef.current = { vw: r.width, vh: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const small = window.innerWidth < 700;
    const COUNT = small ? 26 : 50; // 배경이 넓어졌으니 군중을 다시 늘린다 (쓰러뜨리는 맛). 내 자리 고리와 구역 빛기둥이 있어 사람이 많아도 찾을 수 있다
    const pick = (): [number, number] => walk(300 + Math.random() * 1200, FLOOR_Y + 60 + Math.random() * (BOTTOM - FLOOR_Y - 90));
    /** 지금 자리에서 주로 옆으로 떨어진 다음 목적지 */
    const pickNear = (x: number, y: number): [number, number] => {
      const dx = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 420);
      return walk(Math.min(1500, Math.max(300, x + dx)), y + (Math.random() - 0.5) * 90);
    };
    // 걷는 그림이 있는 인물만 군중으로 쓴다 (없는 인물은 한 장짜리 그림이 미끄러져 보인다). 그림이 3명 이상 모이기 전에는 모두 쓴다
    const ANIMATED = CROWD_WALK.map((n, i) => (n && !PLAYER_ONLY_SP.has(i) ? i : -1)).filter((i) => i >= 0);
    const crowdPick = () => (ANIMATED.length >= 3 ? ANIMATED[Math.floor(Math.random() * ANIMATED.length)] : Math.floor(Math.random() * 8));
    const spawn = (anywhere: boolean): Agent => {
      let x: number; let y: number;
      if (anywhere) { [x, y] = pick(); }
      else { y = BOTTOM + 30; x = 300 + Math.random() * 1200; }
      // 대부분은 갑판에서 서성이고, 일부만 선내로 들어간다 (충돌 직후에는 구명정으로 달려가지 않았다)
      const mill = Math.random() < 0.7;
      const [tx, ty] = mill ? pick() : [DOOR.x, DOOR.y];
      return {
        x, y, vx: 0, vy: 0, speed: mill ? 44 + Math.random() * 20 : 56 + Math.random() * 22, phase: Math.random() * 6.28,
        kind: Math.floor(Math.random() * 4), sp: crowdPick(), mill, tx, ty, a: anywhere ? 1 : 0, wait: Math.random() * 3, enter: false,
        down: 0, downT: 0, dir: 1, say: '', sayT: 0, delay: 0, fs: 0, gait: Math.random() * 4, face: Math.random() < 0.5 ? -1 : 1, fvx: 0, walking: false,
      };
    };
    const agents: Agent[] = Array.from({ length: COUNT }, () => spawn(true));
    const phrases: Phrase[] = [];
    const me = { x: 960, y: 740, phase: 0, moving: 0, gait: 0, vx: 0, vy: 0, face: 1, walking: false };
    // 빨리 움직여서 사람들에게 부딪히면 쓰러지고 한마디 한다. 여러 명이 연달아 쓰러지면 주변 군중이 줄줄이 넘어진다.
    const knocks: number[] = [];
    let waveCool = 0;
    let officerSay: { text: string; until: number; shout?: boolean } | null = null;
    let lastThud = 0;
    let cryHeard = -1; // 우는 아이의 울음소리를 낸 마지막 주기
    const knock = (a: Agent, dxFromMe: number, now: number) => {
      if (a.down > 0 || a.enter) return;
      knockTotal.current += 1;
      if (knockTotal.current === BEATEN_AT && !answered.current) {
        answered.current = true; // 더는 선택하지 못한다
        timers.current.push(setTimeout(() => onBeatenRef.current?.(), 700));
      }
      a.down = a.downT = 1.8;
      a.dir = dxFromMe >= 0 ? 1 : -1;
      // 앞으로든 뒤로든 부딪힌 방향으로 키의 0.75배쯤 밀려난다. 체격이 작은 인물일수록 덜 밀린다
      a.vx = a.dir * personH(a.y) * 2.4 * (SHOVE_BY_SHEET[CROWD_WALK[a.sp] ?? ''] ?? 1);
      a.vy = (Math.random() - 0.5) * personH(a.y) * 0.5;
      a.fs = Math.floor(Math.random() * 4);
      a.say = OUCH[Math.floor(Math.random() * OUCH.length)];
      a.sayT = 2.3;
      if (now - lastThud > 220) { lastThud = now; playThud(); }
    };
    const cam = { ox: 0 };
    const dwell: Record<string, number> = {};
    if (process.env.NODE_ENV === 'development') (window as unknown as { __rumor?: unknown }).__rumor = { me, dwell, target, agents, crowdWalk: CROWD_WALK, knocks: () => knockTotal.current, beat: () => { knockTotal.current = BEATEN_AT - 1; const a = agents.find((x) => x.down <= 0 && !x.enter); if (a) knock(a, 1, performance.now()); } };
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    let murmur: Murmur | null = null;
    let murmurTried = false;
    let lastMoveAt = performance.now();
    let phraseTimer = 0;
    let rumorIdx = 0;
    // 구명환을 들고 있으면 사람들이 한마디씩 한다
    // 인물 종류마다 따로 섞은 주머니에서 한 번씩 뽑아 같은 말이 한 바퀴 돌 때까지 반복하지 않는다
    const chatBags: Record<string, string[]> = {};
    const chatFor = (sp: number): string => {
      if (buoyRef.current && Math.random() < 0.35) return BUOY_QUIPS[Math.floor(Math.random() * BUOY_QUIPS.length)];
      const own = CHATTER_BY[CROWD_WALK[sp] ?? ''];
      const pool = own && Math.random() > 0.2 ? own : ATMOS;
      const key = pool === own ? (CROWD_WALK[sp] ?? '') : '_atmos';
      if (!chatBags[key]?.length) chatBags[key] = [...pool].sort(() => Math.random() - 0.5);
      return chatBags[key].pop() as string;
    };
    let chatTimer = 0;
    let officerTimer = 0;
    let runT = 0; let shoutCool = 0; // 달린 시간, 호통 뒤 쉬는 시간

    const mutate = (text: string, gen: number): string => {
      const r = Math.random();
      if (r < 0.34 && text.length > 4) return text.slice(0, Math.max(3, text.length - 3 - Math.floor(Math.random() * 3))) + '…';
      if (r < 0.62) return RUMORS[Math.min(RUMORS.length - 1, Math.floor(gen / 1.4) + Math.floor(Math.random() * 2))];
      return text;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = (now - t0) / 1000;
      const { vw, vh, dpr } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      const W = IMG.w * s;
      const ch = chosenRef.current;
      const ce = ch ? (now - ch.at) / 1000 : 0;

      // 카메라: 좌우로 넓은 그림이 화면보다 클 때 내 위치를 따라간다
      const goalOx = W > vw ? clamp(vw / 2 - me.x * s, vw - W, 0) : (vw - W) / 2;
      cam.ox += (goalOx - cam.ox) * Math.min(1, dt * 3);
      const oy = (vh - IMG.h * s) / 2;
      // 선택 후에는 고른 곳으로 파고든다
      const zone = ch ? ZONES.find((z) => z.key === ch.key) : undefined;
      const z = zone ? 1 + 0.35 * Math.min(1, ce / 1.6) * Math.min(1, ce / 1.6) : 1;
      const cx = zone ? zone.x : IMG.w / 2;
      const cy = zone ? zone.y : IMG.h / 2;
      const A = s * z;
      const E = cx * (1 - z) * s + cam.ox;
      const F = cy * (1 - z) * s + oy;
      const toWorld = (px: number, py: number) => ({ x: (px - E) / A, y: (py - F) / A });
      void toWorld;

      // ── 갱신 ──
      const crowdA = clamp((e - 4.4) / 1.4, 0, 1); // 정적 뒤 군중이 나타난다
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (a.sayT > 0) a.sayT -= dt;
        if (a.delay > 0) { a.delay -= dt; if (a.delay <= 0) knock(a, a.x - me.x, now); }
        if (a.down > 0) {
          // 쓰러져 있는 동안: 밀려난 방향으로 미끄러지다가 멈추고, 마지막에 일어난다
          a.down -= dt;
          a.x += a.vx * dt; a.y += a.vy * dt;
          a.vx *= Math.max(0, 1 - dt * 3.2); a.vy *= Math.max(0, 1 - dt * 3.2);
          const [wx, wy] = walk(a.x, a.y, BOTTOM + 80); a.x = wx; a.y = wy;
          continue;
        }
        if (a.enter) a.a -= dt * 1.4; else a.a = Math.min(crowdA, a.a + dt * 0.8);
        let dx = a.tx - a.x; let dy = a.ty - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        dx /= dist; dy /= dist;
        // 이웃과 거리 유지
        let sx = 0; let sy = 0;
        const rad = 42 * depth(a.y);
        for (let j = 0; j < agents.length; j++) {
          if (i === j) continue;
          const b = agents[j];
          const ddx = a.x - b.x; const ddy = (a.y - b.y) * 1.6;
          const dd = Math.hypot(ddx, ddy);
          if (dd < rad && dd > 0.01) { sx += (ddx / dd) * (1 - dd / rad); sy += (ddy / dd) * (1 - dd / rad); }
        }
        const sp = a.speed * depth(a.y) * (e < 4.4 || a.wait > 0 ? 0 : 1);
        if (a.wait > 0) a.wait -= dt;
        a.vx += ((dx + sx * 0.9) * sp - a.vx) * Math.min(1, dt * 2.2);
        a.vy += ((dy + sy * 0.9) * sp * 0.6 - a.vy) * Math.min(1, dt * 2.2);
        a.x += a.vx * dt; a.y += a.vy * dt;
        a.phase += dt * (3 + Math.hypot(a.vx, a.vy) * 0.03);
        {
          const spd = Math.hypot(a.vx, a.vy); const dp = depth(a.y);
          if (a.walking ? spd < 4 * dp : spd > 11 * dp) a.walking = !a.walking;
          if (a.walking) a.gait = advanceGait(a.sp, a.gait, (spd * dt) / personH(a.y));
          a.fvx += (a.vx - a.fvx) * Math.min(1, dt * 2.5);
          if (Math.abs(a.fvx) > 9 * dp && Math.sign(a.fvx) !== a.face) a.face = a.fvx < 0 ? -1 : 1;
        }
        if (a.y <= BOTTOM + 70) { const [wx, wy] = walk(a.x, a.y, BOTTOM + 80); a.x = wx; a.y = wy; }
        if (a.mill && dist < 30) { [a.tx, a.ty] = pickNear(a.x, a.y); a.wait = 1 + Math.random() * 3.5; }
        if (!a.mill && !a.enter && dist < 40) a.enter = true; // 입구에 닿으면 안으로 들어간다
        if (a.enter && a.a <= 0) Object.assign(a, spawn(false));
      }

      // 나: 마우스(터치)를 따라가지만 군중에 휩쓸린다
      const tgt = target.current;
      let density = 0;
      // 밀도: 몸 크기 안에 닿아 있는 사람 수 (원근으로 사람이 커졌으니 반경도 키에 맞춘다)
      for (const a of agents) if (Math.hypot(a.x - me.x, (a.y - me.y) * 1.4) < 0.5 * personH(me.y)) density++;
      const fdx = GOAL.x - me.x; const fdy = GOAL.y - me.y; const fd = Math.hypot(fdx, fdy) || 1;
      const push = activeRef.current && !ch ? 60 * Math.min(1, density / 7) : 0;
      // 군중 속에서 가만히 있으면 커서 자체가 흐름에 실려 간다. 움직이는 동안에는 거스를 수 있지만 힘이 든다.
      if (push > 0 && now - lastMoveAt > 900) { tgt.x += (fdx / fd) * push * 1.4 * dt; tgt.y += (fdy / fd) * push * 1.4 * dt * 0.6; }
      const pullK = (3.4 / (1 + density * 0.12)) * (buoyRef.current ? 0.8 : 1); // 구명환을 들고 있으면 조금 느리다
      const mx = me.x; const my = me.y;
      me.x += (tgt.x - me.x) * Math.min(1, dt * pullK) + (fdx / fd) * push * dt;
      me.y += (tgt.y - me.y) * Math.min(1, dt * pullK) + (fdy / fd) * push * dt * 0.6;
      [me.x, me.y] = walk(me.x, me.y);
      const sp = Math.hypot(me.x - mx, me.y - my) / Math.max(dt, 0.001);
      me.moving = sp;
      me.phase += dt * (2 + Math.min(8, sp * 0.04));
      me.vx = (me.x - mx) / Math.max(dt, 0.001); me.vy = (me.y - my) / Math.max(dt, 0.001);
      if (me.walking ? sp < 5 * depth(me.y) : sp > 14 * depth(me.y)) me.walking = !me.walking;
      if (me.walking) me.gait = advanceGait(lookRef.current.k, me.gait, (sp * dt) / (personH(me.y) * lookRef.current.scale));
      if (Math.abs(me.vx) > 12 * depth(me.y)) me.face = me.vx < 0 ? -1 : 1;

      // 달려서 부딪히면: 키의 1.4배/초 이상(군중 속에서 서두르는 속도)으로 사람에게 닿으면 그 사람이 쓰러진다
      if (activeRef.current && !ch && sp > personH(me.y) * 1.4) {
        for (const a of agents) {
          if (a.down > 0 || a.delay > 0 || a.a < 0.5 || a.enter) continue;
          const ddx = a.x - me.x; const ddy = (a.y - me.y) * 1.5; const rr = personH(Math.max(a.y, me.y)) * 0.3;
          if (ddx * ddx + ddy * ddy < rr * rr) { knock(a, ddx, now); knocks.push(now); }
        }
      }
      // 달리기만 해도(사람에게 닿지 않아도) 선원이 호통친다: 달리는 속도로 0.8초 이상 움직이면 한 번, 그 뒤 8초는 쉰다
      if (activeRef.current && !ch && sp > personH(me.y) * 1.4) runT += dt; else runT = Math.max(0, runT - dt * 2);
      if (shoutCool > 0) shoutCool -= dt;
      if (runT > 0.8 && shoutCool <= 0 && !(officerSay && now < officerSay.until)) {
        officerSay = { text: SHOUTS[Math.floor(Math.random() * SHOUTS.length)], until: now + 2800, shout: true };
        shoutCool = 8; runT = 0;
      }
      while (knocks.length && now - knocks[0] > 5000) knocks.shift();
      if (waveCool > 0) waveCool -= dt;
      if (knocks.length >= 5 && waveCool <= 0) {
        // 연달아 여러 명이 쓰러지면 주변 사람들이 줄줄이 넘어진다
        waveCool = 6;
        knocks.length = 0;
        for (const a of agents) {
          if (a.down > 0 || a.enter || a.a < 0.4) continue;
          const dd = Math.hypot(a.x - me.x, (a.y - me.y) * 1.5);
          // 부딪힌 자리 근처(키의 1.3배 안)에서 대부분만 넘어진다: 군중 전체가 한꺼번에 쓰러지지는 않는다
          if (dd < personH(me.y) * 1.3 && Math.random() < 0.75) a.delay = 0.12 + dd / 900 + Math.random() * 0.2;
        }
        officerSay = { text: '거기 당신! 뛰지 마시오!', until: now + 2800, shout: true }; // 호통칠 때는 손가락질하는 그림을 쓴다
      }

      // 구역에 머무르기
      let nearest: Zone | null = null; let nearD = 1e9;
      for (const zn of ZONES) {
        const d = Math.hypot(me.x - zn.x, (me.y - zn.y) * 1.8);
        const r = zn.r * zs(zn.y);
        const inside = d < r;
        dwell[zn.key] = inside && activeRef.current && !ch ? (dwell[zn.key] ?? 0) + dt : Math.max(0, (dwell[zn.key] ?? 0) - dt * 1.6);
        if (d < nearD) { nearD = d; nearest = zn; }
        if (dwell[zn.key] >= DWELL && !ch) choose(zn.key);
      }

      // 소문: 사람에서 사람으로 옮겨 가며 변한다
      phraseTimer += dt;
      const visible = e > 5.2;
      if (visible && phraseTimer > 2.1 && agents.length) {
        phraseTimer = 0;
        const gen = (e - 5.2) / 4;
        if (phrases.filter((q) => !q.chat).length < 8) {
          const ai = Math.floor(Math.random() * agents.length);
          phrases.push({ agent: ai, text: RUMORS[Math.min(RUMORS.length - 1, rumorIdx++ % 3 + Math.floor(gen / 3))], gen: 0, age: 0, life: 7, src: ai });
        }
        // 가까운 사람에게 전달되며 변형
        const rumorsOnly = phrases.filter((q) => !q.chat);
        const p = rumorsOnly[Math.floor(Math.random() * rumorsOnly.length)];
        if (p) {
          const from = agents[p.agent];
          let best = -1; let bd = 1e9;
          for (let k = 0; k < agents.length; k++) {
            if (k === p.agent) continue;
            const d = Math.hypot(agents[k].x - from.x, agents[k].y - from.y);
            if (d < bd && d < 220) { bd = d; best = k; }
          }
          if (best >= 0) { p.agent = best; p.gen += 1; p.text = mutate(p.text, p.gen + gen); p.age = Math.max(0, p.age - 1.2); }
        }
      }
      // 혼잣말: 내 가까이 있는 사람이 더 자주 말한다. 같은 말은 한 바퀴 돌 때까지 반복하지 않는다
      chatTimer += dt;
      if (e > 6 && chatTimer > 1.5 && phrases.filter((q) => q.chat).length < 3) {
        chatTimer = 0;
        const talking = new Set(phrases.map((q) => q.agent));
        const cands = agents.map((_, k) => k).filter((k) => !talking.has(k) && agents[k].down <= 0 && agents[k].a > 0.8 && Math.abs(agents[k].x - me.x) < 760);
        if (cands.length) {
          cands.sort((k1, k2) => Math.hypot(agents[k1].x - me.x, agents[k1].y - me.y) - Math.hypot(agents[k2].x - me.x, agents[k2].y - me.y));
          const ai = cands[Math.floor(Math.pow(Math.random(), 1.6) * cands.length)];
          phrases.push({ agent: ai, text: chatFor(agents[ai].sp), gen: 0, age: 0, life: 5.2, src: ai, chat: true });
        }
      }
      // 선원도 가끔 한마디 한다
      officerTimer += dt;
      if (e > 9 && officerTimer > 13 && !(officerSay && now < officerSay.until)) { officerTimer = 0; officerSay = { text: OFFICER_LINES[Math.floor(Math.random() * OFFICER_LINES.length)], until: now + 3200 }; }
      for (let i = phrases.length - 1; i >= 0; i--) { phrases[i].age += dt; if (phrases[i].age > phrases[i].life) phrases.splice(i, 1); }

      // 웅성거림: 가장 가까운 소문 쪽으로 커지고 기운다
      if (e > 5 && !murmurTried) { murmurTried = true; murmur = startMurmur(); }
      if (murmur) {
        let near = 1e9; let px = 0;
        for (const p of phrases) { const a = agents[p.agent]; const d = Math.hypot(a.x - me.x, a.y - me.y); if (d < near) { near = d; px = a.x - me.x; } }
        murmur.level(ch ? 0.2 : clamp(0.35 + 0.65 * (1 - near / 700), 0.3, 1) * clamp((e - 5) / 3, 0, 1));
        murmur.pan(clamp(px / 600, -1, 1));
      }

      // ── 그리기 ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#04070d';
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * A, 0, 0, dpr * A, dpr * E, dpr * F);
      if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, IMG.w, IMG.h);
      ctx.fillStyle = 'rgba(4,6,14,0.12)';
      ctx.fillRect(0, 0, IMG.w, IMG.h);

      // 바닥 등불의 빛
      const glow = (gx: number, gy: number, r: number, a: number, c = '255,190,110') => {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      };
      ctx.globalCompositeOperation = 'lighter';
      glow(CREW.x, CREW.y - 55, 190, 0.28 * crowdA); // 승무원의 등불
      glow(DOOR.x, DOOR.y - 50, 170, 0.34 * crowdA); // 선내로 들어가는 문의 빛
      glow(330, 850, 130, 0.08 * crowdA);
      ctx.globalCompositeOperation = 'source-over';

      // 구역 표시: 바닥에 은은한 원. 가까이 가면 또렷해지고 머문 만큼 차오른다
      if (crowdA > 0.4) {
        for (const zn of ZONES) {
          const dz = zs(zn.y);
          const near = nearest === zn ? clamp(1 - nearD / (zn.r * dz * 3), 0, 1) : 0;
          const prog = clamp((dwell[zn.key] ?? 0) / DWELL, 0, 1);
          ctx.lineWidth = 3.4;
          ctx.strokeStyle = `rgba(255,214,150,${0.38 + near * 0.5})`;
          ctx.beginPath();
          ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, 0, 0, Math.PI * 2);
          ctx.stroke();
          // 바닥에서 솟는 빛기둥: 사람들 사이에서도 구역이 어디인지 멀리서 보인다
          {
            const ph = personH(zn.y) * 1.8;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(zn.x, zn.y - ph * 0.42);
            ctx.scale(0.3, 1);
            const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, ph * 0.6);
            gp.addColorStop(0, `rgba(255,222,160,${0.30 + near * 0.25})`);
            gp.addColorStop(1, 'rgba(255,222,160,0)');
            ctx.fillStyle = gp;
            ctx.fillRect(-ph * 0.6, -ph * 0.6, ph * 1.2, ph * 1.2);
            ctx.restore();
          }
          if (prog > 0) {
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = 'rgba(255,226,170,0.95)';
            ctx.beginPath();
            // 차오르는 호: 바닥 고리와 같은 가로 타원 위에서 맨 위(-90도)부터 시계 방향으로 그린다 (타원 자체를 돌리면 세로로 길쭉한 타원이 된다)
            ctx.ellipse(zn.x, zn.y + 6, zn.r * dz, zn.r * dz * 0.36, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
            ctx.stroke();
          }
        }
      }

      // 내 자리: 발 밑에 맥박 치는 금빛 고리 (사람들 사이에서 어디 있는지 알 수 있게)
      if (crowdA > 0.4) {
        const pr = personH(me.y) * 0.46;
        const pulseR = 1 + 0.08 * Math.sin(e * 4.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(me.x, me.y + 6, 0, me.x, me.y + 6, pr * 1.5);
        gg.addColorStop(0, 'rgba(255,226,150,0.34)');
        gg.addColorStop(1, 'rgba(255,226,150,0)');
        ctx.translate(0, 0);
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.ellipse(me.x, me.y + 6, pr * 1.5, pr * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = `rgba(255,232,170,${0.8 + 0.2 * Math.sin(e * 4.2)})`;
        ctx.beginPath();
        ctx.ellipse(me.x, me.y + 6, pr * pulseR, pr * pulseR * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 선내로 들어가는 문: 갑판실 왼쪽 끝에서 따뜻한 빛이 새어 나온다
      if (ready(doorImg)) {
        const dd = depth(DOOR.y);
        ctx.globalAlpha = crowdA;
        sprite(doorImg, DOOR.x, DOOR.y + 10, personH(DOOR.y) * 1.45);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        const sp0 = ctx.createRadialGradient(DOOR.x, DOOR.y + 14, 0, DOOR.x, DOOR.y + 14, 120);
        sp0.addColorStop(0, `rgba(255,180,100,${0.3 * crowdA})`);
        sp0.addColorStop(1, 'rgba(255,180,100,0)');
        ctx.fillStyle = sp0;
        ctx.fillRect(DOOR.x - 120, DOOR.y - 106, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const dd = depth(DOOR.y);
        const dw = 60 * dd * 1.2; const dh = 118 * dd * 1.2;
        const gx = DOOR.x - dw / 2; const gy = DOOR.y - dh;
        const g2 = ctx.createLinearGradient(0, gy, 0, gy + dh);
        g2.addColorStop(0, `rgba(255,210,140,${0.55 * crowdA})`);
        g2.addColorStop(1, `rgba(255,170,90,${0.9 * crowdA})`);
        ctx.fillStyle = g2;
        ctx.fillRect(gx, gy, dw, dh);
        ctx.strokeStyle = `rgba(30,18,10,${0.85 * crowdA})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(gx, gy, dw, dh);
        ctx.globalCompositeOperation = 'lighter';
        const sp = ctx.createRadialGradient(DOOR.x, DOOR.y + 14, 0, DOOR.x, DOOR.y + 14, 120);
        sp.addColorStop(0, `rgba(255,180,100,${0.32 * crowdA})`);
        sp.addColorStop(1, 'rgba(255,180,100,0)');
        ctx.fillStyle = sp;
        ctx.fillRect(DOOR.x - 120, DOOR.y - 106, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 사람들(먼 쪽부터)
      type Item = { y: number; draw: () => void };
      const items: Item[] = [];
      for (const a of agents) {
        if (a.a < 0.02) continue;
        items.push({ y: a.y, draw: () => {
          // 내 앞(아래쪽)에서 나를 가리는 사람은 반투명하게 해서 내가 보이게 한다
          const blocks = a.y > me.y + 8 && Math.abs(a.x - me.x) < personH(a.y) * 0.5 && a.y - me.y < personH(a.y) * 1.1;
          ctx.globalAlpha = a.a * (blocks ? 0.32 : 1);
          const im = crowdImgs[a.sp];
          const ws = sheetOf(a.sp, true); // 군중은 밤 그림
          if (ws) {
            const [sh, wi] = ws;
            const k = (personH(a.y) / CROWD_REF) * (CROWD_SIZE[CROWD_WALK[a.sp] ?? ''] ?? 1);
            if (!NO_NIGHT && a.down <= 0) {
              // 역광: 군중 뒤에서 따뜻한 빛이 번지는 느낌(몸 뒤쪽 오른쪽 위에 부드러운 빛무리). 윤곽의 빛은 밤 그림에 구워 두었다
              const ph = personH(a.y) * (CROWD_SIZE[CROWD_WALK[a.sp] ?? ''] ?? 1);
              const hx = a.x + ph * 0.1; const hy = a.y - ph * 0.58;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.translate(hx, hy); ctx.scale(0.62, 1);
              const hg = ctx.createRadialGradient(0, 0, ph * 0.05, 0, 0, ph * 0.78);
              hg.addColorStop(0, 'rgba(255,170,100,0.20)'); hg.addColorStop(0.55, 'rgba(255,140,80,0.07)'); hg.addColorStop(1, 'rgba(255,120,60,0)');
              ctx.fillStyle = hg; ctx.fillRect(-ph, -ph, ph * 2, ph * 2);
              ctx.restore();
            }
            if (a.down > 0) {
              // 부딪힘: 비틀거리다(0.2초) → 누운 그림 → 무릎 짚고 일어남(마지막 0.45초) → 다시 걷는다
              const t = a.downT - a.down;
              const lying = fallImgs.filter(ready);
              const name = CROWD_WALK[a.sp]!;
              const fi = fallImgs[WALK_FALL[name] ?? -1] ?? lying[a.fs % Math.max(1, lying.length)];
              const fsh = sh as Partial<FallSheet>;
              if (fsh.fallF && fsh.fallB && fsh.getupF && fsh.getupB && fsh.lyingF !== undefined && fsh.lyingB !== undefined) {
                // 칸마다 자세가 있는 시트: 바라보는 쪽으로 밀리면 앞으로 엎어지고, 반대쪽이면 뒤로 넘어져 눕는다. 일어나는 길도 다르다
                const fwd = a.dir === a.face;
                const fall = fwd ? fsh.fallF : fsh.fallB; const up = fwd ? fsh.getupF : fsh.getupB; const lie = fwd ? fsh.lyingF : fsh.lyingB;
                const upT = up.length * GETUP_FRAME;
                const f = a.down < upT ? up[Math.min(up.length - 1, Math.floor((upT - a.down) / GETUP_FRAME))]
                  : t < fall.length * FALL_FRAME ? fall[Math.floor(t / FALL_FRAME)] : lie;
                frameAt(wi, sh.rects[f], a.x, a.y, k, a.face < 0);
              } else if (t < 0.2 || !fi || !ready(fi)) frameAt(wi, sh.rects[sh.stagger[0]], a.x, a.y, k, a.dir > 0);
              else if (a.down > 0.45) {
                const lh = fi.naturalHeight * ((personH(a.y) * 0.95) / 500);
                sprite(fi, a.x, a.y + 4, lh, a.dir < 0);
              } else frameAt(wi, sh.rects[sh.getup[0]], a.x, a.y, k, a.dir < 0);
            } else {
              drawWalker(sh, wi, a.x, a.y, k, a.vx, a.vy, a.gait, a.walking, a.face < 0);
            }
          } else if (ready(im)) {
            const h = im.naturalHeight * (personH(a.y) / CROWD_REF);
            if (a.down > 0) {
              // 쓰러지는 동작: 0.22초에 넘어지고, 마지막 0.45초에 일어난다
              const t = a.downT - a.down;
              const ease = (v: number) => v * v * (3 - 2 * v);
              const ang = a.dir * 1.46 * ease(Math.min(1, t / 0.22)) * ease(Math.min(1, a.down / 0.45));
              const lying = fallImgs.filter(ready);
              if (lying.length && t > 0.16 && a.down > 0.42) {
                // 누워 있는 그림: 너비가 키의 0.95배가 되도록 맞춘다
                const fi = lying[a.fs % lying.length];
                const lh = fi.naturalHeight * ((personH(a.y) * 0.95) / 500); // 네 장의 몸 길이가 비슷하므로 같은 배율로 맞춘다 (가로 500px 기준)
                sprite(fi, a.x, a.y + 4, lh, a.dir < 0);
              } else sprite(im, a.x, a.y, h, a.dir < 0, ang);
            } else sprite(im, a.x, a.y - Math.abs(Math.sin(a.phase)) * h * 0.012, h, a.vx < -1, Math.sin(a.phase) * 0.012);
          } else figure(ctx, a.x, a.y, (a.kind === 3 ? 0.6 : 0.93) * personH(a.y), a.phase, a.kind, 'rgba(255,170,90,0.55)');
          ctx.globalAlpha = 1;
          // 쓰러진 사람의 한마디
          if (a.sayT > 0 && a.say) {
            const fs = 22 * clamp(depth(a.y), 0.9, 1.5);
            ctx.font = `700 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            const su = clamp(1 - a.sayT / 2.3, 0, 1); // 한마디가 위로 떠오르며 마지막 1초 동안 사라진다
            ctx.fillStyle = `rgba(255,236,200,${Math.min(1, a.sayT / 1.0) * Math.min(1, su / 0.08 + 0.2)})`;
            const ty = a.y - personH(a.y) * (a.down > 0 ? 0.55 : 1.15) - personH(a.y) * 0.6 * (1 - (1 - su) * (1 - su));
            ctx.strokeText(a.say, a.x, ty);
            ctx.fillText(a.say, a.x, ty);
          }
        } });
      }
      // 승무원과 웅크린 사람들(고정)
      items.push({ y: CREW.y, draw: () => {
        ctx.globalAlpha = crowdA;
        if (ready(officerImg)) {
          const h = personH(CREW.y) * 1.0; // 군중과 같은 키 (예전 1.25배는 너무 컸다)
          const shouting = !!(officerSay && officerSay.shout && now < officerSay.until) && ready(officerShoutImg);
          sprite(shouting ? officerShoutImg : officerImg, CREW.x, CREW.y, h); // 두 그림은 같은 크기·발 위치라 바뀌어도 튀지 않는다
          // 등불이 일렁인다 (등불은 몸 왼쪽 아래: 보통 그림 -0.076h, 호통 그림 -0.138h, 바닥에서 0.355h)
          const fl = 0.85 + 0.15 * Math.sin(e * 9) * Math.sin(e * 3.7);
          glow(CREW.x + h * (shouting ? -0.138 : -0.076), CREW.y - h * 0.355, 150, 0.4 * fl * crowdA);
        } else figure(ctx, CREW.x, CREW.y, 122 * depth(CREW.y), 0, 2, 'rgba(255,200,120,0.8)', '#0a0d16');
        ctx.globalAlpha = 1;
      } });
      // 진정시키기 구역의 우는 아이: 두 모습을 천천히 번갈아 보이고, 주기적으로 크게 "으아앙" 운다(글자가 떠올랐다 사라지고 소리가 난다)
      if (ready(calmImgs[0]) && ready(calmImgs[1]) && crowdA > 0.05) {
        const CX = 1380; const CY = 742;
        const ch2 = personH(CY) * 0.78;
        const cyc = e % CRY_PERIOD;
        const crying = crowdA > 0.5 && cyc > CRY_PERIOD - CRY_LEN;
        if (crying && cryHeard !== Math.floor(e / CRY_PERIOD)) { cryHeard = Math.floor(e / CRY_PERIOD); playChildWail(); }
        const frameI = crying ? 1 : Math.floor(e / 1.1) % 2;
        const shake = crying ? Math.sin(e * 38) * 1.6 : 0;
        items.push({ y: CY, draw: () => {
          ctx.globalAlpha = crowdA;
          sprite(calmImgs[frameI], CX + shake, CY, ch2);
          ctx.globalAlpha = 1;
          if (crying) {
            const u = clamp((cyc - (CRY_PERIOD - CRY_LEN)) / CRY_LEN, 0, 1);
            const fs = 30 * clamp(depth(CY), 0.9, 1.5);
            ctx.font = `800 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
            ctx.textAlign = 'center'; ctx.lineWidth = 6;
            const al = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.4);
            const ty = CY - ch2 * 1.08 - personH(CY) * 0.55 * (1 - (1 - u) * (1 - u));
            ctx.strokeStyle = `rgba(0,0,0,${0.9 * al})`; ctx.fillStyle = `rgba(255,226,190,${al})`;
            ctx.strokeText('으아앙!', CX, ty); ctx.fillText('으아앙!', CX, ty);
          }
        } });
      }
      if (officerSay && now < officerSay.until) {
        const os = officerSay;
        items.push({ y: CREW.y + 1, draw: () => {
          ctx.font = `700 ${26 * clamp(depth(CREW.y), 1, 1.6)}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 6;
          const left = os.until - now; const ou = clamp(1 - left / 2800, 0, 1);
          const oa = Math.min(1, left / 900) * Math.min(1, ou / 0.06 + 0.2);
          const oy2 = CREW.y - personH(CREW.y) * 1.45 - personH(CREW.y) * 0.5 * (1 - (1 - ou) * (1 - ou)); // 위로 떠오르며 사라진다
          ctx.strokeStyle = `rgba(0,0,0,${0.9 * oa})`;
          ctx.fillStyle = `rgba(255,214,150,${oa})`;
          ctx.strokeText(os.text, CREW.x, oy2);
          ctx.fillText(os.text, CREW.x, oy2);
        } });
      }
      // 나: 따뜻한 윤곽으로 구분한다
      items.push({ y: me.y, draw: () => {
        glow(me.x, me.y - 10, 90, 0.18 * crowdA, '255,225,170');
        ctx.globalAlpha = Math.max(0.0, crowdA);
        const look = lookRef.current;
        const mi = crowdImgs[look.k] ?? crowdImgs[4]; // 성별과 나이에 맞는 그림: 따뜻한 빛으로 나를 구분한다
        const mws = sheetOf(look.k);
        if (mws) {
          const [sh, wi] = mws;
          const k = (116 * depth(me.y) * look.scale) / CROWD_REF;
          drawWalker(sh, wi, me.x, me.y, k, me.vx, me.vy, me.gait, me.walking, me.face < 0, 'rgba(255,226,160,0.95)');
        } else if (ready(mi)) {
          const h = mi.naturalHeight * ((116 * depth(me.y) * look.scale) / CROWD_REF);
          const facing = target.current.x < me.x - 4;
          sprite(mi, me.x, me.y - Math.abs(Math.sin(me.phase)) * h * 0.012, h, facing, Math.sin(me.phase) * 0.01, 'rgba(255,226,160,0.95)');
        } else figure(ctx, me.x, me.y, 116 * depth(me.y), me.phase, 2, 'rgba(255,225,160,0.95)', '#0d1018');
        if (buoyRef.current && ready(buoyImg)) {
          const bh = personH(me.y) * 0.5; const bw = buoyImg.naturalWidth * (bh / buoyImg.naturalHeight);
          const facing = target.current.x < me.x - 4;
          ctx.drawImage(buoyImg, me.x + (facing ? -1 : 1) * personH(me.y) * 0.18 - bw / 2, me.y - personH(me.y) * 0.62, bw, bh);
        }
        ctx.globalAlpha = 1;
      } });
      items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

      // 소문 글자
      ctx.textAlign = 'center';
      for (const p of phrases) {
        const a = agents[p.agent];
        if (!a) continue;
        const dz = depth(a.y);
        const near = clamp(1 - Math.hypot(a.x - me.x, a.y - me.y) / 420, 0, 1);
        const k = clamp(p.age / 0.6, 0, 1) * clamp((p.life - p.age) / 1.6, 0, 1);
        const jit = p.chat ? 0 : Math.min(4, p.gen * 0.9) * (1 - near * 0.6);
        const size = (p.chat ? 20 + near * 8 : 22 + near * 14) * clamp(dz, 0.85, p.chat ? 1.15 : 1.3);
        ctx.font = `600 ${size}px "Noto Serif KR", "Nanum Myeongjo", serif`;
        const rt = clamp(p.age / p.life, 0, 1);
        const tx = a.x; const ty = a.y - personH(a.y) * 1.12 - near * 10 - personH(a.y) * 0.7 * (1 - (1 - rt) * (1 - rt)); // 말풍선 없이 글자가 위로 떠오르며 흐려진다
        for (let c2 = 0; c2 < (p.chat ? 1 : 2); c2++) {
          const ox = (Math.sin(e * 7 + p.src + c2 * 2) * jit) * (c2 ? 1 : -1);
          const oy = Math.cos(e * 5.3 + c2) * jit * 0.6;
          ctx.fillStyle = p.chat ? `rgba(255,236,200,${(0.62 + near * 0.38) * k})` : c2 ? `rgba(220,90,80,${0.35 * k})` : `rgba(240,225,200,${(0.45 + near * 0.5) * k * (c2 ? 0.6 : 1)})`;
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 8;
          ctx.fillText(p.text, tx + ox, ty + oy);
        }
        ctx.shadowBlur = 0;
      }

      // 나: 머리 위에 '나' 표시 (모두의 위에 그린다)
      if (crowdA > 0.4) {
        const my = me.y - personH(me.y) * (0.14 + 0.94 * lookRef.current.scale) - 12 + Math.sin(e * 4.2) * 3;
        const fs = 26 * clamp(depth(me.y), 0.9, 1.5);
        ctx.fillStyle = 'rgba(255,226,150,0.98)';
        ctx.strokeStyle = 'rgba(30,20,0,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(me.x, my + fs * 0.1);
        ctx.lineTo(me.x - fs * 0.5, my - fs * 0.62);
        ctx.lineTo(me.x + fs * 0.5, my - fs * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.font = `800 ${fs}px "Noto Serif KR", "Nanum Myeongjo", serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText('나', me.x, my - fs * 0.78);
        ctx.fillStyle = 'rgba(255,240,190,1)';
        ctx.fillText('나', me.x, my - fs * 0.78);
      }

      // 구역 위에 올라서면 머리 위에 동그라미가 떠서 선택 중임을 알린다 (채워지면 선택된다)
      {
        const cz = ZONES.find((zn) => (dwell[zn.key] ?? 0) > 0.02) ?? (ch ? ZONES.find((zn) => zn.key === ch.key) : undefined);
        const fk = cz && !ch ? cz.key : null;
        if (focusRef.current !== fk) { focusRef.current = fk; setFocusKey(fk); }
        if (cz && crowdA > 0.4) {
          const prog = ch ? 1 : clamp((dwell[cz.key] ?? 0) / DWELL, 0, 1);
          const sc = clamp(depth(me.y), 0.9, 1.5);
          const R = 27 * sc;
          const rx = me.x; const ry = me.y - personH(me.y) * (0.14 + 0.94 * lookRef.current.scale) - 12 - 26 * sc - R - 14 + Math.sin(e * 4.2) * 3;
          const num = question.options.findIndex((o) => o.value === cz.key) + 1;
          ctx.save();
          ctx.fillStyle = 'rgba(8,10,18,0.78)';
          ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,226,170,0.28)';
          ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 7 * Math.min(1.2, sc); ctx.lineCap = 'round';
          ctx.strokeStyle = prog >= 1 ? 'rgba(255,240,170,1)' : 'rgba(255,214,120,0.98)';
          ctx.shadowColor = 'rgba(255,200,90,0.9)'; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.font = `800 ${R * 1.05}px "Noto Serif KR", "Nanum Myeongjo", serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,240,200,1)';
          ctx.fillText(prog >= 1 ? '✓' : num > 0 ? String(num) : '·', rx, ry + 1);
          ctx.textBaseline = 'alphabetic';
          ctx.restore();
        }
      }

      // 가장자리 어둠과 붉은 맥박(소문의 불안)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      const pulse = 0.5 + 0.5 * Math.sin(e * 1.6);
      g.addColorStop(0, 'rgba(60,0,0,0)');
      g.addColorStop(1, `rgba(40,0,6,${0.45 + 0.12 * pulse * crowdA})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    };
    raf = requestAnimationFrame(frame);

    // 입력: 마우스는 움직이는 곳으로, 터치는 끌어서
    const world = (px: number, py: number) => {
      const { vw, vh } = sizeRef.current;
      const s = Math.max(vw / IMG.w, vh / IMG.h);
      const W = IMG.w * s;
      const goalOx = W > vw ? clamp(vw / 2 - me.x * s, vw - W, 0) : (vw - W) / 2;
      const ox = cam.ox || goalOx;
      const oy = (vh - IMG.h * s) / 2;
      return { x: (px - ox) / s, y: (py - oy) / s };
    };
    const move = (e: PointerEvent) => {
      if (!activeRef.current || chosenRef.current) return;
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
      const r = cv.getBoundingClientRect();
      const w = world(e.clientX - r.left, e.clientY - r.top);
      const [wx, wy] = walk(w.x, w.y);
      target.current = { x: wx, y: wy };
      lastMoveAt = performance.now();
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', move);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerdown', move);
      murmur?.stop();
    };
  }, [reduce, question, choose]);

  const clock = scenes[question.id]?.clock;

  return (
    <div ref={rootRef} className="fixed inset-0 h-full w-full select-none overflow-clip bg-[#04070d]">
      {!reduce && <canvas ref={cvRef} aria-hidden className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />}

      {/* 위쪽: 진행과 제목 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/80 via-slate-950/35 to-transparent px-6 pb-16 pt-12"
        animate={{ opacity: chosen ? 0 : active && !cardsOpen ? 0.5 : 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="flex-1"><ProgressLine /></div>
          {clock && (
            <div className="flex shrink-0 flex-col items-center gap-0.5" aria-hidden>
              <AnalogClock elapsed={clock.elapsed} size={44} sinkMark={clock.mark} />
              <span className="font-numeric text-xs font-bold text-bright-brass [font-variant-numeric:lining-nums]">{wallClock(clock.elapsed)}</span>
            </div>
          )}
        </div>
        <AnimatePresence>
          {(title || reduce) && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="mx-auto mt-6 max-w-xl">
              <h2 className="text-2xl font-title font-bold leading-relaxed text-danger-text drop-shadow-[0_0_8px_rgba(182,65,53,0.5)] md:text-3xl">{question.title}</h2>
              {question.subtitle && <p className="mt-3 text-sm leading-loose text-muted-ivory md:text-base" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.8)' }}>{question.subtitle}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 아래쪽 안내 */}
      {!reduce && !chosen && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: active && !focusKey ? 0.85 : 0 }}
          transition={{ duration: 1.6, delay: 0.4 }}
          className="pointer-events-none absolute inset-x-0 bottom-16 z-30 px-6 text-center text-sm tracking-wide text-white/80 md:bottom-8"
          style={{ textShadow: '0 1px 10px #000' }}
        >
          군중 속에서 움직여 보세요. 한 곳에 머물면 그곳을 택하게 됩니다.
        </motion.p>
      )}

      {/* 구역에 올라서면 어떤 행동을 하게 되는지 분명히 알려 준다 */}
      <AnimatePresence>
        {!reduce && !chosen && focusKey && (() => {
          const o = question.options.find((q) => q.value === focusKey);
          if (!o) return null;
          const num = question.options.indexOf(o) + 1;
          return (
            <motion.div
              key={focusKey}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-12"
            >
              <div className="max-w-xl rounded-2xl border border-amber-200/60 bg-black/80 px-6 py-4 text-center shadow-[0_0_30px_rgba(255,200,110,0.25)] backdrop-blur-sm">
                <p className="font-title text-lg font-bold text-amber-100 md:text-xl"><span className="mr-2 text-amber-300">{num}</span>{o.label}</p>
                {o.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-ivory md:text-base">{o.description}</p>}
                <p className="mt-2 text-xs tracking-wide text-amber-200/80">이대로 머무르면 이 행동을 하게 됩니다. 벗어나면 취소됩니다.</p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {cardsOpen && !chosen && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[35] overflow-y-auto bg-black/80 px-6 pb-24 pt-56 backdrop-blur-sm"
          >
            <div className="mx-auto flex max-w-xl flex-col gap-3">
              {question.options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => choose(o.value)}
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-4 text-left transition-colors hover:border-amber-200/70 hover:bg-white/10"
                >
                  <span className="mr-2 text-amber-200/80">{i + 1}</span>
                  <span className="font-title text-lg font-bold text-ivory">{o.label}</span>
                  {o.description && <span className="mt-1 block text-sm text-muted-ivory">{o.description}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 뒤로 가기 */}
      {onBack && !chosen && (
        <button onClick={onBack} className="group fixed left-4 top-3 z-50 flex items-center text-slate-300 transition-colors hover:text-amber-300 md:bottom-8 md:left-8 md:top-auto">
          <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
          <span className="font-sans text-sm uppercase tracking-widest">Back</span>
        </button>
      )}

      {/* 들어올 때는 어둠에서, 선택 뒤에는 어둠으로 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[45] bg-black"
        initial={{ opacity: 1 }}
        animate={chosen ? { opacity: 1 } : { opacity: 0 }}
        transition={chosen ? { duration: reduce ? 0.3 : 0.9, delay: reduce ? 0 : 1.0 } : { duration: 1.6, delay: 0.1 }}
      />
    </div>
  );
}
