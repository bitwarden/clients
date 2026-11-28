import { BehaviorSubject, distinctUntilChanged, firstValueFrom, Observable, switchMap } from "rxjs";

import { LogService } from "../../../../platform/abstractions/log.service";
import { SdkService } from "../../../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../../../types/guid";
import { CipherView } from "../../../../vault/models/view/cipher.view";
import { PasskeyDirectoryApiService } from "../../../services/abstractions/passkey-directory-api.service";
import {
  PASSKEY_OPPORTUNITIES_IDLE,
  PasskeyCandidate,
  PasskeyDirectoryEntry,
  PasskeyOpportunitiesState,
  PasskeyOpportunity,
} from "../../models/passkey-opportunity";
import { VaultHealthReportStatus } from "../../models/vault-health-report-status";
import { PasskeyOpportunityService } from "../abstractions/passkey-opportunity.service";

/**
 * PENDING SDK: the slice of `CipherRiskClient` this service calls. Delete once
 * a published `@bitwarden/sdk-internal` exposes `find_passkey_opportunities`
 * on `CipherRiskClient`, and call it directly.
 */
type PasskeyOpportunityClient = {
  find_passkey_opportunities(
    candidates: PasskeyCandidate[],
    directory: PasskeyDirectoryEntry[],
  ): PasskeyOpportunity[] | Promise<PasskeyOpportunity[]>;
};

/** Only these schemes are kept for instructions links, which the popup launches. */
const SAFE_INSTRUCTION_PROTOCOLS = new Set(["https:", "http:"]);

export class DefaultPasskeyOpportunityService implements PasskeyOpportunityService {
  /** One stream per user, so a check that resolves after an account switch cannot publish into another user. */
  private readonly states = new Map<UserId, BehaviorSubject<PasskeyOpportunitiesState>>();
  /**
   * The directory is public, site-level data that changes rarely, so it is
   * fetched once per user for the life of the popup. A failed fetch is not
   * cached.
   */
  private readonly directories = new Map<UserId, Promise<PasskeyDirectoryEntry[]>>();
  /** Bumped per check so an older check that resolves late cannot overwrite a newer one. */
  private readonly generations = new Map<UserId, number>();

  constructor(
    private passkeyDirectoryApiService: PasskeyDirectoryApiService,
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  async findPasskeyOpportunities(
    ciphers: CipherView[],
    userId: UserId,
    options?: { reloadDirectory?: boolean },
  ): Promise<void> {
    const state = this.stateFor(userId);
    const generation = (this.generations.get(userId) ?? 0) + 1;
    this.generations.set(userId, generation);
    const retained = state.value.opportunities;

    // A refresh with results on screen keeps them there; only a first check or a
    // retry after a failure shows progress.
    if (retained == null) {
      state.next({ status: VaultHealthReportStatus.Loading, opportunities: null });
    }

    try {
      const directory = await this.directoryFor(userId, options?.reloadDirectory ?? false);
      const candidates = this.toCandidates(ciphers);
      const opportunities =
        directory.length === 0 || candidates.length === 0
          ? []
          : await this.findWithSdk(candidates, directory, userId);

      if (this.generations.get(userId) !== generation) {
        return;
      }
      state.next({
        status: VaultHealthReportStatus.Success,
        opportunities: opportunities.map((o) => this.withSafeInstructions(o)),
      });
    } catch (error) {
      // No vault data is logged: the error comes from the directory fetch or the SDK.
      this.logService.error("Passkey opportunity check failed", error);
      if (this.generations.get(userId) !== generation) {
        return;
      }
      state.next({ status: VaultHealthReportStatus.Error, opportunities: retained });
    }
  }

  getPasskeyOpportunities$(userId: UserId): Observable<PasskeyOpportunitiesState> {
    return this.stateFor(userId).pipe(
      distinctUntilChanged((a, b) => a.status === b.status && a.opportunities === b.opportunities),
    );
  }

  private stateFor(userId: UserId): BehaviorSubject<PasskeyOpportunitiesState> {
    let state = this.states.get(userId);
    if (state == null) {
      state = new BehaviorSubject<PasskeyOpportunitiesState>(PASSKEY_OPPORTUNITIES_IDLE);
      this.states.set(userId, state);
    }
    return state;
  }

  private directoryFor(userId: UserId, reload: boolean): Promise<PasskeyDirectoryEntry[]> {
    let directory = reload ? undefined : this.directories.get(userId);
    if (directory == null) {
      directory = this.fetchDirectory(userId);
      this.directories.set(userId, directory);
      // Forget a failed fetch so the next check tries again.
      directory.catch(() => {
        if (this.directories.get(userId) === directory) {
          this.directories.delete(userId);
        }
      });
    }
    return directory;
  }

  private async fetchDirectory(userId: UserId): Promise<PasskeyDirectoryEntry[]> {
    const entries = await this.passkeyDirectoryApiService.getPasskeyDirectory(userId);
    return entries.map((entry) => ({
      domainName: entry.domainName ?? undefined,
      instructions: entry.instructions ?? undefined,
      supportsPasskeyLogin: entry.supportsPasskeyLogin,
      supportsPasskeyMfa: entry.supportsPasskeyMfa,
    }));
  }

  /**
   * The Health tab's scope, personal-vault ciphers, mapped to the SDK's
   * candidate shape. Nothing else is filtered here: which of them are eligible
   * is the SDK's call.
   */
  private toCandidates(ciphers: CipherView[] | null): PasskeyCandidate[] {
    return (ciphers ?? [])
      .filter((cipher) => cipher.organizationId == null)
      .map((cipher) => ({
        id: cipher.id,
        type: cipher.type,
        uris: (cipher.login?.uris ?? [])
          .map((loginUri) => loginUri.uri)
          .filter((uri): uri is string => uri != null),
        hasFido2Credentials: cipher.login?.hasFido2Credentials ?? false,
        isDeleted: cipher.isDeleted,
        viewPassword: cipher.viewPassword,
      }));
  }

  private async findWithSdk(
    candidates: PasskeyCandidate[],
    directory: PasskeyDirectoryEntry[],
    userId: UserId,
  ): Promise<PasskeyOpportunity[]> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          // PENDING SDK: drop the cast and the guard once the method is published.
          const client = ref.value
            .vault()
            .cipher_risk() as unknown as Partial<PasskeyOpportunityClient>;
          if (typeof client.find_passkey_opportunities !== "function") {
            throw new Error("This SDK build does not support passkey opportunities");
          }
          return await client.find_passkey_opportunities(candidates, directory);
        }),
      ),
    );
  }

  /** Drops an instructions link the popup should not launch, keeping the opportunity. */
  private withSafeInstructions(opportunity: PasskeyOpportunity): PasskeyOpportunity {
    const { instructions } = opportunity;
    if (instructions == null) {
      return opportunity;
    }
    try {
      if (SAFE_INSTRUCTION_PROTOCOLS.has(new URL(instructions).protocol)) {
        return opportunity;
      }
    } catch {
      // Not a URL; fall through and drop it.
    }
    return { ...opportunity, instructions: undefined };
  }
}
