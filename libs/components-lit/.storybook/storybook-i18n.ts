import messages from "../../../apps/web/src/locales/en/messages.json";
import type { Translator } from "../src/core/i18n";

type MessageCatalog = Record<
  string,
  { message: string; placeholders?: Record<string, { content?: string } | string> }
>;

const catalog = messages as unknown as MessageCatalog;

/** Resolves keys against the web vault's English catalog, mirroring `I18nService.t`. */
export const storybookTranslator: Translator = (key, ...params) => {
  const entry = catalog[key];
  if (!entry) {
    return key;
  }

  let message = entry.message;
  for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
    if (typeof placeholder !== "object" || !placeholder.content) {
      continue;
    }
    const index = Number(placeholder.content.replace("$", "")) - 1;
    message = message.replace(new RegExp(`\\$${name}\\$`, "gi"), String(params[index] ?? ""));
  }
  return message;
};
