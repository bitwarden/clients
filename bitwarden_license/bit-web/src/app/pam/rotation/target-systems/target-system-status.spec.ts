import { AccessConnectorStatus, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { accessConnector, sysId, targetSystem } from "../testing/rotation-builders";

import {
  TARGET_SYSTEM_STATUS_BADGES,
  TargetSystemRowStatus,
  resolveTargetSystemStatus,
  targetSystemStatusBadge,
} from "./target-system-status";

describe("resolveTargetSystemStatus", () => {
  const id = sysId("1");
  const connected = accessConnector({ assignedTargetSystemIds: [id] });

  it("is Active for an active automatic target with a connected connector", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.Active });

    expect(resolveTargetSystemStatus(system, [connected])).toBe(TargetSystemRowStatus.Active);
  });

  it("is Not connected for an active automatic target with no connected connector", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.Active });
    const disconnected = accessConnector({ assignedTargetSystemIds: [id], isConnected: false });

    expect(resolveTargetSystemStatus(system, [])).toBe(TargetSystemRowStatus.NotConnected);
    expect(resolveTargetSystemStatus(system, [disconnected])).toBe(
      TargetSystemRowStatus.NotConnected,
    );
  });

  it("does not count a disabled connector as connected", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.Active });
    const disabled = accessConnector({
      assignedTargetSystemIds: [id],
      status: AccessConnectorStatus.Disabled,
    });

    expect(resolveTargetSystemStatus(system, [disabled])).toBe(TargetSystemRowStatus.NotConnected);
  });

  it("is Inactive ahead of Not connected", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.Disabled });

    expect(resolveTargetSystemStatus(system, [])).toBe(TargetSystemRowStatus.Inactive);
  });

  it("is Active for a manual target, which has nothing to connect", () => {
    const system = targetSystem({
      id,
      status: TargetSystemStatus.Active,
      method: TargetSystemMethod.Manual,
    });

    expect(resolveTargetSystemStatus(system, [])).toBe(TargetSystemRowStatus.Active);
  });

  it("never reads as Not connected while the connector list is unknown", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.Active });

    expect(resolveTargetSystemStatus(system, null)).toBe(TargetSystemRowStatus.Active);
  });

  it("is Setup incomplete for a pending target, ahead of the other states", () => {
    const system = targetSystem({ id, status: TargetSystemStatus.PendingSeal });

    expect(resolveTargetSystemStatus(system, [])).toBe(TargetSystemRowStatus.PendingSeal);
  });
});

describe("targetSystemStatusBadge", () => {
  it("gives each status one label", () => {
    expect(targetSystemStatusBadge(TargetSystemRowStatus.NotConnected)).toMatchObject({
      labelKey: "pamTargetSystemStatusNotConnected",
      variant: "warning",
      icon: "bwi-warning",
    });
    expect(targetSystemStatusBadge(TargetSystemRowStatus.Inactive)).toMatchObject({
      labelKey: "pamTargetSystemStatusInactive",
      variant: "subtle",
      icon: "bwi-minus-circle",
    });
    expect(targetSystemStatusBadge(TargetSystemRowStatus.Active)).toMatchObject({
      labelKey: "pamTargetSystemStatusActive",
      variant: "success",
      icon: "bwi-check-circle",
    });
  });

  it("lists the statuses by urgency: Not connected, Inactive, Active", () => {
    expect(
      TARGET_SYSTEM_STATUS_BADGES.map((badge) => badge.status).filter(
        (status) => status !== TargetSystemRowStatus.PendingSeal,
      ),
    ).toEqual([
      TargetSystemRowStatus.NotConnected,
      TargetSystemRowStatus.Inactive,
      TargetSystemRowStatus.Active,
    ]);
  });
});
