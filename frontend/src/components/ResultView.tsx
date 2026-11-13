'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizStore } from '@/store/quizStore';
import { QuizResultResponse } from '@/types';
import { soundManager } from '@/lib/sound';
import html2canvas from 'html2canvas';
import TitanicPassengerCard from '@/components/ui/TitanicPassengerCard';
import { ProbabilityNumber } from '@/components/ui/ProbabilityNumber';
import ShareCard, { type CardRatio } from '@/components/ui/ShareCard';
import { traitsFromPicks, traitsFromAxes, encodeAxes } from '@/engine/traits';
import { characterDB } from '@/data/characterDB';
import { questionsData } from '@/data/questions';
import { preloadImages } from '@/lib/preloadImages';
import { resultImage } from '@/lib/assetPath';
import { API_BASE, KAKAO_JS_KEY, friendlyError } from '@/lib/api';
import { restartJourney } from '@/lib/session';
import PurserOutage from '@/components/result/PurserOutage';
import { submitAnswers } from '@/lib/submit';
import { storyAlive } from '@/engine/boarding';
import LedgerReveal from '@/components/result/LedgerReveal';
import { slotCenter, type KeyId } from '@/components/result/CardSlot';
import Typed from '@/components/result/Typed';

type RevealStage = 'BRIDGE' | 'LOADING' | 'STAGE_SUMMARY';

interface ResultViewProps {
  sharedResultId?: string;
}

