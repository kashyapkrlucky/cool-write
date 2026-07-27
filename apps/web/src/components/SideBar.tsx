import { FeatherIcon } from "lucide-react"

export function SideBar() {
  return (
    <aside className="glass relative flex h-full w-64 shrink-0 flex-col border-r border-(--border)">
      <div className="drag-region flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gray-600 text-white shadow-xs">
          <FeatherIcon size={15} strokeWidth={2.2} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-(--ink)">Cool Write</span>
      </div>

    </aside>
  )
}