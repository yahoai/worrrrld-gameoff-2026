import { describe, expect, it } from "vitest";
import {
  GAME_DURATION_MS,
  MAX_ACTIVE_BITS,
  MAX_SHAPE_WIDTH,
  START_REGISTER,
  TAP_BUDGET_MS,
  WALL_GAP_MS,
  advance,
  applyShift,
  createGame,
  fitOffsets,
  fits,
  generateWall,
  growBit,
  offsetOf,
  popcount,
  shapeWidth,
  shiftsToNearestFit,
  theoreticalMaxScore,
  tierFor,
  type GameState,
  type Rng,
  type ShiftDir,
} from "./logic";

/** 결정적 난수(mulberry32). */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const running = (over: Partial<GameState>): GameState => ({ ...createGame(), ...over });

describe("시프트", () => {
  it("왼쪽은 값 ×2, 오른쪽은 ÷2", () => {
    expect(applyShift(running({ register: 24 }), "left").register).toBe(48);
    expect(applyShift(running({ register: 24 }), "right").register).toBe(12);
  });

  it("끝으로 밀려난 비트는 사라지고 무손실 연속이 끊긴다", () => {
    const left = applyShift(running({ register: 0b11000000, cleanStreak: 2 }), "left");
    expect(left.register).toBe(0b10000000);
    expect(left.bitsLost).toBe(1);
    expect(left.cleanStreak).toBe(0);
    expect(left.event?.kind).toBe("edge");
    expect(left.event?.lostMask).toBe(0x80);

    expect(applyShift(running({ register: 0b00000011 }), "right").register).toBe(1);
  });

  it("마지막 비트를 밀어내면 out-of-bits로 끝난다", () => {
    expect(applyShift(running({ register: 1 }), "right").over).toBe("out-of-bits");
    expect(applyShift(running({ register: 0x80 }), "left").over).toBe("out-of-bits");
  });

  it("끝난 판에는 입력이 먹지 않는다", () => {
    const over = running({ over: "time", register: 24 });
    expect(applyShift(over, "left")).toBe(over);
  });
});

describe("모양 계산", () => {
  it("offset·폭·비트 수", () => {
    expect(offsetOf(0b00110100)).toBe(2);
    expect(shapeWidth(0b00110100)).toBe(4);
    expect(popcount(0b00110100)).toBe(3);
    expect(shapeWidth(0)).toBe(0);
  });

  it("fitOffsets는 구멍에 들어가는 자리만 돌려준다", () => {
    expect(fitOffsets(0b11, 0b00110011)).toEqual([0, 4]);
    expect(shiftsToNearestFit(0b1100, 0b00110011)).toBe(2);
  });
});

