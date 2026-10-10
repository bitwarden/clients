import { TestBed } from "@angular/core/testing";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";

import { PinnedSharedFoldersService } from "./pinned-shared-folders.service";

const userId = Utils.newGuid() as UserId;
const otherUserId = Utils.newGuid() as UserId;
const folderA = Utils.newGuid() as CollectionId;
const folderB = Utils.newGuid() as CollectionId;

describe("PinnedSharedFoldersService", () => {
  let service: PinnedSharedFoldersService;

  beforeEach(() => {
    const accountService: FakeAccountService = mockAccountServiceWith(userId);
    const stateProvider = new FakeStateProvider(accountService);

    TestBed.configureTestingModule({
      providers: [PinnedSharedFoldersService, { provide: StateProvider, useValue: stateProvider }],
    });

    service = TestBed.inject(PinnedSharedFoldersService);
  });

  it("starts with no pins and the empty state not dismissed", async () => {
    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([]);
    expect(await firstValueFrom(service.emptyStateDismissed$(userId))).toBe(false);
  });

  it("pins folders in the order they were pinned", async () => {
    await service.pin(userId, folderB);
    await service.pin(userId, folderA);

    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([folderB, folderA]);
  });

  it("does not pin the same folder twice", async () => {
    await service.pin(userId, folderA);
    await service.pin(userId, folderA);

    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([folderA]);
  });

  it("dismisses the empty state when a folder is first pinned", async () => {
    await service.pin(userId, folderA);

    expect(await firstValueFrom(service.emptyStateDismissed$(userId))).toBe(true);
  });

  it("unpins only the given folder", async () => {
    await service.pin(userId, folderA);
    await service.pin(userId, folderB);

    await service.unpin(userId, folderA);

    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([folderB]);
  });

  it("does nothing when unpinning a folder that is not pinned", async () => {
    await service.pin(userId, folderA);

    await service.unpin(userId, folderB);

    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([folderA]);
  });

  it("keeps the empty state dismissed after the last folder is unpinned", async () => {
    await service.pin(userId, folderA);
    await service.unpin(userId, folderA);

    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([]);
    expect(await firstValueFrom(service.emptyStateDismissed$(userId))).toBe(true);
  });

  it("dismisses the empty state without pinning anything", async () => {
    await service.dismissEmptyState(userId);

    expect(await firstValueFrom(service.emptyStateDismissed$(userId))).toBe(true);
    expect(await firstValueFrom(service.pinnedIds$(userId))).toEqual([]);
  });

  it("keeps each user's pins separate", async () => {
    await service.pin(userId, folderA);

    expect(await firstValueFrom(service.pinnedIds$(otherUserId))).toEqual([]);
    expect(await firstValueFrom(service.emptyStateDismissed$(otherUserId))).toBe(false);
  });
});
