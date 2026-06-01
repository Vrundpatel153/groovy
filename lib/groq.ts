import Groq from "groq-sdk";
import { FrictionPoint } from "./heuristics";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface HookResult {
  hook_text: string;
  citations: string[];
}

export async function generateHook(
  companyUrl: string,
  companyName: string,
  frictionPoints: FrictionPoint[]
): Promise<HookResult> {
  if (frictionPoints.length === 0) {
    return {
      hook_text:
        "• This site appears well-optimized — no major friction points detected. Consider a different outreach angle.",
      citations: [],
    };
  }

  const frictionSummary = frictionPoints
    .map(
      (fp, i) =>
        `${i + 1}. [${fp.severity.toUpperCase()}] ${fp.label}: ${fp.detail} (Found on: ${fp.citation})`
    )
    .join("\n");

  const systemPrompt = `You are a B2B outreach specialist writing warm-intro hooks for a connector network. Your job is to draft a personalised 5-bullet outreach message based ONLY on the friction points provided.

STRICT RULES:
1. Reference ONLY the friction points listed below. Do NOT invent features, employees, integrations, or products that are not mentioned.
2. Each bullet must tie back to a SPECIFIC friction finding.
3. Mention the company name "${companyName}" naturally.
4. Be conversational and helpful, not salesy or aggressive.
5. Frame friction as opportunities for improvement, not criticisms.
6. If there are fewer than 5 friction points, combine related observations or expand on the most impactful ones to still produce exactly 5 bullets.
7. Do NOT make up any facts. Only use information from the friction points.

OUTPUT FORMAT: Respond with valid JSON only, no markdown fences:
{
  "hook_text": "• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4\\n• Bullet 5",
  "citations": ["friction_id_1 - brief note", "friction_id_2 - brief note"]
}`;

  const userPrompt = `Company: ${companyName}
Website: ${companyUrl}

Detected Friction Points:
${frictionSummary}

Draft the 5-bullet personalised outreach hook now.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty LLM response");
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    let hookText: string = parsed.hook_text || "No hook generated";
    // Normalize bullet characters: strip control chars, ensure • prefix
    hookText = hookText
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "") // strip control chars
      .replace(/^[-–—*]\s*/gm, "• ")                  // normalize bullet prefixes
      .trim();
    return {
      hook_text: hookText,
      citations: parsed.citations || [],
    };
  } catch (err: any) {
    console.error("Groq LLM error:", err.message);

    // Fallback: generate a simple hook from friction points
    const bullets = frictionPoints
      .slice(0, 5)
      .map(
        (fp) =>
          `• Noticed ${fp.label.toLowerCase()} on ${companyName}'s site — ${fp.detail.split(".")[0].toLowerCase()}.`
      );

    while (bullets.length < 5) {
      bullets.push(
        `• There's an opportunity to improve ${companyName}'s online presence based on the signals we're seeing.`
      );
    }

    return {
      hook_text: bullets.join("\n"),
      citations: frictionPoints.map((fp) => `${fp.id} - fallback`),
    };
  }
}
