#!/usr/bin/env python3
"""인물 7명 프롬프트 모음 생성: 서 있기 1칸 + 걷기 4칸(기존 프롬프트 파일에서 가져옴) + 넘어짐·일어남 6칸. 출력 tools/work/stand_ref/prompts_all.md"""
import os
import re

W = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')


def blocks(path):
    t = open(os.path.join(W, path), encoding='utf-8').read()
    return re.findall(r"```\n(.*?)```", t, flags=re.S), t


def excl(t):
    return re.findall(r"^(?:공통 )?제외:?\s*(`.*?`)\s*$", t, flags=re.M)


g, gt = blocks('gent_refA/prompt_refA.md')
l, lt = blocks('lady_ref/prompt_lady.md')
c, ct = blocks('child_ref/prompt_child.md')
e, et = blocks('elder_ref/prompt_elder.md')
y, yt = blocks('young_ref/prompt_young.md')
eg, el, ec, ee, ey = excl(gt), excl(lt), excl(ct), excl(et), excl(yt)

COMMON_STAND = ("character sprite, exactly one frame on a pure white background, full body side view facing right, "
                "1912 Edwardian, painterly, simple clean shapes, flat even lighting, no ground shadow. "
                "Follow the pose reference exactly. The silhouette must read clearly even when filled with solid black: "
                "the arms and legs stay separated from the body outline.")
EXC_STAND = "walking, running, front view, back view, cropped, extra figures, text, watermark, background scenery, ground shadow"
POSES6 = ("character pose sheet, six equal cells in a grid of 3 columns and 2 rows on a pure white background, one pose per cell, "
          "same scale and same ground line in every cell. "
          "{BASE} Full body side view facing right in every cell, 1912 Edwardian, painterly, simple clean shapes, flat even lighting, "
          "no ground shadow. Follow the pose reference exactly, cell by cell. "
          "The silhouette must read clearly even when filled with solid black.\n"
          "Cell 1: falling forward, leaning far forward with one foot kicked up behind and both arms stretched ahead.\n"
          "Cell 2: lying flat face down, legs stretched behind, arms stretched forward.\n"
          "Cell 3: falling backward, both feet in front off the ground, arms thrown up.\n"
          "Cell 4: lying flat on the back, legs forward, one arm beside the body and one above the head.\n"
          "Cell 5: staggering, one foot lifted, arms out to keep balance.\n"
          "Cell 6: getting up, one knee on the ground, the other foot planted, one hand on the planted knee.")
EXC6 = "front view, back view, cropped, extra figures, text, watermark, background scenery, ground shadow, blood, gore"

