# 인터페이스 자체가 결정을 강요·전복하는 인디/실험/아케이드 게임 사례집 (타이타닉 02:05 마지막 자리 재연출용)

> 읽는 법: **[브라우저 ○]** 그대로 구현 가능 / **[△]** 변형 필요 / **[✕]** 불가. 브라우저 판정은 작성자의 공학적 추론이며, MDN을 링크한 항목만 API 사양으로 확인했다. **[요약경유]** 표시는 검색 결과 요약으로만 확인하고 원문을 직접 열지 못한 내용이다. 위키백과 인용은 대부분 페이지 요약 도구를 거쳤으므로, 세부 수치는 최종 인용 전 재확인을 권한다.

## 1. 인터페이스가 거짓말하고, 줄어들고, 선택지를 빼앗고, 커서가 저항하는 사례

### Takeaway
가장 강력한 수법은 화려한 글리치가 아니라 "플레이어가 믿는 약속(저장, 버튼, 내레이션)을 한 번 어기는 것"이다. 다만 진짜 파일·창·하드웨어를 건드리는 수법은 브라우저에서 막혀 있어, DDLC Plus와 OneShot 콘솔판처럼 **가짜 데스크톱을 게임 안에 그려 넣는 방식**이 현실적인 대안이다.

### Cited Findings

