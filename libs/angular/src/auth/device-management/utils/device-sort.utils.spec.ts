import { DeviceDisplayData } from "../device-management.component";

import {
  clearAuthRequestAndSortDevices,
  recentlyActiveSortFn,
  sortDevices,
  sortDevicesWithActivity,
} from "./device-sort.utils";

function makeDevice(overrides: Partial<DeviceDisplayData> = {}): DeviceDisplayData {
  return {
    creationDate: "2026-01-01T00:00:00Z",
    displayName: "Test Device",
    firstLogin: new Date("2026-01-01T00:00:00Z"),
    icon: "bwi-desktop",
    id: "device-id",
    identifier: "device-identifier",
    isCurrentDevice: false,
    isTrusted: false,
    lastActivityDate: null,
    loginStatus: "",
    pendingAuthRequest: null,
    recentlyActiveText: "",
    ...overrides,
  };
}

describe("recentlyActiveSortFn", () => {
  // Mirrors what table-data-source.ts does: fn(a, b, direction) * directionModifier
  const sortAsc = (a: DeviceDisplayData, b: DeviceDisplayData) =>
    recentlyActiveSortFn(a, b, "asc") * 1;
  const sortDesc = (a: DeviceDisplayData, b: DeviceDisplayData) =>
    recentlyActiveSortFn(a, b, "desc") * -1;

  const older = () => makeDevice({ lastActivityDate: new Date("2026-01-01T00:00:00Z") });
  const newer = () => makeDevice({ lastActivityDate: new Date("2026-03-25T00:00:00Z") });

  describe("ascending (oldest first)", () => {
    it("sorts older activity date before newer", () => {
      const a = older();
      const b = newer();

      const result = [b, a].sort(sortAsc);

      expect(result[0]).toBe(a);
      expect(result[1]).toBe(b);
    });

    it("sorts null activity date before devices with a date (treats null as oldest)", () => {
      const withDate = older();
      const withoutDate = makeDevice({ lastActivityDate: null });

      const result = [withDate, withoutDate].sort(sortAsc);

      expect(result[0]).toBe(withoutDate);
      expect(result[1]).toBe(withDate);
    });

    it("preserves relative order when both devices have no activity date", () => {
      expect(recentlyActiveSortFn(makeDevice(), makeDevice(), "asc")).toBe(0);
    });

    it("does not pin current session — sorts by date like any other device", () => {
      const current = makeDevice({
        isCurrentDevice: true,
        lastActivityDate: new Date("2026-01-01T00:00:00Z"),
      });
      const other = newer();

      const result = [current, other].sort(sortAsc);

      // current has an older date, so it sorts first in ascending — but only because of the date
      expect(result[0]).toBe(current);
      expect(result[1]).toBe(other);
    });

    it("sorts current session after a device with a newer date when not pinned", () => {
      const current = makeDevice({
        isCurrentDevice: true,
        lastActivityDate: new Date("2026-01-01T00:00:00Z"),
      });
      const other = makeDevice({ lastActivityDate: new Date("2026-02-01T00:00:00Z") });
      const mostRecent = newer();

      const result = [mostRecent, other, current].sort(sortAsc);

      expect(result[0]).toBe(current);
      expect(result[1]).toBe(other);
      expect(result[2]).toBe(mostRecent);
    });
  });

  describe("descending (newest first)", () => {
    it("sorts newer activity date before older", () => {
      const a = older();
      const b = newer();

      const result = [a, b].sort(sortDesc);

      expect(result[0]).toBe(b);
      expect(result[1]).toBe(a);
    });

    it("sorts null activity date after devices with a date (treats null as oldest, so it sinks to the bottom when newest-first)", () => {
      const withDate = older();
      const withoutDate = makeDevice({ lastActivityDate: null });

      const result = [withoutDate, withDate].sort(sortDesc);

      expect(result[0]).toBe(withDate);
      expect(result[1]).toBe(withoutDate);
    });

    it("preserves relative order when both devices have no activity date", () => {
      expect(recentlyActiveSortFn(makeDevice(), makeDevice(), "desc")).toBe(0);
    });

    it("pins current session to the top even when it has an older activity date", () => {
      const current = makeDevice({
        isCurrentDevice: true,
        lastActivityDate: new Date("2026-01-01T00:00:00Z"),
      });
      const other = newer();

      const result = [other, current].sort(sortDesc);

      expect(result[0]).toBe(current);
      expect(result[1]).toBe(other);
    });

    it("pins current session above null-activity devices", () => {
      const current = makeDevice({ isCurrentDevice: true, lastActivityDate: null });
      const withoutDate = makeDevice({ lastActivityDate: null });

      const result = [withoutDate, current].sort(sortDesc);

      expect(result[0]).toBe(current);
      expect(result[1]).toBe(withoutDate);
    });
  });
});

