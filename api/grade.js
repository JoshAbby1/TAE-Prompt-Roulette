import { GoogleGenerativeAI } from "@google/generative-ai";

function localScore(prompt) {
  const txt = (prompt || "").trim();
  const lines = txt.split(/\n/).filter(s => s.trim()).length;
  const words = txt.split(/\s+/).filter(Boolean).length;

  let feats = 0;
  [/ratio/i,/camera|lens/i,/lighting|light/i,/mood/i,/action/i,/negative/i,/background|scene/i,/outfit/i]
    .forEach(re => { if (re.test(txt)) feats++; });

  let base = 3;
  if (lines >= 2 || words > 25) base = 5;
  if (words > 40) base = 6;
  if (words > 60) base = 7;
  if (feats >= 5) base += 2; else if (feats >= 3) base += 1;

  base = Math.max(3, Math.min(10, base));
  if (lines >= 2 && base < 5) base = 5;
  return base;
}

export default async function handler(req, res) {
  try {
    const { scene, outfit, vibe, prompt } = req.body || {};
    const promptText = (prompt || "").trim();

    if (!process.env.GEMINI_API_KEY) {
      // No leaking internals — and never 0
      return res.status(200).json({
        score: localScore(promptText),
        quip: "Frank’s offline but gave it a fair glance.",
        tips: ["Add lighting and camera", "Include mood", "Tighten negatives"],
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const frankPrompt = `
You are Frank, a sarcastic British creative director.
Judge this user's AI image prompt for quality and completeness.

Context:
Scene: ${scene}
Outfit: ${outfit}
Vibe: ${vibe}

Prompt:
"${promptText}"

Rules:
- Return only valid JSON (no markdown, no code fences).
- Score 1–10 (short & lazy <5; solid detail 8–10).
- One short cheeky quip (max 120 chars).
- 2–3 short tips.

JSON format:
{"score":8,"quip":"Cheeky line.","tips":["tip1","tip2","tip3"]}
`;

    const result = await model.generateContent(frankPrompt);
    const raw = (result?.response?.text() || "").trim();
    const clean = raw.replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(clean);
    } catch {
      data = null;
    }

    let score = data?.score;
    if (!Number.isFinite(score) || score <= 0) score = localScore(promptText);

    // enforce your rule
    const lines = promptText.split(/\n/).filter(Boolean).length;
    if (lines >= 2 && score < 5) score = 5;

    const quip =
      (data?.quip) ||
      (score >= 8 ? "Solid stuff, keep it rolling."
       : score >= 5 ? "Decent — push it further."
       : "That’s weak tea, mate.");

    const tips = Array.isArray(data?.tips) ? data.tips.slice(0,3) : ["Add lighting & camera","Include mood/action","Use negatives"];

    return res.status(200).json({
      score: Math.max(3, Math.min(10, Math.round(score))),
      quip, tips
    });

  } catch (err) {
    console.error("Frank crashed:", err);
    // Hide internal error & still return fair score
    return res.status(200).json({
      score: localScore((req.body?.prompt)||""),
      quip: "Frank’s sulking. Scored it anyway.",
      tips: ["Add structure", "Be specific on lighting", "Mention lens/angle"],
    });
  }
}
