import React, { useState, useEffect } from "react";
import UserPage from "./user.js"; 

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
  children.push(React.createElement("h1", { key: "title" }, "Stock App"));

  if (!user) {
    children.push(
      React.createElement(
        "div",
        { key: "auth" },
        React.createElement("input", { value: username, onChange: e => setUsername(e.target.value), placeholder: "Username" }),
        React.createElement("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), placeholder: "Password" }),
        React.createElement("button", { onClick: register }, "Register"),
        React.createElement("button", { onClick: login }, "Login")
      )
    );
  } else {
    // Render the user page component
    children.push(React.createElement(UserPage, { user }));
  }

  return React.createElement("div", null, children);
}
