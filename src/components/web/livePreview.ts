import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension, Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'

// Obsidian-style live preview for the markdown editor. The document stays
// plain markdown; this only changes how it's displayed:
//  - syntax marks (#, **, *, ~~, `, >, [](…)) are hidden…
//  - …except on the line(s) holding the cursor, so editing stays precise;
//  - bullets, task checkboxes, quotes, code blocks, links and rules render.

const hidden = Decoration.replace({})

class BulletWidget extends WidgetType {
    eq() {
        return true
    }
    toDOM() {
        const bullet = document.createElement('span')
        bullet.className = 'cm-lp-bullet'
        bullet.textContent = '•'
        return bullet
    }
}

// Clicking toggles "[ ]" ⇄ "[x]" in the document (one undoable change).
class CheckboxWidget extends WidgetType {
    constructor(readonly checked: boolean) {
        super()
    }
    eq(other: CheckboxWidget) {
        return other.checked === this.checked
    }
    toDOM(view: EditorView) {
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.className = 'cm-lp-task'
        box.checked = this.checked
        box.setAttribute('aria-label', this.checked ? 'Mark task as not done' : 'Mark task as done')
        box.addEventListener('mousedown', (event) => {
            event.preventDefault()
            const pos = view.posAtDOM(box)
            const marker = view.state.sliceDoc(pos, pos + 3)
            if (!/^\[[ xX]\]$/.test(marker)) return
            view.dispatch({
                changes: { from: pos + 1, to: pos + 2, insert: this.checked ? ' ' : 'x' },
                userEvent: 'input.toggle-task',
            })
        })
        return box
    }
    ignoreEvent() {
        return true
    }
}

class RuleWidget extends WidgetType {
    eq() {
        return true
    }
    toDOM() {
        const rule = document.createElement('span')
        rule.className = 'cm-lp-hr'
        return rule
    }
}

const SAFE_LINK = /^(https?:|mailto:)/i

function linkMark(href: string) {
    return Decoration.mark({
        class: 'cm-lp-link',
        attributes: SAFE_LINK.test(href) ? { 'data-href': href, title: `${href}\n⌘/Ctrl-click to open` } : {},
    })
}

// Lines the cursor/selection touches show raw markdown. When the editor isn't
// focused, everything renders.
function activeLines(view: EditorView) {
    const lines = new Set<number>()
    if (!view.hasFocus) return lines
    for (const range of view.state.selection.ranges) {
        const first = view.state.doc.lineAt(range.from).number
        const last = view.state.doc.lineAt(range.to).number
        for (let n = first; n <= last; n++) lines.add(n)
    }
    return lines
}

