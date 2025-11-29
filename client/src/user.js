import React, { useState, useEffect } from "react";
//import pool from "./db.js"; // if you want server-side DB calls (for client, fetch API)

export default function UserPage({ user }) {
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [cash, setCash] = useState(null);
  const [cv, setCV] = useState([]);
  const [beta, setBeta] = useState([]);
  const [startDate, setStartDate] = useState(""); // format: "YYYY-MM-DD"
  const [endDate, setEndDate] = useState("");     // format: "YYYY-MM-DD"

  // Fetch user's portfolios on load
  useEffect(() => {
    fetch(`http://localhost:5000/api/portfolio/${user.uid}`)
      .then(res => res.json())
      .then(setPortfolios);
  }, [user]);

  // Fetch selected portfolio details
  useEffect(() => {
    if (!selectedPortfolio || !selectedPortfolio.pid) {
        setStocks([]);
        setCash(null);
        return;
    }
    const pid = selectedPortfolio.pid;

    // Fetch stocks
    fetch(`http://localhost:5000/api/holdings/${pid}`)
    .then(res => res.json())
    .then(data => {
        console.log("Fetched stocks:", data);
        setStocks(data);
    });

    // Fetch cash
    fetch(`http://localhost:5000/api/cash/portfolio/${pid}`)
        .then(res => (res.ok ? res.json() : null))
        .then(setCash)
        .catch(() => setCash(null));

    // Fetch covariance var
    // fetch(`http://localhost:5000/api/portfolio/${pid}/cv`)
    // .then(res => res.json())
    // .then(setCV)
    // .catch(() => setCV([]));

    // // Fetch beta coeff
    // fetch(`http://localhost:5000/api/portfolio/${pid}/beta`)
    //   .then(res => res.json())
    //   .then(setBeta)
    //   .catch(() => setBeta([]));
}, [selectedPortfolio]);
  const fetchStatistics = (pid, start, end) => {
    if (!pid) return;

    fetch(`http://localhost:5000/api/portfolio/${pid}/cv?start=${start}&end=${end}`)
      .then(res => res.json())
      .then(setCV)
      .catch(() => setCV([]));

    fetch(`http://localhost:5000/api/portfolio/${pid}/beta?start=${start}&end=${end}`)
      .then(res => res.json())
      .then(setBeta)
      .catch(() => setBeta([]));
  };

  // Create new portfolio
  const createPortfolio = () => {
    fetch(`http://localhost:5000/api/portfolio/${user.uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) // no name if table doesn't have it
    })
      .then(res => res.json())
      .then(p => setPortfolios([...portfolios, p]));
  };

  // Delete portfolio
  const deletePortfolio = pid => {
    fetch(`http://localhost:5000/api/portfolio/${pid}`, { method: "DELETE" })
      .then(res => res.json())
      .then(() => {
        setPortfolios(portfolios.filter(p => p.pid !== pid));
        if (selectedPortfolio?.pid === pid) setSelectedPortfolio(null);
      });
  };

  // Add stock to portfolio
//   const addStock = (symbol, shares) => {
//     if (!selectedPortfolio) return;
//     fetch(`http://localhost:5000/api/holdings/${selectedPortfolio.pid}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ symbol, shares })
//     }).then(() => {
//       setStocks([...stocks, { symbol, number_of_shares: shares }]);
//     });
//   };
    const addStock = (symbol, shares) => {
        if (!selectedPortfolio) return;

        fetch(`http://localhost:5000/api/holdings/${selectedPortfolio.pid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, shares })
        })
            .then(res => {
            if (!res.ok) throw new Error("Failed to add stock");
            // Re-fetch the updated stocks
            return fetch(`http://localhost:5000/api/holdings/${selectedPortfolio.pid}`);
            })
            .then(res => res.json())
            .then(setStocks)
            .catch(err => alert(err.message));
    };


  // Delete stock from portfolio
  const deleteStock = symbol => {
    if (!selectedPortfolio) return;
    fetch(`http://localhost:5000/api/stock/${selectedPortfolio.pid}/${symbol}`, { method: "DELETE" })
      .then(() => setStocks(stocks.filter(s => s.symbol !== symbol)));
  };

  const createCashAccount = () => {
    const value = parseFloat(prompt("Initial Cash Amount"));
    if (isNaN(value)) {
        alert("Invalid number");
        return;
    }
    fetch(`http://localhost:5000/api/cash/${selectedPortfolio.pid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
    })
        .then(res => res.json())
        .then(() => {
        fetch(`http://localhost:5000/api/cash/${selectedPortfolio.pid}`)
            .then(res => res.json())
            .then(setCash);
        });
    };

 const deleteCashAccount = () => {
  fetch(`http://localhost:5000/api/cash/${selectedPortfolio.pid}`, {
    method: "DELETE"
  }).then(() => {
    setCash(null);
  });
};

  // Update cash account
