import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api";
import "../App.css";

const getAuthErrorMessage = (error, fallbackMessage) => {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.code === "ERR_NETWORK") {
    return "Backend server is not reachable. Start the backend on port 5000 and try again.";
  }

  return fallbackMessage;
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await loginUser({
        email,
        password,
      });

      navigate("/app/notes");
    } catch (loginError) {
      console.error(loginError);
      setError(getAuthErrorMessage(loginError, "Login failed"));
    }
  };

  return (
    <div className="auth-page">
      <div className="app-panel auth-card">
        <span className="app-eyebrow">Welcome back</span>
        <h1 className="auth-title">Log in to your study workspace.</h1>
        <p className="app-subtitle">
          Continue generating notes, quizzes, and managing your uploaded materials.
        </p>

        <form className="auth-form" onSubmit={handleLogin}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="primary-cta" type="submit">Login</button>
        </form>

        {error ? <div className="status-banner error">{error}</div> : null}
      </div>
    </div>
  );
};

export default Login;
