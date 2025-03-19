import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";

export const mockMemberCipherDetails: any = [
  {
    userName: "David Brent",
    email: "david.brent@wernhamhogg.uk",
    usesKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab1",
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  },
  {
    userName: "Tim Canterbury",
    email: "tim.canterbury@wernhamhogg.uk",
    usesKeyConnector: false,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  },
  {
    userName: "Gareth Keenan",
    email: "gareth.keenan@wernhamhogg.uk",
    usesKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
      "cbea34a8-bde4-46ad-9d19-b05001227nm7",
    ],
  },
  {
    userName: "Dawn Tinsley",
    email: "dawn.tinsley@wernhamhogg.uk",
    usesKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
    ],
  },
  {
    userName: "Keith Bishop",
    email: "keith.bishop@wernhamhogg.uk",
    usesKeyConnector: false,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab1",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  },
  {
    userName: "Chris Finch",
    email: "chris.finch@wernhamhogg.uk",
    usesKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
    ],
  },
  {
    userName: "Mister Secure",
    email: "mister.secure@secureco.com",
    usesKeyConnector: true,
    cipherIds: ["cbea34a8-bde4-46ad-9d19-b05001227tt1"],
  },
];

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
    apiService.send.mockResolvedValue(mockMemberCipherDetails);

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
