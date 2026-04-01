import { getTranslations } from "next-intl/server";

export default async function IntegrationsPage() {
  const t = await getTranslations("integrations");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <p className="text-muted leading-relaxed">{t("body")}</p>
    </div>
  );
}
