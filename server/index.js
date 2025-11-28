const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const pool = require("./db");

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("DB connection error:", err);
  } else {
    console.log("DB connected:", res.rows[0]);
  }
});

// ===== FAKE DATABASE (replace later with real DB) =====
let users = [];
let portfolios = {};
let stockLists = {};
let friends = {};

// ===== AUTH =====
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING uid, username",
      [username, password]
    );

    res.json(result.rows[0]);   // return the created user (no password)
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already exists" });
    }

    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});


app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT uid, username FROM users WHERE username=$1 AND password=$2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid login" });
    }

    res.json(result.rows[0]);   // return user info (no password)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});


// ===== PORTFOLIOS =====
app.get("/api/portfolio/:userId", (req, res) => {
  res.json(portfolios[req.params.userId] || []);
});

app.post("/api/portfolio/:userId", (req, res) => {
  if (!portfolios[req.params.userId]) portfolios[req.params.userId] = [];
  portfolios[req.params.userId].push(req.body);
  res.json({ success: true });
});

// ===== STOCK LISTS =====
app.get("/api/stocklist/:userId", (req, res) => {
  res.json(stockLists[req.params.userId] || []);
});

app.post("/api/stocklist/:userId", (req, res) => {
  if (!stockLists[req.params.userId]) stockLists[req.params.userId] = [];
  stockLists[req.params.userId].push(req.body);
  res.json({ success: true });
});

// ===== FRIENDS =====
app.post("/api/friends/request", (req, res) => {
  const { from, to } = req.body;
  if (!friends[to]) friends[to] = [];
  friends[to].push(from);
  res.json({ sent: true });
});

app.get("/api/friends/:userId", (req, res) => {
  res.json(friends[req.params.userId] || []);
});

// ===== STOCK DATA =====
app.get("/api/stocks", (req, res) => {
  res.json([
    { ticker: "AAPL", price: 188.32 },
    { ticker: "TSLA", price: 254.18 },
    { ticker: "MSFT", price: 345.22 },
  ]);
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));
