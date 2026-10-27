import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogModule, DIALOG_DATA } from "@bitwarden/components";

import { formatRotationTimestamp } from "../../rotation-timestamp";
import { attemptId, jobId } from "../../testing/rotation-builders";
import type { AttemptView, JobView } from "../rotation-job-row";

import {
  RotationJobDrawerComponent,
  RotationJobDrawerParams,
} from "./rotation-job-drawer.component";

const CONNECTION_REFUSED = "target_unreachable: error kind: ConnectionRefused";

const i18nFake: Pick<I18nService, "t"> = {
  t: (id: string, ...substitutions: (string | number)[]) =>
    [id, ...substitutions.filter((s) => s !== undefined)].join(" "),
};

function attempt(ordinal: number, overrides: Partial<AttemptView> = {}): AttemptView {
  return {
    id: attemptId(String(ordinal)),
    ordinal,
    startedAt: `2026-01-01T00:0${ordinal}:00Z`,
    duration: { hours: 0, minutes: 0, seconds: 16 },
    running: false,
    statusLabelKey: "pamRotationAttemptStatusErrored",
    resultLabelKey: "pamRotationAttemptResultFailed",
    failed: true,
    connectorName: "East datacenter",
    causeLabelKey: "pamRotationAttemptCauseTargetUnreachable",
    failureReason: CONNECTION_REFUSED,
    ...overrides,
  };
}

/** The seeded worst case, with one cause retried five identical times. */
function retriedFailure(overrides: Partial<JobView> = {}): JobView {
  return {
    id: jobId("1"),
    credentialName: "Prod service account",
    credentialResolved: true,
    sourceLabelKey: "pamRotationSourceScheduled",
    statusLabelKey: "pamRotationJobStatusFailed",
    statusVariant: "danger",
    failed: true,
    retrySucceeded: false,
    running: false,
    displayStartedAt: "2026-01-01T00:01:00Z",
    startedAt: "2026-01-01T00:01:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    duration: { hours: 0, minutes: 4, seconds: 16 },
    attempts: [1, 2, 3, 4, 5].map((n) => attempt(n)),
    attemptsUniform: true,
    causeLabelKey: "pamRotationFailureCauseTargetUnreachable",
    reportedReason: CONNECTION_REFUSED,
    syncStateLabelKey: "pamRotationSyncStateTargetUnchanged",
    syncStateIndeterminate: false,
    sessionTerminationLabelKey: null,
    sessionTerminationFailed: false,
    ...overrides,
  };
}

function succeeded(overrides: Partial<JobView> = {}): JobView {
  return retriedFailure({
    statusLabelKey: "pamRotationJobStatusSucceeded",
    statusVariant: "success",
    failed: false,
    attempts: [
      attempt(1, {
        statusLabelKey: "pamRotationAttemptStatusRotated",
        resultLabelKey: "pamRotationAttemptResultSucceeded",
        failed: false,
        causeLabelKey: null,
        failureReason: null,
      }),
    ],
    attemptsUniform: false,
    causeLabelKey: null,
    reportedReason: null,
    syncStateLabelKey: null,
    ...overrides,
  });
}

