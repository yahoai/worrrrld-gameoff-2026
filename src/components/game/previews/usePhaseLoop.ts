"use client";

import { useEffect, useState } from "react";

/** order 순서대로 phase를 순환시키는 공용 미리보기 훅. order/durations는 모듈 상수를
 *  넘겨 참조를 안정적으로 유지한다(매 렌더 새 객체를 넘기면 타이머가 계속 리셋됨). */
export function usePhaseLoop<T extends string>(order: readonly T[], durations: Record<T, number>): T {
  const [phase, setPhase] = useState<T>(order[0]);
  useEffect(() => {
    const idx = order.indexOf(phase);
    const nextPhase = order[(idx + 1) % order.length];
    const id = setTimeout(() => setPhase(nextPhase), durations[phase]);
    return () => clearTimeout(id);
  }, [phase, order, durations]);
  return phase;
}
