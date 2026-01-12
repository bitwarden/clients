// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { ProjectService } from "../projects/project.service";

/**
 * Redirects to projects list if the user doesn't have access to project.
 */
export const projectAccessGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const projectService = inject(ProjectService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);

  try {
    const project = await projectService.getByProjectId(route.params.projectId, true);
    if (project) {
      return true;
    }
  } catch {
    toastService.showToast({
      variant: "error",
      title: null,
      message: i18nService.t("notFound", i18nService.t("project")),
    });
    return createUrlTreeFromSnapshot(route, ["/sm", route.params.organizationId, "projects"]);
  }
  return createUrlTreeFromSnapshot(route, ["/sm", route.params.organizationId, "projects"]);
};
