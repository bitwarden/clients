import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
import { TypedKey } from "./enterprise";
import { AppClientType } from "./enterprise";
import { KeyType } from "./enterprise";
import { EnterpriseRegistration } from "./enterprise";
import { EncryptedKeyType } from "./enterprise";
/**
 * @generated from protobuf enum Authentication.SupportedLanguage
 */
export var SupportedLanguage;
(function (SupportedLanguage) {
  /**
   * @generated from protobuf enum value: ENGLISH = 0;
   */
  SupportedLanguage[(SupportedLanguage["ENGLISH"] = 0)] = "ENGLISH";
  /**
   * @generated from protobuf enum value: ARABIC = 1;
   */
  SupportedLanguage[(SupportedLanguage["ARABIC"] = 1)] = "ARABIC";
  /**
   * @generated from protobuf enum value: BRITISH = 2;
   */
  SupportedLanguage[(SupportedLanguage["BRITISH"] = 2)] = "BRITISH";
  /**
   * @generated from protobuf enum value: CHINESE = 3;
   */
  SupportedLanguage[(SupportedLanguage["CHINESE"] = 3)] = "CHINESE";
  /**
   * @generated from protobuf enum value: CHINESE_HONG_KONG = 4;
   */
  SupportedLanguage[(SupportedLanguage["CHINESE_HONG_KONG"] = 4)] = "CHINESE_HONG_KONG";
  /**
   * @generated from protobuf enum value: CHINESE_TAIWAN = 5;
   */
  SupportedLanguage[(SupportedLanguage["CHINESE_TAIWAN"] = 5)] = "CHINESE_TAIWAN";
  /**
   * @generated from protobuf enum value: DUTCH = 6;
   */
  SupportedLanguage[(SupportedLanguage["DUTCH"] = 6)] = "DUTCH";
  /**
   * @generated from protobuf enum value: FRENCH = 7;
   */
  SupportedLanguage[(SupportedLanguage["FRENCH"] = 7)] = "FRENCH";
  /**
   * @generated from protobuf enum value: GERMAN = 8;
   */
  SupportedLanguage[(SupportedLanguage["GERMAN"] = 8)] = "GERMAN";
  /**
   * @generated from protobuf enum value: GREEK = 9;
   */
  SupportedLanguage[(SupportedLanguage["GREEK"] = 9)] = "GREEK";
  /**
   * @generated from protobuf enum value: HEBREW = 10;
   */
  SupportedLanguage[(SupportedLanguage["HEBREW"] = 10)] = "HEBREW";
  /**
   * @generated from protobuf enum value: ITALIAN = 11;
   */
  SupportedLanguage[(SupportedLanguage["ITALIAN"] = 11)] = "ITALIAN";
  /**
   * @generated from protobuf enum value: JAPANESE = 12;
   */
  SupportedLanguage[(SupportedLanguage["JAPANESE"] = 12)] = "JAPANESE";
  /**
   * @generated from protobuf enum value: KOREAN = 13;
   */
  SupportedLanguage[(SupportedLanguage["KOREAN"] = 13)] = "KOREAN";
  /**
   * @generated from protobuf enum value: POLISH = 14;
   */
  SupportedLanguage[(SupportedLanguage["POLISH"] = 14)] = "POLISH";
  /**
   * @generated from protobuf enum value: PORTUGUESE = 15;
   */
  SupportedLanguage[(SupportedLanguage["PORTUGUESE"] = 15)] = "PORTUGUESE";
  /**
   * @generated from protobuf enum value: PORTUGUESE_BRAZIL = 16;
   */
  SupportedLanguage[(SupportedLanguage["PORTUGUESE_BRAZIL"] = 16)] = "PORTUGUESE_BRAZIL";
  /**
   * @generated from protobuf enum value: ROMANIAN = 17;
   */
  SupportedLanguage[(SupportedLanguage["ROMANIAN"] = 17)] = "ROMANIAN";
  /**
   * @generated from protobuf enum value: RUSSIAN = 18;
   */
  SupportedLanguage[(SupportedLanguage["RUSSIAN"] = 18)] = "RUSSIAN";
  /**
   * @generated from protobuf enum value: SLOVAK = 19;
   */
  SupportedLanguage[(SupportedLanguage["SLOVAK"] = 19)] = "SLOVAK";
  /**
   * @generated from protobuf enum value: SPANISH = 20;
   */
  SupportedLanguage[(SupportedLanguage["SPANISH"] = 20)] = "SPANISH";
  /**
   * @generated from protobuf enum value: FINNISH = 21;
   */
  SupportedLanguage[(SupportedLanguage["FINNISH"] = 21)] = "FINNISH";
  /**
   * @generated from protobuf enum value: SWEDISH = 22;
   */
  SupportedLanguage[(SupportedLanguage["SWEDISH"] = 22)] = "SWEDISH";
})(SupportedLanguage || (SupportedLanguage = {}));
/**
 * @generated from protobuf enum Authentication.LoginType
 */
export var LoginType;
(function (LoginType) {
  /**
   * @generated from protobuf enum value: NORMAL = 0;
   */
  LoginType[(LoginType["NORMAL"] = 0)] = "NORMAL";
  /**
   * @generated from protobuf enum value: SSO = 1;
   */
  LoginType[(LoginType["SSO"] = 1)] = "SSO";
  /**
   * @generated from protobuf enum value: BIO = 2;
   */
  LoginType[(LoginType["BIO"] = 2)] = "BIO";
  /**
   * @generated from protobuf enum value: ALTERNATE = 3;
   */
  LoginType[(LoginType["ALTERNATE"] = 3)] = "ALTERNATE";
  /**
   * @generated from protobuf enum value: OFFLINE = 4;
   */
  LoginType[(LoginType["OFFLINE"] = 4)] = "OFFLINE";
  /**
   * @generated from protobuf enum value: FORGOT_PASSWORD = 5;
   */
  LoginType[(LoginType["FORGOT_PASSWORD"] = 5)] = "FORGOT_PASSWORD";
  /**
   * @generated from protobuf enum value: PASSKEY_BIO = 6;
   */
  LoginType[(LoginType["PASSKEY_BIO"] = 6)] = "PASSKEY_BIO";
})(LoginType || (LoginType = {}));
/**
 * @generated from protobuf enum Authentication.DeviceStatus
 */
export var DeviceStatus;
(function (DeviceStatus) {
  /**
   * @generated from protobuf enum value: DEVICE_NEEDS_APPROVAL = 0;
   */
  DeviceStatus[(DeviceStatus["DEVICE_NEEDS_APPROVAL"] = 0)] = "DEVICE_NEEDS_APPROVAL";
  /**
   * @generated from protobuf enum value: DEVICE_OK = 1;
   */
  DeviceStatus[(DeviceStatus["DEVICE_OK"] = 1)] = "DEVICE_OK";
  /**
   * @generated from protobuf enum value: DEVICE_DISABLED_BY_USER = 2;
   */
  DeviceStatus[(DeviceStatus["DEVICE_DISABLED_BY_USER"] = 2)] = "DEVICE_DISABLED_BY_USER";
  /**
   * @generated from protobuf enum value: DEVICE_LOCKED_BY_ADMIN = 3;
   */
  DeviceStatus[(DeviceStatus["DEVICE_LOCKED_BY_ADMIN"] = 3)] = "DEVICE_LOCKED_BY_ADMIN";
})(DeviceStatus || (DeviceStatus = {}));
/**
 * @generated from protobuf enum Authentication.LicenseStatus
 */
export var LicenseStatus;
(function (LicenseStatus) {
  /**
   * @generated from protobuf enum value: OTHER = 0;
   */
  LicenseStatus[(LicenseStatus["OTHER"] = 0)] = "OTHER";
  /**
   * @generated from protobuf enum value: ACTIVE = 1;
   */
  LicenseStatus[(LicenseStatus["ACTIVE"] = 1)] = "ACTIVE";
  /**
   * @generated from protobuf enum value: EXPIRED = 2;
   */
  LicenseStatus[(LicenseStatus["EXPIRED"] = 2)] = "EXPIRED";
  /**
   * @generated from protobuf enum value: DISABLED = 3;
   */
  LicenseStatus[(LicenseStatus["DISABLED"] = 3)] = "DISABLED";
})(LicenseStatus || (LicenseStatus = {}));
/**
 * @generated from protobuf enum Authentication.AccountType
 */
export var AccountType;
(function (AccountType) {
  /**
   * @generated from protobuf enum value: CONSUMER = 0;
   */
  AccountType[(AccountType["CONSUMER"] = 0)] = "CONSUMER";
  /**
   * @generated from protobuf enum value: FAMILY = 1;
   */
  AccountType[(AccountType["FAMILY"] = 1)] = "FAMILY";
  /**
   * @generated from protobuf enum value: ENTERPRISE = 2;
   */
  AccountType[(AccountType["ENTERPRISE"] = 2)] = "ENTERPRISE";
})(AccountType || (AccountType = {}));
/**
 * @generated from protobuf enum Authentication.SessionTokenType
 */
export var SessionTokenType;
(function (SessionTokenType) {
  /**
   * @generated from protobuf enum value: NO_RESTRICTION = 0;
   */
  SessionTokenType[(SessionTokenType["NO_RESTRICTION"] = 0)] = "NO_RESTRICTION";
  /**
   * @generated from protobuf enum value: ACCOUNT_RECOVERY = 1;
   */
  SessionTokenType[(SessionTokenType["ACCOUNT_RECOVERY"] = 1)] = "ACCOUNT_RECOVERY";
  /**
   * @generated from protobuf enum value: SHARE_ACCOUNT = 2;
   */
  SessionTokenType[(SessionTokenType["SHARE_ACCOUNT"] = 2)] = "SHARE_ACCOUNT";
  /**
   * @generated from protobuf enum value: PURCHASE = 3;
   */
  SessionTokenType[(SessionTokenType["PURCHASE"] = 3)] = "PURCHASE";
  /**
   * @generated from protobuf enum value: RESTRICT = 4;
   */
  SessionTokenType[(SessionTokenType["RESTRICT"] = 4)] = "RESTRICT";
  /**
   * @generated from protobuf enum value: ACCEPT_INVITE = 5;
   */
  SessionTokenType[(SessionTokenType["ACCEPT_INVITE"] = 5)] = "ACCEPT_INVITE";
  /**
   * @generated from protobuf enum value: SUPPORT_SERVER = 6;
   */
  SessionTokenType[(SessionTokenType["SUPPORT_SERVER"] = 6)] = "SUPPORT_SERVER";
  /**
   * @generated from protobuf enum value: ENTERPRISE_CREATION = 7;
   */
  SessionTokenType[(SessionTokenType["ENTERPRISE_CREATION"] = 7)] = "ENTERPRISE_CREATION";
  /**
   * @generated from protobuf enum value: EXPIRED_BUT_ALLOWED_TO_SYNC = 8;
   */
  SessionTokenType[(SessionTokenType["EXPIRED_BUT_ALLOWED_TO_SYNC"] = 8)] =
    "EXPIRED_BUT_ALLOWED_TO_SYNC";
  /**
   * @generated from protobuf enum value: ACCEPT_FAMILY_INVITE = 9;
   */
  SessionTokenType[(SessionTokenType["ACCEPT_FAMILY_INVITE"] = 9)] = "ACCEPT_FAMILY_INVITE";
  /**
   * @generated from protobuf enum value: ENTERPRISE_CREATION_PURCHASED = 10;
   */
  SessionTokenType[(SessionTokenType["ENTERPRISE_CREATION_PURCHASED"] = 10)] =
    "ENTERPRISE_CREATION_PURCHASED";
  /**
   * @generated from protobuf enum value: EMERGENCY_ACCESS = 11;
   */
  SessionTokenType[(SessionTokenType["EMERGENCY_ACCESS"] = 11)] = "EMERGENCY_ACCESS";
})(SessionTokenType || (SessionTokenType = {}));
/**
 * @generated from protobuf enum Authentication.Version
 */
export var Version;
(function (Version) {
  /**
   * @generated from protobuf enum value: invalid_version = 0;
   */
  Version[(Version["invalid_version"] = 0)] = "invalid_version";
  /**
   * @generated from protobuf enum value: default_version = 1;
   */
  Version[(Version["default_version"] = 1)] = "default_version";
  /**
   * @generated from protobuf enum value: second_version = 2;
   */
  Version[(Version["second_version"] = 2)] = "second_version";
})(Version || (Version = {}));
/**
 * @generated from protobuf enum Authentication.MasterPasswordReentryActionType
 */
export var MasterPasswordReentryActionType;
(function (MasterPasswordReentryActionType) {
  /**
   * @generated from protobuf enum value: UNMASK = 0;
   */
  MasterPasswordReentryActionType[(MasterPasswordReentryActionType["UNMASK"] = 0)] = "UNMASK";
  /**
   * @generated from protobuf enum value: COPY = 1;
   */
  MasterPasswordReentryActionType[(MasterPasswordReentryActionType["COPY"] = 1)] = "COPY";
})(MasterPasswordReentryActionType || (MasterPasswordReentryActionType = {}));
/**
 * @generated from protobuf enum Authentication.LoginMethod
 */
export var LoginMethod;
(function (LoginMethod) {
  /**
   * @generated from protobuf enum value: INVALID_LOGINMETHOD = 0;
   */
  LoginMethod[(LoginMethod["INVALID_LOGINMETHOD"] = 0)] = "INVALID_LOGINMETHOD";
  /**
   * @generated from protobuf enum value: EXISTING_ACCOUNT = 1;
   */
  LoginMethod[(LoginMethod["EXISTING_ACCOUNT"] = 1)] = "EXISTING_ACCOUNT";
  /**
   * @generated from protobuf enum value: SSO_DOMAIN = 2;
   */
  LoginMethod[(LoginMethod["SSO_DOMAIN"] = 2)] = "SSO_DOMAIN";
  /**
   * @generated from protobuf enum value: AFTER_SSO = 3;
   */
  LoginMethod[(LoginMethod["AFTER_SSO"] = 3)] = "AFTER_SSO";
  /**
   * @generated from protobuf enum value: NEW_ACCOUNT = 4;
   */
  LoginMethod[(LoginMethod["NEW_ACCOUNT"] = 4)] = "NEW_ACCOUNT";
})(LoginMethod || (LoginMethod = {}));
/**
 * @generated from protobuf enum Authentication.LoginState
 */
export var LoginState;
(function (LoginState) {
  /**
   * @generated from protobuf enum value: INVALID_LOGINSTATE = 0;
   */
  LoginState[(LoginState["INVALID_LOGINSTATE"] = 0)] = "INVALID_LOGINSTATE";
  /**
   * @generated from protobuf enum value: LOGGED_OUT = 1;
   */
  LoginState[(LoginState["LOGGED_OUT"] = 1)] = "LOGGED_OUT";
  /**
   * @generated from protobuf enum value: DEVICE_APPROVAL_REQUIRED = 2;
   */
  LoginState[(LoginState["DEVICE_APPROVAL_REQUIRED"] = 2)] = "DEVICE_APPROVAL_REQUIRED";
  /**
   * @generated from protobuf enum value: DEVICE_LOCKED = 3;
   */
  LoginState[(LoginState["DEVICE_LOCKED"] = 3)] = "DEVICE_LOCKED";
  /**
   * @generated from protobuf enum value: ACCOUNT_LOCKED = 4;
   */
  LoginState[(LoginState["ACCOUNT_LOCKED"] = 4)] = "ACCOUNT_LOCKED";
  /**
   * @generated from protobuf enum value: DEVICE_ACCOUNT_LOCKED = 5;
   */
  LoginState[(LoginState["DEVICE_ACCOUNT_LOCKED"] = 5)] = "DEVICE_ACCOUNT_LOCKED";
  /**
   * @generated from protobuf enum value: UPGRADE = 6;
   */
  LoginState[(LoginState["UPGRADE"] = 6)] = "UPGRADE";
  /**
   * @generated from protobuf enum value: LICENSE_EXPIRED = 7;
   */
  LoginState[(LoginState["LICENSE_EXPIRED"] = 7)] = "LICENSE_EXPIRED";
  /**
   * @generated from protobuf enum value: REGION_REDIRECT = 8;
   */
  LoginState[(LoginState["REGION_REDIRECT"] = 8)] = "REGION_REDIRECT";
  /**
   * @generated from protobuf enum value: REDIRECT_CLOUD_SSO = 9;
   */
  LoginState[(LoginState["REDIRECT_CLOUD_SSO"] = 9)] = "REDIRECT_CLOUD_SSO";
  /**
   * @generated from protobuf enum value: REDIRECT_ONSITE_SSO = 10;
   */
  LoginState[(LoginState["REDIRECT_ONSITE_SSO"] = 10)] = "REDIRECT_ONSITE_SSO";
  /**
   * @generated from protobuf enum value: REQUIRES_2FA = 12;
   */
  LoginState[(LoginState["REQUIRES_2FA"] = 12)] = "REQUIRES_2FA";
  /**
   * @generated from protobuf enum value: REQUIRES_AUTH_HASH = 13;
   */
  LoginState[(LoginState["REQUIRES_AUTH_HASH"] = 13)] = "REQUIRES_AUTH_HASH";
  /**
   * @generated from protobuf enum value: REQUIRES_USERNAME = 14;
   */
  LoginState[(LoginState["REQUIRES_USERNAME"] = 14)] = "REQUIRES_USERNAME";
  /**
   * @generated from protobuf enum value: AFTER_CLOUD_SSO_LOGIN = 15;
   */
  LoginState[(LoginState["AFTER_CLOUD_SSO_LOGIN"] = 15)] = "AFTER_CLOUD_SSO_LOGIN";
  /**
   * @generated from protobuf enum value: REQUIRES_ACCOUNT_CREATION = 16;
   */
  LoginState[(LoginState["REQUIRES_ACCOUNT_CREATION"] = 16)] = "REQUIRES_ACCOUNT_CREATION";
  /**
   * @generated from protobuf enum value: REQUIRES_DEVICE_ENCRYPTED_DATA_KEY = 17;
   */
  LoginState[(LoginState["REQUIRES_DEVICE_ENCRYPTED_DATA_KEY"] = 17)] =
    "REQUIRES_DEVICE_ENCRYPTED_DATA_KEY";
  /**
   * @generated from protobuf enum value: LOGIN_TOKEN_EXPIRED = 18;
   */
  LoginState[(LoginState["LOGIN_TOKEN_EXPIRED"] = 18)] = "LOGIN_TOKEN_EXPIRED";
  /**
   * @generated from protobuf enum value: PASSKEY_INITIATE_CHALLENGE = 19;
   */
  LoginState[(LoginState["PASSKEY_INITIATE_CHALLENGE"] = 19)] = "PASSKEY_INITIATE_CHALLENGE";
  /**
   * @generated from protobuf enum value: PASSKEY_AUTH_REQUIRED = 20;
   */
  LoginState[(LoginState["PASSKEY_AUTH_REQUIRED"] = 20)] = "PASSKEY_AUTH_REQUIRED";
  /**
   * @generated from protobuf enum value: PASSKEY_VERIFY_AUTHENTICATION = 21;
   */
  LoginState[(LoginState["PASSKEY_VERIFY_AUTHENTICATION"] = 21)] = "PASSKEY_VERIFY_AUTHENTICATION";
  /**
   * @generated from protobuf enum value: AFTER_PASSKEY_LOGIN = 22;
   */
  LoginState[(LoginState["AFTER_PASSKEY_LOGIN"] = 22)] = "AFTER_PASSKEY_LOGIN";
  /**
   * @generated from protobuf enum value: LOGGED_IN = 99;
   */
  LoginState[(LoginState["LOGGED_IN"] = 99)] = "LOGGED_IN";
})(LoginState || (LoginState = {}));
/**
 * @generated from protobuf enum Authentication.EncryptedDataKeyType
 */
export var EncryptedDataKeyType;
(function (EncryptedDataKeyType) {
  /**
   * @generated from protobuf enum value: NO_KEY = 0;
   */
  EncryptedDataKeyType[(EncryptedDataKeyType["NO_KEY"] = 0)] = "NO_KEY";
  /**
   * @generated from protobuf enum value: BY_DEVICE_PUBLIC_KEY = 1;
   */
  EncryptedDataKeyType[(EncryptedDataKeyType["BY_DEVICE_PUBLIC_KEY"] = 1)] = "BY_DEVICE_PUBLIC_KEY";
  /**
   * @generated from protobuf enum value: BY_PASSWORD = 2;
   */
  EncryptedDataKeyType[(EncryptedDataKeyType["BY_PASSWORD"] = 2)] = "BY_PASSWORD";
  /**
   * @generated from protobuf enum value: BY_ALTERNATE = 3;
   */
  EncryptedDataKeyType[(EncryptedDataKeyType["BY_ALTERNATE"] = 3)] = "BY_ALTERNATE";
  /**
   * @generated from protobuf enum value: BY_BIO = 4;
   */
  EncryptedDataKeyType[(EncryptedDataKeyType["BY_BIO"] = 4)] = "BY_BIO";
})(EncryptedDataKeyType || (EncryptedDataKeyType = {}));
/**
 * @generated from protobuf enum Authentication.PasswordMethod
 */
export var PasswordMethod;
(function (PasswordMethod) {
  /**
   * @generated from protobuf enum value: ENTERED = 0;
   */
  PasswordMethod[(PasswordMethod["ENTERED"] = 0)] = "ENTERED";
  /**
   * @generated from protobuf enum value: BIOMETRICS = 1;
   */
  PasswordMethod[(PasswordMethod["BIOMETRICS"] = 1)] = "BIOMETRICS";
})(PasswordMethod || (PasswordMethod = {}));
/**
 * @generated from protobuf enum Authentication.TwoFactorPushType
 */
export var TwoFactorPushType;
(function (TwoFactorPushType) {
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_NONE = 0;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_NONE"] = 0)] = "TWO_FA_PUSH_NONE";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_SMS = 1;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_SMS"] = 1)] = "TWO_FA_PUSH_SMS";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_KEEPER = 2;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_KEEPER"] = 2)] = "TWO_FA_PUSH_KEEPER";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_DUO_PUSH = 3;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_DUO_PUSH"] = 3)] = "TWO_FA_PUSH_DUO_PUSH";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_DUO_TEXT = 4;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_DUO_TEXT"] = 4)] = "TWO_FA_PUSH_DUO_TEXT";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_DUO_CALL = 5;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_DUO_CALL"] = 5)] = "TWO_FA_PUSH_DUO_CALL";
  /**
   * @generated from protobuf enum value: TWO_FA_PUSH_DNA = 6;
   */
  TwoFactorPushType[(TwoFactorPushType["TWO_FA_PUSH_DNA"] = 6)] = "TWO_FA_PUSH_DNA";
})(TwoFactorPushType || (TwoFactorPushType = {}));
/**
 * @generated from protobuf enum Authentication.TwoFactorValueType
 */
export var TwoFactorValueType;
(function (TwoFactorValueType) {
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_NONE = 0;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_NONE"] = 0)] = "TWO_FA_CODE_NONE";
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_TOTP = 1;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_TOTP"] = 1)] = "TWO_FA_CODE_TOTP";
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_SMS = 2;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_SMS"] = 2)] = "TWO_FA_CODE_SMS";
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_DUO = 3;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_DUO"] = 3)] = "TWO_FA_CODE_DUO";
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_RSA = 4;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_RSA"] = 4)] = "TWO_FA_CODE_RSA";
  /**
   * @generated from protobuf enum value: TWO_FA_RESP_U2F = 5;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_RESP_U2F"] = 5)] = "TWO_FA_RESP_U2F";
  /**
   * @generated from protobuf enum value: TWO_FA_RESP_WEBAUTHN = 6;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_RESP_WEBAUTHN"] = 6)] = "TWO_FA_RESP_WEBAUTHN";
  /**
   * @generated from protobuf enum value: TWO_FA_CODE_DNA = 7;
   */
  TwoFactorValueType[(TwoFactorValueType["TWO_FA_CODE_DNA"] = 7)] = "TWO_FA_CODE_DNA";
})(TwoFactorValueType || (TwoFactorValueType = {}));
/**
 * @generated from protobuf enum Authentication.TwoFactorChannelType
 */
export var TwoFactorChannelType;
(function (TwoFactorChannelType) {
  /**
   * @generated from protobuf enum value: TWO_FA_CT_NONE = 0;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_NONE"] = 0)] = "TWO_FA_CT_NONE";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_TOTP = 1;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_TOTP"] = 1)] = "TWO_FA_CT_TOTP";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_SMS = 2;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_SMS"] = 2)] = "TWO_FA_CT_SMS";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_DUO = 3;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_DUO"] = 3)] = "TWO_FA_CT_DUO";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_RSA = 4;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_RSA"] = 4)] = "TWO_FA_CT_RSA";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_BACKUP = 5;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_BACKUP"] = 5)] = "TWO_FA_CT_BACKUP";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_U2F = 6;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_U2F"] = 6)] = "TWO_FA_CT_U2F";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_WEBAUTHN = 7;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_WEBAUTHN"] = 7)] = "TWO_FA_CT_WEBAUTHN";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_KEEPER = 8;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_KEEPER"] = 8)] = "TWO_FA_CT_KEEPER";
  /**
   * @generated from protobuf enum value: TWO_FA_CT_DNA = 9;
   */
  TwoFactorChannelType[(TwoFactorChannelType["TWO_FA_CT_DNA"] = 9)] = "TWO_FA_CT_DNA";
})(TwoFactorChannelType || (TwoFactorChannelType = {}));
/**
 * @generated from protobuf enum Authentication.TwoFactorExpiration
 */
export var TwoFactorExpiration;
(function (TwoFactorExpiration) {
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_IMMEDIATELY = 0;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_IMMEDIATELY"] = 0)] =
    "TWO_FA_EXP_IMMEDIATELY";
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_5_MINUTES = 1;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_5_MINUTES"] = 1)] = "TWO_FA_EXP_5_MINUTES";
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_12_HOURS = 2;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_12_HOURS"] = 2)] = "TWO_FA_EXP_12_HOURS";
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_24_HOURS = 3;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_24_HOURS"] = 3)] = "TWO_FA_EXP_24_HOURS";
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_30_DAYS = 4;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_30_DAYS"] = 4)] = "TWO_FA_EXP_30_DAYS";
  /**
   * @generated from protobuf enum value: TWO_FA_EXP_NEVER = 5;
   */
  TwoFactorExpiration[(TwoFactorExpiration["TWO_FA_EXP_NEVER"] = 5)] = "TWO_FA_EXP_NEVER";
})(TwoFactorExpiration || (TwoFactorExpiration = {}));
/**
 * @generated from protobuf enum Authentication.LicenseType
 */
export var LicenseType;
(function (LicenseType) {
  /**
   * @generated from protobuf enum value: VAULT = 0;
   */
  LicenseType[(LicenseType["VAULT"] = 0)] = "VAULT";
  /**
   * @generated from protobuf enum value: CHAT = 1;
   */
  LicenseType[(LicenseType["CHAT"] = 1)] = "CHAT";
  /**
   * @generated from protobuf enum value: STORAGE = 2;
   */
  LicenseType[(LicenseType["STORAGE"] = 2)] = "STORAGE";
  /**
   * @generated from protobuf enum value: BREACHWATCH = 3;
   */
  LicenseType[(LicenseType["BREACHWATCH"] = 3)] = "BREACHWATCH";
})(LicenseType || (LicenseType = {}));
/**
 * @generated from protobuf enum Authentication.ObjectTypes
 */
