import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SecurityTasksApiService, TaskMetrics } from "./security-tasks-api.service";

describe("SecurityTasksApiService", () => {
  const apiServiceMock = mock<ApiService>();
  let service: SecurityTasksApiService;

  beforeEach(() => {
    service = new SecurityTasksApiService(apiServiceMock);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("getTaskMetrics", () => {
    it("should call apiService.send with correct parameters", (done) => {
      const orgId = { toString: () => "org-123" } as OrganizationId;
      const mockMetrics: TaskMetrics = { completedTasks: 2, totalTasks: 5 };
      apiServiceMock.send.mockReturnValue(Promise.resolve(mockMetrics));

      service.getTaskMetrics(orgId).subscribe((metrics) => {
        expect(apiServiceMock.send).toHaveBeenCalledWith(
          "GET",
          "/tasks/org-123/metrics",
          null,
          true,
          true,
        );
        expect(metrics).toEqual(mockMetrics);
        done();
      });
    });

    it("should propagate errors from apiService.send", (done) => {
      const orgId = { toString: () => "org-456" } as OrganizationId;
      const error = new Error("API error");
      apiServiceMock.send.mockReturnValue(Promise.reject(error));

      service.getTaskMetrics(orgId).subscribe({
        next: () => {},
        error: (err: unknown) => {
          expect(err).toBe(error);
          done();
        },
      });
    });
  });
});
