export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  rank: number; // 2-14 (14 = Ace)
  suit: Suit;
}

const SUITS: Suit[] = ["S", "H", "D", "C"];

export function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const RANK_LABELS: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function cardLabel(card: Card): string {
  const rankLabel = RANK_LABELS[card.rank] ?? String(card.rank);
  return `${rankLabel}${card.suit}`;
}