describe("RotationJobDrawerComponent", () => {
  let fixture: ComponentFixture<RotationJobDrawerComponent>;

  async function render(
    job: JobView,
    showCredential = false,
    endingSessions: RotationJobDrawerParams["endingSessions"] = null,
  ) {
    const params: RotationJobDrawerParams = { job, showCredential, endingSessions };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RotationJobDrawerComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: I18nService, useValue: i18nFake },
      ],
    })
      .overrideComponent(RotationJobDrawerComponent, {
        remove: { imports: [DialogModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RotationJobDrawerComponent);
    fixture.detectChanges();
    return fixture;
  }

  function text() {
    return fixture.nativeElement.textContent as string;
  }

  function attemptRows() {
    return fixture.debugElement.queryAll(By.css("[data-testid='drawer-attempt-row']"));
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid='${testId}']`));
  }

  it("titles the drawer Rotation details and names the outcome on a badge", async () => {
    await render(retriedFailure());

    expect(text()).toContain("pamRotationDetailsDrawerTitle");
    const badge = query("drawer-result").nativeElement;
    expect(badge.textContent).toContain("pamRotationJobStatusFailed");
    expect(badge.className).toContain("danger");
  });

  it("lists Started, Ending sessions, Result and Trigger in that order, with no Duration", async () => {
    await render(succeeded(), false, { kind: "entra", supported: true });

    const labels = fixture.debugElement
      .queryAll(By.css("dt"))
      .map((dt: any) => dt.nativeElement.textContent.trim());
    expect(labels).toEqual([
      "pamRotationAttemptStarted",
      "pamTargetSystemEndingSessions",
      "pamRotationHistoryColumnResult",
      "pamRotationHistoryColumnTrigger",
    ]);
    expect(text()).not.toContain("pamRotationHistoryDurationLabel");
  });

  it("formats the start the way the table does", async () => {
    await render(retriedFailure());

    expect(query("drawer-started").nativeElement.textContent.trim()).toBe(
      formatRotationTimestamp("2026-01-01T00:01:00Z", "en-US"),
    );
  });

  it("states nothing for a job with no attempt to read a start from", async () => {
    await render(succeeded({ startedAt: null, attempts: [] }));

    expect(query("drawer-started")).toBeNull();
  });

  describe("Ending sessions", () => {
    it("says Entra can sign out sessions for a supporting Entra target", async () => {
      await render(succeeded(), false, { kind: "entra", supported: true });

      const field = query("drawer-ending-sessions").nativeElement.textContent;
      expect(field).toContain("pamTargetSystemSessionTerminationSupported");
      expect(field).toContain("pamTargetSystemEndingSessionsEntraHint");
    });

    it("shows the badge alone for another kind that supports it", async () => {
      await render(succeeded(), false, { kind: "mssql", supported: true });

      const field = query("drawer-ending-sessions").nativeElement.textContent;
      expect(field).toContain("pamTargetSystemSessionTerminationSupported");
      expect(field).not.toContain("pamTargetSystemEndingSessionsEntraHint");
    });

    it("says not supported, with no helper, for a target that cannot", async () => {
      await render(succeeded(), false, { kind: "entra", supported: false });

      const field = query("drawer-ending-sessions").nativeElement.textContent;
      expect(field).toContain("pamTargetSystemSessionTerminationNo");
      expect(field).not.toContain("pamTargetSystemEndingSessionsEntraHint");
    });

    it("is left out when there is no target to describe", async () => {
      await render(succeeded());

      expect(query("drawer-ending-sessions")).toBeNull();
    });
  });

  describe("the attempt table", () => {
    it("heads the columns Attempt, Access connector and Result", async () => {
      await render(retriedFailure());

      const headers = fixture.debugElement
        .queryAll(By.css("[data-testid='drawer-attempts'] thead th"))
        .map((th: any) => th.nativeElement.textContent.trim());
      expect(headers).toEqual([
        "pamRotationHistoryColumnAttempt",
        "pamTargetSystemAssignConnectorLabel",
        "pamRotationHistoryColumnResult",
      ]);
      expect(
        fixture.debugElement.query(By.css("[data-testid='drawer-attempts'] caption")).nativeElement
          .textContent,
      ).toContain("pamRotationHistoryAttemptsCaption");
    });

    it("gives each attempt an ordinal row header over its time of day", async () => {
      await render(retriedFailure());

      expect(attemptRows()).toHaveLength(5);
      const rowHeader = attemptRows()[0].query(By.css("th"));
      expect(rowHeader.nativeElement.getAttribute("scope")).toBe("row");
      expect(rowHeader.nativeElement.textContent).toContain("1");
      expect(rowHeader.nativeElement.textContent).toContain(
        formatRotationTimestamp("2026-01-01T00:01:00Z", "en-US").split(", ").slice(2).join(", "),
      );
    });

    it("names the access connector, and leaves the cell empty without one", async () => {
      await render(retriedFailure({ attempts: [attempt(1), attempt(2, { connectorName: null })] }));

      const cells = fixture.debugElement.queryAll(
        By.css("[data-testid='drawer-attempt-connector']"),
      );
      expect(cells[0].nativeElement.textContent.trim()).toBe("East datacenter");
      expect(cells[1].nativeElement.textContent.trim()).toBe("");
    });

    it("says why a failed attempt failed, with the raw reason in monospace", async () => {
      await render(retriedFailure({ attempts: [attempt(1)] }));

      const row = attemptRows()[0].nativeElement;
      expect(row.textContent).toContain("pamRotationAttemptResultFailed");
      expect(row.textContent).toContain("pamRotationAttemptCauseTargetUnreachable");
      const raw = row.querySelector("[data-testid='drawer-attempt-reason']");
      expect(raw.textContent.trim()).toBe(CONNECTION_REFUSED);
      expect(raw.className).toContain("tw-font-mono");
    });

    it("shows a succeeded attempt with no cause", async () => {
      await render(succeeded());

      const row = attemptRows()[0].nativeElement;
      expect(row.textContent).toContain("pamRotationAttemptResultSucceeded");
      expect(row.querySelector("[data-testid='drawer-attempt-reason']")).toBeNull();
    });

    it("carries no duration column", async () => {
      await render(retriedFailure());

      expect(query("drawer-attempts").nativeElement.textContent).not.toContain(
        "pamRotationHistoryDurationLabel",
      );
    });

    it("is absent for a job that has not attempted anything yet", async () => {
      await render(retriedFailure({ attempts: [], attemptsUniform: false }));

      expect(query("drawer-attempts")).toBeNull();
    });
  });

  describe("the failed job", () => {
    it("keeps the sync state line", async () => {
      await render(retriedFailure());

      expect(query("drawer-sync-state").nativeElement.textContent).toContain(
        "pamRotationSyncStateTargetUnchanged",
      );
    });

    it("warns when the sync state is indeterminate", async () => {
      await render(retriedFailure({ syncStateIndeterminate: true }));

      expect(query("drawer-sync-state").nativeElement.className).toContain("tw-text-warning");
    });

    it("has no sync line for a succeeded job", async () => {
      await render(succeeded());

      expect(query("drawer-sync-state")).toBeNull();
    });
  });

  describe("the credential", () => {
    it("is named when the table that opened the pane names it", async () => {
      await render(retriedFailure(), true);

      expect(query("drawer-credential").nativeElement.textContent.trim()).toBe(
        "Prod service account",
      );
    });

    it("is left out when the page is already about one credential", async () => {
      await render(retriedFailure(), false);

      expect(query("drawer-credential")).toBeNull();
    });

    it("is set in monospace when it is an unresolved config id", async () => {
      await render(
        retriedFailure({ credentialName: "4487fded-b443", credentialResolved: false }),
        true,
      );

      expect(query("drawer-credential").nativeElement.className).toContain("tw-font-mono");
    });
  });

  describe("session termination", () => {
    it("reports a failed termination as a warning", async () => {
      await render(
        succeeded({
          sessionTerminationLabelKey: "pamRotationSessionTerminationTermFailed",
          sessionTerminationFailed: true,
        }),
      );

      const line = query("drawer-session-termination").nativeElement;
      expect(line.textContent).toContain("pamRotationSessionTerminationTermFailed");
      expect(line.className).toContain("tw-text-warning");
    });

    it("reports an ordinary termination without a warning", async () => {
      await render(
        succeeded({ sessionTerminationLabelKey: "pamRotationSessionTerminationTerminated" }),
      );

      const line = query("drawer-session-termination").nativeElement;
      expect(line.textContent).toContain("pamRotationSessionTerminationTerminated");
      expect(line.className).toContain("tw-text-muted");
    });

    it("says nothing when termination was never requested", async () => {
      await render(succeeded());

      expect(query("drawer-session-termination")).toBeNull();
    });
  });
});
