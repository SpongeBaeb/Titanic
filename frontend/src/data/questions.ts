export interface Option {
  id: string;
  label: string;
  description?: string;
  value: string;
  bgImage?: string;
  bgAlign?: 'left' | 'right' | 'full';
  bgOffset?: string;
  /** 이 승객은 고를 수 없는 선택지: 이유 한 줄 (숨기지 않고 보여 준다) */
  lock?: string;
}

export interface Question {
  id: string;
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  bgImage?: string | ((answers: Record<string, any>) => string);
  options: Option[];
}

export const questionsData: Record<string, Question> = {
  Q0: {
    id: 'Q0',
    step: 1,
    totalSteps: 8,
    title: '당신의 성별은 무엇입니까?',
    subtitle: '거울에 비칠 당신의 모습을 골라 주세요.',
    bgImage: '/bg/bg-titanic.webp',
    options: [
      { id: 'sex_male', label: '남성 (Male)', value: 'male' },
      { id: 'sex_female', label: '여성 (Female)', value: 'female' },
    ],
  },
  Q1: {
    id: 'Q1',
    step: 2,
    totalSteps: 8,
    title: '타이타닉에 오를 당신은 몇 살인가요?',
    subtitle: '1912년 4월, 그곳에 서게 될 당신의 나이를 맞춰 주세요.',
    bgImage: '/bg/bg-titanic.webp',
    options: [
      { id: 'age_under_10', label: '10세 미만', value: '0-9', bgImage: '/age/10.webp', bgAlign: 'left' },
      { id: 'age_10_17', label: '10~17세', value: '10-17', bgImage: '/age/17.webp', bgAlign: 'right' },
      { id: 'age_18_29', label: '18~29세', value: '18-29', bgImage: '/age/29.webp', bgAlign: 'left' },
      { id: 'age_30_39', label: '30~39세', value: '30-39', bgImage: '/age/39.webp', bgAlign: 'right' },
      { id: 'age_40_49', label: '40~49세', value: '40-49', bgImage: '/age/49.webp', bgAlign: 'left' },
      { id: 'age_50_59', label: '50~59세', value: '50-59', bgImage: '/age/59.webp', bgAlign: 'right' },
      { id: 'age_60_plus', label: '60세 이상', value: '60+', bgImage: '/age/60.webp', bgAlign: 'left' },
    ],
  },
  Q2: {
    id: 'Q2',
    step: 3,
    totalSteps: 8,
    title: '누구와 함께 이 여행을 떠났나요?',
    subtitle: '긴 대서양 횡단 여행입니다. 당신은 이 배에 누구와 함께 올랐습니까?',
    bgImage: '/bg/bg-titanic.webp',
    options: [
      { id: 'comp_alone', label: '혼자 떠납니다.', description: '누구에게도 맞출 필요 없는 여행. 이번에는 혼자이고 싶었습니다.', value: 'alone', bgImage: '/fellow/1.webp', bgOffset: 'ml-[53px] mt-[0px] scale-[1]' },
      { id: 'comp_partner', label: '배우자 또는 연인과 단둘이', description: '새로운 삶을 함께 시작하기 위한 여행입니다.', value: 'partner', bgImage: '/fellow/2.webp', bgOffset: 'ml-[30px] mt-[98px] scale-[1]' },
      { id: 'comp_friends', label: '형제자매나 친구들과 함께', description: '혼자라면 재미없죠. 함께 웃고 떠들 사람이 필요합니다.', value: 'friends', bgImage: '/fellow/3.webp', bgOffset: 'ml-[-37px] mt-[150px] scale-[1]' },
      { id: 'comp_family', label: '부모님이나 아이들과 함께', description: '여행의 목적지는 중요하지 않습니다. 함께 가는 사람이 더 중요합니다.', value: 'family', bgImage: '/fellow/4.webp', bgOffset: 'ml-[-52px] mt-[233px] scale-[1]' },
    ],
  },
  // ── 강아지 시점 분기 (문구 초안). 배경은 public/bg/dog_q1~q4.webp ──
  DQ0: {
    id: 'DQ0',
    step: 3,
    totalSteps: 8,
    title: '끊어진 목줄',
    bgImage: '/bg/dog_q1.webp',
    options: [],
  },
  DQ1: {
    id: 'DQ1',
    step: 3,
    totalSteps: 8,
    title: '발밑의 세계',
    subtitle: '끊어진 줄을 끌며 당신은 수많은 다리 사이를 헤맵니다. 주인의 라벤더 향이 점점 옅어집니다. 그때 짠 내 나는 거친 손이 당신을 번쩍 들어 올립니다. 작업복 차림의 소년 선원입니다. "줄 끊긴 녀석이 여기 있었네. 일단 개집으로 가자."',
    bgImage: '/bg/dog_q1.webp',
    options: [
      { id: 'dog_trust', label: '소년의 품에 얌전히 안겨, 짠 내 나는 팔에 코를 묻는다', value: 'trust' },
      { id: 'dog_bite', label: '소맷자락을 물고 버티며 있는 힘껏 짖는다', value: 'bite' },
      { id: 'dog_struggle', label: '라벤더 향이 사라진 쪽으로 몸부림쳐 빠져나가려 한다', value: 'struggle' },
    ],
  },
  DQ2: {
    id: 'DQ2',
    step: 5,
    totalSteps: 8,
    title: '개집의 날들',
    subtitle: '',
    bgImage: '/bg/dog_q2.webp',
    options: [
      { id: 'dog_befriend', label: "캡틴 곁으로 다가가 함께 바닥의 떨림에 귀를 기울인다", value: 'befriend' },
      { id: 'dog_share', label: '숨겨 둔 간식을 창살 사이로 밀어 캡틴과 나눈다', value: 'share' },
      { id: 'dog_ignore', label: '주인의 목소리만 기다리며 구석에서 눈을 감는다', value: 'ignore' },
    ],
  },
  DQ3: {
    id: 'DQ3',
    step: 6,
    totalSteps: 8,
    title: '4월 14일 밤, 개집',
    subtitle: '',
    bgImage: '/bg/dog_q2_night.webp',
    options: [
      { id: 'dog_bark', label: '개집 전체가 함께 울도록 목청껏 짖어 톰을 부른다', value: 'bark' },
      { id: 'dog_scratch', label: '빗장에 걸린 끈을 앞발로 끌어당겨 스스로 문을 연다', value: 'scratch' },
      { id: 'dog_wait', label: '캡틴 곁에 바짝 붙어 숨을 죽이고 기다린다', value: 'wait' },
    ],
  },
  DQ4: {
    id: 'DQ4',
    step: 7,
    totalSteps: 8,
    title: '발소리의 강물',
    subtitle: '',
    bgImage: '/bg/dog_q3.webp',
    options: [
      { id: 'dog_scent', label: '라벤더 향을 코로 쫓아 사람들 다리 사이를 뚫고 달린다', value: 'scent' },
      { id: 'dog_tom', label: '톰이 부르는 휘파람 소리를 따라 그의 품으로 간다', value: 'tom' },
      { id: 'dog_captain', label: '느린 캡틴의 어깨를 밀며 함께 천천히 올라간다', value: 'captain' },
    ],
  },
  DQ5: {
    id: 'DQ5',
    step: 8,
    totalSteps: 8,
    title: '물가의 어둠',
    subtitle: '',
    bgImage: (a) => (a.dogDeck === 'tom' ? '/bg/dog_q5_tom.webp' : a.dogDeck === 'captain' ? '/bg/dog_q5_captain.webp' : '/bg/dog_q4.webp'),
    options: [
      { id: 'dog_leap', label: '라벤더 향 속으로, 주인의 품을 향해 힘껏 뛰어든다', value: 'leap' },
      { id: 'dog_call', label: '구명정이 멈출 때까지 있는 힘껏 짖는다', value: 'call' },
      { id: 'dog_accept', label: '톰의 마지막 눈빛을 삼키며 낯선 부인의 품에 안긴다', value: 'accept' },
      { id: 'dog_return', label: '낯선 품을 뿌리치고 톰의 팔로 다시 뛰어내린다', value: 'return' },
      { id: 'dog_turn', label: '캡틴을 두고 갈 수 없어, 그의 곁에 앉는다', value: 'turn' },
      { id: 'dog_abandon', label: '캡틴의 눈을 피한 채 구명정을 향해 뛴다', value: 'abandon' },
    ],
  },
  Q3: {
    id: 'Q3',
    step: 4,
    totalSteps: 8,
    title: '거대한 타이타닉호 안,\n당신이 가장 끌리는 분위기는 무엇입니까?',
    subtitle: '마음이 가장 편안해지는 곳을 골라 보세요.',
    bgImage: '/bg/where.webp',
    options: [
      { id: 'pclass_1', label: '우아한 왈츠와 완벽한 서비스가 있는 곳', description: '크리스탈 샹들리에 아래서 샴페인을 마시며, 비슷한 취향의 사람들과 여유로운 사교를 즐기고 싶습니다.', value: '1', bgImage: '/bg/1.webp', bgAlign: 'full' },
      { id: 'pclass_2', label: '조용하고 아늑한 평화로운 휴식처', description: '과도한 격식이나 시끄러운 인파는 피하고 싶습니다. 따뜻한 차 한 잔과 함께 온전히 나만의 조용한 휴식을 즐기는 게 좋습니다.', value: '2', bgImage: '/bg/2.webp', bgAlign: 'full' },
      { id: 'pclass_3', label: '웃음소리와 바이올린 선율이 넘치는 활기찬 공간', description: '조금 북적여도 상관없습니다. 모르는 사람들과도 금방 친구가 되어 땀 흘리며 춤추고 노래하는 낭만이 좋습니다.', value: '3', bgImage: '/bg/3.webp', bgAlign: 'full' },
    ],
  },
  Q4: {
    id: 'Q4',
    step: 5,
    totalSteps: 8,
    title: '여유자금이 조금 남았습니다.',
    subtitle: '이 돈을 어디에 쓰시겠습니까?',
    bgImage: (answers) => answers.pclass ? `/bg/${answers.pclass}.webp` : '/bg/bg-dock.webp',
    options: [
      { id: 'fare_luxury', label: '배에서 더 좋은 것을 즐긴다.', description: '좋은 식사와 술, 편안한 서비스. 여행은 아끼려고 하는 게 아니니까요.', value: 'luxury' },
      { id: 'fare_balance', label: '적당히 즐기고 나머지는 남긴다.', description: '여행도 중요하지만 미국에 도착한 뒤가 더 중요합니다.', value: 'balance' },
      { id: 'fare_save', label: '최대한 아껴서 미국에서 쓴다.', description: '배에서 돈을 쓸 이유가 있나요? 진짜 인생은 도착한 다음부터 시작입니다.', value: 'save' },
    ],
  },
  Q5: {
    id: 'Q5',
    step: 6,
    totalSteps: 8,
    title: '당신은 무엇을 위해 미국으로 가나요?',
    subtitle: '저녁 식사가 끝났습니다. 난간에 기대어 대서양을 바라봅니다. 문득 생각합니다. “나는 왜 이 배를 탔을까?”',
    bgImage: '/bg/railing.webp',
    options: [
      { id: 'purp_experience', label: '예술과 미식, 그리고 새로운 경험', description: '아름다운 것과 맛있는 것을 찾아 떠나는 여행. 인생은 즐기기 위해 있는 거니까요.', value: 'experience' },
      { id: 'purp_stability', label: '평범한 일상에서 잠시 벗어나기 위해', description: '큰 변화보다는 잠시 쉬어가는 여행. 돌아갈 일상이 있다는 것도 나쁘지 않습니다.', value: 'stability' },
      { id: 'purp_change', label: '인생을 완전히 바꾸기 위해', description: '익숙한 모든 것을 뒤로하고 미국에서 새로운 삶을 시작합니다.', value: 'change' },
    ],
  },
  Q6: {
    id: 'Q6',
    step: 7,
    totalSteps: 8,
    title: '이상한 소문이 돌기 시작합니다.',
    subtitle: '밤이 깊어졌습니다. 복도에서 사람들이 웅성거리기 시작합니다. “빙산과 부딪혔다는 소문이 있대.” 아직 정확한 상황은 아무도 모릅니다. 당신은 가장 먼저 무엇을 합니까?',
    bgImage: '/bg/crash.webp',
    options: [
      { id: 'rumor_calm', label: '주변 사람들을 진정시킨다.', description: '“일단 진정하세요. 상황부터 알아봅시다.”', value: 'calm_others' },
      { id: 'rumor_crew', label: '선원에게 직접 상황을 확인한다.', description: '소문은 믿지 않습니다. 정확한 정보부터 확인해야 합니다.', value: 'check_crew' },
      { id: 'rumor_escape', label: '구명조끼와 탈출 경로부터 확인한다.', description: '다른 건 나중입니다. 일단 내가 살아야 합니다.', value: 'check_escape' },
      { id: 'rumor_follow', label: '사람들이 움직이는 방향을 따라간다.', description: '저렇게 많은 사람들이 움직인다면 뭔가 이유가 있을 겁니다.', value: 'follow_crowd' },
    ],
  },
  Q7: {
    id: 'Q7',
    step: 8,
    totalSteps: 8,
    title: '구명정 앞에 도착했습니다.',
    subtitle: '구명정은 거의 비어 있습니다. 장교가 랜턴을 들고 외칩니다. "여자와 아이부터입니다!" 빈자리는 많지만, 당신 뒤에는 아직 배에서 빠져나오지 못한 사람들이 있습니다. 그 순간, 당신은 어떻게 행동합니까?',
    bgImage: '/bg/lifeboat.webp',
    options: [
      { id: 'final_yield_seat', label: '자리를 양보한다.', description: '“아직 다른 구명정이 있습니다.”', value: 'yield_seat' },
      { id: 'final_yield_weak', label: '아이를 두 손으로 들어 구명정에 태운다.', description: '“이 아이부터요.”', value: 'yield_weak' },
      { id: 'final_secure_help', label: '일단 내 자리를 확보하고 주변을 돕는다.', description: '“나까지 살아야 다른 사람을 도울 수 있습니다.”', value: 'secure_mine' },
      { id: 'final_me_first', label: '이번에는 내가 먼저 탄다.', description: '“미안하지만 이번에는 내가 먼저입니다.”', value: 'me_first' },
      { id: 'final_observe', label: '바로 움직이지 않고 상황을 지켜본다.', description: '“아직 끝난 게 아닙니다. 더 안전한 기회가 있을 수 있습니다.”', value: 'observe' },
    ],
  },
  // ── Q7 뒤의 갈래: 탑승(B1) / 미탑승(W1 → W2). 점수와 서버에는 쓰이지 않는다 ──
  B1: {
    id: 'B1',
    step: 8,
    totalSteps: 8,
    title: '구명정이 가라앉고 있습니다.',
    subtitle: '배가 사라진 뒤, 구명정 바닥으로 바닷물이 차오릅니다. 너무 많은 사람, 너무 많은 짐. 노를 젓던 손들이 멈췄습니다. 누군가 외칩니다. "무게를 줄여야 합니다!"',
    bgImage: '/bg/boat_sea.webp',
    options: [
      { id: 'boat_supplies', label: '마지막 비상 식량 상자와 체온 유지용 덮개를 바다로 던진다.', description: '“당장 뜨는 게 먼저입니다. 먹을 건 나중 문제입니다.”', value: 'supplies' },
      { id: 'boat_injured', label: '이미 의식을 잃은 중상자를 바다로 내보낸다.', description: '“…이 사람은 이미…” 누구도 끝까지 말하지 못합니다.', value: 'injured' },
      { id: 'boat_belongings', label: '내 소지품과 겉옷, 신발까지 모두 던진다.', description: '“내 것부터 내놓겠습니다.”', value: 'belongings' },
    ],
  },
  W1: {
    id: 'W1',
    step: 8,
    totalSteps: 8,
    title: '곁에 주저앉은 승객이 묻습니다.',
    subtitle: '갑판이 점점 기웁니다. 떨리는 목소리가 당신을 올려다봅니다. "구명선이… 곧 우리를 구하러 되돌아오겠지요?"',
    bgImage: '/bg/crash.webp',
    options: [
      { id: 'words_lie', label: '“네, 조금만 참으면 구명선이 올 겁니다.”', description: '거짓말이라도, 편안하게 보내 드리고 싶습니다.', value: 'lie' },
      { id: 'words_truth', label: '“아니요, 구명선은 돌아오지 않습니다. 우리는 여기서 죽습니다.”', description: '끝까지 현실을 마주 보게 합니다.', value: 'truth' },
      { id: 'words_hold', label: '아무 말 없이 손을 잡아 준다.', description: '대답 대신, 체온을 건넵니다.', value: 'hold' },
      { id: 'words_curse', label: '“…씨발, 그걸 왜 나한테 물어요!”', description: '참았던 말이 터져 나옵니다.', value: 'curse' },
      { id: 'words_jump', label: '바다로 뛰어든다.', description: '“…먼저 가겠습니다.”', value: 'jump' },
    ],
  },
  WB: {
    id: 'WB',
    step: 8,
    totalSteps: 8,
    title: '구명정이 떠났습니다.',
    subtitle: '',
    options: [],
  },
  W2: {
    id: 'W2',
    step: 8,
    totalSteps: 8,
    title: '물이 턱밑까지 차올랐습니다.',
    subtitle: '발밑의 갑판이 거의 서 있습니다. 얼음 같은 바다에 뛰어들면 몇 분 안에 몸이 굳어 갑니다. 배에 그대로 남으면 선체와 함께 끌려 내려갑니다. 당신은 어떻게 합니까?',
    bgImage: '/bg/crash.webp',
    options: [
      { id: 'way_swim', label: '끝까지 구명선의 불빛을 찾아 헤엄친다.', description: '“한 번만 더. 저 불빛까지만.”', value: 'swim' },
      { id: 'way_jump', label: '바다로 뛰어든다.', description: '“적어도 내 발로 들어갑니다.”', value: 'jump' },
      { id: 'way_sink', label: '배에 몸을 맡기고 가라앉는다.', description: '“이 배와 끝까지 함께하겠습니다.”', value: 'sink' },
    ],
  },
};
