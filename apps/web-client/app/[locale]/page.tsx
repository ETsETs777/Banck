import { WebClientHome } from "@/components/WebClientHome";
import { routing, type AppLocale } from "@/i18n/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-0 w-full max-w-[42rem] flex-1 flex-col px-4 pb-12 pt-6 outline-none md:px-6 md:pt-8"
    >
      <WebClientHome />
    </main>
  );
}
