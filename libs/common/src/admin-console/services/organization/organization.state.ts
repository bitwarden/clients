import { Jsonify } from "type-fest";

import { ORGANIZATIONS_DISK, UserKeyDefinition } from "../../../platform/state";
import { OrganizationData } from "../../models/data/organization.data";

/**
 * The `KeyDefinition` for accessing organization lists in application state.
 * @todo Ideally this wouldn't require a `fromJSON()` call, but `OrganizationData`
 * has some properties that contain functions. This should probably get
 * cleaned up.
 */
export const ORGANIZATIONS = UserKeyDefinition.record<OrganizationData>(
  ORGANIZATIONS_DISK,
  "organizations",
  {
    deserializer: (obj: Jsonify<OrganizationData>) => OrganizationData.fromJSON(obj),
    clearOn: ["logout"],
  },
);
