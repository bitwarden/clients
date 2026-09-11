import { DatePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

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
    divergentFailureReason: null,
    ...overrides,
  };
}

/** The seeded worst case: one cause, retried five identical times. */
function retriedFailure(overrides: Partial<JobView> = {}): JobView {
  return {
    id: jobId("1"),
    credentialName: "Prod service account",
    credentialResolved: true,
    sourceLabelKey: "pamRotationSourceScheduled",
    statusLabelKey: "pamRotationJobStatusFailed",
    statusVariant: "danger",
    failed: true,
    running: false,
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
    attempts: [attempt(1, { statusLabelKey: "pamRotationAttemptStatusRotated" })],
    attemptsUniform: false,
    causeLabelKey: null,
    reportedReason: null,
    syncStateLabelKey: null,
    ...overrides,
  });
}

describe("RotationJobDrawerComponent", () => {
  let fixture: ComponentFixture<RotationJobDrawerComponent>;

  async function render(job: JobView, showCredential = true) {
    const params: RotationJobDrawerParams = { job, showCredential };

    // Some of these assertions compare two renders.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RotationJobDrawerComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: I18nService, useValue: i18nFake },
      ],
    })
      // Stub the dialog shell.
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

  it("names the outcome on a badge rather than in prose", async () => {
    await render(retriedFailure());

    const badge = query("drawer-result").nativeElement;
    expect(badge.textContent).toContain("pamRotationJobStatusFailed");
    expect(badge.className).toContain("danger");
  });

  it("states a recognised cause once for the whole job", async () => {
    await render(retriedFailure());

    expect(text().split("pamRotationFailureCauseTargetUnreachable").length - 1).toBe(1);
  });

  it("says once that every retry failed the same way", async () => {
    await render(retriedFailure());

    const cause = query("drawer-cause").nativeElement;
    expect(cause.textContent).toContain("pamRotationHistoryAttemptsAllAlike");
    expect(cause.textContent).toContain("pamRotationSyncStateTargetUnchanged");
    expect(text().split("pamRotationHistoryAttemptsAllAlike").length - 1).toBe(1);
  });

  it("quotes the connector's own reason once, not once per attempt", async () => {
    await render(retriedFailure());

    const raw = fixture.debugElement.queryAll(By.css("[data-testid='drawer-reported-reason']"));
    expect(raw).toHaveLength(1);
    expect(raw[0].nativeElement.textContent).toContain(
      `pamRotationFailureReportedDetail ${CONNECTION_REFUSED}`,
    );
    expect(raw[0].nativeElement.className).toContain("tw-font-mono");
  });

  it("shows an unrecognised reason as the cause with no separate detail line", async () => {
    await render(retriedFailure({ causeLabelKey: null, reportedReason: "flaky target" }));

    expect(query("drawer-cause").nativeElement.textContent).toContain("flaky target");
    expect(
      fixture.debugElement.queryAll(By.css("[data-testid='drawer-reported-reason']")),
    ).toHaveLength(0);
  });

  it("gives a succeeded job no failure section", async () => {
    await render(succeeded());

    expect(query("drawer-cause")).toBeNull();
    expect(query("drawer-attempts")).not.toBeNull();
  });

  it("gives a failure with nothing to report no empty failure section", async () => {
    await render(
      retriedFailure({
        statusLabelKey: "pamRotationJobStatusTimedOut",
        startedAt: null,
        duration: null,
        attempts: [],
        attemptsUniform: false,
        causeLabelKey: null,
        reportedReason: null,
        syncStateLabelKey: null,
      }),
    );

    expect(query("drawer-cause")).toBeNull();
    expect(text()).not.toContain("pamRotationHistoryFailureHeading");
  });

  it("carries no danger colour outside the badge", async () => {
    await render(retriedFailure());

    const marked = fixture.debugElement
      .queryAll(By.css("[data-testid='drawer-cause'] *, [data-testid='drawer-attempts'] *"))
      .map((node: any) => node.nativeElement.className as string);
    expect(
      marked.every((className) => !/danger|tw-bg-.*danger|tw-text-danger/.test(className)),
    ).toBe(true);
  });

  describe("the attempt table", () => {
    it("gives every attempt value its own header", async () => {
      await render(retriedFailure());

      const headers = fixture.debugElement
        .queryAll(By.css("[data-testid='drawer-attempts'] thead th"))
        .map((th: any) => th.nativeElement.textContent.trim());
      expect(headers).toEqual([
        "pamRotationHistoryColumnAttempt",
        "pamRotationAttemptStarted",
        "pamRotationHistoryDurationLabel",
        "pamRotationHistoryColumnResult",
      ]);
      expect(
        fixture.debugElement.query(By.css("[data-testid='drawer-attempts'] caption")).nativeElement
          .textContent,
      ).toContain("pamRotationHistoryAttemptsCaption");
    });

    it("gives each attempt an ordinal row header, a duration and an outcome", async () => {
      await render(retriedFailure());

      expect(attemptRows()).toHaveLength(5);
      const first = attemptRows()[0];
      const rowHeader = first.query(By.css("th"));
      expect(rowHeader.nativeElement.getAttribute("scope")).toBe("row");
      expect(rowHeader.nativeElement.textContent.trim()).toBe("1");
      expect(first.nativeElement.textContent).toContain("pamRotationDurationSeconds 16");
      expect(first.nativeElement.textContent).toContain("pamRotationAttemptStatusErrored");
    });

    it("shows a duration rather than a second raw timestamp", async () => {
      await render(retriedFailure());

      const durations = attemptRows().map((row: any) => row.nativeElement.textContent);
      expect(durations.every((value: string) => value.includes("pamRotationDurationSeconds"))).toBe(
        true,
      );
    });

    it("shows in progress for an attempt that has not ended", async () => {
      await render(
        retriedFailure({
          attempts: [attempt(1, { duration: null })],
        }),
      );

      expect(attemptRows()[0].nativeElement.textContent).toContain("pamRotationAttemptInProgress");
    });

    it("carries a divergent reason only on the attempt that differs", async () => {
      await render(
        retriedFailure({
          attempts: [
            attempt(1, { divergentFailureReason: "target_rejected: LDAP result code 50" }),
            attempt(2),
          ],
        }),
      );

      expect(attemptRows()[0].nativeElement.textContent).toContain(
        "target_rejected: LDAP result code 50",
      );
      expect(attemptRows()[1].nativeElement.textContent).not.toContain("target_rejected");
    });

    it("is absent for a job that has not attempted anything yet", async () => {
      await render(retriedFailure({ attempts: [], attemptsUniform: false }));

      expect(query("drawer-attempts")).toBeNull();
    });
  });

  describe("the job's start", () => {
    const rendered = (iso: string, format: string) => new DatePipe("en-US").transform(iso, format)!;

    it("states the first attempt's start rather than when the job was queued", async () => {
      await render(retriedFailure());

      const shown = query("drawer-started").nativeElement.textContent.trim();
      expect(shown).toBe(rendered("2026-01-01T00:01:00Z", "long"));
      expect(shown).not.toBe(rendered("2026-01-01T00:00:00Z", "long"));
    });

    it("names the same instant the first attempt row does, under the same header", async () => {
      await render(retriedFailure());

      expect(query("drawer-started").nativeElement.textContent.trim()).toBe(
        rendered("2026-01-01T00:01:00Z", "long"),
      );
      expect(attemptRows()[0].nativeElement.textContent).toContain(
        rendered("2026-01-01T00:01:00Z", "mediumTime"),
      );
    });

    it("states nothing for a job with no attempt to read a start from", async () => {
      await render(
        succeeded({
          statusLabelKey: "pamRotationJobStatusPending",
          statusVariant: "secondary",
          running: true,
          startedAt: null,
          duration: null,
          attempts: [],
        }),
      );

      expect(query("drawer-started")).toBeNull();
      expect(text()).not.toContain("pamRotationAttemptStarted");
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

  it("shows the job's own duration, or that it is still running", async () => {
    await render(retriedFailure());
    expect(query("drawer-duration").nativeElement.textContent).toContain(
      "pamRotationDurationMinutes 4 16",
    );

    await render(retriedFailure({ duration: null, running: true }));
    expect(query("drawer-duration").nativeElement.textContent).toContain(
      "pamRotationAttemptInProgress",
    );
  });
});
