import { Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";

// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";

import { ApiService } from "../abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "../abstractions/audit.service";
import { BreachAccountResponse } from "../dirt/models/response/breach-account.response";
import { HibpApiService } from "../dirt/services/hibp-api.service";
import { Utils } from "../platform/misc/utils";

const PwnedPasswordsApi = "https://api.pwnedpasswords.com/range/";

/**
 * Ceiling on a single range lookup.
 *
 * This is a safety valve, not a latency target: a request that never settles holds its slot in the
 * concurrency limiter forever, so a caller fanning out over a whole vault silently loses throughput
 * until nothing is left. Deliberately generous, because padded responses are ~40 kB and a slow
 * network is not a failure.
 */
export const RangeRequestTimeoutMs = 30_000;

export class AuditService implements AuditServiceAbstraction {
  private passwordLeakedSubject = new Subject<{
    password: string;
    resolve: (count: number) => void;
    reject: (err: any) => void;
  }>();

  /**
   * @param maxConcurrent Ceiling on in-flight range lookups, shared by every caller of
   * {@link passwordLeaked}. This is the only limiter on that path — callers fanning out over a
   * vault should not add their own, or the effective ceiling stops being discoverable from either
   * place. The Pwned Passwords API imposes no rate limit, needs no key, and asks for no
   * attribution; the ceiling exists for self-hosted deployments, whose own network, proxy, or
   * gateway may object to the volume.
   */
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private apiService: ApiService,
    private hibpApiService: HibpApiService,
    private readonly maxConcurrent: number = 100,
  ) {
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
          this.maxConcurrent,
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
   *
   * Always settles, within {@link RangeRequestTimeoutMs}.
   *
   * @param password The password to check.
   * @returns A promise that resolves to the number of times the password has been leaked.
   */
  protected async fetchLeakedPasswordCount(password: string): Promise<number> {
    const hashBytes = await this.cryptoFunctionService.hash(password, "sha1");
    const hash = Utils.fromArrayToHex(hashBytes)!.toUpperCase();
    const hashStart = hash.substr(0, 5);
    const hashEnding = hash.substr(5);

    const abortController = new AbortController();
    const abortTimer = setTimeout(() => abortController.abort(), RangeRequestTimeoutMs);

    try {
      const request = new Request(PwnedPasswordsApi + hashStart, {
        headers: { "Add-Padding": "true" },
        signal: abortController.signal,
      });
      const response = await this.apiService.nativeFetch(request);
      if (!response.ok) {
        // An error body would otherwise be parsed as a hash list, matching nothing and reporting
        // the password as not exposed.
        throw new Error(`Pwned Passwords request failed with status ${response.status}.`);
      }
      const leakedHashes = await response.text();
      const match = leakedHashes.split(/\r?\n/).find((v) => {
        return v.split(":")[0] === hashEnding;
      });

      return match != null ? parseInt(match.split(":")[1], 10) : 0;
    } finally {
      clearTimeout(abortTimer);
    }
  }

  async breachedAccounts(username: string): Promise<BreachAccountResponse[]> {
    return this.hibpApiService.getHibpBreach(username);
  }
}
