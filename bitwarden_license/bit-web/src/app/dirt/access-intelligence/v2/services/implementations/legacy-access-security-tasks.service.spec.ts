import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  RiskInsightsDataService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { AdminTaskService } from "../../../../../vault/services/abstractions/admin-task.abstraction";

import { LegacyAccessSecurityTasksService } from "./legacy-access-security-tasks.service";

describe("LegacyAccessSecurityTasksService", () => {
  let service: LegacyAccessSecurityTasksService;
  const adminTaskServiceMock = mock<AdminTaskService>();
  const securityTasksApiServiceMock = mock<SecurityTasksApiService>();
  const riskInsightsDataServiceMock = mock<RiskInsightsDataService>();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new LegacyAccessSecurityTasksService(
      adminTaskServiceMock,
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
      adminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
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
      adminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([]);
      const spy = jest.spyOn(service, "requestPasswordChangeForCriticalApplications$");

      // Call the method
      await firstValueFrom(
        service.requestPasswordChangeForCriticalApplications$(organizationId, mockCipherIds),
      );

      // Verify that bulkCreateTasks was called with distinct cipher ids
      expect(adminTaskServiceMock.bulkCreateTasks).toHaveBeenCalledWith(organizationId, [
        { cipherId: "cid1", type: SecurityTaskType.UpdateAtRiskCredential },
        { cipherId: "cid2", type: SecurityTaskType.UpdateAtRiskCredential },
      ]);
      // Verify that the method was called with correct parameters
      expect(spy).toHaveBeenCalledWith(organizationId, mockCipherIds);
    });

    it("should handle error if adminTaskService errors", async () => {
      const organizationId = "org-3" as OrganizationId;
      const mockCipherIds = ["cid3" as CipherId];
      adminTaskServiceMock.bulkCreateTasks.mockRejectedValue(new Error("API fail error"));

      await expect(
        firstValueFrom(
          service.requestPasswordChangeForCriticalApplications$(organizationId, mockCipherIds),
        ),
      ).rejects.toThrow("API fail error");
    });
  });
});
