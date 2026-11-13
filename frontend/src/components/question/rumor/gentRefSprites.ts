// 자동 생성: tools/build_q6_gentref.py gent (손으로 고치지 말 것)
// 신사 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { WalkSheet } from './walkSprites';
export interface FallSheet extends WalkSheet { fallF: number[]; lyingF: number; getupF: number[]; fallB: number[]; lyingB: number; getupB: number[]; noBob?: boolean; nightSrc?: string; shadow?: { src: string; rects: [number, number, number, number, number, number][]; rectsFlip?: [number, number, number, number, number, number][] } }
export const GENT_REF_SHEET: FallSheet = {
  "src": "/q6/walk/gentref.webp?v=12e9a574",
  "rects": [
    [
      0,
      35,
      94,
      371,
      33.0
    ],
    [
      98,
      40,
      205,
      366,
      89.9
    ],
    [
      307,
      46,
      229,
      360,
      119.9
    ],
    [
      540,
      39,
      164,
      367,
      86.2
    ],
    [
      708,
      39,
      149,
      367,
      47.2
    ],
    [
      861,
      40,
      234,
      366,
      63.7
    ],
    [
      1099,
      53,
      386,
      353,
      179.9
    ],
    [
      1489,
      325,
      462,
      81,
      215.1
    ],
    [
      1955,
      0,
      301,
      406,
      111.7
    ],
    [
      2260,
      315,
      441,
      91,
      243.6
    ],
    [
      2705,
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
    0.1203,
    0.1203,
    0.1203,
    0.1203
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
