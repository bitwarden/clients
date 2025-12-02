import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { mockMemberCipherDetailsResponse } from "../../models/mocks/member-cipher-details-response.mock";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";

describe("Member Cipher Details API Service", () => {
  let memberCipherDetailsApiService: MemberCipherDetailsApiService;

  const apiService = mock<ApiService>();

  beforeEach(() => {
    memberCipherDetailsApiService = new MemberCipherDetailsApiService(apiService);
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(memberCipherDetailsApiService).not.toBeFalsy();
  });

  it("getMemberCipherDetails retrieves data", async () => {
    apiService.send.mockResolvedValue(mockMemberCipherDetailsResponse);

    const orgId = "1234";
    const result = await memberCipherDetailsApiService.getMemberCipherDetails(orgId);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(7);
    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      "/reports/member-cipher-details/" + orgId,
      null,
      true,
      true,
    );
  });
});
