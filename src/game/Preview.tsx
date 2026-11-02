"use client";

import { usePhaseLoop } from "@/components/game/previews/usePhaseLoop";

const ORDER = ["fall", "shift", "pass"] as const;
const DURATIONS = { fall: 800, shift: 800, pass: 900 };
export const BIT_SHIFT_LOOP_MS = ORDER.reduce((sum, p) => sum + DURATIONS[p], 0);

const GAPS = 0b00111000;
const BEFORE = 0b00011100;
const AFTER = 0b00111000;
const CELLS = [7, 6, 5, 4, 3, 2, 1, 0];
const on = (value: number, cell: number) => ((value >> cell) & 1) === 1;

/* bit-shift: 벽이 내려옴 -> << 로 값 두 배 -> 구멍 통과 후 값만큼 득점. 실제 게임과 같은 색이다. */
export function BitShiftPreview() {
  const phase = usePhaseLoop(ORDER, DURATIONS);
  const value = phase === "fall" ? BEFORE : AFTER;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-[232px] flex-col gap-2 rounded-xl border-[3px] border-ink bg-[#17191F] p-2">
        <div className="flex items-center justify-between font-mono text-sm font-black">
          <span className="tabular-nums text-[#FFC94D]">{value}</span>
          <span className="text-white">
            {phase === "fall" && "⇧ <<"}
            {phase === "shift" && "× 2"}
            {phase === "pass" && "✓ +56"}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-0.5" style={{ opacity: phase === "pass" ? 0.25 : 1 }}>
          {CELLS.map((cell) => (
            <div
              key={cell}
              className={
                on(GAPS, cell)
                  ? "h-4 rounded-sm border border-dashed border-[#FFC94D]/70"
                  : "h-4 rounded-sm border border-ink bg-[#FFF8EE]"
              }
            />
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5">
          {CELLS.map((cell) => (
            <div
              key={cell}
              className={`flex h-6 items-center justify-center rounded-sm border font-mono text-xs font-black ${
                on(value, cell)
                  ? "border-[#FFF8EE] bg-[#FFC94D] text-ink"
                  : "border-white/15 bg-white/5 text-white/25"
              }`}
            >
              {on(value, cell) ? 1 : 0}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
