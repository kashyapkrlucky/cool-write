import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "../components/layout/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cool Write — the writing surface built around AI",
  description:
    "Cool Write pairs a fast, distraction-free editor with an AI chat panel right next to your document.",
};

// Applies the persisted theme (zustand `settings` key in localStorage) before
// first paint, so dark-mode users don't see a flash of the light theme.
const themeInitScript = `try{var s=JSON.parse(localStorage.getItem('settings')||'null');if(s&&s.state&&s.state.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
