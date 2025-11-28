import React, { useState, useEffect } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [username, setUsername] = useState("");   // FIXED
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      fetch("http://localhost:5000/api/stocks")
        .then(res => res.json())
        .then(setStocks);
    }
  }, [user]);

  const register = function () {
    fetch("http://localhost:5000/api/register", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username, password })
    })
    .then(res => {
      if (!res.ok) throw new Error("Registration failed");
      alert("Registered! Click Login.");
    })
    .catch(err => alert(err.message));
  };

  const login = function () {
    fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username, password })
    })
    .then(res => {
      if (!res.ok) throw new Error("Login failed");
      return res.json();
    })
    .then(data => setUser(data))
    .catch(err => alert(err.message));
  };

  const children = [];

  children.push(
    React.createElement("h1", { key: "title" }, "Stock App")
  );

  if (!user) {
    children.push(
      React.createElement(
        "div",
        { key: "auth", style: { display: "flex", flexDirection: "column", maxWidth: 200 } },

        React.createElement("input", {
          type: "text",
          placeholder: "Username",
          value: username,
          onChange: e => setUsername(e.target.value),
          style: { marginBottom: 5, padding: 5 }
        }),

        React.createElement("input", {
          type: "password",
          placeholder: "Password",
          value: password,
          onChange: e => setPassword(e.target.value),
          style: { marginBottom: 5, padding: 5 }
        }),

        React.createElement("button", { onClick: register, style: { marginBottom: 5 } }, "Register"),
        React.createElement("button", { onClick: login }, "Login")
      )
    );
  } else {
    children.push(
      React.createElement(
        "div",
        { key: "main" },
        React.createElement("h2", null, "Welcome " + user.username),   // FIXED
        React.createElement("h3", null, "Stocks"),

        React.createElement(
          "div",
          null,
          stocks.map(function(s) {
            return React.createElement(
              "div",
              { key: s.symbol },          // FIXED
              s.symbol + " - $" + s.close // FIXED
            );
          })
        )
      )
    );
  }

  return React.createElement("div", { style: { padding: 20 } }, children);
}
