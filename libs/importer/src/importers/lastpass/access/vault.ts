import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { Account } from "./account";
import { Client } from "./client";
import { ClientInfo } from "./client-info";
import { CryptoUtils } from "./crypto-utils";
import { Parser } from "./parser";
import { ParserOptions } from "./parser-options";
import { Ui } from "./ui";

export class Vault {
  accounts: Account[];

  private client: Client;
  private cryptoUtils: CryptoUtils;

  constructor(private cryptoFunctionService: CryptoFunctionService) {
    this.cryptoUtils = new CryptoUtils(cryptoFunctionService);
    const parser = new Parser(cryptoFunctionService, this.cryptoUtils);
    this.client = new Client(parser, this.cryptoUtils);
  }

  async open(
    username: string,
    password: string,
    clientInfo: ClientInfo,
    ui: Ui,
    parserOptions: ParserOptions = ParserOptions.default
  ): Promise<void> {
    this.accounts = await this.client.openVault(username, password, clientInfo, ui, parserOptions);
  }

  async openFederated(
    username: string,
    k1: string,
    k2: string,
    clientInfo: ClientInfo,
    ui: Ui,
    parserOptions: ParserOptions = ParserOptions.default
  ): Promise<void> {
    const k1Arr = Utils.fromByteStringToArray(k1);
    const k2Arr = Utils.fromB64ToArray(k2);
    const hiddenPasswordArr = await this.cryptoFunctionService.hash(
      this.cryptoUtils.ExclusiveOr(k1Arr, k2Arr),
      "sha256"
    );
    const hiddenPassword = Utils.fromBufferToB64(hiddenPasswordArr);
    await this.open(username, hiddenPassword, clientInfo, ui, parserOptions);
  }
}
