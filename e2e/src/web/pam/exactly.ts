/** Matches the whole of an element's text, so one name never matches another it prefixes. */
export function exactly(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
}
