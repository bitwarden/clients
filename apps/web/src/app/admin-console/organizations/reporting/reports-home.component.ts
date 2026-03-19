// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  AfterViewInit,
  Component,
  inject,
  OnDestroy,
  OnInit,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, map, Observable, startWith, concatMap, firstValueFrom } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import { ReportVariant, reports, ReportType, ReportEntry } from "../../../dirt/reports";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-reports-home",
  templateUrl: "reports-home.component.html",
  standalone: false,
})
export class ReportsHomeComponent implements OnInit, AfterViewInit, OnDestroy {
  reports$: Observable<ReportEntry[]>;
  homepage$: Observable<boolean>;

  private readonly backButtonTemplate =
    viewChild.required<TemplateRef<unknown>>("backButtonTemplate");

  private overlayRef: OverlayRef | null = null;
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private router: Router,
  ) {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event) => event instanceof NavigationEnd),
      )
      .subscribe(() => this.updateOverlay());
  }

  async ngOnInit() {
    this.homepage$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => this.isReportsHomepageRouteUrl((event as NavigationEnd).urlAfterRedirects)),
      startWith(this.isReportsHomepageRouteUrl(this.router.url)),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.reports$ = this.route.params.pipe(
      concatMap((params) =>
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(params.organizationId)),
      ),
      map((org) => this.buildReports(org.productTierType)),
    );
  }

  ngAfterViewInit(): void {
    this.updateOverlay();
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  returnFocusToPage(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) {
      return; // Allow natural Shift+Tab behavior
    }
    event.preventDefault();
    const firstFocusable = document.querySelector(
      "[cdktrapfocus] a:not([tabindex='-1'])",
    ) as HTMLElement;
    firstFocusable?.focus();
  }

  focusOverlayButton(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) {
      return; // Allow natural Shift+Tab behavior
    }
    event.preventDefault();
    const button = this.overlayRef?.overlayElement?.querySelector("a") as HTMLElement;
    button?.focus();
  }

  private updateOverlay(): void {
    if (this.isReportsHomepageRouteUrl(this.router.url)) {
      this.overlayRef?.dispose();
      this.overlayRef = null;
    } else if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        positionStrategy: this.overlay.position().global().bottom("20px").right("32px"),
      });
      this.overlayRef.attach(new TemplatePortal(this.backButtonTemplate(), this.viewContainerRef));
    }
  }

  private buildReports(productType: ProductTierType): ReportEntry[] {
    const reportRequiresUpgrade =
      productType == ProductTierType.Free ? ReportVariant.RequiresUpgrade : ReportVariant.Enabled;

    const reportsArray = [
      {
        ...reports[ReportType.ExposedPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.ReusedPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.WeakPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.UnsecuredWebsites],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.Inactive2fa],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.MemberAccessReport],
        variant:
          productType == ProductTierType.Enterprise
            ? ReportVariant.Enabled
            : ReportVariant.RequiresEnterprise,
      },
    ];

    return reportsArray;
  }

  private isReportsHomepageRouteUrl(url: string): boolean {
    return url.endsWith("/reports");
  }
}
