import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, filter, Observable, startWith, Subject, switchMap, takeUntil } from "rxjs";

import { Guid } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { ProjectPermissionDetailsView } from "../../models/view/project.view";
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
  protected project$: Observable<ProjectPermissionDetailsView>;

  private organizationId: Guid;
  private projectId: Guid;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    // Update project if it is edited
    const currentProjectEdited = this.projectService.project$.pipe(
      filter((p) => p?.id === this.projectId),
      startWith(null)
    );

    this.project$ = combineLatest([this.route.params, currentProjectEdited]).pipe(
      switchMap(([params, _]) => {
        return this.projectService.getByProjectId(params.projectId);
      })
    );

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId;
      this.projectId = params.projectId;
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
        projectId: this.projectId,
      },
    });
  }
}
