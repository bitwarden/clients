import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import {
  PAM_NOTIFICATION_SNAPSHOT,
  PamNotificationStateService,
} from "./pam-notification-state.service";

describe("PamNotificationStateService", () => {
  const userId = "user-1" as UserId;
  let service: PamNotificationStateService;

  beforeEach(() => {
    service = new PamNotificationStateService(
      new FakeStateProvider(mockAccountServiceWith(userId)),
    );
  });

  it("is on until turned off", async () => {
    expect(await firstValueFrom(service.enabled$)).toBe(true);

    await service.setEnabled(false);

    expect(await firstValueFrom(service.enabled$)).toBe(false);
  });

  it("stores each user's snapshot", async () => {
    const snapshot = { inbox: ["i1"], requests: { r1: "pending" as const }, leases: {} };

    await service.setSnapshot(userId, snapshot);

    expect(await firstValueFrom(service.snapshot$(userId))).toEqual(snapshot);
    expect(await firstValueFrom(service.snapshot$("user-2" as UserId))).toBeNull();
  });

  it("clears the snapshot on logout only", () => {
    expect(PAM_NOTIFICATION_SNAPSHOT.clearOn).toEqual(["logout"]);
  });
});