describe("벽 생성", () => {
  const registers = [0b11, 0b1, 0b101, 0b1011, 0b11011, 0b110101, 0b10011];

  it("첫 벽은 시작 위치가 이미 맞아 가만히 있어도 0점이 아니다", () => {
    for (let seed = 0; seed < 200; seed++) {
      const wall = generateWall(START_REGISTER, 0, seeded(seed));
      expect(fits(START_REGISTER, wall.gaps)).toBe(true);
      expect(wall.nearestShifts).toBe(0);
    }
  });

  it("첫 벽에는 지금보다 왼쪽의 비싼 자리가 있다", () => {
    for (let seed = 0; seed < 200; seed++) {
      const wall = generateWall(START_REGISTER, 0, seeded(seed));
      const best = Math.max(...fitOffsets(START_REGISTER, wall.gaps));
      expect(best).toBeGreaterThan(offsetOf(START_REGISTER));
    }
  });

  it("맞는 자리가 항상 있고, 2번째 벽부터는 지금 위치가 맞지 않는다", () => {
    for (let seed = 0; seed < 3000; seed++) {
      const rng = seeded(seed);
      const shape = registers[seed % registers.length];
      const room = 8 - shapeWidth(shape);
      const register = shape << Math.floor(rng() * (room + 1));
      const index = 1 + Math.floor(rng() * 25);
      const wall = generateWall(register, index, rng);
      expect(fitOffsets(register, wall.gaps).length).toBeGreaterThan(0);
      expect(fits(register, wall.gaps)).toBe(false);
    }
  });

  it("사람이 닿을 시간 예산: 낙하시간 >= 읽기 예산 + 탭 예산 × 가까운 자리 거리", () => {
    for (let seed = 0; seed < 3000; seed++) {
      const rng = seeded(seed);
      const shape = registers[seed % registers.length];
      const register = shape << Math.floor(rng() * (9 - shapeWidth(shape)));
      const index = Math.floor(rng() * 30);
      const wall = generateWall(register, index, rng);
      expect(wall.fallMs).toBeGreaterThanOrEqual(
        tierFor(index).readMs + TAP_BUDGET_MS * wall.nearestShifts,
      );
      expect(wall.fallMs).toBeGreaterThanOrEqual(950);
    }
  });

  it("맞는 자리가 왼쪽 끝이나 오른쪽 끝에만 몰리지 않는다", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      const wall = generateWall(0b00011000, 5, seeded(seed));
      seen.add(Math.min(...fitOffsets(0b00011000, wall.gaps)));
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("growBit", () => {
  it("기존 비트 근처에 하나 켜고 상한을 지킨다", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const rng = seeded(seed);
      const register = 1 + Math.floor(rng() * 255);
      if (shapeWidth(register) > MAX_SHAPE_WIDTH) continue;
      const grown = growBit(register, rng);
      expect(grown & register).toBe(register);
      expect(popcount(grown)).toBeLessThanOrEqual(Math.max(popcount(register), MAX_ACTIVE_BITS));
      expect(shapeWidth(grown)).toBeLessThanOrEqual(MAX_SHAPE_WIDTH);
    }
  });

  it("이미 최대면 그대로", () => {
    expect(growBit(0b00111110, seeded(1))).toBe(0b00111110);
  });
});

describe("판 진행", () => {
  it("통과하면 그 순간 레지스터 값이 점수가 된다", () => {
    const s = advance(createGame(), 2700, () => 0);
    expect(s.wallsDone).toBe(1);
    expect(s.score).toBe(START_REGISTER);
    expect(s.event?.kind).toBe("pass");
  });

  it("왼쪽으로 옮겨 통과하면 더 큰 값을 받는다", () => {
    let s = advance(createGame(), 10, () => 0.99);
    const offsets = fitOffsets(s.register, s.wall!.gaps);
    const target = Math.max(...offsets);
    while (offsetOf(s.register) < target) s = applyShift(s, "left");
    s = advance(s, 3000, () => 0.99);
    expect(s.score).toBeGreaterThan(START_REGISTER);
  });

  it("벽에 닿은 비트만 부서지고 남은 값만 점수가 된다", () => {
    const wall = { gaps: 0b00010000, fallMs: 100, nearestShifts: 0 };
    const s = advance(running({ register: 0b00011000, wall, cleanStreak: 2 }), 100, () => 0);
    expect(s.register).toBe(0b00010000);
    expect(s.score).toBe(0b00010000);
    expect(s.cleanStreak).toBe(0);
    expect(s.bitsLost).toBe(1);
    expect(s.event?.kind).toBe("crush");
  });

  it("전부 부서지면 out-of-bits", () => {
    const wall = { gaps: 0b11000000, fallMs: 100, nearestShifts: 0 };
    const s = advance(running({ register: 0b00011000, wall }), 100, () => 0);
    expect(s.over).toBe("out-of-bits");
    expect(s.score).toBe(0);
  });

  it("무손실 3연속이면 비트가 늘어난다", () => {
    const wall = { gaps: 0xff, fallMs: 100, nearestShifts: 0 };
    const s = advance(running({ register: 0b00011000, wall, cleanStreak: 2 }), 100, () => 0);
    expect(popcount(s.register)).toBe(3);
    expect(s.event?.grownMask).toBeGreaterThan(0);
    expect(s.cleanStreak).toBe(0);
  });

  it("30초에 정확히 끝나고 dt가 커도 벽을 건너뛰지 않는다", () => {
    const s = advance(running({ elapsedMs: GAME_DURATION_MS - 5 }), 50, () => 0);
    expect(s.over).toBe("time");
    expect(s.elapsedMs).toBe(GAME_DURATION_MS);

    const once = advance(createGame(), 5000, seeded(3));
    expect(once.wallsDone).toBeGreaterThanOrEqual(1);
  });

  it("끝난 판은 더 진행되지 않는다", () => {
    const over = running({ over: "time" });
    expect(advance(over, 100, () => 0)).toBe(over);
  });
});

/** 사람 모델: 벽을 보고 reactionMs 뒤부터 tapMs 간격으로 goal 자리까지 시프트한다. */
function play(seed: number, reactionMs: number, tapMs: number, goal: "near" | "rich" | "idle") {
  const rng = seeded(seed);
  let s = createGame();
  let nextTap = 0;
  const STEP = 10;
  while (!s.over) {
    s = advance(s, STEP, rng);
    if (s.over || !s.wall || goal === "idle") continue;
    if (s.wallAgeMs < reactionMs || s.elapsedMs < nextTap) continue;
    const here = offsetOf(s.register);
    const options = fitOffsets(s.register, s.wall.gaps);
    if (!options.length) continue;
    const nearest = options.reduce((a, b) => (Math.abs(a - here) <= Math.abs(b - here) ? a : b));
    const left = s.wall.fallMs - s.wallAgeMs;
    const reachable = options.filter((p) => left > Math.abs(p - here) * tapMs + STEP);
    const target = goal === "rich" && reachable.length ? Math.max(...reachable) : nearest;
    if (target === here) continue;
    const dir: ShiftDir = target > here ? "left" : "right";
    s = applyShift(s, dir);
    nextTap = s.elapsedMs + tapMs;
  }
  return s;
}

function average(runs: GameState[], f: (s: GameState) => number) {
  return runs.reduce((sum, s) => sum + f(s), 0) / runs.length;
}

describe("사람 모델 시뮬레이션", () => {
  const N = 400;
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const newcomer = seeds.map((s) => play(s, 800, 260, "near"));
  const skilled = seeds.map((s) => play(s, 450, 170, "rich"));
  const idle = seeds.map((s) => play(s, 0, 0, "idle"));

  it("처음 하는 사람(반응 800ms, 탭 260ms)도 0점이 나오지 않고 30초를 버틴다", () => {
    expect(newcomer.every((s) => s.score > 0)).toBe(true);
    expect(newcomer.filter((s) => s.over === "time").length / N).toBeGreaterThan(0.95);
  });

  it("숙련자는 위험을 감수해 처음 하는 사람보다 확실히 높다(실력 차)", () => {
    expect(average(skilled, (s) => s.score)).toBeGreaterThan(average(newcomer, (s) => s.score) * 1.5);
  });

  it("가만히 있으면 첫 벽 점수만 받고 금방 끝난다", () => {
    expect(average(idle, (s) => s.elapsedMs)).toBeLessThan(8000);
    expect(average(idle, (s) => s.score)).toBeLessThan(average(newcomer, (s) => s.score) / 5);
  });

  it("점수 분포가 뭉치지 않는다(동점 비율 낮음)", () => {
    const unique = new Set(newcomer.map((s) => s.score));
    expect(unique.size).toBeGreaterThan(N / 4);
  });

  it("실플레이가 기계 한계 안이다", () => {
    const max = Math.max(...skilled.map((s) => s.score));
    expect(max).toBeLessThanOrEqual(theoreticalMaxScore());
    expect(theoreticalMaxScore()).toBe(Math.ceil(GAME_DURATION_MS / (950 + WALL_GAP_MS)) * 248);
  });

  it("[기록] 평균 수치", () => {
    console.log(
      "newcomer", Math.round(average(newcomer, (s) => s.score)), Math.round(average(newcomer, (s) => s.wallsDone)),
      "skilled", Math.round(average(skilled, (s) => s.score)), Math.round(average(skilled, (s) => s.wallsDone)),
      "skilled-survive", skilled.filter((s) => s.over === "time").length / N,
      "idle", Math.round(average(idle, (s) => s.score)), Math.round(average(idle, (s) => s.elapsedMs)),
    );
  });
});
