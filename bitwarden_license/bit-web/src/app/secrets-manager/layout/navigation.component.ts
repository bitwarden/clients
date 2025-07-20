// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SecretsManagerLogo } from "@bitwarden/components";

import { OrganizationCounts } from "../models/view/counts.view";
import { ProjectService } from "../projects/project.service";
import { SecretService } from "../secrets/secret.service";
import { ServiceAccountService } from "../service-accounts/service-account.service";
import { SecretsManagerPortingApiService } from "../settings/services/sm-porting-api.service";
import { CountService } from "../shared/counts/count.service";

@Component({
  selector: "sm-navigation",
  templateUrl: "./navigation.component.html",
  standalone: false,
})
export class NavigationComponent implements OnInit, OnDestroy {
  protected readonly logo = SecretsManagerLogo;
  protected orgFilter = (org: Organization) => org.canAccessSecretsManager;
  protected isAdmin$: Observable<boolean>;
  protected isOrgEnabled$: Observable<boolean>;
  protected organizationCounts: OrganizationCounts;
  private destroy$: Subject<void> = new Subject<void>();

  constructor(
    protected route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private countService: CountService,
    private projectService: ProjectService,
    private secretService: SecretService,
    private serviceAccountService: ServiceAccountService,
    private portingApiService: SecretsManagerPortingApiService,
  ) {}

  ngOnInit() {
    const org$ = this.route.params.pipe(
      concatMap((params) =>
        getUserId(this.accountService.activeAccount$).pipe(
          switchMap((userId) =>
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );

    this.isAdmin$ = org$.pipe(
      map((org) => org?.isAdmin),
      takeUntil(this.destroy$),
    );

    this.isOrgEnabled$ = org$.pipe(
      map((org) => org?.enabled),
      takeUntil(this.destroy$),
    );

    combineLatest([
      org$,
      this.projectService.project$.pipe(startWith(null)),
      this.secretService.secret$.pipe(startWith(null)),
      this.serviceAccountService.serviceAccount$.pipe(startWith(null)),
      this.portingApiService.imports$.pipe(startWith(null)),
    ])
      .pipe(
        filter(([org]) => org?.enabled),
        switchMap(([org]) => this.countService.getOrganizationCounts(org.id)),
        takeUntil(this.destroy$),
      )
      .subscribe((organizationCounts) => {
        this.organizationCounts = {
          projects: organizationCounts.projects,
          secrets: organizationCounts.secrets,
          serviceAccounts: organizationCounts.serviceAccounts,
        };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
