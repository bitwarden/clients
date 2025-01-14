import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskStatus } from "@bitwarden/vault";

import { DefaultAdminTaskService } from "./default-admin-task.service";
describe("DefaultAdminTaskService", () => {
  let defaultAdminTaskService: DefaultAdminTaskService;
  let apiService: MockProxy<ApiService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    defaultAdminTaskService = new DefaultAdminTaskService(apiService);
  });

  describe("getAllTasks", () => {
    it("should call the api service with the correct parameters", async () => {
      const organizationId = "orgId" as OrganizationId;
      const status = SecurityTaskStatus.Pending;
      const expectedUrl = `/tasks/organization?organizationId=${organizationId}&status=0`;

      await defaultAdminTaskService.getAllTasks(organizationId, status);

      expect(apiService.send).toHaveBeenCalledWith("GET", expectedUrl, null, true, true);
    });
  });
});
