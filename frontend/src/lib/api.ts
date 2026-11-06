/**
 * 서버 주소와 외부 서비스 설정.
 * - 운영 빌드에서 NEXT_PUBLIC_API_URL 이 없으면 같은 주소(상대 경로)로 요청한다.
 * - 개발 서버에서는 기존처럼 로컬 Flask(5000번)를 기본값으로 쓴다.
 */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5000');

/** 카카오 JavaScript 키 (공개용 키: 도메인 제한으로 보호). 환경 변수로 바꿀 수 있다. */
export const KAKAO_JS_KEY: string = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '0775b15ad473e250a057e5340c038cf6';

/** 사용자에게 보여 줄 오류 문구로 바꾼다 (브라우저 영문 원문을 그대로 노출하지 않는다). */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (!msg || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.';
  }
  return msg;
}
