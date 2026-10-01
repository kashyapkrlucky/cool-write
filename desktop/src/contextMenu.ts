import type { ContextMenuParams, MenuItemConstructorOptions } from "electron";

// Electron shows no right-click menu by default. This builds the usual one:
// spelling suggestions, cut/copy/paste in editable fields, copy for selected
// text, and link actions. Pure (no Electron calls) so it can be tested.

export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void;
  addToDictionary: (word: string) => void;
  openLink: (url: string) => void;
  copyText: (text: string) => void;
}

const MAX_SUGGESTIONS = 5;

export function buildContextMenuTemplate(
  params: Pick<ContextMenuParams, "misspelledWord" | "dictionarySuggestions" | "isEditable" | "selectionText" | "linkURL" | "editFlags">,
  actions: ContextMenuActions,
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  const section = (entries: MenuItemConstructorOptions[]) => {
    if (entries.length === 0) return;
    if (items.length > 0) items.push({ type: "separator" });
    items.push(...entries);
  };

  if (params.isEditable && params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    section([
      ...(suggestions.length > 0
        ? suggestions.map((word) => ({ label: word, click: () => actions.replaceMisspelling(word) }))
        : [{ label: "No suggestions", enabled: false }]),
      { label: "Add to Dictionary", click: () => actions.addToDictionary(params.misspelledWord) },
    ]);
  }

  if (/^https?:\/\//i.test(params.linkURL)) {
    section([
      { label: "Open Link in Browser", click: () => actions.openLink(params.linkURL) },
      { label: "Copy Link", click: () => actions.copyText(params.linkURL) },
    ]);
  }

  if (params.isEditable) {
    section([
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]);
  } else if (params.selectionText.trim()) {
    section([{ role: "copy" }]);
  }

  return items;
}
