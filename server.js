import express from "express";
import cors from "cors";
import twilio from "twilio";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Twilio Credentials from Environment Variables ----------------
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || "";
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET || "";
const TWIML_APP_SID = process.env.TWIML_APP_SID || "";
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || "";

// Check credentials
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error("❌ Twilio credentials are missing! Please set them in environment variables.");
}

// Use port from Railway
const PORT = process.env.PORT || 5006;

// Twilio client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ---------------- Number Search ----------------
app.get("/api/numbers/search", async (req, res) => {
  try {
    const { areaCode = "618", limit = 5 } = req.query;
    const numericLimit = parseInt(limit, 10);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      return res.status(400).json({ error: "Limit must be a positive integer" });
    }

    const numbers = await client.availablePhoneNumbers("US").local.list({
      areaCode,
      limit: numericLimit,
    });

    res.json(
      numbers.map((n) => ({ phoneNumber: n.phoneNumber, friendlyName: n.friendlyName }))
    );
  } catch (error) {
    console.error("❌ Number search error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------- Simulate Purchase ----------------
let purchasedNumbers = [];
app.post("/api/numbers/purchase", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required" });

  if (!purchasedNumbers.includes(phoneNumber)) {
    purchasedNumbers.push(phoneNumber);
    return res.json({ success: true, message: `Number ${phoneNumber} purchased (simulated)` });
  } else {
    return res.json({ success: false, message: `Number ${phoneNumber} already purchased` });
  }
});

// ---------------- SMS: Send ----------------
app.post("/api/send-sms", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: "Recipient number and message are required" });

    const sms = await client.messages.create({ body: message, from: TWILIO_NUMBER, to });
    res.json({ success: true, sid: sms.sid });
  } catch (error) {
    console.error("❌ SMS Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------- SMS: Receive ----------------
app.get("/api/receive-sms", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const messages = await client.messages.list({ limit });

    res.json({
      success: true,
      messages: messages.map(msg => ({
        sid: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        dateSent: msg.dateSent,
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------- Voice Token (WebRTC) ----------------
app.get("/api/voice/token-web-rtc", (req, res) => {
  try {
    const identity = `user-${uuidv4()}`;
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({ outgoingApplicationSid: TWIML_APP_SID, incomingAllow: true });
    token.addGrant(voiceGrant);

    res.json({ success: true, identity, token: token.toJwt() });
  } catch (error) {
    console.error("❌ Voice Token Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------- Root Check ----------------
app.get("/", (req, res) => res.send("Backend is running"));

// ---------------- Start Server ----------------
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));

