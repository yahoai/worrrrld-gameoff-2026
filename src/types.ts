export interface MatchResult {
  gameId: string;
  players: { id: string; name: string; score: number; result: "win" | "lose" | "draw" }[];
  durationMs: number;
  playedAt: string;
}

export interface GameComponentProps {
  roomId: string;
  playerId: string;
  onGameEnd: (result: MatchResult) => void;
}
