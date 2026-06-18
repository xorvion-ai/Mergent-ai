import express from "express";
import mongoose from "mongoose";
import axios from "axios";

const app = express();
app.use(express.json());

const ADMIN = process.env.ADMIN_SERVICE_URL || "http://admin-service:8081";
const NOTIFY = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3003";

const Profile = mongoose.model("profiles", new mongoose.Schema({ userId: String, bio: String }));
const Preference = mongoose.model("preferences", new mongoose.Schema({ userId: String, theme: String }));

// duplicate of user-service GET /user/{id} (different response schema)
app.get("/user/:id", async (req, res) => {
  // role hydration: profile -> admin (part of the cycle)
  const roles = await axios.get(`${ADMIN}/roles`);
  const profile = await Profile.findOne({ userId: req.params.id });
  res.json({ profile, roles: roles.data });
});

app.get("/profiles", async (_req, res) => {
  res.json(await Profile.find());
});

app.put("/profile", async (req, res) => {
  await Profile.updateOne({ userId: req.body.userId }, req.body);
  // notify via queue
  await axios.post(`${NOTIFY}/notify`, { event: "profile.updated" });
  res.json({ ok: true });
});

app.listen(Number(process.env.PORT) || 3002);
