import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:5000/api";

export default function PortfolioStats({ defaultPid }) {
  const [pid, setPid] = useState(defaultPid);
  const [matrixType, setMatrixType] = useState("CORR"); // "CORR" | "COVAR_POP"
  const [symbols, setSymbols] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [regData, setRegData] = useState(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  useEffect(() => {
    setPid(defaultPid);
    setSymbols([]);
    setMatrix([]);
    setSelectedSymbol("");
    setRegData(null);
    setError("");
    setRegError("");
  }, [defaultPid]);

  const fetchMatrix = async () => {
    if (!pid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/portfolio/${pid}/matrix?type=${matrixType}`
      );
      if (!res.ok) throw new Error("Failed to fetch matrix");

      const data = await res.json();
      const syms = data.symbols || [];
      setSymbols(syms);
      setMatrix(data.matrix || []);

      if (!selectedSymbol && syms.length > 0) {
        setSelectedSymbol(syms[0]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading matrix");
      setSymbols([]);
      setMatrix([]);
    } finally {
      setLoading(false);
    }
  };

  const runRegression = async () => {
    if (!selectedSymbol) {
      alert("Select a symbol first");
      return;
    }
    setRegLoading(true);
    setRegError("");
    setRegData(null);

    try {
      const res = await fetch(
        `${API_BASE}/stocks/predict/${selectedSymbol}?days=5`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to run regression");
      }
      const data = await res.json();
      setRegData(data);
    } catch (err) {
      console.error(err);
      setRegError(err.message || "Error running regression");
    } finally {
      setRegLoading(false);
    }
  };

  if (!pid) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Covariance / Correlation Matrix</h4>

      <div
        style={{
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <label>
          Type:{" "}
          <select
            value={matrixType}
            onChange={(e) => setMatrixType(e.target.value)}
          >
            <option value="CORR">Correlation</option>
            <option value="COVAR_POP">Covariance (Population)</option>
          </select>
        </label>

        <button onClick={fetchMatrix}>Compute</button>
      </div>

      {loading && <div>Loading matrix...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && symbols.length === 0 && (
        <div>No stocks in this portfolio or no data.</div>
      )}

      {!loading && !error && symbols.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "4px 8px",
                  }}
                ></th>
                {symbols.map((sym) => (
                  <th
                    key={sym}
                    style={{
                      border: "1px solid black",
                      padding: "4px 8px",
                    }}
                  >
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((rowSym, i) => (
                <tr key={rowSym}>
                  <th
                    style={{
                      border: "1px solid black",
                      padding: "4px 8px",
                      textAlign: "right",
                    }}
                  >
                    {rowSym}
                  </th>
                  {symbols.map((colSym, j) => {
                    const rawVal =
                      matrix &&
                      matrix[i] &&
                      matrix[i][j] !== null &&
                      matrix[i][j] !== undefined
                        ? Number(matrix[i][j])
                        : null;

                    const display =
                      rawVal === null
                        ? "-"
                        : matrixType === "CORR"
                        ? rawVal.toFixed(3)
                        : rawVal.toFixed(2);

                    return (
                      <td
                        key={`${rowSym}-${colSym}`}
                        style={{
                          border: "1px solid black",
                          padding: "4px 8px",
                          textAlign: "right",
                        }}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========= LINEAR REGRESSION ========= */}
      <div style={{ marginTop: 24 }}>
        <h4>Linear Regression (predicted closes)</h4>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <label>
            Symbol:{" "}
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              <option value="">-- select --</option>
              {symbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </label>

          <button onClick={runRegression}>Run Linear Regression</button>
        </div>

        {regLoading && <div>Running regression...</div>}
        {regError && <div style={{ color: "red" }}>{regError}</div>}

        {regData && regData.predictions && regData.predictions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>
              Predictions for <strong>{regData.symbol}</strong> (next{" "}
              {regData.predictions.length} days):
            </div>
            <table
              style={{
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid black",
                      padding: "4px 8px",
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      border: "1px solid black",
                      padding: "4px 8px",
                    }}
                  >
                    Predicted Close
                  </th>
                </tr>
              </thead>
              <tbody>
                {regData.predictions.map((p, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px 8px",
                      }}
                    >
                      {p.date}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px 8px",
                        textAlign: "right",
                      }}
                    >
                      ${p.predicted_close.toFixed(2)}
                    </td>
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
