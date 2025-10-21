// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from "@angular/forms";
import { RouterModule } from "@angular/router";
import {
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  pairwise,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
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
import { AdvancedUriOptionDialogComponent } from "@bitwarden/vault";

import { AutofillBrowserSettingsService } from "../../../autofill/services/autofill-browser-settings.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "autofill.component.html",
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
    ReactiveFormsModule,
    SpotlightComponent,
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
  protected browserClientVendor: BrowserClientVendor = BrowserClientVendors.Unknown;
  protected disablePasswordManagerURI: DisablePasswordManagerUri =
    DisablePasswordManagerUris.Unknown;
  protected browserShortcutsURI: BrowserShortcutsUri = BrowserShortcutsUris.Unknown;
  protected browserClientIsUnknown: boolean;
  protected autofillOnPageLoadFromPolicy$ =
    this.autofillSettingsService.activateAutofillOnPageLoadFromPolicy$;
  protected showSpotlightNudge$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    switchMap((account) =>
      this.nudgesService.showNudgeSpotlight$(NudgeType.AutofillNudge, account.id),
    ),
  );
  protected restrictedCardType$: Observable<boolean> =
    this.restrictedItemTypesService.restricted$.pipe(
      map((restrictedTypes) => restrictedTypes.some((type) => type.cipherType === CipherType.Card)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  protected autofillOnPageLoadForm = new FormGroup({
    autofillOnPageLoad: new FormControl(),
    defaultAutofill: new FormControl(),
  });

  protected additionalOptionsForm = new FormGroup({
    enableContextMenuItem: new FormControl(),
    enableAutoTotpCopy: new FormControl(),
    clearClipboard: new FormControl(),
    defaultUriMatch: new FormControl(),
  });

  protected isDefaultUriMatchDisabledByPolicy = false;

  advancedOptionWarningMap: Partial<Record<UriMatchStrategySetting, string>>;
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
  uriMatchOptions: { name: string; value: UriMatchStrategySetting; disabled?: boolean }[];
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
    private formBuilder: FormBuilder,
    private destroyRef: DestroyRef,
    private nudgesService: NudgesService,
    private accountService: AccountService,
    private autofillBrowserSettingsService: AutofillBrowserSettingsService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private policyService: PolicyService,
  ) {
    this.autofillOnPageLoadOptions = [
      { name: this.i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: this.i18nService.t("autoFillOnPageLoadNo"), value: false },
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
      { name: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { name: i18nService.t("never"), value: UriMatchStrategy.Never },
      { name: this.i18nService.t("uriAdvancedOption"), value: null, disabled: true },
      { name: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
    ];
    this.advancedOptionWarningMap = {
      [UriMatchStrategy.StartsWith]: "startsWithAdvancedOptionWarning",
      [UriMatchStrategy.RegularExpression]: "regExAdvancedOptionWarning",
    };

    this.browserClientVendor = BrowserApi.getBrowserClientVendor(window);
    this.disablePasswordManagerURI = DisablePasswordManagerUris[this.browserClientVendor];
    this.browserShortcutsURI = BrowserShortcutsUris[this.browserClientVendor];
    this.browserClientIsUnknown = this.browserClientVendor === BrowserClientVendors.Unknown;
  }

  async ngOnInit() {
    this.canOverrideBrowserAutofillSetting = !this.browserClientIsUnknown;

    this.defaultBrowserAutofillDisabled =
      await this.autofillBrowserSettingsService.isBrowserAutofillSettingOverridden(
        this.browserClientVendor,
      );

    this.inlineMenuVisibility = await firstValueFrom(
      this.autofillSettingsService.inlineMenuVisibility$,
    );

    this.showInlineMenuIdentities = await firstValueFrom(
      this.autofillSettingsService.showInlineMenuIdentities$,
    );

    this.showInlineMenuCards = await firstValueFrom(
      this.autofillSettingsService.showInlineMenuCards$,
    );

    this.enableInlineMenuOnIconSelect =
      this.inlineMenuVisibility === AutofillOverlayVisibility.OnButtonClick;

    this.enableInlineMenu =
      this.inlineMenuVisibility === AutofillOverlayVisibility.OnFieldFocus ||
      this.enableInlineMenuOnIconSelect;

    this.autofillSettingsService.activateAutofillOnPageLoadFromPolicy$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        value
          ? this.autofillOnPageLoadForm.controls.autofillOnPageLoad.disable({ emitEvent: false })
          : this.autofillOnPageLoadForm.controls.autofillOnPageLoad.enable({ emitEvent: false });
      });

    this.enableAutofillOnPageLoad = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoad$,
    );

    this.autofillOnPageLoadForm.controls.autofillOnPageLoad.patchValue(
      this.enableAutofillOnPageLoad,
      { emitEvent: false },
    );

    this.autofillOnPageLoadDefault = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoadDefault$,
    );

    if (this.enableAutofillOnPageLoad === false) {
      this.autofillOnPageLoadForm.controls.defaultAutofill.disable();
    }

    this.autofillOnPageLoadForm.controls.defaultAutofill.patchValue(
      this.autofillOnPageLoadDefault,
      { emitEvent: false },
    );

    this.autofillOnPageLoadForm.controls.autofillOnPageLoad.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        void this.autofillSettingsService.setAutofillOnPageLoad(value);
        this.enableDefaultAutofillControl(value);
      });

    this.autofillOnPageLoadForm.controls.defaultAutofill.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        void this.autofillSettingsService.setAutofillOnPageLoadDefault(value);
      });

    /** Additional options form */

    this.enableContextMenuItem = await firstValueFrom(
      this.autofillSettingsService.enableContextMenu$,
    );

    this.additionalOptionsForm.controls.enableContextMenuItem.patchValue(
      this.enableContextMenuItem,
      { emitEvent: false },
    );

    this.enableAutoTotpCopy = await firstValueFrom(this.autofillSettingsService.autoCopyTotp$);

    this.additionalOptionsForm.controls.enableAutoTotpCopy.patchValue(this.enableAutoTotpCopy, {
      emitEvent: false,
    });

    this.clearClipboard = await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);

    this.additionalOptionsForm.controls.clearClipboard.patchValue(this.clearClipboard, {
      emitEvent: false,
    });

    const defaultUriMatch = await firstValueFrom(
      this.domainSettingsService.resolvedDefaultUriMatchStrategy$,
    );
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchStrategy.Domain : defaultUriMatch;

    this.additionalOptionsForm.controls.defaultUriMatch.patchValue(this.defaultUriMatch, {
      emitEvent: false,
    });

    this.applyUriMatchPolicy();

    this.additionalOptionsForm.controls.enableContextMenuItem.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        void this.autofillSettingsService.setEnableContextMenu(value);
        this.messagingService.send("bgUpdateContextMenu");
      });

    this.additionalOptionsForm.controls.enableAutoTotpCopy.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        void this.autofillSettingsService.setAutoCopyTotp(value);
      });

    this.additionalOptionsForm.controls.clearClipboard.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        void this.autofillSettingsService.setClearClipboardDelay(value);
      });

    this.additionalOptionsForm.controls.defaultUriMatch.valueChanges
      .pipe(
        startWith(this.defaultUriMatch),
        pairwise(),
        concatMap(([previous, current]) => this.handleAdvancedMatch(previous, current)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    const command = await this.platformUtilsService.getAutofillKeyboardShortcut();
    await this.setAutofillKeyboardHelperText(command);

    this.showCardsCurrentTab = await firstValueFrom(this.vaultSettingsService.showCardsCurrentTab$);

    this.showIdentitiesCurrentTab = await firstValueFrom(
      this.vaultSettingsService.showIdentitiesCurrentTab$,
    );
  }

  get spotlightButtonIcon() {
    if (this.browserClientVendor === BrowserClientVendors.Unknown) {
      return "bwi-external-link";
    }
    return null;
  }

  get browserClientVendorExtended() {
    if (this.browserClientVendor !== BrowserClientVendors.Unknown) {
      return this.browserClientVendor;
    }
    if (this.platformUtilsService.isFirefox()) {
      return "Firefox";
    }
    if (this.platformUtilsService.isSafari()) {
      return "Safari";
    }
    return BrowserClientVendors.Unknown;
  }

  get spotlightButtonText() {
    if (this.browserClientVendorExtended === BrowserClientVendors.Unknown) {
      return this.i18nService.t("turnOffAutofill");
    }
    return this.i18nService.t("turnOffBrowserAutofill", this.browserClientVendorExtended);
  }

  async dismissSpotlight() {
    await this.nudgesService.dismissNudge(
      NudgeType.AutofillNudge,
      await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)),
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
  async getAutofillOnPageLoadFromPolicy() {
    await firstValueFrom(this.autofillOnPageLoadFromPolicy$);
  }

  enableDefaultAutofillControl(enable: boolean = true) {
    if (enable) {
      this.autofillOnPageLoadForm.controls.defaultAutofill.enable();
    } else {
      this.autofillOnPageLoadForm.controls.defaultAutofill.disable();
    }
  }

  private async setAutofillKeyboardHelperText(command: string) {
    if (command) {
      this.autofillKeyboardHelperText = this.i18nService.t("autofillLoginShortcutText", command);
    } else {
      this.autofillKeyboardHelperText = this.i18nService.t("autofillLoginShortcutNotSet");
    }
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
      this.defaultBrowserAutofillDisabled
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

    await BrowserApi.updateDefaultBrowserAutofillSettings(!this.defaultBrowserAutofillDisabled);
    this.autofillBrowserSettingsService.setDefaultBrowserAutofillDisabled(
      this.defaultBrowserAutofillDisabled,
    );
  }

  private handleOverrideDialogAccept = async () => {
    this.defaultBrowserAutofillDisabled = true;
    await this.updateDefaultBrowserAutofillDisabled();
  };

  private applyUriMatchPolicy() {
    this.domainSettingsService.defaultUriMatchStrategyPolicy$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value !== null) {
          this.isDefaultUriMatchDisabledByPolicy = true;
          this.additionalOptionsForm.controls.defaultUriMatch.disable({ emitEvent: false });
        } else {
          this.isDefaultUriMatchDisabledByPolicy = false;
          this.additionalOptionsForm.controls.defaultUriMatch.enable({ emitEvent: false });
        }
      });
  }

  private async handleAdvancedMatch(
    previous: UriMatchStrategySetting | null,
    current: UriMatchStrategySetting | null,
  ): Promise<void> {
    const valueChange = previous !== current;
    const isAdvanced =
      current === UriMatchStrategy.StartsWith || current === UriMatchStrategy.RegularExpression;
    if (!valueChange || !isAdvanced) {
      return await this.domainSettingsService.setDefaultUriMatchStrategy(current);
    }
    AdvancedUriOptionDialogComponent.open(this.dialogService, {
      contentKey: this.advancedOptionWarningMap[current],
      onContinue: async () => {
        this.additionalOptionsForm.controls.defaultUriMatch.setValue(current);
        await this.domainSettingsService.setDefaultUriMatchStrategy(current);
      },
      onCancel: async () => {
        this.additionalOptionsForm.controls.defaultUriMatch.setValue(previous);
        await this.domainSettingsService.setDefaultUriMatchStrategy(previous);
      },
    });
  }

  async privacyPermissionGranted(): Promise<boolean> {
    return await BrowserApi.permissionsGranted(["privacy"]);
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

  getMatchHints() {
    const hints = ["uriMatchDefaultStrategyHint"];
    const strategy = this.additionalOptionsForm.get("defaultUriMatch")
      ?.value as UriMatchStrategySetting;
    if (
      strategy === UriMatchStrategy.StartsWith ||
      strategy === UriMatchStrategy.RegularExpression
    ) {
      hints.push(this.advancedOptionWarningMap[strategy]);
    }
    return hints;
  }

  /** Navigates the user from the Autofill Nudge to the proper destination based on their browser. */
  async disableBrowserAutofillSettingsFromNudge(event: Event) {
    // When we can programmatically disable the autofill setting, do that first
    // otherwise open the appropriate URI for the browser
    if (this.canOverrideBrowserAutofillSetting) {
      this.defaultBrowserAutofillDisabled = true;
      await this.updateDefaultBrowserAutofillDisabled();
    } else {
      await this.openURI(event, this.disablePasswordManagerURI);
    }
  }
}
