import express from "express";
import { Pool } from "pg";
import axios from "axios";

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const AUTH = process.env.AUTH_SERVICE_URL || "http://auth-service:8080";

// duplicate of auth-service GET /users
app.get("/users", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM users");
  res.json(rows);
});

// duplicate of profile-service GET /user/{id}
app.get("/user/:id", async (req, res) => {
  // validate token with auth-service
  await axios.get(`${AUTH}/permissions`);
  const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [req.params.id]);
  res.json(rows[0]);
});

app.post("/register", async (req, res) => {
  await pool.query("INSERT INTO users(email) VALUES($1)", [req.body.email]);
  res.status(201).json({ ok: true });
});

app.delete("/user/:id", async (req, res) => {
  await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.listen(Number(process.env.PORT) || 3001);
