import { MockProxy, mock } from "jest-mock-extended";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";

import { ModalService } from "../../services/modal.service";

import { PasswordRepromptService } from "./password-reprompt.service";

describe("PasswordRepromptService", () => {
  let passwordRepromptService: PasswordRepromptService;

  let userVerificationService: MockProxy<UserVerificationService>;
  let modalService: MockProxy<ModalService>;

  beforeEach(() => {
    modalService = mock<ModalService>();
    userVerificationService = mock<UserVerificationService>();

    passwordRepromptService = new PasswordRepromptService(modalService, userVerificationService);
  });

  describe("enabled()", () => {
    it("returns false if a user does not have a master password", async () => {
      userVerificationService.hasMasterPasswordAndMasterKeyHash.mockResolvedValue(false);

      expect(await passwordRepromptService.enabled()).toBe(false);
    });
    it("returns true if the user has a master password", async () => {
      userVerificationService.hasMasterPasswordAndMasterKeyHash.mockResolvedValue(true);

      expect(await passwordRepromptService.enabled()).toBe(true);
    });
  });
});
