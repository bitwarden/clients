// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TwoFactorProviderType } from "../../../enums/two-factor-provider-type";

export class TokenTwoFactorRequest {
  constructor(
    public provider: TwoFactorProviderType = null,
    public token: string = null,
    public remember: boolean = false,
  ) {}
}
