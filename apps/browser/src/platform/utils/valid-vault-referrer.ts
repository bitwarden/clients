import { firstValueFrom } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

/**
 * Validates that a referrer hostname matches any of the available regions' and current environment web vault URLs.
 *
 * @remarks
 * **Limitation — the allowlist is client-side only.** It misses a self-hosted vault whose server is
 * configured with a different hostname than the client points at. Custom Environment and managed
 * policy each set the web vault URL independently of the base URL, which is what lets the two
 * drift. Remedy: the server publishes its own vault URL from its config endpoint; admit that
 * hostname to close the drift at its source.
 *
 * @param environmentService - source of the configured environment and the selectable regions
 * @param referrer - hostname from message source (should not include protocol or path)
 * @returns true if referrer matches any known vault hostname, false otherwise
 */
export async function isValidVaultReferrer(
  environmentService: EnvironmentService,
  referrer: string | null | undefined,
): Promise<boolean> {
  if (!referrer) {
    return false;
  }

  const environment = await firstValueFrom(environmentService.environment$);

  const regions = environmentService.availableRegions();
  const regionVaultUrls = regions
    .map((r) => r.urls.webVault ?? r.urls.base)
    .filter((url): url is string => url != null);
  const environmentWebVaultUrl = environment.getWebVaultUrl();
  const messageIsFromKnownVault = [...regionVaultUrls, environmentWebVaultUrl].some(
    (webVaultUrl) => Utils.getHostname(webVaultUrl) === referrer,
  );

  return messageIsFromKnownVault;
}
