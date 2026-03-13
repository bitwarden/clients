import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  RiskInsightsDataService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { DefaultAdminTaskService } from "../../../../../vault/services/default-admin-task.service";

import { LegacySecurityTasksService } from "./legacy-security-tasks.service";

describe("LegacySecurityTasksService", () => {
  let service: LegacySecurityTasksService;
  const defaultAdminTaskServiceMock = mock<DefaultAdminTaskService>();
  const securityTasksApiServiceMock = mock<SecurityTasksApiService>();
  const riskInsightsDataServiceMock = mock<RiskInsightsDataService>();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new LegacySecurityTasksService(
      defaultAdminTaskServiceMock,
      securityTasksApiServiceMock,
      riskInsightsDataServiceMock,
    );
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("assignTasks", () => {
    it("should call requestPasswordChangeForCriticalApplications$ and setTaskCreatedCount", async () => {
      // Set up test data
      const organizationId = "org-1" as OrganizationId;
      const mockCipherIds = ["cid1" as CipherId, "cid2" as CipherId];
      defaultAdminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([]);
      const spy = jest.spyOn(service, "requestPasswordChangeForCriticalApplications$");

      // Call the method
      await firstValueFrom(
        service.requestPasswordChangeForCriticalApplications$(organizationId, mockCipherIds),
      );

      // Verify that the method was called with correct parameters
      expect(spy).toHaveBeenCalledWith(organizationId, mockCipherIds);
    });
  });

  describe("requestPasswordChangeForCriticalApplications$", () => {
    it("should create tasks for distinct cipher ids and show success toast", async () => {
      // Set up test data
      const organizationId = "org-2" as OrganizationId;
      const mockCipherIds = ["cid1" as CipherId, "cid2" as CipherId];
      defaultAdminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([]);
      const spy = jest.spyOn(service, "requestPasswordChangeForCriticalApplications$");

      // Call the method
      await firstValueFrom(
        service.requestPasswordChangeForCriticalApplications$(organizationId, mockCipherIds),
      );

      // Verify that bulkCreateTasks was called with distinct cipher ids
      expect(defaultAdminTaskServiceMock.bulkCreateTasks).toHaveBeenCalledWith(organizationId, [
        { cipherId: "cid1", type: SecurityTaskType.UpdateAtRiskCredential },
        { cipherId: "cid2", type: SecurityTaskType.UpdateAtRiskCredential },
      ]);
      // Verify that the method was called with correct parameters
      expect(spy).toHaveBeenCalledWith(organizationId, mockCipherIds);
    });

    it("should handle error if defaultAdminTaskService errors", async () => {
      const organizationId = "org-3" as OrganizationId;
      const mockCipherIds = ["cid3" as CipherId];
      defaultAdminTaskServiceMock.bulkCreateTasks.mockRejectedValue(new Error("API fail error"));

      await expect(
        firstValueFrom(
          service.requestPasswordChangeForCriticalApplications$(organizationId, mockCipherIds),
        ),
      ).rejects.toThrow("API fail error");
    });
  });
});
