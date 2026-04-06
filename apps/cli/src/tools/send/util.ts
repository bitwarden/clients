/**
 * Parses email addresses from various input formats and combines them with previously parsed emails.
 *
 * Supports: single email, JSON array, comma-separated, or space-separated lists.
 * Note: Function signature follows Commander.js option parsing pattern.
 *
 * @param input - Email input string in any supported format
 * @param previousInput - Previously parsed email addresses to append to
 * @returns Combined array of email addresses
 * @throws {Error} For invalid JSON, non-array JSON, invalid email addresses, or unrecognized format
 *
 * @example
 * parseEmail("user@example.com", []) // ["user@example.com"]
 * parseEmail('["user1@example.com", "user2@example.com"]', []) // ["user1@example.com", "user2@example.com"]
 * parseEmail("user1@example.com, user2@example.com", []) // ["user1@example.com", "user2@example.com"]
 */
export function parseEmail(input: string, previousInput: string[]) {
  let result = previousInput ?? [];

  if (isEmail(input)) {
    result.push(input);
  } else if (input.startsWith("[")) {
    const json = JSON.parse(input);
    if (!Array.isArray(json)) {
      throw new Error("invalid JSON");
    }

    result = result.concat(json);
  } else if (input.includes(",")) {
    result = result.concat(parseList(input, ","));
  } else if (input.includes(" ")) {
    result = result.concat(parseList(input, " "));
  } else {
    throw new Error("`input` must be a single address, a comma-separated list, or a JSON array");
  }

  return result;
}

function isEmail(input: string) {
  return !!input && !!input.match(/^([\w._+-]+?)@([\w._+-]+?)$/);
}

function parseList(value: string, separator: string) {
  const parts = value
    .split(separator)
    .map((v) => v.trim())
    .filter((v) => !!v.length);
  const invalid = parts.find((v) => !isEmail(v));
  if (invalid) {
    throw new Error(`Invalid email address: ${invalid}`);
  }

  return parts;
}
