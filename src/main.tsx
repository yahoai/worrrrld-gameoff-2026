import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import BitShift from "./game/BitShift";
import { BitShiftPreview } from "./game/Preview";
import type { MatchResult } from "./types";
import "./index.css";

function App() {
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<MatchResult | null>(null);

  if (playing) {
    return (
      <BitShift
        key={round}
        roomId="local"
        playerId="local"
        onGameEnd={(result) => {
          setLast(result);
          setPlaying(false);
        }}
      />
    );
  }
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center text-ink">
      <h1 className="text-4xl font-black">Bit Shift</h1>
      <div className="h-32 w-full">
        <BitShiftPreview />
      </div>
      {last && <p className="text-xl font-black">Score: {last.players[0].score}</p>}
      <button
        type="button"
        className="rounded-xl border-[3px] border-ink bg-[#FF7A3D] px-8 py-3 text-xl font-black text-white"
        onClick={() => {
          setRound((r) => r + 1);
          setPlaying(true);
        }}
      >
        {last ? "Play again" : "Start"}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="mx-auto w-full max-w-[430px] p-2">
      <App />
    </main>
  </StrictMode>,
);
