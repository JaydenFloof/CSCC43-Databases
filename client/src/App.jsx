// App.jsx
import React, { useState, useEffect } from "react";
import UserPage from "./user"; 

const API_BASE = "http://localhost:5000/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("stocks"); // "stocks" | "stocklists" | "friends"

  // Auth
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Stocks (dummy market list)
  const [stocks, setStocks] = useState([]);

  // Stock lists
  const [ownedLists, setOwnedLists] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [newListPublic, setNewListPublic] = useState(false);

  // Active list details
  const [activeList, setActiveList] = useState(null); // { lid, list_name, is_public, owner_uid }
  const [activeListStocks, setActiveListStocks] = useState([]);
  const [stockSymbol, setStockSymbol] = useState("");
  const [stockShares, setStockShares] = useState("");

  // Reviews for active list
  const [reviews, setReviews] = useState([]);
  const [myReviewText, setMyReviewText] = useState("");
  const [myReviewId, setMyReviewId] = useState(null); // null = no existing review

  // Friends
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestUserId, setRequestUserId] = useState("");

  // ================== AUTH ==================

  const register = async () => {
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error("Registration failed");
      alert("Registered! Now log in.");
    } catch (err) {
      alert(err.message);
    }
  };

  const login = async () => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      setUser(data); // { uid, username }
    } catch (err) {
      alert(err.message);
    }
  };

  const logout = () => {
    setUser(null);
    setStocks([]);
    setOwnedLists([]);
    setSharedLists([]);
    setActiveList(null);
    setActiveListStocks([]);
    setReviews([]);
    setMyReviewId(null);
    setMyReviewText("");
    setFriends([]);
    setPendingRequests([]);
  };

  // ================== LOADERS ==================

  const loadStocks = async () => {
    try {
      const res = await fetch(`${API_BASE}/stocks`);
      if (!res.ok) throw new Error("Failed to load stocks");
      const data = await res.json();
      setStocks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStockLists = async (uid) => {
    try {
      const [ownedRes, sharedRes] = await Promise.all([
        fetch(`${API_BASE}/stocklist/owned/${uid}`),
        fetch(`${API_BASE}/stocklist/shared/${uid}`),
      ]);

      const ownedData = ownedRes.ok ? await ownedRes.json() : [];
      const sharedData = sharedRes.ok ? await sharedRes.json() : [];

      setOwnedLists(ownedData);
      setSharedLists(sharedData);
      console.log("Owned lists:", ownedData);
      console.log("Shared/Public lists:", sharedData);
    } catch (err) {
      console.error("Error loading stock lists:", err);
    }
  };

  const loadFriends = async (uid) => {
    try {
      // accepted friends
      const friendsRes = await fetch(`${API_BASE}/friends/${uid}`);
      const friendsData = friendsRes.ok ? await friendsRes.json() : [];
      setFriends(friendsData);

      // incoming pending requests
      const pendingRes = await fetch(`${API_BASE}/friends/requests/${uid}`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingRequests(pendingData);
        console.log("Pending requests:", pendingData);
      } else {
        setPendingRequests([]);
      }
    } catch (e) {
      console.warn("Error loading friends/pending requests", e);
    }
  };

  const loadListStocks = async (lid) => {
    try {
      const res = await fetch(`${API_BASE}/stocklist/stocks/${lid}`);
      if (!res.ok) throw new Error("Failed to load stocks in list");
      const data = await res.json();
      setActiveListStocks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadListReviews = async (lid, uid) => {
    try {
      const res = await fetch(`${API_BASE}/reviews/${lid}`);
      if (!res.ok) {
        setReviews([]);
        setMyReviewId(null);
        setMyReviewText("");
        return;
      }
      const data = await res.json();
      setReviews(data);

      // Find this user's review (if any)
      const mine = data.find((r) => r.reviewer_uid === uid);
      if (mine) {
        setMyReviewId(mine.rid);
        setMyReviewText(mine.text || "");
      } else {
        setMyReviewId(null);
        setMyReviewText("");
      }
    } catch (err) {
      console.error(err);
      setReviews([]);
      setMyReviewId(null);
      setMyReviewText("");
    }
  };

  useEffect(() => {
    if (user) {
      loadStocks();
      loadStockLists(user.uid);
      loadFriends(user.uid);
    }
  }, [user]);

  // ================== ACTIVE LIST ==================

  const openList = async (list) => {
    setActiveList(list);
    setStockSymbol("");
    setStockShares("");
    setMyReviewText("");

    await loadListStocks(list.lid);
    await loadListReviews(list.lid, user.uid);
  };

  const closeActiveList = () => {
    setActiveList(null);
    setActiveListStocks([]);
    setReviews([]);
    setStockSymbol("");
    setStockShares("");
    setMyReviewId(null);
    setMyReviewText("");
  };

  // ================== STOCK LIST ACTIONS ==================

  const createStockList = async () => {
    if (!newListName.trim()) {
      alert("List name required");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/stocklist/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_name: newListName,
          is_public: newListPublic,
        }),
      });

      if (!res.ok) throw new Error("Failed to create stock list");
      await res.json();

      await loadStockLists(user.uid);
      setNewListName("");
      setNewListPublic(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const deleteStockList = async (lid) => {
    if (!window.confirm("Delete this list?")) return;
    try {
      const res = await fetch(`${API_BASE}/stocklist/${user.uid}/${lid}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete stock list");

      await loadStockLists(user.uid);
      if (activeList && activeList.lid === lid) {
        closeActiveList();
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // ----- Stocks inside an active list -----

  const addStockToActiveList = async () => {
    if (!activeList) return alert("No list selected");
    if (!stockSymbol.trim()) return alert("Enter a stock symbol");
    if (stockShares === "" || isNaN(Number(stockShares)))
      return alert("Enter a valid number of shares");

    try {
      const res = await fetch(`${API_BASE}/stocklist/add/${activeList.lid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: stockSymbol,
          shares: Number(stockShares),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add stock");
      }

      await loadListStocks(activeList.lid);
      setStockSymbol("");
      setStockShares("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const updateStockInActiveList = async () => {
    if (!activeList) return alert("No list selected");
    if (!stockSymbol.trim()) return alert("Enter a stock symbol");
    if (stockShares === "" || isNaN(Number(stockShares)))
      return alert("Enter a valid number of shares");

    try {
      const res = await fetch(
        `${API_BASE}/stocklist/update/${activeList.lid}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: stockSymbol,
            shares: Number(stockShares),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update stock");
      }

      await loadListStocks(activeList.lid);
      setStockSymbol("");
      setStockShares("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const deleteStockFromActiveList = async (symbol) => {
    if (!activeList) return;
    if (!window.confirm(`Remove ${symbol} from this list?`)) return;
    try {
      const res = await fetch(
        `${API_BASE}/stocklist/delete/${activeList.lid}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete stock");
      }

      await loadListStocks(activeList.lid);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // ================== REVIEWS ==================

  const submitMyReview = async () => {
    if (!activeList) return alert("No list selected");
    if (!myReviewText.trim()) return alert("Review cannot be empty");
    if (myReviewText.length > 4000)
      return alert("Review must be at most 4000 characters");

    try {
      let res;
      if (myReviewId) {
        // edit existing
        res = await fetch(`${API_BASE}/reviews/${myReviewId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            text: myReviewText,
          }),
        });
      } else {
        // create new
        res = await fetch(`${API_BASE}/reviews/${activeList.lid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            text: myReviewText,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit review");
      }

      await loadListReviews(activeList.lid, user.uid);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const deleteReview = async (rid) => {
    if (!activeList) return;
    if (!window.confirm("Delete this review?")) return;

    try {
      const res = await fetch(`${API_BASE}/reviews/${rid}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete review");
      }

      await loadListReviews(activeList.lid, user.uid);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // ================== FRIENDS ==================

  const sendFriendRequest = async () => {
    const target = requestUserId.trim();
    if (!target) return alert("Enter user ID to send request to");

    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reqUser: user.uid,
          resUser: Number(target),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send request");
      }

      alert("Friend request sent!");
      setRequestUserId("");
      await loadFriends(user.uid);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const respondFriendRequest = async (requesterUid, accept) => {
    try {
      const res = await fetch(`${API_BASE}/friends/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reqUser: requesterUid,
          resUser: user.uid,
          response: accept,
        }),
      });

      if (!res.ok) throw new Error("Failed to respond to request");

      await loadFriends(user.uid);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // ================== RENDER HELPERS ==================

  const renderAuth = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: 250,
        gap: 8,
      }}
    >
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ padding: 6 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 6 }}
      />
      <button onClick={register}>Register</button>
      <button onClick={login}>Login</button>
    </div>
  );

  const renderNav = () => (
    <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
      <button
        onClick={() => setView("stocks")}
        style={{ fontWeight: view === "stocks" ? "bold" : "normal" }}
      >
        Stocks
      </button>
      <button
        onClick={() => setView("stocklists")}
        style={{ fontWeight: view === "stocklists" ? "bold" : "normal" }}
      >
        Stock Lists
      </button>
      <button
        onClick={() => setView("friends")}
        style={{ fontWeight: view === "friends" ? "bold" : "normal" }}
      >
        Friends
      </button>
      <div style={{ marginLeft: "auto" }}>
        Logged in as <strong>{user.username}</strong>{" "}
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );

  const renderStocksView = () => (
    <div>
      <h3>Stocks</h3>
      {stocks.map((s) => (
        <div key={s.ticker}>
          {s.ticker} – ${s.price ?? s.close}
        </div>
      ))}

      {/* Partner's UserPage component from the old App.js */}
      <div style={{ marginTop: 24 }}>
        <UserPage user={user} />
      </div>
    </div>
  );

  const renderActiveListDetails = () => {
    if (!activeList) return null;

    return (
      <div
        style={{
          marginTop: 24,
          padding: 12,
          border: "1px solid #ccc",
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3>
            List #{activeList.lid} – {activeList.list_name}{" "}
            {activeList.is_public ? <em>(public)</em> : <em>(private)</em>}
          </h3>
          <button onClick={closeActiveList}>Close</button>
        </div>

        {/* Stocks in list */}
        <h4>Stocks in this list</h4>
        {activeListStocks.length === 0 && <div>No stocks yet.</div>}
        {activeListStocks.map((s) => (
          <div
            key={s.symbol}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span>
              {s.symbol} – {s.shares} shares
            </span>
            <button
              onClick={() => {
                setStockSymbol(s.symbol);
                setStockShares(String(s.shares));
              }}
            >
              Edit
            </button>
            {(user.uid === activeList.owner_uid || user.uid === user.uid) && (
              <button onClick={() => deleteStockFromActiveList(s.symbol)}>
                Delete
              </button>
            )}
          </div>
        ))}

        {/* Add / Update stock form */}
        {user.uid === activeList.owner_uid && (
          <>
            <h4 style={{ marginTop: 16 }}>Add / Update Stock</h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxWidth: 300,
              }}
            >
              <input
                type="text"
                placeholder="Symbol (e.g. AAPL)"
                value={stockSymbol}
                onChange={(e) => setStockSymbol(e.target.value)}
              />
              <input
                type="number"
                placeholder="Shares"
                value={stockShares}
                onChange={(e) => setStockShares(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addStockToActiveList}>Add</button>
                <button onClick={updateStockInActiveList}>Update</button>
              </div>
            </div>
          </>
        )}

        {/* Reviews */}
        <h4 style={{ marginTop: 24 }}>Reviews</h4>
        {reviews.length === 0 && <div>No reviews yet.</div>}
        {reviews.map((r) => {
          const canDelete =
            r.reviewer_uid === user.uid || activeList.owner_uid === user.uid;
          return (
            <div
              key={r.rid ?? `${r.reviewer_uid}-${r.timestamp}`}
              style={{
                marginBottom: 8,
                padding: 8,
                border: "1px solid #eee",
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                By user {r.reviewer_uid} at{" "}
                {r.timestamp
                  ? new Date(r.timestamp).toLocaleString()
                  : "unknown time"}
              </div>
              <div>{r.text}</div>
              {canDelete && (
                <button
                  style={{ marginTop: 4 }}
                  onClick={() => deleteReview(r.rid)}
                >
                  Delete review
                </button>
              )}
            </div>
          );
        })}

        {/* My review editor */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxWidth: 400,
          }}
        >
          <h5>
            {myReviewId ? "Edit your review" : "Leave a review for this list"}
          </h5>
          <textarea
            placeholder="Write your review..."
            value={myReviewText}
            onChange={(e) => setMyReviewText(e.target.value)}
            rows={3}
          />
          <button onClick={submitMyReview}>
            {myReviewId ? "Update Review" : "Submit Review"}
          </button>
        </div>
      </div>
    );
  };

  const renderStockListsView = () => (
    <div>
      <h3>Your Stock Lists</h3>
      {ownedLists.length === 0 && <div>No lists yet.</div>}
      {ownedLists.map((l) => (
        <div
          key={l.lid}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span>
            #{l.lid} — {l.list_name}{" "}
            {l.is_public ? <em>(public)</em> : <em>(private)</em>}
          </span>
          <button onClick={() => openList(l)}>Open</button>
          <button onClick={() => deleteStockList(l.lid)}>Delete</button>
        </div>
      ))}

      <h4 style={{ marginTop: 16 }}>Create new list</h4>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 300,
        }}
      >
        <input
          type="text"
          placeholder="List name"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={newListPublic}
            onChange={(e) => setNewListPublic(e.target.checked)}
          />{" "}
          Public list
        </label>
        <button onClick={createStockList}>Create</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Shared With You / Public</h3>
      {sharedLists.length === 0 && <div>No shared/public lists available.</div>}
      {sharedLists.map((l) => (
        <div
          key={l.lid}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span>
            #{l.lid} — {l.list_name}{" "}
            {l.is_public ? <em>(public)</em> : <em>(shared)</em>}
          </span>
          <button onClick={() => openList(l)}>Open</button>
        </div>
      ))}

      {renderActiveListDetails()}
    </div>
  );

  const renderFriendsView = () => (
    <div>
      <h3>Your Friends</h3>
      {friends.length === 0 && <div>No friends yet.</div>}
      {friends.map((f) => (
        <div key={f.uid}>
          {f.uid}: {f.username}
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Incoming Requests</h3>
      {pendingRequests.length === 0 && <div>No pending requests.</div>}
      {pendingRequests.map((r) => (
        <div key={r.uid} style={{ marginBottom: 4 }}>
          {r.uid}: {r.username}{" "}
          <button onClick={() => respondFriendRequest(r.uid, true)}>
            Accept
          </button>
          <button onClick={() => respondFriendRequest(r.uid, false)}>
            Reject
          </button>
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Send Friend Request</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Target user ID"
          value={requestUserId}
          onChange={(e) => setRequestUserId(e.target.value)}
        />
        <button onClick={sendFriendRequest}>Send</button>
      </div>
    </div>
  );

  // ================== MAIN RENDER ==================

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Stock App</h1>

      {!user && renderAuth()}

      {user && (
        <>
          {renderNav()}
          {view === "stocks" && renderStocksView()}
          {view === "stocklists" && renderStockListsView()}
          {view === "friends" && renderFriendsView()}
        </>
      )}
    </div>
  );
}
