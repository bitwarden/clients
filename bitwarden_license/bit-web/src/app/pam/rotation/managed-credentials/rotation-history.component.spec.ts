import { TestBed } from "@angular/core/testing";

import type { RotationJobView } from "../rotation";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";
import { jobId, rotationJobView } from "../testing/rotation-builders";

import { RotationHistoryComponent } from "./rotation-history.component";

function makeJob(overrides: Partial<RotationJobView> = {}): RotationJobView {
  return rotationJobView(overrides);
}

describe("RotationHistoryComponent", () => {
  let component: RotationHistoryComponent;

  function setup(jobs: RotationJobView[]) {
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
