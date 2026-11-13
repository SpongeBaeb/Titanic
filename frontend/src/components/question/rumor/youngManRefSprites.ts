// 자동 생성: tools/build_q6_gentref.py young_m (손으로 고치지 말 것)
// 청년 남성 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const YOUNGMAN_REF_SHEET: FallSheet = {
  "src": "/q6/walk/youngmanref.webp?v=06d55fad",
  "rects": [
    [
      0,
      45,
      92,
      361,
      31.5
    ],
    [
      96,
      50,
      204,
      356,
      89.9
    ],
    [
      304,
      56,
      211,
      350,
      119.9
    ],
    [
      519,
      51,
      151,
      355,
      92.2
    ],
    [
      674,
      50,
      154,
      356,
      57.0
    ],
    [
      832,
      51,
      234,
      355,
      63.7
    ],
    [
      1070,
      53,
      386,
      353,
      179.9
    ],
    [
      1460,
      335,
      462,
      71,
      215.1
    ],
    [
      1926,
      0,
      295,
      406,
      106.4
    ],
    [
      2225,
      313,
      441,
      93,
      243.6
    ],
    [
      2670,
      147,
      244,
      259,
      132.7
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
    0.1162,
    0.1162,
    0.1162,
    0.1162
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
