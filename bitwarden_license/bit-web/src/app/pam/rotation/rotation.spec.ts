import {
  DaemonStatus,
  isDaemonStatus,
  isRotationAttemptStatus,
  isRotationJobStatus,
  isRotationSessionTermination,
  isRotationSource,
  isRotationSyncState,
  isTargetSystemKind,
  isTargetSystemMethod,
  isTargetSystemStatus,
  toDaemonStatus,
  toRotationAttemptStatus,
  toRotationJobStatus,
  toRotationSessionTermination,
  toRotationSource,
  toRotationSyncState,
  toTargetSystemKind,
  toTargetSystemMethod,
  toTargetSystemStatus,
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSessionTermination,
  RotationSource,
  RotationSyncState,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "./rotation";

describe("TargetSystemMethod", () => {
  describe("isTargetSystemMethod", () => {
    it("returns true for valid members", () => {
      expect(isTargetSystemMethod(TargetSystemMethod.Automatic)).toBe(true);
      expect(isTargetSystemMethod(TargetSystemMethod.Manual)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isTargetSystemMethod(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTargetSystemMethod(undefined)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isTargetSystemMethod(null)).toBe(false);
    });

    it("returns false for a string that is not a member", () => {
      expect(isTargetSystemMethod("Automatic")).toBe(false);
    });
  });

  describe("toTargetSystemMethod", () => {
    it("returns the value for a valid member", () => {
      expect(toTargetSystemMethod(0)).toBe(TargetSystemMethod.Automatic);
      expect(toTargetSystemMethod(1)).toBe(TargetSystemMethod.Manual);
    });

    it("returns the value when given a numeric string", () => {
      expect(toTargetSystemMethod("0")).toBe(TargetSystemMethod.Automatic);
      expect(toTargetSystemMethod("1")).toBe(TargetSystemMethod.Manual);
    });

    it("returns undefined for an invalid number", () => {
      expect(toTargetSystemMethod(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toTargetSystemMethod(undefined)).toBeUndefined();
    });

    it("returns undefined for a non-numeric string", () => {
      expect(toTargetSystemMethod("Automatic")).toBeUndefined();
    });
  });
});

describe("TargetSystemKind", () => {
  describe("isTargetSystemKind", () => {
    it("returns true for valid members", () => {
      expect(isTargetSystemKind(TargetSystemKind.Entra)).toBe(true);
      expect(isTargetSystemKind(TargetSystemKind.Mssql)).toBe(true);
      expect(isTargetSystemKind(TargetSystemKind.CustomScript)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isTargetSystemKind(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTargetSystemKind(undefined)).toBe(false);
    });
  });

  describe("toTargetSystemKind", () => {
    it("returns the value for a valid member", () => {
      expect(toTargetSystemKind(0)).toBe(TargetSystemKind.Entra);
      expect(toTargetSystemKind(1)).toBe(TargetSystemKind.Mssql);
      expect(toTargetSystemKind(2)).toBe(TargetSystemKind.CustomScript);
    });

    it("returns the value when given a numeric string", () => {
      expect(toTargetSystemKind("2")).toBe(TargetSystemKind.CustomScript);
    });

    it("returns undefined for an invalid number", () => {
      expect(toTargetSystemKind(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toTargetSystemKind(undefined)).toBeUndefined();
    });
  });
});

describe("TargetSystemStatus", () => {
  describe("isTargetSystemStatus", () => {
    it("returns true for valid members", () => {
      expect(isTargetSystemStatus(TargetSystemStatus.Active)).toBe(true);
      expect(isTargetSystemStatus(TargetSystemStatus.Disabled)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isTargetSystemStatus(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTargetSystemStatus(undefined)).toBe(false);
    });
  });

  describe("toTargetSystemStatus", () => {
    it("returns the value for a valid member", () => {
      expect(toTargetSystemStatus(0)).toBe(TargetSystemStatus.Active);
      expect(toTargetSystemStatus(1)).toBe(TargetSystemStatus.Disabled);
    });

    it("returns undefined for an invalid number", () => {
      expect(toTargetSystemStatus(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toTargetSystemStatus(undefined)).toBeUndefined();
    });
  });
});

describe("DaemonStatus", () => {
  describe("isDaemonStatus", () => {
    it("returns true for valid members", () => {
      expect(isDaemonStatus(DaemonStatus.Enabled)).toBe(true);
      expect(isDaemonStatus(DaemonStatus.Disabled)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isDaemonStatus(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isDaemonStatus(undefined)).toBe(false);
    });
  });

  describe("toDaemonStatus", () => {
    it("returns the value for a valid member", () => {
      expect(toDaemonStatus(0)).toBe(DaemonStatus.Enabled);
      expect(toDaemonStatus(1)).toBe(DaemonStatus.Disabled);
    });

    it("returns the value when given a numeric string", () => {
      expect(toDaemonStatus("1")).toBe(DaemonStatus.Disabled);
    });

    it("returns undefined for an invalid number", () => {
      expect(toDaemonStatus(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toDaemonStatus(undefined)).toBeUndefined();
    });
  });
});

describe("RotationSource", () => {
  describe("isRotationSource", () => {
    it("returns true for valid members", () => {
      expect(isRotationSource(RotationSource.Scheduled)).toBe(true);
      expect(isRotationSource(RotationSource.OnDemand)).toBe(true);
      expect(isRotationSource(RotationSource.AccessEnd)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isRotationSource(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isRotationSource(undefined)).toBe(false);
    });
  });

  describe("toRotationSource", () => {
    it("returns the value for a valid member", () => {
      expect(toRotationSource(0)).toBe(RotationSource.Scheduled);
      expect(toRotationSource(1)).toBe(RotationSource.OnDemand);
      expect(toRotationSource(2)).toBe(RotationSource.AccessEnd);
    });

    it("returns undefined for an invalid number", () => {
      expect(toRotationSource(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toRotationSource(undefined)).toBeUndefined();
    });
  });
});

describe("RotationJobStatus", () => {
  describe("isRotationJobStatus", () => {
    it("returns true for valid members", () => {
      expect(isRotationJobStatus(RotationJobStatus.Pending)).toBe(true);
      expect(isRotationJobStatus(RotationJobStatus.Claimed)).toBe(true);
      expect(isRotationJobStatus(RotationJobStatus.Succeeded)).toBe(true);
      expect(isRotationJobStatus(RotationJobStatus.Failed)).toBe(true);
      expect(isRotationJobStatus(RotationJobStatus.TimedOut)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isRotationJobStatus(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isRotationJobStatus(undefined)).toBe(false);
    });
  });

  describe("toRotationJobStatus", () => {
    it("returns the value for a valid member", () => {
      expect(toRotationJobStatus(0)).toBe(RotationJobStatus.Pending);
      expect(toRotationJobStatus(4)).toBe(RotationJobStatus.TimedOut);
    });

    it("returns the value when given a numeric string", () => {
      expect(toRotationJobStatus("3")).toBe(RotationJobStatus.Failed);
    });

    it("returns undefined for an invalid number", () => {
      expect(toRotationJobStatus(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toRotationJobStatus(undefined)).toBeUndefined();
    });
  });
});

describe("RotationAttemptStatus", () => {
  describe("isRotationAttemptStatus", () => {
    it("returns true for valid members", () => {
      expect(isRotationAttemptStatus(RotationAttemptStatus.Executing)).toBe(true);
      expect(isRotationAttemptStatus(RotationAttemptStatus.Rotated)).toBe(true);
      expect(isRotationAttemptStatus(RotationAttemptStatus.Errored)).toBe(true);
      expect(isRotationAttemptStatus(RotationAttemptStatus.Abandoned)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isRotationAttemptStatus(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isRotationAttemptStatus(undefined)).toBe(false);
    });
  });

  describe("toRotationAttemptStatus", () => {
    it("returns the value for a valid member", () => {
      expect(toRotationAttemptStatus(0)).toBe(RotationAttemptStatus.Executing);
      expect(toRotationAttemptStatus(3)).toBe(RotationAttemptStatus.Abandoned);
    });

    it("returns undefined for an invalid number", () => {
      expect(toRotationAttemptStatus(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toRotationAttemptStatus(undefined)).toBeUndefined();
    });
  });
});

describe("RotationSyncState", () => {
  describe("isRotationSyncState", () => {
    it("returns true for valid members", () => {
      expect(isRotationSyncState(RotationSyncState.TargetUnchanged)).toBe(true);
      expect(isRotationSyncState(RotationSyncState.TargetUpdated)).toBe(true);
      expect(isRotationSyncState(RotationSyncState.Indeterminate)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isRotationSyncState(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isRotationSyncState(undefined)).toBe(false);
    });
  });

  describe("toRotationSyncState", () => {
    it("returns the value for a valid member", () => {
      expect(toRotationSyncState(0)).toBe(RotationSyncState.TargetUnchanged);
      expect(toRotationSyncState(1)).toBe(RotationSyncState.TargetUpdated);
      expect(toRotationSyncState(2)).toBe(RotationSyncState.Indeterminate);
    });

    it("returns the value when given a numeric string", () => {
      expect(toRotationSyncState("2")).toBe(RotationSyncState.Indeterminate);
    });

    it("returns undefined for an invalid number", () => {
      expect(toRotationSyncState(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toRotationSyncState(undefined)).toBeUndefined();
    });
  });
});

describe("RotationSessionTermination", () => {
  describe("isRotationSessionTermination", () => {
    it("returns true for valid members", () => {
      expect(isRotationSessionTermination(RotationSessionTermination.NotRequested)).toBe(true);
      expect(isRotationSessionTermination(RotationSessionTermination.Terminated)).toBe(true);
      expect(isRotationSessionTermination(RotationSessionTermination.TermFailed)).toBe(true);
    });

    it("returns false for an invalid number", () => {
      expect(isRotationSessionTermination(99)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isRotationSessionTermination(undefined)).toBe(false);
    });
  });

  describe("toRotationSessionTermination", () => {
    it("returns the value for a valid member", () => {
      expect(toRotationSessionTermination(0)).toBe(RotationSessionTermination.NotRequested);
      expect(toRotationSessionTermination(1)).toBe(RotationSessionTermination.Terminated);
      expect(toRotationSessionTermination(2)).toBe(RotationSessionTermination.TermFailed);
    });

    it("returns the value when given a numeric string", () => {
      expect(toRotationSessionTermination("1")).toBe(RotationSessionTermination.Terminated);
    });

    it("returns undefined for an invalid number", () => {
      expect(toRotationSessionTermination(99)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(toRotationSessionTermination(undefined)).toBeUndefined();
    });
  });
});
