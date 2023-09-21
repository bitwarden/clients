import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  map,
  Observable,
  switchMap,
  Subject,
  takeUntil,
  combineLatest,
  startWith,
  distinctUntilChanged,
  take,
  share,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

import { ProjectListView } from "../models/view/project-list.view";
import { SecretListView } from "../models/view/secret-list.view";
import {
  ProjectDeleteDialogComponent,
  ProjectDeleteOperation,
} from "../projects/dialog/project-delete-dialog.component";
import {
  ProjectDialogComponent,
  ProjectOperation,
} from "../projects/dialog/project-dialog.component";
import { ProjectService } from "../projects/project.service";
import {
  SecretDeleteDialogComponent,
  SecretDeleteOperation,
} from "../secrets/dialog/secret-delete.component";
import {
  OperationType,
  SecretDialogComponent,
  SecretOperation,
} from "../secrets/dialog/secret-dialog.component";
import { SecretService } from "../secrets/secret.service";
import {
  ServiceAccountDialogComponent,
  ServiceAccountOperation,
} from "../service-accounts/dialog/service-account-dialog.component";
import { ServiceAccountService } from "../service-accounts/service-account.service";
import { SecretsListComponent } from "../shared/secrets-list.component";

type Tasks = {
  [organizationId: string]: OrganizationTasks;
};

type OrganizationTasks = {
  importSecrets: boolean;
  createSecret: boolean;
  createProject: boolean;
  createServiceAccount: boolean;
};

@Component({
  selector: "sm-overview",
  templateUrl: "./overview.component.html",
})
export class OverviewComponent implements OnInit, OnDestroy {
  private destroy$: Subject<void> = new Subject<void>();
  private tableSize = 10;
  private organizationId: string;
  protected organizationName: string;
  protected userIsAdmin: boolean;
  protected showOnboarding = false;
  protected loading = true;

  protected view$: Observable<{
    allProjects: ProjectListView[];
    allSecrets: SecretListView[];
    latestProjects: ProjectListView[];
    latestSecrets: SecretListView[];
    tasks: OrganizationTasks;
  }>;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private secretService: SecretService,
    private serviceAccountService: ServiceAccountService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private stateService: StateService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService
  ) {}

  ngOnInit() {
    const orgId$ = this.route.params.pipe(
      map((p) => p.organizationId),
      distinctUntilChanged()
    );

    orgId$
      .pipe(
        map((orgId) => this.organizationService.get(orgId)),
        takeUntil(this.destroy$)
      )
      .subscribe((org) => {
        this.organizationId = org.id;
        this.organizationName = org.name;
        this.userIsAdmin = org.isAdmin;
        this.loading = true;
      });

    const projects$ = combineLatest([
      orgId$,
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.projectService.getProjects(orgId)),
      share()
    );

    const secrets$ = combineLatest([
      orgId$,
      this.secretService.secret$.pipe(startWith(null)),
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.secretService.getSecrets(orgId)),
      share()
    );

    const serviceAccounts$ = combineLatest([
      orgId$,
      this.serviceAccountService.serviceAccount$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.serviceAccountService.getServiceAccounts(orgId, false)),
      share()
    );

    this.view$ = orgId$.pipe(
      switchMap((orgId) =>
        combineLatest([projects$, secrets$, serviceAccounts$]).pipe(
          switchMap(async ([projects, secrets, serviceAccounts]) => ({
            latestProjects: this.getRecentItems(projects, this.tableSize),
            latestSecrets: this.getRecentItems(secrets, this.tableSize),
            allProjects: projects,
            allSecrets: secrets,
            tasks: await this.saveCompletedTasks(orgId, {
              importSecrets: secrets.length > 0,
              createSecret: secrets.length > 0,
              createProject: projects.length > 0,
              createServiceAccount: serviceAccounts.length > 0,
            }),
          }))
        )
      )
    );

    // Refresh onboarding status when orgId changes by fetching the first value from view$.
    orgId$
      .pipe(
        switchMap(() => this.view$.pipe(take(1))),
        takeUntil(this.destroy$)
      )
      .subscribe((view) => {
        this.showOnboarding = Object.values(view.tasks).includes(false);
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getRecentItems<T extends { revisionDate: string }[]>(items: T, length: number): T {
    return items
      .sort((a, b) => {
        return new Date(b.revisionDate).getTime() - new Date(a.revisionDate).getTime();
      })
      .slice(0, length) as T;
  }

  private async saveCompletedTasks(
    organizationId: string,
    orgTasks: OrganizationTasks
  ): Promise<OrganizationTasks> {
    const prevTasks = ((await this.stateService.getSMOnboardingTasks()) || {}) as Tasks;
    const newlyCompletedOrgTasks = Object.fromEntries(
      Object.entries(orgTasks).filter(([_k, v]) => v === true)
    );
    const nextOrgTasks = {
      importSecrets: false,
      createSecret: false,
      createProject: false,
      createServiceAccount: false,
      ...prevTasks[organizationId],
      ...newlyCompletedOrgTasks,
    };
    this.stateService.setSMOnboardingTasks({
      ...prevTasks,
      [organizationId]: nextOrgTasks,
    });
    return nextOrgTasks as OrganizationTasks;
  }

  // Projects ---

  openEditProject(projectId: string) {
    this.dialogService.open<unknown, ProjectOperation>(ProjectDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Edit,
        projectId: projectId,
      },
    });
  }

  openNewProjectDialog() {
    this.dialogService.open<unknown, ProjectOperation>(ProjectDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
      },
    });
  }

  openServiceAccountDialog() {
    this.dialogService.open<unknown, ServiceAccountOperation>(ServiceAccountDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
      },
    });
  }

  openDeleteProjectDialog(event: ProjectListView[]) {
    this.dialogService.open<unknown, ProjectDeleteOperation>(ProjectDeleteDialogComponent, {
      data: {
        projects: event,
      },
    });
  }

  // Secrets ---

  openSecretDialog() {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
      },
    });
  }

  openEditSecret(secretId: string) {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Edit,
        secretId: secretId,
      },
    });
  }

  openDeleteSecret(event: SecretListView[]) {
    this.dialogService.open<unknown, SecretDeleteOperation>(SecretDeleteDialogComponent, {
      data: {
        secrets: event,
      },
    });
  }

  openNewSecretDialog() {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
      },
    });
  }

  copySecretName(name: string) {
    SecretsListComponent.copySecretName(name, this.platformUtilsService, this.i18nService);
  }

  copySecretValue(id: string) {
    SecretsListComponent.copySecretValue(
      id,
      this.platformUtilsService,
      this.i18nService,
      this.secretService
    );
  }

  copySecretUuid(id: string) {
    SecretsListComponent.copySecretUuid(id, this.platformUtilsService, this.i18nService);
  }

  protected hideOnboarding() {
    this.showOnboarding = false;
    this.saveCompletedTasks(this.organizationId, {
      importSecrets: true,
      createSecret: true,
      createProject: true,
      createServiceAccount: true,
    });
  }
}
