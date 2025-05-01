// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ScimProviderType } from "../../enums";

export class ScimConfigRequest {
  constructor(
    private enabled: boolean,
    private scimProvider: ScimProviderType = null,
  ) {}
}
