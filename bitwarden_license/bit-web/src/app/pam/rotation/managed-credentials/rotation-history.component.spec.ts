import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MockProxy, mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import type { RotationJob } from "../rotation";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";
import {
  attemptId,
  configId,
  jobId,
  rotationAttempt,
  rotationJob,
} from "../testing/rotation-builders";

import { RotationHistoryComponent } from "./rotation-history.component";
import { RotationJobDrawerComponent } from "./rotation-job-drawer/rotation-job-drawer.component";

describe("RotationHistoryComponent", () => {
  let component: RotationHistoryComponent;

  function setup(jobs: RotationJob[]) {
    TestBed.overrideComponent(RotationHistoryComponent, {
      set: { template: "<div>stub</div>", imports: [] },
    });

    TestBed.configureTestingModule({
      imports: [RotationHistoryComponent],
      providers: [{ provide: DialogService, useValue: mock<DialogService>() }],
    });

    const fixture = TestBed.createComponent(RotationHistoryComponent);
    fixture.componentRef.setInput("jobs", jobs);
    fixture.detectChanges();
    component = fixture.componentInstance as any;
    return fixture;
  }

  it("creates without error", () => {
    setup([]);
    expect(component).toBeTruthy();
  });

  describe("sortedJobs", () => {
    it("sorts jobs newest-first by createdAt", () => {
      const older = rotationJob({ id: jobId("job-old"), createdAt: "2024-01-01T00:00:00Z" });
      const newer = rotationJob({ id: jobId("job-new"), createdAt: "2024-06-01T00:00:00Z" });
      setup([older, newer]);
      const sorted = (component as any).sortedJobs();
      expect(sorted[0].id).toBe(jobId("job-new"));
      expect(sorted[1].id).toBe(jobId("job-old"));
    });

    it("returns empty array when jobs input is empty", () => {
      setup([]);
      expect((component as any).sortedJobs()).toHaveLength(0);
    });
  });

  describe("sourceLabelKey", () => {
    it("returns scheduled key for Scheduled source", () => {
      setup([]);
      expect((component as any).sourceLabelKey(RotationSource.Scheduled)).toBe(
        "pamRotationSourceScheduled",
      );
    });

    it("returns onDemand key for OnDemand source", () => {
      setup([]);
      expect((component as any).sourceLabelKey(RotationSource.OnDemand)).toBe(
        "pamRotationSourceOnDemand",
      );
    });

    it("returns accessEnd key for AccessEnd source", () => {
      setup([]);
      expect((component as any).sourceLabelKey(RotationSource.AccessEnd)).toBe(
        "pamRotationSourceAccessEnd",
      );
    });
  });

  describe("jobStatusVariant", () => {
    it("returns success variant for Succeeded", () => {
      setup([]);
      expect((component as any).jobStatusVariant(RotationJobStatus.Succeeded)).toBe("success");
    });

    it("returns danger variant for Failed", () => {
      setup([]);
      expect((component as any).jobStatusVariant(RotationJobStatus.Failed)).toBe("danger");
    });

    it("returns danger variant for TimedOut", () => {
      setup([]);
      expect((component as any).jobStatusVariant(RotationJobStatus.TimedOut)).toBe("danger");
    });

    it("returns secondary variant for Pending and Claimed", () => {
      setup([]);
      expect((component as any).jobStatusVariant(RotationJobStatus.Pending)).toBe("secondary");
      expect((component as any).jobStatusVariant(RotationJobStatus.Claimed)).toBe("secondary");
    });
  });

  describe("syncStateLabelKey", () => {
    it("maps TargetUnchanged correctly", () => {
      setup([]);
      expect((component as any).syncStateLabelKey(RotationSyncState.TargetUnchanged)).toBe(
        "pamRotationSyncStateTargetUnchanged",
      );
    });

    it("maps TargetUpdated correctly", () => {
      setup([]);
      expect((component as any).syncStateLabelKey(RotationSyncState.TargetUpdated)).toBe(
        "pamRotationSyncStateTargetUpdated",
      );
    });
  });

  describe("sessionTerminationLabelKey", () => {
    it("maps Terminated correctly", () => {
      setup([]);
      expect(
        (component as any).sessionTerminationLabelKey(SessionTerminationOutcome.Terminated),
      ).toBe("pamRotationSessionTerminationTerminated");
    });

    it("maps TermFailed correctly", () => {
      setup([]);
      expect(
        (component as any).sessionTerminationLabelKey(SessionTerminationOutcome.TermFailed),
      ).toBe("pamRotationSessionTerminationTermFailed");
    });
  });

  describe("attempt status labels", () => {
    it("maps all attempt statuses correctly", () => {
      setup([]);
      expect((component as any).attemptStatusLabelKey(RotationAttemptStatus.Executing)).toBe(
        "pamRotationAttemptStatusExecuting",
      );
      expect((component as any).attemptStatusLabelKey(RotationAttemptStatus.Rotated)).toBe(
        "pamRotationAttemptStatusRotated",
      );
      expect((component as any).attemptStatusLabelKey(RotationAttemptStatus.Errored)).toBe(
        "pamRotationAttemptStatusErrored",
      );
      expect((component as any).attemptStatusLabelKey(RotationAttemptStatus.Abandoned)).toBe(
        "pamRotationAttemptStatusAbandoned",
      );
    });
  });

  describe("failureCauseLabelKey", () => {
    it.each([
      ["target_rejected: LDAP result code 19", "pamRotationFailureCausePasswordRejected"],
      ["target_rejected: LDAP result code 32", "pamRotationFailureCauseAccountNotFound"],
      ["target_rejected: LDAP result code 49", "pamRotationFailureCauseInvalidCredentials"],
      ["target_rejected: LDAP result code 50", "pamRotationFailureCauseInsufficientRights"],
      ["target_rejected: LDAP result code 53", "pamRotationFailureCauseDirectoryRefused"],
      ["target_rejected: ldap error code 50", "pamRotationFailureCauseInsufficientRights"],
      [
        "target_unreachable: error kind: ConnectionRefused",
        "pamRotationFailureCauseTargetUnreachable",
      ],
    ])("maps %s to %s", (failureReason, expected) => {
      setup([]);
      expect((component as any).failureCauseLabelKey(failureReason)).toBe(expected);
    });

    it.each([
      ["target_rejected: LDAP result code 68"],
      ["target unreachable"],
      ["flaky target"],
      ["target_rejected"],
    ])("returns null for %s", (failureReason) => {
      setup([]);
      expect((component as any).failureCauseLabelKey(failureReason)).toBeNull();
    });
  });

  describe("durationParts", () => {
    it("splits an elapsed span into hours, minutes and seconds", () => {
      setup([]);
      expect(
        (component as any).durationParts("2026-01-01T00:00:00Z", "2026-01-01T01:02:03Z"),
      ).toEqual({ hours: 1, minutes: 2, seconds: 3 });
    });

    it("rounds to whole seconds", () => {
      setup([]);
      expect(
        (component as any).durationParts("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:13.400Z"),
      ).toEqual({ hours: 0, minutes: 0, seconds: 13 });
    });

    it("returns null without an end", () => {
      setup([]);
      expect((component as any).durationParts("2026-01-01T00:00:00Z", null)).toBeNull();
    });

    it("returns null when the end precedes the start", () => {
      setup([]);
      expect(
        (component as any).durationParts("2026-01-01T00:01:00Z", "2026-01-01T00:00:00Z"),
      ).toBeNull();
    });

    it("returns null for an unparseable timestamp", () => {
      setup([]);
      expect((component as any).durationParts("2026-01-01T00:00:00Z", "not a date")).toBeNull();
    });
  });

  describe("toJobView", () => {
    function failingJob(reason = "target_unreachable: error kind: ConnectionRefused") {
      return rotationJob({
        status: RotationJobStatus.Failed,
        createdAt: "2026-01-01T00:00:00Z",
        attempts: [
          rotationAttempt({
            id: attemptId("1"),
            status: RotationAttemptStatus.Errored,
            failureReason: reason,
            syncState: RotationSyncState.TargetUnchanged,
            sessionTermination: SessionTerminationOutcome.NotRequested,
            startedAt: "2026-01-01T00:00:10Z",
            endedAt: "2026-01-01T00:00:26Z",
          }),
          rotationAttempt({
            id: attemptId("2"),
            status: RotationAttemptStatus.Errored,
            failureReason: reason,
            syncState: RotationSyncState.TargetUnchanged,
            sessionTermination: SessionTerminationOutcome.NotRequested,
            startedAt: "2026-01-01T00:00:40Z",
            endedAt: "2026-01-01T00:00:55Z",
          }),
        ],
      });
    }

    it("takes the job cause from the final attempt and states it once", () => {
      setup([]);
      const view = (component as any).toJobView(failingJob());
      expect(view.failed).toBe(true);
      expect(view.causeLabelKey).toBe("pamRotationFailureCauseTargetUnreachable");
      expect(view.reportedReason).toBe("target_unreachable: error kind: ConnectionRefused");
      expect(view.attempts.every((a: any) => a.divergentFailureReason === null)).toBe(true);
    });

    it("marks a retry set as uniform when every attempt matches the final one", () => {
      setup([]);
      expect((component as any).toJobView(failingJob()).attemptsUniform).toBe(true);
    });

    it("does not claim uniformity for a single attempt", () => {
      setup([]);
      const view = (component as any).toJobView(
        rotationJob({
          status: RotationJobStatus.Failed,
          attempts: [
            rotationAttempt({
              id: attemptId("1"),
              status: RotationAttemptStatus.Errored,
              failureReason: "flaky target",
            }),
          ],
        }),
      );
      expect(view.attemptsUniform).toBe(false);
    });

    it("carries a divergent reason on the attempt that differs from the job cause", () => {
      setup([]);
      const job = failingJob();
      (job.attempts[0] as any).failureReason = "target_rejected: LDAP result code 50";
      const view = (component as any).toJobView(job);
      expect(view.attemptsUniform).toBe(false);
      expect(view.attempts[0].divergentFailureReason).toBe("target_rejected: LDAP result code 50");
      expect(view.attempts[1].divergentFailureReason).toBeNull();
    });

    it("measures the job from creation to the last attempt that ended", () => {
      setup([]);
      expect((component as any).toJobView(failingJob()).duration).toEqual({
        hours: 0,
        minutes: 0,
        seconds: 55,
      });
    });

    it("has no duration while an attempt is still running", () => {
      setup([]);
      const view = (component as any).toJobView(
        rotationJob({
          status: RotationJobStatus.Claimed,
          attempts: [
            rotationAttempt({
              id: attemptId("1"),
              status: RotationAttemptStatus.Executing,
              endedAt: undefined,
            }),
          ],
        }),
      );
      expect(view.duration).toBeNull();
      expect(view.running).toBe(true);
    });

    it("numbers attempts in the order the server returned them", () => {
      setup([]);
      expect(
        (component as any).toJobView(failingJob()).attempts.map((a: any) => a.ordinal),
      ).toEqual([1, 2]);
    });

    it("reports the sync state on a failed job only", () => {
      setup([]);
      expect((component as any).toJobView(failingJob()).syncStateLabelKey).toBe(
        "pamRotationSyncStateTargetUnchanged",
      );
      expect((component as any).toJobView(rotationJob()).syncStateLabelKey).toBeNull();
    });

    it("flags an indeterminate sync state", () => {
      setup([]);
      const job = failingJob();
      (job.attempts[1] as any).syncState = RotationSyncState.Indeterminate;
      expect((component as any).toJobView(job).syncStateIndeterminate).toBe(true);
    });

    it("names the managed credential from the supplied map", () => {
      const fixture = setup([]);
      fixture.componentRef.setInput(
        "credentialNames",
        new Map([[configId("7"), "Prod service account"]]),
      );
      const view = (component as any).toJobView(rotationJob({ rotationConfigId: configId("7") }));
      expect(view.credentialName).toBe("Prod service account");
      expect(view.credentialResolved).toBe(true);
    });

    it("falls back to the config id when the map has no name for it", () => {
      setup([]);
      const view = (component as any).toJobView(rotationJob({ rotationConfigId: configId("7") }));
      expect(view.credentialName).toBe(String(configId("7")));
      expect(view.credentialResolved).toBe(false);
    });

    it("omits session termination when it was not requested", () => {
      setup([]);
      expect((component as any).toJobView(rotationJob()).sessionTerminationLabelKey).toBeNull();
    });

    it("surfaces a failed session termination", () => {
      setup([]);
      const view = (component as any).toJobView(
        rotationJob({
          attempts: [
            rotationAttempt({
              id: attemptId("1"),
              sessionTermination: SessionTerminationOutcome.TermFailed,
            }),
          ],
        }),
      );
      expect(view.sessionTerminationLabelKey).toBe("pamRotationSessionTerminationTermFailed");
      expect(view.sessionTerminationFailed).toBe(true);
    });
  });
});

