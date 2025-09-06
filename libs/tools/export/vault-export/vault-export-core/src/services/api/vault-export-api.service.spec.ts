import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { VaultExportApiService } from "./vault-export-api.service";

describe("VaultExportApiService", () => {
  let apiServiceMock: MockProxy<ApiService>;
  let sut: VaultExportApiService;

  beforeEach(() => {
    apiServiceMock = mock<ApiService>();
    sut = new VaultExportApiService(apiServiceMock);
  });

  it("should call apiService.send with correct parameters", async () => {
    const orgId: OrganizationId = "test-org-id" as OrganizationId;
    const apiResponse = { foo: "bar" };
    apiServiceMock.send.mockResolvedValue(apiResponse);

    await sut.getOrganizationExport(orgId);

    expect(apiServiceMock.send).toHaveBeenCalledWith(
      "GET",
      `/organizations/${orgId}/export`,
      null,
      true,
      true,
    );
  });
});
