import { BEFORE_INTERACTIVE_THEME_SCRIPT } from "@spektors/ui-shell";
import "@spektors/ui-tokens/theme.css";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

/**
 * Корневой layout: единственное место для html/body (требование Next.js).
 * lang по умолчанию ru; фактическая локаль обновляется в LangSync внутри [locale].
 */
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
