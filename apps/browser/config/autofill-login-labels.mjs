import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const localesDirectory = fileURLToPath(new URL("../src/_locales", import.meta.url));

// Common website labels that differ from the extension's UI strings.
const additionalLabels = [
  // Spanish
  "nombre de usuario",
  "identificador de usuario",
  "id de usuario",
  "correo electronico",
  "usuario o correo electrónico",
  "nombre de usuario o correo electrónico",
  // French
  "identifiant",
  "adresse courriel",
  // Japanese
  "ユーザー名",
  // Luxembourgish (the UI catalog currently falls back to English)
  "Benotzernumm",
  "E-Mail-Adress",
  // Russian
  "электронная почта",
  // Vietnamese
  "tên người dùng",
  "thư điện tử",
  // Simplified Chinese
  "用户名或邮箱",
  "电子邮件地址",
];

/** Extract only the labels needed by autofill, so locale catalogs stay out of content scripts. */
export function getAutofillLoginLabels() {
  const labels = new Set(additionalLabels);
  const locales = readdirSync(localesDirectory, { withFileTypes: true });
  for (const locale of locales
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const filename = join(localesDirectory, locale, "messages.json");
    const messages = JSON.parse(readFileSync(filename, "utf8"));
    for (const key of ["username", "emailAddress", "email"]) {
      const label = messages[key]?.message?.trim();
      // The Filipino translation of "email" is a verb ("send an email").
      if (label && label !== "Mag-email") {
        labels.add(label);
      }
    }
  }
  return [...labels];
}
