import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import {
  CipherService,
  EncryptionContext,
  RestrictedCipherWriteError,
} from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { CipherType } from "@bitwarden/sdk-internal";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";

import { DefaultCipherFormService } from "./default-cipher-form.service";

describe("DefaultCipherFormService", () => {
  let service: DefaultCipherFormService;
  let testBed: TestBed;
  const cipherServiceMock = mock<CipherService>();
  const revealedCipherServiceMock = mock<RevealedCipherService>();

  let markAsCompleteMock: jest.Mock;
  let pendingTasks$: jest.Mock;

  beforeEach(() => {
    markAsCompleteMock = jest.fn().mockResolvedValue(undefined);
    pendingTasks$ = jest.fn().mockReturnValue(of([]));
    cipherServiceMock.encrypt.mockResolvedValue({} as EncryptionContext);

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: TaskService, useValue: { markAsComplete: markAsCompleteMock, pendingTasks$ } },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" as UserId } as Account) },
        },
        { provide: RevealedCipherService, useValue: revealedCipherServiceMock },
        DefaultCipherFormService,
      ],
    });

    service = testBed.inject(DefaultCipherFormService);
  });

  describe("markAssociatedTaskAsComplete", () => {
    it("does not call markAsComplete when the cipher is not a login", async () => {
      pendingTasks$.mockReturnValueOnce(
        of([
          {
            type: SecurityTaskType.UpdateAtRiskCredential,
            cipherId: "cipher-1",
            userId: "user-1" as UserId,
          },
        ]),
      );

      const cardCipher = new CipherView();
      cardCipher.type = CipherType.Card;
      cardCipher.id = "cipher-1";

      await service.saveCipher(cardCipher, {
        originalCipher: new Cipher(),
        admin: false,
      } as CipherFormConfig);

      expect(markAsCompleteMock).not.toHaveBeenCalled();
    });

    it("does not call markAsComplete when there is no associated credential tasks", async () => {
      pendingTasks$.mockReturnValueOnce(of([]));

      const originalCipher = new Cipher();
      originalCipher.type = CipherType.Login;

      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.id = "cipher-1";
      cipher.login = new LoginView();
      cipher.login.password = "password123";

      cipherServiceMock.decrypt.mockResolvedValue({
        ...cipher,
        login: {
          ...cipher.login,
          password: "newPassword123",
        },
      } as CipherView);

      await service.saveCipher(cipher, {
        originalCipher: originalCipher,
        admin: false,
      } as CipherFormConfig);

      expect(markAsCompleteMock).not.toHaveBeenCalled();
    });

    it("does not call markAsComplete when the password has not changed", async () => {
      pendingTasks$.mockReturnValueOnce(
        of([
          {
            type: SecurityTaskType.UpdateAtRiskCredential,
            cipherId: "cipher-1",
            userId: "user-1" as UserId,
          },
        ]),
      );

      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.id = "cipher-1";
      cipher.login = new LoginView();
      cipher.login.password = "password123";

      cipherServiceMock.decrypt.mockResolvedValue(cipher);

      await service.saveCipher(cipher, {
        originalCipher: new Cipher(),
        admin: false,
      } as CipherFormConfig);

      expect(markAsCompleteMock).not.toHaveBeenCalled();
    });

    it("calls markAsComplete when the cipher password has changed and there is an associated credential task", async () => {
      pendingTasks$.mockReturnValueOnce(
        of([
          {
            type: SecurityTaskType.UpdateAtRiskCredential,
            cipherId: "cipher-1",
            userId: "user-1" as UserId,
          },
        ]),
      );

      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.id = "cipher-1";
      cipher.login = new LoginView();
      cipher.login.password = "password123";

      cipherServiceMock.decrypt.mockResolvedValue({
        ...cipher,
        login: {
          ...cipher.login,
          password: "newPassword123",
        },
      } as CipherView);

      await service.saveCipher(cipher, {
        originalCipher: new Cipher(),
        admin: false,
      } as CipherFormConfig);

      expect(markAsCompleteMock).toHaveBeenCalled();
    });
  });

  describe("restricted ciphers", () => {
    const cipherId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as CipherId;

    const restrictedCipher = () => {
      const cipher = new Cipher();
      cipher.id = cipherId;
      cipher.type = CipherType.Login;
      cipher.partialData = "{}";
      return cipher;
    };

    const revealedView = (password: string) => {
      const view = new CipherView();
      view.id = cipherId;
      view.type = CipherType.Login;
      view.login = new LoginView();
      view.login.password = password;
      return view;
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("decrypts to a copy of the revealed view", async () => {
      const revealed = revealedView("secret");
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealed);

      const result = await service.decryptCipher(restrictedCipher());

      expect(revealedCipherServiceMock.getOrReveal).toHaveBeenCalledWith("user-1", cipherId);
      expect(result).not.toBe(revealed);
      expect(result.login.password).toBe("secret");
      expect(cipherServiceMock.decrypt).not.toHaveBeenCalled();
    });

    it("decrypts the stored copy when nothing is revealed", async () => {
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(null);
      const cipher = restrictedCipher();

      await service.decryptCipher(cipher);

      expect(cipherServiceMock.decrypt).toHaveBeenCalledWith(cipher, "user-1");
    });

    it("passes the revealed copy as the original of a restricted cipher's save", async () => {
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealedView("secret"));

      await service.saveCipher(revealedView("secret"), {
        originalCipher: restrictedCipher(),
        admin: false,
      } as CipherFormConfig);

      expect(cipherServiceMock.updateWithServer).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        expect.objectContaining({ id: cipherId, partial: false }),
        false,
      );
    });

    it("returns the saved view without an encrypt and decrypt round trip", async () => {
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealedView("secret"));
      const saved = new CipherView();
      cipherServiceMock.updateWithServer.mockResolvedValue(saved);

      const result = await service.saveCipher(revealedView("secret"), {
        originalCipher: restrictedCipher(),
        admin: false,
      } as CipherFormConfig);

      expect(result).toBe(saved);
      expect(cipherServiceMock.encrypt).not.toHaveBeenCalled();
      expect(cipherServiceMock.decrypt).not.toHaveBeenCalled();
    });

    it("refuses a collection change on a restricted cipher before any write", async () => {
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealedView("secret"));
      const original = restrictedCipher();
      original.organizationId = "org-1";
      original.collectionIds = ["collection-1"];
      const cipher = revealedView("secret");
      cipher.organizationId = "org-1";
      cipher.collectionIds = ["collection-2"];

      await expect(
        service.saveCipher(cipher, { originalCipher: original, admin: false } as CipherFormConfig),
      ).rejects.toThrow(RestrictedCipherWriteError);

      expect(cipherServiceMock.updateWithServer).not.toHaveBeenCalled();
      expect(cipherServiceMock.saveCollectionsWithServer).not.toHaveBeenCalled();
      expect(cipherServiceMock.saveCollectionsWithServerAdmin).not.toHaveBeenCalled();
    });

    it.each([
      ["unchanged", "old-password", false],
      ["changed", "new-password", true],
    ])(
      "compares the at-risk password against the revealed view (%s)",
      async (_, newPassword, completed) => {
        pendingTasks$.mockReturnValueOnce(
          of([
            {
              id: "task-1",
              type: SecurityTaskType.UpdateAtRiskCredential,
              cipherId,
              userId: "user-1" as UserId,
            },
          ]),
        );
        revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealedView("old-password"));

        await service.saveCipher(revealedView(newPassword), {
          originalCipher: restrictedCipher(),
          admin: false,
        } as CipherFormConfig);

        expect(markAsCompleteMock).toHaveBeenCalledTimes(completed ? 1 : 0);
      },
    );
  });
});
