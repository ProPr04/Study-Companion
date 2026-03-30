import express from "express";
import cors from "cors";
import "./config/env.js";
import pool from "./db/index.js";
import documentRoutes from "./routes/documentRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const PORT = process.env.PORT || 5000;
const app = express();


app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

// Test route
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "API is running",
      time: result.rows[0],
    });
  } catch (error) {
    res.status(500).send("DB error");
  }
});

app.use((error, req, res, next) => {
  if (error?.message === "Only PDF files allowed") {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
