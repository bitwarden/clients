import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
    MasterKeyWrappedUserKey,
    MasterPasswordAuthenticationData,
    MasterPasswordAuthenticationHash,
    MasterPasswordSalt,
    MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { DEFAULT_KDF_CONFIG, KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { DefaultChangeEmailService } from "./default-change-email.service";

describe("DefaultChangeEmailService", () => {
    let sut: DefaultChangeEmailService;

    let masterPasswordService: FakeMasterPasswordService;
    let kdfConfigService: MockProxy<KdfConfigService>;
    let apiService: MockProxy<ApiService>;
    let keyService: MockProxy<KeyService>;

    const mockUserId = newGuid() as UserId;
    const mockMasterPassword = "master-password";
    const mockNewEmail = "new@example.com";
    const mockToken = "verification-token";
    const kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG;
    const existingSalt = "existing@example.com" as MasterPasswordSalt;

    beforeEach(() => {
        masterPasswordService = new FakeMasterPasswordService();
        kdfConfigService = mock<KdfConfigService>();
        apiService = mock<ApiService>();
        keyService = mock<KeyService>();

        sut = new DefaultChangeEmailService(masterPasswordService, kdfConfigService, apiService, keyService);

        jest.resetAllMocks();
    });

    it("should be created", () => {
        expect(sut).toBeTruthy();
    });

    describe("requestEmailToken", () => {
        it("should use existing salt to create authentication data", async () => {
            kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
            masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));

            const authenticationData: MasterPasswordAuthenticationData = {
                salt: existingSalt,
                kdf: kdfConfig,
                masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
            };
            masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue(
                authenticationData,
            );
            apiService.send.mockResolvedValue(undefined);

            await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

            expect(masterPasswordService.mock.saltForUser$).toHaveBeenCalledWith(mockUserId);
            expect(masterPasswordService.mock.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
                mockMasterPassword,
                kdfConfig,
                existingSalt,
            );
        });

        it("should send request with authentication hash", async () => {
            kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
            masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));

            const authenticationData: MasterPasswordAuthenticationData = {
                salt: existingSalt,
                kdf: kdfConfig,
                masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
            };
            masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue(
                authenticationData,
            );
            apiService.send.mockResolvedValue(undefined);

            await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

            expect(apiService.send).toHaveBeenCalledWith(
                "POST",
                "/accounts/email-token",
                expect.objectContaining({
                    newEmail: mockNewEmail,
                    masterPasswordHash: authenticationData.masterPasswordAuthenticationHash,
                }),
                mockUserId,
                false,
            );
        });

        it("should throw if KDF config is null", async () => {
            masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
            kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

            await expect(
                sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId),
            ).rejects.toThrow("kdf is null or undefined.");
        });

        it("should throw if salt is null", async () => {
            masterPasswordService.mock.saltForUser$.mockReturnValue(
                of(null as unknown as MasterPasswordSalt),
            );

            await expect(
                sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId),
            ).rejects.toThrow("salt is null or undefined.");
        });
    });

    describe("confirmEmailChange", () => {
        let mockUserKey: UserKey;
        let existingAuthData: MasterPasswordAuthenticationData;
        let newAuthData: MasterPasswordAuthenticationData;
        let newUnlockData: MasterPasswordUnlockData;
        const newSalt = "new@example.com" as MasterPasswordSalt;

        beforeEach(() => {
            kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

            mockUserKey = new SymmetricCryptoKey(new Uint8Array(64).fill(3) as CsprngArray) as UserKey;
            keyService.userKey$.mockReturnValue(of(mockUserKey));

            masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
            masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

            existingAuthData = {
                salt: existingSalt,
                kdf: kdfConfig,
                masterPasswordAuthenticationHash: "existing-auth-hash" as MasterPasswordAuthenticationHash,
            };
            newAuthData = {
                salt: newSalt,
                kdf: kdfConfig,
                masterPasswordAuthenticationHash: "new-auth-hash" as MasterPasswordAuthenticationHash,
            };
            newUnlockData = {
                salt: newSalt,
                kdf: kdfConfig,
                masterKeyWrappedUserKey: "wrapped-user-key" as MasterKeyWrappedUserKey,
            } as MasterPasswordUnlockData;

            masterPasswordService.mock.makeMasterPasswordAuthenticationData
                .mockResolvedValueOnce(existingAuthData)
                .mockResolvedValueOnce(newAuthData);
            masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
            apiService.send.mockResolvedValue(undefined);
        });

        it("should create existing auth data first", async () => {
            await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

            expect(masterPasswordService.mock.makeMasterPasswordAuthenticationData).toHaveBeenNthCalledWith(
                1,
                mockMasterPassword,
                kdfConfig,
                existingSalt,
            );
        });

        it("should derive new salt from new email", async () => {
            await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

            expect(masterPasswordService.mock.emailToSalt).toHaveBeenCalledWith(mockNewEmail);
        });

        it("should create new auth data with new salt", async () => {
            await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

            expect(masterPasswordService.mock.makeMasterPasswordAuthenticationData).toHaveBeenNthCalledWith(
                2,
                mockMasterPassword,
                kdfConfig,
                newSalt,
            );
        });

        it("should create unlock data with new salt and user key", async () => {
            await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

            expect(masterPasswordService.mock.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
                mockMasterPassword,
                kdfConfig,
                newSalt,
                mockUserKey,
            );
        });

        it("should send request with required fields", async () => {
            await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

            expect(apiService.send).toHaveBeenCalledWith(
                "POST",
                "/accounts/email",
                expect.objectContaining({
                    newEmail: mockNewEmail,
                    token: mockToken,
                    masterPasswordHash: existingAuthData.masterPasswordAuthenticationHash,
                    newMasterPasswordHash: newAuthData.masterPasswordAuthenticationHash,
                    key: newUnlockData.masterKeyWrappedUserKey,
                }),
                mockUserId,
                false,
            );
        });

        it("should throw if KDF config is null", async () => {
            kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

            await expect(
                sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
            ).rejects.toThrow("kdf is null or undefined.");
        });

        it("should throw if user key is null", async () => {
            keyService.userKey$.mockReturnValue(of(null));

            await expect(
                sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
            ).rejects.toThrow("userKey is null or undefined.");
        });

        it("should throw if existing salt is null", async () => {
            masterPasswordService.mock.saltForUser$.mockReturnValue(
                of(null as unknown as MasterPasswordSalt),
            );

            await expect(
                sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
            ).rejects.toThrow("salt is null or undefined.");
        });
    });
});
