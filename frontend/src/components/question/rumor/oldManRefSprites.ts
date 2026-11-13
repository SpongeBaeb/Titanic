// 자동 생성: tools/build_q6_gentref.py elder_m (손으로 고치지 말 것)
// 노인 남성 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const OLDMAN_REF_SHEET: FallSheet = {
  "src": "/q6/walk/oldmanref.webp?v=52384063",
  "rects": [
    [
      0,
      45,
      90,
      361,
      25.5
    ],
    [
      94,
      35,
      157,
      371,
      66.7
    ],
    [
      255,
      45,
      109,
      361,
      43.5
    ],
    [
      368,
      43,
      90,
      363,
      25.5
    ],
    [
      462,
      42,
      119,
      364,
      40.5
    ],
    [
      585,
      40,
      234,
      366,
      63.7
    ],
    [
      823,
      53,
      386,
      353,
      179.9
    ],
    [
      1213,
      325,
      462,
      81,
      215.1
    ],
    [
      1679,
      0,
      301,
      406,
      111.7
    ],
    [
      1984,
      315,
      441,
      91,
      243.6
    ],
    [
      2429,
      131,
      244,
      275,
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
    0.0611,
    0.0611,
    0.0611,
    0.0611
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
