import pandas as pd
import numpy as np
import joblib
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
import xgboost as xgb
import os

def train_model():
    csv_path = '../Titanic-Dataset.csv'
    if not os.path.exists(csv_path):
        print(f"Error: Could not find dataset at {csv_path}")
        return

    df = pd.read_csv(csv_path)

    # 파생 변수 (FamilySize, IsAlone)
    df['FamilySize'] = df['SibSp'] + df['Parch'] + 1
    df['IsAlone'] = (df['FamilySize'] == 1).astype(int)
    
    # Feature와 Target 분리
    X = df[['Pclass', 'Sex', 'Age', 'Fare', 'Embarked', 'SibSp', 'Parch', 'FamilySize', 'IsAlone']]
    y = df['Survived']

    # 전처리 파이프라인
    numeric_features = ['Age', 'Fare', 'SibSp', 'Parch', 'FamilySize', 'IsAlone']
    categorical_features = ['Pclass', 'Sex', 'Embarked']

    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])

    # 모델 파이프라인
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', xgb.XGBClassifier(eval_metric='logloss', random_state=42))
    ])

    print("Training XGBoost Baseline model...")
    clf.fit(X, y)

    # 모델 저장
    joblib.dump(clf, 'model.joblib')
    print("[SUCCESS] Model trained and saved to 'model.joblib'.")

if __name__ == '__main__':
    train_model()
