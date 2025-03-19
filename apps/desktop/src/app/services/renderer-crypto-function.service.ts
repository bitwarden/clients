import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { WebCryptoFunctionService } from "@bitwarden/common/platform/services/web-crypto-function.service";

export class RendererCryptoFunctionService
  extends WebCryptoFunctionService
  implements CryptoFunctionService
{
  constructor(win: Window | typeof global) {
    super(win);
  }

  // We can't use the `argon2-browser` implementation because it loads WASM and the Content Security Policy doesn't allow it.
  // Rather than trying to weaken the policy, we'll just use the Node.js implementation though the IPC channel.
  // Note that the rest of the functions on this service will be inherited from the WebCryptoFunctionService, as those work just fine.
  async argon2(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    iterations: number,
    memory: number,
    parallelism: number,
  ): Promise<Uint8Array> {
    if (typeof password === "string") {
      password = new TextEncoder().encode(password);
    }
    if (typeof salt === "string") {
      salt = new TextEncoder().encode(salt);
    }

    return await ipc.platform.crypto.argon2(password, salt, iterations, memory, parallelism);
  }
}
