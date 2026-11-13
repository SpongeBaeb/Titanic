// 자동 생성: tools/build_q6_gentref.py child (손으로 고치지 말 것)
// 어린이(성별 무관) 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const CHILD_REF_SHEET: FallSheet = {
  "src": "/q6/walk/childref.webp?v=6de97009",
  "rects": [
    [
      0,
      25,
      82,
      340,
      29.6
    ],
    [
      86,
      29,
      178,
      336,
      78.9
    ],
    [
      268,
      33,
      185,
      332,
      104.7
    ],
    [
      457,
      29,
      138,
      336,
      87.3
    ],
    [
      599,
      29,
      135,
      336,
      56.1
    ],
    [
      738,
      29,
      201,
      336,
      53.1
    ],
    [
      943,
      52,
      341,
      313,
      160.1
    ],
    [
      1288,
      293,
      409,
      72,
      190.4
    ],
    [
      1701,
      0,
      274,
      365,
      106.2
    ],
    [
      1979,
      282,
      390,
      83,
      214.7
    ],
    [
      2373,
      108,
      227,
      257,
      118.4
    ]
  ],
  "stand": [
    0
  ],
  "walk": [
    1,
    2,
    3,
    4
  ],
  "back": [],
  "stagger": [
    5
  ],
  "getup": [
    10
  ],
  "walkDist": [
    0.0956,
    0.0956,
    0.0956,
    0.0956
  ],
  "fallF": [
    5,
    6
  ],
  "lyingF": 7,
  "getupF": [
    10
  ],
  "fallB": [
    5,
    8
  ],
  "lyingB": 9,
  "getupB": [
    10
  ]
};
