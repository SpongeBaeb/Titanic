import type { Option, Question } from '@/data/questions';
import type { Persona } from '@/engine/persona';

/**
 * 승객(항구, 성별, 나이, 객실 분위기)에 따라 질문과 선택지의 글을 바꾸고, 못 하는 선택지를 잠근다 (선택지_개정안.md).
 * - 선택값(value)과 점수는 바꾸지 않는다. 바꾸는 것은 제목, 부제, 선택지의 라벨/설명, 잠금(lock)뿐이다.
 * - 객실 등급 이름은 어떤 글에도 쓰지 않는다. 분위기와 장면으로만 말한다.
 * - 잠긴 선택지는 숨기지 않고 lock 에 이유 한 줄을 둔다(렌더러가 보여 준다).
 */

type Patch = Partial<Pick<Option, 'label' | 'description' | 'lock'>>;

const withOptions = (q: Question, patches: Record<string, Patch>, omit: string[] = []): Question => ({
  ...q,
  options: q.options
    .filter((o) => !omit.includes(o.value))
    .map((o) => (patches[o.value] ? { ...o, ...patches[o.value] } : o)),
});

// ── Q0: 항구마다 서게 될 곳과 때가 다르다 (아직 1912년에 도착하기 전이라 기계나 장치는 직접 말하지 않는다) ──
const Q0_SUB: Record<string, string> = {
  S: '1912년 4월 10일, 사우샘프턴 부두의 정오. 그곳에 서게 될 당신의 모습을 골라 주세요.',
  C: '1912년 4월 10일 저녁, 셰르부르 앞바다. 그곳에 서게 될 당신의 모습을 골라 주세요.',
  Q: '1912년 4월 11일, 이슬비 내리는 퀸스타운. 그곳에 서게 될 당신의 모습을 골라 주세요.',
};

// ── Q1: 나이를 묻는 말 ──
const Q1_TITLE: Record<string, string> = {
  'S-male': '사우샘프턴 부두에 서게 될 당신은 몇 살입니까?',
  'S-female': '사우샘프턴 부두에 서게 될 당신은 몇 살입니까?',
  'C-male': '셰르부르 앞바다에 서게 될 당신은 몇 살입니까?',
  'C-female': '셰르부르 앞바다에 서게 될 당신은 몇 살입니까?',
  'Q-male': '퀸스타운에 서게 될 당신은 몇 살입니까?',
  'Q-female': '퀸스타운에 서게 될 당신은 몇 살입니까?',
};

