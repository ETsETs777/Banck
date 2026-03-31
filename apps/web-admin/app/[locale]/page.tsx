import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export default async function AdminHome() {
  const t = await getTranslations("home");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        className="rounded-2xl border p-8 shadow-glow backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <p className="text-sm text-muted">{t("badge")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-4 text-muted">{t("intro")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/inbox"
          className="rounded-2xl border p-6 shadow-glow backdrop-blur-md transition hover:border-accent/40"
          style={{
            background: "var(--glass)",
            borderColor: "var(--glass-border)",
          }}
        >
          <h2 className="font-medium text-foreground">{t("inboxCardTitle")}</h2>
          <p className="mt-2 text-sm text-muted">{t("inboxCardDesc")}</p>
        </Link>
        <Link
          href="/inbox"
          className="rounded-2xl border p-6 shadow-glow backdrop-blur-md transition hover:border-accent/40"
          style={{
            background: "var(--glass)",
            borderColor: "var(--glass-border)",
          }}
        >
          <h2 className="font-medium text-foreground">{t("threadsCardTitle")}</h2>
          <p className="mt-2 text-sm text-muted">{t("threadsCardDesc")}</p>
        </Link>
      </div>
    </div>
  );
}
