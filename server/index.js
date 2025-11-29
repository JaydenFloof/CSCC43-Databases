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
// app.get("/api/portfolio/:userId", (req, res) => {
//   res.json(portfolios[req.params.userId] || []);
// });
// Get all the portfolio
app.get("/api/portfolio/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    const result = await pool.query(
      `
        SELECT
        p.pid,
        ca.value
        FROM portfolio p
        LEFT JOIN cash_account ca ON ca.pid = p.pid
        WHERE p.owner_uid = $1
        ORDER BY p.pid;
      `,
      [uid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch portfolios" });
  }
});

// app.post("/api/portfolio/:userId", (req, res) => {
//   if (!portfolios[req.params.userId]) portfolios[req.params.userId] = [];
//   portfolios[req.params.userId].push(req.body);
//   res.json({ success: true });
// });

// Post new portfolio to user with userId
app.post("/api/portfolio/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    const result = await pool.query(
      `
        INSERT INTO portfolio (owner_uid)
        VALUES ($1)
        RETURNING pid
      `,
      [uid]
    );
    console.log(result.rows);
    res.json({ pid: result.rows[0].pid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create portfolio" });
  }
});

// Get portfolio info (symbol, number of shares) from stock holding by pid
app.get("/api/holdings/:pid", async (req, res) => {
  const pid = req.params.pid;
  try {
    const result = await pool.query(
      "SELECT symbol, number_of_shares FROM stock_holding WHERE pid = $1",
      [pid]
    );
    res.json(result.rows); // returns array of { symbol, number_of_shares }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});


// Add stock holding by pid  
app.post("/api/holdings/:pid", async (req, res) => {
  const { pid } = req.params;
  const { symbol, shares } = req.body;
  try {
    await pool.query(`
      INSERT INTO stock_holding (pid, symbol, number_of_shares)
      VALUES ($1,$2,$3)
      ON CONFLICT (pid, symbol)
      DO UPDATE SET number_of_shares = stock_holding.number_of_shares + EXCLUDED.number_of_shares
    `, [pid, symbol, shares]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add stock to portfolio" });
  }
});


// Cash Account
// get all the cash account of a user with uid
app.get("/api/cash/user/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query(
      `
        SELECT ca.value
        FROM cash_account ca
        JOIN portfolio p ON p.pid = ca.pid
        WHERE p.owner_uid = $1
      `,
      [uid]
    );
    res.json(result.rows); // array of cash accounts (pid + value)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user's cash accounts" });
  }
});

// get the cash value of a portfolio with pid
app.get("/api/cash/portfolio/:pid", async (req, res) => {
  const { pid } = req.params;
  try {
    const result = await pool.query(
      `
        SELECT ca.value
        FROM cash_account ca
        JOIN portfolio p ON p.pid = ca.pid
        WHERE p.pid = $1
      `,
      [pid]
    );
    res.json(result.rows[0]); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user's cash accounts" });
  }
});

// Create new cash account by pid
app.post("/api/cash/:pid", async (req, res) => {
  const { pid } = req.params;
  const { value } = req.body; // initial value

  try {
    const result = await pool.query(
      `
        INSERT INTO cash_account (pid, value)
        VALUES ($1, $2)
        RETURNING pid, value
      `,
      [pid, value]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create cash account" });
  }
});

// transaction in cash account by pid
// also will insert to transaction table.
app.post("/api/cash/update/:pid", async (req, res) => {
  const { pid } = req.params;
  const { amount, transaction_type } = req.body; // transaction_type required
  try {
    // 1️⃣ Update cash account
    const cashResult = await pool.query(
      `
        UPDATE cash_account
        SET value = value + $1
        WHERE pid = $2
        RETURNING pid, value
      `,
      [amount, pid]
    );
    if (cashResult.rows.length === 0) {
      return res.status(404).json({ error: "Cash account not found" });
    }
    //Insert transaction record
    await pool.query(
      `
        INSERT INTO transaction (pid, amount, transaction_type, shares)
        VALUES ($1, $2, $3, NULL)
      `,
      [pid, amount, transaction_type]
    );
    res.json(cashResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cash account" });
  }
});

//delete
app.delete("/api/portfolio/:pid", async (req, res) => {
  const { pid } = req.params;
  try {
    const result = await pool.query(
      `
        DELETE FROM portfolio
        WHERE pid = $1
        RETURNING pid
      `,
      [pid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete portfolio" });
  }
});

app.delete("/api/cash/:pid", async (req, res) => {
  const { pid } = req.params;
  try {
    const result = await pool.query(
      `
        DELETE FROM cash_account
        WHERE pid = $1
        RETURNING pid
      `,
      [pid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cash account not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete cash account" });
  }
});

app.delete("/api/stock/:pid/:symbol", async (req, res) => {
  const { pid, symbol } = req.params;
  try {
    const result = await pool.query(
      `
        DELETE FROM stock_holding
        WHERE pid = $1 AND symbol = $2
        RETURNING pid, symbol
      `,
      [pid, symbol]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Stock not found in portfolio" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete stock" });
  }
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
