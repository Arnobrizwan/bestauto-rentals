"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn, formatCurrency } from "@/lib/utils";

type VehicleChip = {
  slug: string;
  name: string;
  pricePerDay: number;
  seats: number;
  transmission: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  vehicles?: VehicleChip[];
  suggestions?: string[];
  /*
   * Deliberately no engine, latency, tool names or lead score.
   *
   * All four were rendered under the assistant's answers, and all four are
   * operations detail wearing a customer's clothes: a `search_vehicles` chip
   * means nothing to someone booking a car, and "scored 42/100 (cold)" tells
   * them how the sales team ranks them. The server still returns and stores
   * every one of them — the admin AI console is where they belong.
   */
  leadCaptured?: boolean;
};

const OPENER: Message = {
  id: "opener",
  role: "assistant",
  content:
    "Hello — I look after bookings at Best Auto. Tell me who's travelling, roughly when, and what you'd like to spend a day, and I'll pull up the right cars.",
  // Fully specified on purpose. "Something cheap for city driving" and "A
  // 7-seater for a family holiday" name no branch, no party size and no
  // duration, and the hosted model answered both with prose and no search —
  // so the first thing anyone opening the widget clicked returned zero cars.
  // A chip is a demo of the product, not a test of the model's willingness to
  // guess. The guardrail in the agent now forces a search on either wording;
  // these give it real slots to search with as well.
  suggestions: [
    "A cheap automatic in Dhaka for 3 days",
    "A 7-seater for 6 people going to Cox's Bazar",
    "What's the insurance excess?",
  ],
};

function newSessionId() {
  try {
    const existing = window.sessionStorage.getItem("bestauto.session");
    if (existing) return existing;
    const id = `s_${crypto.randomUUID().slice(0, 12)}`;
    window.sessionStorage.setItem("bestauto.session", id);
    return id;
  } catch {
    return `s_${Math.random().toString(36).slice(2, 14)}`;
  }
}

/**
 * Floating AI concierge.
 *
 * Only the new turn is sent each turn; the server reads history back from the
 * database and persists the transcript for the admin AI console. Which engine
 * answered, how long it took, which tools it called and how a lead scored are
 * all recorded there — none of it is shown here, because none of it is the
 * customer's business.
 */
