import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  createApplication,
  createReport,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { AdminTaskService } from "../../../../../vault/services/abstractions/admin-task.abstraction";

import { DefaultAccessSecurityTasksService } from "./default-access-security-tasks.service";

function buildReport(options: {
  criticalApps?: Array<{ name: string; cipherRefs: Record<string, boolean> }>;
  nonCriticalApps?: Array<{ name: string; cipherRefs: Record<string, boolean> }>;
  creationDate?: Date;
}): AccessReportView {
  const view = new AccessReportView();
  view.creationDate = options.creationDate ?? new Date("2026-04-10T00:00:00Z");

  const criticalApps = options.criticalApps ?? [];
  const nonCriticalApps = options.nonCriticalApps ?? [];

  view.reports = [
    ...criticalApps.map((a) => createReport(a.name, {}, a.cipherRefs)),
    ...nonCriticalApps.map((a) => createReport(a.name, {}, a.cipherRefs)),
  ];
  view.applications = [
    ...criticalApps.map((a) => createApplication(a.name, true)),
    ...nonCriticalApps.map((a) => createApplication(a.name, false)),
  ];
  return view;
}

function buildTask(
  cipherId: string | null,
  status: SecurityTaskStatus,
  revisionDate: Date,
): SecurityTask {
  return {
    id: `task-${cipherId}-${status}`,
    organizationId: "org-1" as OrganizationId,
    cipherId: cipherId as CipherId | null,
    type: SecurityTaskType.UpdateAtRiskCredential,
    status,
    creationDate: revisionDate,
    revisionDate,
  } as unknown as SecurityTask;
}

