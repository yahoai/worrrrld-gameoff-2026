"use client";

import type { GameComponentProps } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/context";
import {
  GAME_DURATION_MS,
  REGISTER_BITS,
  type GameState,
  type ShiftDir,
} from "./logic";
import { useBitShiftGame } from "./useBitShiftGame";

/** 비트 시프트: 레지스터의 비트를 Shift 두 개로 밀어 벽의 구멍에 맞춘다. 통과할 때의 10진 값이 점수다. */

const COPY: Record<
  Locale,
  {
    intro: string;
    keys: string;
    score: string;
    value: string;
    timeUp: string;
    outOfBits: string;
    totalScore: string;
    walls: string;
    best: string;
    lost: string;
  }
> = {
  en: { intro: "Fit the gap. Further left pays more!", keys: "Keyboard: Left/Right Shift or ← →", score: "Score", value: "Value", timeUp: "Time!", outOfBits: "Out of bits!", totalScore: "Total Score", walls: "Walls", best: "Peak value", lost: "Bits lost" },
  ko: { intro: "구멍에 맞춰요. 왼쪽일수록 점수가 커요!", keys: "키보드: 왼쪽/오른쪽 Shift 또는 ← →", score: "점수", value: "값", timeUp: "시간 종료!", outOfBits: "비트 소진!", totalScore: "총점", walls: "통과한 벽", best: "최고 값", lost: "잃은 비트" },
  ja: { intro: "穴に合わせよう。左ほど高得点！", keys: "キーボード: 左右のShift か ← →", score: "スコア", value: "値", timeUp: "タイムアップ!", outOfBits: "ビット切れ!", totalScore: "合計スコア", walls: "壁", best: "最高値", lost: "失ったビット" },
  zh: { intro: "对准缺口，越靠左分越高！", keys: "键盘：左右 Shift 或 ← →", score: "分数", value: "数值", timeUp: "时间到!", outOfBits: "比特耗尽!", totalScore: "总分", walls: "穿过的墙", best: "最高数值", lost: "丢失比特" },
  es: { intro: "Encaja en el hueco. ¡Más a la izquierda, más puntos!", keys: "Teclado: Shift izq./der. o ← →", score: "Puntos", value: "Valor", timeUp: "¡Tiempo!", outOfBits: "¡Sin bits!", totalScore: "Puntuación", walls: "Muros", best: "Valor máx.", lost: "Bits perdidos" },
  pt: { intro: "Encaixe no vão. Mais à esquerda vale mais!", keys: "Teclado: Shift esq./dir. ou ← →", score: "Pontos", value: "Valor", timeUp: "Tempo!", outOfBits: "Sem bits!", totalScore: "Pontuação", walls: "Muros", best: "Valor máx.", lost: "Bits perdidos" },
  fr: { intro: "Vise le trou. Plus à gauche, plus de points !", keys: "Clavier : Shift gauche/droit ou ← →", score: "Score", value: "Valeur", timeUp: "Temps !", outOfBits: "Plus de bits !", totalScore: "Score Total", walls: "Murs", best: "Valeur max", lost: "Bits perdus" },
  de: { intro: "Triff die Lücke. Weiter links zählt mehr!", keys: "Tastatur: linke/rechte Shift oder ← →", score: "Punkte", value: "Wert", timeUp: "Zeit!", outOfBits: "Keine Bits mehr!", totalScore: "Gesamtpunktzahl", walls: "Mauern", best: "Höchstwert", lost: "Verlorene Bits" },
};

const EVENT_FLASH_MS = 420;
/** 비트 7(왼쪽 끝)부터 그린다. */
const CELLS = Array.from({ length: REGISTER_BITS }, (_, i) => REGISTER_BITS - 1 - i);
const bitAt = (value: number, cell: number) => (value >> cell) & 1;
const toBinary = (value: number) => value.toString(2).padStart(REGISTER_BITS, "0");

function WallRow({ gaps, progress }: { gaps: number; progress: number }) {
  return (
    <div
      className="absolute inset-x-2 grid grid-cols-8 gap-1"
      style={{ top: `calc(${progress} * (100% - 3rem))` }}
    >
      {CELLS.map((cell) => (
        <div
          key={cell}
          className={
            bitAt(gaps, cell)
              ? "h-10 rounded-sm border-2 border-dashed border-[#FFC94D]/70"
              : "h-10 rounded-sm border-2 border-ink bg-[#FFF8EE] shadow-[inset_0_-5px_0_rgba(33,30,28,0.25)]"
          }
        />
      ))}
    </div>
  );
}

