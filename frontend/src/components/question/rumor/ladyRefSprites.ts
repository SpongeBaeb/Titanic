// 자동 생성: tools/build_q6_gentref.py lady (손으로 고치지 말 것)
// 숙녀 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const LADY_REF_SHEET: FallSheet = {
  "src": "/q6/walk/ladyref.webp?v=1d062c93",
  "rects": [
    [
      0,
      19,
      100,
      371,
      42.7
    ],
    [
      104,
      23,
      179,
      367,
      87.5
    ],
    [
      287,
      26,
      184,
      364,
      109.2
    ],
    [
      475,
      23,
      155,
      367,
      97.6
    ],
    [
      634,
      24,
      137,
      366,
      59.3
    ],
    [
      775,
      22,
      222,
      368,
      60.0
    ],
    [
      1001,
      44,
      371,
      346,
      173.5
    ],
    [
      1376,
      290,
      445,
      100,
      207.5
    ],
    [
      1825,
      0,
      309,
      390,
      126.5
    ],
    [
      2138,
      280,
      423,
      110,
      232.8
    ],
    [
      2565,
      115,
      235,
      275,
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
    0.0955,
    0.0955,
    0.0955,
    0.0955
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
