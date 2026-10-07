import {
  OpenShellEnvironment,
  OpenShellMetaColor,
  OpenShellSecretRef,
  OpenShellSecretSet,
} from "../models/openshell-environments";
import {
  OpenShellManagementError,
  OpenShellManagementResult,
  OpenShellSandboxCredential,
} from "../models/openshell-management";

import { addOpenShellCredentialUnique } from "./openshell-profile.util";

/** Static class names (Tailwind only emits what it can see) and i18n keys for the accent palette. */
export const OPENSHELL_META_COLOR_CLASS: Record<OpenShellMetaColor, string> = {
  blue: "tw-bg-primary-600",
  green: "tw-bg-success-600",
  amber: "tw-bg-warning-600",
  red: "tw-bg-danger-600",
  gray: "tw-bg-secondary-600",
};

export const OPENSHELL_META_COLOR_KEY: Record<OpenShellMetaColor, string> = {
  blue: "agentAccessOsMetaColorBlue",
  green: "agentAccessOsMetaColorGreen",
  amber: "agentAccessOsMetaColorAmber",
  red: "agentAccessOsMetaColorRed",
  gray: "agentAccessOsMetaColorGray",
};

/**
 * The secret refs of a sandbox's current credentials. Only a credential this app created with
 * exactly one binding can be captured (the gateway strips the vault reference, so anything else
 * has no ids to save); the rest are counted in `skipped` so the UI can say so. Two bindings with
 * the same env var keep the first.
 */
export function secretRefsFromCredentials(credentials: OpenShellSandboxCredential[]): {
  refs: OpenShellSecretRef[];
  skipped: number;
} {
  const refs: OpenShellSecretRef[] = [];
  const envVars = new Set<string>();
  let skipped = 0;
  for (const credential of credentials) {
    const binding = credential.bindings[0];
    if (
      !credential.managed ||
      credential.bindings.length !== 1 ||
      credential.profileId == null ||
      binding == null ||
      envVars.has(binding.envVar)
    ) {
      skipped++;
      continue;
    }
    envVars.add(binding.envVar);
    refs.push({
      resourceType: binding.resourceType,
      id: binding.id,
      field: binding.field,
      label: binding.label,
      profileId: credential.profileId,
      envVar: binding.envVar,
    });
  }
  return { refs, skipped };
}

/** The refs an environment gives a sandbox: its inline refs, or its set's. `null` when the set is gone. */
export function secretRefsOfEnvironment(
  environment: OpenShellEnvironment,
  sets: OpenShellSecretSet[],
): OpenShellSecretRef[] | null {
  if (environment.secretSetId != null) {
    return sets.find((set) => set.id === environment.secretSetId)?.secrets ?? null;
  }
  return environment.secrets ?? [];
}

export interface OpenShellSecretFailure {
  /** The secret's display label. */
  label: string;
  error: OpenShellManagementError;
  /** Scrubbed gateway text, rendered as text only. */
  message?: string;
}

export interface OpenShellApplySecretsResult {
  added: number;
  failures: OpenShellSecretFailure[];
}

/**
 * Adds refs to a sandbox one at a time, so a failure leaves a clear line between what was added and
 * what was not. A failure does not stop the rest: each is reported. Only ids, field and env var
 * names and labels are sent; main builds every reference.
 */
export async function applyOpenShellSecretRefs(
  sandboxName: string,
  refs: OpenShellSecretRef[],
): Promise<OpenShellApplySecretsResult> {
  const result: OpenShellApplySecretsResult = { added: 0, failures: [] };
  for (const ref of refs) {
    const added: OpenShellManagementResult<void> = await addOpenShellCredentialUnique({
      sandboxName,
      profileId: ref.profileId,
      bindings: [
        {
          envVar: ref.envVar,
          resourceType: ref.resourceType,
          id: ref.id,
          field: ref.field,
          label: ref.label,
        },
      ],
    });
    if (added.ok) {
      result.added++;
    } else {
      result.failures.push({ label: ref.label, error: added.error, message: added.message });
    }
  }
  return result;
}

/** Best effort: the metadata of a deleted sandbox is removed, and a failure is never surfaced. */
export async function clearOpenShellSandboxMeta(name: string): Promise<void> {
  try {
    await ipc.agentAccess.setOpenShellSandboxMeta({ name, purpose: "", color: null });
  } catch {
    // The entry is a few bytes of display text; it will be overwritten by a sandbox of that name.
  }
}
