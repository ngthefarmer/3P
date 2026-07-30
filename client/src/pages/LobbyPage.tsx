import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../socket";

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [maxSeats, setMaxSeats] = useState(6);
  const [bootAmount, setBootAmount] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const socket = getSocket();
    if (!socket) return setError("Not connected to server");
    setBusy(true);
    socket.emit(
      "room:create",
      { maxSeats, bootAmount },
      (res: { ok: boolean; error?: string; roomCode?: string }) => {
        setBusy(false);
        if (!res.ok || !res.roomCode) return setError(res.error || "Could not create room");
        navigate(`/table/${res.roomCode}`);
      }
    );
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!joinCode.trim()) return setError("Enter a room code");
    navigate(`/table/${joinCode.trim().toUpperCase()}`);
  }

  return (
    <div className="centered-page">
      <div className="lobby-header">
        <div>
          Welcome, <strong>{user?.username}</strong>
        </div>
        <div>
          Chips: <strong>{user?.chipBalance}</strong>
        </div>
        <button className="btn ghost" onClick={logout} type="button">
          Log Out
        </button>
      </div>

      <div className="lobby-panels">
        <div className="card-panel">
          <h2>Create a Table</h2>
          <form onSubmit={handleCreate}>
            <label>
              Seats (2-10)
              <input
                type="number"
                min={2}
                max={10}
                value={maxSeats}
                onChange={(e) => setMaxSeats(Number(e.target.value))}
              />
            </label>
            <label>
              Boot Amount
              <input
                type="number"
                min={1}
                value={bootAmount}
                onChange={(e) => setBootAmount(Number(e.target.value))}
              />
            </label>
            <button type="submit" className="btn primary" disabled={busy}>
              Create Table
            </button>
          </form>
        </div>

        <div className="card-panel">
          <h2>Join a Table</h2>
          <form onSubmit={handleJoin}>
            <label>
              Room Code
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="e.g. AB3XZ"
              />
            </label>
            <button type="submit" className="btn primary">
              Join Table
            </button>
          </form>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
