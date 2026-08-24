import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { DaemonRegisterRequest } from "../requests/daemon-register.request";
import { DaemonRegistrationResponse } from "../responses/daemon-registration.response";
import { RotationApiService } from "../rotation-api.service";

import { DaemonRegistrationService } from "./daemon-registration.service";

describe("DaemonRegistrationService", () => {
  const orgId = "org-1" as OrganizationId;

  // Stable fake key material
  const fakeKeyMaterial = new Uint8Array(16).fill(42);
  const fakeDerivedKey = {
    keyB64: "derivedKeyB64==",
  } as unknown as SymmetricCryptoKey;

  const fakeCreatedKey = {
    material: fakeKeyMaterial,
    derivedKey: fakeDerivedKey,
  };

  const fakeOrgKey = {
    keyB64: "orgKeyB64==",
  } as unknown as SymmetricCryptoKey;

  const fakeEncryptedPayload = { toString: () => "enc-payload" } as unknown as EncString;
  const fakeWrappedKey = { toString: () => "enc-wrapped-key" } as unknown as EncString;

  const fakeDaemonResponse = {
    id: "daemon-id",
    apiKeyId: "api-key-id",
    clientSecret: "super-secret",
  } as unknown as DaemonRegistrationResponse;

  let service: DaemonRegistrationService;
  let keyGenerationService: jest.Mocked<KeyGenerationService>;
  let encryptService: jest.Mocked<EncryptService>;
  let rotationApiService: jest.Mocked<RotationApiService>;
  let keyService: jest.Mocked<KeyService>;
  let accountService: jest.Mocked<AccountService>;

  beforeEach(() => {
    keyGenerationService = {
      createKeyWithPurpose: jest.fn().mockResolvedValue(fakeCreatedKey),
    } as unknown as jest.Mocked<KeyGenerationService>;

    encryptService = {
      encryptString: jest
        .fn()
        .mockResolvedValueOnce(fakeEncryptedPayload)
        .mockResolvedValueOnce(fakeWrappedKey),
    } as unknown as jest.Mocked<EncryptService>;

    rotationApiService = {
      registerRotationDaemon: jest.fn().mockResolvedValue(fakeDaemonResponse),
    } as unknown as jest.Mocked<RotationApiService>;

    keyService = {
      orgKeys$: jest.fn().mockReturnValue(of({ [orgId]: fakeOrgKey })),
    } as unknown as jest.Mocked<KeyService>;

    accountService = {
      activeAccount$: of({ id: "user-1" }),
    } as unknown as jest.Mocked<AccountService>;

    TestBed.configureTestingModule({
      providers: [
        DaemonRegistrationService,
        { provide: KeyGenerationService, useValue: keyGenerationService },
        { provide: EncryptService, useValue: encryptService },
        { provide: RotationApiService, useValue: rotationApiService },
        { provide: KeyService, useValue: keyService },
        { provide: AccountService, useValue: accountService },
      ],
    });

    service = TestBed.inject(DaemonRegistrationService);
  });

  it("creates a key with the correct purpose and salt", async () => {
    await service.register(orgId, "my-daemon");

    expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalledWith(
      128,
      "pam-rotation-daemon",
      "bitwarden-accesstoken",
    );
  });

  it("encrypts the org key as the payload using the derived key first", async () => {
    await service.register(orgId, "my-daemon");

    expect(encryptService.encryptString).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ encryptionKey: fakeOrgKey.keyB64 }),
      fakeDerivedKey,
    );
  });

  it("wraps the derived key with the org key second", async () => {
    await service.register(orgId, "my-daemon");

    expect(encryptService.encryptString).toHaveBeenNthCalledWith(
      2,
      fakeDerivedKey.keyB64,
      fakeOrgKey,
    );
  });

  it("sends the daemon name as plaintext on the register request", async () => {
    await service.register(orgId, "my-daemon");

    const [[, requestArg]] = (rotationApiService.registerRotationDaemon as jest.Mock).mock.calls;
    expect(requestArg).toBeInstanceOf(DaemonRegisterRequest);
    expect((requestArg as DaemonRegisterRequest).name).toBe("my-daemon");
  });

  it("returns the exact token format 0.daemon.{apiKeyId}.{clientSecret}:{keyMaterialBase64}", async () => {
    const { token } = await service.register(orgId, "my-daemon");

    const expectedBase64 = Utils.fromBufferToB64(fakeKeyMaterial);
    expect(token).toBe(
      `0.daemon.${fakeDaemonResponse.apiKeyId}.${fakeDaemonResponse.clientSecret}:${expectedBase64}`,
    );
  });

  it("returns the registration response alongside the token", async () => {
    const { daemon } = await service.register(orgId, "my-daemon");

    expect(daemon).toBe(fakeDaemonResponse);
  });
});
