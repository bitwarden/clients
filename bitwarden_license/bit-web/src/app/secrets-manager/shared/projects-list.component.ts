// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TableDataSource, ToastService } from "@bitwarden/components";

import { ProjectListView } from "../models/view/project-list.view";

@Component({
  selector: "sm-projects-list",
  templateUrl: "./projects-list.component.html",
  standalone: false,
})
export class ProjectsListComponent {
  @Input()
  get projects(): ProjectListView[] {
    return this._projects;
  }
  set projects(projects: ProjectListView[]) {
    this.selection.clear();
    this._projects = projects;
    this.dataSource.data = projects;
  }
  private _projects: ProjectListView[];

  @Input() showMenus?: boolean = true;

  @Input()
  set search(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  @Output() editProjectEvent = new EventEmitter<string>();
  @Output() deleteProjectEvent = new EventEmitter<ProjectListView[]>();
  @Output() newProjectEvent = new EventEmitter();
  @Output() copiedProjectUUIdEvent = new EventEmitter<string>();

  selection = new SelectionModel<string>(true, []);
  protected dataSource = new TableDataSource<ProjectListView>();
  protected hasWriteAccessOnSelected$ = this.selection.changed.pipe(
    map((_) => this.selectedHasWriteAccess()),
  );

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {}

  isAllSelected() {
    if (this.selection.selected?.length > 0) {
      const numSelected = this.selection.selected.length;
      const numRows = this.dataSource.filteredData.length;
      return numSelected === numRows;
    }
    return false;
  }

  toggleAll() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.filteredData.map((s) => s.id));
    }
  }

  deleteProject(projectId: string) {
    this.deleteProjectEvent.emit(this.projects.filter((p) => p.id == projectId));
  }

  bulkDeleteProjects() {
    if (this.selection.selected.length >= 1) {
      this.deleteProjectEvent.emit(
        this.projects.filter((project) => this.selection.isSelected(project.id)),
      );
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  private selectedHasWriteAccess() {
    const selectedProjects = this.projects.filter((project) =>
      this.selection.isSelected(project.id),
    );
    if (selectedProjects.some((project) => project.write)) {
      return true;
    }
    return false;
  }

  copyProjectUuidToClipboard(id: string) {
    this.platformUtilsService.copyToClipboard(id);
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t("projectId")),
    );
  }
}
