import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";
import * as rxjs from "rxjs";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { KeyGenerationService } from "../../../platform/abstractions/key-generation.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";

import { MasterPasswordService } from "./master-password.service";

describe("MasterPasswordService", () => {
  let sut: MasterPasswordService;

  let stateProvider: MockProxy<StateProvider>;
  let stateService: MockProxy<StateService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;

  const userId = "user-id" as UserId;
  const mockUserState = {
    state$: of(null),
    update: jest.fn().mockResolvedValue(null),
  };

  beforeEach(() => {
    stateProvider = mock<StateProvider>();
    stateService = mock<StateService>();
    keyGenerationService = mock<KeyGenerationService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();

    stateProvider.getUser.mockReturnValue(mockUserState as any);

    mockUserState.update.mockReset();

    sut = new MasterPasswordService(
      stateProvider,
      stateService,
      keyGenerationService,
      encryptService,
      logService,
    );
  });

  describe("setForceSetPasswordReason", () => {
    it("calls stateProvider with the provided reason and user ID", async () => {
      const reason = ForceSetPasswordReason.WeakMasterPassword;

      await sut.setForceSetPasswordReason(reason, userId);

      expect(stateProvider.getUser).toHaveBeenCalled();
      expect(mockUserState.update).toHaveBeenCalled();

      // Call the update function to verify it returns the correct reason
      const updateFn = mockUserState.update.mock.calls[0][0];
      expect(updateFn(null)).toBe(reason);
    });

    it("throws an error if reason is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(null as unknown as ForceSetPasswordReason, userId),
      ).rejects.toThrow("Reason is required.");
    });

    it("throws an error if user ID is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(ForceSetPasswordReason.None, null as unknown as UserId),
      ).rejects.toThrow("User ID is required.");
    });

    it("does not overwrite AdminForcePasswordReset with other reasons except None", async () => {
      jest
        .spyOn(sut, "forceSetPasswordReason$")
        .mockReturnValue(of(ForceSetPasswordReason.AdminForcePasswordReset));

      jest
        .spyOn(rxjs, "firstValueFrom")
        .mockResolvedValue(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.WeakMasterPassword, userId);

      expect(mockUserState.update).not.toHaveBeenCalled();
    });

    it("allows overwriting AdminForcePasswordReset with None", async () => {
      jest
        .spyOn(sut, "forceSetPasswordReason$")
        .mockReturnValue(of(ForceSetPasswordReason.AdminForcePasswordReset));

      jest
        .spyOn(rxjs, "firstValueFrom")
        .mockResolvedValue(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

      expect(mockUserState.update).toHaveBeenCalled();
    });
  });
});
