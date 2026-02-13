import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { RiskInsightsApplicationView } from "./risk-insights-application.view";
import { RiskInsightsReportView } from "./risk-insights-report.view";
import { MemberRegistry, RiskInsightsView } from "./risk-insights.view";

describe("RiskInsightsView", () => {
  // ==================== Test Helpers ====================

  const createMemberRegistry = (
    members: Array<{ id: string; name: string; email: string }>,
  ): MemberRegistry => {
    const registry: MemberRegistry = {};
    members.forEach((m) => {
      registry[m.id] = { id: m.id, userName: m.name, email: m.email };
    });
    return registry;
  };

  const createReport = (
    applicationName: string,
    memberRefs: Record<string, boolean>,
    cipherRefs: Record<string, boolean>,
  ): RiskInsightsReportView => {
    const report = new RiskInsightsReportView();
    report.applicationName = applicationName;
    report.memberRefs = memberRefs;
    report.cipherRefs = cipherRefs;
    report.passwordCount = Object.keys(cipherRefs).length;
    report.atRiskPasswordCount = Object.values(cipherRefs).filter((v) => v).length;
    report.memberCount = Object.keys(memberRefs).length;
    report.atRiskMemberCount = Object.values(memberRefs).filter((v) => v).length;
    return report;
  };

  const createApplication = (
    name: string,
    isCritical: boolean,
    reviewedDate?: Date,
  ): RiskInsightsApplicationView => {
    const app = new RiskInsightsApplicationView();
    app.applicationName = name;
    app.isCritical = isCritical;
    app.reviewedDate = reviewedDate;
    return app;
  };

  // ==================== Constructor Tests ====================

  describe("constructor", () => {
    it("should create empty view when no parameter provided", () => {
      const view = new RiskInsightsView();

      expect(view.id).toBe("");
      expect(view.organizationId).toBe("");
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
      expect(view.creationDate).toBeInstanceOf(Date);
    });

    it("should initialize from domain model", () => {
      const mockDomain = {
        id: "report-123" as OrganizationReportId,
        organizationId: "org-456" as OrganizationId,
        creationDate: new Date("2024-01-15"),
        contentEncryptionKey: undefined,
      } as any;

      const view = new RiskInsightsView(mockDomain);

      expect(view.id).toBe("report-123");
      expect(view.organizationId).toBe("org-456");
      expect(view.creationDate).toEqual(new Date("2024-01-15"));
    });
  });

  // ==================== Query Methods ====================

  describe("getAtRiskMembers", () => {
    it("should return all unique at-risk members across applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true, u2: false }, {}),
        createReport("gitlab.com", { u1: true, u3: true }, {}),
      ];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(2);
      expect(atRiskMembers.map((m) => m.id).sort()).toEqual(["u1", "u3"]);
    });

    it("should deduplicate members appearing in multiple applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, {}),
        createReport("gitlab.com", { u1: true }, {}),
        createReport("bitbucket.com", { u1: true }, {}),
      ];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(1);
      expect(atRiskMembers[0].id).toBe("u1");
    });

    it("should return empty array when no at-risk members exist", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u1: false }, {})];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(0);
    });

    it("should filter out members not in registry", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u1: true, u999: true }, {})];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(1);
      expect(atRiskMembers[0].id).toBe("u1");
    });
  });

  describe("getCriticalApplications", () => {
    it("should return only critical application reports", () => {
      const view = new RiskInsightsView();
      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", false),
        createApplication("bitbucket.com", true),
      ];

      view.reports = [
        createReport("github.com", {}, {}),
        createReport("gitlab.com", {}, {}),
        createReport("bitbucket.com", {}, {}),
      ];

      const criticalApps = view.getCriticalApplications();

      expect(criticalApps).toHaveLength(2);
      expect(criticalApps.map((r) => r.applicationName).sort()).toEqual([
        "bitbucket.com",
        "github.com",
      ]);
    });

    it("should return empty array when no critical applications exist", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false)];
      view.reports = [createReport("github.com", {}, {})];

      const criticalApps = view.getCriticalApplications();

      expect(criticalApps).toHaveLength(0);
    });
  });

  describe("getNewApplications", () => {
    it("should return only unreviewed applications", () => {
      const view = new RiskInsightsView();
      view.applications = [
        createApplication("github.com", false, new Date("2024-01-15")),
        createApplication("gitlab.com", false, undefined),
        createApplication("bitbucket.com", false, undefined),
      ];

      view.reports = [
        createReport("github.com", {}, {}),
        createReport("gitlab.com", {}, {}),
        createReport("bitbucket.com", {}, {}),
      ];

      const newApps = view.getNewApplications();

      expect(newApps).toHaveLength(2);
      expect(newApps.map((r) => r.applicationName).sort()).toEqual(["bitbucket.com", "gitlab.com"]);
    });

    it("should return empty array when all applications are reviewed", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false, new Date())];
      view.reports = [createReport("github.com", {}, {})];

      const newApps = view.getNewApplications();

      expect(newApps).toHaveLength(0);
    });
  });

  describe("getApplicationByName", () => {
    it("should find application by exact name match", () => {
      const view = new RiskInsightsView();
      view.reports = [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})];

      const app = view.getApplicationByName("github.com");

      expect(app).toBeDefined();
      expect(app?.applicationName).toBe("github.com");
    });

    it("should return undefined when application not found", () => {
      const view = new RiskInsightsView();
      view.reports = [createReport("github.com", {}, {})];

      const app = view.getApplicationByName("gitlab.com");

      expect(app).toBeUndefined();
    });
  });

  describe("getTotalMemberCount", () => {
    it("should return count of members in registry", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      expect(view.getTotalMemberCount()).toBe(3);
    });

    it("should return 0 when registry is empty", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = {};

      expect(view.getTotalMemberCount()).toBe(0);
    });
  });

  // ==================== Update Methods ====================

  describe("markApplicationAsCritical", () => {
    it("should mark existing application as critical", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false)];
      view.reports = [createReport("github.com", {}, {})];

      view.markApplicationAsCritical("github.com");

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(true);
    });

    it("should add new application if not in list", () => {
      const view = new RiskInsightsView();
      view.applications = [];

      view.markApplicationAsCritical("github.com");

      expect(view.applications).toHaveLength(1);
      expect(view.applications[0].applicationName).toBe("github.com");
      expect(view.applications[0].isCritical).toBe(true);
    });

    it("should trigger summary recomputation", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      view.reports = [createReport("github.com", { u1: true }, { c1: true })];
      view.applications = [createApplication("github.com", false)];

      view.markApplicationAsCritical("github.com");

      expect(view.summary.totalCriticalApplicationCount).toBe(1);
    });
  });

  describe("unmarkApplicationAsCritical", () => {
    it("should unmark existing application as critical", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", true)];
      view.reports = [createReport("github.com", {}, {})];

      view.unmarkApplicationAsCritical("github.com");

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(false);
    });

    it("should trigger summary recomputation when application exists", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      view.reports = [createReport("github.com", { u1: true }, { c1: true })];
      view.applications = [createApplication("github.com", true)];

      view.unmarkApplicationAsCritical("github.com");

      expect(view.summary.totalCriticalApplicationCount).toBe(0);
    });

    it("should do nothing if application not found", () => {
      const view = new RiskInsightsView();
      view.applications = [];

      view.unmarkApplicationAsCritical("github.com");

      expect(view.applications).toHaveLength(0);
    });
  });

  describe("markApplicationAsReviewed", () => {
    it("should mark existing application as reviewed with current date", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false)];

      const beforeDate = new Date();
      view.markApplicationAsReviewed("github.com");
      const afterDate = new Date();

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.reviewedDate).toBeDefined();
      expect(app!.reviewedDate!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(app!.reviewedDate!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it("should mark application with specific date", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false)];

      const specificDate = new Date("2024-01-15");
      view.markApplicationAsReviewed("github.com", specificDate);

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.reviewedDate).toEqual(specificDate);
    });

    it("should add new application if not in list", () => {
      const view = new RiskInsightsView();
      view.applications = [];

      view.markApplicationAsReviewed("github.com");

      expect(view.applications).toHaveLength(1);
      expect(view.applications[0].applicationName).toBe("github.com");
      expect(view.applications[0].reviewedDate).toBeDefined();
    });

    it("should not trigger summary recomputation", () => {
      const view = new RiskInsightsView();
      view.applications = [createApplication("github.com", false)];

      // Manually set summary to verify it doesn't change
      view.summary.totalApplicationCount = 99;

      view.markApplicationAsReviewed("github.com");

      // Summary should remain unchanged
      expect(view.summary.totalApplicationCount).toBe(99);
    });
  });

  // ==================== Computation Methods ====================

  describe("recomputeSummary", () => {
    it("should compute total counts correctly", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u2: false }, { c3: false }),
      ];

      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalMemberCount).toBe(2);
      expect(view.summary.totalApplicationCount).toBe(2);
      expect(view.summary.totalAtRiskApplicationCount).toBe(1); // github.com has at-risk cipher
      expect(view.summary.totalAtRiskMemberCount).toBe(1); // u1
    });

    it("should deduplicate at-risk members across applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u1: true }, { c2: true }),
      ];

      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalAtRiskMemberCount).toBe(1); // u1 counted once
    });

    it("should compute critical application counts", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: false }, { c2: false }),
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true),
      ];

      view.recomputeSummary();

      expect(view.summary.totalCriticalApplicationCount).toBe(2);
      expect(view.summary.totalCriticalAtRiskApplicationCount).toBe(1); // github.com
      expect(view.summary.totalCriticalMemberCount).toBe(2); // u1 and u2
      expect(view.summary.totalCriticalAtRiskMemberCount).toBe(1); // u1
    });

    it("should handle empty reports and applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = {};
      view.reports = [];
      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalMemberCount).toBe(0);
      expect(view.summary.totalApplicationCount).toBe(0);
      expect(view.summary.totalAtRiskApplicationCount).toBe(0);
      expect(view.summary.totalAtRiskMemberCount).toBe(0);
      expect(view.summary.totalCriticalApplicationCount).toBe(0);
      expect(view.summary.totalCriticalAtRiskApplicationCount).toBe(0);
      expect(view.summary.totalCriticalMemberCount).toBe(0);
      expect(view.summary.totalCriticalAtRiskMemberCount).toBe(0);
    });
  });

  describe("toMetrics", () => {
    it("should compute complete metrics including password counts", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: false, c3: true }), // 3 passwords, 2 at-risk
        createReport("gitlab.com", { u2: false }, { c4: false, c5: false }), // 2 passwords, 0 at-risk
      ];

      view.applications = [
        createApplication("github.com", true), // Critical
        createApplication("gitlab.com", false), // Not critical
      ];

      view.recomputeSummary(); // Compute summary first

      const metrics = view.toMetrics();

      // Summary counts (copied from summary)
      expect(metrics.totalMemberCount).toBe(2);
      expect(metrics.totalAtRiskMemberCount).toBe(1); // u1
      expect(metrics.totalApplicationCount).toBe(2);
      expect(metrics.totalAtRiskApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalAtRiskApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalMemberCount).toBe(1); // u1
      expect(metrics.totalCriticalAtRiskMemberCount).toBe(1); // u1

      // Password counts (computed from reports)
      expect(metrics.totalPasswordCount).toBe(5); // 3 + 2
      expect(metrics.totalAtRiskPasswordCount).toBe(2); // 2 + 0
      expect(metrics.totalCriticalPasswordCount).toBe(3); // github.com only
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(2); // github.com at-risk only
    });

    it("should compute metrics with no critical applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: true }), // 2 passwords, 2 at-risk
      ];

      view.applications = [
        createApplication("github.com", false), // Not critical
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(2);
      expect(metrics.totalAtRiskPasswordCount).toBe(2);
      expect(metrics.totalCriticalPasswordCount).toBe(0); // No critical apps
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(0); // No critical apps
    });

    it("should compute metrics with all critical applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: false }), // 2 passwords, 1 at-risk
        createReport("gitlab.com", { u2: true }, { c3: true }), // 1 password, 1 at-risk
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true),
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(3); // 2 + 1
      expect(metrics.totalAtRiskPasswordCount).toBe(2); // 1 + 1
      expect(metrics.totalCriticalPasswordCount).toBe(3); // All apps are critical
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(2); // All apps are critical
    });

    it("should handle empty reports and applications", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = {};
      view.reports = [];
      view.applications = [];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(0);
      expect(metrics.totalAtRiskPasswordCount).toBe(0);
      expect(metrics.totalCriticalPasswordCount).toBe(0);
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(0);
      expect(metrics.totalMemberCount).toBe(0);
      expect(metrics.totalAtRiskMemberCount).toBe(0);
      expect(metrics.totalApplicationCount).toBe(0);
      expect(metrics.totalAtRiskApplicationCount).toBe(0);
    });

    it("should compute metrics with applications not in report", () => {
      const view = new RiskInsightsView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }), // 1 password, 1 at-risk
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true), // Marked critical but not in reports
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(1);
      expect(metrics.totalAtRiskPasswordCount).toBe(1);
      expect(metrics.totalCriticalPasswordCount).toBe(1); // Only github.com has passwords
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(1);
    });
  });

  // ==================== Serialization ====================

  describe("fromJSON", () => {
    it("should initialize nested objects", () => {
      const json: Partial<DeepJsonify<RiskInsightsView>> = {
        id: "report-123" as OrganizationReportId,
        organizationId: "org-456" as OrganizationId,
        reports: [
          {
            applicationName: "github.com",
            memberRefs: { u1: true },
            cipherRefs: { c1: true },
            passwordCount: 1,
            atRiskPasswordCount: 1,
            memberCount: 1,
            atRiskMemberCount: 1,
          },
        ],
        applications: [
          {
            applicationName: "github.com",
            isCritical: true,
          },
        ],
        summary: {
          totalMemberCount: 1,
          totalApplicationCount: 1,
          totalAtRiskMemberCount: 1,
          totalAtRiskApplicationCount: 1,
          totalCriticalApplicationCount: 1,
          totalCriticalMemberCount: 1,
          totalCriticalAtRiskMemberCount: 1,
          totalCriticalAtRiskApplicationCount: 1,
        },
        memberRegistry: {
          u1: { id: "u1", userName: "Alice", email: "alice@example.com" },
        },
      };

      const view = RiskInsightsView.fromJSON(json);

      expect(view.id).toBe("report-123");
      expect(view.organizationId).toBe("org-456");
      expect(view.reports).toHaveLength(1);
      expect(view.reports[0]).toBeInstanceOf(RiskInsightsReportView);
      expect(view.applications).toHaveLength(1);
      expect(view.applications[0]).toBeInstanceOf(RiskInsightsApplicationView);
      expect(view.memberRegistry).toEqual({
        u1: { id: "u1", userName: "Alice", email: "alice@example.com" },
      });
    });

    it("should handle null input", () => {
      const view = RiskInsightsView.fromJSON(null as any);

      expect(view).toBeInstanceOf(RiskInsightsView);
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
    });

    it("should handle undefined input", () => {
      const view = RiskInsightsView.fromJSON(undefined as any);

      expect(view).toBeInstanceOf(RiskInsightsView);
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
    });
  });
});
