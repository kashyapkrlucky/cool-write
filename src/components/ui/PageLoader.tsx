export default function PageLoader() {
    return (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-50 bg-(--bg)">
            <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-(--border) border-t-(--accent-1)"></div>
                <p className="text-sm text-(--ink-dim)">
                    Loading...
                </p>
            </div>
        </div>
    );
}
