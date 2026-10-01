import { FilePlus2Icon, LogOutIcon, Trash2Icon } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useDocuments } from "../../store/useDocuments"
import { IconButton } from "../ui/IconButton"
import Image from "next/image"
import { getDesktopBridge } from "../../lib/desktop"

export function SideBar() {
  const status = useDocuments((s) => s.status)
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const createDocument = useDocuments((s) => s.createDocument)
  const deleteDocument = useDocuments((s) => s.deleteDocument)
  const { data: session } = useSession()
  const user = session?.user

  const setActiveId = useDocuments((s) => s.setActiveId)
  const onCreateDocument = async () => {
    try {
      await createDocument("Untitled")
    } catch (error) {
      console.error('Error creating document:', error)
      alert('Could not create the document. Please try again.')
    }
  }
  const onDeleteDocument = async (id: string, title: string) => {
    if (!confirm(`Delete "${title || 'Untitled'}"?`)) return
    try {
      await deleteDocument(id)
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Could not delete the document. Please try again.')
    }
  }

  return (
    <aside className="glass relative flex h-full w-64 shrink-0 flex-col border-r border-(--border)">
      <header className="drag-region desktop-traffic-light-inset flex flex-row items-center justify-between px-3 h-12">

        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Cool Write" width={24} height={24} unoptimized />
          <span className="text-sm font-semibold tracking-tight text-(--ink)">Cool Write</span>
        </div>


        <button
          onClick={onCreateDocument}
          aria-label="New document"
          title="New document"
          className="no-drag flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-hover)"
        >
          <FilePlus2Icon size={15} className="text-(--accent-1)" />
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-2">
        {status === 'loading' ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--accent-1)"></div>
          </div>
        ) : status === 'error' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-(--danger)">Failed to load documents</p>
          </div>
        ) : (
          documents.length > 0 ? <>
            {
              documents.map((document) => {
                const isActive = document.id === activeId
                const preview = document.preview.replace(/^#+\s*/gm, '').trim().slice(0, 64)

                return (
                  <div key={document.id} className="group relative">
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-full bg-(--accent-1)" />
                    )}
                    <button
                      onClick={() => setActiveId(document.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 ${isActive
                        ? 'bg-(--surface)'
                        : 'hover:bg-(--surface-hover)'
                        }`}
                    >
                      <span className="block font-medium text-(--ink) group-hover:text-(--ink-strong)">{document.title || 'Untitled'}</span>

                      {preview && (
                        <p className="mt-0.5 truncate text-xs text-(--ink-faint) group-hover:text-(--ink-faint-strong)">{preview}</p>
                      )}
                    </button>


                    <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton
                        label="Delete document"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteDocument(document.id, document.title)
                        }}
                        className="h-6 w-6 hover:text-(--danger)"
                      >
                        <Trash2Icon size={13} />
                      </IconButton>
                    </div>
                  </div>
                )
              })
            }
          </> : <div className="flex items-center justify-center h-full">
            <p className="text-(--ink-faint)">No documents found</p>
          </div>


        )}
      </section>

      {user && (
        <footer className="flex items-center justify-between border-t border-(--border) px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {user.image ? (
              <img src={user.image} alt="" className="h-6 w-6 shrink-0 rounded-full" />
            ) : (
              <div className="h-6 w-6 shrink-0 rounded-full bg-gray-600" />
            )}
            <span className="truncate text-xs text-(--ink-faint)">{user.name ?? user.email}</span>
          </div>
          <IconButton label="Sign out" onClick={() => {
            // In the desktop app, sign-out also revokes the install's session.
            const desktop = getDesktopBridge()
            if (desktop) void desktop.signOut()
            else void signOut({ callbackUrl: '/login' })
          }} className="shrink-0 hover:text-(--danger)">
            <LogOutIcon size={14} />
          </IconButton>
        </footer>
      )}
    </aside>
  )
}