import re, json
import os

configs_path = r'c:\Titanic\backend\engine\imageConfigs.json'
image_configs = {}
if os.path.exists(configs_path):
    with open(configs_path, 'r', encoding='utf-8') as cf:
        try:
            image_configs = json.load(cf)
        except Exception:
            pass

with open(r'C:\Users\samsung\.gemini\antigravity-ide\brain\b753ffbc-cb86-45f4-a2e3-cf6b4dd0ef04\titanic_character_cards.md', 'r', encoding='utf-8') as f:
    text = f.read()

chars = {}
current_name = None
current_char = {}

for line in text.split('\n'):
    name_match = re.search(r'### \d+\. (.+?) \((.+?)\)', line)
    if name_match:
        if current_name:
            chars[current_name] = current_char
        current_name = name_match.group(1).strip()
        current_char = {
            'name': current_name,
            'koreanName': name_match.group(2).strip(),
            'meta': [],
            'stats': []
        }
    
    if not current_name: continue
    
    if line.startswith('* 신분 등급'):
        current_char['class'] = line.split(':')[1].strip()
    elif line.startswith('* 기본 메타'):
        parts = line.split(':')[1].split('/')
        if len(parts) >= 3:
            current_char['meta'].append({'label': '나이', 'value': parts[0].strip()})
            current_char['meta'].append({'label': '국적', 'value': parts[1].strip()})
            current_char['meta'].append({'label': '소속', 'value': parts[2].strip()})
    elif line.startswith('* 탑승 목적'):
        current_char['purpose'] = line.split(':')[1].strip()
    elif line.startswith('* 재력 (Wealth)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '재력', 'value': val, 'fullMark': 10})
    elif line.startswith('* 영향력 (Influence)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '영향력', 'value': val, 'fullMark': 10})
    elif line.startswith('* 이타성 (Altruism)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '이타성', 'value': val, 'fullMark': 10})
    elif line.startswith('* 신체 능력 (Physicality)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '신체 능력', 'value': val, 'fullMark': 10})
    elif line.startswith('* 침착성 (Composure)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '침착성', 'value': val, 'fullMark': 10})
    elif line.startswith('* 행운 (Luck)'):
        val = int(re.search(r'(\d+)', line).group(1))
        current_char['stats'].append({'subject': '행운', 'value': val, 'fullMark': 10})
    elif line.startswith('* 그날 밤의 선택 (The Choice):'):
        current_char['story'] = line.split(':', 1)[1].strip()
    elif line.startswith('* 핵심 대사 (Quote)'):
        current_char['quote'] = line.split(':', 1)[1].strip().strip('\"')
    elif line.startswith('* 해시태그 (Trivia Tags)'):
        tags_text = line.split(':', 1)[1].strip()
        tags = [t.strip() for t in tags_text.split('#') if t.strip()]
        current_char['tags'] = ['#' + t for t in tags]

if current_name:
    chars[current_name] = current_char

# Apply imageConfigs
for name, c in chars.items():
    if name in image_configs:
        c['imageConfig'] = image_configs[name]

js_code = 'export const characterDB: Record<string, any> = ' + json.dumps(chars, ensure_ascii=False, indent=2) + ';\n'
with open(r'c:\Titanic\frontend\src\data\characterDB.ts', 'w', encoding='utf-8') as f:
    f.write(js_code)
