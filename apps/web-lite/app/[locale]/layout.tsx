import { AppChrome } from "@/components/AppChrome";
import { SkipToMainContent } from "@/components/SkipToMainContent";
import { routing, type AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import LangSync from "./LangSync";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <LangSync />
      <SkipToMainContent />
      <div className="flex min-h-screen min-h-0 flex-col">
        <AppChrome />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </NextIntlClientProvider>
  );
}
