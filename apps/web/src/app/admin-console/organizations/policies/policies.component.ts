import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Observable, of, switchMap, first, map, shareReplay } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, PolicyDialogComponent } from "./base-policy-edit.component";
import { PolicyCategory, PolicyCategoryPipe } from "./pipes/policy-category.pipe";
import { PolicyOrderPipe } from "./pipes/policy-order.pipe";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import { PolicyListService } from "./policy-list.service";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

@Component({
  templateUrl: "policies.component.html",
  imports: [SharedModule, HeaderModule, PolicyOrderPipe, PolicyCategoryPipe],
  providers: [
    safeProvider({
      provide: PolicyListService,
      deps: [POLICY_EDIT_REGISTER],
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesComponent implements AfterViewChecked, OnDestroy {
  private myDialogRef?: DialogRef;
  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);
  private intersectionObserver?: IntersectionObserver;
  private scrollSpySetup = false;

  protected readonly PolicyCategory = PolicyCategory;
  protected readonly activeCategory = signal<PolicyCategory>(PolicyCategory.DataControl);

  private readonly stickyWrapper = viewChild<ElementRef<HTMLElement>>("stickyWrapper");
  private readonly dataSection = viewChild<ElementRef<HTMLElement>>("dataSection");
  private readonly authSection = viewChild<ElementRef<HTMLElement>>("authSection");
  private readonly vaultSection = viewChild<ElementRef<HTMLElement>>("vaultSection");

  protected organizationId$: Observable<OrganizationId> = this.route.params.pipe(
    map((params) => params.organizationId),
  );

  protected organization$: Observable<Organization> = combineLatest([
    this.userId$,
    this.organizationId$,
  ]).pipe(
    switchMap(([userId, orgId]) =>
      this.organizationService.organizations$(userId).pipe(
        getById(orgId),
        map((org) => {
          if (org == null) {
            throw new Error("No organization found for provided userId");
          }
          return org;
        }),
      ),
    ),
  );

  protected policies$: Observable<readonly BasePolicyEditDefinition[]> = of(
    this.policyListService.getPolicies(),
  );

  private orgPolicies$: Observable<PolicyResponse[]> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    switchMap(() => this.organizationId$),
    switchMap((organizationId) => this.policyApiService.getPolicies(organizationId)),
    map((response) => (response.data != null && response.data.length > 0 ? response.data : [])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected policiesEnabledMap$: Observable<Map<PolicyType, boolean>> = this.orgPolicies$.pipe(
    map((orgPolicies) => {
      const policiesEnabledMap: Map<PolicyType, boolean> = new Map<PolicyType, boolean>();
      orgPolicies.forEach((op) => {
        policiesEnabledMap.set(op.type, op.enabled);
      });
      return policiesEnabledMap;
    }),
  );

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
    private policyService: PolicyService,
    protected configService: ConfigService,
    private destroyRef: DestroyRef,
    private cdr: ChangeDetectorRef,
  ) {
    this.handleLaunchEvent();
  }

  ngAfterViewChecked() {
    if (
      !this.scrollSpySetup &&
      this.dataSection() != null &&
      this.authSection() != null &&
      this.vaultSection() != null
    ) {
      this.scrollSpySetup = true;
      this.setupScrollSpy();
    }
  }

  ngOnDestroy() {
    this.myDialogRef?.close();
    this.intersectionObserver?.disconnect();
  }

  private setupScrollSpy() {
    const sectionMap = new Map<Element, PolicyCategory>([
      [this.dataSection()!.nativeElement, PolicyCategory.DataControl],
      [this.authSection()!.nativeElement, PolicyCategory.Authentication],
      [this.vaultSection()!.nativeElement, PolicyCategory.VaultManagement],
    ]);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const category = sectionMap.get(entry.target);
            if (category != null) {
              this.activeCategory.set(category);
              this.cdr.markForCheck();
            }
          }
        }
      },
      { rootMargin: "-10% 0px -85% 0px", threshold: 0 },
    );

    for (const element of sectionMap.keys()) {
      this.intersectionObserver.observe(element);
    }
  }

  scrollToSection(category: PolicyCategory) {
    const sectionMap = new Map<PolicyCategory, ElementRef<HTMLElement> | undefined>([
      [PolicyCategory.DataControl, this.dataSection()],
      [PolicyCategory.Authentication, this.authSection()],
      [PolicyCategory.VaultManagement, this.vaultSection()],
    ]);

    const ref = sectionMap.get(category);
    if (ref) {
      const headerHeight = this.stickyWrapper()?.nativeElement.offsetHeight ?? 0;
      const scrollContainer = ref.nativeElement.closest("main") as HTMLElement | null;

      if (scrollContainer) {
        const targetTop =
          ref.nativeElement.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top +
          scrollContainer.scrollTop -
          headerHeight;
        scrollContainer.scrollTo({ top: targetTop, behavior: "smooth" });
      } else {
        ref.nativeElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    this.activeCategory.set(category);
  }

  // Handle policies component launch from Event message
  private handleLaunchEvent() {
    combineLatest([
      this.route.queryParams.pipe(first()),
      this.policies$,
      this.organizationId$,
      this.orgPolicies$,
    ])
      .pipe(
        map(([qParams, policies, organizationId, orgPolicies]) => {
          if (qParams.policyId != null) {
            const policyIdFromEvents: string = qParams.policyId;
            for (const orgPolicy of orgPolicies) {
              if (orgPolicy.id === policyIdFromEvents) {
                for (let i = 0; i < policies.length; i++) {
                  if (policies[i].type === orgPolicy.type) {
                    this.edit(policies[i], organizationId);
                    break;
                  }
                }
                break;
              }
            }
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  edit(policy: BasePolicyEditDefinition, organizationId: OrganizationId) {
    const dialogComponent: PolicyDialogComponent =
      policy.editDialogComponent ?? PolicyEditDialogComponent;
    this.myDialogRef = dialogComponent.open(this.dialogService, {
      data: {
        policy: policy,
        organizationId: organizationId,
      },
    });
  }
}
