import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import {
  MemberDetailsFlat,
  HealthReportUriDetailWithMemberDetails,
} from "../models/password-health";

import { RiskInsightsDataService } from "./risk-insights-data.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

describe("RiskInsightsDataService - memberDetailsSubject", () => {
  let service: RiskInsightsDataService;
  const mockReportService = mock<RiskInsightsReportService>();

  beforeEach(() => {
    mockReportService.generateApplicationsReport$.mockReturnValue(
      of({
        healthReport: [],
        members: [],
      } as HealthReportUriDetailWithMemberDetails),
    );
    service = new RiskInsightsDataService(mockReportService);
  });

  it("should initialize memberDetailsSubject with an empty array", (done) => {
    service.memberDetails$.subscribe((value) => {
      expect(value).toEqual([]);
      done();
    });
  });

  it("should update memberDetailsSubject when fetchApplicationsReport succeeds", (done) => {
    const mockMembers: MemberDetailsFlat[] = [
      { id: "1", name: "Alice" } as unknown as MemberDetailsFlat,
      { id: "2", name: "Bob" } as unknown as MemberDetailsFlat,
    ];
    const mockReport: HealthReportUriDetailWithMemberDetails = {
      healthReport: [],
      members: mockMembers,
    };
    mockReportService.generateApplicationsReport$.mockReturnValue(of(mockReport));

    service.memberDetails$.subscribe((value) => {
      if (value.length > 0) {
        expect(value).toEqual(mockMembers);
        done();
      }
    });

    service.fetchApplicationsReport("org-123");
  });

  it("should set memberDetailsSubject to empty array on fetchApplicationsReport error", (done) => {
    // setup a failure when the method is called
    mockReportService.generateApplicationsReport$.mockReturnValue(
      throwError(() => new Error("Network error")),
    );

    // Set initial value to something else to verify it resets
    (service as any).memberDetailsSubject.next([
      { id: "x", name: "Test" } as unknown as MemberDetailsFlat,
    ]);

    // test to ensure that the subscribe result is an empty array
    service.memberDetails$.pipe().subscribe({
      next: (value) => {
        if (value.length === 0) {
          expect(value).toEqual([]);
          done();
        }
      },
    });

    // invoke the method that should trigger the error
    service.fetchApplicationsReport("org-123");
  });
});
