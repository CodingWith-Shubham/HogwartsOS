import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { getBackendUrlSync } from "@/lib/backend-url";

const tools = [
  {
    functionDeclarations: [
      {
        name: "get_client_by_lead_id",
        description:
          "Get a specific client or lead from the database by their lead ID. Use when user mentions a specific lead ID like HL-XXXXX.",
        parameters: {
          type: "OBJECT",
          properties: {
            lead_id: {
              type: "STRING",
              description: "The lead ID e.g. HL-MRUJE2WM",
            },
          },
          required: ["lead_id"],
        },
      },
      {
        name: "get_clients_list",
        description:
          "Get list of all clients and leads from the database, optionally filtered by status. Use for questions like 'show me all new leads' or 'how many clients do we have'.",
        parameters: {
          type: "OBJECT",
          properties: {
            status: {
              type: "STRING",
              description:
                "Filter by status. Valid values: New Lead, Proposal Sent, Proposal Accepted, Awaiting Payment, Payment Under Review, Awaiting Shoot, Shoot Scheduled, Shoot Done, Payment Completed",
            },
            limit: {
              type: "NUMBER",
              description: "Maximum number of results to return. Default 20.",
            },
          },
        },
      },
      {
        name: "get_payments",
        description:
          "Get payment records from the database. Use for questions about payments, pending amounts, verified payments.",
        parameters: {
          type: "OBJECT",
          properties: {
            lead_id: {
              type: "STRING",
              description: "Filter payments by lead ID",
            },
            payment_id: {
              type: "STRING",
              description: "Get a specific payment by payment ID",
            },
          },
        },
      },
      {
        name: "get_shoots",
        description:
          "Get shoot records from the database. Use for questions about scheduled shoots, upcoming shoots, shoot dates.",
        parameters: {
          type: "OBJECT",
          properties: {
            lead_id: {
              type: "STRING",
              description: "Filter shoots by lead ID",
            },
            shoot_date: {
              type: "STRING",
              description: "Filter shoots by date in YYYY-MM-DD format",
            },
          },
        },
      },
      {
        name: "get_editing_tasks",
        description:
          "Get editing tasks from the database. Use for questions about editing work, editor assignments, draft status.",
        parameters: {
          type: "OBJECT",
          properties: {
            editor_email: {
              type: "STRING",
              description: "Filter tasks by editor email address",
            },
          },
        },
      },
      {
        name: "get_users",
        description:
          "Get team members and users from the database. Use for questions about team members, editors, salespersons.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: {
              type: "STRING",
              description: "Filter users by name",
            },
            role: {
              type: "STRING",
              description:
                "Filter by role: admin, manager, sales, editor, shoot",
            },
          },
        },
      },
      {
        name: "get_dashboard_summary",
        description:
          "Get overall CRM dashboard summary and live statistics. Use for questions like 'how are we doing this month' or 'give me a summary'.",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
    ],
  },
];

async function executeExpressTool(
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
    headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
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
        return fetch(`${base}/realtime-data`, { headers }).then((r) => r.json());

      default:
        return { error: "Unknown tool" };
    }
  } catch (err) {
    return { error: "Tool execution failed", detail: String(err) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userRole, userEmail, userName } = await req.json();
    const token = req.headers.get("x-auth-token") || req.headers.get("authorization") || "";
    const firstName = userName?.split(" ")[0] || "there";

    const systemInstruction = `You are Aria, the AI assistant for Hogwarts Media Studio CRM. You help the internal team manage clients, shoots, payments, editing workflows, and general studio operations.

Current user: ${firstName} | Role: ${userRole} | Email: ${userEmail}

PERSONALITY: Professional, warm, concise. Address the user by their first name occasionally. Use emojis sparingly but meaningfully.

DATABASE ACCESS: You have live tools to query the CRM database. Use them proactively when users ask about specific clients, payments, shoots, tasks, or team members. Always fetch fresh data rather than guessing.

ROLE-BASED ACCESS RULES — strictly enforce these:
- admin / manager: full access to all tools and data
- sales: can only use get_clients_list, get_client_by_lead_id, get_payments. Politely decline other data requests.
- editor: can only use get_editing_tasks (filtered to their own email). Politely decline other data requests.
- shoot: can only use get_shoots. Politely decline other data requests.

HOGWARTS MEDIA STUDIO INFO (answer these without tools):
- Services: Podcast production, Reel editing, Long-format videos, Teasers, Thumbnails, Product shoots, Corporate videos
- Workflow: Lead → Proposal → Payment → Shoot → Editing → Delivery
- Payment modes: Online (UPI/Bank transfer) and Cash
- Editing statuses: Assigned → In Progress → Review → Completed
- Lead statuses: New Lead → Proposal Sent → Proposal Accepted → Awaiting Payment → Awaiting Shoot → Shoot Scheduled → Shoot Done → Payment Completed

RESPONSE FORMAT:
- Keep answers under 150 words unless showing data tables
- Use bullet points for lists of data
- Use bold for important values like amounts, dates, names
- When showing multiple records, format as a clean numbered list
- For errors or no data found, be helpful and suggest what to try instead`;

    const rawHistory = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const history: Array<any> = [];
    for (const msg of rawHistory) {
      if (history.length > 0 && history[history.length - 1].role === msg.role) {
        history[history.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
      } else {
        history.push(msg);
      }
    }
    
    if (history.length > 0 && history[0].role === "model") {
      history.shift();
    }

    const apiKey = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    let currentContents = [...history];

    const makeRequest = async (contents: any[]) => {
      const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools,
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API Error: ${res.status} ${errorText}`);
      }
      return res.json();
    };

    let responseJson = await makeRequest(currentContents);
    let iterations = 0;

    // Agentic loop
    while (
      responseJson.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall) &&
      iterations < 5
    ) {
      iterations++;
      const modelContent = responseJson.candidates[0].content;
      // Push exactly what the model returned to history, preserving thought_signatures
      currentContents.push(modelContent);

      const functionCalls = modelContent.parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
      const toolResultsParts = [];

      for (const call of functionCalls) {
        const result = await executeExpressTool(call.name, call.args, token);
        toolResultsParts.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      }

      // Add tool responses as a 'user' message
      currentContents.push({
        role: "user",
        parts: toolResultsParts,
      });

      responseJson = await makeRequest(currentContents);
    }

    const finalParts = responseJson.candidates?.[0]?.content?.parts || [];
    const textPart = finalParts.find((p: any) => p.text);
    
    return Response.json({ message: textPart?.text || "I processed the data." });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Failed to get response from Aria", details: err.message },
      { status: 500 }
    );
  }
}
