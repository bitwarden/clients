import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/src/types/guid";

import { MemberAccessReportApiService } from "./member-access-report-api.service";
import { memberAccessReportsMock } from "./member-access-report.mock";
import { MemberAccessReportService } from "./member-access-report.service";
describe("ImportService", () => {
  const mockOrganizationId = "mockOrgId" as OrganizationId;
  const reportApiService = mock<MemberAccessReportApiService>();
  let memberAccessReportService: MemberAccessReportService;
  const i18nService = mock<I18nService>();

  beforeEach(() => {
    reportApiService.getMemberAccessData.mockImplementation(() =>
      Promise.resolve(memberAccessReportsMock),
    );
    memberAccessReportService = new MemberAccessReportService(reportApiService, i18nService);
  });

  describe("generateMemberAccessReportView", () => {
    it("should generate member access report view", () => {
      const result = memberAccessReportService.generateMemberAccessReportView(mockOrganizationId);

      expect(result).toEqual([
        {
          name: "Sarah Johnson",
          email: "sjohnson@email.com",
          collectionsCount: 4,
          groupsCount: 3,
          itemsCount: 70,
        },
        {
          name: "James Lull",
          email: "jlull@email.com",
          collectionsCount: 2,
          groupsCount: 2,
          itemsCount: 20,
        },
        {
          name: "Beth Williams",
          email: "bwilliams@email.com",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 60,
        },
        {
          name: "Ray Williams",
          email: "rwilliams@email.com",
          collectionsCount: 3,
          groupsCount: 3,
          itemsCount: 36,
        },
      ]);
    });
  });

  describe("generateUserReportExportItems", () => {
    it("should generate user report export items", async () => {
      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "sjohnson@email.com",
            name: "Sarah Johnson",
            twoStepLogin: "On",
            accountRecovery: "On",
            group: "Group 1",
            collection: expect.any(String),
            collectionPermission: "read only",
            totalItems: "10",
          }),
          expect.objectContaining({
            email: "jlull@email.com",
            name: "James Lull",
            twoStepLogin: "Off",
            accountRecovery: "Off",
            group: "(No group)",
            collection: expect.any(String),
            collectionPermission: "read only",
            totalItems: "15",
          }),
        ]),
      );
    });
  });
});
