import { ipcMain } from "electron";

import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { NodeCryptoFunctionService } from "@bitwarden/node/services/node-crypto-function.service";

export class MainCryptoFunctionService
  extends NodeCryptoFunctionService
  implements CryptoFunctionService
{
  init() {
    ipcMain.handle(
      "crypto.argon2",
      async (
        event,
        opts: {
          password: string | Uint8Array;
          salt: string | Uint8Array;
          iterations: number;
          memory: number;
          parallelism: number;
        },
      ) => {
        return await this.argon2(
          opts.password,
          opts.salt,
          opts.iterations,
          opts.memory,
          opts.parallelism,
        );
      },
    );
  }
}
