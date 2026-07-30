# Teen Patti Multiplayer

A real-time multiplayer Teen Patti (Indian 3-card poker, played among players — no dealer) table.
Players create or join a table with a room code, play with persistent chip balances tied to their
account, and play out classic Teen Patti betting: boot, blind/seen, chaal/raise, pack, side show,
and show.

## Stack

- **Server**: Node.js, Express, Socket.IO, TypeScript, SQLite (`better-sqlite3`), JWT auth, bcrypt.
- **Client**: React + TypeScript (Vite), Socket.IO client, React Router.

## Project layout

```
server/   Express + Socket.IO backend, SQLite persistence, game engine
client/   React frontend (Vite)
```

## Running locally

Requires Node.js 18+.

```bash
npm install          # installs both workspaces
npm run dev          # runs server (port 4000) and client (port 5173) together
```

Or run them separately:

```bash
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Open the client URL in two or more browser windows/profiles to play against yourself, or share
the room code with other players on your network (set `VITE_API_URL` on the client and
`CLIENT_ORIGIN` on the server if hosting across machines).

### Environment variables

| Var | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `4000` | HTTP/Socket.IO port |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | CORS allow-origin |
| `JWT_SECRET` | server | dev fallback | **Set a real secret in production** |
| `VITE_API_URL` | client | `http://localhost:4000` | Server URL the client connects to |

### Production build

```bash
npm run build   # builds server (dist/) and client (dist/)
npm start       # runs the built server
```
Serve `client/dist` as a static site (or add an Express static handler) pointing at the deployed
server URL.

## Accounts & chips

- Simple username/password accounts (bcrypt-hashed), JWT session tokens.
- New accounts start with 1000 chips. Chip balances persist in SQLite (`server/data/teenpatti.sqlite`)
  and follow the player across tables and sessions.
- If a player's balance ever drops below 200 chips, it's topped back up to 200 on their next login
  so nobody gets permanently locked out.

## Tables

- Any player can create a table, choosing the number of seats (2–10) and the boot (ante) amount.
- Tables are identified by a short room code (e.g. `AB3XZ`) that others use to join.
- Tables live in server memory only — they disappear once everyone leaves (chip balances are
  already persisted to the DB by then, so nothing is lost).
- Any seated player can click "Start Hand" once at least 2 players with enough chips to cover the
  boot are seated.

## Teen Patti rules implemented (v1)

This is the classic "core" Teen Patti ruleset, played among players with no dealer:

**Hand rankings** (highest to lowest):
1. **Trail / Set** (three of a kind) — AAA highest, 222 lowest.
2. **Pure Sequence** (straight flush) — same suit, 3 consecutive ranks. `A-K-Q` is the highest
   sequence; `A-2-3` is the lowest (Ace plays low only in this one case).
3. **Sequence** (straight) — same ranking order as above, mixed suits.
4. **Color** (flush) — same suit, not a sequence; compared card-by-card, highest first.
5. **Pair** — compared by pair rank, then kicker.
6. **High Card** — compared card-by-card, highest first.

Since a single 52-card deck is dealt with no duplicate cards in play, exact ties within a category
never occur in a real hand.

**Betting flow:**
1. Every player dealt into the hand pays the **boot** (ante) into the pot.
2. All players start **blind** (cards face down, unseen).
3. On your turn:
   - **See Cards** — look at your hand (no cost). You may still act blind on your turn if you
     prefer not to look yet.
   - **Chaal** (call) — blind bet = current stake; seen bet = 2× current stake.
   - **Raise** — pay double the chaal amount and double the current stake for everyone going
     forward.
   - **Pack** (fold) — you're out of this hand.
   - **Side Show** — seen players only. Request a private hand comparison with the previous
     player still in the hand (who must also be seen). Costs the same as a chaal. If they accept,
     hands are compared and the loser is automatically packed; if they decline, no comparison
     happens but the turn still passes on.
   - **Show** — once exactly two players remain, a seen player can call Show (cost = a seen
     chaal). Both hands are compared and the winner takes the pot.
4. If everyone else packs, the last remaining player wins the pot automatically without revealing
   their cards.
5. Chip balances are written back to each player's account as soon as a hand ends.

**Known simplifications (by design, for v1):**
- No side pots / all-in mechanics — if you can't cover a bet, you can't make it (pack instead).
- No optional "show your winning hand" after winning by fold.
- No table variants (AK47, Muflis, Joker, etc.) — classic rules only.
- No spectator mode for seats beyond the configured max — the table is full once every seat is
  taken.

## Playing a hand

1. Register/log in.
2. Create a table (pick seats + boot) or join one with a room code.
3. Once 2+ players are seated, anyone can start the hand.
4. Play blind or peek at your cards, then chaal, raise, pack, side show, or show as the rules
   allow. The action bar only shows the moves that are valid for your turn/state.
