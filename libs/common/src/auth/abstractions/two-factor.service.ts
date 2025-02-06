// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";

export interface TwoFactorProviderDetails {
  type: TwoFactorProviderType;
  name: string;
  description: string;
  priority: number;
  sort: number;
  premium: boolean;
}
export abstract class TwoFactorService {
  abstract init(): void;

  abstract getSupportedProviders(win: Window): Promise<TwoFactorProviderDetails[]>;

  abstract getDefaultProvider(webAuthnSupported: boolean): Promise<TwoFactorProviderType>;

  abstract setSelectedProvider(type: TwoFactorProviderType): Promise<void>;

  abstract clearSelectedProvider(): Promise<void>;

  abstract setProviders(response: IdentityTwoFactorResponse): Promise<void>;

  abstract clearProviders(): Promise<void>;

  abstract getProviders(): Promise<Map<TwoFactorProviderType, { [key: string]: string }> | null>;
}
