import { FeatherIcon, FilePlus2Icon, Trash2Icon } from "lucide-react"
import { useDocuments } from "../store/useDocuments"
import { IconButton } from "@repo/ui/IconButton"

export function SideBar() {
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const createDocument = useDocuments((s) => s.createDocument)
  const deleteDocument = useDocuments((s) => s.deleteDocument)

  const setActiveId = useDocuments((s) => s.setActiveId)
  const onCreateDocument = () => {
    createDocument("Untitled")
  }

  return (
    <aside className="glass relative flex h-full w-64 shrink-0 flex-col border-r border-(--border)">
      <header className="flex flex-row items-center justify-between px-3 h-12">

        <div className="drag-region flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gray-600 text-white shadow-xs">
            <FeatherIcon size={15} strokeWidth={2.2} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-(--ink)">Cool Write</span>
        </div>


        <button
          onClick={onCreateDocument}
          className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-hover)"
        >
          <FilePlus2Icon size={15} className="text-(--accent-1)" />
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-2">
        {documents.map((document) => {
          const isActive = document.id === activeId
          const preview = document.content.replace(/^#+\s*/gm, '').trim().slice(0, 64)

          return (
            <div key={document.id} className="group relative">
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-full bg-gray-400" />
              )}
              <button
                onClick={() => setActiveId(document.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 ${isActive
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
                  }`}
              >
                <span className="block font-medium text-(--ink) group-hover:text-(--ink-strong)">{document.title}</span>

                {preview && (
                  <p className="mt-0.5 truncate text-xs text-(--ink-faint) group-hover:text-(--ink-faint-strong)">{preview}</p>
                )}
              </button>


              <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton
                  label="Delete document"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${document.title || 'Untitled'}"?`)) deleteDocument(document.id)
                  }}
                  className="h-6 w-6 hover:text-(--danger)"
                >
                  <Trash2Icon size={13} />
                </IconButton>
              </div>
            </div>
          )
        })}
      </section>
    </aside>
  )
}