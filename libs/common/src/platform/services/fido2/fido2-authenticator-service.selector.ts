import { firstValueFrom, Observable } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { ConfigService } from "../../abstractions/config/config.service";
import {
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "../../abstractions/log.service";

const FLAG_ON_MESSAGE = `${FeatureFlag.PM8313_Fido2OperationsToSdk} enabled. SDK FIDO2 implementation active.`;
const FLAG_OFF_MESSAGE = `${FeatureFlag.PM8313_Fido2OperationsToSdk} disabled. TypeScript FIDO2 implementation active.`;

/**
 * Selects between the TypeScript and SDK FIDO2 authenticators based on
 * {@link FeatureFlag.PM8313_Fido2OperationsToSdk}.
 *
 * With the flag on, `makeCredential` and `getAssertion` throw SDK errors rather than retrying with
 * the TypeScript implementation, since a retry could ask the user to approve the same request twice.
 * `silentCredentialDiscovery` never prompts, so it logs the error and falls back instead: throwing
 * would also cancel the browser's own passkey suggestions on the page.
 */
export class Fido2AuthenticatorServiceSelector<
  ParentWindowReference,
> implements Fido2AuthenticatorService<ParentWindowReference> {
  private readonly useSdk$: Observable<boolean>;

  constructor(
    configService: ConfigService,
    private legacy: Fido2AuthenticatorService<ParentWindowReference>,
    private sdk: Fido2AuthenticatorService<ParentWindowReference>,
    private logService: LogService,
  ) {
    this.useSdk$ = configService.getFeatureFlag$(FeatureFlag.PM8313_Fido2OperationsToSdk);
  }

  async makeCredential(
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorMakeCredentialResult> {
    const service = await this.getService();
    return await service.makeCredential(params, window, abortController);
  }

  async getAssertion(
    params: Fido2AuthenticatorGetAssertionParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ): Promise<Fido2AuthenticatorGetAssertionResult> {
    const service = await this.getService();
    return await service.getAssertion(params, window, abortController);
  }

  async silentCredentialDiscovery(rpId: string): Promise<Fido2CredentialView[]> {
    if (!(await firstValueFrom(this.useSdk$))) {
      return await this.legacy.silentCredentialDiscovery(rpId);
    }

    try {
      return await this.sdk.silentCredentialDiscovery(rpId);
    } catch (error) {
      this.logService.error("SDK silent credential discovery failed, using TypeScript.", error);
      return await this.legacy.silentCredentialDiscovery(rpId);
    }
  }

  private async getService(): Promise<Fido2AuthenticatorService<ParentWindowReference>> {
    const useSdk = await firstValueFrom(this.useSdk$);
    this.logService.info(useSdk ? FLAG_ON_MESSAGE : FLAG_OFF_MESSAGE);
    return useSdk ? this.sdk : this.legacy;
  }
}
