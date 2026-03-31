import { DevTopBar } from "@/components/DevTopBar";
import { BEFORE_INTERACTIVE_THEME_SCRIPT } from "@spektors/ui-shell";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import "@spektors/ui-tokens/theme.css";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Spektors · Dev",
  description: "Инструменты разработчика",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <Script id="spektors-theme" strategy="beforeInteractive">
          {BEFORE_INTERACTIVE_THEME_SCRIPT}
        </Script>
        <DevTopBar />
        {children}
      </body>
    </html>
  );
}