// ── Q2: 동행. 나이에 따라 못 하는 선택지가 있고, 같은 선택지도 말이 달라진다 ──
function companionPatches(p: Persona): Record<string, Patch> {
  const age = p.age ?? 25;
  const f = p.sex === 'female';
  const patch: Record<string, Patch> = {};

  // 혼자
  if (age <= 5) patch.alone = { lock: '당신은 품에 안겨 있습니다.' };
  else if (age <= 11) patch.alone = { lock: '어른 없이는 배에 오를 수 없습니다.' };
  else if (age <= 15) patch.alone = { lock: '"같이 온 어른은 어디 있지?" 누군가 묻습니다.' };
  else if (age <= 17) patch.alone = { description: '서류에는 뉴욕에서 마중 나올 친척의 이름이 적혀 있다.' };
  else if (age <= 29) patch.alone = { description: f ? '혼자 떠나는 젊은 여성. 사람들은 먼저 당신의 손가락을 봅니다.' : '청춘의 대서양. 누가 기다리든 말든 당신은 혼자 간다.' };
  else if (age <= 59) patch.alone = { description: f ? '혼자 떠나는 여성. 오늘의 선택은 당신 혼자의 것입니다.' : '출장일 수도, 도망일 수도 있습니다. 어쨌든 짐은 가방 하나.' };
  else patch.alone = { description: `혼자 떠나는 ${f ? '노부인' : '노신사'}. 뉴욕에서는 누군가의 마중이 기다립니다.` };

  // 배우자·연인
  if (age <= 5) patch.partner = { lock: '아직 엄마 품이 세상의 전부입니다.' };
  else if (age <= 11) patch.partner = { lock: '소꿉친구는 배우자가 아닙니다.' };
  else if (age <= 15) patch.partner = { lock: '사랑은 학교를 마친 뒤에 오시오.' };
  else if (age <= 17) patch.partner = { lock: '"조금만 더 참으시오. 사랑은 도망가지 않소."' };
  else if (age >= 60) patch.partner = { label: '곁의 사람과 함께', description: '함께 늙어 온 사이일 수도, 늦게 만난 사이일 수도 있다. 이 배의 난간은 둘이 같이 잡는다.' };
  else patch.partner = { description: '새로운 삶이든 짧은 여행이든, 나란히 서서 트랩을 오릅니다.' };

  // 형제자매·친구
  if (age <= 5) patch.friends = { lock: '아직 손잡아 줄 어른이 필요한 나이입니다.' };
  else if (age <= 15) patch.friends = { description: `${f ? '오빠, 언니' : '형, 누나'}, 동생과. 어른 한 명이 이름표처럼 당신들을 데리고 다닌다.` };
  else if (age <= 29) patch.friends = { description: '내기에서 이긴 친구, 같은 동네에서 온 사촌. 함께 웃을 사람이 있다.' };
  else patch.friends = { description: '오랜 벗이거나, 사업 파트너거나, 형제. 대서양은 사람을 시험하기 좋은 곳이다.' };

  // 부모님·아이들
  if (age <= 5) patch.family = { label: '엄마 아빠와 함께', description: '엄마 품에 안겨, 아빠의 코트 단추를 만지작거린다.' };
  else if (age <= 11) patch.family = { label: '엄마 아빠와 함께', description: '엄마 치맛자락을 놓지 않는다. 낯선 곳에서도 이것만 있으면 괜찮다.' };
  else if (age <= 17) patch.family = { description: '부모님 사이에서 한 걸음 뒤처져 걷는다. 이 배가 어디로 가는지 아직 실감하지 못한다.' };
  else if (age <= 29) patch.family = { description: '부모님과 어린 동생들. 당신은 이 가족의 짐꾼이자 길잡이다.' };
  else if (age <= 59) patch.family = { description: '가족의 손을 잡고. 누군가에게는 모든 것이 처음이다.' };
  else patch.family = { description: '가족이 이끄는 여행. 당신은 오랜만에 앞장서지 않는다.' };

  // 항구가 더하는 한 줄 (혼자일 때 가장 잘 들린다)
  const portLine = p.port === 'S' ? '부두 끝에서 누군가 손수건을 흔들고 있다.' : p.port === 'C' ? '연락선 불빛이 물에 길게 늘어진다. 프랑스어와 영어가 뒤섞여 들린다.' : '어젯밤 송별 잔치에서 부르던 노래가 아직 귀에 남아 있다.';
  if (patch.alone && !patch.alone.lock) patch.alone = { ...patch.alone, description: `${patch.alone.description} ${portLine}` };
  return patch;
}

// ── Q3: 분위기 (등급 이름은 쓰지 않는다). 1=우아한 곳, 2=조용한 곳, 3=활기찬 곳 ──
const CABIN_AGE_LINE: Record<string, { adult: string; kid: string; old: string }> = {
  '1': { adult: '샹들리에 아래 대화는 모두 낮은 목소리.', kid: '복도가 너무 조용해서 구두 소리가 무섭다.', old: '계단 대신 승강기를 권한다. 처음 타 보는 기계다.' },
  '2': { adult: '도서관 의자에 앉자 오래된 책 냄새가 났다.', kid: '식당에서 숟가락 소리가 크게 들린다.', old: '산책 갑판의 벤치에 담요가 놓여 있다.' },
  '3': { adult: '복도 끝 어디선가 아코디언 소리가 들린다.', kid: '복도에서 아이들이 뛰어다닌다. 벌써 친구가 생겼다.', old: '옆 침대의 코 고는 소리마저 정겹다.' },
};
const CABIN_PORT_LINE: Record<string, Record<string, string>> = {
  C: { '1': '연락선에서 올라올 때 이미 비단과 향수 냄새가 났다.', '3': '낯선 억양의 말소리가 복도에 섞여 흐른다.' },
  Q: { '1': '연락선 갑판에서 당신의 구두 소리만 또렷하다.', '3': '고향 노래가 먼저 건너와 있다. 같은 곡이 두 번째로 흐른다.' },
};

// ── Q4(시설): 막지 않고, 승객에 따라 오리 사무장이 한마디 거든다 ──
export function purserFacilityLine(facilityId: string, p: Persona): string | null {
  const band = p.band;
  if (band === 'baby' || band === 'kid') {
    if (facilityId === 'pool') return '…물 깊이는 허리까지요. 오리는 머리까지 잠기지만 손님은 그러면 안 되오.';
    if (facilityId === 'massage') return '…찌릿한 건 과학이오. 눈을 꼭 감으시오.';
    if (facilityId === 'barber') return '…부리는 건드리지 않아도 되오. 머리부터.';
  }
  if (band === 'old') {
    if (facilityId === 'pool') return '…물은 미지근하오. 심장에는 이쪽이 좋소.';
    if (facilityId === 'massage') return '…전기는 혈액에 좋다고 하오. 나는 의사는 아니오.';
    if (facilityId === 'gamble') return '…노인의 손은 의외로 냉정하오.';
  }
  return null;
}

