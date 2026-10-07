import {
  OpenShellAddCredentialRequest,
  OpenShellManagementResult,
  OpenShellProfileCredential,
  OpenShellProviderProfile,
} from "../models/openshell-management";

/** Provider-name suffixes tried when `<profile>-<sandbox>` is already taken. */
const MAX_NAME_ATTEMPTS = 5;

/** The profile credential a single chosen secret fills: the first required one, else the first. */
export function slotFor(profile: OpenShellProviderProfile): OpenShellProfileCredential | null {
  return profile.credentials.find((c) => c.required) ?? profile.credentials[0] ?? null;
}

/** A profile one secret can satisfy: it has a slot and no second required credential. */
export function isSingleSecretProfile(profile: OpenShellProviderProfile): boolean {
  return slotFor(profile) != null && profile.credentials.filter((c) => c.required).length <= 1;
}

/**
 * Adds a credential under `<profile>-<sandbox>`, or `-2`, `-3`... when that name is taken, so more
 * than one secret can share a permission in one sandbox. Any other failure is returned as is.
 */
export async function addOpenShellCredentialUnique(
  request: Omit<OpenShellAddCredentialRequest, "providerName">,
): Promise<OpenShellManagementResult<void>> {
  const base = `${request.profileId}-${request.sandboxName}`;
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    // Main would derive the first name itself; later ones need a suffix to stay unique.
    const result = await ipc.agentAccess.addOpenShellCredential({
      ...request,
      ...(attempt > 1 ? { providerName: `${base}-${attempt}` } : {}),
    });
    if (result.ok || result.error !== "alreadyExists") {
      return result;
    }
  }
  return { ok: false, error: "alreadyExists" };
}
