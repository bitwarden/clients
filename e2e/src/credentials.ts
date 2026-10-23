import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEBUG_DIR } from "./paths";

const CREDENTIALS_FILE = resolve(DEBUG_DIR, "credentials.txt");

/**
 * Section of `.debug/credentials.txt` every suite defaults to.
 */
const DEFAULT_ACCOUNT = "local-web";

/**
 * Section of the account that multi-account tests sign in beside the default one.
 */
const DEFAULT_SECOND_ACCOUNT = "local-web-2";

export type Account = {
  email: string;
  password: string;
  /** Web vault URL, which is also the self-hosted base URL, e.g. `https://localhost:8080`. */
  server: string;
};

/**
 * Parses the INI-style `.debug/credentials.txt`:
 *
 *   # comment
 *   [local-web]
 *   email=e2e-web@example.com
 *   password=...
 *   server=https://localhost:8080
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

/** Reads the account named by `E2E_ACCOUNT`, falling back to the default. */
export function account(): Account {
  return readAccount(process.env.E2E_ACCOUNT ?? DEFAULT_ACCOUNT);
}

/** Reads the account named by `E2E_SECOND_ACCOUNT`, for tests that need two accounts. */
export function secondAccount(): Account {
  return readAccount(process.env.E2E_SECOND_ACCOUNT ?? DEFAULT_SECOND_ACCOUNT);
}

function readAccount(name: string): Account {
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

  return { email: section.email, password: section.password, server: vaultUrl(section.server) };
}

/** Accepts a bare host, e.g. `vault.usdev.bitwarden.pw`, as its https URL. */
function vaultUrl(server: string): string {
  return /^https?:\/\//.test(server) ? server : `https://${server}`;
}
