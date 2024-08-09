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
  firstValueFrom,
  concatMap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { OrganizationCounts } from "../models/view/counts.view";
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
import {
  SecretViewDialogComponent,
  SecretViewDialogParams,
} from "../secrets/dialog/secret-view-dialog.component";
import { SecretService } from "../secrets/secret.service";
import {
  ServiceAccountDialogComponent,
  ServiceAccountOperation,
} from "../service-accounts/dialog/service-account-dialog.component";
import { ServiceAccountService } from "../service-accounts/service-account.service";
import { CountService } from "../shared/counts/count.service";
import { SecretsListComponent } from "../shared/secrets-list.component";

import { SMOnboardingTasks, SMOnboardingTasksService } from "./sm-onboarding-tasks.service";

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
  protected organizationEnabled = false;
  protected onboardingTasks$: Observable<SMOnboardingTasks>;

  protected view$: Observable<{
    allProjects: ProjectListView[];
    allSecrets: SecretListView[];
    latestProjects: ProjectListView[];
    latestSecrets: SecretListView[];
    tasks: OrganizationTasks;
    counts: OrganizationCounts;
  }>;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private countService: CountService,
    private secretService: SecretService,
    private serviceAccountService: ServiceAccountService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private smOnboardingTasksService: SMOnboardingTasksService,
    private logService: LogService,
  ) {}

  ngOnInit() {
    this.onboardingTasks$ = this.smOnboardingTasksService.smOnboardingTasks$;

    const orgId$ = this.route.params.pipe(
      map((p) => p.organizationId),
      distinctUntilChanged(),
    );

    orgId$
      .pipe(
        concatMap(async (orgId) => await this.organizationService.get(orgId)),
        takeUntil(this.destroy$),
      )
      .subscribe((org) => {
        this.organizationId = org.id;
        this.organizationName = org.name;
        this.userIsAdmin = org.isAdmin;
        this.loading = true;
        this.organizationEnabled = org.enabled;
      });

    const projects$ = combineLatest([
      orgId$,
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.projectService.getProjects(orgId)),
      share(),
    );

    const secrets$ = combineLatest([
      orgId$,
      this.secretService.secret$.pipe(startWith(null)),
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.secretService.getSecrets(orgId)),
      share(),
    );

    const serviceAccounts$ = combineLatest([
      orgId$,
      this.serviceAccountService.serviceAccount$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.serviceAccountService.getServiceAccounts(orgId, false)),
      share(),
    );

    const counts$ = combineLatest([
      orgId$,
      this.secretService.secret$.pipe(startWith(null)),
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(([orgId]) => this.countService.getOrganizationCounts(orgId)),
      share(),
    );

    this.view$ = orgId$.pipe(
      switchMap((orgId) =>
        combineLatest([projects$, secrets$, serviceAccounts$, counts$]).pipe(
          switchMap(async ([projects, secrets, serviceAccounts, counts]) => ({
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
            counts: {
              projects: counts.projects,
              secrets: counts.secrets,
              serviceAccounts: counts.serviceAccounts,
            },
          })),
        ),
      ),
    );

    // Refresh onboarding status when orgId changes by fetching the first value from view$.
    orgId$
      .pipe(
        switchMap(() => this.view$.pipe(take(1))),
        takeUntil(this.destroy$),
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
    orgTasks: OrganizationTasks,
  ): Promise<OrganizationTasks> {
    const prevTasks = (await firstValueFrom(this.onboardingTasks$)) as Tasks;
    const newlyCompletedOrgTasks = Object.fromEntries(
      Object.entries(orgTasks).filter(([_k, v]) => v === true),
    );
    const nextOrgTasks = {
      importSecrets: false,
      createSecret: false,
      createProject: false,
      createServiceAccount: false,
      ...prevTasks[organizationId],
      ...newlyCompletedOrgTasks,
    };

    await this.smOnboardingTasksService.setSmOnboardingTasks({
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
        organizationEnabled: this.organizationEnabled,
        projectId: projectId,
      },
    });
  }

  openNewProjectDialog() {
    this.dialogService.open<unknown, ProjectOperation>(ProjectDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openServiceAccountDialog() {
    this.dialogService.open<unknown, ServiceAccountOperation>(ServiceAccountDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
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
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openEditSecret(secretId: string) {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Edit,
        secretId: secretId,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openViewSecret(secretId: string) {
    this.dialogService.open<unknown, SecretViewDialogParams>(SecretViewDialogComponent, {
      data: {
        organizationId: this.organizationId,
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
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  copySecretName(name: string) {
    SecretsListComponent.copySecretName(name, this.platformUtilsService, this.i18nService);
  }

  async copySecretValue(id: string) {
    await SecretsListComponent.copySecretValue(
      id,
      this.platformUtilsService,
      this.i18nService,
      this.secretService,
      this.logService,
    );
  }

  copySecretUuid(id: string) {
    SecretsListComponent.copySecretUuid(id, this.platformUtilsService, this.i18nService);
  }

  protected async hideOnboarding() {
    this.showOnboarding = false;
    await this.saveCompletedTasks(this.organizationId, {
      importSecrets: true,
      createSecret: true,
      createProject: true,
      createServiceAccount: true,
    });
  }
}
