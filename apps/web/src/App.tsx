import { useEffect } from 'react'
import { SideBar } from './components/SideBar'
import { TopBar } from './components/TopBar'
import { useSettings } from './store/useSettings'
import { ChatPanel } from './components/ChatPanel'
import { Editor } from './components/Editor'
import { useDocuments } from './store/useDocuments'

function App() {
  const { getDocuments } = useDocuments();
  const theme = useSettings((s) => s.theme)

  const focusMode = useSettings((s) => s.focusMode)

  const chatPanelOpen = useSettings((s) => s.chatPanelOpen)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    getDocuments();
  }, [])

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
          <Editor />
        </div>
        {chatPanelOpen && <ChatPanel />}
      </div>
    </div>
  )
}

export default App
