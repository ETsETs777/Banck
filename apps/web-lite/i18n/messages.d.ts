import type webLiteRu from "@spektors/messages/web-lite/ru.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof webLiteRu;
  }
}
