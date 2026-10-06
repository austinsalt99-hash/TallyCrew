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
  equipment_needed: string;
  internal_notes: string;
  quoted_price: number | null;
}

const MODEL = "claude-haiku-4-5-20251001";

const RECORD_JOB_TOOL: Anthropic.Tool = {
  name: "record_job",
  description: "Record the calendar job described in the voice note. Call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short job name, e.g. \"Septic excavation – Hendricks\". Empty string if none." },
      date: { type: "string", description: "YYYY-MM-DD. Resolve relative dates (\"Thursday\", \"next Monday\", \"the 15th\") from today's date. Empty string if none." },
      start_time: { type: "string", description: "HH:MM, 24-hour. Empty string if not mentioned." },
      end_time: { type: "string", description: "HH:MM, 24-hour. Empty string if not mentioned." },
      client: { type: "string", description: "Customer: person or company name. Empty string if none." },
      location: { type: "string", description: "Site address or place name, as complete as the note gives it. Empty string if none." },
      assigned_to: { type: "string", description: "Crew member name, spelled exactly as in the crew list when it matches. Empty string if none." },
      description: {
        type: "string",
        description: "Crew-facing notes, one item per line, each starting with \"- \". Include the scope of work, step-by-step instructions, materials, site access (gate codes, parking, keys), contacts with names and phone numbers, timing constraints, safety notes, and anything else a crew member needs to do the job. Do not include the price or internal pricing terms. Empty string if there is nothing.",
      },
      equipment_needed: { type: "string", description: "Equipment, vehicles, and tools the job needs, one per line. Empty string if none." },
      internal_notes: {
        type: "string",
        description: "Admin-only notes: pricing terms (deposit, payment terms, what the quote includes or excludes, discounts), PO numbers, and anything the crew doesn't need. Empty string if none.",
      },
      quoted_price: {
        type: ["number", "null"],
        description: "The quoted job total in dollars, as a plain number (\"four thousand five hundred\" → 4500, \"3k\" → 3000). null if no price was mentioned.",
      },
    },
    required: ["title", "date", "start_time", "end_time", "client", "location", "assigned_to", "description", "equipment_needed", "internal_notes", "quoted_price"],
  },
};

const SYSTEM_PROMPT = `You turn a spoken job note from a contractor's office into a calendar job record by calling the record_job tool.

Rules:
- Capture every concrete detail the speaker gives. Nothing should be dropped. Put each detail in the field it belongs to, using the tool's field descriptions.
- Speech-to-text makes mistakes. Correct obvious mishearings of names, places, numbers, and times using context, and use the crew list for names.
- Never invent details. If something isn't in the note, use "" for text fields and null for quoted_price.
- The price goes only in quoted_price. Pricing terms and context go in internal_notes. Neither goes in description.
- Write description as a short bulleted list a crew member can work from. Keep the speaker's specifics: quantities, measurements, names, phone numbers, codes, and times.`;

export async function parseVoiceEventText(text: string, crewNames: string[] = []): Promise<ParsedVoiceEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });
  const crewLine = crewNames.length > 0
    ? `Crew members: ${crewNames.join(", ")}. Speech-to-text often mishears names, so if the note names or sounds like one of them, use that crew member's name exactly as listed.`
    : "No crew list was provided.";

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [RECORD_JOB_TOOL],
    messages: [
      {
        role: "user",
        content: `Today is ${dayOfWeek}, ${todayStr}. ${crewLine}\n\nCall record_job with the job from this voice note:\n"""${text}"""`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Unexpected response from AI");
  }

  return normalize(toolUse.input as Record<string, unknown>);
}

// The model is asked for these types, but normalize anyway so the form never gets undefined or NaN.
function normalize(input: Record<string, unknown>): ParsedVoiceEvent {
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
  const price = typeof input.quoted_price === "number"
    ? input.quoted_price
    : typeof input.quoted_price === "string" ? parseFloat(input.quoted_price) : NaN;
  return {
    title: str("title"),
    date: str("date"),
    start_time: str("start_time"),
    end_time: str("end_time"),
    client: str("client"),
    location: str("location"),
    assigned_to: str("assigned_to"),
    description: str("description"),
    equipment_needed: str("equipment_needed"),
    internal_notes: str("internal_notes"),
    quoted_price: Number.isFinite(price) && price >= 0 ? price : null,
  };
}
