const express = require("express");
const { Kafka } = require("kafkajs");
const axios = require("axios");

const app = express();
app.use(express.json());

// MongoDB notif_db
const MONGODB_URI = "mongodb://mongo-notif:27017/notif_db";
const EMAIL = process.env.EMAIL_SERVICE_URL || "http://email-service:8002";

const kafka = new Kafka({ brokers: ["kafka:9092"] });

// semantic duplicate of email-service POST /notifications/send
app.post("/notify", async (req, res) => {
  // enqueue to email-service over the queue topic
  await kafka.producer().send({ topic: "email-service", messages: [{ value: JSON.stringify(req.body) }] });
  res.json({ queued: true });
});

app.post("/notifications/send", async (req, res) => {
  await axios.post(`${EMAIL}/send`, req.body);
  res.json({ sent: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(Number(process.env.PORT) || 3003);
