// Lets code outside the editor (e.g. the desktop app before installing an
// update) wait for unsaved document edits to reach the server.
const flushers = new Set<() => Promise<void>>()

export function registerSaveFlusher(flush: () => Promise<void>) {
    flushers.add(flush)
    return () => {
        flushers.delete(flush)
    }
}

export async function flushAllSaves() {
    await Promise.all([...flushers].map((flush) => flush().catch(() => {})))
}
