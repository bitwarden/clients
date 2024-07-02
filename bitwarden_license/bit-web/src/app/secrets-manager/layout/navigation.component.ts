import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SecretsManagerLogo } from "@bitwarden/web-vault/app/layouts/secrets-manager-logo";

import { OrganizationCounts } from "../models/view/counts.view";
import { ProjectService } from "../projects/project.service";
import { SecretService } from "../secrets/secret.service";
import { SecretsManagerService } from "../secrets-manager.service";
import { ServiceAccountService } from "../service-accounts/service-account.service";

@Component({
  selector: "sm-navigation",
  templateUrl: "./navigation.component.html",
})
export class NavigationComponent implements OnInit, OnDestroy {
  protected readonly logo = SecretsManagerLogo;
  protected orgFilter = (org: Organization) => org.canAccessSecretsManager;
  protected isAdmin$: Observable<boolean>;
  protected organizationCounts: OrganizationCounts;
  private destroy$: Subject<void> = new Subject<void>();

  constructor(
    protected route: ActivatedRoute,
    private organizationService: OrganizationService,
    private secretsManagerService: SecretsManagerService,
    private projectService: ProjectService,
    private secretService: SecretService,
    private serviceAccountService: ServiceAccountService,
  ) {}

  ngOnInit() {
    const orgId$ = this.route.params.pipe(
      map((p) => p.organizationId),
      distinctUntilChanged(),
    );

    this.isAdmin$ = this.route.params.pipe(
      concatMap(
        async (params) => (await this.organizationService.get(params.organizationId))?.isAdmin,
      ),
      takeUntil(this.destroy$),
    );

    combineLatest([
      orgId$,
      this.projectService.project$.pipe(startWith(null)),
      this.secretService.secret$.pipe(startWith(null)),
      this.serviceAccountService.serviceAccount$.pipe(startWith(null)),
    ])
      .pipe(
        switchMap(([orgId]) => this.secretsManagerService.getCounts(orgId)),
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
