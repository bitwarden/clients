import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  InlineMenuVisibilitySetting,
  ClearClipboardDelaySetting,
} from "@bitwarden/common/autofill/types";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { DialogService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { enableAccountSwitching } from "../../../platform/flags";
import { AutofillService } from "../../services/abstractions/autofill.service";

@Component({
  selector: "app-autofill-v1",
  templateUrl: "autofill-v1.component.html",
})
export class AutofillV1Component implements OnInit {
  protected canOverrideBrowserAutofillSetting = false;
  protected defaultBrowserAutofillDisabled = false;
  protected autoFillOverlayVisibility: InlineMenuVisibilitySetting;
  protected autoFillOverlayVisibilityOptions: any[];
  protected disablePasswordManagerLink: string;
  enableAutoFillOnPageLoad = false;
  autoFillOnPageLoadDefault = false;
  autoFillOnPageLoadOptions: any[];
  enableContextMenuItem = false;
  enableAutoTotpCopy = false; // TODO: Does it matter if this is set to false or true?
  clearClipboard: ClearClipboardDelaySetting;
  clearClipboardOptions: any[];
  defaultUriMatch: UriMatchStrategySetting = UriMatchStrategy.Domain;
  uriMatchOptions: any[];
  showCardsCurrentTab = false;
  showIdentitiesCurrentTab = false;
  autofillKeyboardHelperText: string;
  accountSwitcherEnabled = false;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private domainSettingsService: DomainSettingsService,
    private autofillService: AutofillService,
    private dialogService: DialogService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private messagingService: MessagingService,
    private vaultSettingsService: VaultSettingsService,
  ) {
    this.autoFillOverlayVisibilityOptions = [
      {
        name: i18nService.t("autofillOverlayVisibilityOff"),
        value: AutofillOverlayVisibility.Off,
      },
      {
        name: i18nService.t("autofillOverlayVisibilityOnFieldFocus"),
        value: AutofillOverlayVisibility.OnFieldFocus,
      },
      {
        name: i18nService.t("autofillOverlayVisibilityOnButtonClick"),
        value: AutofillOverlayVisibility.OnButtonClick,
      },
    ];
    this.autoFillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];
    this.clearClipboardOptions = [
      { name: i18nService.t("never"), value: null },
      { name: i18nService.t("tenSeconds"), value: 10 },
      { name: i18nService.t("twentySeconds"), value: 20 },
      { name: i18nService.t("thirtySeconds"), value: 30 },
      { name: i18nService.t("oneMinute"), value: 60 },
      { name: i18nService.t("twoMinutes"), value: 120 },
      { name: i18nService.t("fiveMinutes"), value: 300 },
    ];
    this.uriMatchOptions = [
      { name: i18nService.t("baseDomainOptionRecommended"), value: UriMatchStrategy.Domain },
      { name: i18nService.t("host"), value: UriMatchStrategy.Host },
      { name: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { name: i18nService.t("never"), value: UriMatchStrategy.Never },
    ];

    this.accountSwitcherEnabled = enableAccountSwitching();
    this.disablePasswordManagerLink = this.getDisablePasswordManagerLink();
  }

  async ngOnInit() {
    this.canOverrideBrowserAutofillSetting =
      this.platformUtilsService.isChrome() ||
      this.platformUtilsService.isEdge() ||
      this.platformUtilsService.isOpera() ||
      this.platformUtilsService.isVivaldi();

    this.defaultBrowserAutofillDisabled = await this.browserAutofillSettingCurrentlyOverridden();

    this.autoFillOverlayVisibility = await firstValueFrom(
      this.autofillSettingsService.inlineMenuVisibility$,
    );

    this.enableAutoFillOnPageLoad = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoad$,
    );

    this.autoFillOnPageLoadDefault = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoadDefault$,
    );

    this.enableContextMenuItem = await firstValueFrom(
      this.autofillSettingsService.enableContextMenu$,
    );

    this.enableAutoTotpCopy = await firstValueFrom(this.autofillSettingsService.autoCopyTotp$);

    this.clearClipboard = await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);

    const defaultUriMatch = await firstValueFrom(
      this.domainSettingsService.defaultUriMatchStrategy$,
    );
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchStrategy.Domain : defaultUriMatch;

    const command = await this.platformUtilsService.getAutofillKeyboardShortcut();
    await this.setAutofillKeyboardHelperText(command);

    this.showCardsCurrentTab = await firstValueFrom(this.vaultSettingsService.showCardsCurrentTab$);

    this.showIdentitiesCurrentTab = await firstValueFrom(
      this.vaultSettingsService.showIdentitiesCurrentTab$,
    );
  }

  async updateAutoFillOverlayVisibility() {
    await this.autofillSettingsService.setInlineMenuVisibility(this.autoFillOverlayVisibility);
    await this.requestPrivacyPermission();
  }

  async updateAutoFillOnPageLoad() {
    await this.autofillSettingsService.setAutofillOnPageLoad(this.enableAutoFillOnPageLoad);
  }

  async updateAutoFillOnPageLoadDefault() {
    await this.autofillSettingsService.setAutofillOnPageLoadDefault(this.autoFillOnPageLoadDefault);
  }

  async saveDefaultUriMatch() {
    await this.domainSettingsService.setDefaultUriMatchStrategy(this.defaultUriMatch);
  }

  private async setAutofillKeyboardHelperText(command: string) {
    if (command) {
      this.autofillKeyboardHelperText = this.i18nService.t("autofillLoginShortcutText", command);
    } else {
      this.autofillKeyboardHelperText = this.i18nService.t("autofillLoginShortcutNotSet");
    }
  }

  async commandSettings() {
    if (this.platformUtilsService.isChrome()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("chrome://extensions/shortcuts");
    } else if (this.platformUtilsService.isOpera()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("opera://extensions/shortcuts");
    } else if (this.platformUtilsService.isEdge()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("edge://extensions/shortcuts");
    } else if (this.platformUtilsService.isVivaldi()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("vivaldi://extensions/shortcuts");
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("https://bitwarden.com/help/keyboard-shortcuts");
    }
  }

  private getDisablePasswordManagerLink(): string {
    if (this.platformUtilsService.isChrome()) {
      return "chrome://settings/autofill";
    }
    if (this.platformUtilsService.isOpera()) {
      return "opera://settings/autofill";
    }
    if (this.platformUtilsService.isEdge()) {
      return "edge://settings/passwords";
    }
    if (this.platformUtilsService.isVivaldi()) {
      return "vivaldi://settings/autofill";
    }

    return "https://bitwarden.com/help/disable-browser-autofill/";
  }

  protected openDisablePasswordManagerLink(event: Event) {
    event.preventDefault();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.createNewTab(this.disablePasswordManagerLink);
  }

  async requestPrivacyPermission() {
    if (
      this.autoFillOverlayVisibility === AutofillOverlayVisibility.Off ||
      !this.canOverrideBrowserAutofillSetting ||
      (await this.browserAutofillSettingCurrentlyOverridden())
    ) {
      return;
    }

    await this.dialogService.openSimpleDialog({
      title: { key: "overrideDefaultBrowserAutofillTitle" },
      content: { key: "overrideDefaultBrowserAutofillDescription" },
      acceptButtonText: { key: "makeDefault" },
      acceptAction: async () => await this.handleOverrideDialogAccept(),
      cancelButtonText: { key: "ignore" },
      type: "info",
    });
  }

  async updateDefaultBrowserAutofillDisabled() {
    const privacyPermissionGranted = await this.privacyPermissionGranted();
    if (!this.defaultBrowserAutofillDisabled && !privacyPermissionGranted) {
      return;
    }

    if (
      !privacyPermissionGranted &&
      !(await BrowserApi.requestPermission({ permissions: ["privacy"] }))
    ) {
      await this.dialogService.openSimpleDialog({
        title: { key: "privacyPermissionAdditionNotGrantedTitle" },
        content: { key: "privacyPermissionAdditionNotGrantedDescription" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });
      this.defaultBrowserAutofillDisabled = false;

      return;
    }

    BrowserApi.updateDefaultBrowserAutofillSettings(!this.defaultBrowserAutofillDisabled);
  }

  private handleOverrideDialogAccept = async () => {
    this.defaultBrowserAutofillDisabled = true;
    await this.updateDefaultBrowserAutofillDisabled();
  };

  async browserAutofillSettingCurrentlyOverridden() {
    if (!this.canOverrideBrowserAutofillSetting) {
      return false;
    }

    if (!(await this.privacyPermissionGranted())) {
      return false;
    }

    return await BrowserApi.browserAutofillSettingsOverridden();
  }

  async privacyPermissionGranted(): Promise<boolean> {
    return await BrowserApi.permissionsGranted(["privacy"]);
  }

  async updateContextMenuItem() {
    await this.autofillSettingsService.setEnableContextMenu(this.enableContextMenuItem);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateAutoTotpCopy() {
    await this.autofillSettingsService.setAutoCopyTotp(this.enableAutoTotpCopy);
  }

  async saveClearClipboard() {
    await this.autofillSettingsService.setClearClipboardDelay(this.clearClipboard);
  }

  async updateShowCardsCurrentTab() {
    await this.vaultSettingsService.setShowCardsCurrentTab(this.showCardsCurrentTab);
  }

  async updateShowIdentitiesCurrentTab() {
    await this.vaultSettingsService.setShowIdentitiesCurrentTab(this.showIdentitiesCurrentTab);
  }
}
