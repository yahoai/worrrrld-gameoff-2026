/**
 * Bit Shift 순수 상태기계. React·브라우저 의존 없음.
 *
 * 레지스터는 8비트 정수다. 비트 7이 화면 왼쪽 끝. 왼쪽 시프트는 값 ×2, 오른쪽은 ÷2이고
 * 끝으로 밀려난 비트는 사라진다. 벽이 내려오면 벽의 구멍 밖에 있는 비트가 부서지고,
 * 살아남은 레지스터의 10진 값이 그대로 점수가 된다.
 */

export type Rng = () => number;
export type ShiftDir = "left" | "right";

export const REGISTER_BITS = 8;
const BYTE = 0xff;
/** 3비트로 시작해 초반 실수 한두 번으로 판이 끝나지 않게 한다. */
export const START_REGISTER = 0b00011100;
export const MAX_ACTIVE_BITS = 5;
/** 비트가 늘어나도 맞는 자리가 2곳 이상 남도록 모양 폭을 제한한다. */
export const MAX_SHAPE_WIDTH = 6;
export const CLEAN_WALLS_FOR_NEW_BIT = 3;

export const GAME_DURATION_MS = 30_000;
/** 시프트 1회에 사람에게 주는 시간. */
export const TAP_BUDGET_MS = 240;
/** 벽 사이 숨 고르는 시간. 이때 미리 움직일 수 있다. */
export const WALL_GAP_MS = 180;
/** 첫 벽은 조작을 익히도록 더 천천히 내려온다. */
export const FIRST_WALL_BONUS_MS = 1_100;

export interface Tier {
  firstWall: number;
  /** 벽을 읽고 판단하는 데 주는 시간. */
  readMs: number;
  /** 가까운 자리가 현재 위치에서 몇 칸 떨어지는가. */
  minShifts: number;
  maxShifts: number;
}

export const TIERS: readonly Tier[] = [
  { firstWall: 0, readMs: 1500, minShifts: 1, maxShifts: 2 },
  { firstWall: 3, readMs: 1300, minShifts: 1, maxShifts: 2 },
  { firstWall: 7, readMs: 1100, minShifts: 1, maxShifts: 3 },
  { firstWall: 12, readMs: 950, minShifts: 2, maxShifts: 3 },
];

export interface Wall {
  /** 1 = 구멍. */
  gaps: number;
  fallMs: number;
  /** 벽이 나올 때 가장 가까운 맞는 자리까지의 시프트 수. */
  nearestShifts: number;
}

export type EventKind = "pass" | "crush" | "edge";

export interface GameEvent {
  key: number;
  kind: EventKind;
  /** 부서지거나 밀려난 칸. */
  lostMask: number;
  /** 새로 생긴 칸. */
  grownMask: number;
  gain: number;
  atMs: number;
}

export type EndReason = "time" | "out-of-bits";

export interface GameState {
  register: number;
  score: number;
  elapsedMs: number;
  wall: Wall | null;
  wallAgeMs: number;
  gapLeftMs: number;
  wallsDone: number;
  cleanStreak: number;
  bestValue: number;
  bitsLost: number;
  over: EndReason | null;
  event: GameEvent | null;
  eventKey: number;
}

export function createGame(): GameState {
  return {
    register: START_REGISTER,
    score: 0,
    elapsedMs: 0,
    wall: null,
    wallAgeMs: 0,
    gapLeftMs: 0,
    wallsDone: 0,
    cleanStreak: 0,
    bestValue: START_REGISTER,
    bitsLost: 0,
    over: null,
    event: null,
    eventKey: 0,
  };
}

export function popcount(value: number): number {
  let n = 0;
  for (let v = value & BYTE; v; v &= v - 1) n++;
  return n;
}

/** 켜진 비트 중 가장 낮은 위치. 빈 레지스터는 0. */
export function offsetOf(register: number): number {
  if (!register) return 0;
  let i = 0;
  while (!((register >> i) & 1)) i++;
  return i;
}

