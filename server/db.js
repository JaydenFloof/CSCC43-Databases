const { Pool } = require("pg");

// Replace these values with your PostgreSQL VM info
const pool = new Pool({
  user: "postgres",               // your postgres username
  host: "34.9.235.221",    // the external IP of your VM
  database: "projectdb",          // the database you just created
  password: "postgres",      // your postgres password
  port: 5432,                     // default PostgreSQL port
});

pool.connect()
  .then(() => console.log("Connected to PostgreSQL database projectdb"))
  .catch(err => console.error("Connection error", err));

module.exports = pool;
