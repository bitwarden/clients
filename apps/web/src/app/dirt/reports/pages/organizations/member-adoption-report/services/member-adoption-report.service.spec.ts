import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAdoptionReportResponse } from "../response/member-adoption-report.response";
import {
  MemberAdoptionExportItem,
  memberAdoptionExportHeaders,
} from "../view/member-adoption-report.view";

import { MemberAdoptionReportApiService } from "./member-adoption-report-api.service";
import { memberAdoptionReportPayloadMock } from "./member-adoption-report.mock";
import { MemberAdoptionReportService } from "./member-adoption-report.service";

const ORGANIZATION_ID = "5a1c0000-0000-4000-8000-00000000000f" as OrganizationId;

describe("MemberAdoptionReportService", () => {
  let service: MemberAdoptionReportService;
  let apiService: MockProxy<MemberAdoptionReportApiService>;
  let i18nService: MockProxy<I18nService>;

  const respondWith = (payload: unknown): void => {
    apiService.getMemberAdoptionData.mockResolvedValue(new MemberAdoptionReportResponse(payload));
  };

  beforeEach(() => {
    apiService = mock<MemberAdoptionReportApiService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((id: string) => (id === "yes" ? "Yes" : "No"));

    TestBed.configureTestingModule({
      providers: [
        MemberAdoptionReportService,
        { provide: MemberAdoptionReportApiService, useValue: apiService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(MemberAdoptionReportService);
  });

  describe("getMemberAdoptionReport", () => {
    it("asks the api for the organization under report", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(apiService.getMemberAdoptionData).toHaveBeenCalledWith(ORGANIZATION_ID);
    });

    it("maps the totals onto the view", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(report.totalMemberCount).toBe(12);
      expect(report.activeMemberCount).toBe(8);
      expect(report.inactiveMemberCount).toBe(4);
      expect(report.sponsoredFamiliesRedeemedCount).toBe(3);
    });

    it("maps every member onto a row, in the order the api returned them", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(report.members).toHaveLength(memberAdoptionReportPayloadMock.members.length);
      expect(report.members.map((member) => member.email)).toEqual(
        memberAdoptionReportPayloadMock.members.map((member) => member.email),
      );
      expect(report.members[0]).toEqual({
        organizationUserId: "5a1c0001-0000-4000-8000-000000000001",
        userId: "5a1c1001-0000-4000-8000-000000000001",
        name: "Sarah Johnson",
        email: "sjohnson@example.com",
        hasRecentLogin: true,
        hasExtensionInstalled: true,
        vaultItemCount: 42,
        sharedItemCount: 12,
      });
    });

    it("keeps a member with no account as a row with a null user id", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);
      const invited = report.members.find((member) => member.email === "invited@example.com");

      expect(invited).toBeDefined();
      expect(invited!.userId).toBeNull();
      expect(invited!.name).toBe("");
    });

    it("falls back to empty totals and no rows for a payload with nothing in it", async () => {
      respondWith({});

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(report).toEqual({
        totalMemberCount: 0,
        activeMemberCount: 0,
        inactiveMemberCount: 0,
        sponsoredFamiliesRedeemedCount: 0,
        members: [],
      });
    });

    it("defaults the signals a member payload leaves out", async () => {
      respondWith({
        totalMemberCount: 1,
        members: [{ organizationUserId: "5a1c0001-0000-4000-8000-0000000000ff" }],
      });

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(report.members[0]).toEqual({
        organizationUserId: "5a1c0001-0000-4000-8000-0000000000ff",
        userId: null,
        name: "",
        email: "",
        hasRecentLogin: false,
        hasExtensionInstalled: false,
        vaultItemCount: 0,
        sharedItemCount: 0,
      });
    });

    it("reads a PascalCase payload, which the response model tolerates", async () => {
      respondWith({
        TotalMemberCount: 1,
        ActiveMemberCount: 1,
        InactiveMemberCount: 0,
        SponsoredFamiliesRedeemedCount: 1,
        Members: [
          {
            OrganizationUserId: "5a1c0001-0000-4000-8000-0000000000fe",
            UserId: "5a1c1001-0000-4000-8000-0000000000fe",
            Name: "Sarah Johnson",
            Email: "sjohnson@example.com",
            HasRecentLogin: true,
            HasExtensionInstalled: true,
            VaultItemCount: 42,
            SharedItemCount: 12,
          },
        ],
      });

      const report = await service.getMemberAdoptionReport(ORGANIZATION_ID);

      expect(report.totalMemberCount).toBe(1);
      expect(report.sponsoredFamiliesRedeemedCount).toBe(1);
      expect(report.members[0]).toEqual({
        organizationUserId: "5a1c0001-0000-4000-8000-0000000000fe",
        userId: "5a1c1001-0000-4000-8000-0000000000fe",
        name: "Sarah Johnson",
        email: "sjohnson@example.com",
        hasRecentLogin: true,
        hasExtensionInstalled: true,
        vaultItemCount: 42,
        sharedItemCount: 12,
      });
    });

    it("surfaces an api failure to the caller", async () => {
      apiService.getMemberAdoptionData.mockRejectedValue(new Error("boom"));

      await expect(service.getMemberAdoptionReport(ORGANIZATION_ID)).rejects.toThrow("boom");
    });
  });

  describe("getMemberAdoptionExportItems", () => {
    it("flattens each member to the CSV row shape", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const items = await service.getMemberAdoptionExportItems(ORGANIZATION_ID);

      expect(items).toHaveLength(memberAdoptionReportPayloadMock.members.length);
      expect(items[0]).toEqual({
        name: "Sarah Johnson",
        email: "sjohnson@example.com",
        recentLogin: "Yes",
        extensionInstalled: "Yes",
        vaultItems: "42",
        itemsSharedWithThem: "12",
      } satisfies MemberAdoptionExportItem);
    });

    it("emits its fields in the order the CSV headers declare", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const items = await service.getMemberAdoptionExportItems(ORGANIZATION_ID);

      expect(Object.keys(items[0])).toEqual(Object.keys(memberAdoptionExportHeaders));
    });

    it("resolves the localized yes and no rather than the raw booleans", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const items = await service.getMemberAdoptionExportItems(ORGANIZATION_ID);
      const noLogin = items.find((item) => item.email === "bwilliams@example.com");

      expect(noLogin).toBeDefined();
      expect(noLogin!.recentLogin).toBe("No");
      expect(noLogin!.extensionInstalled).toBe("Yes");
      expect(i18nService.t).toHaveBeenCalledWith("yes");
      expect(i18nService.t).toHaveBeenCalledWith("no");
    });

    it("translates yes and no once for the whole export, not once per row", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      await service.getMemberAdoptionExportItems(ORGANIZATION_ID);

      expect(i18nService.t).toHaveBeenCalledTimes(2);
    });

    it("stringifies the counts so every column is a display string", async () => {
      respondWith(memberAdoptionReportPayloadMock);

      const items = await service.getMemberAdoptionExportItems(ORGANIZATION_ID);

      expect(items.map((item) => item.vaultItems)).toEqual(
        memberAdoptionReportPayloadMock.members.map((member) => String(member.vaultItemCount)),
      );
      expect(items.every((item) => typeof item.itemsSharedWithThem === "string")).toBe(true);
    });

    it("returns no rows for an organization with no members", async () => {
      respondWith({});

      await expect(service.getMemberAdoptionExportItems(ORGANIZATION_ID)).resolves.toEqual([]);
    });

    it("surfaces an api failure to the caller", async () => {
      apiService.getMemberAdoptionData.mockRejectedValue(new Error("boom"));

      await expect(service.getMemberAdoptionExportItems(ORGANIZATION_ID)).rejects.toThrow("boom");
    });
  });
});
