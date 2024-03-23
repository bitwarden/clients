import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Observable, Subject, takeUntil } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { TableDataSource } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
import { SecretListView } from "../../models/view/secret-list.view";
import { ProjectService } from "../../projects/project.service";
import { SecretService } from "../secret.service";

export interface SecretMoveProjectOperation {
  secrets: SecretListView[];
  organizationId: string;
}

type Secret = { name: string; currentProject?: string; moveTo: string };

@Component({
  templateUrl: "./secret-move-project.component.html",
})
export class SecretMoveProjectComponent implements OnInit, OnDestroy {
  protected formGroup = new FormGroup({
    project: new FormControl("", [Validators.required]),
  });

  projects: ProjectListView[];
  secretsCount: number;
  selectedProjectId$: Observable<string | undefined>;
  private destroy$ = new Subject<void>();
  dataSource = new TableDataSource<Secret>();

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: SecretMoveProjectOperation,
    private projectService: ProjectService,
    private secretService: SecretService,
  ) {
    this.secretsCount = data.secrets.length;
    this.selectedProjectId$ = this.formGroup.controls.project.valueChanges;

    this.selectedProjectId$.pipe(takeUntil(this.destroy$)).subscribe((projectId) => {
      if (Utils.isNullOrWhitespace(projectId)) {
        this.dataSource.data = [];
        return;
      }

      const chosenProjectName = this.projects.find((p) => p.id === projectId)?.name;

      if (!chosenProjectName) {
        return { showTable: false };
      }

      const data = this.data.secrets.map((s) => {
        if (s.projects == null || s.projects.length === 0) {
          return { name: s.name, moveTo: chosenProjectName };
        }

        // TODO: The logic will need updating if/when secrets can have more than one project
        const currentProject = s.projects[0];
        return { name: s.name, moveTo: chosenProjectName, currentProject: currentProject.name };
      });

      this.dataSource.data = data;
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit() {
    this.projects = await this.projectService
      .getProjects(this.data.organizationId)
      .then((projects) => projects.filter((p) => p.write))
      .then((projects) => projects.sort((a, b) => a.name.localeCompare(b.name)));
  }

  move = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    await this.secretService.bulkMoveToProject(
      this.data.organizationId,
      this.data.secrets.map((s) => s.id),
      this.formGroup.controls.project.value,
    );

    this.dialogRef.close();
  };
}
