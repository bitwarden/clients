import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import {
  AllActivitiesService,
  ApplicationHealthReportDetailEnriched,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { ToastService } from "@bitwarden/components";

import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

import { AccessIntelligenceSecurityTasksService } from "./security-tasks.service";

describe("AccessIntelligenceSecurityTasksService", () => {
  let service: AccessIntelligenceSecurityTasksService;
  const defaultAdminTaskServiceSpy = mock<DefaultAdminTaskService>();
  const allActivitiesServiceSpy = mock<AllActivitiesService>();
  const toastServiceSpy = mock<ToastService>();
  const i18nServiceSpy = mock<I18nService>();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new AccessIntelligenceSecurityTasksService(
      allActivitiesServiceSpy,
      defaultAdminTaskServiceSpy,
      toastServiceSpy,
      i18nServiceSpy,
    );
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("assignTasks", () => {
    it("should call requestPasswordChange and setTaskCreatedCount", async () => {
      const organizationId = "org-1" as OrganizationId;
      const apps = [
        {
          isMarkedAsCritical: true,
          atRiskPasswordCount: 1,
          atRiskCipherIds: ["cid1"],
        } as ApplicationHealthReportDetailEnriched,
      ];
      const spy = jest.spyOn(service, "requestPasswordChange").mockResolvedValue(2);
      await service.assignTasks(organizationId, apps);
      expect(spy).toHaveBeenCalledWith(organizationId, apps);
      expect(allActivitiesServiceSpy.setTaskCreatedCount).toHaveBeenCalledWith(2);
    });
  });

  describe("requestPasswordChange", () => {
    it("should create tasks for distinct cipher ids and show success toast", async () => {
      const organizationId = "org-2" as OrganizationId;
      const apps = [
        {
          isMarkedAsCritical: true,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cid1", "cid2"],
        } as ApplicationHealthReportDetailEnriched,
        {
          isMarkedAsCritical: true,
          atRiskPasswordCount: 1,
          atRiskCipherIds: ["cid2"],
        } as ApplicationHealthReportDetailEnriched,
      ];
      defaultAdminTaskServiceSpy.bulkCreateTasks.mockResolvedValue(undefined);
      i18nServiceSpy.t.mockImplementation((key) => key);

      const result = await service.requestPasswordChange(organizationId, apps);

      expect(defaultAdminTaskServiceSpy.bulkCreateTasks).toHaveBeenCalledWith(organizationId, [
        { cipherId: "cid1", type: SecurityTaskType.UpdateAtRiskCredential },
        { cipherId: "cid2", type: SecurityTaskType.UpdateAtRiskCredential },
      ]);
      expect(toastServiceSpy.showToast).toHaveBeenCalledWith({
        message: "notifiedMembers",
        variant: "success",
        title: "success",
      });
      expect(result).toBe(2);
    });

    it("should show error toast and return 0 if bulkCreateTasks throws", async () => {
      const organizationId = "org-3" as OrganizationId;
      const apps = [
        {
          isMarkedAsCritical: true,
          atRiskPasswordCount: 1,
          atRiskCipherIds: ["cid3"],
        } as ApplicationHealthReportDetailEnriched,
      ];
      defaultAdminTaskServiceSpy.bulkCreateTasks.mockRejectedValue(new Error("fail"));
      i18nServiceSpy.t.mockImplementation((key) => key);

      const result = await service.requestPasswordChange(organizationId, apps);

      expect(toastServiceSpy.showToast).toHaveBeenCalledWith({
        message: "unexpectedError",
        variant: "error",
        title: "error",
      });
      expect(result).toBe(0);
    });

    it("should not create any tasks if no apps have atRiskPasswordCount > 0", async () => {
      const organizationId = "org-4" as OrganizationId;
      const apps = [
        {
          isMarkedAsCritical: true,
          atRiskPasswordCount: 0,
          atRiskCipherIds: ["cid4"],
        } as ApplicationHealthReportDetailEnriched,
      ];
      const result = await service.requestPasswordChange(organizationId, apps);

      expect(defaultAdminTaskServiceSpy.bulkCreateTasks).toHaveBeenCalledWith(organizationId, []);
      expect(result).toBe(0);
    });

    it("should not create any tasks for non-critical apps", async () => {
      const organizationId = "org-5" as OrganizationId;
      const apps = [
        {
          isMarkedAsCritical: false,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cid5", "cid6"],
        } as ApplicationHealthReportDetailEnriched,
      ];
      const result = await service.requestPasswordChange(organizationId, apps);

      expect(defaultAdminTaskServiceSpy.bulkCreateTasks).toHaveBeenCalledWith(organizationId, []);
      expect(result).toBe(0);
    });
  });
});
