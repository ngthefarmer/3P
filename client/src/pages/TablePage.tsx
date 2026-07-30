import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../socket";
import { Seat } from "../components/Seat";
import { ActionBar } from "../components/ActionBar";
import type { PlayerAction, TableStateForPlayer } from "../types";

function seatStyle(index: number, total: number): React.CSSProperties {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  const rx = 42;
  const ry = 36;
  const x = 50 + rx * Math.cos(angle);
  const y = 50 + ry * Math.sin(angle);
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
  };
}

export default function TablePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { updateBalance } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<TableStateForPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomCode) return;

    function handleState(newState: TableStateForPlayer) {
      setState(newState);
      if (newState.mySeatIndex !== null) {
        updateBalance(newState.seats[newState.mySeatIndex].chips);
      }
    }

    socket.on("table:state", handleState);

    if (!joinedRef.current) {
      joinedRef.current = true;
      socket.emit("room:join", { roomCode }, (res: { ok: boolean; error?: string }) => {
        if (!res.ok) {
          setError(res.error || "Could not join room");
        }
      });
    }

    return () => {
      socket.off("table:state", handleState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const handleAction = useCallback((action: PlayerAction) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("game:action", action, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setError(res.error || "Action failed");
    });
  }, []);

  function handleLeave() {
    const socket = getSocket();
    socket?.emit("room:leave", {}, () => {
      navigate("/lobby");
    });
  }

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  if (!state) {
    return (
      <div className="centered-page">
        <div className="card-panel">
          <p>Joining table {roomCode}...</p>
          {error && <div className="error-text">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="table-page">
      <div className="table-topbar">
        <div>
          Room Code: <strong>{state.roomCode}</strong>
        </div>
        <div>Boot: {state.bootAmount}</div>
        <button className="btn ghost" onClick={handleLeave} type="button">
          Leave Table
        </button>
      </div>

      <div className="poker-table">
        <div className="table-center">
          <div className="pot-display">Pot: {state.pot}</div>
          <div className="stake-display">Stake: {state.currentStake}</div>
          {state.lastHandResult && (
            <div className="last-result">
              {state.lastHandResult.winnerUsername} won {state.lastHandResult.amountWon} ({state.lastHandResult.reason})
            </div>
          )}
        </div>
        {state.seats.map((seat, i) => (
          <Seat
            key={i}
            seat={seat}
            style={seatStyle(i, state.maxSeats)}
            isMe={i === state.mySeatIndex}
            myCards={i === state.mySeatIndex ? state.myCards : null}
          />
        ))}
      </div>

      <ActionBar state={state} onAction={handleAction} />

      {error && <div className="toast error-toast">{error}</div>}

      <div className="log-panel">
        {state.log
          .slice()
          .reverse()
          .map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
      </div>
    </div>
  );
}
