import * as fs from "fs";
import * as path from "path";

const CREDENTIALS_PATH = path.join(__dirname, "..", "..", ".debug", "e2e-credentials.txt");

const SECTION_HEADER = /^\[(.+)]$/;
const KEY_VALUE = /^([^=]+)=(.*)$/;
const COMMENT_PREFIX = "#";

export type Account = {
  email: string;
  password: string;
  server?: string;
  /** `sso_identifier` — the org identifier typed on the SSO login page. */
  ssoIdentifier?: string;
  /** `org_id` — the organization this account owns, for admin-console routes. */
  orgId?: string;
};

type AccountsByName = Record<string, Record<string, string>>;

/**
 * Reads .debug/e2e-credentials.txt, an INI-style file of test accounts:
 *
 *   # comment
 *   [v1]
 *   email=user@example.com
 *   password=hunter2
 *   server=https://vault.example.com
 *
 * The file is git-ignored and must contain test accounts only.
 */
export function readAccount(name: string): Account {
  const accounts = parseCredentials(readCredentialsFile());
  const account = accounts[name];

  if (account == null) {
    throw new Error(
      `No [${name}] section in ${CREDENTIALS_PATH}. Found: ${Object.keys(accounts).join(", ")}`,
    );
  }

  if (!account.email || !account.password) {
    throw new Error(`Account [${name}] is missing an email or password.`);
  }

  return {
    email: account.email,
    password: account.password,
    server: account.server,
    ssoIdentifier: account.sso_identifier,
    orgId: account.org_id,
  };
}

function readCredentialsFile(): string {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing credentials file: ${CREDENTIALS_PATH}. See e2e/README.md.`);
  }

  return fs.readFileSync(CREDENTIALS_PATH, "utf8");
}

function parseCredentials(contents: string): AccountsByName {
  const accounts: AccountsByName = {};
  let current: Record<string, string> | undefined;

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith(COMMENT_PREFIX)) {
      continue;
    }

    const header = SECTION_HEADER.exec(line);
    if (header) {
      current = {};
      accounts[header[1].trim()] = current;
      continue;
    }

    const pair = KEY_VALUE.exec(line);
    if (!pair || current == null) {
      continue;
    }

    current[pair[1].trim()] = pair[2].trim();
  }

  return accounts;
}
