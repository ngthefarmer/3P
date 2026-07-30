import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as apiLogin, register as apiRegister } from "../api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fn = mode === "login" ? apiLogin : apiRegister;
      const { token, user } = await fn(username, password);
      auth.login(token, user);
      navigate("/lobby");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered-page">
      <div className="card-panel auth-panel">
        <h1>Teen Patti</h1>
        <p className="subtitle">Play three-card poker with friends, no dealer needed.</p>

        <div className="tab-row">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")} type="button">
            Log In
          </button>
          <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")} type="button">
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={4}
            />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
