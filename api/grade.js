import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const { scene, outfit, vibe, prompt } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).send("Missing GEMINI_API_KEY env var.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const frankPrompt = `
You are Frank, a sarcastic creative AI prompt judge.
Rate the user's prompt that was written from these random parts:

Scene: ${scene}
Outfit: ${outfit}
Vibe: ${vibe}

Prompt to grade:
"${prompt}"

Your job:
- Give a score from 1 to 10
- One cheeky sentence of feedback in British tone
- Up to 3 short tips for improvement

Reply ONLY valid JSON (no markdown, no code fences):
{"score": 8, "quip": "Needs more chaos, mate.", "tips": ["Add lens", "Add lighting", "Tighten negatives"]}
`;

    const result = await model.generateContent(frankPrompt);
    const raw = (result?.response?.text() || "").trim();

    // Strip accidental markdown code-fences if any
    const clean = raw.replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(clean);
    } catch (e) {
      data = {
        score: 5,
        quip: "Frank mumbled something unintelligible. Try again, mate.",
        tips: ["Add camera & lighting", "Include a clear action", "Use negatives"],
      };
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}
