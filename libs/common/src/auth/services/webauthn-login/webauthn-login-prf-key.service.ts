import { CryptoFunctionService } from "../../../platform/abstractions/crypto-function.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { PrfKey } from "../../../types/key";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-prf-key.service.abstraction";

const LoginWithPrfSalt = "passwordless-login";

export class WebAuthnLoginPrfKeyService implements WebAuthnLoginPrfKeyServiceAbstraction {
  constructor(private cryptoFunctionService: CryptoFunctionService) {}

  async getLoginWithPrfSalt(): Promise<ArrayBuffer> {
    return await this.cryptoFunctionService.hash(LoginWithPrfSalt, "sha256");
  }

  async createSymmetricKeyFromPrf(prf: ArrayBuffer): Promise<PrfKey> {
    return (await this.stretchKey(new Uint8Array(prf))) as PrfKey;
  }

  // TODO: use keyGenerationService.stretchKey
  private async stretchKey(key: Uint8Array): Promise<SymmetricCryptoKey> {
    const newKey = new Uint8Array(64);
    const encKey = await this.cryptoFunctionService.hkdfExpand(key, "enc", 32, "sha256");
    const macKey = await this.cryptoFunctionService.hkdfExpand(key, "mac", 32, "sha256");
    newKey.set(new Uint8Array(encKey));
    newKey.set(new Uint8Array(macKey), 32);
    return new SymmetricCryptoKey(newKey);
  }
}
