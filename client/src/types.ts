export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  rank: number;
  suit: Suit;
}

export interface PublicSeatState {
  seatIndex: number;
  userId: number | null;
  username: string | null;
  chips: number;
  connected: boolean;
  inHand: boolean;
  folded: boolean;
  isBlind: boolean;
  hasCards: boolean;
  isDealer: boolean;
  isTurn: boolean;
  awaitingSideShowResponse: boolean;
  revealedCards?: Card[];
  revealedHandLabel?: string;
}

export interface PendingSideShow {
  requesterIndex: number;
  targetIndex: number;
}

export interface LastHandResult {
  winnerSeatIndex: number;
  winnerUsername: string;
  amountWon: number;
  reason: "fold" | "show" | "sideshow";
}

export interface TableStateForPlayer {
  roomCode: string;
  maxSeats: number;
  bootAmount: number;
  currentStake: number;
  baseCallAmount: number | null;
  pot: number;
  handInProgress: boolean;
  dealerSeatIndex: number | null;
  turnSeatIndex: number | null;
  mySeatIndex: number | null;
  myCards: Card[] | null;
  myHandLabel: string | null;
  seats: PublicSeatState[];
  pendingSideShow: PendingSideShow | null;
  lastHandResult: LastHandResult | null;
  log: string[];
}

export type PlayerAction =
  | { type: "startHand" }
  | { type: "see" }
  | { type: "chaal" }
  | { type: "raise" }
  | { type: "pack" }
  | { type: "sideShowRequest" }
  | { type: "sideShowAccept" }
  | { type: "sideShowDecline" }
  | { type: "show" };

export interface AuthUser {
  id: number;
  username: string;
  chipBalance: number;
}
