import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { DefaultKdfConfigService } from "./kdf-config.service";

describe("KdfConfigService", () => {
  let sutKdfConfigService: DefaultKdfConfigService;

  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let unlockData$: BehaviorSubject<MasterPasswordUnlockData | null>;
  const mockUserId = Utils.newGuid() as UserId;

  const unlockDataWith = (kdf: KdfConfig) =>
    new MasterPasswordUnlockData(
      "salt" as MasterPasswordSalt,
      kdf,
      "wrapped-user-key" as MasterKeyWrappedUserKey,
    );

  beforeEach(() => {
    unlockData$ = new BehaviorSubject<MasterPasswordUnlockData | null>(null);
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(unlockData$);
    sutKdfConfigService = new DefaultKdfConfigService(masterPasswordService);
  });

  describe("getKdfConfig$", () => {
    it("emits null when the user has no master-password unlock data", async () => {
      await expect(
        firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId)),
      ).resolves.toBeNull();
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
    });

    it("emits the KDF config from the master-password unlock data", async () => {
      const kdfConfig = new PBKDF2KdfConfig(500_000);
      unlockData$.next(unlockDataWith(kdfConfig));

      await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
        kdfConfig,
      );
    });

    it("emits the new KDF config when the unlock data changes", async () => {
      unlockData$.next(unlockDataWith(new PBKDF2KdfConfig(500_000)));
      const kdfConfigChanged = new PBKDF2KdfConfig(500_001);
      unlockData$.next(unlockDataWith(kdfConfigChanged));

      await expect(firstValueFrom(sutKdfConfigService.getKdfConfig$(mockUserId))).resolves.toEqual(
        kdfConfigChanged,
      );
    });

    it("throws when userId is null", () => {
      expect(() => sutKdfConfigService.getKdfConfig$(null as unknown as UserId)).toThrow(
        "userId cannot be null",
      );
    });
  });
});
