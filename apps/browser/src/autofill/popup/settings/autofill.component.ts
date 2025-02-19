// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AutofillOverlayVisibility,
  BrowserClientVendors,
  BrowserShortcutsUris,
  ClearClipboardDelay,
  DisablePasswordManagerUris,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  BrowserClientVendor,
  BrowserShortcutsUri,
  ClearClipboardDelaySetting,
  DisablePasswordManagerUri,
  InlineMenuVisibilitySetting,
} from "@bitwarden/common/autofill/types";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import {
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "autofill.component.html",
  standalone: true,
  imports: [
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    IconButtonModule,
    ItemModule,
    JslibModule,
    LinkModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
  ],
})
export class AutofillComponent implements OnInit {
  /*
   * Default values set here are used in component state operations
   * until corresponding stored settings have loaded on init.
   */
  protected canOverrideBrowserAutofillSetting: boolean = false;
  protected defaultBrowserAutofillDisabled: boolean = false;
  protected inlineMenuVisibility: InlineMenuVisibilitySetting =
    AutofillOverlayVisibility.OnFieldFocus;
  protected inlineMenuPositioningImprovementsEnabled: boolean = false;
  protected blockBrowserInjectionsByDomainEnabled: boolean = false;
  protected browserClientVendor: BrowserClientVendor = BrowserClientVendors.Unknown;
  protected disablePasswordManagerURI: DisablePasswordManagerUri =
    DisablePasswordManagerUris.Unknown;
  protected browserShortcutsURI: BrowserShortcutsUri = BrowserShortcutsUris.Unknown;
  protected browserClientIsUnknown: boolean;
  protected autofillOnPageLoadFromPolicy$ =
    this.autofillSettingsService.activateAutofillOnPageLoadFromPolicy$;

