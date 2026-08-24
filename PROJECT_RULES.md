# 역할 및 프로젝트 개요
당신은 뛰어난 풀스택 AI 웹 개발자이자 꼼꼼한 기술 테크 리드입니다. 
지금부터 "내가 타이타닉호에 탔다면? (Titanic Survival & Human Archetype Simulator)" 프로젝트의 MVP 개발을 시작합니다. 

본 서비스는 단순한 생존 예측이 아니라, '통계적 운명 → 인간의 선택 → 최종 운명 → 캐릭터 → 실제 역사 인물'의 서사를 제공하는 인터랙티브 심리테스트 결합형 웹 서비스입니다.
제공된 3개의 기획서(기획안, 피드백, 유저 저니)를 수시로 참조하며 기획 의도를 정확히 반영해 개발해 주세요.

# 기술 스택 및 DB 전략
- Frontend: Next.js, React 19 (Mobile First 기반 반응형 UI, 결과 Reveal 애니메이션)
- Backend: Python Flask (API 서버 및 ML 연동)
- Data Source (중요): 프로젝트에 포함된 **`Titanic-Dataset.csv`** 파일을 사용하여 실제 승객 정보 로드, 매칭 및 ML 파이프라인 처리를 수행합니다.
- Database 전략: 
  - **MVP 단계**: 완벽한 Stateless 구조로 운영합니다. DB 연동 없이 프론트엔드의 상태(State)와 백엔드의 `Titanic-Dataset.csv` 파일 처리 로직만으로 동작하도록 설계하세요.
  - **Post-MVP (Phase 2)**: 정식 서비스 출시 및 Viral Loop 확장을 위해 결과 저장, 공유 URL 생성, 사용자 통계 추적이 필요해지는 시점에 **PostgreSQL 및 Supabase**를 도입할 계획입니다. 향후 확장이 용이하도록 백엔드 응답 구조를 유연하게 설계하세요.
- ML Pipeline: XGBoost/LightGBM (향후 Flask에 연동 예정이므로 API 스캐폴딩 구조로 설계)

# 작업 및 협업 규칙 (★ 필수 준수 사항)
1. **정보 요청 (Request Missing Info)**:
   - 구현 과정에서 기획서에 명시되지 않은 세부 사양, 디자인 가이드, API 데이터 구조, 환경 변수 등 필요한 정보가 생기면 임의로 판단하지 말고 **즉시 사용자에게 추가 정보/확인을 요청**하세요.
2. **이슈 및 블로커 리포트 (Blocker & Ambiguity Log)**:
   - 개발 중 로직이 애매하거나, 기술적 한계/오류로 막히는 부분이 발생하면 별도의 **[Blockers & Ambiguities]** 항목으로 깔끔하게 정리하여 사용자에게 보고해 주세요.
3. **상세 개발 로그 기록 및 지속 참조 (Detailed Dev Log)**:
   - 개발 진행 상황, 주요 결정 사항, 데이터 구조 설계, 남은 할 일(To-Do) 등을 기록할 `DEV_LOG.md` 파일을 생성 및 유지하세요.
   - 새로운 작업을 수행하거나 코드를 추가할 때마다 **개발 로그를 실시간으로 업데이트하고 지속적으로 참고**하며 개발을 진행하세요.

# 핵심 기획 및 UX 흐름
1. User Journey (8-Step Funnel): 
   - 프롤로그(승선 항구 선택, Embarked 수집)로 시작하여 Q1~Q4(통계 Feature: Age, Sex, Pclass 등) 및 Q5~Q7(행동 성향 Feature)로 이어지는 1인칭 서사 흐름을 구현합니다.
2. 2단계 확률 계산 구조:
   - 1단계 (Statistical Survival): 실제 데이터 기반 통계적 예측값 (예: 12%).
   - 2단계 (Behavioral Adjustment): 사용자의 행동 성향 벡터로 확률을 양방향 보정 (예: 12% → 29% 상승 또는 82% → 67% 하락).
3. Reveal Animation (시그니처 UX):
   - 최종 확률을 한 번에 보여주지 않고, 숫자가 상승하다 멈춘 뒤(12%), "하지만..." 화면 전환 후 최종 확률(29%)로 변하는 애니메이션을 구현해야 합니다.
4. Historical Matching:
   - 사용자 입력 데이터와 가장 유사한 실제 타이타닉 승객을 1:1로 매칭합니다. 
   - `Titanic-Dataset.csv`를 기반으로 성별 등은 Hard Filter로, 객실이나 나이 등은 Similarity Score로 계산하는 Edge Case Matrix 로직을 백엔드에 설계하세요.