// TODO: PM-34091 - Delete this entire describe block; sortDevices is being removed.
describe("sortDevices", () => {
  it("sorts pending auth request device before non-pending device", () => {
    const pending = makeDevice({ pendingAuthRequest: { id: "req-1", creationDate: "" } });
    const normal = makeDevice();

    const result = [normal, pending].sort(sortDevices);

    expect(result[0]).toBe(pending);
    expect(result[1]).toBe(normal);
  });

  it("sorts current device before non-current device when neither has a pending request", () => {
    const current = makeDevice({ isCurrentDevice: true });
    const other = makeDevice();

    const result = [other, current].sort(sortDevices);

    expect(result[0]).toBe(current);
    expect(result[1]).toBe(other);
  });

  it("sorts pending auth request device before current device", () => {
    const pending = makeDevice({ pendingAuthRequest: { id: "req-1", creationDate: "" } });
    const current = makeDevice({ isCurrentDevice: true });

    const result = [current, pending].sort(sortDevices);

    expect(result[0]).toBe(pending);
    expect(result[1]).toBe(current);
  });

  it("sorts devices by creation date descending when no special flags apply", () => {
    const older = makeDevice({ creationDate: "2026-01-01T00:00:00Z" });
    const newer = makeDevice({ creationDate: "2026-03-01T00:00:00Z" });

    const result = [older, newer].sort(sortDevices);

    expect(result[0]).toBe(newer);
    expect(result[1]).toBe(older);
  });

  it("returns 0 for two devices with identical creation dates and no special flags", () => {
    const a = makeDevice({ creationDate: "2026-01-01T00:00:00Z" });
    const b = makeDevice({ creationDate: "2026-01-01T00:00:00Z" });

    expect(sortDevices(a, b)).toBe(0);
  });
});