describe("RotationHistoryComponent rendering", () => {
  const i18nFake: Pick<I18nService, "t"> = {
    t: (id: string, ...substitutions: (string | number)[]) =>
      [id, ...substitutions.filter((s) => s !== undefined)].join(" "),
  };

  const CONNECTION_REFUSED = "target_unreachable: error kind: ConnectionRefused";

  let dialogService: MockProxy<DialogService>;

  function render(jobs: RotationJob[], inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    dialogService = mock<DialogService>();

    TestBed.configureTestingModule({
      imports: [RotationHistoryComponent],
      providers: [
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: dialogService },
      ],
    });

    const fixture = TestBed.createComponent(RotationHistoryComponent);
    fixture.componentRef.setInput("jobs", jobs);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  /** The seeded shape this screen is designed around: one failure, retried five identical times. */
  function retriedFailure(): RotationJob {
    return rotationJob({
      status: RotationJobStatus.Failed,
      createdAt: "2026-01-01T00:00:00Z",
      attempts: [1, 2, 3, 4, 5].map((n) =>
        rotationAttempt({
          id: attemptId(String(n)),
          status: RotationAttemptStatus.Errored,
          failureReason: CONNECTION_REFUSED,
          syncState: RotationSyncState.TargetUnchanged,
          startedAt: `2026-01-01T00:0${n}:00Z`,
          endedAt: `2026-01-01T00:0${n}:16Z`,
        }),
      ),
    });
  }

  function jobRows(fixture: any) {
    return fixture.debugElement.queryAll(By.css("[data-testid='rotation-history-job']"));
  }

  function resultCell(fixture: any, index = 0) {
    return fixture.debugElement.queryAll(By.css("[data-testid='rotation-history-job-result']"))[
      index
    ];
  }

  function jobHeaders(fixture: any) {
    return fixture.debugElement
      .queryAll(By.css("[data-testid='rotation-history-columns'] th"))
      .map((th: any) => th.nativeElement.textContent.trim());
  }

  /**
   * Arms the drawer mock with a ref whose `closed` this test controls, for the two behaviours that
   * only happen on the way out.
   */
  function openedDrawer(): Subject<unknown> {
    const closed = new Subject<unknown>();
    dialogService.openDrawer.mockResolvedValue({ closed } as any);
    return closed;
  }

  /** Lets the component's own `await` on `openDrawer` resolve, then renders what it changed. */
  async function settle(fixture: any) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The params the drawer was opened with, or null when it was never opened. */
  function drawerParams() {
    const call = dialogService.openDrawer.mock.calls[0];
    return call ? ((call[1] as any).data ?? null) : null;
  }

  it("shows the empty message when there are no jobs", () => {
    const fixture = render([]);
    expect(jobRows(fixture)).toHaveLength(0);
    expect(fixture.debugElement.query(By.css("table"))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("pamRotationHistoryEmpty");
  });

  it("renders one row per job in a captioned table", () => {
    const fixture = render([
      rotationJob({ id: jobId("1"), createdAt: "2026-01-01T00:00:00Z" }),
      rotationJob({ id: jobId("2"), createdAt: "2026-02-01T00:00:00Z" }),
    ]);

    expect(jobRows(fixture)).toHaveLength(2);
    expect(fixture.debugElement.query(By.css("caption")).nativeElement.textContent).toContain(
      "pamRotationHistoryCaption",
    );
  });

  it("keeps the job table inside its own horizontally scrolling container", () => {
    const fixture = render([rotationJob()]);
    const table = fixture.debugElement.query(By.css("table")).nativeElement;
    expect(table.parentElement.className).toContain("tw-overflow-x-auto");
  });

  it("heads the job columns with what each one holds", () => {
    const fixture = render([rotationJob()]);

    expect(jobHeaders(fixture)).toEqual([
      "pamRotationAttemptStarted",
      "pamRotationHistoryColumnSource",
      "pamRotationHistoryColumnResult",
      "pamRotationHistoryDurationLabel",
      "pamRotationHistoryColumnAttempts",
    ]);
  });

  it("gives every job column header a col scope", () => {
    const fixture = render([rotationJob()]);
    const headers = fixture.debugElement.queryAll(
      By.css("[data-testid='rotation-history-columns'] th"),
    );
    expect(headers.every((th: any) => th.nativeElement.getAttribute("scope") === "row")).toBe(
      false,
    );
    expect(headers.every((th: any) => th.nativeElement.getAttribute("scope") === "col")).toBe(true);
  });

  it("makes the job's start time its row header", () => {
    const fixture = render([rotationJob({ createdAt: "2026-01-01T00:00:00Z" })]);

    const rowHeader = jobRows(fixture)[0].query(By.css("th"));
    expect(rowHeader.nativeElement.getAttribute("scope")).toBe("row");
    expect(rowHeader.nativeElement.textContent.trim()).not.toBe("");
  });

  it("shows the job duration rather than a second raw timestamp", () => {
    const fixture = render([retriedFailure()]);

    expect(jobRows(fixture)[0].nativeElement.textContent).toContain(
      "pamRotationDurationMinutes 5 16",
    );
  });

  it("gives a failed job an ordinary row, with the outcome on the badge alone", () => {
    const fixture = render([
      rotationJob({ id: jobId("1"), createdAt: "2026-01-01T00:00:00Z" }),
      { ...retriedFailure(), id: jobId("2"), createdAt: "2026-02-01T00:00:00Z" },
    ]);

    const [failed, succeeded] = jobRows(fixture).map((row: any) => row.nativeElement);
    expect(failed.className).toBe(succeeded.className);
    expect(failed.querySelector("th").className).toBe(succeeded.querySelector("th").className);
    expect(failed.className).not.toMatch(/danger/);
    expect(failed.textContent).toContain("pamRotationJobStatusFailed");
  });

  it("keeps every explanation off the ledger, however the reason was reported", () => {
    const recognised = render([retriedFailure()]);
    expect(recognised.nativeElement.textContent).not.toContain(
      "pamRotationFailureCauseTargetUnreachable",
    );
    expect(recognised.nativeElement.textContent).not.toContain(CONNECTION_REFUSED);
    expect(recognised.nativeElement.textContent).not.toContain(
      "pamRotationHistoryAttemptsAllAlike",
    );

    const unrecognised = render([
      rotationJob({
        status: RotationJobStatus.Failed,
        attempts: [
          rotationAttempt({
            id: attemptId("1"),
            status: RotationAttemptStatus.Errored,
            failureReason: "flaky target",
          }),
        ],
      }),
    ]);
    expect(unrecognised.nativeElement.textContent).not.toContain("flaky target");
  });

  it("surfaces a failed session termination on the job row", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            id: attemptId("1"),
            sessionTermination: SessionTerminationOutcome.TermFailed,
          }),
        ],
      }),
    ]);

    expect(jobRows(fixture)[0].nativeElement.textContent).toContain(
      "pamRotationSessionTerminationTermFailed",
    );
    expect(resultCell(fixture).nativeElement.getAttribute("aria-label")).toContain(
      "pamRotationSessionTerminationTermFailed",
    );
  });

  it("leaves an ordinary session termination to the drawer", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            id: attemptId("1"),
            sessionTermination: SessionTerminationOutcome.Terminated,
          }),
        ],
      }),
    ]);

    expect(fixture.nativeElement.textContent).not.toContain(
      "pamRotationSessionTerminationTerminated",
    );
  });

  describe("the credential column", () => {
    it("is absent by default", () => {
      const fixture = render([rotationJob()]);
      expect(jobHeaders(fixture)).not.toContain("pamRotationConfigColumnCredential");
      expect(
        fixture.debugElement.queryAll(By.css("[data-testid='rotation-history-job-credential']")),
      ).toHaveLength(0);
    });

    it("names the managed credential when asked to", () => {
      const fixture = render([rotationJob({ rotationConfigId: configId("7") })], {
        showCredential: true,
        credentialNames: new Map([[configId("7"), "Prod service account"]]),
      });

      expect(jobHeaders(fixture)[1]).toBe("pamRotationConfigColumnCredential");
      const cell = fixture.debugElement.query(
        By.css("[data-testid='rotation-history-job-credential']"),
      ).nativeElement;
      expect(cell.textContent.trim()).toBe("Prod service account");
      expect(cell.querySelector("span").className).not.toContain("tw-truncate");
      expect(cell.querySelector("[title]")).toBeNull();
    });

    it("falls back to the config id when no name resolved", () => {
      const fixture = render([rotationJob({ rotationConfigId: configId("7") })], {
        showCredential: true,
      });

      const cell = fixture.debugElement.query(
        By.css("[data-testid='rotation-history-job-credential']"),
      );
      expect(cell.nativeElement.textContent.trim()).toBe(String(configId("7")));
      expect(cell.nativeElement.querySelector("span").className).toContain("tw-font-mono");
      expect(cell.nativeElement.querySelector("span").className).not.toContain("tw-truncate");
    });
  });

  describe("attempts", () => {
    it("counts a job's attempts in the ledger without listing them", () => {
      const fixture = render([retriedFailure()]);

      const cell = fixture.debugElement.query(
        By.css("[data-testid='rotation-history-job-attempts']"),
      );
      expect(cell.nativeElement.textContent.trim()).toBe("5");
    });

    it("never nests a table inside the job table", () => {
      const fixture = render([retriedFailure()]);
      const tables = fixture.debugElement.queryAll(By.css("table"));

      expect(tables).toHaveLength(1);
      expect(tables[0].nativeElement.querySelector("table")).toBeNull();
    });

    it("renders no attempt value in the job table", () => {
      const fixture = render([retriedFailure()]);

      expect(fixture.nativeElement.textContent).not.toContain("pamRotationAttemptStatusErrored");
      expect(fixture.nativeElement.textContent).not.toContain("pamRotationHistoryColumnAttempt ");
    });
  });

  describe("opening a job", () => {
    it("opens the details drawer when the row is clicked", () => {
      const fixture = render([retriedFailure()]);

      jobRows(fixture)[0].nativeElement.click();

      expect(dialogService.openDrawer).toHaveBeenCalledWith(
        RotationJobDrawerComponent,
        expect.objectContaining({ closeOnNavigation: true }),
      );
      expect(drawerParams().job.attempts).toHaveLength(5);
    });

    it("opens the details drawer from the keyboard", () => {
      const fixture = render([retriedFailure()]);

      resultCell(fixture).triggerEventHandler("keydown.enter", {});
      expect(dialogService.openDrawer).toHaveBeenCalledTimes(1);

      resultCell(fixture).triggerEventHandler("keydown.space", { preventDefault: () => {} });
      expect(dialogService.openDrawer).toHaveBeenCalledTimes(2);
    });

    it("gives the row's activation control a focusable button role and a name", () => {
      const fixture = render([rotationJob({ createdAt: "2026-01-01T00:00:00Z" })]);

      const cell = resultCell(fixture).nativeElement;
      expect(cell.getAttribute("role")).toBe("button");
      expect(cell.getAttribute("tabindex")).toBe("0");
      expect(cell.getAttribute("aria-label")).toContain("pamRotationJobStatusSucceeded");
      expect(cell.getAttribute("aria-label")).not.toBe("pamRotationJobStatusSucceeded ");
    });

    it("carries only one activation control per row", () => {
      const fixture = render([
        rotationJob({ id: jobId("1"), createdAt: "2026-01-01T00:00:00Z" }),
        rotationJob({ id: jobId("2"), createdAt: "2026-02-01T00:00:00Z" }),
      ]);

      expect(fixture.debugElement.queryAll(By.css("[tabindex='0']"))).toHaveLength(2);
    });

    it("hands focus back to the row when the drawer closes", async () => {
      const fixture = render([retriedFailure()]);
      const closed = openedDrawer();

      const cell = resultCell(fixture).nativeElement as HTMLElement;
      cell.click();
      await settle(fixture);

      (document.activeElement as HTMLElement)?.blur();
      expect(document.activeElement).not.toBe(cell);

      closed.next(undefined);
      expect(document.activeElement).toBe(cell);
    });

    it("stands Source, Duration and Attempts down while the pane is beside the table", async () => {
      const fixture = render([retriedFailure()]);
      const closed = openedDrawer();
      const hidden = () =>
        fixture.debugElement
          .queryAll(By.css("[data-testid='rotation-history-columns'] th"))
          .filter((th: any) => th.nativeElement.className.includes("tw-hidden"))
          .map((th: any) => th.nativeElement.textContent.trim());

      expect(hidden()).toEqual([]);

      jobRows(fixture)[0].nativeElement.click();
      await settle(fixture);

      expect(hidden()).toEqual([
        "pamRotationHistoryColumnSource",
        "pamRotationHistoryDurationLabel",
        "pamRotationHistoryColumnAttempts",
      ]);

      closed.next(undefined);
      fixture.detectChanges();
      expect(hidden()).toEqual([]);
    });

    it("tells the drawer whether the table named the credential", () => {
      const withCredential = render([rotationJob({ rotationConfigId: configId("7") })], {
        showCredential: true,
        credentialNames: new Map([[configId("7"), "Prod service account"]]),
      });
      jobRows(withCredential)[0].nativeElement.click();
      expect(drawerParams().showCredential).toBe(true);
      expect(drawerParams().job.credentialName).toBe("Prod service account");

      const withoutCredential = render([rotationJob()]);
      jobRows(withoutCredential)[0].nativeElement.click();
      expect(drawerParams().showCredential).toBe(false);
    });
  });
});
