"""이미지 최적화 도구 (기준: 이미지_최적화_기준.md)

변환(frames, images)에는 Pillow 가 필요하다:  pip install Pillow
점검(check)은 표준 라이브러리만 쓴다.

원본(PNG·JPEG)은 assets-src/ 에 두고, 변환본(WebP)만 frontend/public/ 에 둔다.

  python scripts/optimize_images.py frames [--src assets-src/bg/frames] [--dest frontend/public/bg]
      프롤로그 프레임(JPEG)을 데스크톱용(1296px)·모바일용(864px) WebP 로 변환한다.
      -> bg/frames-d, bg/frames-m

  python scripts/optimize_images.py images [--src assets-src] [--dest frontend/public] [--rename-map 파일]
      원본 PNG/JPEG 를 분류 규칙(가로 최대, 화질)으로 WebP 로 변환한다. 폴더 구조는 유지한다.
      파일 이름이 규칙(공백·비ASCII 금지)에 맞지 않으면 슬러그로 바꾸고 그 목록을 출력한다.
      (bg/frames 는 frames 명령이 처리하므로 건너뛴다)

  python scripts/optimize_images.py check [--dir <폴더>] [--staged] [--baseline <파일>] [--update-baseline <파일>]
      장당 용량 상한, 파일 이름, public 안에 남은 PNG 를 점검한다(읽기 전용).
      --staged           git 에 stage 된 파일만 점검한다 (커밋 전 점검용)
      --baseline 파일    그 파일에 적힌 '기존 위반'은 무시하고 새 위반만 실패로 처리한다
      --update-baseline  현재 위반 목록으로 baseline 파일을 새로 쓴다
      새 위반이 있으면 종료 코드 1.
"""
import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
ASSETS_SRC = ROOT / 'assets-src'          # 원본(PNG, JPEG) 보관 위치. 배포물(public)에는 포함되지 않는다

# (경로 접두사/이름, 분류, 가로 최대 px, WebP 화질, 장당 상한 KB)  — 위에서부터 먼저 맞는 규칙 적용
RULES = [
    ('bg/frames', 'frame', 1296, 70, 100),
    ('bg/', 'bg', 1920, 80, 400),
    ('result/', 'result', 900, 82, 300),
    ('spend/bill', 'bill', 1200, 85, 300),
    ('spend/hair', 'sprite', 640, 85, 300),          # 머리카락 낙하 효과 이미지 (아이콘보다 큼)
    ('spend/', 'icon', 640, 85, 100),
    ('crashed/', 'crashed', 1400, 85, 300),
    ('age/', 'age', 1200, 85, 200),
    ('reflection', 'ui-opaque', 1080, 80, 400),
    ('map-route', 'ui-wide', 1600, 82, 200),
    ('ticket', 'ui-wide', 1200, 85, 200),
    ('labelui', 'ui-wide', 1200, 85, 200),
    ('lens', 'ui-wide', 1200, 85, 200),
    ('dollar', 'ui-wide', 1200, 85, 200),
    ('mirror', 'ui-tall', 1000, 85, 200),
    ('female', 'ui-tall', 1000, 85, 200),
    ('male', 'ui-tall', 1000, 85, 200),
]
DEFAULT_RULE = ('other', 1400, 85, 200)
FRAME_SETS = {'frames-d': 1296, 'frames-m': 864}   # 데스크톱 / 모바일(화면 폭 768px 이하)
FRAME_QUALITY = 70
IMAGE_EXT = {'.png', '.jpg', '.jpeg'}
CHECK_EXT = {'.png', '.jpg', '.jpeg', '.webp'}
NAME_OK = re.compile(r'[a-z0-9._\-/]+')


def rule_for(rel: str):
    r = rel.lower()
    for prefix, cat, max_w, quality, cap in RULES:
        if r.startswith(prefix):
            return cat, max_w, quality, cap
    return DEFAULT_RULE


