#!/usr/bin/env python3
"""걷기 스프라이트 생성용 모델 받기 (Hugging Face). 반 정밀도(fp16) safetensors 만 받아 용량을 줄인다.
  - 기본 모델: Lykon/dreamshaper-8 (SD 1.5, 그림 같은 사실풍)
  - 자세 고정: lllyasviel/control_v11p_sd15_openpose
  - 인물 고정: h94/IP-Adapter (ip-adapter-plus_sd15 + image_encoder)
"""
from huggingface_hub import snapshot_download

jobs = [
    ('Lykon/dreamshaper-8', ['model_index.json', '*/config.json', '*/*.fp16.safetensors', 'tokenizer/*', 'scheduler/*', 'feature_extractor/*']),
    ('lllyasviel/control_v11p_sd15_openpose', ['config.json', 'diffusion_pytorch_model.fp16.safetensors']),
    ('h94/IP-Adapter', ['models/ip-adapter-plus_sd15.safetensors', 'models/image_encoder/config.json', 'models/image_encoder/model.safetensors']),
]
for repo, pats in jobs:
    p = snapshot_download(repo, allow_patterns=pats)
    print('done', repo, p, flush=True)
