// PortfolioStats.jsx
import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:5000/api";

export default function PortfolioStats({
  defaultSymbol = "",
  defaultPid = "",
}) {
  // ===== Prediction state =====
  const [predictionSymbol, setPredictionSymbol] = useState(defaultSymbol);
  const [predictionDays, setPredictionDays] = useState(5);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [predictionFuture, setPredictionFuture] = useState([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  // ===== Matrix state =====
  const [matrixPid, setMatrixPid] = useState(defaultPid);
  const [matrixType, setMatrixType] = useState("COVAR_POP"); // or "CORR"
  const [matrixSymbols, setMatrixSymbols] = useState([]);
  const [matrixValues, setMatrixValues] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState("");

  // keep props in sync if user switches portfolios / symbols
  useEffect(() => {
    setPredictionSymbol(defaultSymbol);
  }, [defaultSymbol]);

  useEffect(() => {
    setMatrixPid(defaultPid);
  }, [defaultPid]);

  // ---------- PREDICTION ACTIONS ----------

  const fetchPrediction = async () => {
    const sym = predictionSymbol.trim().toUpperCase();
    const days = parseInt(predictionDays, 10);

    if (!sym) {
      alert("Enter a stock symbol");
      return;
    }
    if (!days || days <= 0) {
      alert("Days must be a positive integer");
      return;
    }

    try {
      setPredictionLoading(true);
      setPredictionError("");
      const res = await fetch(
        `${API_BASE}/stocks/predict/${encodeURIComponent(sym)}?days=${days}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch prediction");
      }
      const data = await res.json();
      setPredictionHistory(data.history || []);
      setPredictionFuture(data.predictions || []);
    } catch (err) {
      console.error(err);
      setPredictionError(err.message);
      setPredictionHistory([]);
      setPredictionFuture([]);
    } finally {
      setPredictionLoading(false);
    }
  };

  const renderPredictionGraph = () => {
    const histPoints = (predictionHistory || [])
      .map((p) => ({
        y: Number(p.close ?? p.close_price),
      }))
      .filter((p) => !Number.isNaN(p.y));

    const futPoints = (predictionFuture || [])
      .map((p) => ({
        y: Number(p.predicted_close ?? p.close),
      }))
      .filter((p) => !Number.isNaN(p.y));

    const all = [...histPoints, ...futPoints];
    if (all.length === 0) return null;

    const width = 500;
    const height = 200;
    const padding = 30;

    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));
    const spanY = maxY - minY || 1;
    const total = all.length;

    const scaleX = (idx) =>
      padding + (idx / Math.max(1, total - 1)) * (width - 2 * padding);
    const scaleY = (y) =>
      height - padding - ((y - minY) / spanY) * (height - 2 * padding);

    const histPolyline = histPoints
      .map((p, idx) => `${scaleX(idx)},${scaleY(p.y)}`)
      .join(" ");

    const futPolyline = futPoints
      .map((p, idx) => `${scaleX(histPoints.length + idx)},${scaleY(p.y)}`)
      .join(" ");

    return (
      <svg
        width={width}
        height={height}
        style={{
          border: "1px solid #ccc",
          marginTop: 8,
          background: "#fafafa",
        }}
      >
        {/* axes */}
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#999"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#999"
        />
        {/* history line */}
        {histPolyline && (
          <polyline
            fill="none"
            stroke="blue"
            strokeWidth="2"
            points={histPolyline}
          />
        )}
        {/* future line */}
        {futPolyline && (
          <polyline
            fill="none"
            stroke="red"
            strokeWidth="2"
            strokeDasharray="4 4"
            points={futPolyline}
          />
        )}
      </svg>
    );
  };

  // ---------- MATRIX ACTIONS ----------

  const fetchMatrix = async () => {
    const pid = (matrixPid || "").toString().trim();
    if (!pid) {
      alert("No portfolio selected");
      return;
    }
    try {
      setMatrixLoading(true);
      setMatrixError("");
      const res = await fetch(
        `${API_BASE}/portfolio/${encodeURIComponent(
          pid
        )}/matrix?type=${matrixType}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to compute matrix");
      }
      const data = await res.json();
      setMatrixSymbols(data.symbols || []);
      setMatrixValues(data.matrix || []);
    } catch (err) {
      console.error(err);
      setMatrixError(err.message);
      setMatrixSymbols([]);
      setMatrixValues([]);
    } finally {
      setMatrixLoading(false);
    }
  };

  // ---------- RENDER ----------

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Portfolio Predictions & Matrix</h3>

      {/* Prediction section */}
      <div
        style={{
          marginTop: 12,
          padding: 10,
          border: "1px solid #ddd",
          borderRadius: 4,
        }}
      >
        <h4>Future Price Prediction (Linear Regression)</h4>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Symbol (e.g. AAPL)"
            value={predictionSymbol}
            onChange={(e) => setPredictionSymbol(e.target.value)}
          />
          <input
            type="number"
            min={1}
            placeholder="Days into future"
            value={predictionDays}
            onChange={(e) => setPredictionDays(e.target.value)}
            style={{ width: 120 }}
          />
          <button onClick={fetchPrediction} disabled={predictionLoading}>
            {predictionLoading ? "Predicting..." : "Predict"}
          </button>
        </div>
        {predictionError && (
          <div style={{ color: "red", marginTop: 8 }}>{predictionError}</div>
        )}

        {(predictionHistory.length > 0 || predictionFuture.length > 0) && (
          <div style={{ marginTop: 12 }}>
            <h5>Predicted Values</h5>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: 12,
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: 4 }}>
                      Date
                    </th>
                    <th style={{ border: "1px solid #ccc", padding: 4 }}>
                      Type
                    </th>
                    <th style={{ border: "1px solid #ccc", padding: 4 }}>
                      Close
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {predictionHistory.map((p, idx) => (
                    <tr key={`hist-${idx}`}>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        {(p.date ?? p.timestamp ?? "").toString().slice(0, 10)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        Historical
                      </td>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        {(p.close ?? p.close_price ?? "").toFixed
                          ? (p.close ?? p.close_price).toFixed(2)
                          : p.close ?? p.close_price}
                      </td>
                    </tr>
                  ))}
                  {predictionFuture.map((p, idx) => (
                    <tr key={`pred-${idx}`}>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        {p.date}
                      </td>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        Predicted
                      </td>
                      <td
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                        }}
                      >
                        {p.predicted_close?.toFixed
                          ? p.predicted_close.toFixed(2)
                          : p.predicted_close}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {renderPredictionGraph()}
          </div>
        )}
      </div>

      {/* Matrix section */}
      <div
        style={{
          marginTop: 16,
          padding: 10,
          border: "1px solid #ddd",
          borderRadius: 4,
        }}
      >
        <h4>Covariance / Correlation Matrix</h4>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* show portfolio ID, but don't make user type it */}
          <span>
            Portfolio ID: <strong>{matrixPid}</strong>
          </span>
          <select
            value={matrixType}
            onChange={(e) => setMatrixType(e.target.value)}
          >
            <option value="COVAR_POP">Covariance (COVAR_POP)</option>
            <option value="CORR">Correlation (CORR)</option>
          </select>
          <button onClick={fetchMatrix} disabled={matrixLoading}>
            {matrixLoading ? "Computing..." : "Compute Matrix"}
          </button>
        </div>
        {matrixError && (
          <div style={{ color: "red", marginTop: 8 }}>{matrixError}</div>
        )}

        {matrixSymbols.length > 0 && matrixValues.length > 0 && (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: 4,
                    }}
                  >
                    Symbol
                  </th>
                  {matrixSymbols.map((sym) => (
                    <th
                      key={sym}
                      style={{
                        border: "1px solid #ccc",
                        padding: 4,
                      }}
                    >
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixValues.map((row, i) => (
                  <tr key={matrixSymbols[i]}>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: 4,
                      }}
                    >
                      {matrixSymbols[i]}
                    </th>
                    {row.map((val, j) => (
                      <td
                        key={`${i}-${j}`}
                        style={{
                          border: "1px solid #eee",
                          padding: 4,
                          textAlign: "right",
                        }}
                      >
                        {val === null || val === undefined
                          ? "-"
                          : Number(val).toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
