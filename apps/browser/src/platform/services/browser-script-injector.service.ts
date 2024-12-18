import { Subject, takeUntil } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BrowserApi } from "../browser/browser-api";

import {
  CommonScriptInjectionDetails,
  ScriptInjectionConfig,
  ScriptInjectorService,
} from "./abstractions/script-injector.service";

export class BrowserScriptInjectorService extends ScriptInjectorService {
  blockedDomains: Set<string> = null;

  private destroy$ = new Subject<void>();

  constructor(
    private readonly domainSettingsService: DomainSettingsService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly logService: LogService,
  ) {
    super();

    this.domainSettingsService.blockedInteractionsUris$
      .pipe(takeUntil(this.destroy$))
      .subscribe((neverDomains: NeverDomains) => {
        if (neverDomains) {
          this.blockedDomains = new Set(Object.keys(neverDomains));
        }
      });
  }

  /**
   * Facilitates the injection of a script into a tab context. Will adjust
   * behavior between manifest v2 and v3 based on the passed configuration.
   *
   * @param config - The configuration for the script injection.
   */
  async inject(config: ScriptInjectionConfig): Promise<void> {
    const { tabId, injectDetails, mv3Details } = config;
    const file = this.getScriptFile(config);
    if (!file) {
      throw new Error("No file specified for script injection");
    }

    // Check if the tab URI is on the disabled URIs list
    const tab = await BrowserApi.getTab(tabId);
    const tabURL = tab.url ? new URL(tab.url) : null;
    const injectionAllowedInTab = !(tabURL && this.blockedDomains?.has(tabURL.hostname));

    if (!injectionAllowedInTab) {
      throw new Error("This URI of this tab is on the blocked domains list.");
    }

    const injectionDetails = this.buildInjectionDetails(injectDetails, file);

    if (BrowserApi.isManifestVersion(3)) {
      try {
        await BrowserApi.executeScriptInTab(tabId, injectionDetails, {
          world: mv3Details?.world ?? "ISOLATED",
        });
      } catch (error) {
        // Swallow errors for host permissions, since this is believed to be a Manifest V3 Chrome bug
        // @TODO remove when the bugged behaviour is resolved
        if (
          error.message !==
          "Cannot access contents of the page. Extension manifest must request permission to access the respective host."
        ) {
          throw error;
        }

        if (this.platformUtilsService.isDev()) {
          this.logService.warning(
            `BrowserApi.executeScriptInTab exception for ${injectDetails.file} in tab ${tabId}: ${error.message}`,
          );
        }
      }

      return;
    }

    await BrowserApi.executeScriptInTab(tabId, injectionDetails);
  }

  /**
   * Retrieves the script file to inject based on the configuration.
   *
   * @param config - The configuration for the script injection.
   */
  private getScriptFile(config: ScriptInjectionConfig): string {
    const { injectDetails, mv2Details, mv3Details } = config;

    if (BrowserApi.isManifestVersion(3)) {
      return mv3Details?.file ?? injectDetails?.file;
    }

    return mv2Details?.file ?? injectDetails?.file;
  }

  /**
   * Builds the injection details for the script injection.
   *
   * @param injectDetails - The details for the script injection.
   * @param file - The file to inject.
   */
  private buildInjectionDetails(
    injectDetails: CommonScriptInjectionDetails,
    file: string,
  ): chrome.tabs.InjectDetails {
    const { frame, runAt } = injectDetails;
    const injectionDetails: chrome.tabs.InjectDetails = { file };

    if (runAt) {
      injectionDetails.runAt = runAt;
    }

    if (!frame) {
      return { ...injectionDetails, frameId: 0 };
    }

    if (frame !== "all_frames") {
      return { ...injectionDetails, frameId: frame };
    }

    return { ...injectionDetails, allFrames: true };
  }
}
