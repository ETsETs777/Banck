import type webClientRu from "@spektors/messages/web-client/ru.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof webClientRu;
  }
}
