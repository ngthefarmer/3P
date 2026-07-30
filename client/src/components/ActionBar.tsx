import type { PlayerAction, TableStateForPlayer } from "../types";

interface ActionBarProps {
  state: TableStateForPlayer;
  onAction: (action: PlayerAction) => void;
}

export function ActionBar({ state, onAction }: ActionBarProps) {
  const { mySeatIndex, seats, handInProgress, pendingSideShow, turnSeatIndex, baseCallAmount } = state;
  const mySeat = mySeatIndex !== null ? seats[mySeatIndex] : null;
  const remainingCount = seats.filter((s) => s.inHand && !s.folded).length;

  if (!handInProgress) {
    return (
      <div className="action-bar">
        {mySeatIndex !== null ? (
          <button className="btn primary" onClick={() => onAction({ type: "startHand" })}>
            Start Hand
          </button>
        ) : (
          <div className="action-hint">Spectating &mdash; waiting for a seat.</div>
        )}
      </div>
    );
  }

  if (pendingSideShow) {
    if (pendingSideShow.targetIndex === mySeatIndex) {
      const requesterName = seats[pendingSideShow.requesterIndex]?.username;
      return (
        <div className="action-bar">
          <div className="action-hint">{requesterName} wants a side show with you.</div>
          <button className="btn primary" onClick={() => onAction({ type: "sideShowAccept" })}>
            Accept
          </button>
          <button className="btn danger" onClick={() => onAction({ type: "sideShowDecline" })}>
            Decline
          </button>
        </div>
      );
    }
    return (
      <div className="action-bar">
        <div className="action-hint">
          Side show requested between {seats[pendingSideShow.requesterIndex]?.username} and{" "}
          {seats[pendingSideShow.targetIndex]?.username}...
        </div>
      </div>
    );
  }

  if (!mySeat || mySeatIndex !== turnSeatIndex || !mySeat.inHand || mySeat.folded) {
    const turnPlayer = turnSeatIndex !== null ? seats[turnSeatIndex]?.username : null;
    return (
      <div className="action-bar">
        <div className="action-hint">{turnPlayer ? `Waiting for ${turnPlayer}...` : "Waiting..."}</div>
      </div>
    );
  }

  return (
    <div className="action-bar">
      {mySeat.isBlind && (
        <button className="btn ghost" onClick={() => onAction({ type: "see" })}>
          See Cards
        </button>
      )}
      <button className="btn primary" onClick={() => onAction({ type: "chaal" })}>
        {mySeat.isBlind ? "Blind Chaal" : "Chaal"} ({baseCallAmount})
      </button>
      <button className="btn primary" onClick={() => onAction({ type: "raise" })}>
        Raise ({baseCallAmount ? baseCallAmount * 2 : "-"})
      </button>
      {!mySeat.isBlind && (
        <button className="btn ghost" onClick={() => onAction({ type: "sideShowRequest" })}>
          Side Show
        </button>
      )}
      {!mySeat.isBlind && remainingCount === 2 && (
        <button className="btn primary" onClick={() => onAction({ type: "show" })}>
          Show
        </button>
      )}
      <button className="btn danger" onClick={() => onAction({ type: "pack" })}>
        Pack
      </button>
    </div>
  );
}
