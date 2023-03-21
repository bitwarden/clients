import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Observable, startWith, switchMap } from "rxjs";

import { Guid } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
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

  private organizationId: Guid;

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

  openEditProject(projectId: Guid) {
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

  openDeleteProjectDialog(event: ProjectListView[]) {
    this.dialogService.open<unknown, ProjectDeleteOperation>(ProjectDeleteDialogComponent, {
      data: {
        projects: event,
      },
    });
  }
}
