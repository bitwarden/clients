import { ParamMap } from "@angular/router";

import { isId, OrganizationId } from "@bitwarden/common/types/guid";

/** The route param that makes an import an organization's own, from its admin console. */
export const IMPORT_ORGANIZATION_ID_ROUTE_PARAM = "organizationId";

/** Whose vault the import goes to. The route says which: the personal import has no
 *  `organizationId` segment, an organization's import from its admin console has one. */
export type ImportOwner =
  { kind: "personal" } | { kind: "organization"; organizationId: OrganizationId };

export function importOwnerFromParams(params: ParamMap): ImportOwner {
  const param = params.get(IMPORT_ORGANIZATION_ID_ROUTE_PARAM);
  if (param == null) {
    return { kind: "personal" };
  }
  if (!isId<OrganizationId>(param)) {
    throw new Error(
      `Invalid OrganizationId provided in route parameter \`${IMPORT_ORGANIZATION_ID_ROUTE_PARAM}\``,
    );
  }
  return { kind: "organization", organizationId: param };
}
