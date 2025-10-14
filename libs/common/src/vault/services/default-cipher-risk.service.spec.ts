import { CipherRisk, CipherRiskOptions } from "@bitwarden/sdk-internal";

import { MockSdkService } from "../../platform/spec/mock-sdk.service";
import { UserId } from "../../types/guid";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { LoginView } from "../models/view/login.view";

import { DefaultCipherRiskService } from "./default-cipher-risk.service";

describe("DefaultCipherRiskService", () => {
  let cipherRiskService: DefaultCipherRiskService;
  let sdkService: MockSdkService;

  const mockUserId = "test-user-id" as UserId;
  const mockCipherId1 = "cbea34a8-bde4-46ad-9d19-b05001228ab2";
  const mockCipherId2 = "cbea34a8-bde4-46ad-9d19-b05001228ab3";
  const mockCipherId3 = "cbea34a8-bde4-46ad-9d19-b05001228ab4";

  beforeEach(() => {
    sdkService = new MockSdkService();
    cipherRiskService = new DefaultCipherRiskService(sdkService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("computeRisk", () => {
    it("should call SDK cipher_risk().compute_risk() with correct parameters", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockRiskResults: CipherRisk[] = [
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

      const results = await cipherRiskService.computeRisk([cipher], mockUserId, options);

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

      await cipherRiskService.computeRisk([loginCipher, cardCipher, identityCipher], mockUserId);

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

      await cipherRiskService.computeRisk(
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

      const results = await cipherRiskService.computeRisk([cardCipher], mockUserId);

      expect(results).toEqual([]);
    });

    it("should handle multiple Login ciphers", async () => {
      const mockClient = sdkService.simulate.userLogin(mockUserId);
      const mockCipherRiskClient = mockClient.vault.mockDeep().cipher_risk.mockDeep();

      const mockRiskResults: CipherRisk[] = [
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

      const results = await cipherRiskService.computeRisk([cipher1, cipher2], mockUserId);

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

      await cipherRiskService.computeRisk([cipher], mockUserId);

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

      await cipherRiskService.computeRisk([cipher], mockUserId);

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
      const mockCipherRiskClient = sdkService.client.vault.mockDeep().cipher_risk.mockDeep();

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

      const result = await cipherRiskService.buildPasswordReuseMap([cipher1, cipher2]);

      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
        expect.objectContaining({ password: "password2" }),
      ]);
      expect(result).toEqual(mockReuseMap);
    });

    it("should filter out non-Login ciphers", async () => {
      const mockCipherRiskClient = sdkService.client.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});

      const loginCipher = new CipherView();
      loginCipher.id = mockCipherId1;
      loginCipher.type = CipherType.Login;
      loginCipher.login = new LoginView();
      loginCipher.login.password = "password1";

      const cardCipher = new CipherView();
      cardCipher.id = mockCipherId2;
      cardCipher.type = CipherType.Card;

      await cipherRiskService.buildPasswordReuseMap([loginCipher, cardCipher]);

      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
      ]);
    });

    it("should filter out Login ciphers without passwords", async () => {
      const mockCipherRiskClient = sdkService.client.vault.mockDeep().cipher_risk.mockDeep();
      mockCipherRiskClient.password_reuse_map.mockReturnValue({});

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

      await cipherRiskService.buildPasswordReuseMap([cipherWithPassword, cipherWithoutPassword]);

      expect(mockCipherRiskClient.password_reuse_map).toHaveBeenCalledWith([
        expect.objectContaining({ password: "password1" }),
      ]);
    });

    it("should return empty object when no valid Login ciphers provided", async () => {
      const cardCipher = new CipherView();
      cardCipher.type = CipherType.Card;

      const result = await cipherRiskService.buildPasswordReuseMap([cardCipher]);

      expect(result).toEqual({});
    });
  });
});
