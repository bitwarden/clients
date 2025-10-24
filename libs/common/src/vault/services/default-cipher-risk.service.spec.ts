import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import type { CipherRiskOptions, CipherId, CipherRiskResult } from "@bitwarden/sdk-internal";

import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { MockSdkService } from "../../platform/spec/mock-sdk.service";
import { UserId } from "../../types/guid";
import { CipherService } from "../abstractions/cipher.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { LoginView } from "../models/view/login.view";

import { DefaultCipherRiskService } from "./default-cipher-risk.service";

describe("DefaultCipherRiskService", () => {
  let cipherRiskService: DefaultCipherRiskService;
  let sdkService: MockSdkService;
  let mockCipherService: jest.Mocked<CipherService>;

  const mockUserId = "test-user-id" as UserId;
  const mockCipherId1 = "cbea34a8-bde4-46ad-9d19-b05001228ab2";
  const mockCipherId2 = "cbea34a8-bde4-46ad-9d19-b05001228ab3";
  const mockCipherId3 = "cbea34a8-bde4-46ad-9d19-b05001228ab4";

  beforeEach(() => {
    sdkService = new MockSdkService();
    mockCipherService = mock<CipherService>();
    cipherRiskService = new DefaultCipherRiskService(sdkService, mockCipherService);
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
  });
});
