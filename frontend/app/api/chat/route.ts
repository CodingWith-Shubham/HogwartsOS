import { NextRequest } from "next/server";
import { getBackendUrlSync } from "@/lib/backend-url";

// ── Tool definitions (OpenAI / Groq format) ──────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "get_client_by_lead_id",
      description: "Get client by lead ID e.g. HL-XXXXX",
      parameters: {
        type: "object",
        properties: { lead_id: { type: "string" } },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clients_list",
      description: "List clients, filter by status",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payments",
      description: "Get payments by lead ID or payment ID",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          payment_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shoots",
      description: "Get shoots by lead ID or date",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          shoot_date: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_editing_tasks",
      description: "Get editing tasks by editor email",
      parameters: {
        type: "object",
        properties: { editor_email: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_users",
      description: "Get team members by name or role",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Get dashboard summary",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description: "Action: 'my-attendance', 'team-attendance', 'summary', 'my-summary', 'my-leaves', 'leave-balance', 'team-leaves', 'lop-overrides', 'full-day-requests'",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string" },
          date: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  token?: string
): Promise<unknown> {
  const base = getBackendUrlSync();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-n8n-secret": process.env.N8N_SECRET || "",
  };

  if (token) {
    headers["Authorization"] = token.startsWith("Bearer ")
      ? token
      : `Bearer ${token}`;
  }

  try {
    switch (name) {
      case "get_client_by_lead_id":
        return fetch(`${base}/clients/${args.lead_id}`, { headers }).then((r) =>
          r.json()
        );

      case "get_clients_list": {
        const params = new URLSearchParams();
        if (args.status) params.set("status", String(args.status));
        if (args.limit) params.set("limit", String(args.limit));
        return fetch(`${base}/clients?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      case "get_payments": {
        const params = new URLSearchParams();
        if (args.lead_id) params.set("leadId", String(args.lead_id));
        if (args.payment_id) params.set("paymentId", String(args.payment_id));
        return fetch(`${base}/payments?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      case "get_shoots": {
        const params = new URLSearchParams();
        if (args.lead_id) params.set("leadId", String(args.lead_id));
        if (args.shoot_date) params.set("shootDate", String(args.shoot_date));
        return fetch(`${base}/shoots?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      case "get_editing_tasks": {
        const params = new URLSearchParams();
        if (args.editor_email)
          params.set("editorEmail", String(args.editor_email));
        return fetch(`${base}/editing?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      case "get_users": {
        const params = new URLSearchParams();
        if (args.name) params.set("name", String(args.name));
        if (args.role) params.set("role", String(args.role));
        return fetch(`${base}/users?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      case "get_dashboard_summary":
        return fetch(`${base}/realtime-data`, { headers }).then((r) =>
          r.json()
        );

      case "get_attendance": {
        const params = new URLSearchParams();
        const action = args.action ? String(args.action) : "my-attendance";
        params.set("action", action);
        if (args.date) params.set("date", String(args.date));
        if (args.startDate) params.set("startDate", String(args.startDate));
        if (args.endDate) params.set("endDate", String(args.endDate));
        return fetch(`${base}/attendance?${params}`, { headers }).then((r) =>
          r.json()
        );
      }

      default:
        return { error: "Unknown tool" };
    }
  } catch (err) {
    return { error: "Tool execution failed", detail: String(err) };
  }
}

// ── Gemini API call via OpenAI Compatibility Endpoint ─────────────────────────

async function callGeminiOpenAI(
  messages: unknown[],
  apiKey: string,
  retries = 4
): Promise<any> {
  const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const model = "gemini-2.5-flash";

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    // Rate limit — wait and retry
    if (res.status === 429) {
      const waitMs = 20000;
      console.warn(`⏳ Gemini rate limit hit. Waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API Error: ${res.status} ${errorText}`);
    }

    return res.json();
  }

  throw new Error("Gemini API Error: Rate limit exceeded after multiple retries. Please try again in a moment.");
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, userRole, userEmail, userName } = await req.json();
    const token =
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization") ||
      "";
    const firstName = userName?.split(" ")[0] || "there";

    const systemPrompt = `You are Aria, the AI assistant for Hogwarts Media Studio CRM. You help the internal team manage clients, shoots, payments, editing workflows, and general studio operations.

Current user: ${firstName} | Role: ${userRole} | Email: ${userEmail}

PERSONALITY: Professional, warm, concise. Address the user by their first name occasionally. Use emojis sparingly but meaningfully.

DATABASE ACCESS: You have live tools to query the CRM database. Use them proactively when users ask about specific clients, payments, shoots, tasks, attendance, or team members. Always fetch fresh data rather than guessing.

ROLE-BASED ACCESS RULES — strictly enforce these:
- admin / manager / super_admin: full access to all tools and data
- sales: can only use get_clients_list, get_client_by_lead_id, get_payments, get_attendance (my-attendance, my-leaves, leave-balance only). Politely decline other data requests.
- editor: can only use get_editing_tasks (filtered to their own email), get_attendance (my-attendance, my-leaves, leave-balance only). Politely decline other data requests.
- shoot: can only use get_shoots, get_attendance (my-attendance, my-leaves, leave-balance only). Politely decline other data requests.

HOGWARTS MEDIA STUDIO INFO (answer these without tools):
- Services: Podcast production, Reel editing, Long-format videos, Teasers, Thumbnails, Product shoots, Corporate videos
- Workflow: Lead → Proposal → Payment → Shoot → Editing → Delivery
- Payment modes: Online (UPI/Bank transfer) and Cash
- Editing statuses: Assigned → In Progress → Review → Completed
- Lead statuses: New Lead → Proposal Sent → Proposal Accepted → Awaiting Payment → Awaiting Shoot → Shoot Scheduled → Shoot Done → Payment Completed
- Attendance: Tracked per employee daily. Statuses include Present, Absent, Late, Half Day, Weekly Off, Leave. Use get_attendance tool with the appropriate action to fetch real data.

RESPONSE FORMAT:
- Keep answers under 150 words unless showing data tables
- Use bullet points for lists of data
- Use bold for important values like amounts, dates, names
- When showing multiple records, format as a clean numbered list
- For errors or no data found, be helpful and suggest what to try instead`;

    // Build OpenAI-format message history
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];

    // Only take the last 10 messages from the conversation history
    const recentMessages = messages.slice(-10);

    for (const m of recentMessages) {
      aiMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY!;

    // Agentic loop — keep calling until no more tool calls (max 5 iterations)
    let iterations = 0;

    while (iterations < 5) {
      const responseJson = await callGeminiOpenAI(aiMessages, apiKey);
      const choice = responseJson.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) {
        throw new Error("Empty response from Gemini API");
      }

      // Push assistant message (may contain tool_calls)
      aiMessages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls;

      // No tool calls → final text response
      if (!toolCalls || toolCalls.length === 0) {
        const text = assistantMsg.content || "I processed the data.";
        return Response.json({ message: text });
      }

      // Execute each tool call and push results
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}

        const result = await executeTool(call.function.name, args, token);

        // Prevent massive payloads from crashing the AI
        let stringifiedResult = JSON.stringify(result);
        if (stringifiedResult.length > 5000) {
          stringifiedResult = stringifiedResult.substring(0, 5000) + 
          "... [DATA TRUNCATED: The result was too large. Please narrow your search criteria.]";
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: stringifiedResult,
        });
      }

      iterations++;
    }

    // Fallback: ask for a plain response after max iterations
    aiMessages.push({
      role: "user",
      content: "Please summarise the data you have retrieved so far.",
    });
    const finalJson = await callGeminiOpenAI(aiMessages, apiKey);
    const finalText =
      finalJson.choices?.[0]?.message?.content || "I processed the data.";
    return Response.json({ message: finalText });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Failed to get response from Aria", details: err.message },
      { status: 500 }
    );
  }
}
