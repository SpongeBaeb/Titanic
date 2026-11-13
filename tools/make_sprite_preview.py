#!/usr/bin/env python3
"""걷기 프레임 움직이는 미리보기 도구.
사용: python -I tools/make_sprite_preview.py <프레임 폴더> [--glob 'frame_*.png'] [--fps 8] [--stride 0] [--out 이름]
  - 폴더 안 프레임(번호순)을 읽어 공통 영역으로 자르고, GIF 와 HTML(속도 조절·한 칸씩·양파껍질·바닥 흐름) 을 만든다.
  - --stride: 한 주기에 나아가는 거리(px, 잘린 그림 기준). 0 이면 HTML 의 바닥 흐름은 끈 상태로 시작.
출력: <폴더>/<out>.gif, <폴더>/<out>.html (그림이 안에 들어 있어 파일 하나로 열린다)
"""
import argparse, base64, glob, io, json, os
from PIL import Image, ImageChops

ap = argparse.ArgumentParser()
ap.add_argument('folder'); ap.add_argument('--glob', default='frame_*.png'); ap.add_argument('--fps', type=float, default=8)
ap.add_argument('--stride', type=float, default=0); ap.add_argument('--out', default='preview')
a = ap.parse_args()
files = sorted(glob.glob(os.path.join(a.folder, a.glob)), key=lambda p: [int(t) if t.isdigit() else t for t in __import__('re').split(r'(\d+)', os.path.basename(p))])
if not files: raise SystemExit('프레임이 없습니다: ' + a.folder)
ims = [Image.open(f).convert('RGB') for f in files]
# 흰 바탕과 다른 곳의 합집합으로 자른다 (모든 프레임에 같은 상자 → 몸이 흔들리지 않는다)
box = None
for im in ims:
    d = ImageChops.difference(im, Image.new('RGB', im.size, (255, 255, 255))).convert('L').point(lambda v: 255 if v > 24 else 0)
    b = d.getbbox()
    if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
pad = 12
box = (max(0, box[0] - pad), max(0, box[1] - pad), min(ims[0].width, box[2] + pad), min(ims[0].height, box[3] + pad))
crops = [im.crop(box) for im in ims]
gif = os.path.join(a.folder, a.out + '.gif')
crops[0].save(gif, save_all=True, append_images=crops[1:], duration=int(1000 / a.fps), loop=0, optimize=True)
def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
data = json.dumps([b64(c) for c in crops])
html = '''<!doctype html><meta charset=utf-8><title>걷기 미리보기</title>
<style>body{font:14px sans-serif;background:#222;color:#eee;margin:16px}canvas{background:#fff;border:1px solid #555;display:block;margin:8px 0}
label{margin-right:14px}button{padding:4px 10px}</style>
<canvas id=c></canvas>
<div><button id=pp>일시정지</button> <button id=pv>◀</button> <button id=nx>▶</button> <span id=fi></span></div>
<div style="margin-top:8px"><label>속도 <input id=fps type=range min=1 max=24 step=0.5 value=%FPS%> <b id=fv></b> fps</label>
<label><input id=onion type=checkbox> 양파껍질</label><label><input id=ground type=checkbox %GCHK%> 바닥 흐름</label>
<label>배율 <input id=zoom type=range min=0.5 max=2 step=0.1 value=1></label></div>
<script>
const F=%DATA%.map(s=>{const i=new Image();i.src=s;return i}),STRIDE=%STRIDE%;
const c=document.getElementById('c'),x=c.getContext('2d'),$=id=>document.getElementById(id);
let i=0,play=true,last=0,off=0;
function draw(){const w=F[0].naturalWidth,h=F[0].naturalHeight,z=+$('zoom').value;c.width=w*z*1.6;c.height=h*z;x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 const gy=h*z-12*z;if($('ground').checked){x.strokeStyle='#999';for(let k=-1;k<c.width/(40*z)+2;k++){const gx=((k*40*z-off*z)%(c.width+80*z));x.beginPath();x.moveTo(gx,gy);x.lineTo(gx,gy+8*z);x.stroke()}}
 x.strokeStyle='#bbb';x.beginPath();x.moveTo(0,gy);x.lineTo(c.width,gy);x.stroke();
 const px=(c.width-w*z)/2;if($('onion').checked){x.globalAlpha=.25;x.drawImage(F[(i+F.length-1)%F.length],px,0,w*z,h*z);x.globalAlpha=1}
 x.drawImage(F[i],px,0,w*z,h*z);$('fi').textContent=' 프레임 '+(i+1)+' / '+F.length;$('fv').textContent=$('fps').value}
function tick(t){const iv=1000/+$('fps').value;if(play&&t-last>=iv){last=t;i=(i+1)%F.length;if(STRIDE&&$('ground').checked)off+=STRIDE/F.length}draw();requestAnimationFrame(tick)}
$('pp').onclick=()=>{play=!play;$('pp').textContent=play?'일시정지':'재생'};$('nx').onclick=()=>{play=false;$('pp').textContent='재생';i=(i+1)%F.length};
$('pv').onclick=()=>{play=false;$('pp').textContent='재생';i=(i+F.length-1)%F.length};
Promise.all(F.map(f=>f.decode())).then(()=>requestAnimationFrame(tick));
</script>'''.replace('%FPS%', str(a.fps)).replace('%DATA%', data).replace('%STRIDE%', str(a.stride)).replace('%GCHK%', 'checked' if a.stride else '')
out = os.path.join(a.folder, a.out + '.html')
open(out, 'w', encoding='utf-8').write(html)
print(gif, os.path.getsize(gif) // 1024, 'KB'); print(out)
