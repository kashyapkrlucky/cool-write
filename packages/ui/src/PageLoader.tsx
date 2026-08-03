export default function PageLoader({ theme }: { theme?: string }) {
    return (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
                <div className={`animate-spin rounded-full h-8 w-8 border-2 ${theme === "light" 
                    ? "border-white/30 border-t-white" 
                    : "border-gray-200 border-t-purple-600"
                }`}></div>
                <p className={`text-sm ${theme === "light" ? "text-white/70" : "text-gray-500"}`}>
                    Loading...
                </p>
            </div>
        </div>
    );
}