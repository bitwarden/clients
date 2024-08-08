import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { Subject, filter, firstValueFrom, switchMap, takeUntil, tap } from "rxjs";

import {
  AnonLayoutComponent,
  AnonLayoutWrapperData,
  AnonLayoutWrapperDataService,
} from "@bitwarden/auth/angular";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { Icon, IconModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { CurrentAccountComponent } from "../account-switching/current-account.component";

import {
  ExtensionBitwardenLogoPrimary,
  ExtensionBitwardenLogoWhite,
} from "./extension-bitwarden-logo.icon";

export interface ExtensionAnonLayoutWrapperData extends AnonLayoutWrapperData {
  showAcctSwitcher?: boolean;
  showBackButton?: boolean;
  showLogo?: boolean;
}

@Component({
  standalone: true,
  templateUrl: "extension-anon-layout-wrapper.component.html",
  imports: [
    AnonLayoutComponent,
    CommonModule,
    CurrentAccountComponent,
    IconModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    RouterModule,
  ],
})
export class ExtensionAnonLayoutWrapperComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected showAcctSwitcher: boolean;
  protected showBackButton: boolean;
  protected showLogo: boolean = true;

  protected pageTitle: string;
  protected pageSubtitle: string;
  protected pageIcon: Icon;
  protected showReadonlyHostname: boolean;
  protected maxWidth: "md" | "3xl";

  protected theme: string;
  protected logo: Icon;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private extensionAnonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private themeStateService: ThemeStateService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Set the initial page data on load
    this.setAnonLayoutWrapperDataFromRouteData(this.route.snapshot.firstChild?.data);

    // Listen for page changes and update the page data appropriately
    this.listenForPageDataChanges();
    this.listenForServiceDataChanges();

    this.theme = await firstValueFrom(this.themeStateService.selectedTheme$);

    if (this.theme === "dark") {
      this.logo = ExtensionBitwardenLogoWhite;
    } else {
      this.logo = ExtensionBitwardenLogoPrimary;
    }
  }

  private listenForPageDataChanges() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        // reset page data on page changes
        tap(() => this.resetPageData()),
        switchMap(() => this.route.firstChild?.data || null),
        takeUntil(this.destroy$),
      )
      .subscribe((firstChildRouteData: Data | null) => {
        this.setAnonLayoutWrapperDataFromRouteData(firstChildRouteData);
      });
  }

  private setAnonLayoutWrapperDataFromRouteData(firstChildRouteData: Data | null) {
    if (!firstChildRouteData) {
      return;
    }

    if (firstChildRouteData["pageTitle"] !== undefined) {
      this.pageTitle = this.i18nService.t(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      this.pageSubtitle = this.i18nService.t(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      this.pageIcon = firstChildRouteData["pageIcon"];
    }

    this.showReadonlyHostname = Boolean(firstChildRouteData["showReadonlyHostname"]);
    this.maxWidth = firstChildRouteData["maxWidth"];

    if (firstChildRouteData["showAcctSwitcher"] !== undefined) {
      this.showAcctSwitcher = Boolean(firstChildRouteData["showAcctSwitcher"]);
    }

    if (firstChildRouteData["showBackButton"] !== undefined) {
      this.showBackButton = Boolean(firstChildRouteData["showBackButton"]);
    }

    if (firstChildRouteData["showLogo"] !== undefined) {
      this.showLogo = Boolean(firstChildRouteData["showLogo"]);
    }
  }

  private listenForServiceDataChanges() {
    this.extensionAnonLayoutWrapperDataService
      .anonLayoutWrapperData$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: ExtensionAnonLayoutWrapperData) => {
        this.setAnonLayoutWrapperData(data);
      });
  }

  private setAnonLayoutWrapperData(data: ExtensionAnonLayoutWrapperData) {
    if (!data) {
      return;
    }

    if (data.pageTitle) {
      this.pageTitle = this.i18nService.t(data.pageTitle);
    }

    if (data.pageSubtitle) {
      this.pageSubtitle = this.i18nService.t(data.pageSubtitle);
    }

    if (data.pageIcon) {
      this.pageIcon = data.pageIcon;
    }

    if (data.showReadonlyHostname != null) {
      this.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.showAcctSwitcher != null) {
      this.showAcctSwitcher = data.showAcctSwitcher;
    }

    if (data.showBackButton != null) {
      this.showBackButton = data.showBackButton;
    }

    if (data.showLogo != null) {
      this.showLogo = data.showLogo;
    }
  }

  private resetPageData() {
    this.pageTitle = null;
    this.pageSubtitle = null;
    this.pageIcon = null;
    this.showReadonlyHostname = null;
    this.showAcctSwitcher = null;
    this.showBackButton = null;
    this.showLogo = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
