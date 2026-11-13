#!/usr/bin/env python3
"""중년 신사 걷기 레퍼런스 시트 (6칸). sd_walk_generate2 와 같은 방식(실루엣 img2img + OpenPose + IP-Adapter), 칸 수와 프롬프트만 다르다.
사용: python -I tools/sd_walk_gentleman.py [시드] [강도]
출력: tools/work/sd/gent/frame_{0..5}.png, gentleman_walk_sheet.png (6칸 가로 한 줄)
"""
import os, sys, time
import torch
from diffusers import ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionControlNetImg2ImgPipeline
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gait_model as G
import sd_pose_frames as P
import sd_walk_generate2 as S

N = 6
OUT = os.path.join(ROOT, 'tools', 'work', 'sd', 'gent')
seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1912
strength = float(sys.argv[2]) if len(sys.argv) > 2 else 0.78
PROMPT = ('full body side view of a middle-aged gentleman in his late forties walking to the right, short trimmed graying mustache, weathered face, '
          'long dark charcoal wool frock coat to the knees, waistcoat, round black bowler hat, dark trousers, black leather shoes, 1912 Edwardian, '
          'painterly photorealistic, oil painting texture, warm amber lamplight from the left, isolated on a pure white background')
NEG = S.NEG + ', young, boy, beard, glasses, cane, umbrella'

tr, _ = G.timed_cycle(N)
poses, inits = [], []
for i, (p, pose, x, hy) in enumerate(tr):
    poses.append(P.draw(P.keypoints(pose, hy)))
    inits.append(S.init_image(pose, hy, p))
cn = ControlNetModel.from_pretrained('lllyasviel/control_v11p_sd15_openpose', torch_dtype=torch.float16, variant='fp16')
pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained('Lykon/dreamshaper-8', controlnet=cn, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True, final_sigmas_type='sigma_min')
pipe.load_ip_adapter('h94/IP-Adapter', subfolder='models', weight_name='ip-adapter-plus_sd15.safetensors', image_encoder_folder='models/image_encoder')
pipe.set_ip_adapter_scale(0.5)
pipe.to('cuda')
ref = Image.open(S.REF).convert('RGB')
frames = []
for i in range(N):
    g = torch.Generator('cuda').manual_seed(seed)
    im = pipe(PROMPT, negative_prompt=NEG, image=inits[i], control_image=poses[i], ip_adapter_image=ref, strength=strength,
              num_inference_steps=30, guidance_scale=6.5, controlnet_conditioning_scale=0.9, width=S.W, height=S.H, generator=g).images[0]
    im.save(os.path.join(OUT, f'frame_{i}.png')); frames.append(im); print('frame', i, flush=True)
sheet = Image.new('RGB', (S.W * N, S.H), 'white')
for i, f in enumerate(frames):
    sheet.paste(f, (i * S.W, 0))
sheet.resize((S.W * N // 2, S.H // 2)).save(os.path.join(OUT, 'gentleman_walk_sheet.png'))
print('done')
