import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { RotationAttempt, RotationJob } from "../rotation";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";
import { attemptId, jobId, rotationAttempt, rotationJob } from "../testing/rotation-builders";

import { RotationHistoryComponent } from "./rotation-history.component";

function makeJob(overrides: Partial<RotationJob> = {}): RotationJob {
  return rotationJob(overrides);
}

function failedAttempt(label: string, failureReason: string): RotationAttempt {
  return rotationAttempt({
    id: attemptId(label),
    status: RotationAttemptStatus.Errored,
    failureReason,
  });
}

describe("RotationHistoryComponent", () => {
  let component: RotationHistoryComponent;

  function setup(jobs: RotationJob[]) {
    TestBed.overrideComponent(RotationHistoryComponent, {
      set: { template: "<div>stub</div>", imports: [] },
    });

    TestBed.configureTestingModule({
      imports: [RotationHistoryComponent],
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
      const older = makeJob({ id: jobId("job-old"), createdAt: "2024-01-01T00:00:00Z" });
      const newer = makeJob({ id: jobId("job-new"), createdAt: "2024-06-01T00:00:00Z" });
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

  describe("jobFailureCauseLabelKey", () => {
    it("returns the shared key when every attempt failed the same recognised way", () => {
      setup([]);
      const job = makeJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "target_rejected: LDAP result code 50"),
          failedAttempt("9", "target_rejected: ldap error code 50"),
        ],
      });

      expect((component as any).jobFailureCauseLabelKey(job)).toBe(
        "pamRotationFailureCauseInsufficientRights",
      );
    });

    it("returns null when the attempts resolve to two different causes", () => {
      setup([]);
      const job = makeJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "target_unreachable: error kind: ConnectionRefused"),
        ],
      });

      expect((component as any).jobFailureCauseLabelKey(job)).toBeNull();
    });

    it("skips an unrecognised attempt rather than letting it disqualify the job", () => {
      setup([]);
      const job = makeJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "flaky target"),
        ],
      });

      expect((component as any).jobFailureCauseLabelKey(job)).toBe(
        "pamRotationFailureCauseInsufficientRights",
      );
    });

    it("returns null when no attempt failed", () => {
      setup([]);
      expect((component as any).jobFailureCauseLabelKey(makeJob())).toBeNull();
    });

    it("returns null when the only failure is unrecognised", () => {
      setup([]);
      const job = makeJob({ attempts: [failedAttempt("7", "flaky target")] });

      expect((component as any).jobFailureCauseLabelKey(job)).toBeNull();
    });
  });
});

describe("RotationHistoryComponent rendering", () => {
  const i18nFake: Pick<I18nService, "t"> = {
    t: (id: string, ...substitutions: (string | number)[]) => [id, ...substitutions].join(" "),
  };

  function render(jobs: RotationJob[]) {
    TestBed.configureTestingModule({
      imports: [RotationHistoryComponent],
      providers: [{ provide: I18nService, useValue: i18nFake }],
    });

    const fixture = TestBed.createComponent(RotationHistoryComponent);
    fixture.componentRef.setInput("jobs", jobs);
    fixture.detectChanges();
    return fixture;
  }

  it("gives each attempt row a single cell spanning every column", () => {
    const fixture = render([rotationJob()]);

    const attemptRows = fixture.debugElement.queryAll(
      By.css("[data-testid='rotation-history-attempt-row']"),
    );
    expect(attemptRows).toHaveLength(1);

    const cells = attemptRows[0].queryAll(By.css("td"));
    expect(cells).toHaveLength(1);
    expect(cells[0].nativeElement.getAttribute("colspan")).toBe("4");
  });

  it("labels both timestamps of a finished attempt", () => {
    const fixture = render([rotationJob()]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationAttemptStarted");
    expect(text).toContain("pamRotationAttemptEnded");
  });

  it("shows in progress and no ended label while an attempt is running", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({ endedAt: undefined, status: RotationAttemptStatus.Executing }),
        ],
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationAttemptStarted");
    expect(text).toContain("pamRotationAttemptInProgress");
    expect(text).not.toContain("pamRotationAttemptEnded");
  });

  it("leaves the job row filling the four headers, with the attempt count last", () => {
    const fixture = render([rotationJob()]);

    const cells = fixture.debugElement.queryAll(
      By.css("[data-testid='rotation-history-job-row'] td"),
    );
    expect(cells).toHaveLength(4);
    expect(cells[3].nativeElement.textContent.trim()).toBe("1");
  });

  it("keeps the attempt status, failure reason and sync state in the row", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            status: RotationAttemptStatus.Errored,
            failureReason: "LDAP result code 53",
            syncState: RotationSyncState.Indeterminate,
          }),
        ],
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationAttemptStatusErrored");
    expect(text).toContain("LDAP result code 53");
    expect(text).toContain("pamRotationSyncStateIndeterminate");
  });

  it("explains a recognised failure and carries the recorded reason on its own line", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            status: RotationAttemptStatus.Errored,
            failureReason: "target_rejected: LDAP result code 50",
          }),
        ],
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationFailureCauseInsufficientRights");
    expect(text).toContain("pamRotationFailureReportedDetail target_rejected: LDAP result code 50");
  });

  it("shows an unrecognised failure reason alone, with no explanation line", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            status: RotationAttemptStatus.Errored,
            failureReason: "flaky target",
          }),
        ],
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("flaky target");
    expect(text).not.toContain("pamRotationFailureReportedDetail");
  });

  it("states one shared cause once for the job instead of once per attempt row", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "target_rejected: LDAP result code 50"),
          failedAttempt("9", "target_rejected: LDAP result code 50"),
        ],
      }),
    ]);

    expect(fixture.debugElement.queryAll(By.css("bit-callout"))).toHaveLength(1);

    const text = fixture.nativeElement.textContent;
    expect(text.match(/pamRotationFailureCauseInsufficientRights/g)).toHaveLength(1);

    const attemptRows = fixture.debugElement.queryAll(
      By.css("[data-testid='rotation-history-attempt-row']"),
    );
    expect(attemptRows).toHaveLength(3);
    attemptRows.forEach((row) =>
      expect(row.nativeElement.textContent).toContain("pamRotationFailureReportedDetail"),
    );
  });

  it("spans the cause row across all four columns", () => {
    const fixture = render([
      rotationJob({ attempts: [failedAttempt("7", "target_rejected: LDAP result code 50")] }),
    ]);

    const cells = fixture.debugElement.queryAll(
      By.css("[data-testid='rotation-history-job-cause-row'] td"),
    );
    expect(cells).toHaveLength(1);
    expect(cells[0].nativeElement.getAttribute("colspan")).toBe("4");
    expect(cells[0].query(By.css("bit-callout"))).not.toBeNull();
  });

  it("keeps a cause on every attempt row when the job failed in two different ways", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "target_unreachable: error kind: ConnectionRefused"),
        ],
      }),
    ]);

    expect(fixture.debugElement.queryAll(By.css("bit-callout"))).toHaveLength(0);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationFailureCauseInsufficientRights");
    expect(text).toContain("pamRotationFailureCauseTargetUnreachable");
  });

  it("keeps an unrecognised reason on its own row beside the job-level cause", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          failedAttempt("7", "target_rejected: LDAP result code 50"),
          failedAttempt("8", "target_rejected: LDAP result code 50"),
          failedAttempt("9", "flaky target"),
        ],
      }),
    ]);

    expect(fixture.debugElement.queryAll(By.css("bit-callout"))).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain("flaky target");
  });
});
