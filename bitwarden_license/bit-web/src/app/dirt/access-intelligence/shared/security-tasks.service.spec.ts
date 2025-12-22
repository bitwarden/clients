import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

import { AccessIntelligenceSecurityTasksService } from "./security-tasks.service";

describe("AccessIntelligenceSecurityTasksService", () => {
  let service: AccessIntelligenceSecurityTasksService;
  const defaultAdminTaskServiceMock = mock<DefaultAdminTaskService>();
  const securityTasksApiServiceMock = mock<SecurityTasksApiService>();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new AccessIntelligenceSecurityTasksService(
      defaultAdminTaskServiceMock,
      securityTasksApiServiceMock,
    );
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("assignTasks", () => {
    it("should call requestPasswordChangeForCriticalApplications and setTaskCreatedCount", async () => {
      // Set up test data
      const organizationId = "org-1" as OrganizationId;
      const mockCipherIds = ["cid1" as CipherId, "cid2" as CipherId];
      const spy = jest.spyOn(service, "requestPasswordChangeForCriticalApplications");

      // Call the method
      await service.requestPasswordChangeForCriticalApplications(organizationId, mockCipherIds);

      // Verify that the method was called with correct parameters
      expect(spy).toHaveBeenCalledWith(organizationId, mockCipherIds);
    });
  });

  describe("requestPasswordChangeForCriticalApplications", () => {
    it("should create tasks for distinct cipher ids and show success toast", async () => {
      // Set up test data
      const organizationId = "org-2" as OrganizationId;
      const mockCipherIds = ["cid1" as CipherId, "cid2" as CipherId];
      defaultAdminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      const spy = jest.spyOn(service, "requestPasswordChangeForCriticalApplications");

      // Call the method
      await service.requestPasswordChangeForCriticalApplications(organizationId, mockCipherIds);

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
        service.requestPasswordChangeForCriticalApplications(organizationId, mockCipherIds),
      ).rejects.toThrow("API fail error");
    });
  });
});
