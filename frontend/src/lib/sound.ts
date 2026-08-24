'use client';

// 향후 실제 음원 파일(.mp3, .wav)을 추가할 때 이곳의 경로만 수정하면 됩니다.
const SOUND_FILES = {
  click: '',         // 예: '/sounds/click.mp3' (짧은 클릭음)
  heartbeat: '',     // 예: '/sounds/heartbeat.mp3' (결과 도출 시 긴장감)
  shipHorn: '',      // 예: '/sounds/ship_horn.mp3' (프롤로그 뱃고동)
  ambientOcean: '',  // 예: '/sounds/ambient_ocean.mp3' (바다, 바람, 증기선 배경음)
  rumble: '',        // 예: '/sounds/ship_rumble.mp3' (Q6 위기 상황 저주파 진동)
  thud: '',          // 예: '/sounds/impact_thud.mp3' (빙산 충돌)
};

class SoundManager {
  private isMuted: boolean = true; // 기획서 가이드: 기본값은 음소거 상태

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  setMute(state: boolean) {
    this.isMuted = state;
  }

  getMuteState() {
    return this.isMuted;
  }

  private playSound(key: keyof typeof SOUND_FILES, loop: boolean = false) {
    if (this.isMuted) return null;
    
    const src = SOUND_FILES[key];
    if (!src) {
      console.log(`[SoundManager] 🔊 Play requested for '${key}', but no file mapped yet.`);
      return null;
    }

    try {
      const audio = new Audio(src);
      audio.loop = loop;
      audio.play().catch(e => console.warn('Audio play failed:', e));
      return audio;
    } catch (e) {
      console.warn('Audio initialization failed:', e);
      return null;
    }
  }

  playClick() { return this.playSound('click'); }
  playHeartbeat() { return this.playSound('heartbeat', true); }
  playShipHorn() { return this.playSound('shipHorn'); }
  playAmbientOcean() { return this.playSound('ambientOcean', true); }
  playRumble() { return this.playSound('rumble', true); }
  playThud() { return this.playSound('thud'); }
}

// 전역에서 싱글톤으로 사용
export const soundManager = new SoundManager();