export function shapeWidth(register: number): number {
  if (!register) return 0;
  return 32 - Math.clz32(register) - offsetOf(register);
}

export function fits(register: number, gaps: number): boolean {
  return (register & ~gaps & BYTE) === 0;
}

/** 현재 모양이 이 벽을 통과할 수 있는 오프셋 전부(오름차순). */
export function fitOffsets(register: number, gaps: number): number[] {
  const shape = register >> offsetOf(register);
  const out: number[] = [];
  for (let p = 0; p <= REGISTER_BITS - shapeWidth(register); p++) {
    if (fits(shape << p, gaps)) out.push(p);
  }
  return out;
}

export function shiftsToNearestFit(register: number, gaps: number): number {
  const here = offsetOf(register);
  return Math.min(...fitOffsets(register, gaps).map((p) => Math.abs(p - here)));
}

export function tierFor(wallIndex: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) if (wallIndex >= t.firstWall) tier = t;
  return tier;
}

function pick(rng: Rng, items: readonly number[]): number {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/**
 * 벽 생성. 구멍은 "가까운 자리"와 그보다 왼쪽의 "비싼 자리"를 합친 것이다.
 * 첫 벽 이후로는 지금 위치가 맞지 않게 해 가만히 있으면 부서진다(한 자리만 가능한 모양은 예외).
 */
export function generateWall(register: number, wallIndex: number, rng: Rng): Wall {
  const here = offsetOf(register);
  const shape = register >> here;
  const maxOffset = REGISTER_BITS - shapeWidth(register);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);
  const tier = tierFor(wallIndex);

  let near: number;
  let others: number[];
  if (wallIndex === 0) {
    near = here;
    others = offsets.filter((p) => p > here);
  } else {
    const moved = offsets.filter((p) => p !== here);
    const inRange = moved.filter((p) => {
      const d = Math.abs(p - here);
      return d >= tier.minShifts && d <= tier.maxShifts;
    });
    const pool = inRange.length ? inRange : moved.length ? moved : [here];
    // 더 왼쪽에 비싼 자리를 둘 수 있도록 왼쪽 끝이 아닌 자리를 우선한다.
    const notTop = pool.filter((p) => p < maxOffset);
    near = pick(rng, notTop.length ? notTop : pool);
    others = moved.filter((p) => p > near);
  }

  let gaps = (shape << near) & BYTE;
  if (others.length) {
    const withRich = gaps | ((shape << pick(rng, others)) & BYTE);
    // 구멍 있는 모양은 두 자리를 합치면 지금 위치까지 뚫릴 수 있다. 그때는 비싼 자리를 뺀다.
    if (wallIndex === 0 || !fits(register, withRich)) gaps = withRich;
  }

  const nearestShifts = shiftsToNearestFit(register, gaps);
  const fallMs =
    tier.readMs + TAP_BUDGET_MS * nearestShifts + (wallIndex === 0 ? FIRST_WALL_BONUS_MS : 0);
  return { gaps, fallMs, nearestShifts };
}

/** 무손실 연속 보상. 기존 비트 가까이에 새 비트를 하나 켠다. 놓을 곳이 없으면 그대로. */
export function growBit(register: number, rng: Rng): number {
  if (popcount(register) >= MAX_ACTIVE_BITS) return register;
  const options: number[] = [];
  for (let cell = 0; cell < REGISTER_BITS; cell++) {
    if ((register >> cell) & 1) continue;
    const neighbourhood = cell >= 2 ? 0b11111 << (cell - 2) : 0b11111 >> (2 - cell);
    if (!(register & neighbourhood)) continue;
    if (shapeWidth(register | (1 << cell)) > MAX_SHAPE_WIDTH) continue;
    options.push(cell);
  }
  return options.length ? register | (1 << pick(rng, options)) : register;
}

