// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { filter, firstValueFrom, map, timeout } from "rxjs";

import { AccountService } from "../../../auth/abstractions/account.service";
import { getUserId } from "../../../auth/services/account.service";
import { CipherId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "../../../vault/enums/cipher-reprompt-type";
import { CipherType } from "../../../vault/enums/cipher-type";
import { Cipher } from "../../../vault/models/domain/cipher";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import {
  Fido2AlgorithmIdentifier,
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction,
  PublicKeyCredentialDescriptor,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import { Fido2UserInterfaceService } from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";

import { CBOR } from "./cbor";
import { compareCredentialIds, parseCredentialId } from "./credential-id-utils";
import { p1363ToDer } from "./ecdsa-utils";
import { Fido2Utils } from "./fido2-utils";
import { guidToStandardFormat } from "./guid-utils";

// AAGUID: d548826e-79b4-db40-a3d8-11116f7e8349
export const AAGUID = new Uint8Array([
  0xd5, 0x48, 0x82, 0x6e, 0x79, 0xb4, 0xdb, 0x40, 0xa3, 0xd8, 0x11, 0x11, 0x6f, 0x7e, 0x83, 0x49,
]);

const KeyUsages: KeyUsage[] = ["sign"];

/**
 * Bitwarden implementation of the WebAuthn Authenticator Model as described by W3C
 * https://www.w3.org/TR/webauthn-3/#sctn-authenticator-model
 *
 * It is highly recommended that the W3C specification is used a reference when reading this code.
 */
export class Fido2AuthenticatorService<ParentWindowReference>
  implements Fido2AuthenticatorServiceAbstraction<ParentWindowReference>
{
  constructor(
    private cipherService: CipherService,
    private userInterface: Fido2UserInterfaceService<ParentWindowReference>,
    private syncService: SyncService,
    private accountService: AccountService,
    private logService?: LogService,
  ) {}

  async makeCredential(
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
    transactionContext?: ArrayBuffer,
  ): Promise<Fido2AuthenticatorMakeCredentialResult> {
    const userInterfaceSession = await this.userInterface.newSession(
      params.fallbackSupported,
      window,
      abortController,
      transactionContext,
    );

    try {
      if (params.credTypesAndPubKeyAlgs.every((p) => p.alg !== Fido2AlgorithmIdentifier.ES256)) {
        const requestedAlgorithms = params.credTypesAndPubKeyAlgs.map((p) => p.alg).join(", ");
        this.logService?.warning(
          `[Fido2Authenticator] No compatible algorithms found, RP requested: ${requestedAlgorithms}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotSupported);
      }

      if (
        params.requireResidentKey != undefined &&
        typeof params.requireResidentKey !== "boolean"
      ) {
        this.logService?.error(
          `[Fido2Authenticator] Invalid 'requireResidentKey' value: ${String(
            params.requireResidentKey,
          )}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
      }

      if (
        params.requireUserVerification != undefined &&
        typeof params.requireUserVerification !== "boolean"
      ) {
        this.logService?.error(
          `[Fido2Authenticator] Invalid 'requireUserVerification' value: ${String(
            params.requireUserVerification,
          )}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
      }

      await userInterfaceSession.ensureUnlockedVault();

      // Avoid syncing if we did it reasonably soon as the only reason for syncing is to validate excludeCredentials
      const lastSync = await firstValueFrom(this.syncService.activeUserLastSync$());
      const threshold = new Date().getTime() - 1000 * 60 * 30; // 30 minutes ago

      if (!lastSync || lastSync.getTime() < threshold) {
        await this.syncService.fullSync(false);
      }

      const existingCipherIds = await this.findExcludedCredentials(
        params.excludeCredentialDescriptorList,
      );
      if (existingCipherIds.length > 0) {
        this.logService?.info(
          `[Fido2Authenticator] Aborting due to excluded credential found in vault.`,
        );
        await userInterfaceSession.informExcludedCredential(existingCipherIds);
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
      }

      let cipher: CipherView;
      let fido2Credential: Fido2CredentialView;
      let keyPair: CryptoKeyPair;
      let userVerified = false;
      let credentialId: string;
      let pubKeyDer: ArrayBuffer;

      const response = await userInterfaceSession.confirmNewCredential({
        credentialName: params.rpEntity.name,
        userName: params.userEntity.name,
        userHandle: Fido2Utils.bufferToString(params.userEntity.id),
        userVerification: params.requireUserVerification,
        rpId: params.rpEntity.id,
      });
      const cipherId = response.cipherId;
      userVerified = response.userVerified;

      if (cipherId === undefined) {
        this.logService?.warning(
          `[Fido2Authenticator] Aborting because user confirmation was not recieved.`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
      }

      try {
        keyPair = await createKeyPair();
        pubKeyDer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(getUserId),
        );

        const encrypted = await firstValueFrom(
          this.cipherService.ciphers$(activeUserId).pipe(
            map((ciphers) => ciphers[cipherId as CipherId]),
            filter((c) => c !== undefined),
            timeout({
              first: 5000,
              with: () => {
                this.logService?.error(
                  `[Fido2Authenticator] Aborting because cipher with ID ${cipherId} could not be found within timeout.`,
                );
                throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
              },
            }),
            map((c) => new Cipher(c, null)),
          ),
        );

        cipher = await this.cipherService.decrypt(encrypted, activeUserId);

        if (
          !userVerified &&
          (params.requireUserVerification || cipher.reprompt !== CipherRepromptType.None)
        ) {
          this.logService?.warning(
            `[Fido2Authenticator] Aborting because user verification was unsuccessful.`,
          );
          throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
        }

        fido2Credential = await createKeyView(params, keyPair.privateKey);
        cipher.login.fido2Credentials = [fido2Credential];
        // update username if username is missing
        if (Utils.isNullOrEmpty(cipher.login.username)) {
          cipher.login.username = fido2Credential.userName;
        }
        const reencrypted = await this.cipherService.encrypt(cipher, activeUserId);
        await this.cipherService.updateWithServer(reencrypted);
        // await this.cipherService.clearCache(activeUserId);
        credentialId = fido2Credential.credentialId;
      } catch (error) {
        this.logService?.error(
          `[Fido2Authenticator] Aborting because of unknown error when creating credential: ${error}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
      }

      const authData = await generateAuthData({
        rpId: params.rpEntity.id,
        credentialId: parseCredentialId(credentialId),
        counter: fido2Credential.counter,
        userPresence: true,
        userVerification: userVerified,
        keyPair,
      });
      const attestationObject = new Uint8Array(
        CBOR.encode({
          fmt: "none",
          attStmt: {},
          authData,
        }),
      );

      return {
        credentialId: parseCredentialId(credentialId),
        attestationObject,
        authData,
        publicKey: pubKeyDer,
        publicKeyAlgorithm: -7,
      };
    } finally {
      userInterfaceSession.close();
    }
  }

  async getAssertion(
    params: Fido2AuthenticatorGetAssertionParams,
    window: ParentWindowReference,
    abortController?: AbortController,
    transactionContext?: ArrayBuffer,
  ): Promise<Fido2AuthenticatorGetAssertionResult> {
    const userInterfaceSession = await this.userInterface.newSession(
      params.fallbackSupported,
      window,
      abortController,
      transactionContext,
    );
    try {
      if (
        params.requireUserVerification != undefined &&
        typeof params.requireUserVerification !== "boolean"
      ) {
        this.logService?.error(
          `[Fido2Authenticator] Invalid 'requireUserVerification' value: ${String(
            params.requireUserVerification,
          )}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
      }

      let cipherOptions: CipherView[];

      await userInterfaceSession.ensureUnlockedVault();

      // Try to find the passkey locally before causing a sync to speed things up
      // only skip syncing if we found credentials AND all of them have a counter = 0
      cipherOptions = await this.findCredential(params, cipherOptions);
      if (
        cipherOptions.length === 0 ||
        cipherOptions.some((c) => c.login.fido2Credentials.some((p) => p.counter > 0))
      ) {
        // If no passkey is found, or any had a non-zero counter, sync to get the latest data
        await this.syncService.fullSync(false);
        cipherOptions = await this.findCredential(params, cipherOptions);
      }

      if (cipherOptions.length === 0) {
        this.logService?.info(
          `[Fido2Authenticator] Aborting because no matching credentials were found in the vault.`,
        );

        await userInterfaceSession.informCredentialNotFound();
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
      }

      let response = { cipherId: cipherOptions[0].id, userVerified: false };
      const masterPasswordRepromptRequired = cipherOptions.some(
        (cipher) => cipher.reprompt !== CipherRepromptType.None,
      );

      if (
        this.requiresUserVerificationPrompt(params, cipherOptions, masterPasswordRepromptRequired)
      ) {
        response = await userInterfaceSession.pickCredential({
          cipherIds: cipherOptions.map((cipher) => cipher.id),
          userVerification: params.requireUserVerification,
          assumeUserPresence: params.assumeUserPresence,
          masterPasswordRepromptRequired,
        });
      }

      const selectedCipherId = response.cipherId;
      const userVerified = response.userVerified;
      const selectedCipher = cipherOptions.find((c) => c.id === selectedCipherId);

      if (selectedCipher === undefined) {
        this.logService?.error(
          `[Fido2Authenticator] Aborting because the selected credential could not be found.`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
      }

      if (
        !userVerified &&
        (params.requireUserVerification || selectedCipher.reprompt !== CipherRepromptType.None)
      ) {
        this.logService?.warning(
          `[Fido2Authenticator] Aborting because user verification was unsuccessful.`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
      }

      try {
        const selectedFido2Credential = selectedCipher.login.fido2Credentials[0];
        const selectedCredentialId = selectedFido2Credential.credentialId;

        if (selectedFido2Credential.counter > 0) {
          ++selectedFido2Credential.counter;
        }

        selectedCipher.localData = {
          ...selectedCipher.localData,
          lastUsedDate: new Date().getTime(),
        };

        if (selectedFido2Credential.counter > 0) {
          const activeUserId = await firstValueFrom(
            this.accountService.activeAccount$.pipe(getUserId),
          );
          const encrypted = await this.cipherService.encrypt(selectedCipher, activeUserId);
          await this.cipherService.updateWithServer(encrypted);
          await this.cipherService.clearCache(activeUserId);
        }

        const authenticatorData = await generateAuthData({
          rpId: selectedFido2Credential.rpId,
          credentialId: parseCredentialId(selectedCredentialId),
          counter: selectedFido2Credential.counter,
          userPresence: true,
          userVerification: userVerified,
        });

        const signature = await generateSignature({
          authData: authenticatorData,
          clientDataHash: params.hash,
          privateKey: await getPrivateKeyFromFido2Credential(selectedFido2Credential),
        });

        return {
          authenticatorData,
          selectedCredential: {
            id: parseCredentialId(selectedCredentialId),
            userHandle: Fido2Utils.stringToBuffer(selectedFido2Credential.userHandle),
          },
          signature,
        };
      } catch (error) {
        this.logService?.error(
          `[Fido2Authenticator] Aborting because of unknown error when asserting credential: ${error}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
      }
    } finally {
      userInterfaceSession.close();
    }
  }

  private async findCredential(
    params: Fido2AuthenticatorGetAssertionParams,
    cipherOptions: CipherView[],
  ) {
    if (params.allowCredentialDescriptorList?.length > 0) {
      cipherOptions = await this.findCredentialsById(
        params.allowCredentialDescriptorList,
        params.rpId,
      );
    } else {
      cipherOptions = await this.findCredentialsByRp(params.rpId);
    }
    return cipherOptions;
  }

  private requiresUserVerificationPrompt(
    params: Fido2AuthenticatorGetAssertionParams,
    cipherOptions: CipherView[],
    masterPasswordRepromptRequired: boolean,
  ): boolean {
    return (
      params.requireUserVerification ||
      !params.assumeUserPresence ||
      cipherOptions.length > 1 ||
      cipherOptions.length === 0 ||
      masterPasswordRepromptRequired
    );
  }

  async silentCredentialDiscovery(rpId: string): Promise<Fido2CredentialView[]> {
    const credentials = await this.findCredentialsByRp(rpId);
    return credentials.map((c) => c.login.fido2Credentials[0]);
  }

  /** Finds existing crendetials and returns the `cipherId` for each one */
  private async findExcludedCredentials(
    credentials: PublicKeyCredentialDescriptor[],
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const credential of credentials) {
      try {
        ids.push(guidToStandardFormat(credential.id));
        // eslint-disable-next-line no-empty
      } catch {}
    }

    if (ids.length === 0) {
      return [];
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
    return ciphers
      .filter(
        (cipher) =>
          !cipher.isDeleted &&
          cipher.organizationId == undefined &&
          cipher.type === CipherType.Login &&
          cipher.login.hasFido2Credentials &&
          ids.includes(cipher.login.fido2Credentials[0].credentialId),
      )
      .map((cipher) => cipher.id);
  }

  private async findCredentialsById(
    credentials: PublicKeyCredentialDescriptor[],
    rpId: string,
  ): Promise<CipherView[]> {
    if (credentials.length === 0) {
      return [];
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
    return ciphers.filter(
      (cipher) =>
        !cipher.isDeleted &&
        cipher.type === CipherType.Login &&
        cipher.login.hasFido2Credentials &&
        cipher.login.fido2Credentials[0].rpId === rpId &&
        credentials.some((credential) =>
          compareCredentialIds(
            credential.id,
            parseCredentialId(cipher.login.fido2Credentials[0].credentialId),
          ),
        )
    );
  }

  private async findCredentialsByRp(rpId: string): Promise<CipherView[]> {
    this.logService.debug("[findCredentialByRp]:", rpId)
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
    this.logService.debug("[findCredentialsByRp] ciphers:", ciphers)
    return ciphers.filter(
      (cipher) =>
        !cipher.isDeleted &&
        cipher.type === CipherType.Login &&
        cipher.login.hasFido2Credentials &&
        cipher.login.fido2Credentials[0].rpId === rpId &&
        cipher.login.fido2Credentials[0].discoverable,
    );
  }
}

async function createKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    KeyUsages,
  );
}

async function createKeyView(
  params: Fido2AuthenticatorMakeCredentialsParams,
  keyValue: CryptoKey,
): Promise<Fido2CredentialView> {
  if (keyValue.algorithm.name !== "ECDSA" && (keyValue.algorithm as any).namedCurve !== "P-256") {
    throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.Unknown);
  }

  const pkcs8Key = await crypto.subtle.exportKey("pkcs8", keyValue);
  const fido2Credential = new Fido2CredentialView();
  fido2Credential.credentialId = Utils.newGuid();
  fido2Credential.keyType = "public-key";
  fido2Credential.keyAlgorithm = "ECDSA";
  fido2Credential.keyCurve = "P-256";
  fido2Credential.keyValue = Fido2Utils.bufferToString(pkcs8Key);
  fido2Credential.rpId = params.rpEntity.id;
  fido2Credential.userHandle = Fido2Utils.bufferToString(params.userEntity.id);
  fido2Credential.userName = params.userEntity.name;
  fido2Credential.counter = 0;
  fido2Credential.rpName = params.rpEntity.name;
  fido2Credential.userDisplayName = params.userEntity.displayName;
  fido2Credential.discoverable = params.requireResidentKey;
  fido2Credential.creationDate = new Date();

  return fido2Credential;
}

async function getPrivateKeyFromFido2Credential(
  fido2Credential: Fido2CredentialView,
): Promise<CryptoKey> {
  const keyBuffer = Fido2Utils.stringToBuffer(fido2Credential.keyValue);
  return await crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(keyBuffer),
    {
      name: fido2Credential.keyAlgorithm,
      namedCurve: fido2Credential.keyCurve,
    } as EcKeyImportParams,
    true,
    KeyUsages,
  );
}

interface AuthDataParams {
  rpId: string;
  credentialId: BufferSource;
  userPresence: boolean;
  userVerification: boolean;
  counter: number;
  keyPair?: CryptoKeyPair;
}

async function generateAuthData(params: AuthDataParams) {
  const authData: Array<number> = [];

  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest({ name: "SHA-256" }, Utils.fromByteStringToArray(params.rpId)),
  );
  authData.push(...rpIdHash);

  const flags = authDataFlags({
    extensionData: false,
    attestationData: params.keyPair != undefined,
    backupEligibility: true,
    backupState: true, // Credentials are always synced
    userVerification: params.userVerification,
    userPresence: params.userPresence,
  });
  authData.push(flags);

  // add 4 bytes of counter - we use time in epoch seconds as monotonic counter
  // TODO: Consider changing this to a cryptographically safe random number
  const counter = params.counter;
  authData.push(
    ((counter & 0xff000000) >> 24) & 0xff,
    ((counter & 0x00ff0000) >> 16) & 0xff,
    ((counter & 0x0000ff00) >> 8) & 0xff,
    counter & 0x000000ff,
  );

  if (params.keyPair) {
    // attestedCredentialData
    const attestedCredentialData: Array<number> = [];

    attestedCredentialData.push(...AAGUID);

    // credentialIdLength (2 bytes) and credential Id
    const rawId = Fido2Utils.bufferSourceToUint8Array(params.credentialId);
    const credentialIdLength = [(rawId.length - (rawId.length & 0xff)) / 256, rawId.length & 0xff];
    attestedCredentialData.push(...credentialIdLength);
    attestedCredentialData.push(...rawId);

    const publicKeyJwk = await crypto.subtle.exportKey("jwk", params.keyPair.publicKey);
    // COSE format of the EC256 key
    const keyX = Utils.fromUrlB64ToArray(publicKeyJwk.x);
    const keyY = Utils.fromUrlB64ToArray(publicKeyJwk.y);

    // Can't get `cbor-redux` to encode in CTAP2 canonical CBOR. So we do it manually:
    const coseBytes = new Uint8Array(77);
    coseBytes.set([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20], 0);
    coseBytes.set(keyX, 10);
    coseBytes.set([0x22, 0x58, 0x20], 10 + 32);
    coseBytes.set(keyY, 10 + 32 + 3);

    // credential public key - convert to array from CBOR encoded COSE key
    attestedCredentialData.push(...coseBytes);

    authData.push(...attestedCredentialData);
  }

  return new Uint8Array(authData);
}

interface SignatureParams {
  authData: Uint8Array;
  clientDataHash: BufferSource;
  privateKey: CryptoKey;
}

async function generateSignature(params: SignatureParams) {
  const sigBase = new Uint8Array([
    ...params.authData,
    ...Fido2Utils.bufferSourceToUint8Array(params.clientDataHash),
  ]);
  const p1363_signature = new Uint8Array(
    await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      params.privateKey,
      sigBase,
    ),
  );

  const asn1Der_signature = p1363ToDer(p1363_signature);

  return asn1Der_signature;
}

interface Flags {
  extensionData: boolean;
  attestationData: boolean;
  backupEligibility: boolean;
  backupState: boolean;
  userVerification: boolean;
  userPresence: boolean;
}

function authDataFlags(options: Flags): number {
  let flags = 0;

  if (options.extensionData) {
    flags |= 0b1000000;
  }

  if (options.attestationData) {
    flags |= 0b01000000;
  }

  if (options.backupEligibility) {
    flags |= 0b00001000;
  }

  if (options.backupState) {
    flags |= 0b00010000;
  }

  if (options.userVerification) {
    flags |= 0b00000100;
  }

  if (options.userPresence) {
    flags |= 0b00000001;
  }

  return flags;
}
