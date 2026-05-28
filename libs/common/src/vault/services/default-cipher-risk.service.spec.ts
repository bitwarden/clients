import { mock } from "jest-mock-extended";
import { BehaviorSubject, lastValueFrom, Observable } from "rxjs";

import type { CipherRiskOptions, CipherRiskResult } from "@bitwarden/sdk-internal";

import { AuditService } from "../../abstractions/audit.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { MockSdkService } from "../../platform/spec/mock-sdk.service";
import { UserId, CipherId } from "../../types/guid";
import {
  PersonalVaultRiskProgress,
  PersonalVaultRiskUpdate,
} from "../abstractions/cipher-risk.service";
import { CipherService } from "../abstractions/cipher.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { LoginView } from "../models/view/login.view";

import { DefaultCipherRiskService } from "./default-cipher-risk.service";

describe("DefaultCipherRiskService", () => {
  let cipherRiskService: DefaultCipherRiskService;
  let sdkService: MockSdkService;
  let mockCipherService: jest.Mocked<CipherService>;
  let mockAuditService: jest.Mocked<AuditService>;

  const mockUserId = "test-user-id" as UserId;
  const mockCipherId1 = "cbea34a8-bde4-46ad-9d19-b05001228ab2" as CipherId;
  const mockCipherId2 = "cbea34a8-bde4-46ad-9d19-b05001228ab3" as CipherId;
  const mockCipherId3 = "cbea34a8-bde4-46ad-9d19-b05001228ab4" as CipherId;

  beforeEach(() => {
    sdkService = new MockSdkService();
    mockCipherService = mock<CipherService>();
    mockAuditService = mock<AuditService>();
    cipherRiskService = new DefaultCipherRiskService(
      sdkService,
      mockCipherService,
      mockAuditService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("computeRiskForCiphers", () => {
    it("should call SDK cipher_risk().compute_risk() with correct parameters", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockRiskResults: CipherRiskResult[] = [
        {
          id: mockCipherId1 as any,
          password_strength: 3,
          exposed_result: { type: "NotChecked" },
          reuse_count: undefined,
        },
      ];

      mockCipherRiskClient.compute_risk.mockResolvedValue(mockRiskResults);

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "test-password";
      cipher.login.username = "test@example.com";

      const options: CipherRiskOptions = {
        checkExposed: true,
        passwordMap: undefined,
        hibpBaseUrl: undefined,
      };

      const results = await cipherRiskService.computeRiskForCiphers([cipher], mockUserId, options);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          {
            id: expect.anything(),
            password: "test-password",
            username: "test@example.com",
          },
        ],
        options,
      );
      expect(results).toEqual(mockRiskResults);
    });

    it("should filter out non-Login ciphers", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);

      const loginCipher = new CipherView();
      loginCipher.id = mockCipherId1;
      loginCipher.type = CipherType.Login;
      loginCipher.login = new LoginView();
      loginCipher.login.password = "password1";

      const cardCipher = new CipherView();
      cardCipher.id = mockCipherId2;
      cardCipher.type = CipherType.Card;

      const identityCipher = new CipherView();
      identityCipher.id = mockCipherId3;
      identityCipher.type = CipherType.Identity;

      await cipherRiskService.computeRiskForCiphers(
        [loginCipher, cardCipher, identityCipher],
        mockUserId,
      );

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: expect.anything(),
            password: "password1",
          }),
        ],
        expect.any(Object),
      );
    });

    it("should filter out Login ciphers without passwords", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);

      const cipherWithPassword = new CipherView();
      cipherWithPassword.id = mockCipherId1;
      cipherWithPassword.type = CipherType.Login;
      cipherWithPassword.login = new LoginView();
      cipherWithPassword.login.password = "password1";

      const cipherWithoutPassword = new CipherView();
      cipherWithoutPassword.id = mockCipherId2;
      cipherWithoutPassword.type = CipherType.Login;
      cipherWithoutPassword.login = new LoginView();
      cipherWithoutPassword.login.password = undefined;

      const cipherWithEmptyPassword = new CipherView();
      cipherWithEmptyPassword.id = mockCipherId3;
      cipherWithEmptyPassword.type = CipherType.Login;
      cipherWithEmptyPassword.login = new LoginView();
      cipherWithEmptyPassword.login.password = "";

      await cipherRiskService.computeRiskForCiphers(
        [cipherWithPassword, cipherWithoutPassword, cipherWithEmptyPassword],
        mockUserId,
      );

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            password: "password1",
          }),
        ],
        expect.any(Object),
      );
    });

    it("should return empty array when no valid Login ciphers provided", async () => {
      const cardCipher = new CipherView();
      cardCipher.type = CipherType.Card;

      const results = await cipherRiskService.computeRiskForCiphers([cardCipher], mockUserId);

      expect(results).toEqual([]);
    });

    it("should handle multiple Login ciphers", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockRiskResults: CipherRiskResult[] = [
        {
          id: mockCipherId1 as any,
          password_strength: 3,
          exposed_result: { type: "Found", value: 5 },
          reuse_count: 2,
        },
        {
          id: mockCipherId2 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ];

      mockCipherRiskClient.compute_risk.mockResolvedValue(mockRiskResults);

      const cipher1 = new CipherView();
      cipher1.id = mockCipherId1;
      cipher1.type = CipherType.Login;
      cipher1.login = new LoginView();
      cipher1.login.password = "password1";
      cipher1.login.username = "user1@example.com";

      const cipher2 = new CipherView();
      cipher2.id = mockCipherId2;
      cipher2.type = CipherType.Login;
      cipher2.login = new LoginView();
      cipher2.login.password = "password2";
      cipher2.login.username = "user2@example.com";

      const results = await cipherRiskService.computeRiskForCiphers([cipher1, cipher2], mockUserId);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          expect.objectContaining({ password: "password1", username: "user1@example.com" }),
          expect.objectContaining({ password: "password2", username: "user2@example.com" }),
        ],
        expect.any(Object),
      );
      expect(results).toEqual(mockRiskResults);
    });

    it("should use default options when options not provided", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "test-password";

      await cipherRiskService.computeRiskForCiphers([cipher], mockUserId);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(expect.any(Array), {
        checkExposed: false,
        passwordMap: undefined,
        hibpBaseUrl: undefined,
      });
    });

    it("should handle ciphers without username", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "test-password";
      cipher.login.username = undefined;

      await cipherRiskService.computeRiskForCiphers([cipher], mockUserId);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            password: "test-password",
            username: undefined,
          }),
        ],
        expect.any(Object),
      );
    });

    it("should filter out deleted Login ciphers", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);

      const activeCipher = new CipherView();
      activeCipher.id = mockCipherId1;
      activeCipher.type = CipherType.Login;
      activeCipher.login = new LoginView();
      activeCipher.login.password = "password1";
      activeCipher.deletedDate = undefined;

      const deletedCipher = new CipherView();
      deletedCipher.id = mockCipherId2;
      deletedCipher.type = CipherType.Login;
      deletedCipher.login = new LoginView();
      deletedCipher.login.password = "password2";
      deletedCipher.deletedDate = new Date();

      await cipherRiskService.computeRiskForCiphers([activeCipher, deletedCipher], mockUserId);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: expect.anything(),
            password: "password1",
          }),
        ],
        expect.any(Object),
      );
    });
  });

  describe("buildPasswordReuseMap", () => {
    it("should call SDK cipher_risk().password_reuse_map() with correct parameters", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockReuseMap = {
        password1: 2,
        password2: 1,
      };

      mockCipherRiskClient.password_reuse_map.mockReturnValue(mockReuseMap);

      const cipher1 = new CipherView();
      cipher1.id = mockCipherId1;
      cipher1.type = CipherType.Login;
      cipher1.login = new LoginView();
      cipher1.login.password = "password1";

      const cipher2 = new CipherView();
      cipher2.id = mockCipherId2;
      cipher2.type = CipherType.Login;
      cipher2.login = new LoginView();
      cipher2.login.password = "password2";

      const result = await cipherRiskService.buildPasswordReuseMap([cipher1, cipher2], mockUserId);

      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
        expect.objectContaining({ password: "password2" }),
      ]);
      expect(result).toEqual(mockReuseMap);
    });

    it("should exclude deleted ciphers when building password reuse map", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockReuseMap = {
        password1: 1,
      };

      mockCipherRiskClient.password_reuse_map.mockReturnValue(mockReuseMap);

      const activeCipher = new CipherView();
      activeCipher.id = mockCipherId1;
      activeCipher.type = CipherType.Login;
      activeCipher.login = new LoginView();
      activeCipher.login.password = "password1";
      activeCipher.deletedDate = undefined;

      const deletedCipherWithSamePassword = new CipherView();
      deletedCipherWithSamePassword.id = mockCipherId2;
      deletedCipherWithSamePassword.type = CipherType.Login;
      deletedCipherWithSamePassword.login = new LoginView();
      deletedCipherWithSamePassword.login.password = "password1";
      deletedCipherWithSamePassword.deletedDate = new Date();

      const result = await cipherRiskService.buildPasswordReuseMap(
        [activeCipher, deletedCipherWithSamePassword],
        mockUserId,
      );

      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
      ]);
      expect(result).toEqual(mockReuseMap);
    });
  });

  describe("computeCipherRiskForUser", () => {
    it("should compute risk for a single cipher with password reuse map", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      // Setup cipher data
      const cipher1 = new CipherView();
      cipher1.id = mockCipherId1;
      cipher1.type = CipherType.Login;
      cipher1.login = new LoginView();
      cipher1.login.password = "password1";
      cipher1.login.username = "user1@example.com";

      const cipher2 = new CipherView();
      cipher2.id = mockCipherId2;
      cipher2.type = CipherType.Login;
      cipher2.login = new LoginView();
      cipher2.login.password = "password1"; // Same password as cipher1
      cipher2.login.username = "user2@example.com";

      const allCiphers = [cipher1, cipher2];

      // Mock cipherViews$ observable
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject(allCiphers));

      // Mock password reuse map
      const mockReuseMap = { password1: 2 };
      mockCipherRiskClient.password_reuse_map.mockReturnValue(mockReuseMap);

      // Mock compute_risk result
      const mockRiskResult: CipherRiskResult = {
        id: mockCipherId1 as any,
        password_strength: 3,
        exposed_result: { type: "NotChecked" },
        reuse_count: 2,
      };
      mockCipherRiskClient.compute_risk.mockResolvedValue([mockRiskResult]);

      const result = await cipherRiskService.computeCipherRiskForUser(
        asUuid<CipherId>(mockCipherId1),
        mockUserId,
        true,
      );

      // Verify cipherViews$ was called
      expect(mockCipherService.cipherViews$).toHaveBeenCalledWith(mockUserId);

      // Verify password_reuse_map was called with all ciphers
      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1", username: "user1@example.com" }),
        expect.objectContaining({ password: "password1", username: "user2@example.com" }),
      ]);

      // Verify compute_risk was called with target cipher and password map
      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [expect.objectContaining({ password: "password1", username: "user1@example.com" })],
        {
          passwordMap: mockReuseMap,
          checkExposed: true,
        },
      );

      expect(result).toEqual(mockRiskResult);
    });

    it("should throw error when cipher is not found", async () => {
      const cipher1 = new CipherView();
      cipher1.id = mockCipherId1;
      cipher1.type = CipherType.Login;
      cipher1.login = new LoginView();
      cipher1.login.password = "password1";

      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([cipher1]));

      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(
        cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(nonExistentId), mockUserId),
      ).rejects.toThrow(`Cipher with id ${asUuid<CipherId>(nonExistentId)} not found`);
    });

    it("should use checkExposed parameter correctly", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "password1";

      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([cipher]));
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ]);

      await cipherRiskService.computeCipherRiskForUser(
        asUuid<CipherId>(mockCipherId1),
        mockUserId,
        false,
      );

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(expect.any(Array), {
        passwordMap: expect.any(Object),
        checkExposed: false,
      });
    });

    it("should default checkExposed to true when not provided", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "password1";

      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([cipher]));
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "Found", value: 10 },
          reuse_count: 1,
        },
      ]);

      await cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(mockCipherId1), mockUserId);

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(expect.any(Array), {
        passwordMap: expect.any(Object),
        checkExposed: true,
      });
    });

    it("should handle ciphers without passwords when building password map", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const cipherWithPassword = new CipherView();
      cipherWithPassword.id = mockCipherId1;
      cipherWithPassword.type = CipherType.Login;
      cipherWithPassword.login = new LoginView();
      cipherWithPassword.login.password = "password1";

      const cipherWithoutPassword = new CipherView();
      cipherWithoutPassword.id = mockCipherId2;
      cipherWithoutPassword.type = CipherType.Login;
      cipherWithoutPassword.login = new LoginView();
      cipherWithoutPassword.login.password = "";

      mockCipherService.cipherViews$.mockReturnValue(
        new BehaviorSubject([cipherWithPassword, cipherWithoutPassword]),
      );
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ]);

      await cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(mockCipherId1), mockUserId);

      // Verify password_reuse_map only received cipher with password
      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
      ]);
    });

    it("should handle non-Login ciphers in vault when building password map", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const loginCipher = new CipherView();
      loginCipher.id = mockCipherId1;
      loginCipher.type = CipherType.Login;
      loginCipher.login = new LoginView();
      loginCipher.login.password = "password1";

      const cardCipher = new CipherView();
      cardCipher.id = mockCipherId2;
      cardCipher.type = CipherType.Card;

      const noteCipher = new CipherView();
      noteCipher.id = mockCipherId3;
      noteCipher.type = CipherType.SecureNote;

      mockCipherService.cipherViews$.mockReturnValue(
        new BehaviorSubject([loginCipher, cardCipher, noteCipher]),
      );
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ]);

      await cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(mockCipherId1), mockUserId);

      // Verify password_reuse_map only received Login cipher
      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
      ]);
    });

    it("should compute fresh password map on each call", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "password1";

      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([cipher]));
      mockCipherRiskClient.password_reuse_map.mockReturnValue({ password1: 1 });
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ]);

      // First call
      await cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(mockCipherId1), mockUserId);

      // Second call
      await cipherRiskService.computeCipherRiskForUser(asUuid<CipherId>(mockCipherId1), mockUserId);

      // Verify password_reuse_map was called twice (fresh computation each time)
      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledTimes(2);
    });

    it("should wait for a decrypted vault before computing risk", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const cipher = new CipherView();
      cipher.id = mockCipherId1;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.password = "password1";

      // Simulate the observable emitting null (undecrypted vault) first, then the decrypted ciphers
      const cipherViewsSubject = new BehaviorSubject<CipherView[] | null>(null);
      mockCipherService.cipherViews$.mockReturnValue(
        cipherViewsSubject as Observable<CipherView[]>,
      );

      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        {
          id: mockCipherId1 as any,
          password_strength: 4,
          exposed_result: { type: "NotChecked" },
          reuse_count: 1,
        },
      ]);

      // Initiate the async call but don't await yet
      const computePromise = cipherRiskService.computeCipherRiskForUser(
        asUuid<CipherId>(mockCipherId1),
        mockUserId,
        true,
      );

      // Simulate a tick to allow the service to process the null emission
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now emit the actual decrypted ciphers
      cipherViewsSubject.next([cipher]);

      const result = await computePromise;

      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [expect.objectContaining({ password: "password1" })],
        {
          passwordMap: expect.any(Object),
          checkExposed: true,
        },
      );
      expect(result).toEqual(expect.objectContaining({ id: expect.anything() }));
    });
  });

  describe("computeRiskForPersonalVault", () => {
    let mockCipherRiskClient: any;

    function makeLoginCipher(
      id: string,
      password: string,
      opts: Partial<CipherView> = {},
    ): CipherView {
      const c = new CipherView();
      c.id = id;
      c.type = CipherType.Login;
      c.login = new LoginView();
      c.login.password = password;
      Object.assign(c, opts);
      return c;
    }

    function makeRiskResult(id: string, opts: Partial<CipherRiskResult>): CipherRiskResult {
      return {
        id: id as any,
        password_strength: 4,
        exposed_result: { type: "NotChecked" },
        reuse_count: 1,
        ...opts,
      };
    }

    beforeEach(() => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});
      mockCipherRiskClient.compute_risk.mockResolvedValue([]);
      mockAuditService.passwordLeaked.mockResolvedValue(0);
    });

    it("filters down to non-org, non-deleted Login ciphers with a password", async () => {
      const valid = makeLoginCipher(mockCipherId1, "pw");
      const card = new CipherView();
      card.id = mockCipherId2;
      card.type = CipherType.Card;
      const orgLogin = makeLoginCipher(mockCipherId3, "pw", {
        organizationId: "org-1" as any,
      });
      const deletedLogin = makeLoginCipher("00000000-0000-0000-0000-000000000004", "pw", {
        deletedDate: new Date(),
      });
      const noPassword = makeLoginCipher("00000000-0000-0000-0000-000000000005", "");

      mockCipherService.cipherViews$.mockReturnValue(
        new BehaviorSubject([valid, card, orgLogin, deletedLogin, noPassword]),
      );

      const updates = await lastValueFrom(
        cipherRiskService.computeRiskForPersonalVault(mockUserId),
      );

      // The SDK should have been asked to compute risk only for `valid`.
      expect(mockCipherRiskClient.compute_risk).toHaveBeenCalledWith(
        [expect.objectContaining({ password: "pw" })],
        expect.any(Object),
      );
      // No exposed/weak/reused — just an empty result.
      expect(updates.type).toBe("result");
    });

    it("emits a result with empty arrays and never calls auditService for an empty vault", async () => {
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([] as CipherView[]));

      const emissions: PersonalVaultRiskUpdate[] = [];
      await new Promise<void>((resolve, reject) => {
        cipherRiskService.computeRiskForPersonalVault(mockUserId).subscribe({
          next: (u) => emissions.push(u),
          complete: resolve,
          error: reject,
        });
      });

      expect(emissions[0]).toMatchObject({ type: "progress", phase: "preparing", percent: 0 });
      expect(emissions).toHaveLength(2);
      const result = emissions[emissions.length - 1] as Extract<
        PersonalVaultRiskUpdate,
        { type: "result" }
      >;
      expect(result.type).toBe("result");
      expect(result.summary.exposed).toEqual([]);
      expect(result.summary.weak).toEqual([]);
      expect(result.summary.reused).toEqual([]);
      expect(result.summary.riskCounts.size).toBe(0);
      expect(mockAuditService.passwordLeaked).not.toHaveBeenCalled();
    });

    it("emits preparing→analyzing→checkingBreaches→result progress events", async () => {
      const c = makeLoginCipher(mockCipherId1, "pw");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([c]));
      mockCipherRiskClient.compute_risk.mockResolvedValue([makeRiskResult(mockCipherId1, {})]);

      const emissions: PersonalVaultRiskUpdate[] = [];
      await new Promise<void>((resolve, reject) => {
        cipherRiskService.computeRiskForPersonalVault(mockUserId).subscribe({
          next: (u) => emissions.push(u),
          complete: resolve,
          error: reject,
        });
      });

      const phases = emissions
        .filter((u): u is PersonalVaultRiskProgress => u.type === "progress")
        .map((u) => u.phase);
      expect(phases[0]).toBe("preparing");
      expect(phases).toContain("analyzing");
      expect(phases).toContain("checkingBreaches");
      expect(emissions[emissions.length - 1].type).toBe("result");
    });

    it("classifies weak passwords (password_strength < 3)", async () => {
      const a = makeLoginCipher(mockCipherId1, "pw");
      const b = makeLoginCipher(mockCipherId2, "pw");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        makeRiskResult(mockCipherId1, { password_strength: 2 }),
        makeRiskResult(mockCipherId2, { password_strength: 4 }),
      ]);

      const result = await lastValueFrom(cipherRiskService.computeRiskForPersonalVault(mockUserId));

      expect(result.type).toBe("result");
      const r = result as Extract<PersonalVaultRiskUpdate, { type: "result" }>;
      expect(r.summary.weak).toEqual([a]);
      expect(r.summary.riskCounts.get(mockCipherId1)?.weak).toBe(true);
      expect(r.summary.riskCounts.has(mockCipherId2)).toBe(false);
    });

    it("classifies reused passwords (reuse_count > 1)", async () => {
      const a = makeLoginCipher(mockCipherId1, "pw");
      const b = makeLoginCipher(mockCipherId2, "pw");
      const c = makeLoginCipher(mockCipherId3, "other");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b, c]));
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        makeRiskResult(mockCipherId1, { reuse_count: 2 }),
        makeRiskResult(mockCipherId2, { reuse_count: 2 }),
        makeRiskResult(mockCipherId3, { reuse_count: 1 }),
      ]);

      const result = (await lastValueFrom(
        cipherRiskService.computeRiskForPersonalVault(mockUserId),
      )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

      expect(result.summary.reused.map((x) => x.id).sort()).toEqual([mockCipherId1, mockCipherId2]);
      expect(result.summary.riskCounts.get(mockCipherId1)?.reuseCount).toBe(2);
    });

    it("adds exposed ciphers when auditService.passwordLeaked > 0", async () => {
      const a = makeLoginCipher(mockCipherId1, "leaked");
      const b = makeLoginCipher(mockCipherId2, "fine");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        makeRiskResult(mockCipherId1, {}),
        makeRiskResult(mockCipherId2, {}),
      ]);
      mockAuditService.passwordLeaked.mockImplementation(async (pw: string) =>
        pw === "leaked" ? 17 : 0,
      );

      const result = (await lastValueFrom(
        cipherRiskService.computeRiskForPersonalVault(mockUserId),
      )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

      expect(result.summary.exposed.map((c) => c.id)).toEqual([mockCipherId1]);
      expect(result.summary.riskCounts.get(mockCipherId1)?.exposedBreaches).toBe(17);
    });

    it("caps concurrent passwordLeaked calls at 5", async () => {
      const ciphers = Array.from({ length: 20 }, (_, i) =>
        makeLoginCipher(
          `00000000-0000-0000-0000-0000000000${i.toString().padStart(2, "0")}`,
          `pw${i}`,
        ),
      );
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject(ciphers));
      mockCipherRiskClient.compute_risk.mockResolvedValue(
        ciphers.map((c) => makeRiskResult(c.id, {})),
      );

      let inFlight = 0;
      let peak = 0;
      mockAuditService.passwordLeaked.mockImplementation(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return 0;
      });

      await lastValueFrom(cipherRiskService.computeRiskForPersonalVault(mockUserId));

      expect(peak).toBeLessThanOrEqual(5);
      expect(mockAuditService.passwordLeaked).toHaveBeenCalledTimes(20);
    });

    it("continues the scan when a single passwordLeaked call rejects", async () => {
      const a = makeLoginCipher(mockCipherId1, "boom");
      const b = makeLoginCipher(mockCipherId2, "leaked");
      const c = makeLoginCipher(mockCipherId3, "fine");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b, c]));
      mockCipherRiskClient.compute_risk.mockResolvedValue([
        makeRiskResult(mockCipherId1, {}),
        makeRiskResult(mockCipherId2, {}),
        makeRiskResult(mockCipherId3, {}),
      ]);
      mockAuditService.passwordLeaked.mockImplementation(async (pw: string) => {
        if (pw === "boom") {
          throw new Error("HIBP 503");
        }
        return pw === "leaked" ? 4 : 0;
      });

      const result = (await lastValueFrom(
        cipherRiskService.computeRiskForPersonalVault(mockUserId),
      )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

      expect(result.summary.exposed.map((x) => x.id)).toEqual([mockCipherId2]);
      expect(result.summary.riskCounts.get(mockCipherId2)?.exposedBreaches).toBe(4);
      expect(result.summary.riskCounts.has(mockCipherId1)).toBe(false);
    });

    it("surfaces upstream errors to the observable", async () => {
      const a = makeLoginCipher(mockCipherId1, "pw");
      mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a]));
      mockCipherRiskClient.compute_risk.mockRejectedValue(new Error("sdk boom"));

      await expect(
        lastValueFrom(cipherRiskService.computeRiskForPersonalVault(mockUserId)),
      ).rejects.toThrow("sdk boom");
    });

    describe("category deduplication (priority: exposed > weak > reused)", () => {
      it("places a cipher with all three risks only in exposed", async () => {
        const a = makeLoginCipher(mockCipherId1, "leaked");
        const b = makeLoginCipher(mockCipherId2, "leaked");
        mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
        mockCipherRiskClient.compute_risk.mockResolvedValue([
          makeRiskResult(mockCipherId1, { password_strength: 1, reuse_count: 2 }),
          makeRiskResult(mockCipherId2, { password_strength: 1, reuse_count: 2 }),
        ]);
        mockAuditService.passwordLeaked.mockResolvedValue(5);

        const result = (await lastValueFrom(
          cipherRiskService.computeRiskForPersonalVault(mockUserId),
        )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

        expect(result.summary.exposed.map((c) => c.id).sort()).toEqual([
          mockCipherId1,
          mockCipherId2,
        ]);
        expect(result.summary.weak).toEqual([]);
        expect(result.summary.reused).toEqual([]);
      });

      it("places a weak+reused cipher (not exposed) only in weak", async () => {
        const a = makeLoginCipher(mockCipherId1, "pw");
        const b = makeLoginCipher(mockCipherId2, "pw");
        mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
        mockCipherRiskClient.compute_risk.mockResolvedValue([
          makeRiskResult(mockCipherId1, { password_strength: 1, reuse_count: 2 }),
          makeRiskResult(mockCipherId2, { password_strength: 1, reuse_count: 2 }),
        ]);

        const result = (await lastValueFrom(
          cipherRiskService.computeRiskForPersonalVault(mockUserId),
        )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

        expect(result.summary.exposed).toEqual([]);
        expect(result.summary.weak.map((c) => c.id).sort()).toEqual([mockCipherId1, mockCipherId2]);
        expect(result.summary.reused).toEqual([]);
      });

      it("keeps a reused-only cipher in reused", async () => {
        const a = makeLoginCipher(mockCipherId1, "pw");
        const b = makeLoginCipher(mockCipherId2, "pw");
        mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
        mockCipherRiskClient.compute_risk.mockResolvedValue([
          makeRiskResult(mockCipherId1, { reuse_count: 2 }),
          makeRiskResult(mockCipherId2, { reuse_count: 2 }),
        ]);

        const result = (await lastValueFrom(
          cipherRiskService.computeRiskForPersonalVault(mockUserId),
        )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

        expect(result.summary.exposed).toEqual([]);
        expect(result.summary.weak).toEqual([]);
        expect(result.summary.reused.map((c) => c.id).sort()).toEqual([
          mockCipherId1,
          mockCipherId2,
        ]);
      });

      it("preserves all risks in riskCounts even when a cipher is deduplicated to a single category", async () => {
        const a = makeLoginCipher(mockCipherId1, "leaked");
        const b = makeLoginCipher(mockCipherId2, "leaked");
        mockCipherService.cipherViews$.mockReturnValue(new BehaviorSubject([a, b]));
        mockCipherRiskClient.compute_risk.mockResolvedValue([
          makeRiskResult(mockCipherId1, { password_strength: 1, reuse_count: 3 }),
          makeRiskResult(mockCipherId2, { password_strength: 1, reuse_count: 3 }),
        ]);
        mockAuditService.passwordLeaked.mockResolvedValue(5);

        const result = (await lastValueFrom(
          cipherRiskService.computeRiskForPersonalVault(mockUserId),
        )) as Extract<PersonalVaultRiskUpdate, { type: "result" }>;

        const counts = result.summary.riskCounts.get(mockCipherId1);
        expect(counts).toEqual({ exposedBreaches: 5, reuseCount: 3, weak: true });
      });
    });
  });
});
