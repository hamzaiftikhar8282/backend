import express from "express";
import cors from "cors";
import twilio from "twilio";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Twilio Credentials (hardcoded) ----------------
const TWILIO_ACCOUNT_SID = "ACf3c0da9bfbfabfc2f752d747e4c5033e";
const TWILIO_AUTH_TOKEN = "380e0772f7b1f046e613cfbef37bd94f";
const TWILIO_API_KEY_SID = "SK5a268a3513b48328ffb9646779d756e5";
const TWILIO_API_KEY_SECRET = "OHoeseoLUqY4fX2G108tuBXZlThDnOlu";
const TWIML_APP_SID = "AP300fccf8cbc582680c4098528b607713";
const TWILIO_NUMBER = "+16187034601";
const PORT = 5006;

// Twilio client for REST API (Numbers & SMS)
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ---------------- Number Search ----------------
app.get("/api/numbers/search", async (req, res) => {
  try {
    let { areaCode = "618", limit = 5 } = req.query;
    const numericLimit = parseInt(limit, 10);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      return res.status(400).json({ error: "Limit must be a positive integer" });
    }

    const numbers = await client.availablePhoneNumbers("US").local.list({
      areaCode,
      limit: numericLimit,
    });

    res.json(
      numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- Simulate Purchase ----------------
let purchasedNumbers = [];
app.post("/api/numbers/purchase", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: "Phone number is required" });
  }

  if (!purchasedNumbers.includes(phoneNumber)) {
    purchasedNumbers.push(phoneNumber);
    return res.json({
      success: true,
      message: `Number ${phoneNumber} purchased (simulated)`,
    });
  } else {
    return res.json({
      success: false,
      message: `Number ${phoneNumber} already purchased`,
    });
  }
});

// ---------------- SMS: Send ----------------
app.post("/api/send-sms", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: "Recipient number and message are required" });
    }

    const sms = await client.messages.create({
      body: message,
      from: TWILIO_NUMBER,
      to,
    });

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

    const formattedMessages = messages.map((msg) => ({
      sid: msg.sid,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      status: msg.status,
      dateSent: msg.dateSent,
    }));

    res.json({ success: true, messages: formattedMessages });
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

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true,
    });

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
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
