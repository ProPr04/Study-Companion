import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signupUser } from "../api";
import "../App.css";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signupUser({
        email,
        password,
      });

      navigate("/app/notes");
    } catch (signupError) {
      console.error(signupError);
      setError(signupError?.response?.data?.error || "Signup failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="app-panel auth-card">
        <span className="app-eyebrow">Create account</span>
        <h1 className="auth-title">Start your learning workspace.</h1>
        <p className="app-subtitle">
          Sign up to save uploads, generate notes, build quizzes, and manage your session.
        </p>

        <form className="auth-form" onSubmit={handleSignup}>
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
          <button className="primary-cta" type="submit">Sign up</button>
        </form>

        {error ? <div className="status-banner error">{error}</div> : null}
      </div>
    </div>
  );
};

export default Signup;
