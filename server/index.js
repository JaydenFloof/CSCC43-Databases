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

// ===== FAKE DATABASE =====
let users = [];
let portfolios = {};
// let stockLists = {};
// let friends = {};

// ===== AUTH =====
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING uid, username",
      [username, password]
    );

    res.json(result.rows[0]);
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

    res.json(result.rows[0]);
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
// app.get("/api/holdings/:pid", async (req, res) => {
//   const pid = req.params.pid;
//   try {
//     const result = await pool.query(
//       "SELECT symbol, number_of_shares FROM stock_holding WHERE pid = $1",
//       [pid]
//     );
//     res.json(result.rows); // returns array of { symbol, number_of_shares }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch stocks" });
//   }
// });

// Also fetch last close price
app.get("/api/holdings/:pid", async (req, res) => {
  const pid = req.params.pid;
  try {
    const result = await pool.query(
      `
      SELECT
        h.symbol,
        h.number_of_shares,
        s.close AS last_close
      FROM stock_holding h
      LEFT JOIN LATERAL(
        SELECT close
        FROM stocks s
        WHERE s.symbol = h.symbol
        ORDER BY "timestamp" DESC
        LIMIT 1
      ) s ON TRUE
      WHERE h.pid = $1
      `,
      [pid]
    );

    res.json(result.rows);
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
    await pool.query(
      `
      INSERT INTO stock_holding (pid, symbol, number_of_shares)
      VALUES ($1,$2,$3)
      ON CONFLICT (pid, symbol)
      DO UPDATE SET number_of_shares = stock_holding.number_of_shares + EXCLUDED.number_of_shares
    `,
      [pid, symbol, shares]
    );

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
    res.json(result.rows);
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
  const { value } = req.body;

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

// transaction in cash account by pid also will insert to transaction table.
app.post("/api/cash/update/:pid", async (req, res) => {
  const { pid } = req.params;
  const { amount, transaction_type } = req.body;
  try {
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

// Remove a friend
app.delete("/api/friends/:userId/:friendId", async (req, res) => {
  const { userId, friendId } = req.params;

  try {
    const result = await pool.query(
      `
      DELETE FROM friend_request
      WHERE
        ((requester_uid = $1 AND responder_uid = $2)
         OR
         (requester_uid = $2 AND responder_uid = $1))
        AND is_accepted = TRUE
      RETURNING requester_uid, responder_uid, is_accepted, send_time
      `,
      [userId, friendId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    res.json({ success: true, removed: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// ===== STOCK PREDICTION =====

// Predict future value of stock with linear regression
app.get("/api/stocks/predict/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  const days = parseInt(req.query.days || "5", 10);

  if (!days || days <= 0) {
    return res.status(400).json({ error: "Days must be a positive integer" });
  }

  try {
    const result = await pool.query(
      `
      SELECT "timestamp" AS date, close
      FROM stocks
      WHERE symbol = $1
      ORDER BY "timestamp" ASC
      `,
      [symbol]
    );

    const rows = result.rows;

    if (rows.length < 2) {
      return res.status(400).json({ error: "Not enough data for prediction" });
    }

    const n = rows.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    rows.forEach((row, idx) => {
      const x = idx + 1;
      const y = Number(row.close);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const denom = n * sumX2 - sumX * sumX;
    let slope = 0;
    let intercept = rows[n - 1].close;

    if (denom !== 0) {
      slope = (n * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / n;
    }

    const lastDate = new Date(rows[n - 1].date);

    const predictions = [];
    for (let i = 1; i <= days; i++) {
      const futureIndex = n + i;
      const predictedClose = intercept + slope * futureIndex;

      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);

      predictions.push({
        date: d.toISOString().slice(0, 10),
        predicted_close: Number(predictedClose.toFixed(2)),
      });
    }

    res.json({
      symbol,
      history: rows,
      predictions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to predict stock prices" });
  }
});
// ===== PORTFOLIO COEFFICIENT OF VARIATION (CV) =====
app.get("/api/portfolio/:pid/cv", async (req, res) => {
  const { pid } = req.params;
  let { start, end } = req.query;

  try {
    let query;
    let params;

    if (start && end) {
      // Use date filter
      query = `
        WITH stock_returns AS (
          SELECT
            symbol,
            "timestamp"::date AS day,
            (close - LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp"))
              / LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp") AS stock_return
          FROM stocks
          WHERE "timestamp" BETWEEN $2 AND $3
        )
        SELECT
          sr.symbol,
          STDDEV_SAMP(sr.stock_return) / NULLIF(AVG(sr.stock_return), 0) AS cv
        FROM stock_returns sr
        JOIN stock_holding sh ON sr.symbol = sh.symbol
        WHERE sh.pid = $1
          AND sr.stock_return IS NOT NULL
        GROUP BY sr.symbol
        ORDER BY sr.symbol;
      `;
      params = [pid, start, end];
    } else {
      // No date filter – use entire history
      query = `
        WITH stock_returns AS (
          SELECT
            symbol,
            "timestamp"::date AS day,
            (close - LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp"))
              / LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp") AS stock_return
          FROM stocks
        )
        SELECT
          sr.symbol,
          STDDEV_SAMP(sr.stock_return) / NULLIF(AVG(sr.stock_return), 0) AS cv
        FROM stock_returns sr
        JOIN stock_holding sh ON sr.symbol = sh.symbol
        WHERE sh.pid = $1
          AND sr.stock_return IS NOT NULL
        GROUP BY sr.symbol
        ORDER BY sr.symbol;
      `;
      params = [pid];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Portfolio CV error:", err);
    res.status(500).json({ error: "Failed to compute portfolio CV" });
  }
});

// ===== PORTFOLIO BETA =====
app.get("/api/portfolio/:pid/beta", async (req, res) => {
  const { pid } = req.params;
  let { start, end } = req.query;

  try {
    let query;
    let params;

    if (start && end) {
      // Use date filter
      query = `
        WITH stock_returns AS (
          SELECT
            symbol,
            "timestamp"::date AS day,
            (close - LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp"))
              / LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp") AS stock_return
          FROM stocks
          WHERE "timestamp" BETWEEN $2 AND $3
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
      `;
      params = [pid, start, end];
    } else {
      // No date filter – use entire history
      query = `
        WITH stock_returns AS (
          SELECT
            symbol,
            "timestamp"::date AS day,
            (close - LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp"))
              / LAG(close) OVER (PARTITION BY symbol ORDER BY "timestamp") AS stock_return
          FROM stocks
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
      `;
      params = [pid];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Portfolio beta error:", err);
    res.status(500).json({ error: "Failed to compute portfolio beta" });
  }
});

// ===== COVARIANCE / CORRELATION MATRIX =====
app.get("/api/portfolio/:pid/matrix", async (req, res) => {
  const { pid } = req.params;
  let { type, start, end } = req.query;

  if (!type) type = "COVAR_POP";

  if (type !== "COVAR_POP" && type !== "CORR") {
    return res
      .status(400)
      .json({ error: "Invalid type, use COVAR_POP or CORR" });
  }

  try {
    const symbolsRes = await pool.query(
      `SELECT DISTINCT symbol
       FROM stock_holding
       WHERE pid = $1
       ORDER BY symbol`,
      [pid]
    );

    if (symbolsRes.rows.length === 0) {
      return res.status(200).json({
        message: "No stocks held in this portfolio",
        symbols: [],
        matrix: [],
      });
    }

    const symbols = symbolsRes.rows.map((r) => r.symbol);
    const useDates = start && end;
    const matrix = [];

    for (let i = 0; i < symbols.length; i++) {
      const row = [];
      for (let j = 0; j < symbols.length; j++) {
        let query;
        let params;

        if (useDates) {
          query = `
            SELECT ${type}(s1.close, s2.close) AS value
            FROM stocks s1
            JOIN stocks s2
              ON s1."timestamp" = s2."timestamp"
            WHERE s1.symbol = $1
              AND s2.symbol = $2
              AND s1."timestamp" BETWEEN $3 AND $4
          `;
          params = [symbols[i], symbols[j], start, end];
        } else {
          query = `
            SELECT ${type}(s1.close, s2.close) AS value
            FROM stocks s1
            JOIN stocks s2
              ON s1."timestamp" = s2."timestamp"
            WHERE s1.symbol = $1
              AND s2.symbol = $2
          `;
          params = [symbols[i], symbols[j]];
        }

        const result = await pool.query(query, params);
        row.push(result.rows[0].value);
      }
      matrix.push(row);
    }

    return res.status(200).json({
      type,
      symbols,
      matrix,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compute matrix" });
  }
});

// ===== STOCK DATA (from DB) =====
app.get("/api/stocks", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT "timestamp", open, high, low, close, volume, symbol
      FROM stocks
      ORDER BY "timestamp" DESC
      LIMIT 10
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch stocks:", err);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

// ===== ADD NEW STOCK ROW =====
app.post("/api/stocks", async (req, res) => {
  const { timestamp, open, high, low, close, volume, symbol } = req.body;

  if (
    !timestamp ||
    open === undefined ||
    high === undefined ||
    low === undefined ||
    close === undefined ||
    volume === undefined ||
    !symbol
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO stocks ("timestamp", open, high, low, close, volume, symbol)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "timestamp", open, high, low, close, volume, symbol
      `,
      [timestamp, open, high, low, close, volume, symbol]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to insert stock:", err);
    res.status(500).json({ error: "Failed to insert stock" });
  }
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));
