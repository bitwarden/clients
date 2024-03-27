import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, lastValueFrom, Observable, startWith, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import {
  BulkConfirmationDetails,
  BulkConfirmationDialogComponent,
  BulkConfirmationResult,
  BulkConfirmationStatus,
} from "../../shared/dialogs/bulk-confirmation-dialog.component";
import {
  ProjectDeleteDialogComponent,
  ProjectDeleteOperation,
} from "../dialog/project-delete-dialog.component";
import {
  OperationType,
  ProjectDialogComponent,
  ProjectOperation,
} from "../dialog/project-dialog.component";
import { ProjectService } from "../project.service";

@Component({
  selector: "sm-projects",
  templateUrl: "./projects.component.html",
})
export class ProjectsComponent implements OnInit {
  protected projects$: Observable<ProjectListView[]>;
  protected search: string;

  private organizationId: string;
  private organizationEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private accessPolicyService: AccessPolicyService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
  ) {}

  ngOnInit() {
    this.projects$ = combineLatest([
      this.route.params,
      this.projectService.project$.pipe(startWith(null)),
      this.accessPolicyService.projectAccessPolicyChanges$.pipe(startWith(null)),
    ]).pipe(
      switchMap(async ([params]) => {
        this.organizationId = params.organizationId;
        this.organizationEnabled = (
          await this.organizationService.get(params.organizationId)
        )?.enabled;

        return await this.getProjects();
      }),
    );
  }

  private async getProjects(): Promise<ProjectListView[]> {
    return await this.projectService.getProjects(this.organizationId);
  }

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

  async openDeleteProjectDialog(projects: ProjectListView[]) {
    let projectsToDelete = projects;
    const readOnlyProjects = projects.filter((project) => project.write == false);
    if (readOnlyProjects.length > 0) {
      const dialogRef = this.dialogService.open<unknown, BulkConfirmationDetails>(
        BulkConfirmationDialogComponent,
        {
          data: {
            title: "deleteProjects",
            columnTitle: "projectName",
            message: "smProjectsDeleteBulkConfirmation",
            details: this.getBulkConfirmationDetails(readOnlyProjects),
          },
        },
      );

      const result = await lastValueFrom(dialogRef.closed);

      if (result !== BulkConfirmationResult.Continue) {
        return;
      }
      projectsToDelete = projects.filter((project) => project.write);
    }

    this.dialogService.open<unknown, ProjectDeleteOperation>(ProjectDeleteDialogComponent, {
      data: {
        projects: projectsToDelete,
      },
    });
  }

  private getBulkConfirmationDetails(projects: ProjectListView[]): BulkConfirmationStatus[] {
    return projects.map((project) => {
      return {
        id: project.id,
        name: project.name,
        description: "smProjectDeleteAccessRestricted",
      };
    });
  }
}
