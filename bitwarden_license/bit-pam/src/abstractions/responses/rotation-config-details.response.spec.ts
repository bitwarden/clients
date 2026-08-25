import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSessionTermination,
  RotationSource,
  RotationSyncState,
  TargetSystemMethod,
} from "../rotation";

import {
  RotationAttemptResponse,
  RotationConfigDetailsResponse,
  RotationJobResponse,
} from "./rotation-config-details.response";

const makeAttemptRaw = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  Id: "attempt-uuid-1",
  Status: RotationAttemptStatus.Rotated,
  FailureReason: null as unknown,
  SyncState: RotationSyncState.TargetUpdated,
  SessionTermination: RotationSessionTermination.Terminated,
  CreationDate: "2024-06-01T02:00:05Z",
  ResolvedDate: "2024-06-01T02:00:10Z",
  ...overrides,
});

const makeJobRaw = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  Id: "job-uuid-1",
  Source: RotationSource.Scheduled,
  Status: RotationJobStatus.Succeeded,
  CreationDate: "2024-06-01T02:00:00Z",
  Attempts: [makeAttemptRaw()],
  ...overrides,
});

const makeConfigRaw = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  Id: "config-uuid-details",
  CipherId: "cipher-uuid-abcd",
  TargetSystemId: "ts-uuid-efgh",
  TargetSystemName: "Production Entra",
  TargetSystemMethod: TargetSystemMethod.Automatic,
  AccountIdentity: "svc-account@corp.example.com",
  TerminateSessions: true,
  ScheduleCron: "0 0 0 * * ?",
  RotateOnAccessEnd: false,
  Enabled: true,
  LastRotationAt: "2024-06-01T02:00:10Z",
  NextRotationAt: "2024-06-02T02:00:00Z",
  HasActiveJob: false,
  AwaitingManualRotation: false,
  Jobs: [makeJobRaw()],
  ...overrides,
});

describe("RotationAttemptResponse", () => {
  describe("with a successful attempt", () => {
    let response: RotationAttemptResponse;

    beforeEach(() => {
      response = new RotationAttemptResponse(makeAttemptRaw());
    });

    it("parses id", () => {
      expect(response.id).toBe("attempt-uuid-1");
    });

    it("parses status as Rotated", () => {
      expect(response.status).toBe(RotationAttemptStatus.Rotated);
    });

    it("parses failureReason as null for a successful attempt", () => {
      expect(response.failureReason).toBeNull();
    });

    it("parses syncState as TargetUpdated", () => {
      expect(response.syncState).toBe(RotationSyncState.TargetUpdated);
    });

    it("parses sessionTermination as Terminated", () => {
      expect(response.sessionTermination).toBe(RotationSessionTermination.Terminated);
    });

    it("parses startedAt", () => {
      expect(response.startedAt).toBe("2024-06-01T02:00:05Z");
    });

    it("parses endedAt", () => {
      expect(response.endedAt).toBe("2024-06-01T02:00:10Z");
    });
  });

  describe("with a failed attempt (nulls and missing fields)", () => {
    const raw = makeAttemptRaw({
      Id: "attempt-uuid-fail",
      Status: RotationAttemptStatus.Errored,
      FailureReason: "Connection refused",
      SyncState: RotationSyncState.TargetUnchanged,
      SessionTermination: null,
      ResolvedDate: "2024-06-01T02:00:08Z",
    });

    let response: RotationAttemptResponse;

    beforeEach(() => {
      response = new RotationAttemptResponse(raw);
    });

    it("parses status as Errored", () => {
      expect(response.status).toBe(RotationAttemptStatus.Errored);
    });

    it("parses failureReason", () => {
      expect(response.failureReason).toBe("Connection refused");
    });

    it("parses syncState as TargetUnchanged", () => {
      expect(response.syncState).toBe(RotationSyncState.TargetUnchanged);
    });

    it("parses explicit null sessionTermination as null", () => {
      expect(response.sessionTermination).toBeNull();
    });
  });

  describe("with an executing attempt (endedAt absent)", () => {
    const raw = makeAttemptRaw({
      Status: RotationAttemptStatus.Executing,
      SyncState: null,
      SessionTermination: null,
      // ResolvedDate absent
    });
    delete raw.ResolvedDate;

    it("defaults endedAt to null when absent", () => {
      const response = new RotationAttemptResponse(raw);
      expect(response.endedAt).toBeNull();
    });

    it("parses syncState as null when absent", () => {
      const response = new RotationAttemptResponse(raw);
      expect(response.syncState).toBeNull();
    });
  });
});

