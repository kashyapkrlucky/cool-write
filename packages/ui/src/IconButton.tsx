import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  active?: boolean
  label: string
}

export function IconButton({ children, active, label, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 ${
        active
          ? 'bg-[color-mix(in_srgb,var(--accent-1)_14%,var(--surface-hover))] text-(--accent-1)'
          : 'text-(--ink-dim) hover:scale-105 hover:bg-(--surface-hover) hover:text-(--ink)'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
