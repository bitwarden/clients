import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAdoptionReportResponse } from "../response/member-adoption-report.response";

import { MemberAdoptionReportApiService } from "./member-adoption-report-api.service";
import { memberAdoptionReportPayloadMock } from "./member-adoption-report.mock";

const ORGANIZATION_ID = "5a1c0000-0000-4000-8000-00000000000f" as OrganizationId;

describe("MemberAdoptionReportApiService", () => {
  let service: MemberAdoptionReportApiService;
  let apiService: MockProxy<ApiService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    apiService.send.mockResolvedValue(memberAdoptionReportPayloadMock);

    TestBed.configureTestingModule({
      providers: [MemberAdoptionReportApiService, { provide: ApiService, useValue: apiService }],
    });

    service = TestBed.inject(MemberAdoptionReportApiService);
  });

  it("gets the report from the organization's report route, authenticated, with a json response", async () => {
    await service.getMemberAdoptionData(ORGANIZATION_ID);

    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/member-adoption/${ORGANIZATION_ID}`,
      null,
      true,
      true,
    );
  });

  it("wraps the payload in the response model", async () => {
    const response = await service.getMemberAdoptionData(ORGANIZATION_ID);

    expect(response).toBeInstanceOf(MemberAdoptionReportResponse);
    expect(response.totalMemberCount).toBe(memberAdoptionReportPayloadMock.totalMemberCount);
    expect(response.members).toHaveLength(memberAdoptionReportPayloadMock.members.length);
    expect(response.members[0].email).toBe(memberAdoptionReportPayloadMock.members[0].email);
  });

  it("surfaces an api failure to the caller", async () => {
    apiService.send.mockRejectedValue(new Error("boom"));

    await expect(service.getMemberAdoptionData(ORGANIZATION_ID)).rejects.toThrow("boom");
  });
});
