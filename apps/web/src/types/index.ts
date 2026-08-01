
export interface Command {
    id: string
    label: string
    hint?: string
    icon: React.ReactNode
    action: () => void
}