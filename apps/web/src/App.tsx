import { useEffect } from 'react'
import { SideBar } from './components/SideBar'
import { TopBar } from './components/TopBar'
import { useSettings } from './store/useSettings'
import { ChatPanel } from './components/ChatPanel'
import { Editor } from './components/Editor'
import { useDocuments } from './store/useDocuments'
import { CommandPalette } from './components/CommandPalette'
import { isMac } from './utils'

function App() {
  const { getDocuments } = useDocuments();
  const { theme, commandPaletteOpen, focusMode, chatPanelOpen, setCommandPaletteOpen, setChatPanelOpen } = useSettings();


  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    getDocuments();
  }, [])



  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setChatPanelOpen(!chatPanelOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandPaletteOpen, chatPanelOpen])

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-(--bg) text-(--ink)">
      <div className="ambient-glow" />
      <div className="noise-overlay" />
      <div className="relative z-10 flex min-w-0 flex-1">
        {focusMode && <SideBar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <Editor />
        </div>
        {chatPanelOpen && <ChatPanel />}
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      </div>
    </div>
  )
}

export default App
