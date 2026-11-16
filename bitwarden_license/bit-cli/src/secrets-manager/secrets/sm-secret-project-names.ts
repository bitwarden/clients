import { ProjectService, SecretProjectView, SecretView } from "@bitwarden/bit-sm";

import { isInSmOrganization, SmOrganization } from "../sm-command.utils";

/**
 * The server returns a created or edited secret's projects without names, or omits them when
 * unchanged. Names come from the request view when it has them, otherwise from a project lookup
 * limited to the organization. A project that can't be resolved keeps a null name.
 */
export async function fillSmSecretProjectNames(
  projectService: ProjectService,
  org: SmOrganization,
  result: SecretView,
  requested: SecretProjectView[],
): Promise<void> {
  const known = new Map<string, string>();
  for (const p of [...(requested ?? []), ...(result.projects ?? [])]) {
    if (p.name) {
      known.set(p.id, p.name);
    }
  }
  const ids = requested.map((p) => p.id);
  if (ids.every((id) => known.has(id))) {
    result.projects = ids.map((id) =>
      Object.assign(new SecretProjectView(), { id, name: known.get(id) }),
    );
    return;
  }

  await Promise.all(
    ids
      .filter((id) => !known.has(id))
      .map(async (id) => {
        try {
          const project = await projectService.getByProjectId(id, true);
          if (isInSmOrganization(project, org) && project.name) {
            known.set(id, project.name);
          }
        } catch {
          // the secret is already saved, so an unresolved name is not an error
        }
      }),
  );
  result.projects = ids.map((id) =>
    Object.assign(new SecretProjectView(), { id, name: known.get(id) ?? null }),
  );
}
