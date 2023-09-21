import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, lastValueFrom, Observable, startWith, switchMap } from "rxjs";

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

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private accessPolicyService: AccessPolicyService,
    private dialogService: DialogService
  ) {}

  ngOnInit() {
    this.projects$ = combineLatest([
      this.route.params,
      this.projectService.project$.pipe(startWith(null)),
      this.accessPolicyService.projectAccessPolicyChanges$.pipe(startWith(null)),
    ]).pipe(
      switchMap(async ([params]) => {
        this.organizationId = params.organizationId;
        return await this.getProjects();
      })
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

  async openDeleteProjectDialog(projects: ProjectListView[]) {
    if (projects.some((project) => project.write == false)) {
      const readOnlyProjects = projects.filter((project) => project.write == false);
      const writeProjects = projects.filter((project) => project.write);

      const dialogRef = this.dialogService.open<unknown, BulkConfirmationDetails>(
        BulkConfirmationDialogComponent,
        {
          data: {
            title: "deleteProjects",
            columnTitle: "projectName",
            message: "smProjectsDeleteBulkConfirmation",
            details: this.getBulkConfirmationDetails(readOnlyProjects),
          },
        }
      );

      const result = await lastValueFrom(dialogRef.closed);

      if (result == BulkConfirmationResult.Continue) {
        this.dialogService.open<unknown, ProjectDeleteOperation>(ProjectDeleteDialogComponent, {
          data: {
            projects: writeProjects,
          },
        });
      }
    } else {
      this.dialogService.open<unknown, ProjectDeleteOperation>(ProjectDeleteDialogComponent, {
        data: {
          projects,
        },
      });
    }
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
