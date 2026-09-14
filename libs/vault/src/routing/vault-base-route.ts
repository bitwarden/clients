import { InjectionToken } from "@angular/core";

import { DEFAULT_VAULT_BASE_ROUTE } from "../models/vault-scope";

/**
 * The path this client mounts the vault page at.
 */
export const VAULT_BASE_ROUTE = new InjectionToken<string>("VaultBaseRoute", {
  providedIn: "root",
  factory: () => DEFAULT_VAULT_BASE_ROUTE,
});
