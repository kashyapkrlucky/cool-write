import { ShieldCheck, LogIn } from "lucide-react";

const APP_NAME = "Cool Write";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Login() {

    const loginWithGoogle = async () => {
        const res = await fetch(`${API_URL}/api/auth/csrf`, {
            credentials: "include",
        });
        const { csrfToken } = await res.json();

        const form = document.createElement("form");
        form.method = "POST";
        form.action = `${API_URL}/api/auth/signin/google`;

        const fields: Record<string, string> = {
            csrfToken,
            callbackUrl: window.location.origin,
        };
        for (const [name, value] of Object.entries(fields)) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = value;
            form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
    };
    return <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <ShieldCheck size={21} />
                </div>
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {APP_NAME}
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Sign in with Google
                    </h1>
                </div>
            </div>

            <p className="mb-6 text-sm leading-6 text-slate-600">
                Google is the only sign-in method for this private workspace. Your app
                data is scoped to your email.
            </p>

            <button
                className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                onClick={loginWithGoogle}
                type="button"
            >
                <LogIn size={18} />
                Continue with Google
            </button>
        </section>
    </main>;
}