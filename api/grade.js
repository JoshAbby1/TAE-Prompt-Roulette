import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const { scene, outfit, vibe, prompt } = req.body;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const frankPrompt = `
You are Frank, a sarcastic creative AI prompt judge. 
Someone wrote a prompt based on:
Scene: ${scene}
Outfit: ${outfit}
Vibe: ${vibe}

They wrote:
"${prompt}"

Your job:
- Give it a score from 1 to 10.
- Add one cheeky sentence of feedback in your British sarcastic tone.
- Suggest up to 3 short tips for improving it.

Reply ONLY as JSON (no markdown, no code block):
{
"score": 8,
"quip": "Needs more chaos, mate.",
"tips": ["Use a specific camera lens", "Add a lighting style"]
}
`;

    const result = await model.generateContent(frankPrompt);
    const text = result.response.text().trim();

    // Try to clean up any accidental markdown or stray text
    const clean = text.replace(/```json|```/g, "").trim();

    // Parse safely
    let data;
    try {
      data = JSON.parse(clean);
    } catch {
      data = {
        score: 5,
        quip: "Frank mumbled something unintelligible.",
        tips: ["Try again, mate."],
      };
    }

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