//   const updateCash = amount => {
//     if (!selectedPortfolio) return;
//     fetch(`http://localhost:5000/api/cash/update/${selectedPortfolio.pid}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ amount, transaction_type: "deposit" })
//     }).then(res => res.json())
//       .then(setCash);
//   };
    const updateCash = (amount) => {
        if (!selectedPortfolio) return;

        const transaction_type = amount >= 0 ? "deposit" : "withdraw";

        fetch(`http://localhost:5000/api/cash/update/${selectedPortfolio.pid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: Math.abs(amount), transaction_type })
        })
            .then(res => res.json())
            .then(setCash)
            .catch(err => {
            console.error(err);
            alert("Failed to update cash account");
            });
    };


  const children = [];

  children.push(
    React.createElement("h2", { key: "title" }, "Your Portfolios")
  );

  // Portfolio list
  children.push(
    React.createElement(
      "div",
      { key: "list", style: { marginBottom: 20 } },
      portfolios.map(p =>
        React.createElement(
          "div",
          { key: p.pid, style: { display: "flex", alignItems: "center", marginBottom: 5 } },
          React.createElement(
            "button",
            { onClick: () => setSelectedPortfolio(p), style: { marginRight: 5 } },
            `Portfolio ${p.pid}`
          ),
          React.createElement(
            "button",
            { onClick: () => deletePortfolio(p.pid), style: { color: "red" } },
            "Delete"
          )
        )
      ),
      React.createElement(
        "button",
        { onClick: createPortfolio, style: { marginTop: 10 } },
        "Create New Portfolio"
      )
    )
  );

  // Selected portfolio details
if (selectedPortfolio) {
    children.push(
        React.createElement(
        "div",
        { key: "details", style: { border: "1px solid #ccc", padding: 10 } },

        React.createElement("h3", null, `Portfolio ${selectedPortfolio.pid}`),

        React.createElement(
            "div",
            null,

            // ----- CASH ACCOUNT DISPLAY -----
            React.createElement(
            "p",
            null,
            cash ? `Cash Balance: $${cash.value}` : "No Cash Account"
            ),
            // ----- CASH ACCOUNT BUTTONS -----
            !cash &&
            React.createElement(
                "button",
                { onClick: createCashAccount },
                "Create Cash Account"
            ),
            cash &&
            React.createElement(
                "button",
                {
                onClick: deleteCashAccount,
                style: { color: "red", marginLeft: 10 }
                },
                "Delete Cash Account"
            ),

            // ----- DEPOSIT -----
            cash &&
            React.createElement(
            "button",
            {
                onClick: () => {
                const amount = parseFloat(prompt("Enter deposit amount:"));
                if (!isNaN(amount) && amount > 0) {
                    updateCash(amount);
                } else {
                    alert("Invalid amount");
                }
                },
                style: { marginLeft: 10 }
            },
            "Deposit Cash"
            ),

            cash &&
            React.createElement(
            "button",
            {
                onClick: () => {
                const amount = parseFloat(prompt("Enter withdrawal amount:"));
                if (!isNaN(amount) && amount > 0) {
                    updateCash(-amount); // or use transaction_type: "withdraw" in your backend
                } else {
                    alert("Invalid amount");
                }
                },
                style: { marginLeft: 10, color: "red" }
            },
            "Withdraw Cash"
            )
        ),
        React.createElement(
            "div",
            null,

            React.createElement("h4", null, "Stocks"),

            stocks.map(s =>
            React.createElement(
                "div",
                {
                key: s.symbol,
                style: { display: "flex", alignItems: "center" }
                },
                React.createElement(
                "span",
                { style: { marginRight: 10 } },
                `${s.symbol} - ${s.number_of_shares}`
                ),
                React.createElement(
                "button",
                {
                    onClick: () => deleteStock(s.symbol),
                    style: { color: "red" }
                },
                "Delete ALL"
                )
            )
            ),

            React.createElement(
            "button",
            {
                onClick: () =>
                addStock(
                    prompt("Stock Symbol"),
                    parseInt(prompt("Shares"), 10)
                )
            },
            "Add/Delete Stock"
            )
        ),
        React.createElement("hr"),

        React.createElement("h4", null, "Portfolio Statistics"),

        /* CV */
        // React.createElement(
        //   "div",
        //   null,
        //   React.createElement("h5", null, "Coefficient of Variation (CV)"),
        //   cv.length === 0
        //     ? React.createElement("p", null, "No CV data")
        //     : cv.map(row =>
        //         React.createElement(
        //           "div",
        //           { key: row.symbol },
        //           `${row.symbol}: ${Number(row.cv).toFixed(4)}`
        //         )
        //       )
        // ),

        // /* Beta */
        // React.createElement(
        //   "div",
        //   null,
        //   React.createElement("h5", null, "Beta Coefficient"),
        //   beta.length === 0
        //     ? React.createElement("p", null, "No Beta data")
        //     : beta.map(row =>
        //         React.createElement(
        //           "div",
        //           { key: row.symbol },
        //           `${row.symbol}: ${Number(row.beta).toFixed(4)}`
        //         )
        //       )
        // )
        stocks.length === 0
        ?React.createElement("p", null, "No Stocks")
        :React.createElement(
          "div",
          { style: { marginBottom: 20 } },
          React.createElement("h4", null, "Portfolio Statistics Interval"),

          React.createElement("label", null, "Start Date:"),
          React.createElement("input", {
            type: "date",
            value: startDate,
            onChange: e => setStartDate(e.target.value),
            style: { marginLeft: 5, marginRight: 10 }
          }),

          React.createElement("label", null, "End Date:"),
          React.createElement("input", {
            type: "date",
            value: endDate,
            onChange: e => setEndDate(e.target.value),
            style: { marginLeft: 5, marginRight: 10 }
          }),

          React.createElement(
            "button",
            {
              onClick: () => fetchStatistics(selectedPortfolio.pid, startDate, endDate),
              style: { marginLeft: 10 }
            },
            "Fetch CV & Beta"
          ),

          React.createElement(
            "div",
            null,
            React.createElement("h5", null, "Coefficient of Variation (CV)"),
            cv.length === 0
              ? React.createElement("p", null, "No CV data")
              : cv.map(row =>
                  React.createElement(
                    "div",
                    { key: row.symbol },
                    `${row.symbol}: ${Number(row.cv).toFixed(4)}`
                  )
                )
          ),
          React.createElement(
            "div",
            null,
            React.createElement("h5", null, "Beta Coefficient"),
            beta.length === 0
              ? React.createElement("p", null, "No Beta data")
              : beta.map(row =>
                  React.createElement(
                    "div",
                    { key: row.symbol },
                    `${row.symbol}: ${Number(row.beta).toFixed(4)}`
                  )
                )
          )
        )
        )
    );
    }

  // Display CV
children.push(
  
);

// Display Beta
children.push(
  
);


  return React.createElement("div", { style: { padding: 20 } }, children);
}