# (키, 이름, 걷기 회색, 걷기 부위색, 걷기 프롬프트, 걷기 제외, 서 있기 설명, 서 있기 제외 추가, 6자세 BASE, 6자세 제외 추가)
P = [
    ('gent', '신사 (중년 남성)', 'gent_ref_kit/walk_tone_row.png', 'gent_ref_kit/walk_parts_row.png', g[0], eg[0],
     "A middle-aged gentleman, late forties, short trimmed graying mustache, long dark charcoal wool frock coat to the knees, "
     "waistcoat, round black bowler hat, dark trousers, black leather shoes, standing still in a relaxed upright posture, "
     "feet close together, arms hanging naturally at the sides, calm expression.", "",
     "The same middle-aged gentleman in every cell, late forties, short trimmed graying mustache, long dark charcoal wool frock coat "
     "to the knees, waistcoat, round black bowler hat (the hat stays on), dark trousers, black leather shoes.", "cane, umbrella, beard"),
    ('lady', '숙녀 (중년 여성)', 'lady_ref/walk_tone_row.png', 'lady_ref/walk_parts_row.png', l[0], el[0],
     "A middle-aged lady, late thirties, hair pinned in a low bun, wide-brimmed hat with a single tall feather, fitted dark jacket "
     "with a high collar, long dark skirt down to the ankles with only the tips of the black boots showing, standing still, "
     "upright and graceful, feet together, forearms held in front of the waist.", "",
     "The same middle-aged lady in every cell, late thirties, hair pinned in a low bun, wide-brimmed hat with a single tall feather "
     "(the hat stays on), fitted dark jacket with a high collar, long dark skirt to the ankles, black boots.",
     "trousers, short skirt, parasol, long loose hair"),
    ('child', '어린이 (남녀 공용, 청소년도 같은 시트)', 'child_ref/walk_tone_row.png', 'child_ref/walk_parts_row.png', c[0], ec[0],
     "A child about eight years old, boy-or-girl neutral look, bare head with short tidy hair, short dark jacket to the hips, "
     "knee-length breeches, long dark stockings, small black boots, large head compared to the body, short legs and arms, "
     "standing still with feet together and arms at the sides, chin up.", "",
     "The same child in every cell, about eight years old, boy-or-girl neutral look, bare head with short tidy hair, short dark jacket "
     "to the hips, knee-length breeches, long dark stockings, small black boots, large head compared to the body, short legs and arms.",
     "hat, cap, adult proportions, skirt, dress"),
    ('elder_m', '노인 남성', 'elder_ref/male/walk_tone_row.png', 'elder_ref/male/walk_parts_row.png', e[0], ee[0],
     "An elderly man about seventy-five, short white beard, round black bowler hat, long dark charcoal wool overcoat, dark trousers, "
     "black leather shoes, standing still with a rounded back and bowed head, knees slightly bent, feet together, leaning on a "
     "wooden walking cane planted straight on the ground beside him.", "umbrella, glasses, long beard",
     "The same elderly man in every cell, about seventy-five, short white beard, round black bowler hat (the hat stays on), "
     "long dark charcoal wool overcoat, dark trousers, black leather shoes. The cane has been dropped and is not in the picture.",
     "cane, umbrella, glasses"),
    ('elder_f', '노인 여성', 'elder_ref/female/walk_tone_row.png', 'elder_ref/female/walk_parts_row.png', e[1], ee[0],
     "An elderly woman about seventy-five, gray hair in a small bun under a plain cloth bonnet, a heavy wool shawl draped over the "
     "shoulders and hanging down the back, its edge held closed at the belly with the near hand, long dark skirt to the ankles with "
     "only the tips of the black boots showing, standing still with a rounded back and bowed head, feet together.",
     "wide-brimmed hat, feather, trousers, short skirt, cane",
     "The same elderly woman in every cell, about seventy-five, gray hair in a small bun under a plain cloth bonnet (the bonnet stays on), "
     "a heavy wool shawl draped over the shoulders and hanging down the back, long dark skirt to the ankles, black boots.",
     "wide-brimmed hat, trousers, short skirt, cane"),
    ('young_m', '청년 남성', 'young_ref/male/walk_tone_row.png', 'young_ref/male/walk_parts_row.png', y[0], ey[0],
     "A young man about twenty-five, clean-shaven, dark wool flat cap with a short brim, a short dark sack jacket ending at mid-thigh "
     "over a waistcoat and white shirt, plain dark trousers, black leather boots, standing relaxed and confident, feet slightly apart, "
     "arms hanging at the sides.", "",
     "The same young man in every cell, about twenty-five, clean-shaven, dark wool flat cap with a short brim (the cap stays on), "
     "a short dark sack jacket ending at mid-thigh over a waistcoat and white shirt, plain dark trousers, black leather boots.",
     "bowler hat, top hat, long coat, beard"),
    ('young_f', '청년 여성', 'young_ref/female/walk_tone_row.png', 'young_ref/female/walk_parts_row.png', y[1], ey[1],
     "A young woman about twenty-five, dark hair in a Gibson-girl updo with a large soft bun on top, no hat, a high-collared blouse "
     "under a fitted dark jacket, a slim long skirt down to the ankles with only the tips of the black boots showing, "
     "standing lightly upright, chin level, forearms held in front of the waist.", "",
     "The same young woman in every cell, about twenty-five, dark hair in a Gibson-girl updo with a large soft bun on top, no hat, "
     "a high-collared blouse under a fitted dark jacket, a slim long skirt to the ankles, black boots.",
     "hat, wide-brimmed hat, trousers, short skirt, wide skirt"),
]

