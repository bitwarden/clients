// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, combineLatest, from, switchMap, takeUntil } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
import { ProjectService } from "../../projects/project.service";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

class ServiceAccountConfig {
  organizationId: string;
  serviceAccountId: string;
  identityUrl: string;
  apiUrl: string;
  projects: ProjectListView[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-service-account-config",
  templateUrl: "./config.component.html",
  standalone: false,
})
export class ServiceAccountConfigComponent implements OnInit, OnDestroy {
  identityUrl: string;
  apiUrl: string;
  organizationId: string;
  serviceAccountId: string;
  projects: ProjectListView[];
  hasProjects = false;

  private destroy$ = new Subject<void>();
  loading = true;

  constructor(
    private environmentService: EnvironmentService,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private projectService: ProjectService,
    private accessPolicyService: AccessPolicyService,
  ) {}

  async ngOnInit() {
    combineLatest([this.route.params, this.environmentService.environment$])
      .pipe(
        switchMap(([params, env]) =>
          from(this.load(env, params.organizationId, params.serviceAccountId)),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((smConfig) => {
        this.identityUrl = smConfig.identityUrl;
        this.apiUrl = smConfig.apiUrl;
        this.organizationId = smConfig.organizationId;
        this.serviceAccountId = smConfig.serviceAccountId;
        this.projects = smConfig.projects;

        this.hasProjects = smConfig.projects.length > 0;
        this.loading = false;
      });
  }

  private async load(
    environment: Environment,
    organizationId: string,
    serviceAccountId: string,
  ): Promise<ServiceAccountConfig> {
    const allProjects = await this.projectService.getProjects(organizationId);
    const policies = await this.accessPolicyService.getServiceAccountGrantedPolicies(
      organizationId,
      serviceAccountId,
    );

    const projects = policies.grantedProjectPolicies.map((policy) => {
      return {
        id: policy.accessPolicy.grantedProjectId,
        name: policy.accessPolicy.grantedProjectName,
        organizationId: organizationId,
        linkable: allProjects.some(
          (project) => project.id === policy.accessPolicy.grantedProjectId,
        ),
      } as ProjectListView;
    });

    return {
      organizationId,
      serviceAccountId,
      identityUrl: environment.getIdentityUrl(),
      apiUrl: environment.getApiUrl(),
      projects,
    } as ServiceAccountConfig;
  }

  copyIdentityUrl = () => {
    this.platformUtilsService.copyToClipboard(this.identityUrl);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("identityUrl")),
    });
  };

  copyApiUrl = () => {
    this.platformUtilsService.copyToClipboard(this.apiUrl);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("apiUrl")),
    });
  };

  copyOrganizationId = () => {
    this.platformUtilsService.copyToClipboard(this.organizationId);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("organizationId")),
    });
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
