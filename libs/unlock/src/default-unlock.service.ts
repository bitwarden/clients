import { first, firstValueFrom, map } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { PinLockType } from "@bitwarden/common/key-management/pin/pin-lock-type";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { UnlockService } from "./unlock.service";
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";
import { EncString, Kdf, MasterPasswordUnlockData, PasswordProtectedKeyEnvelope, UnsignedSharedKey, WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
    asUuid,
} from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DeviceKey } from "@bitwarden/common/types/key";

export class DefaultUnlockService implements UnlockService {
    constructor(
        private registerSdkService: RegisterSdkService,
        private accountCryptographicStateService: AccountCryptographicStateService,
        private pinStateService: PinStateServiceAbstraction,
        private kdfService: KdfConfigService,
        private accountService: AccountService,
        private masterPasswordService: InternalMasterPasswordServiceAbstraction,
        private apiService: ApiService,
    ) { }

    private async getAccountCryptographicState(userId: UserId): Promise<WrappedAccountCryptographicState> {
        return firstValueFrom(
            this.accountCryptographicStateService.accountCryptographicState$(userId),
        );
    }

    private async getKdfParams(userId: UserId): Promise<Kdf> {
        return firstValueFrom(
            this.kdfService.getKdfConfig$(userId).pipe(
                map((config: KdfConfig) => {
                    return config.toSdkConfig();
                }),
            ),
        );
    }

    private async getEmail(userId: UserId): Promise<string> {
        return await firstValueFrom(
            this.accountService.activeAccount$.pipe(map((a) => a?.email)),
        );
    }

    private async getPinProtectedUserKeyEnvelope(userId: UserId): Promise<PasswordProtectedKeyEnvelope | null> {
        const pinLockType = await this.pinStateService.getPinLockType(userId);
        return this.pinStateService.getPinProtectedUserKeyEnvelope(
            userId,
            pinLockType,
        );
    }

    private async getMasterPasswordUnlockData(userId: UserId): Promise<MasterPasswordUnlockData | null> {
        const unlockData = await firstValueFrom(this.masterPasswordService.masterPasswordUnlockData$(userId));
        return unlockData.toSdk();
    }

    async unlockWithDeviceKey(userId: UserId,
        encryptedDevicePrivateKey: EncString,
        encryptedUserKey: UnsignedSharedKey,
        deviceKey: DeviceKey,
    ): Promise<void> {
        await firstValueFrom(
            this.registerSdkService.registerClient$(userId).pipe(
                map(async (sdk) => {
                    if (!sdk) {
                        throw new Error("SDK not available");
                    }
                    using ref = sdk.take();
                    return ref.value.crypto().initialize_user_crypto({
                        userId: asUuid(userId),
                        kdfParams: await this.getKdfParams(userId),
                        email: await this.getEmail(userId),
                        accountCryptographicState: await this.getAccountCryptographicState(userId),
                        method: {
                            deviceKey: {
                                device_key: deviceKey.toBase64(),
                                protected_device_private_key: encryptedDevicePrivateKey,
                                device_protected_user_key: encryptedUserKey,
                            },
                        },
                    });
                }),
            ),
        );
    }

    async unlockWithAuthRequest(userId: UserId, privateKey: string, protectedUserKey: UnsignedSharedKey): Promise<void> {
        await firstValueFrom(
            this.registerSdkService.registerClient$(userId).pipe(
                map(async (sdk) => {
                    if (!sdk) {
                        throw new Error("SDK not available");
                    }
                    using ref = sdk.take();
                    return ref.value.crypto().initialize_user_crypto({
                        userId: asUuid(userId),
                        kdfParams: await this.getKdfParams(userId),
                        email: await this.getEmail(userId),
                        accountCryptographicState: await this.getAccountCryptographicState(userId),
                        method: {
                            authRequest: {
                                request_private_key: privateKey,
                                method: {
                                    userKey: {
                                        protected_user_key: protectedUserKey,
                                    }
                                }
                            },
                        },
                    });
                }),
            ),
        );
    }

    async unlockWithKeyConnector(userId: UserId, keyConnectorUrl: string): Promise<void> {
        const keyConnectorKey = (await this.apiService.getMasterKeyFromKeyConnector(keyConnectorUrl)).key;
        const keyConnectorKeyWrappedUserKey = await this.masterPasswordService.getMasterKeyEncryptedUserKey(userId);
        await firstValueFrom(
            this.registerSdkService.registerClient$(userId).pipe(
                map(async (sdk) => {
                    if (!sdk) {
                        throw new Error("SDK not available");
                    }
                    using ref = sdk.take();
                    return ref.value.crypto().initialize_user_crypto({
                        userId: asUuid(userId),
                        kdfParams: await this.getKdfParams(userId),
                        email: await this.getEmail(userId),
                        accountCryptographicState: await this.getAccountCryptographicState(userId),
                        method: {
                            keyConnector: {
                                master_key: keyConnectorKey,
                                user_key: keyConnectorKeyWrappedUserKey.toSdk(),
                            },
                        },
                    });
                }),
            ),
        );
    }

    async unlockWithPin(userId: UserId, pin: string): Promise<void> {
        await firstValueFrom(
            this.registerSdkService.registerClient$(userId).pipe(
                map(async (sdk) => {
                    if (!sdk) {
                        throw new Error("SDK not available");
                    }
                    using ref = sdk.take();
                    return ref.value.crypto().initialize_user_crypto({
                        userId: asUuid(userId),
                        kdfParams: await this.getKdfParams(userId),
                        email: await this.getEmail(userId),
                        accountCryptographicState: await this.getAccountCryptographicState(userId),
                        method: {
                            pinEnvelope: {
                                pin: pin,
                                pin_protected_user_key_envelope: await this.getPinProtectedUserKeyEnvelope(userId),
                            },
                        },
                    });
                }),
            ),
        );
    }

    async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
        await firstValueFrom(
            this.registerSdkService.registerClient$(userId).pipe(
                map(async (sdk) => {
                    if (!sdk) {
                        throw new Error("SDK not available");
                    }
                    using ref = sdk.take();
                    return ref.value.crypto().initialize_user_crypto({
                        userId: asUuid(userId),
                        kdfParams: await this.getKdfParams(userId),
                        email: await this.getEmail(userId),
                        accountCryptographicState: await this.getAccountCryptographicState(userId),
                        method: {
                            masterPasswordUnlock: {
                                password: masterPassword,
                                master_password_unlock: await this.getMasterPasswordUnlockData(userId),
                            },
                        },
                    });
                }),
            ),
        );
    }
}
