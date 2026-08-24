from flask import Flask, request, jsonify
from flask_cors import CORS
from engine.survival_engine import SurvivalEngine
from engine.historical_matcher import HistoricalMatcher
from engine.db import save_result, get_result
import json
import os
import subprocess

app = Flask(__name__)
CORS(app)

survival_engine = SurvivalEngine(model_path='model.joblib')
historical_matcher = HistoricalMatcher()

def parse_user_features(data):
    """
    프론트엔드에서 넘어온 심리테스트 답변을 ML이 이해할 수 있는 정형 Feature로 변환
    """
    # 기본값
    features = {
        'Pclass': 3,
        'Sex': 'male', 
        'Age': 25.0,
        'Fare': 15.0,
        'Embarked': 'S',
        'SibSp': 0,
        'Parch': 0,
        'FamilySize': 1,
        'IsAlone': 1
    }
    
    if 'embarked' in data:
        features['Embarked'] = data['embarked']
        
    if 'sex' in data:
        features['Sex'] = data['sex']
        
    if 'pclass' in data:
        features['Pclass'] = int(data['pclass'])
        
    if 'ageGroup' in data:
        age_mapping = {'0-9': 5, '10-17': 14, '18-29': 24, '30-39': 35, '40-49': 45, '50-59': 55, '60+': 65}
        features['Age'] = age_mapping.get(data['ageGroup'], 25.0)
        
    if 'companion' in data:
        comp = data['companion']
        if comp == 'alone':
            features['SibSp'], features['Parch'] = 0, 0
        elif comp == 'partner':
            features['SibSp'], features['Parch'] = 1, 0
        elif comp == 'friends':
            features['SibSp'], features['Parch'] = 2, 0
        elif comp == 'family':
            features['SibSp'], features['Parch'] = 1, 2
            
    features['FamilySize'] = features['SibSp'] + features['Parch'] + 1
    features['IsAlone'] = 1 if features['FamilySize'] == 1 else 0
    
    if 'fareIntent' in data:
        fare_mapping = {'luxury': 80.0, 'balance': 30.0, 'save': 8.0}
        features['Fare'] = fare_mapping.get(data['fareIntent'], 15.0)
        
    return features

@app.route('/api/admin/image-config', methods=['POST'])
def save_image_config():
    data = request.json
    character_name = data.get('character')
    config = data.get('config')
    
    if not character_name or not config:
        return jsonify({"status": "error", "message": "Missing character or config"}), 400
        
    config_path = os.path.join(os.path.dirname(__file__), 'engine', 'imageConfigs.json')
    configs = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                configs = json.load(f)
        except Exception:
            pass
            
    configs[character_name] = config
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(configs, f, ensure_ascii=False, indent=2)
        
    # parse_db.py 실행
    parse_script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'parse_db.py')
    try:
        subprocess.run(['python', parse_script_path], check=True, cwd=os.path.dirname(parse_script_path))
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to run parse_db.py: {str(e)}"}), 500
        
    return jsonify({"status": "success", "message": f"Saved config for {character_name} and regenerated characterDB.ts"})

@app.route('/api/quiz/submit', methods=['POST'])
def quiz_submit():
    data = request.json
    
    # 1. Feature 매핑
    features = parse_user_features(data)
    
    # 2. 통계적 생존 확률 도출 (XGBoost)
    stat_prob = survival_engine.calculate_statistical_survival(features)
    
    # 3. 행동 성향 보정 및 페르소나 도출 (Rule-based)
    adj_prob, persona = survival_engine.calculate_behavioral_adjustment(data, stat_prob)
    
    # 4. 가장 닮은 실존 인물 등 3가지 매칭 반환 (KNN-like)
    match_result = historical_matcher.find_all_matches(features, persona)
    
    # 5. DB에 결과 저장 (전체 dict 저장)
    result_id = save_result(stat_prob, adj_prob, persona, match_result)
    
    return jsonify({
        "status": "success",
        "id": result_id,
        "statistical_probability": round(stat_prob, 1),
        "adjusted_probability": round(adj_prob, 1),
        "persona": persona,
        "historical_match": match_result.get('best'),
        "worst_match": match_result.get('worst'),
        "opposite_match": match_result.get('opposite')
    })

@app.route('/api/quiz/result/<result_id>', methods=['GET'])
def get_quiz_result(result_id):
    result = get_result(result_id)
    if result:
        hm = result['historical_match']
        if isinstance(hm, dict) and 'best' in hm:
            best = hm['best']
            worst = hm.get('worst')
            opposite = hm.get('opposite')
        else:
            best = hm
            worst = None
            opposite = None
            
        return jsonify({
            "status": "success",
            "statistical_probability": round(result['statistical_probability'], 1),
            "adjusted_probability": round(result['adjusted_probability'], 1),
            "persona": result['persona'],
            "historical_match": best,
            "worst_match": worst,
            "opposite_match": opposite
        })
    else:
        return jsonify({"status": "error", "message": "Result not found"}), 404

# --- 개별 테스트용 API ---
@app.route('/api/survival/predict', methods=['POST'])
def predict_survival():
    features = parse_user_features(request.json)
    prob = survival_engine.calculate_statistical_survival(features)
    return jsonify({"status": "success", "statistical_probability": round(prob, 1)})

@app.route('/api/behavior/analyze', methods=['POST'])
def analyze_behavior():
    data = request.json
    base_prob = data.get('base_prob', 12.0)
    adj_prob, persona = survival_engine.calculate_behavioral_adjustment(data, base_prob)
    return jsonify({"status": "success", "adjusted_probability": round(adj_prob, 1), "persona": persona})

@app.route('/api/historical/match', methods=['POST'])
def match_historical():
    data = request.json
    features = parse_user_features(data)
    persona = data.get('persona', 'THE OBSERVER')
    match = historical_matcher.find_match(features, persona)
    return jsonify({"status": "success", "historical_match": match})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
