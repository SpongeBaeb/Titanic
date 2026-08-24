import json
import os
import random

class HistoricalMatcher:
    def __init__(self, characters_path='engine/characters.json'):
        if not os.path.exists(characters_path):
            characters_path = os.path.join(os.path.dirname(__file__), 'characters.json')
            
        if os.path.exists(characters_path):
            with open(characters_path, 'r', encoding='utf-8') as f:
                self.characters = json.load(f)
        else:
            self.characters = []
            print(f"Warning: characters.json not found at {characters_path}")

    def find_all_matches(self, user_features, persona):
        """
        user_features: dict with Age, Sex, Pclass, Fare, SibSp, Parch, Embarked, FamilySize
        """
        if not self.characters:
            return {
                "best": self._mock_match(persona),
                "worst": self._mock_match(persona),
                "opposite": self._mock_match(persona)
            }

        user_sex = user_features.get('Sex', 'male')
        user_age = user_features.get('Age', 25.0)
        user_pclass = user_features.get('Pclass', 3)
        user_fare = user_features.get('Fare', 15.0)
        user_family = user_features.get('FamilySize', 1)

        import math

        def calculate_similarity_score(c):
            # 1. Persona (40 points)
            persona_score = 40 if c.get('persona') == persona else 0
            
            # 2. Pclass (25 points)
            pclass_diff = abs(c.get('pclass', 3) - user_pclass)
            if pclass_diff == 0: pclass_score = 25
            elif pclass_diff == 1: pclass_score = 10
            else: pclass_score = 0
            
            # 3. Age (15 points)
            age_diff = abs(c.get('age', 30) - user_age)
            age_score = max(0, 15 - (age_diff / 2.0))
            
            # 4. Family Size (10 points)
            family_diff = abs(c.get('family_size', 1) - user_family)
            family_score = max(0, 10 - (family_diff * 3))
            
            # 5. Fare (10 points)
            c_fare = c.get('fare', 15.0)
            fare_diff = abs(math.log(c_fare + 1) - math.log(user_fare + 1))
            fare_score = max(0, 10 - (fare_diff * 5))
            
            return persona_score + pclass_score + age_score + family_score + fare_score

        def get_match_obj(best_match, raw_score):
            # 원래 40% 밑으로 떨어지지 않게 보정했으나, Worst Match의 극적인 효과를 위해 원본 점수를 그대로 반영합니다.
            match_percentage = min(99.9, max(1.0, float(raw_score)))
            return {
                "name": best_match['name'],
                "pclass": best_match.get('pclass'),
                "sex": best_match.get('sex'),
                "survived": best_match.get('survived'),
                "match_percentage": float(round(match_percentage, 1)),
                "story": best_match.get('story')
            }

        # 1. Best & Worst Match (같은 성별)
        filtered_same_sex = [c for c in self.characters if c.get('sex') == user_sex]
        pool = filtered_same_sex if filtered_same_sex else self.characters
        
        # 내림차순 정렬 (점수가 높을수록 Best)
        pool_sorted = sorted(pool, key=calculate_similarity_score, reverse=True)
        
        # Best Match (최고점 기준 5점 이내 후보군 중 랜덤)
        best_top_score = calculate_similarity_score(pool_sorted[0])
        best_candidates = [c for c in pool_sorted if calculate_similarity_score(c) >= best_top_score - 5.0]
        chosen_best = random.choice(best_candidates)
        best_match = get_match_obj(chosen_best, calculate_similarity_score(chosen_best))

        # Worst Match (최하점 기준 2점 이내로 풀을 매우 좁힘)
        worst_bottom_score = calculate_similarity_score(pool_sorted[-1])
        worst_candidates = [c for c in pool_sorted if calculate_similarity_score(c) <= worst_bottom_score + 2.0]
        chosen_worst = random.choice(worst_candidates)
        worst_match = get_match_obj(chosen_worst, calculate_similarity_score(chosen_worst))

        # 2. Opposite Match (다른 성별)
        opposite_sex = 'female' if user_sex == 'male' else 'male'
        filtered_opp_sex = [c for c in self.characters if c.get('sex') == opposite_sex]
        pool_opp = filtered_opp_sex if filtered_opp_sex else self.characters
        pool_opp_sorted = sorted(pool_opp, key=calculate_similarity_score, reverse=True)
        
        # Opposite Match (최고점 기준 5점 이내 후보군 중 랜덤)
        opp_top_score = calculate_similarity_score(pool_opp_sorted[0])
        opp_candidates = [c for c in pool_opp_sorted if calculate_similarity_score(c) >= opp_top_score - 5.0]
        chosen_opp = random.choice(opp_candidates)
        opposite_match = get_match_obj(chosen_opp, calculate_similarity_score(chosen_opp))

        return {
            "best": best_match,
            "worst": worst_match,
            "opposite": opposite_match
        }

    def _mock_match(self, persona):
        return {
            "name": "Lawrence Beesley",
            "pclass": 2,
            "sex": "male",
            "survived": True,
            "match_percentage": 82.0,
            "story": "통계는 나를 버렸지만 나는 통계를 버렸다."
        }
