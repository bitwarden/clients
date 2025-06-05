// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  firstValueFrom,
  lastValueFrom,
  Observable,
  startWith,
  switchMap,
} from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
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
  standalone: false,
})
export class ProjectsComponent implements OnInit {
  protected projects$: Observable<ProjectListView[]>;
  protected search: string;

  private organizationId: string;
  private organizationEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.projects$ = combineLatest([
      this.route.params,
      this.projectService.project$.pipe(startWith(null)),
    ]).pipe(
      switchMap(async ([params]) => {
        this.organizationId = params.organizationId;
        const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        this.organizationEnabled = (
          await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          )
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
