import pandas as pd
import numpy as np
import joblib
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedKFold, cross_val_score
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
        # 891행 데이터에서 과적합을 막기 위해 트리 깊이와 학습률을 제한한다.
        ('classifier', xgb.XGBClassifier(
            max_depth=3,
            n_estimators=100,
            learning_rate=0.05,
            min_child_weight=5,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric='logloss',
            random_state=42
        ))
    ])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(clf, X, y, cv=cv)
    print(f"5-fold CV accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    print("Training XGBoost model...")
    clf.fit(X, y)
    print(f"Train accuracy: {clf.score(X, y):.4f}")

    # 모델 저장
    joblib.dump(clf, 'model.joblib')
    print("[SUCCESS] Model trained and saved to 'model.joblib'.")

if __name__ == '__main__':
    train_model()
