# 결정을 강요하는 웹·뉴스·광고 연출 사례 (타이타닉 02:05 마지막 질문 재연출 참고용)

## 인터랙티브 저널리즘과 뉴스게임은 선택을 어떻게 강요하는가

### Takeaway
저널리즘 쪽 사례 대부분은 실시간 타이머가 아니라 "되돌릴 수 없는 진행"과 "결말 후 정산"으로 압박한다. 시간을 다루는 가장 강한 장치는 실시간 알림(Bury me, my Love)과 분 단위 타임라인 스크롤(한겨레 '사월, 哀')이었다.

### Cited Findings
**The Uber Game (Financial Times, 2017)**
- 전업 우버 기사가 되어 샌프란시스코의 높은 비용을 감당할 돈을 버는 선택지형 이야기. 7일간 진행된다 — [검색 결과: journalismgames](https://www.journalismgames.org/game.php?PID=190), [Medium 분석](https://medium.com/narrative-from-linear-media-to-interactive-media/the-uber-game-the-financial-times-d1e23fe81af)
- 딜레마 예: 아들과의 약속을 지키러 귀가할지 계속 운전할지, 3배 할증을 쫓아 30분을 달릴지. 날짜를 건너뛰거나 되돌릴 수 없는 선형 진행이며 1회 플레이는 약 5~10분 — [OpenNews](https://source.opennews.org/articles/how-and-why-financial-times-made-uber-game/)
- 최종 화면은 플레이어 수입을 같은 난이도의 다른 플레이어와 백분위로 비교한다. 아들 숙제 돕기 같은 부수적 선택도 기록한다 — [OpenNews](https://source.opennews.org/articles/how-and-why-financial-times-made-uber-game/)
- 실시간 타이머는 이 제작기에 나오지 않는다. 초기 구상에 "평점과 시간 게이지"가 있었으나 최종 반영 정도는 불명 — [OpenNews](https://source.opennews.org/articles/how-and-why-financial-times-made-uber-game/)
- 기술: Ink/inkjs, anime.js, Framer 프로토타입, Node.js+PostgreSQL 백엔드. 시작한 사람의 70% 이상이 끝까지 플레이 — [OpenNews](https://source.opennews.org/articles/how-and-why-financial-times-made-uber-game/)

**Syrian Journey: Choose your own escape route (BBC Arabic, 2015)**
- 경로를 고르는 분기형으로, 일곱 장면을 통과해 유럽 해안에 닿으면 '성공'이지만 그것이 행복한 결말은 아니다. 경로와 결과는 실제 사례 인터뷰에 기반 — [Emory 비평](https://scholarblogs.emory.edu/themigrantandrefugeecrisis/2017/11/06/critique-choose-your-own-escape-route), [YES! Magazine](https://www.yesmagazine.org/education/2017/05/11/syrian-journey-choose-your-own-escape-route)
- 인도적 재난을 "아이들 게임"으로 만들었다는 비판을 받았다(Daily Mail 등). 반대로 Guardian의 Keith Stuart는 옹호했다 — [Breitbart가 전한 반발](https://www.breitbart.com/europe/2015/04/07/bbc-criticised-for-making-computer-game-about-syrian-refugees), [Prindle Institute](https://www.prindleinstitute.org/?p=3303)

**Pirate Fishing (Al Jazeera, 2014)**
- 플레이어가 조사 기자가 되어 시에라리온 불법 조업의 증거와 메모를 모으는 웹 게임. 다큐 영상을 게임 안에 삽입 — [Docubase](https://docubase.mit.edu/topics/piracy), [Grain Media](https://www.grainmedia.co.uk/work/pirate-fishing)
- 제작자 Juliana Ruhfus 본인이 클릭해도 결과가 바뀌지 않는다는 한계를 인정했다 — [Docubase 인터뷰](https://docubase.mit.edu/lab/interviews/hacked-syrias-electronic-armies-through-the-eyes-of-its-makers/)

**Darfur is Dying (2006)**
- 물을 길어 오는 달리기 단계와 위에서 내려다보는 캠프 관리 단계를 오간다. 방향키와 스페이스바만 사용하고 목표는 7일 유지 — [Wikipedia](https://en.wikipedia.org/wiki/Darfur_is_Dying), [Serious Games Society](https://seriousgamessociety.org/2016/09/22/darfur-is-dying/)
- 캐릭터 선택 자체가 대가를 진다. 소년은 빠르지만 적게 나르고, 성인 여성은 많이 나르지만 공격받기 쉽다 — [Wikipedia](https://en.wikipedia.org/wiki/Darfur_is_Dying)

**Spent (Urban Ministries of Durham / McKinney)**
- 1,000달러로 한 달을 버티며 주거, 식비, 의료 중 선택을 이어 간다. 잔액이 0 위에 머물러야 한다 — [Yes! Magazine](https://www.yesmagazine.org/?p=63239), [GamesBeat](https://gamesbeat.com/?p=53929)
- 더럼의 공정 시장 임대료 등 실제 통계와 쉼터 이용자 포커스그룹을 기반으로 했다. 플레이 수는 170만 회와 400만 회 이상으로 시점에 따라 다르다 — [Adweek](https://www.adweek.com/?p=11562), [WUNC](https://www.wunc.org/business-economy/2014-07-30/spent-hit-game-about-money-and-resources-goes-mobile)

**Bury me, my Love (The Pixel Hunt 외)**
- 시리아 난민 Nour의 메시지를 메신저 형식으로 받고 남편 Majd로서 답을 고른다. 실시간 또는 빠른 진행 중 선택하며, 실시간이면 여정 구간마다 알림이 온다 — [IGF](https://igf.com/bury-me-my-love), [itch.io](https://dearvillagers.itch.io/bury-me-my-love)
- 50곳 이상의 장소와 19개 결말 — [Nintendo](https://nintendo.com/store/products/bury-me-my-love-switch)
- 알림이 몰입과 숙고의 시간을 준다는 평과 성가시다는 평이 갈렸다 — [검색 결과: Nintendo Life](https://www.nintendolife.com/eshop/bury_me_my_love)

**Snow Fall (New York Times, 2012)**
- 챕터형 스크롤 장문 안에 멀티미디어를 사이드바가 아닌 본문 흐름으로 넣었다. 스크롤 효과는 jQuery와 Reel.js로 구현 — [Journovation](https://journovation.syr.edu/2013/05/20/journovationtour-nyc-stop-1-the-new-york-times-snow-fall/), [A List Apart](https://alistapart.com/column/he-aint-snowfalling-hes-my-brother)
- 약 10인치 미만 화면에는 최적화되지 않았다는 비평이 있다 — [CSU 비평](https://thinkspace.csu.edu.au/readreflectreimagine/?p=69)

**Firestorm (The Guardian, 2013)**
- 태즈메이니아 더낼리 산불에서 살아남은 Holmes 가족 이야기를 축으로 산불 역사와 기후 변화를 엮은 멀티미디어 기사. 제작 3개월, 23명 참여 — [사례 분석](https://bramalkema.github.io/multiplejournalism-static/case/firestorm.html), [Toronto Metropolitan](https://grad.journalism.torontomu.ca/2019-taylorwest/)
- 가족은 바다에 뛰어들어 부두에 3시간 매달렸다 — [NBC](https://www.nbcnews.com/news/world/family-escapes-australian-tornadoes-fire-clinging-jetty-3-hours-flna1B7904952)

**사월, 哀 — 세월호 최초 100시간의 기록 (한겨레, 2014)**
- 화면을 스크롤하면 4월 16일 오전 7시 8분부터 4월 20일 오전 10시 20분까지 5952분의 타임라인이 펼쳐진다. 4개 챕터, 기자 4명 참여 — [기자협회보](https://www.journalist.or.kr/m/m_article.html?no=33739)

**Parable of the Polygons / The Evolution of Trust (Nicky Case 외)**
- Parable(2014, Vi Hart·Nicky Case)은 Schelling 분리 모형을 다룬 탐색형 설명글. 먼저 도형을 손으로 옮기게 한 뒤 자동 시뮬레이션으로 넘어간다 — [Kill Screen](https://www.killscreen.com/parable-polygons-teaches-us-danger-and-power-individual-bias/), [Wikipedia](https://en.wikipedia.org/wiki/Parable_of_the_Polygons)
- Evolution of Trust(2017)는 협력/배신을 고르고 상대 성격에 따라 결과가 갈리는 약 30분 분량의 죄수의 딜레마 체험 — [Exploring Economics](https://www.exploring-economics.org/de/entdecken/the-evolution-of-trust/), [FlowingData](https://flowingdata.com/?p=49228)

### Inferences
- **재현 기술(모두 추론):** Uber Game은 Ink+inkjs 또는 상태 머신과 서버 집계 백분위. Syrian Journey와 Pirate Fishing은 단순 분기 그래프. Spent는 잔액 상태값이 선택지를 잠그는 구조. Bury me는 `setTimeout` 큐와 타이핑 표시(웹에서는 Notification API 없이도 재현 가능). Snow Fall과 Firestorm은 `IntersectionObserver` 또는 스크롤 위치 연동 `position: sticky`. '사월, 哀'는 스크롤 값을 시각으로 변환하는 매핑.
- 02:05 장면에는 '사월, 哀'의 시각 매핑이 가장 직접적이다. 예컨대 스크롤이나 드래그 진행이 02:05에서 멈추고 더 내려가려면 선택해야 하는 구조가 가능하다.
- Uber Game의 "부수적 선택 기록"은 마지막 질문에 쓸 수 있다. 게임 초반의 행동을 결말 화면에서 되돌려 보여 주면 선택 하나가 전체 플레이의 정산이 된다.
- Pirate Fishing의 자기비판은 경고로 볼 만하다. 다섯 선택지의 결과가 같으면 플레이어는 곧 알아차린다.
- Syrian Journey의 반발은 실제 희생자를 다루는 Titanic 작품에도 해당한다. 승패 점수나 "성공" 표현은 피하는 편이 안전하다.

### Gaps
- **방법 한계:** 직접 원문을 연 것은 OpenNews(Uber Game), Wikipedia(The Button), MIT 호놀룰루 경보 수업 페이지뿐이다. 나머지는 검색 결과 요약에 근거하며, 링크는 해당 내용이 나온 결과 묶음의 대표 URL이라 세부 수치는 원문 대조가 필요하다.
- '그날 바다'라는 세월호 인터랙티브 기사는 찾지 못했다. 같은 이름의 2018년 영화 《그날, 바다》와 혼동된 것으로 보인다.
- 뉴스타파와 경향의 세월호 인터랙티브, 이태원 참사 인터랙티브 기사, 스토리펀딩은 형식을 확인할 자료를 찾지 못했다. 이태원 검색에서는 일반 기사만 나왔다.
- 조사하지 못한 항목: The Counted, Reuters, ProPublica, Bloomberg, The Pudding, If It Were My Home, Papers, Please류, Molleindustria, Gone Home.
- NYT "Rent or Buy" 계산기의 슬라이더 조작은 신뢰할 출처를 찾지 못했다.
- Firestorm의 실제 스크롤·영상 동작은 작품을 직접 확인하지 못했다.

## 도덕 실험과 1회성 버튼은 타인과의 비교를 어떻게 쓰는가

### Takeaway
비교는 두 시점에 쓰인다. Absurd Trolley Problems와 Moral Machine은 답한 뒤 다수와 비교하고, The Button은 누른 시점을 영구 신분(플레어)으로 남긴다. "누르지 않음"까지 신분으로 만든 것이 The Button의 핵심이다.

### Cited Findings
**Moral Machine (MIT Media Lab)**
- 두 교통 상황 중 하나를 고르는 방식으로, 누가 다치거나 죽을지 결정한다. 답변 후 자신의 응답을 타인과 비교할 수 있고 직접 시나리오를 만들 수도 있다 — [MIT 프로젝트](https://www.media.mit.edu/projects/moral-machine/), [Digital Trends](https://digitaltrends.com/cars/mit-moral-machine)
- 결과는 나이, 사회적 중요도, 법규 준수 같은 요인이 본인에게 얼마나 중요한지 보여 준다. 시나리오는 제약 안에서 무작위 생성된다 — [HERE](https://here.com/node/71076), [Kottke](https://kottke.org/16/10/solve-trolley-problem-scenarios-with-mits-moral-machine)

**Absurd Trolley Problems (Neal Agarwal, 2022)**
- 고전적 트롤리 문제로 시작해 점점 터무니없는 변주로 넘어간다. 고전 문제 답변 후 같은 답을 한 사람의 비율을 보여 준다. 끝에 철학을 해결해 줘서 고맙다고 한다 — [VICE](https://noisey.vice.com/en/article/wxn58q/absurd-trolley-problems-presents-increasingly-ridiculous-ethical-dilemmas), [FlowingData](https://flowingdata.com/2022/07/06/absurd-trolly-problems)

**The Button (Reddit, 2015년 4월 1일~6월 5일)**
- 전 세계 공유 60초 카운트다운. 누구든 누르면 60초로 초기화된다. 2015년 4월 1일 이전 생성 계정만 1회 가능 — [Wikipedia](https://en.wikipedia.org/wiki/The_Button_(Reddit))
- 누른 순간의 남은 시간이 플레어 색이 된다: 보라 60~52초, 파랑 51~42, 초록 41~32, 노랑 31~22, 주황 21~12, 빨강 11~0. 회색은 누르지 않음, 흰색은 누를 자격 없음 — [Wikipedia](https://en.wikipedia.org/wiki/The_Button_(Reddit))
- 색마다 이름 붙은 집단이 생겼고, 비(非)누름 진영 "Knights of the Button"은 더미 계정으로 타이머를 지키려 했다 — [Wikipedia](https://en.wikipedia.org/wiki/The_Button_(Reddit))
- 총 1,008,316회 클릭. 일부 시점에 제때 눌렀는데도 0에 도달했고 관리자는 DB 오류라고 설명했다 — [Wikipedia](https://en.wikipedia.org/wiki/The_Button_(Reddit))

### Inferences
- **재현 기술(모두 추론):** Moral Machine은 좌우 2분할 카드와 서버 집계. Absurd Trolley는 선택 뒤 비율 막대 전환. The Button은 WebSocket이나 서버 시각 기준 카운트다운에 계정 1회 제약.
- The Button의 색 구간은 02:05 장면에 응용할 수 있다. 정해진 시간 안에 언제 결정했는지를 "즉시 / 망설임 / 끝까지"로 나눠 결말 문구에 쓰면 된다. "지켜본다"를 무응답과 같은 신분으로 다루는 것은 회색 플레어와 같은 구조다.
- 비교 통계는 선택 후에만 보여 줘야 한다. 두 사례 모두 답변 뒤 공개한다. 먼저 보여 주면 선택이 다수 추종으로 바뀔 가능성이 있다.
- 집계 표본이 적은 초기에는 비율 표시가 왜곡되므로 일정 수 이상 모인 뒤 노출하는 처리가 필요하다.
- The Button의 DB 오류 논란은 동기화 타이머의 위험을 보여 준다. 혼자 하는 게임이면 클라이언트 타이머로 충분하다.

### Gaps
- Moral Machine의 "세션당 13문제"는 단일 언론 보도에서만 봤고 Nature 논문은 접근이 막혀 확인하지 못했다.
- Absurd Trolley Problems의 구체 비율과 화면 배치, 각 문제에 시간 제한이 있는지는 출처를 찾지 못했다.
- r/place, The Trolley Problem Game, 기타 1회 누름 웹페이지는 조사하지 못했다.

## 적대적 UI, 커밋 패턴, 브라우저 입력 예술은 무엇을 빌려줄 수 있는가

### Takeaway
"결심의 물리적 비용"을 만드는 방법은 길게 누르기(약 2초)와 이름 타이핑이 대표적이다. Do Not Touch의 과거 방문자 커서는 "남들이 이미 지나간 흔적"을 보여 주는 가장 구체적인 사례다.

### Cited Findings
**Do Not Touch (Studio Moniker, 2013, Light Light "Kilo")**
- 시작 전에 마우스 움직임이 기록된다고 경고하고, 시청자에게 지시를 내린다. 각자의 커서 데이터가 영상에 더해지고 약 1시간마다 다시 렌더링된다 — [Arshake](https://www.arshake.com/en/frame-do-not-touch-2/), [GeekDad](https://geekdad.com/2013/04/do-not-touch-a-crowdsourced-music-video/)
- 400만 명 이상 참여, 17,500회 이상 렌더 — [Studio Moniker](https://studiomoniker.com/projects/do-not-touch)

**User Inyerface (Bagaar)**
- 일부러 최악으로 만든 가입 양식을 최대한 빨리 채우는 브라우저 게임. 화면마다 입력 검증이 있고 마지막에 지독한 캡차가 나온다. 끝나면 소요 시간을 보여 주며 5분 안팎이면 최상위 기록으로 친다 — [t3n](https://t3n.de/news/?p=1178186), [Core77](https://www.core77.com/posts/123695/User-Inyerface-Intentionally-Terrible-UIUX-Design)

**GitHub식 이름 타이핑 확인**
- 저장소 이름을 정확히 입력해야 삭제 버튼이 활성화된다. 드물고 결과가 큰 동작에만 쓰라는 권고가 있다 — [Open Skill Index](https://openskillindex.com/skills/intense-visions-harness-engineering-ux-confirmation-dialogs), [SaaS UI](https://www.saasui.design/blog/saas-destructive-actions-confirmation-ux-patterns)

**길게 누르기 확인 (hold-to-confirm)**
- 약 2초 누르는 동안 진행 표시가 덮이고, 접근성 레이블로 길게 눌러야 함을 알린다 — [구현 가이드](https://instagit.com/emilkowalski/skills/how-to-implement-hold-to-delete-pattern.md)
- 많은 구현이 키보드 지원을 빼거나 2단계 클릭으로 흉내 내 패턴의 의미를 약화시킨다 — [HoldToConfirm](https://tfe-svelte-templates.vercel.app/holdtoconfirm)

**The Wilderness Downtown (Chris Milk·Google Creative Lab, 2010, Arcade Fire "We Used to Wait")**
- 자란 집 주소를 입력하면 Street View 이미지를 끌어와 여러 브라우저 창을 연출한다. 도중에 "그때 그곳에 살던 어린 자신에게" 조언 엽서를 쓰게 한다 — [Google Maps 블로그](https://maps.googleblog.com/2010/08/street-view-and-wilderness-downtown.html), [Experiments with Google](https://experiments.withgoogle.com/the-wilderness-downtown)
- 데이터가 부족한 주소는 거부됐다는 후기가 있다 — [검색 결과: eWeek](https://www.eweek.com/development/google-chrome-arcade-fire-provide-memory-lane-experiment/)

### Inferences
- **재현 기술(모두 추론):** 길게 누르기는 Pointer Events(`pointerdown`/`pointerup`/`pointercancel`)와 `requestAnimationFrame` 진행값. 터치에서는 `touch-action: none`과 컨텍스트 메뉴 억제가 필요하다. Do Not Touch식 흔적은 좌표를 `{t,x,y}`로 샘플링해 저장한 뒤 canvas로 재생. 이름 타이핑은 입력값 일치 시 버튼 활성화.
- Do Not Touch 방식의 응용: 선택지 위에 이전 플레이어들의 커서가 망설인 궤적을 재생하면 비율 표시보다 "다른 사람도 여기서 멈췄다"는 감각이 강하다.
- 동작별로 비용을 다르게 줄 수 있다. "자리에 앉는다"는 짧은 클릭이고, "아이에게 양보한다"는 긴 누름이며, 손을 떼면 진행이 풀리는 식이다. 어떤 선택에 더 비싼 비용을 매기느냐가 작품의 판단이 되므로 의도를 정해야 한다.
- 커서 기록은 터치 기기에서 궤적이 끊긴다. 모바일에서는 탭 위치와 망설인 시간만 기록하는 쪽이 현실적이다.
- 한국어 IME 입력은 조합 중 값이 달라져 이름 타이핑 비교에 `compositionend` 처리가 필요하다.
- 길게 누르기는 키보드 대체 입력이 있어야 한다. 스페이스바 누름 유지로 맞출 수 있다.

### Gaps
- Terms & Conditions 소재 예술, Stripe의 확인 패턴, "Don't look at me", ROME(3 Dreams of Black), Chrome Experiments 전반, 웹캠·마이크 입력 사례는 조사하지 못했다.
- User Inyerface 타이머의 화면상 동작(증가/감소, 상시 표시 여부)은 확인하지 못했다.
- GitHub 패턴은 공식 문서가 아닌 UX 가이드를 통해 확인했다.

## 광고와 공익 캠페인은 시청자의 개입을 어떻게 만드는가

### Takeaway
2009~2010년 YouTube 주석형 분기가 원형이고, 이후에는 기기 자체를 쓰는 방향으로 넓어졌다. UNICEF Tap Project는 "아무것도 하지 않음"을 입력으로 삼았다는 점에서 '지켜본다' 선택지에 가장 가까운 사례다.

### Cited Findings
**Choose a Different Ending (런던 경찰청, AMV BBDO, 2009)**
- 10대 소년 시점의 영상을 보다가 칼을 가져갈지, 파티에 갈지, 상대를 찌를지를 고른다. YouTube 주석으로 연결한 영상 21편, 결말 10개. 결과를 본 뒤 "다른 결말을 선택"할 수 있다 — [D&AD](https://dandad.org/awards/professional/2010/integrated/17748/choose-a-different-ending), [Interview Magazine](https://www.interviewmagazine.com/culture/chose-your-own-psa)
- 약 260만~270만 조회, 인지도 78%는 대행사 출품 자료의 자체 수치다. 2010년 Cannes Lions 수상 — [Cannes](https://lovethework.com/work-awards/entries/choose-a-different-ending-275030)

**Lifesaver (Resuscitation Council UK, UNIT9)**
- 실사 영상과 상호작용을 합친 위기 시뮬레이터. 기기를 초당 2회 위아래로 움직여 영상 속 환자에게 가슴 압박을 수행한다. PC, 스마트폰, 태블릿에서 무료 — [Resuscitation Council UK](https://www.resus.org.uk/apps/lifesaver), [UNIT9](https://www.unit9.com/project/lifesaver-cpr)

**A Hunter Shoots a Bear (Tipp-Ex, Buzzman, 2010)**
- 곰을 쏘지 못하는 사냥꾼이 플레이어 밖으로 손을 뻗어 수정 테이프로 제목의 "shoots"를 지운다. 시청자가 동사를 직접 입력하면 그 행동을 영상이 연기한다 — [Creative Review](https://www.creativereview.co.uk/tipp-exs-interactive-hunter-shoots-a-bear-film/), [Ads of the World](https://www.adsoftheworld.com/campaigns/a-hunter-shoots-a-bear)
- 결말 수는 42개 이상, 50개 이상으로 출처가 엇갈린다. 3,550만 조회는 대행사 수치 — [D&AD](https://www.dandad.org/work/d-ad-awards-archive/a-hunter-shoots-a-bear), [ClickZ](https://www.clickz.com/boring-product-great-ad-tipp-ex-channels-subservient-chicken/54805/)

**Deliver Me to Hell (Hell Pizza, 뉴질랜드, 2010)**
- 좀비 도시를 지나 피자를 배달하는 주인공의 경로를 영상 끝마다 고른다. 나쁜 결말이면 다시 시작한다 — [Scoop](https://scoop.co.nz/stories/CU1008/S00125/world-first-pick-a-path-interactive-zombie-movie.htm), [Dread Central](https://www.dreadcentral.com/news/18722/new-zealand-s-hell-pizza-launches-interactive-zombie-movie-adventure)

**Unskippable (GEICO, The Martin Agency, 2015)**
- 건너뛸 수 없는 첫 5초 안에 메시지를 끝낸 뒤 인물이 멈춰 있는 듯 연기한다. 약 15초짜리 4편 — [TIME](https://time.com/3730021/geico-unskippable-ad-youtube), [Tubefilter](https://www.tubefilter.com/2015/03/03/geico-pre-roll-youtube-ads-unskippable-videos/)

**UNICEF Tap Project (2014 모바일판)**
- 휴대폰으로 사이트를 연 뒤 내려놓으면 몇 초 후 타이머가 시작되고 휴대폰이 움직이면 끝난다. 후원사가 건드리지 않은 시간에 비례해 깨끗한 물을 기부한다. 비율은 대체로 10분에 1일이지만 5분·15분으로 쓴 곳도 있다 — [Gizmodo](https://gizmodo.com/help-get-clean-water-to-needy-kids-just-by-ignoring-yo-1528646699), [LBB](https://lbbonline.com/news/put-your-phone-down-to-help-save-lives)

**Most Shocking Second a Day (Save the Children, Don't Panic, 2014)**
- 런던 소녀의 일상이 전쟁으로 무너지는 과정을 1일 1초 형식으로 보여 준다. 상호작용은 없는 영상이다. 조회수는 자체 발표로 5,200만~1억 5,000만까지 다양하다 — [UNIT9](https://unit9.com/project/save-the-children-syrias-children), [Don't Panic](https://dontpaniclondon.com/work/most-shocking-second-a-day)

**라이프펌프 캠페인 (캐리비안베이·제일기획)**
- 물놀이 튜브에 바람을 넣는 동작으로 심폐소생술을 체험하게 하는 오프라인 참여형. 첫날 2천 명 이상 참여로 소개됐다 — [위픽레터](https://letter.wepick.kr/post/2091)

### Inferences
- **재현 기술(모두 추론):** 영상 분기는 HTML5 `<video>` 전환 또는 YouTube IFrame API. Lifesaver식 흔들기는 DeviceMotion API(iOS 권한 요청 필요)이며, PC에서는 스페이스 또는 클릭 리듬으로 대체할 수 있다. Tap Project식 무입력은 DeviceMotion과 Page Visibility API. Tipp-Ex식 동사 입력은 제목 텍스트를 입력창으로 전환하고 허용 어휘에 대응.
- Tap Project는 '지켜본다'에 그대로 쓸 수 있는 구조다. 입력 없음이 곧 기록되는 행동이며 시간이 지날수록 결과가 쌓인다. 이 게임에서는 방향이 반대라, 가만히 있는 동안 자리가 사라지는 식으로 뒤집을 수 있다.
- Tipp-Ex의 "제목을 고쳐 쓰기"는 질문 문구 자체를 플레이어가 지우는 연출로 옮길 수 있다.
- GEICO의 멈춤 연기는 UI가 멈춘 듯 보이는 순간의 긴장을 보여 준다. 선택 뒤 몇 초간 화면을 비우는 데 응용할 수 있다.
- Most Shocking Second a Day는 상호작용 없이도 시간 압축만으로 충격을 만든다. 02:05 직전 하루를 빠르게 압축하는 도입에 참고할 만하다.
- Choose a Different Ending의 재선택은 메시지(다시 고를 수 있으면 좋겠지만 현실은 아니다)에 맞았다. 타이타닉 결말에서 다시하기를 숨길지는 별도 결정 사항이다.

### Gaps
- Dumb Ways to Die 게임의 조작 방식은 확인하지 못했다.
- Volvo LifePaint와 "skip ad" 거부형 공익광고는 조사하지 못했다.
- 한국의 웹 기반 심폐소생술 체험 캠페인은 찾지 못했다. 라이프펌프는 웹이 아닌 오프라인 사례다.
- Lifesaver의 움직임 감지 방식(가속도계 사용 여부)은 출처에서 명시되지 않았다.

## 실제 비상 UI는 무엇을 알려 주는가

### Takeaway
Hawaii 오경보의 교훈은 긴장감 있는 UI가 아니라 "확인 절차가 있어도 믿음이 틀리면 막지 못한다"는 점이다. 확인 대화상자 자체는 있었다.

### Cited Findings
**Hawaii 탄도미사일 오경보 (HI-EMA, 2018년 1월 13일)**
- 오전 8시 7분 발송 문구: "BALLISTIC MISSILE THREAT INBOUND TO HAWAII. SEEK IMMEDIATE SHELTER. THIS IS NOT A DRILL." 38분 뒤 정정 — [MIT 수업 자료](https://web.mit.edu/2.744/www/resourceMaterials/ClassExercises/HawaiiAlert.html)
- 담당자는 드롭다운에서 실경보 템플릿을 고르고 발송 여부를 묻는 확인 창에 동의했다 — [FCC 예비보고 보도](https://www.tvtechnology.com/news/human-error-poor-safeguards-contribute-to-false-missile-alarm-fcc-finds), [Yahoo/Reuters](https://news.yahoo.com/fcc-criticizes-hawaii-over-faulty-missile-alert-155041140.html)
- 초기에는 메뉴 오선택으로 설명됐으나 FCC 예비보고는 예고 없는 훈련의 녹음을 듣고 실제 상황으로 믿었다고 진술했다고 밝혔다. 녹음에는 "Exercise, exercise, exercise"와 "This is not a drill"이 함께 있었다 — [The Conversation](https://theconversation.com/hawaiis-missile-alert-gaffe-why-good-human-machine-design-is-critical-90144), [KAXE/NPR](https://www.kaxe.org/2018-04-10/fcc-on-hawaiis-bogus-alert-dont-say-this-is-not-a-drill-during-drills)
- FCC 권고: 둘 이상의 권한자 검증, 실경보와 시험 환경 분리, 확인 창 포함 — [NPSTC](https://blog.npstc.org/?p=6859)
- 정정 지연의 원인은 출처마다 다르다(FEMA 허가 대기로 본 설명과 주 내부 처리 문제로 본 설명) — [Scientific American](https://www.scientificamerican.com/article/hawaiis-missile-alert-gaffe-why-good-human-machine-design-is-critical/), [The Gazette](https://gazette.com/?p=1151403)

### Inferences
- **재현 기술(추론):** 일반 `<select>`와 네이티브 스타일 확인 창을 그대로 쓰는 것으로 충분하다. 화려한 카운트다운보다 평범한 양식이 더 서늘할 수 있다.
- 타이타닉 장면에 응용한다면 잘못된 정보 아래의 결정이 소재가 된다. 당시 승객도 상황을 완전히 알지 못했으므로, 선택 뒤에 알게 되는 정보를 두는 구조가 어울린다.
- "THIS IS NOT A DRILL"식 전부 대문자 단문은 비상 문구의 어조 참고가 된다. 게임 대사로 쓸 때는 시대에 맞는 표현으로 옮겨야 한다.
- 정정에 38분이 걸린 사실은 "되돌리기가 없는 UI"의 실제 사례다.

### Gaps
- HI-EMA 메뉴의 정확한 문구와 배치는 원본 이미지를 확인하지 못해 싣지 않았다.
- 정정 메시지 템플릿 부재 여부는 이번 출처로 확정하지 못했다. FCC 최종 보고서 원문 확인이 필요하다.
- 일반 재난문자 UI와 카운트다운형 비상 UI 사례는 조사하지 못했다.
