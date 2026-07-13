import { ScimProviderType } from "../../enums";

export class ScimConfigRequest {
  constructor(
    private enabled: boolean,
    private scimProvider: ScimProviderType | undefined = undefined,
    private inviteUsersAfterProvisioning: boolean = true,
  ) {}
}
