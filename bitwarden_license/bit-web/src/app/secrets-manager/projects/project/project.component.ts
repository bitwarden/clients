// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  map,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { ProjectCounts } from "../../models/view/counts.view";
import { ProjectView } from "../../models/view/project.view";
import { SecretService } from "../../secrets/secret.service";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { CountService } from "../../shared/counts/count.service";
import { organizationForRoute$ } from "../../shared/sm-organization";
import { ProjectService } from "../project.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-project",
  templateUrl: "./project.component.html",
  standalone: false,
})
export class ProjectComponent implements OnInit, OnDestroy {
  protected project$: Observable<ProjectView>;
  protected projectCounts: ProjectCounts;

  protected renaming = false;

  private organizationId: string;
  private projectId: string;
  private organizationEnabled: boolean;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private secretService: SecretService,
    private accessPolicyService: AccessPolicyService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private countService: CountService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    // Update project if it is edited
    const currentProjectEdited = this.projectService.project$.pipe(
      filter((p) => p?.id === this.projectId),
      startWith(null),
    );

    this.project$ = combineLatest([this.route.params, currentProjectEdited]).pipe(
      switchMap(([params, currentProj]) =>
        this.projectService.getByProjectId(params.projectId, currentProj != null),
      ),
    );
    const projectId$ = this.route.params.pipe(map((p) => p.projectId));

    // Close the editor when switching projects.
    projectId$.pipe(distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((projectId) => {
      this.projectId = projectId;
      this.renaming = false;
    });

    // Separate from the counts fetch so the rename guard isn't blocked on it.
    organizationForRoute$(this.route.params, this.accountService, this.organizationService)
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this.organizationId = organization?.id;
        this.organizationEnabled = organization?.enabled;
      });

    const projectCounts$ = combineLatest([
      this.route.params,
      this.secretService.secret$.pipe(startWith(null)),
      this.accessPolicyService.accessPolicy$.pipe(startWith(null)),
    ]).pipe(switchMap(([params]) => this.countService.getProjectCounts(params.projectId)));

    projectCounts$.pipe(takeUntil(this.destroy$)).subscribe((projectCounts) => {
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

  saveRename = async (name: string): Promise<boolean> => {
    if (this.organizationEnabled === false) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("projectsCannotEdit"),
      });
      return false;
    }

    const projectView = new ProjectView();
    projectView.id = this.projectId;
    projectView.organizationId = this.organizationId;
    projectView.name = name;

    await this.projectService.update(this.organizationId, projectView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("projectSaved"),
    });
    return true;
  };
}
