/* ============================================================
   Mergent AI — magic-link email
   Sends the one-time sign-in link via any SMTP provider
   (Brevo / SendGrid / Resend / Mailgun…) configured by env —
   no personal account password, just a provider API/SMTP key.
   Token signing is HMAC-based (stateless) so it works on
   serverless without shared storage.
   ============================================================ */
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter = null;
function tx() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return transporter;
}

/* ---- signed, expiring tokens (no DB needed) ---- */
export function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", config.authSecret).update(data).digest("base64url");
  return `${data}.${sig}`;
}
export function verifyToken(token) {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", config.authSecret).update(data).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

/* ---- send the link ---- */
export async function sendMagicLink(to, link, name) {
  const who = name ? name.split(" ")[0] : "there";
  await tx().sendMail({
    from: `Mergent <${config.mail.from}>`,
    to,
    subject: "Your Mergent sign-in link",
    text: `Hi ${who},\n\nSign in to Mergent with this link (valid for 15 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#16181d">
        <div style="font-size:20px;font-weight:700;letter-spacing:-.02em">Merg<span style="color:#0fb5ae">ent</span></div>
        <p style="font-size:15px;color:#444;margin-top:24px">Hi ${who}, click below to sign in to Mergent. This link is valid for <b>15 minutes</b>.</p>
        <a href="${link}" style="display:inline-block;margin:18px 0;background:#0fb5ae;color:#062a29;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:15px">Sign in to Mergent →</a>
        <p style="font-size:12.5px;color:#889;margin-top:18px">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all;color:#0fb5ae">${link}</span></p>
        <p style="font-size:12px;color:#aab;margin-top:24px;border-top:1px solid #eee;padding-top:14px">Didn't request this? You can safely ignore this email. · Mergent by Xorvion</p>
      </div>`,
  });
}
