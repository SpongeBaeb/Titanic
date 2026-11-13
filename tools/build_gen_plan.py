#!/usr/bin/env python3
"""그림 만들기 작업 계획: 인물 7명 x 3단계(걷기 4칸 / 기본 3칸 / 넘어짐 4칸)의 참조 이미지를 폴더로 정리하고, 단계별 절대경로 + 프롬프트 문서를 만든다.
출력: tools/work/gen_plan/{번호}_{인물}/ (1_walk4_*.png, 2_basic3_*.png, 3_falls4_*.png, out/ 폴더), tools/work/gen_plan/gen_plan.md
  기본 3칸 = 서 있기 + 휘청 + 일어나는 중 (2160x576), 넘어짐 4칸 = 앞으로 넘어지는 중 + 엎드림 + 뒤로 넘어지는 중 + 누움 (2880x576)
"""
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_prompts_all as M  # noqa: E402  (프롬프트 문구를 재사용한다)

WORK = os.path.join(HERE, 'work')
OUT = os.path.join(WORK, 'gen_plan')
W, H = 720, 576
ORDER = ['gent', 'lady', 'child', 'elder_m', 'elder_f', 'young_m', 'young_f']
INDEX = {p[0]: p for p in M.P}  # (키, 이름, 걷기 회색, 걷기 부위색, 걷기 프롬프트, 걷기 제외, 서 있기 설명, 서 있기 제외, 6자세 BASE, 6자세 제외)
STAND_TEXT = {
    'gent': "standing still in a relaxed upright posture, feet close together, arms hanging naturally at the sides, calm expression",
    'lady': "standing still, upright and graceful, feet together, forearms held in front of the waist",
    'child': "standing still with feet together and arms at the sides, chin up",
    'elder_m': "standing still with a rounded back and bowed head, knees slightly bent, feet together, leaning on a wooden walking cane planted straight on the ground beside him",
    'elder_f': "standing still with a rounded back and bowed head, feet together, the shawl held closed at the belly with the near hand",
    'young_m': "standing relaxed and confident, feet slightly apart, arms hanging at the sides",
    'young_f': "standing lightly upright, chin level, forearms held in front of the waist",
}
IDENT = "Use the attached character image as the identity reference: the same face, the same clothing and the same proportions in every cell."
CELL = {'F2': (0, 0), 'F4': (1, 0), 'B2': (2, 0), 'B4': (0, 1), 'K2': (1, 1), 'U4': (2, 1)}  # poses6 3x2 시트 안의 칸 위치


def poses_cell(sheet, name):
    cx, cy = CELL[name]
    return sheet.crop((cx * W, cy * H, cx * W + W, cy * H + H))


def row(cells):
    r = Image.new('RGB', (W * len(cells), H), 'white')
    for i, c in enumerate(cells):
        r.paste(c, (i * W, 0))
    return r


def prep(n, who):
    d = os.path.join(OUT, f'{n}_{who}')
    os.makedirs(os.path.join(d, 'out'), exist_ok=True)
    walk_src = os.path.join(WORK, 'walk_ref_all')
    for kind in ('tone', 'parts'):
        shutil.copyfile(os.path.join(walk_src, f'{n}_{who}_walk_{kind}_row.png'), os.path.join(d, f'1_walk4_{kind}.png'))
        stand = Image.open(os.path.join(WORK, 'stand_ref', who, f'stand_{kind}.png')).convert('RGB')
        sheet = Image.open(os.path.join(WORK, 'poses6_ref', who, f'poses6_{kind}.png')).convert('RGB')
        row([stand, poses_cell(sheet, 'K2'), poses_cell(sheet, 'U4')]).save(os.path.join(d, f'2_basic3_{kind}.png'))
        row([poses_cell(sheet, k) for k in ('F2', 'F4', 'B2', 'B4')]).save(os.path.join(d, f'3_falls4_{kind}.png'))
    return d


def basic3_prompt(who):
    base = INDEX[who][8]
    cane = " The cane has been dropped and is not in the picture in cells 2 and 3." if who == 'elder_m' else ""
    return (f"character pose sheet, exactly three equal cells in a single row on a pure white background, same scale and same ground line in every cell. "
            f"{base} Full body side view facing right in every cell, 1912 Edwardian, painterly, simple clean shapes, flat even lighting, no ground shadow. "
            f"Follow the pose reference exactly, cell by cell. The silhouette must read clearly even when filled with solid black. {IDENT}\n"
            f"Cell 1: {STAND_TEXT[who]}.\n"
            f"Cell 2: staggering, one foot lifted, arms out to keep balance.\n"
            f"Cell 3: getting up, one knee on the ground, the other foot planted, one hand on the planted knee.{cane}")


