/**
 * WebAudio 합성음. 음 높이가 레지스터 값에 정비례해서, 왼쪽 시프트는 정확히 한 옥타브 위로 간다.
 * 첫 입력(사용자 제스처) 때 AudioContext를 만든다. 오디오를 못 쓰는 환경에서는 조용히 넘어간다.
 */
type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, ms: number, type: OscillatorType, delayMs = 0, volume = 0.05) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delayMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + ms / 1000);
}

const HZ_PER_VALUE = 8;
const clampHz = (hz: number) => Math.min(2400, Math.max(70, hz));

export function playShift(value: number) {
  blip(clampHz(value * HZ_PER_VALUE), 70, "square");
}

export function playPass(value: number) {
  const hz = clampHz(value * HZ_PER_VALUE);
  blip(hz, 70, "triangle", 0, 0.07);
  blip(clampHz(hz * 1.5), 90, "triangle", 60, 0.07);
}

export function playCrush() {
  blip(110, 140, "sawtooth", 0, 0.07);
  blip(73, 180, "sawtooth", 70, 0.07);
}

export function playEnd() {
  [440, 330, 220].forEach((hz, i) => blip(hz, 160, "square", i * 120));
}