export var ObjectTypes;
(function (ObjectTypes) {
  /**
   * @generated from protobuf enum value: RECORD = 0;
   */
  ObjectTypes[(ObjectTypes["RECORD"] = 0)] = "RECORD";
  /**
   * @generated from protobuf enum value: SHARED_FOLDER_USER = 1;
   */
  ObjectTypes[(ObjectTypes["SHARED_FOLDER_USER"] = 1)] = "SHARED_FOLDER_USER";
  /**
   * @generated from protobuf enum value: SHARED_FOLDER_TEAM = 2;
   */
  ObjectTypes[(ObjectTypes["SHARED_FOLDER_TEAM"] = 2)] = "SHARED_FOLDER_TEAM";
  /**
   * @generated from protobuf enum value: USER_FOLDER = 3;
   */
  ObjectTypes[(ObjectTypes["USER_FOLDER"] = 3)] = "USER_FOLDER";
  /**
   * @generated from protobuf enum value: TEAM_USER = 4;
   */
  ObjectTypes[(ObjectTypes["TEAM_USER"] = 4)] = "TEAM_USER";
})(ObjectTypes || (ObjectTypes = {}));
/**
 * @generated from protobuf enum Authentication.EncryptedObjectType
 */
export var EncryptedObjectType;
(function (EncryptedObjectType) {
  /**
   * @generated from protobuf enum value: EOT_UNSPECIFIED = 0;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_UNSPECIFIED"] = 0)] = "EOT_UNSPECIFIED";
  /**
   * @generated from protobuf enum value: EOT_RECORD_KEY = 1;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_RECORD_KEY"] = 1)] = "EOT_RECORD_KEY";
  /**
   * @generated from protobuf enum value: EOT_SHARED_FOLDER_USER_KEY = 2;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_SHARED_FOLDER_USER_KEY"] = 2)] =
    "EOT_SHARED_FOLDER_USER_KEY";
  /**
   * @generated from protobuf enum value: EOT_SHARED_FOLDER_TEAM_KEY = 3;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_SHARED_FOLDER_TEAM_KEY"] = 3)] =
    "EOT_SHARED_FOLDER_TEAM_KEY";
  /**
   * @generated from protobuf enum value: EOT_TEAM_USER_KEY = 4;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_TEAM_USER_KEY"] = 4)] = "EOT_TEAM_USER_KEY";
  /**
   * @generated from protobuf enum value: EOT_USER_FOLDER_KEY = 5;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_USER_FOLDER_KEY"] = 5)] = "EOT_USER_FOLDER_KEY";
  /**
   * @generated from protobuf enum value: EOT_SECURITY_DATA = 6;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_SECURITY_DATA"] = 6)] = "EOT_SECURITY_DATA";
  /**
   * @generated from protobuf enum value: EOT_SECURITY_DATA_MASTER_PASSWORD = 7;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_SECURITY_DATA_MASTER_PASSWORD"] = 7)] =
    "EOT_SECURITY_DATA_MASTER_PASSWORD";
  /**
   * @generated from protobuf enum value: EOT_EMERGENCY_ACCESS_KEY = 8;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_EMERGENCY_ACCESS_KEY"] = 8)] =
    "EOT_EMERGENCY_ACCESS_KEY";
  /**
   * @generated from protobuf enum value: EOT_V2_RECORD_KEY = 9;
   */
  EncryptedObjectType[(EncryptedObjectType["EOT_V2_RECORD_KEY"] = 9)] = "EOT_V2_RECORD_KEY";
})(EncryptedObjectType || (EncryptedObjectType = {}));
/**
 * @generated from protobuf enum Authentication.MasterPasswordReentryStatus
 */
export var MasterPasswordReentryStatus;
(function (MasterPasswordReentryStatus) {
  /**
   * @generated from protobuf enum value: MP_UNKNOWN = 0;
   */
  MasterPasswordReentryStatus[(MasterPasswordReentryStatus["MP_UNKNOWN"] = 0)] = "MP_UNKNOWN";
  /**
   * @generated from protobuf enum value: MP_SUCCESS = 1;
   */
  MasterPasswordReentryStatus[(MasterPasswordReentryStatus["MP_SUCCESS"] = 1)] = "MP_SUCCESS";
  /**
   * @generated from protobuf enum value: MP_FAILURE = 2;
   */
  MasterPasswordReentryStatus[(MasterPasswordReentryStatus["MP_FAILURE"] = 2)] = "MP_FAILURE";
})(MasterPasswordReentryStatus || (MasterPasswordReentryStatus = {}));
/**
 * @generated from protobuf enum Authentication.AlternateAuthenticationType
 */
export var AlternateAuthenticationType;
(function (AlternateAuthenticationType) {
  /**
   * @generated from protobuf enum value: ALTERNATE_MASTER_PASSWORD = 0;
   */
  AlternateAuthenticationType[(AlternateAuthenticationType["ALTERNATE_MASTER_PASSWORD"] = 0)] =
    "ALTERNATE_MASTER_PASSWORD";
  /**
   * @generated from protobuf enum value: BIOMETRIC = 1;
   */
  AlternateAuthenticationType[(AlternateAuthenticationType["BIOMETRIC"] = 1)] = "BIOMETRIC";
  /**
   * @generated from protobuf enum value: ACCOUNT_RECOVER = 2;
   */
  AlternateAuthenticationType[(AlternateAuthenticationType["ACCOUNT_RECOVER"] = 2)] =
    "ACCOUNT_RECOVER";
})(AlternateAuthenticationType || (AlternateAuthenticationType = {}));
/**
 * @generated from protobuf enum Authentication.ThrottleType
 */
export var ThrottleType;
(function (ThrottleType) {
  /**
   * @generated from protobuf enum value: PASSWORD_RETRY_THROTTLE = 0;
   */
  ThrottleType[(ThrottleType["PASSWORD_RETRY_THROTTLE"] = 0)] = "PASSWORD_RETRY_THROTTLE";
  /**
   * @generated from protobuf enum value: PASSWORD_RETRY_LEGACY_THROTTLE = 1;
   */
  ThrottleType[(ThrottleType["PASSWORD_RETRY_LEGACY_THROTTLE"] = 1)] =
    "PASSWORD_RETRY_LEGACY_THROTTLE";
  /**
   * @generated from protobuf enum value: TWO_FA_THROTTLE = 2;
   */
  ThrottleType[(ThrottleType["TWO_FA_THROTTLE"] = 2)] = "TWO_FA_THROTTLE";
  /**
   * @generated from protobuf enum value: TWO_FA_LEGACY_THROTTLE = 3;
   */
  ThrottleType[(ThrottleType["TWO_FA_LEGACY_THROTTLE"] = 3)] = "TWO_FA_LEGACY_THROTTLE";
  /**
   * @generated from protobuf enum value: QA_RETRY_THROTTLE = 4;
   */
  ThrottleType[(ThrottleType["QA_RETRY_THROTTLE"] = 4)] = "QA_RETRY_THROTTLE";
  /**
   * @generated from protobuf enum value: ACCOUNT_RECOVER_THROTTLE = 5;
   */
  ThrottleType[(ThrottleType["ACCOUNT_RECOVER_THROTTLE"] = 5)] = "ACCOUNT_RECOVER_THROTTLE";
  /**
   * @generated from protobuf enum value: VALIDATE_DEVICE_VERIFICATION_CODE_THROTTLE = 6;
   */
  ThrottleType[(ThrottleType["VALIDATE_DEVICE_VERIFICATION_CODE_THROTTLE"] = 6)] =
    "VALIDATE_DEVICE_VERIFICATION_CODE_THROTTLE";
  /**
   * @generated from protobuf enum value: VALIDATE_CREATE_USER_VERIFICATION_CODE_THROTTLE = 7;
   */
  ThrottleType[(ThrottleType["VALIDATE_CREATE_USER_VERIFICATION_CODE_THROTTLE"] = 7)] =
    "VALIDATE_CREATE_USER_VERIFICATION_CODE_THROTTLE";
})(ThrottleType || (ThrottleType = {}));
/**
 * @generated from protobuf enum Authentication.Region
 */
export var Region;
(function (Region) {
  /**
   * @generated from protobuf enum value: UNKNOWN = 0;
   */
  Region[(Region["UNKNOWN"] = 0)] = "UNKNOWN";
  /**
   * @generated from protobuf enum value: eu = 1;
   */
  Region[(Region["eu"] = 1)] = "eu";
  /**
   * @generated from protobuf enum value: us = 2;
   */
  Region[(Region["us"] = 2)] = "us";
  /**
   * @generated from protobuf enum value: usgov = 3;
   */
  Region[(Region["usgov"] = 3)] = "usgov";
  /**
   * @generated from protobuf enum value: au = 4;
   */
  Region[(Region["au"] = 4)] = "au";
  /**
   * @generated from protobuf enum value: jp = 5;
   */
  Region[(Region["jp"] = 5)] = "jp";
  /**
   * @generated from protobuf enum value: ca = 6;
   */
  Region[(Region["ca"] = 6)] = "ca";
})(Region || (Region = {}));
/**
 * @generated from protobuf enum Authentication.ApplicationShareType
 */
export var ApplicationShareType;
(function (ApplicationShareType) {
  /**
   * @generated from protobuf enum value: SHARE_TYPE_RECORD = 0;
   */
  ApplicationShareType[(ApplicationShareType["SHARE_TYPE_RECORD"] = 0)] = "SHARE_TYPE_RECORD";
  /**
   * @generated from protobuf enum value: SHARE_TYPE_FOLDER = 1;
   */
  ApplicationShareType[(ApplicationShareType["SHARE_TYPE_FOLDER"] = 1)] = "SHARE_TYPE_FOLDER";
})(ApplicationShareType || (ApplicationShareType = {}));
/**
 * @generated from protobuf enum Authentication.TimeLimitedAccessType
 */
