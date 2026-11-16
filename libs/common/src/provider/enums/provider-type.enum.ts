import { ProviderType as SdkProviderType } from "@bitwarden/sdk-internal";

// Re-export the SdkProviderType so we have a single source of truth
export {
  /** @deprecated Import directly from @bitwarden/sdk-internal instead. **/
  SdkProviderType as ProviderType,
};
