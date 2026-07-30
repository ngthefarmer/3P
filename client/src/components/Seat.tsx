import type { Card, PublicSeatState } from "../types";
import { PlayingCard } from "./PlayingCard";

interface SeatProps {
  seat: PublicSeatState;
  style: React.CSSProperties;
  isMe: boolean;
  myCards: Card[] | null;
}

export function Seat({ seat, style, isMe, myCards }: SeatProps) {
  if (!seat.userId) {
    return (
      <div className="seat empty" style={style}>
        <div className="seat-empty-label">Empty Seat</div>
      </div>
    );
  }

  const cardsToShow: (Card | undefined)[] = seat.revealedCards
    ? seat.revealedCards
    : isMe && myCards
    ? myCards
    : seat.hasCards
    ? [undefined, undefined, undefined]
    : [];

  return (
    <div
      className={[
        "seat",
        seat.isTurn ? "is-turn" : "",
        seat.folded ? "folded" : "",
        !seat.connected ? "disconnected" : "",
        seat.awaitingSideShowResponse ? "awaiting-sideshow" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div className="seat-name-row">
        {seat.isDealer && <span className="badge dealer-badge">D</span>}
        <span className="seat-name">{seat.username}</span>
        {isMe && <span className="badge me-badge">You</span>}
      </div>
      <div className="seat-chips">{seat.chips} chips</div>
      <div className="seat-cards">
        {cardsToShow.map((c, i) => (
          <PlayingCard key={i} card={c} faceDown={!c} />
        ))}
      </div>
      <div className="seat-status-row">
        {seat.folded && <span className="badge fold-badge">Packed</span>}
        {!seat.folded && seat.inHand && seat.isBlind && <span className="badge blind-badge">Blind</span>}
        {!seat.folded && seat.inHand && !seat.isBlind && <span className="badge seen-badge">Seen</span>}
        {!seat.connected && <span className="badge disconnected-badge">Offline</span>}
        {seat.revealedHandLabel && <span className="badge reveal-badge">{seat.revealedHandLabel}</span>}
      </div>
    </div>
  );
}
