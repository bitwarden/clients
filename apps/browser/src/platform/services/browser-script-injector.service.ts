import { firstValueFrom } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { isUrlInList } from "@bitwarden/common/autofill/utils";
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

  constructor(
    private readonly domainSettingsService: DomainSettingsService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly logService: LogService,
  ) {
    super();
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

    const tab = tabId && (await BrowserApi.getTab(tabId));

    const blockedURI = await this.findBlockedInjectionUrl(tabId, tab, injectDetails);

    if (blockedURI !== undefined) {
      this.logService.warning(
        `${injectDetails.file} was not injected because ${blockedURI || "the tab URL"} is on the user's blocked domains list.`,
      );
      return;
    }

    const injectionDetails = this.buildInjectionDetails(injectDetails, file);

    if (BrowserApi.isManifestVersion(3)) {
      try {
        await BrowserApi.executeScriptInTab(tabId, injectionDetails, {
          world: mv3Details?.world ?? chrome.scripting.ExecutionWorld.ISOLATED,
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
   * Identifies the URL that blocks an injection, or `undefined` when the injection is allowed.
   *
   * @param tabId - The id of the tab targeted for injection.
   * @param tab - The targeted tab, when it could be resolved.
   * @param injectDetails - The details for the script injection.
   */
  private async findBlockedInjectionUrl(
    tabId: number,
    tab: chrome.tabs.Tab,
    injectDetails: CommonScriptInjectionDetails,
  ): Promise<string | undefined> {
    const blockedDomains = await firstValueFrom(
      this.domainSettingsService.blockedInteractionsUris$,
    );

    // If the tab URL is in blockedDomains, no frame lookups are needed,
    // so check that first
    if (!blockedDomains || Object.keys(blockedDomains).length === 0) {
      return undefined;
    }

    if (tab?.url && isUrlInList(tab.url, blockedDomains)) {
      return tab.url;
    }

    const { frame } = injectDetails;
    if (typeof frame !== "number" || frame === 0) {
      return undefined;
    }

    const frameUrl = await BrowserApi.getFrameDetails({ tabId, frameId: frame })
      .then((frameDetails) => frameDetails?.url)
      .catch((): undefined => undefined);

    return frameUrl && isUrlInList(frameUrl, blockedDomains) ? frameUrl : undefined;
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
  ): chrome.extensionTypes.InjectDetails {
    const { frame, runAt } = injectDetails;
    const injectionDetails: chrome.extensionTypes.InjectDetails = { file };

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
