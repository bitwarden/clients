import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { formatTimeOfDay, formatTimestamp } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogModule, DIALOG_DATA } from "@bitwarden/components";

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
    configId: "config-1",
    targetSystemId: null,
    targetSystemName: null,
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
    details: { key: "pamRotationAttemptCauseTargetUnreachable" },
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
    organizationId: string | null = null,
  ) {
    const params: RotationJobDrawerParams = { job, showCredential, endingSessions, organizationId };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RotationJobDrawerComponent],
      providers: [
        provideRouter([]),
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

  it("titles the drawer Rotation details, with no badge", async () => {
    await render(retriedFailure());

    expect(text()).toContain("pamRotationDetailsDrawerTitle");
    expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
    expect(query("drawer-result")).toBeNull();
  });

  it("heads the body with the start, then lists Trigger and Ending sessions, with no Result or Duration", async () => {
    await render(succeeded(), false, { kind: "entra", supported: true });

    const heading = fixture.nativeElement.querySelector("h2");
    expect(heading.textContent.trim()).toBe(
      formatTimestamp("en-US", Date.parse("2026-01-01T00:01:00Z")),
    );
    const labels = fixture.debugElement
      .queryAll(By.css("dt"))
      .map((dt: any) => dt.nativeElement.textContent.trim());
    expect(labels).toEqual([
      "pamRotationHistoryColumnRotationTrigger",
      "pamTargetSystemEndingSessions",
    ]);
    expect(text()).not.toContain("pamRotationAttemptStarted");
    expect(text()).not.toContain("pamRotationHistoryDurationLabel");
  });

  it("names the managed credential and target system as links, ahead of the trigger", async () => {
    await render(
      retriedFailure({ targetSystemName: "ADP - On Prem AD", targetSystemId: "target-1" }),
      true,
      null,
      "org-1",
    );

    const labels = fixture.debugElement
      .queryAll(By.css("dt"))
      .map((dt: any) => dt.nativeElement.textContent.trim());
    expect(labels).toEqual([
      "pamRotationConfigColumnManagedCredential",
      "pamRotationConfigColumnTargetSystem",
      "pamRotationHistoryColumnRotationTrigger",
    ]);
    const credential = query("drawer-credential").nativeElement.querySelector("a");
    expect(credential.getAttribute("href")).toBe(
      "/organizations/org-1/pam/rotation/managed-credentials/config-1",
    );
    const target = query("drawer-target-system").nativeElement.querySelector("a");
    expect(target.textContent.trim()).toBe("ADP - On Prem AD");
    expect(target.getAttribute("href")).toBe(
      "/organizations/org-1/pam/rotation/target-systems/target-1",
    );
  });

  it("states the start without a separate Started field", async () => {
    await render(retriedFailure());

    expect(query("drawer-started").nativeElement.textContent.trim()).toBe(
      formatTimestamp("en-US", Date.parse("2026-01-01T00:01:00Z")),
    );
    expect(text()).not.toContain("pamRotationAttemptStarted");
  });

  it("falls back to when the job was created if no attempt ever started", async () => {
    await render(
      succeeded({
        startedAt: null,
        displayStartedAt: "2026-01-01T00:00:00Z",
        attempts: [],
      }),
    );

    expect(query("drawer-started").nativeElement.textContent.trim()).toBe(
      formatTimestamp("en-US", Date.parse("2026-01-01T00:00:00Z")),
    );
  });

  describe("Ending sessions", () => {
    it("says Entra can sign out sessions for a supporting Entra target", async () => {
      await render(succeeded(), false, { kind: "entra", supported: true });

      const field = query("drawer-ending-sessions").nativeElement.textContent;
      expect(field).toContain("pamTargetSystemSessionTerminationSupported");
      expect(field).toContain("pamTargetSystemEndingSessionsEntraHint");
    });

    it("shows plain text alone for another kind that supports it", async () => {
      await render(succeeded(), false, { kind: "mssql", supported: true });

      const field = query("drawer-ending-sessions").nativeElement;
      expect(field.textContent).toContain("pamTargetSystemSessionTerminationSupported");
      expect(field.textContent).not.toContain("pamTargetSystemEndingSessionsEntraHint");
      expect(field.querySelector("[bitBadge]")).toBeNull();
    });

    it("leaves the field out, with no badge, for a target that cannot", async () => {
      await render(succeeded({ sessionTerminationLabelKey: "x" }), false, {
        kind: "entra",
        supported: false,
      });

      expect(query("drawer-ending-sessions")).toBeNull();
      expect(query("drawer-session-termination")).toBeNull();
      expect(text()).not.toContain("pamTargetSystemSessionTerminationNo");
    });

    it("is left out when there is no target to describe", async () => {
      await render(succeeded());

      expect(query("drawer-ending-sessions")).toBeNull();
    });
  });

  describe("the attempt table", () => {
    it("is a Table V2 headed Time, Result and Access connector", async () => {
      await render(retriedFailure());

      const headers = fixture.debugElement
        .queryAll(By.css("[data-testid='drawer-attempts'] bit-table-v2 [role='columnheader']"))
        .map((th: any) => th.nativeElement.textContent.trim());
      expect(headers).toEqual([
        "time",
        "pamRotationHistoryColumnResult",
        "pamTargetSystemAssignConnectorLabel",
      ]);
      expect(query("drawer-attempts").nativeElement.querySelector("table")).toBeNull();
    });

    it("gives each attempt a row showing its time of day", async () => {
      await render(retriedFailure());

      expect(attemptRows()).toHaveLength(5);
      const times = fixture.debugElement.queryAll(By.css("[data-testid='drawer-attempt-time']"));
      expect(times[0].nativeElement.textContent.trim()).toBe(
        formatTimeOfDay("en-US", Date.parse("2026-01-01T00:01:00Z")),
      );
    });

    it("wraps a failure reason as secondary text instead of widening the table", async () => {
      await render(retriedFailure({ attempts: [attempt(1)] }));

      const cause = fixture.debugElement.query(
        By.css("[data-testid='drawer-attempt-row'] .tw-text-muted"),
      ).nativeElement;
      expect(cause.className).toContain("tw-break-words");
      expect(query("drawer-attempts").nativeElement.innerHTML).not.toContain("tw-table-auto");
    });

    it("names the access connector, and leaves the cell empty without one", async () => {
      await render(retriedFailure({ attempts: [attempt(1), attempt(2, { connectorName: null })] }));

      const cells = fixture.debugElement.queryAll(
        By.css("[data-testid='drawer-attempt-connector']"),
      );
      expect(cells[0].nativeElement.textContent.trim()).toBe("East datacenter");
      expect(cells[1].nativeElement.textContent.trim()).toBe("");
    });

    it("says why a failed attempt failed in plain language, without the raw reason", async () => {
      await render(retriedFailure({ attempts: [attempt(1)] }));

      const row = attemptRows()[0].nativeElement;
      expect(row.textContent).toContain("pamRotationAttemptResultFailed");
      expect(row.textContent).toContain("pamRotationAttemptCauseTargetUnreachable");
      expect(row.textContent).not.toContain(CONNECTION_REFUSED);
      expect(row.querySelector(".tw-font-mono")).toBeNull();
    });

    it("shows a succeeded attempt with no cause", async () => {
      await render(succeeded());

      const row = attemptRows()[0].nativeElement;
      expect(row.textContent).toContain("pamRotationAttemptResultSucceeded");
      expect(row.querySelector(".tw-text-muted")).toBeNull();
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
    it("has no sync state line, whatever the sync state", async () => {
      await render(retriedFailure());
      expect(query("drawer-sync-state")).toBeNull();
      expect(text()).not.toContain("pamRotationSyncStateTargetUnchanged");

      await render(retriedFailure({ syncStateIndeterminate: true }));
      expect(query("drawer-sync-state")).toBeNull();
    });

    it("has no separate Result field", async () => {
      await render(retriedFailure());

      expect(query("drawer-result-text")).toBeNull();
      expect(text()).not.toContain("pamRotationJobStatusFailed");
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
        false,
        { kind: "entra", supported: true },
      );

      const line = query("drawer-session-termination").nativeElement;
      expect(line.textContent).toContain("pamRotationSessionTerminationTermFailed");
      expect(line.className).toContain("tw-text-warning");
    });

    it("reports an ordinary termination without a warning", async () => {
      await render(
        succeeded({ sessionTerminationLabelKey: "pamRotationSessionTerminationTerminated" }),
        false,
        { kind: "entra", supported: true },
      );

      const line = query("drawer-session-termination").nativeElement;
      expect(line.textContent).toContain("pamRotationSessionTerminationTerminated");
      expect(line.className).toContain("tw-text-muted");
    });

    it("says nothing when termination was never requested", async () => {
      await render(succeeded());

      expect(query("drawer-session-termination")).toBeNull();
    });

    it("says nothing when the caller passes no ending-sessions info, as the connector page does", async () => {
      await render(
        succeeded({ sessionTerminationLabelKey: "pamRotationSessionTerminationTerminated" }),
        true,
        null,
        "org-1",
      );

      expect(query("drawer-session-termination")).toBeNull();
    });
  });
});
