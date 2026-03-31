import { BEFORE_INTERACTIVE_THEME_SCRIPT } from "@spektors/ui-shell";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import "@spektors/ui-tokens/theme.css";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Spektors · Admin",
  description: "Operator console",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <Script id="spektors-theme" strategy="beforeInteractive">
          {BEFORE_INTERACTIVE_THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
