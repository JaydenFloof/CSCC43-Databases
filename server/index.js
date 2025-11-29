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

// ===== AUTH =====
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING uid, username",
      [username, password]
    );

    res.json(result.rows[0]); // return the created user (no password)
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

    res.json(result.rows[0]); // return user info (no password)
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

//portfolio cv
app.get("/api/portfolio/:pid/cv", async (req, res) => {
  const { pid } = req.params;
  const { start, end } = req.query;

  try {
    const result = await pool.query(`
      WITH stock_returns AS (
        SELECT
          symbol,
          timestamp::date AS day,
          (close - LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp))
            / LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp) AS stock_return
        FROM stocks
        WHERE timestamp BETWEEN $2 AND $3
      )

      SELECT
        sr.symbol,
        STDDEV_SAMP(sr.stock_return) / NULLIF(AVG(sr.stock_return),0) AS cv
      FROM stock_returns sr
      JOIN stock_holding sh ON sr.symbol = sh.symbol
      WHERE sh.pid = $1
        AND sr.stock_return IS NOT NULL
      GROUP BY sr.symbol
      ORDER BY sr.symbol;
    `, [pid, start, end]);

    res.json(result.rows);
  } catch (err) {
    console.error("Portfolio CV error:", err);
    res.status(500).json({ error: "Failed to compute portfolio CV" });
  }
});


// portfolio beta
app.get("/api/portfolio/:pid/beta", async (req, res) => {
  const { pid } = req.params;
  const { start, end } = req.query;

  try {
    const result = await pool.query(`
      WITH stock_returns AS (
        SELECT
          symbol,
          timestamp::date AS day,
          (close - LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp))
            / LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp) AS stock_return
        FROM stocks
        WHERE timestamp BETWEEN $2 AND $3
      ),

      market_returns AS (
        SELECT
          day,
          AVG(stock_return) AS market_return
        FROM stock_returns
        WHERE stock_return IS NOT NULL
        GROUP BY day
      ),

      joined AS (
        SELECT
          s.symbol,
          s.day,
          s.stock_return,
          m.market_return
        FROM stock_returns s
        JOIN market_returns m
          ON s.day = m.day
        WHERE s.stock_return IS NOT NULL
      )

      SELECT
        j.symbol,
        COVAR_SAMP(j.stock_return, j.market_return)
          / VAR_SAMP(j.market_return) AS beta
      FROM joined j
      JOIN stock_holding sh ON j.symbol = sh.symbol
      WHERE sh.pid = $1
      GROUP BY j.symbol
      ORDER BY j.symbol;
    `, [pid, start, end]);

    res.json(result.rows);
  } catch (err) {
    console.error("Portfolio beta error:", err);
    res.status(500).json({ error: "Failed to compute portfolio beta" });
  }
});



// ===== STOCK LISTS =====

// Get stock lists owned by user
app.get("/api/stocklist/owned/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    const result = await pool.query(
      "SELECT lid, list_name, is_public, owner_uid FROM stock_lists WHERE owner_uid = $1 ORDER BY lid;",
      [uid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve stock lists" });
  }
});

// Get stock lists user has access to (shared or public lists)
app.get("/api/stocklist/shared/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    const result = await pool.query(
      "SELECT DISTINCT list.lid, list.list_name, list.is_public, list.owner_uid FROM stock_lists AS list LEFT JOIN user_shares_stock_list AS shared ON shared.lid = list.lid AND shared.shared_uid = $1 WHERE list.is_public = TRUE OR shared.shared_uid = $1 ORDER BY list.lid",
      [uid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve shared stock lists" });
  }
});

// Create new empty stocklist for user
app.post("/api/stocklist/:userId", async (req, res) => {
  const uid = req.params.userId;
  const { list_name, is_public } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO stock_lists(list_name, is_public, owner_uid) VALUES ($1, $2, $3) RETURNING lid, list_name, is_public, owner_uid",
      [list_name, is_public, uid]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create new stock list" });
  }
});

