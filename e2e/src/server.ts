import { account } from "./credentials";

/** Where the dev server listens — see apps/web/config/base.json. */
const DEV_SERVER_URL = "https://localhost:8080";

/** The account's server; an account on a deployed vault skips the local build. */
export const WEB_VAULT_URL = account().server;

/**
 * Only the dev server's certificate is self-signed. A deployed vault keeps TLS
 * verification on, since the suite sends real credentials to it.
 */
export const IS_DEV_SERVER = new URL(WEB_VAULT_URL).origin === DEV_SERVER_URL;
