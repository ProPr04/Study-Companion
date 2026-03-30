import bcrypt from "bcrypt";
import pool from "../db/index.js";
import { generateToken } from "../utils/jwt.js";

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const validateCredentials = (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password ?? "");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    return { error: "A valid email is required" };
  }

  if (normalizedPassword.length < 8) {
    return { error: "Password must be at least 8 characters long" };
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword,
  };
};

export const signup = async (req, res) => {
  try {
    const validated = validateCredentials(req.body?.email, req.body?.password);

    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const { email, password } = validated;

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
      [email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
};

export const login = async (req, res) => {
  try {
    const validated = validateCredentials(req.body?.email, req.body?.password);

    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const { email, password } = validated;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
};
