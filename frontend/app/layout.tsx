import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const display = Outfit({ subsets: ["latin"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "AI Sports Analytics System",
  description: "Professional sports analytics dashboard for AI-driven betting insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable} font-[var(--font-body)]`}>
        <div className="mx-auto min-h-screen max-w-[1480px] px-4 py-6 md:px-8">
          <Navigation />
          <main className="mt-6 desk-shell rounded-[34px] p-4 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