  enableAutofillOnPageLoad: boolean = false;
  enableInlineMenu: boolean = false;
  enableInlineMenuOnIconSelect: boolean = false;
  showInlineMenuIdentities: boolean = true;
  showInlineMenuCards: boolean = true;
  autofillOnPageLoadDefault: boolean = false;
  autofillOnPageLoadOptions: { name: string; value: boolean }[];
  enableContextMenuItem: boolean = false;
  enableAutoTotpCopy: boolean = false;
  clearClipboard: ClearClipboardDelaySetting;
  clearClipboardOptions: { name: string; value: ClearClipboardDelaySetting }[];
  defaultUriMatch: UriMatchStrategySetting = UriMatchStrategy.Domain;
  uriMatchOptions: { name: string; value: UriMatchStrategySetting }[];
  showCardsCurrentTab: boolean = true;
  showIdentitiesCurrentTab: boolean = true;
  autofillKeyboardHelperText: string;
  accountSwitcherEnabled: boolean = false;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private domainSettingsService: DomainSettingsService,
    private dialogService: DialogService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private messagingService: MessagingService,
    private vaultSettingsService: VaultSettingsService,
    private configService: ConfigService,
  ) {
    this.autofillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];
    this.clearClipboardOptions = [
      { name: i18nService.t("never"), value: ClearClipboardDelay.Never },
      { name: i18nService.t("tenSeconds"), value: ClearClipboardDelay.TenSeconds },
      { name: i18nService.t("twentySeconds"), value: ClearClipboardDelay.TwentySeconds },
      { name: i18nService.t("thirtySeconds"), value: ClearClipboardDelay.ThirtySeconds },
      { name: i18nService.t("oneMinute"), value: ClearClipboardDelay.OneMinute },
      { name: i18nService.t("twoMinutes"), value: ClearClipboardDelay.TwoMinutes },
      { name: i18nService.t("fiveMinutes"), value: ClearClipboardDelay.FiveMinutes },
    ];
    this.uriMatchOptions = [
      { name: i18nService.t("baseDomainOptionRecommended"), value: UriMatchStrategy.Domain },
      { name: i18nService.t("host"), value: UriMatchStrategy.Host },
      { name: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { name: i18nService.t("never"), value: UriMatchStrategy.Never },
    ];

    this.browserClientVendor = this.getBrowserClientVendor();
    this.disablePasswordManagerURI = DisablePasswordManagerUris[this.browserClientVendor];
    this.browserShortcutsURI = BrowserShortcutsUris[this.browserClientVendor];
    this.browserClientIsUnknown = this.browserClientVendor === BrowserClientVendors.Unknown;
  }

  async ngOnInit() {
    this.canOverrideBrowserAutofillSetting = !this.browserClientIsUnknown;
    this.defaultBrowserAutofillDisabled = await this.browserAutofillSettingCurrentlyOverridden();

    this.inlineMenuVisibility = await firstValueFrom(
      this.autofillSettingsService.inlineMenuVisibility$,
    );

    this.inlineMenuPositioningImprovementsEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.InlineMenuPositioningImprovements,
    );

    this.blockBrowserInjectionsByDomainEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.BlockBrowserInjectionsByDomain,
    );

    this.showInlineMenuIdentities =
      this.inlineMenuPositioningImprovementsEnabled &&
      (await firstValueFrom(this.autofillSettingsService.showInlineMenuIdentities$));

    this.showInlineMenuCards =
      this.inlineMenuPositioningImprovementsEnabled &&
      (await firstValueFrom(this.autofillSettingsService.showInlineMenuCards$));

    this.enableInlineMenuOnIconSelect =
      this.inlineMenuVisibility === AutofillOverlayVisibility.OnButtonClick;

    this.enableInlineMenu =
      this.inlineMenuVisibility === AutofillOverlayVisibility.OnFieldFocus ||
      this.enableInlineMenuOnIconSelect;

    this.enableAutofillOnPageLoad = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoad$,
    );

    this.autofillOnPageLoadDefault = await firstValueFrom(
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

  async updateInlineMenuVisibility() {
    if (!this.enableInlineMenu) {
      this.enableInlineMenuOnIconSelect = false;
    }

    const newInlineMenuVisibilityValue = this.enableInlineMenuOnIconSelect
      ? AutofillOverlayVisibility.OnButtonClick
      : this.enableInlineMenu
        ? AutofillOverlayVisibility.OnFieldFocus
        : AutofillOverlayVisibility.Off;

    await this.autofillSettingsService.setInlineMenuVisibility(newInlineMenuVisibilityValue);

    // No need to initiate browser permission request if a feature is being turned off
    if (newInlineMenuVisibilityValue !== AutofillOverlayVisibility.Off) {
      await this.requestPrivacyPermission();
    }
  }

  async updateAutofillOnPageLoad() {
    await this.autofillSettingsService.setAutofillOnPageLoad(this.enableAutofillOnPageLoad);
  }

  async updateAutofillOnPageLoadDefault() {
    await this.autofillSettingsService.setAutofillOnPageLoadDefault(this.autofillOnPageLoadDefault);
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

  private getBrowserClientVendor(): BrowserClientVendor {
    if (this.platformUtilsService.isChrome()) {
      return BrowserClientVendors.Chrome;
    }

    if (this.platformUtilsService.isOpera()) {
      return BrowserClientVendors.Opera;
    }

    if (this.platformUtilsService.isEdge()) {
      return BrowserClientVendors.Edge;
    }

    if (this.platformUtilsService.isVivaldi()) {
      return BrowserClientVendors.Vivaldi;
    }

    return BrowserClientVendors.Unknown;
  }

  protected async openURI(event: Event, uri: BrowserShortcutsUri | DisablePasswordManagerUri) {
    event.preventDefault();

    // If the destination is a password management settings page, ask the user to confirm before proceeding
    if (uri === DisablePasswordManagerUris[this.browserClientVendor]) {
      await this.dialogService.openSimpleDialog({
        ...(this.browserClientIsUnknown
          ? {
              content: { key: "confirmContinueToHelpCenterPasswordManagementContent" },
              title: { key: "confirmContinueToHelpCenter" },
            }
          : {
              content: { key: "confirmContinueToBrowserPasswordManagementSettingsContent" },
              title: { key: "confirmContinueToBrowserSettingsTitle" },
            }),
        acceptButtonText: { key: "continue" },
        acceptAction: async () => {
          await BrowserApi.createNewTab(uri);
        },
        cancelButtonText: { key: "cancel" },
        type: "info",
      });

      return;
    }

    // If the destination is a browser shortcut settings page, ask the user to confirm before proceeding
    if (uri === BrowserShortcutsUris[this.browserClientVendor]) {
      await this.dialogService.openSimpleDialog({
        ...(this.browserClientIsUnknown
          ? {
              content: { key: "confirmContinueToHelpCenterKeyboardShortcutsContent" },
              title: { key: "confirmContinueToHelpCenter" },
            }
          : {
              content: { key: "confirmContinueToBrowserKeyboardShortcutSettingsContent" },
              title: { key: "confirmContinueToBrowserSettingsTitle" },
            }),
        acceptButtonText: { key: "continue" },
        acceptAction: async () => {
          await BrowserApi.createNewTab(uri);
        },
        cancelButtonText: { key: "cancel" },
        type: "info",
      });

      return;
    }

    await BrowserApi.createNewTab(uri);
  }

  async requestPrivacyPermission() {
    if (
      this.inlineMenuVisibility === AutofillOverlayVisibility.Off ||
      !this.canOverrideBrowserAutofillSetting ||
      (await this.browserAutofillSettingCurrentlyOverridden())
    ) {
      return;
    }

    await this.dialogService.openSimpleDialog({
      title: { key: "overrideDefaultBrowserAutofillTitle" },
      content: { key: "overrideDefaultBrowserAutofillDescription" },
      acceptButtonText: { key: "continue" },
      acceptAction: async () => await this.handleOverrideDialogAccept(),
      cancelButtonText: { key: "cancel" },
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

  async updateShowInlineMenuCards() {
    await this.autofillSettingsService.setShowInlineMenuCards(this.showInlineMenuCards);
  }

  async updateShowInlineMenuIdentities() {
    await this.autofillSettingsService.setShowInlineMenuIdentities(this.showInlineMenuIdentities);
  }
}
