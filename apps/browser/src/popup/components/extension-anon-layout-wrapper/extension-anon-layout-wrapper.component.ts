import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, map, of, switchMap, tap } from "rxjs";

import { BitwardenLogo, BitwardenLogoBeta, BitSvg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  SvgModule,
  Translation,
  AnonLayoutComponent,
  AnonLayoutWrapperData,
  AnonLayoutWrapperDataService,
  ANON_LAYOUT_DEFAULTS,
  ContentVerticalPaddingType,
  FooterVerticalPaddingType,
  HeroTextAlignmentType,
  LandingContentMaxWidthType,
  SecondaryContentLocationType,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { AccountSwitcherService } from "../../../auth/popup/account-switching/services/account-switcher.service";
import { flagEnabled } from "../../../platform/flags";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { EXTENSION_ANON_LAYOUT_DEFAULTS } from "./extension-anon-layout-defaults";

export interface ExtensionAnonLayoutWrapperData extends AnonLayoutWrapperData {
  showAcctSwitcher?: boolean;
  showBackButton?: boolean;
  showLogo?: boolean;
  hideFooter?: boolean;
}

interface ExtensionAnonLayoutWrapperState {
  showAcctSwitcher: boolean | null;
  showBackButton: boolean | null;
  showLogo: boolean | null;
  pageTitle: string | null;
  pageSubtitle: string | null;
  pageIcon: BitSvg | null;
  showReadonlyHostname: boolean | null;
  maxWidth: LandingContentMaxWidthType | null;
  hideFooter: boolean | null;
  hideCardWrapper: boolean | null;
  hidePageIcon?: boolean;
  contentVerticalPadding?: ContentVerticalPaddingType;
  footerVerticalPadding?: FooterVerticalPaddingType;
  heroTextAlignment?: HeroTextAlignmentType;
  secondaryContentLocation?: SecondaryContentLocationType;
}

const RESET_STATE: ExtensionAnonLayoutWrapperState = {
  showAcctSwitcher: null,
  showBackButton: null,
  showLogo: null,
  pageTitle: null,
  pageSubtitle: null,
  pageIcon: null,
  showReadonlyHostname: null,
  maxWidth: null,
  hideFooter: null,
  hideCardWrapper: null,
};

const INITIAL_STATE: ExtensionAnonLayoutWrapperState = {
  ...RESET_STATE,
  showLogo: true,
  hideCardWrapper: false,
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush once routed pages no longer rely on Default CD
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "extension-anon-layout-wrapper.component.html",
  imports: [
    AnonLayoutComponent,
    CurrentAccountComponent,
    I18nPipe,
    SvgModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    RouterModule,
  ],
})
export class ExtensionAnonLayoutWrapperComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly extensionAnonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);
  private readonly accountSwitcherService = inject(AccountSwitcherService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<ExtensionAnonLayoutWrapperState>(INITIAL_STATE);

  protected readonly hasLoggedInAccount = toSignal(
    this.accountSwitcherService.availableAccounts$.pipe(
      map((accounts) => accounts.some((account) => account.id !== "addAccount")),
    ),
    { initialValue: false },
  );

  protected readonly logo = flagEnabled("prereleaseBuild") ? BitwardenLogoBeta : BitwardenLogo;

  ngOnInit(): void {
    // Set the initial page data on load
    this.setAnonLayoutWrapperDataFromRouteData(this.route.snapshot.firstChild?.data ?? null);

    // Listen for page changes and update the page data appropriately
    this.listenForPageDataChanges();
    this.listenForServiceDataChanges();
  }

  private listenForPageDataChanges() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        // reset page data on page changes
        tap(() => this.state.set(RESET_STATE)),
        switchMap(() => this.route.firstChild?.data || of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((firstChildRouteData: Data | null) => {
        this.setAnonLayoutWrapperDataFromRouteData(firstChildRouteData);
      });
  }

  private setAnonLayoutWrapperDataFromRouteData(firstChildRouteData: Data | null) {
    if (!firstChildRouteData) {
      return;
    }

    const next: ExtensionAnonLayoutWrapperState = { ...this.state() };

    if (firstChildRouteData["pageTitle"] !== undefined) {
      next.pageTitle = this.handleStringOrTranslation(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      next.pageSubtitle = this.handleStringOrTranslation(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      next.pageIcon = firstChildRouteData["pageIcon"];
    }

    // When undefined, fall back to ANON_LAYOUT_DEFAULTS / EXTENSION_ANON_LAYOUT_DEFAULTS — single
    // source of truth for route-init defaults, the reset emission, and the component-level
    // input defaults.
    next.showReadonlyHostname =
      firstChildRouteData["showReadonlyHostname"] ?? ANON_LAYOUT_DEFAULTS.showReadonlyHostname;
    next.maxWidth = firstChildRouteData["maxWidth"] ?? ANON_LAYOUT_DEFAULTS.maxWidth;
    next.hideCardWrapper =
      firstChildRouteData["hideCardWrapper"] ?? ANON_LAYOUT_DEFAULTS.hideCardWrapper;
    next.hidePageIcon = firstChildRouteData["hidePageIcon"] ?? ANON_LAYOUT_DEFAULTS.hidePageIcon;
    next.contentVerticalPadding =
      firstChildRouteData["contentVerticalPadding"] ?? ANON_LAYOUT_DEFAULTS.contentVerticalPadding;
    next.footerVerticalPadding =
      firstChildRouteData["footerVerticalPadding"] ?? ANON_LAYOUT_DEFAULTS.footerVerticalPadding;
    next.heroTextAlignment =
      firstChildRouteData["heroTextAlignment"] ?? ANON_LAYOUT_DEFAULTS.heroTextAlignment;

    next.showAcctSwitcher =
      firstChildRouteData["showAcctSwitcher"] ?? EXTENSION_ANON_LAYOUT_DEFAULTS.showAcctSwitcher;
    next.showBackButton =
      firstChildRouteData["showBackButton"] ?? EXTENSION_ANON_LAYOUT_DEFAULTS.showBackButton;
    next.showLogo = firstChildRouteData["showLogo"] ?? EXTENSION_ANON_LAYOUT_DEFAULTS.showLogo;
    next.hideFooter =
      firstChildRouteData["hideFooter"] ?? EXTENSION_ANON_LAYOUT_DEFAULTS.hideFooter;
    next.secondaryContentLocation =
      firstChildRouteData["secondaryContentLocation"] ??
      ANON_LAYOUT_DEFAULTS.secondaryContentLocation;

    this.state.set(next);

    // Cache the route-data payload so resetToCachedRouteData() can later restore it.
    this.extensionAnonLayoutWrapperDataService.cacheRouteData(
      firstChildRouteData as Partial<AnonLayoutWrapperData>,
    );
  }

  private listenForServiceDataChanges() {
    this.extensionAnonLayoutWrapperDataService
      .anonLayoutWrapperData$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: ExtensionAnonLayoutWrapperData) => {
        this.setAnonLayoutWrapperDataFromService(data);
      });
  }

  private setAnonLayoutWrapperDataFromService(data: ExtensionAnonLayoutWrapperData) {
    if (!data) {
      return;
    }

    const next: ExtensionAnonLayoutWrapperState = { ...this.state() };

    // Null emissions are used to reset the page data as all fields are optional.

    if (data.pageTitle !== undefined) {
      next.pageTitle =
        data.pageTitle !== null ? this.handleStringOrTranslation(data.pageTitle) : null;
    }

    if (data.pageSubtitle !== undefined) {
      next.pageSubtitle =
        data.pageSubtitle !== null ? this.handleStringOrTranslation(data.pageSubtitle) : null;
    }

    if (data.pageIcon !== undefined) {
      next.pageIcon = data.pageIcon !== null ? data.pageIcon : null;
    }

    if (data.hideFooter !== undefined) {
      next.hideFooter = data.hideFooter !== null ? data.hideFooter : null;
    }

    if (data.showReadonlyHostname !== undefined) {
      next.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.hideCardWrapper !== undefined) {
      next.hideCardWrapper = data.hideCardWrapper;
    }

    if (data.showAcctSwitcher !== undefined) {
      next.showAcctSwitcher = data.showAcctSwitcher;
    }

    if (data.showBackButton !== undefined) {
      next.showBackButton = data.showBackButton;
    }

    if (data.showLogo !== undefined) {
      next.showLogo = data.showLogo;
    }

    if (data.hidePageIcon !== undefined) {
      next.hidePageIcon = data.hidePageIcon;
    }
    if (data.contentVerticalPadding !== undefined) {
      next.contentVerticalPadding = data.contentVerticalPadding;
    }
    if (data.footerVerticalPadding !== undefined) {
      next.footerVerticalPadding = data.footerVerticalPadding;
    }
    if (data.heroTextAlignment !== undefined) {
      next.heroTextAlignment = data.heroTextAlignment;
    }
    if (data.secondaryContentLocation !== undefined) {
      next.secondaryContentLocation = data.secondaryContentLocation;
    }

    this.state.set(next);
  }

  private handleStringOrTranslation(value: string | Translation): string {
    if (typeof value === "string") {
      // If it's a string, return it as is
      return value;
    }

    // If it's a Translation object, translate it
    return this.i18nService.t(value.key, ...(value.placeholders ?? []));
  }
}