function Register({ game, flash }: { game: GameState; flash: boolean }) {
  const lost = flash ? (game.event?.lostMask ?? 0) : 0;
  const grown = flash ? (game.event?.grownMask ?? 0) : 0;
  return (
    <div className="grid grid-cols-8 gap-1 px-2 pb-2">
      {CELLS.map((cell) => {
        const on = bitAt(game.register, cell) === 1;
        const gone = bitAt(lost, cell) === 1;
        const born = bitAt(grown, cell) === 1;
        return (
          <div
            key={cell}
            className={`flex h-12 items-center justify-center rounded-md border-2 font-mono text-lg font-black ${
              gone
                ? "border-red-400 bg-red-500 text-white"
                : on
                  ? "border-[#FFF8EE] bg-[#FFC94D] text-ink shadow-[0_0_12px_rgba(255,201,77,0.7)]"
                  : "border-white/15 bg-white/5 text-white/25"
            } ${born ? "scale-110" : ""}`}
          >
            {gone ? "✗" : on ? "1" : "0"}
          </div>
        );
      })}
    </div>
  );
}

function ShiftButton({ dir, onShift }: { dir: ShiftDir; onShift: (dir: ShiftDir) => void }) {
  const left = dir === "left";
  return (
    <button
      type="button"
      aria-label={left ? "Shift left" : "Shift right"}
      onPointerDown={(e) => {
        e.preventDefault();
        onShift(dir);
      }}
      className={`flex h-20 flex-1 touch-none flex-col items-center justify-center rounded-xl border-[3px] border-ink text-white shadow-[3px_4px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_2px_0_#000] ${
        left ? "bg-[#FF7A3D]" : "bg-[#3B6FE0]"
      }`}
    >
      <span className="text-2xl font-black">{left ? "⇧ <<" : ">> ⇧"}</span>
      <span className="text-xs font-black tabular-nums opacity-90">{left ? "× 2" : "÷ 2"}</span>
    </button>
  );
}

export default function BitShift({ playerId, onGameEnd }: GameComponentProps) {
  const { locale } = useI18n();
  const c = COPY[locale];
  const { phase, countdownNum, game, shift } = useBitShiftGame(playerId, onGameEnd);

  const event = game.event;
  const flash = event !== null && game.elapsedMs - event.atMs < EVENT_FLASH_MS;
  const remaining = Math.max(0, 1 - game.elapsedMs / GAME_DURATION_MS);
  const progress = game.wall ? Math.min(1, game.wallAgeMs / game.wall.fallMs) : 0;

  return (
    <div className="relative flex h-[70vh] w-full select-none flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-[#17191F]">
      {/* --- HUD --- */}
      <div className="flex flex-col gap-1.5 px-3 pt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#22B8A6]" style={{ width: `${remaining * 100}%` }} />
        </div>
        <div className="flex items-end justify-between font-mono text-white">
          <div>
            <p className="text-[11px] font-bold text-white/60">{c.value}</p>
            <p className="text-4xl font-black leading-none tabular-nums text-[#FFC94D]">{game.register}</p>
          </div>
          {flash && event && event.kind !== "edge" && (
            <span
              key={event.key}
              className={`rounded-md px-2 py-0.5 text-sm font-black tabular-nums ${
                event.kind === "pass" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {event.kind === "pass" ? "✓" : "✗"} +{event.gain}
            </span>
          )}
          <div className="text-right">
            <p className="text-[11px] font-bold text-white/60">{c.score}</p>
            <p className="text-2xl font-black leading-none tabular-nums">{game.score}</p>
          </div>
        </div>
        <p className="text-center font-mono text-xs font-bold tracking-[0.3em] text-white/50">
          0b{toBinary(game.register)}
        </p>
      </div>

      {/* --- 벽이 떨어지는 통로 --- */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {phase === "playing" && game.wall && <WallRow gaps={game.wall.gaps} progress={progress} />}
        {phase === "countdown" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-7xl font-black text-white">{countdownNum > 0 ? countdownNum : "GO!"}</p>
            <p className="text-base font-black text-white/90">{c.intro}</p>
            <p className="text-xs font-bold text-white/60">{c.keys}</p>
          </div>
        )}
      </div>

      <Register game={game} flash={flash} />

      {/* --- Shift 두 개가 조작 전부 --- */}
      <div className="flex gap-3 border-t-2 border-white/10 bg-black/30 p-3">
        <ShiftButton dir="left" onShift={shift} />
        <ShiftButton dir="right" onShift={shift} />
      </div>

      {/* --- 결과 --- */}
      {phase === "finished" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/75 text-white">
          <p className="text-xl font-black">{game.over === "out-of-bits" ? c.outOfBits : c.timeUp}</p>
          <p className="text-6xl font-black tabular-nums">{game.score}</p>
          <p className="text-sm font-bold opacity-80">{c.totalScore}</p>
          <div className="mt-2 flex flex-col items-center gap-1 text-sm font-bold opacity-80">
            <span>{c.walls}: {game.wallsDone}</span>
            <span>{c.best}: {game.bestValue}</span>
            <span>{c.lost}: {game.bitsLost}</span>
          </div>
        </div>
      )}
    </div>
  );
}
