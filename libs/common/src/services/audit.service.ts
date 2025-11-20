import { Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";

import { ApiService } from "../abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "../abstractions/audit.service";
import { BreachAccountResponse } from "../dirt/models/response/breach-account.response";
import { HibpApiService } from "../dirt/services/hibp-api.service";
import { CryptoFunctionService } from "../key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "../models/response/error.response";
import { Utils } from "../platform/misc/utils";

const PwnedPasswordsApi = "https://api.pwnedpasswords.com/range/";

export class AuditService implements AuditServiceAbstraction {
  private passwordLeakedSubject = new Subject<{
    password: string;
    resolve: (count: number) => void;
    reject: (err: any) => void;
  }>();

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private apiService: ApiService,
    private hibpApiService: HibpApiService,
    private readonly maxConcurrent: number = 100, // default to 100, can be overridden
  ) {
    this.maxConcurrent = maxConcurrent;
    this.passwordLeakedSubject
      .pipe(
        mergeMap(
          // Handle each password leak request, resolving or rejecting the associated promise.
          async (req) => {
            try {
              const count = await this.fetchLeakedPasswordCount(req.password);
              req.resolve(count);
            } catch (err) {
              req.reject(err);
            }
          },
          this.maxConcurrent, // Limit concurrent API calls
        ),
      )
      .subscribe();
  }

  async passwordLeaked(password: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.passwordLeakedSubject.next({ password, resolve, reject });
    });
  }

  /**
   * Fetches the count of leaked passwords from the Pwned Passwords API.
   * @param password The password to check.
   * @returns A promise that resolves to the number of times the password has been leaked.
   */
  protected async fetchLeakedPasswordCount(password: string): Promise<number> {
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
      return await this.hibpApiService.getHibpBreach(username);
    } catch (e) {
      const error = e as ErrorResponse;
      if (error.statusCode === 404) {
        return [];
      }
      throw new Error();
    }
  }
}