def slugify(text: str) -> str:
    """악센트 제거 → 소문자 → 영문·숫자가 아닌 연속 문자를 '-' 로.  'August Wennerström' -> 'august-wennerstrom'
    frontend/src/lib/assetPath.ts 의 slugify 와 결과가 같아야 한다."""
    t = unicodedata.normalize('NFD', text)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def valid_stem(stem: str) -> bool:
    return bool(NAME_OK.fullmatch(stem.lower())) and ' ' not in stem


# ───────── 변환 ─────────

def has_alpha(im) -> bool:
    return im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)


def convert(src: Path, dest: Path, max_w: int, quality: int) -> int:
    from PIL import Image          # 변환할 때만 필요하다 (check 는 Pillow 없이 동작)
    im = Image.open(src)
    im.load()
    im = im.convert('RGBA' if has_alpha(im) else 'RGB')
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'WEBP', quality=quality, method=4)
    return dest.stat().st_size


def cmd_frames(args) -> int:
    src_dir = Path(args.src)
    files = sorted(src_dir.glob('*.jpg'))
    if not files:
        print(f'프레임을 찾지 못했습니다: {src_dir}')
        return 1
    dest = Path(args.dest)
    cap = RULES[0][4] * 1024
    for name, width in FRAME_SETS.items():
        out_dir = dest / name
        total, over = 0, 0
        for f in files:
            size = convert(f, out_dir / (f.stem + '.webp'), width, FRAME_QUALITY)
            total += size
            over += size > cap
        print(f'{name}: {len(files)}장, 합계 {total / 1e6:.1f}MB, 장당 평균 {total / len(files) / 1e3:.0f}KB'
              + (f', 상한({RULES[0][4]}KB) 초과 {over}장' if over else ''))
    src_total = sum(f.stat().st_size for f in files)
    print(f'원본 JPEG: {src_total / 1e6:.1f}MB (삭제하지 않았습니다)')
    return 0


def cmd_images(args) -> int:
    src, dest = Path(args.src), Path(args.dest)
    tot_src = tot_out = n = 0
    renames = {}
    for f in sorted(src.rglob('*')):
        if f.suffix.lower() not in IMAGE_EXT:
            continue
        rel = f.relative_to(src).as_posix()
        if rel.startswith('bg/frames/'):
            continue                                  # 프롤로그 프레임은 frames 명령이 따로 처리한다
        cat, max_w, quality, cap = rule_for(rel)
        rp = Path(rel)
        stem = rp.stem if valid_stem(rp.stem) else slugify(rp.stem)
        if stem != rp.stem:
            renames[rel] = (rp.parent / (stem + '.webp')).as_posix()
        out_rel = rp.parent / (stem + '.webp')
        out = convert(f, dest / out_rel, max_w, quality)
        tot_src += f.stat().st_size
        tot_out += out
        n += 1
        if out > cap * 1024:
            print(f'  [상한 초과] {out_rel.as_posix()}: {out / 1024:.0f}KB > {cap}KB ({cat})')
    print(f'{n}장 변환: {tot_src / 1e6:.1f}MB -> {tot_out / 1e6:.2f}MB')
    if renames:
        print(f'규칙에 맞지 않아 이름을 바꾼 파일 {len(renames)}개:')
        for old, new in renames.items():
            print(f'  {old} -> {new}')
    if args.rename_map:
        Path(args.rename_map).write_text(json.dumps(renames, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'이름 변경 목록 저장: {args.rename_map}')
    return 0


# ───────── 점검 ─────────

def find_problems(rel: str, size: int):
    """한 파일의 위반 목록: [(종류, 설명)]. 종류는 baseline 키에 쓰인다 (PNG / SIZE / NAME)."""
    out = []
    ext = Path(rel).suffix.lower()
    if ext in CHECK_EXT:
        if ext == '.png':
            out.append(('PNG', f'PNG 가 public 에 있음 ({size / 1e6:.1f}MB) — images 명령으로 WebP 변환 후 PNG 는 assets-src 에 보관'))
        elif not rel.startswith('bg/frames/'):      # 원본 프레임(JPEG)은 변환 후 정리 대상
            cat, _, _, cap = rule_for(rel)
            if size > cap * 1024:
                out.append(('SIZE', f'용량 상한 초과 {size / 1024:.0f}KB > {cap}KB ({cat})'))
    if not NAME_OK.fullmatch(rel.lower()) or ' ' in rel:
        out.append(('NAME', '파일 이름 규칙 위반 (영문 소문자·숫자·하이픈만, 공백·비ASCII 금지)'))
    return out


def staged_files(root: Path):
    """git 에 stage 된(추가·수정) 파일 중 root(public) 아래에 있는 것의 상대 경로 목록."""
    top = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=ROOT, capture_output=True, text=True)
    if top.returncode != 0:
        print('git 저장소를 찾지 못했습니다.')
        sys.exit(2)
    repo = Path(top.stdout.strip())
    names = subprocess.run(['git', 'diff', '--cached', '--name-only', '--diff-filter=AM', '-z'],
                           cwd=repo, capture_output=True).stdout.decode('utf-8', 'replace').split('\0')
    rels = []
    for n in filter(None, names):
        try:
            rel = (repo / n).resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            continue
        if (root / rel).is_file():
            rels.append(rel)
    return rels


