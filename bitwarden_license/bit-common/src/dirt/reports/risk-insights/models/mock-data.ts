import { mock } from "jest-mock-extended";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MemberCipherDetailsResponse } from "../response/member-cipher-details.response";

import { ApplicationHealthReportDetailEnriched } from "./report-data-service.types";
import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

const mockApplication1: ApplicationHealthReportDetail = {
  applicationName: "application1.com",
  passwordCount: 2,
  atRiskPasswordCount: 1,
  atRiskCipherIds: ["cipher-1"],
  memberCount: 2,
  atRiskMemberCount: 1,
  memberDetails: [
    {
      userGuid: "user-id-1",
      userName: "tom",
      email: "tom@application1.com",
      cipherId: "cipher-1",
    },
  ],
  atRiskMemberDetails: [
    {
      userGuid: "user-id-2",
      userName: "tom",
      email: "tom2@application1.com",
      cipherId: "cipher-2",
    },
  ],
  cipherIds: ["cipher-1", "cipher-2"],
};

const mockApplication2: ApplicationHealthReportDetail = {
  applicationName: "site2.application1.com",
  passwordCount: 0,
  atRiskPasswordCount: 0,
  atRiskCipherIds: [],
  memberCount: 0,
  atRiskMemberCount: 0,
  memberDetails: [],
  atRiskMemberDetails: [],
  cipherIds: [],
};
const mockApplication3: ApplicationHealthReportDetail = {
  applicationName: "application2.com",
  passwordCount: 0,
  atRiskPasswordCount: 0,
  atRiskCipherIds: [],
  memberCount: 0,
  atRiskMemberCount: 0,
  memberDetails: [],
  atRiskMemberDetails: [],
  cipherIds: [],
};

export const mockReportData: ApplicationHealthReportDetail[] = [
  mockApplication1,
  mockApplication2,
  mockApplication3,
];

export const mockSummaryData: OrganizationReportSummary = {
  totalMemberCount: 5,
  totalAtRiskMemberCount: 2,
  totalApplicationCount: 3,
  totalAtRiskApplicationCount: 1,
  totalCriticalMemberCount: 1,
  totalCriticalAtRiskMemberCount: 1,
  totalCriticalApplicationCount: 1,
  totalCriticalAtRiskApplicationCount: 1,
  newApplications: [],
};
export const mockApplicationData: OrganizationReportApplication[] = [
  {
    applicationName: "application1.com",
    isCritical: true,
  },
  {
    applicationName: "application2.com",
    isCritical: false,
  },
];

export const mockEnrichedReportData: ApplicationHealthReportDetailEnriched[] = [
  { ...mockApplication1, isMarkedAsCritical: true, ciphers: [] },
  { ...mockApplication2, isMarkedAsCritical: false, ciphers: [] },
];

export const mockCipherViews: CipherView[] = [
  mock<CipherView>({
    id: "cipher-1",
    type: CipherType.Login,
    login: { password: "pass1", username: "user1", uris: [{ uri: "https://app.com/login" }] },
    isDeleted: false,
    viewPassword: true,
  }),
  mock<CipherView>({
    id: "cipher-2",
    type: CipherType.Login,
    login: { password: "pass2", username: "user2", uris: [{ uri: "app.com/home" }] },
    isDeleted: false,
    viewPassword: true,
  }),
  mock<CipherView>({
    id: "cipher-3",
    type: CipherType.Login,
    login: { password: "pass3", username: "user3", uris: [{ uri: "https://other.com" }] },
    isDeleted: false,
    viewPassword: true,
  }),
];

export const mockMemberDetails = [
  mock<MemberCipherDetailsResponse>({
    cipherIds: ["cipher-1"],
    userGuid: "user1",
    userName: "User 1",
    email: "user1@app.com",
  }),
  mock<MemberCipherDetailsResponse>({
    cipherIds: ["cipher-2"],
    userGuid: "user2",
    userName: "User 2",
    email: "user2@app.com",
  }),
  mock<MemberCipherDetailsResponse>({
    cipherIds: ["cipher-3"],
    userGuid: "user3",
    userName: "User 3",
    email: "user3@other.com",
  }),
];
