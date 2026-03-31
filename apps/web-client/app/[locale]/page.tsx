import { ChatPanel } from "@spektors/chat-ui";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8 pb-16 pt-16">
      <div
        className="rounded-2xl border p-8 shadow-glow backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <p className="text-sm text-muted">{t("badge")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-4 text-muted">
          {t.rich("intro", {
            codeAppId: (chunks) => (
              <code className="text-accent" key="appId">
                {chunks}
              </code>
            ),
            codeApiUrl: (chunks) => (
              <code className="text-accent" key="apiUrl">
                {chunks}
              </code>
            ),
          })}
        </p>
      </div>
      <ChatPanel appId="web_client" />
    </main>
  );
}
