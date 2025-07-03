import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  CipherService,
  EncryptionContext,
} from "@bitwarden/common/vault/abstractions/cipher.service";
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
});