describe("RotationJobResponse", () => {
  describe("with a succeeded job with one attempt", () => {
    let response: RotationJobResponse;

    beforeEach(() => {
      response = new RotationJobResponse(makeJobRaw());
    });

    it("parses id", () => {
      expect(response.id).toBe("job-uuid-1");
    });

    it("parses source as Scheduled", () => {
      expect(response.source).toBe(RotationSource.Scheduled);
    });

    it("parses status as Succeeded", () => {
      expect(response.status).toBe(RotationJobStatus.Succeeded);
    });

    it("parses createdAt", () => {
      expect(response.createdAt).toBe("2024-06-01T02:00:00Z");
    });

    it("parses attempts as an array of RotationAttemptResponse", () => {
      expect(response.attempts).toHaveLength(1);
      expect(response.attempts[0]).toBeInstanceOf(RotationAttemptResponse);
    });

    it("parses nested attempt id", () => {
      expect(response.attempts[0].id).toBe("attempt-uuid-1");
    });
  });

  describe("with a failed job from an on-demand trigger", () => {
    const raw = makeJobRaw({
      Id: "job-uuid-fail",
      Source: RotationSource.OnDemand,
      Status: RotationJobStatus.Failed,
      Attempts: [
        makeAttemptRaw({
          Id: "attempt-uuid-fail-1",
          Status: RotationAttemptStatus.Errored,
          FailureReason: "Timeout",
        }),
        makeAttemptRaw({
          Id: "attempt-uuid-fail-2",
          Status: RotationAttemptStatus.Abandoned,
          FailureReason: "Daemon revoked",
        }),
      ],
    });

    let response: RotationJobResponse;

    beforeEach(() => {
      response = new RotationJobResponse(raw);
    });

    it("parses source as OnDemand", () => {
      expect(response.source).toBe(RotationSource.OnDemand);
    });

    it("parses status as Failed", () => {
      expect(response.status).toBe(RotationJobStatus.Failed);
    });

    it("parses multiple attempts", () => {
      expect(response.attempts).toHaveLength(2);
    });

    it("parses all attempts as RotationAttemptResponse instances", () => {
      response.attempts.forEach((a) => expect(a).toBeInstanceOf(RotationAttemptResponse));
    });
  });

  describe("with a pending job and no attempts", () => {
    const raw = makeJobRaw({
      Status: RotationJobStatus.Pending,
      Attempts: [],
    });

    it("parses empty attempts array", () => {
      const response = new RotationJobResponse(raw);
      expect(response.attempts).toEqual([]);
    });
  });

  describe("with Attempts absent from the payload", () => {
    const raw = {
      Id: "job-uuid-no-attempts",
      Source: RotationSource.AccessEnd,
      Status: RotationJobStatus.TimedOut,
      CreationDate: "2024-06-03T00:00:00Z",
    };

    it("defaults attempts to empty array when absent", () => {
      const response = new RotationJobResponse(raw);
      expect(response.attempts).toEqual([]);
    });
  });
});

describe("RotationConfigDetailsResponse", () => {
  describe("with a fully-populated details payload", () => {
    let response: RotationConfigDetailsResponse;

    beforeEach(() => {
      response = new RotationConfigDetailsResponse(makeConfigRaw());
    });

    it("inherits base config fields from RotationConfigResponse", () => {
      expect(response.id).toBe("config-uuid-details");
      expect(response.cipherId).toBe("cipher-uuid-abcd");
      expect(response.enabled).toBe(true);
    });

    it("parses jobs as an array of RotationJobResponse", () => {
      expect(response.jobs).toHaveLength(1);
      expect(response.jobs[0]).toBeInstanceOf(RotationJobResponse);
    });

    it("parses nested job id", () => {
      expect(response.jobs[0].id).toBe("job-uuid-1");
    });

    it("parses nested attempt from job", () => {
      expect(response.jobs[0].attempts[0].id).toBe("attempt-uuid-1");
    });
  });

  describe("with multiple jobs", () => {
    const raw = makeConfigRaw({
      Jobs: [
        makeJobRaw({ Id: "job-uuid-newer", Source: RotationSource.OnDemand }),
        makeJobRaw({ Id: "job-uuid-older", Source: RotationSource.Scheduled }),
      ],
    });

    it("parses two jobs", () => {
      const response = new RotationConfigDetailsResponse(raw);
      expect(response.jobs).toHaveLength(2);
      expect(response.jobs[0].id).toBe("job-uuid-newer");
      expect(response.jobs[1].id).toBe("job-uuid-older");
    });
  });

  describe("with Jobs absent from the payload", () => {
    const raw = makeConfigRaw();
    delete raw.Jobs;

    it("defaults jobs to empty array when absent", () => {
      const response = new RotationConfigDetailsResponse(raw);
      expect(response.jobs).toEqual([]);
    });
  });

  describe("with an empty Jobs array", () => {
    const raw = makeConfigRaw({ Jobs: [] });

    it("parses empty jobs array", () => {
      const response = new RotationConfigDetailsResponse(raw);
      expect(response.jobs).toEqual([]);
    });
  });
});
