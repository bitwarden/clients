import { inject } from "@angular/core";
import { CanActivateFn, ParamMap, createUrlTreeFromSnapshot } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

/** Maps the legacy `?type=` string values to their numeric CipherType equivalents. */
const LEGACY_TYPE_MAP: Record<string, CipherType> = {
  login: CipherType.Login,
  card: CipherType.Card,
  identity: CipherType.Identity,
  note: CipherType.SecureNote,
  sshKey: CipherType.SshKey,
  driversLicense: CipherType.DriversLicense,
  bankAccount: CipherType.BankAccount,
  passport: CipherType.Passport,
};

/** All legacy param key names stripped from the URL during redirect. */
const LEGACY_KEYS = new Set([
  "type",
  "folderId",
  "sharedFolderId",
  "collectionId",
  "vaultId",
  "organizationId",
  "search",
]);

/**
 * Extracts the five legacy filter params from a query-param map.
 * Returns null for each dimension that isn't present.
 */
function extractLegacyParams(params: ParamMap) {
  return {
    type: params.get("type"),
    folderId: params.get("folderId"),
    sharedFolderId: params.get("sharedFolderId") ?? params.get("collectionId"),
    organizationId: params.get("vaultId") ?? params.get("organizationId"),
    search: params.get("search"),
  };
}

/**
 * Builds the query-param patch to apply during the redirect.
 * Legacy keys are mapped to their `vault.*` namespaced equivalents.
 */
function buildRedirectPatch(
  legacy: ReturnType<typeof extractLegacyParams>,
): Record<string, string> {
  const patch: Record<string, string> = {};

  if (legacy.type === "favorites") {
    patch["vault.favorites"] = "true";
  } else if (legacy.type != null && LEGACY_TYPE_MAP[legacy.type] != null) {
    patch["vault.type"] = String(LEGACY_TYPE_MAP[legacy.type]);
  }

  if (legacy.folderId != null) {
    patch["vault.folder"] = legacy.folderId;
  }
  if (legacy.sharedFolderId != null) {
    patch["vault.sharedFolder"] = legacy.sharedFolderId;
  }
  if (legacy.organizationId != null) {
    patch["vault.vault"] = legacy.organizationId;
  }
  if (legacy.search != null) {
    patch["vault.search"] = legacy.search;
  }

  return patch;
}

/**
 * Redirects legacy vault URL params (`?type=`, `?folderId=`, etc.) to their
 * `queryParam="vault"` namespaced equivalents (`?vault.type=`, `?vault.folder=`, etc.)
 * when the VFO1Foundation feature flag is enabled. Non-legacy params (e.g. `cipherId`,
 * `action`) are preserved in the redirect.
 */
export const vaultFilterLegacyRedirectGuard: CanActivateFn = async (route) => {
  const configService = inject(ConfigService);

  const vfo1Enabled = await configService.getFeatureFlag(FeatureFlag.VFO1Foundation);

  // Only applicable when VFO1Foundation is enabled
  if (!vfo1Enabled) {
    return true;
  }

  const legacy = extractLegacyParams(route.queryParamMap);
  const hasLegacyParams = Object.values(legacy).some((v) => v != null);

  if (!hasLegacyParams) {
    return true;
  }

  const patch = buildRedirectPatch(legacy);

  // No mapped params — nothing to redirect (e.g. ?type=trash, ?type=archive).
  if (Object.keys(patch).length === 0) {
    return true;
  }

  // Copy non-legacy params first, then apply the converted patch.
  // This preserves params like cipherId and action that the vault uses independently.
  const queryParams: Record<string, string> = {};
  for (const key of route.queryParamMap.keys) {
    if (!LEGACY_KEYS.has(key)) {
      queryParams[key] = route.queryParamMap.get(key)!;
    }
  }
  Object.assign(queryParams, patch);

  return createUrlTreeFromSnapshot(route, [], queryParams);
};