describe("DefaultAccessSecurityTasksService", () => {
  let service: DefaultAccessSecurityTasksService;
  let report$: BehaviorSubject<AccessReportView | null>;
  const adminTaskServiceMock = mock<AdminTaskService>();
  const securityTasksApiServiceMock = mock<SecurityTasksApiService>();

  const buildService = (reportView: AccessReportView | null) => {
    jest.clearAllMocks();
    report$ = new BehaviorSubject<AccessReportView | null>(reportView);

    const dataServiceMock = {
      report$,
    } as unknown as AccessIntelligenceDataService;

    TestBed.configureTestingModule({});
    service = new DefaultAccessSecurityTasksService(
      adminTaskServiceMock,
      securityTasksApiServiceMock,
      dataServiceMock,
    );
  };

  it("should be created", () => {
    buildService(null);
    expect(service).toBeTruthy();
  });

  describe("unassignedCriticalCipherIds$", () => {
    it("emits [] when there is no report", async () => {
      buildService(null);

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual([]);
    });

    it("emits all at-risk cipher IDs from critical apps when there are no tasks", async () => {
      const view = buildReport({
        criticalApps: [{ name: "github.com", cipherRefs: { c1: true, c2: true } }],
        nonCriticalApps: [{ name: "other.com", cipherRefs: { c3: true } }],
      });
      buildService(view);

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual(expect.arrayContaining(["c1", "c2"]));
      expect(ids).not.toContain("c3");
    });

    it("excludes ciphers with pending tasks", async () => {
      const view = buildReport({
        criticalApps: [{ name: "github.com", cipherRefs: { c1: true, c2: true } }],
      });
      buildService(view);

      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([
        buildTask("c1", SecurityTaskStatus.Pending, new Date("2026-04-11T00:00:00Z")),
      ]);
      await firstValueFrom(service.loadTasks$("org-1" as OrganizationId));

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual(["c2"]);
    });

    it("excludes ciphers with completed tasks whose revisionDate >= report.creationDate", async () => {
      const reportCreation = new Date("2026-04-10T00:00:00Z");
      const view = buildReport({
        criticalApps: [{ name: "github.com", cipherRefs: { c1: true, c2: true } }],
        creationDate: reportCreation,
      });
      buildService(view);

      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([
        buildTask("c1", SecurityTaskStatus.Completed, new Date("2026-04-11T00:00:00Z")),
      ]);
      await firstValueFrom(service.loadTasks$("org-1" as OrganizationId));

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual(["c2"]);
    });

    it("does NOT exclude ciphers whose completed task is older than the report", async () => {
      const reportCreation = new Date("2026-04-10T00:00:00Z");
      const view = buildReport({
        criticalApps: [{ name: "github.com", cipherRefs: { c1: true } }],
        creationDate: reportCreation,
      });
      buildService(view);

      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([
        buildTask("c1", SecurityTaskStatus.Completed, new Date("2026-04-01T00:00:00Z")),
      ]);
      await firstValueFrom(service.loadTasks$("org-1" as OrganizationId));

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual(["c1"]);
    });

    it("filters out tasks with null cipherId (null-guard on both pending and completed)", async () => {
      const view = buildReport({
        criticalApps: [{ name: "github.com", cipherRefs: { c1: true } }],
      });
      buildService(view);

      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([
        buildTask(null, SecurityTaskStatus.Pending, new Date("2026-04-11T00:00:00Z")),
        buildTask(null, SecurityTaskStatus.Completed, new Date("2026-04-11T00:00:00Z")),
      ]);
      await firstValueFrom(service.loadTasks$("org-1" as OrganizationId));

      const ids = await firstValueFrom(service.unassignedCriticalCipherIds$);

      expect(ids).toEqual(["c1"]);
    });
  });

  describe("requestPasswordChangeForCriticalApplications$", () => {
    beforeEach(() => {
      buildService(null);
    });

    it("passes distinct cipher IDs to bulkCreateTasks", async () => {
      const organizationId = "org-1" as OrganizationId;
      adminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([]);

      await firstValueFrom(
        service.requestPasswordChangeForCriticalApplications$(organizationId, ["c1", "c2", "c1"]),
      );

      expect(adminTaskServiceMock.bulkCreateTasks).toHaveBeenCalledWith(organizationId, [
        { cipherId: "c1", type: SecurityTaskType.UpdateAtRiskCredential },
        { cipherId: "c2", type: SecurityTaskType.UpdateAtRiskCredential },
      ]);
    });

    it("calls loadTasks$ after bulk-create completes", async () => {
      const organizationId = "org-1" as OrganizationId;
      adminTaskServiceMock.bulkCreateTasks.mockResolvedValue(undefined);
      securityTasksApiServiceMock.getAllTasks.mockResolvedValue([]);

      await firstValueFrom(
        service.requestPasswordChangeForCriticalApplications$(organizationId, ["c1"]),
      );

      expect(securityTasksApiServiceMock.getAllTasks).toHaveBeenCalledWith(organizationId);
    });

    it("propagates errors from bulkCreateTasks", async () => {
      const organizationId = "org-1" as OrganizationId;
      adminTaskServiceMock.bulkCreateTasks.mockRejectedValue(new Error("boom"));

      await expect(
        firstValueFrom(
          service.requestPasswordChangeForCriticalApplications$(organizationId, ["c1"]),
        ),
      ).rejects.toThrow("boom");
    });
  });

  describe("getTaskMetrics$", () => {
    beforeEach(() => {
      buildService(null);
    });

    it("delegates to securityTasksApiService.getTaskMetrics", async () => {
      const organizationId = "org-1" as OrganizationId;
      const metrics = {
        totalTasks: 5,
        completedTasks: 2,
        pendingTasks: 3,
      };
      securityTasksApiServiceMock.getTaskMetrics.mockReturnValue(
        new BehaviorSubject(metrics).asObservable(),
      );

      const result = await firstValueFrom(service.getTaskMetrics$(organizationId));

      expect(result).toEqual(metrics);
      expect(securityTasksApiServiceMock.getTaskMetrics).toHaveBeenCalledWith(organizationId);
    });
  });
});
