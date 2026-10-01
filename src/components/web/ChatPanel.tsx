import { AlignLeftIcon, ArrowDownToLineIcon, ArrowUpIcon, CheckIcon, HeadingIcon, TextCursorInputIcon, LightbulbIcon, ListTreeIcon, PenLineIcon, SparklesIcon, SquareIcon } from "lucide-react"
import Textarea from "../ui/Textarea"
import { useEffect, useRef, useState } from "react"
import { useActiveDoc, useDocuments } from "@/store/useDocuments"
import { httpClient } from "../../lib/httpClient"
import { LIMITS } from "../../types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function AiAvatar() {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-xs ">
      <SparklesIcon size={11} className="text-(--ink)" />
    </div>
  )
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let localIdCounter = 0
const localId = () => `local-${Date.now()}-${localIdCounter++}`

// Assistant replies are markdown. react-markdown doesn't render raw HTML, so
// model output can't inject markup; links open in a new tab.
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="typing-dots text-(--ink-faint)">
      <span />
      <span />
      <span />
    </span>
  )
}


const QUICK_ACTIONS = [
  {
    label: 'Continue writing',
    icon: PenLineIcon,
    prompt: 'Continue writing this document in the same voice and style, picking up naturally from where it leaves off.',
  },
  { label: 'Summarize', icon: AlignLeftIcon, prompt: 'Summarize this document in 3-5 concise sentences.' },
  {
    label: 'Outline',
    icon: ListTreeIcon,
    prompt: 'Produce a clear structural outline (headings and bullet points) for this document.',
  },
  {
    label: 'Brainstorm ideas',
    icon: LightbulbIcon,
    prompt: 'Brainstorm 5 fresh ideas or angles related to this document.',
  },
  { label: 'Suggest a title', icon: HeadingIcon, prompt: 'Suggest 5 compelling title options for this document.' },
]

export function ChatPanel() {

  const activeDoc = useActiveDoc()
  const activeDocId = activeDoc?.id
  const requestInsert = useDocuments((s) => s.requestInsert)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [added, setAdded] = useState<{ id: string; mode: 'cursor' | 'append' } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function onSend(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || busy || historyLoading) return

    setError(null)
    setInput('')
    const userMessageId = localId()
    const assistantMessageId = localId()
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', content: trimmed },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ])
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          documentId: activeDoc?.id ?? null,
        }),
        signal: controller.signal,
      })

      if (res.status === 401) {
        window.location.assign('/login')
        return
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Something went wrong. Please try again.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const next = prev.slice()
          next[next.length - 1] = { id: assistantMessageId, role: 'assistant', content: assistantText }
          return next
        })
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        // Nothing was answered (and nothing saved): drop the exchange and give
        // the prompt back so it can be retried.
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.id === assistantMessageId && !last.content) {
            setInput((current) => current || trimmed)
            return prev.filter((m) => m.id !== userMessageId && m.id !== assistantMessageId)
          }
          return prev
        })
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }
  function onStop() {
    abortRef.current?.abort()
  }

  function onAddToDocument(message: ChatMessage, mode: 'cursor' | 'append') {
    if (!message.content.trim()) return
    requestInsert(message.content, mode)
    setAdded({ id: message.id, mode })
    window.setTimeout(() => setAdded((current) => (current?.id === message.id ? null : current)), 2000)
  }


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    abortRef.current?.abort()
    setBusy(false)
    setError(null)
    setMessages([])

    if (!activeDocId) return

    let cancelled = false
    setHistoryLoading(true)
    httpClient
      .get(`/api/v1/documents/${activeDocId}/messages`)
      .then(({ data }) => {
        if (cancelled) return
        setMessages(
          (data as { id: string; role: 'user' | 'assistant'; content: string }[]).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        )
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Error loading chat history:', err)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDocId])


  return (
    <aside className="glass flex h-full w-80 shrink-0 flex-col border-l border-(--border)">
      <header className="flex items-center justify-between border-b border-(--border-soft) px-4 py-3 h-12 ">
        <div className="flex items-center gap-2">
          <AiAvatar />
          <span className="text-sm font-semibold text-(--ink)">Ask AI</span>
        </div>
      </header>

      <section ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {historyLoading ? (
          <p className="text-xs text-(--ink-faint)">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="mb-2 text-xs font-medium text-(--ink-faint)">Quick actions</p>
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => onSend(qa.prompt)}
                disabled={busy}
                className="group flex items-center gap-1 rounded-lg border border-(--border-soft) px-2 py-1.5 text-left text-sm text-(--ink) hover:border-(--border) hover:bg-(--surface-hover) disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--surface) text-(--accent-1) transition-colors group-hover:bg-[color-mix(in_srgb,var(--accent-1)_14%,var(--surface))]">
                  <qa.icon size={14} />
                </span>
                <span className="text-xs">{qa.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1
              const isStreamingThis = busy && isLast
              const isPendingAssistant = message.role === 'assistant' && !message.content && isStreamingThis
              const canAddToDoc =
                message.role === 'assistant' && message.content.trim() && !isStreamingThis && activeDoc

              return (
                <div key={message.id} className={message.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap rounded-xl bg-(--accent-1) px-3 py-2 text-sm text-white'
                        : 'max-w-[92%] min-w-0 rounded-xl bg-(--surface) px-3 py-2 text-sm text-(--ink)'
                    }
                  >
                    {isPendingAssistant ? (
                      <TypingDots />
                    ) : message.role === 'assistant' ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                  {canAddToDoc && (
                    <div className="mt-1 flex items-center gap-0.5">
                      {(['cursor', 'append'] as const).map((mode) => {
                        const done = added?.id === message.id && added.mode === mode
                        const Icon = done ? CheckIcon : mode === 'cursor' ? TextCursorInputIcon : ArrowDownToLineIcon
                        return (
                          <button
                            key={mode}
                            onClick={() => onAddToDocument(message, mode)}
                            title={mode === 'cursor' ? 'Insert at the cursor (replaces selected text)' : 'Add to the end of the document'}
                            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-(--ink-faint) hover:bg-(--surface-hover) hover:text-(--ink)"
                          >
                            <Icon size={11} />
                            {done ? (mode === 'cursor' ? 'Inserted' : 'Appended') : mode === 'cursor' ? 'Insert at cursor' : 'Append'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-(--danger)">{error}</p>}
      </section>
      <footer>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSend(input)
          }}
          className="border-t border-(--border-soft) p-3 relative"
        >
          <Textarea
            placeholder="Ask AI..."
            maxLength={LIMITS.promptMaxLength}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Don't send while an IME (e.g. Chinese/Japanese input) is composing.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                onSend(input)
              }
            }}
          />
          <div className="absolute right-5 bottom-5">
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="lift inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--surface-hover) text-(--ink)"
              >
                <SquareIcon size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim() || historyLoading}
                className="lift inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--accent-1) text-white disabled:opacity-30"
              >
                <ArrowUpIcon size={14} />
              </button>
            )}
          </div>
        </form>
      </footer>
    </aside>
  )
} 