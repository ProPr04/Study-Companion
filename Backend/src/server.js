import express from "express";
import "./config/env.js";
import pool from "./db/index.js";
import documentRoutes from "./routes/documentRoutes.js";

const app = express();

app.use(express.json());

// Routes
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
