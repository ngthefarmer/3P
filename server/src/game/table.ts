import { createShuffledDeck, type Card } from "./deck.js";
import { compareHands, evaluateHand, HAND_CATEGORY_LABELS } from "./handEvaluator.js";
import type {
  ActionResult,
  LastHandResult,
  PendingSideShow,
  PlayerAction,
  PublicSeatState,
  TableStateForPlayer,
} from "./types.js";
import { setChipBalance } from "../db.js";

export interface SeatPlayer {
  userId: number;
  username: string;
  socketId: string | null;
  chips: number;
  connected: boolean;
  cards: Card[] | null;
  folded: boolean;
  isBlind: boolean;
  inHand: boolean;
  revealed: boolean; // true once this seat's cards were shown to the table this hand
}

const MAX_LOG_LINES = 30;

export class TeenPattiTable {
  readonly roomCode: string;
  readonly maxSeats: number;
  readonly bootAmount: number;
  seats: (SeatPlayer | null)[];
  dealerIndex: number | null = null;
  turnIndex: number | null = null;
  handInProgress = false;
  pot = 0;
  currentStake = 0;
  pendingSideShow: PendingSideShow | null = null;
  lastHandResult: LastHandResult | null = null;
  log: string[] = [];

  constructor(roomCode: string, maxSeats: number, bootAmount: number) {
    this.roomCode = roomCode;
    this.maxSeats = maxSeats;
    this.bootAmount = bootAmount;
    this.seats = new Array(maxSeats).fill(null);
  }

  private pushLog(message: string) {
    this.log.push(message);
    if (this.log.length > MAX_LOG_LINES) this.log.shift();
  }

