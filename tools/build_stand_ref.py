#!/usr/bin/env python3
"""인물 7명의 '서 있기' 레퍼런스(게임에서 멈췄을 때 쓰는 칸): 한 칸 720x576, 오른쪽을 본다.
출력 tools/work/stand_ref/{who}/stand_{tone,parts,black}.png, 전체 비교 stand_overview_{tone,parts}.png
사용: python -I build_stand_ref.py            (7명 모두; 인물마다 체형 설정이 달라 따로 실행한다)
      python -I build_stand_ref.py <who>      (gent|lady|child|elder_m|elder_f|young_m|young_f)
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
WHOS = ['gent', 'lady', 'child', 'elder_m', 'elder_f', 'young_m', 'young_f']
LABEL = {'gent': '신사(중년 남성)', 'lady': '숙녀(중년 여성)', 'child': '어린이(성별 무관)', 'elder_m': '노인 남성', 'elder_f': '노인 여성', 'young_m': '청년 남성', 'young_f': '청년 여성'}
OUT = os.path.join(HERE, 'work', 'stand_ref')


def one(who):
    import importlib
    import gait_model as G
    import gent_pose_kit as K
    import build_gentleman_poses as BP
    from PIL import Image
    os.makedirs(os.path.join(OUT, who), exist_ok=True)
    if who == 'gent':
        K.STYLE, K.OPTS, P = 'gent', set(), BP.STAND
    elif who == 'lady':
        K.STYLE, K.OPTS, P = 'lady', set(), BP.STAND
    elif who == 'child':
        import build_child_ref  # noqa: F401  어린이 체형·스타일을 켠다
        importlib.reload(BP)
        P = BP.STAND
    elif who in ('elder_m', 'elder_f'):
        import build_elder_ref as ER
        m = who == 'elder_m'
        K.STYLE = 'gent' if m else 'lady'
        K.OPTS = {'beard', 'stoop'} if m else {'bonnet', 'shawl', 'stoop'}
        P = ER.elder_stand('male' if m else 'female')
    else:
        K.STYLE = 'gent' if who == 'young_m' else 'lady'
        K.OPTS = {'jacket', 'flatcap'} if who == 'young_m' else {'updo', 'slim'}
        P = BP.STAND
    for kind in ('tone', 'parts', 'black'):
        K.render(P, kind).save(os.path.join(OUT, who, f'stand_{kind}.png'))
    print('ok', who)


def overview():
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 34)
    for kind in ('tone', 'parts'):
        ims = [Image.open(os.path.join(OUT, w, f'stand_{kind}.png')).crop((160, 0, 560, 576)) for w in WHOS]
        W, H = ims[0].size
        sheet = Image.new('RGB', (W * 7, H), 'white'); d = ImageDraw.Draw(sheet)
        for i, (w, im) in enumerate(zip(WHOS, ims)):
            sheet.paste(im, (i * W, 0)); d.text((i * W + 12, 8), LABEL[w], fill=(200, 50, 40), font=f)
        sheet.resize((W * 7 // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, f'stand_overview_{kind}.png'))


if __name__ == '__main__':
    if len(sys.argv) > 1:
        one(sys.argv[1])
    else:
        for w in WHOS:
            subprocess.run([sys.executable, '-I', os.path.abspath(__file__), w], check=True)
        overview()
