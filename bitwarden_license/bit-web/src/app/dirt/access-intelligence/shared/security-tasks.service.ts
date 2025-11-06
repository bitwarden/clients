import { Injectable } from "@angular/core";

import {
  AllActivitiesService,
  ApplicationHealthReportDetailEnriched,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { ToastService } from "@bitwarden/components";

import { CreateTasksRequest } from "../../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

@Injectable()
export class AccessIntelligenceSecurityTasksService {
  constructor(
    private allActivitiesService: AllActivitiesService,
    private adminTaskService: DefaultAdminTaskService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}
  async assignTasks(organizationId: OrganizationId, apps: ApplicationHealthReportDetailEnriched[]) {
    const taskCount = await this.requestPasswordChange(organizationId, apps);
    this.allActivitiesService.setTaskCreatedCount(taskCount);
  }

  // TODO: this method is shared between here and critical-applications.component.ts
  async requestPasswordChange(
    organizationId: OrganizationId,
    apps: ApplicationHealthReportDetailEnriched[],
  ): Promise<number> {
    // Only create tasks for CRITICAL applications with at-risk passwords
    const cipherIds = apps
      .filter((_) => _.isMarkedAsCritical && _.atRiskPasswordCount > 0)
      .flatMap((app) => app.atRiskCipherIds);

    const distinctCipherIds = Array.from(new Set(cipherIds));

    const tasks: CreateTasksRequest[] = distinctCipherIds.map((cipherId) => ({
      cipherId: cipherId as CipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    try {
      await this.adminTaskService.bulkCreateTasks(organizationId, tasks);
      this.toastService.showToast({
        message: this.i18nService.t("notifiedMembers"),
        variant: "success",
        title: this.i18nService.t("success"),
      });

      return tasks.length;
    } catch {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
    }

    return 0;
  }
}
