import { PotentialGranteeView } from "@bitwarden/bit-common/secrets-manager/models/view/access-policies/potential-grantee.view";
import { GrantedProjectPolicyPermissionDetailsView } from "@bitwarden/bit-common/secrets-manager/models/view/access-policies/service-account-granted-policies.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { AccessPolicyService } from "@bitwarden/bit-common/secrets-manager/shared/access-policies/access-policy.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
// eslint-disable-next-line no-restricted-imports
import { DECRYPT_ERROR } from "@bitwarden/legacy-crypto";

import { ServiceContainer } from "../../service-container";
import { SmGranteeType, toSmGranteeType } from "../models/sm-grantee.response";
import {
  parseSmId,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export const SmAccessTargets = ["project", "machine-account", "secret"] as const;
export type SmAccessTarget = (typeof SmAccessTargets)[number];

export const SmAccessPermissions = ["read", "read-write"] as const;
export type SmAccessPermission = (typeof SmAccessPermissions)[number];

export type SmAccessPolicy = {
  type: SmGranteeType;
  id: string;
  name?: string;
  read: boolean;
  write: boolean;
};

export type SmAccessState = {
  organizationId: string;
  target: SmAccessTarget;
  targetId: string;
  policies: SmAccessPolicy[];
  secret?: SecretView;
};

type SmGranteeCandidate = {
  type: SmGranteeType;
  id: string;
  name?: string;
  email?: string;
};

const TargetLabels: Record<SmAccessTarget, string> = {
  project: "project",
  "machine-account": "machine account",
  secret: "secret",
};

const GranteeTypes: Record<SmAccessTarget, SmGranteeType[]> = {
  project: ["user", "group", "machineAccount"],
  "machine-account": ["user", "group", "project"],
  secret: ["user", "group", "machineAccount"],
};

const GranteeTypeLabels: Record<SmGranteeType, string> = {
  user: "user",
  group: "group",
  machineAccount: "machine account",
  project: "project",
};

/**
 * Machine account people access only supports read-write, matching the web vault.
 */
function requiresReadWrite(target: SmAccessTarget, type: SmGranteeType): boolean {
  return target === "machine-account" && (type === "user" || type === "group");
}

export function parseSmPermission(
  permission: unknown,
):
  | { permission: SmAccessPermission; error?: undefined }
  | { permission?: undefined; error: Response } {
  if (!SmAccessPermissions.includes(permission as SmAccessPermission)) {
    return {
      error: Response.badRequest(
        "`permission` must be one of: " + SmAccessPermissions.join(", ") + ".",
      ),
    };
  }
  return { permission: permission as SmAccessPermission };
}

export function toSmPermission(policy: { read: boolean; write: boolean }): SmAccessPermission {
  return policy.write ? "read-write" : "read";
}

export function fromSmPermission(permission: SmAccessPermission): {
  read: boolean;
  write: boolean;
} {
  return { read: true, write: permission === "read-write" };
}

export function parseSmAccessTarget(
  target: string,
): { target: SmAccessTarget; error?: undefined } | { target?: undefined; error: Response } {
  if (!SmAccessTargets.includes(target as SmAccessTarget)) {
    return {
      error: Response.badRequest(
        "Unknown access target `" +
          target +
          "`. Expected one of: " +
          SmAccessTargets.join(", ") +
          ".",
      ),
    };
  }
  return { target: target as SmAccessTarget };
}

/**
 * Validates a policy for the target, returning an error message if the grantee type or
 * permission is not supported.
 */
export function checkSmAccessPolicy(
  target: SmAccessTarget,
  type: SmGranteeType,
  permission: SmAccessPermission,
): Response | undefined {
  if (!GranteeTypes[target].includes(type)) {
    return Response.badRequest(
      "A " +
        GranteeTypeLabels[type] +
        " cannot be granted access to a " +
        TargetLabels[target] +
        ". Expected one of: " +
        GranteeTypes[target].join(", ") +
        ".",
    );
  }
  if (requiresReadWrite(target, type) && permission !== "read-write") {
    return Response.badRequest(
      "People can only be granted read-write access to a machine account.",
    );
  }
  return undefined;
}

export function isSmGranteeTypeFor(target: SmAccessTarget, type: unknown): type is SmGranteeType {
  return GranteeTypes[target].includes(type as SmGranteeType);
}

export function smAccessGranteeTypes(target: SmAccessTarget): SmGranteeType[] {
  return GranteeTypes[target];
}

function granteeDescription(candidate: SmGranteeCandidate): string {
  const label = candidate.email ?? candidate.name;
  return GranteeTypeLabels[candidate.type] + " " + candidate.id + (label ? " (" + label + ")" : "");
}

function matchesGrantee(candidate: SmGranteeCandidate, normalized: string): boolean {
  if (candidate.type === "user") {
    return candidate.email?.toLowerCase() === normalized;
  }
  return candidate.name?.toLowerCase() === normalized;
}

/**
 * Finds the single grantee identified by an id, a user's email, or the name of a group,
 * machine account, or project.
 */
export function resolveSmGrantee(
  grantee: string,
  candidates: SmGranteeCandidate[],
  target: SmAccessTarget,
): { grantee: SmGranteeCandidate; error?: undefined } | { grantee?: undefined; error: Response } {
  const normalized = grantee?.trim().toLowerCase() ?? "";
  if (normalized === "") {
    return { error: Response.badRequest("`grantee` is required.") };
  }

  let matches = candidates.filter((c) => c.id.toLowerCase() === normalized);
  if (matches.length === 0) {
    matches = candidates.filter((c) => matchesGrantee(c, normalized));
  }

  if (matches.length === 0) {
    const types = GranteeTypes[target].map((t) => GranteeTypeLabels[t]);
    return {
      error: Response.error(
        "No " +
          types.slice(0, -1).join(", ") +
          ", or " +
          types[types.length - 1] +
          " matching `" +
          grantee +
          "` can be granted access to this " +
          TargetLabels[target] +
          ". Use `bw sm grantees list` to see the available grantees.",
      ),
    };
  }
  if (matches.length > 1) {
    return {
      error: Response.error(
        "`" +
          grantee +
          "` matches more than one grantee. Use the id of one of the following instead:\n" +
          matches.map(granteeDescription).join("\n"),
      ),
    };
  }
  return { grantee: matches[0] };
}

function samePolicies(a: SmAccessPolicy[], b: SmAccessPolicy[]): boolean {
  const key = (p: SmAccessPolicy) =>
    p.type + ":" + p.id.toLowerCase() + ":" + p.read + ":" + p.write;
  const aKeys = a.map(key).sort();
  const bKeys = b.map(key).sort();
  return aKeys.length === bKeys.length && aKeys.every((k, i) => k === bKeys[i]);
}

function ofType(policies: SmAccessPolicy[], ...types: SmGranteeType[]): SmAccessPolicy[] {
  return policies.filter((p) => types.includes(p.type));
}

function flags(policy: { read: boolean; write: boolean }) {
  return { read: policy.read, write: policy.write };
}

/**
 * Reads and writes the access policies of projects, machine accounts, and secrets as a single
 * list. The server replaces each set of policies wholesale, so writes always send the complete
 * set for every group of policies that changed.
 */
export class SmAccessPolicyStore {
  constructor(
    private accessPolicyService: AccessPolicyService,
    private projectService: ProjectService,
    private serviceAccountService: ServiceAccountService,
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  /**
   * Validates the arguments shared by every access command and loads the current policies.
   */
  async load(
    organizationId: string,
    target: string,
    targetId: string,
  ): Promise<{ state: SmAccessState; error?: undefined } | { state?: undefined; error: Response }> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return { error: org.error };
    }
    const parsedTarget = parseSmAccessTarget(target);
    if (parsedTarget.error) {
      return { error: parsedTarget.error };
    }
    const id = parseSmId(targetId, "id");
    if (id.error) {
      return { error: id.error };
    }

    try {
      const owner = await this.getOwner(org.organizationId, parsedTarget.target, id.id);
      if (owner.organizationId !== org.organizationId) {
        return { error: smNotFoundResponse(TargetLabels[parsedTarget.target]) };
      }
      const policies = await this.getPolicies(org.organizationId, parsedTarget.target, id.id);
      return {
        state: {
          organizationId: org.organizationId,
          target: parsedTarget.target,
          targetId: id.id,
          policies,
          secret: owner.secret,
        },
      };
    } catch (e) {
      return { error: smErrorResponse(e, TargetLabels[parsedTarget.target]) };
    }
  }

  /**
   * Replaces the target's policies with `policies` and returns the policies stored on the server.
   */
  async save(
    state: SmAccessState,
    policies: SmAccessPolicy[],
  ): Promise<
    { policies: SmAccessPolicy[]; error?: undefined } | { policies?: undefined; error: Response }
  > {
    try {
      const error = await this.write(state, policies);
      if (error) {
        return { error };
      }
      return {
        policies: await this.getPolicies(state.organizationId, state.target, state.targetId),
      };
    } catch (e) {
      return { error: smErrorResponse(e, TargetLabels[state.target]) };
    }
  }

  /**
   * Resolves a grantee argument against the target's potential grantees and its current policies.
   */
  async resolveGrantee(
    state: SmAccessState,
    grantee: string,
  ): Promise<
    { grantee: SmGranteeCandidate; error?: undefined } | { grantee?: undefined; error: Response }
  > {
    const current: SmGranteeCandidate[] = state.policies.map((p) => ({
      type: p.type,
      id: p.id,
      name: p.type === "user" ? undefined : p.name,
    }));
    const byId = current.filter((c) => c.id.toLowerCase() === grantee?.trim().toLowerCase());
    if (byId.length === 1) {
      return { grantee: byId[0] };
    }

    let potential: PotentialGranteeView[];
    try {
      potential = await this.getPotentialGrantees(state.organizationId, state.target);
    } catch (e) {
      return { error: smErrorResponse(e, "organization") };
    }
    const candidates: SmGranteeCandidate[] = potential
      .map((g) => ({
        type: toSmGranteeType(g.type),
        id: g.id,
        name: g.name === DECRYPT_ERROR ? undefined : g.name,
        email: g.email ?? undefined,
      }))
      .filter((c) => GranteeTypes[state.target].includes(c.type));
    for (const c of current) {
      if (!candidates.some((p) => p.type === c.type && p.id.toLowerCase() === c.id.toLowerCase())) {
        candidates.push(c);
      }
    }
    return resolveSmGrantee(grantee, candidates, state.target);
  }

  private async getOwner(
    organizationId: string,
    target: SmAccessTarget,
    targetId: string,
  ): Promise<{ organizationId: string; secret?: SecretView }> {
    switch (target) {
      case "project":
        return await this.projectService.getByProjectId(targetId, true);
      case "machine-account":
        return await this.serviceAccountService.getByServiceAccountId(targetId, organizationId);
      case "secret": {
        const secret = await this.secretService.getBySecretId(targetId);
        return { organizationId: secret.organizationId, secret };
      }
    }
  }

  private getPotentialGrantees(organizationId: string, target: SmAccessTarget) {
    const others =
      target === "machine-account"
        ? this.accessPolicyService.getProjectsPotentialGrantees(organizationId)
        : this.accessPolicyService.getServiceAccountsPotentialGrantees(organizationId);
    return Promise.all([
      this.accessPolicyService.getPeoplePotentialGrantees(organizationId),
      others,
    ]).then(([people, rest]) => [...people, ...rest]);
  }

  private async getPolicies(
    organizationId: string,
    target: SmAccessTarget,
    targetId: string,
  ): Promise<SmAccessPolicy[]> {
    switch (target) {
      case "project": {
        const [people, machineAccounts] = await Promise.all([
          this.accessPolicyService.getProjectPeopleAccessPolicies(targetId),
          this.accessPolicyService.getProjectServiceAccountsAccessPolicies(
            organizationId,
            targetId,
          ),
        ]);
        return [
          ...this.fromPeople(people),
          ...this.fromMachineAccounts(machineAccounts.serviceAccountAccessPolicies),
        ];
      }
      case "machine-account": {
        const [people, granted] = await Promise.all([
          this.accessPolicyService.getServiceAccountPeopleAccessPolicies(targetId),
          this.accessPolicyService.getServiceAccountGrantedPolicies(organizationId, targetId),
        ]);
        return [
          ...this.fromPeople(people),
          ...granted.grantedProjectPolicies.map((g) => ({
            type: "project" as const,
            id: g.accessPolicy.grantedProjectId,
            name: g.accessPolicy.grantedProjectName,
            ...flags(g.accessPolicy),
          })),
        ];
      }
      case "secret": {
        const policies = await this.accessPolicyService.getSecretAccessPolicies(
          organizationId,
          targetId,
        );
        return [
          ...this.fromPeople(policies),
          ...this.fromMachineAccounts(policies.serviceAccountAccessPolicies),
        ];
      }
    }
  }

  private async write(state: SmAccessState, policies: SmAccessPolicy[]): Promise<Response | void> {
    const people = (list: SmAccessPolicy[]) => ofType(list, "user", "group");
    const peopleView = {
      userAccessPolicies: ofType(policies, "user").map((p) => ({
        organizationUserId: p.id,
        organizationUserName: p.name,
        currentUser: false,
        ...flags(p),
      })),
      groupAccessPolicies: ofType(policies, "group").map((p) => ({
        groupId: p.id,
        groupName: p.name,
        currentUserInGroup: false,
        ...flags(p),
      })),
    };
    const machineAccountViews = ofType(policies, "machineAccount").map((p) => ({
      serviceAccountId: p.id,
      serviceAccountName: p.name,
      ...flags(p),
    }));
    const peopleChanged = !samePolicies(people(state.policies), people(policies));

    switch (state.target) {
      case "project": {
        if (peopleChanged) {
          await this.accessPolicyService.putProjectPeopleAccessPolicies(state.targetId, peopleView);
        }
        if (
          !samePolicies(
            ofType(state.policies, "machineAccount"),
            ofType(policies, "machineAccount"),
          )
        ) {
          await this.accessPolicyService.putProjectServiceAccountsAccessPolicies(
            state.organizationId,
            state.targetId,
            { serviceAccountAccessPolicies: machineAccountViews },
          );
        }
        return;
      }
      case "machine-account": {
        if (peopleChanged) {
          await this.accessPolicyService.putServiceAccountPeopleAccessPolicies(
            state.targetId,
            peopleView,
          );
        }
        if (!samePolicies(ofType(state.policies, "project"), ofType(policies, "project"))) {
          await this.accessPolicyService.putServiceAccountGrantedPolicies(
            state.organizationId,
            state.targetId,
            {
              grantedProjectPolicies: ofType(policies, "project").map((p) =>
                Object.assign(new GrantedProjectPolicyPermissionDetailsView(), {
                  accessPolicy: { grantedProjectId: p.id, grantedProjectName: p.name, ...flags(p) },
                  hasPermission: true,
                }),
              ),
            },
          );
        }
        return;
      }
      case "secret": {
        if (samePolicies(state.policies, policies)) {
          return;
        }
        const secret = state.secret;
        if (!secret.write) {
          return Response.noEditPermission();
        }
        if ([secret.name, secret.value, secret.note].includes(DECRYPT_ERROR)) {
          return Response.error(
            "The secret could not be decrypted, so its access cannot be changed.",
          );
        }
        await this.secretService.update(
          state.organizationId,
          secret,
          { ...peopleView, serviceAccountAccessPolicies: machineAccountViews },
          false,
        );
        return;
      }
    }
  }

  private fromPeople(view: {
    userAccessPolicies: {
      organizationUserId: string;
      organizationUserName: string;
      read: boolean;
      write: boolean;
    }[];
    groupAccessPolicies: { groupId: string; groupName: string; read: boolean; write: boolean }[];
  }): SmAccessPolicy[] {
    return [
      ...(view.userAccessPolicies ?? []).map((p) => ({
        type: "user" as const,
        id: p.organizationUserId,
        name: p.organizationUserName,
        ...flags(p),
      })),
      ...(view.groupAccessPolicies ?? []).map((p) => ({
        type: "group" as const,
        id: p.groupId,
        name: p.groupName,
        ...flags(p),
      })),
    ];
  }

  private fromMachineAccounts(
    policies: {
      serviceAccountId: string;
      serviceAccountName: string;
      read: boolean;
      write: boolean;
    }[],
  ): SmAccessPolicy[] {
    return (policies ?? []).map((p) => ({
      type: "machineAccount" as const,
      id: p.serviceAccountId,
      name: p.serviceAccountName,
      ...flags(p),
    }));
  }

  static create(serviceContainer: ServiceContainer) {
    return new SmAccessPolicyStore(
      serviceContainer.accessPolicyService,
      serviceContainer.projectService,
      serviceContainer.serviceAccountService,
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
