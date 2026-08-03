export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded-md border border-(--border) bg-(--surface) px-1.5 py-0.5 font-mono text-[10px] font-medium text-(--ink-dim)">
      {children}
    </kbd>
  )
}
