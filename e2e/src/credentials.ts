import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEBUG_DIR } from "./paths";

const CREDENTIALS_FILE = resolve(DEBUG_DIR, "credentials.txt");

/** Sections of `.debug/credentials.txt` the suites default to. */
export const AccountName = Object.freeze({
  /** Local dev stack. The only option for web, whose API URLs are baked into the build. */
  Local: "local-web",
  /** usdev, which serves /api and /identity under the vault host, so it works self-hosted. */
  Usdev: "usdev-e2e",
} as const);
export type AccountName = (typeof AccountName)[keyof typeof AccountName];

/** Web vault the dev server listens on — see apps/web/config/base.json. */
export const LOCAL_WEB_VAULT_URL = "https://localhost:8080";

const LOCAL_SERVER = "localhost";

export type Account = {
  email: string;
  password: string;
  /** `localhost` for the local dev server, otherwise a self-hosted base URL. */
  server: string;
};

/**
 * Parses the INI-style `.debug/credentials.txt`:
 *
 *   # comment
 *   [local-web]
 *   email=e2e-web@example.com
 *   password=...
 */
function parse(contents: string): Map<string, Record<string, string>> {
  const sections = new Map<string, Record<string, string>>();
  let current: Record<string, string> | undefined;

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      current = {};
      sections.set(header[1], current);
      continue;
    }

    const separator = line.indexOf("=");
    if (current == null || separator < 0) {
      continue;
    }

    current[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return sections;
}

/** Reads the account named by `E2E_ACCOUNT`, falling back to the suite's own default. */
export function account(fallback: AccountName): Account {
  const name = process.env.E2E_ACCOUNT ?? fallback;

  let contents: string;
  try {
    contents = readFileSync(CREDENTIALS_FILE, "utf8");
  } catch {
    throw new Error(`No credentials at ${CREDENTIALS_FILE}. See e2e/README.md.`);
  }

  const section = parse(contents).get(name);
  if (section == null) {
    throw new Error(`No [${name}] section in ${CREDENTIALS_FILE}.`);
  }

  for (const key of ["email", "password", "server"] as const) {
    if (!section[key]) {
      throw new Error(`[${name}] in ${CREDENTIALS_FILE} is missing ${key}.`);
    }
  }

  return { email: section.email, password: section.password, server: section.server };
}

/** Base URL to enter in the self-hosted environment dialog for this account. */
export function selfHostedUrl(target: Account): string {
  if (target.server === LOCAL_SERVER) {
    return LOCAL_WEB_VAULT_URL;
  }

  return /^https?:\/\//.test(target.server) ? target.server : `https://${target.server}`;
}
