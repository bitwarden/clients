// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../models/view/view";
import {
  MemberDecryptionType,
  OpenIdConnectRedirectBehavior,
  Saml2BindingType,
  Saml2NameIdFormat,
  Saml2SigningBehavior,
  SsoType,
} from "../../enums/sso";
import { OrganizationSsoResponse } from "../response/organization-sso.response";

export class SsoConfigView extends View {
  enabled: boolean;
  ssoIdentifier: string;

  configType: SsoType;

  memberDecryptionType: MemberDecryptionType;
  keyConnectorUrl: string;

  openId: {
    authority: string;
    clientId: string;
    clientSecret: string;
    metadataAddress: string;
    redirectBehavior: OpenIdConnectRedirectBehavior;
    getClaimsFromUserInfoEndpoint: boolean;
    additionalScopes: string;
    additionalUserIdClaimTypes: string;
    additionalEmailClaimTypes: string;
    additionalNameClaimTypes: string;
    acrValues: string;
    expectedReturnAcrValue: string;
  };

  saml: {
    spUniqueEntityId: boolean;
    spNameIdFormat: Saml2NameIdFormat;
    spOutboundSigningAlgorithm: string;
    spSigningBehavior: Saml2SigningBehavior;
    spMinIncomingSigningAlgorithm: string;
    spWantAssertionsSigned: boolean;
    spValidateCertificates: boolean;

    idpEntityId: string;
    idpBindingType: Saml2BindingType;
    idpSingleSignOnServiceUrl: string;
    idpSingleLogoutServiceUrl: string;
    idpX509PublicCert: string;
    idpOutboundSigningAlgorithm: string;
    idpAllowUnsolicitedAuthnResponse: boolean;
    idpAllowOutboundLogoutRequests: boolean;
    idpWantAuthnRequestsSigned: boolean;
  };

  constructor(orgSsoResponse: OrganizationSsoResponse) {
    super();

    if (orgSsoResponse == null) {
      return;
    }

    this.enabled = orgSsoResponse.enabled;
    this.ssoIdentifier = orgSsoResponse.identifier;

    if (orgSsoResponse.data == null) {
      return;
    }

    this.configType = orgSsoResponse.data.configType;
    this.memberDecryptionType = orgSsoResponse.data.memberDecryptionType;

    this.keyConnectorUrl = orgSsoResponse.data.keyConnectorUrl;

    if (this.configType === SsoType.OpenIdConnect) {
      this.openId = {
        authority: orgSsoResponse.data.authority,
        clientId: orgSsoResponse.data.clientId,
        clientSecret: orgSsoResponse.data.clientSecret,
        metadataAddress: orgSsoResponse.data.metadataAddress,
        redirectBehavior: orgSsoResponse.data.redirectBehavior,
        getClaimsFromUserInfoEndpoint: orgSsoResponse.data.getClaimsFromUserInfoEndpoint,
        additionalScopes: orgSsoResponse.data.additionalScopes,
        additionalUserIdClaimTypes: orgSsoResponse.data.additionalUserIdClaimTypes,
        additionalEmailClaimTypes: orgSsoResponse.data.additionalEmailClaimTypes,
        additionalNameClaimTypes: orgSsoResponse.data.additionalNameClaimTypes,
        acrValues: orgSsoResponse.data.acrValues,
        expectedReturnAcrValue: orgSsoResponse.data.expectedReturnAcrValue,
      };
    } else if (this.configType === SsoType.Saml2) {
      this.saml = {
        spUniqueEntityId: orgSsoResponse.data.spUniqueEntityId,
        spNameIdFormat: orgSsoResponse.data.spNameIdFormat,
        spOutboundSigningAlgorithm: orgSsoResponse.data.spOutboundSigningAlgorithm,
        spSigningBehavior: orgSsoResponse.data.spSigningBehavior,
        spMinIncomingSigningAlgorithm: orgSsoResponse.data.spMinIncomingSigningAlgorithm,
        spWantAssertionsSigned: orgSsoResponse.data.spWantAssertionsSigned,
        spValidateCertificates: orgSsoResponse.data.spValidateCertificates,

        idpEntityId: orgSsoResponse.data.idpEntityId,
        idpBindingType: orgSsoResponse.data.idpBindingType,
        idpSingleSignOnServiceUrl: orgSsoResponse.data.idpSingleSignOnServiceUrl,
        idpSingleLogoutServiceUrl: orgSsoResponse.data.idpSingleLogoutServiceUrl,
        idpX509PublicCert: orgSsoResponse.data.idpX509PublicCert,
        idpOutboundSigningAlgorithm: orgSsoResponse.data.idpOutboundSigningAlgorithm,
        idpAllowUnsolicitedAuthnResponse: orgSsoResponse.data.idpAllowUnsolicitedAuthnResponse,
        idpWantAuthnRequestsSigned: orgSsoResponse.data.idpWantAuthnRequestsSigned,

        // Value is inverted in the view model (allow instead of disable)
        idpAllowOutboundLogoutRequests:
          orgSsoResponse.data.idpDisableOutboundLogoutRequests == null
            ? null
            : !orgSsoResponse.data.idpDisableOutboundLogoutRequests,
      };
    }
  }
}