// TODO: PM-34091 - Rename this describe block to "sortDevices" once sortDevicesWithActivity is renamed.
describe("sortDevicesWithActivity", () => {
  it("sorts current device first, before pending auth request", () => {
    const current = makeDevice({ isCurrentDevice: true });
    const pending = makeDevice({ pendingAuthRequest: { id: "req-1", creationDate: "" } });

    const result = [pending, current].sort(sortDevicesWithActivity);

    expect(result[0]).toBe(current);
    expect(result[1]).toBe(pending);
  });

  it("sorts pending auth request device before recently active device", () => {
    const pending = makeDevice({ pendingAuthRequest: { id: "req-1", creationDate: "" } });
    const active = makeDevice({ lastActivityDate: new Date("2026-03-25T00:00:00Z") });

    const result = [active, pending].sort(sortDevicesWithActivity);

    expect(result[0]).toBe(pending);
    expect(result[1]).toBe(active);
  });

  it("sorts more recently active device before less recently active device", () => {
    const recentlyActive = makeDevice({ lastActivityDate: new Date("2026-03-25T00:00:00Z") });
    const lessRecentlyActive = makeDevice({ lastActivityDate: new Date("2026-01-01T00:00:00Z") });

    const result = [lessRecentlyActive, recentlyActive].sort(sortDevicesWithActivity);

    expect(result[0]).toBe(recentlyActive);
    expect(result[1]).toBe(lessRecentlyActive);
  });

  it("sorts device with lastActivityDate before device without one", () => {
    const withActivity = makeDevice({ lastActivityDate: new Date("2026-01-01T00:00:00Z") });
    const withoutActivity = makeDevice({ lastActivityDate: null });

    const result = [withoutActivity, withActivity].sort(sortDevicesWithActivity);

    expect(result[0]).toBe(withActivity);
    expect(result[1]).toBe(withoutActivity);
  });

  it("falls back to firstLogin date when both devices have no lastActivityDate", () => {
    const olderFirstLogin = makeDevice({ firstLogin: new Date("2026-01-01T00:00:00Z") });
    const newerFirstLogin = makeDevice({ firstLogin: new Date("2026-03-01T00:00:00Z") });

    const result = [olderFirstLogin, newerFirstLogin].sort(sortDevicesWithActivity);

    expect(result[0]).toBe(newerFirstLogin);
    expect(result[1]).toBe(olderFirstLogin);
  });
});

describe("clearAuthRequestAndSortDevices", () => {
  it("clears pendingAuthRequest and loginStatus on the matching device", () => {
    const target = makeDevice({
      pendingAuthRequest: { id: "req-1", creationDate: "" },
      loginStatus: "requestPending",
    });
    const other = makeDevice();

    const result = clearAuthRequestAndSortDevices([target, other], {
      id: "req-1",
      creationDate: "",
    });

    const clearedDevice = result.find((d) => d.id === target.id);
    expect(clearedDevice?.pendingAuthRequest).toBeNull();
    expect(clearedDevice?.loginStatus).toBe("");
  });

  it("does not modify devices that do not match the pending auth request", () => {
    const target = makeDevice({
      pendingAuthRequest: { id: "req-1", creationDate: "" },
      loginStatus: "requestPending",
    });
    const other = makeDevice({ loginStatus: "currentSession" });

    clearAuthRequestAndSortDevices([target, other], { id: "req-1", creationDate: "" });

    expect(other.loginStatus).toBe("currentSession");
    expect(other.pendingAuthRequest).toBeNull();
  });

  // TODO: PM-34091 - Remove this test; the sortFn parameter is being removed.
  it("re-sorts using the provided sortFn after clearing", () => {
    const wasPending = makeDevice({
      id: "was-pending",
      pendingAuthRequest: { id: "req-1", creationDate: "" },
      firstLogin: new Date("2026-01-01T00:00:00Z"),
    });
    const current = makeDevice({
      id: "current",
      isCurrentDevice: true,
      firstLogin: new Date("2026-02-01T00:00:00Z"),
    });

    const result = clearAuthRequestAndSortDevices(
      [wasPending, current],
      { id: "req-1", creationDate: "" },
      sortDevicesWithActivity,
    );

    // After clearing the pending request, current device should sort first
    expect(result[0].id).toBe("current");
    expect(result[1].id).toBe("was-pending");
  });

  // TODO: PM-34091 - Remove this test; the sortFn parameter default is being removed.
  it("defaults to sortDevices sort when no sortFn is provided", () => {
    const wasPending = makeDevice({
      id: "was-pending",
      pendingAuthRequest: { id: "req-1", creationDate: "" },
      creationDate: "2026-01-01T00:00:00Z",
    });
    const current = makeDevice({
      id: "current",
      isCurrentDevice: true,
      creationDate: "2026-02-01T00:00:00Z",
    });

    const result = clearAuthRequestAndSortDevices([wasPending, current], {
      id: "req-1",
      creationDate: "",
    });

    // sortDevices puts current device before others when no pending request
    expect(result[0].id).toBe("current");
  });
});
