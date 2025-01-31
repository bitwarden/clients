import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { DeleteManagedMemberWarningService } from "./delete-managed-member-warning.service";

describe("Delete managed member warning service", () => {
  const userId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let dialogService: MockProxy<DialogService>;
  let warningService: DeleteManagedMemberWarningService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    dialogService = mock();
    warningService = new DeleteManagedMemberWarningService(stateProvider, dialogService);
  });

  it("warningAcknowledged returns false for ids that have not acknowledged the warning", async () => {
    const id = Utils.newGuid();
    const acknowledged = await firstValueFrom(warningService.warningAcknowledged(id));

    expect(acknowledged).toEqual(false);
  });

  it("warningAcknowledged returns true for ids that have acknowledged the warning", async () => {
    const id1 = Utils.newGuid();
    const id2 = Utils.newGuid();
    const id3 = Utils.newGuid();
    await warningService.acknowledgeWarning(id1);
    await warningService.acknowledgeWarning(id3);

    const acknowledged1 = await firstValueFrom(warningService.warningAcknowledged(id1));
    const acknowledged2 = await firstValueFrom(warningService.warningAcknowledged(id2));
    const acknowledged3 = await firstValueFrom(warningService.warningAcknowledged(id3));

    expect(acknowledged1).toEqual(true);
    expect(acknowledged2).toEqual(false);
    expect(acknowledged3).toEqual(true);
  });
});
