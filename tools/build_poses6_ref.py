#!/usr/bin/env python3
"""인물 7명의 넘어짐·일어남 6자세 레퍼런스 (3열 x 2행, 칸 720x576, 오른쪽을 본다): 한 동작에 한 장씩 추린 자세.
 1 앞으로 넘어지는 중(F2) / 2 엎드려 쓰러짐(F4) / 3 뒤로 넘어지는 중(B2) / 4 누워 쓰러짐(B4) / 5 휘청, 버팀(K2) / 6 일어나는 중(U4)
출력 tools/work/poses6_ref/{who}/poses6_{tone,parts,black}.png (2160x1152, 글자 없음), poses6_tone_labeled.png, 전체 비교 poses6_overview_{tone,parts}.png
사용: python -I build_poses6_ref.py [who]   (인물마다 체형 설정이 달라 인물별로 따로 실행한다. 인자가 없으면 7명 모두)
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
WHOS = ['gent', 'lady', 'child', 'elder_m', 'elder_f', 'young_m', 'young_f']
LABEL = {'gent': '신사', 'lady': '숙녀', 'child': '어린이', 'elder_m': '노인 남성', 'elder_f': '노인 여성', 'young_m': '청년 남성', 'young_f': '청년 여성'}
PICK = [('F2 쏠림', '앞으로 넘어지는 중'), ('F4 엎드림', '엎드려 쓰러짐'), ('B2 허공', '뒤로 넘어지는 중'), ('B4 드러누움', '누워 쓰러짐'), ('K2 휘청', '휘청, 버팀'), ('U4 한 무릎 세움', '일어나는 중')]
OUT = os.path.join(HERE, 'work', 'poses6_ref')


def one(who):
    import importlib
    import gent_pose_kit as K
    import build_gentleman_poses as BP
    from PIL import Image, ImageDraw
    if who == 'gent':
        K.STYLE, K.OPTS = 'gent', set()
    elif who == 'lady':
        K.STYLE, K.OPTS = 'lady', set()
    elif who == 'child':
        import build_child_ref  # noqa: F401  어린이 체형·스타일을 켠다
        importlib.reload(BP)
    elif who == 'elder_m':
        K.STYLE, K.OPTS = 'gent', {'beard'}            # 넘어질 때는 지팡이를 놓는다(굽은 등 외투 처리는 서 있을 때만)
    elif who == 'elder_f':
        K.STYLE, K.OPTS = 'lady', {'bonnet', 'shawl'}
    elif who == 'young_m':
        K.STYLE, K.OPTS = 'gent', {'jacket', 'flatcap'}
    else:
        K.STYLE, K.OPTS = 'lady', {'updo', 'slim'}
    allf = {lb: (P, l) for _, frs in BP.SEQ for lb, P, l in frs}
    W, H = K.CW, K.CH
    os.makedirs(os.path.join(OUT, who), exist_ok=True)
    f = BP.font(32)
    for kind in ('tone', 'parts', 'black'):
        g = Image.new('RGB', (W * 3, H * 2), 'white'); lab = g.copy(); d = ImageDraw.Draw(lab)
        for i, (lb, nm) in enumerate(PICK):
            P, l = allf[lb]; im = K.render(P, kind, l)
            x, y = (i % 3) * W, (i // 3) * H
            g.paste(im, (x, y)); lab.paste(im, (x, y)); d.text((x + 16, y + 10), f'{i + 1} {nm}', fill=(200, 50, 40), font=f)
        g.save(os.path.join(OUT, who, f'poses6_{kind}.png'))
        if kind == 'tone':
            lab.resize((W * 3 // 2, H)).save(os.path.join(OUT, who, 'poses6_tone_labeled.png'))
    print('ok', who)


def overview():
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 30)
    for kind in ('tone', 'parts'):
        cw, chh = 180, 144
        sheet = Image.new('RGB', (cw * 6 + 120, chh * 7), 'white'); d = ImageDraw.Draw(sheet)
        for r, w in enumerate(WHOS):
            g = Image.open(os.path.join(OUT, w, f'poses6_{kind}.png'))
            d.text((4, r * chh + 50), LABEL[w], fill=(200, 50, 40), font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 20))
            for i in range(6):
                x, y = (i % 3) * 720, (i // 3) * 576
                sheet.paste(g.crop((x, y, x + 720, y + 576)).resize((cw, chh), Image.LANCZOS), (120 + i * cw, r * chh))
        sheet.save(os.path.join(OUT, f'poses6_overview_{kind}.png'))


if __name__ == '__main__':
    if len(sys.argv) > 1:
        one(sys.argv[1])
    else:
        for w in WHOS:
            subprocess.run([sys.executable, '-I', os.path.abspath(__file__), w], check=True)
        overview()
