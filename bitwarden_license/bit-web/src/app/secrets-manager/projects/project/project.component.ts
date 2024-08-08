import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  filter,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  map,
  concatMap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ProjectCounts } from "../../models/view/counts.view";
import { ProjectView } from "../../models/view/project.view";
import { SecretService } from "../../secrets/secret.service";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { CountService } from "../../shared/counts/count.service";
import {
  OperationType,
  ProjectDialogComponent,
  ProjectOperation,
} from "../dialog/project-dialog.component";
import { ProjectService } from "../project.service";

@Component({
  selector: "sm-project",
  templateUrl: "./project.component.html",
})
export class ProjectComponent implements OnInit, OnDestroy {
  protected project$: Observable<ProjectView>;
  protected projectCounts: ProjectCounts;

  private organizationId: string;
  private projectId: string;
  private organizationEnabled: boolean;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private secretService: SecretService,
    private accessPolicyService: AccessPolicyService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private countService: CountService,
  ) {}

  ngOnInit(): void {
    // Update project if it is edited
    const currentProjectEdited = this.projectService.project$.pipe(
      filter((p) => p?.id === this.projectId),
      startWith(null),
    );

    this.project$ = combineLatest([this.route.params, currentProjectEdited]).pipe(
      switchMap(([params, _]) => this.projectService.getByProjectId(params.projectId)),
    );

    const projectId$ = this.route.params.pipe(map((p) => p.projectId));
    const organization$ = this.route.params.pipe(
      concatMap((params) => this.organizationService.get$(params.organizationId)),
    );
    const projectCounts$ = combineLatest([
      this.route.params,
      this.secretService.secret$.pipe(startWith(null)),
      this.accessPolicyService.accessPolicy$.pipe(startWith(null)),
    ]).pipe(switchMap(([params]) => this.countService.getProjectCounts(params.projectId)));

    combineLatest([projectId$, organization$, projectCounts$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([projectId, organization, projectCounts]) => {
        this.organizationId = organization.id;
        this.projectId = projectId;
        this.organizationEnabled = organization.enabled;
        this.projectCounts = {
          secrets: projectCounts.secrets,
          people: projectCounts.people,
          serviceAccounts: projectCounts.serviceAccounts,
        };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async openEditDialog() {
    this.dialogService.open<unknown, ProjectOperation>(ProjectDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Edit,
        organizationEnabled: this.organizationEnabled,
        projectId: this.projectId,
      },
    });
  }
}