// Hide a mark plus the single space after it ("# ", "> ").
function hideWithSpace(state: EditorState, node: SyntaxNodeRef) {
    const end = state.sliceDoc(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
    return hidden.range(node.from, end)
}

function buildDecorations(view: EditorView): DecorationSet {
    const { state } = view
    const active = activeLines(view)
    const decorations: Range<Decoration>[] = []
    const lineClass = (pos: number, className: string) =>
        decorations.push(Decoration.line({ class: className }).range(state.doc.lineAt(pos).from))
    const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number)

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(state).iterate({
            from,
            to,
            enter: (node) => {
                const parent = node.node.parent?.name
                switch (node.name) {
                    case 'ATXHeading1':
                    case 'ATXHeading2':
                    case 'ATXHeading3':
                    case 'ATXHeading4':
                    case 'ATXHeading5':
                    case 'ATXHeading6':
                        lineClass(node.from, `cm-lp-heading cm-lp-${node.name.slice(-1)}`)
                        break
                    case 'HeaderMark':
                        if (parent?.startsWith('ATXHeading') && !isActive(node.from)) decorations.push(hideWithSpace(state, node))
                        break
                    case 'EmphasisMark':
                    case 'StrikethroughMark':
                        if (!isActive(node.from)) decorations.push(hidden.range(node.from, node.to))
                        break
                    case 'InlineCode':
                        decorations.push(Decoration.mark({ class: 'cm-lp-code' }).range(node.from, node.to))
                        break
                    case 'CodeMark':
                        if (parent === 'InlineCode' && !isActive(node.from)) decorations.push(hidden.range(node.from, node.to))
                        break
                    case 'Link': {
                        const marks = node.node.getChildren('LinkMark')
                        const url = node.node.getChild('URL')
                        const open = marks[0]
                        const close = marks[1]
                        if (!open || !close) break
                        decorations.push(
                            linkMark(url ? state.sliceDoc(url.from, url.to) : '').range(open.to, close.from),
                        )
                        // Hide "[" and "](url)" unless the link is on an active line.
                        if (!isActive(node.from) && !isActive(node.to)) {
                            decorations.push(hidden.range(open.from, open.to))
                            decorations.push(hidden.range(close.from, node.to))
                        }
                        break
                    }
                    case 'Autolink':
                        if (!isActive(node.from)) {
                            for (const mark of node.node.getChildren('LinkMark')) decorations.push(hidden.range(mark.from, mark.to))
                        }
                        break
                    case 'URL':
                        if (parent !== 'Link' && parent !== 'Image') {
                            decorations.push(linkMark(state.sliceDoc(node.from, node.to)).range(node.from, node.to))
                        }
                        break
                    case 'ListMark': {
                        if (isActive(node.from)) break
                        const isTask = node.node.parent?.getChild('Task') != null
                        if (isTask) decorations.push(hideWithSpace(state, node))
                        else if (node.node.parent?.parent?.name === 'BulletList') {
                            decorations.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to))
                        }
                        break
                    }
                    case 'TaskMarker': {
                        const checked = /x/i.test(state.sliceDoc(node.from, node.to))
                        if (checked) lineClass(node.from, 'cm-lp-task-done')
                        if (!isActive(node.from)) {
                            decorations.push(Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to))
                        }
                        break
                    }
                    case 'QuoteMark':
                        lineClass(node.from, 'cm-lp-quote')
                        if (!isActive(node.from)) decorations.push(hideWithSpace(state, node))
                        break
                    case 'HorizontalRule':
                        if (!isActive(node.from)) {
                            decorations.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to))
                        }
                        break
                    case 'FencedCode': {
                        const first = state.doc.lineAt(node.from).number
                        const last = state.doc.lineAt(node.to).number
                        let blockActive = false
                        for (let n = first; n <= last; n++) {
                            const edge = n === first ? ' cm-lp-codeblock-first' : n === last ? ' cm-lp-codeblock-last' : ''
                            lineClass(state.doc.line(n).from, `cm-lp-codeblock${edge}`)
                            if (active.has(n)) blockActive = true
                        }
                        // Fences (```) show only while editing inside the block;
                        // the language name stays visible as a small label.
                        const info = node.node.getChild('CodeInfo')
                        if (info) decorations.push(Decoration.mark({ class: 'cm-lp-code-info' }).range(info.from, info.to))
                        if (!blockActive) {
                            for (const fence of node.node.getChildren('CodeMark')) decorations.push(hidden.range(fence.from, fence.to))
                        }
                        break
                    }
                }
            },
        })
    }
    return Decoration.set(decorations, true)
}

const livePreviewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = buildDecorations(view)
        }
        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                update.selectionSet ||
                update.focusChanged ||
                syntaxTree(update.startState) !== syntaxTree(update.state)
            ) {
                this.decorations = buildDecorations(update.view)
            }
        }
    },
    {
        decorations: (plugin) => plugin.decorations,
        eventHandlers: {
            // ⌘/Ctrl-click opens a link (the desktop app routes it to the browser).
            mousedown(event) {
                if (!(event.metaKey || event.ctrlKey)) return false
                const link = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-href]')
                const href = link?.dataset.href
                if (!href || !SAFE_LINK.test(href)) return false
                event.preventDefault()
                window.open(href, '_blank', 'noopener,noreferrer')
                return true
            },
        },
    },
)

const livePreviewTheme = EditorView.theme({
    '.cm-lp-heading': { paddingTop: '0.35em' },
    '.cm-lp-bullet': { color: 'var(--ink-dim)', display: 'inline-block', width: '0.9em' },
    '.cm-lp-task': {
        margin: '0 0.45em 0 0',
        verticalAlign: '-0.12em',
        cursor: 'pointer',
        accentColor: 'var(--accent-1)',
    },
    '.cm-lp-task-done': { color: 'var(--ink-faint)', textDecoration: 'line-through' },
    '.cm-lp-quote': {
        borderLeft: '3px solid var(--border)',
        paddingLeft: '0.8em !important',
        color: 'var(--ink-dim)',
    },
    '.cm-lp-code': { backgroundColor: 'var(--surface-hover)', borderRadius: '4px', padding: '0.1em 0.3em' },
    '.cm-lp-codeblock': {
        backgroundColor: 'var(--surface-hover)',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        fontSize: '0.9em',
        paddingLeft: '0.8em !important',
        paddingRight: '0.8em !important',
    },
    '.cm-lp-codeblock-first': { borderTopLeftRadius: '6px', borderTopRightRadius: '6px' },
    '.cm-lp-codeblock-last': { borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' },
    '.cm-lp-code-info': { color: 'var(--ink-faint)', fontSize: '0.85em' },
    '.cm-lp-hr': {
        display: 'inline-block',
        width: '100%',
        borderTop: '1px solid var(--border)',
        verticalAlign: 'middle',
    },
    '.cm-lp-link': { color: 'var(--accent-1)', textDecoration: 'underline', textUnderlineOffset: '2px' },
})

export const livePreview: Extension = [livePreviewPlugin, livePreviewTheme]
