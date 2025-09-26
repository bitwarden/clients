import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SecurityTaskMetricsApiService } from "./security-task-metrics-api.service";

describe("SecurityTaskMetricsApiService", () => {
  let service: SecurityTaskMetricsApiService;
  const apiService = mock<ApiService>();
  const orgId = "org-123" as OrganizationId;

  beforeEach(() => {
    service = new SecurityTaskMetricsApiService(apiService);
  });

  it("should call apiService.send with correct parameters", (done) => {
    const mockResponse = { totalTasks: 5, completedTasks: 3 };
    apiService.send.mockResolvedValueOnce(mockResponse);

    service.getSecurityTaskMetrics(orgId).subscribe((response) => {
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/tasks/${orgId}/metrics`,
        null,
        true,
        true,
      );
      expect(response).toEqual(mockResponse);
      done();
    });
  });

  it("should return an observable", () => {
    apiService.send.mockResolvedValue({});
    const result = service.getSecurityTaskMetrics(orgId);
    expect(result.subscribe).toBeDefined();
  });

  it("should propagate errors from apiService.send", (done) => {
    const error = new Error("API error");
    apiService.send.mockRejectedValue(error);

    service.getSecurityTaskMetrics(orgId).subscribe({
      next: () => {},
      error: (err: unknown) => {
        expect(err).toBe(error);
        done();
      },
    });
  });
});
