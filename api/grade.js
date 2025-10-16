// api/grade.js
export default async function handler(req, res) {
  // Allow CORS (lets your site talk to this endpoint)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { scene, outfit, vibe, prompt } = req.body || {};
  if (!scene || !outfit || !vibe) {
    return res.status(400).send('Missing scene/outfit/vibe');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).send('Server missing GEMINI_API_KEY');
  }

  const judgeInstruction = `
You are "Frank", a cheeky TAE judge. Rate the user's AI image prompt from 1 to 10.

They had to include:
- Scene: ${scene}
- Outfit: ${outfit}
- Vibe: ${vibe}

Judge on:
- Clarity & completeness (ratio, scene, outfit, lighting, camera, mood, action, negatives)
- TAE tone (cinematic / chaos as requested)
- Creativity
- How well it matches the three parts above

Return STRICT JSON ONLY like:
{"score":7,"quip":"Bit safe, mate. Needs more chaos.","tips":["Add an 85mm lens line","State lighting clearly","Include a negative line"]}

Keep the quip short and Frank-like.
`;

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + apiKey;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: judgeInstruction.trim() },
            { text: "USER_PROMPT:\n" + (prompt || "(empty)") }
          ]
        }
      ]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).send(err || 'Gemini API error');
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse JSON safely
    let out;
    try {
      const match = text.match(/\{[\s\S]*\}$/);
      out = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch {
      const m = text.match(/(\d{1,2})\s*\/?\s*10/);
      const score = m ? Math.max(1, Math.min(10, parseInt(m[1], 10))) : 6;
      out = { score, quip: text.slice(0,120) || "Frank shrugs.", tips: [] };
    }

    return res.status(200).json({
      score: Number.isFinite(out.score) ? out.score : 6,
      quip: out.quip || "Frank shrugs.",
      tips: Array.isArray(out.tips) ? out.tips : []
    });

  } catch (e) {
    console.error(e);
    return res.status(500).send('Server error');
  }
}