out = ["# 인물 7명 프롬프트 모음 (서 있기 1칸 + 걷기 4칸 + 넘어짐·일어남 6칸)\n",
       "게임 시트는 인물마다 **11칸**입니다: 서 있기 1 + 걷기 4(멈추면 서 있기, 움직이면 걷기 4칸 반복) + 넘어짐·일어남 6자세"
       "(휘청, 앞으로 쏠림, 엎드림, 뒤로 넘어짐, 누움, 일어나는 중). "
       "넘어질 때는 휘청 → 쏠림(또는 뒤로 넘어짐) → 누워 있음 → 일어나는 중 순서로 보여 줍니다.\n",
       "## 받는 방법\n",
       "- **서 있기**: `stand_ref/<인물>/stand_tone.png`(720×576) 한 칸을 첨부해 한 장으로 받습니다. **먼저 만드세요**(인물의 옷, 얼굴, 비율의 기준).",
       "- **걷기 4칸**: 가로 4칸 한 장(2880×576)을 `*_tone_row.png`로 첨부해 한 번에 받습니다. 부위 구분이 필요하면 `*_parts_row.png`.",
       "- **넘어짐·일어남 6칸**: `poses6_ref/<인물>/poses6_tone.png`(3열×2행, 2160×1152)를 첨부해 한 장으로 받습니다.",
       "- 투명 배경 PNG 또는 흰 배경. 모든 칸이 같은 크기와 같은 바닥선, 오른쪽을 봅니다. 정렬과 잘라내기는 제가 합니다.",
       "- 세 가지 그림이 **같은 인물**이어야 합니다. 서 있기 그림을 걷기와 6자세 프롬프트에 인물 참고로 함께 넣으세요.",
       "- 어두운 밤 장면이라 검은색으로 채워도 팔과 다리가 몸에서 떨어져 보여야 합니다(프롬프트에 넣어 두었습니다).",
       "- 노인 남성은 걷기에서는 지팡이를 짚고, 넘어지는 6자세에서는 지팡이를 놓습니다.\n",
       "## 레퍼런스 파일 위치(모두 `tools/work/` 아래)\n",
       "| 인물 | 서 있기 | 걷기 4칸(회색) | 걷기 4칸(부위별 색) | 6자세(회색) |", "|---|---|---|---|---|"]
for k, name, wt, wp, wb, we, sd, sx, base, x6 in P:
    out.append(f"| {name} | `stand_ref/{k}/stand_tone.png` | `{wt}` | `{wp}` | `poses6_ref/{k}/poses6_tone.png` |")
out.append("\n전체 비교: `stand_ref/stand_overview_tone.png`, `stand_ref/stand_overview_parts.png`, "
           "`poses6_ref/poses6_overview_tone.png`, `poses6_ref/poses6_overview_parts.png`\n")
for k, name, wt, wp, wb, we, sd, sx, base, x6 in P:
    sx_all = EXC_STAND + (', ' + sx if sx else '')
    x6_all = EXC6 + (', ' + x6 if x6 else '')
    out.append(f"## {name}\n")
    out.append(f"### 서 있기 1칸\n```\n{COMMON_STAND}\n{sd}\n```\n제외: `{sx_all}`\n")
    out.append(f"### 걷기 4칸\n```\n{wb.strip()}\n```\n제외: {we}\n")
    out.append(f"### 넘어짐·일어남 6칸\n```\n{POSES6.format(BASE=base)}\n```\n제외: `{x6_all}`\n")
open(os.path.join(W, 'stand_ref', 'prompts_all.md'), 'w', encoding='utf-8').write("\n".join(out))
print('ok', sum(len(x) for x in out))