export default function ResultView({ sharedResultId: sharedProp }: ResultViewProps) {
  // 결과가 만들어지면 주소에 결과 id 가 붙는다. 그 뒤 다시 그려져도 '공유 링크로 연 화면'으로 바뀌지 않게 처음 값을 고정한다.
  const [sharedResultId] = useState(sharedProp);
  const [attempt, setAttempt] = useState(0);
  const { answers, picks, extras } = useQuizStore();
  // 성향 육각형: 이 판에서 고른 선택으로 계산한다 (공유 링크로 열면 선택 기록이 없어 건너뛴다)
  const traits = useMemo(
    () =>
      traitsFromPicks(picks, typeof extras.knocked === 'number' ? extras.knocked : undefined) ??
      (sharedProp && typeof window !== 'undefined' ? traitsFromAxes(new URLSearchParams(window.location.search).get('t')) : null),
    [picks, extras.knocked, sharedProp],
  );
  const traitCode = traits ? encodeAxes(traits.axes) : null;
  // Q7 을 방금 끝낸 판은 로딩 화면 없이 사진·승선권·장부로 이어진다. 공유 링크와 새로고침은 건너뛴다
  const [stage, setStage] = useState<RevealStage>(!sharedProp && (answers.finalAction || picks.length > 0) ? 'BRIDGE' : 'LOADING');
  const [resultData, setResultData] = useState<QuizResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<'best' | 'worst' | 'opposite'>('best');
  const [matchOpen, setMatchOpen] = useState(false); // 닮은 승객 카드: 아날로그 기계의 사출구에서 나오는 팝업
  const [slotFrom, setSlotFrom] = useState({ x: 0, y: 400 }); // 사출구가 화면 가운데에서 얼마나 떨어져 있는가
  const openMatch = () => {
    const s = slotCenter();
    setSlotFrom({ x: s.x - window.innerWidth / 2, y: s.y - window.innerHeight / 2 });
    setMatchOpen(true);
    soundManager.playThud();
  };
  const cardRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null); // 공유 전용 카드(화면 밖에 숨겨 둠)
  const [ratio, setRatio] = useState<CardRatio>('4:5');

  const getOptionLabel = (questionId: string, value: any) => {
    if (value === undefined || value === null) return null;
    const q = questionsData[questionId];
    if (!q) return value;
    const opt = q.options.find(o => o.value === String(value) || o.id === String(value));
    return opt ? opt.label : value;
  };

  const summaryItems = [
    { label: '성별', value: getOptionLabel('Q0', answers.sex) },
    { label: '연령대', value: typeof extras.age === 'number' ? `${extras.age}세 (${getOptionLabel('Q1', answers.ageGroup)})` : getOptionLabel('Q1', answers.ageGroup) },
    { label: '동행', value: getOptionLabel('Q2', answers.companion) },
    { label: '객실', value: getOptionLabel('Q3', answers.pclass) },
    { label: '목적', value: getOptionLabel('Q5', answers.purpose) },
    { label: '소문', value: getOptionLabel('Q6', answers.rumorAction) },
    { label: '최후', value: getOptionLabel('Q7', answers.finalAction) },
  ].filter(item => item.value);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Kakao && !(window as any).Kakao.isInitialized()) {
      (window as any).Kakao.init(KAKAO_JS_KEY);
    }
  }, []);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        let data: QuizResultResponse;
        if (sharedResultId) {
          // Fetch existing result
          const res = await fetch(`${API_BASE}/api/quiz/result/${sharedResultId}`);
          if (!res.ok) {
            throw new Error(res.status === 404
              ? '이 결과를 찾을 수 없습니다. 링크가 잘못되었거나 만료되었을 수 있습니다.'
              : '서버가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.');
          }
          data = await res.json();
        } else {
          // Q7 직후의 탑승 판정이 이미 같은 답으로 서버를 불렀다면 그 결과를 다시 쓴다 (같은 결과가 두 번 저장되지 않는다)
          data = await submitAnswers(answers as Record<string, unknown>, extras);
        }
        setResultData(data);
        setError(null);

        // 새로고침해도 같은 결과를 다시 보도록 주소에 결과 id 를 남긴다 (새로 계산하지 않는다)
        if (data?.id && !sharedResultId) {
          try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}?result=${data.id}${traits ? `&t=${encodeAxes(traits.axes)}` : ''}`);
          } catch { /* 무시 */ }
        }

        if (data) {
          const assetsToPreload = [];
          if (data.historical_match) {
            assetsToPreload.push(`/bg/${data.historical_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.historical_match.name));
          }
          if (data.worst_match) {
            assetsToPreload.push(`/bg/${data.worst_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.worst_match.name));
          }
          if (data.opposite_match) {
            assetsToPreload.push(`/bg/${data.opposite_match.survived ? 'survived' : 'perished'}.webp`);
            assetsToPreload.push(resultImage(data.opposite_match.name));
          }
          preloadImages(assetsToPreload);
        }
        
        // 인쇄 연출(BRIDGE) 중이 아니면 바로 결과 화면
        setTimeout(() => {
          setStage((st) => (st === 'BRIDGE' ? st : 'STAGE_SUMMARY'));
          soundManager.playHeartbeat();
        }, 1500);

      } catch (err: any) {
        setError(friendlyError(err) || '결과를 불러오는 중 문제가 발생했습니다.');
      }
    };

    fetchResult();
  }, [answers, attempt]);

  // 같은 답으로 결과를 다시 요청한다 (새로고침하지 않으므로 고른 답이 사라지지 않는다)
  const retry = () => {
    setError(null);
    setResultData(null);
    setStage('LOADING');
    setAttempt((a) => a + 1);
  };

  // 승객 카드 팝업이 열리면 아래 기계도 같이 어두워지도록 표시한다
  useEffect(() => {
    if (!matchOpen) return;
    document.documentElement.setAttribute('data-modal', '1');
    return () => document.documentElement.removeAttribute('data-modal');
  }, [matchOpen]);

  // 닮은 승객 카드는 Esc 로도 닫는다
  useEffect(() => {
    if (!matchOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMatchOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matchOpen]);

  const finishBridge = useCallback(() => { setStage('STAGE_SUMMARY'); }, []);

  // 업적 버튼이 연출 중에는 숨고 정리 화면에서만 보이도록, 지금 단계를 바깥에 알린다
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('titanic:result-stage', { detail: stage }));
    return () => { window.dispatchEvent(new CustomEvent('titanic:result-stage', { detail: null })); };
  }, [stage]);

  // ── 공유 ──
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const shareUrl = () => (resultData?.id ? `${window.location.origin}/?result=${resultData.id}${traitCode ? `&t=${traitCode}` : ''}` : window.location.origin);
  const shareText = () => (traits && resultData
    ? `나는 '${traits.type.ko}' — 타이타닉에서 살아남을 확률 ${resultData.adjusted_probability}%. 너는 어떤 사람이었을까?`
    : '타이타닉에서 나는 어떤 사람이었을까?');
  const hashTags = () => (traits ? `#나는${traits.type.ko.replace(/\s/g, '')} #타이타닉성향` : '#타이타닉성향');
  /** X(트위터) 글쓰기 창: 문구와 링크만 실린다 (이미지는 붙일 수 없어, 링크의 미리보기 또는 저장한 카드를 올린다) */
  const handleShareX = () => {
    if (!resultData) return;
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText()}
${hashTags()}`)}&url=${encodeURIComponent(shareUrl())}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };
  /** 스레드 글쓰기 창: 문구 뒤에 링크를 붙여 보낸다 */
  const handleShareThreads = () => {
    if (!resultData) return;
    const u = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText()}
${hashTags()}
${shareUrl()}`)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };
  /** 인스타그램: 웹에서는 글쓰기 주소가 없다. 모바일은 공유 시트로 카드 이미지를 보내고, 그 밖에는 카드 이미지를 저장하고 문구를 복사해 둔다 */
  const handleShareInstagram = async () => {
    if (!resultData) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        const canvas = await renderCard();
        const blob: Blob | null = canvas ? await new Promise((res) => canvas.toBlob(res, 'image/png')) : null;
        if (blob) {
          const f = new File([blob], `titanic_${traits ? traits.type.en.replace(/\s+/g, '_') : 'result'}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    try { await navigator.clipboard.writeText(`${shareText()}
${hashTags()}
${shareUrl()}`); } catch { /* 복사하지 못해도 이미지는 저장한다 */ }
    await handleSaveImage();
    showToast('카드를 저장하고 문구를 복사했어요. 인스타그램 앱에서 올려 주세요!');
  };
  /** 모바일: 시스템 공유 시트(인스타그램 스토리, 카카오톡, 메시지)로 카드 이미지와 함께 보낸다. 안 되는 환경에서는 링크를 복사한다 */
  const handleShare = async () => {
    if (!resultData) return;
    const url = shareUrl();
    const text = shareText();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        let files: File[] | undefined;
        if (typeof navigator.canShare === 'function') {
          try {
            const canvas = await renderCard();
            if (!canvas) throw new Error('no card');
            const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
            if (blob) {
              const f = new File([blob], `titanic_${traits ? traits.type.en.replace(/\s+/g, '_') : 'result'}.png`, { type: 'image/png' });
              if (navigator.canShare({ files: [f] })) files = [f];
            }
          } catch { /* 이미지 없이 링크만 보낸다 */ }
        }
        await navigator.share({ title: '타이타닉 생존 시뮬레이터', text: `${text}\n${url}`, ...(files ? { files } : { url }) });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // 사용자가 닫았다
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast('문구와 링크를 복사했어요. 붙여넣어 보내 보세요!');
    } catch {
      showToast('링크를 복사하지 못했어요.');
    }
  };

  /** 공유 카드를 이미지로 뽑는다 (화면 크기와 상관없이 1080 폭 그대로) */
  const renderCard = async (): Promise<HTMLCanvasElement | null> => {
    const el = shareCardRef.current;
    if (!el) return null;
    await new Promise((r) => setTimeout(r, 120)); // 육각형이 다 그려질 때까지
    return html2canvas(el, { backgroundColor: '#020617', scale: 1, width: el.offsetWidth, height: el.offsetHeight, windowWidth: el.offsetWidth });
  };

  const handleCopyLink = () => {
    if (!resultData?.id) return;
    const url = `${window.location.origin}/?result=${resultData.id}${traitCode ? `&t=${traitCode}` : ''}`;
    navigator.clipboard.writeText(`${shareText()}\n${url}`).then(() => {
      showToast('문구와 링크를 복사했어요!');
    });
  };

  const handleSaveImage = async () => {
    try {
      const canvas = await renderCard();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `titanic_${traits ? traits.type.en.replace(/\s+/g, '_') : 'result'}_${ratio.replace(':', 'x')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      showToast('이미지 저장에 실패했어요.');
    }
  };

  const handleKakaoShare = () => {
    if (!resultData?.id || typeof window === 'undefined' || !(window as any).Kakao) {
      alert('카카오톡 공유를 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const url = `${window.location.origin}/?result=${resultData.id}${traitCode ? `&t=${traitCode}` : ''}`;
    
    (window as any).Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '타이타닉 생존 시뮬레이터',
        description: traits ? `1912년 그날 밤, 나는 '${traits.type.ko}' 유형이었습니다. 당신은 어떤 사람일까요?` : `나와 가장 비슷한 1912년의 승객은 ${resultData.historical_match.name}입니다!`,
        imageUrl: `${window.location.origin}${resultImage(resultData.historical_match.name)}`,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: '운명 확인하기',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  };

  // 단말기 아랫단의 키패드: 중요한 순서대로 카카오톡, 인스타그램, X, 스레드가 큰 키, 링크·저장·보내기가 작은 키
  const machine = {
    ratio,
    onToggleRatio: () => setRatio((r) => (r === '4:5' ? '9:16' : '4:5')),
    onKey: (id: KeyId) => {
      if (id === 'kakao') handleKakaoShare();
      else if (id === 'insta') handleShareInstagram();
      else if (id === 'x') handleShareX();
      else if (id === 'threads') handleShareThreads();
      else if (id === 'link') handleCopyLink();
      else if (id === 'save') handleSaveImage();
      else handleShare();
    },
  };

  const renderContent = () => {
    // 결과 화면: 결과지 인쇄(아날로그 전환)와 자세히 보기를 한 화면으로 합쳤다. 인쇄가 끝나면 STAGE_SUMMARY 로 바뀌어도 같은 화면이 이어진다
    if (stage === 'BRIDGE' || (stage === 'STAGE_SUMMARY' && traits && resultData)) {
      return (
        <LedgerReveal
          answers={answers as Record<string, unknown>}
          extras={extras}
          stat={resultData?.statistical_probability ?? null}
          adjusted={resultData?.adjusted_probability ?? null}
          typeKo={traits?.type.ko}
          typeEn={traits?.type.en}
          line={traits?.type.line}
          symbol={traits?.type.symbol}
          axes={traits?.axes}
          top={traits?.top}
          played={stage === 'STAGE_SUMMARY'}
          onSettled={() => setStage((st) => (st === 'BRIDGE' ? 'STAGE_SUMMARY' : st))}
          machine={machine}
          log={summaryItems.map((i) => ({ label: String(i.label), value: String(i.value) }))}
          onDone={finishBridge}
        >
          {/* 용지 아래, 아날로그 화면(단말기)에 찍히는 명령과 안내: 초록 글자, 줄 앞에 > */}
          <div className="mx-auto w-full max-w-[560px] px-2 text-left font-mono" style={{ color: '#8dffc4', textShadow: '0 0 9px rgba(120,255,190,.5)' }}>
            <TermLine delay={0}><span className="opacity-60"><Typed text="> 기록 인쇄 완료. 다음 명령을 선택하십시오." delay={0.3} /></span></TermLine>
            <TermLine delay={0.9}>
              <button type="button" onClick={() => openMatch()} className="group text-left text-[13px] tracking-wide md:text-[15px]">
                <span className="opacity-70">&gt; </span><span className="underline decoration-emerald-300/30 underline-offset-4 transition-colors group-hover:text-emerald-50"><Typed text="나와 닮은 궤적의 1912년 승객 카드 꺼내기" delay={1.2} /></span>
              </button>
            </TermLine>
            <TermLine delay={1.5}>
              <button type="button" onClick={restartJourney} className="group text-left text-[13px] tracking-wide md:text-[15px]">
                <span className="opacity-70">&gt; </span><span className="underline decoration-emerald-300/30 underline-offset-4 transition-colors group-hover:text-emerald-50"><Typed text="새로운 여정 시작하기" delay={2.3} /></span>
              </button>
            </TermLine>
            <div className="mt-8 space-y-1.5 border-t border-emerald-200/15 pt-4 text-[11px] leading-relaxed opacity-60 md:text-xs">
              <TermLine delay={0}><p><Typed text="> 재미로 보는 성향 테스트입니다. 점수는 그날 밤의 선택으로 계산한 것이며 실제 성격을 진단하지 않습니다." delay={2.8} speed={14} /></p></TermLine>
              <TermLine delay={0}><p><Typed text="> 이 웹사이트의 일부 콘텐츠는 AI 기술을 사용하여 생성되었으며, 이는 ChatGPT와 Gemini의 이용약관을 준수하여 사용되었습니다." delay={4.3} speed={14} /></p></TermLine>
              <TermLine delay={0}><p><Typed text="> 본 콘텐츠에는 역사적 사실을 바탕으로 한 각색 및 창작 내용이 포함되어 있습니다." delay={6.2} speed={14} /></p></TermLine>
            </div>
          </div>
        </LedgerReveal>
      );
    }

    // 다시 연결하는 동안에도 사무장이 화면에 남아 있다 (실패하면 그 자리에서 감전된다)
    if (!resultData || (stage === 'LOADING' && attempt > 0)) {
      if (stage !== 'LOADING' || attempt > 0) {
        return (
          <PurserOutage
            tries={attempt}
            busy={stage === 'LOADING' && !resultData}
            connected={!!resultData}
            message={error}
            onRetry={retry}
            onRestart={restartJourney}
          />
        );
      }
    }

    if (stage === 'LOADING') {
      return (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-lg tracking-widest animate-pulse">당신의 운명을 계산 중입니다...</p>
        </motion.div>
      );
    }

    if (!resultData) return null;

    // 성향 기록이 없는 오래된 공유 링크: 확률만 간단히 보여 주고 닮은 승객 카드를 열어 볼 수 있게 한다
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-sm tracking-[0.3em] text-slate-400">1912년 4월 14일</p>
        <div className="flex flex-col items-center">
          <span className="mb-1 text-xs uppercase tracking-widest text-slate-400/80">나의 최종 생존 확률</span>
          <ProbabilityNumber
            value={resultData.adjusted_probability}
            size="lg"
            tone={resultData.adjusted_probability > resultData.statistical_probability ? 'survive' : 'danger'}
          />
        </div>
        <button onClick={() => { setMatchOpen(true); soundManager.playThud(); }} className="text-sm font-medium text-amber-500/80 underline decoration-amber-500/30 underline-offset-4 transition-colors hover:text-amber-400">
          당신과 닮은 궤적을 그린 1912년의 승객 보기
        </button>
        <div>
          <button onClick={restartJourney} className="rounded border border-slate-600 px-8 py-3 text-sm tracking-widest text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">새로운 여정 시작하기</button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-[80vh] flex items-center justify-center px-6 ${resultData && traits && stage === 'STAGE_SUMMARY' ? 'pb-32 pt-24' : ''}`}>
      {renderContent()}

      {/* 공유 전용 카드: 화면 밖에 숨겨 두고 이미지로만 뽑는다 */}
      {resultData && traits && (
        <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }}>
          <ShareCard ref={shareCardRef} traits={traits} statistical={resultData.statistical_probability} adjusted={resultData.adjusted_probability} alive={storyAlive(extras, resultData.adjusted_probability)} ratio={ratio} />
        </div>
      )}

      {/* 닮은 승객 카드: 같은 화면 위에 통 하고 튀어나온다 */}
      <AnimatePresence>
        {matchOpen && resultData && (() => {
          const m =
            activeMatch === 'worst' && resultData.worst_match ? resultData.worst_match :
            activeMatch === 'opposite' && resultData.opposite_match ? resultData.opposite_match :
            resultData.historical_match;
          return (
            <motion.div
              key="matchPopup"
              className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto px-4 pt-6"
              style={{ paddingBottom: 'calc(var(--machine-h, 300px) + 24px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMatchOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="닮은 승객 카드"
            >
              {/* 생존·사망 배경 위에 어둡게 깔린다 */}
              {m && <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(/bg/${m.survived ? 'survived' : 'perished'}.webp)` }} />}
              <div aria-hidden className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.3, x: slotFrom.x, y: slotFrom.y, rotate: 0, opacity: 0 }}
                animate={{ scale: 1, x: 0, y: 0, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.3, x: slotFrom.x, y: slotFrom.y, opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } }}
                transition={{ type: 'spring', stiffness: 130, damping: 12, mass: 1, opacity: { duration: 0.12 } }}
                className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
              >
                <h2 className="mb-4 text-lg font-light text-slate-200">
                  {activeMatch === 'best' && '당신과 가장 비슷한 궤적을 그린 승객'}
                  {activeMatch === 'worst' && '당신과 가장 정반대의 궤적을 그린 승객'}
                  {activeMatch === 'opposite' && '만약 당신이 다른 성별이었다면'}
                </h2>
                <div ref={cardRef} className="flex w-full justify-center">
                  {m && m.name && characterDB[m.name] ? (
                    <TitanicPassengerCard
                      passengerData={{
                        ...characterDB[m.name],
                        imageUrl: m.sex === 'male' ? '/male.webp' : '/female.webp',
                        matchRate: m.match_percentage,
                        survived: m.survived,
                      }}
                    />
                  ) : (
                    <div className="text-slate-400">캐릭터 정보를 불러올 수 없습니다.</div>
                  )}
                </div>
                <div className="mt-5 flex flex-col items-center gap-2 text-sm font-medium">
                  {activeMatch !== 'worst' && resultData.worst_match && (
                    <button onClick={() => setActiveMatch('worst')} className="text-amber-400/90 underline decoration-amber-500/30 underline-offset-4 transition-colors hover:text-amber-300">나와 가장 유사도가 낮은 인물 확인하기</button>
                  )}
                  {activeMatch !== 'opposite' && resultData.opposite_match && (
                    <button onClick={() => setActiveMatch('opposite')} className="text-amber-400/90 underline decoration-amber-500/30 underline-offset-4 transition-colors hover:text-amber-300">만약 내가 다른 성별이었다면?</button>
                  )}
                  {activeMatch !== 'best' && (
                    <button onClick={() => setActiveMatch('best')} className="text-blue-300/90 underline decoration-blue-400/30 underline-offset-4 transition-colors hover:text-blue-200">나의 원래 매칭 결과로 돌아가기</button>
                  )}
                </div>
                <button onClick={() => setMatchOpen(false)} className="mt-5 rounded-full border border-slate-400/60 px-6 py-2 text-sm tracking-widest text-slate-200 transition-colors hover:bg-white/10">닫기</button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-[95] mx-auto w-fit max-w-[90vw] rounded-full bg-slate-100 px-5 py-2 text-sm font-medium text-slate-900 shadow-lg">{toast}</div>
      )}
    </div>
  );
}

/** 단말기에 한 줄씩 찍히듯 나타나는 줄 */
function TermLine({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div className="mt-3" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.25 }}>
      {children}
    </motion.div>
  );
}