// Delete stocks from a list
app.delete("/api/stocklist/delete/:listId", async (req, res) => {
  const lid = req.params.listId;
  const { symbol } = req.body;
  try {
    const result = await pool.query(
      "DELETE FROM listing WHERE lid = $1 AND symbol = $2 RETURNING lid, symbol",
      [lid, symbol]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove stock from list" });
  }
});

// Delete a stocklist
app.delete("/api/stocklist/:userId/:listId", async (req, res) => {
  const userId = req.params.userId;
  const listId = req.params.listId;

  console.log("got params ", userId, listId);

  try {
    const result = await pool.query(
      "DELETE FROM stock_lists WHERE lid = $1 AND owner_uid = $2 RETURNING lid",
      [listId, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete stock list" });
  }
});

// Get stocks inside of a current stock list
app.get("/api/stocklist/stocks/:listId", async (req, res) => {
  const lid = req.params.listId;
  try {
    const result = await pool.query(
      "SELECT symbol, shares FROM listing WHERE lid = $1 ORDER BY symbol",
      [lid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve stocks in list" });
  }
});

// Add stocks to a list
app.post("/api/stocklist/add/:listId", async (req, res) => {
  const lid = req.params.listId;
  const { symbol, shares } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO listing (lid, symbol, shares) VALUES ($1, $2, $3) RETURNING lid, symbol, shares",
      [lid, symbol, shares]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add stocks to list" });
  }
});

// Update stock in a list
app.post("/api/stocklist/update/:listId", async (req, res) => {
  const lid = req.params.listId;
  const { symbol, shares } = req.body;
  try {
    const result = await pool.query(
      "UPDATE listing SET shares = $3 WHERE lid = $1 AND symbol = $2 RETURNING lid, symbol, shares",
      [lid, symbol, shares]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add stocks to list" });
  }
});

// ===== REVIEWS =====

// Create new review attached to list
app.post("/api/reviews/:listId", async (req, res) => {
  const listId = req.params.listId;
  const { uid, text } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO reviews (reviewer_uid, text, lid) VALUES ($1, $2, $3) RETURNING rid, reviewer_uid, text, timestamp, lid",
      [uid, text, listId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Get all reviews for a given stock list
app.get("/api/reviews/:listId", async (req, res) => {
  const listId = req.params.listId;

  try {
    const result = await pool.query(
      "SELECT rid, reviewer_uid, text, timestamp, lid FROM reviews WHERE lid = $1 ORDER BY timestamp DESC",
      [listId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get reviews" });
  }
});

// Delete a review (only review or list owner)
app.delete("/api/reviews/:rid", async (req, res) => {
  const rid = req.params.rid;
  const { uid } = req.body;

  try {
    const existing = await pool.query(
      "SELECT reviews.rid FROM reviews JOIN stock_lists AS list ON reviews.lid = list.lid WHERE reviews.rid = $1 AND (reviews.reviewer_uid = $2 OR list.owner_uid = $2)",
      [rid, uid]
    );

    if (existing.rows.length === 0) {
      return res.status(401).json({ error: "Cannot delete review" });
    }

    const result = await pool.query(
      "DELETE FROM reviews WHERE rid = $1 RETURNING rid, reviewer_uid, text, timestamp, lid",
      [rid]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// Edit a review (only review owner)
app.post("/api/reviews/:rid", async (req, res) => {
  const rid = req.params.rid;
  const { uid, text } = req.body;

  try {
    const existing = await pool.query(
      "SELECT reviews.rid FROM reviews JOIN stock_lists AS list ON reviews.lid = list.lid WHERE reviews.rid = $1 AND reviews.reviewer_uid = $2",
      [rid, uid]
    );

    if (existing.rows.length === 0) {
      return res.status(401).json({ error: "Cannot edit review" });
    }

    const result = await pool.query(
      "UPDATE reviews SET text = $1 WHERE rid = $2 RETURNING rid, reviewer_uid, text, timestamp, lid",
      [rid, text]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to edit review" });
  }
});

// ===== FRIENDS =====

// Send friend request
app.post("/api/friends/request", async (req, res) => {
  const { reqUser, resUser } = req.body;
  try {
    const existing = await pool.query(
      "SELECT * FROM friend_request WHERE ((requester_uid = $1 AND responder_uid = $2) OR (requester_uid = $2 AND responder_uid = $1)) AND is_accepted IS NULL",
      [reqUser, resUser]
    );

    if (existing.rows.length !== 0) {
      return res.status(401).json({ error: "Friend request already pending" });
    }

    const result = await pool.query(
      "INSERT INTO friend_request (requester_uid, responder_uid, is_accepted) VALUES ($1, $2, NULL) RETURNING requester_uid, responder_uid, is_accepted, send_time",
      [reqUser, resUser]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// Accept/Deny friend request
app.post("/api/friends/respond", async (req, res) => {
  const { reqUser, resUser, response } = req.body;
  try {
    const result = await pool.query(
      "UPDATE friend_request SET is_accepted = $3 WHERE requester_uid = $1 AND responder_uid = $2 AND is_accepted IS NULL RETURNING requester_uid, responder_uid, is_accepted, send_time",
      [reqUser, resUser, response]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// Get all current friends
app.get("/api/friends/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    // case for requester or responder uid
    const result = await pool.query(
      "SELECT users.uid, users.username FROM users JOIN friend_request AS req ON users.uid = CASE WHEN req.requester_uid = $1 THEN req.responder_uid ELSE req.requester_uid END WHERE ((req.requester_uid = $1) OR (req.responder_uid = $1)) AND req.is_accepted = TRUE",
      [uid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// Get all current friend requests (pending)
app.get("/api/friends/requests/:userId", async (req, res) => {
  const uid = req.params.userId;
  try {
    const result = await pool.query(
      "SELECT users.uid, users.username, req.send_time FROM users JOIN friend_request AS req ON users.uid = req.requester_uid WHERE req.responder_uid = $1 AND req.is_accepted IS NULL",
      [uid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
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
