import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskStatus } from "@bitwarden/vault";

import { CreateTasksRequest } from "./abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "./default-admin-task.service";

describe("DefaultAdminTaskService", () => {
  let defaultAdminTaskService: DefaultAdminTaskService;
  let apiService: MockProxy<ApiService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    defaultAdminTaskService = new DefaultAdminTaskService(apiService);
  });

  describe("getAllTasks", () => {
    it("should call the api service with the correct parameters with status", async () => {
      const organizationId = "orgId" as OrganizationId;
      const status = SecurityTaskStatus.Pending;
      const expectedUrl = `/tasks/organization?organizationId=${organizationId}&status=0`;

      await defaultAdminTaskService.getAllTasks(organizationId, status);

      expect(apiService.send).toHaveBeenCalledWith("GET", expectedUrl, null, true, true);
    });

    it("should call the api service with the correct parameters without status", async () => {
      const organizationId = "orgId" as OrganizationId;
      const expectedUrl = `/tasks/organization?organizationId=${organizationId}`;

      await defaultAdminTaskService.getAllTasks(organizationId);

      expect(apiService.send).toHaveBeenCalledWith("GET", expectedUrl, null, true, true);
    });
  });

  describe("bulkCreateTasks", () => {
    it("should call the api service with the correct parameters", async () => {
      const organizationId = "orgId" as OrganizationId;
      const tasks: CreateTasksRequest[] = [
        {
          cipherId: "cipherId-1" as CipherId,
          type: "updateAtRiskCredential",
        },
        {
          cipherId: "cipherId-2" as CipherId,
          type: "updateAtRiskCredential",
        },
      ];

      await defaultAdminTaskService.bulkCreateTasks(organizationId, tasks);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/tasks/${organizationId}/bulk-create`,
        tasks,
        true,
        true,
      );
    });
  });
});
