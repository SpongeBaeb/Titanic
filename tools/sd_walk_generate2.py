#!/usr/bin/env python3
"""걷기 8칸 생성 v2: 흰 바탕 위 실루엣에서 시작하는 img2img + ControlNet(OpenPose) + IP-Adapter.
v1(빈 잡음에서 시작)은 'white background' 를 무시하고 거리·복도를 그렸다.
이번에는 칸마다 걷기 모델의 외투+모자 실루엣(흰 바탕, 어두운 옷 색)을 시작 그림으로 주어,
배경은 흰색, 윤곽은 실루엣, 자세는 뼈대(ControlNet), 사람은 기존 그림(IP-Adapter)을 따르게 한다.
사용: python -I tools/sd_walk_generate2.py [시드] [강도]
출력: tools/work/sd/bowler2_frame_{0..7}.png, bowler2_sheet.png, init_{0..7}.png
"""
import os
import sys
import time

import torch
from diffusers import ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionControlNetImg2ImgPipeline
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_walk_ref_v3 as R  # noqa: E402  (실루엣 그리기)
import gait_model as G  # noqa: E402

SD = os.path.join(ROOT, 'tools', 'work', 'sd')
seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1912
strength = float(sys.argv[2]) if len(sys.argv) > 2 else 0.78
REF = os.path.join(ROOT, '이미지_참고', 'q6', 'crowd_0_bowler_man.png')
PROMPT = ('full body side view of a man walking to the right, long dark charcoal wool overcoat to below the knees, round black bowler hat (derby hat), '
          'dark trousers, black leather shoes, 1912 Edwardian gentleman, painterly photorealistic, oil painting texture, warm amber lamplight from the left '
          'lighting the left edges, deep shadows, isolated on a pure white background')
NEG = ('room, interior, street, building, wall, door, lamp, scenery, environment, floor, ground, shadow, fedora, top hat, cartoon, anime, 3d render, '
       'extra limbs, extra legs, deformed hands, blurry, cropped, multiple people, text, watermark, front view, back view')
W, H, BASE, SC = 512, 768, 740, 1.32   # sd_pose_frames.py 와 같은 배치


def init_image(pose, hy, p):
    """뼈대 그림과 같은 자리·크기의 외투+모자 실루엣 (흰 바탕, 옷 색은 어두운 회갈색, 먼 쪽은 조금 밝게)"""
    w0, h0 = int(W / SC), int(H / SC)
    im = Image.new('RGB', (w0, h0), (255, 255, 255))
    keep = (R.NEAR, R.FAR, R.LINE)
    R.NEAR, R.FAR, R.LINE = (46, 40, 38), (70, 64, 62), (46, 40, 38)
    try:
        R.draw(ImageDraw.Draw(im), pose, 'coat', W * 0.46 / SC, BASE / SC + hy, p, outline=False)
    finally:
        R.NEAR, R.FAR, R.LINE = keep
    return im.resize((W, H), Image.LANCZOS)


def main():
    t0 = time.time()
    tr, _ = G.timed_cycle(8)
    inits = []
    for i, (p, pose, x, hy) in enumerate(tr):
        im = init_image(pose, hy, p)
        im.save(os.path.join(SD, f'init_{i}.png'))
        inits.append(im)
    cn = ControlNetModel.from_pretrained('lllyasviel/control_v11p_sd15_openpose', torch_dtype=torch.float16, variant='fp16')
    pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained('Lykon/dreamshaper-8', controlnet=cn, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True, final_sigmas_type='sigma_min')
    pipe.load_ip_adapter('h94/IP-Adapter', subfolder='models', weight_name='ip-adapter-plus_sd15.safetensors', image_encoder_folder='models/image_encoder')
    pipe.set_ip_adapter_scale(0.65)
    pipe.to('cuda')
    ref = Image.open(REF).convert('RGB')
    print('loaded', round(time.time() - t0, 1), 's', flush=True)
    frames = []
    for i in range(8):
        pose_img = Image.open(os.path.join(SD, f'pose_{i}.png')).convert('RGB')
        g = torch.Generator('cuda').manual_seed(seed)
        im = pipe(PROMPT, negative_prompt=NEG, image=inits[i], control_image=pose_img, ip_adapter_image=ref, strength=strength,
                  num_inference_steps=30, guidance_scale=6.5, controlnet_conditioning_scale=0.9, width=W, height=H, generator=g).images[0]
        im.save(os.path.join(SD, f'bowler2_frame_{i}.png'))
        frames.append(im)
        print('frame', i, round(time.time() - t0, 1), 's', flush=True)
    sheet = Image.new('RGB', (W * 4, H * 2), 'white')
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % 4) * W, (i // 4) * H))
    sheet.resize((1024, 768)).save(os.path.join(SD, 'bowler2_sheet.png'))
    print('done', round(time.time() - t0, 1), 's')


if __name__ == '__main__':
    main()