**내레이션/UI의 거짓말**
- **The Stanley Parable** — 두 개의 열린 문 앞에서 내레이터가 아직 일어나지 않은 "스탠리는 왼쪽 문으로 갔다"를 먼저 말한다. 오른쪽으로 가면 내레이터가 이야기를 고치며 되돌리려 한다. 진짜 첫 선택은 그 앞의 "사무실 문을 잠글지"이며 고유 엔딩으로 이어진다. 엔딩 뒤 게임은 처음으로 리셋된다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Stanley_Parable) **[브라우저 ○]** 텍스트/음성이 입력보다 먼저 결과를 단정하게 만들면 된다.
- **The Stanley Parable (의도적 고장)** — 지시대로 버튼을 눌러야 하는 퍼즐에서 키보드 입력을 연결하지 못한 상태가 그대로 남았고, 플레이어들은 이를 통제력 상실의 표현으로 읽어 호평했다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Stanley_Parable) **[브라우저 ○]** 특정 순간에 입력 핸들러만 끊으면 된다.
- **Undertale (Flowey의 거짓말)** — 초반 Flowey가 "LV"의 의미를 속이고, 뉴트럴 엔딩에서 Sans가 LOVE/EXP가 "level of violence", "execution points"임을 밝힌다. 게임 내내 보던 수치의 이름이 뒤늦게 고발문이 된다. — [Wikipedia](https://en.wikipedia.org/wiki/Undertale) **[브라우저 ○]** HUD 라벨의 의미를 결말에서 재정의.
- **Undertale (전투 명령과 살리기)** — 공격은 타이밍 입력, 방어는 작은 하트를 움직이는 탄막 회피다. 살리기(Spare)는 올바른 반응을 고르거나 적의 HP를 죽이지 않을 만큼 낮춰야 하며, 일부 보스는 대사가 끝날 때까지 버텨야 한다. 즉 "자비"가 버튼 하나가 아니라 인내 입력이다. — [Wikipedia](https://en.wikipedia.org/wiki/Undertale) **[브라우저 ○]**
- **Undertale (Flowey와 세이브 지배)** — 오메가 Flowey 직전 게임이 크래시하고, 재실행해야 전투가 시작된다. Flowey는 리셋을 넘어 기억하며, 제노사이드 루트에서는 자기 세이브 로드가 플레이어의 DETERMINATION에 밀려 실패했다고 말한다. — [Undertale Wiki](https://undertale.wiki/w/Flowey) **[브라우저 △]** 실제 크래시 대신 탭 전체를 "종료된 화면"으로 덮는 연출. 새로고침 후 이어지게 하려면 저장소 사용.
- **Undertale (지워지지 않는 죄)** — 제노사이드 후 게임을 다시 하려면 영혼을 Chara에게 넘겨야 하고, 이는 진(眞) 평화 엔딩을 영구히 바꾼다. 리셋은 undertale.ini 대부분을 지우지만 일부는 별도 파일에 남는다. — [Wikipedia](https://en.wikipedia.org/wiki/Undertale); [Undertale Wiki: SAVE](https://undertale.wiki/w/SAVE) [요약경유] **[브라우저 ○]** localStorage에 "초기화로 지워지지 않는 키"를 별도로 둔다.
- **Spec Ops: The Line** — 로딩 화면 팁이 평범하게 시작했다가 점차 Walker와 플레이어를 직접 적대한다("재미로 죽이는 것은 무해하다"는 취지의 문구). 콘래드는 물을 훔친 민간인과 그를 잡다 가족을 죽인 병사 중 하나를 처형하라고 강요한다. 작가 Walt Williams는 분노를 유발할 의도였고, 컨트롤러를 내려놓는 것도 유효한 반응이라고 말했다. — [Wikipedia](https://en.wikipedia.org/wiki/Spec_Ops:_The_Line) **[브라우저 ○]** 로딩·전환 문구를 점진적으로 변질.
- **Hellblade: Senua's Sacrifice (허풍 영구사망)** — 사망할 때마다 손의 썩음이 번지고 머리에 닿으면 세이브가 지워진다고 암시하지만, 실제로는 일정 횟수 뒤 멈추는 허풍이었다. Antoniades는 정신질환과 연결된 공포를 주려는 의도였다고 옹호했고, PC Gamer는 믿을 수 없는 서술로, Game Informer 리뷰어는 불명확한 위험으로 평가가 갈렸다. — [Wikipedia](https://en.wikipedia.org/wiki/Hellblade:_Senua%27s_Sacrifice) **[브라우저 ○]** 실제 삭제 없이 "삭제 경고"만으로 재현 가능.

**시스템 고장 위장·개인정보 읽기**
- **Eternal Darkness** — 초록 정신력 바가 낮아지면 TV/게임큐브의 가짜 오류가 나타난다. 메모리카드 포맷 메시지를 믿고 플레이어가 카드를 뽑아 실제 손상을 낼까 Nintendo가 우려했다. 게임플레이에는 영향이 없다. — [Wikipedia](https://en.wikipedia.org/wiki/Eternal_Darkness) **[브라우저 ○]** 전체화면 가짜 오류. 단 실제 브라우저/OS 보안 경고를 흉내 내면 이탈과 불신을 부를 수 있어 게임 세계 안의 장치로 한정 권장.
- **Metal Gear Solid (Psycho Mantis)** — 메모리카드에서 다른 코나미 게임 세이브를 읽어 언급하고, 컨트롤러를 바닥에 놓으라 한 뒤 진동시키며, 콘솔이 끊긴 듯 위장한다. 전투 중 모든 입력을 읽는 그를 이기려면 컨트롤러를 2번 포트로 옮겨야 한다. 후속 이식판은 키보드 사용이나 설정의 플레이어 2 전환으로 바뀌었다. — [Wikipedia](https://en.wikipedia.org/wiki/Psycho_Mantis) **[브라우저 △]** 다른 게임 기록은 읽을 수 없으나 이 게임 내 이전 선택·접속 시각은 읽을 수 있다. "포트 교체" 대응물은 입력 수단 전환(마우스→키보드, 세로→가로 회전).
- **Metal Gear Solid 3 (The End)** — 전투 중 저장·종료 후 일주일을 기다리거나 콘솔 시계를 앞당기면 The End가 노환으로 죽어 있다. — [Wikipedia](https://en.wikipedia.org/wiki/Metal_Gear_Solid_3:_Snake_Eater) **[브라우저 ○]** 저장된 타임스탬프와 Date.now() 비교. 재방문 시 상황이 이미 끝나 있는 연출에 적합.
- **Pony Island** — 낡은 아케이드 게임을 해킹해 나아가는 구조. 가짜 오류 화면과 친구가 보낸 것처럼 꾸민 Steam 메시지를 썼고, 마지막에 "Hopeless Soul"이 플레이어에게 게임 파일 삭제를 요청한다. 코드 명령을 재배열하는 실시간 퍼즐이 있다. — [Wikipedia](https://en.wikipedia.org/wiki/Pony_Island) **[브라우저 △]** 페이지 내 가짜 알림·메신저는 가능, 실제 Steam/OS 메시지는 불가.
- **There Is No Game (Wrong Dimension)** — 2015 Newgrounds Construct Jam("deception" 주제) 수상작에서 출발한 포인트앤클릭. "게임"이 음성으로 플레이를 말리고, 그만두지 않으면 세이브를 지우는 척한다. "플레이/삭제" 선택에서 플레이를 고르면 크래시가 난다. — [Wikipedia](https://en.wikipedia.org/wiki/There_Is_No_Game:_Wrong_Dimension) **[브라우저 ○]** 원작이 Construct 2 기반 잼 게임.

**파일·창·신체를 대가로**
- **Doki Doki Literature Club** — 특정 시점에 플레이어가 게임 파일을 조작해야 진행된다. Monika는 코드를 고쳐 다른 인물을 나쁘게 만들고 삭제하며, 그녀의 캐릭터 파일을 지울 때까지 계속 말한다. Plus판은 실제 파일 조작을 게임 내 가상 데스크톱으로 대체했다. — [Wikipedia](https://en.wikipedia.org/wiki/Doki_Doki_Literature_Club!) **[브라우저 △]** 실제 파일 불가, Plus식 가상 데스크톱은 가능.
- **OneShot** — 로그인/프로필 이름으로 플레이어를 호명하고, 창을 화면 밖으로 옮기면 코드가 보이며, 폴더 안 파일을 옮겨야 풀리는 퍼즐이 있다. 콘솔판은 시뮬레이션 OS "The World Machine"으로 대체했다. Psycho Mantis가 영감으로 언급됐다. — [Wikipedia](https://en.wikipedia.org/wiki/OneShot) **[브라우저 △]** 일반 페이지는 자기 창을 옮길 수 없고 window.open으로 연 단일 탭 창만 제한적으로 가능하다 — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/moveTo). 페이지 안의 가짜 창을 드래그하는 방식으로 대체.
- **Inscryption** — 카드를 내려면 이미 놓인 카드를 희생해야 하며, 패배하면 Leshy의 카메라가 영혼을 "death card"로 찍어 다음 판에 재등장시킨다. Act III 뒤 디스크 전체 삭제가 진행되는 가운데 게임이 붕괴한다. 원형인 잼 게임 *Sacrifices Must Be Made*는 희생을 신체로 확장해, 눈을 잃으면 시야가 좁아지는 효과를 구상했다. — [Wikipedia](https://en.wikipedia.org/wiki/Inscryption) **[브라우저 ○]** 시야 축소는 CSS clip/마스크로 쉽게 구현.
- **Execution → 2번 항목**, **NieR → 5번 항목** 참조.

**의도적으로 나쁜 UI (웹 네이티브)**
- **User Inyerface (Bagaar)** — 벨기에 디자인 에이전시의 웹 회원가입 게임. 예시 문구가 클릭해도 지워지지 않고, 클릭 가능한 요소에서 커서가 변하지 않으며, 닫기 버튼은 약관처럼 보이는 글 아래 숨고, "키릴 문자 1개 포함" 같은 비밀번호 조건과 판독이 필요한 확인창을 쓴다. — [Gizmodo](https://gizmodo.com/this-websites-deliberately-frustrating-interface-will-m-1836131103) **[브라우저 ○]** 웹 그 자체가 재료.
- **브라우저 커서 제약** — Pointer Lock은 커서를 숨기고 상대 이동값을 주지만 사용자 제스처가 필요하고 ESC로 풀린다. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API). beforeunload 대화창은 문구를 지정할 수 없고 사용자 상호작용이 있어야 뜨며 모바일에서 신뢰할 수 없다. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

### Inferences
- **커서 저항의 실제 구현:** 시스템 커서를 숨기고 가짜 커서를 그려, 입력과 표시를 어긋나게 한다. 예: "자리를 차지한다" 쪽으로 움직일 때만 가짜 커서가 무겁게 뒤처진다. 터치에는 커서가 없으므로 손가락 아래 대상이 미끄러지는 방식으로 분기 구현이 필요하다.
- **5지선다의 축소:** Depression Quest처럼 선택지 자체를 앞선 플레이로 지운다. 배에서 아무도 돕지 않았다면 "아이/노인에게 양보"에 취소선을 긋되 글자는 읽히게 둔다.
- **내레이터 선언:** 입력 전에 "당신은 자리에 앉았다"가 먼저 찍히고, 플레이어가 그것을 거스르게 하는 Stanley식 구조가 프로토타입의 hold보다 저비용이다.
- **허풍의 비용:** Hellblade의 반발을 보면 "기록이 지워진다"류 경고는 실제로 이행하거나, 허풍임을 작품 안에서 회수해야 한다.

### Gaps
- Undertale의 MERCY 버튼이 도망가거나 FIGHT 바가 조작되는 구체 장면은 확인하지 못했다. 위키백과는 "타이밍 입력"까지만 서술한다. "Photoshop Flowey" 세이브 관련 세부는 품질이 낮은 출처뿐이었다.
- Psycho Mantis의 "HIDEO" 암전, 고문 장면의 연타 조작은 접근한 페이지에 없었다(Metal Gear 위키는 402 차단).
- Inscryption의 이빨 뽑기, OLD_DATA 내용, Stanley의 Broom Closet 세부, Spec Ops의 열화상 박격포 화면과 교수형 장면의 제3의 선택은 출처 미확보.
- Papers, Please의 "일부러 불편한 UI" 주장은 잘린 문장으로만 확인되어 인용하지 않았다.

## 2. 영구적·1회성 선택과 플레이어를 기억하는 게임

### Takeaway
1회성은 기술보다 "돌아왔을 때 무엇이 보이는가"로 완성된다. One Chance의 쿠키와 Execution의 "It's already too late"는 웹에서 거의 그대로 재현할 수 있고, 삭제 우회가 가능하다는 약점은 One Chance가 이미 겪은 범위 안에 있다.

### Cited Findings
- **Execution (Jesse Venbrux, 2008)** — 조준경 너머 기둥에 묶인 남자, 맥락 없음. 쏘면 "졌다"고 알려준다. 재실행하면 시작 화면에 "It's already too late"가 뜨고, 조준경 속 남자는 계속 죽어 있다. 이기는 유일한 방법은 쏘기 전에 게임을 끄는 것이다. — [Kill Screen](https://www.killscreen.com/beg-your-life-experimental-about-execution) **[브라우저 ○]** localStorage + 페이지를 떠났는지 감지.
- **Iron Sunset (Venbrux)** — 기둥에 묶인 군인 셋 중 배신자 한 명을 쏴야 하지만 누구인지 모른다. 이후 입장이 뒤집혀 "살기 위해 무언가 말하라"는 입력을 받는데, 안내 없이 세 번의 다른 간청을 요구한다. 작성한 간청은 **다른 플레이어의 게임에서 군인의 대사로 나타난다.** — [Kill Screen](https://www.killscreen.com/beg-your-life-experimental-about-execution) **[브라우저 △]** 텍스트 입력은 쉬우나 공유에는 서버와 욕설 필터링이 필요.
- **One Chance (Dean Moynihan, 2010, Newgrounds)** — 6일 후 인류 멸종을 앞둔 과학자. 가족과 연구 사이에서 선택한다. 브라우저 쿠키로 재플레이를 막고, 새로고침하면 자신이 얻은 엔딩으로 돌아온다. 우회(쿠키 삭제, 다른 PC)는 가능하나 제작자가 만류했다. — [Wikipedia](https://en.wikipedia.org/wiki/One_Chance_(video_game)) **[브라우저 ○]** 원작이 브라우저 작품. localStorage는 브라우저를 닫아도 유지되지만 시크릿 모드 등에서 쓸 수 없을 수 있다 — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API).
- **Passage (Jason Rohrer)** — 5분에 일생을 압축. 좁고 긴 띠 화면에서 아바타가 처음엔 왼쪽 끝에 있어 앞이 넓게 보이고, 시간이 지나면 오른쪽으로 밀려 앞이 줄고 지난 길이 보인다. 이동 속도도 느려진다. 배우자를 만나면 함께 움직여 일부 길이 막힌다. 죽음은 필연이며 승리 조건이 없다. — [Wikipedia](https://en.wikipedia.org/wiki/Passage_(video_game)) **[브라우저 ○]** 화면 구도 자체를 시계로 쓰는 예.
- **The Marriage (Rod Humble)** — 마우스 호버만 입력. 파랑·분홍 사각형 위에 올리면 파랑이 줄고 둘이 가까워진다. 원 위에 올리면 원이 사라지고 분홍이 준다. 분홍은 파랑이 닿지 않으면 시간에 따라 투명해지며, **아무것도 안 하는 것도 상태를 바꾼다.** 어느 쪽이든 너무 작거나 투명해지면 끝난다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Marriage_(video_game)) **[브라우저 △]** 마우스는 그대로, 터치에는 호버가 없어 드래그/누름으로 바꿔야 한다.
- **Every Day the Same Dream (Molleindustria, 2009)** — 좌우 이동과 상호작용뿐. 일상을 따르면 침실로 돌아온다. 엘리베이터 노파가 "5 more steps and you will be a new person"이라 말하고, 경로를 벗어난 다섯 행동 뒤 빈 세계에서 옥상의 분신이 뛰어내리는 것을 본다. — [Wikipedia](https://en.wikipedia.org/wiki/Every_day_the_same_dream) **[브라우저 ○]** 플래시 브라우저 작품으로 분류됨.
- **Depression Quest** — Twine 하이퍼텍스트. 일부 선택지가 취소선으로 그어져 읽히지만 클릭할 수 없고, 선택지 아래 상태 문구가 우울 수준·치료·복약 여부를 표시한다. 정지 이미지와 분위기 음악이 함께 쓰인다. — [Wikipedia](https://en.wikipedia.org/wiki/Depression_Quest) **[브라우저 ○]** `<s>` 태그와 비활성 링크로 끝난다.
- **Reigns** — 카드를 좌우로 밀어 수락/거절(Tinder에서 착안). 군대·백성·교회·재산 네 게이지 중 하나가 **꽉 차거나** 비면 통치가 끝나고 다음 왕으로 이어진다. — [Wikipedia](https://en.wikipedia.org/wiki/Reigns_(video_game)) **[브라우저 ○]** 포인터 이벤트로 터치/마우스 공용.
- **Her Story** — 낡은 데스크톱의 검색창에 단어를 넣어 271개 인터뷰 클립을 찾는다. 클립을 보면 빨간 칸이 초록으로 바뀐다. 충분히 보면 채팅창이 "다 끝났냐"고 묻고, "예"를 고르면 플레이어가 Eve의 딸 Sarah였음이 드러난다. — [Wikipedia](https://en.wikipedia.org/wiki/Her_Story_(video_game)) **[브라우저 ○]**
- **Return of the Obra Dinn** — 시체에 회중시계를 쓰면 사망 직전 **소리**가 먼저 재생되고 그 순간이 정지 장면이 된다. 답은 세 개 단위로만 정답 확인되어 찍기를 막는다. — [Wikipedia](https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn) **[브라우저 ○]** 암전+음성 후 정지 일러스트로 저비용 구현.
- **Kentucky Route Zero** — 대화 선택으로 진행하는 "인터랙티브 시나리오". 때로 다른 인물의 대사를 고르게 되며, 빛을 끄면 광부의 환영이 보이는 등 표현이 바뀐다. — [Wikipedia](https://en.wikipedia.org/wiki/Kentucky_Route_Zero) **[브라우저 ○]**
- **Bury Me, My Love** — 시리아를 탈출하는 아내 Nour에게 메시지로 답하고 조언하는 구조. — [Wikipedia](https://en.wikipedia.org/wiki/Bury_Me,_My_Love) **[브라우저 ○]** 메신저 UI로 재현 가능.
- **Beholder** — 관리인 Carl이 세입자를 도청·수색·신고한다. 명령 복종과 세입자 편들기가 충돌하고 결말이 갈린다. — [Wikipedia](https://en.wikipedia.org/wiki/Beholder_(video_game)) **[브라우저 ○]**
- **80 Days (inkle, 2014)** — 80일 안에 세계일주, 돈·건강·시간 관리. 한 번 완주로 전체 75만 단어 중 약 2%만 본다. — [Wikipedia](https://en.wikipedia.org/wiki/80_Days_(2014_video_game)) **[브라우저 ○]**

### Inferences
- **Execution 구조는 "지켜본다/물러선다"에 가장 직접적으로 대응한다.** 페이지를 닫는 것 자체를 유일하게 무죄인 선택지로 둘 수 있다. Spec Ops 작가의 "컨트롤러를 내려놓는 것도 반응"이라는 말과 같은 논리다. 단 닫기 감지는 beforeunload가 불안정하므로 visibilitychange와 저장값으로 "돌아왔을 때" 판정한다.
- **재방문 화면이 본체:** 다시 접속하면 02:05가 아니라 02:20의 빈 바다가 나오고, 본인이 고른 자리에 그대로 표시.
- **Passage식 구도:** 20초 동안 화면 프레임이 서서히 밀려 구명정이 시야 끝으로 빠지게 하면, 숫자 타이머 없이도 시간이 줄어든다.
- **Marriage식 무행동:** "지켜본다"를 버튼이 아닌 입력 정지로 정의. 아무것도 안 하면 상태가 진행된다.

### Gaps
- September 12th(Newsgaming, Frasca)는 위키 문서를 찾지 못해 미확인(문서 404, 날짜 문서로 연결됨).
- Actual Sunlight 문서는 404. iOS Lifeline은 동명의 PS2 게임 문서만 열려 실시간 대기·알림 구조를 확인하지 못했다. Bury Me의 실시간 알림 여부와 실화 기반 여부도 미확인. Kentucky Route Zero의 "감정을 고르는 선택" 분석도 미확보.
- Depression Quest의 취소선 비율은 2차 자료 간에 서술이 달라(상단 1~2개 vs 가장 건강한 선택 1개) 위키백과 수준으로만 기록했다.

## 3. 누르고 버티기, 조작 난이도가 곧 도덕이 되는 사례

### Takeaway
입력이 의미가 되는 지점은 "어렵게 만든 순간"보다 "손에 익은 입력의 의미가 바뀌는 순간"이다. Brothers 결말이 대표적이며, 20초 hold를 유지하더라도 **hold의 의미를 후반에 뒤집는 것**이 난이도를 올리는 것보다 효과적일 가능성이 높다.

### Cited Findings
- **Brothers: A Tale of Two Sons** — 내내 왼쪽 스틱/트리거는 한 형제, 오른쪽은 다른 형제. 형이 죽은 뒤 강을 건널 때는 양쪽 버튼을 번갈아 눌러 동생의 팔 스트로크를 만든다. 예전에 형이 업어 건넜던 강이다. — [AV Club](https://avclub.com/brothers-embodies-the-best-of-siblinghood-when-it-break-1798281600); Edge는 "상호작용으로 의미를 전달한다"고 평했다 — [Wikipedia](https://en.wikipedia.org/wiki/Brothers:_A_Tale_of_Two_Sons) **[브라우저 △]** 터치는 두 손가락으로 가능, 마우스는 포인터가 하나라 좌/우 클릭 또는 키보드 병용으로 변형.
- **The Stanley Parable ("Baby Game")** — 아기가 소각로로 걸어가지 못하게 버튼을 반복해서 눌러야 한다. 비평은 그 선택이 의미가 있는지를 묻는다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Stanley_Parable) **[브라우저 ○]** 연타 피로=책임이라는 가장 단순한 모델.
- **That Dragon, Cancer** — 2013 데모의 병실에서 장난감과 책을 줘도 Joel의 울음이 멈추지 않고 방을 나갈 수도 없다. 다른 모든 방법이 실패한 뒤에야 "앉아서 기도한다"는 선택이 나타나고 울음이 멈춘다. 레버를 당겨도 내부 연결이 끊겨 있던 기계 장면은 구상됐다가 삭제됐다. — [Wikipedia](https://en.wikipedia.org/wiki/That_Dragon,_Cancer) **[브라우저 ○]** 선택지를 소진시켜 마지막 하나를 드러내는 구조.
- **Before Your Eyes** — 웹캠으로 눈 깜빡임을 읽고, 깜빡이면 시간이 앞으로 건너뛰어 그 장면에 머물 수 없다. 마우스 클릭으로 대체 가능. 잦은 재보정 문제가 비판받았다. — [Wikipedia](https://en.wikipedia.org/wiki/Before_Your_Eyes) **[브라우저 △]** getUserMedia와 얼굴 인식 라이브러리로 원리상 가능하나 카메라 권한 부담이 크다. 클릭 폴백이 원작에도 있음.
- **What Remains of Edith Finch (Lewis)** — 한쪽 입력은 공상 세계를 움직이고 다른 쪽은 통조림 공장에서 생선 머리를 자른다. — [Wikipedia](https://en.wikipedia.org/wiki/What_Remains_of_Edith_Finch) **[브라우저 △]** 터치 두 손가락, 마우스는 커서+스페이스.
- **Florence** — 첫 데이트의 어색함을 퍼즐로 보여주고, 친해질수록 퍼즐이 쉬워진다. 양치, 이사 짐 싸기 등 짧은 입력. 음악(첼로/피아노)이 대화를 대신한다. — [Wikipedia](https://en.wikipedia.org/wiki/Florence_(video_game)) **[브라우저 ○]**
- **Journey** — 버튼을 누르는 길이가 외침의 길이와 크기를 정하고, 음은 배경음악과 어울린다. 상대를 방해할 수단이 없다. 눈보라 속에서 스카프를 충전할 수 없게 되며 쓰러진다. — [Wikipedia](https://en.wikipedia.org/wiki/Journey_(2012_video_game)) **[브라우저 ○]** Web Audio로 누름 시간-음량 매핑.
- **Papers, Please** — 드래그 앤 드롭이 굼떠서 책상 위로 미끄러져 나오는 도장대로 교체했고, 빨간 거부 도장은 불일치 발견 후 활성화하던 방식이 "너무 게임 같아" 사유 도장 체계로 바뀌었다. — [Wikipedia](https://en.wikipedia.org/wiki/Papers,_Please). 가족 상태 화면은 "점 몇 개와 텍스트뿐"으로 일부러 비워 상상하게 했다 — [Game Developer](https://www.gamedeveloper.com/design/designing-the-bleak-genius-of-i-papers-please-i-) **[브라우저 ○]** 교훈: 물리감은 드래그의 사실성보다 응답성에서 나온다.
- **Metal Gear Solid (고문)** — 오셀롯의 고문에 굴복했는지에 따라 Snake가 Meryl 또는 Otacon과 탈출한다. — [Wikipedia](https://en.wikipedia.org/wiki/Metal_Gear_Solid_(1998_video_game)) **[브라우저 ○]** 조작 지구력이 곧 타인의 생사로 연결.
- **QWOP (Bennett Foddy, 2008)** — 네 키가 허벅지/종아리를 하나씩 움직이는 브라우저 게임. 모바일은 터치 대체. 순위 없이 스스로 목표를 세우게 했다. — [Wikipedia](https://en.wikipedia.org/wiki/QWOP) **[브라우저 ○]**
- **Getting Over It** — 마우스로 망치를 직접 움직이고 체크포인트 없이 진행을 잃는다. 내레이션은 격려 위주로 방향을 바꿨다. 정상에 오르면 **녹화 중이냐고 묻고**, 아니라고 하면 완주자 채팅방에 들어간다. — [Wikipedia](https://en.wikipedia.org/wiki/Getting_Over_It_with_Bennett_Foddy) **[브라우저 ○]**
- **Papo & Yo** — 개구리를 먹으면 난폭해지는 Monster(아버지의 알코올 중독 은유). 마지막에 그를 재운 뒤 직접 밀어 심연으로 떨어뜨린다. 지금까지 도움을 주던 조작이 이별의 행위가 된다. — [Wikipedia](https://en.wikipedia.org/wiki/Papo_%26_Yo) **[브라우저 ○]**

### Inferences
- **hold의 의미 뒤집기 안:** 20초간 누르는 대상이 처음에는 "자리를 붙잡는 손"이다가, 후반에 화면이 바뀌어 그 손이 "옆 사람의 손목"이었음이 드러난다. 놓으면 양보, 계속 잡으면 차지. 조작은 같고 의미만 바뀐다.
- **Brothers식 두 터치:** "돕는다(자리를 확보하며 돕기)"를 두 지점 동시 입력으로 정의. 한 손은 자리, 한 손은 다른 사람. 데스크톱은 클릭+스페이스.
- **Baby Game식 연타:** "지킨다"를 hold가 아닌 연타로 바꾸면 자연스럽게 지친다. 손을 떼는 순간이 결정이 된다.
- **Journey식 부름:** 누르는 길이가 곧 "아이를 부르는 소리"가 되게 하면, 시간 입력이 말이 된다.
- **That Dragon식 소진:** 처음 눈에 보이는 선택이 하나씩 실패하며 사라지고, 끝까지 버틴 사람에게만 다섯 번째 선택이 드러난다.
- 진동은 사용자 활성화가 필요하고 Baseline이 아니므로 보조 효과로만 쓴다 — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate).

### Gaps
- Ico의 "손을 잡기 위해 버튼을 계속 누르는" 입력, Heavy Rain의 다중 버튼 동시 유지, Dark Souls의 프롬프트 연출, Death Stranding의 최종 입력은 위키에서 확인되지 않았다. Ueda의 "손을 잡는다" 콘셉트 자체는 [Wikipedia](https://en.wikipedia.org/wiki/Ico)에 있다.
- 고문의 버튼 연타 수치, 굴복-결말 대응(어느 쪽이 Meryl인지)은 미확인.
- Far Cry 4의 "식탁에서 기다리면 끝나는" 이스터에그는 [Wikipedia](https://en.wikipedia.org/wiki/Far_Cry_4)에서 확인했지만 "15분"은 해당 문서에 없다. 무행동이 정답인 사례로 유용하다.
- iOS Safari의 Vibration 미지원은 MDN 본문에 명시되지 않아 호환표 확인이 필요하다.

## 4. 생존 상황의 이기심, 타이타닉과 실제 재난 소재 게임

### Takeaway
타이타닉 게임 중 구명정 탑승을 인터페이스 차원의 도덕 선택으로 만든 사례는 찾지 못했다. 다만 Adventure Out of Time의 "구명정 표가 되는 카드를 남에게 줄 수 있다"는 설정과 60 Seconds!의 칸 제한이 이 프로젝트의 "마지막 한 자리"에 바로 쓸 수 있는 선례다.

### Cited Findings
- **Titanic: Adventure Out of Time** — 1인칭 포인트앤클릭. 시간은 과제 완료로만 진행되다가(회중시계 표시) **침몰이 시작되면 실시간으로 전환**되어 제한시간 안에 임무를 끝내고 구명정에 타야 한다. 블랙잭으로 얻는 "Death card"는 구명정 표로 쓰이고, 절박한 Zeitel에게 줘서 그림을 되찾을 수도 있다. 8개 엔딩 중 하나만 성공이며 대부분 주인공이 죽고 배는 구할 수 없다. — [Wikipedia](https://en.wikipedia.org/wiki/Titanic:_Adventure_Out_of_Time) **[브라우저 ○]**
- **Titanic: Honor and Glory** — 언리얼 기반 재현 프로젝트. 충돌부터 최종 침몰까지 실시간 체험과 구명정 하강, 공포 확산을 홍보한다. 자유 탐험과 스토리 모드 구상. — [TravelPulse](https://www.travelpulse.com/news/entertainment/titanic-honor-and-glory-game-recreates-voyage-sinking-in-full-detail); [TechRadar](https://techradar.com/features/ive-become-obsessed-with-a-simulation-of-the-titanic) [요약경유] **[브라우저 ✕(3D 원본)/△(실시간 시계 개념)]**
- **60 Seconds!** — 사이렌 후 60초 안에 집을 뒤져 물자와 가족을 대피소로 나른다. 아이템 위치는 매번 바뀐다. 한 가이드에 따르면 소지 공간은 4칸, 가방은 3칸을 차지한다. 이후 일지 형식으로 배급하며 가족 희생 같은 선택이 등장한다. — [Wikiwand](https://www.wikiwand.com/en/articles/60_Seconds!) [요약경유] **[브라우저 ○]** 2D 탑다운으로 축소 가능.
- **This War of Mine** — 낮엔 저격수 때문에 은신처, 밤에 약탈. 다른 생존자를 돕거나 강도·살인할 수 있고 생존자별 결말에 반영된다. 사라예보 포위전에서 영감. 휴전 시점은 무작위. — [Wikipedia](https://en.wikipedia.org/wiki/This_War_of_Mine) **[브라우저 ○]**
- **FTL: Faster Than Light** — 실시간 전투지만 일시정지 가능, 패배 시 세이브 삭제. 선체 파손은 승무원이 수리할 때까지 공기를 뺏고, 화재는 산소가 없으면 꺼진다. — [Wikipedia](https://en.wikipedia.org/wiki/FTL:_Faster_Than_Light) **[브라우저 ○]**
- **Sunless Sea** — 영구 사망이나 후계자가 일부 재산을 잇고 유언을 남길 수 있다. 느린 항해와 음악으로 긴장을 만든다. "EAT YOUR CREW"라는 2016년 보도자료 제목이 참고문헌에 있다. — [Wikipedia](https://en.wikipedia.org/wiki/Sunless_Sea) **[브라우저 ○]**
- **Inscryption** — 희생 없이는 카드를 낼 수 없어, 이득에 항상 희생이 묶인다(1번 항목). — [Wikipedia](https://en.wikipedia.org/wiki/Inscryption)

### Inferences
- **"자리"를 위치가 아니라 소유물로:** Death card처럼 자리를 끌어서 옮길 수 있는 표로 만든다. 자신에게 드래그=승선, 아이에게 드래그=양보, 끌고 있는 상태=망설임, 놓지 않음=방관.
- **02:05에서 시간 체계를 전환:** 게임 내내 장면 단위로 흐르던 시간이 마지막에만 실시간이 되는 AOoT 구조가 극적이다.
- **무게로 표현:** 60 Seconds의 칸 제한처럼 플레이어가 끌어온 짐·동행이 자리 수를 잠식하면, 앞선 플레이가 마지막 선택지를 바꾼다.
- 실제 희생자가 있는 사건이므로 "승리/패배" 표기는 피하는 편이 안전하다(Execution의 "You lose"는 허구의 처형이라 가능한 도발이다).

### Gaps
- Sea of Solitude, Don't Starve Together, SOS는 조사 호출 한도 안에서 확인하지 못했다.
- FTL에서 문을 열어 일부러 방을 진공으로 만드는 전술은 접근한 문서에 없었다. 위 항목은 공기 유출·산소 소화까지만 근거가 있다.
- Honor and Glory의 현재 개발 상태와 구명정 선택 시스템 유무는 확인 불가. 출처들은 2015~2023년 시점의 미완성 프로젝트로 서술한다. 타이타닉 모드·기타 실제 재난 게임의 구명정 선택 사례는 찾지 못했다.
- 60 Seconds의 4칸 수치는 단일 가이드 근거이고 게임에서 직접 검증하지 못했다.

## 5. 다인 딜레마, 다른 실제 플레이어의 선택을 보여주는 사례

### Takeaway
웹에서 가장 강한 선례는 NieR와 Reddit의 The Button이다. 전자는 "내 기록을 지워 모르는 사람을 돕는다"를, 후자는 "언제 눌렀는가가 곧 신원이 된다"를 보여준다. 둘 다 구명정의 "자리"라는 희소 자원과 잘 맞고, 작은 서버 하나로 구현할 수 있다.

### Cited Findings
- **The Button (Reddit, 2015.4.1~6.5)** — 60초 카운트다운, 누가 누르면 모두의 타이머가 초기화된다. 4월 1일 이전 계정만 **평생 1회** 가능. 누른 시점의 초에 따라 닉네임 옆 색(보라 60~52초 … 빨강 11~0초)이 영구 표시되고, 호버하면 정확한 초가 나온다. 안 누른 사람은 회색. 약 100만 8천 계정이 클릭. 타이머가 0이 되며 종료됐다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Button_(Reddit)) **[브라우저 ○]** 서버 필요.
- **NieR: Automata (Ending E)** — 크레딧의 이름을 쏘는 탄막에서 다른 플레이어의 도움을 받을 수 있고, 끝난 뒤 세이브 전체를 삭제해 모르는 사람을 도울지 묻는다. "all your save data will be deleted" 경고가 뜬다. 합창으로 음악이 변한다. 거절해도 벌칙이 없다. — [Kotaku](https://kotaku.com/nier-automata-dumped-me-and-i-m-okay-with-it-1846036247); 남긴 메시지와 유령 아이콘이 다른 플레이어에게 나타난다는 설명 — [Gamepur](https://gamepur.com/?p=129797) [요약경유] **[브라우저 △]** 로컬 기록 삭제는 쉽고, 익명 메시지 전달은 서버 필요.
- **Iron Sunset** — 내가 쓴 간청이 다른 사람의 게임에서 사형수의 말이 된다(2번 항목). — [Kill Screen](https://www.killscreen.com/beg-your-life-experimental-about-execution)
- **Absurd Trolley Problems (Neal Agarwal)** — 웹 트롤리 문제 연작. 선택 후 하단 막대가 "80% 동의, 20% 반대 (58만 3284표)"처럼 보여준다(2022년 스냅숏). — [Gigazine](https://gigazine.net/gsc_news/en/20220707-absurd-trolley-problems) [요약경유] **[브라우저 ○]**
- **Moral Machine (MIT)** — 자율주행 딜레마를 양자택일로 제시, 233개국 400만 명에게서 4천만 건 수집. 13문항 세션. — [Wikipedia](https://en.wikipedia.org/wiki/Moral_Machine) **[브라우저 ○]** 조사형 UI의 규모 선례.
- **Telltale's The Walking Dead** — 에피소드당 주요 선택 5개를 추적해 타인과 비교한다. — [Wikipedia](https://en.wikipedia.org/wiki/Telltale%27s_The_Walking_Dead). 시즌1에서 Doug를 구한 비율은 약 25%, Carley 약 75%. GDC 2013에서 Telltale은 외모보다 **유대를 쌓을 기회의 차이**가 원인이라 분석했다("Doug가 누구인지 알 기회를 주지 않았다"). — [Game Informer](https://www.gameinformer.com/b/news/archive/2013/03/28/telltale-why-fewer-people-saved-doug-in-the-walking-dead.aspx)
- **Life is Strange** — 되감기로 선택을 재시도할 수 있지만, 최종 선택은 Chloe 희생과 Arcadia Bay 희생의 양자택일이다. — [Wikipedia](https://en.wikipedia.org/wiki/Life_Is_Strange_(video_game)) **[브라우저 ○]**
- **Death Stranding** — 플레이어끼리 직접 만나지 않고 구조물·물자·메시지·"좋아요"로만 영향을 준다. 구조물은 시간비로 사라지며 타인이 잃은 화물을 대신 회수할 수 있다. — [Wikipedia](https://en.wikipedia.org/wiki/Death_Stranding) **[브라우저 △]** 서버 필요.
- **Journey** — 이름은 크레딧까지 비공개, 대화 없이 노래만, 방해 수단 없음. — [Wikipedia](https://en.wikipedia.org/wiki/Journey_(2012_video_game))
- **Golden Balls (Split or Steal)** — 둘 다 Split이면 반분, 한쪽만 Steal이면 독식, 둘 다 Steal이면 0. 결정 전에 대화 가능. — [Wikipedia](https://en.wikipedia.org/wiki/Golden_Balls) **[브라우저 △]** 실시간 매칭 없이 "앞선 플레이어의 선택"과 비동기 대결로 변형.
- **Among Us** — 시체 신고나 비상 버튼으로 회의를 열어 다수결로 방출. 방출자 정체 공개 여부는 설정. — [Wikipedia](https://en.wikipedia.org/wiki/Among_Us) **[브라우저 △]** 실시간 다인 필요.

### Inferences
- **The Button식 낙인:** 결과 화면에 "02:05:13에 앉음"처럼 **결심한 초**를 기록. 20초 타이머의 어느 지점에서 손을 뗐는지가 곧 그 사람의 색이 된다.
- **NieR식 이어주기:** "자리를 양보한다"를 고른 사람의 기록(짧은 문장)이 다음 플레이어의 구명정 좌석에 이름 없이 남는다. 다음 플레이어가 "자리가 있다"는 사실 자체가 앞사람의 양보 덕분이 된다.
- **비동기 Split or Steal:** "직전 플레이어는 당신에게 자리를 남겼다/남기지 않았다"를 **선택 후**에 공개.
- **통계 공개 시점:** Absurd Trolley처럼 선택 뒤에 공개하면 사후 비교가 되고, 선택 전에 "지금까지 73%가 탔습니다"를 보여주면 압력이 된다. 후자는 응답을 오염시키지만 연출로는 더 공격적이다.
- **Doug의 교훈:** 다섯 선택의 비율은 도덕성보다 앞선 장면에서 누구를 알게 했는지에 좌우될 수 있다. 아이/노인이 그 전에 한 번도 등장하지 않으면 "양보"는 추상적 선택이 된다.

### Gaps
- Telltale의 타이머 UI, Life is Strange의 에피소드 말 통계 및 최종 선택 비율은 접근 문서에 없었다. Game Informer는 시즌1 최종 선택에서 다수가 Lee를 쏘게 했다고 전한다는 검색 요약만 있다.
- The Evolution of Trust(Nicky Case)는 JS 렌더링으로 본문을 읽지 못해 제외했다.
- Golden Balls의 Nick/Ibrahim 회차, Among Us 회의 타이머와 건너뛰기 UI, 80 Days의 실시간 공유 지구본, "양심 리더보드"라 부를 만한 명시적 사례는 근거를 찾지 못했다.
