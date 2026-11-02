# Bit Shift

My entry for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026). The theme is **SHIFT**.

Two Shift keys, one byte, 30 seconds.

**Play:** https://www.worrrrld.com/play/bit-shift?entry=jam (no account needed)

## How it plays

Your bits sit in an 8-cell register. A wall drops with gaps in it, and every lit bit has to line up with a gap when it lands.

- Left Shift is a real `<<`, so the register's value doubles. Right Shift is `>>`, so it halves.
- A bit pushed past the edge is gone for good.
- Clearing a wall scores the register's decimal value at that moment, so the same fit is worth more further left.
- Most walls have a close safe spot and a riskier one further left that pays more.
- Bits that hit the wall break. Lose them all and it's OUT OF BITS, game over.
- Three clean walls in a row earn a new bit, up to five.

The sound follows the number too: the pitch is proportional to the value, so `<<` plays exactly one octave higher.

On worrrrld.com a finished run becomes a challenge link you can send to a friend, who plays for the higher score.

## Controls

| Input | Shift left | Shift right |
|---|---|---|
| Keyboard | Left Shift | Right Shift |
| Keyboard, other | ← or A | → or D |
| Touch | orange button | blue button |

Tapping Shift five times turns on Sticky Keys on Windows. If that popup appears, use the arrow keys.

## Run it locally

```bash
pnpm install
pnpm dev
pnpm test
```

## What's in this repo

- `src/game/`: the game. `logic.ts` is a pure state machine with no React or browser code, `logic.test.ts` covers it, including simulated players.
- `src/main.tsx`, `src/lib/`, `src/components/`: a small standalone shell so the game runs on its own.
- `itch/index.html`: the wrapper uploaded to itch.io, which embeds the hosted game.

The worrrrld site itself (accounts, challenges, leaderboards) is a separate private project and isn't included.

## Credits

Made by [yahoai](https://yahoai.itch.io) with AI assistance (Claude Code). Code and sound are original; the audio is synthesized at runtime with WebAudio.
