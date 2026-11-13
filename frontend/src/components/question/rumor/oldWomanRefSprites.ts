// 자동 생성: tools/build_q6_gentref.py elder_f (손으로 고치지 말 것)
// 노인 여성 레퍼런스 자세 시트. 주소에 ?gentref 가 있을 때만 RumorView 가 쓴다. 프레임 번호: stand, walk(반 걸음 4장 반복), stagger,
// 앞으로 넘어짐 fallF -> lyingF -> getupF, 뒤로 넘어짐 fallB -> lyingB -> getupB
import type { FallSheet } from './gentRefSprites';
export const OLDWOMAN_REF_SHEET: FallSheet = {
  "src": "/q6/walk/oldwomanref.webp?v=f1bac463",
  "rects": [
    [
      0,
      47,
      120,
      343,
      36.1
    ],
    [
      124,
      39,
      142,
      351,
      57.8
    ],
    [
      270,
      47,
      121,
      343,
      38.3
    ],
    [
      395,
      44,
      123,
      346,
      34.0
    ],
    [
      522,
      42,
      119,
      348,
      36.1
    ],
    [
      645,
      43,
      222,
      347,
      60.0
    ],
    [
      871,
      52,
      371,
      338,
      173.5
    ],
    [
      1246,
      306,
      445,
      84,
      207.5
    ],
    [
      1695,
      0,
      290,
      390,
      107.7
    ],
    [
      1989,
      290,
      423,
      100,
      232.8
    ],
    [
      2416,
      136,
      235,
      254,
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
    0.0511,
    0.0511,
    0.0511,
    0.0511
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
