"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

// ─── Markdown renderer ─────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let keyIdx = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul
          key={`ul-${keyIdx++}`}
          className="list-disc list-inside space-y-0.5 my-1"
        >
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (const line of lines) {
    const isBullet = /^[-•*]\s+/.test(line);
    const isNumbered = /^\d+\.\s+/.test(line);
    if (isBullet) {
      listBuffer.push(line.replace(/^[-•*]\s+/, ""));
    } else if (isNumbered) {
      listBuffer.push(line.replace(/^\d+\.\s+/, ""));
    } else {
      flushList();
      if (line.trim() === "") {
        nodes.push(<br key={`br-${keyIdx++}`} />);
      } else {
        nodes.push(<span key={`span-${keyIdx++}`}>{renderInline(line)}</span>);
        nodes.push(<br key={`br2-${keyIdx++}`} />);
      }
    }
  }
  flushList();
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Typing indicator ───────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm max-w-[85%]"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid rgba(99,102,241,0.15)",
          color: "white",
        }}
      >
        <div className="flex gap-1 items-center h-4">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block w-2 h-2 rounded-full animate-bounce"
              style={{
                background: "hsl(var(--theme-accent))",
                animationDelay: `${delay}ms`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Suggested chips ────────────────────────────────────────────────────────

const SUGGESTED = [
  "📊 Show dashboard summary",
  "📅 Today's shoots",
  "💰 Pending payments",
];

// ─── Main component ─────────────────────────────────────────────────────────

export default function ChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Greeting on first open
  useEffect(() => {
    if (isOpen && !hasGreeted && user) {
      const firstName = user.name?.split(" ")[0] || "there";
      const greetingMsg: Message = {
        id: `greeting-${Date.now()}`,
        role: "assistant",
        content: `Hi ${firstName}! 👋 I'm Aria, your CRM assistant for Hogwarts Media.\n\nI can look up clients, payments, shoots, editing tasks, and answer questions about the studio. What can I help you with?`,
        timestamp: new Date(),
      };
      setMessages([greetingMsg]);
      setHasGreeted(true);
    }
  }, [isOpen, hasGreeted, user]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);

      try {
        const res = await authFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            userRole: user?.role,
            userEmail: user?.email,
            userName: user?.name,
          }),
        });

        const data = await res.json();

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            data.message ||
            data.error ||
            "⚠️ Something went wrong. Please try again.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "⚠️ Something went wrong. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, user]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!user) return null;

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────── */}
      <button
        id="aria-chatbot-trigger"
        aria-label="Open Aria AI assistant"
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]"
        style={{
          width: 56,
          height: 56,
          background: "hsl(var(--card))",
          border: "1.5px solid hsl(var(--theme-accent))",
          boxShadow: "0 0 20px rgba(99,102,241,0.4)",
        }}
      >
        {isOpen ? (
          <X size={22} color="white" />
        ) : (
          <>
            <MessageCircle size={24} color="white" />
            {/* Notification dot */}
            {!hasGreeted && (
              <span
                className="absolute top-0 right-0 block rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: "hsl(var(--danger))",
                  border: "2px solid hsl(var(--background))",
                  top: 2,
                  right: 2,
                }}
              />
            )}
          </>
        )}
      </button>

      {/* ── Chat window ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="aria-chat-window"
          className="fixed z-40 flex flex-col"
          style={{
            // Mobile: full screen; Desktop: fixed position near button
            bottom: "var(--chat-bottom, 96px)",
            right: "var(--chat-right, 24px)",
            width: "min(384px, calc(100vw - 16px))",
            height: "min(520px, calc(100vh - 112px))",
            background: "hsl(var(--background))",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 16,
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            animation: "aria-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{
              background: "hsl(var(--card))",
              borderBottom: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "16px 16px 0 0",
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} color="hsl(var(--theme-accent))" />
              <span className="font-bold text-foreground text-sm">Aria</span>
              <span className="text-xs" style={{ color: "hsl(var(--success))" }}>
                ● Online
              </span>
            </div>
            <button
              id="aria-chat-close"
              aria-label="Close Aria assistant"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 transition-colors hover:bg-white/10"
            >
              <X size={16} color="rgba(255,255,255,0.7)" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className="px-4 py-2.5 text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          background: "hsl(var(--theme-accent))",
                          color: "white",
                          borderRadius: "16px 16px 4px 16px",
                          maxWidth: "80%",
                        }
                      : {
                          background: "hsl(var(--card))",
                          color: "hsl(var(--foreground))",
                          borderRadius: "16px 16px 16px 4px",
                          border: "1px solid rgba(99,102,241,0.15)",
                          maxWidth: "85%",
                        }
                  }
                >
                  {msg.role === "assistant" ? (
                    renderMarkdown(msg.content)
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
                <span
                  className="text-xs mt-1 px-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}

            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested chips — only when conversation is empty/greeting only */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              {SUGGESTED.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  style={{
                    border: "1px solid rgba(99,102,241,0.4)",
                    color: "rgba(255,255,255,0.75)",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(99,102,241,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div
            className="flex items-center gap-2 px-3 py-3 shrink-0"
            style={{ borderTop: "1px solid rgba(99,102,241,0.2)" }}
          >
            <input
              ref={inputRef}
              id="aria-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask Aria anything..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none rounded-xl px-3 py-2.5 disabled:opacity-50"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            />
            <button
              id="aria-chat-send"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              aria-label="Send message to Aria"
              className="flex items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
              style={{
                background: "hsl(var(--theme-accent))",
                padding: 10,
                minWidth: 40,
                minHeight: 40,
              }}
            >
              {isLoading ? (
                <Loader2 size={16} color="white" className="animate-spin" />
              ) : (
                <Send size={16} color="white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Keyframe animation ──────────────────────────────────────── */}
      <style>{`
        @keyframes aria-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @media (max-width: 639px) {
          #aria-chat-window {
            --chat-bottom: 0;
            --chat-right: 0;
            width: 100vw !important;
            height: 100dvh !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
