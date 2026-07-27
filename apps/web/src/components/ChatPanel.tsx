import { IconButton } from "@repo/ui/IconButton"
import { SparklesIcon } from "lucide-react"
import { PanelRightClose } from "lucide-react"
import { useSettings } from "../store/useSettings"

function AiAvatar() {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-xs">
      <SparklesIcon size={11} className="text-white" />
    </div>
  )
}

export function ChatPanel() {

  const setChatPanelOpen = useSettings((s) => s.setChatPanelOpen)
  return (
    <aside className="glass flex h-full w-80 shrink-0 flex-col border-l border-(--border)">
      <div className="flex items-center justify-between border-b border-(--border-soft) px-4 py-3">
        <div className="flex items-center gap-2">
          <AiAvatar />
          <span className="text-sm font-semibold text-(--ink)">Ask AI</span>
        </div>
        <IconButton label="Close panel" onClick={() => setChatPanelOpen(false)}>
          <PanelRightClose size={16} />
        </IconButton>
      </div>
    </aside>
  )
}