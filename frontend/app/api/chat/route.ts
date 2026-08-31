import { NextRequest } from "next/server";
import { getBackendUrlSync } from "@/lib/backend-url";

// ── Tool definitions (OpenAI / Groq format) ──────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "get_client_by_lead_id",
      description:
        "Get a specific client or lead from the database by their lead ID. Use when user mentions a specific lead ID like HL-XXXXX.",
      parameters: {
        type: "object",
        properties: {
          lead_id: {
            type: "string",
            description: "The lead ID e.g. HL-MRUJE2WM",
          },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clients_list",
      description:
        "Get list of all clients and leads from the database, optionally filtered by status. Use for questions like 'show me all new leads' or 'how many clients do we have'.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Filter by status. Valid values: New Lead, Proposal Sent, Proposal Accepted, Awaiting Payment, Payment Under Review, Awaiting Shoot, Shoot Scheduled, Shoot Done, Payment Completed",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return. Default 20.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payments",
      description:
        "Get payment records from the database. Use for questions about payments, pending amounts, verified payments.",
      parameters: {
        type: "object",
        properties: {
          lead_id: {
            type: "string",
            description: "Filter payments by lead ID",
          },
          payment_id: {
            type: "string",
            description: "Get a specific payment by payment ID",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shoots",
      description:
        "Get shoot records from the database. Use for questions about scheduled shoots, upcoming shoots, shoot dates.",
      parameters: {
        type: "object",
        properties: {
          lead_id: {
            type: "string",
            description: "Filter shoots by lead ID",
          },
          shoot_date: {
            type: "string",
            description: "Filter shoots by date in YYYY-MM-DD format",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_editing_tasks",
      description:
        "Get editing tasks from the database. Use for questions about editing work, editor assignments, draft status.",
      parameters: {
        type: "object",
        properties: {
          editor_email: {
            type: "string",
            description: "Filter tasks by editor email address",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_users",
      description:
        "Get team members and users from the database. Use for questions about team members, editors, salespersons.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Filter users by name",
          },
          role: {
            type: "string",
            description:
              "Filter by role: admin, manager, sales, editor, shoot",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description:
        "Get overall CRM dashboard summary and live statistics. Use for questions like 'how are we doing this month' or 'give me a summary'.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description:
        "Get attendance data from the CRM. Use for any questions about attendance, check-ins, check-outs, leaves, leave balance, team attendance, LOP (Loss of Pay), absences, late arrivals, or monthly attendance summary. Actions available: 'my-attendance' (personal today's record), 'team-attendance' (full team for a date), 'summary' (team summary for a date range), 'my-summary' (personal monthly breakdown), 'my-leaves' (personal leave history), 'leave-balance' (remaining leaves), 'team-leaves' (pending team leave requests), 'lop-overrides' (LOP override requests), 'full-day-requests' (pending full-day work-from-home requests).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description:
              "Which attendance data to fetch. One of: 'my-attendance', 'team-attendance', 'summary', 'my-summary', 'my-leaves', 'leave-balance', 'team-leaves', 'lop-overrides', 'full-day-requests'. Defaults to 'my-attendance'.",
          },
          date: {
            type: "string",
            description:
              "Date in YYYY-MM-DD format. Required for 'team-attendance'. Optional for others.",
          },
          startDate: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD format. Used with 'summary' action.",
          },
          endDate: {
            type: "string",
            description:
              "End date in YYYY-MM-DD format. Used with 'summary' action.",
          },
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

// ── Dynamic model resolution ──────────────────────────────────────────────────
// Preferred models in order — best tool-use quality first.
// The resolver picks the first one that exists on the account's tier.
const MODEL_PREFERENCE = [
  "llama-3.3-70b-specdec",
  "llama-3.3-70b-versatile",
  "llama3-groq-70b-8192-tool-use-preview",
  "llama-3.1-70b-versatile",
  "llama3-groq-8b-8192-tool-use-preview",
  "llama-3.1-8b-instant",
];

let cachedModel: string | null = null;

async function resolveGroqModel(apiKey: string): Promise<string> {
  if (cachedModel) return cachedModel;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error("Could not fetch model list");
    const data = await res.json();
    const available: string[] = (data.data ?? []).map((m: any) => m.id);

    for (const preferred of MODEL_PREFERENCE) {
      if (available.includes(preferred)) {
        console.log(`✅ Groq model selected: ${preferred}`);
        cachedModel = preferred;
        return preferred;
      }
    }

    // Fallback: use first available model
    if (available.length > 0) {
      console.warn(`⚠️ No preferred model available, falling back to: ${available[0]}`);
      cachedModel = available[0];
      return available[0];
    }
  } catch (e) {
    console.error("Model resolution failed, using default fallback:", e);
  }

  // Hard fallback if model list fetch itself fails
  return "llama-3.1-8b-instant";
}

// ── Groq API call with retry + backoff on 429 / model rotation on 404 ─────────

async function callGroq(
  messages: unknown[],
  apiKey: string,
  retries = 4
): Promise<any> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  let model = await resolveGroqModel(apiKey);

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
        max_tokens: 1024,
      }),
    });

    // Rate limit — wait and retry
    if (res.status === 429) {
      let waitMs = 20000;
      try {
        const errBody = await res.json();
        const retryMatch = errBody?.error?.message?.match(/retry in ([\d.]+)/i);
        if (retryMatch) waitMs = (parseFloat(retryMatch[1]) + 2) * 1000;
      } catch {}
      console.warn(`⏳ Groq rate limit. Waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    // Model not found — clear cache, rotate to next preferred model
    if (res.status === 404) {
      console.warn(`⚠️ Model "${model}" not available, rotating to next...`);
      cachedModel = null;
      const currentIdx = MODEL_PREFERENCE.indexOf(model);
      const next = MODEL_PREFERENCE.slice(currentIdx + 1);
      model = next.length > 0 ? next[0] : "llama-3.1-8b-instant";
      cachedModel = model;
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error: ${res.status} ${errorText}`);
    }

    return res.json();
  }

  throw new Error("Groq API Error: Rate limit exceeded after multiple retries. Please try again in a moment.");
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
    const groqMessages: any[] = [{ role: "system", content: systemPrompt }];

    for (const m of messages) {
      groqMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    const apiKey = process.env.GROQ_API_KEY!;

    // Agentic loop — keep calling until no more tool calls (max 5 iterations)
    let iterations = 0;

    while (iterations < 5) {
      const responseJson = await callGroq(groqMessages, apiKey);
      const choice = responseJson.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) {
        throw new Error("Empty response from Groq");
      }

      // Push assistant message (may contain tool_calls)
      groqMessages.push(assistantMsg);

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

        groqMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      iterations++;
    }

    // Fallback: ask for a plain response after max iterations
    groqMessages.push({
      role: "user",
      content: "Please summarise the data you have retrieved so far.",
    });
    const finalJson = await callGroq(groqMessages, apiKey);
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
