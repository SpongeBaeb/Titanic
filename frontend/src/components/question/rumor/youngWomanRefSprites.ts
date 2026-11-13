// 자동 생성: tools/build_q6_gentref.py young_f (손으로 고치지 말 것)
// 청년 여성 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const YOUNGWOMAN_REF_SHEET: FallSheet = {
  "src": "/q6/walk/youngwomanref.webp?v=8ea6343b",
  "rects": [
    [
      0,
      30,
      93,
      360,
      35.4
    ],
    [
      97,
      34,
      178,
      356,
      82.4
    ],
    [
      279,
      39,
      189,
      351,
      109.2
    ],
    [
      472,
      34,
      152,
      356,
      94.7
    ],
    [
      628,
      35,
      134,
      355,
      51.3
    ],
    [
      766,
      34,
      222,
      356,
      60.0
    ],
    [
      992,
      52,
      371,
      338,
      173.5
    ],
    [
      1367,
      305,
      445,
      85,
      207.5
    ],
    [
      1816,
      0,
      294,
      390,
      111.3
    ],
    [
      2114,
      290,
      423,
      100,
      232.8
    ],
    [
      2541,
      127,
      235,
      263,
      128.0
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
    0.1,
    0.1,
    0.1,
    0.1
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
