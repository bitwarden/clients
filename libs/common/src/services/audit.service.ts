import { ApiService } from "../abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "../abstractions/audit.service";
import { CryptoFunctionService } from "../key-management/crypto/abstractions/crypto-function.service";
import { BreachAccountResponse } from "../models/response/breach-account.response";
import { ErrorResponse } from "../models/response/error.response";
import { throttle } from "../platform/misc/throttle";
import { Utils } from "../platform/misc/utils";

const PwnedPasswordsApi = "https://api.pwnedpasswords.com/range/";

export class AuditService implements AuditServiceAbstraction {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private apiService: ApiService,
  ) {}

  @throttle(100, () => "passwordLeaked")
  async passwordLeaked(password: string): Promise<number> {
    const hashBytes = await this.cryptoFunctionService.hash(password, "sha1");
    const hash = Utils.fromBufferToHex(hashBytes).toUpperCase();
    const hashStart = hash.substr(0, 5);
    const hashEnding = hash.substr(5);

    const response = await this.apiService.nativeFetch(new Request(PwnedPasswordsApi + hashStart));
    const leakedHashes = await response.text();
    const match = leakedHashes.split(/\r?\n/).find((v) => {
      return v.split(":")[0] === hashEnding;
    });

    return match != null ? parseInt(match.split(":")[1], 10) : 0;
  }

  async breachedAccounts(username: string): Promise<BreachAccountResponse[]> {
    try {
      return await this.apiService.getHibpBreach(username);
    } catch (e) {
      const error = e as ErrorResponse;
      if (error.statusCode === 404) {
        return [];
      }
      throw new Error();
    }
  }
}
