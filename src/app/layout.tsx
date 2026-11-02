import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { RescanButton } from "@/components/rescan-button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title: "Conhecimento Liberta",
  description: "Assista cursos locais e acompanhe seu progresso",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-6">
              <Link href="/" className="text-lg font-extrabold tracking-tight">
                Conhecimento<span className="text-primary"> Liberta</span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <RescanButton />
              </div>
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
