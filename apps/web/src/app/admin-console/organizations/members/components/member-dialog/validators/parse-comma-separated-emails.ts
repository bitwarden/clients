/**
 * Splits a comma-separated email input into trimmed, non-empty entries.
 *
 * Empty entries are discarded so that a stray or trailing comma isn't treated as a typo. Validation
 * and submission must parse the input identically — otherwise the validator can accept a value the
 * submission then forwards in a form the server rejects — so every call site shares this helper.
 */
export function parseCommaSeparatedEmails(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email !== "");
}
