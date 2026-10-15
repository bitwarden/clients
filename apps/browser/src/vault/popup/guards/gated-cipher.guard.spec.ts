import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { gatedCipherGuard } from "./gated-cipher.guard";

describe("gatedCipherGuard", () => {
  const userId = "user-id" as UserId;
  const cipherService = mock<CipherService>();
  const createUrlTree = jest.fn().mockReturnValue(new UrlTree());

  const runGuard = (queryParams: Record<string, string>) =>
    TestBed.runInInjectionContext(() =>
      gatedCipherGuard(
        { queryParams } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  beforeEach(() => {
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: CipherService, useValue: cipherService },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
  });

  it("allows a stored item that is not partial", async () => {
    cipherService.get.mockResolvedValue({ isPartial: false } as Cipher);

    await expect(runGuard({ cipherId: "cipher-1", type: "1" })).resolves.toBe(true);
    expect(cipherService.get).toHaveBeenCalledWith("cipher-1", userId);
  });

  it("redirects a partial item to its view, keeping the id and type", async () => {
    cipherService.get.mockResolvedValue({ isPartial: true } as Cipher);

    const result = await runGuard({ cipherId: "cipher-1", type: "1" });

    expect(createUrlTree).toHaveBeenCalledWith(["/view-cipher"], {
      queryParams: { cipherId: "cipher-1", type: "1" },
    });
    expect(result).toBeInstanceOf(UrlTree);
  });

  it("allows a route without a cipher id", async () => {
    await expect(runGuard({})).resolves.toBe(true);
    expect(cipherService.get).not.toHaveBeenCalled();
  });
});
