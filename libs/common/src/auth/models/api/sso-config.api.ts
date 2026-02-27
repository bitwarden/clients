// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";
import {
  MemberDecryptionType,
  OpenIdConnectRedirectBehavior,
  Saml2BindingType,
  Saml2NameIdFormat,
  Saml2SigningBehavior,
  SsoType,
} from "../../enums/sso";
import { SsoConfigView } from "../view/sso-config.view";

export class SsoConfigApi extends BaseResponse {
  static fromView(view: SsoConfigView, api = new SsoConfigApi()) {
    api.configType = view.configType;
    api.memberDecryptionType = view.memberDecryptionType;

    api.keyConnectorUrl = view.keyConnectorUrl;

    if (api.configType === SsoType.OpenIdConnect) {
      api.authority = view.openId.authority;
      api.clientId = view.openId.clientId;
      api.clientSecret = view.openId.clientSecret;
      api.metadataAddress = view.openId.metadataAddress;
      api.redirectBehavior = view.openId.redirectBehavior;
      api.getClaimsFromUserInfoEndpoint = view.openId.getClaimsFromUserInfoEndpoint;
      api.additionalScopes = view.openId.additionalScopes;
      api.additionalUserIdClaimTypes = view.openId.additionalUserIdClaimTypes;
      api.additionalEmailClaimTypes = view.openId.additionalEmailClaimTypes;
      api.additionalNameClaimTypes = view.openId.additionalNameClaimTypes;
      api.acrValues = view.openId.acrValues;
      api.expectedReturnAcrValue = view.openId.expectedReturnAcrValue;
    } else if (api.configType === SsoType.Saml2) {
      api.spUniqueEntityId = view.saml.spUniqueEntityId;
      api.spNameIdFormat = view.saml.spNameIdFormat;
      api.spOutboundSigningAlgorithm = view.saml.spOutboundSigningAlgorithm;
      api.spSigningBehavior = view.saml.spSigningBehavior;
      api.spMinIncomingSigningAlgorithm = view.saml.spMinIncomingSigningAlgorithm;
      api.spWantAssertionsSigned = view.saml.spWantAssertionsSigned;
      api.spValidateCertificates = view.saml.spValidateCertificates;

      api.idpEntityId = view.saml.idpEntityId;
      api.idpBindingType = view.saml.idpBindingType;
      api.idpSingleSignOnServiceUrl = view.saml.idpSingleSignOnServiceUrl;
      api.idpSingleLogoutServiceUrl = view.saml.idpSingleLogoutServiceUrl;
      api.idpX509PublicCert = view.saml.idpX509PublicCert;
      api.idpOutboundSigningAlgorithm = view.saml.idpOutboundSigningAlgorithm;
      api.idpAllowUnsolicitedAuthnResponse = view.saml.idpAllowUnsolicitedAuthnResponse;
      api.idpWantAuthnRequestsSigned = view.saml.idpWantAuthnRequestsSigned;

      // Value is inverted in the api model (disable instead of allow)
      api.idpDisableOutboundLogoutRequests = !view.saml.idpAllowOutboundLogoutRequests;
    }

    return api;
  }
  configType: SsoType;
  memberDecryptionType: MemberDecryptionType;

  keyConnectorUrl: string;

  // OpenId
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

  // SAML
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
  idpDisableOutboundLogoutRequests: boolean;
  idpWantAuthnRequestsSigned: boolean;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.configType = this.getResponseProperty("ConfigType");
    this.memberDecryptionType = this.getResponseProperty("MemberDecryptionType");

    this.keyConnectorUrl = this.getResponseProperty("KeyConnectorUrl");

    this.authority = this.getResponseProperty("Authority");
    this.clientId = this.getResponseProperty("ClientId");
    this.clientSecret = this.getResponseProperty("ClientSecret");
    this.metadataAddress = this.getResponseProperty("MetadataAddress");
    this.redirectBehavior = this.getResponseProperty("RedirectBehavior");
    this.getClaimsFromUserInfoEndpoint = this.getResponseProperty("GetClaimsFromUserInfoEndpoint");
    this.additionalScopes = this.getResponseProperty("AdditionalScopes");
    this.additionalUserIdClaimTypes = this.getResponseProperty("AdditionalUserIdClaimTypes");
    this.additionalEmailClaimTypes = this.getResponseProperty("AdditionalEmailClaimTypes");
    this.additionalNameClaimTypes = this.getResponseProperty("AdditionalNameClaimTypes");
    this.acrValues = this.getResponseProperty("AcrValues");
    this.expectedReturnAcrValue = this.getResponseProperty("ExpectedReturnAcrValue");

    this.spUniqueEntityId = this.getResponseProperty("SpUniqueEntityId");
    this.spNameIdFormat = this.getResponseProperty("SpNameIdFormat");
    this.spOutboundSigningAlgorithm = this.getResponseProperty("SpOutboundSigningAlgorithm");
    this.spSigningBehavior = this.getResponseProperty("SpSigningBehavior");
    this.spMinIncomingSigningAlgorithm = this.getResponseProperty("SpMinIncomingSigningAlgorithm");
    this.spWantAssertionsSigned = this.getResponseProperty("SpWantAssertionsSigned");
    this.spValidateCertificates = this.getResponseProperty("SpValidateCertificates");

    this.idpEntityId = this.getResponseProperty("IdpEntityId");
    this.idpBindingType = this.getResponseProperty("IdpBindingType");
    this.idpSingleSignOnServiceUrl = this.getResponseProperty("IdpSingleSignOnServiceUrl");
    this.idpSingleLogoutServiceUrl = this.getResponseProperty("IdpSingleLogoutServiceUrl");
    this.idpX509PublicCert = this.getResponseProperty("IdpX509PublicCert");
    this.idpOutboundSigningAlgorithm = this.getResponseProperty("IdpOutboundSigningAlgorithm");
    this.idpAllowUnsolicitedAuthnResponse = this.getResponseProperty(
      "IdpAllowUnsolicitedAuthnResponse",
    );
    this.idpDisableOutboundLogoutRequests = this.getResponseProperty(
      "IdpDisableOutboundLogoutRequests",
    );
    this.idpWantAuthnRequestsSigned = this.getResponseProperty("IdpWantAuthnRequestsSigned");
  }
}
