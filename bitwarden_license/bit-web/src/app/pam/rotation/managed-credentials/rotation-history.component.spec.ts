import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { RotationJob } from "../rotation";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";
import { jobId, rotationAttempt, rotationJob } from "../testing/rotation-builders";

import { RotationHistoryComponent } from "./rotation-history.component";

function makeJob(overrides: Partial<RotationJob> = {}): RotationJob {
  return rotationJob(overrides);
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
});

describe("RotationHistoryComponent rendering", () => {
  function render(jobs: RotationJob[]) {
    TestBed.configureTestingModule({
      imports: [RotationHistoryComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    });

    const fixture = TestBed.createComponent(RotationHistoryComponent);
    fixture.componentRef.setInput("jobs", jobs);
    fixture.detectChanges();
    return fixture;
  }

  it("gives each attempt row a single cell spanning every column", () => {
    const fixture = render([rotationJob()]);

    const attemptRows = fixture.debugElement.queryAll(By.css("tr.tw-bg-background-alt"));
    expect(attemptRows).toHaveLength(1);

    const cells = fixture.debugElement.queryAll(By.css("tr.tw-bg-background-alt td"));
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
      rotationJob({ attempts: [rotationAttempt({ endedAt: undefined, status: "executing" })] }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationAttemptStarted");
    expect(text).toContain("pamRotationAttemptInProgress");
    expect(text).not.toContain("pamRotationAttemptEnded");
  });

  it("leaves the job row filling the four headers, with the attempt count last", () => {
    const fixture = render([rotationJob()]);

    const cells = fixture.debugElement.queryAll(By.css("tbody tr:not(.tw-bg-background-alt) td"));
    expect(cells).toHaveLength(4);
    expect(cells[3].nativeElement.textContent.trim()).toBe("1");
  });

  it("keeps the attempt status, failure reason and sync state in the row", () => {
    const fixture = render([
      rotationJob({
        attempts: [
          rotationAttempt({
            status: "errored",
            failureReason: "LDAP result code 53",
            syncState: "indeterminate",
          }),
        ],
      }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("pamRotationAttemptStatusErrored");
    expect(text).toContain("LDAP result code 53");
    expect(text).toContain("pamRotationSyncStateIndeterminate");
  });
});
