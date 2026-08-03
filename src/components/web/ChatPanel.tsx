import { AlignLeftIcon, ArrowUpIcon, HeadingIcon, LightbulbIcon, ListTreeIcon, PenLineIcon, SparklesIcon, SquareIcon } from "lucide-react"
import Textarea from "../ui/Textarea"
import { useEffect, useRef, useState } from "react"

function AiAvatar() {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-xs ">
      <SparklesIcon size={11} className="text-(--ink)" />
    </div>
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

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function onSend(prompt: string) {

    if (!prompt.trim() || busy) return
    setError(null)
    setInput('')
  }
  function onStop() {
    abortRef.current?.abort()
  }


  useEffect(() => {
    setError(null)
  }, [])


  return (
    <aside className="glass flex h-full w-80 shrink-0 flex-col border-l border-(--border)">
      <header className="flex items-center justify-between border-b border-(--border-soft) px-4 py-3 h-12 ">
        <div className="flex items-center gap-2">
          <AiAvatar />
          <span className="text-sm font-semibold text-(--ink)">Ask AI</span>
        </div>


      </header>

      <section ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">

        <div className="flex flex-col gap-1.5">
          <p className="mb-2 text-xs font-medium text-(--ink-faint)">Quick actions</p>
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              // onClick={() => send(qa.prompt)}
              className="group flex items-center gap-1 rounded-lg border border-(--border-soft) px-2 py-1.5 text-left text-sm text-(--ink) hover:border-(--border) hover:bg-(--surface-hover)"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--surface) text-(--accent-1) transition-colors group-hover:bg-[color-mix(in_srgb,var(--accent-1)_14%,var(--surface))]">
                <qa.icon size={14} />
              </span>
              <span className="text-xs">{qa.label}</span>
            </button>
          ))}
        </div>
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
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
                className="lift inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--surface-hover) text-(--ink)"
              >
                <SquareIcon size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
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