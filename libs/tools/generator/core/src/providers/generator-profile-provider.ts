import {
  distinctUntilChanged,
  map,
  Observable,
  switchMap,
  takeUntil,
  shareReplay,
  tap,
  of,
} from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BoundDependency } from "@bitwarden/common/tools/dependencies";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { anyComplete } from "@bitwarden/common/tools/rx";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";

import { ProfileContext, CoreProfileMetadata, ProfileMetadata } from "../metadata";
import { GeneratorConstraints } from "../types/generator-constraints";
import { equivalent } from "../util";

/** Surfaces contextual information to credential generators */
export class GeneratorProfileProvider {
  /** Instantiates the context provider
   *  @param providers dependency injectors for user state subjects
   *  @param policyService settings constraint lookups
   */
  constructor(
    private readonly providers: UserStateSubjectDependencyProvider,
    private readonly policyService: PolicyService,
  ) {
    this.log = providers.log({ type: "GeneratorProfileProvider" });
  }

  private readonly log: SemanticLogger;

  /** Get a subject bound to a specific user's settings for the provided profile.
   * @param profile determines which profile's settings are loaded
   * @param dependencies.singleUserId$ identifies the user to which the settings are bound
   * @returns an observable that emits the subject once `dependencies.singleUserId$` becomes
   *   available and then completes.
   * @remarks the subject tracks and enforces policy on the settings it contains.
   *   It completes when `dependencies.singleUserId$` competes or the user's encryption key
   *   becomes unavailable.
   */
  settings<Settings extends object>(
    profile: Readonly<CoreProfileMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
  ): UserStateSubject<Settings> {
    const account$ = dependencies.account$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    const constraints$ = this.constraints$(profile, { account$ });
    const subject = new UserStateSubject(profile.storage, this.providers, {
      constraints$,
      account$,
    });

    return subject;
  }

  /** Get the policy constraints for the provided profile
   *  @param dependencies.account$ constraints are loaded from this account.
   *    If the account's email is verified, it is passed to the constraints
   *  @returns an observable that emits the policy once `dependencies.userId$`
   *   and the policy become available.
   */
  constraints$<Settings>(
    profile: Readonly<ProfileMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
  ): Observable<GeneratorConstraints<Settings>> {
    const account$ = dependencies.account$.pipe(shareReplay({ bufferSize: 1, refCount: true }));

    const constraints$ = account$.pipe(
      distinctUntilChanged((prev, next) => {
        return prev.email === next.email && prev.emailVerified === next.emailVerified;
      }),
      switchMap((account) => {
        this.log.debug(
          {
            accountId: account.id,
            profileType: profile.type,
            policyType: profile.constraints.type ?? "N/A",
            defaultConstraints: profile.constraints.default as object,
          },
          "initializing constraints$",
        );

        const policies$ = profile.constraints.type
          ? this.policyService.policiesByType$(profile.constraints.type, account.id)
          : of([]);

        const context: ProfileContext<Settings> = {
          defaultConstraints: profile.constraints.default,
        };
        if (account.emailVerified) {
          this.log.debug({ email: account.email }, "verified email detected; including in context");
          context.email = account.email;
        }

        const constraints$ = policies$.pipe(
          map((policies) => profile.constraints.create(policies, context)),
          distinctUntilChanged((previous, next) => {
            return equivalent(previous, next);
          }),
          tap((constraints) => this.log.debug(constraints as object, "constraints updated")),
        );

        return constraints$;
      }),
      // complete policy emissions otherwise `switchMap` holds `constraints$`
      // open indefinitely
      takeUntil(anyComplete(account$)),
    );

    return constraints$;
  }
}
