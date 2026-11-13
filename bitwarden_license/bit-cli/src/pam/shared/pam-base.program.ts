import { firstValueFrom } from "rxjs";

import { BaseProgram } from "@bitwarden/cli/base-program";
import { Response } from "@bitwarden/cli/models/response";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";

import { parseOrganizationIdOption } from "./options";
import {
  checkAnyOrganizationRequirement,
  checkOrganizationRequirement,
  PamOrganizationRequirement,
} from "./organization-requirements";
import { pamErrorResponse } from "./pam-response";

/**
 * What a `bw privileged-controls` verb needs before it may run. The checks run in a fixed order: the feature
 * flags, then the vault being unlocked, then the cheap organization pre-checks.
 */
export interface PamGuard {
  /**
   * Flags required beyond `FeatureFlag.Pam`, which is always checked: `PamAccessConnector` for
   * connectors, targets and rotation.
   */
  flags?: readonly FeatureFlag[];
  /** What the caller must be able to do. Omit it for verbs that need no organization check. */
  requirement?: PamOrganizationRequirement;
  /**
   * The raw `--organizationid`. When given, the requirement is checked against that organization;
   * when omitted, against any organization the caller belongs to.
   */
  organizationId?: string;
}

/** What a passed {@link PamGuard} learned. */
export interface PamContext {
  userId: UserId;
  /** The validated, lowercased `--organizationid`, when the guard was given one. */
  organizationId?: string;
  organization?: Organization;
}

/**
 * Small helpers shared by the `bw privileged-controls` group programs, not a framework: each group still defines
 * its own commands. A group program extends this and calls {@link runPam} from each action.
 *
 * Approver commands and rule reads are not gated on admin permissions, since an approver may hold
 * no admin role. The server stays the authority for everything else: a 403, a 404 or a
 * `NotFound` is mapped to a clear message by `pamErrorResponse`.
 */
export abstract class PamBaseProgram extends BaseProgram {
  constructor(protected serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  /**
   * Enforces `guard`, runs `run`, and prints the result through `processResponse`, so
   * `BW_RESPONSE`, `BW_QUIET`, `BW_RAW` and `BW_CLEANEXIT` behave as they do for every command.
   * Any error `run` throws becomes a failed response through `pamErrorResponse`, which prints
   * text only and never a payload.
   */
  protected async runPam(
    guard: PamGuard,
    run: (context: PamContext) => Promise<Response>,
  ): Promise<void> {
    const context = await this.enforceGuard(guard);
    let response: Response;
    try {
      response = await run(context);
    } catch (e) {
      response = pamErrorResponse(e);
    }
    this.processResponse(response);
  }

  /** Exits with a clear message when the guard is not met. */
  protected async enforceGuard(guard: PamGuard): Promise<PamContext> {
    await this.exitIfFeatureFlagDisabled(FeatureFlag.Pam);
    for (const flag of guard.flags ?? []) {
      await this.exitIfFeatureFlagDisabled(flag);
    }
    await this.exitIfLocked();

    const userId = (await firstValueFrom(this.serviceContainer.accountService.activeAccount$))?.id;
    if (userId == null) {
      this.exitWith(Response.error("You are not logged in."));
    }

    const context: PamContext = { userId };
    if (guard.organizationId != null) {
      try {
        context.organizationId = parseOrganizationIdOption(guard.organizationId);
      } catch (e) {
        this.exitWith(pamErrorResponse(e));
      }
    }

    if (guard.requirement != null) {
      const organizations = await firstValueFrom(
        this.serviceContainer.organizationService.organizations$(userId),
      );
      const organization =
        context.organizationId == null
          ? undefined
          : organizations.find((o) => o.id === context.organizationId);
      const refusal =
        context.organizationId == null
          ? checkAnyOrganizationRequirement(organizations, guard.requirement)
          : checkOrganizationRequirement(organization, guard.requirement);
      if (refusal != null) {
        this.exitWith(Response.error(refusal));
      }
      context.organization = organization;
    }
    return context;
  }

  /** Prints `response` and exits. Never returns; the throw is only reachable when exit is stubbed. */
  private exitWith(response: Response): never {
    this.processResponse(response, true);
    throw new Error("The process did not exit.");
  }
}
