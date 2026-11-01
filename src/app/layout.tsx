import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { RescanButton } from "@/components/rescan-button";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Udemy",
  description: "Assista cursos locais e acompanhe seu progresso",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-6">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              Local<span className="text-primary">Udemy</span>
            </Link>
            <RescanButton />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
