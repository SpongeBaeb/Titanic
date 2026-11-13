# 영상·인쇄 매체는 압박 속 강제 결정을 어떻게 연출하는가 (타이타닉 웹게임 02:05 최종 문항 재연출 참고)

표기 규칙: 표시 없는 항목은 해당 페이지를 직접 열어 확인한 내용이다. **[S]** 는 검색 결과 요약으로만 확인한 내용이다. **[S·귀속불명]** 은 요약에 문장은 있었으나 어느 링크에서 나온 말인지 특정하지 못한 경우로, 링크는 "후보 출처"다. 최종 인용 전에 원문 대조가 필요하다. 출처 문장은 직접 인용하지 않고 한국어로 풀어 썼다.

## 인터랙티브 영화·TV: 선택창, 제한 시간, 시간 초과, 되돌림은 어떻게 설계되었나

### Takeaway
선택 인터페이스의 핵심 변수는 네 가지다. 멈추지 않는 시계, 시간 초과의 처리, 분기가 진짜인지 여부, 실패 후 되돌림이다. 비평의 호평은 끊김 없는 전환에 모였고, 불만은 반복 구간과 임의적인 선택에 모였다. Kinoautomat 사례는 선택이 수렴한다는 사실이 드러날 때 관객이 배신감을 느낀다는 점을 보여 준다.

### Cited Findings

