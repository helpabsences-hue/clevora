"use client";

import { ExternalLinkIcon, LoaderCircleIcon, RotateCcwIcon, SendIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";

type Source = { label: string; href: string };
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  tool?: string | null;
  sources?: Source[];
  error?: string;
  pending?: boolean;
};

const MAX = 1000;

/**
 * The conversation lives only in this browser tab (never saved on the server).
 * Each answer streams in as NDJSON events from /api/assistant.
 */
export function Chat({ suggestions, remaining }: { suggestions: string[]; remaining: number | null }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(remaining);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  const update = (id: number, patch: (m: Message) => Partial<Message>) =>
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));

  const ask = async (text: string) => {
    const q = text.trim().slice(0, MAX);
    if (!q || busy) return;
    const history = messages.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, text: m.text }));
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((list) => [...list, { id: userId, role: "user", text: q }, { id: botId, role: "assistant", text: "", pending: true, tool: null }]);
    setQuestion("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history, locale }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        update(botId, () => ({ error: body.error ?? "unavailable", pending: false }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as { type: string; delta?: string; name?: string; sources?: Source[]; error?: string };
          if (e.type === "text" && e.delta) update(botId, (m) => ({ text: m.text + e.delta, tool: null }));
          else if (e.type === "tool") update(botId, () => ({ tool: e.name ?? null }));
          else if (e.type === "sources") update(botId, () => ({ sources: e.sources }));
          else if (e.type === "error") update(botId, () => ({ error: e.error ?? "unavailable" }));
        }
      }
      setLeft((n) => (n === null ? n : Math.max(0, n - 1)));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) update(botId, () => ({ error: "unavailable" }));
    } finally {
      update(botId, (m) => ({ pending: false, text: m.text.trim() }));
      setBusy(false);
      abort.current = null;
      inputRef.current?.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(question);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <section aria-labelledby="suggest-title" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 id="suggest-title" className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="size-5 text-primary" aria-hidden />
            {t("tryTitle")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void ask(s)}
                  className="flex min-h-12 w-full items-center rounded-lg border bg-background px-3 py-2 text-start text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  data-testid="assistant-suggestion"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ol className="flex flex-col gap-4" aria-live="polite" aria-label={t("conversation")} data-testid="assistant-messages">
          {messages.map((m) =>
            m.role === "user" ? (
              <li key={m.id} className="flex justify-end">
                <p dir="auto" className="max-w-[85%] rounded-2xl rounded-ee-sm bg-primary px-4 py-2 text-primary-foreground [overflow-wrap:anywhere]">{m.text}</p>
              </li>
            ) : (
              <li key={m.id} className="flex flex-col gap-2 rounded-2xl rounded-es-sm border bg-card p-4" data-testid="assistant-answer">
                {m.text ? <AnswerText text={m.text} /> : null}
                {m.pending && !m.text ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                    {m.tool ? t(`tools.${m.tool}`) : t("thinking")}
                  </p>
                ) : null}
                {m.error ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {t(`errors.${m.error}`)}
                  </p>
                ) : null}
                {m.sources?.length ? (
                  <div className="flex flex-col gap-1 border-t pt-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("sources")}</span>
                    <ul className="flex flex-wrap gap-2" data-testid="assistant-sources">
                      {m.sources.map((s) => (
                        <li key={s.href}>
                          <Link href={s.href} className="inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm hover:bg-accent">
                            <ExternalLinkIcon className="size-3.5 rtl:-scale-x-100" aria-hidden />
                            <span dir="auto">{s.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ol>
      )}
      <div ref={endRef} />

      <form
        onSubmit={submit}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t bg-card/95 p-3 backdrop-blur md:sticky md:bottom-4 md:rounded-xl md:border md:bg-card md:shadow-sm md:backdrop-blur-none"
      >
        <label htmlFor="assistant-question" className="sr-only">{t("questionLabel")}</label>
        <div className="mx-auto flex max-w-3xl items-end gap-2 md:max-w-none">
          <Textarea
            ref={inputRef}
            id="assistant-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX))}
            onKeyDown={onKey}
            placeholder={t("placeholder")}
            rows={1}
            dir="auto"
            className="max-h-40 min-h-12 flex-1 resize-none"
            disabled={left === 0}
          />
          {busy ? (
            <Button type="button" size="lg" variant="outline" onClick={() => abort.current?.abort()}>
              <SquareIcon aria-hidden />
              {t("stop")}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!question.trim() || left === 0}>
              <SendIcon className="rtl:-scale-x-100" aria-hidden />
              {t("send")}
            </Button>
          )}
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground md:max-w-none">
          <span>{left === null ? t("privacyShort") : t("remaining", { count: left })}</span>
          {messages.length ? (
            <button type="button" onClick={() => setMessages([])} disabled={busy} className={cn("inline-flex min-h-11 items-center gap-1 font-medium hover:text-foreground", busy && "opacity-50")}>
              <RotateCcwIcon className="size-3.5" aria-hidden />
              {t("newChat")}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
