import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo } from "@/components/Logo";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

/** The public address: APP_URL, else Vercel's production address; unset lets Next pick its default. */
function siteUrl(): URL | undefined {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = process.env.APP_URL || (vercel ? `https://${vercel}` : "");
  try {
    return raw ? new URL(raw) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  // Absolute links for the share image when a poll link is pasted into a chat.
  metadataBase: siteUrl(),
  title: "Calendarly",
  description: "Find a time that works for the whole group. Answer from a link, no account needed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" aria-label="Calendarly home">
              <Logo />
            </Link>
            <Suspense fallback={null}>
              <AccountMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
