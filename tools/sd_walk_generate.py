#!/usr/bin/env python3
"""걷기 8칸 생성 (전문가 방식): ControlNet(OpenPose) 로 자세를 고정하고, IP-Adapter 로 인물을 고정한다.
- 자세: tools/work/sd/pose_{0..7}.png (sd_pose_frames.py, 걷기 모델에서)
- 인물: 이미지_참고/q6/crowd_0_bowler_man.png (기존 중절모 남자 그림)
- 같은 시드, 같은 설정으로 8칸을 만든다 (칸마다 사람이 바뀌지 않게)
사용: python -I tools/sd_walk_generate.py [인물이름] [시드]
출력: tools/work/sd/{인물}_frame_{0..7}.png, {인물}_sheet.png
"""
import os
import sys
import time

import torch
from diffusers import ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionControlNetPipeline
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SD = os.path.join(ROOT, 'tools', 'work', 'sd')
name = sys.argv[1] if len(sys.argv) > 1 else 'bowler'
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1912
REF = {'bowler': os.path.join(ROOT, '이미지_참고', 'q6', 'crowd_0_bowler_man.png')}[name]
PROMPT = {
    'bowler': 'full body side view of a man walking to the right, long dark wool overcoat to below the knees, round black bowler hat (derby hat) with a short curled brim, dark trousers, black leather shoes, 1912 Edwardian, painterly photorealistic, oil painting texture, warm amber lamplight from the left lighting the left edges, deep shadows, isolated figure on a pure white seamless studio background, nothing else in the scene',
}[name]
NEG = 'room, interior, hallway, corridor, wall, door, lamp, street lamp, window, furniture, scenery, environment, fedora, top hat, cartoon, anime, 3d render, extra limbs, extra legs, missing legs, deformed hands, blurry, cropped, cut off feet, multiple people, text, watermark, background scenery, floor, shadow, modern clothing, front view, back view'


def main():
    t0 = time.time()
    cn = ControlNetModel.from_pretrained('lllyasviel/control_v11p_sd15_openpose', torch_dtype=torch.float16, variant='fp16')
    pipe = StableDiffusionControlNetPipeline.from_pretrained('Lykon/dreamshaper-8', controlnet=cn, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True, final_sigmas_type='sigma_min')
    pipe.load_ip_adapter('h94/IP-Adapter', subfolder='models', weight_name='ip-adapter-plus_sd15.safetensors', image_encoder_folder='models/image_encoder')
    pipe.set_ip_adapter_scale(0.7)
    pipe.to('cuda')
    ref = Image.open(REF).convert('RGB')
    print('loaded', round(time.time() - t0, 1), 's', flush=True)
    frames = []
    for i in range(8):
        pose = Image.open(os.path.join(SD, f'pose_{i}.png')).convert('RGB')
        g = torch.Generator('cuda').manual_seed(seed)
        im = pipe(PROMPT, negative_prompt=NEG, image=pose, ip_adapter_image=ref, num_inference_steps=26, guidance_scale=6.5,
                  controlnet_conditioning_scale=1.0, width=512, height=768, generator=g).images[0]
        im.save(os.path.join(SD, f'{name}_frame_{i}.png'))
        frames.append(im)
        print('frame', i, round(time.time() - t0, 1), 's', flush=True)
    sheet = Image.new('RGB', (512 * 4, 768 * 2), 'white')
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % 4) * 512, (i // 4) * 768))
    sheet.resize((1024, 768)).save(os.path.join(SD, f'{name}_sheet.png'))
    print('done', round(time.time() - t0, 1), 's')


if __name__ == '__main__':
    main()
