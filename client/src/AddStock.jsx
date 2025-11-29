import React, { useState } from "react";

const API_BASE = "http://localhost:5000/api";

export default function AddStockForm({ onAdded }) {
  const [timestamp, setTimestamp] = useState(""); // e.g. 2018-02-07
  const [symbol, setSymbol] = useState("");
  const [open, setOpen] = useState("");
  const [high, setHigh] = useState("");
  const [low, setLow] = useState("");
  const [close, setClose] = useState("");
  const [volume, setVolume] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!timestamp || !symbol) {
      setError("Timestamp and symbol are required");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/stocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp, // "2018-02-07" is fine; Postgres will cast to timestamp
          symbol: symbol.toUpperCase(),
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to add stock");
      }

      const data = await res.json();
      if (onAdded) onAdded(data); // let parent refresh list if it wants
      // clear form
      setTimestamp("");
      setSymbol("");
      setOpen("");
      setHigh("");
      setLow("");
      setClose("");
      setVolume("");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 10, border: "1px solid #ddd" }}>
      <h4>Add New Stock Row</h4>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxWidth: 320,
        }}
      >
        <input
          type="date"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          placeholder="Timestamp (YYYY-MM-DD)"
        />
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol (e.g. AAPL)"
        />
        <input
          type="number"
          step="0.01"
          value={open}
          onChange={(e) => setOpen(e.target.value)}
          placeholder="Open"
        />
        <input
          type="number"
          step="0.01"
          value={high}
          onChange={(e) => setHigh(e.target.value)}
          placeholder="High"
        />
        <input
          type="number"
          step="0.01"
          value={low}
          onChange={(e) => setLow(e.target.value)}
          placeholder="Low"
        />
        <input
          type="number"
          step="0.01"
          value={close}
          onChange={(e) => setClose(e.target.value)}
          placeholder="Close"
        />
        <input
          type="number"
          step="1"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          placeholder="Volume"
        />

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add Stock"}
        </button>
      </form>
    </div>
  );
}