// ── Q5 갑판: 질문을 승객의 시점으로 ──
function deckQuestion(q: Question, p: Persona): Question {
  const band = p.band;
  if (band === 'baby' || band === 'kid') {
    return withOptions(
      {
        ...q,
        title: '엄마 아빠는 왜 이 배를 탔을까요?',
        subtitle: '저녁이 끝나고 어른들이 난간 쪽으로 걸어갑니다. 당신은 난간 사이로 바다를 봅니다. 문득 생각합니다. “어른들은 왜 이 배를 탔을까?”',
      },
      {
        experience: { label: '가 보고 싶은 곳이 있대', description: '신기한 걸 구경하는 여행.' },
        stability: { label: '잠깐 쉬러 간대', description: '돌아갈 집이 있는 여행.' },
        change: { label: '새 집에서 살 거래', description: '이 배는 새 집으로 가는 길.' },
      },
    );
  }
  let subtitle = q.subtitle ?? '';
  if (p.port === 'C') subtitle = subtitle.replace('저녁 식사가 끝났습니다.', '만찬이 끝났습니다. 담배 연기와 오케스트라가 남았습니다.');
  if (p.port === 'Q') subtitle = `아일랜드의 마지막 해안선이 사라진 지 사흘째입니다. ${subtitle}`;
  const out: Question = { ...q, subtitle };
  if (band === 'small') out.title = '당신은 이 여행이 어디로 이어질 거라 믿나요?';
  return out;
}

// ── Q6 소문: 그 순간 있던 곳이 다르고, 아이는 아이의 시점으로 ──
function rumorQuestion(q: Question, p: Persona, cabin: Persona['cabin']): Question {
  const band = p.band;
  const rest = ' 복도에서 사람들이 웅성거리기 시작합니다. “빙산과 부딪혔다는 소문이 있대.” 아직 정확한 상황은 아무도 모릅니다. 당신은 가장 먼저 무엇을 합니까?';
  let intro = '밤이 깊어졌습니다.';
  const womanOrChild = p.sex === 'female' || (p.age !== null && p.age < 16);
  if (band === 'baby' || band === 'kid') intro = '엄마가 당신을 안아 올립니다. 평소보다 훨씬 힘이 셉니다.';
  else if (cabin === 1) intro = womanOrChild ? '라운지의 샹들리에 아래, 찻잔을 내려놓습니다. 어디선가 짧고 둔한 진동이 찻잔을 흔들었습니다.' : '흡연실 가죽 의자에서 카드를 내려놓습니다. 어디선가 짧고 둔한 진동이 컵의 얼음을 흔들었습니다.';
  else if (cabin === 2) intro = '도서관의 불은 아직 따뜻했습니다. 발밑에서 아주 낮은 소리가 한 번, 책 한 권이 떨어졌습니다.';
  else if (cabin === 3) intro = '객실 침대에 누운 당신의 등 아래로 쇠가 긁히는 소리가 지나갑니다.';
  const out: Question = { ...q, subtitle: intro + rest };
  if (band === 'baby' || band === 'kid') {
    return withOptions(out, {
      calm_others: { label: '우는 아이를 꼭 안아 달랜다', description: '“괜찮아, 괜찮아.”' },
      check_crew: { label: '파란 옷 아저씨(선원)에게 “무슨 일이에요?” 하고 묻는다', description: '어른한테 물어보면 알려 줄 거야.' },
      check_escape: { label: '엄마가 입혀 주는 커다란 조끼를 가만히 입는다', description: '무거워도 벗지 않는다.' },
      follow_crowd: { label: '엄마 손을 놓치지 않고 사람들 속을 걷는다', description: '손을 놓치면 안 돼.' },
    });
  }
  if (band === 'small' || band === 'young') {
    return withOptions(out, {
      calm_others: { label: '어린 동생들을 불러 모은다', description: '“이리 와. 내 옆에 붙어 있어.”' },
      check_crew: { label: '승무원을 찾아 묻는다', description: '어른들은 이야기해 주지 않지만, 승무원은 알 겁니다.' },
      check_escape: { label: '구명조끼를 먼저 챙겨 동생들에게 입힌다', description: '내가 챙기지 않으면 아무도 챙기지 않습니다.' },
      follow_crowd: { label: '부모님 뒤에서 한 걸음도 떨어지지 않는다', description: '놓치면 안 됩니다.' },
    });
  }
  return out;
}

