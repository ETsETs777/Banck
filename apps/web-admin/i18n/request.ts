import en from "@spektors/messages/web-admin/en.json";
import nl from "@spektors/messages/web-admin/nl.json";
import ru from "@spektors/messages/web-admin/ru.json";
import { getRequestConfig } from "next-intl/server";

const catalogs = { ru, en, nl } as const;
const allowed = new Set<string>(Object.keys(catalogs));

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !allowed.has(locale)) {
    locale = "ru";
  }
  const key = locale as keyof typeof catalogs;
  return {
    locale: key,
    messages: catalogs[key],
  };
});
