import { mock } from "jest-mock-extended";

import { MemberCipherDetailsResponse } from "..";

export const mockMemberCipherDetailsResponse: MemberCipherDetailsResponse[] = [
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-1",
    userName: "David Brent",
    email: "david.brent@wernhamhogg.uk",
    useKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab1",
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-2",
    userName: "Tim Canterbury",
    email: "tim.canterbury@wernhamhogg.uk",
    useKeyConnector: false,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-3",
    userName: "Gareth Keenan",
    email: "gareth.keenan@wernhamhogg.uk",
    useKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
      "cbea34a8-bde4-46ad-9d19-b05001227nm7",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-4",
    userName: "Dawn Tinsley",
    email: "dawn.tinsley@wernhamhogg.uk",
    useKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-5",
    userName: "Keith Bishop",
    email: "keith.bishop@wernhamhogg.uk",
    useKeyConnector: false,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab1",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
      "cbea34a8-bde4-46ad-9d19-b05001227nm5",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-1",
    userName: "Chris Finch",
    email: "chris.finch@wernhamhogg.uk",
    useKeyConnector: true,
    cipherIds: [
      "cbea34a8-bde4-46ad-9d19-b05001228ab2",
      "cbea34a8-bde4-46ad-9d19-b05001228cd3",
      "cbea34a8-bde4-46ad-9d19-b05001228xy4",
    ],
  }),
  mock<MemberCipherDetailsResponse>({
    userGuid: "user-1",
    userName: "Mister Secure",
    email: "mister.secure@secureco.com",
    useKeyConnector: true,
    cipherIds: ["cbea34a8-bde4-46ad-9d19-b05001227tt1"],
  }),
];
