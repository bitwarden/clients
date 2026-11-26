// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Region, RegionConfig } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DefaultEnvironmentService,
  formatUrl,
} from "@bitwarden/common/platform/services/default-environment.service";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GroupPolicyEnvironment } from "../../admin-console/types/group-policy-environment";
import { devFlagEnabled, devFlagValue } from "../flags";

const MANAGED_URL_KEYS = [
  "base",
  "webVault",
  "api",
  "identity",
  "icons",
  "notifications",
  "events",
] as const;

export class BrowserEnvironmentService extends DefaultEnvironmentService {
  constructor(
    private logService: LogService,
    stateProvider: StateProvider,
    accountService: AccountService,
    additionalRegionConfigs: RegionConfig[] = [],
  ) {
    super(stateProvider, accountService, additionalRegionConfigs);
  }

  async hasManagedEnvironment(): Promise<boolean> {
    try {
      return (await this.getManagedEnvironment()) != null;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }

  async settingsHaveChanged() {
    if (!(await this.hasManagedEnvironment())) {
      return false;
    }

    const managedEnv = await this.getManagedEnvironment();
    const env = await firstValueFrom(this.environment$);
    const urls = env.getUrls();

    return (
      managedEnv.base != urls.base ||
      managedEnv.webVault != urls.webVault ||
      managedEnv.api != urls.api ||
      managedEnv.identity != urls.identity ||
      managedEnv.icons != urls.icons ||
      managedEnv.notifications != urls.notifications ||
      managedEnv.events != urls.events
    );
  }

  getManagedEnvironment(): Promise<GroupPolicyEnvironment> {
    return devFlagEnabled("managedEnvironment")
      ? new Promise((resolve) => resolve(devFlagValue("managedEnvironment")))
      : new Promise((resolve, reject) => {
          if (chrome.storage.managed == null) {
            return resolve(null);
          }

          chrome.storage.managed.get("environment", (result) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }

            resolve(result.environment);
          });
        });
  }

  async setUrlsToManagedEnvironment() {
    const env = await this.getManagedEnvironment();

    // Managed URLs that belong to a Bitwarden cloud region (e.g. https://vault.bitwarden.eu)
    // select that region instead of being treated as a self-hosted server.
    const cloudRegion = this.findCloudRegion(env);
    if (cloudRegion != null) {
      await this.setEnvironment(cloudRegion);
      return;
    }

    await this.setEnvironment(Region.SelfHosted, {
      base: env.base,
      webVault: env.webVault,
      api: env.api,
      identity: env.identity,
      icons: env.icons,
      notifications: env.notifications,
      events: env.events,
    });
  }

  /**
   * Returns the cloud region whose URLs match every URL set in the managed environment,
   * or null if any URL points elsewhere (self-hosted).
   */
  private findCloudRegion(env: GroupPolicyEnvironment): Region | null {
    const providedKeys = MANAGED_URL_KEYS.filter((key) => !!env[key]);
    if (providedKeys.length === 0) {
      return null;
    }

    const match = this.availableRegions().find((config) =>
      providedKeys.every((key) => {
        // A cloud region's base URL is its web vault, e.g. https://vault.bitwarden.eu
        const regionUrl = key === "base" ? config.urls.webVault : config.urls[key];
        return formatUrl(env[key].trim())?.toLowerCase() === formatUrl(regionUrl)?.toLowerCase();
      }),
    );

    return match?.key ?? null;
  }
}
