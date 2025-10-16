import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const { scene, outfit, vibe, prompt } = req.body || {};
    const text = (prompt || "").trim();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        score: 0,
        quip: "Frank’s sulking — missing Gemini API key.",
        tips: [],
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // quick length + quality check to help Frank decide realistically
    let baseScore = 3;
    const wordCount = text.split(/\s+/).length;

    if (wordCount > 40) baseScore = 8;
    else if (wordCount > 25) baseScore = 6;
    else if (wordCount > 10) baseScore = 4;
    else if (wordCount > 3) baseScore = 3;
    else baseScore = 1;

    // Ask Gemini for tone + adjustment
    const frankPrompt = `
You are Frank, a brutally honest but funny British creative director.
Judge this user's AI image prompt based on quality, creativity and effort.

Details:
Scene: ${scene}
Outfit: ${outfit}
Vibe: ${vibe}

Prompt they wrote:
"${prompt}"

Rules:
- Base your rating 1–10 on creativity, detail, and how complete it feels.
- If it’s short and lazy, under 5.
- If it’s detailed and well-structured, 8–10.
- Give one short sarcastic comment.
- Give 2–3 short practical tips.
- Do not include code fences or markdown.

Return ONLY valid JSON like this:
{"score":8,"quip":"Decent effort, mate.","tips":["Add lighting details","Include mood","Tighten negatives"]}
`;

    const result = await model.generateContent(frankPrompt);
    const raw = (result?.response?.text() || "").trim();
    const clean = raw.replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(clean);
    } catch {
      data = {
        score: baseScore,
        quip:
          baseScore >= 8
            ? "Solid prompt, I’ll give you that."
            : baseScore >= 5
            ? "Not bad, bit safe though."
            : baseScore >= 3
            ? "Lazy one, innit?"
            : "That’s tragic, mate.",
        tips: ["Add more structure", "Mention lighting or mood", "Describe the camera angle"],
      };
    }

    // Blend Gemini’s score with realism based on length
    let finalScore = data.score || baseScore;
    if (Math.abs(finalScore - baseScore) > 3) {
      finalScore = Math.round((finalScore + baseScore) / 2);
    }
    finalScore = Math.max(1, Math.min(10, finalScore));

    res.status(200).json({
      score: finalScore,
      quip: data.quip || "Frank’s unimpressed.",
      tips: Array.isArray(data.tips) ? data.tips.slice(0, 3) : [],
    });
  } catch (err) {
    console.error("Frank crashed:", err);
    res.status(500).json({
      score: 4,
      quip: "Frank’s sulking. Try again later.",
      tips: [],
    });
  }
}