function withEvent(
  state: GameState,
  kind: EventKind,
  lostMask: number,
  grownMask: number,
  gain: number,
): Pick<GameState, "event" | "eventKey"> {
  const key = state.eventKey + 1;
  return { eventKey: key, event: { key, kind, lostMask, grownMask, gain, atMs: state.elapsedMs } };
}

/** 시프트 1회. 진짜 논리 시프트라 끝에 있던 비트는 사라진다. */
export function applyShift(state: GameState, dir: ShiftDir): GameState {
  if (state.over) return state;
  const lostMask = dir === "left" ? state.register & 0x80 : state.register & 1;
  const register = dir === "left" ? (state.register << 1) & BYTE : state.register >> 1;
  const next: GameState = {
    ...state,
    register,
    bestValue: Math.max(state.bestValue, register),
    bitsLost: state.bitsLost + popcount(lostMask),
  };
  if (!lostMask) return next;
  return {
    ...next,
    cleanStreak: 0,
    over: register === 0 ? "out-of-bits" : null,
    ...withEvent(state, "edge", lostMask, 0, 0),
  };
}

function landWall(state: GameState, wall: Wall, rng: Rng): GameState {
  const survivors = state.register & wall.gaps;
  const lostMask = state.register & ~wall.gaps & BYTE;
  const clean = lostMask === 0;
  const cleanStreak = clean ? state.cleanStreak + 1 : 0;

  let register = survivors;
  let streak = cleanStreak;
  if (streak >= CLEAN_WALLS_FOR_NEW_BIT) {
    register = growBit(survivors, rng);
    streak = 0;
  }
  return {
    ...state,
    register,
    score: state.score + survivors,
    wall: null,
    wallAgeMs: 0,
    gapLeftMs: WALL_GAP_MS,
    wallsDone: state.wallsDone + 1,
    cleanStreak: streak,
    bestValue: Math.max(state.bestValue, register),
    bitsLost: state.bitsLost + popcount(lostMask),
    over: register === 0 ? "out-of-bits" : null,
    ...withEvent(state, clean ? "pass" : "crush", lostMask, register & ~survivors, survivors),
  };
}

/** 시간을 dtMs만큼 진행한다. 탭이 잠들었다 깨어나 dt가 커도 벽을 건너뛰지 않는다. */
export function advance(state: GameState, dtMs: number, rng: Rng): GameState {
  let s = state;
  let left = dtMs;
  while (left > 0 && !s.over) {
    if (s.elapsedMs >= GAME_DURATION_MS) return { ...s, over: "time" };

    if (!s.wall && s.gapLeftMs <= 0) {
      s = { ...s, wall: generateWall(s.register, s.wallsDone, rng), wallAgeMs: 0 };
    }
    const toClock = GAME_DURATION_MS - s.elapsedMs;
    const toNext = s.wall ? s.wall.fallMs - s.wallAgeMs : s.gapLeftMs;
    const used = Math.min(left, toClock, toNext);
    s = {
      ...s,
      elapsedMs: s.elapsedMs + used,
      wallAgeMs: s.wall ? s.wallAgeMs + used : 0,
      gapLeftMs: s.wall ? s.gapLeftMs : s.gapLeftMs - used,
    };
    left -= used;
    if (s.wall && s.wallAgeMs >= s.wall.fallMs) s = landWall(s, s.wall, rng);
  }
  if (!s.over && s.elapsedMs >= GAME_DURATION_MS) return { ...s, over: "time" };
  return s;
}

/** 벽 하나의 최단 주기와 레지스터 최댓값으로 계산한 기계 한계. */
export function theoreticalMaxScore(): number {
  const fastestCycleMs = TIERS[TIERS.length - 1].readMs + WALL_GAP_MS;
  const maxValue = 0b11111000;
  return Math.ceil(GAME_DURATION_MS / fastestCycleMs) * maxValue;
}
