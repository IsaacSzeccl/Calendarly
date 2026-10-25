import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Calendarly",
  description: "A calendar-aware poll that explains the trade-offs between times.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
              Calendarly
            </Link>
            <Suspense fallback={null}>
              <AccountMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
