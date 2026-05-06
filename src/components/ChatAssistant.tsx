import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Mail, NotebookPen, CalendarClock, Search, Sparkles, Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };
type Mode = "general" | "email" | "meeting" | "planner" | "research";

const MODES: Array<{ id: Mode; label: string; icon: typeof Mail; hint: string; placeholder: string }> = [
  { id: "general", label: "Assistant", icon: Sparkles, hint: "Ask anything — I'll detect the task.", placeholder: "How can I help you work smarter today?" },
  { id: "email", label: "Email", icon: Mail, hint: "Draft polished emails.", placeholder: "Write a follow-up email to a client about the delayed deliverable…" },
  { id: "meeting", label: "Meeting Notes", icon: NotebookPen, hint: "Summarize notes & extract actions.", placeholder: "Paste meeting notes or transcript here…" },
  { id: "planner", label: "Task Planner", icon: CalendarClock, hint: "Plan & time-block your day.", placeholder: "Plan my day: design review, 3 emails, gym, deep-work on Q3 deck…" },
  { id: "research", label: "Research", icon: Search, hint: "Synthesize topics with insights.", placeholder: "Explain the trade-offs of OKRs vs KPIs for a 20-person team…" },
];

const STARTERS: Record<Mode, string[]> = {
  general: ["Summarize my workload priorities", "Help me say no professionally", "Suggest a daily routine"],
  email: ["Follow-up after a client meeting", "Decline a meeting politely", "Ask manager for a raise"],
  meeting: ["Summarize a 1:1 with my manager", "Extract action items from a standup"],
  planner: ["Plan a 6-hour focused workday", "Organize a project launch week"],
  research: ["Compare async vs sync work", "Best practices for remote 1:1s"],
};

export function ChatAssistant() {
  const [mode, setMode] = useState<Mode>("general");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const current = MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 220) + "px";
    }
  }, [input]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, mode }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        let msg = "Something went wrong. Please try again.";
        try {
          const j = JSON.parse(errText);
          if (j.error) msg = j.error;
        } catch {}
        toast.error(msg);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let done = false;
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              acc += delta;
              setMessages((p) => p.map((m, i) => (i === p.length - 1 ? { ...m, content: acc } : m)));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-deep shadow-soft">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold leading-none">Sidekick</h1>
              <p className="mt-1 text-xs text-muted-foreground">Your workplace productivity assistant</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      {/* Mode tabs */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3">
          <div className="flex gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 ? (
            <EmptyState mode={mode} hint={current.hint} starters={STARTERS[mode]} onPick={send} />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} streaming={loading && i === messages.length - 1 && m.role === "assistant"} />
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-soft focus-within:border-foreground/30"
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={current.placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-warm text-accent-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            AI-generated content. Review before using for critical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-deep">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-card-foreground rounded-bl-sm shadow-soft",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || "…"}</ReactMarkdown>
            {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function EmptyState({
  mode,
  hint,
  starters,
  onPick,
}: {
  mode: Mode;
  hint: string;
  starters: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-deep shadow-glow">
        <Sparkles className="h-7 w-7 text-accent" />
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Work smarter, <span className="italic text-muted-foreground">not harder.</span>
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">{hint}</p>

      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition hover:border-foreground/20 hover:shadow-soft"
          >
            <span className="text-muted-foreground transition group-hover:text-foreground">→</span>{" "}
            {s}
          </button>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>· Emails</span>
        <span>· Meeting summaries</span>
        <span>· Day planning</span>
        <span>· Research</span>
      </div>
    </div>
  );
}
