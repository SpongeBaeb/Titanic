import type { CineOption, CineScene } from './cinematic';
import { bagItemNames } from './cinematic';

// 개발용 데모 장면. 문구는 초안이며 역사 검토 전이다(운영 장면으로 쓰지 않는다).
// 구명정 자리 마감 (충돌 후 분, 초안). 첫 하강(+60~65분) 이후 시간표 기준. 귀띔을 받으면 더 늦게까지 가능
const SEAT_DEADLINE = 75;
const CREWTIP_DEADLINE = 85;

export const demoScenes: CineScene[] = [
  {
    id: 'N1', at: 25, title: '구명조끼 착용 안내', bg: '/bg/crash.webp', fx: ['kenburns'],
    story: ({ run, extras }) => [
      { text: '갑판 위, 승무원이 목청을 높여 구명조끼를 입으라고 외칩니다. 그런데 사람들은 웃으며 발밑의 얼음 조각을 줍고 있습니다.' },
      ...(run > 1 ? [{ text: '…이 풍경, 어딘가 낯이 익습니다. 한 번 겪어 본 듯한 기분이 듭니다.', changed: true }] : []),
      ...(bagItemNames(extras).length ? [{ text: `객실에 두고 온 가방 안에서 ${bagItemNames(extras).join(', ')} 같은 물건들이 부딪히던 소리가 떠오릅니다.`, changed: true }] : []),
    ],
    options: ({ run, extras }): CineOption[] => {
      const bagN = bagItemNames(extras).length;
      return [
      { id: 'wake', label: '객실로 돌아가 이웃을 깨운다', echo: 'photo' as const, timeCost: 8, sets: { neighbor: true } },
      { id: 'vest', label: '구명조끼를 입고 곧장 갑판으로 나간다', timeCost: 3, sets: { vest: true } },
      { id: 'wait', label: '다른 사람들이 움직일 때까지 기다린다', timeCost: 12, fx: ['dim'] as const, sets: { waited: true } },
      { id: 'bag', label: bagN > 0 ? `가방 속 물건 ${bagN}개를 챙긴다` : '귀중품과 서류부터 챙긴다', timeCost: 6 + Math.min(bagN, 8), sets: { bag: true } },
      ...(run > 1 ? [{ id: 'crew', label: '이번에는 선원실로 가서 구명정 위치를 먼저 묻는다', tag: 'memory' as const, timeCost: 4, sets: { crewTip: true } }] : []),
      ];
    },
  },
  {
    id: 'N2', at: 65, title: '구명정 줄이 길어짐', bg: '/bg/lifeboat.webp', fx: ['kenburns'],
    story: ({ flags, elapsed = 0 }) => [
      { text: '첫 구명정이 도르래 소리를 내며 내려갑니다. 줄은 길고, 사람들의 숨소리가 거칩니다.' },
      ...(flags.neighbor ? [{ text: '복도에서 깨운 이웃집 아이가 당신의 소매를 꼭 쥐고 있습니다.', changed: true }] : []),
      ...(flags.vest ? [{ text: '구명조끼 덕분에 승무원이 당신을 앞줄로 안내합니다.', changed: true }] : []),
      ...(flags.waited ? [{ text: '기다리는 사이 줄은 이미 길게 늘어졌습니다. 뒤쪽이 웅성거립니다.', changed: true }] : []),
      ...(flags.bag ? [{ text: '무거운 가방 때문에 승무원이 짐은 두고 타라고 합니다.', changed: true }] : []),
      ...(flags.crewTip ? [{ text: '선원이 귀띔해 준 대로, 이쪽 구명정에는 아직 자리가 남아 있습니다.', changed: true }] : []),
      ...(elapsed > SEAT_DEADLINE ? [{ text: '앞쪽 구명정은 이미 가득 찬 채 내려가고 있습니다. 남은 자리는 보이지 않습니다.', changed: true }] : []),
    ],
    options: ({ flags }): CineOption[] => {
      const list: CineOption[] = [
        { id: 'organize', label: '줄을 정리하고 사람들을 안내한다', timeCost: 10, fx: ['shake'] as const, sets: { led: true } },
        { id: 'rule', label: '차례를 기다리며 규칙을 따른다', timeCost: 8, sets: { ruled: true } },
        flags.neighbor
          ? { id: 'child', echo: 'photo' as const, label: '이웃집 아이를 먼저 태운다', tag: 'chain' as const, timeCost: 5, sets: { helpedChild: true } }
          : { id: 'weak', echo: 'photo' as const, label: '곁에 있는 약한 사람부터 앞으로 보낸다', timeCost: 5, sets: { helpedOther: true } },
        { id: 'seat', label: '앞줄에서 자리를 확보한다', tag: flags.vest ? 'chain' as const : undefined, timeCost: 3, until: SEAT_DEADLINE, sets: { boat: true } },
        ...(flags.crewTip ? [{ id: 'boat', label: '귀띔받은 구명정으로 곧장 달려간다', tag: 'memory' as const, timeCost: 2, until: CREWTIP_DEADLINE, sets: { boat: true } }] : []),
        ...(flags.bag ? [{ id: 'drop', label: '가방을 내려놓고 다른 갑판을 찾아 뛴다', tag: 'chain' as const, timeCost: 6, fx: ['shake'] as const, sets: { droppedBag: true } }] : []),
      ];
      return list.slice(0, 6);
    },
  },
  {
    id: 'N3', at: 130, title: '갑판이 기울고 악단이 연주', fx: ['water', 'flicker'],
    // 새 톤(잔잔한 별밤). 임시로 crash 를 쓰고, deck-tilt-2/3 가 추가되면 자동으로 교차 전환된다
    bg: '/bg/crash.webp',
    bgStages: [{ from: 0, url: '/bg/deck-tilt-2.webp' }, { from: 140, url: '/bg/deck-tilt-3.webp' }],
    timer: { seconds: 10, timeoutOption: { id: 'timeout', label: '머뭇거리다 시간이 흘렀다', timeCost: 10, fx: ['dim'] as const, sets: { hesitated: true } } },
    story: ({ flags, elapsed = 0, extras }) => flags.boat
      ? [
          { text: '당신은 구명정에 몸을 싣고 있습니다.', changed: true },
          { text: '노 젓는 소리 너머로, 불이 하나둘 꺼지는 배가 기울어 가는 것이 보입니다. 어디선가 악단의 연주가 희미하게 들려옵니다.' },
        ]
      : [
          { text: '갑판이 눈에 띄게 기울기 시작했습니다. 어디선가 악단의 연주가 들려옵니다. 발밑의 물건들이 한쪽으로 미끄러집니다.' },
          ...(flags.helpedChild ? [{ text: '구명정에 태운 아이가 멀어지며 당신을 돌아봅니다.', changed: true }]
            : flags.neighbor ? [{ text: '깨워 주었던 이웃을 찾아보지만, 사람들 속에서 보이지 않습니다.', changed: true }] : []),
          ...(flags.led ? [{ text: '아까 줄을 정리해 주던 당신을 알아본 사람들이 불안한 얼굴로 쳐다봅니다.', changed: true }] : []),
          ...(flags.droppedBag ? [{ text: extras && bagItemNames(extras).length ? `버리고 온 가방이 저 아래 어딘가에서 굴러가는 소리가 납니다. 안에는 ${bagItemNames(extras).join(', ')}이(가) 들어 있었습니다.` : '버리고 온 가방이 저 아래 어딘가에서 굴러가는 소리가 납니다.', changed: true }] : []),
          ...(elapsed >= 145 ? [{ text: '물이 벌써 갑판 가장자리까지 올라와 있습니다. 더 생각할 시간이 없습니다.', changed: true }] : []),
        ],
    options: ({ flags }): CineOption[] => flags.boat
      ? [
          { id: 'row', label: '배에서 멀어지도록 힘껏 노를 젓는다', timeCost: 4, fx: ['shake'] as const, sets: { rowed: true } },
          { id: 'back', label: '물에 빠진 사람이 있는지 어둠 속을 살핀다', timeCost: 6, sets: { lookedBack: true } },
          { id: 'quiet', label: '아무 말 없이 가라앉는 배를 끝까지 바라본다', timeCost: 8, fx: ['dim'] as const, sets: { watched: true } },
        ]
      : [
          { id: 'hold', echo: 'photo' as const, label: '곁의 사람 손을 잡고 끝까지 함께한다', timeCost: 5, sets: { together: true } },
          { id: 'jump', label: '물에 뛰어들 준비를 한다', timeCost: 2, fx: ['flash'] as const, sets: { jumped: true } },
          { id: 'high', label: '가장 높은 곳에 올라 상황을 살핀다', timeCost: 6, sets: { highGround: true } },
          ...(flags.led ? [{ id: 'leadup', label: '사람들을 이끌어 높은 갑판으로 간다', tag: 'chain' as const, timeCost: 5, sets: { leadUp: true } }] : []),
        ],
  },
];