def falls4_prompt(who):
    base = INDEX[who][8]
    return (f"character pose sheet, exactly four equal cells in a single row on a pure white background, same scale and same ground line in every cell. "
            f"{base} Full body side view facing right in every cell, 1912 Edwardian, painterly, simple clean shapes, flat even lighting, no ground shadow. "
            f"Follow the pose reference exactly, cell by cell. The silhouette must read clearly even when filled with solid black. {IDENT}\n"
            f"Cell 1: falling forward, leaning far forward with one foot kicked up behind and both arms stretched ahead.\n"
            f"Cell 2: lying flat face down, legs stretched behind, arms stretched forward.\n"
            f"Cell 3: falling backward, both feet in front off the ground, arms thrown up.\n"
            f"Cell 4: lying flat on the back, legs forward, one arm beside the body and one above the head.")


def main():
    os.makedirs(OUT, exist_ok=True)
    md = ["# 그림 만들기 작업 순서 (7명 × 3단계 = 21단계)\n",
          "인물마다 **① 걷기 4칸 → ② 기본 3칸 → ③ 넘어짐 4칸** 순서로 만듭니다. 한 번에 3~4칸씩이라 품질이 안정됩니다.",
          "- ①이 인물의 기준입니다. ②와 ③을 만들 때는 **①의 결과 그림을 인물 참고로 함께 첨부**합니다(같은 얼굴, 옷, 비율).",
          "- 레퍼런스는 모두 글자 없는 회색 이미지(`*_tone.png`)를 씁니다. 부위 구분이 필요하면 같은 이름의 `*_parts.png`를 함께 첨부합니다.",
          "- 결과는 투명 배경 PNG 또는 흰 배경으로, 각 폴더의 `out` 폴더에 아래 이름으로 저장해 주세요. 저는 그 파일을 읽어 정렬합니다.",
          "- 모든 칸이 같은 크기와 같은 바닥선, 오른쪽을 봅니다. 어두운 밤 장면용이라 검은색으로 채워도 팔다리가 몸에서 떨어져 보여야 합니다(프롬프트에 들어 있음).",
          "- 이미지 크기 안내: ① 2880×576(4칸), ② 2160×576(3칸), ③ 2880×576(4칸). 칸 하나는 720×576입니다.\n",
          "## 작업 목록\n", "| 순서 | 인물 | 단계 | 결과 저장 이름 |", "|---|---|---|---|"]
    step = 0
    body = []
    for n, who in enumerate(ORDER, 1):
        d = prep(n, who)
        name = INDEX[who][1]
        outd = os.path.join(d, 'out')
        steps = [
            ('① 걷기 4칸', '1_walk4', "걷기 한 걸음(착지, 내려앉음, 지나감, 솟음)", INDEX[who][4].strip(), INDEX[who][5], False),
            ('② 기본 3칸 (서 있기, 휘청, 일어나는 중)', '2_basic3', "서 있기, 휘청, 일어나는 중", basic3_prompt(who), '`' + M.EXC6 + (', ' + INDEX[who][9].replace('cane, ', '') if INDEX[who][9] else '') + '`', True),  # 노인 남성은 1번 칸에서 지팡이를 짚으므로 제외어에서 cane 을 뺀다
            ('③ 넘어짐 4칸 (앞으로 넘어지는 중, 엎드림, 뒤로 넘어지는 중, 누움)', '3_falls4', "앞으로 넘어지는 중, 엎드림, 뒤로 넘어지는 중, 누움", falls4_prompt(who), '`' + M.EXC6 + (', ' + INDEX[who][9] if INDEX[who][9] else '') + '`', True),
        ]
        body.append(f"\n---\n\n## {n}. {name}\n")
        for label, key, what, prompt, ex, needs_id in steps:
            step += 1
            md.append(f"| {step} | {name} | {label} | `{os.path.join(outd, key + '.png')}` |")
            body.append(f"### 순서 {step}. {name} — {label}\n")
            body.append("**첨부할 이미지**\n")
            body.append(f"1. 자세 레퍼런스(필수): `{os.path.join(d, key + '_tone.png')}`")
            body.append(f"2. 부위 구분(선택): `{os.path.join(d, key + '_parts.png')}`")
            if needs_id:
                body.append(f"3. 인물 참고(필수, ①의 결과): `{os.path.join(outd, '1_walk4.png')}`")
            body.append(f"\n**입력할 프롬프트**\n\n```\n{prompt}\n```\n제외: {ex}\n")
            body.append(f"**결과 저장**: `{os.path.join(outd, key + '.png')}`\n")
    with open(os.path.join(OUT, 'gen_plan.md'), 'w', encoding='utf-8') as f:
        f.write("\n".join(md) + "\n" + "\n".join(body))
    print('ok steps', step)


if __name__ == '__main__':
    main()
