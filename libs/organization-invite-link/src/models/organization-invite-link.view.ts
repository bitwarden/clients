import { Jsonify } from "type-fest";

import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationInviteLinkView as SdkOrganizationInviteLinkView } from "@bitwarden/sdk-internal";

/**
 * Client-side view of an organization invite link, mirroring the SDK's
 * `OrganizationInviteLinkView`. The SDK returns a `urlFragment`; the service combines it with the
 * web vault URL and stores the resulting full {@link url} for direct display.
 */
export class OrganizationInviteLinkView {
  /** The unique identifier of the invite link. */
  id: string;
  /** The identifier of the organization that owns the invite link. */
  organizationId: string;
  /** The email domains permitted to use the invite link. */
  allowedDomains: string[];
  /** Whether this invite link can be used to confirm a user. */
  supportsConfirmation: boolean;
  /** The ISO-8601 date the invite link was created. */
  creationDate: string;
  /** The full, shareable invite link URL. */
  url: string;

  constructor(init: Jsonify<OrganizationInviteLinkView>) {
    this.id = init.id;
    this.organizationId = init.organizationId;
    this.allowedDomains = init.allowedDomains;
    this.supportsConfirmation = init.supportsConfirmation;
    this.creationDate = init.creationDate;
    this.url = init.url;
  }

  static fromJSON(obj: Jsonify<OrganizationInviteLinkView>): OrganizationInviteLinkView {
    return Object.assign(new OrganizationInviteLinkView(obj as any), obj);
  }

  static fromSdk(obj: SdkOrganizationInviteLinkView, url: string): OrganizationInviteLinkView {
    return new OrganizationInviteLinkView({
      id: uuidAsString(obj.id),
      organizationId: uuidAsString(obj.organizationId),
      allowedDomains: obj.allowedDomains,
      supportsConfirmation: obj.supportsConfirmation,
      creationDate: obj.creationDate,
      url,
    });
  }
}
