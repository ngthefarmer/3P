import type { Card, Suit } from "../types";

const SUIT_SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS: Suit[] = ["H", "D"];
const RANK_LABELS: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export function PlayingCard({ card, faceDown = false }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return <div className="playing-card face-down" aria-label="hidden card" />;
  }
  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`playing-card ${isRed ? "red" : "black"}`}>
      <span className="card-rank">{rankLabel(card.rank)}</span>
      <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
