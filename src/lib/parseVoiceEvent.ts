import Anthropic from "@anthropic-ai/sdk";

export interface ParsedVoiceEvent {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  client: string;
  location: string;
  assigned_to: string;
  description: string;
}

export async function parseVoiceEventText(text: string): Promise<ParsedVoiceEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Today is ${dayOfWeek}, ${todayStr}. Parse this voice input into a calendar job event and return ONLY a valid JSON object with these fields (use empty string for anything not mentioned):
- title (string, required — the job or task name)
- date (string, YYYY-MM-DD — resolve relative references like "Thursday" or "next Monday" from today's date)
- start_time (string, HH:MM in 24h format, or "")
- end_time (string, HH:MM in 24h format, or "")
- client (string, company or person name, or "")
- location (string, address or place, or "")
- assigned_to (string, crew member or team, or "")
- description (string, any remaining notes, or "")

Return ONLY the JSON object. No explanation, no markdown, no code fences.

Voice input: "${text}"`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response from AI");
  }

  const cleaned = content.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as ParsedVoiceEvent;
}