export function Concierge() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([OPENER]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string>("");
  const idRef = useRef(0);
  const nextId = () => String(++idRef.current);

  useEffect(() => {
    sessionRef.current = newSessionId();
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, busy]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  function togglePanel() {
    setOpen((wasOpen) => {
      if (!wasOpen) setUnread(false);
      return !wasOpen;
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMessage: Message = {
      id: `u_${nextId()}`,
      role: "user",
      content: trimmed,
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only the new turn. The server reads the conversation back from the
        // database by session, so it is not the browser's job to say what was
        // already said.
        body: JSON.stringify({
          sessionId: sessionRef.current,
          message: trimmed,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 429
            ? "That's a lot of questions at once — give me a few seconds."
            : "I couldn't reach the booking system just then.",
        );
      }

      // The assistant bubble appears empty and fills as the words arrive.
      const replyId = `a_${nextId()}`;
      setMessages((prev) => [
        ...prev,
        { id: replyId, role: "assistant", content: "" },
      ]);

      const patch = (change: Partial<Message>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, ...change } : m)),
        );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // An event ends at a blank line, and one read can hold a fraction of
        // an event or several at once.
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;

          let payload: {
            type: string;
            text?: string;
            error?: string;
            message?: string;
            vehicles?: VehicleChip[];
            suggestions?: string[];
            // The wire still carries engine, latency and tool calls — the
            // server records them for the admin console. None are read here.
            leadCaptured?: { tier: string; score: number };
          };
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (payload.type === "delta" && payload.text) {
            streamed += payload.text;
            patch({ content: streamed });
          } else if (payload.type === "reset") {
            // Those words belonged to a turn that then called a tool, or to a
            // model call that failed and was replaced. They are not the answer.
            streamed = "";
            patch({ content: "" });
          } else if (payload.type === "error") {
            throw new Error(
              payload.error ?? "The assistant is unavailable right now.",
            );
          } else if (payload.type === "done") {
            patch({
              content: payload.message ?? streamed,
              vehicles: payload.vehicles,
              suggestions: payload.suggestions,
              leadCaptured: Boolean(payload.leadCaptured),
            });
          }
        }
      }

      if (!open) setUnread(true);
    } catch (err) {
      // Drop a bubble that never received any words, so a failure does not
      // leave an empty assistant message sitting in the transcript.
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "assistant" && m.content === "")),
      );
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const last = messages[messages.length - 1];
  const suggestions =
    !busy && last?.role === "assistant" ? (last.suggestions ?? []) : [];

  return (
    <>
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-controls="concierge-panel"
        aria-label={
          open ? "Close the booking assistant" : "Open the booking assistant"
        }
        className={cn(
          "fixed right-4 bottom-4 z-60 grid size-14 place-items-center rounded-full text-white shadow-pop transition-all duration-300 sm:right-6 sm:bottom-6",
          open
            ? "rotate-90 bg-ink-900"
            : "bg-brand-400 hover:scale-105 hover:bg-brand-500",
        )}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path
              d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-2.9-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
          </svg>
        )}
        {unread && !open && (
          <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white bg-danger" />
        )}
      </button>

      <div
        id="concierge-panel"
        role="dialog"
        aria-label="Best Auto booking assistant"
        aria-modal="false"
        className={cn(
          "fixed right-0 bottom-0 z-55 flex w-full flex-col overflow-hidden bg-white transition-all duration-300 sm:right-6 sm:bottom-24 sm:w-[400px] sm:rounded-2xl sm:border sm:border-line sm:shadow-pop",
          open
            ? "pointer-events-auto h-[86dvh] translate-y-0 opacity-100 sm:h-[600px]"
            : "pointer-events-none h-0 translate-y-6 opacity-0",
        )}
      >
        <header className="flex items-center gap-3 border-b border-line bg-ink-900 px-4 py-3.5 text-white">
          <span className="relative grid size-9 place-items-center rounded-full bg-brand-400">
            <svg
              viewBox="0 0 24 24"
              className="size-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
              <path
                d="M5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">
              Booking assistant
            </p>
            {/*
              Says what the assistant does, never which model is doing it. This
              line rendered the raw model id — "qwen-plus" — to customers as
              soon as a hosted model answered. That is an internal detail: it
              means nothing to someone booking a car, it dates the product the
              day the model is swapped, and it needlessly tells the world which
              vendor sits behind the endpoint. Which engine answered is still
              recorded per message and shown in the admin AI console, where it
              is actually useful.
            */}
            <p className="flex items-center gap-1.5 text-[11px] text-white/50">
              <span className="size-1.5 rounded-full bg-success" />
              Checks live availability
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          ref={scrollRef}
          className="scroll-slim flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[86%] space-y-2",
                  message.role === "user" && "items-end",
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line",
                    message.role === "user"
                      ? "rounded-br-md bg-ink-900 text-white"
                      : "rounded-bl-md border border-line bg-white text-ink-700",
                  )}
                >
                  {message.content}
                </div>

                {message.vehicles && message.vehicles.length > 0 && (
                  <div className="space-y-1.5">
                    {message.vehicles.map((v) => (
                      <Link
                        key={v.slug}
                        href={`/cars/${v.slug}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5 transition-all hover:border-brand-400 hover:shadow-card"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink-900">
                            {v.name}
                          </span>
                          <span className="block text-[11px] text-ink-400">
                            {v.seats} seats · {v.transmission}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-bold text-brand-500">
                          {formatCurrency(v.pricePerDay)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {message.leadCaptured && (
                  <p className="rounded-lg bg-success-soft px-3 py-2 text-[12px] font-medium text-success">
                    Passed to our booking team — they will be in touch shortly.
                  </p>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex gap-1.5 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-ink-300"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger"
            >
              {error}
            </p>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-line bg-white px-4 py-2.5 no-scrollbar">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="shrink-0 rounded-full border border-ink-200 px-3 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 border-t border-line bg-white px-3 py-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Ask about cars, prices or policies…"
            aria-label="Message the booking assistant"
            className="h-11 flex-1 rounded-xl bg-canvas px-3.5 text-[14px] text-ink-900 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-400 text-white transition-colors hover:bg-brand-500 disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M4.5 12h15m0 0-6-6m6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
