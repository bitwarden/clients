import { Component, OnInit, ViewChild } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { ThemeType, UriMatchType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { NavigatableListComponent } from "../components/navigatable-list.component";

@Component({
  selector: "app-options",
  templateUrl: "options.component.html",
})
export class OptionsComponent implements OnInit {
  enableFavicon = false;
  enableBadgeCounter = false;
  enableAutoFillOnPageLoad = false;
  autoFillOnPageLoadDefault = false;
  autoFillOnPageLoadOptions: any[];
  enableAutoTotpCopy = false; // TODO: Does it matter if this is set to false or true?
  enableContextMenuItem = false;
  enableAddLoginNotification = false;
  enableChangedPasswordNotification = false;
  showCardsCurrentTab = false;
  showIdentitiesCurrentTab = false;
  showClearClipboard = true;
  theme: ThemeType;
  themeOptions: any[];
  defaultUriMatch = UriMatchType.Domain;
  uriMatchOptions: any[];
  clearClipboard: number;
  clearClipboardOptions: any[];
  showGeneral = true;
  showAutofill = true;
  showDisplay = true;

  @ViewChild(NavigatableListComponent) navigatableListComponent: NavigatableListComponent;

  constructor(
    private messagingService: MessagingService,
    private stateService: StateService,
    private totpService: TotpService,
    i18nService: I18nService,
    private themingService: AbstractThemingService,
    private settingsService: SettingsService
  ) {
    this.themeOptions = [
      { name: i18nService.t("default"), value: ThemeType.System },
      { name: i18nService.t("light"), value: ThemeType.Light },
      { name: i18nService.t("dark"), value: ThemeType.Dark },
      { name: "Nord", value: ThemeType.Nord },
      { name: i18nService.t("solarizedDark"), value: ThemeType.SolarizedDark },
    ];
    this.uriMatchOptions = [
      { name: i18nService.t("baseDomain"), value: UriMatchType.Domain },
      { name: i18nService.t("host"), value: UriMatchType.Host },
      { name: i18nService.t("startsWith"), value: UriMatchType.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchType.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchType.Exact },
      { name: i18nService.t("never"), value: UriMatchType.Never },
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
    this.autoFillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];
  }

  async ngOnInit() {
    this.enableAutoFillOnPageLoad = await this.stateService.getEnableAutoFillOnPageLoad();

    this.autoFillOnPageLoadDefault =
      (await this.stateService.getAutoFillOnPageLoadDefault()) ?? true;

    this.enableAddLoginNotification = !(await this.stateService.getDisableAddLoginNotification());

    this.enableChangedPasswordNotification =
      !(await this.stateService.getDisableChangedPasswordNotification());

    this.enableContextMenuItem = !(await this.stateService.getDisableContextMenuItem());

    this.showCardsCurrentTab = !(await this.stateService.getDontShowCardsCurrentTab());
    this.showIdentitiesCurrentTab = !(await this.stateService.getDontShowIdentitiesCurrentTab());

    this.enableAutoTotpCopy = !(await this.stateService.getDisableAutoTotpCopy());

    this.enableFavicon = !this.settingsService.getDisableFavicon();

    this.enableBadgeCounter = !(await this.stateService.getDisableBadgeCounter());

    this.theme = await this.stateService.getTheme();

    const defaultUriMatch = await this.stateService.getDefaultUriMatch();
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchType.Domain : defaultUriMatch;

    this.clearClipboard = await this.stateService.getClearClipboard();
  }

  async updateAddLoginNotification() {
    await this.stateService.setDisableAddLoginNotification(!this.enableAddLoginNotification);
  }

  async updateChangedPasswordNotification() {
    await this.stateService.setDisableChangedPasswordNotification(
      !this.enableChangedPasswordNotification
    );
  }

  async updateContextMenuItem() {
    await this.stateService.setDisableContextMenuItem(!this.enableContextMenuItem);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateAutoTotpCopy() {
    await this.stateService.setDisableAutoTotpCopy(!this.enableAutoTotpCopy);
  }

  async updateAutoFillOnPageLoad() {
    await this.stateService.setEnableAutoFillOnPageLoad(this.enableAutoFillOnPageLoad);
  }

  async updateAutoFillOnPageLoadDefault() {
    await this.stateService.setAutoFillOnPageLoadDefault(this.autoFillOnPageLoadDefault);
  }

  async updateFavicon() {
    await this.settingsService.setDisableFavicon(!this.enableFavicon);
  }

  async updateBadgeCounter() {
    await this.stateService.setDisableBadgeCounter(!this.enableBadgeCounter);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateShowCardsCurrentTab() {
    await this.stateService.setDontShowCardsCurrentTab(!this.showCardsCurrentTab);
  }

  async updateShowIdentitiesCurrentTab() {
    await this.stateService.setDontShowIdentitiesCurrentTab(!this.showIdentitiesCurrentTab);
  }

  async saveTheme() {
    await this.themingService.updateConfiguredTheme(this.theme);
  }

  async saveDefaultUriMatch() {
    await this.stateService.setDefaultUriMatch(this.defaultUriMatch);
  }

  async saveClearClipboard() {
    await this.stateService.setClearClipboard(this.clearClipboard);
  }
}
