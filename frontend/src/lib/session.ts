/**
 * 진행 상태 보존 (탭을 닫기 전까지 새로고침해도 이어서 한다).
 * sessionStorage 에 저장하므로 새 탭이나 탭을 닫은 뒤에는 처음부터 시작한다.
 */
const KEY = 'titanic.session.v1';

export interface SavedSession {
  currentStep: string;
  answers: object;
  flags: object;
  picks: { scene: string; value: string }[];
  extras: Record<string, unknown>;
  history: unknown[];
}

export function loadSession(): SavedSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.currentStep !== 'string' || !Array.isArray(s.history) || !Array.isArray(s.picks)) return null;
    return s as SavedSession;
  } catch {
    return null;
  }
}

export function saveSession(s: SavedSession) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 공간이 막혀 있어도 게임은 계속된다 */
  }
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/** 처음부터 다시: 저장된 진행과 주소의 결과 id 를 지우고 깨끗하게 새로 연다. */
export function restartJourney() {
  clearSession();
  window.location.assign(window.location.pathname);
}
