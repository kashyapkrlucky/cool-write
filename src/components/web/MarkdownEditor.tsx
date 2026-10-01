import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { tags } from '@lezer/highlight'
import { livePreview as livePreviewExtension } from './livePreview'

// Markdown is shown as styled source (headings larger, emphasis styled, syntax
// marks dimmed) — the stored document stays plain markdown text.
const markdownHighlight = HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.6em', fontWeight: '650', lineHeight: '1.4' },
    { tag: tags.heading2, fontSize: '1.35em', fontWeight: '650' },
    { tag: tags.heading3, fontSize: '1.15em', fontWeight: '650' },
    { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '650' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.link, color: 'var(--accent-1)', textDecoration: 'underline' },
    { tag: tags.url, color: 'var(--accent-1)' },
    { tag: tags.monospace, fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: '0.92em' },
    { tag: tags.quote, color: 'var(--ink-dim)', fontStyle: 'italic' },
    { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--ink-faint)' },
])

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '0.875rem',
        color: 'var(--ink)',
        backgroundColor: 'var(--surface)',
        borderRadius: '2px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.8', overflow: 'auto' },
    '.cm-content': { padding: '1rem', caretColor: 'var(--ink)' },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: 'color-mix(in srgb, var(--accent-1) 28%, transparent) !important',
    },
    '.cm-placeholder': { color: 'var(--ink-faint)' },
})

export interface MarkdownEditorHandle {
    // Inserts at the cursor, replacing any selection; falls back to appending
    // when the editor hasn't been focused yet (cursor would be at the top).
    insertAtCursor: (text: string) => void
    append: (text: string) => void
    replaceAll: (text: string) => void
}

interface MarkdownEditorProps {
    initialValue: string
    onChange: (value: string) => void
    maxLength: number
    placeholder?: string
    ariaLabel?: string
    handleRef?: React.RefObject<MarkdownEditorHandle | null>
    // Render markdown in place (syntax shown only on the cursor's line).
    livePreview?: boolean
}

export function MarkdownEditor({ initialValue, onChange, maxLength, placeholder, ariaLabel, handleRef, livePreview = true }: MarkdownEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onChangeRef = useRef(onChange)
    const viewRef = useRef<EditorView | null>(null)
    const previewCompartment = useRef(new Compartment())
    const livePreviewRef = useRef(livePreview)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    // The editor owns its document after mount; `initialValue` is read once.
    // Parents remount (via `key`) to load a different document.
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let hasFocused = false

        const view = new EditorView({
            parent: container,
            state: EditorState.create({
                doc: initialValue,
                extensions: [
                    history(),
                    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
                    markdown({ base: markdownLanguage }),
                    syntaxHighlighting(markdownHighlight),
                    previewCompartment.current.of(livePreviewRef.current ? livePreviewExtension : []),
                    EditorView.lineWrapping,
                    editorTheme,
                    placeholderExt(placeholder ?? ''),
                    EditorView.contentAttributes.of({
                        'aria-label': ariaLabel ?? 'Editor',
                        spellcheck: 'true',
                        autocorrect: 'on',
                        autocapitalize: 'sentences',
                    }),
                    EditorState.changeFilter.of((tr) => tr.newDoc.length <= maxLength),
                    EditorView.focusChangeEffect.of((_state, focusing) => {
                        if (focusing) hasFocused = true
                        return null
                    }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) onChangeRef.current(update.state.doc.toString())
                    }),
                ],
            }),
        })

        viewRef.current = view

        const separated = (before: string, text: string) => (before.trim() ? `\n\n${text}` : text)

        if (handleRef) {
            handleRef.current = {
                insertAtCursor: (text) => {
                    if (!hasFocused) return handleRef.current?.append(text)
                    const { from, to } = view.state.selection.main
                    view.dispatch({
                        changes: { from, to, insert: text },
                        selection: { anchor: from + text.length },
                        scrollIntoView: true,
                        userEvent: 'input.paste',
                    })
                    view.focus()
                },
                append: (text) => {
                    const end = view.state.doc.length
                    const insert = separated(view.state.doc.toString(), text)
                    view.dispatch({
                        changes: { from: end, insert },
                        selection: { anchor: end + insert.length },
                        scrollIntoView: true,
                        userEvent: 'input.paste',
                    })
                },
                replaceAll: (text) => {
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: text },
                        userEvent: 'input.paste',
                    })
                },
            }
        }

        return () => {
            if (handleRef) handleRef.current = null
            viewRef.current = null
            view.destroy()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per document (see comment above)
    }, [])

    // Switch between live preview and raw markdown without remounting.
    useEffect(() => {
        livePreviewRef.current = livePreview
        viewRef.current?.dispatch({
            effects: previewCompartment.current.reconfigure(livePreview ? livePreviewExtension : []),
        })
    }, [livePreview])

    return <div ref={containerRef} className="min-h-0 flex-1" />
}
