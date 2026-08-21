import { inject } from "@angular/core";
import { CanActivateFn, ParamMap, createUrlTreeFromSnapshot } from "@angular/router";

import { Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import {
  MY_VAULT,
  NO_FOLDER,
  VAULT_FILTER_KEYS,
  VAULT_FILTER_NAMESPACE,
} from "../components/vault-items-table/vault-items-table.component";
import { All } from "../models/routed-vault-filter.model";

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
  const ns = VAULT_FILTER_NAMESPACE;
  const keys = VAULT_FILTER_KEYS;
  const patch: Record<string, string> = {};

  if (legacy.type === "favorites") {
    patch[`${ns}.${keys.favorites}`] = "true";
  } else if (legacy.type != null && LEGACY_TYPE_MAP[legacy.type] != null) {
    patch[`${ns}.${keys.type}`] = String(LEGACY_TYPE_MAP[legacy.type]);
  }

  if (legacy.folderId != null) {
    patch[`${ns}.${keys.folder}`] = legacy.folderId === Unassigned ? NO_FOLDER : legacy.folderId;
  }
  // `all` means "no shared-folder filter" in the new table — omit rather than map it.
  if (legacy.sharedFolderId != null && legacy.sharedFolderId !== All) {
    patch[`${ns}.${keys.sharedFolder}`] = legacy.sharedFolderId;
  }
  if (legacy.organizationId != null) {
    patch[`${ns}.${keys.vault}`] =
      legacy.organizationId === Unassigned ? MY_VAULT : legacy.organizationId;
  }
  if (legacy.search != null) {
    patch[`${ns}.${keys.search}`] = legacy.search;
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

  const vfo1Enabled = await configService.getFeatureFlag(FeatureFlag.VFO1Foundation);

  // Only applicable when VFO1Foundation is enabled
  if (!vfo1Enabled) {
    return true;
  }

  // Copy non-legacy params first, then apply the converted patch.
  // This preserves params like cipherId and action that the vault uses independently.
  //
  // If `type` was present but untranslatable (e.g. trash/archive), keep it in the
  // redirect so the legacy filter$ can still apply it. Without this, a URL like
  // ?vaultId=<org>&type=trash would silently drop the Trash filter when the redirect
  // fires for the org param.
  const typeTranslated =
    patch[`${VAULT_FILTER_NAMESPACE}.${VAULT_FILTER_KEYS.type}`] != null ||
    patch[`${VAULT_FILTER_NAMESPACE}.${VAULT_FILTER_KEYS.favorites}`] != null;
  const keysToStrip = new Set(LEGACY_KEYS);
  if (legacy.type != null && !typeTranslated) {
    keysToStrip.delete("type");
  }

  const queryParams: Record<string, string | string[]> = {};
  for (const key of route.queryParamMap.keys) {
    if (!keysToStrip.has(key)) {
      const values = route.queryParamMap.getAll(key);
      queryParams[key] = values.length > 1 ? values : values[0];
    }
  }
  Object.assign(queryParams, patch);

  return createUrlTreeFromSnapshot(route, [], queryParams);
};
