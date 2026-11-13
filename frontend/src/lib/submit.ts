import { API_BASE } from '@/lib/api';
import type { QuizResultResponse } from '@/types';

/**
 * 서버(/api/quiz/submit)에 보내는 값: 서버가 읽는 키만 보낸다.
 * 탑승 판정과 결과 화면이 같은 요청을 공유하므로, 새 장면(B1·W1·W2)의 선택이 섞여 값이 달라지거나
 * 같은 결과가 두 번 저장되는 일이 없다.
 */
const SERVER_KEYS = ['embarked', 'sex', 'ageGroup', 'companion', 'pclass', 'fareIntent', 'purpose', 'rumorAction', 'finalAction'] as const;

export function submitBody(answers: Record<string, unknown>, extras: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const k of SERVER_KEYS) if (answers[k] !== undefined) body[k] = answers[k];
  if (extras.lifebuoy) body.lifebuoy = true;
  if (typeof extras.age === 'number') body.age = extras.age;
  return body;
}

// 같은 답으로 이미 보낸 요청은 다시 보내지 않는다 (실패한 요청은 기억하지 않아 다시 시도할 수 있다)
const memo = new Map<string, Promise<QuizResultResponse>>();

export function submitAnswers(answers: Record<string, unknown>, extras: Record<string, unknown>): Promise<QuizResultResponse> {
  const body = submitBody(answers, extras);
  const key = JSON.stringify(body);
  let p = memo.get(key);
  if (!p) {
    p = fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: key,
    }).then(async (res) => {
      if (!res.ok) throw new Error('서버가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return (await res.json()) as QuizResultResponse;
    });
    p.catch(() => memo.delete(key));
    memo.set(key, p);
  }
  return p;
}
