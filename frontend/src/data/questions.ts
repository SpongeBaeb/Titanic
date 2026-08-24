export interface Option {
  id: string;
  label: string;
  description?: string;
  value: string;
  bgImage?: string;
  bgAlign?: 'left' | 'right' | 'full';
  bgOffset?: string;
}

export interface Question {
  id: string;
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  options: Option[];
}

export const questionsData: Record<string, Question> = {
  Q0: {
    id: 'Q0',
    step: 1,
    totalSteps: 8,
    title: '당신의 성별은 무엇입니까?',
    subtitle: '타이타닉호 탑승을 위해 기본 인적사항이 필요합니다.',
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
    subtitle: '1912년 4월. 승객 명부에 당신의 이름이 기록됩니다.',
    options: [
      { id: 'age_under_10', label: '10세 미만', value: '0-9', bgImage: '/age/10.png', bgAlign: 'left' },
      { id: 'age_10_17', label: '10~17세', value: '10-17', bgImage: '/age/17.png', bgAlign: 'right' },
      { id: 'age_18_29', label: '18~29세', value: '18-29', bgImage: '/age/29.png', bgAlign: 'left' },
      { id: 'age_30_39', label: '30~39세', value: '30-39', bgImage: '/age/39.png', bgAlign: 'right' },
      { id: 'age_40_49', label: '40~49세', value: '40-49', bgImage: '/age/49.png', bgAlign: 'left' },
      { id: 'age_50_59', label: '50~59세', value: '50-59', bgImage: '/age/59.png', bgAlign: 'right' },
      { id: 'age_60_plus', label: '60세 이상', value: '60+', bgImage: '/age/60.png', bgAlign: 'left' },
    ],
  },
  Q2: {
    id: 'Q2',
    step: 3,
    totalSteps: 8,
    title: '누구와 함께 이 여행을 떠났나요?',
    subtitle: '긴 대서양 횡단 여행입니다. 당신은 이 배에 누구와 함께 올랐습니까?',
    options: [
      { id: 'comp_alone', label: '혼자 떠납니다.', description: '누구에게도 맞출 필요 없는 여행. 이번에는 혼자이고 싶었습니다.', value: 'alone', bgImage: '/fellow/1.png', bgOffset: 'ml-[53px] mt-[0px] scale-[1]' },
      { id: 'comp_partner', label: '배우자 또는 연인과 단둘이', description: '새로운 삶을 함께 시작하기 위한 여행입니다.', value: 'partner', bgImage: '/fellow/2.png', bgOffset: 'ml-[30px] mt-[98px] scale-[1]' },
      { id: 'comp_friends', label: '형제자매나 친구들과 함께', description: '혼자라면 재미없죠. 함께 웃고 떠들 사람이 필요합니다.', value: 'friends', bgImage: '/fellow/3.png', bgOffset: 'ml-[-37px] mt-[150px] scale-[1]' },
      { id: 'comp_family', label: '부모님이나 아이들과 함께', description: '여행의 목적지는 중요하지 않습니다. 함께 가는 사람이 더 중요합니다.', value: 'family', bgImage: '/fellow/4.png', bgOffset: 'ml-[-52px] mt-[233px] scale-[1]' },
    ],
  },
  Q3: {
    id: 'Q3',
    step: 4,
    totalSteps: 8,
    title: '거대한 타이타닉호 안,\n당신이 가장 끌리는 분위기는 무엇입니까?',
    subtitle: '거대한 여객선 안에는 저마다의 방식으로 항해를 즐기는 공간들이 있습니다. 당신의 마음이 가장 편안해지는 곳은 어디입니까?',
    options: [
      { id: 'pclass_1', label: '우아한 왈츠와 완벽한 서비스가 있는 곳', description: '크리스탈 샹들리에 아래서 샴페인을 마시며, 비슷한 취향의 사람들과 여유로운 사교를 즐기고 싶습니다.', value: '1', bgImage: '/bg/1.png', bgAlign: 'full' },
      { id: 'pclass_2', label: '조용하고 아늑한 평화로운 휴식처', description: '과도한 격식이나 시끄러운 인파는 피하고 싶습니다. 따뜻한 차 한 잔과 함께 온전히 나만의 조용한 휴식을 즐기는 게 좋습니다.', value: '2', bgImage: '/bg/2.png', bgAlign: 'full' },
      { id: 'pclass_3', label: '웃음소리와 바이올린 선율이 넘치는 활기찬 공간', description: '조금 좁고 덜 화려해도 상관없습니다. 모르는 사람들과도 금방 친구가 되어 땀 흘리며 춤추고 노래하는 낭만이 좋습니다.', value: '3', bgImage: '/bg/3.png', bgAlign: 'full' },
    ],
  },
  Q4: {
    id: 'Q4',
    step: 5,
    totalSteps: 8,
    title: '객실을 정하고도 돈이 조금 남았습니다.',
    subtitle: '이 돈을 어디에 쓰시겠습니까?',
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
    subtitle: '바다는 검고 차갑습니다. 구명정에는 이제 한 자리만 남았습니다. 그런데 당신 뒤에는 아직 배에서 빠져나오지 못한 사람들이 있습니다. 그 순간, 당신은 어떻게 행동합니까?',
    options: [
      { id: 'final_yield_seat', label: '자리를 양보한다.', description: '“아직 다른 구명정이 있습니다.”', value: 'yield_seat' },
      { id: 'final_yield_weak', label: '아이나 노약자에게 양보한다.', description: '“우선순위는 지켜야 합니다.”', value: 'yield_weak' },
      { id: 'final_secure_help', label: '일단 내 자리를 확보하고 주변을 돕는다.', description: '“나까지 살아야 다른 사람을 도울 수 있습니다.”', value: 'secure_mine' },
      { id: 'final_me_first', label: '이번에는 내가 먼저 탄다.', description: '“미안하지만 이번에는 내가 먼저입니다.”', value: 'me_first' },
      { id: 'final_observe', label: '바로 움직이지 않고 상황을 지켜본다.', description: '“아직 끝난 게 아닙니다. 더 안전한 기회가 있을 수 있습니다.”', value: 'observe' },
    ],
  },
};
