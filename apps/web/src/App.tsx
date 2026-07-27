import { useEffect } from 'react'
import { SideBar } from './components/SideBar'
import { TopBar } from './components/TopBar'
import { useSettings } from './store/useSettings'
import { ChatPanel } from './components/ChatPanel'
import { SparklesIcon } from 'lucide-react'
import { Button } from '@repo/ui/Button'

function App() {

  const theme = useSettings((s) => s.theme)

  const focusMode = useSettings((s) => s.focusMode)

  const chatPanelOpen = useSettings((s) => s.chatPanelOpen)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-(--bg) text-(--ink)">
      <div className="ambient-glow" />
      <div className="noise-overlay" />
      <div className="relative z-10 flex min-w-0 flex-1">
        {focusMode && <SideBar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onOpenPalette={() => { }}
          />
          <div className="flex min-h-0 flex-1">
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-(--ink-faint)">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--border-soft) bg-(--surface)">
                <SparklesIcon size={20} className="text-(--accent-1)" />
              </div>
              <p className="text-sm">No document open</p>
              <Button>
                Create a document
              </Button>
            </div>
            {chatPanelOpen && <ChatPanel />}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