def load_baseline(path: Path):
    if not path.exists():
        return set()
    return {ln.strip() for ln in path.read_text(encoding='utf-8').splitlines() if ln.strip() and not ln.startswith('#')}


def cmd_check(args) -> int:
    root = Path(args.dir)
    if args.staged:
        rels = staged_files(root)
    else:
        rels = [f.relative_to(root).as_posix() for f in sorted(root.rglob('*')) if f.is_file()]

    problems = []                                     # (키, 설명)
    for rel in rels:
        for kind, msg in find_problems(rel, (root / rel).stat().st_size):
            problems.append((f'{kind}\t{rel}', f'{rel}: {msg}'))

    if args.update_baseline:
        path = Path(args.update_baseline)
        header = ['# 이미지 점검에서 "이미 알고 있는" 위반 목록입니다. 해결할 때마다 줄어듭니다.',
                  '# 갱신: python scripts/optimize_images.py check --update-baseline scripts/image-baseline.txt']
        path.write_text('\n'.join(header + sorted(k for k, _ in problems)) + '\n', encoding='utf-8')
        print(f'baseline 갱신: {len(problems)}건 -> {path}')
        return 0

    baseline = load_baseline(Path(args.baseline)) if args.baseline else set()
    new = [(k, m) for k, m in problems if k not in baseline]
    known = len(problems) - len(new)
    fixed = len(baseline - {k for k, _ in problems}) if (args.baseline and not args.staged) else 0

    for _, msg in new:
        print(msg)
    summary = f'점검 완료: 새 위반 {len(new)}건'
    if known:
        summary += f' (기존 위반 {known}건은 baseline 으로 무시)'
    print(summary)
    if fixed:
        print(f'알림: baseline 의 {fixed}건이 이미 해결되었습니다. --update-baseline 으로 목록을 줄이세요.')
    return 1 if new else 0


def main() -> int:
    ap = argparse.ArgumentParser(description='이미지 최적화 도구')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('frames')
    p.add_argument('--src', default=str(ASSETS_SRC / 'bg' / 'frames'))
    p.add_argument('--dest', default=str(PUBLIC / 'bg'))
    p.set_defaults(fn=cmd_frames)
    p = sub.add_parser('images')
    p.add_argument('--src', default=str(ASSETS_SRC))
    p.add_argument('--dest', default=str(PUBLIC))
    p.add_argument('--rename-map', help='이름을 바꾼 파일 목록(JSON)을 저장할 경로')
    p.set_defaults(fn=cmd_images)
    p = sub.add_parser('check')
    p.add_argument('--dir', default=str(PUBLIC))
    p.add_argument('--staged', action='store_true')
    p.add_argument('--baseline')
    p.add_argument('--update-baseline')
    p.set_defaults(fn=cmd_check)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
