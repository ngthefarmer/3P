import type { Card } from "./deck.js";

export enum HandCategory {
  HighCard = 1,
  Pair = 2,
  Color = 3,
  Sequence = 4,
  PureSequence = 5,
  Trail = 6,
}

export interface HandRank {
  category: HandCategory;
  // Ordered list of tiebreaker values, most significant first.
  // Comparisons walk this array left-to-right.
  tiebreakers: number[];
}

export const HAND_CATEGORY_LABELS: Record<HandCategory, string> = {
  [HandCategory.HighCard]: "High Card",
  [HandCategory.Pair]: "Pair",
  [HandCategory.Color]: "Color (Flush)",
  [HandCategory.Sequence]: "Sequence (Straight)",
  [HandCategory.PureSequence]: "Pure Sequence (Straight Flush)",
  [HandCategory.Trail]: "Trail (Three of a Kind)",
};

function sortDesc(ranks: number[]): number[] {
  return [...ranks].sort((a, b) => b - a);
}

/**
 * Detects a 3-card straight and returns its comparison value, or null if not a straight.
 * A-K-Q is the highest straight; A-2-3 is the lowest (Ace plays low only here),
 * matching standard Teen Patti sequence ordering.
 */
function straightValue(sortedDesc: number[]): number | null {
  const [a, b, c] = sortedDesc;
  if (a === 14 && b === 13 && c === 12) return 14; // A-K-Q: highest
  if (a === 14 && b === 3 && c === 2) return 1; // A-2-3: lowest
  if (a - 1 === b && b - 1 === c) return a;
  return null;
}

export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length !== 3) throw new Error("A Teen Patti hand must have exactly 3 cards");

  const ranksDesc = sortDesc(cards.map((c) => c.rank));
  const isFlush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const isTrail = ranksDesc[0] === ranksDesc[1] && ranksDesc[1] === ranksDesc[2];
  const straight = straightValue(ranksDesc);

  if (isTrail) {
    return { category: HandCategory.Trail, tiebreakers: [ranksDesc[0]] };
  }

  if (straight !== null && isFlush) {
    return { category: HandCategory.PureSequence, tiebreakers: [straight] };
  }

  if (straight !== null) {
    return { category: HandCategory.Sequence, tiebreakers: [straight] };
  }

  if (isFlush) {
    return { category: HandCategory.Color, tiebreakers: ranksDesc };
  }

  const isPair = ranksDesc[0] === ranksDesc[1] || ranksDesc[1] === ranksDesc[2];
  if (isPair) {
    const pairRank = ranksDesc[0] === ranksDesc[1] ? ranksDesc[0] : ranksDesc[1];
    const kicker = ranksDesc[0] === ranksDesc[1] ? ranksDesc[2] : ranksDesc[0];
    return { category: HandCategory.Pair, tiebreakers: [pairRank, kicker] };
  }

  return { category: HandCategory.HighCard, tiebreakers: ranksDesc };
}

/** Returns positive if a > b, negative if a < b, 0 if equal rank (never happens with a single deck). */
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
