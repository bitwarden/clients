import { ipcMain } from "electron";

import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { crypto } from "@bitwarden/desktop-napi";
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
          password: Uint8Array;
          salt: Uint8Array;
          iterations: number;
          memory: number;
          parallelism: number;
        },
      ) => {
        return await crypto.argon2(
          Buffer.from(opts.password),
          Buffer.from(opts.salt),
          opts.iterations,
          opts.memory,
          opts.parallelism,
        );
      },
    );
  }
}