**Black Mirror: Bandersnatch (블랙 미러: 밴더스내치, Netflix, 2018-12-28)**
- 시간: 선택 지점마다 10초가 주어지고, 고르지 않으면 기본값이 선택된다. 기기별 튜토리얼이 먼저 조작법을 알려 준다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 화면: 초기 디자인이 시험 시청자를 혼란스럽게 해서, 텍스트 선택지와 일시적 레터박스 방식으로 정리했다. 선택 순간에는 조명, 사운드, 화면비도 바뀌어 압박을 키운다. 초기안이 정확히 어떤 형태였는지는 원문 재확인이 필요하다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 기술 구조: 선택 지점은 Initialization, Choice Selection, Timeout, UI Hide의 네 단계로 나뉜다. Choice Selection 단계에서 카운트다운이 보이고, 카운트다운이 끝나면 선택이 잠기며 UI가 사라진다. 단계별 시간은 선택 지점마다 코드로 정의되어 창작자가 호흡을 조절한다. — [Streaming Media](https://www.streamingmedia.com/Articles/Editorial/Featured-Articles/Netflix-Goes-to-the-Other-Side-of-the-Mirror-With-Bandersnatch-134349.aspx?pageNum=2)
- 끊김 방지: 기본 경로는 평소처럼 재생·다운로드되고, 이탈할 때만 타임라인의 다른 지점으로 건너뛴다. 비기본 분기가 있으면 두 세그먼트를 모두 캐시하므로 비트레이트와 메모리 사용이 사실상 두 배가 된다. — [Streaming Media](https://www.streamingmedia.com/Articles/Editorial/Featured-Articles/Netflix-Goes-to-the-Other-Side-of-the-Mirror-With-Bandersnatch-134349.aspx?pageNum=2)
- 되돌림: 대부분의 결말에서 마지막 결정적 선택을 다시 하도록 제안하고, 이미 본 앞부분은 건너뛰기도 한다. 일부 고리는 무엇을 골라도 같은 서사로 이어진다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 규모: 고유 영상 약 150분, 250개 세그먼트, 평균 시청 약 90분, 최단 약 40분이다. 결말 수는 Netflix 기준 5개(변형 포함)이나 프로듀서 Russell McLean은 10~12개라고 말해 진술이 엇갈린다. 대본은 Twine으로 쓴 170쪽이고, 전용 도구 Branch Manager를 Netflix가 만들었다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 시청 데이터(Netflix 발표): 시청자의 94%가 능동적으로 선택했고, 약 73%가 처음에 Tuckersoft 입사를 수락했다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 비평: 전환이 매끄럽다는 호평이 많았다(Alan Heritage, Linda Holmes, David Griffin). 불만은 짧은 결정 시간(Griffin), 끊기는 호흡(Austen Goslin), 선택의 피로(Roisin O'Connor), 반복 구간의 짜증(Holmes)에 있었다. — [Wikipedia](https://en.wikipedia.org/wiki/Black_Mirror:_Bandersnatch)
- 상태 추적: Netflix는 이야기 전체의 선택을 기억하는 state tracking 기술을 새로 만들었다. **[S]** — [The Hollywood Reporter](https://www.hollywoodreporter.com/live-feed/black-mirror-bandersnatch-netflixs-interactive-film-explained-1171486)

**Kinoautomat (키노오토마트, 체코슬로바키아, 1967, Radúz Činčera 외)**
- 관객 입력: 전용 극장 127석의 각 좌석에 녹색·적색 버튼이 있었고, 스크린 가장자리의 좌석 번호판이 투표색으로 켜져 집계가 공개되었다. — [Wikipedia](https://en.wikipedia.org/wiki/Kinoautomat)
- 시간과 무대: 9개 지점에서 영화가 멈추고 사회자(주연 Miroslav Horníček가 직접 무대에 등장)가 관객에게 두 장면 중 선택을 받았다. 동기화된 영사기 2대의 렌즈 뚜껑을 바꿔 끼워 승리한 장면을 상영했다. — [Wikipedia](https://en.wikipedia.org/wiki/Kinoautomat)
- 환상의 붕괴: 줄거리는 각 지점에서 다시 수렴했다. 체코 TV가 두 릴을 ČT1과 ČT2로 동시 방영하자 이 사실이 드러났고, Činčera는 시청자가 속았다고 느낀 그 반응을 완전한 실패로 회고했다. 1972년 공산당이 상영을 금지했다. — [Wikipedia](https://en.wikipedia.org/wiki/Kinoautomat)

**You vs. Wild (유 vs. 와일드, Netflix, 2019)**
- 정보 부족과 시간 압박 때문에 선택이 임의적으로 느껴진다는 비평이 있다. **[S]** — [TV Guide](https://www.tvguide.com/news/you-vs-wild-netflix-review-how-to-kill-bear-grylls)
- 어떤 경로든 임무의 끝은 같고, 실패하면 잘못 고른 지점으로 돌려보낸다. **[S]** — [VICE](https://www.vice.com/en/article/netflix-you-vs-wild-proves-interactive-tv-isnt-as-exciting-as-bandersnatch/)
- 2021년 특별편 Out Cold는 Bear Grylls가 판단에 충분한 정보를 준다는 호평을 받았다. **[S]** — [Ready Steady Cut](https://readysteadycut.com/2021/09/14/review-you-vs-wild-out-cold-netflix-interactive-special)

**Late Shift (레이트 시프트, 2016)**
- 일부 선택은 시간이 너무 짧아 놓칠 수 있다. **[S]** — [Silver Screening Review](https://silverscreeningreview.com/2017/05/03/late-shift-review-decisions-decisions)
- 상영 중 관객이 화면에 뜨는 지시에 맞춰 앱으로 전개를 바꾼다(UAE 개봉 리뷰). **[S]** — [Gulf News](https://gulfnews.com/entertainment/hollywood/late-shift-film-review-choose-your-own-ending-movie-is-a-thrilling-experience-1.81339445)
- 시간이 다 되면 대신 결정되고 이야기는 멈추지 않으며, 영화제에서는 스마트폰 다수결로 진행했다. **[S·귀속불명]** 후보 출처: [Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/late_shift), [FMV World](https://fmvworld.com/lateshift.html)

### Inferences
- 02:05 문항은 Bandersnatch식 잠금 구조(표시, 선택, 잠금, UI 소멸)가 그대로 맞는다. 시계를 멈추지 않는 것이 Late Shift와 같은 압박을 만든다.
- 시간 초과의 기본값을 "지켜본다"로 두면 무선택 자체가 선택지 중 하나로 기록된다. Bandersnatch의 기본값 처리를 주제적으로 바꾼 활용이다.
- Kinoautomat의 교훈은, 선택 뒤 결과가 같다면 그 사실을 플레이어가 나중에 발견하지 않게 해야 한다는 것이다. 다섯 선택지의 결말 문장은 실제로 달라야 한다.
- 마지막 문항은 Bandersnatch식 재선택을 허용하지 않는 편이 무게를 지킨다. 반복이 짜증과 무게 상실을 낳았다는 Holmes의 비판이 근거다.

### Gaps
- Bandersnatch 선택 막대의 형태(줄어드는 방향, 색, 위치)는 이번 자료에서 확인하지 못했다.
- 시리얼 Frosties 선택 비율(약 60%로 알려짐)은 확인되지 않았다.
- You vs. Wild의 시간 초과 처리, Late Shift의 정확한 선택 횟수와 개봉일(자료 간 3월/4월 불일치)은 미확인이다.
- Mosaic(Soderbergh, HBO)은 Wikipedia 문서 접근에 실패했다. Telltale식 TV 사례도 조사하지 못했다.
- Kinoautomat이 최초의 인터랙티브 영화라는 평가는 이번 자료로 직접 확인하지 못했다.

## 영화 연출: 결정의 순간을 이미지·소리·시간으로 어떻게 만드는가

### Takeaway
가장 강한 사례들은 결정 자체를 크게 보여 주기보다 정보를 제한한다. Force Majeure의 고정 롱테이크, Se7en의 상자, Son of Saul의 좁은 시야가 그렇다. 또 소리의 설계로 시간을 늘린다. 타이타닉 재현에는 1958년판의 절차적 건조함과 인물별 작은 결정의 나열이 특히 참고가 된다.

### Cited Findings

**A Night to Remember (타이타닉호의 비극, 1958, Roy Ward Baker)**
- 좌석과 결정의 나열: Lucas는 진실을 듣고 처자를 보트에 태운다. 불안해서 카드판을 떠난 Hoyle은 자기 생존을 우선한 사람들의 합성 인물이다. Straus 부부는 헤어지기를 거부하고, 그것이 Clarke 부인이 남편 곁에 남는 계기가 된다. Yates는 보트가 과밀해지지 않도록 헤엄쳐 떠난다. 제빵장 Joughin은 자리를 양보했다가 나중에 접이식 보트에 오른다. Ismay는 마지막 보트 중 하나에 탄다. — [Wikipedia](https://en.wikipedia.org/wiki/A_Night_to_Remember_(1958_film))
- 사실과의 차이: 영화는 거의 모든 보트를 Lightoller가 내린 것처럼 보여 준다. Yates의 메모는 그가 경찰을 속이려 꾸민 것으로, 실제로 승선하지 않았다. 접이식 B의 죽은 아이 장면은 신빙성이 의심되는 증언에 기댄다. — [Wikipedia](https://en.wikipedia.org/wiki/A_Night_to_Remember_(1958_film))
- 소리: 세트가 기울 때 삐걱거리는 소리가 마이크에 잡혔고 감독은 사실감을 위해 그대로 두었다. 생존자 Lawrence Beesley는 물속 사람들의 외침을 녹음기에 재연했다. 악단은 보트를 내릴 때 래그타임을, Clarke 부부가 몸을 낮출 때 찬송가 Nearer, My God, to Thee를 연주한다. — [Wikipedia](https://en.wikipedia.org/wiki/A_Night_to_Remember_(1958_film))
- 촬영: 설계도를 따른 세트 약 30개를 Pinewood에 지었고, 물 장면은 11월 새벽 2시 Ruislip Lido 야외 수영장에서 찍었다. — [Wikipedia](https://en.wikipedia.org/wiki/A_Night_to_Remember_(1958_film))

**Titanic (타이타닉, 1997, James Cameron)**
- 영화는 Murdoch이 뇌물에 혐오를 느끼고, 보트로 돌진하는 승객을 쏜 뒤 자살하는 것으로 그렸다. 고향 Dalbeattie가 반발했고, 제작 측 Scott Neeson이 찾아가 의도를 설명했으나 완전한 사과는 아니었다. **[S]** — [Sensibility: Titanic Makers Apologize](https://www.sensibility.com/blog/blog/resources/titanic-project/titanic-makers-apologize), [Titanic Officers](https://titanicofficers.com/titanic_03_murdoch_15.html)
- 역사적 근거는 엇갈린다. Eugene Daly, George Rheims 등이 장교의 발포와 자살을 증언했으나 Murdoch을 특정하지 않았고 반대 증언도 있다. Murdoch 옹호 사이트라는 편향이 있다. **[S]** — [williammurdoch.net](https://williammurdoch.net/mystery03_alternative_overview.html)

**Sophie's Choice (소피의 선택, 1982, Alan J. Pakula)**
- 테이크 수는 엇갈린다. 트리비아는 Streep이 한 번만 찍고 재촬영을 거부했다고 전한다. **[S]** — [MovieMistakes](https://moviemistakes.com/film1195/trivia)
- 반면 당시 네 살이던 아역 Jennifer Lawn은 제작진이 한 번을 예상했지만 13번 찍었다고 회고했다. 아이는 어머니 역의 품에서 끌려 나가 화면 밖으로 사라진다. — [Far Out](https://faroutmagazine.co.uk/story-behind-the-iconic-sophies-choice-scene/)
- 아역의 어머니는 촬영에 2시간이 걸렸고 Streep이 테이크마다 아이와 자신을 진정시켰다고 썼다. Entertainment Weekly 2014 기사의 미러로만 확인했다. **[S]** — [EW 기사 미러](https://fast-gamers.netlify.app/host-https-ew.com/article/2014/04/25/sophies-choice-bluray)

**Dunkirk (덩케르크, 2017, Christopher Nolan)**
- Nolan은 자신의 회중시계 소리 녹음을 대본과 함께 Hans Zimmer에게 보냈고, 그 째깍임이 신시사이저 펄스가 되었다. Shepard tone은 Nolan의 제안이며 The Prestige에서 이미 썼다. Nolan은 감정적 음악을 쓰지 말라고 요청했다. **[S·귀속불명]** 후보 출처: [SlashFilm](https://www.slashfilm.com/908307/christopher-nolan-brought-a-unique-sound-to-hans-zimmers-dunkirk-score), [Gulf News](https://gulfnews.com/entertainment/dunkirk-soundtrack-how-it-all-came-together-1.2066116), [SFCV](https://sfcv.t324.com/articles/feature/inside-making-dunkirks-landmark-soundtrack)
- 서로 다른 시간 척도의 세 Shepard 음계로 속도가 다른 세 서사의 긴장을 쌓았다는 해설이 있다. **[S·귀속불명]** 후보 출처: [Kottke](https://kottke.org/tag/Dunkirk)
- Zimmer가 이 음향 기법이 관객을 메스껍게 했다고 설명한 인터뷰가 있다(제목 기준, 본문 접근 실패). **[S]** — [CBC](https://www.cbc.ca/radio/q/blog/hans-zimmer-explains-the-audio-trickery-that-made-dunkirk-audiences-nauseous-1.4311684)

**Force Majeure (포스 마쥬어, 2014, Ruben Östlund)**
- 가족이 식당 테라스에서 점심을 먹고 Tomas는 폰으로 눈사태를 찍는다. 눈구름이 덮칠 듯하자 그는 공황 상태로 달아나고, 테라스가 비면서 Ebba와 아이들만 안개 속에 남는다. 아무도 다치지 않는다. 그날 저녁 그는 도망치지 않았다고 우기고, 뒤에 영상을 함께 보게 된다. — [Wikipedia](https://en.wikipedia.org/wiki/Force_Majeure_(film))
- 눈사태는 움직이지 않는 단일 테이크로 찍혔고 공기가 걷힌 뒤에도 프레임을 유지한다. 화면은 눈으로 완전히 하얗게 된다. — [Reverse Shot](https://reverseshot.org/archive/entry/1922/force_majeure)
- 눈사태 제작 방식은 통제 폭파 촬영이라는 설명과 실제 눈사태를 합성했다는 설명이 엇갈린다. **[S·귀속불명]** 후보 출처: [The Arts Desk](https://theartsdesk.com/film/force-majeure)

**Son of Saul (사울의 아들, 2015, László Nemes)**
- 40mm 렌즈 하나로 시야를 넓히지 않고 인물 눈높이에 카메라를 묶었다. **[S]** — [MUBI Notebook](https://mubi.com/notebook/posts/an-interview-with-laszlo-nemes)
- 얕은 초점과 화면 밖 요소의 지속적 존재가 핵심 전략이다. 화면비 표기는 1:1.33과 1.37:1로 자료가 갈린다. **[S]** — [BTL News](https://www.btlnews.com/awards/contender-cinematographer-matyas-erdely-son-of-saul/), [Irish Times](https://www.irishtimes.com/culture/film/laszlo-nemes-is-it-now-trendy-for-17-year-olds-to-be-neo-nazis-1.2628041)

**1917 (2019, Sam Mendes, 촬영 Roger Deakins)**
- 두 개의 연속 쇼트처럼 보이게 구성했으나 약 1시간 6분에 Schofield가 기절하며 암전이 있다. 대부분 40mm, 터널·벙커에서는 폐소감을 위해 35mm를 썼다. 시계 종소리를 듣고 시간이 없음을 깨닫는 구조가 있다. 약 300m 질주 장면에서 배우가 엑스트라와 부딪힌 테이크가 그대로 쓰였다. — [Wikipedia](https://en.wikipedia.org/wiki/1917_(2019_film))

**United 93 (유나이티드 93, 2006, Paul Greengrass)**
- 핸드헬드로 즉시성을 만들고, 실제 비행 경로처럼 움직이는 세트를 썼다. FAA의 Ben Sliney 등 실제 당사자가 본인을 연기했다. 승객과 납치범 역 배우를 숙소와 식사에서 분리해 적대감을 쌓았다. — [Wikipedia](https://en.wikipedia.org/wiki/United_93_(film))
- 승객의 결정은 꼬리 쪽 작전 회의, 무기 수집, 기도와 마지막 통화, 돌격의 순서로 전개된다. 실제 시간과 같은 범위를 다루지만 일부 시점은 극적으로 옮겼고 자막으로 상상이 들어갔음을 밝힌다. — [Wikipedia](https://en.wikipedia.org/wiki/United_93_(film))

**The Dark Knight (다크 나이트, 2008, 페리 장면)**
- 조커는 자정까지 상대 배를 폭파하면 살려 주겠다고 각 배에 기폭 장치를 준다. 시민 배가 실행에 더 가까이 가지만 누르지 못하고, 죄수 배에서는 험상궂은 죄수가 장치를 받아 내던진다. 창밖이냐 물속이냐는 자료마다 표현이 다르다. 대부분 학습 가이드 수준의 출처다. **[S·귀속불명]** 후보 출처: [GradeSaver](https://www.gradesaver.com/the-dark-knight/study-guide/summary-part-5), [Shmoop](https://www.shmoop.com/study-guides/the-dark-knight/scene-7-summary.html)

**Se7en (세븐, 1995, David Fincher)**
- 상자의 내용물은 끝내 보이지 않고 Somerset의 공포에 질린 반응과 대사로 추론된다. Fincher는 Paltrow의 복제 머리가 들어 있었다는 소문을 터무니없다고 일축했다. **[S]** — [The Ringer](https://www.theringer.com/2020/09/22/movies/seven-whats-in-the-box), [SlashFilm](https://slashfilm.com/1752197/david-fincher-se7en-what-was-in-the-box)

**The Mist (미스트, 2007, Frank Darabont)**
- 남은 탄환 4발을 아들과 동행 셋에게 쓰고 자신을 쏠 탄이 없다. 차에서 내려 괴물을 부르자 탱크가 나타나고 안개가 걷혀, 5분만 더 기다렸다면 살았음을 깨닫는다. — [SlashFilm](https://www.slashfilm.com/663591/the-mist-ending-explained-14-years-later-the-ending-still-hits-like-a-gunshot)
- 음악은 Dead Can Dance의 The Host of Seraphim이며, 결말은 원작과 다른 Darabont의 창작이다. **[S·귀속불명]** 후보 출처: [Wikipedia](https://en.wikipedia.org/wiki/The_Mist_(film))

**Hitchcock의 탁자 밑 폭탄 (Hitchcock/Truffaut, 1962 대담)**
- 예고 없는 폭발은 약 15초의 놀람을, 관객이 폭탄을 아는 경우는 약 15분의 서스펜스를 준다는 대조다. **[S]** — [Futility Closet](https://www.futilitycloset.com/2023/12/20/hitchcocks-bomb-theory/)
- 1972년 AFI 세미나에서는 수치가 약 10초와 5분으로 다르다. **[S]** — [SlashFilm](https://slashfilm.com/851604/strangers-on-a-train-features-the-most-dangerous-scene-alfred-hitchcock-ever-filmed)
- David Bordwell은 이 구분의 독창성에 의문을 제기한다. **[S]** — [David Bordwell's website](https://www.davidbordwell.net/blog/2013/11/29/hitchcock-lessing-and-the-bomb-under-the-table/trackback/)

### Inferences
- 플레이어는 02:05의 시각과 남은 시간을 이미 알고 있으므로 게임 전체가 Hitchcock의 탁자 밑 폭탄이다. 마지막 문항에서 새로운 깜짝 정보를 넣기보다, 아는 사실을 천천히 다가오게 하는 쪽이 맞다.
- A Night to Remember의 방식을 쓰면 선택 직전에 주변 인물의 작은 결정들(양보, 동승 거부, 슬쩍 올라타기)을 짧게 나열할 수 있다. 다섯 선택지 각각에 역사적 선례가 있는 셈이다. 다만 Yates처럼 영화가 꾸며 낸 일화를 사실로 쓰면 안 된다.
- Force Majeure는 "지켜본다"와 "물러선다" 결말에 가장 유용하다. 카메라를 고정하고, 선택 뒤에 자기 행동을 부정하는 시간을 짧게 두는 구성이다.
- Se7en의 방식은 결과 묘사를 생략하는 근거가 된다. 실제 재난을 다루는 게임이라 죽음을 직접 그리지 않는 윤리적 이점도 있다.
- 웹에서 Shepard tone을 쓸 경우 Zimmer의 메스꺼움 언급을 감안해 짧게 쓰고 끌 수 있게 해야 한다.
- Son of Saul과 1917이 모두 40mm 중심인 점은, 시야를 사람 눈높이에 묶는 원리를 화면 구도에 옮길 근거가 된다. 마지막 화면은 넓은 전경 대신 좁은 프레임이 적합해 보인다.

### Gaps
- 1997년 Titanic의 Cal 탑승, Jack 거부, 보트 하강 장면의 구체적 연출은 신뢰할 출처를 얻지 못했다. Encyclopedia Titanica는 접근이 차단되었다.
- 1958년판에서 남성 승객이 거부당하는 쇼트 구성은 확인하지 못했다.
- Sophie's Choice의 카메라·조명 구성(Almendros)과 Pakula의 리허설 방식은 신뢰할 수준으로 확인되지 않았다.
- Force Majeure에서 Tomas가 장갑을 챙긴다는 세부는 Wikipedia 줄거리와 리뷰에서 확인되지 않았다(폰 촬영은 확인).
- Saw, Gravity, Das Boot, The Hunt는 이번 조사에서 다루지 못했다.
- 돌리 줌, 프리즈 프레임, 휩 팬에 대한 결정 장면 전용 근거 자료를 찾지 못했다. 교차 편집은 Dunkirk와 The Dark Knight 사례에서 추론만 가능하다.

## TV 드라마와 게임쇼: 투표, 집계, 잠금은 어떻게 보이는가

### Takeaway
게임쇼는 시간 제한 없이도 압박을 만든다. Millionaire는 조명 축소, 끊기지 않는 음악, 단계별 반음 상승, 명시적 잠금 발화로 이를 해낸다. Squid Game은 부조리한 대비와 초박빙 표결로 만든다.

### Cited Findings

**Squid Game (오징어 게임, Netflix, 2021, 황동혁)**
- 2화 표결: 생존자들이 3조 조항으로 게임 중단을 근소한 차로 가결한다. — [Wikipedia](https://en.wikipedia.org/wiki/Squid_Game_season_1)
- 표수는 100대 100 동률에서 오일남이 결정표를 던졌다는 설명과 101대 100이라는 설명이 있다. 팬 위키급 출처라 영상 확인이 필요하다. **[S·귀속불명]** 후보 출처: [Inverse](https://www.inverse.com/entertainment/who-is-player-001-squid-game-season-2-twist-explained), [Everybodywiki](https://en.everybodywiki.com/Oh_Il-nam)
- 무궁화꽃이 피었습니다: 움직이면 사살되고 참가자 절반이 공황 속에 죽는다. Fly Me to the Moon이 폭력과 대비를 이룬다. 황동혁은 군중이 움직이고 멈추는 모습이 우스우면서 슬픈 군무처럼 보이리라 여겨 이 게임을 택했다. — [Wikipedia](https://en.wikipedia.org/wiki/Squid_Game_season_1)
- 징검다리: 다리는 두 칸 폭이고, 한쪽은 강화유리, 한쪽은 일반유리다. 세트는 지면에서 1.5m에 불과한 서커스 무대 형태로 지어 크로마키로 높이를 만들었는데, 그 높이만으로도 배우들이 긴장했다. — [Wikipedia](https://en.wikipedia.org/wiki/Squid_Game_season_1)
- 수학적 분석은 참가자 16명, 다리 18칸으로 모델링한다. **[S]** — [Chalkdust](https://chalkdustmagazine.com/features/surviving-the-bridge-in-squid-game/)

**The Good Place (굿 플레이스, 시즌2 6화 "The Trolley Problem", NBC, 2017-10-19, 연출 Dean Holland)**
- Chidi가 사고 실험으로 가르치자 Michael은 학습을 명분으로 Chidi를 현실 같은 트롤리 시뮬레이션에 집어넣는다. 뒤에 그것이 고의적 고문이었음을 인정한다. 추상적 문제를 몸으로 겪게 하는 코미디 구조다. — [Wikipedia](https://en.wikipedia.org/wiki/The_Trolley_Problem_(The_Good_Place))

**Who Wants to Be a Millionaire? (영국판, 1998~)**
- 세트: Andy Walmsley의 무대는 참가자를 불편하게 하는 스릴러 분위기를 목표로 했다. 거울 접시 위 플렉시글라스 바닥과 마주 앉는 의자 두 개가 있고, 조명은 세트 전체에서 두 사람만으로 좁혀진다. — [Wikipedia](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire%3F_(British_game_show))
- 음악: Keith·Matthew Strachan의 음악은 에피소드 내내 흐르며, 문제가 올라갈 때마다 반음씩 높아진다. — [Wikipedia](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire%3F_(British_game_show))
- 잠금: 참가자는 문제를 본 뒤에도 그만둘 수 있고, 어려운 문제에서는 최종 답이라고 확정해야 잠긴다. 진행자도 그 전에는 정답을 보지 못한다. 대체로 문제별 제한 시간은 없다(2010~2014 clock format은 예외). — [Wikipedia](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire%3F_(British_game_show))
- 높은 의자, 극적 음악, 취조실 같은 조명이 참가자를 곤란하게 만드는 장치였다는 회고가 있다. **[S]** — [The Daily Telegraph (PressReader)](https://www.pressreader.com/uk/the-daily-telegraph/20180504/282364040302524)

**Golden Balls (골든 볼스, 영국, Split or Steal)**
- van den Assem, van Dolder, Thaler의 2012년 Management Science 논문은 큰 금액에서도 맥락상 작아 보이면 협력이 놀랄 만큼 높다는 "big peanuts" 현상을 보고했다. **[S]** — [Erasmus University](https://pure.eur.nl/en/publications/split-or-steal-cooperative-behavior-when-the-stakes-are-large/)
- Nick이 상대 Ibrahim에게 무조건 Steal하겠다고 말한 뒤 실제로는 Split을 고른 회차가 있다. 블로그 수준의 출처다. **[S·귀속불명]** 후보 출처: [Cornell Info2040](https://blogs.cornell.edu/info2040/2012/09/21/split-or-steal-an-analysis-using-game-theory)

**The Genius / The Devil's Plan (더 지니어스, 데블스 플랜, 정종연 PD)**
- 시즌2에서 PD는 히든 룰에 따른 이세돌 탈락의 아쉬움, 딜러 개입 논란, 출연자 비판에 대한 책임을 언급했다. 장면 연출 자체의 자료는 아니다. **[S]** — [OSEN](https://www.osen.co.kr/article/G1112578387), [ST이슈(다음)](https://v.daum.net/v/20250527174304490)

### Inferences
- Millionaire의 잠금 발화는 웹게임에 바로 옮길 수 있다. 선택지를 누른 뒤 "정말 이 자리를 ...합니까" 한 단계를 두되 그 단계에서는 시계를 멈추지 않는다.
- 문항이 진행될수록 배경음을 조금씩 높이는 반음 상승 원리는 게임 시계가 02:05로 다가오는 구간에 적용 가능하다.
- Squid Game의 1.5m 세트는 실제 위험이 낮아도 긴장이 작동함을 보여 준다. 저렴한 화면 효과로도 충분히 압박을 줄 수 있다는 근거다.

### Gaps
- 오징어 게임 표결의 정확한 표수와 화면상 집계 표시, 징검다리 조끼 번호 선택의 연출은 일차 자료로 확인하지 못했다.
- Alice in Borderland, Deal or No Deal, The Weakest Link, Physical: 100은 이번 조사에서 다루지 못했다.
- 더 지니어스와 데블스 플랜의 투표·탈락 장면 연출을 다룬 자료는 찾지 못했다.

## 생중계 관객 투표: 군중의 결정은 어떻게 집계되고 공개되는가

### Takeaway
Terror는 관객 투표를 도덕적 사건으로 만든 가장 분명한 사례다. 투표 뒤 수치 공개, 그다음 판결 이유 순으로 진행된다. 동시에 대규모 동시 투표의 기술 실패도 보여 준다. 매체별로 무죄 비율이 크게 달랐다.

### Cited Findings

**Terror (테러, Ferdinand von Schirach 희곡) / Terror – Ihr Urteil (ARD, 2016-10-17, 연출 Lars Kraume)**
- 전제: 납치된 Lufthansa기(탑승 164명)가 만석의 뮌헨 축구장으로 향하고, 공군 조종사 Lars Koch 소령이 명령 없이 격추해 살인죄로 재판을 받는다. 2006년 연방헌법재판소는 생명을 생명과 상계할 수 없다며 격추 허용 조항을 무효화했다. — [evangelisch.de](https://www.evangelisch.de/inhalte/139154/14-10-2016/die-ard-zeigt-den-film-nach-dem-erfolgstheaterstueck-terror-von-ferdinand-von-schirach)
- 순서: 약 90분 영화 뒤 시청자가 투표하는 동안 Frank Plasberg의 Hart aber fair가 토론을 진행한다. 결과를 발표한 뒤 판사의 판결 이유를 보여 준다. 사전에 14일 150여 도시 극장에서도 투표가 있었다. — [evangelisch.de](https://www.evangelisch.de/inhalte/139154/14-10-2016/die-ard-zeigt-den-film-nach-dem-erfolgstheaterstueck-terror-von-ferdinand-von-schirach)
- 입력과 결과: 전화·온라인 투표로 독일 86.9%, 오스트리아 86.9%, 스위스 84%가 무죄를 택했다. 극장 공연 평균은 약 60%, 영화관은 약 70%(만하임은 약 55:45)였다. 집계된 표는 60만이다. — [Filmstarts](https://www.filmstarts.de/nachrichten/18507942.html)
- 25개 극장 기준 무죄 59.5%라는 출판사 수치가 있다. — [evangelisch.de](https://www.evangelisch.de/inhalte/139154/14-10-2016/die-ard-zeigt-den-film-nach-dem-erfolgstheaterstueck-terror-von-ferdinand-von-schirach)
- 기술 실패: 투표 사이트가 다운되고 전화선도 과부하되어 많은 시청자가 투표하지 못했다. — [Filmstarts](https://www.filmstarts.de/nachrichten/18507942.html)
- 시청자 약 690만, 후속 토론 630만이다. **[S]** — [evangelisch.de](https://www.evangelisch.de/inhalte/139395/18-10-2016/69-millionen-sehen-terror-film-im-ersten)
- ARD는 절대 투표수 공개를 거부했다는 지적이 있으며, YouGov 조사는 무죄 다수가 그만큼 크지 않았다고 전한다. **[S]** — [YouGov](https://yougov.com/de-de/artikel/16786-weniger-grosse-mehrheit-fur-freispruch-im-terror-s)

**Twitch Plays Pokémon (2014)**
- 기본은 Anarchy 모드로 모든 입력이 반영되고, 채팅 투표로 Democracy 모드로 바꾸면 입력별 다수결이 된다. Democracy 전환에는 초과 다수, 복귀에는 과반이 필요했다. 수치는 75%와 80%로 자료가 갈린다. **[S·귀속불명]** 후보 출처: [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Twitch_Plays_Pok%C3%A9mon/Season_1), [The Mary Sue](https://themarysue.com/?p=194426)

### Inferences
- Terror의 공개 순서(개인 투표, 전체 수치, 이유 제시)는 게임 결말의 정보 순서로 그대로 쓸 수 있다.
- 집단별 비율 차이(TV 87%, 극장 60%)는 맥락이 응답을 바꿈을 시사한다. 다른 플레이어의 통계를 선택 전에 보여 주면 응답을 오염시키므로 선택 뒤에만 보여 주는 것이 맞다. 표본 구성 등 다른 요인도 있어 인과로 단정할 수는 없다.
- 웹게임의 결과 수치는 동시 접속 집계에 의존하지 않도록, 집계 실패 시에도 결말이 표시되어야 한다.

### Gaps
- 공연 실황 중계의 실시간 투표(National Theatre Live 등)와 Twitch 확장 기능, Choice Chamber류 게임은 자료를 얻지 못했다.
- Terror 희곡의 초연 일자와 장소, 영화의 두 결말 촬영 방식은 해당 문서 접근 실패로 확인하지 못했다.

## 만화·웹툰: 칸, 여백, 스크롤은 어떻게 망설임을 만드는가

### Takeaway
한국 웹툰의 대표 선례는 호랑의 스크롤 연동 효과이며, 스크롤 강제 고정을 포함한다. 다만 원래의 플래시 방식은 모바일에서 작동하지 않아 현재 기술로 재구현해야 한다. 세로 스크롤의 여백 수치는 실무 경험칙뿐이고 실증 연구는 찾지 못했다.

### Cited Findings

**옥수역 귀신 / 봉천동 귀신 (호랑, 네이버웹툰 '2011 미스테리 단편' 5화·20화, 2011)**
- 스크롤을 내리면 귀신의 머리가 돌아가거나 화면을 향해 달려드는 3D 플래시가 실행된다. 칼럼은 이를 한국 웹툰에서 전례 없는 시도로 평가한다. — [웹툰가이드, 잠뿌리 칼럼(2016-12-22)](https://www.webtoonguide.com/ko/board/news-column/2261)
- 스크롤 도중 BGM이 흐르게 해 읽는 호흡을 설계했고, 스크롤 시점에 맞춰 결정적 효과를 터뜨렸다. 스크롤을 강제로 고정한 것도 효과를 키웠다. 같은 칼럼은 이후의 모방작이 반복적이라고 아쉬워한다. — [웹툰가이드, 잠뿌리 칼럼](https://www.webtoonguide.com/ko/board/news-column/2261)
- 호랑은 2018년 토크콘서트에서 기존 플래시 파일 방식이 모바일 웹에서 작동하지 않아 새 대응이 필요하다고 말했다. — [웹툰가이드(2018-10-22)](https://www.webtoonguide.com/ko/board/news04_generalnews/7036)

**2022 스크롤금지 (네이버웹툰 공포 단편선, 2022)**
- 스크롤을 내리기 무서운 웹툰이라는 콘셉트로, 일부 회차에 애니메이션·효과음·BGM을 더한 효과툰을 공개했고 호랑이 참여했다. — [웹툰가이드(2022-06-14)](https://www.webtoonguide.com/ko/board/news-column/16846)

**Scott McCloud, Understanding Comics (만화의 이해, 1993)** (2차 해설만 확인)
- 칸 수를 늘리거나 칸 사이 공간을 넓히거나 한 칸을 길게 하면 시간이 늘어난다는 요약이 있다. 대사 없는 칸은 한순간을 암시하고 말소리가 들어오면 시간이 생긴다. 큰 칸일수록 읽는 데 시간이 든다. **[S·귀속불명]** 후보 출처: [SuperSummary](https://www.supersummary.com/understanding-comics/chapters-3-6-summary), [C. Merritt Houghton](https://cmerritthoughton.substack.com/p/gutters-the-invisible-heartbeat-of)
- 넓은 칸 사이는 긴 시간을, 좁은 칸 사이는 긴박함을 나타낸다는 실무 해설이 있다. **[S]** — [C. Merritt Houghton](https://cmerritthoughton.substack.com/p/gutters-the-invisible-heartbeat-of)
- 닫힘(closure)이 칸 사이에 한정되지 않는 연속적 비자발적 행위라는 반론이 있다. **[S]** — [The Hooded Utilitarian](https://www.hoodedutilitarian.com/tag/closure/)

**세로 스크롤의 여백 경험칙**
- 한 튜토리얼은 표준 간격을 약 800px, 이어지는 대사의 작은 간격을 약 400px로 제시한다. 실무 경험칙이지 실증 수치가 아니다. **[S]** — [Content Curve](https://contentcurve.substack.com/p/introduction-to-webtoon-paneling)

**Barefoot Gen (맨발의 겐, 나카자와 케이지)**
- 1983년 애니메이션판(감독 Mori Masaki): 불안한 음악이 커지다가 폭발 순간 완전한 무음이 된다. 색이 사라지고 부감의 붉은 버섯구름만 남는다. 붉은 풍선을 든 소녀에서 시작해 우체부, 노인, 어머니와 갓난아기, 개로 같은 파괴가 반복된다. 이는 만화가 아닌 영화의 연출이다. — [The Daily Beast](https://www.thedailybeast.com/obsessed/after-oppenheimer-watch-barefoot-gen-an-unforgettable-atomic-bomb-anime)
- 만화판은 Maus보다 약 10년 앞서며, Art Spiegelman이 Maus 작업에 영향을 받았다고 영문판 서문에서 밝혔다. **[S]** — [Comics Beat](https://www.comicsbeat.com/barefoot-gen-examined/), [Spiegelman 서문](https://medium.com/@lastgaspbooks/comics-after-the-bomb-an-introduction-by-art-spiegelman-6ca34bdf836c)

### Inferences
- 02:05 화면을 세로 스크롤로 구성한다면 긴 빈 여백 뒤에 선택지를 놓고, 호랑식 스크롤 고정으로 잠시 진행을 막는 방식이 가능하다. 구현은 모바일에서 작동하는 sticky 위치 지정과 스크롤 이벤트로 해야 한다.
- 스크롤 고정은 조작을 빼앗는 만큼 짧아야 하고, 모션 감소 설정과 키보드 접근을 고려해야 한다.
- 무음은 Barefoot Gen 애니메이션처럼 소리가 커진 직후에 와야 효과가 산다. 선택을 잠그는 순간에 음악을 끊는 데 쓸 수 있다.
- 대사 없는 칸은 한순간으로 읽힌다는 요약에 따르면, 선택 직전 화면에서는 텍스트를 최소화하는 편이 시간을 늘리는 데 맞다.

### Gaps
- Understanding Comics 원문과 infinite canvas 논의는 직접 확인하지 못했다.
- 세로 스크롤의 호흡이나 여백 타이밍에 관한 실증 연구는 찾지 못했다.
- Maus의 칸 구성, Barefoot Gen 만화판의 원폭 페이지에 대한 칸 단위 분석은 찾지 못했다.
- 호랑 외 인터랙티브 웹툰의 구체 사례, 한국 전쟁·재난 만화의 연출 사례는 찾지 못했다.
