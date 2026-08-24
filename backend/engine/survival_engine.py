import joblib
import pandas as pd
import os

class SurvivalEngine:
    def __init__(self, model_path='model.joblib'):
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
        else:
            self.model = None
            print(f"Warning: Model not found at {model_path}")

    def calculate_statistical_survival(self, features):
        """
        features: dict containing:
        Pclass, Sex, Age, Fare, Embarked, SibSp, Parch, FamilySize, IsAlone
        """
        if not self.model:
            return 12.0 # Default mock value

        df = pd.DataFrame([features])
        prob = self.model.predict_proba(df)[0][1] # Probability of Class 1 (Survived)
        return float(prob) * 100.0

    def calculate_behavioral_adjustment(self, answers, base_prob):
        """
        answers: dict containing user answers from Q5~Q7
        Returns: adjusted_prob, persona
        """
        score_modifier = 0
        persona = "THE OBSERVER"
        
        purpose = answers.get('purpose', answers.get('purp', ''))
        rumor = answers.get('rumorAction', answers.get('rumor', ''))
        final_action = answers.get('finalAction', '')
        
        # 1. rumorAction modifier
        if rumor == 'check_escape':
            score_modifier += 5
        elif rumor == 'check_crew':
            score_modifier += 2
        elif rumor == 'calm_others':
            score_modifier -= 2
        elif rumor == 'follow_crowd':
            score_modifier -= 5

        # 2. finalAction modifier & persona assignment
        if final_action == 'yield_seat':
            score_modifier -= 15
            if purpose == 'experience':
                persona = "THE TRAGIC ARTIST"
            else:
                persona = "THE NOBLE ROMANTIC"
        elif final_action == 'me_first':
            score_modifier += 20
            if rumor == 'check_escape':
                persona = "THE RUTHLESS SURVIVOR"
            else:
                persona = "THE OPPORTUNIST"
        elif final_action == 'secure_mine':
            score_modifier += 10
            if rumor == 'check_crew':
                persona = "THE COLD STRATEGIST"
            else:
                persona = "THE STRATEGIC SURVIVOR"
        elif final_action == 'yield_weak':
            score_modifier -= 10
            if rumor == 'calm_others':
                persona = "THE TRUE LEADER"
            else:
                persona = "THE PROTECTOR"
        else: # observe or fallback
            if purpose == 'stability':
                persona = "THE BEAUTIFUL LOSER"
            else:
                persona = "THE SILENT WITNESS"
            
        adjusted_prob = base_prob + score_modifier
        
        # Cap between 1 and 99
        adjusted_prob = max(1.0, min(99.0, adjusted_prob)) 
        
        return float(adjusted_prob), persona
