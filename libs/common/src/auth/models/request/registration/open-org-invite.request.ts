/**
 * Identifying key for an open organization invite link: the target organization and the
 * link's bearer code.
 */
export class OpenOrgInviteRequest {
  constructor(
    public organizationId: string,
    public code: string,
  ) {}
}