// ── Q7 구명정: 규칙이 사람을 가른다 (여성과 아이 먼저) ──
function lifeboatQuestion(q: Question, p: Persona): Question {
  const band = p.band;
  if (band === 'baby' || band === 'kid') {
    return withOptions(
      { ...q, title: '구명정 앞입니다. 엄마가 당신을 안고 있습니다.', subtitle: '바다는 검고 차갑습니다. 구명정에는 이제 자리가 몇 개 남지 않았습니다. 어른들이 서로를 바라봅니다. 그 순간, 당신은 어떻게 합니까?' },
      {
        yield_seat: { label: '엄마 옆자리를 다른 아이에게 비켜 준다', description: '“나는 괜찮아.”' },
        secure_mine: { label: '엄마가 당신을 안고 오른다', description: '“꼭 잡아.”' },
        observe: { label: '엄마 품에서 가만히 지켜본다', description: '“무섭지만 눈은 감지 않아.”' },
      },
      ['yield_weak', 'me_first'],
    );
  }
  // 앞에서 무엇을 했는지에 따라 이곳에 오게 된 사정을 한 줄로 먼저 말한다 (아직 아무도 침몰을 믿지 않는 밤이라 말투는 무겁지 않게)
  const lead = p.rumor ? LIFEBOAT_LEAD[p.rumor] : undefined;
  const base = lead ? { ...q, subtitle: `${lead} ${q.subtitle}` } : q;
  // 진정시키기를 골랐다면 그때 달랜 우는 아이가 구명정 앞까지 함께 와 있다
  const calmed: Record<string, Patch> = p.rumor === 'calm_others'
    ? { yield_weak: { label: '아까 달랜 우는 아이를 안아 구명정에 태운다', description: '“이제 괜찮아. 먼저 타렴.”' } }
    : {};
  if (p.sex === 'male' && (p.age ?? 30) >= 16) {
    return withOptions(base, {
      yield_seat: { label: '여성과 아이가 먼저 타도록 뒤로 물러선다', description: '“아직 다른 구명정이 있습니다.”' },
      yield_weak: { label: '아이와 여자들에게 길을 터 준다', description: '“우선순위는 지켜야 합니다.”' },
      me_first: { description: '“미안하지만 이번에는 내가 먼저입니다.” 장교의 시선이 당신을 따라옵니다.' },
      ...calmed,
    });
  }
  return Object.keys(calmed).length ? withOptions(base, calmed) : base;
}

/** Q7 첫머리: Q6 에서 고른 행동에 따라 구명정 갑판에 오게 된 까닭 (문구 초안) */
const LIFEBOAT_LEAD: Record<string, string> = {
  follow_crowd: '발길 닿는 대로 사람들을 따라왔더니 어느새 구명정이 매달린 갑판입니다. 다들 왜 여기까지 왔는지 서로 묻지 않습니다.',
  check_crew: '승무원이 낮은 목소리로 말했습니다. “만약을 위해 보트 갑판에 가 계시는 게 좋겠습니다.” 당신은 그 말대로 올라왔습니다.',
  check_escape: '구명조끼를 챙겨 입고 보트 갑판으로 올라왔습니다. 아직 서두르는 사람은 많지 않습니다.',
  calm_others: '훌쩍이던 아이의 손을 잡고 아이 엄마와 함께 보트 갑판으로 올라왔습니다. 아이는 아직 눈가를 비비고 있습니다.',
};

export function personalize(sceneId: string, q: Question, p: Persona): Question {
  switch (sceneId) {
    case 'Q0':
      return { ...q, subtitle: Q0_SUB[p.port] ?? q.subtitle };
    case 'Q1': {
      const key = `${p.port}-${p.sex ?? 'male'}`;
      return { ...q, title: Q1_TITLE[key] ?? q.title };
    }
    case 'Q2':
      return p.age === null ? q : withOptions(q, companionPatches(p));
    case 'Q3': {
      const band = p.band;
      const kidLike = band === 'baby' || band === 'kid';
      const lineKey: 'adult' | 'kid' | 'old' = kidLike ? 'kid' : band === 'old' ? 'old' : 'adult';
      const patches: Record<string, Patch> = {};
      for (const o of q.options) {
        const base = o.description ?? '';
        const extra = [CABIN_AGE_LINE[o.value]?.[lineKey], CABIN_PORT_LINE[p.port]?.[o.value]].filter(Boolean).join(' ');
        patches[o.value] = { description: extra ? `${base} ${extra}` : base };
      }
      const out = withOptions(q, patches);
      return band === 'baby' ? { ...out, title: '엄마 아빠가 당신을 안고 간 곳은 어디였나요?', subtitle: '코끝에 닿는 냄새와 귓가에 들리는 소리로 기억하는 곳을 골라 보세요.' } : out;
    }
    case 'Q5':
      return deckQuestion(q, p);
    case 'Q6':
      return rumorQuestion(q, p, p.cabin);
    case 'Q7':
      return lifeboatQuestion(q, p);
    default:
      return q;
  }
}