  findSeatByUserId(userId: number): number | null {
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i]?.userId === userId) return i;
    }
    return null;
  }

  seatPlayer(userId: number, username: string, chips: number, socketId: string): { ok: boolean; error?: string; seatIndex?: number } {
    const existing = this.findSeatByUserId(userId);
    if (existing !== null) {
      this.seats[existing]!.connected = true;
      this.seats[existing]!.socketId = socketId;
      return { ok: true, seatIndex: existing };
    }
    const freeIndex = this.seats.findIndex((s) => s === null);
    if (freeIndex === -1) return { ok: false, error: "Table is full" };
    this.seats[freeIndex] = {
      userId,
      username,
      socketId,
      chips,
      connected: true,
      cards: null,
      folded: false,
      isBlind: true,
      inHand: false,
      revealed: false,
    };
    this.pushLog(`${username} joined the table.`);
    return { ok: true, seatIndex: freeIndex };
  }

  markDisconnected(userId: number) {
    const idx = this.findSeatByUserId(userId);
    if (idx === null) return;
    const seat = this.seats[idx]!;
    seat.connected = false;
    seat.socketId = null;
    if (this.handInProgress && seat.inHand && !seat.folded) {
      this.foldSeat(idx, "disconnected");
    }
  }

  /** Removes a player from the table entirely, persisting their chip balance. Returns their chip count. */
  removePlayer(userId: number): number | null {
    const idx = this.findSeatByUserId(userId);
    if (idx === null) return null;
    const seat = this.seats[idx]!;
    if (this.handInProgress && seat.inHand && !seat.folded) {
      this.foldSeat(idx, "left the table");
    }
    const chips = seat.chips;
    setChipBalance(userId, chips);
    this.pushLog(`${seat.username} left the table.`);
    this.seats[idx] = null;
    return chips;
  }

  private activeSeatIndexes(predicate: (s: SeatPlayer) => boolean): number[] {
    const result: number[] = [];
    this.seats.forEach((s, i) => {
      if (s && predicate(s)) result.push(i);
    });
    return result;
  }

  canStartHand(): boolean {
    if (this.handInProgress) return false;
    const eligible = this.activeSeatIndexes((s) => s.chips >= this.bootAmount);
    return eligible.length >= 2;
  }

  private nextSeatIndex(from: number, predicate: (s: SeatPlayer) => boolean): number | null {
    for (let step = 1; step <= this.maxSeats; step++) {
      const idx = (from + step) % this.maxSeats;
      const seat = this.seats[idx];
      if (seat && predicate(seat)) return idx;
    }
    return null;
  }

  startHand(): ActionResult {
    if (!this.canStartHand()) return { ok: false, error: "Need at least 2 players with enough chips to start" };

    const dealtSeats = this.activeSeatIndexes((s) => s.chips >= this.bootAmount);
    const deck = createShuffledDeck();

    this.seats.forEach((seat, i) => {
      if (!seat) return;
      if (dealtSeats.includes(i)) {
        seat.cards = [deck.pop()!, deck.pop()!, deck.pop()!];
        seat.folded = false;
        seat.isBlind = true;
        seat.inHand = true;
        seat.revealed = false;
        seat.chips -= this.bootAmount;
      } else {
        seat.cards = null;
        seat.inHand = false;
        seat.folded = false;
      }
    });

    this.pot = dealtSeats.length * this.bootAmount;
    this.currentStake = this.bootAmount;
    this.pendingSideShow = null;
    this.lastHandResult = null;

    const prevDealer = this.dealerIndex ?? -1;
    this.dealerIndex = this.nextSeatIndex(prevDealer, (s) => dealtSeats.includes(this.seats.indexOf(s)));
    if (this.dealerIndex === null) this.dealerIndex = dealtSeats[0];

    this.turnIndex = this.nextSeatIndex(this.dealerIndex, (s) => s.inHand);
    this.handInProgress = true;
    this.pushLog(`New hand dealt. Boot: ${this.bootAmount}. ${dealtSeats.length} players in.`);
    return { ok: true };
  }

  private baseCallAmountForSeat(seat: SeatPlayer): number {
    return seat.isBlind ? this.currentStake : this.currentStake * 2;
  }

  private inHandSeats(): number[] {
    return this.activeSeatIndexes((s) => s.inHand && !s.folded);
  }

  private foldSeat(idx: number, reason: string) {
    const seat = this.seats[idx];
    if (!seat) return;
    seat.folded = true;
    seat.inHand = false;
    this.pushLog(`${seat.username} packed (${reason}).`);
    this.checkForAutoWin();
  }

  private checkForAutoWin() {
    if (!this.handInProgress) return;
    const remaining = this.inHandSeats();
    if (remaining.length === 1) {
      this.endHand(remaining[0], "fold");
    }
  }

  private advanceTurnAfter(idx: number) {
    if (!this.handInProgress) return;
    const remaining = this.inHandSeats();
    if (remaining.length <= 1) return;
    this.turnIndex = this.nextSeatIndex(idx, (s) => s.inHand && !s.folded);
  }

  private endHand(winnerIdx: number, reason: LastHandResult["reason"]) {
    const winner = this.seats[winnerIdx]!;
    winner.chips += this.pot;
    this.lastHandResult = {
      winnerSeatIndex: winnerIdx,
      winnerUsername: winner.username,
      amountWon: this.pot,
      reason,
    };
    this.pushLog(`${winner.username} wins the pot of ${this.pot} (${reason}).`);

    // Persist chip balances for everyone who was dealt into this hand.
    // In-memory seat.chips is the source of truth during play, so we write it straight to the DB.
    this.seats.forEach((s) => {
      if (s && s.cards !== null) {
        setChipBalance(s.userId, s.chips);
      }
    });

    this.pot = 0;
    this.currentStake = 0;
    this.turnIndex = null;
    this.pendingSideShow = null;
    this.handInProgress = false;
  }

  handleAction(userId: number, action: PlayerAction): ActionResult {
    const idx = this.findSeatByUserId(userId);
    if (idx === null) return { ok: false, error: "You are not seated at this table" };
    const seat = this.seats[idx]!;

    if (action.type === "startHand") {
      return this.startHand();
    }

    if (!this.handInProgress) return { ok: false, error: "No hand in progress" };

    if (this.pendingSideShow) {
      if (action.type === "sideShowAccept" || action.type === "sideShowDecline") {
        if (idx !== this.pendingSideShow.targetIndex) {
          return { ok: false, error: "You are not the target of this side show request" };
        }
        return this.resolveSideShow(action.type === "sideShowAccept");
      }
      return { ok: false, error: "A side show request is pending" };
    }

    if (this.turnIndex !== idx) return { ok: false, error: "It is not your turn" };
    if (!seat.inHand || seat.folded) return { ok: false, error: "You are not active in this hand" };

    switch (action.type) {
      case "see": {
        if (!seat.isBlind) return { ok: false, error: "You have already seen your cards" };
        seat.isBlind = false;
        this.pushLog(`${seat.username} looked at their cards.`);
        return { ok: true };
      }
      case "chaal": {
        const amount = this.baseCallAmountForSeat(seat);
        if (seat.chips < amount) return { ok: false, error: "Not enough chips to call" };
        seat.chips -= amount;
        this.pot += amount;
        this.pushLog(`${seat.username} played ${seat.isBlind ? "blind" : "seen"} chaal (${amount}).`);
        this.advanceTurnAfter(idx);
        return { ok: true };
      }
      case "raise": {
        const amount = this.baseCallAmountForSeat(seat) * 2;
        if (seat.chips < amount) return { ok: false, error: "Not enough chips to raise" };
        seat.chips -= amount;
        this.pot += amount;
        this.currentStake *= 2;
        this.pushLog(`${seat.username} raised ${seat.isBlind ? "blind" : "seen"} (${amount}). Stake is now ${this.currentStake}.`);
        this.advanceTurnAfter(idx);
        return { ok: true };
      }
      case "pack": {
        this.foldSeat(idx, "packed");
        if (this.handInProgress) this.advanceTurnAfter(idx);
        return { ok: true };
      }
      case "sideShowRequest": {
        if (seat.isBlind) return { ok: false, error: "You must see your cards before requesting a side show" };
        const targetIdx = this.findPreviousInHandSeat(idx);
        if (targetIdx === null) return { ok: false, error: "No eligible player for a side show" };
        const target = this.seats[targetIdx]!;
        if (target.isBlind) return { ok: false, error: "The previous player hasn't seen their cards yet" };
        const cost = this.baseCallAmountForSeat(seat);
        if (seat.chips < cost) return { ok: false, error: "Not enough chips to request a side show" };
        seat.chips -= cost;
        this.pot += cost;
        this.pendingSideShow = { requesterIndex: idx, targetIndex: targetIdx };
        this.pushLog(`${seat.username} requested a side show with ${target.username}.`);
        return { ok: true };
      }
      case "show": {
        const remaining = this.inHandSeats();
        if (remaining.length !== 2) return { ok: false, error: "Show is only available heads-up between the last two players" };
        if (seat.isBlind) return { ok: false, error: "You must see your cards before calling show" };
        const opponentIdx = remaining.find((i) => i !== idx)!;
        const opponent = this.seats[opponentIdx]!;
        const cost = this.baseCallAmountForSeat(seat);
        if (seat.chips < cost) return { ok: false, error: "Not enough chips to call show" };
        seat.chips -= cost;
        this.pot += cost;
        seat.revealed = true;
        opponent.revealed = true;
        const result = compareHands(evaluateHand(seat.cards!), evaluateHand(opponent.cards!));
        const winnerIdx = result >= 0 ? idx : opponentIdx;
        this.pushLog(`${seat.username} called show against ${opponent.username}.`);
        this.endHand(winnerIdx, "show");
        return { ok: true };
      }
      default:
        return { ok: false, error: "Unknown action" };
    }
  }

  private findPreviousInHandSeat(fromIdx: number): number | null {
    for (let step = 1; step < this.maxSeats; step++) {
      const idx = (fromIdx - step + this.maxSeats) % this.maxSeats;
      const seat = this.seats[idx];
      if (seat && seat.inHand && !seat.folded && idx !== fromIdx) return idx;
    }
    return null;
  }

  private resolveSideShow(accepted: boolean): ActionResult {
    const pending = this.pendingSideShow!;
    const requester = this.seats[pending.requesterIndex]!;
    const target = this.seats[pending.targetIndex]!;

    if (!accepted) {
      this.pushLog(`${target.username} declined the side show.`);
      this.pendingSideShow = null;
      this.advanceTurnAfter(pending.requesterIndex);
      return { ok: true };
    }

    const result = compareHands(evaluateHand(requester.cards!), evaluateHand(target.cards!));
    const loserIdx = result >= 0 ? pending.targetIndex : pending.requesterIndex;
    this.pushLog(`${requester.username} and ${target.username} compared hands in the side show.`);
    this.pendingSideShow = null;
    this.foldSeat(loserIdx, "lost side show");
    if (this.handInProgress) this.advanceTurnAfter(pending.requesterIndex);
    return { ok: true };
  }

  getStateForUser(userId: number | null): TableStateForPlayer {
    const mySeatIndex = userId !== null ? this.findSeatByUserId(userId) : null;
    const mySeat = mySeatIndex !== null ? this.seats[mySeatIndex] : null;

    const seats: PublicSeatState[] = this.seats.map((seat, i) => {
      if (!seat) {
        return {
          seatIndex: i,
          userId: null,
          username: null,
          chips: 0,
          connected: false,
          inHand: false,
          folded: false,
          isBlind: false,
          hasCards: false,
          isDealer: false,
          isTurn: false,
          awaitingSideShowResponse: false,
        };
      }
      const revealNow = !this.handInProgress && seat.revealed && seat.cards;
      return {
        seatIndex: i,
        userId: seat.userId,
        username: seat.username,
        chips: seat.chips,
        connected: seat.connected,
        inHand: seat.inHand,
        folded: seat.folded,
        isBlind: seat.isBlind,
        hasCards: seat.cards !== null && seat.inHand,
        isDealer: this.dealerIndex === i,
        isTurn: this.turnIndex === i,
        awaitingSideShowResponse: this.pendingSideShow?.targetIndex === i,
        revealedCards: revealNow ? seat.cards! : undefined,
        revealedHandLabel: revealNow ? HAND_CATEGORY_LABELS[evaluateHand(seat.cards!).category] : undefined,
      };
    });

    const myCards = mySeat?.cards && (!mySeat.isBlind || !this.handInProgress) ? mySeat.cards : null;
    const myHandLabel = myCards ? HAND_CATEGORY_LABELS[evaluateHand(myCards).category] : null;

    return {
      roomCode: this.roomCode,
      maxSeats: this.maxSeats,
      bootAmount: this.bootAmount,
      currentStake: this.currentStake,
      baseCallAmount: mySeat && this.handInProgress ? this.baseCallAmountForSeat(mySeat) : null,
      pot: this.pot,
      handInProgress: this.handInProgress,
      dealerSeatIndex: this.dealerIndex,
      turnSeatIndex: this.turnIndex,
      mySeatIndex,
      myCards,
      myHandLabel,
      seats,
      pendingSideShow: this.pendingSideShow,
      lastHandResult: this.lastHandResult,
      log: this.log,
    };
  }
}