export var TimeLimitedAccessType;
(function (TimeLimitedAccessType) {
  /**
   * @generated from protobuf enum value: INVALID_TIME_LIMITED_ACCESS_TYPE = 0;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["INVALID_TIME_LIMITED_ACCESS_TYPE"] = 0)] =
    "INVALID_TIME_LIMITED_ACCESS_TYPE";
  /**
   * @generated from protobuf enum value: USER_ACCESS_TO_RECORD = 1;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["USER_ACCESS_TO_RECORD"] = 1)] =
    "USER_ACCESS_TO_RECORD";
  /**
   * @generated from protobuf enum value: USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER = 2;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER"] = 2)] =
    "USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER";
  /**
   * @generated from protobuf enum value: RECORD_ACCESS_TO_SHAREDFOLDER = 3;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["RECORD_ACCESS_TO_SHAREDFOLDER"] = 3)] =
    "RECORD_ACCESS_TO_SHAREDFOLDER";
})(TimeLimitedAccessType || (TimeLimitedAccessType = {}));
/**
 * @generated from protobuf enum Authentication.BackupKeyType
 */
export var BackupKeyType;
(function (BackupKeyType) {
  /**
   * @generated from protobuf enum value: BKT_SEC_ANSWER = 0;
   */
  BackupKeyType[(BackupKeyType["BKT_SEC_ANSWER"] = 0)] = "BKT_SEC_ANSWER";
  /**
   * @generated from protobuf enum value: BKT_PASSPHRASE_HASH = 1;
   */
  BackupKeyType[(BackupKeyType["BKT_PASSPHRASE_HASH"] = 1)] = "BKT_PASSPHRASE_HASH";
})(BackupKeyType || (BackupKeyType = {}));
/**
 * @generated from protobuf enum Authentication.GenericStatus
 */
export var GenericStatus;
(function (GenericStatus) {
  /**
   * @generated from protobuf enum value: SUCCESS = 0;
   */
  GenericStatus[(GenericStatus["SUCCESS"] = 0)] = "SUCCESS";
  /**
   * @generated from protobuf enum value: INVALID_OBJECT = 1;
   */
  GenericStatus[(GenericStatus["INVALID_OBJECT"] = 1)] = "INVALID_OBJECT";
  /**
   * @generated from protobuf enum value: ALREADY_EXISTS = 2;
   */
  GenericStatus[(GenericStatus["ALREADY_EXISTS"] = 2)] = "ALREADY_EXISTS";
  /**
   * @generated from protobuf enum value: ACCESS_DENIED = 3;
   */
  GenericStatus[(GenericStatus["ACCESS_DENIED"] = 3)] = "ACCESS_DENIED";
})(GenericStatus || (GenericStatus = {}));
/**
 * @generated from protobuf enum Authentication.AuthenticatorAttachment
 */
export var AuthenticatorAttachment;
(function (AuthenticatorAttachment) {
  /**
   * @generated from protobuf enum value: CROSS_PLATFORM = 0;
   */
  AuthenticatorAttachment[(AuthenticatorAttachment["CROSS_PLATFORM"] = 0)] = "CROSS_PLATFORM";
  /**
   * @generated from protobuf enum value: PLATFORM = 1;
   */
  AuthenticatorAttachment[(AuthenticatorAttachment["PLATFORM"] = 1)] = "PLATFORM";
  /**
   * @generated from protobuf enum value: ALL_SUPPORTED = 2;
   */
  AuthenticatorAttachment[(AuthenticatorAttachment["ALL_SUPPORTED"] = 2)] = "ALL_SUPPORTED";
})(AuthenticatorAttachment || (AuthenticatorAttachment = {}));
/**
 * @generated from protobuf enum Authentication.PasskeyPurpose
 */
export var PasskeyPurpose;
(function (PasskeyPurpose) {
  /**
   * @generated from protobuf enum value: PK_LOGIN = 0;
   */
  PasskeyPurpose[(PasskeyPurpose["PK_LOGIN"] = 0)] = "PK_LOGIN";
  /**
   * @generated from protobuf enum value: PK_REAUTH = 1;
   */
  PasskeyPurpose[(PasskeyPurpose["PK_REAUTH"] = 1)] = "PK_REAUTH";
})(PasskeyPurpose || (PasskeyPurpose = {}));
/**
 * @generated from protobuf enum Authentication.ClientFormFactor
 */
export var ClientFormFactor;
(function (ClientFormFactor) {
  /**
   * @generated from protobuf enum value: FF_EMPTY = 0;
   */
  ClientFormFactor[(ClientFormFactor["FF_EMPTY"] = 0)] = "FF_EMPTY";
  /**
   * @generated from protobuf enum value: FF_PHONE = 1;
   */
  ClientFormFactor[(ClientFormFactor["FF_PHONE"] = 1)] = "FF_PHONE";
  /**
   * @generated from protobuf enum value: FF_TABLET = 2;
   */
  ClientFormFactor[(ClientFormFactor["FF_TABLET"] = 2)] = "FF_TABLET";
  /**
   * @generated from protobuf enum value: FF_WATCH = 3;
   */
  ClientFormFactor[(ClientFormFactor["FF_WATCH"] = 3)] = "FF_WATCH";
})(ClientFormFactor || (ClientFormFactor = {}));
// @generated message type with reflection information, may provide speed optimized methods
class ApiRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ApiRequest", [
      { no: 1, name: "encryptedTransmissionKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "publicKeyId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "locale", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "encryptedPayload", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptionType", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "recaptcha", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "subEnvironment", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedTransmissionKey = new Uint8Array(0);
    message.publicKeyId = 0;
    message.locale = "";
    message.encryptedPayload = new Uint8Array(0);
    message.encryptionType = 0;
    message.recaptcha = "";
    message.subEnvironment = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedTransmissionKey */ 1:
          message.encryptedTransmissionKey = reader.bytes();
          break;
        case /* int32 publicKeyId */ 2:
          message.publicKeyId = reader.int32();
          break;
        case /* string locale */ 3:
          message.locale = reader.string();
          break;
        case /* bytes encryptedPayload */ 4:
          message.encryptedPayload = reader.bytes();
          break;
        case /* int32 encryptionType */ 5:
          message.encryptionType = reader.int32();
          break;
        case /* string recaptcha */ 6:
          message.recaptcha = reader.string();
          break;
        case /* string subEnvironment */ 7:
          message.subEnvironment = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedTransmissionKey = 1; */
    if (message.encryptedTransmissionKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedTransmissionKey);
    /* int32 publicKeyId = 2; */
    if (message.publicKeyId !== 0) writer.tag(2, WireType.Varint).int32(message.publicKeyId);
    /* string locale = 3; */
    if (message.locale !== "") writer.tag(3, WireType.LengthDelimited).string(message.locale);
    /* bytes encryptedPayload = 4; */
    if (message.encryptedPayload.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedPayload);
    /* int32 encryptionType = 5; */
    if (message.encryptionType !== 0) writer.tag(5, WireType.Varint).int32(message.encryptionType);
    /* string recaptcha = 6; */
    if (message.recaptcha !== "") writer.tag(6, WireType.LengthDelimited).string(message.recaptcha);
    /* string subEnvironment = 7; */
    if (message.subEnvironment !== "")
      writer.tag(7, WireType.LengthDelimited).string(message.subEnvironment);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApiRequest
 */
export const ApiRequest = new ApiRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApiRequestPayload$Type extends MessageType {
  constructor() {
    super("Authentication.ApiRequestPayload", [
      { no: 1, name: "payload", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "timeToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "apiVersion", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.payload = new Uint8Array(0);
    message.encryptedSessionToken = new Uint8Array(0);
    message.timeToken = new Uint8Array(0);
    message.apiVersion = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes payload */ 1:
          message.payload = reader.bytes();
          break;
        case /* bytes encryptedSessionToken */ 2:
          message.encryptedSessionToken = reader.bytes();
          break;
        case /* bytes timeToken */ 3:
          message.timeToken = reader.bytes();
          break;
        case /* int32 apiVersion */ 4:
          message.apiVersion = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes payload = 1; */
    if (message.payload.length) writer.tag(1, WireType.LengthDelimited).bytes(message.payload);
    /* bytes encryptedSessionToken = 2; */
    if (message.encryptedSessionToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedSessionToken);
    /* bytes timeToken = 3; */
    if (message.timeToken.length) writer.tag(3, WireType.LengthDelimited).bytes(message.timeToken);
    /* int32 apiVersion = 4; */
    if (message.apiVersion !== 0) writer.tag(4, WireType.Varint).int32(message.apiVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApiRequestPayload
 */
export const ApiRequestPayload = new ApiRequestPayload$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Transform$Type extends MessageType {
  constructor() {
    super("Authentication.Transform", [
      { no: 1, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = new Uint8Array(0);
    message.encryptedDeviceToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes key */ 1:
          message.key = reader.bytes();
          break;
        case /* bytes encryptedDeviceToken */ 2:
          message.encryptedDeviceToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes key = 1; */
    if (message.key.length) writer.tag(1, WireType.LengthDelimited).bytes(message.key);
    /* bytes encryptedDeviceToken = 2; */
    if (message.encryptedDeviceToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.Transform
 */
export const Transform = new Transform$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceRequest", [
      { no: 1, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
      { no: 5, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientVersion = "";
    message.deviceName = "";
    message.devicePlatform = "";
    message.clientFormFactor = 0;
    message.username = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string clientVersion */ 1:
          message.clientVersion = reader.string();
          break;
        case /* string deviceName */ 2:
          message.deviceName = reader.string();
          break;
        case /* string devicePlatform */ 3:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 4:
          message.clientFormFactor = reader.int32();
          break;
        case /* string username */ 5:
          message.username = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string clientVersion = 1; */
    if (message.clientVersion !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceName = 2; */
    if (message.deviceName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.deviceName);
    /* string devicePlatform = 3; */
    if (message.devicePlatform !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 4; */
    if (message.clientFormFactor !== 0)
      writer.tag(4, WireType.Varint).int32(message.clientFormFactor);
    /* string username = 5; */
    if (message.username !== "") writer.tag(5, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceRequest
 */
export const DeviceRequest = new DeviceRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuthRequest$Type extends MessageType {
  constructor() {
    super("Authentication.AuthRequest", [
      { no: 1, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientVersion = "";
    message.username = "";
    message.encryptedDeviceToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string clientVersion */ 1:
          message.clientVersion = reader.string();
          break;
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* bytes encryptedDeviceToken */ 3:
          message.encryptedDeviceToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string clientVersion = 1; */
    if (message.clientVersion !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.clientVersion);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* bytes encryptedDeviceToken = 3; */
    if (message.encryptedDeviceToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AuthRequest
 */
export const AuthRequest = new AuthRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NewUserMinimumParams$Type extends MessageType {
  constructor() {
    super("Authentication.NewUserMinimumParams", [
      { no: 1, name: "minimumIterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 2,
        name: "passwordMatchRegex",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 3,
        name: "passwordMatchDescription",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 4, name: "isEnterpriseDomain", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "enterpriseEccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "forbidKeyType2", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.minimumIterations = 0;
    message.passwordMatchRegex = [];
    message.passwordMatchDescription = [];
    message.isEnterpriseDomain = false;
    message.enterpriseEccPublicKey = new Uint8Array(0);
    message.forbidKeyType2 = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 minimumIterations */ 1:
          message.minimumIterations = reader.int32();
          break;
        case /* repeated string passwordMatchRegex */ 2:
          message.passwordMatchRegex.push(reader.string());
          break;
        case /* repeated string passwordMatchDescription */ 3:
          message.passwordMatchDescription.push(reader.string());
          break;
        case /* bool isEnterpriseDomain */ 4:
          message.isEnterpriseDomain = reader.bool();
          break;
        case /* bytes enterpriseEccPublicKey */ 5:
          message.enterpriseEccPublicKey = reader.bytes();
          break;
        case /* bool forbidKeyType2 */ 6:
          message.forbidKeyType2 = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 minimumIterations = 1; */
    if (message.minimumIterations !== 0)
      writer.tag(1, WireType.Varint).int32(message.minimumIterations);
    /* repeated string passwordMatchRegex = 2; */
    for (let i = 0; i < message.passwordMatchRegex.length; i++)
      writer.tag(2, WireType.LengthDelimited).string(message.passwordMatchRegex[i]);
    /* repeated string passwordMatchDescription = 3; */
    for (let i = 0; i < message.passwordMatchDescription.length; i++)
      writer.tag(3, WireType.LengthDelimited).string(message.passwordMatchDescription[i]);
    /* bool isEnterpriseDomain = 4; */
    if (message.isEnterpriseDomain !== false)
      writer.tag(4, WireType.Varint).bool(message.isEnterpriseDomain);
    /* bytes enterpriseEccPublicKey = 5; */
    if (message.enterpriseEccPublicKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.enterpriseEccPublicKey);
    /* bool forbidKeyType2 = 6; */
    if (message.forbidKeyType2 !== false)
      writer.tag(6, WireType.Varint).bool(message.forbidKeyType2);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.NewUserMinimumParams
 */
export const NewUserMinimumParams = new NewUserMinimumParams$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreLoginRequest$Type extends MessageType {
  constructor() {
    super("Authentication.PreLoginRequest", [
      { no: 1, name: "authRequest", kind: "message", T: () => AuthRequest },
      { no: 2, name: "loginType", kind: "enum", T: () => ["Authentication.LoginType", LoginType] },
      { no: 3, name: "twoFactorToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.loginType = 0;
    message.twoFactorToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.AuthRequest authRequest */ 1:
          message.authRequest = AuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.authRequest,
          );
          break;
        case /* Authentication.LoginType loginType */ 2:
          message.loginType = reader.int32();
          break;
        case /* bytes twoFactorToken */ 3:
          message.twoFactorToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthRequest authRequest = 1; */
    if (message.authRequest)
      AuthRequest.internalBinaryWrite(
        message.authRequest,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Authentication.LoginType loginType = 2; */
    if (message.loginType !== 0) writer.tag(2, WireType.Varint).int32(message.loginType);
    /* bytes twoFactorToken = 3; */
    if (message.twoFactorToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.twoFactorToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PreLoginRequest
 */
export const PreLoginRequest = new PreLoginRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginRequest$Type extends MessageType {
  constructor() {
    super("Authentication.LoginRequest", [
      { no: 1, name: "authRequest", kind: "message", T: () => AuthRequest },
      { no: 2, name: "loginType", kind: "enum", T: () => ["Authentication.LoginType", LoginType] },
      { no: 3, name: "authenticationHashPrime", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "authResponse", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "mcEnterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 7, name: "push_token", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "platform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.loginType = 0;
    message.authenticationHashPrime = new Uint8Array(0);
    message.encryptedLoginToken = new Uint8Array(0);
    message.authResponse = new Uint8Array(0);
    message.mcEnterpriseId = 0;
    message.pushToken = "";
    message.platform = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.AuthRequest authRequest */ 1:
          message.authRequest = AuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.authRequest,
          );
          break;
        case /* Authentication.LoginType loginType */ 2:
          message.loginType = reader.int32();
          break;
        case /* bytes authenticationHashPrime */ 3:
          message.authenticationHashPrime = reader.bytes();
          break;
        case /* bytes encryptedLoginToken */ 4:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* bytes authResponse */ 5:
          message.authResponse = reader.bytes();
          break;
        case /* int32 mcEnterpriseId */ 6:
          message.mcEnterpriseId = reader.int32();
          break;
        case /* string push_token */ 7:
          message.pushToken = reader.string();
          break;
        case /* string platform */ 8:
          message.platform = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthRequest authRequest = 1; */
    if (message.authRequest)
      AuthRequest.internalBinaryWrite(
        message.authRequest,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Authentication.LoginType loginType = 2; */
    if (message.loginType !== 0) writer.tag(2, WireType.Varint).int32(message.loginType);
    /* bytes authenticationHashPrime = 3; */
    if (message.authenticationHashPrime.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.authenticationHashPrime);
    /* bytes encryptedLoginToken = 4; */
    if (message.encryptedLoginToken.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* bytes authResponse = 5; */
    if (message.authResponse.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.authResponse);
    /* int32 mcEnterpriseId = 6; */
    if (message.mcEnterpriseId !== 0) writer.tag(6, WireType.Varint).int32(message.mcEnterpriseId);
    /* string push_token = 7; */
    if (message.pushToken !== "") writer.tag(7, WireType.LengthDelimited).string(message.pushToken);
    /* string platform = 8; */
    if (message.platform !== "") writer.tag(8, WireType.LengthDelimited).string(message.platform);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.LoginRequest
 */
export const LoginRequest = new LoginRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceResponse$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceResponse", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* Authentication.DeviceStatus status */ 2:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* Authentication.DeviceStatus status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceResponse
 */
export const DeviceResponse = new DeviceResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Salt$Type extends MessageType {
  constructor() {
    super("Authentication.Salt", [
      { no: 1, name: "iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "salt", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "algorithm", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.iterations = 0;
    message.salt = new Uint8Array(0);
    message.algorithm = 0;
    message.uid = new Uint8Array(0);
    message.name = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 iterations */ 1:
          message.iterations = reader.int32();
          break;
        case /* bytes salt */ 2:
          message.salt = reader.bytes();
          break;
        case /* int32 algorithm */ 3:
          message.algorithm = reader.int32();
          break;
        case /* bytes uid */ 4:
          message.uid = reader.bytes();
          break;
        case /* string name */ 5:
          message.name = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 iterations = 1; */
    if (message.iterations !== 0) writer.tag(1, WireType.Varint).int32(message.iterations);
    /* bytes salt = 2; */
    if (message.salt.length) writer.tag(2, WireType.LengthDelimited).bytes(message.salt);
    /* int32 algorithm = 3; */
    if (message.algorithm !== 0) writer.tag(3, WireType.Varint).int32(message.algorithm);
    /* bytes uid = 4; */
    if (message.uid.length) writer.tag(4, WireType.LengthDelimited).bytes(message.uid);
    /* string name = 5; */
    if (message.name !== "") writer.tag(5, WireType.LengthDelimited).string(message.name);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.Salt
 */
export const Salt = new Salt$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorChannel$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorChannel", [
      { no: 1, name: "type", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 type */ 1:
          message.type = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorChannel
 */
export const TwoFactorChannel = new TwoFactorChannel$Type();
// @generated message type with reflection information, may provide speed optimized methods
class StartLoginRequest$Type extends MessageType {
  constructor() {
    super("Authentication.StartLoginRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "loginType", kind: "enum", T: () => ["Authentication.LoginType", LoginType] },
      { no: 7, name: "mcEnterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 8,
        name: "loginMethod",
        kind: "enum",
        T: () => ["Authentication.LoginMethod", LoginMethod],
      },
      { no: 9, name: "forceNewLogin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 10, name: "cloneCode", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 11, name: "v2TwoFactorToken", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 12, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 13, name: "fromSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.username = "";
    message.clientVersion = "";
    message.messageSessionUid = new Uint8Array(0);
    message.encryptedLoginToken = new Uint8Array(0);
    message.loginType = 0;
    message.mcEnterpriseId = 0;
    message.loginMethod = 0;
    message.forceNewLogin = false;
    message.cloneCode = new Uint8Array(0);
    message.v2TwoFactorToken = "";
    message.accountUid = new Uint8Array(0);
    message.fromSessionToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* string clientVersion */ 3:
          message.clientVersion = reader.string();
          break;
        case /* bytes messageSessionUid */ 4:
          message.messageSessionUid = reader.bytes();
          break;
        case /* bytes encryptedLoginToken */ 5:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* Authentication.LoginType loginType */ 6:
          message.loginType = reader.int32();
          break;
        case /* int32 mcEnterpriseId */ 7:
          message.mcEnterpriseId = reader.int32();
          break;
        case /* Authentication.LoginMethod loginMethod */ 8:
          message.loginMethod = reader.int32();
          break;
        case /* bool forceNewLogin */ 9:
          message.forceNewLogin = reader.bool();
          break;
        case /* bytes cloneCode */ 10:
          message.cloneCode = reader.bytes();
          break;
        case /* string v2TwoFactorToken */ 11:
          message.v2TwoFactorToken = reader.string();
          break;
        case /* bytes accountUid */ 12:
          message.accountUid = reader.bytes();
          break;
        case /* bytes fromSessionToken */ 13:
          message.fromSessionToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* string clientVersion = 3; */
    if (message.clientVersion !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.clientVersion);
    /* bytes messageSessionUid = 4; */
    if (message.messageSessionUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* bytes encryptedLoginToken = 5; */
    if (message.encryptedLoginToken.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* Authentication.LoginType loginType = 6; */
    if (message.loginType !== 0) writer.tag(6, WireType.Varint).int32(message.loginType);
    /* int32 mcEnterpriseId = 7; */
    if (message.mcEnterpriseId !== 0) writer.tag(7, WireType.Varint).int32(message.mcEnterpriseId);
    /* Authentication.LoginMethod loginMethod = 8; */
    if (message.loginMethod !== 0) writer.tag(8, WireType.Varint).int32(message.loginMethod);
    /* bool forceNewLogin = 9; */
    if (message.forceNewLogin !== false) writer.tag(9, WireType.Varint).bool(message.forceNewLogin);
    /* bytes cloneCode = 10; */
    if (message.cloneCode.length) writer.tag(10, WireType.LengthDelimited).bytes(message.cloneCode);
    /* string v2TwoFactorToken = 11; */
    if (message.v2TwoFactorToken !== "")
      writer.tag(11, WireType.LengthDelimited).string(message.v2TwoFactorToken);
    /* bytes accountUid = 12; */
    if (message.accountUid.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.accountUid);
    /* bytes fromSessionToken = 13; */
    if (message.fromSessionToken.length)
      writer.tag(13, WireType.LengthDelimited).bytes(message.fromSessionToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.StartLoginRequest
 */
export const StartLoginRequest = new StartLoginRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginResponse$Type extends MessageType {
  constructor() {
    super("Authentication.LoginResponse", [
      {
        no: 1,
        name: "loginState",
        kind: "enum",
        T: () => ["Authentication.LoginState", LoginState],
      },
      { no: 2, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "primaryUsername", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "encryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "encryptedDataKeyType",
        kind: "enum",
        T: () => ["Authentication.EncryptedDataKeyType", EncryptedDataKeyType],
      },
      { no: 6, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 8,
        name: "sessionTokenType",
        kind: "enum",
        T: () => ["Authentication.SessionTokenType", SessionTokenType],
      },
      { no: 9, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 10, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 11,
        name: "channels",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TwoFactorChannelInfo,
      },
      { no: 12, name: "salt", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => Salt },
      { no: 13, name: "cloneCode", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 14, name: "stateSpecificValue", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 15, name: "ssoClientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 16, name: "sessionTokenTypeModifier", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.loginState = 0;
    message.accountUid = new Uint8Array(0);
    message.primaryUsername = "";
    message.encryptedDataKey = new Uint8Array(0);
    message.encryptedDataKeyType = 0;
    message.encryptedLoginToken = new Uint8Array(0);
    message.encryptedSessionToken = new Uint8Array(0);
    message.sessionTokenType = 0;
    message.message = "";
    message.url = "";
    message.channels = [];
    message.salt = [];
    message.cloneCode = new Uint8Array(0);
    message.stateSpecificValue = "";
    message.ssoClientVersion = "";
    message.sessionTokenTypeModifier = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.LoginState loginState */ 1:
          message.loginState = reader.int32();
          break;
        case /* bytes accountUid */ 2:
          message.accountUid = reader.bytes();
          break;
        case /* string primaryUsername */ 3:
          message.primaryUsername = reader.string();
          break;
        case /* bytes encryptedDataKey */ 4:
          message.encryptedDataKey = reader.bytes();
          break;
        case /* Authentication.EncryptedDataKeyType encryptedDataKeyType */ 5:
          message.encryptedDataKeyType = reader.int32();
          break;
        case /* bytes encryptedLoginToken */ 6:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* bytes encryptedSessionToken */ 7:
          message.encryptedSessionToken = reader.bytes();
          break;
        case /* Authentication.SessionTokenType sessionTokenType */ 8:
          message.sessionTokenType = reader.int32();
          break;
        case /* string message */ 9:
          message.message = reader.string();
          break;
        case /* string url */ 10:
          message.url = reader.string();
          break;
        case /* repeated Authentication.TwoFactorChannelInfo channels */ 11:
          message.channels.push(
            TwoFactorChannelInfo.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Authentication.Salt salt */ 12:
          message.salt.push(Salt.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bytes cloneCode */ 13:
          message.cloneCode = reader.bytes();
          break;
        case /* string stateSpecificValue */ 14:
          message.stateSpecificValue = reader.string();
          break;
        case /* string ssoClientVersion */ 15:
          message.ssoClientVersion = reader.string();
          break;
        case /* string sessionTokenTypeModifier */ 16:
          message.sessionTokenTypeModifier = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.LoginState loginState = 1; */
    if (message.loginState !== 0) writer.tag(1, WireType.Varint).int32(message.loginState);
    /* bytes accountUid = 2; */
    if (message.accountUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.accountUid);
    /* string primaryUsername = 3; */
    if (message.primaryUsername !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.primaryUsername);
    /* bytes encryptedDataKey = 4; */
    if (message.encryptedDataKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedDataKey);
    /* Authentication.EncryptedDataKeyType encryptedDataKeyType = 5; */
    if (message.encryptedDataKeyType !== 0)
      writer.tag(5, WireType.Varint).int32(message.encryptedDataKeyType);
    /* bytes encryptedLoginToken = 6; */
    if (message.encryptedLoginToken.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* bytes encryptedSessionToken = 7; */
    if (message.encryptedSessionToken.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.encryptedSessionToken);
    /* Authentication.SessionTokenType sessionTokenType = 8; */
    if (message.sessionTokenType !== 0)
      writer.tag(8, WireType.Varint).int32(message.sessionTokenType);
    /* string message = 9; */
    if (message.message !== "") writer.tag(9, WireType.LengthDelimited).string(message.message);
    /* string url = 10; */
    if (message.url !== "") writer.tag(10, WireType.LengthDelimited).string(message.url);
    /* repeated Authentication.TwoFactorChannelInfo channels = 11; */
    for (let i = 0; i < message.channels.length; i++)
      TwoFactorChannelInfo.internalBinaryWrite(
        message.channels[i],
        writer.tag(11, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.Salt salt = 12; */
    for (let i = 0; i < message.salt.length; i++)
      Salt.internalBinaryWrite(
        message.salt[i],
        writer.tag(12, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes cloneCode = 13; */
    if (message.cloneCode.length) writer.tag(13, WireType.LengthDelimited).bytes(message.cloneCode);
    /* string stateSpecificValue = 14; */
    if (message.stateSpecificValue !== "")
      writer.tag(14, WireType.LengthDelimited).string(message.stateSpecificValue);
    /* string ssoClientVersion = 15; */
    if (message.ssoClientVersion !== "")
      writer.tag(15, WireType.LengthDelimited).string(message.ssoClientVersion);
    /* string sessionTokenTypeModifier = 16; */
    if (message.sessionTokenTypeModifier !== "")
      writer.tag(16, WireType.LengthDelimited).string(message.sessionTokenTypeModifier);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.LoginResponse
 */
export const LoginResponse = new LoginResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SwitchListElement$Type extends MessageType {
  constructor() {
    super("Authentication.SwitchListElement", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "authRequired", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "isLinked", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.fullName = "";
    message.authRequired = false;
    message.isLinked = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* string fullName */ 2:
          message.fullName = reader.string();
          break;
        case /* bool authRequired */ 3:
          message.authRequired = reader.bool();
          break;
        case /* bool isLinked */ 4:
          message.isLinked = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* string fullName = 2; */
    if (message.fullName !== "") writer.tag(2, WireType.LengthDelimited).string(message.fullName);
    /* bool authRequired = 3; */
    if (message.authRequired !== false) writer.tag(3, WireType.Varint).bool(message.authRequired);
    /* bool isLinked = 4; */
    if (message.isLinked !== false) writer.tag(4, WireType.Varint).bool(message.isLinked);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SwitchListElement
 */
export const SwitchListElement = new SwitchListElement$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SwitchListResponse$Type extends MessageType {
  constructor() {
    super("Authentication.SwitchListResponse", [
      {
        no: 1,
        name: "elements",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SwitchListElement,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.elements = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.SwitchListElement elements */ 1:
          message.elements.push(
            SwitchListElement.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.SwitchListElement elements = 1; */
    for (let i = 0; i < message.elements.length; i++)
      SwitchListElement.internalBinaryWrite(
        message.elements[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SwitchListResponse
 */
export const SwitchListResponse = new SwitchListResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SsoUserInfo$Type extends MessageType {
  constructor() {
    super("Authentication.SsoUserInfo", [
      { no: 1, name: "companyName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "samlRequest", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "samlRequestType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "ssoDomainName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "loginUrl", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "logoutUrl", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.companyName = "";
    message.samlRequest = "";
    message.samlRequestType = "";
    message.ssoDomainName = "";
    message.loginUrl = "";
    message.logoutUrl = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string companyName */ 1:
          message.companyName = reader.string();
          break;
        case /* string samlRequest */ 2:
          message.samlRequest = reader.string();
          break;
        case /* string samlRequestType */ 3:
          message.samlRequestType = reader.string();
          break;
        case /* string ssoDomainName */ 4:
          message.ssoDomainName = reader.string();
          break;
        case /* string loginUrl */ 5:
          message.loginUrl = reader.string();
          break;
        case /* string logoutUrl */ 6:
          message.logoutUrl = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string companyName = 1; */
    if (message.companyName !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.companyName);
    /* string samlRequest = 2; */
    if (message.samlRequest !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.samlRequest);
    /* string samlRequestType = 3; */
    if (message.samlRequestType !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.samlRequestType);
    /* string ssoDomainName = 4; */
    if (message.ssoDomainName !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.ssoDomainName);
    /* string loginUrl = 5; */
    if (message.loginUrl !== "") writer.tag(5, WireType.LengthDelimited).string(message.loginUrl);
    /* string logoutUrl = 6; */
    if (message.logoutUrl !== "") writer.tag(6, WireType.LengthDelimited).string(message.logoutUrl);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SsoUserInfo
 */
export const SsoUserInfo = new SsoUserInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreLoginResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PreLoginResponse", [
      {
        no: 1,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
      { no: 2, name: "salt", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => Salt },
      {
        no: 3,
        name: "OBSOLETE_FIELD",
        kind: "message",
        jsonName: "OBSOLETEFIELD",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TwoFactorChannel,
      },
      { no: 4, name: "ssoUserInfo", kind: "message", T: () => SsoUserInfo },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceStatus = 0;
    message.salt = [];
    message.oBSOLETEFIELD = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.DeviceStatus deviceStatus */ 1:
          message.deviceStatus = reader.int32();
          break;
        case /* repeated Authentication.Salt salt */ 2:
          message.salt.push(Salt.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Authentication.TwoFactorChannel OBSOLETE_FIELD */ 3:
          message.oBSOLETEFIELD.push(
            TwoFactorChannel.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Authentication.SsoUserInfo ssoUserInfo */ 4:
          message.ssoUserInfo = SsoUserInfo.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.ssoUserInfo,
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.DeviceStatus deviceStatus = 1; */
    if (message.deviceStatus !== 0) writer.tag(1, WireType.Varint).int32(message.deviceStatus);
    /* repeated Authentication.Salt salt = 2; */
    for (let i = 0; i < message.salt.length; i++)
      Salt.internalBinaryWrite(
        message.salt[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.TwoFactorChannel OBSOLETE_FIELD = 3; */
    for (let i = 0; i < message.oBSOLETEFIELD.length; i++)
      TwoFactorChannel.internalBinaryWrite(
        message.oBSOLETEFIELD[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Authentication.SsoUserInfo ssoUserInfo = 4; */
    if (message.ssoUserInfo)
      SsoUserInfo.internalBinaryWrite(
        message.ssoUserInfo,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PreLoginResponse
 */
export const PreLoginResponse = new PreLoginResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginAsUserRequest$Type extends MessageType {
  constructor() {
    super("Authentication.LoginAsUserRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.LoginAsUserRequest
 */
export const LoginAsUserRequest = new LoginAsUserRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginAsUserResponse$Type extends MessageType {
  constructor() {
    super("Authentication.LoginAsUserResponse", [
      { no: 1, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedSharedAccountKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedSessionToken = new Uint8Array(0);
    message.encryptedSharedAccountKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedSessionToken */ 1:
          message.encryptedSessionToken = reader.bytes();
          break;
        case /* bytes encryptedSharedAccountKey */ 2:
          message.encryptedSharedAccountKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedSessionToken = 1; */
    if (message.encryptedSessionToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedSessionToken);
    /* bytes encryptedSharedAccountKey = 2; */
    if (message.encryptedSharedAccountKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedSharedAccountKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.LoginAsUserResponse
 */
export const LoginAsUserResponse = new LoginAsUserResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ValidateAuthHashRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ValidateAuthHashRequest", [
      {
        no: 1,
        name: "passwordMethod",
        kind: "enum",
        T: () => ["Authentication.PasswordMethod", PasswordMethod],
      },
      { no: 2, name: "authResponse", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.passwordMethod = 0;
    message.authResponse = new Uint8Array(0);
    message.encryptedLoginToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.PasswordMethod passwordMethod */ 1:
          message.passwordMethod = reader.int32();
          break;
        case /* bytes authResponse */ 2:
          message.authResponse = reader.bytes();
          break;
        case /* bytes encryptedLoginToken */ 3:
          message.encryptedLoginToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.PasswordMethod passwordMethod = 1; */
    if (message.passwordMethod !== 0) writer.tag(1, WireType.Varint).int32(message.passwordMethod);
    /* bytes authResponse = 2; */
    if (message.authResponse.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.authResponse);
    /* bytes encryptedLoginToken = 3; */
    if (message.encryptedLoginToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ValidateAuthHashRequest
 */
export const ValidateAuthHashRequest = new ValidateAuthHashRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorChannelInfo$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorChannelInfo", [
      {
        no: 1,
        name: "channelType",
        kind: "enum",
        T: () => ["Authentication.TwoFactorChannelType", TwoFactorChannelType],
      },
      { no: 2, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "channelName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "challenge", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "capabilities",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 6, name: "phoneNumber", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 7,
        name: "maxExpiration",
        kind: "enum",
        T: () => ["Authentication.TwoFactorExpiration", TwoFactorExpiration],
      },
      {
        no: 8,
        name: "createdOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 9,
        name: "lastFrequency",
        kind: "enum",
        T: () => ["Authentication.TwoFactorExpiration", TwoFactorExpiration],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.channelType = 0;
    message.channelUid = new Uint8Array(0);
    message.channelName = "";
    message.challenge = "";
    message.capabilities = [];
    message.phoneNumber = "";
    message.maxExpiration = 0;
    message.createdOn = 0n;
    message.lastFrequency = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.TwoFactorChannelType channelType */ 1:
          message.channelType = reader.int32();
          break;
        case /* bytes channel_uid */ 2:
          message.channelUid = reader.bytes();
          break;
        case /* string channelName */ 3:
          message.channelName = reader.string();
          break;
        case /* string challenge */ 4:
          message.challenge = reader.string();
          break;
        case /* repeated string capabilities */ 5:
          message.capabilities.push(reader.string());
          break;
        case /* string phoneNumber */ 6:
          message.phoneNumber = reader.string();
          break;
        case /* Authentication.TwoFactorExpiration maxExpiration */ 7:
          message.maxExpiration = reader.int32();
          break;
        case /* int64 createdOn */ 8:
          message.createdOn = reader.int64().toBigInt();
          break;
        case /* Authentication.TwoFactorExpiration lastFrequency */ 9:
          message.lastFrequency = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.TwoFactorChannelType channelType = 1; */
    if (message.channelType !== 0) writer.tag(1, WireType.Varint).int32(message.channelType);
    /* bytes channel_uid = 2; */
    if (message.channelUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.channelUid);
    /* string channelName = 3; */
    if (message.channelName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.channelName);
    /* string challenge = 4; */
    if (message.challenge !== "") writer.tag(4, WireType.LengthDelimited).string(message.challenge);
    /* repeated string capabilities = 5; */
    for (let i = 0; i < message.capabilities.length; i++)
      writer.tag(5, WireType.LengthDelimited).string(message.capabilities[i]);
    /* string phoneNumber = 6; */
    if (message.phoneNumber !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.phoneNumber);
    /* Authentication.TwoFactorExpiration maxExpiration = 7; */
    if (message.maxExpiration !== 0) writer.tag(7, WireType.Varint).int32(message.maxExpiration);
    /* int64 createdOn = 8; */
    if (message.createdOn !== 0n) writer.tag(8, WireType.Varint).int64(message.createdOn);
    /* Authentication.TwoFactorExpiration lastFrequency = 9; */
    if (message.lastFrequency !== 0) writer.tag(9, WireType.Varint).int32(message.lastFrequency);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorChannelInfo
 */
export const TwoFactorChannelInfo = new TwoFactorChannelInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorDuoStatus$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorDuoStatus", [
      {
        no: 1,
        name: "capabilities",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 2, name: "phoneNumber", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "enroll_url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.capabilities = [];
    message.phoneNumber = "";
    message.enrollUrl = "";
    message.message = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string capabilities */ 1:
          message.capabilities.push(reader.string());
          break;
        case /* string phoneNumber */ 2:
          message.phoneNumber = reader.string();
          break;
        case /* string enroll_url */ 3:
          message.enrollUrl = reader.string();
          break;
        case /* string message */ 4:
          message.message = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated string capabilities = 1; */
    for (let i = 0; i < message.capabilities.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.capabilities[i]);
    /* string phoneNumber = 2; */
    if (message.phoneNumber !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.phoneNumber);
    /* string enroll_url = 3; */
    if (message.enrollUrl !== "") writer.tag(3, WireType.LengthDelimited).string(message.enrollUrl);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorDuoStatus
 */
export const TwoFactorDuoStatus = new TwoFactorDuoStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorAddRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorAddRequest", [
      {
        no: 1,
        name: "channelType",
        kind: "enum",
        T: () => ["Authentication.TwoFactorChannelType", TwoFactorChannelType],
      },
      { no: 2, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "channelName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "phoneNumber", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "duoPushType",
        kind: "enum",
        T: () => ["Authentication.TwoFactorPushType", TwoFactorPushType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.channelType = 0;
    message.channelUid = new Uint8Array(0);
    message.channelName = "";
    message.phoneNumber = "";
    message.duoPushType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.TwoFactorChannelType channelType */ 1:
          message.channelType = reader.int32();
          break;
        case /* bytes channel_uid */ 2:
          message.channelUid = reader.bytes();
          break;
        case /* string channelName */ 3:
          message.channelName = reader.string();
          break;
        case /* string phoneNumber */ 4:
          message.phoneNumber = reader.string();
          break;
        case /* Authentication.TwoFactorPushType duoPushType */ 5:
          message.duoPushType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.TwoFactorChannelType channelType = 1; */
    if (message.channelType !== 0) writer.tag(1, WireType.Varint).int32(message.channelType);
    /* bytes channel_uid = 2; */
    if (message.channelUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.channelUid);
    /* string channelName = 3; */
    if (message.channelName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.channelName);
    /* string phoneNumber = 4; */
    if (message.phoneNumber !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.phoneNumber);
    /* Authentication.TwoFactorPushType duoPushType = 5; */
    if (message.duoPushType !== 0) writer.tag(5, WireType.Varint).int32(message.duoPushType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorAddRequest
 */
export const TwoFactorAddRequest = new TwoFactorAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorRenameRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorRenameRequest", [
      { no: 1, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "channelName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.channelUid = new Uint8Array(0);
    message.channelName = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes channel_uid */ 1:
          message.channelUid = reader.bytes();
          break;
        case /* string channelName */ 2:
          message.channelName = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes channel_uid = 1; */
    if (message.channelUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.channelUid);
    /* string channelName = 2; */
    if (message.channelName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.channelName);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorRenameRequest
 */
export const TwoFactorRenameRequest = new TwoFactorRenameRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorAddResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorAddResponse", [
      { no: 1, name: "challenge", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "backupKeys",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.challenge = "";
    message.backupKeys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string challenge */ 1:
          message.challenge = reader.string();
          break;
        case /* repeated string backupKeys */ 2:
          message.backupKeys.push(reader.string());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string challenge = 1; */
    if (message.challenge !== "") writer.tag(1, WireType.LengthDelimited).string(message.challenge);
    /* repeated string backupKeys = 2; */
    for (let i = 0; i < message.backupKeys.length; i++)
      writer.tag(2, WireType.LengthDelimited).string(message.backupKeys[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorAddResponse
 */
export const TwoFactorAddResponse = new TwoFactorAddResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorDeleteRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorDeleteRequest", [
      { no: 1, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.channelUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes channel_uid */ 1:
          message.channelUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes channel_uid = 1; */
    if (message.channelUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.channelUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorDeleteRequest
 */
export const TwoFactorDeleteRequest = new TwoFactorDeleteRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorListResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorListResponse", [
      {
        no: 1,
        name: "channels",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TwoFactorChannelInfo,
      },
      {
        no: 2,
        name: "expireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.channels = [];
    message.expireOn = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.TwoFactorChannelInfo channels */ 1:
          message.channels.push(
            TwoFactorChannelInfo.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 expireOn */ 2:
          message.expireOn = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.TwoFactorChannelInfo channels = 1; */
    for (let i = 0; i < message.channels.length; i++)
      TwoFactorChannelInfo.internalBinaryWrite(
        message.channels[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 expireOn = 2; */
    if (message.expireOn !== 0n) writer.tag(2, WireType.Varint).int64(message.expireOn);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorListResponse
 */
export const TwoFactorListResponse = new TwoFactorListResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorUpdateExpirationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorUpdateExpirationRequest", [
      {
        no: 1,
        name: "expireIn",
        kind: "enum",
        T: () => ["Authentication.TwoFactorExpiration", TwoFactorExpiration],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.expireIn = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.TwoFactorExpiration expireIn */ 1:
          message.expireIn = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.TwoFactorExpiration expireIn = 1; */
    if (message.expireIn !== 0) writer.tag(1, WireType.Varint).int32(message.expireIn);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorUpdateExpirationRequest
 */
export const TwoFactorUpdateExpirationRequest = new TwoFactorUpdateExpirationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorValidateRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorValidateRequest", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "valueType",
        kind: "enum",
        T: () => ["Authentication.TwoFactorValueType", TwoFactorValueType],
      },
      { no: 3, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "expireIn",
        kind: "enum",
        T: () => ["Authentication.TwoFactorExpiration", TwoFactorExpiration],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    message.valueType = 0;
    message.value = "";
    message.channelUid = new Uint8Array(0);
    message.expireIn = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* Authentication.TwoFactorValueType valueType */ 2:
          message.valueType = reader.int32();
          break;
        case /* string value */ 3:
          message.value = reader.string();
          break;
        case /* bytes channel_uid */ 4:
          message.channelUid = reader.bytes();
          break;
        case /* Authentication.TwoFactorExpiration expireIn */ 5:
          message.expireIn = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* Authentication.TwoFactorValueType valueType = 2; */
    if (message.valueType !== 0) writer.tag(2, WireType.Varint).int32(message.valueType);
    /* string value = 3; */
    if (message.value !== "") writer.tag(3, WireType.LengthDelimited).string(message.value);
    /* bytes channel_uid = 4; */
    if (message.channelUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.channelUid);
    /* Authentication.TwoFactorExpiration expireIn = 5; */
    if (message.expireIn !== 0) writer.tag(5, WireType.Varint).int32(message.expireIn);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorValidateRequest
 */
export const TwoFactorValidateRequest = new TwoFactorValidateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorValidateResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorValidateResponse", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorValidateResponse
 */
export const TwoFactorValidateResponse = new TwoFactorValidateResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TwoFactorSendPushRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TwoFactorSendPushRequest", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "pushType",
        kind: "enum",
        T: () => ["Authentication.TwoFactorPushType", TwoFactorPushType],
      },
      { no: 3, name: "channel_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "expireIn",
        kind: "enum",
        T: () => ["Authentication.TwoFactorExpiration", TwoFactorExpiration],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    message.pushType = 0;
    message.channelUid = new Uint8Array(0);
    message.expireIn = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* Authentication.TwoFactorPushType pushType */ 2:
          message.pushType = reader.int32();
          break;
        case /* bytes channel_uid */ 3:
          message.channelUid = reader.bytes();
          break;
        case /* Authentication.TwoFactorExpiration expireIn */ 4:
          message.expireIn = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* Authentication.TwoFactorPushType pushType = 2; */
    if (message.pushType !== 0) writer.tag(2, WireType.Varint).int32(message.pushType);
    /* bytes channel_uid = 3; */
    if (message.channelUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.channelUid);
    /* Authentication.TwoFactorExpiration expireIn = 4; */
    if (message.expireIn !== 0) writer.tag(4, WireType.Varint).int32(message.expireIn);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TwoFactorSendPushRequest
 */
export const TwoFactorSendPushRequest = new TwoFactorSendPushRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class License$Type extends MessageType {
  constructor() {
    super("Authentication.License", [
      {
        no: 1,
        name: "created",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "licenseStatus",
        kind: "enum",
        T: () => ["Authentication.LicenseStatus", LicenseStatus],
      },
      { no: 4, name: "paid", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.created = 0n;
    message.expiration = 0n;
    message.licenseStatus = 0;
    message.paid = false;
    message.message = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 created */ 1:
          message.created = reader.int64().toBigInt();
          break;
        case /* int64 expiration */ 2:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Authentication.LicenseStatus licenseStatus */ 3:
          message.licenseStatus = reader.int32();
          break;
        case /* bool paid */ 4:
          message.paid = reader.bool();
          break;
        case /* string message */ 5:
          message.message = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 created = 1; */
    if (message.created !== 0n) writer.tag(1, WireType.Varint).int64(message.created);
    /* int64 expiration = 2; */
    if (message.expiration !== 0n) writer.tag(2, WireType.Varint).int64(message.expiration);
    /* Authentication.LicenseStatus licenseStatus = 3; */
    if (message.licenseStatus !== 0) writer.tag(3, WireType.Varint).int32(message.licenseStatus);
    /* bool paid = 4; */
    if (message.paid !== false) writer.tag(4, WireType.Varint).bool(message.paid);
    /* string message = 5; */
    if (message.message !== "") writer.tag(5, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.License
 */
export const License = new License$Type();
// @generated message type with reflection information, may provide speed optimized methods
class OwnerlessRecord$Type extends MessageType {
  constructor() {
    super("Authentication.OwnerlessRecord", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "status", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes recordKey */ 2:
          message.recordKey = reader.bytes();
          break;
        case /* int32 status */ 3:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes recordKey = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    /* int32 status = 3; */
    if (message.status !== 0) writer.tag(3, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.OwnerlessRecord
 */
export const OwnerlessRecord = new OwnerlessRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class OwnerlessRecords$Type extends MessageType {
  constructor() {
    super("Authentication.OwnerlessRecords", [
      {
        no: 1,
        name: "ownerlessRecord",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => OwnerlessRecord,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.ownerlessRecord = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.OwnerlessRecord ownerlessRecord */ 1:
          message.ownerlessRecord.push(
            OwnerlessRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.OwnerlessRecord ownerlessRecord = 1; */
    for (let i = 0; i < message.ownerlessRecord.length; i++)
      OwnerlessRecord.internalBinaryWrite(
        message.ownerlessRecord[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.OwnerlessRecords
 */
export const OwnerlessRecords = new OwnerlessRecords$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserAuthRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UserAuthRequest", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "salt", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "authHash", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "encryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "loginType", kind: "enum", T: () => ["Authentication.LoginType", LoginType] },
      { no: 8, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 9, name: "algorithm", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.salt = new Uint8Array(0);
    message.iterations = 0;
    message.encryptedClientKey = new Uint8Array(0);
    message.authHash = new Uint8Array(0);
    message.encryptedDataKey = new Uint8Array(0);
    message.loginType = 0;
    message.name = "";
    message.algorithm = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* bytes salt */ 2:
          message.salt = reader.bytes();
          break;
        case /* int32 iterations */ 3:
          message.iterations = reader.int32();
          break;
        case /* bytes encryptedClientKey */ 4:
          message.encryptedClientKey = reader.bytes();
          break;
        case /* bytes authHash */ 5:
          message.authHash = reader.bytes();
          break;
        case /* bytes encryptedDataKey */ 6:
          message.encryptedDataKey = reader.bytes();
          break;
        case /* Authentication.LoginType loginType */ 7:
          message.loginType = reader.int32();
          break;
        case /* string name */ 8:
          message.name = reader.string();
          break;
        case /* int32 algorithm */ 9:
          message.algorithm = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* bytes salt = 2; */
    if (message.salt.length) writer.tag(2, WireType.LengthDelimited).bytes(message.salt);
    /* int32 iterations = 3; */
    if (message.iterations !== 0) writer.tag(3, WireType.Varint).int32(message.iterations);
    /* bytes encryptedClientKey = 4; */
    if (message.encryptedClientKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    /* bytes authHash = 5; */
    if (message.authHash.length) writer.tag(5, WireType.LengthDelimited).bytes(message.authHash);
    /* bytes encryptedDataKey = 6; */
    if (message.encryptedDataKey.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.encryptedDataKey);
    /* Authentication.LoginType loginType = 7; */
    if (message.loginType !== 0) writer.tag(7, WireType.Varint).int32(message.loginType);
    /* string name = 8; */
    if (message.name !== "") writer.tag(8, WireType.LengthDelimited).string(message.name);
    /* int32 algorithm = 9; */
    if (message.algorithm !== 0) writer.tag(9, WireType.Varint).int32(message.algorithm);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserAuthRequest
 */
export const UserAuthRequest = new UserAuthRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UidRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UidRequest", [
      {
        no: 1,
        name: "uid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes uid */ 1:
          message.uid.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes uid = 1; */
    for (let i = 0; i < message.uid.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.uid[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UidRequest
 */
export const UidRequest = new UidRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceUpdateRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceUpdateRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
      { no: 6, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 7,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.clientVersion = "";
    message.deviceName = "";
    message.devicePublicKey = new Uint8Array(0);
    message.deviceStatus = 0;
    message.devicePlatform = "";
    message.clientFormFactor = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string deviceName */ 3:
          message.deviceName = reader.string();
          break;
        case /* bytes devicePublicKey */ 4:
          message.devicePublicKey = reader.bytes();
          break;
        case /* Authentication.DeviceStatus deviceStatus */ 5:
          message.deviceStatus = reader.int32();
          break;
        case /* string devicePlatform */ 6:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 7:
          message.clientFormFactor = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceName = 3; */
    if (message.deviceName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.deviceName);
    /* bytes devicePublicKey = 4; */
    if (message.devicePublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* Authentication.DeviceStatus deviceStatus = 5; */
    if (message.deviceStatus !== 0) writer.tag(5, WireType.Varint).int32(message.deviceStatus);
    /* string devicePlatform = 6; */
    if (message.devicePlatform !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 7; */
    if (message.clientFormFactor !== 0)
      writer.tag(7, WireType.Varint).int32(message.clientFormFactor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceUpdateRequest
 */
export const DeviceUpdateRequest = new DeviceUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceUpdateResponse$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceUpdateResponse", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
      { no: 6, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 7,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.clientVersion = "";
    message.deviceName = "";
    message.devicePublicKey = new Uint8Array(0);
    message.deviceStatus = 0;
    message.devicePlatform = "";
    message.clientFormFactor = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string deviceName */ 3:
          message.deviceName = reader.string();
          break;
        case /* bytes devicePublicKey */ 4:
          message.devicePublicKey = reader.bytes();
          break;
        case /* Authentication.DeviceStatus deviceStatus */ 5:
          message.deviceStatus = reader.int32();
          break;
        case /* string devicePlatform */ 6:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 7:
          message.clientFormFactor = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceName = 3; */
    if (message.deviceName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.deviceName);
    /* bytes devicePublicKey = 4; */
    if (message.devicePublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* Authentication.DeviceStatus deviceStatus = 5; */
    if (message.deviceStatus !== 0) writer.tag(5, WireType.Varint).int32(message.deviceStatus);
    /* string devicePlatform = 6; */
    if (message.devicePlatform !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 7; */
    if (message.clientFormFactor !== 0)
      writer.tag(7, WireType.Varint).int32(message.clientFormFactor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceUpdateResponse
 */
export const DeviceUpdateResponse = new DeviceUpdateResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RegisterDeviceInRegionRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RegisterDeviceInRegionRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 6,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.clientVersion = "";
    message.deviceName = "";
    message.devicePublicKey = new Uint8Array(0);
    message.devicePlatform = "";
    message.clientFormFactor = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string deviceName */ 3:
          message.deviceName = reader.string();
          break;
        case /* bytes devicePublicKey */ 4:
          message.devicePublicKey = reader.bytes();
          break;
        case /* string devicePlatform */ 5:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 6:
          message.clientFormFactor = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceName = 3; */
    if (message.deviceName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.deviceName);
    /* bytes devicePublicKey = 4; */
    if (message.devicePublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* string devicePlatform = 5; */
    if (message.devicePlatform !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 6; */
    if (message.clientFormFactor !== 0)
      writer.tag(6, WireType.Varint).int32(message.clientFormFactor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RegisterDeviceInRegionRequest
 */
export const RegisterDeviceInRegionRequest = new RegisterDeviceInRegionRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RegistrationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RegistrationRequest", [
      { no: 1, name: "authRequest", kind: "message", T: () => AuthRequest },
      { no: 2, name: "userAuthRequest", kind: "message", T: () => UserAuthRequest },
      { no: 3, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "deprecatedAuthHashHash", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 8, name: "deprecatedEncryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 9, name: "deprecatedEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 10, name: "deprecatedEncryptionParams", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedClientKey = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    message.publicKey = new Uint8Array(0);
    message.verificationCode = "";
    message.deprecatedAuthHashHash = new Uint8Array(0);
    message.deprecatedEncryptedClientKey = new Uint8Array(0);
    message.deprecatedEncryptedPrivateKey = new Uint8Array(0);
    message.deprecatedEncryptionParams = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.AuthRequest authRequest */ 1:
          message.authRequest = AuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.authRequest,
          );
          break;
        case /* Authentication.UserAuthRequest userAuthRequest */ 2:
          message.userAuthRequest = UserAuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.userAuthRequest,
          );
          break;
        case /* bytes encryptedClientKey */ 3:
          message.encryptedClientKey = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 4:
          message.encryptedPrivateKey = reader.bytes();
          break;
        case /* bytes publicKey */ 5:
          message.publicKey = reader.bytes();
          break;
        case /* string verificationCode */ 6:
          message.verificationCode = reader.string();
          break;
        case /* bytes deprecatedAuthHashHash */ 7:
          message.deprecatedAuthHashHash = reader.bytes();
          break;
        case /* bytes deprecatedEncryptedClientKey */ 8:
          message.deprecatedEncryptedClientKey = reader.bytes();
          break;
        case /* bytes deprecatedEncryptedPrivateKey */ 9:
          message.deprecatedEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes deprecatedEncryptionParams */ 10:
          message.deprecatedEncryptionParams = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthRequest authRequest = 1; */
    if (message.authRequest)
      AuthRequest.internalBinaryWrite(
        message.authRequest,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Authentication.UserAuthRequest userAuthRequest = 2; */
    if (message.userAuthRequest)
      UserAuthRequest.internalBinaryWrite(
        message.userAuthRequest,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes encryptedClientKey = 3; */
    if (message.encryptedClientKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    /* bytes encryptedPrivateKey = 4; */
    if (message.encryptedPrivateKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    /* bytes publicKey = 5; */
    if (message.publicKey.length) writer.tag(5, WireType.LengthDelimited).bytes(message.publicKey);
    /* string verificationCode = 6; */
    if (message.verificationCode !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.verificationCode);
    /* bytes deprecatedAuthHashHash = 7; */
    if (message.deprecatedAuthHashHash.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.deprecatedAuthHashHash);
    /* bytes deprecatedEncryptedClientKey = 8; */
    if (message.deprecatedEncryptedClientKey.length)
      writer.tag(8, WireType.LengthDelimited).bytes(message.deprecatedEncryptedClientKey);
    /* bytes deprecatedEncryptedPrivateKey = 9; */
    if (message.deprecatedEncryptedPrivateKey.length)
      writer.tag(9, WireType.LengthDelimited).bytes(message.deprecatedEncryptedPrivateKey);
    /* bytes deprecatedEncryptionParams = 10; */
    if (message.deprecatedEncryptionParams.length)
      writer.tag(10, WireType.LengthDelimited).bytes(message.deprecatedEncryptionParams);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RegistrationRequest
 */
export const RegistrationRequest = new RegistrationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ConvertUserToV3Request$Type extends MessageType {
  constructor() {
    super("Authentication.ConvertUserToV3Request", [
      { no: 1, name: "authRequest", kind: "message", T: () => AuthRequest },
      { no: 2, name: "userAuthRequest", kind: "message", T: () => UserAuthRequest },
      { no: 3, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedClientKey = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    message.publicKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.AuthRequest authRequest */ 1:
          message.authRequest = AuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.authRequest,
          );
          break;
        case /* Authentication.UserAuthRequest userAuthRequest */ 2:
          message.userAuthRequest = UserAuthRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.userAuthRequest,
          );
          break;
        case /* bytes encryptedClientKey */ 3:
          message.encryptedClientKey = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 4:
          message.encryptedPrivateKey = reader.bytes();
          break;
        case /* bytes publicKey */ 5:
          message.publicKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthRequest authRequest = 1; */
    if (message.authRequest)
      AuthRequest.internalBinaryWrite(
        message.authRequest,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Authentication.UserAuthRequest userAuthRequest = 2; */
    if (message.userAuthRequest)
      UserAuthRequest.internalBinaryWrite(
        message.userAuthRequest,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes encryptedClientKey = 3; */
    if (message.encryptedClientKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    /* bytes encryptedPrivateKey = 4; */
    if (message.encryptedPrivateKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    /* bytes publicKey = 5; */
    if (message.publicKey.length) writer.tag(5, WireType.LengthDelimited).bytes(message.publicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ConvertUserToV3Request
 */
export const ConvertUserToV3Request = new ConvertUserToV3Request$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RevisionResponse$Type extends MessageType {
  constructor() {
    super("Authentication.RevisionResponse", [
      {
        no: 1,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.revision = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 revision */ 1:
          message.revision = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 revision = 1; */
    if (message.revision !== 0n) writer.tag(1, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RevisionResponse
 */
export const RevisionResponse = new RevisionResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeEmailRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeEmailRequest", [
      { no: 1, name: "newEmail", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.newEmail = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string newEmail */ 1:
          message.newEmail = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string newEmail = 1; */
    if (message.newEmail !== "") writer.tag(1, WireType.LengthDelimited).string(message.newEmail);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeEmailRequest
 */
export const ChangeEmailRequest = new ChangeEmailRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeEmailResponse$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeEmailResponse", [
      { no: 1, name: "encryptedChangeEmailToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedChangeEmailToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedChangeEmailToken */ 1:
          message.encryptedChangeEmailToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedChangeEmailToken = 1; */
    if (message.encryptedChangeEmailToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedChangeEmailToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeEmailResponse
 */
export const ChangeEmailResponse = new ChangeEmailResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EmailVerificationLinkResponse$Type extends MessageType {
  constructor() {
    super("Authentication.EmailVerificationLinkResponse", [
      { no: 1, name: "emailVerified", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.emailVerified = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool emailVerified */ 1:
          message.emailVerified = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool emailVerified = 1; */
    if (message.emailVerified !== false) writer.tag(1, WireType.Varint).bool(message.emailVerified);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EmailVerificationLinkResponse
 */
export const EmailVerificationLinkResponse = new EmailVerificationLinkResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityData$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityData", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.data = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* bytes data */ 2:
          message.data = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* bytes data = 2; */
    if (message.data.length) writer.tag(2, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityData
 */
export const SecurityData = new SecurityData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityScoreData$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityScoreData", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.data = new Uint8Array(0);
    message.revision = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* bytes data */ 2:
          message.data = reader.bytes();
          break;
        case /* int64 revision */ 3:
          message.revision = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* bytes data = 2; */
    if (message.data.length) writer.tag(2, WireType.LengthDelimited).bytes(message.data);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityScoreData
 */
export const SecurityScoreData = new SecurityScoreData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityDataRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityDataRequest", [
      {
        no: 1,
        name: "recordSecurityData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityData,
      },
      {
        no: 2,
        name: "masterPasswordSecurityData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityData,
      },
      {
        no: 3,
        name: "encryptionType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      {
        no: 4,
        name: "recordSecurityScoreData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityScoreData,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordSecurityData = [];
    message.masterPasswordSecurityData = [];
    message.encryptionType = 0;
    message.recordSecurityScoreData = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.SecurityData recordSecurityData */ 1:
          message.recordSecurityData.push(
            SecurityData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Authentication.SecurityData masterPasswordSecurityData */ 2:
          message.masterPasswordSecurityData.push(
            SecurityData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Enterprise.EncryptedKeyType encryptionType */ 3:
          message.encryptionType = reader.int32();
          break;
        case /* repeated Authentication.SecurityScoreData recordSecurityScoreData */ 4:
          message.recordSecurityScoreData.push(
            SecurityScoreData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.SecurityData recordSecurityData = 1; */
    for (let i = 0; i < message.recordSecurityData.length; i++)
      SecurityData.internalBinaryWrite(
        message.recordSecurityData[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.SecurityData masterPasswordSecurityData = 2; */
    for (let i = 0; i < message.masterPasswordSecurityData.length; i++)
      SecurityData.internalBinaryWrite(
        message.masterPasswordSecurityData[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.EncryptedKeyType encryptionType = 3; */
    if (message.encryptionType !== 0) writer.tag(3, WireType.Varint).int32(message.encryptionType);
    /* repeated Authentication.SecurityScoreData recordSecurityScoreData = 4; */
    for (let i = 0; i < message.recordSecurityScoreData.length; i++)
      SecurityScoreData.internalBinaryWrite(
        message.recordSecurityScoreData[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityDataRequest
 */
export const SecurityDataRequest = new SecurityDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityReportIncrementalData$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityReportIncrementalData", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "currentSecurityData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "currentSecurityDataRevision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "oldSecurityData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "oldSecurityDataRevision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 6,
        name: "currentDataEncryptionType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      {
        no: 7,
        name: "oldDataEncryptionType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      { no: 8, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.currentSecurityData = new Uint8Array(0);
    message.currentSecurityDataRevision = 0n;
    message.oldSecurityData = new Uint8Array(0);
    message.oldSecurityDataRevision = 0n;
    message.currentDataEncryptionType = 0;
    message.oldDataEncryptionType = 0;
    message.recordUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes currentSecurityData */ 2:
          message.currentSecurityData = reader.bytes();
          break;
        case /* int64 currentSecurityDataRevision */ 3:
          message.currentSecurityDataRevision = reader.int64().toBigInt();
          break;
        case /* bytes oldSecurityData */ 4:
          message.oldSecurityData = reader.bytes();
          break;
        case /* int64 oldSecurityDataRevision */ 5:
          message.oldSecurityDataRevision = reader.int64().toBigInt();
          break;
        case /* Enterprise.EncryptedKeyType currentDataEncryptionType */ 6:
          message.currentDataEncryptionType = reader.int32();
          break;
        case /* Enterprise.EncryptedKeyType oldDataEncryptionType */ 7:
          message.oldDataEncryptionType = reader.int32();
          break;
        case /* bytes recordUid */ 8:
          message.recordUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes currentSecurityData = 2; */
    if (message.currentSecurityData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.currentSecurityData);
    /* int64 currentSecurityDataRevision = 3; */
    if (message.currentSecurityDataRevision !== 0n)
      writer.tag(3, WireType.Varint).int64(message.currentSecurityDataRevision);
    /* bytes oldSecurityData = 4; */
    if (message.oldSecurityData.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.oldSecurityData);
    /* int64 oldSecurityDataRevision = 5; */
    if (message.oldSecurityDataRevision !== 0n)
      writer.tag(5, WireType.Varint).int64(message.oldSecurityDataRevision);
    /* Enterprise.EncryptedKeyType currentDataEncryptionType = 6; */
    if (message.currentDataEncryptionType !== 0)
      writer.tag(6, WireType.Varint).int32(message.currentDataEncryptionType);
    /* Enterprise.EncryptedKeyType oldDataEncryptionType = 7; */
    if (message.oldDataEncryptionType !== 0)
      writer.tag(7, WireType.Varint).int32(message.oldDataEncryptionType);
    /* bytes recordUid = 8; */
    if (message.recordUid.length) writer.tag(8, WireType.LengthDelimited).bytes(message.recordUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityReportIncrementalData
 */
export const SecurityReportIncrementalData = new SecurityReportIncrementalData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityReport$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityReport", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedReportData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "twoFactor", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "lastLogin",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "numberOfReusedPassword", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 7,
        name: "securityReportIncrementalData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityReportIncrementalData,
      },
      { no: 8, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 9, name: "hasOldEncryption", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.encryptedReportData = new Uint8Array(0);
    message.revision = 0n;
    message.twoFactor = "";
    message.lastLogin = 0n;
    message.numberOfReusedPassword = 0;
    message.securityReportIncrementalData = [];
    message.userId = 0;
    message.hasOldEncryption = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedReportData */ 2:
          message.encryptedReportData = reader.bytes();
          break;
        case /* int64 revision */ 3:
          message.revision = reader.int64().toBigInt();
          break;
        case /* string twoFactor */ 4:
          message.twoFactor = reader.string();
          break;
        case /* int64 lastLogin */ 5:
          message.lastLogin = reader.int64().toBigInt();
          break;
        case /* int32 numberOfReusedPassword */ 6:
          message.numberOfReusedPassword = reader.int32();
          break;
        case /* repeated Authentication.SecurityReportIncrementalData securityReportIncrementalData */ 7:
          message.securityReportIncrementalData.push(
            SecurityReportIncrementalData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int32 userId */ 8:
          message.userId = reader.int32();
          break;
        case /* bool hasOldEncryption */ 9:
          message.hasOldEncryption = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes encryptedReportData = 2; */
    if (message.encryptedReportData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedReportData);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    /* string twoFactor = 4; */
    if (message.twoFactor !== "") writer.tag(4, WireType.LengthDelimited).string(message.twoFactor);
    /* int64 lastLogin = 5; */
    if (message.lastLogin !== 0n) writer.tag(5, WireType.Varint).int64(message.lastLogin);
    /* int32 numberOfReusedPassword = 6; */
    if (message.numberOfReusedPassword !== 0)
      writer.tag(6, WireType.Varint).int32(message.numberOfReusedPassword);
    /* repeated Authentication.SecurityReportIncrementalData securityReportIncrementalData = 7; */
    for (let i = 0; i < message.securityReportIncrementalData.length; i++)
      SecurityReportIncrementalData.internalBinaryWrite(
        message.securityReportIncrementalData[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int32 userId = 8; */
    if (message.userId !== 0) writer.tag(8, WireType.Varint).int32(message.userId);
    /* bool hasOldEncryption = 9; */
    if (message.hasOldEncryption !== false)
      writer.tag(9, WireType.Varint).bool(message.hasOldEncryption);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityReport
 */
export const SecurityReport = new SecurityReport$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityReportSaveRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityReportSaveRequest", [
      {
        no: 1,
        name: "securityReport",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityReport,
      },
      { no: 2, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.securityReport = [];
    message.continuationToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.SecurityReport securityReport */ 1:
          message.securityReport.push(
            SecurityReport.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bytes continuationToken */ 2:
          message.continuationToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.SecurityReport securityReport = 1; */
    for (let i = 0; i < message.securityReport.length; i++)
      SecurityReport.internalBinaryWrite(
        message.securityReport[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes continuationToken = 2; */
    if (message.continuationToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.continuationToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityReportSaveRequest
 */
export const SecurityReportSaveRequest = new SecurityReportSaveRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityReportRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityReportRequest", [
      {
        no: 1,
        name: "fromPage",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.fromPage = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 fromPage */ 1:
          message.fromPage = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 fromPage = 1; */
    if (message.fromPage !== 0n) writer.tag(1, WireType.Varint).int64(message.fromPage);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityReportRequest
 */
export const SecurityReportRequest = new SecurityReportRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityReportResponse$Type extends MessageType {
  constructor() {
    super("Authentication.SecurityReportResponse", [
      { no: 1, name: "enterprisePrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "securityReport",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityReport,
      },
      {
        no: 3,
        name: "asOfRevision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "fromPage",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "toPage",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "complete", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "enterpriseEccPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 8, name: "hasIncrementalData", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterprisePrivateKey = new Uint8Array(0);
    message.securityReport = [];
    message.asOfRevision = 0n;
    message.fromPage = 0n;
    message.toPage = 0n;
    message.complete = false;
    message.enterpriseEccPrivateKey = new Uint8Array(0);
    message.hasIncrementalData = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes enterprisePrivateKey */ 1:
          message.enterprisePrivateKey = reader.bytes();
          break;
        case /* repeated Authentication.SecurityReport securityReport */ 2:
          message.securityReport.push(
            SecurityReport.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 asOfRevision */ 3:
          message.asOfRevision = reader.int64().toBigInt();
          break;
        case /* int64 fromPage */ 4:
          message.fromPage = reader.int64().toBigInt();
          break;
        case /* int64 toPage */ 5:
          message.toPage = reader.int64().toBigInt();
          break;
        case /* bool complete */ 6:
          message.complete = reader.bool();
          break;
        case /* bytes enterpriseEccPrivateKey */ 7:
          message.enterpriseEccPrivateKey = reader.bytes();
          break;
        case /* bool hasIncrementalData */ 8:
          message.hasIncrementalData = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes enterprisePrivateKey = 1; */
    if (message.enterprisePrivateKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.enterprisePrivateKey);
    /* repeated Authentication.SecurityReport securityReport = 2; */
    for (let i = 0; i < message.securityReport.length; i++)
      SecurityReport.internalBinaryWrite(
        message.securityReport[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 asOfRevision = 3; */
    if (message.asOfRevision !== 0n) writer.tag(3, WireType.Varint).int64(message.asOfRevision);
    /* int64 fromPage = 4; */
    if (message.fromPage !== 0n) writer.tag(4, WireType.Varint).int64(message.fromPage);
    /* int64 toPage = 5; */
    if (message.toPage !== 0n) writer.tag(5, WireType.Varint).int64(message.toPage);
    /* bool complete = 6; */
    if (message.complete !== false) writer.tag(6, WireType.Varint).bool(message.complete);
    /* bytes enterpriseEccPrivateKey = 7; */
    if (message.enterpriseEccPrivateKey.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.enterpriseEccPrivateKey);
    /* bool hasIncrementalData = 8; */
    if (message.hasIncrementalData !== false)
      writer.tag(8, WireType.Varint).bool(message.hasIncrementalData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SecurityReportResponse
 */
export const SecurityReportResponse = new SecurityReportResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class IncrementalSecurityDataRequest$Type extends MessageType {
  constructor() {
    super("Authentication.IncrementalSecurityDataRequest", [
      { no: 1, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.continuationToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes continuationToken */ 1:
          message.continuationToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes continuationToken = 1; */
    if (message.continuationToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.continuationToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.IncrementalSecurityDataRequest
 */
export const IncrementalSecurityDataRequest = new IncrementalSecurityDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class IncrementalSecurityDataResponse$Type extends MessageType {
  constructor() {
    super("Authentication.IncrementalSecurityDataResponse", [
      {
        no: 1,
        name: "securityReportIncrementalData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityReportIncrementalData,
      },
      { no: 2, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.securityReportIncrementalData = [];
    message.continuationToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.SecurityReportIncrementalData securityReportIncrementalData */ 1:
          message.securityReportIncrementalData.push(
            SecurityReportIncrementalData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bytes continuationToken */ 2:
          message.continuationToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.SecurityReportIncrementalData securityReportIncrementalData = 1; */
    for (let i = 0; i < message.securityReportIncrementalData.length; i++)
      SecurityReportIncrementalData.internalBinaryWrite(
        message.securityReportIncrementalData[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes continuationToken = 2; */
    if (message.continuationToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.continuationToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.IncrementalSecurityDataResponse
 */
export const IncrementalSecurityDataResponse = new IncrementalSecurityDataResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReusedPasswordsRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ReusedPasswordsRequest", [
      { no: 1, name: "count", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.count = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 count */ 1:
          message.count = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 count = 1; */
    if (message.count !== 0) writer.tag(1, WireType.Varint).int32(message.count);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ReusedPasswordsRequest
 */
export const ReusedPasswordsRequest = new ReusedPasswordsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SummaryConsoleReport$Type extends MessageType {
  constructor() {
    super("Authentication.SummaryConsoleReport", [
      { no: 1, name: "reportType", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "reportData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reportType = 0;
    message.reportData = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 reportType */ 1:
          message.reportType = reader.int32();
          break;
        case /* bytes reportData */ 2:
          message.reportData = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 reportType = 1; */
    if (message.reportType !== 0) writer.tag(1, WireType.Varint).int32(message.reportType);
    /* bytes reportData = 2; */
    if (message.reportData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.reportData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SummaryConsoleReport
 */
export const SummaryConsoleReport = new SummaryConsoleReport$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeToKeyTypeOne$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeToKeyTypeOne", [
      {
        no: 1,
        name: "objectType",
        kind: "enum",
        T: () => ["Authentication.ObjectTypes", ObjectTypes],
      },
      { no: 2, name: "primaryUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "secondaryUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.objectType = 0;
    message.primaryUid = new Uint8Array(0);
    message.secondaryUid = new Uint8Array(0);
    message.key = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.ObjectTypes objectType */ 1:
          message.objectType = reader.int32();
          break;
        case /* bytes primaryUid */ 2:
          message.primaryUid = reader.bytes();
          break;
        case /* bytes secondaryUid */ 3:
          message.secondaryUid = reader.bytes();
          break;
        case /* bytes key */ 4:
          message.key = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.ObjectTypes objectType = 1; */
    if (message.objectType !== 0) writer.tag(1, WireType.Varint).int32(message.objectType);
    /* bytes primaryUid = 2; */
    if (message.primaryUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.primaryUid);
    /* bytes secondaryUid = 3; */
    if (message.secondaryUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.secondaryUid);
    /* bytes key = 4; */
    if (message.key.length) writer.tag(4, WireType.LengthDelimited).bytes(message.key);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeToKeyTypeOne
 */
export const ChangeToKeyTypeOne = new ChangeToKeyTypeOne$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeToKeyTypeOneRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeToKeyTypeOneRequest", [
      {
        no: 1,
        name: "changeToKeyTypeOne",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ChangeToKeyTypeOne,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.changeToKeyTypeOne = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.ChangeToKeyTypeOne changeToKeyTypeOne */ 1:
          message.changeToKeyTypeOne.push(
            ChangeToKeyTypeOne.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.ChangeToKeyTypeOne changeToKeyTypeOne = 1; */
    for (let i = 0; i < message.changeToKeyTypeOne.length; i++)
      ChangeToKeyTypeOne.internalBinaryWrite(
        message.changeToKeyTypeOne[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeToKeyTypeOneRequest
 */
export const ChangeToKeyTypeOneRequest = new ChangeToKeyTypeOneRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeToKeyTypeOneStatus$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeToKeyTypeOneStatus", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "type", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "reason", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.type = "";
    message.status = "";
    message.reason = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* string type */ 2:
          message.type = reader.string();
          break;
        case /* string status */ 3:
          message.status = reader.string();
          break;
        case /* string reason */ 4:
          message.reason = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* string type = 2; */
    if (message.type !== "") writer.tag(2, WireType.LengthDelimited).string(message.type);
    /* string status = 3; */
    if (message.status !== "") writer.tag(3, WireType.LengthDelimited).string(message.status);
    /* string reason = 4; */
    if (message.reason !== "") writer.tag(4, WireType.LengthDelimited).string(message.reason);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeToKeyTypeOneStatus
 */
export const ChangeToKeyTypeOneStatus = new ChangeToKeyTypeOneStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeToKeyTypeOneResponse$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeToKeyTypeOneResponse", [
      {
        no: 1,
        name: "changeToKeyTypeOneStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ChangeToKeyTypeOneStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.changeToKeyTypeOneStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.ChangeToKeyTypeOneStatus changeToKeyTypeOneStatus */ 1:
          message.changeToKeyTypeOneStatus.push(
            ChangeToKeyTypeOneStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.ChangeToKeyTypeOneStatus changeToKeyTypeOneStatus = 1; */
    for (let i = 0; i < message.changeToKeyTypeOneStatus.length; i++)
      ChangeToKeyTypeOneStatus.internalBinaryWrite(
        message.changeToKeyTypeOneStatus[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeToKeyTypeOneResponse
 */
export const ChangeToKeyTypeOneResponse = new ChangeToKeyTypeOneResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetChangeKeyTypesRequest$Type extends MessageType {
  constructor() {
    super("Authentication.GetChangeKeyTypesRequest", [
      {
        no: 1,
        name: "onlyTheseObjects",
        kind: "enum",
        repeat: 1 /*RepeatType.PACKED*/,
        T: () => ["Authentication.EncryptedObjectType", EncryptedObjectType],
      },
      { no: 2, name: "limit", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "includeRecommended", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "includeKeys", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "includeAllowedKeyTypes", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.onlyTheseObjects = [];
    message.limit = 0;
    message.includeRecommended = false;
    message.includeKeys = false;
    message.includeAllowedKeyTypes = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.EncryptedObjectType onlyTheseObjects */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.onlyTheseObjects.push(reader.int32());
          else message.onlyTheseObjects.push(reader.int32());
          break;
        case /* int32 limit */ 2:
          message.limit = reader.int32();
          break;
        case /* bool includeRecommended */ 3:
          message.includeRecommended = reader.bool();
          break;
        case /* bool includeKeys */ 4:
          message.includeKeys = reader.bool();
          break;
        case /* bool includeAllowedKeyTypes */ 5:
          message.includeAllowedKeyTypes = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.EncryptedObjectType onlyTheseObjects = 1; */
    if (message.onlyTheseObjects.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.onlyTheseObjects.length; i++)
        writer.int32(message.onlyTheseObjects[i]);
      writer.join();
    }
    /* int32 limit = 2; */
    if (message.limit !== 0) writer.tag(2, WireType.Varint).int32(message.limit);
    /* bool includeRecommended = 3; */
    if (message.includeRecommended !== false)
      writer.tag(3, WireType.Varint).bool(message.includeRecommended);
    /* bool includeKeys = 4; */
    if (message.includeKeys !== false) writer.tag(4, WireType.Varint).bool(message.includeKeys);
    /* bool includeAllowedKeyTypes = 5; */
    if (message.includeAllowedKeyTypes !== false)
      writer.tag(5, WireType.Varint).bool(message.includeAllowedKeyTypes);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetChangeKeyTypesRequest
 */
export const GetChangeKeyTypesRequest = new GetChangeKeyTypesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetChangeKeyTypesResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetChangeKeyTypesResponse", [
      {
        no: 1,
        name: "keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ChangeKeyType,
      },
      {
        no: 2,
        name: "allowedKeyTypes",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AllowedKeyTypes,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keys = [];
    message.allowedKeyTypes = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.ChangeKeyType keys */ 1:
          message.keys.push(ChangeKeyType.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Authentication.AllowedKeyTypes allowedKeyTypes */ 2:
          message.allowedKeyTypes.push(
            AllowedKeyTypes.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.ChangeKeyType keys = 1; */
    for (let i = 0; i < message.keys.length; i++)
      ChangeKeyType.internalBinaryWrite(
        message.keys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.AllowedKeyTypes allowedKeyTypes = 2; */
    for (let i = 0; i < message.allowedKeyTypes.length; i++)
      AllowedKeyTypes.internalBinaryWrite(
        message.allowedKeyTypes[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetChangeKeyTypesResponse
 */
export const GetChangeKeyTypesResponse = new GetChangeKeyTypesResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AllowedKeyTypes$Type extends MessageType {
  constructor() {
    super("Authentication.AllowedKeyTypes", [
      {
        no: 1,
        name: "objectType",
        kind: "enum",
        T: () => ["Authentication.EncryptedObjectType", EncryptedObjectType],
      },
      {
        no: 2,
        name: "allowedKeyTypes",
        kind: "enum",
        repeat: 1 /*RepeatType.PACKED*/,
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.objectType = 0;
    message.allowedKeyTypes = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.EncryptedObjectType objectType */ 1:
          message.objectType = reader.int32();
          break;
        case /* repeated Enterprise.EncryptedKeyType allowedKeyTypes */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.allowedKeyTypes.push(reader.int32());
          else message.allowedKeyTypes.push(reader.int32());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.EncryptedObjectType objectType = 1; */
    if (message.objectType !== 0) writer.tag(1, WireType.Varint).int32(message.objectType);
    /* repeated Enterprise.EncryptedKeyType allowedKeyTypes = 2; */
    if (message.allowedKeyTypes.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.allowedKeyTypes.length; i++)
        writer.int32(message.allowedKeyTypes[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AllowedKeyTypes
 */
export const AllowedKeyTypes = new AllowedKeyTypes$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeKeyTypes$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeKeyTypes", [
      {
        no: 1,
        name: "keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ChangeKeyType,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.ChangeKeyType keys */ 1:
          message.keys.push(ChangeKeyType.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.ChangeKeyType keys = 1; */
    for (let i = 0; i < message.keys.length; i++)
      ChangeKeyType.internalBinaryWrite(
        message.keys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeKeyTypes
 */
export const ChangeKeyTypes = new ChangeKeyTypes$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeKeyType$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeKeyType", [
      {
        no: 1,
        name: "objectType",
        kind: "enum",
        T: () => ["Authentication.EncryptedObjectType", EncryptedObjectType],
      },
      { no: 2, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "secondaryUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      {
        no: 6,
        name: "status",
        kind: "enum",
        T: () => ["Authentication.GenericStatus", GenericStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.objectType = 0;
    message.uid = new Uint8Array(0);
    message.secondaryUid = new Uint8Array(0);
    message.key = new Uint8Array(0);
    message.keyType = 0;
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.EncryptedObjectType objectType */ 1:
          message.objectType = reader.int32();
          break;
        case /* bytes uid */ 2:
          message.uid = reader.bytes();
          break;
        case /* bytes secondaryUid */ 3:
          message.secondaryUid = reader.bytes();
          break;
        case /* bytes key */ 4:
          message.key = reader.bytes();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 5:
          message.keyType = reader.int32();
          break;
        case /* Authentication.GenericStatus status */ 6:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.EncryptedObjectType objectType = 1; */
    if (message.objectType !== 0) writer.tag(1, WireType.Varint).int32(message.objectType);
    /* bytes uid = 2; */
    if (message.uid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.uid);
    /* bytes secondaryUid = 3; */
    if (message.secondaryUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.secondaryUid);
    /* bytes key = 4; */
    if (message.key.length) writer.tag(4, WireType.LengthDelimited).bytes(message.key);
    /* Enterprise.EncryptedKeyType keyType = 5; */
    if (message.keyType !== 0) writer.tag(5, WireType.Varint).int32(message.keyType);
    /* Authentication.GenericStatus status = 6; */
    if (message.status !== 0) writer.tag(6, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeKeyType
 */
export const ChangeKeyType = new ChangeKeyType$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetKey$Type extends MessageType {
  constructor() {
    super("Authentication.SetKey", [
      { no: 1, name: "id", kind: "scalar", T: 3 /*ScalarType.INT64*/, L: 0 /*LongType.BIGINT*/ },
      { no: 2, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.id = 0n;
    message.key = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 id */ 1:
          message.id = reader.int64().toBigInt();
          break;
        case /* bytes key */ 2:
          message.key = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 id = 1; */
    if (message.id !== 0n) writer.tag(1, WireType.Varint).int64(message.id);
    /* bytes key = 2; */
    if (message.key.length) writer.tag(2, WireType.LengthDelimited).bytes(message.key);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SetKey
 */
export const SetKey = new SetKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetKeyRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SetKeyRequest", [
      { no: 1, name: "keys", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => SetKey },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.SetKey keys */ 1:
          message.keys.push(SetKey.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.SetKey keys = 1; */
    for (let i = 0; i < message.keys.length; i++)
      SetKey.internalBinaryWrite(
        message.keys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SetKeyRequest
 */
export const SetKeyRequest = new SetKeyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class CreateUserRequest$Type extends MessageType {
  constructor() {
    super("Authentication.CreateUserRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "authVerifier", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "encryptionParams", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "rsaPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "rsaEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "eccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "eccEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 8, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 9, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 10, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 11, name: "encryptedDeviceDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 12, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 13, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 14, name: "installReferrer", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 15, name: "mccMNC", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 16, name: "mfg", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 17, name: "model", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 18, name: "brand", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 19, name: "product", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 20, name: "device", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 21, name: "carrier", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 22, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 23, name: "enterpriseRegistration", kind: "message", T: () => EnterpriseRegistration },
      { no: 24, name: "encryptedVerificationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 25, name: "enterpriseUsersDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.authVerifier = new Uint8Array(0);
    message.encryptionParams = new Uint8Array(0);
    message.rsaPublicKey = new Uint8Array(0);
    message.rsaEncryptedPrivateKey = new Uint8Array(0);
    message.eccPublicKey = new Uint8Array(0);
    message.eccEncryptedPrivateKey = new Uint8Array(0);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.encryptedClientKey = new Uint8Array(0);
    message.clientVersion = "";
    message.encryptedDeviceDataKey = new Uint8Array(0);
    message.encryptedLoginToken = new Uint8Array(0);
    message.messageSessionUid = new Uint8Array(0);
    message.installReferrer = "";
    message.mccMNC = 0;
    message.mfg = "";
    message.model = "";
    message.brand = "";
    message.product = "";
    message.device = "";
    message.carrier = "";
    message.verificationCode = "";
    message.encryptedVerificationToken = new Uint8Array(0);
    message.enterpriseUsersDataKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* bytes authVerifier */ 2:
          message.authVerifier = reader.bytes();
          break;
        case /* bytes encryptionParams */ 3:
          message.encryptionParams = reader.bytes();
          break;
        case /* bytes rsaPublicKey */ 4:
          message.rsaPublicKey = reader.bytes();
          break;
        case /* bytes rsaEncryptedPrivateKey */ 5:
          message.rsaEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes eccPublicKey */ 6:
          message.eccPublicKey = reader.bytes();
          break;
        case /* bytes eccEncryptedPrivateKey */ 7:
          message.eccEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes encryptedDeviceToken */ 8:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes encryptedClientKey */ 9:
          message.encryptedClientKey = reader.bytes();
          break;
        case /* string clientVersion */ 10:
          message.clientVersion = reader.string();
          break;
        case /* bytes encryptedDeviceDataKey */ 11:
          message.encryptedDeviceDataKey = reader.bytes();
          break;
        case /* bytes encryptedLoginToken */ 12:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* bytes messageSessionUid */ 13:
          message.messageSessionUid = reader.bytes();
          break;
        case /* string installReferrer */ 14:
          message.installReferrer = reader.string();
          break;
        case /* int32 mccMNC */ 15:
          message.mccMNC = reader.int32();
          break;
        case /* string mfg */ 16:
          message.mfg = reader.string();
          break;
        case /* string model */ 17:
          message.model = reader.string();
          break;
        case /* string brand */ 18:
          message.brand = reader.string();
          break;
        case /* string product */ 19:
          message.product = reader.string();
          break;
        case /* string device */ 20:
          message.device = reader.string();
          break;
        case /* string carrier */ 21:
          message.carrier = reader.string();
          break;
        case /* string verificationCode */ 22:
          message.verificationCode = reader.string();
          break;
        case /* Enterprise.EnterpriseRegistration enterpriseRegistration */ 23:
          message.enterpriseRegistration = EnterpriseRegistration.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.enterpriseRegistration,
          );
          break;
        case /* bytes encryptedVerificationToken */ 24:
          message.encryptedVerificationToken = reader.bytes();
          break;
        case /* bytes enterpriseUsersDataKey */ 25:
          message.enterpriseUsersDataKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* bytes authVerifier = 2; */
    if (message.authVerifier.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.authVerifier);
    /* bytes encryptionParams = 3; */
    if (message.encryptionParams.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptionParams);
    /* bytes rsaPublicKey = 4; */
    if (message.rsaPublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.rsaPublicKey);
    /* bytes rsaEncryptedPrivateKey = 5; */
    if (message.rsaEncryptedPrivateKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.rsaEncryptedPrivateKey);
    /* bytes eccPublicKey = 6; */
    if (message.eccPublicKey.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.eccPublicKey);
    /* bytes eccEncryptedPrivateKey = 7; */
    if (message.eccEncryptedPrivateKey.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.eccEncryptedPrivateKey);
    /* bytes encryptedDeviceToken = 8; */
    if (message.encryptedDeviceToken.length)
      writer.tag(8, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes encryptedClientKey = 9; */
    if (message.encryptedClientKey.length)
      writer.tag(9, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    /* string clientVersion = 10; */
    if (message.clientVersion !== "")
      writer.tag(10, WireType.LengthDelimited).string(message.clientVersion);
    /* bytes encryptedDeviceDataKey = 11; */
    if (message.encryptedDeviceDataKey.length)
      writer.tag(11, WireType.LengthDelimited).bytes(message.encryptedDeviceDataKey);
    /* bytes encryptedLoginToken = 12; */
    if (message.encryptedLoginToken.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* bytes messageSessionUid = 13; */
    if (message.messageSessionUid.length)
      writer.tag(13, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* string installReferrer = 14; */
    if (message.installReferrer !== "")
      writer.tag(14, WireType.LengthDelimited).string(message.installReferrer);
    /* int32 mccMNC = 15; */
    if (message.mccMNC !== 0) writer.tag(15, WireType.Varint).int32(message.mccMNC);
    /* string mfg = 16; */
    if (message.mfg !== "") writer.tag(16, WireType.LengthDelimited).string(message.mfg);
    /* string model = 17; */
    if (message.model !== "") writer.tag(17, WireType.LengthDelimited).string(message.model);
    /* string brand = 18; */
    if (message.brand !== "") writer.tag(18, WireType.LengthDelimited).string(message.brand);
    /* string product = 19; */
    if (message.product !== "") writer.tag(19, WireType.LengthDelimited).string(message.product);
    /* string device = 20; */
    if (message.device !== "") writer.tag(20, WireType.LengthDelimited).string(message.device);
    /* string carrier = 21; */
    if (message.carrier !== "") writer.tag(21, WireType.LengthDelimited).string(message.carrier);
    /* string verificationCode = 22; */
    if (message.verificationCode !== "")
      writer.tag(22, WireType.LengthDelimited).string(message.verificationCode);
    /* Enterprise.EnterpriseRegistration enterpriseRegistration = 23; */
    if (message.enterpriseRegistration)
      EnterpriseRegistration.internalBinaryWrite(
        message.enterpriseRegistration,
        writer.tag(23, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes encryptedVerificationToken = 24; */
    if (message.encryptedVerificationToken.length)
      writer.tag(24, WireType.LengthDelimited).bytes(message.encryptedVerificationToken);
    /* bytes enterpriseUsersDataKey = 25; */
    if (message.enterpriseUsersDataKey.length)
      writer.tag(25, WireType.LengthDelimited).bytes(message.enterpriseUsersDataKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.CreateUserRequest
 */
export const CreateUserRequest = new CreateUserRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NodeEnforcementAddOrUpdateRequest$Type extends MessageType {
  constructor() {
    super("Authentication.NodeEnforcementAddOrUpdateRequest", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "enforcement", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
    message.enforcement = "";
    message.value = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 nodeId */ 1:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string enforcement */ 2:
          message.enforcement = reader.string();
          break;
        case /* string value */ 3:
          message.value = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 nodeId = 1; */
    if (message.nodeId !== 0n) writer.tag(1, WireType.Varint).int64(message.nodeId);
    /* string enforcement = 2; */
    if (message.enforcement !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enforcement);
    /* string value = 3; */
    if (message.value !== "") writer.tag(3, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.NodeEnforcementAddOrUpdateRequest
 */
export const NodeEnforcementAddOrUpdateRequest = new NodeEnforcementAddOrUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NodeEnforcementRemoveRequest$Type extends MessageType {
  constructor() {
    super("Authentication.NodeEnforcementRemoveRequest", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "enforcement", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
    message.enforcement = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 nodeId */ 1:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string enforcement */ 2:
          message.enforcement = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 nodeId = 1; */
    if (message.nodeId !== 0n) writer.tag(1, WireType.Varint).int64(message.nodeId);
    /* string enforcement = 2; */
    if (message.enforcement !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enforcement);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.NodeEnforcementRemoveRequest
 */
export const NodeEnforcementRemoveRequest = new NodeEnforcementRemoveRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApiRequestByKey$Type extends MessageType {
  constructor() {
    super("Authentication.ApiRequestByKey", [
      { no: 1, name: "keyId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "payload", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "locale", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "supportedLanguage",
        kind: "enum",
        T: () => ["Authentication.SupportedLanguage", SupportedLanguage],
      },
      { no: 6, name: "type", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keyId = 0;
    message.payload = new Uint8Array(0);
    message.username = "";
    message.locale = "";
    message.supportedLanguage = 0;
    message.type = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 keyId */ 1:
          message.keyId = reader.int32();
          break;
        case /* bytes payload */ 2:
          message.payload = reader.bytes();
          break;
        case /* string username */ 3:
          message.username = reader.string();
          break;
        case /* string locale */ 4:
          message.locale = reader.string();
          break;
        case /* Authentication.SupportedLanguage supportedLanguage */ 5:
          message.supportedLanguage = reader.int32();
          break;
        case /* int32 type */ 6:
          message.type = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 keyId = 1; */
    if (message.keyId !== 0) writer.tag(1, WireType.Varint).int32(message.keyId);
    /* bytes payload = 2; */
    if (message.payload.length) writer.tag(2, WireType.LengthDelimited).bytes(message.payload);
    /* string username = 3; */
    if (message.username !== "") writer.tag(3, WireType.LengthDelimited).string(message.username);
    /* string locale = 4; */
    if (message.locale !== "") writer.tag(4, WireType.LengthDelimited).string(message.locale);
    /* Authentication.SupportedLanguage supportedLanguage = 5; */
    if (message.supportedLanguage !== 0)
      writer.tag(5, WireType.Varint).int32(message.supportedLanguage);
    /* int32 type = 6; */
    if (message.type !== 0) writer.tag(6, WireType.Varint).int32(message.type);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApiRequestByKey
 */
export const ApiRequestByKey = new ApiRequestByKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApiRequestByKAtoKAKey$Type extends MessageType {
  constructor() {
    super("Authentication.ApiRequestByKAtoKAKey", [
      { no: 1, name: "sourceRegion", kind: "enum", T: () => ["Authentication.Region", Region] },
      { no: 2, name: "payload", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "supportedLanguage",
        kind: "enum",
        T: () => ["Authentication.SupportedLanguage", SupportedLanguage],
      },
      {
        no: 4,
        name: "destinationRegion",
        kind: "enum",
        T: () => ["Authentication.Region", Region],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sourceRegion = 0;
    message.payload = new Uint8Array(0);
    message.supportedLanguage = 0;
    message.destinationRegion = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.Region sourceRegion */ 1:
          message.sourceRegion = reader.int32();
          break;
        case /* bytes payload */ 2:
          message.payload = reader.bytes();
          break;
        case /* Authentication.SupportedLanguage supportedLanguage */ 3:
          message.supportedLanguage = reader.int32();
          break;
        case /* Authentication.Region destinationRegion */ 4:
          message.destinationRegion = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.Region sourceRegion = 1; */
    if (message.sourceRegion !== 0) writer.tag(1, WireType.Varint).int32(message.sourceRegion);
    /* bytes payload = 2; */
    if (message.payload.length) writer.tag(2, WireType.LengthDelimited).bytes(message.payload);
    /* Authentication.SupportedLanguage supportedLanguage = 3; */
    if (message.supportedLanguage !== 0)
      writer.tag(3, WireType.Varint).int32(message.supportedLanguage);
    /* Authentication.Region destinationRegion = 4; */
    if (message.destinationRegion !== 0)
      writer.tag(4, WireType.Varint).int32(message.destinationRegion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApiRequestByKAtoKAKey
 */
export const ApiRequestByKAtoKAKey = new ApiRequestByKAtoKAKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MemcacheRequest$Type extends MessageType {
  constructor() {
    super("Authentication.MemcacheRequest", [
      { no: 1, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = "";
    message.userId = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string key */ 1:
          message.key = reader.string();
          break;
        case /* int32 userId */ 2:
          message.userId = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string key = 1; */
    if (message.key !== "") writer.tag(1, WireType.LengthDelimited).string(message.key);
    /* int32 userId = 2; */
    if (message.userId !== 0) writer.tag(2, WireType.Varint).int32(message.userId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.MemcacheRequest
 */
export const MemcacheRequest = new MemcacheRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MemcacheResponse$Type extends MessageType {
  constructor() {
    super("Authentication.MemcacheResponse", [
      { no: 1, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = "";
    message.value = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string key */ 1:
          message.key = reader.string();
          break;
        case /* string value */ 2:
          message.value = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string key = 1; */
    if (message.key !== "") writer.tag(1, WireType.LengthDelimited).string(message.key);
    /* string value = 2; */
    if (message.value !== "") writer.tag(2, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.MemcacheResponse
 */
export const MemcacheResponse = new MemcacheResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MasterPasswordReentryRequest$Type extends MessageType {
  constructor() {
    super("Authentication.MasterPasswordReentryRequest", [
      { no: 1, name: "pbkdf2Password", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "action",
        kind: "enum",
        T: () => [
          "Authentication.MasterPasswordReentryActionType",
          MasterPasswordReentryActionType,
        ],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.pbkdf2Password = "";
    message.action = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string pbkdf2Password */ 1:
          message.pbkdf2Password = reader.string();
          break;
        case /* Authentication.MasterPasswordReentryActionType action */ 2:
          message.action = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string pbkdf2Password = 1; */
    if (message.pbkdf2Password !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.pbkdf2Password);
    /* Authentication.MasterPasswordReentryActionType action = 2; */
    if (message.action !== 0) writer.tag(2, WireType.Varint).int32(message.action);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.MasterPasswordReentryRequest
 */
export const MasterPasswordReentryRequest = new MasterPasswordReentryRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MasterPasswordReentryResponse$Type extends MessageType {
  constructor() {
    super("Authentication.MasterPasswordReentryResponse", [
      {
        no: 1,
        name: "status",
        kind: "enum",
        T: () => ["Authentication.MasterPasswordReentryStatus", MasterPasswordReentryStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.MasterPasswordReentryStatus status */ 1:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.MasterPasswordReentryStatus status = 1; */
    if (message.status !== 0) writer.tag(1, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.MasterPasswordReentryResponse
 */
export const MasterPasswordReentryResponse = new MasterPasswordReentryResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceRegistrationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceRegistrationRequest", [
      { no: 1, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientVersion = "";
    message.deviceName = "";
    message.devicePublicKey = new Uint8Array(0);
    message.devicePlatform = "";
    message.clientFormFactor = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string clientVersion */ 1:
          message.clientVersion = reader.string();
          break;
        case /* string deviceName */ 2:
          message.deviceName = reader.string();
          break;
        case /* bytes devicePublicKey */ 3:
          message.devicePublicKey = reader.bytes();
          break;
        case /* string devicePlatform */ 4:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 5:
          message.clientFormFactor = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string clientVersion = 1; */
    if (message.clientVersion !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceName = 2; */
    if (message.deviceName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.deviceName);
    /* bytes devicePublicKey = 3; */
    if (message.devicePublicKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* string devicePlatform = 4; */
    if (message.devicePlatform !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 5; */
    if (message.clientFormFactor !== 0)
      writer.tag(5, WireType.Varint).int32(message.clientFormFactor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceRegistrationRequest
 */
export const DeviceRegistrationRequest = new DeviceRegistrationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceVerificationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceVerificationRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "verificationChannel", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.username = "";
    message.verificationChannel = "";
    message.messageSessionUid = new Uint8Array(0);
    message.clientVersion = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* string verificationChannel */ 3:
          message.verificationChannel = reader.string();
          break;
        case /* bytes messageSessionUid */ 4:
          message.messageSessionUid = reader.bytes();
          break;
        case /* string clientVersion */ 5:
          message.clientVersion = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* string verificationChannel = 3; */
    if (message.verificationChannel !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.verificationChannel);
    /* bytes messageSessionUid = 4; */
    if (message.messageSessionUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* string clientVersion = 5; */
    if (message.clientVersion !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.clientVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceVerificationRequest
 */
export const DeviceVerificationRequest = new DeviceVerificationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceVerificationResponse$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceVerificationResponse", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.username = "";
    message.messageSessionUid = new Uint8Array(0);
    message.clientVersion = "";
    message.deviceStatus = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* bytes messageSessionUid */ 3:
          message.messageSessionUid = reader.bytes();
          break;
        case /* string clientVersion */ 4:
          message.clientVersion = reader.string();
          break;
        case /* Authentication.DeviceStatus deviceStatus */ 5:
          message.deviceStatus = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* bytes messageSessionUid = 3; */
    if (message.messageSessionUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* string clientVersion = 4; */
    if (message.clientVersion !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.clientVersion);
    /* Authentication.DeviceStatus deviceStatus = 5; */
    if (message.deviceStatus !== 0) writer.tag(5, WireType.Varint).int32(message.deviceStatus);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceVerificationResponse
 */
export const DeviceVerificationResponse = new DeviceVerificationResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceApprovalRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceApprovalRequest", [
      { no: 1, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "twoFactorChannel", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "locale", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "totpCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "deviceIp", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "deviceTokenExpireDays", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.email = "";
    message.twoFactorChannel = "";
    message.clientVersion = "";
    message.locale = "";
    message.encryptedDeviceToken = new Uint8Array(0);
    message.totpCode = "";
    message.deviceIp = "";
    message.deviceTokenExpireDays = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string email */ 1:
          message.email = reader.string();
          break;
        case /* string twoFactorChannel */ 2:
          message.twoFactorChannel = reader.string();
          break;
        case /* string clientVersion */ 3:
          message.clientVersion = reader.string();
          break;
        case /* string locale */ 4:
          message.locale = reader.string();
          break;
        case /* bytes encryptedDeviceToken */ 5:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* string totpCode */ 6:
          message.totpCode = reader.string();
          break;
        case /* string deviceIp */ 7:
          message.deviceIp = reader.string();
          break;
        case /* string deviceTokenExpireDays */ 8:
          message.deviceTokenExpireDays = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string email = 1; */
    if (message.email !== "") writer.tag(1, WireType.LengthDelimited).string(message.email);
    /* string twoFactorChannel = 2; */
    if (message.twoFactorChannel !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.twoFactorChannel);
    /* string clientVersion = 3; */
    if (message.clientVersion !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.clientVersion);
    /* string locale = 4; */
    if (message.locale !== "") writer.tag(4, WireType.LengthDelimited).string(message.locale);
    /* bytes encryptedDeviceToken = 5; */
    if (message.encryptedDeviceToken.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string totpCode = 6; */
    if (message.totpCode !== "") writer.tag(6, WireType.LengthDelimited).string(message.totpCode);
    /* string deviceIp = 7; */
    if (message.deviceIp !== "") writer.tag(7, WireType.LengthDelimited).string(message.deviceIp);
    /* string deviceTokenExpireDays = 8; */
    if (message.deviceTokenExpireDays !== "")
      writer.tag(8, WireType.LengthDelimited).string(message.deviceTokenExpireDays);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceApprovalRequest
 */
export const DeviceApprovalRequest = new DeviceApprovalRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceApprovalResponse$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceApprovalResponse", [
      { no: 1, name: "encryptedTwoFactorToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedTwoFactorToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedTwoFactorToken */ 1:
          message.encryptedTwoFactorToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedTwoFactorToken = 1; */
    if (message.encryptedTwoFactorToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedTwoFactorToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceApprovalResponse
 */
export const DeviceApprovalResponse = new DeviceApprovalResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApproveDeviceRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ApproveDeviceRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedDeviceDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "denyApproval", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "linkDevice", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.encryptedDeviceDataKey = new Uint8Array(0);
    message.denyApproval = false;
    message.linkDevice = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes encryptedDeviceDataKey */ 2:
          message.encryptedDeviceDataKey = reader.bytes();
          break;
        case /* bool denyApproval */ 3:
          message.denyApproval = reader.bool();
          break;
        case /* bool linkDevice */ 4:
          message.linkDevice = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes encryptedDeviceDataKey = 2; */
    if (message.encryptedDeviceDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceDataKey);
    /* bool denyApproval = 3; */
    if (message.denyApproval !== false) writer.tag(3, WireType.Varint).bool(message.denyApproval);
    /* bool linkDevice = 4; */
    if (message.linkDevice !== false) writer.tag(4, WireType.Varint).bool(message.linkDevice);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApproveDeviceRequest
 */
export const ApproveDeviceRequest = new ApproveDeviceRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserAliasRequest$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserAliasRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "alias", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.alias = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string alias */ 2:
          message.alias = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* string alias = 2; */
    if (message.alias !== "") writer.tag(2, WireType.LengthDelimited).string(message.alias);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserAliasRequest
 */
export const EnterpriseUserAliasRequest = new EnterpriseUserAliasRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserAddAliasRequest$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserAddAliasRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "alias", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "primary", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.alias = "";
    message.primary = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string alias */ 2:
          message.alias = reader.string();
          break;
        case /* bool primary */ 3:
          message.primary = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* string alias = 2; */
    if (message.alias !== "") writer.tag(2, WireType.LengthDelimited).string(message.alias);
    /* bool primary = 3; */
    if (message.primary !== false) writer.tag(3, WireType.Varint).bool(message.primary);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserAddAliasRequest
 */
export const EnterpriseUserAddAliasRequest = new EnterpriseUserAddAliasRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserAddAliasRequestV2$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserAddAliasRequestV2", [
      {
        no: 1,
        name: "enterpriseUserAddAliasRequest",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserAddAliasRequest,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserAddAliasRequest = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.EnterpriseUserAddAliasRequest enterpriseUserAddAliasRequest */ 1:
          message.enterpriseUserAddAliasRequest.push(
            EnterpriseUserAddAliasRequest.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.EnterpriseUserAddAliasRequest enterpriseUserAddAliasRequest = 1; */
    for (let i = 0; i < message.enterpriseUserAddAliasRequest.length; i++)
      EnterpriseUserAddAliasRequest.internalBinaryWrite(
        message.enterpriseUserAddAliasRequest[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserAddAliasRequestV2
 */
export const EnterpriseUserAddAliasRequestV2 = new EnterpriseUserAddAliasRequestV2$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserAddAliasStatus$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserAddAliasStatus", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.status = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string status */ 2:
          message.status = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* string status = 2; */
    if (message.status !== "") writer.tag(2, WireType.LengthDelimited).string(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserAddAliasStatus
 */
export const EnterpriseUserAddAliasStatus = new EnterpriseUserAddAliasStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserAddAliasResponse$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserAddAliasResponse", [
      {
        no: 1,
        name: "status",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserAddAliasStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.status = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.EnterpriseUserAddAliasStatus status */ 1:
          message.status.push(
            EnterpriseUserAddAliasStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.EnterpriseUserAddAliasStatus status = 1; */
    for (let i = 0; i < message.status.length; i++)
      EnterpriseUserAddAliasStatus.internalBinaryWrite(
        message.status[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserAddAliasResponse
 */
export const EnterpriseUserAddAliasResponse = new EnterpriseUserAddAliasResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Device$Type extends MessageType {
  constructor() {
    super("Authentication.Device", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.Device
 */
export const Device = new Device$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RegisterDeviceDataKeyRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RegisterDeviceDataKeyRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedDeviceDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.encryptedDeviceDataKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedDeviceToken */ 1:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes encryptedDeviceDataKey */ 2:
          message.encryptedDeviceDataKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedDeviceToken = 1; */
    if (message.encryptedDeviceToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes encryptedDeviceDataKey = 2; */
    if (message.encryptedDeviceDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceDataKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RegisterDeviceDataKeyRequest
 */
export const RegisterDeviceDataKeyRequest = new RegisterDeviceDataKeyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ValidateCreateUserVerificationCodeRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ValidateCreateUserVerificationCodeRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.clientVersion = "";
    message.verificationCode = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string verificationCode */ 3:
          message.verificationCode = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string verificationCode = 3; */
    if (message.verificationCode !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.verificationCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ValidateCreateUserVerificationCodeRequest
 */
export const ValidateCreateUserVerificationCodeRequest =
  new ValidateCreateUserVerificationCodeRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ValidateDeviceVerificationCodeRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ValidateDeviceVerificationCodeRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.clientVersion = "";
    message.verificationCode = "";
    message.messageSessionUid = new Uint8Array(0);
    message.encryptedDeviceToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string verificationCode */ 3:
          message.verificationCode = reader.string();
          break;
        case /* bytes messageSessionUid */ 4:
          message.messageSessionUid = reader.bytes();
          break;
        case /* bytes encryptedDeviceToken */ 5:
          message.encryptedDeviceToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string verificationCode = 3; */
    if (message.verificationCode !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.verificationCode);
    /* bytes messageSessionUid = 4; */
    if (message.messageSessionUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* bytes encryptedDeviceToken = 5; */
    if (message.encryptedDeviceToken.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ValidateDeviceVerificationCodeRequest
 */
export const ValidateDeviceVerificationCodeRequest =
  new ValidateDeviceVerificationCodeRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SendSessionMessageRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SendSessionMessageRequest", [
      { no: 1, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "command", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageSessionUid = new Uint8Array(0);
    message.command = "";
    message.username = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes messageSessionUid */ 1:
          message.messageSessionUid = reader.bytes();
          break;
        case /* string command */ 2:
          message.command = reader.string();
          break;
        case /* string username */ 3:
          message.username = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes messageSessionUid = 1; */
    if (message.messageSessionUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* string command = 2; */
    if (message.command !== "") writer.tag(2, WireType.LengthDelimited).string(message.command);
    /* string username = 3; */
    if (message.username !== "") writer.tag(3, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SendSessionMessageRequest
 */
export const SendSessionMessageRequest = new SendSessionMessageRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GlobalUserAccount$Type extends MessageType {
  constructor() {
    super("Authentication.GlobalUserAccount", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "regionName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.accountUid = new Uint8Array(0);
    message.regionName = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* bytes accountUid */ 2:
          message.accountUid = reader.bytes();
          break;
        case /* string regionName */ 3:
          message.regionName = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* bytes accountUid = 2; */
    if (message.accountUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.accountUid);
    /* string regionName = 3; */
    if (message.regionName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.regionName);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GlobalUserAccount
 */
export const GlobalUserAccount = new GlobalUserAccount$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AccountUsername$Type extends MessageType {
  constructor() {
    super("Authentication.AccountUsername", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "dateActive", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.dateActive = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* string dateActive */ 2:
          message.dateActive = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* string dateActive = 2; */
    if (message.dateActive !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.dateActive);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AccountUsername
 */
export const AccountUsername = new AccountUsername$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SsoServiceProviderRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SsoServiceProviderRequest", [
      { no: 1, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "locale", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.name = "";
    message.clientVersion = "";
    message.locale = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string name */ 1:
          message.name = reader.string();
          break;
        case /* string clientVersion */ 2:
          message.clientVersion = reader.string();
          break;
        case /* string locale */ 3:
          message.locale = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string name = 1; */
    if (message.name !== "") writer.tag(1, WireType.LengthDelimited).string(message.name);
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    /* string locale = 3; */
    if (message.locale !== "") writer.tag(3, WireType.LengthDelimited).string(message.locale);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SsoServiceProviderRequest
 */
export const SsoServiceProviderRequest = new SsoServiceProviderRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SsoServiceProviderResponse$Type extends MessageType {
  constructor() {
    super("Authentication.SsoServiceProviderResponse", [
      { no: 1, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "spUrl", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "isCloud", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.name = "";
    message.spUrl = "";
    message.isCloud = false;
    message.clientVersion = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string name */ 1:
          message.name = reader.string();
          break;
        case /* string spUrl */ 2:
          message.spUrl = reader.string();
          break;
        case /* bool isCloud */ 3:
          message.isCloud = reader.bool();
          break;
        case /* string clientVersion */ 4:
          message.clientVersion = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string name = 1; */
    if (message.name !== "") writer.tag(1, WireType.LengthDelimited).string(message.name);
    /* string spUrl = 2; */
    if (message.spUrl !== "") writer.tag(2, WireType.LengthDelimited).string(message.spUrl);
    /* bool isCloud = 3; */
    if (message.isCloud !== false) writer.tag(3, WireType.Varint).bool(message.isCloud);
    /* string clientVersion = 4; */
    if (message.clientVersion !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.clientVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SsoServiceProviderResponse
 */
export const SsoServiceProviderResponse = new SsoServiceProviderResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserSettingRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UserSettingRequest", [
      { no: 1, name: "setting", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.setting = "";
    message.value = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string setting */ 1:
          message.setting = reader.string();
          break;
        case /* string value */ 2:
          message.value = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string setting = 1; */
    if (message.setting !== "") writer.tag(1, WireType.LengthDelimited).string(message.setting);
    /* string value = 2; */
    if (message.value !== "") writer.tag(2, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserSettingRequest
 */
export const UserSettingRequest = new UserSettingRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ThrottleState$Type extends MessageType {
  constructor() {
    super("Authentication.ThrottleState", [
      { no: 1, name: "type", kind: "enum", T: () => ["Authentication.ThrottleType", ThrottleType] },
      { no: 2, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "state", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    message.key = "";
    message.value = "";
    message.state = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.ThrottleType type */ 1:
          message.type = reader.int32();
          break;
        case /* string key */ 2:
          message.key = reader.string();
          break;
        case /* string value */ 3:
          message.value = reader.string();
          break;
        case /* bool state */ 4:
          message.state = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.ThrottleType type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    /* string key = 2; */
    if (message.key !== "") writer.tag(2, WireType.LengthDelimited).string(message.key);
    /* string value = 3; */
    if (message.value !== "") writer.tag(3, WireType.LengthDelimited).string(message.value);
    /* bool state = 4; */
    if (message.state !== false) writer.tag(4, WireType.Varint).bool(message.state);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ThrottleState
 */
export const ThrottleState = new ThrottleState$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ThrottleState2$Type extends MessageType {
  constructor() {
    super("Authentication.ThrottleState2", [
      { no: 1, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "keyDescription", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "valueDescription", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "identifier", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "locked", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "includedInAllClear", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "expireSeconds", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = "";
    message.keyDescription = "";
    message.value = "";
    message.valueDescription = "";
    message.identifier = "";
    message.locked = false;
    message.includedInAllClear = false;
    message.expireSeconds = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string key */ 1:
          message.key = reader.string();
          break;
        case /* string keyDescription */ 2:
          message.keyDescription = reader.string();
          break;
        case /* string value */ 3:
          message.value = reader.string();
          break;
        case /* string valueDescription */ 4:
          message.valueDescription = reader.string();
          break;
        case /* string identifier */ 5:
          message.identifier = reader.string();
          break;
        case /* bool locked */ 6:
          message.locked = reader.bool();
          break;
        case /* bool includedInAllClear */ 7:
          message.includedInAllClear = reader.bool();
          break;
        case /* int32 expireSeconds */ 8:
          message.expireSeconds = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string key = 1; */
    if (message.key !== "") writer.tag(1, WireType.LengthDelimited).string(message.key);
    /* string keyDescription = 2; */
    if (message.keyDescription !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.keyDescription);
    /* string value = 3; */
    if (message.value !== "") writer.tag(3, WireType.LengthDelimited).string(message.value);
    /* string valueDescription = 4; */
    if (message.valueDescription !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.valueDescription);
    /* string identifier = 5; */
    if (message.identifier !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.identifier);
    /* bool locked = 6; */
    if (message.locked !== false) writer.tag(6, WireType.Varint).bool(message.locked);
    /* bool includedInAllClear = 7; */
    if (message.includedInAllClear !== false)
      writer.tag(7, WireType.Varint).bool(message.includedInAllClear);
    /* int32 expireSeconds = 8; */
    if (message.expireSeconds !== 0) writer.tag(8, WireType.Varint).int32(message.expireSeconds);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ThrottleState2
 */
export const ThrottleState2 = new ThrottleState2$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceInformation$Type extends MessageType {
  constructor() {
    super("Authentication.DeviceInformation", [
      {
        no: 1,
        name: "deviceId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "lastLogin",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceId = 0n;
    message.deviceName = "";
    message.clientVersion = "";
    message.lastLogin = 0n;
    message.deviceStatus = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 deviceId */ 1:
          message.deviceId = reader.int64().toBigInt();
          break;
        case /* string deviceName */ 2:
          message.deviceName = reader.string();
          break;
        case /* string clientVersion */ 3:
          message.clientVersion = reader.string();
          break;
        case /* int64 lastLogin */ 4:
          message.lastLogin = reader.int64().toBigInt();
          break;
        case /* Authentication.DeviceStatus deviceStatus */ 5:
          message.deviceStatus = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 deviceId = 1; */
    if (message.deviceId !== 0n) writer.tag(1, WireType.Varint).int64(message.deviceId);
    /* string deviceName = 2; */
    if (message.deviceName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.deviceName);
    /* string clientVersion = 3; */
    if (message.clientVersion !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.clientVersion);
    /* int64 lastLogin = 4; */
    if (message.lastLogin !== 0n) writer.tag(4, WireType.Varint).int64(message.lastLogin);
    /* Authentication.DeviceStatus deviceStatus = 5; */
    if (message.deviceStatus !== 0) writer.tag(5, WireType.Varint).int32(message.deviceStatus);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeviceInformation
 */
export const DeviceInformation = new DeviceInformation$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserSetting$Type extends MessageType {
  constructor() {
    super("Authentication.UserSetting", [
      { no: 1, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "value", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.name = "";
    message.value = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string name */ 1:
          message.name = reader.string();
          break;
        case /* bool value */ 2:
          message.value = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string name = 1; */
    if (message.name !== "") writer.tag(1, WireType.LengthDelimited).string(message.name);
    /* bool value = 2; */
    if (message.value !== false) writer.tag(2, WireType.Varint).bool(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserSetting
 */
export const UserSetting = new UserSetting$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserDataKeyRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UserDataKeyRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated int64 enterpriseUserId */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserId.push(reader.int64().toBigInt());
          else message.enterpriseUserId.push(reader.int64().toBigInt());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserId.length; i++)
        writer.int64(message.enterpriseUserId[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserDataKeyRequest
 */
export const UserDataKeyRequest = new UserDataKeyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserDataKeyByNodeRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UserDataKeyByNodeRequest", [
      {
        no: 1,
        name: "nodeIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated int64 nodeIds */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.nodeIds.push(reader.int64().toBigInt());
          else message.nodeIds.push(reader.int64().toBigInt());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated int64 nodeIds = 1; */
    if (message.nodeIds.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.nodeIds.length; i++) writer.int64(message.nodeIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserDataKeyByNodeRequest
 */
export const UserDataKeyByNodeRequest = new UserDataKeyByNodeRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserIdDataKeyPair$Type extends MessageType {
  constructor() {
    super("Authentication.EnterpriseUserIdDataKeyPair", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.encryptedDataKey = new Uint8Array(0);
    message.keyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedDataKey */ 2:
          message.encryptedDataKey = reader.bytes();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 3:
          message.keyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes encryptedDataKey = 2; */
    if (message.encryptedDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDataKey);
    /* Enterprise.EncryptedKeyType keyType = 3; */
    if (message.keyType !== 0) writer.tag(3, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EnterpriseUserIdDataKeyPair
 */
export const EnterpriseUserIdDataKeyPair = new EnterpriseUserIdDataKeyPair$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserDataKey$Type extends MessageType {
  constructor() {
    super("Authentication.UserDataKey", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "roleKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "privateKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "enterpriseUserIdDataKeyPairs",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserIdDataKeyPair,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.roleKey = new Uint8Array(0);
    message.privateKey = "";
    message.enterpriseUserIdDataKeyPairs = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 roleId */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* bytes roleKey */ 2:
          message.roleKey = reader.bytes();
          break;
        case /* string privateKey */ 3:
          message.privateKey = reader.string();
          break;
        case /* repeated Authentication.EnterpriseUserIdDataKeyPair enterpriseUserIdDataKeyPairs */ 4:
          message.enterpriseUserIdDataKeyPairs.push(
            EnterpriseUserIdDataKeyPair.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 roleId = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* bytes roleKey = 2; */
    if (message.roleKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.roleKey);
    /* string privateKey = 3; */
    if (message.privateKey !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.privateKey);
    /* repeated Authentication.EnterpriseUserIdDataKeyPair enterpriseUserIdDataKeyPairs = 4; */
    for (let i = 0; i < message.enterpriseUserIdDataKeyPairs.length; i++)
      EnterpriseUserIdDataKeyPair.internalBinaryWrite(
        message.enterpriseUserIdDataKeyPairs[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserDataKey
 */
export const UserDataKey = new UserDataKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserDataKeyResponse$Type extends MessageType {
  constructor() {
    super("Authentication.UserDataKeyResponse", [
      {
        no: 1,
        name: "userDataKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserDataKey,
      },
      {
        no: 2,
        name: "accessDenied",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "noEncryptedDataKey",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userDataKeys = [];
    message.accessDenied = [];
    message.noEncryptedDataKey = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.UserDataKey userDataKeys */ 1:
          message.userDataKeys.push(
            UserDataKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated int64 accessDenied */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.accessDenied.push(reader.int64().toBigInt());
          else message.accessDenied.push(reader.int64().toBigInt());
          break;
        case /* repeated int64 noEncryptedDataKey */ 3:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.noEncryptedDataKey.push(reader.int64().toBigInt());
          else message.noEncryptedDataKey.push(reader.int64().toBigInt());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.UserDataKey userDataKeys = 1; */
    for (let i = 0; i < message.userDataKeys.length; i++)
      UserDataKey.internalBinaryWrite(
        message.userDataKeys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated int64 accessDenied = 2; */
    if (message.accessDenied.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.accessDenied.length; i++) writer.int64(message.accessDenied[i]);
      writer.join();
    }
    /* repeated int64 noEncryptedDataKey = 3; */
    if (message.noEncryptedDataKey.length) {
      writer.tag(3, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.noEncryptedDataKey.length; i++)
        writer.int64(message.noEncryptedDataKey[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserDataKeyResponse
 */
export const UserDataKeyResponse = new UserDataKeyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MasterPasswordRecoveryVerificationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.MasterPasswordRecoveryVerificationRequest", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.MasterPasswordRecoveryVerificationRequest
 */
export const MasterPasswordRecoveryVerificationRequest =
  new MasterPasswordRecoveryVerificationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetSecurityQuestionV3Request$Type extends MessageType {
  constructor() {
    super("Authentication.GetSecurityQuestionV3Request", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    message.verificationCode = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* string verificationCode */ 2:
          message.verificationCode = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* string verificationCode = 2; */
    if (message.verificationCode !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.verificationCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetSecurityQuestionV3Request
 */
export const GetSecurityQuestionV3Request = new GetSecurityQuestionV3Request$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetSecurityQuestionV3Response$Type extends MessageType {
  constructor() {
    super("Authentication.GetSecurityQuestionV3Response", [
      { no: 1, name: "securityQuestion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "backupKeyDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "salt", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.securityQuestion = "";
    message.backupKeyDate = 0n;
    message.salt = new Uint8Array(0);
    message.iterations = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string securityQuestion */ 1:
          message.securityQuestion = reader.string();
          break;
        case /* int64 backupKeyDate */ 2:
          message.backupKeyDate = reader.int64().toBigInt();
          break;
        case /* bytes salt */ 3:
          message.salt = reader.bytes();
          break;
        case /* int32 iterations */ 4:
          message.iterations = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string securityQuestion = 1; */
    if (message.securityQuestion !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.securityQuestion);
    /* int64 backupKeyDate = 2; */
    if (message.backupKeyDate !== 0n) writer.tag(2, WireType.Varint).int64(message.backupKeyDate);
    /* bytes salt = 3; */
    if (message.salt.length) writer.tag(3, WireType.LengthDelimited).bytes(message.salt);
    /* int32 iterations = 4; */
    if (message.iterations !== 0) writer.tag(4, WireType.Varint).int32(message.iterations);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetSecurityQuestionV3Response
 */
export const GetSecurityQuestionV3Response = new GetSecurityQuestionV3Response$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetDataKeyBackupV3Request$Type extends MessageType {
  constructor() {
    super("Authentication.GetDataKeyBackupV3Request", [
      { no: 1, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "securityAnswerHash", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedLoginToken = new Uint8Array(0);
    message.verificationCode = "";
    message.securityAnswerHash = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 1:
          message.encryptedLoginToken = reader.bytes();
          break;
        case /* string verificationCode */ 2:
          message.verificationCode = reader.string();
          break;
        case /* bytes securityAnswerHash */ 3:
          message.securityAnswerHash = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedLoginToken = 1; */
    if (message.encryptedLoginToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    /* string verificationCode = 2; */
    if (message.verificationCode !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.verificationCode);
    /* bytes securityAnswerHash = 3; */
    if (message.securityAnswerHash.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.securityAnswerHash);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetDataKeyBackupV3Request
 */
export const GetDataKeyBackupV3Request = new GetDataKeyBackupV3Request$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasswordRules$Type extends MessageType {
  constructor() {
    super("Authentication.PasswordRules", [
      { no: 1, name: "ruleType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "match", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "pattern", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "description", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "minimum", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.ruleType = "";
    message.match = false;
    message.pattern = "";
    message.description = "";
    message.minimum = 0;
    message.value = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string ruleType */ 1:
          message.ruleType = reader.string();
          break;
        case /* bool match */ 2:
          message.match = reader.bool();
          break;
        case /* string pattern */ 3:
          message.pattern = reader.string();
          break;
        case /* string description */ 4:
          message.description = reader.string();
          break;
        case /* int32 minimum */ 5:
          message.minimum = reader.int32();
          break;
        case /* string value */ 6:
          message.value = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string ruleType = 1; */
    if (message.ruleType !== "") writer.tag(1, WireType.LengthDelimited).string(message.ruleType);
    /* bool match = 2; */
    if (message.match !== false) writer.tag(2, WireType.Varint).bool(message.match);
    /* string pattern = 3; */
    if (message.pattern !== "") writer.tag(3, WireType.LengthDelimited).string(message.pattern);
    /* string description = 4; */
    if (message.description !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.description);
    /* int32 minimum = 5; */
    if (message.minimum !== 0) writer.tag(5, WireType.Varint).int32(message.minimum);
    /* string value = 6; */
    if (message.value !== "") writer.tag(6, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasswordRules
 */
export const PasswordRules = new PasswordRules$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetDataKeyBackupV3Response$Type extends MessageType {
  constructor() {
    super("Authentication.GetDataKeyBackupV3Response", [
      { no: 1, name: "dataKeyBackup", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "dataKeyBackupDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "clientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 7,
        name: "passwordRules",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => PasswordRules,
      },
      { no: 8, name: "passwordRulesIntro", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 9, name: "minimumPbkdf2Iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 10, name: "keyType", kind: "enum", T: () => ["Enterprise.KeyType", KeyType] },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.dataKeyBackup = new Uint8Array(0);
    message.dataKeyBackupDate = 0n;
    message.publicKey = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    message.clientKey = new Uint8Array(0);
    message.encryptedSessionToken = new Uint8Array(0);
    message.passwordRules = [];
    message.passwordRulesIntro = "";
    message.minimumPbkdf2Iterations = 0;
    message.keyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes dataKeyBackup */ 1:
          message.dataKeyBackup = reader.bytes();
          break;
        case /* int64 dataKeyBackupDate */ 2:
          message.dataKeyBackupDate = reader.int64().toBigInt();
          break;
        case /* bytes publicKey */ 3:
          message.publicKey = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 4:
          message.encryptedPrivateKey = reader.bytes();
          break;
        case /* bytes clientKey */ 5:
          message.clientKey = reader.bytes();
          break;
        case /* bytes encryptedSessionToken */ 6:
          message.encryptedSessionToken = reader.bytes();
          break;
        case /* repeated Authentication.PasswordRules passwordRules */ 7:
          message.passwordRules.push(
            PasswordRules.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string passwordRulesIntro */ 8:
          message.passwordRulesIntro = reader.string();
          break;
        case /* int32 minimumPbkdf2Iterations */ 9:
          message.minimumPbkdf2Iterations = reader.int32();
          break;
        case /* Enterprise.KeyType keyType */ 10:
          message.keyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes dataKeyBackup = 1; */
    if (message.dataKeyBackup.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.dataKeyBackup);
    /* int64 dataKeyBackupDate = 2; */
    if (message.dataKeyBackupDate !== 0n)
      writer.tag(2, WireType.Varint).int64(message.dataKeyBackupDate);
    /* bytes publicKey = 3; */
    if (message.publicKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.publicKey);
    /* bytes encryptedPrivateKey = 4; */
    if (message.encryptedPrivateKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    /* bytes clientKey = 5; */
    if (message.clientKey.length) writer.tag(5, WireType.LengthDelimited).bytes(message.clientKey);
    /* bytes encryptedSessionToken = 6; */
    if (message.encryptedSessionToken.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.encryptedSessionToken);
    /* repeated Authentication.PasswordRules passwordRules = 7; */
    for (let i = 0; i < message.passwordRules.length; i++)
      PasswordRules.internalBinaryWrite(
        message.passwordRules[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string passwordRulesIntro = 8; */
    if (message.passwordRulesIntro !== "")
      writer.tag(8, WireType.LengthDelimited).string(message.passwordRulesIntro);
    /* int32 minimumPbkdf2Iterations = 9; */
    if (message.minimumPbkdf2Iterations !== 0)
      writer.tag(9, WireType.Varint).int32(message.minimumPbkdf2Iterations);
    /* Enterprise.KeyType keyType = 10; */
    if (message.keyType !== 0) writer.tag(10, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetDataKeyBackupV3Response
 */
export const GetDataKeyBackupV3Response = new GetDataKeyBackupV3Response$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetPublicKeysRequest$Type extends MessageType {
  constructor() {
    super("Authentication.GetPublicKeysRequest", [
      {
        no: 1,
        name: "usernames",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.usernames = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string usernames */ 1:
          message.usernames.push(reader.string());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated string usernames = 1; */
    for (let i = 0; i < message.usernames.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.usernames[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetPublicKeysRequest
 */
export const GetPublicKeysRequest = new GetPublicKeysRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PublicKeyResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PublicKeyResponse", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "publicEccKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "errorCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.publicKey = new Uint8Array(0);
    message.publicEccKey = new Uint8Array(0);
    message.message = "";
    message.errorCode = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* bytes publicKey */ 2:
          message.publicKey = reader.bytes();
          break;
        case /* bytes publicEccKey */ 3:
          message.publicEccKey = reader.bytes();
          break;
        case /* string message */ 4:
          message.message = reader.string();
          break;
        case /* string errorCode */ 5:
          message.errorCode = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* bytes publicKey = 2; */
    if (message.publicKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.publicKey);
    /* bytes publicEccKey = 3; */
    if (message.publicEccKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.publicEccKey);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    /* string errorCode = 5; */
    if (message.errorCode !== "") writer.tag(5, WireType.LengthDelimited).string(message.errorCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PublicKeyResponse
 */
export const PublicKeyResponse = new PublicKeyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetPublicKeysResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetPublicKeysResponse", [
      {
        no: 1,
        name: "keyResponses",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => PublicKeyResponse,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keyResponses = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.PublicKeyResponse keyResponses */ 1:
          message.keyResponses.push(
            PublicKeyResponse.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.PublicKeyResponse keyResponses = 1; */
    for (let i = 0; i < message.keyResponses.length; i++)
      PublicKeyResponse.internalBinaryWrite(
        message.keyResponses[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetPublicKeysResponse
 */
export const GetPublicKeysResponse = new GetPublicKeysResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetEccKeyPairRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SetEccKeyPairRequest", [
      { no: 1, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.publicKey = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes publicKey */ 1:
          message.publicKey = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 2:
          message.encryptedPrivateKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes publicKey = 1; */
    if (message.publicKey.length) writer.tag(1, WireType.LengthDelimited).bytes(message.publicKey);
    /* bytes encryptedPrivateKey = 2; */
    if (message.encryptedPrivateKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SetEccKeyPairRequest
 */
export const SetEccKeyPairRequest = new SetEccKeyPairRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetEccKeyPairsRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SetEccKeyPairsRequest", [
      {
        no: 1,
        name: "teamKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamEccKeyPair,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamKeys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.TeamEccKeyPair teamKeys */ 1:
          message.teamKeys.push(
            TeamEccKeyPair.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.TeamEccKeyPair teamKeys = 1; */
    for (let i = 0; i < message.teamKeys.length; i++)
      TeamEccKeyPair.internalBinaryWrite(
        message.teamKeys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SetEccKeyPairsRequest
 */
export const SetEccKeyPairsRequest = new SetEccKeyPairsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetEccKeyPairsResponse$Type extends MessageType {
  constructor() {
    super("Authentication.SetEccKeyPairsResponse", [
      {
        no: 1,
        name: "teamKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamEccKeyPairResponse,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamKeys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.TeamEccKeyPairResponse teamKeys */ 1:
          message.teamKeys.push(
            TeamEccKeyPairResponse.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.TeamEccKeyPairResponse teamKeys = 1; */
    for (let i = 0; i < message.teamKeys.length; i++)
      TeamEccKeyPairResponse.internalBinaryWrite(
        message.teamKeys[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SetEccKeyPairsResponse
 */
export const SetEccKeyPairsResponse = new SetEccKeyPairsResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamEccKeyPair$Type extends MessageType {
  constructor() {
    super("Authentication.TeamEccKeyPair", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.publicKey = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes teamUid */ 1:
          message.teamUid = reader.bytes();
          break;
        case /* bytes publicKey */ 2:
          message.publicKey = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 3:
          message.encryptedPrivateKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes teamUid = 1; */
    if (message.teamUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.teamUid);
    /* bytes publicKey = 2; */
    if (message.publicKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.publicKey);
    /* bytes encryptedPrivateKey = 3; */
    if (message.encryptedPrivateKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TeamEccKeyPair
 */
export const TeamEccKeyPair = new TeamEccKeyPair$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamEccKeyPairResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TeamEccKeyPairResponse", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Authentication.GenericStatus", GenericStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes teamUid */ 1:
          message.teamUid = reader.bytes();
          break;
        case /* Authentication.GenericStatus status */ 2:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes teamUid = 1; */
    if (message.teamUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.teamUid);
    /* Authentication.GenericStatus status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TeamEccKeyPairResponse
 */
export const TeamEccKeyPairResponse = new TeamEccKeyPairResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetKsmPublicKeysRequest$Type extends MessageType {
  constructor() {
    super("Authentication.GetKsmPublicKeysRequest", [
      {
        no: 1,
        name: "clientIds",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 2,
        name: "controllerUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientIds = [];
    message.controllerUids = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes clientIds */ 1:
          message.clientIds.push(reader.bytes());
          break;
        case /* repeated bytes controllerUids */ 2:
          message.controllerUids.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes clientIds = 1; */
    for (let i = 0; i < message.clientIds.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.clientIds[i]);
    /* repeated bytes controllerUids = 2; */
    for (let i = 0; i < message.controllerUids.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.controllerUids[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetKsmPublicKeysRequest
 */
export const GetKsmPublicKeysRequest = new GetKsmPublicKeysRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DevicePublicKeyResponse$Type extends MessageType {
  constructor() {
    super("Authentication.DevicePublicKeyResponse", [
      { no: 1, name: "clientId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "controllerUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientId = new Uint8Array(0);
    message.publicKey = new Uint8Array(0);
    message.controllerUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes clientId */ 1:
          message.clientId = reader.bytes();
          break;
        case /* bytes publicKey */ 2:
          message.publicKey = reader.bytes();
          break;
        case /* bytes controllerUid */ 3:
          message.controllerUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes clientId = 1; */
    if (message.clientId.length) writer.tag(1, WireType.LengthDelimited).bytes(message.clientId);
    /* bytes publicKey = 2; */
    if (message.publicKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.publicKey);
    /* bytes controllerUid = 3; */
    if (message.controllerUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.controllerUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DevicePublicKeyResponse
 */
export const DevicePublicKeyResponse = new DevicePublicKeyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetKsmPublicKeysResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetKsmPublicKeysResponse", [
      {
        no: 1,
        name: "keyResponses",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DevicePublicKeyResponse,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keyResponses = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.DevicePublicKeyResponse keyResponses */ 1:
          message.keyResponses.push(
            DevicePublicKeyResponse.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.DevicePublicKeyResponse keyResponses = 1; */
    for (let i = 0; i < message.keyResponses.length; i++)
      DevicePublicKeyResponse.internalBinaryWrite(
        message.keyResponses[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetKsmPublicKeysResponse
 */
export const GetKsmPublicKeysResponse = new GetKsmPublicKeysResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AddAppSharesRequest$Type extends MessageType {
  constructor() {
    super("Authentication.AddAppSharesRequest", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "shares",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AppShareAdd,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.shares = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* repeated Authentication.AppShareAdd shares */ 2:
          message.shares.push(AppShareAdd.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* repeated Authentication.AppShareAdd shares = 2; */
    for (let i = 0; i < message.shares.length; i++)
      AppShareAdd.internalBinaryWrite(
        message.shares[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AddAppSharesRequest
 */
export const AddAppSharesRequest = new AddAppSharesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RemoveAppSharesRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RemoveAppSharesRequest", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "shares",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.shares = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* repeated bytes shares */ 2:
          message.shares.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* repeated bytes shares = 2; */
    for (let i = 0; i < message.shares.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.shares[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RemoveAppSharesRequest
 */
export const RemoveAppSharesRequest = new RemoveAppSharesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AppShareAdd$Type extends MessageType {
  constructor() {
    super("Authentication.AppShareAdd", [
      { no: 2, name: "secretUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "shareType",
        kind: "enum",
        T: () => ["Authentication.ApplicationShareType", ApplicationShareType],
      },
      { no: 4, name: "encryptedSecretKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "editable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.secretUid = new Uint8Array(0);
    message.shareType = 0;
    message.encryptedSecretKey = new Uint8Array(0);
    message.editable = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes secretUid */ 2:
          message.secretUid = reader.bytes();
          break;
        case /* Authentication.ApplicationShareType shareType */ 3:
          message.shareType = reader.int32();
          break;
        case /* bytes encryptedSecretKey */ 4:
          message.encryptedSecretKey = reader.bytes();
          break;
        case /* bool editable */ 5:
          message.editable = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes secretUid = 2; */
    if (message.secretUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.secretUid);
    /* Authentication.ApplicationShareType shareType = 3; */
    if (message.shareType !== 0) writer.tag(3, WireType.Varint).int32(message.shareType);
    /* bytes encryptedSecretKey = 4; */
    if (message.encryptedSecretKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedSecretKey);
    /* bool editable = 5; */
    if (message.editable !== false) writer.tag(5, WireType.Varint).bool(message.editable);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AppShareAdd
 */
export const AppShareAdd = new AppShareAdd$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AppShare$Type extends MessageType {
  constructor() {
    super("Authentication.AppShare", [
      { no: 1, name: "secretUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "shareType",
        kind: "enum",
        T: () => ["Authentication.ApplicationShareType", ApplicationShareType],
      },
      { no: 3, name: "editable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 4,
        name: "createdOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.secretUid = new Uint8Array(0);
    message.shareType = 0;
    message.editable = false;
    message.createdOn = 0n;
    message.data = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes secretUid */ 1:
          message.secretUid = reader.bytes();
          break;
        case /* Authentication.ApplicationShareType shareType */ 2:
          message.shareType = reader.int32();
          break;
        case /* bool editable */ 3:
          message.editable = reader.bool();
          break;
        case /* int64 createdOn */ 4:
          message.createdOn = reader.int64().toBigInt();
          break;
        case /* bytes data */ 5:
          message.data = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes secretUid = 1; */
    if (message.secretUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.secretUid);
    /* Authentication.ApplicationShareType shareType = 2; */
    if (message.shareType !== 0) writer.tag(2, WireType.Varint).int32(message.shareType);
    /* bool editable = 3; */
    if (message.editable !== false) writer.tag(3, WireType.Varint).bool(message.editable);
    /* int64 createdOn = 4; */
    if (message.createdOn !== 0n) writer.tag(4, WireType.Varint).int64(message.createdOn);
    /* bytes data = 5; */
    if (message.data.length) writer.tag(5, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AppShare
 */
export const AppShare = new AppShare$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AddAppClientRequest$Type extends MessageType {
  constructor() {
    super("Authentication.AddAppClientRequest", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedAppKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "clientId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "lockIp", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 5,
        name: "firstAccessExpireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 6,
        name: "accessExpireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 7, name: "id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 8,
        name: "appClientType",
        kind: "enum",
        T: () => ["Enterprise.AppClientType", AppClientType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.encryptedAppKey = new Uint8Array(0);
    message.clientId = new Uint8Array(0);
    message.lockIp = false;
    message.firstAccessExpireOn = 0n;
    message.accessExpireOn = 0n;
    message.id = "";
    message.appClientType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* bytes encryptedAppKey */ 2:
          message.encryptedAppKey = reader.bytes();
          break;
        case /* bytes clientId */ 3:
          message.clientId = reader.bytes();
          break;
        case /* bool lockIp */ 4:
          message.lockIp = reader.bool();
          break;
        case /* int64 firstAccessExpireOn */ 5:
          message.firstAccessExpireOn = reader.int64().toBigInt();
          break;
        case /* int64 accessExpireOn */ 6:
          message.accessExpireOn = reader.int64().toBigInt();
          break;
        case /* string id */ 7:
          message.id = reader.string();
          break;
        case /* Enterprise.AppClientType appClientType */ 8:
          message.appClientType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* bytes encryptedAppKey = 2; */
    if (message.encryptedAppKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedAppKey);
    /* bytes clientId = 3; */
    if (message.clientId.length) writer.tag(3, WireType.LengthDelimited).bytes(message.clientId);
    /* bool lockIp = 4; */
    if (message.lockIp !== false) writer.tag(4, WireType.Varint).bool(message.lockIp);
    /* int64 firstAccessExpireOn = 5; */
    if (message.firstAccessExpireOn !== 0n)
      writer.tag(5, WireType.Varint).int64(message.firstAccessExpireOn);
    /* int64 accessExpireOn = 6; */
    if (message.accessExpireOn !== 0n) writer.tag(6, WireType.Varint).int64(message.accessExpireOn);
    /* string id = 7; */
    if (message.id !== "") writer.tag(7, WireType.LengthDelimited).string(message.id);
    /* Enterprise.AppClientType appClientType = 8; */
    if (message.appClientType !== 0) writer.tag(8, WireType.Varint).int32(message.appClientType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AddAppClientRequest
 */
export const AddAppClientRequest = new AddAppClientRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RemoveAppClientsRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RemoveAppClientsRequest", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "clients",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.clients = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* repeated bytes clients */ 2:
          message.clients.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* repeated bytes clients = 2; */
    for (let i = 0; i < message.clients.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.clients[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RemoveAppClientsRequest
 */
export const RemoveAppClientsRequest = new RemoveAppClientsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AddExternalShareRequest$Type extends MessageType {
  constructor() {
    super("Authentication.AddExternalShareRequest", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedRecordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "clientId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "accessExpireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "isSelfDestruct", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "isEditable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.encryptedRecordKey = new Uint8Array(0);
    message.clientId = new Uint8Array(0);
    message.accessExpireOn = 0n;
    message.id = "";
    message.isSelfDestruct = false;
    message.isEditable = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes encryptedRecordKey */ 2:
          message.encryptedRecordKey = reader.bytes();
          break;
        case /* bytes clientId */ 3:
          message.clientId = reader.bytes();
          break;
        case /* int64 accessExpireOn */ 4:
          message.accessExpireOn = reader.int64().toBigInt();
          break;
        case /* string id */ 5:
          message.id = reader.string();
          break;
        case /* bool isSelfDestruct */ 6:
          message.isSelfDestruct = reader.bool();
          break;
        case /* bool isEditable */ 7:
          message.isEditable = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes encryptedRecordKey = 2; */
    if (message.encryptedRecordKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedRecordKey);
    /* bytes clientId = 3; */
    if (message.clientId.length) writer.tag(3, WireType.LengthDelimited).bytes(message.clientId);
    /* int64 accessExpireOn = 4; */
    if (message.accessExpireOn !== 0n) writer.tag(4, WireType.Varint).int64(message.accessExpireOn);
    /* string id = 5; */
    if (message.id !== "") writer.tag(5, WireType.LengthDelimited).string(message.id);
    /* bool isSelfDestruct = 6; */
    if (message.isSelfDestruct !== false)
      writer.tag(6, WireType.Varint).bool(message.isSelfDestruct);
    /* bool isEditable = 7; */
    if (message.isEditable !== false) writer.tag(7, WireType.Varint).bool(message.isEditable);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AddExternalShareRequest
 */
export const AddExternalShareRequest = new AddExternalShareRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AppClient$Type extends MessageType {
  constructor() {
    super("Authentication.AppClient", [
      { no: 1, name: "id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "clientId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "createdOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "firstAccess",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "lastAccess",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "lockIp", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "ipAddress", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 9,
        name: "firstAccessExpireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 10,
        name: "accessExpireOn",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 11,
        name: "appClientType",
        kind: "enum",
        T: () => ["Enterprise.AppClientType", AppClientType],
      },
      { no: 12, name: "canEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.id = "";
    message.clientId = new Uint8Array(0);
    message.createdOn = 0n;
    message.firstAccess = 0n;
    message.lastAccess = 0n;
    message.publicKey = new Uint8Array(0);
    message.lockIp = false;
    message.ipAddress = "";
    message.firstAccessExpireOn = 0n;
    message.accessExpireOn = 0n;
    message.appClientType = 0;
    message.canEdit = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string id */ 1:
          message.id = reader.string();
          break;
        case /* bytes clientId */ 2:
          message.clientId = reader.bytes();
          break;
        case /* int64 createdOn */ 3:
          message.createdOn = reader.int64().toBigInt();
          break;
        case /* int64 firstAccess */ 4:
          message.firstAccess = reader.int64().toBigInt();
          break;
        case /* int64 lastAccess */ 5:
          message.lastAccess = reader.int64().toBigInt();
          break;
        case /* bytes publicKey */ 6:
          message.publicKey = reader.bytes();
          break;
        case /* bool lockIp */ 7:
          message.lockIp = reader.bool();
          break;
        case /* string ipAddress */ 8:
          message.ipAddress = reader.string();
          break;
        case /* int64 firstAccessExpireOn */ 9:
          message.firstAccessExpireOn = reader.int64().toBigInt();
          break;
        case /* int64 accessExpireOn */ 10:
          message.accessExpireOn = reader.int64().toBigInt();
          break;
        case /* Enterprise.AppClientType appClientType */ 11:
          message.appClientType = reader.int32();
          break;
        case /* bool canEdit */ 12:
          message.canEdit = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string id = 1; */
    if (message.id !== "") writer.tag(1, WireType.LengthDelimited).string(message.id);
    /* bytes clientId = 2; */
    if (message.clientId.length) writer.tag(2, WireType.LengthDelimited).bytes(message.clientId);
    /* int64 createdOn = 3; */
    if (message.createdOn !== 0n) writer.tag(3, WireType.Varint).int64(message.createdOn);
    /* int64 firstAccess = 4; */
    if (message.firstAccess !== 0n) writer.tag(4, WireType.Varint).int64(message.firstAccess);
    /* int64 lastAccess = 5; */
    if (message.lastAccess !== 0n) writer.tag(5, WireType.Varint).int64(message.lastAccess);
    /* bytes publicKey = 6; */
    if (message.publicKey.length) writer.tag(6, WireType.LengthDelimited).bytes(message.publicKey);
    /* bool lockIp = 7; */
    if (message.lockIp !== false) writer.tag(7, WireType.Varint).bool(message.lockIp);
    /* string ipAddress = 8; */
    if (message.ipAddress !== "") writer.tag(8, WireType.LengthDelimited).string(message.ipAddress);
    /* int64 firstAccessExpireOn = 9; */
    if (message.firstAccessExpireOn !== 0n)
      writer.tag(9, WireType.Varint).int64(message.firstAccessExpireOn);
    /* int64 accessExpireOn = 10; */
    if (message.accessExpireOn !== 0n)
      writer.tag(10, WireType.Varint).int64(message.accessExpireOn);
    /* Enterprise.AppClientType appClientType = 11; */
    if (message.appClientType !== 0) writer.tag(11, WireType.Varint).int32(message.appClientType);
    /* bool canEdit = 12; */
    if (message.canEdit !== false) writer.tag(12, WireType.Varint).bool(message.canEdit);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AppClient
 */
export const AppClient = new AppClient$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetAppInfoRequest$Type extends MessageType {
  constructor() {
    super("Authentication.GetAppInfoRequest", [
      {
        no: 1,
        name: "appRecordUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes appRecordUid */ 1:
          message.appRecordUid.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes appRecordUid = 1; */
    for (let i = 0; i < message.appRecordUid.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetAppInfoRequest
 */
export const GetAppInfoRequest = new GetAppInfoRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AppInfo$Type extends MessageType {
  constructor() {
    super("Authentication.AppInfo", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "shares",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AppShare,
      },
      {
        no: 3,
        name: "clients",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AppClient,
      },
      { no: 4, name: "isExternalShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.shares = [];
    message.clients = [];
    message.isExternalShare = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* repeated Authentication.AppShare shares */ 2:
          message.shares.push(AppShare.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Authentication.AppClient clients */ 3:
          message.clients.push(AppClient.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bool isExternalShare */ 4:
          message.isExternalShare = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* repeated Authentication.AppShare shares = 2; */
    for (let i = 0; i < message.shares.length; i++)
      AppShare.internalBinaryWrite(
        message.shares[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.AppClient clients = 3; */
    for (let i = 0; i < message.clients.length; i++)
      AppClient.internalBinaryWrite(
        message.clients[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool isExternalShare = 4; */
    if (message.isExternalShare !== false)
      writer.tag(4, WireType.Varint).bool(message.isExternalShare);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AppInfo
 */
export const AppInfo = new AppInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetAppInfoResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetAppInfoResponse", [
      {
        no: 1,
        name: "appInfo",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AppInfo,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appInfo = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.AppInfo appInfo */ 1:
          message.appInfo.push(AppInfo.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.AppInfo appInfo = 1; */
    for (let i = 0; i < message.appInfo.length; i++)
      AppInfo.internalBinaryWrite(
        message.appInfo[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetAppInfoResponse
 */
export const GetAppInfoResponse = new GetAppInfoResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApplicationSummary$Type extends MessageType {
  constructor() {
    super("Authentication.ApplicationSummary", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "lastAccess",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "recordShares", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "folderShares", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "folderRecords", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "clientCount", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 7, name: "expiredClientCount", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 8, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 9, name: "appData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.lastAccess = 0n;
    message.recordShares = 0;
    message.folderShares = 0;
    message.folderRecords = 0;
    message.clientCount = 0;
    message.expiredClientCount = 0;
    message.username = "";
    message.appData = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* int64 lastAccess */ 2:
          message.lastAccess = reader.int64().toBigInt();
          break;
        case /* int32 recordShares */ 3:
          message.recordShares = reader.int32();
          break;
        case /* int32 folderShares */ 4:
          message.folderShares = reader.int32();
          break;
        case /* int32 folderRecords */ 5:
          message.folderRecords = reader.int32();
          break;
        case /* int32 clientCount */ 6:
          message.clientCount = reader.int32();
          break;
        case /* int32 expiredClientCount */ 7:
          message.expiredClientCount = reader.int32();
          break;
        case /* string username */ 8:
          message.username = reader.string();
          break;
        case /* bytes appData */ 9:
          message.appData = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* int64 lastAccess = 2; */
    if (message.lastAccess !== 0n) writer.tag(2, WireType.Varint).int64(message.lastAccess);
    /* int32 recordShares = 3; */
    if (message.recordShares !== 0) writer.tag(3, WireType.Varint).int32(message.recordShares);
    /* int32 folderShares = 4; */
    if (message.folderShares !== 0) writer.tag(4, WireType.Varint).int32(message.folderShares);
    /* int32 folderRecords = 5; */
    if (message.folderRecords !== 0) writer.tag(5, WireType.Varint).int32(message.folderRecords);
    /* int32 clientCount = 6; */
    if (message.clientCount !== 0) writer.tag(6, WireType.Varint).int32(message.clientCount);
    /* int32 expiredClientCount = 7; */
    if (message.expiredClientCount !== 0)
      writer.tag(7, WireType.Varint).int32(message.expiredClientCount);
    /* string username = 8; */
    if (message.username !== "") writer.tag(8, WireType.LengthDelimited).string(message.username);
    /* bytes appData = 9; */
    if (message.appData.length) writer.tag(9, WireType.LengthDelimited).bytes(message.appData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ApplicationSummary
 */
export const ApplicationSummary = new ApplicationSummary$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetApplicationsSummaryResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetApplicationsSummaryResponse", [
      {
        no: 1,
        name: "applicationSummary",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ApplicationSummary,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.applicationSummary = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.ApplicationSummary applicationSummary */ 1:
          message.applicationSummary.push(
            ApplicationSummary.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.ApplicationSummary applicationSummary = 1; */
    for (let i = 0; i < message.applicationSummary.length; i++)
      ApplicationSummary.internalBinaryWrite(
        message.applicationSummary[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetApplicationsSummaryResponse
 */
export const GetApplicationsSummaryResponse = new GetApplicationsSummaryResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetVerificationTokenRequest$Type extends MessageType {
  constructor() {
    super("Authentication.GetVerificationTokenRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 1:
          message.username = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetVerificationTokenRequest
 */
export const GetVerificationTokenRequest = new GetVerificationTokenRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetVerificationTokenResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GetVerificationTokenResponse", [
      { no: 1, name: "encryptedVerificationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedVerificationToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedVerificationToken */ 1:
          message.encryptedVerificationToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedVerificationToken = 1; */
    if (message.encryptedVerificationToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedVerificationToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GetVerificationTokenResponse
 */
export const GetVerificationTokenResponse = new GetVerificationTokenResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SendShareInviteRequest$Type extends MessageType {
  constructor() {
    super("Authentication.SendShareInviteRequest", [
      { no: 1, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.email = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string email */ 1:
          message.email = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string email = 1; */
    if (message.email !== "") writer.tag(1, WireType.LengthDelimited).string(message.email);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.SendShareInviteRequest
 */
export const SendShareInviteRequest = new SendShareInviteRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TimeLimitedAccessRequest", [
      {
        no: 1,
        name: "accountUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 2,
        name: "teamUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 3,
        name: "recordUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 4, name: "sharedObjectUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 5,
        name: "timeLimitedAccessType",
        kind: "enum",
        T: () => ["Authentication.TimeLimitedAccessType", TimeLimitedAccessType],
      },
      {
        no: 6,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.accountUid = [];
    message.teamUid = [];
    message.recordUid = [];
    message.sharedObjectUid = new Uint8Array(0);
    message.timeLimitedAccessType = 0;
    message.expiration = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes accountUid */ 1:
          message.accountUid.push(reader.bytes());
          break;
        case /* repeated bytes teamUid */ 2:
          message.teamUid.push(reader.bytes());
          break;
        case /* repeated bytes recordUid */ 3:
          message.recordUid.push(reader.bytes());
          break;
        case /* bytes sharedObjectUid */ 4:
          message.sharedObjectUid = reader.bytes();
          break;
        case /* Authentication.TimeLimitedAccessType timeLimitedAccessType */ 5:
          message.timeLimitedAccessType = reader.int32();
          break;
        case /* int64 expiration */ 6:
          message.expiration = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes accountUid = 1; */
    for (let i = 0; i < message.accountUid.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.accountUid[i]);
    /* repeated bytes teamUid = 2; */
    for (let i = 0; i < message.teamUid.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.teamUid[i]);
    /* repeated bytes recordUid = 3; */
    for (let i = 0; i < message.recordUid.length; i++)
      writer.tag(3, WireType.LengthDelimited).bytes(message.recordUid[i]);
    /* bytes sharedObjectUid = 4; */
    if (message.sharedObjectUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.sharedObjectUid);
    /* Authentication.TimeLimitedAccessType timeLimitedAccessType = 5; */
    if (message.timeLimitedAccessType !== 0)
      writer.tag(5, WireType.Varint).int32(message.timeLimitedAccessType);
    /* int64 expiration = 6; */
    if (message.expiration !== 0n) writer.tag(6, WireType.Varint).int64(message.expiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TimeLimitedAccessRequest
 */
export const TimeLimitedAccessRequest = new TimeLimitedAccessRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessStatus$Type extends MessageType {
  constructor() {
    super("Authentication.TimeLimitedAccessStatus", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.message = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* string message */ 2:
          message.message = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* string message = 2; */
    if (message.message !== "") writer.tag(2, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TimeLimitedAccessStatus
 */
export const TimeLimitedAccessStatus = new TimeLimitedAccessStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TimeLimitedAccessResponse", [
      {
        no: 1,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "userAccessStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TimeLimitedAccessStatus,
      },
      {
        no: 3,
        name: "teamAccessStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TimeLimitedAccessStatus,
      },
      {
        no: 4,
        name: "recordAccessStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TimeLimitedAccessStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.revision = 0n;
    message.userAccessStatus = [];
    message.teamAccessStatus = [];
    message.recordAccessStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 revision */ 1:
          message.revision = reader.int64().toBigInt();
          break;
        case /* repeated Authentication.TimeLimitedAccessStatus userAccessStatus */ 2:
          message.userAccessStatus.push(
            TimeLimitedAccessStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Authentication.TimeLimitedAccessStatus teamAccessStatus */ 3:
          message.teamAccessStatus.push(
            TimeLimitedAccessStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Authentication.TimeLimitedAccessStatus recordAccessStatus */ 4:
          message.recordAccessStatus.push(
            TimeLimitedAccessStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 revision = 1; */
    if (message.revision !== 0n) writer.tag(1, WireType.Varint).int64(message.revision);
    /* repeated Authentication.TimeLimitedAccessStatus userAccessStatus = 2; */
    for (let i = 0; i < message.userAccessStatus.length; i++)
      TimeLimitedAccessStatus.internalBinaryWrite(
        message.userAccessStatus[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.TimeLimitedAccessStatus teamAccessStatus = 3; */
    for (let i = 0; i < message.teamAccessStatus.length; i++)
      TimeLimitedAccessStatus.internalBinaryWrite(
        message.teamAccessStatus[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Authentication.TimeLimitedAccessStatus recordAccessStatus = 4; */
    for (let i = 0; i < message.recordAccessStatus.length; i++)
      TimeLimitedAccessStatus.internalBinaryWrite(
        message.recordAccessStatus[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TimeLimitedAccessResponse
 */
export const TimeLimitedAccessResponse = new TimeLimitedAccessResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RequestDownloadRequest$Type extends MessageType {
  constructor() {
    super("Authentication.RequestDownloadRequest", [
      {
        no: 1,
        name: "fileNames",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.fileNames = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string fileNames */ 1:
          message.fileNames.push(reader.string());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated string fileNames = 1; */
    for (let i = 0; i < message.fileNames.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.fileNames[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RequestDownloadRequest
 */
export const RequestDownloadRequest = new RequestDownloadRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RequestDownloadResponse$Type extends MessageType {
  constructor() {
    super("Authentication.RequestDownloadResponse", [
      { no: 1, name: "result", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "downloads",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Download,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.result = "";
    message.message = "";
    message.downloads = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string result */ 1:
          message.result = reader.string();
          break;
        case /* string message */ 2:
          message.message = reader.string();
          break;
        case /* repeated Authentication.Download downloads */ 3:
          message.downloads.push(Download.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string result = 1; */
    if (message.result !== "") writer.tag(1, WireType.LengthDelimited).string(message.result);
    /* string message = 2; */
    if (message.message !== "") writer.tag(2, WireType.LengthDelimited).string(message.message);
    /* repeated Authentication.Download downloads = 3; */
    for (let i = 0; i < message.downloads.length; i++)
      Download.internalBinaryWrite(
        message.downloads[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.RequestDownloadResponse
 */
export const RequestDownloadResponse = new RequestDownloadResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Download$Type extends MessageType {
  constructor() {
    super("Authentication.Download", [
      { no: 1, name: "fileName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "successStatusCode", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.fileName = "";
    message.url = "";
    message.successStatusCode = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string fileName */ 1:
          message.fileName = reader.string();
          break;
        case /* string url */ 2:
          message.url = reader.string();
          break;
        case /* int32 successStatusCode */ 3:
          message.successStatusCode = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string fileName = 1; */
    if (message.fileName !== "") writer.tag(1, WireType.LengthDelimited).string(message.fileName);
    /* string url = 2; */
    if (message.url !== "") writer.tag(2, WireType.LengthDelimited).string(message.url);
    /* int32 successStatusCode = 3; */
    if (message.successStatusCode !== 0)
      writer.tag(3, WireType.Varint).int32(message.successStatusCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.Download
 */
export const Download = new Download$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeleteUserRequest$Type extends MessageType {
  constructor() {
    super("Authentication.DeleteUserRequest", [
      { no: 1, name: "reason", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reason = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string reason */ 1:
          message.reason = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string reason = 1; */
    if (message.reason !== "") writer.tag(1, WireType.LengthDelimited).string(message.reason);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.DeleteUserRequest
 */
export const DeleteUserRequest = new DeleteUserRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeMasterPasswordRequest$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeMasterPasswordRequest", [
      { no: 1, name: "authVerifier", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptionParams", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "fromServiceProvider", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "iterationsChange", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.authVerifier = new Uint8Array(0);
    message.encryptionParams = new Uint8Array(0);
    message.fromServiceProvider = false;
    message.iterationsChange = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes authVerifier */ 1:
          message.authVerifier = reader.bytes();
          break;
        case /* bytes encryptionParams */ 2:
          message.encryptionParams = reader.bytes();
          break;
        case /* bool fromServiceProvider */ 3:
          message.fromServiceProvider = reader.bool();
          break;
        case /* bool iterationsChange */ 4:
          message.iterationsChange = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes authVerifier = 1; */
    if (message.authVerifier.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.authVerifier);
    /* bytes encryptionParams = 2; */
    if (message.encryptionParams.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptionParams);
    /* bool fromServiceProvider = 3; */
    if (message.fromServiceProvider !== false)
      writer.tag(3, WireType.Varint).bool(message.fromServiceProvider);
    /* bool iterationsChange = 4; */
    if (message.iterationsChange !== false)
      writer.tag(4, WireType.Varint).bool(message.iterationsChange);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeMasterPasswordRequest
 */
export const ChangeMasterPasswordRequest = new ChangeMasterPasswordRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ChangeMasterPasswordResponse$Type extends MessageType {
  constructor() {
    super("Authentication.ChangeMasterPasswordResponse", [
      { no: 1, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedSessionToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedSessionToken */ 1:
          message.encryptedSessionToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptedSessionToken = 1; */
    if (message.encryptedSessionToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedSessionToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.ChangeMasterPasswordResponse
 */
export const ChangeMasterPasswordResponse = new ChangeMasterPasswordResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AccountRecoverySetupRequest$Type extends MessageType {
  constructor() {
    super("Authentication.AccountRecoverySetupRequest", [
      { no: 1, name: "recoveryEncryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recoveryAuthHash", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recoveryEncryptedDataKey = new Uint8Array(0);
    message.recoveryAuthHash = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes recoveryEncryptedDataKey */ 1:
          message.recoveryEncryptedDataKey = reader.bytes();
          break;
        case /* bytes recoveryAuthHash */ 2:
          message.recoveryAuthHash = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes recoveryEncryptedDataKey = 1; */
    if (message.recoveryEncryptedDataKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.recoveryEncryptedDataKey);
    /* bytes recoveryAuthHash = 2; */
    if (message.recoveryAuthHash.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recoveryAuthHash);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AccountRecoverySetupRequest
 */
export const AccountRecoverySetupRequest = new AccountRecoverySetupRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AccountRecoveryVerifyCodeResponse$Type extends MessageType {
  constructor() {
    super("Authentication.AccountRecoveryVerifyCodeResponse", [
      {
        no: 1,
        name: "backupKeyType",
        kind: "enum",
        T: () => ["Authentication.BackupKeyType", BackupKeyType],
      },
      {
        no: 2,
        name: "backupKeyDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "securityQuestion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "salt", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.backupKeyType = 0;
    message.backupKeyDate = 0n;
    message.securityQuestion = "";
    message.salt = new Uint8Array(0);
    message.iterations = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.BackupKeyType backupKeyType */ 1:
          message.backupKeyType = reader.int32();
          break;
        case /* int64 backupKeyDate */ 2:
          message.backupKeyDate = reader.int64().toBigInt();
          break;
        case /* string securityQuestion */ 3:
          message.securityQuestion = reader.string();
          break;
        case /* bytes salt */ 4:
          message.salt = reader.bytes();
          break;
        case /* int32 iterations */ 5:
          message.iterations = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.BackupKeyType backupKeyType = 1; */
    if (message.backupKeyType !== 0) writer.tag(1, WireType.Varint).int32(message.backupKeyType);
    /* int64 backupKeyDate = 2; */
    if (message.backupKeyDate !== 0n) writer.tag(2, WireType.Varint).int64(message.backupKeyDate);
    /* string securityQuestion = 3; */
    if (message.securityQuestion !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.securityQuestion);
    /* bytes salt = 4; */
    if (message.salt.length) writer.tag(4, WireType.LengthDelimited).bytes(message.salt);
    /* int32 iterations = 5; */
    if (message.iterations !== 0) writer.tag(5, WireType.Varint).int32(message.iterations);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.AccountRecoveryVerifyCodeResponse
 */
export const AccountRecoveryVerifyCodeResponse = new AccountRecoveryVerifyCodeResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EmergencyAccessLoginRequest$Type extends MessageType {
  constructor() {
    super("Authentication.EmergencyAccessLoginRequest", [
      { no: 1, name: "owner", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.owner = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string owner */ 1:
          message.owner = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string owner = 1; */
    if (message.owner !== "") writer.tag(1, WireType.LengthDelimited).string(message.owner);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EmergencyAccessLoginRequest
 */
export const EmergencyAccessLoginRequest = new EmergencyAccessLoginRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EmergencyAccessLoginResponse$Type extends MessageType {
  constructor() {
    super("Authentication.EmergencyAccessLoginResponse", [
      { no: 1, name: "sessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "dataKey", kind: "message", T: () => TypedKey },
      { no: 3, name: "rsaPrivateKey", kind: "message", T: () => TypedKey },
      { no: 4, name: "eccPrivateKey", kind: "message", T: () => TypedKey },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sessionToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes sessionToken */ 1:
          message.sessionToken = reader.bytes();
          break;
        case /* Enterprise.TypedKey dataKey */ 2:
          message.dataKey = TypedKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.dataKey,
          );
          break;
        case /* Enterprise.TypedKey rsaPrivateKey */ 3:
          message.rsaPrivateKey = TypedKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.rsaPrivateKey,
          );
          break;
        case /* Enterprise.TypedKey eccPrivateKey */ 4:
          message.eccPrivateKey = TypedKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.eccPrivateKey,
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes sessionToken = 1; */
    if (message.sessionToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sessionToken);
    /* Enterprise.TypedKey dataKey = 2; */
    if (message.dataKey)
      TypedKey.internalBinaryWrite(
        message.dataKey,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.TypedKey rsaPrivateKey = 3; */
    if (message.rsaPrivateKey)
      TypedKey.internalBinaryWrite(
        message.rsaPrivateKey,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.TypedKey eccPrivateKey = 4; */
    if (message.eccPrivateKey)
      TypedKey.internalBinaryWrite(
        message.eccPrivateKey,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.EmergencyAccessLoginResponse
 */
export const EmergencyAccessLoginResponse = new EmergencyAccessLoginResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserTeamKey$Type extends MessageType {
  constructor() {
    super("Authentication.UserTeamKey", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "encryptedTeamKeyRSA", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptedTeamKeyEC", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 6,
        name: "status",
        kind: "enum",
        T: () => ["Authentication.GenericStatus", GenericStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.username = "";
    message.enterpriseUserId = 0n;
    message.encryptedTeamKeyRSA = new Uint8Array(0);
    message.encryptedTeamKeyEC = new Uint8Array(0);
    message.status = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes teamUid */ 1:
          message.teamUid = reader.bytes();
          break;
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* int64 enterpriseUserId */ 3:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedTeamKeyRSA */ 4:
          message.encryptedTeamKeyRSA = reader.bytes();
          break;
        case /* bytes encryptedTeamKeyEC */ 5:
          message.encryptedTeamKeyEC = reader.bytes();
          break;
        case /* Authentication.GenericStatus status */ 6:
          message.status = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes teamUid = 1; */
    if (message.teamUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.teamUid);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* int64 enterpriseUserId = 3; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(3, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes encryptedTeamKeyRSA = 4; */
    if (message.encryptedTeamKeyRSA.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedTeamKeyRSA);
    /* bytes encryptedTeamKeyEC = 5; */
    if (message.encryptedTeamKeyEC.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedTeamKeyEC);
    /* Authentication.GenericStatus status = 6; */
    if (message.status !== 0) writer.tag(6, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UserTeamKey
 */
export const UserTeamKey = new UserTeamKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GenericRequestResponse$Type extends MessageType {
  constructor() {
    super("Authentication.GenericRequestResponse", [
      {
        no: 1,
        name: "request",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.request = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes request */ 1:
          message.request.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes request = 1; */
    for (let i = 0; i < message.request.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.request[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.GenericRequestResponse
 */
export const GenericRequestResponse = new GenericRequestResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyRegistrationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyRegistrationRequest", [
      {
        no: 1,
        name: "authenticatorAttachment",
        kind: "enum",
        T: () => ["Authentication.AuthenticatorAttachment", AuthenticatorAttachment],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.authenticatorAttachment = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Authentication.AuthenticatorAttachment authenticatorAttachment */ 1:
          message.authenticatorAttachment = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthenticatorAttachment authenticatorAttachment = 1; */
    if (message.authenticatorAttachment !== 0)
      writer.tag(1, WireType.Varint).int32(message.authenticatorAttachment);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyRegistrationRequest
 */
export const PasskeyRegistrationRequest = new PasskeyRegistrationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyRegistrationResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyRegistrationResponse", [
      { no: 1, name: "challengeToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "pkCreationOptions", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.challengeToken = new Uint8Array(0);
    message.pkCreationOptions = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes challengeToken */ 1:
          message.challengeToken = reader.bytes();
          break;
        case /* string pkCreationOptions */ 2:
          message.pkCreationOptions = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes challengeToken = 1; */
    if (message.challengeToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.challengeToken);
    /* string pkCreationOptions = 2; */
    if (message.pkCreationOptions !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.pkCreationOptions);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyRegistrationResponse
 */
export const PasskeyRegistrationResponse = new PasskeyRegistrationResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyRegistrationFinalization$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyRegistrationFinalization", [
      {
        no: 3,
        name: "friendlyName",
        kind: "scalar",
        oneof: "FriendlyName",
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 1, name: "challengeToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "authenticatorResponse", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.FriendlyName = { oneofKind: undefined };
    message.challengeToken = new Uint8Array(0);
    message.authenticatorResponse = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string friendlyName */ 3:
          message.FriendlyName = {
            oneofKind: "friendlyName",
            friendlyName: reader.string(),
          };
          break;
        case /* bytes challengeToken */ 1:
          message.challengeToken = reader.bytes();
          break;
        case /* string authenticatorResponse */ 2:
          message.authenticatorResponse = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes challengeToken = 1; */
    if (message.challengeToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.challengeToken);
    /* string authenticatorResponse = 2; */
    if (message.authenticatorResponse !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.authenticatorResponse);
    /* string friendlyName = 3; */
    if (message.FriendlyName.oneofKind === "friendlyName")
      writer.tag(3, WireType.LengthDelimited).string(message.FriendlyName.friendlyName);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyRegistrationFinalization
 */
export const PasskeyRegistrationFinalization = new PasskeyRegistrationFinalization$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyAuthenticationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyAuthenticationRequest", [
      { no: 5, name: "username", kind: "scalar", oneof: "Username", T: 9 /*ScalarType.STRING*/ },
      {
        no: 6,
        name: "encryptedLoginToken",
        kind: "scalar",
        oneof: "EncryptedLoginToken",
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 1,
        name: "authenticatorAttachment",
        kind: "enum",
        T: () => ["Authentication.AuthenticatorAttachment", AuthenticatorAttachment],
      },
      {
        no: 2,
        name: "passkeyPurpose",
        kind: "enum",
        T: () => ["Authentication.PasskeyPurpose", PasskeyPurpose],
      },
      { no: 3, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.Username = { oneofKind: undefined };
    message.EncryptedLoginToken = { oneofKind: undefined };
    message.authenticatorAttachment = 0;
    message.passkeyPurpose = 0;
    message.clientVersion = "";
    message.encryptedDeviceToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string username */ 5:
          message.Username = {
            oneofKind: "username",
            username: reader.string(),
          };
          break;
        case /* bytes encryptedLoginToken */ 6:
          message.EncryptedLoginToken = {
            oneofKind: "encryptedLoginToken",
            encryptedLoginToken: reader.bytes(),
          };
          break;
        case /* Authentication.AuthenticatorAttachment authenticatorAttachment */ 1:
          message.authenticatorAttachment = reader.int32();
          break;
        case /* Authentication.PasskeyPurpose passkeyPurpose */ 2:
          message.passkeyPurpose = reader.int32();
          break;
        case /* string clientVersion */ 3:
          message.clientVersion = reader.string();
          break;
        case /* bytes encryptedDeviceToken */ 4:
          message.encryptedDeviceToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Authentication.AuthenticatorAttachment authenticatorAttachment = 1; */
    if (message.authenticatorAttachment !== 0)
      writer.tag(1, WireType.Varint).int32(message.authenticatorAttachment);
    /* Authentication.PasskeyPurpose passkeyPurpose = 2; */
    if (message.passkeyPurpose !== 0) writer.tag(2, WireType.Varint).int32(message.passkeyPurpose);
    /* string clientVersion = 3; */
    if (message.clientVersion !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.clientVersion);
    /* bytes encryptedDeviceToken = 4; */
    if (message.encryptedDeviceToken.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* string username = 5; */
    if (message.Username.oneofKind === "username")
      writer.tag(5, WireType.LengthDelimited).string(message.Username.username);
    /* bytes encryptedLoginToken = 6; */
    if (message.EncryptedLoginToken.oneofKind === "encryptedLoginToken")
      writer
        .tag(6, WireType.LengthDelimited)
        .bytes(message.EncryptedLoginToken.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyAuthenticationRequest
 */
export const PasskeyAuthenticationRequest = new PasskeyAuthenticationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyAuthenticationResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyAuthenticationResponse", [
      {
        no: 3,
        name: "encryptedLoginToken",
        kind: "scalar",
        oneof: "EncryptedLoginToken",
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 1, name: "pkRequestOptions", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "challengeToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.EncryptedLoginToken = { oneofKind: undefined };
    message.pkRequestOptions = "";
    message.challengeToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 3:
          message.EncryptedLoginToken = {
            oneofKind: "encryptedLoginToken",
            encryptedLoginToken: reader.bytes(),
          };
          break;
        case /* string pkRequestOptions */ 1:
          message.pkRequestOptions = reader.string();
          break;
        case /* bytes challengeToken */ 2:
          message.challengeToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string pkRequestOptions = 1; */
    if (message.pkRequestOptions !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.pkRequestOptions);
    /* bytes challengeToken = 2; */
    if (message.challengeToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.challengeToken);
    /* bytes encryptedLoginToken = 3; */
    if (message.EncryptedLoginToken.oneofKind === "encryptedLoginToken")
      writer
        .tag(3, WireType.LengthDelimited)
        .bytes(message.EncryptedLoginToken.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyAuthenticationResponse
 */
export const PasskeyAuthenticationResponse = new PasskeyAuthenticationResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyValidationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyValidationRequest", [
      {
        no: 4,
        name: "encryptedLoginToken",
        kind: "scalar",
        oneof: "EncryptedLoginToken",
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 1, name: "challengeToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "assertionResponse", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "passkeyPurpose",
        kind: "enum",
        T: () => ["Authentication.PasskeyPurpose", PasskeyPurpose],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.EncryptedLoginToken = { oneofKind: undefined };
    message.challengeToken = new Uint8Array(0);
    message.assertionResponse = new Uint8Array(0);
    message.passkeyPurpose = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedLoginToken */ 4:
          message.EncryptedLoginToken = {
            oneofKind: "encryptedLoginToken",
            encryptedLoginToken: reader.bytes(),
          };
          break;
        case /* bytes challengeToken */ 1:
          message.challengeToken = reader.bytes();
          break;
        case /* bytes assertionResponse */ 2:
          message.assertionResponse = reader.bytes();
          break;
        case /* Authentication.PasskeyPurpose passkeyPurpose */ 3:
          message.passkeyPurpose = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes challengeToken = 1; */
    if (message.challengeToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.challengeToken);
    /* bytes assertionResponse = 2; */
    if (message.assertionResponse.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.assertionResponse);
    /* Authentication.PasskeyPurpose passkeyPurpose = 3; */
    if (message.passkeyPurpose !== 0) writer.tag(3, WireType.Varint).int32(message.passkeyPurpose);
    /* bytes encryptedLoginToken = 4; */
    if (message.EncryptedLoginToken.oneofKind === "encryptedLoginToken")
      writer
        .tag(4, WireType.LengthDelimited)
        .bytes(message.EncryptedLoginToken.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyValidationRequest
 */
export const PasskeyValidationRequest = new PasskeyValidationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyValidationResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyValidationResponse", [
      { no: 1, name: "isValid", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 2, name: "encryptedLoginToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.isValid = false;
    message.encryptedLoginToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool isValid */ 1:
          message.isValid = reader.bool();
          break;
        case /* bytes encryptedLoginToken */ 2:
          message.encryptedLoginToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool isValid = 1; */
    if (message.isValid !== false) writer.tag(1, WireType.Varint).bool(message.isValid);
    /* bytes encryptedLoginToken = 2; */
    if (message.encryptedLoginToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedLoginToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyValidationResponse
 */
export const PasskeyValidationResponse = new PasskeyValidationResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UpdatePasskeyRequest$Type extends MessageType {
  constructor() {
    super("Authentication.UpdatePasskeyRequest", [
      {
        no: 3,
        name: "friendlyName",
        kind: "scalar",
        oneof: "FriendlyName",
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "credentialId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.FriendlyName = { oneofKind: undefined };
    message.userId = 0;
    message.credentialId = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string friendlyName */ 3:
          message.FriendlyName = {
            oneofKind: "friendlyName",
            friendlyName: reader.string(),
          };
          break;
        case /* int32 userId */ 1:
          message.userId = reader.int32();
          break;
        case /* bytes credentialId */ 2:
          message.credentialId = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 userId = 1; */
    if (message.userId !== 0) writer.tag(1, WireType.Varint).int32(message.userId);
    /* bytes credentialId = 2; */
    if (message.credentialId.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.credentialId);
    /* string friendlyName = 3; */
    if (message.FriendlyName.oneofKind === "friendlyName")
      writer.tag(3, WireType.LengthDelimited).string(message.FriendlyName.friendlyName);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.UpdatePasskeyRequest
 */
export const UpdatePasskeyRequest = new UpdatePasskeyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyListRequest$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyListRequest", [
      { no: 1, name: "includeDisabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.includeDisabled = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool includeDisabled */ 1:
          message.includeDisabled = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool includeDisabled = 1; */
    if (message.includeDisabled !== false)
      writer.tag(1, WireType.Varint).bool(message.includeDisabled);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyListRequest
 */
export const PasskeyListRequest = new PasskeyListRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyInfo$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyInfo", [
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "credentialId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "friendlyName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "AAGUID", kind: "scalar", jsonName: "AAGUID", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "createdAtMillis",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 6,
        name: "lastUsedMillis",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 7,
        name: "disabledAtMillis",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userId = 0;
    message.credentialId = new Uint8Array(0);
    message.friendlyName = "";
    message.aAGUID = "";
    message.createdAtMillis = 0n;
    message.lastUsedMillis = 0n;
    message.disabledAtMillis = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 userId */ 1:
          message.userId = reader.int32();
          break;
        case /* bytes credentialId */ 2:
          message.credentialId = reader.bytes();
          break;
        case /* string friendlyName */ 3:
          message.friendlyName = reader.string();
          break;
        case /* string AAGUID */ 4:
          message.aAGUID = reader.string();
          break;
        case /* int64 createdAtMillis */ 5:
          message.createdAtMillis = reader.int64().toBigInt();
          break;
        case /* int64 lastUsedMillis */ 6:
          message.lastUsedMillis = reader.int64().toBigInt();
          break;
        case /* int64 disabledAtMillis */ 7:
          message.disabledAtMillis = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 userId = 1; */
    if (message.userId !== 0) writer.tag(1, WireType.Varint).int32(message.userId);
    /* bytes credentialId = 2; */
    if (message.credentialId.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.credentialId);
    /* string friendlyName = 3; */
    if (message.friendlyName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.friendlyName);
    /* string AAGUID = 4; */
    if (message.aAGUID !== "") writer.tag(4, WireType.LengthDelimited).string(message.aAGUID);
    /* int64 createdAtMillis = 5; */
    if (message.createdAtMillis !== 0n)
      writer.tag(5, WireType.Varint).int64(message.createdAtMillis);
    /* int64 lastUsedMillis = 6; */
    if (message.lastUsedMillis !== 0n) writer.tag(6, WireType.Varint).int64(message.lastUsedMillis);
    /* int64 disabledAtMillis = 7; */
    if (message.disabledAtMillis !== 0n)
      writer.tag(7, WireType.Varint).int64(message.disabledAtMillis);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyInfo
 */
export const PasskeyInfo = new PasskeyInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasskeyListResponse$Type extends MessageType {
  constructor() {
    super("Authentication.PasskeyListResponse", [
      {
        no: 1,
        name: "passkeyInfo",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => PasskeyInfo,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.passkeyInfo = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.PasskeyInfo passkeyInfo */ 1:
          message.passkeyInfo.push(
            PasskeyInfo.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.PasskeyInfo passkeyInfo = 1; */
    for (let i = 0; i < message.passkeyInfo.length; i++)
      PasskeyInfo.internalBinaryWrite(
        message.passkeyInfo[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.PasskeyListResponse
 */
export const PasskeyListResponse = new PasskeyListResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TranslationInfo$Type extends MessageType {
  constructor() {
    super("Authentication.TranslationInfo", [
      { no: 1, name: "translationKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "translationValue", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.translationKey = "";
    message.translationValue = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string translationKey */ 1:
          message.translationKey = reader.string();
          break;
        case /* string translationValue */ 2:
          message.translationValue = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string translationKey = 1; */
    if (message.translationKey !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.translationKey);
    /* string translationValue = 2; */
    if (message.translationValue !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.translationValue);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TranslationInfo
 */
export const TranslationInfo = new TranslationInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TranslationRequest$Type extends MessageType {
  constructor() {
    super("Authentication.TranslationRequest", [
      {
        no: 1,
        name: "translationKey",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.translationKey = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string translationKey */ 1:
          message.translationKey.push(reader.string());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated string translationKey = 1; */
    for (let i = 0; i < message.translationKey.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.translationKey[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TranslationRequest
 */
export const TranslationRequest = new TranslationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TranslationResponse$Type extends MessageType {
  constructor() {
    super("Authentication.TranslationResponse", [
      {
        no: 1,
        name: "translationInfo",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TranslationInfo,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.translationInfo = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Authentication.TranslationInfo translationInfo */ 1:
          message.translationInfo.push(
            TranslationInfo.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Authentication.TranslationInfo translationInfo = 1; */
    for (let i = 0; i < message.translationInfo.length; i++)
      TranslationInfo.internalBinaryWrite(
        message.translationInfo[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Authentication.TranslationResponse
 */
export const TranslationResponse = new TranslationResponse$Type();
