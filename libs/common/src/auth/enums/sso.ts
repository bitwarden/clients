import { MemberDecryptionType as SdkMemberDecryptionType } from "@bitwarden/sdk-internal";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SsoType {
  None = 0,
  OpenIdConnect = 1,
  Saml2 = 2,
}

// Re-export the SdkMemberDecryptionType so we have a single source of truth
export {
  /** @deprecated Import directly from @bitwarden/sdk-internal instead. **/
  SdkMemberDecryptionType as MemberDecryptionType,
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OpenIdConnectRedirectBehavior {
  RedirectGet = 0,
  FormPost = 1,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum Saml2BindingType {
  HttpRedirect = 1,
  HttpPost = 2,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum Saml2NameIdFormat {
  NotConfigured = 0,
  Unspecified = 1,
  EmailAddress = 2,
  X509SubjectName = 3,
  WindowsDomainQualifiedName = 4,
  KerberosPrincipalName = 5,
  EntityIdentifier = 6,
  Persistent = 7,
  Transient = 8,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum Saml2SigningBehavior {
  IfIdpWantAuthnRequestsSigned = 0,
  Always = 1,
  Never = 3,
}
