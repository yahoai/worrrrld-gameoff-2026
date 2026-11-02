"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchResult } from "../types";
import {
  GAME_DURATION_MS,
  advance,
  applyShift,
  createGame,
  type GameState,
  type ShiftDir,
} from "./logic";
import { playCrush, playEnd, playPass, playShift } from "./sound";

type Phase = "countdown" | "playing" | "finished";

/** 결과 패널을 읽을 시간. 이 뒤에 onGameEnd를 불러 화면 전환이 결과를 덮지 않게 한다. */
export const RESULT_HOLD_MS = 2_500;

const LEFT_KEYS = new Set(["ShiftLeft", "ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ShiftRight", "ArrowRight", "KeyD"]);

function keyToDir(code: string): ShiftDir | null {
  if (LEFT_KEYS.has(code)) return "left";
  if (RIGHT_KEYS.has(code)) return "right";
  return null;
}

/** 값이 바뀐 이벤트에 맞는 소리를 낸다. */
function soundFor(prev: GameState, next: GameState) {
  if (next.eventKey === prev.eventKey || !next.event) return;
  if (next.event.kind === "pass") playPass(next.register);
  else playCrush();
}

export function useBitShiftGame(playerId: string, onGameEnd: (result: MatchResult) => void) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownNum, setCountdownNum] = useState(3);
  const [game, setGame] = useState<GameState>(createGame);

  const gameRef = useRef(game);
  const phaseRef = useRef<Phase>("countdown");
  const onGameEndRef = useRef(onGameEnd);
  const reportedRef = useRef(false);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
  }, [onGameEnd]);

  useEffect(() => {
    phaseRef.current = phase;

    if (phase === "countdown") {
      if (countdownNum <= 0) {
        const t = setTimeout(() => setPhase("playing"), 0);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setCountdownNum((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }

    if (phase === "playing") {
      let raf = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const prev = gameRef.current;
        const next = advance(prev, now - last, Math.random);
        last = now;
        gameRef.current = next;
        setGame(next);
        soundFor(prev, next);
        if (next.over) {
          playEnd();
          setPhase("finished");
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    if (!reportedRef.current) {
      const t = setTimeout(() => {
        if (reportedRef.current) return;
        reportedRef.current = true;
        const final = gameRef.current;
        onGameEndRef.current({
          gameId: "bit-shift",
          players: [{ id: playerId, name: "You", score: final.score, result: "win" }],
          durationMs: Math.min(final.elapsedMs, GAME_DURATION_MS),
          playedAt: new Date().toISOString(),
        });
      }, RESULT_HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [phase, countdownNum, playerId]);

  const shift = useCallback((dir: ShiftDir) => {
    if (phaseRef.current !== "playing") return;
    const prev = gameRef.current;
    const next = applyShift(prev, dir);
    gameRef.current = next;
    setGame(next);
    if (next.eventKey !== prev.eventKey) soundFor(prev, next);
    else playShift(next.register);
    if (next.over) {
      playEnd();
      setPhase("finished");
    }
  }, []);

  // 데스크톱은 진짜 Shift 키 두 개로 조작한다. e.code만 왼쪽/오른쪽을 구분해 준다.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const dir = keyToDir(e.code);
      if (!dir || e.repeat) return;
      e.preventDefault();
      shift(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, shift]);

  return { phase, countdownNum, game, shift };
}
