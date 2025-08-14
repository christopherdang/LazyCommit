import express from "express";
import cors from "cors";
import morgan from "morgan";
import { fetch } from "undici";

const app = express();
const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const PUBLIC_ACCESS_TOKEN = process.env.PUBLIC_ACCESS_TOKEN || ""; // optional gate

if (!OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is not set. The proxy will reject requests.");
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// Optional health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Minimal passthrough for chat completions
app.post("/chat/completions", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server misconfigured" });
    }
    if (PUBLIC_ACCESS_TOKEN) {
      const token = req.get("x-api-key");
      if (token !== PUBLIC_ACCESS_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const body = req.body;
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status);
    res.setHeader("content-type", contentType);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy error" });
  }
});

app.listen(PORT, () => {
  console.log(`LazyCommit proxy listening on http://localhost:${PORT}`);
});


