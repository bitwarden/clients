import { OpenShellSandboxCredential } from "../models/openshell-management";

/** Sandboxes whose credentials are looked at; the rest are reported as not checked. */
const MAX_SANDBOXES = 50;
/** Credential reads in flight at once. */
const BATCH = 5;

export interface OpenShellPermissionUsage {
  /** Sandbox names per permission (profile id). */
  sandboxesByProfile: ReadonlyMap<string, string[]>;
  /** `true` when every sandbox was read, so "unused" can be trusted. */
  complete: boolean;
}

/**
 * Which sandboxes use which permission. A permission is shared by every sandbox that has a
 * credential from it, so this answers "what does changing it affect" and "is it safe to delete".
 * Only names and profile ids are read. `null` when the sandbox list itself can't be read.
 */
export async function findOpenShellPermissionUsage(): Promise<OpenShellPermissionUsage | null> {
  const listed = await ipc.agentAccess.listOpenShellSandboxes();
  if (!listed.ok) {
    return null;
  }
  const names = listed.data.map((sandbox) => sandbox.name);
  const checked = names.slice(0, MAX_SANDBOXES);
  const byProfile = new Map<string, string[]>();
  let complete = names.length <= MAX_SANDBOXES;

  for (let i = 0; i < checked.length; i += BATCH) {
    const batch = checked.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((sandboxName) => ipc.agentAccess.listOpenShellCredentials({ sandboxName })),
    );
    results.forEach((result, index) => {
      if (!result.ok) {
        complete = false;
        return;
      }
      for (const profileId of profileIds(result.data)) {
        byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), batch[index]]);
      }
    });
  }
  return { sandboxesByProfile: byProfile, complete };
}

function profileIds(credentials: OpenShellSandboxCredential[]): Set<string> {
  return new Set(credentials.map((c) => c.profileId).filter((id): id is string => id != null));
}
