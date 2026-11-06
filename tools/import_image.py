"""
Gemini에서 받은 이미지를 자동으로 배경 제거하고 프로젝트 폴더에 넣는다. (비용 없음, API 사용 안 함)

사용법
  1) 감시 모드 (추천):   python tools/import_image.py watch
       - 다운로드 폴더에 새로 생기는 Gemini_Generated_Image_*.png|jpg|webp 를 감시한다.
       - tools/queue.txt 에 적힌 이름을 위에서부터 차례로 하나씩 배정한다.
       - 이름은 tools/assets.json 에 있어야 한다(저장 위치, 배경 제거 방식, 크기).
  2) 한 장만 처리:        python tools/import_image.py one icon_pool [파일경로]
       - 파일경로를 생략하면 다운로드 폴더에서 가장 최근 이미지를 쓴다.
  3) 목록 보기:           python tools/import_image.py list

배경 제거 방식 (assets.json 의 mode)
  rembg : 인물·소품처럼 윤곽이 복잡한 그림 (AI 배경 제거)
  flood : 흰 배경에서 가장자리와 이어진 흰색만 지운다 (라벨·UI 부품처럼 단순한 판)
  none  : 배경 제거 없이 그대로
  이미 투명한 이미지(알파가 있는 PNG/WebP)는 mode 와 상관없이 지우기를 건너뛴다.
"""
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent / "frontend" / "public"
MANIFEST = ROOT / "assets.json"
QUEUE = ROOT / "queue.txt"
DONE = ROOT / "processed"
BACKUP = ROOT / "backup"
DOWNLOADS = Path.home() / "Downloads"
EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def load_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def has_real_alpha(im: Image.Image) -> bool:
    if im.mode != "RGBA":
        return False
    a = np.array(im)[..., 3]
    return (a < 250).mean() > 0.02


def flood_remove(im: Image.Image, hole: bool = False) -> Image.Image:
    """가장자리에서 이어진 흰색 배경만 투명하게 만든다."""
    import cv2

    a = np.array(im.convert("RGB"))
    mn = a.min(axis=2)
    sat = a.max(axis=2).astype(int) - mn.astype(int)
    bg = ((mn > 215) & (sat < 28)).astype(np.uint8)
    lab = cv2.connectedComponents(bg, connectivity=4)[1]
    edge = np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])
    ids = set(np.unique(edge)) - {0}
    outside = np.isin(lab, list(ids))
    if hole:
        # 가운데에서 이어진 흰색(안쪽 빈 곳)도 투명하게
        cid = lab[lab.shape[0] // 2, lab.shape[1] // 2]
        if cid != 0:
            outside = outside | (lab == cid)
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    alpha = cv2.erode(alpha, k, iterations=1)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    return Image.fromarray(np.dstack([a, alpha]), "RGBA")


def rembg_remove(im: Image.Image) -> Image.Image:
    from rembg import remove

    return remove(im.convert("RGB")).convert("RGBA")


def process(src: Path, key: str, mode_override=None) -> Path:
    spec = load_manifest()[key]
    mode = mode_override or spec.get("mode", "none")
    dest = PROJECT / spec["dest"]
    im = Image.open(src)
    im.load()

    if has_real_alpha(im):
        im = im.convert("RGBA")
        how = "이미 투명함"
    elif mode == "rembg":
        im = rembg_remove(im)
        how = "rembg"
    elif mode == "flood":
        im = flood_remove(im, bool(spec.get("hole")))
        how = "flood"
    else:
        im = im.convert("RGBA")
        how = "배경 제거 안 함"

    if spec.get("trim", True) and mode != "none":
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
    maxdim = spec.get("max")
    if maxdim and max(im.size) > maxdim:
        r = maxdim / max(im.size)
        im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        BACKUP.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(dest, BACKUP / f"{dest.stem}_{stamp}{dest.suffix}")
    im.save(dest, quality=92, method=6)
    DONE.mkdir(exist_ok=True)
    shutil.move(str(src), str(DONE / f"{key}_{src.name}"))
    print(f"[완료] {key}: {how} -> {dest} ({im.width}x{im.height})", flush=True)
    return dest


def newest_download():
    files = [p for p in DOWNLOADS.iterdir() if p.suffix.lower() in EXTS and p.name.startswith("Gemini_Generated_Image")]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


def read_queue():
    if not QUEUE.exists():
        return []
    out = []
    for line in QUEUE.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            out.append(line)
    return out


def write_queue(keys):
    QUEUE.write_text("\n".join(keys) + ("\n" if keys else ""), encoding="utf-8")


def stable(p: Path) -> bool:
    try:
        s1 = p.stat().st_size
        time.sleep(1.2)
        return s1 > 0 and s1 == p.stat().st_size
    except OSError:
        return False


def watch():
    manifest = load_manifest()
    queue = read_queue()
    bad = [k for k in queue if k not in manifest]
    if bad:
        print("assets.json 에 없는 이름:", ", ".join(bad))
        return
    start = time.time()
    seen = set()
    print(f"감시 시작: {DOWNLOADS}")
    print("Gemini 이미지를 내려받으면 queue.txt 의 위에서부터 차례로 배정합니다. 끝내려면 Ctrl+C.")
    while True:
        queue = read_queue()
        if not queue:
            print("queue.txt 가 비었습니다. 모두 처리했거나 이름을 추가해 주세요.")
            return
        print(f"다음 차례: {queue[0]}  (남은 {len(queue)}개)", flush=True)
        # 새 파일이 올 때까지 대기
        target = None
        while target is None:
            for p in DOWNLOADS.iterdir():
                if p.suffix.lower() in EXTS and p.name.startswith("Gemini_Generated_Image") and p not in seen and p.stat().st_mtime >= start - 1:
                    if stable(p):
                        target = p
                        break
            if target is None:
                time.sleep(1)
        seen.add(target)
        # 기다리는 동안 queue.txt 가 바뀌었을 수 있으므로, 이미지를 받은 이 순간의 맨 위 이름을 다시 읽는다
        queue = read_queue()
        if not queue:
            print("queue.txt 가 비어 있어 이 이미지는 처리하지 않았습니다(파일은 그대로).", flush=True)
            continue
        key = queue[0]
        if key not in load_manifest():
            print(f"[건너뜀] assets.json 에 없는 이름: {key}", flush=True)
            continue
        print(f"[배정] {target.name} -> {key}", flush=True)
        # rembg 는 메모리를 많이 쓰므로 한 장마다 별도 프로세스로 처리한다
        r = subprocess.run([sys.executable, str(Path(__file__)), "one", key, str(target)])
        if r.returncode == 0:
            # 처리하는 사이에 바뀐 목록을 덮어쓰지 않도록 최신 목록에서 이 이름만 뺀다
            cur = read_queue()
            if key in cur:
                cur.remove(key)
            write_queue(cur)
        else:
            print(f"[실패] {key}: 파일은 그대로 두었습니다. 이 이름을 다시 배정하려면 새 이미지를 받아 주세요.", flush=True)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "list":
        m = load_manifest()
        for k, v in m.items():
            print(f"{k:20s} {v.get('mode','none'):6s} {v['dest']}")
    elif cmd == "watch":
        watch()
    elif cmd == "one":
        key = sys.argv[2]
        src = Path(sys.argv[3]) if len(sys.argv) > 3 else newest_download()
        if not src or not src.exists():
            print("처리할 이미지를 찾지 못했습니다.")
            sys.exit(1)
        if key not in load_manifest():
            print(f"assets.json 에 없는 이름: {key}")
            sys.exit(1)
        process(src, key)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
