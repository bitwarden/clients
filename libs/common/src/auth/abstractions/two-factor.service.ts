import { Observable } from "rxjs";

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
  providers$: Observable<Map<TwoFactorProviderType, { [key: string]: string }>>;
  selected$: Observable<TwoFactorProviderType>;
  getSupportedProviders$: (win: Window) => Observable<TwoFactorProviderDetails[]>;
  getDefaultProvider$: (webAuthnSupported: boolean) => Observable<TwoFactorProviderType>;
  setSelectedProvider: (type: TwoFactorProviderType) => Promise<void>;
  clearSelectedProvider: () => Promise<void>;

  setProviders: (response: IdentityTwoFactorResponse) => Promise<void>;
  clearProviders: () => Promise<void>;
  getProviders: () => Promise<Map<TwoFactorProviderType, { [key: string]: string }>>;
}
