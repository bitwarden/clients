import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf enum Enterprise.KeyType
 */
export var KeyType;
(function (KeyType) {
  /**
   * @generated from protobuf enum value: RSA = 0;
   */
  KeyType[(KeyType["RSA"] = 0)] = "RSA";
  /**
   * @generated from protobuf enum value: ECC = 1;
   */
  KeyType[(KeyType["ECC"] = 1)] = "ECC";
})(KeyType || (KeyType = {}));
/**
 * @generated from protobuf enum Enterprise.RoleUserModifyStatus
 */
export var RoleUserModifyStatus;
(function (RoleUserModifyStatus) {
  /**
   * @generated from protobuf enum value: ROLE_EXISTS = 0;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["ROLE_EXISTS"] = 0)] = "ROLE_EXISTS";
  /**
   * @generated from protobuf enum value: MISSING_TREE_KEY = 1;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["MISSING_TREE_KEY"] = 1)] = "MISSING_TREE_KEY";
  /**
   * @generated from protobuf enum value: MISSING_ROLE_KEY = 2;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["MISSING_ROLE_KEY"] = 2)] = "MISSING_ROLE_KEY";
  /**
   * @generated from protobuf enum value: INVALID_ENTERPRISE_USER_ID = 3;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["INVALID_ENTERPRISE_USER_ID"] = 3)] =
    "INVALID_ENTERPRISE_USER_ID";
  /**
   * @generated from protobuf enum value: PENDING_ENTERPRISE_USER = 4;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["PENDING_ENTERPRISE_USER"] = 4)] =
    "PENDING_ENTERPRISE_USER";
  /**
   * @generated from protobuf enum value: INVALID_NODE_ID = 5;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["INVALID_NODE_ID"] = 5)] = "INVALID_NODE_ID";
  /**
   * @generated from protobuf enum value: MAY_NOT_REMOVE_SELF_FROM_ROLE = 6;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["MAY_NOT_REMOVE_SELF_FROM_ROLE"] = 6)] =
    "MAY_NOT_REMOVE_SELF_FROM_ROLE";
  /**
   * @generated from protobuf enum value: MUST_HAVE_ONE_USER_ADMIN = 7;
   */
  RoleUserModifyStatus[(RoleUserModifyStatus["MUST_HAVE_ONE_USER_ADMIN"] = 7)] =
    "MUST_HAVE_ONE_USER_ADMIN";
})(RoleUserModifyStatus || (RoleUserModifyStatus = {}));
/**
 * @generated from protobuf enum Enterprise.EnterpriseType
 */
export var EnterpriseType;
(function (EnterpriseType) {
  /**
   * @generated from protobuf enum value: ENTERPRISE_STANDARD = 0;
   */
  EnterpriseType[(EnterpriseType["ENTERPRISE_STANDARD"] = 0)] = "ENTERPRISE_STANDARD";
  /**
   * @generated from protobuf enum value: ENTERPRISE_MSP = 1;
   */
  EnterpriseType[(EnterpriseType["ENTERPRISE_MSP"] = 1)] = "ENTERPRISE_MSP";
})(EnterpriseType || (EnterpriseType = {}));
/**
 * @generated from protobuf enum Enterprise.TransferAcceptanceStatus
 */
export var TransferAcceptanceStatus;
(function (TransferAcceptanceStatus) {
  /**
   * @generated from protobuf enum value: UNDEFINED = 0;
   */
  TransferAcceptanceStatus[(TransferAcceptanceStatus["UNDEFINED"] = 0)] = "UNDEFINED";
  /**
   * @generated from protobuf enum value: NOT_REQUIRED = 1;
   */
  TransferAcceptanceStatus[(TransferAcceptanceStatus["NOT_REQUIRED"] = 1)] = "NOT_REQUIRED";
  /**
   * @generated from protobuf enum value: NOT_ACCEPTED = 2;
   */
  TransferAcceptanceStatus[(TransferAcceptanceStatus["NOT_ACCEPTED"] = 2)] = "NOT_ACCEPTED";
  /**
   * @generated from protobuf enum value: PARTIALLY_ACCEPTED = 3;
   */
  TransferAcceptanceStatus[(TransferAcceptanceStatus["PARTIALLY_ACCEPTED"] = 3)] =
    "PARTIALLY_ACCEPTED";
  /**
   * @generated from protobuf enum value: ACCEPTED = 4;
   */
  TransferAcceptanceStatus[(TransferAcceptanceStatus["ACCEPTED"] = 4)] = "ACCEPTED";
})(TransferAcceptanceStatus || (TransferAcceptanceStatus = {}));
/**
 * @generated from protobuf enum Enterprise.EnterpriseDataEntity
 */
export var EnterpriseDataEntity;
(function (EnterpriseDataEntity) {
  /**
   * @generated from protobuf enum value: UNKNOWN = 0;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["UNKNOWN"] = 0)] = "UNKNOWN";
  /**
   * @generated from protobuf enum value: NODES = 1;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["NODES"] = 1)] = "NODES";
  /**
   * @generated from protobuf enum value: ROLES = 2;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["ROLES"] = 2)] = "ROLES";
  /**
   * @generated from protobuf enum value: USERS = 3;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["USERS"] = 3)] = "USERS";
  /**
   * @generated from protobuf enum value: TEAMS = 4;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["TEAMS"] = 4)] = "TEAMS";
  /**
   * @generated from protobuf enum value: TEAM_USERS = 5;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["TEAM_USERS"] = 5)] = "TEAM_USERS";
  /**
   * @generated from protobuf enum value: ROLE_USERS = 6;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["ROLE_USERS"] = 6)] = "ROLE_USERS";
  /**
   * @generated from protobuf enum value: ROLE_PRIVILEGES = 7;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["ROLE_PRIVILEGES"] = 7)] = "ROLE_PRIVILEGES";
  /**
   * @generated from protobuf enum value: ROLE_ENFORCEMENTS = 8;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["ROLE_ENFORCEMENTS"] = 8)] = "ROLE_ENFORCEMENTS";
  /**
   * @generated from protobuf enum value: ROLE_TEAMS = 9;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["ROLE_TEAMS"] = 9)] = "ROLE_TEAMS";
  /**
   * @generated from protobuf enum value: LICENSES = 10;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["LICENSES"] = 10)] = "LICENSES";
  /**
   * @generated from protobuf enum value: MANAGED_NODES = 11;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["MANAGED_NODES"] = 11)] = "MANAGED_NODES";
  /**
   * @generated from protobuf enum value: MANAGED_COMPANIES = 12;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["MANAGED_COMPANIES"] = 12)] = "MANAGED_COMPANIES";
  /**
   * @generated from protobuf enum value: BRIDGES = 13;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["BRIDGES"] = 13)] = "BRIDGES";
  /**
   * @generated from protobuf enum value: SCIMS = 14;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["SCIMS"] = 14)] = "SCIMS";
  /**
   * @generated from protobuf enum value: EMAIL_PROVISION = 15;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["EMAIL_PROVISION"] = 15)] = "EMAIL_PROVISION";
  /**
   * @generated from protobuf enum value: QUEUED_TEAMS = 16;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["QUEUED_TEAMS"] = 16)] = "QUEUED_TEAMS";
  /**
   * @generated from protobuf enum value: QUEUED_TEAM_USERS = 17;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["QUEUED_TEAM_USERS"] = 17)] = "QUEUED_TEAM_USERS";
  /**
   * @generated from protobuf enum value: SSO_SERVICES = 18;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["SSO_SERVICES"] = 18)] = "SSO_SERVICES";
  /**
   * @generated from protobuf enum value: REPORT_FILTER_USERS = 19;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["REPORT_FILTER_USERS"] = 19)] = "REPORT_FILTER_USERS";
  /**
   * @generated from protobuf enum value: DEVICES_REQUEST_FOR_ADMIN_APPROVAL = 20;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["DEVICES_REQUEST_FOR_ADMIN_APPROVAL"] = 20)] =
    "DEVICES_REQUEST_FOR_ADMIN_APPROVAL";
  /**
   * @generated from protobuf enum value: USER_ALIASES = 21;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["USER_ALIASES"] = 21)] = "USER_ALIASES";
  /**
   * @generated from protobuf enum value: COMPLIANCE_REPORT_CRITERIA_AND_FILTER = 22;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["COMPLIANCE_REPORT_CRITERIA_AND_FILTER"] = 22)] =
    "COMPLIANCE_REPORT_CRITERIA_AND_FILTER";
  /**
   * @generated from protobuf enum value: COMPLIANCE_REPORTS = 23;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["COMPLIANCE_REPORTS"] = 23)] = "COMPLIANCE_REPORTS";
  /**
   * @generated from protobuf enum value: QUEUED_TEAM_USERS_INCLUDING_PENDING = 24;
   */
  EnterpriseDataEntity[(EnterpriseDataEntity["QUEUED_TEAM_USERS_INCLUDING_PENDING"] = 24)] =
    "QUEUED_TEAM_USERS_INCLUDING_PENDING";
})(EnterpriseDataEntity || (EnterpriseDataEntity = {}));
/**
 * @generated from protobuf enum Enterprise.CacheStatus
 */
export var CacheStatus;
(function (CacheStatus) {
  /**
   * @generated from protobuf enum value: KEEP = 0;
   */
  CacheStatus[(CacheStatus["KEEP"] = 0)] = "KEEP";
  /**
   * @generated from protobuf enum value: CLEAR = 1;
   */
  CacheStatus[(CacheStatus["CLEAR"] = 1)] = "CLEAR";
})(CacheStatus || (CacheStatus = {}));
/**
 * @generated from protobuf enum Enterprise.BackupKeyType
 */
export var BackupKeyType;
(function (BackupKeyType) {
  /**
   * @generated from protobuf enum value: NO_KEY = 0;
   */
  BackupKeyType[(BackupKeyType["NO_KEY"] = 0)] = "NO_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_DATA_KEY = 1;
   */
  BackupKeyType[(BackupKeyType["ENCRYPTED_BY_DATA_KEY"] = 1)] = "ENCRYPTED_BY_DATA_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_PUBLIC_KEY = 2;
   */
  BackupKeyType[(BackupKeyType["ENCRYPTED_BY_PUBLIC_KEY"] = 2)] = "ENCRYPTED_BY_PUBLIC_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_DATA_KEY_GCM = 3;
   */
  BackupKeyType[(BackupKeyType["ENCRYPTED_BY_DATA_KEY_GCM"] = 3)] = "ENCRYPTED_BY_DATA_KEY_GCM";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_PUBLIC_KEY_ECC = 4;
   */
  BackupKeyType[(BackupKeyType["ENCRYPTED_BY_PUBLIC_KEY_ECC"] = 4)] = "ENCRYPTED_BY_PUBLIC_KEY_ECC";
})(BackupKeyType || (BackupKeyType = {}));
/**
 * @generated from protobuf enum Enterprise.BackupUserDataKeyType
 */
export var BackupUserDataKeyType;
(function (BackupUserDataKeyType) {
  /**
   * @generated from protobuf enum value: OWN = 0;
   */
  BackupUserDataKeyType[(BackupUserDataKeyType["OWN"] = 0)] = "OWN";
  /**
   * @generated from protobuf enum value: SHARED_TO_ENTERPRISE = 1;
   */
  BackupUserDataKeyType[(BackupUserDataKeyType["SHARED_TO_ENTERPRISE"] = 1)] =
    "SHARED_TO_ENTERPRISE";
})(BackupUserDataKeyType || (BackupUserDataKeyType = {}));
/**
 * @generated from protobuf enum Enterprise.EncryptedKeyType
 */
export var EncryptedKeyType;
(function (EncryptedKeyType) {
  /**
   * @generated from protobuf enum value: KT_NO_KEY = 0;
   */
  EncryptedKeyType[(EncryptedKeyType["KT_NO_KEY"] = 0)] = "KT_NO_KEY";
  /**
   * @generated from protobuf enum value: KT_ENCRYPTED_BY_DATA_KEY = 1;
   */
  EncryptedKeyType[(EncryptedKeyType["KT_ENCRYPTED_BY_DATA_KEY"] = 1)] = "KT_ENCRYPTED_BY_DATA_KEY";
  /**
   * @generated from protobuf enum value: KT_ENCRYPTED_BY_PUBLIC_KEY = 2;
   */
  EncryptedKeyType[(EncryptedKeyType["KT_ENCRYPTED_BY_PUBLIC_KEY"] = 2)] =
    "KT_ENCRYPTED_BY_PUBLIC_KEY";
  /**
   * @generated from protobuf enum value: KT_ENCRYPTED_BY_DATA_KEY_GCM = 3;
   */
  EncryptedKeyType[(EncryptedKeyType["KT_ENCRYPTED_BY_DATA_KEY_GCM"] = 3)] =
    "KT_ENCRYPTED_BY_DATA_KEY_GCM";
  /**
   * @generated from protobuf enum value: KT_ENCRYPTED_BY_PUBLIC_KEY_ECC = 4;
   */
  EncryptedKeyType[(EncryptedKeyType["KT_ENCRYPTED_BY_PUBLIC_KEY_ECC"] = 4)] =
    "KT_ENCRYPTED_BY_PUBLIC_KEY_ECC";
})(EncryptedKeyType || (EncryptedKeyType = {}));
/**
 * @generated from protobuf enum Enterprise.EnterpriseFlagType
 */
export var EnterpriseFlagType;
(function (EnterpriseFlagType) {
  /**
   * @generated from protobuf enum value: INVALID = 0;
   */
  EnterpriseFlagType[(EnterpriseFlagType["INVALID"] = 0)] = "INVALID";
  /**
   * @generated from protobuf enum value: ALLOW_PERSONAL_LICENSE = 1;
   */
  EnterpriseFlagType[(EnterpriseFlagType["ALLOW_PERSONAL_LICENSE"] = 1)] = "ALLOW_PERSONAL_LICENSE";
  /**
   * @generated from protobuf enum value: SPECIAL_PROVISIONING = 2;
   */
  EnterpriseFlagType[(EnterpriseFlagType["SPECIAL_PROVISIONING"] = 2)] = "SPECIAL_PROVISIONING";
  /**
   * @generated from protobuf enum value: RECORD_TYPES = 3;
   */
  EnterpriseFlagType[(EnterpriseFlagType["RECORD_TYPES"] = 3)] = "RECORD_TYPES";
  /**
   * @generated from protobuf enum value: SECRETS_MANAGER = 4;
   */
  EnterpriseFlagType[(EnterpriseFlagType["SECRETS_MANAGER"] = 4)] = "SECRETS_MANAGER";
  /**
   * @generated from protobuf enum value: ENTERPRISE_LOCKED = 5;
   */
  EnterpriseFlagType[(EnterpriseFlagType["ENTERPRISE_LOCKED"] = 5)] = "ENTERPRISE_LOCKED";
  /**
   * @generated from protobuf enum value: FORBID_KEY_TYPE_2 = 6;
   */
  EnterpriseFlagType[(EnterpriseFlagType["FORBID_KEY_TYPE_2"] = 6)] = "FORBID_KEY_TYPE_2";
  /**
   * @generated from protobuf enum value: CONSOLE_ONBOARDED = 7;
   */
  EnterpriseFlagType[(EnterpriseFlagType["CONSOLE_ONBOARDED"] = 7)] = "CONSOLE_ONBOARDED";
  /**
   * @generated from protobuf enum value: FORBID_ACCOUNT_TRANSFER = 8;
   */
  EnterpriseFlagType[(EnterpriseFlagType["FORBID_ACCOUNT_TRANSFER"] = 8)] =
    "FORBID_ACCOUNT_TRANSFER";
  /**
   * @generated from protobuf enum value: NPS_POPUP_OPT_OUT = 9;
   */
  EnterpriseFlagType[(EnterpriseFlagType["NPS_POPUP_OPT_OUT"] = 9)] = "NPS_POPUP_OPT_OUT";
  /**
   * @generated from protobuf enum value: SHOW_USER_ONBOARD = 10;
   */
  EnterpriseFlagType[(EnterpriseFlagType["SHOW_USER_ONBOARD"] = 10)] = "SHOW_USER_ONBOARD";
})(EnterpriseFlagType || (EnterpriseFlagType = {}));
/**
 * @generated from protobuf enum Enterprise.UserUpdateStatus
 */
export var UserUpdateStatus;
(function (UserUpdateStatus) {
  /**
   * @generated from protobuf enum value: USER_UPDATE_OK = 0;
   */
  UserUpdateStatus[(UserUpdateStatus["USER_UPDATE_OK"] = 0)] = "USER_UPDATE_OK";
  /**
   * @generated from protobuf enum value: USER_UPDATE_ACCESS_DENIED = 1;
   */
  UserUpdateStatus[(UserUpdateStatus["USER_UPDATE_ACCESS_DENIED"] = 1)] =
    "USER_UPDATE_ACCESS_DENIED";
})(UserUpdateStatus || (UserUpdateStatus = {}));
/**
 * @generated from protobuf enum Enterprise.AuditUserStatus
 */
export var AuditUserStatus;
(function (AuditUserStatus) {
  /**
   * @generated from protobuf enum value: OK = 0;
   */
  AuditUserStatus[(AuditUserStatus["OK"] = 0)] = "OK";
  /**
   * @generated from protobuf enum value: ACCESS_DENIED = 1;
   */
  AuditUserStatus[(AuditUserStatus["ACCESS_DENIED"] = 1)] = "ACCESS_DENIED";
  /**
   * @generated from protobuf enum value: NO_LONGER_IN_ENTERPRISE = 2;
   */
  AuditUserStatus[(AuditUserStatus["NO_LONGER_IN_ENTERPRISE"] = 2)] = "NO_LONGER_IN_ENTERPRISE";
})(AuditUserStatus || (AuditUserStatus = {}));
/**
 * @generated from protobuf enum Enterprise.TeamUserType
 */
export var TeamUserType;
(function (TeamUserType) {
  /**
   * @generated from protobuf enum value: USER = 0;
   */
  TeamUserType[(TeamUserType["USER"] = 0)] = "USER";
  /**
   * @generated from protobuf enum value: ADMIN = 1;
   */
  TeamUserType[(TeamUserType["ADMIN"] = 1)] = "ADMIN";
  /**
   * @generated from protobuf enum value: ADMIN_ONLY = 2;
   */
  TeamUserType[(TeamUserType["ADMIN_ONLY"] = 2)] = "ADMIN_ONLY";
})(TeamUserType || (TeamUserType = {}));
/**
 * @generated from protobuf enum Enterprise.AppClientType
 */
export var AppClientType;
(function (AppClientType) {
  /**
   * @generated from protobuf enum value: NOT_USED = 0;
   */
  AppClientType[(AppClientType["NOT_USED"] = 0)] = "NOT_USED";
  /**
   * @generated from protobuf enum value: GENERAL = 1;
   */
  AppClientType[(AppClientType["GENERAL"] = 1)] = "GENERAL";
  /**
   * @generated from protobuf enum value: DISCOVERY_AND_ROTATION_CONTROLLER = 2;
   */
  AppClientType[(AppClientType["DISCOVERY_AND_ROTATION_CONTROLLER"] = 2)] =
    "DISCOVERY_AND_ROTATION_CONTROLLER";
  /**
   * @generated from protobuf enum value: KCM_CONTROLLER = 3;
   */
  AppClientType[(AppClientType["KCM_CONTROLLER"] = 3)] = "KCM_CONTROLLER";
  /**
   * @generated from protobuf enum value: SELF_DESTRUCT = 4;
   */
  AppClientType[(AppClientType["SELF_DESTRUCT"] = 4)] = "SELF_DESTRUCT";
})(AppClientType || (AppClientType = {}));
/**
 * @generated from protobuf enum Enterprise.DeleteEnterpriseUsersResult
 */
export var DeleteEnterpriseUsersResult;
(function (DeleteEnterpriseUsersResult) {
  /**
   * @generated from protobuf enum value: SUCCESS = 0;
   */
  DeleteEnterpriseUsersResult[(DeleteEnterpriseUsersResult["SUCCESS"] = 0)] = "SUCCESS";
  /**
   * @generated from protobuf enum value: NOT_AN_ENTERPRISE_USER = 1;
   */
  DeleteEnterpriseUsersResult[(DeleteEnterpriseUsersResult["NOT_AN_ENTERPRISE_USER"] = 1)] =
    "NOT_AN_ENTERPRISE_USER";
  /**
   * @generated from protobuf enum value: CANNOT_DELETE_SELF = 2;
   */
  DeleteEnterpriseUsersResult[(DeleteEnterpriseUsersResult["CANNOT_DELETE_SELF"] = 2)] =
    "CANNOT_DELETE_SELF";
  /**
   * @generated from protobuf enum value: BRIDGE_CANNOT_DELETE_ACTIVE_USER = 3;
   */
  DeleteEnterpriseUsersResult[
    (DeleteEnterpriseUsersResult["BRIDGE_CANNOT_DELETE_ACTIVE_USER"] = 3)
  ] = "BRIDGE_CANNOT_DELETE_ACTIVE_USER";
  /**
   * @generated from protobuf enum value: ERROR = 4;
   */
  DeleteEnterpriseUsersResult[(DeleteEnterpriseUsersResult["ERROR"] = 4)] = "ERROR";
})(DeleteEnterpriseUsersResult || (DeleteEnterpriseUsersResult = {}));
/**
 * @generated from protobuf enum Enterprise.ClearSecurityDataType
 */
export var ClearSecurityDataType;
(function (ClearSecurityDataType) {
  /**
   * @generated from protobuf enum value: RECALCULATE_SUMMARY_REPORT = 0;
   */
  ClearSecurityDataType[(ClearSecurityDataType["RECALCULATE_SUMMARY_REPORT"] = 0)] =
    "RECALCULATE_SUMMARY_REPORT";
  /**
   * @generated from protobuf enum value: FORCE_CLIENT_CHECK_FOR_MISSING_DATA = 1;
   */
  ClearSecurityDataType[(ClearSecurityDataType["FORCE_CLIENT_CHECK_FOR_MISSING_DATA"] = 1)] =
    "FORCE_CLIENT_CHECK_FOR_MISSING_DATA";
  /**
   * @generated from protobuf enum value: FORCE_CLIENT_RESEND_SECURITY_DATA = 2;
   */
  ClearSecurityDataType[(ClearSecurityDataType["FORCE_CLIENT_RESEND_SECURITY_DATA"] = 2)] =
    "FORCE_CLIENT_RESEND_SECURITY_DATA";
})(ClearSecurityDataType || (ClearSecurityDataType = {}));
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseKeyPairRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseKeyPairRequest", [
      { no: 1, name: "enterprisePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedEnterprisePrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "keyType", kind: "enum", T: () => ["Enterprise.KeyType", KeyType] },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterprisePublicKey = new Uint8Array(0);
    message.encryptedEnterprisePrivateKey = new Uint8Array(0);
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
        case /* bytes enterprisePublicKey */ 1:
          message.enterprisePublicKey = reader.bytes();
          break;
        case /* bytes encryptedEnterprisePrivateKey */ 2:
          message.encryptedEnterprisePrivateKey = reader.bytes();
          break;
        case /* Enterprise.KeyType keyType */ 3:
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
    /* bytes enterprisePublicKey = 1; */
    if (message.enterprisePublicKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.enterprisePublicKey);
    /* bytes encryptedEnterprisePrivateKey = 2; */
    if (message.encryptedEnterprisePrivateKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedEnterprisePrivateKey);
    /* Enterprise.KeyType keyType = 3; */
    if (message.keyType !== 0) writer.tag(3, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseKeyPairRequest
 */
export const EnterpriseKeyPairRequest = new EnterpriseKeyPairRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetTeamMemberRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.GetTeamMemberRequest", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
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
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetTeamMemberRequest
 */
export const GetTeamMemberRequest = new GetTeamMemberRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUser$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUser", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "enterpriseUsername", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "isShareAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.email = "";
    message.enterpriseUsername = "";
    message.isShareAdmin = false;
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string email */ 2:
          message.email = reader.string();
          break;
        case /* string enterpriseUsername */ 3:
          message.enterpriseUsername = reader.string();
          break;
        case /* bool isShareAdmin */ 4:
          message.isShareAdmin = reader.bool();
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* string email = 2; */
    if (message.email !== "") writer.tag(2, WireType.LengthDelimited).string(message.email);
    /* string enterpriseUsername = 3; */
    if (message.enterpriseUsername !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.enterpriseUsername);
    /* bool isShareAdmin = 4; */
    if (message.isShareAdmin !== false) writer.tag(4, WireType.Varint).bool(message.isShareAdmin);
    /* string username = 5; */
    if (message.username !== "") writer.tag(5, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUser
 */
export const EnterpriseUser = new EnterpriseUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetTeamMemberResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.GetTeamMemberResponse", [
      {
        no: 1,
        name: "enterpriseUser",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUser,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUser = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.EnterpriseUser enterpriseUser */ 1:
          message.enterpriseUser.push(
            EnterpriseUser.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.EnterpriseUser enterpriseUser = 1; */
    for (let i = 0; i < message.enterpriseUser.length; i++)
      EnterpriseUser.internalBinaryWrite(
        message.enterpriseUser[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetTeamMemberResponse
 */
export const GetTeamMemberResponse = new GetTeamMemberResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserIds$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserIds", [
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
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserIds
 */
export const EnterpriseUserIds = new EnterpriseUserIds$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterprisePersonalAccount$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterprisePersonalAccount", [
      { no: 1, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "OBSOLETE_FIELD",
        kind: "scalar",
        jsonName: "OBSOLETEFIELD",
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.email = "";
    message.oBSOLETEFIELD = new Uint8Array(0);
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
        case /* bytes OBSOLETE_FIELD */ 2:
          message.oBSOLETEFIELD = reader.bytes();
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
    /* bytes OBSOLETE_FIELD = 2; */
    if (message.oBSOLETEFIELD.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.oBSOLETEFIELD);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterprisePersonalAccount
 */
export const EnterprisePersonalAccount = new EnterprisePersonalAccount$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EncryptedTeamKeyRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.EncryptedTeamKeyRequest", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedTeamKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "force", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.encryptedTeamKey = new Uint8Array(0);
    message.force = false;
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
        case /* bytes encryptedTeamKey */ 2:
          message.encryptedTeamKey = reader.bytes();
          break;
        case /* bool force */ 3:
          message.force = reader.bool();
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
    /* bytes encryptedTeamKey = 2; */
    if (message.encryptedTeamKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedTeamKey);
    /* bool force = 3; */
    if (message.force !== false) writer.tag(3, WireType.Varint).bool(message.force);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EncryptedTeamKeyRequest
 */
export const EncryptedTeamKeyRequest = new EncryptedTeamKeyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReEncryptedData$Type extends MessageType {
  constructor() {
    super("Enterprise.ReEncryptedData", [
      { no: 1, name: "id", kind: "scalar", T: 3 /*ScalarType.INT64*/, L: 0 /*LongType.BIGINT*/ },
      { no: 2, name: "data", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.id = 0n;
    message.data = "";
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
        case /* string data */ 2:
          message.data = reader.string();
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
    /* string data = 2; */
    if (message.data !== "") writer.tag(2, WireType.LengthDelimited).string(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ReEncryptedData
 */
export const ReEncryptedData = new ReEncryptedData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReEncryptedRoleKey$Type extends MessageType {
  constructor() {
    super("Enterprise.ReEncryptedRoleKey", [
      {
        no: 1,
        name: "role_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedRoleKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.encryptedRoleKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 role_id */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedRoleKey */ 2:
          message.encryptedRoleKey = reader.bytes();
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
    /* int64 role_id = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* bytes encryptedRoleKey = 2; */
    if (message.encryptedRoleKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedRoleKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ReEncryptedRoleKey
 */
export const ReEncryptedRoleKey = new ReEncryptedRoleKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReEncryptedUserDataKey$Type extends MessageType {
  constructor() {
    super("Enterprise.ReEncryptedUserDataKey", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "userEncryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.userEncryptedDataKey = new Uint8Array(0);
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
        case /* bytes userEncryptedDataKey */ 2:
          message.userEncryptedDataKey = reader.bytes();
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
    /* bytes userEncryptedDataKey = 2; */
    if (message.userEncryptedDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.userEncryptedDataKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ReEncryptedUserDataKey
 */
export const ReEncryptedUserDataKey = new ReEncryptedUserDataKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NodeToManagedCompanyRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.NodeToManagedCompanyRequest", [
      { no: 1, name: "companyId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 2,
        name: "nodes",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedData,
      },
      {
        no: 3,
        name: "roles",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedData,
      },
      {
        no: 4,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedData,
      },
      {
        no: 5,
        name: "roleKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedRoleKey,
      },
      {
        no: 6,
        name: "teamKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EncryptedTeamKeyRequest,
      },
      {
        no: 7,
        name: "usersDataKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedUserDataKey,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.companyId = 0;
    message.nodes = [];
    message.roles = [];
    message.users = [];
    message.roleKeys = [];
    message.teamKeys = [];
    message.usersDataKeys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 companyId */ 1:
          message.companyId = reader.int32();
          break;
        case /* repeated Enterprise.ReEncryptedData nodes */ 2:
          message.nodes.push(ReEncryptedData.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.ReEncryptedData roles */ 3:
          message.roles.push(ReEncryptedData.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.ReEncryptedData users */ 4:
          message.users.push(ReEncryptedData.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.ReEncryptedRoleKey roleKeys */ 5:
          message.roleKeys.push(
            ReEncryptedRoleKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.EncryptedTeamKeyRequest teamKeys */ 6:
          message.teamKeys.push(
            EncryptedTeamKeyRequest.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.ReEncryptedUserDataKey usersDataKeys */ 7:
          message.usersDataKeys.push(
            ReEncryptedUserDataKey.internalBinaryRead(reader, reader.uint32(), options),
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
    /* int32 companyId = 1; */
    if (message.companyId !== 0) writer.tag(1, WireType.Varint).int32(message.companyId);
    /* repeated Enterprise.ReEncryptedData nodes = 2; */
    for (let i = 0; i < message.nodes.length; i++)
      ReEncryptedData.internalBinaryWrite(
        message.nodes[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ReEncryptedData roles = 3; */
    for (let i = 0; i < message.roles.length; i++)
      ReEncryptedData.internalBinaryWrite(
        message.roles[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ReEncryptedData users = 4; */
    for (let i = 0; i < message.users.length; i++)
      ReEncryptedData.internalBinaryWrite(
        message.users[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ReEncryptedRoleKey roleKeys = 5; */
    for (let i = 0; i < message.roleKeys.length; i++)
      ReEncryptedRoleKey.internalBinaryWrite(
        message.roleKeys[i],
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.EncryptedTeamKeyRequest teamKeys = 6; */
    for (let i = 0; i < message.teamKeys.length; i++)
      EncryptedTeamKeyRequest.internalBinaryWrite(
        message.teamKeys[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ReEncryptedUserDataKey usersDataKeys = 7; */
    for (let i = 0; i < message.usersDataKeys.length; i++)
      ReEncryptedUserDataKey.internalBinaryWrite(
        message.usersDataKeys[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.NodeToManagedCompanyRequest
 */
export const NodeToManagedCompanyRequest = new NodeToManagedCompanyRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleTeam$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleTeam", [
      {
        no: 1,
        name: "role_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.teamUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 role_id */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* bytes teamUid */ 2:
          message.teamUid = reader.bytes();
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
    /* int64 role_id = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* bytes teamUid = 2; */
    if (message.teamUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.teamUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleTeam
 */
export const RoleTeam = new RoleTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleTeams$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleTeams", [
      {
        no: 1,
        name: "role_team",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleTeam,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleTeam = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RoleTeam role_team */ 1:
          message.roleTeam.push(RoleTeam.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Enterprise.RoleTeam role_team = 1; */
    for (let i = 0; i < message.roleTeam.length; i++)
      RoleTeam.internalBinaryWrite(
        message.roleTeam[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleTeams
 */
export const RoleTeams = new RoleTeams$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUserAddKeys$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUserAddKeys", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "treeKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "roleAdminKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.treeKey = "";
    message.roleAdminKey = "";
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
        case /* string treeKey */ 2:
          message.treeKey = reader.string();
          break;
        case /* string roleAdminKey */ 3:
          message.roleAdminKey = reader.string();
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
    /* string treeKey = 2; */
    if (message.treeKey !== "") writer.tag(2, WireType.LengthDelimited).string(message.treeKey);
    /* string roleAdminKey = 3; */
    if (message.roleAdminKey !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.roleAdminKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUserAddKeys
 */
export const RoleUserAddKeys = new RoleUserAddKeys$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUserAdd$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUserAdd", [
      {
        no: 1,
        name: "role_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "roleUserAddKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleUserAddKeys,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.roleUserAddKeys = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 role_id */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* repeated Enterprise.RoleUserAddKeys roleUserAddKeys */ 2:
          message.roleUserAddKeys.push(
            RoleUserAddKeys.internalBinaryRead(reader, reader.uint32(), options),
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
    /* int64 role_id = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* repeated Enterprise.RoleUserAddKeys roleUserAddKeys = 2; */
    for (let i = 0; i < message.roleUserAddKeys.length; i++)
      RoleUserAddKeys.internalBinaryWrite(
        message.roleUserAddKeys[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUserAdd
 */
export const RoleUserAdd = new RoleUserAdd$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUsersAddRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUsersAddRequest", [
      {
        no: 1,
        name: "roleUserAdds",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleUserAdd,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleUserAdds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RoleUserAdd roleUserAdds */ 1:
          message.roleUserAdds.push(
            RoleUserAdd.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.RoleUserAdd roleUserAdds = 1; */
    for (let i = 0; i < message.roleUserAdds.length; i++)
      RoleUserAdd.internalBinaryWrite(
        message.roleUserAdds[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUsersAddRequest
 */
export const RoleUsersAddRequest = new RoleUsersAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUserAddResult$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUserAddResult", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "status",
        kind: "enum",
        T: () => ["Enterprise.RoleUserModifyStatus", RoleUserModifyStatus],
      },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.enterpriseUserId = 0n;
    message.status = 0;
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
        case /* int64 roleId */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* Enterprise.RoleUserModifyStatus status */ 3:
          message.status = reader.int32();
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
    /* int64 roleId = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    /* Enterprise.RoleUserModifyStatus status = 3; */
    if (message.status !== 0) writer.tag(3, WireType.Varint).int32(message.status);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUserAddResult
 */
export const RoleUserAddResult = new RoleUserAddResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUsersAddResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUsersAddResponse", [
      {
        no: 1,
        name: "results",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleUserAddResult,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.results = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RoleUserAddResult results */ 1:
          message.results.push(
            RoleUserAddResult.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.RoleUserAddResult results = 1; */
    for (let i = 0; i < message.results.length; i++)
      RoleUserAddResult.internalBinaryWrite(
        message.results[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUsersAddResponse
 */
export const RoleUsersAddResponse = new RoleUsersAddResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUserRemove$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUserRemove", [
      {
        no: 1,
        name: "role_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.enterpriseUserIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 role_id */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* repeated int64 enterpriseUserIds */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
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
    /* int64 role_id = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* repeated int64 enterpriseUserIds = 2; */
    if (message.enterpriseUserIds.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUserRemove
 */
export const RoleUserRemove = new RoleUserRemove$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUsersRemoveRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUsersRemoveRequest", [
      {
        no: 1,
        name: "roleUserRemoves",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleUserRemove,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleUserRemoves = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RoleUserRemove roleUserRemoves */ 1:
          message.roleUserRemoves.push(
            RoleUserRemove.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.RoleUserRemove roleUserRemoves = 1; */
    for (let i = 0; i < message.roleUserRemoves.length; i++)
      RoleUserRemove.internalBinaryWrite(
        message.roleUserRemoves[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUsersRemoveRequest
 */
export const RoleUsersRemoveRequest = new RoleUsersRemoveRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUserRemoveResult$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUserRemoveResult", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "status",
        kind: "enum",
        T: () => ["Enterprise.RoleUserModifyStatus", RoleUserModifyStatus],
      },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.enterpriseUserId = 0n;
    message.status = 0;
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
        case /* int64 roleId */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* Enterprise.RoleUserModifyStatus status */ 3:
          message.status = reader.int32();
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
    /* int64 roleId = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    /* Enterprise.RoleUserModifyStatus status = 3; */
    if (message.status !== 0) writer.tag(3, WireType.Varint).int32(message.status);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUserRemoveResult
 */
export const RoleUserRemoveResult = new RoleUserRemoveResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUsersRemoveResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUsersRemoveResponse", [
      {
        no: 1,
        name: "results",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleUserRemoveResult,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.results = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RoleUserRemoveResult results */ 1:
          message.results.push(
            RoleUserRemoveResult.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.RoleUserRemoveResult results = 1; */
    for (let i = 0; i < message.results.length; i++)
      RoleUserRemoveResult.internalBinaryWrite(
        message.results[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUsersRemoveResponse
 */
export const RoleUsersRemoveResponse = new RoleUsersRemoveResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseRegistration$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseRegistration", [
      { no: 1, name: "encryptedTreeKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "enterpriseName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "rootNodeData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "adminUserData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "adminName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "roleData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "rsaKeyPair", kind: "message", T: () => EnterpriseKeyPairRequest },
      { no: 8, name: "numberSeats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 9,
        name: "enterpriseType",
        kind: "enum",
        T: () => ["Enterprise.EnterpriseType", EnterpriseType],
      },
      { no: 10, name: "rolePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 11,
        name: "rolePrivateKeyEncryptedWithRoleKey",
        kind: "scalar",
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 12, name: "roleKeyEncryptedWithTreeKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 13, name: "eccKeyPair", kind: "message", T: () => EnterpriseKeyPairRequest },
      { no: 14, name: "allUsersRoleData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 15,
        name: "roleKeyEncryptedWithUserPublicKey",
        kind: "scalar",
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 16, name: "approverRoleData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedTreeKey = new Uint8Array(0);
    message.enterpriseName = "";
    message.rootNodeData = new Uint8Array(0);
    message.adminUserData = new Uint8Array(0);
    message.adminName = "";
    message.roleData = new Uint8Array(0);
    message.numberSeats = 0;
    message.enterpriseType = 0;
    message.rolePublicKey = new Uint8Array(0);
    message.rolePrivateKeyEncryptedWithRoleKey = new Uint8Array(0);
    message.roleKeyEncryptedWithTreeKey = new Uint8Array(0);
    message.allUsersRoleData = new Uint8Array(0);
    message.roleKeyEncryptedWithUserPublicKey = new Uint8Array(0);
    message.approverRoleData = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptedTreeKey */ 1:
          message.encryptedTreeKey = reader.bytes();
          break;
        case /* string enterpriseName */ 2:
          message.enterpriseName = reader.string();
          break;
        case /* bytes rootNodeData */ 3:
          message.rootNodeData = reader.bytes();
          break;
        case /* bytes adminUserData */ 4:
          message.adminUserData = reader.bytes();
          break;
        case /* string adminName */ 5:
          message.adminName = reader.string();
          break;
        case /* bytes roleData */ 6:
          message.roleData = reader.bytes();
          break;
        case /* Enterprise.EnterpriseKeyPairRequest rsaKeyPair */ 7:
          message.rsaKeyPair = EnterpriseKeyPairRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.rsaKeyPair,
          );
          break;
        case /* int32 numberSeats */ 8:
          message.numberSeats = reader.int32();
          break;
        case /* Enterprise.EnterpriseType enterpriseType */ 9:
          message.enterpriseType = reader.int32();
          break;
        case /* bytes rolePublicKey */ 10:
          message.rolePublicKey = reader.bytes();
          break;
        case /* bytes rolePrivateKeyEncryptedWithRoleKey */ 11:
          message.rolePrivateKeyEncryptedWithRoleKey = reader.bytes();
          break;
        case /* bytes roleKeyEncryptedWithTreeKey */ 12:
          message.roleKeyEncryptedWithTreeKey = reader.bytes();
          break;
        case /* Enterprise.EnterpriseKeyPairRequest eccKeyPair */ 13:
          message.eccKeyPair = EnterpriseKeyPairRequest.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.eccKeyPair,
          );
          break;
        case /* bytes allUsersRoleData */ 14:
          message.allUsersRoleData = reader.bytes();
          break;
        case /* bytes roleKeyEncryptedWithUserPublicKey */ 15:
          message.roleKeyEncryptedWithUserPublicKey = reader.bytes();
          break;
        case /* bytes approverRoleData */ 16:
          message.approverRoleData = reader.bytes();
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
    /* bytes encryptedTreeKey = 1; */
    if (message.encryptedTreeKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptedTreeKey);
    /* string enterpriseName = 2; */
    if (message.enterpriseName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enterpriseName);
    /* bytes rootNodeData = 3; */
    if (message.rootNodeData.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.rootNodeData);
    /* bytes adminUserData = 4; */
    if (message.adminUserData.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.adminUserData);
    /* string adminName = 5; */
    if (message.adminName !== "") writer.tag(5, WireType.LengthDelimited).string(message.adminName);
    /* bytes roleData = 6; */
    if (message.roleData.length) writer.tag(6, WireType.LengthDelimited).bytes(message.roleData);
    /* Enterprise.EnterpriseKeyPairRequest rsaKeyPair = 7; */
    if (message.rsaKeyPair)
      EnterpriseKeyPairRequest.internalBinaryWrite(
        message.rsaKeyPair,
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int32 numberSeats = 8; */
    if (message.numberSeats !== 0) writer.tag(8, WireType.Varint).int32(message.numberSeats);
    /* Enterprise.EnterpriseType enterpriseType = 9; */
    if (message.enterpriseType !== 0) writer.tag(9, WireType.Varint).int32(message.enterpriseType);
    /* bytes rolePublicKey = 10; */
    if (message.rolePublicKey.length)
      writer.tag(10, WireType.LengthDelimited).bytes(message.rolePublicKey);
    /* bytes rolePrivateKeyEncryptedWithRoleKey = 11; */
    if (message.rolePrivateKeyEncryptedWithRoleKey.length)
      writer.tag(11, WireType.LengthDelimited).bytes(message.rolePrivateKeyEncryptedWithRoleKey);
    /* bytes roleKeyEncryptedWithTreeKey = 12; */
    if (message.roleKeyEncryptedWithTreeKey.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.roleKeyEncryptedWithTreeKey);
    /* Enterprise.EnterpriseKeyPairRequest eccKeyPair = 13; */
    if (message.eccKeyPair)
      EnterpriseKeyPairRequest.internalBinaryWrite(
        message.eccKeyPair,
        writer.tag(13, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes allUsersRoleData = 14; */
    if (message.allUsersRoleData.length)
      writer.tag(14, WireType.LengthDelimited).bytes(message.allUsersRoleData);
    /* bytes roleKeyEncryptedWithUserPublicKey = 15; */
    if (message.roleKeyEncryptedWithUserPublicKey.length)
      writer.tag(15, WireType.LengthDelimited).bytes(message.roleKeyEncryptedWithUserPublicKey);
    /* bytes approverRoleData = 16; */
    if (message.approverRoleData.length)
      writer.tag(16, WireType.LengthDelimited).bytes(message.approverRoleData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseRegistration
 */
export const EnterpriseRegistration = new EnterpriseRegistration$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainPasswordRulesRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainPasswordRulesRequest", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
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
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* string verificationCode = 2; */
    if (message.verificationCode !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.verificationCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainPasswordRulesRequest
 */
export const DomainPasswordRulesRequest = new DomainPasswordRulesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainPasswordRulesFields$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainPasswordRulesFields", [
      { no: 1, name: "type", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "minimum", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "maximum", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "allowed", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = "";
    message.minimum = 0;
    message.maximum = 0;
    message.allowed = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string type */ 1:
          message.type = reader.string();
          break;
        case /* int32 minimum */ 2:
          message.minimum = reader.int32();
          break;
        case /* int32 maximum */ 3:
          message.maximum = reader.int32();
          break;
        case /* bool allowed */ 4:
          message.allowed = reader.bool();
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
    /* string type = 1; */
    if (message.type !== "") writer.tag(1, WireType.LengthDelimited).string(message.type);
    /* int32 minimum = 2; */
    if (message.minimum !== 0) writer.tag(2, WireType.Varint).int32(message.minimum);
    /* int32 maximum = 3; */
    if (message.maximum !== 0) writer.tag(3, WireType.Varint).int32(message.maximum);
    /* bool allowed = 4; */
    if (message.allowed !== false) writer.tag(4, WireType.Varint).bool(message.allowed);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainPasswordRulesFields
 */
export const DomainPasswordRulesFields = new DomainPasswordRulesFields$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginToMcRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.LoginToMcRequest", [
      { no: 1, name: "mcEnterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.mcEnterpriseId = 0;
    message.messageSessionUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 mcEnterpriseId */ 1:
          message.mcEnterpriseId = reader.int32();
          break;
        case /* bytes messageSessionUid */ 2:
          message.messageSessionUid = reader.bytes();
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
    /* int32 mcEnterpriseId = 1; */
    if (message.mcEnterpriseId !== 0) writer.tag(1, WireType.Varint).int32(message.mcEnterpriseId);
    /* bytes messageSessionUid = 2; */
    if (message.messageSessionUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.messageSessionUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.LoginToMcRequest
 */
export const LoginToMcRequest = new LoginToMcRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LoginToMcResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.LoginToMcResponse", [
      { no: 1, name: "encryptedSessionToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedTreeKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedSessionToken = new Uint8Array(0);
    message.encryptedTreeKey = "";
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
        case /* string encryptedTreeKey */ 2:
          message.encryptedTreeKey = reader.string();
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
    /* string encryptedTreeKey = 2; */
    if (message.encryptedTreeKey !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.encryptedTreeKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.LoginToMcResponse
 */
export const LoginToMcResponse = new LoginToMcResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainPasswordRulesResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainPasswordRulesResponse", [
      {
        no: 1,
        name: "domainPasswordRulesFields",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DomainPasswordRulesFields,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.domainPasswordRulesFields = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.DomainPasswordRulesFields domainPasswordRulesFields */ 1:
          message.domainPasswordRulesFields.push(
            DomainPasswordRulesFields.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.DomainPasswordRulesFields domainPasswordRulesFields = 1; */
    for (let i = 0; i < message.domainPasswordRulesFields.length; i++)
      DomainPasswordRulesFields.internalBinaryWrite(
        message.domainPasswordRulesFields[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainPasswordRulesResponse
 */
export const DomainPasswordRulesResponse = new DomainPasswordRulesResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApproveUserDeviceRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ApproveUserDeviceRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "encryptedDeviceDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "denyApproval", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.encryptedDeviceToken = new Uint8Array(0);
    message.encryptedDeviceDataKey = new Uint8Array(0);
    message.denyApproval = false;
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
        case /* bytes encryptedDeviceToken */ 2:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes encryptedDeviceDataKey */ 3:
          message.encryptedDeviceDataKey = reader.bytes();
          break;
        case /* bool denyApproval */ 4:
          message.denyApproval = reader.bool();
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
    /* bytes encryptedDeviceToken = 2; */
    if (message.encryptedDeviceToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes encryptedDeviceDataKey = 3; */
    if (message.encryptedDeviceDataKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedDeviceDataKey);
    /* bool denyApproval = 4; */
    if (message.denyApproval !== false) writer.tag(4, WireType.Varint).bool(message.denyApproval);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ApproveUserDeviceRequest
 */
export const ApproveUserDeviceRequest = new ApproveUserDeviceRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApproveUserDeviceResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.ApproveUserDeviceResponse", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "failed", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.encryptedDeviceToken = new Uint8Array(0);
    message.failed = false;
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedDeviceToken */ 2:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bool failed */ 3:
          message.failed = reader.bool();
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes encryptedDeviceToken = 2; */
    if (message.encryptedDeviceToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bool failed = 3; */
    if (message.failed !== false) writer.tag(3, WireType.Varint).bool(message.failed);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ApproveUserDeviceResponse
 */
export const ApproveUserDeviceResponse = new ApproveUserDeviceResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApproveUserDevicesRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ApproveUserDevicesRequest", [
      {
        no: 1,
        name: "deviceRequests",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ApproveUserDeviceRequest,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceRequests = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.ApproveUserDeviceRequest deviceRequests */ 1:
          message.deviceRequests.push(
            ApproveUserDeviceRequest.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.ApproveUserDeviceRequest deviceRequests = 1; */
    for (let i = 0; i < message.deviceRequests.length; i++)
      ApproveUserDeviceRequest.internalBinaryWrite(
        message.deviceRequests[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ApproveUserDevicesRequest
 */
export const ApproveUserDevicesRequest = new ApproveUserDevicesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApproveUserDevicesResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.ApproveUserDevicesResponse", [
      {
        no: 1,
        name: "deviceResponses",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ApproveUserDeviceResponse,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceResponses = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.ApproveUserDeviceResponse deviceResponses */ 1:
          message.deviceResponses.push(
            ApproveUserDeviceResponse.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.ApproveUserDeviceResponse deviceResponses = 1; */
    for (let i = 0; i < message.deviceResponses.length; i++)
      ApproveUserDeviceResponse.internalBinaryWrite(
        message.deviceResponses[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ApproveUserDevicesResponse
 */
export const ApproveUserDevicesResponse = new ApproveUserDevicesResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserDataKey$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserDataKey", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "userEncryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "keyTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "roleKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "privateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.userEncryptedDataKey = new Uint8Array(0);
    message.keyTypeId = 0;
    message.roleKey = new Uint8Array(0);
    message.privateKey = new Uint8Array(0);
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
        case /* bytes userEncryptedDataKey */ 2:
          message.userEncryptedDataKey = reader.bytes();
          break;
        case /* int32 keyTypeId */ 3:
          message.keyTypeId = reader.int32();
          break;
        case /* bytes roleKey */ 4:
          message.roleKey = reader.bytes();
          break;
        case /* bytes privateKey */ 5:
          message.privateKey = reader.bytes();
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
    /* bytes userEncryptedDataKey = 2; */
    if (message.userEncryptedDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.userEncryptedDataKey);
    /* int32 keyTypeId = 3; */
    if (message.keyTypeId !== 0) writer.tag(3, WireType.Varint).int32(message.keyTypeId);
    /* bytes roleKey = 4; */
    if (message.roleKey.length) writer.tag(4, WireType.LengthDelimited).bytes(message.roleKey);
    /* bytes privateKey = 5; */
    if (message.privateKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.privateKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserDataKey
 */
export const EnterpriseUserDataKey = new EnterpriseUserDataKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserDataKeys$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserDataKeys", [
      {
        no: 1,
        name: "keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserDataKey,
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
        case /* repeated Enterprise.EnterpriseUserDataKey keys */ 1:
          message.keys.push(
            EnterpriseUserDataKey.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.EnterpriseUserDataKey keys = 1; */
    for (let i = 0; i < message.keys.length; i++)
      EnterpriseUserDataKey.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserDataKeys
 */
export const EnterpriseUserDataKeys = new EnterpriseUserDataKeys$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserDataKeyLight$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserDataKeyLight", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "userEncryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "keyTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.userEncryptedDataKey = new Uint8Array(0);
    message.keyTypeId = 0;
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
        case /* bytes userEncryptedDataKey */ 2:
          message.userEncryptedDataKey = reader.bytes();
          break;
        case /* int32 keyTypeId */ 3:
          message.keyTypeId = reader.int32();
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
    /* bytes userEncryptedDataKey = 2; */
    if (message.userEncryptedDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.userEncryptedDataKey);
    /* int32 keyTypeId = 3; */
    if (message.keyTypeId !== 0) writer.tag(3, WireType.Varint).int32(message.keyTypeId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserDataKeyLight
 */
export const EnterpriseUserDataKeyLight = new EnterpriseUserDataKeyLight$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserDataKeysByNode$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserDataKeysByNode", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserDataKeyLight,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
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
        case /* int64 nodeId */ 1:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* repeated Enterprise.EnterpriseUserDataKeyLight keys */ 2:
          message.keys.push(
            EnterpriseUserDataKeyLight.internalBinaryRead(reader, reader.uint32(), options),
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
    /* int64 nodeId = 1; */
    if (message.nodeId !== 0n) writer.tag(1, WireType.Varint).int64(message.nodeId);
    /* repeated Enterprise.EnterpriseUserDataKeyLight keys = 2; */
    for (let i = 0; i < message.keys.length; i++)
      EnterpriseUserDataKeyLight.internalBinaryWrite(
        message.keys[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserDataKeysByNode
 */
export const EnterpriseUserDataKeysByNode = new EnterpriseUserDataKeysByNode$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUserDataKeysByNodeResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUserDataKeysByNodeResponse", [
      {
        no: 1,
        name: "keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUserDataKeysByNode,
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
        case /* repeated Enterprise.EnterpriseUserDataKeysByNode keys */ 1:
          message.keys.push(
            EnterpriseUserDataKeysByNode.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.EnterpriseUserDataKeysByNode keys = 1; */
    for (let i = 0; i < message.keys.length; i++)
      EnterpriseUserDataKeysByNode.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Enterprise.EnterpriseUserDataKeysByNodeResponse
 */
export const EnterpriseUserDataKeysByNodeResponse = new EnterpriseUserDataKeysByNodeResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseDataRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseDataRequest", [
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
 * @generated MessageType for protobuf message Enterprise.EnterpriseDataRequest
 */
export const EnterpriseDataRequest = new EnterpriseDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SpecialProvisioning$Type extends MessageType {
  constructor() {
    super("Enterprise.SpecialProvisioning", [
      { no: 1, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.url = "";
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
        case /* string url */ 1:
          message.url = reader.string();
          break;
        case /* string name */ 2:
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
    /* string url = 1; */
    if (message.url !== "") writer.tag(1, WireType.LengthDelimited).string(message.url);
    /* string name = 2; */
    if (message.name !== "") writer.tag(2, WireType.LengthDelimited).string(message.name);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SpecialProvisioning
 */
export const SpecialProvisioning = new SpecialProvisioning$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GeneralDataEntity$Type extends MessageType {
  constructor() {
    super("Enterprise.GeneralDataEntity", [
      { no: 1, name: "enterpriseName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "restrictVisibility", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "specialProvisioning", kind: "message", T: () => SpecialProvisioning },
      { no: 7, name: "userPrivilege", kind: "message", T: () => UserPrivilege },
      { no: 8, name: "distributor", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 9, name: "forbidAccountTransfer", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 10, name: "showUserOnboard", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseName = "";
    message.restrictVisibility = false;
    message.distributor = false;
    message.forbidAccountTransfer = false;
    message.showUserOnboard = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string enterpriseName */ 1:
          message.enterpriseName = reader.string();
          break;
        case /* bool restrictVisibility */ 2:
          message.restrictVisibility = reader.bool();
          break;
        case /* Enterprise.SpecialProvisioning specialProvisioning */ 4:
          message.specialProvisioning = SpecialProvisioning.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.specialProvisioning,
          );
          break;
        case /* Enterprise.UserPrivilege userPrivilege */ 7:
          message.userPrivilege = UserPrivilege.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.userPrivilege,
          );
          break;
        case /* bool distributor */ 8:
          message.distributor = reader.bool();
          break;
        case /* bool forbidAccountTransfer */ 9:
          message.forbidAccountTransfer = reader.bool();
          break;
        case /* bool showUserOnboard */ 10:
          message.showUserOnboard = reader.bool();
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
    /* string enterpriseName = 1; */
    if (message.enterpriseName !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.enterpriseName);
    /* bool restrictVisibility = 2; */
    if (message.restrictVisibility !== false)
      writer.tag(2, WireType.Varint).bool(message.restrictVisibility);
    /* Enterprise.SpecialProvisioning specialProvisioning = 4; */
    if (message.specialProvisioning)
      SpecialProvisioning.internalBinaryWrite(
        message.specialProvisioning,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.UserPrivilege userPrivilege = 7; */
    if (message.userPrivilege)
      UserPrivilege.internalBinaryWrite(
        message.userPrivilege,
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool distributor = 8; */
    if (message.distributor !== false) writer.tag(8, WireType.Varint).bool(message.distributor);
    /* bool forbidAccountTransfer = 9; */
    if (message.forbidAccountTransfer !== false)
      writer.tag(9, WireType.Varint).bool(message.forbidAccountTransfer);
    /* bool showUserOnboard = 10; */
    if (message.showUserOnboard !== false)
      writer.tag(10, WireType.Varint).bool(message.showUserOnboard);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GeneralDataEntity
 */
export const GeneralDataEntity = new GeneralDataEntity$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Node$Type extends MessageType {
  constructor() {
    super("Enterprise.Node", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "parentId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "bridgeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "scimId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "licenseId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "duoEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "rsaEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 9,
        name: "ssoServiceProviderId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 10, name: "restrictVisibility", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 11,
        name: "ssoServiceProviderIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
    message.parentId = 0n;
    message.bridgeId = 0n;
    message.scimId = 0n;
    message.licenseId = 0n;
    message.encryptedData = "";
    message.duoEnabled = false;
    message.rsaEnabled = false;
    message.ssoServiceProviderId = 0n;
    message.restrictVisibility = false;
    message.ssoServiceProviderIds = [];
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
        case /* int64 parentId */ 2:
          message.parentId = reader.int64().toBigInt();
          break;
        case /* int64 bridgeId */ 3:
          message.bridgeId = reader.int64().toBigInt();
          break;
        case /* int64 scimId */ 4:
          message.scimId = reader.int64().toBigInt();
          break;
        case /* int64 licenseId */ 5:
          message.licenseId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 6:
          message.encryptedData = reader.string();
          break;
        case /* bool duoEnabled */ 7:
          message.duoEnabled = reader.bool();
          break;
        case /* bool rsaEnabled */ 8:
          message.rsaEnabled = reader.bool();
          break;
        case /* int64 ssoServiceProviderId */ 9:
          message.ssoServiceProviderId = reader.int64().toBigInt();
          break;
        case /* bool restrictVisibility */ 10:
          message.restrictVisibility = reader.bool();
          break;
        case /* repeated int64 ssoServiceProviderIds */ 11:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.ssoServiceProviderIds.push(reader.int64().toBigInt());
          else message.ssoServiceProviderIds.push(reader.int64().toBigInt());
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
    /* int64 parentId = 2; */
    if (message.parentId !== 0n) writer.tag(2, WireType.Varint).int64(message.parentId);
    /* int64 bridgeId = 3; */
    if (message.bridgeId !== 0n) writer.tag(3, WireType.Varint).int64(message.bridgeId);
    /* int64 scimId = 4; */
    if (message.scimId !== 0n) writer.tag(4, WireType.Varint).int64(message.scimId);
    /* int64 licenseId = 5; */
    if (message.licenseId !== 0n) writer.tag(5, WireType.Varint).int64(message.licenseId);
    /* string encryptedData = 6; */
    if (message.encryptedData !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.encryptedData);
    /* bool duoEnabled = 7; */
    if (message.duoEnabled !== false) writer.tag(7, WireType.Varint).bool(message.duoEnabled);
    /* bool rsaEnabled = 8; */
    if (message.rsaEnabled !== false) writer.tag(8, WireType.Varint).bool(message.rsaEnabled);
    /* int64 ssoServiceProviderId = 9; */
    if (message.ssoServiceProviderId !== 0n)
      writer.tag(9, WireType.Varint).int64(message.ssoServiceProviderId);
    /* bool restrictVisibility = 10; */
    if (message.restrictVisibility !== false)
      writer.tag(10, WireType.Varint).bool(message.restrictVisibility);
    /* repeated int64 ssoServiceProviderIds = 11; */
    if (message.ssoServiceProviderIds.length) {
      writer.tag(11, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.ssoServiceProviderIds.length; i++)
        writer.int64(message.ssoServiceProviderIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Node
 */
export const Node = new Node$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Role$Type extends MessageType {
  constructor() {
    super("Enterprise.Role", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "keyType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "visibleBelow", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "newUserInherit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "roleType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.nodeId = 0n;
    message.encryptedData = "";
    message.keyType = "";
    message.visibleBelow = false;
    message.newUserInherit = false;
    message.roleType = "";
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
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 3:
          message.encryptedData = reader.string();
          break;
        case /* string keyType */ 4:
          message.keyType = reader.string();
          break;
        case /* bool visibleBelow */ 5:
          message.visibleBelow = reader.bool();
          break;
        case /* bool newUserInherit */ 6:
          message.newUserInherit = reader.bool();
          break;
        case /* string roleType */ 7:
          message.roleType = reader.string();
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
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string encryptedData = 3; */
    if (message.encryptedData !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.encryptedData);
    /* string keyType = 4; */
    if (message.keyType !== "") writer.tag(4, WireType.LengthDelimited).string(message.keyType);
    /* bool visibleBelow = 5; */
    if (message.visibleBelow !== false) writer.tag(5, WireType.Varint).bool(message.visibleBelow);
    /* bool newUserInherit = 6; */
    if (message.newUserInherit !== false)
      writer.tag(6, WireType.Varint).bool(message.newUserInherit);
    /* string roleType = 7; */
    if (message.roleType !== "") writer.tag(7, WireType.LengthDelimited).string(message.roleType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Role
 */
export const Role = new Role$Type();
// @generated message type with reflection information, may provide speed optimized methods
class User$Type extends MessageType {
  constructor() {
    super("Enterprise.User", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "keyType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "lock", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 8, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 9,
        name: "accountShareExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 10, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 11, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 12, name: "tfaEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 13,
        name: "transferAcceptanceStatus",
        kind: "enum",
        T: () => ["Enterprise.TransferAcceptanceStatus", TransferAcceptanceStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.nodeId = 0n;
    message.encryptedData = "";
    message.keyType = "";
    message.username = "";
    message.status = "";
    message.lock = 0;
    message.userId = 0;
    message.accountShareExpiration = 0n;
    message.fullName = "";
    message.jobTitle = "";
    message.tfaEnabled = false;
    message.transferAcceptanceStatus = 0;
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
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 3:
          message.encryptedData = reader.string();
          break;
        case /* string keyType */ 4:
          message.keyType = reader.string();
          break;
        case /* string username */ 5:
          message.username = reader.string();
          break;
        case /* string status */ 6:
          message.status = reader.string();
          break;
        case /* int32 lock */ 7:
          message.lock = reader.int32();
          break;
        case /* int32 userId */ 8:
          message.userId = reader.int32();
          break;
        case /* int64 accountShareExpiration */ 9:
          message.accountShareExpiration = reader.int64().toBigInt();
          break;
        case /* string fullName */ 10:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 11:
          message.jobTitle = reader.string();
          break;
        case /* bool tfaEnabled */ 12:
          message.tfaEnabled = reader.bool();
          break;
        case /* Enterprise.TransferAcceptanceStatus transferAcceptanceStatus */ 13:
          message.transferAcceptanceStatus = reader.int32();
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
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string encryptedData = 3; */
    if (message.encryptedData !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.encryptedData);
    /* string keyType = 4; */
    if (message.keyType !== "") writer.tag(4, WireType.LengthDelimited).string(message.keyType);
    /* string username = 5; */
    if (message.username !== "") writer.tag(5, WireType.LengthDelimited).string(message.username);
    /* string status = 6; */
    if (message.status !== "") writer.tag(6, WireType.LengthDelimited).string(message.status);
    /* int32 lock = 7; */
    if (message.lock !== 0) writer.tag(7, WireType.Varint).int32(message.lock);
    /* int32 userId = 8; */
    if (message.userId !== 0) writer.tag(8, WireType.Varint).int32(message.userId);
    /* int64 accountShareExpiration = 9; */
    if (message.accountShareExpiration !== 0n)
      writer.tag(9, WireType.Varint).int64(message.accountShareExpiration);
    /* string fullName = 10; */
    if (message.fullName !== "") writer.tag(10, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 11; */
    if (message.jobTitle !== "") writer.tag(11, WireType.LengthDelimited).string(message.jobTitle);
    /* bool tfaEnabled = 12; */
    if (message.tfaEnabled !== false) writer.tag(12, WireType.Varint).bool(message.tfaEnabled);
    /* Enterprise.TransferAcceptanceStatus transferAcceptanceStatus = 13; */
    if (message.transferAcceptanceStatus !== 0)
      writer.tag(13, WireType.Varint).int32(message.transferAcceptanceStatus);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.User
 */
export const User = new User$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserAlias$Type extends MessageType {
  constructor() {
    super("Enterprise.UserAlias", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string username */ 2:
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserAlias
 */
export const UserAlias = new UserAlias$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportMetaData$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportMetaData", [
      { no: 1, name: "reportUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "reportName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "dateGenerated",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "runByName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "numberOfOwners", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 8, name: "numberOfRecords", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reportUid = new Uint8Array(0);
    message.nodeId = 0n;
    message.reportName = "";
    message.dateGenerated = 0n;
    message.runByName = "";
    message.numberOfOwners = 0;
    message.numberOfRecords = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes reportUid */ 1:
          message.reportUid = reader.bytes();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string reportName */ 3:
          message.reportName = reader.string();
          break;
        case /* int64 dateGenerated */ 4:
          message.dateGenerated = reader.int64().toBigInt();
          break;
        case /* string runByName */ 5:
          message.runByName = reader.string();
          break;
        case /* int32 numberOfOwners */ 7:
          message.numberOfOwners = reader.int32();
          break;
        case /* int32 numberOfRecords */ 8:
          message.numberOfRecords = reader.int32();
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
    /* bytes reportUid = 1; */
    if (message.reportUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.reportUid);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string reportName = 3; */
    if (message.reportName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.reportName);
    /* int64 dateGenerated = 4; */
    if (message.dateGenerated !== 0n) writer.tag(4, WireType.Varint).int64(message.dateGenerated);
    /* string runByName = 5; */
    if (message.runByName !== "") writer.tag(5, WireType.LengthDelimited).string(message.runByName);
    /* int32 numberOfOwners = 7; */
    if (message.numberOfOwners !== 0) writer.tag(7, WireType.Varint).int32(message.numberOfOwners);
    /* int32 numberOfRecords = 8; */
    if (message.numberOfRecords !== 0)
      writer.tag(8, WireType.Varint).int32(message.numberOfRecords);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportMetaData
 */
export const ComplianceReportMetaData = new ComplianceReportMetaData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ManagedNode$Type extends MessageType {
  constructor() {
    super("Enterprise.ManagedNode", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "managedNodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "cascadeNodeManagement", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.managedNodeId = 0n;
    message.cascadeNodeManagement = false;
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
        case /* int64 managedNodeId */ 2:
          message.managedNodeId = reader.int64().toBigInt();
          break;
        case /* bool cascadeNodeManagement */ 3:
          message.cascadeNodeManagement = reader.bool();
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
    /* int64 managedNodeId = 2; */
    if (message.managedNodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.managedNodeId);
    /* bool cascadeNodeManagement = 3; */
    if (message.cascadeNodeManagement !== false)
      writer.tag(3, WireType.Varint).bool(message.cascadeNodeManagement);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ManagedNode
 */
export const ManagedNode = new ManagedNode$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserManagedNode$Type extends MessageType {
  constructor() {
    super("Enterprise.UserManagedNode", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "cascadeNodeManagement", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 3,
        name: "privileges",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
    message.cascadeNodeManagement = false;
    message.privileges = [];
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
        case /* bool cascadeNodeManagement */ 2:
          message.cascadeNodeManagement = reader.bool();
          break;
        case /* repeated string privileges */ 3:
          message.privileges.push(reader.string());
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
    /* bool cascadeNodeManagement = 2; */
    if (message.cascadeNodeManagement !== false)
      writer.tag(2, WireType.Varint).bool(message.cascadeNodeManagement);
    /* repeated string privileges = 3; */
    for (let i = 0; i < message.privileges.length; i++)
      writer.tag(3, WireType.LengthDelimited).string(message.privileges[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserManagedNode
 */
export const UserManagedNode = new UserManagedNode$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserPrivilege$Type extends MessageType {
  constructor() {
    super("Enterprise.UserPrivilege", [
      {
        no: 1,
        name: "userManagedNodes",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserManagedNode,
      },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userManagedNodes = [];
    message.enterpriseUserId = 0n;
    message.encryptedData = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.UserManagedNode userManagedNodes */ 1:
          message.userManagedNodes.push(
            UserManagedNode.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 3:
          message.encryptedData = reader.string();
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
    /* repeated Enterprise.UserManagedNode userManagedNodes = 1; */
    for (let i = 0; i < message.userManagedNodes.length; i++)
      UserManagedNode.internalBinaryWrite(
        message.userManagedNodes[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    /* string encryptedData = 3; */
    if (message.encryptedData !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.encryptedData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserPrivilege
 */
export const UserPrivilege = new UserPrivilege$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleUser$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleUser", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.enterpriseUserId = 0n;
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
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
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
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleUser
 */
export const RoleUser = new RoleUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RolePrivilege$Type extends MessageType {
  constructor() {
    super("Enterprise.RolePrivilege", [
      {
        no: 1,
        name: "managedNodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "privilegeType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.managedNodeId = 0n;
    message.roleId = 0n;
    message.privilegeType = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 managedNodeId */ 1:
          message.managedNodeId = reader.int64().toBigInt();
          break;
        case /* int64 roleId */ 2:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* string privilegeType */ 3:
          message.privilegeType = reader.string();
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
    /* int64 managedNodeId = 1; */
    if (message.managedNodeId !== 0n) writer.tag(1, WireType.Varint).int64(message.managedNodeId);
    /* int64 roleId = 2; */
    if (message.roleId !== 0n) writer.tag(2, WireType.Varint).int64(message.roleId);
    /* string privilegeType = 3; */
    if (message.privilegeType !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.privilegeType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RolePrivilege
 */
export const RolePrivilege = new RolePrivilege$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleEnforcement$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleEnforcement", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "enforcementType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.enforcementType = "";
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
        case /* int64 roleId */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* string enforcementType */ 2:
          message.enforcementType = reader.string();
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
    /* int64 roleId = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* string enforcementType = 2; */
    if (message.enforcementType !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enforcementType);
    /* string value = 3; */
    if (message.value !== "") writer.tag(3, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleEnforcement
 */
export const RoleEnforcement = new RoleEnforcement$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Team$Type extends MessageType {
  constructor() {
    super("Enterprise.Team", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "restrictEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "restrictShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "restrictView", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "encryptedTeamKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.name = "";
    message.nodeId = 0n;
    message.restrictEdit = false;
    message.restrictShare = false;
    message.restrictView = false;
    message.encryptedData = "";
    message.encryptedTeamKey = "";
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
        case /* string name */ 2:
          message.name = reader.string();
          break;
        case /* int64 nodeId */ 3:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* bool restrictEdit */ 4:
          message.restrictEdit = reader.bool();
          break;
        case /* bool restrictShare */ 5:
          message.restrictShare = reader.bool();
          break;
        case /* bool restrictView */ 6:
          message.restrictView = reader.bool();
          break;
        case /* string encryptedData */ 7:
          message.encryptedData = reader.string();
          break;
        case /* string encryptedTeamKey */ 8:
          message.encryptedTeamKey = reader.string();
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
    /* string name = 2; */
    if (message.name !== "") writer.tag(2, WireType.LengthDelimited).string(message.name);
    /* int64 nodeId = 3; */
    if (message.nodeId !== 0n) writer.tag(3, WireType.Varint).int64(message.nodeId);
    /* bool restrictEdit = 4; */
    if (message.restrictEdit !== false) writer.tag(4, WireType.Varint).bool(message.restrictEdit);
    /* bool restrictShare = 5; */
    if (message.restrictShare !== false) writer.tag(5, WireType.Varint).bool(message.restrictShare);
    /* bool restrictView = 6; */
    if (message.restrictView !== false) writer.tag(6, WireType.Varint).bool(message.restrictView);
    /* string encryptedData = 7; */
    if (message.encryptedData !== "")
      writer.tag(7, WireType.LengthDelimited).string(message.encryptedData);
    /* string encryptedTeamKey = 8; */
    if (message.encryptedTeamKey !== "")
      writer.tag(8, WireType.LengthDelimited).string(message.encryptedTeamKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Team
 */
export const Team = new Team$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamUser$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamUser", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "userType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.enterpriseUserId = 0n;
    message.userType = "";
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
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* string userType */ 3:
          message.userType = reader.string();
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
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    /* string userType = 3; */
    if (message.userType !== "") writer.tag(3, WireType.LengthDelimited).string(message.userType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamUser
 */
export const TeamUser = new TeamUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetDistributorInfoResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.GetDistributorInfoResponse", [
      {
        no: 1,
        name: "distributors",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Distributor,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.distributors = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.Distributor distributors */ 1:
          message.distributors.push(
            Distributor.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.Distributor distributors = 1; */
    for (let i = 0; i < message.distributors.length; i++)
      Distributor.internalBinaryWrite(
        message.distributors[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetDistributorInfoResponse
 */
export const GetDistributorInfoResponse = new GetDistributorInfoResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Distributor$Type extends MessageType {
  constructor() {
    super("Enterprise.Distributor", [
      { no: 1, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "mspInfos",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => MspInfo,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.name = "";
    message.mspInfos = [];
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
        case /* repeated Enterprise.MspInfo mspInfos */ 2:
          message.mspInfos.push(MspInfo.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Enterprise.MspInfo mspInfos = 2; */
    for (let i = 0; i < message.mspInfos.length; i++)
      MspInfo.internalBinaryWrite(
        message.mspInfos[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Distributor
 */
export const Distributor = new Distributor$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MspInfo$Type extends MessageType {
  constructor() {
    super("Enterprise.MspInfo", [
      { no: 1, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "enterpriseName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "allocatedLicenses", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 4,
        name: "allowedMcProducts",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 5,
        name: "allowedAddOns",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 6, name: "maxFilePlanType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 7,
        name: "managedCompanies",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ManagedCompany,
      },
      { no: 8, name: "allowUnlimitedLicenses", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 9,
        name: "addOns",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => LicenseAddOn,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseId = 0;
    message.enterpriseName = "";
    message.allocatedLicenses = 0;
    message.allowedMcProducts = [];
    message.allowedAddOns = [];
    message.maxFilePlanType = "";
    message.managedCompanies = [];
    message.allowUnlimitedLicenses = false;
    message.addOns = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 enterpriseId */ 1:
          message.enterpriseId = reader.int32();
          break;
        case /* string enterpriseName */ 2:
          message.enterpriseName = reader.string();
          break;
        case /* int32 allocatedLicenses */ 3:
          message.allocatedLicenses = reader.int32();
          break;
        case /* repeated string allowedMcProducts */ 4:
          message.allowedMcProducts.push(reader.string());
          break;
        case /* repeated string allowedAddOns */ 5:
          message.allowedAddOns.push(reader.string());
          break;
        case /* string maxFilePlanType */ 6:
          message.maxFilePlanType = reader.string();
          break;
        case /* repeated Enterprise.ManagedCompany managedCompanies */ 7:
          message.managedCompanies.push(
            ManagedCompany.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bool allowUnlimitedLicenses */ 8:
          message.allowUnlimitedLicenses = reader.bool();
          break;
        case /* repeated Enterprise.LicenseAddOn addOns */ 9:
          message.addOns.push(LicenseAddOn.internalBinaryRead(reader, reader.uint32(), options));
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
    /* int32 enterpriseId = 1; */
    if (message.enterpriseId !== 0) writer.tag(1, WireType.Varint).int32(message.enterpriseId);
    /* string enterpriseName = 2; */
    if (message.enterpriseName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enterpriseName);
    /* int32 allocatedLicenses = 3; */
    if (message.allocatedLicenses !== 0)
      writer.tag(3, WireType.Varint).int32(message.allocatedLicenses);
    /* repeated string allowedMcProducts = 4; */
    for (let i = 0; i < message.allowedMcProducts.length; i++)
      writer.tag(4, WireType.LengthDelimited).string(message.allowedMcProducts[i]);
    /* repeated string allowedAddOns = 5; */
    for (let i = 0; i < message.allowedAddOns.length; i++)
      writer.tag(5, WireType.LengthDelimited).string(message.allowedAddOns[i]);
    /* string maxFilePlanType = 6; */
    if (message.maxFilePlanType !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.maxFilePlanType);
    /* repeated Enterprise.ManagedCompany managedCompanies = 7; */
    for (let i = 0; i < message.managedCompanies.length; i++)
      ManagedCompany.internalBinaryWrite(
        message.managedCompanies[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool allowUnlimitedLicenses = 8; */
    if (message.allowUnlimitedLicenses !== false)
      writer.tag(8, WireType.Varint).bool(message.allowUnlimitedLicenses);
    /* repeated Enterprise.LicenseAddOn addOns = 9; */
    for (let i = 0; i < message.addOns.length; i++)
      LicenseAddOn.internalBinaryWrite(
        message.addOns[i],
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MspInfo
 */
export const MspInfo = new MspInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ManagedCompany$Type extends MessageType {
  constructor() {
    super("Enterprise.ManagedCompany", [
      { no: 1, name: "mcEnterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "mcEnterpriseName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "mspNodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "numberOfSeats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "numberOfUsers", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "productId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "isExpired", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "treeKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 9,
        name: "tree_key_role",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 10, name: "filePlanType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 11,
        name: "addOns",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => LicenseAddOn,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.mcEnterpriseId = 0;
    message.mcEnterpriseName = "";
    message.mspNodeId = 0n;
    message.numberOfSeats = 0;
    message.numberOfUsers = 0;
    message.productId = "";
    message.isExpired = false;
    message.treeKey = "";
    message.treeKeyRole = 0n;
    message.filePlanType = "";
    message.addOns = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 mcEnterpriseId */ 1:
          message.mcEnterpriseId = reader.int32();
          break;
        case /* string mcEnterpriseName */ 2:
          message.mcEnterpriseName = reader.string();
          break;
        case /* int64 mspNodeId */ 3:
          message.mspNodeId = reader.int64().toBigInt();
          break;
        case /* int32 numberOfSeats */ 4:
          message.numberOfSeats = reader.int32();
          break;
        case /* int32 numberOfUsers */ 5:
          message.numberOfUsers = reader.int32();
          break;
        case /* string productId */ 6:
          message.productId = reader.string();
          break;
        case /* bool isExpired */ 7:
          message.isExpired = reader.bool();
          break;
        case /* string treeKey */ 8:
          message.treeKey = reader.string();
          break;
        case /* int64 tree_key_role */ 9:
          message.treeKeyRole = reader.int64().toBigInt();
          break;
        case /* string filePlanType */ 10:
          message.filePlanType = reader.string();
          break;
        case /* repeated Enterprise.LicenseAddOn addOns */ 11:
          message.addOns.push(LicenseAddOn.internalBinaryRead(reader, reader.uint32(), options));
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
    /* int32 mcEnterpriseId = 1; */
    if (message.mcEnterpriseId !== 0) writer.tag(1, WireType.Varint).int32(message.mcEnterpriseId);
    /* string mcEnterpriseName = 2; */
    if (message.mcEnterpriseName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.mcEnterpriseName);
    /* int64 mspNodeId = 3; */
    if (message.mspNodeId !== 0n) writer.tag(3, WireType.Varint).int64(message.mspNodeId);
    /* int32 numberOfSeats = 4; */
    if (message.numberOfSeats !== 0) writer.tag(4, WireType.Varint).int32(message.numberOfSeats);
    /* int32 numberOfUsers = 5; */
    if (message.numberOfUsers !== 0) writer.tag(5, WireType.Varint).int32(message.numberOfUsers);
    /* string productId = 6; */
    if (message.productId !== "") writer.tag(6, WireType.LengthDelimited).string(message.productId);
    /* bool isExpired = 7; */
    if (message.isExpired !== false) writer.tag(7, WireType.Varint).bool(message.isExpired);
    /* string treeKey = 8; */
    if (message.treeKey !== "") writer.tag(8, WireType.LengthDelimited).string(message.treeKey);
    /* int64 tree_key_role = 9; */
    if (message.treeKeyRole !== 0n) writer.tag(9, WireType.Varint).int64(message.treeKeyRole);
    /* string filePlanType = 10; */
    if (message.filePlanType !== "")
      writer.tag(10, WireType.LengthDelimited).string(message.filePlanType);
    /* repeated Enterprise.LicenseAddOn addOns = 11; */
    for (let i = 0; i < message.addOns.length; i++)
      LicenseAddOn.internalBinaryWrite(
        message.addOns[i],
        writer.tag(11, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ManagedCompany
 */
export const ManagedCompany = new ManagedCompany$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MSPPool$Type extends MessageType {
  constructor() {
    super("Enterprise.MSPPool", [
      { no: 1, name: "productId", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "seats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "availableSeats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "stash", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.productId = "";
    message.seats = 0;
    message.availableSeats = 0;
    message.stash = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string productId */ 1:
          message.productId = reader.string();
          break;
        case /* int32 seats */ 2:
          message.seats = reader.int32();
          break;
        case /* int32 availableSeats */ 3:
          message.availableSeats = reader.int32();
          break;
        case /* int32 stash */ 4:
          message.stash = reader.int32();
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
    /* string productId = 1; */
    if (message.productId !== "") writer.tag(1, WireType.LengthDelimited).string(message.productId);
    /* int32 seats = 2; */
    if (message.seats !== 0) writer.tag(2, WireType.Varint).int32(message.seats);
    /* int32 availableSeats = 3; */
    if (message.availableSeats !== 0) writer.tag(3, WireType.Varint).int32(message.availableSeats);
    /* int32 stash = 4; */
    if (message.stash !== 0) writer.tag(4, WireType.Varint).int32(message.stash);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MSPPool
 */
export const MSPPool = new MSPPool$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MSPContact$Type extends MessageType {
  constructor() {
    super("Enterprise.MSPContact", [
      { no: 1, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "enterpriseName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseId = 0;
    message.enterpriseName = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 enterpriseId */ 1:
          message.enterpriseId = reader.int32();
          break;
        case /* string enterpriseName */ 2:
          message.enterpriseName = reader.string();
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
    /* int32 enterpriseId = 1; */
    if (message.enterpriseId !== 0) writer.tag(1, WireType.Varint).int32(message.enterpriseId);
    /* string enterpriseName = 2; */
    if (message.enterpriseName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.enterpriseName);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MSPContact
 */
export const MSPContact = new MSPContact$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LicenseAddOn$Type extends MessageType {
  constructor() {
    super("Enterprise.LicenseAddOn", [
      { no: 1, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "enabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "isTrial", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 4,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "created",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "seats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 7,
        name: "activationTime",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 8, name: "includedInProduct", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 9, name: "apiCallCount", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 10, name: "tierDescription", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 11, name: "seatsAllocated", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.name = "";
    message.enabled = false;
    message.isTrial = false;
    message.expiration = 0n;
    message.created = 0n;
    message.seats = 0;
    message.activationTime = 0n;
    message.includedInProduct = false;
    message.apiCallCount = 0;
    message.tierDescription = "";
    message.seatsAllocated = 0;
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
        case /* bool enabled */ 2:
          message.enabled = reader.bool();
          break;
        case /* bool isTrial */ 3:
          message.isTrial = reader.bool();
          break;
        case /* int64 expiration */ 4:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* int64 created */ 5:
          message.created = reader.int64().toBigInt();
          break;
        case /* int32 seats */ 6:
          message.seats = reader.int32();
          break;
        case /* int64 activationTime */ 7:
          message.activationTime = reader.int64().toBigInt();
          break;
        case /* bool includedInProduct */ 8:
          message.includedInProduct = reader.bool();
          break;
        case /* int32 apiCallCount */ 9:
          message.apiCallCount = reader.int32();
          break;
        case /* string tierDescription */ 10:
          message.tierDescription = reader.string();
          break;
        case /* int32 seatsAllocated */ 11:
          message.seatsAllocated = reader.int32();
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
    /* bool enabled = 2; */
    if (message.enabled !== false) writer.tag(2, WireType.Varint).bool(message.enabled);
    /* bool isTrial = 3; */
    if (message.isTrial !== false) writer.tag(3, WireType.Varint).bool(message.isTrial);
    /* int64 expiration = 4; */
    if (message.expiration !== 0n) writer.tag(4, WireType.Varint).int64(message.expiration);
    /* int64 created = 5; */
    if (message.created !== 0n) writer.tag(5, WireType.Varint).int64(message.created);
    /* int32 seats = 6; */
    if (message.seats !== 0) writer.tag(6, WireType.Varint).int32(message.seats);
    /* int64 activationTime = 7; */
    if (message.activationTime !== 0n) writer.tag(7, WireType.Varint).int64(message.activationTime);
    /* bool includedInProduct = 8; */
    if (message.includedInProduct !== false)
      writer.tag(8, WireType.Varint).bool(message.includedInProduct);
    /* int32 apiCallCount = 9; */
    if (message.apiCallCount !== 0) writer.tag(9, WireType.Varint).int32(message.apiCallCount);
    /* string tierDescription = 10; */
    if (message.tierDescription !== "")
      writer.tag(10, WireType.LengthDelimited).string(message.tierDescription);
    /* int32 seatsAllocated = 11; */
    if (message.seatsAllocated !== 0) writer.tag(11, WireType.Varint).int32(message.seatsAllocated);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.LicenseAddOn
 */
export const LicenseAddOn = new LicenseAddOn$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MCDefault$Type extends MessageType {
  constructor() {
    super("Enterprise.MCDefault", [
      { no: 1, name: "mcProduct", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "addOns",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 3, name: "filePlanType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "maxLicenses", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "fixedMaxLicenses", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.mcProduct = "";
    message.addOns = [];
    message.filePlanType = "";
    message.maxLicenses = 0;
    message.fixedMaxLicenses = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string mcProduct */ 1:
          message.mcProduct = reader.string();
          break;
        case /* repeated string addOns */ 2:
          message.addOns.push(reader.string());
          break;
        case /* string filePlanType */ 3:
          message.filePlanType = reader.string();
          break;
        case /* int32 maxLicenses */ 4:
          message.maxLicenses = reader.int32();
          break;
        case /* bool fixedMaxLicenses */ 5:
          message.fixedMaxLicenses = reader.bool();
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
    /* string mcProduct = 1; */
    if (message.mcProduct !== "") writer.tag(1, WireType.LengthDelimited).string(message.mcProduct);
    /* repeated string addOns = 2; */
    for (let i = 0; i < message.addOns.length; i++)
      writer.tag(2, WireType.LengthDelimited).string(message.addOns[i]);
    /* string filePlanType = 3; */
    if (message.filePlanType !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.filePlanType);
    /* int32 maxLicenses = 4; */
    if (message.maxLicenses !== 0) writer.tag(4, WireType.Varint).int32(message.maxLicenses);
    /* bool fixedMaxLicenses = 5; */
    if (message.fixedMaxLicenses !== false)
      writer.tag(5, WireType.Varint).bool(message.fixedMaxLicenses);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MCDefault
 */
export const MCDefault = new MCDefault$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MSPPermits$Type extends MessageType {
  constructor() {
    super("Enterprise.MSPPermits", [
      { no: 1, name: "restricted", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 2, name: "maxAllowedLicenses", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 3,
        name: "allowedMcProducts",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 4,
        name: "allowedAddOns",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 5, name: "maxFilePlanType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "allowUnlimitedLicenses", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 7,
        name: "mcDefaults",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => MCDefault,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.restricted = false;
    message.maxAllowedLicenses = 0;
    message.allowedMcProducts = [];
    message.allowedAddOns = [];
    message.maxFilePlanType = "";
    message.allowUnlimitedLicenses = false;
    message.mcDefaults = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool restricted */ 1:
          message.restricted = reader.bool();
          break;
        case /* int32 maxAllowedLicenses */ 2:
          message.maxAllowedLicenses = reader.int32();
          break;
        case /* repeated string allowedMcProducts */ 3:
          message.allowedMcProducts.push(reader.string());
          break;
        case /* repeated string allowedAddOns */ 4:
          message.allowedAddOns.push(reader.string());
          break;
        case /* string maxFilePlanType */ 5:
          message.maxFilePlanType = reader.string();
          break;
        case /* bool allowUnlimitedLicenses */ 6:
          message.allowUnlimitedLicenses = reader.bool();
          break;
        case /* repeated Enterprise.MCDefault mcDefaults */ 7:
          message.mcDefaults.push(MCDefault.internalBinaryRead(reader, reader.uint32(), options));
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
    /* bool restricted = 1; */
    if (message.restricted !== false) writer.tag(1, WireType.Varint).bool(message.restricted);
    /* int32 maxAllowedLicenses = 2; */
    if (message.maxAllowedLicenses !== 0)
      writer.tag(2, WireType.Varint).int32(message.maxAllowedLicenses);
    /* repeated string allowedMcProducts = 3; */
    for (let i = 0; i < message.allowedMcProducts.length; i++)
      writer.tag(3, WireType.LengthDelimited).string(message.allowedMcProducts[i]);
    /* repeated string allowedAddOns = 4; */
    for (let i = 0; i < message.allowedAddOns.length; i++)
      writer.tag(4, WireType.LengthDelimited).string(message.allowedAddOns[i]);
    /* string maxFilePlanType = 5; */
    if (message.maxFilePlanType !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.maxFilePlanType);
    /* bool allowUnlimitedLicenses = 6; */
    if (message.allowUnlimitedLicenses !== false)
      writer.tag(6, WireType.Varint).bool(message.allowUnlimitedLicenses);
    /* repeated Enterprise.MCDefault mcDefaults = 7; */
    for (let i = 0; i < message.mcDefaults.length; i++)
      MCDefault.internalBinaryWrite(
        message.mcDefaults[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MSPPermits
 */
export const MSPPermits = new MSPPermits$Type();
// @generated message type with reflection information, may provide speed optimized methods
class License$Type extends MessageType {
  constructor() {
    super("Enterprise.License", [
      { no: 1, name: "paid", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 2, name: "numberOfSeats", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 3,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "licenseKeyId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "productTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 7,
        name: "enterpriseLicenseId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 8, name: "seatsAllocated", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 9, name: "seatsPending", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 10, name: "tier", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 11, name: "filePlanTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 12,
        name: "maxBytes",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 13,
        name: "storageExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 14, name: "licenseStatus", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 15,
        name: "mspPool",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => MSPPool,
      },
      { no: 16, name: "managedBy", kind: "message", T: () => MSPContact },
      {
        no: 17,
        name: "addOns",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => LicenseAddOn,
      },
      {
        no: 18,
        name: "nextBillingDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 19, name: "hasMSPLegacyLog", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 20, name: "mspPermits", kind: "message", T: () => MSPPermits },
      { no: 21, name: "distributor", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.paid = false;
    message.numberOfSeats = 0;
    message.expiration = 0n;
    message.licenseKeyId = 0;
    message.productTypeId = 0;
    message.name = "";
    message.enterpriseLicenseId = 0n;
    message.seatsAllocated = 0;
    message.seatsPending = 0;
    message.tier = 0;
    message.filePlanTypeId = 0;
    message.maxBytes = 0n;
    message.storageExpiration = 0n;
    message.licenseStatus = "";
    message.mspPool = [];
    message.addOns = [];
    message.nextBillingDate = 0n;
    message.hasMSPLegacyLog = false;
    message.distributor = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool paid */ 1:
          message.paid = reader.bool();
          break;
        case /* int32 numberOfSeats */ 2:
          message.numberOfSeats = reader.int32();
          break;
        case /* int64 expiration */ 3:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* int32 licenseKeyId */ 4:
          message.licenseKeyId = reader.int32();
          break;
        case /* int32 productTypeId */ 5:
          message.productTypeId = reader.int32();
          break;
        case /* string name */ 6:
          message.name = reader.string();
          break;
        case /* int64 enterpriseLicenseId */ 7:
          message.enterpriseLicenseId = reader.int64().toBigInt();
          break;
        case /* int32 seatsAllocated */ 8:
          message.seatsAllocated = reader.int32();
          break;
        case /* int32 seatsPending */ 9:
          message.seatsPending = reader.int32();
          break;
        case /* int32 tier */ 10:
          message.tier = reader.int32();
          break;
        case /* int32 filePlanTypeId */ 11:
          message.filePlanTypeId = reader.int32();
          break;
        case /* int64 maxBytes */ 12:
          message.maxBytes = reader.int64().toBigInt();
          break;
        case /* int64 storageExpiration */ 13:
          message.storageExpiration = reader.int64().toBigInt();
          break;
        case /* string licenseStatus */ 14:
          message.licenseStatus = reader.string();
          break;
        case /* repeated Enterprise.MSPPool mspPool */ 15:
          message.mspPool.push(MSPPool.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* Enterprise.MSPContact managedBy */ 16:
          message.managedBy = MSPContact.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.managedBy,
          );
          break;
        case /* repeated Enterprise.LicenseAddOn addOns */ 17:
          message.addOns.push(LicenseAddOn.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* int64 nextBillingDate */ 18:
          message.nextBillingDate = reader.int64().toBigInt();
          break;
        case /* bool hasMSPLegacyLog */ 19:
          message.hasMSPLegacyLog = reader.bool();
          break;
        case /* Enterprise.MSPPermits mspPermits */ 20:
          message.mspPermits = MSPPermits.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.mspPermits,
          );
          break;
        case /* bool distributor */ 21:
          message.distributor = reader.bool();
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
    /* bool paid = 1; */
    if (message.paid !== false) writer.tag(1, WireType.Varint).bool(message.paid);
    /* int32 numberOfSeats = 2; */
    if (message.numberOfSeats !== 0) writer.tag(2, WireType.Varint).int32(message.numberOfSeats);
    /* int64 expiration = 3; */
    if (message.expiration !== 0n) writer.tag(3, WireType.Varint).int64(message.expiration);
    /* int32 licenseKeyId = 4; */
    if (message.licenseKeyId !== 0) writer.tag(4, WireType.Varint).int32(message.licenseKeyId);
    /* int32 productTypeId = 5; */
    if (message.productTypeId !== 0) writer.tag(5, WireType.Varint).int32(message.productTypeId);
    /* string name = 6; */
    if (message.name !== "") writer.tag(6, WireType.LengthDelimited).string(message.name);
    /* int64 enterpriseLicenseId = 7; */
    if (message.enterpriseLicenseId !== 0n)
      writer.tag(7, WireType.Varint).int64(message.enterpriseLicenseId);
    /* int32 seatsAllocated = 8; */
    if (message.seatsAllocated !== 0) writer.tag(8, WireType.Varint).int32(message.seatsAllocated);
    /* int32 seatsPending = 9; */
    if (message.seatsPending !== 0) writer.tag(9, WireType.Varint).int32(message.seatsPending);
    /* int32 tier = 10; */
    if (message.tier !== 0) writer.tag(10, WireType.Varint).int32(message.tier);
    /* int32 filePlanTypeId = 11; */
    if (message.filePlanTypeId !== 0) writer.tag(11, WireType.Varint).int32(message.filePlanTypeId);
    /* int64 maxBytes = 12; */
    if (message.maxBytes !== 0n) writer.tag(12, WireType.Varint).int64(message.maxBytes);
    /* int64 storageExpiration = 13; */
    if (message.storageExpiration !== 0n)
      writer.tag(13, WireType.Varint).int64(message.storageExpiration);
    /* string licenseStatus = 14; */
    if (message.licenseStatus !== "")
      writer.tag(14, WireType.LengthDelimited).string(message.licenseStatus);
    /* repeated Enterprise.MSPPool mspPool = 15; */
    for (let i = 0; i < message.mspPool.length; i++)
      MSPPool.internalBinaryWrite(
        message.mspPool[i],
        writer.tag(15, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.MSPContact managedBy = 16; */
    if (message.managedBy)
      MSPContact.internalBinaryWrite(
        message.managedBy,
        writer.tag(16, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.LicenseAddOn addOns = 17; */
    for (let i = 0; i < message.addOns.length; i++)
      LicenseAddOn.internalBinaryWrite(
        message.addOns[i],
        writer.tag(17, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 nextBillingDate = 18; */
    if (message.nextBillingDate !== 0n)
      writer.tag(18, WireType.Varint).int64(message.nextBillingDate);
    /* bool hasMSPLegacyLog = 19; */
    if (message.hasMSPLegacyLog !== false)
      writer.tag(19, WireType.Varint).bool(message.hasMSPLegacyLog);
    /* Enterprise.MSPPermits mspPermits = 20; */
    if (message.mspPermits)
      MSPPermits.internalBinaryWrite(
        message.mspPermits,
        writer.tag(20, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool distributor = 21; */
    if (message.distributor !== false) writer.tag(21, WireType.Varint).bool(message.distributor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.License
 */
export const License = new License$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Bridge$Type extends MessageType {
  constructor() {
    super("Enterprise.Bridge", [
      {
        no: 1,
        name: "bridgeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "wanIpEnforcement", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "lanIpEnforcement", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.bridgeId = 0n;
    message.nodeId = 0n;
    message.wanIpEnforcement = "";
    message.lanIpEnforcement = "";
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
        case /* int64 bridgeId */ 1:
          message.bridgeId = reader.int64().toBigInt();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string wanIpEnforcement */ 3:
          message.wanIpEnforcement = reader.string();
          break;
        case /* string lanIpEnforcement */ 4:
          message.lanIpEnforcement = reader.string();
          break;
        case /* string status */ 5:
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
    /* int64 bridgeId = 1; */
    if (message.bridgeId !== 0n) writer.tag(1, WireType.Varint).int64(message.bridgeId);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string wanIpEnforcement = 3; */
    if (message.wanIpEnforcement !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.wanIpEnforcement);
    /* string lanIpEnforcement = 4; */
    if (message.lanIpEnforcement !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.lanIpEnforcement);
    /* string status = 5; */
    if (message.status !== "") writer.tag(5, WireType.LengthDelimited).string(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Bridge
 */
export const Bridge = new Bridge$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Scim$Type extends MessageType {
  constructor() {
    super("Enterprise.Scim", [
      {
        no: 1,
        name: "scimId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "lastSynced",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "rolePrefix", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "uniqueGroups", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.scimId = 0n;
    message.nodeId = 0n;
    message.status = "";
    message.lastSynced = 0n;
    message.rolePrefix = "";
    message.uniqueGroups = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 scimId */ 1:
          message.scimId = reader.int64().toBigInt();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string status */ 3:
          message.status = reader.string();
          break;
        case /* int64 lastSynced */ 4:
          message.lastSynced = reader.int64().toBigInt();
          break;
        case /* string rolePrefix */ 5:
          message.rolePrefix = reader.string();
          break;
        case /* bool uniqueGroups */ 6:
          message.uniqueGroups = reader.bool();
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
    /* int64 scimId = 1; */
    if (message.scimId !== 0n) writer.tag(1, WireType.Varint).int64(message.scimId);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string status = 3; */
    if (message.status !== "") writer.tag(3, WireType.LengthDelimited).string(message.status);
    /* int64 lastSynced = 4; */
    if (message.lastSynced !== 0n) writer.tag(4, WireType.Varint).int64(message.lastSynced);
    /* string rolePrefix = 5; */
    if (message.rolePrefix !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.rolePrefix);
    /* bool uniqueGroups = 6; */
    if (message.uniqueGroups !== false) writer.tag(6, WireType.Varint).bool(message.uniqueGroups);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.Scim
 */
export const Scim = new Scim$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EmailProvision$Type extends MessageType {
  constructor() {
    super("Enterprise.EmailProvision", [
      { no: 1, name: "id", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "domain", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "method", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.id = 0;
    message.nodeId = 0n;
    message.domain = "";
    message.method = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 id */ 1:
          message.id = reader.int32();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string domain */ 3:
          message.domain = reader.string();
          break;
        case /* string method */ 4:
          message.method = reader.string();
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
    /* int32 id = 1; */
    if (message.id !== 0) writer.tag(1, WireType.Varint).int32(message.id);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string domain = 3; */
    if (message.domain !== "") writer.tag(3, WireType.LengthDelimited).string(message.domain);
    /* string method = 4; */
    if (message.method !== "") writer.tag(4, WireType.LengthDelimited).string(message.method);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EmailProvision
 */
export const EmailProvision = new EmailProvision$Type();
// @generated message type with reflection information, may provide speed optimized methods
class QueuedTeam$Type extends MessageType {
  constructor() {
    super("Enterprise.QueuedTeam", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.name = "";
    message.nodeId = 0n;
    message.encryptedData = "";
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
        case /* string name */ 2:
          message.name = reader.string();
          break;
        case /* int64 nodeId */ 3:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 4:
          message.encryptedData = reader.string();
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
    /* string name = 2; */
    if (message.name !== "") writer.tag(2, WireType.LengthDelimited).string(message.name);
    /* int64 nodeId = 3; */
    if (message.nodeId !== 0n) writer.tag(3, WireType.Varint).int64(message.nodeId);
    /* string encryptedData = 4; */
    if (message.encryptedData !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.encryptedData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.QueuedTeam
 */
export const QueuedTeam = new QueuedTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class QueuedTeamUser$Type extends MessageType {
  constructor() {
    super("Enterprise.QueuedTeamUser", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "users",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.users = [];
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
        case /* repeated int64 users */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.users.push(reader.int64().toBigInt());
          else message.users.push(reader.int64().toBigInt());
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
    /* repeated int64 users = 2; */
    if (message.users.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.users.length; i++) writer.int64(message.users[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.QueuedTeamUser
 */
export const QueuedTeamUser = new QueuedTeamUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsAddResult$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsAddResult", [
      {
        no: 1,
        name: "successfulTeamAdd",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamAddResult,
      },
      {
        no: 2,
        name: "unsuccessfulTeamAdd",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamAddResult,
      },
      { no: 3, name: "result", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "errorMessage", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.successfulTeamAdd = [];
    message.unsuccessfulTeamAdd = [];
    message.result = "";
    message.errorMessage = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.TeamAddResult successfulTeamAdd */ 1:
          message.successfulTeamAdd.push(
            TeamAddResult.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.TeamAddResult unsuccessfulTeamAdd */ 2:
          message.unsuccessfulTeamAdd.push(
            TeamAddResult.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string result */ 3:
          message.result = reader.string();
          break;
        case /* string errorMessage */ 4:
          message.errorMessage = reader.string();
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
    /* repeated Enterprise.TeamAddResult successfulTeamAdd = 1; */
    for (let i = 0; i < message.successfulTeamAdd.length; i++)
      TeamAddResult.internalBinaryWrite(
        message.successfulTeamAdd[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.TeamAddResult unsuccessfulTeamAdd = 2; */
    for (let i = 0; i < message.unsuccessfulTeamAdd.length; i++)
      TeamAddResult.internalBinaryWrite(
        message.unsuccessfulTeamAdd[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string result = 3; */
    if (message.result !== "") writer.tag(3, WireType.LengthDelimited).string(message.result);
    /* string errorMessage = 4; */
    if (message.errorMessage !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.errorMessage);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsAddResult
 */
export const TeamsAddResult = new TeamsAddResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamAddResult$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamAddResult", [
      { no: 1, name: "team", kind: "message", T: () => Team },
      { no: 2, name: "result", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "errorMessage", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.result = "";
    message.errorMessage = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Enterprise.Team team */ 1:
          message.team = Team.internalBinaryRead(reader, reader.uint32(), options, message.team);
          break;
        case /* string result */ 2:
          message.result = reader.string();
          break;
        case /* string errorMessage */ 3:
          message.errorMessage = reader.string();
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
    /* Enterprise.Team team = 1; */
    if (message.team)
      Team.internalBinaryWrite(
        message.team,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string result = 2; */
    if (message.result !== "") writer.tag(2, WireType.LengthDelimited).string(message.result);
    /* string errorMessage = 3; */
    if (message.errorMessage !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.errorMessage);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamAddResult
 */
export const TeamAddResult = new TeamAddResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SsoService$Type extends MessageType {
  constructor() {
    super("Enterprise.SsoService", [
      {
        no: 1,
        name: "ssoServiceProviderId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "sp_url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "inviteNewUsers", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "active", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "isCloud", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.ssoServiceProviderId = 0n;
    message.nodeId = 0n;
    message.name = "";
    message.spUrl = "";
    message.inviteNewUsers = false;
    message.active = false;
    message.isCloud = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 ssoServiceProviderId */ 1:
          message.ssoServiceProviderId = reader.int64().toBigInt();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string name */ 3:
          message.name = reader.string();
          break;
        case /* string sp_url */ 4:
          message.spUrl = reader.string();
          break;
        case /* bool inviteNewUsers */ 5:
          message.inviteNewUsers = reader.bool();
          break;
        case /* bool active */ 6:
          message.active = reader.bool();
          break;
        case /* bool isCloud */ 7:
          message.isCloud = reader.bool();
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
    /* int64 ssoServiceProviderId = 1; */
    if (message.ssoServiceProviderId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.ssoServiceProviderId);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* string name = 3; */
    if (message.name !== "") writer.tag(3, WireType.LengthDelimited).string(message.name);
    /* string sp_url = 4; */
    if (message.spUrl !== "") writer.tag(4, WireType.LengthDelimited).string(message.spUrl);
    /* bool inviteNewUsers = 5; */
    if (message.inviteNewUsers !== false)
      writer.tag(5, WireType.Varint).bool(message.inviteNewUsers);
    /* bool active = 6; */
    if (message.active !== false) writer.tag(6, WireType.Varint).bool(message.active);
    /* bool isCloud = 7; */
    if (message.isCloud !== false) writer.tag(7, WireType.Varint).bool(message.isCloud);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SsoService
 */
export const SsoService = new SsoService$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReportFilterUser$Type extends MessageType {
  constructor() {
    super("Enterprise.ReportFilterUser", [
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userId = 0;
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
        case /* int32 userId */ 1:
          message.userId = reader.int32();
          break;
        case /* string email */ 2:
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
    /* int32 userId = 1; */
    if (message.userId !== 0) writer.tag(1, WireType.Varint).int32(message.userId);
    /* string email = 2; */
    if (message.email !== "") writer.tag(2, WireType.LengthDelimited).string(message.email);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ReportFilterUser
 */
export const ReportFilterUser = new ReportFilterUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceRequestForAdminApproval$Type extends MessageType {
  constructor() {
    super("Enterprise.DeviceRequestForAdminApproval", [
      {
        no: 1,
        name: "deviceId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "deviceType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "date", kind: "scalar", T: 3 /*ScalarType.INT64*/, L: 0 /*LongType.BIGINT*/ },
      { no: 9, name: "ipAddress", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 10, name: "location", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 11, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 12, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceId = 0n;
    message.enterpriseUserId = 0n;
    message.encryptedDeviceToken = new Uint8Array(0);
    message.devicePublicKey = new Uint8Array(0);
    message.deviceName = "";
    message.clientVersion = "";
    message.deviceType = "";
    message.date = 0n;
    message.ipAddress = "";
    message.location = "";
    message.email = "";
    message.accountUid = new Uint8Array(0);
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
        case /* int64 enterpriseUserId */ 2:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedDeviceToken */ 3:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes devicePublicKey */ 4:
          message.devicePublicKey = reader.bytes();
          break;
        case /* string deviceName */ 5:
          message.deviceName = reader.string();
          break;
        case /* string clientVersion */ 6:
          message.clientVersion = reader.string();
          break;
        case /* string deviceType */ 7:
          message.deviceType = reader.string();
          break;
        case /* int64 date */ 8:
          message.date = reader.int64().toBigInt();
          break;
        case /* string ipAddress */ 9:
          message.ipAddress = reader.string();
          break;
        case /* string location */ 10:
          message.location = reader.string();
          break;
        case /* string email */ 11:
          message.email = reader.string();
          break;
        case /* bytes accountUid */ 12:
          message.accountUid = reader.bytes();
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
    /* int64 enterpriseUserId = 2; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.enterpriseUserId);
    /* bytes encryptedDeviceToken = 3; */
    if (message.encryptedDeviceToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes devicePublicKey = 4; */
    if (message.devicePublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* string deviceName = 5; */
    if (message.deviceName !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.deviceName);
    /* string clientVersion = 6; */
    if (message.clientVersion !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.clientVersion);
    /* string deviceType = 7; */
    if (message.deviceType !== "")
      writer.tag(7, WireType.LengthDelimited).string(message.deviceType);
    /* int64 date = 8; */
    if (message.date !== 0n) writer.tag(8, WireType.Varint).int64(message.date);
    /* string ipAddress = 9; */
    if (message.ipAddress !== "") writer.tag(9, WireType.LengthDelimited).string(message.ipAddress);
    /* string location = 10; */
    if (message.location !== "") writer.tag(10, WireType.LengthDelimited).string(message.location);
    /* string email = 11; */
    if (message.email !== "") writer.tag(11, WireType.LengthDelimited).string(message.email);
    /* bytes accountUid = 12; */
    if (message.accountUid.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.accountUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DeviceRequestForAdminApproval
 */
export const DeviceRequestForAdminApproval = new DeviceRequestForAdminApproval$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseData$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseData", [
      {
        no: 1,
        name: "entity",
        kind: "enum",
        T: () => ["Enterprise.EnterpriseDataEntity", EnterpriseDataEntity],
      },
      { no: 2, name: "delete", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 3,
        name: "data",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.entity = 0;
    message.delete = false;
    message.data = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Enterprise.EnterpriseDataEntity entity */ 1:
          message.entity = reader.int32();
          break;
        case /* bool delete */ 2:
          message.delete = reader.bool();
          break;
        case /* repeated bytes data */ 3:
          message.data.push(reader.bytes());
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
    /* Enterprise.EnterpriseDataEntity entity = 1; */
    if (message.entity !== 0) writer.tag(1, WireType.Varint).int32(message.entity);
    /* bool delete = 2; */
    if (message.delete !== false) writer.tag(2, WireType.Varint).bool(message.delete);
    /* repeated bytes data = 3; */
    for (let i = 0; i < message.data.length; i++)
      writer.tag(3, WireType.LengthDelimited).bytes(message.data[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseData
 */
export const EnterpriseData = new EnterpriseData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseDataResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseDataResponse", [
      { no: 1, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "hasMore", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 3,
        name: "cacheStatus",
        kind: "enum",
        T: () => ["Enterprise.CacheStatus", CacheStatus],
      },
      {
        no: 4,
        name: "data",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseData,
      },
      { no: 5, name: "generalData", kind: "message", T: () => GeneralDataEntity },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.continuationToken = new Uint8Array(0);
    message.hasMore = false;
    message.cacheStatus = 0;
    message.data = [];
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
        case /* bool hasMore */ 2:
          message.hasMore = reader.bool();
          break;
        case /* Enterprise.CacheStatus cacheStatus */ 3:
          message.cacheStatus = reader.int32();
          break;
        case /* repeated Enterprise.EnterpriseData data */ 4:
          message.data.push(EnterpriseData.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* Enterprise.GeneralDataEntity generalData */ 5:
          message.generalData = GeneralDataEntity.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.generalData,
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
    /* bytes continuationToken = 1; */
    if (message.continuationToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.continuationToken);
    /* bool hasMore = 2; */
    if (message.hasMore !== false) writer.tag(2, WireType.Varint).bool(message.hasMore);
    /* Enterprise.CacheStatus cacheStatus = 3; */
    if (message.cacheStatus !== 0) writer.tag(3, WireType.Varint).int32(message.cacheStatus);
    /* repeated Enterprise.EnterpriseData data = 4; */
    for (let i = 0; i < message.data.length; i++)
      EnterpriseData.internalBinaryWrite(
        message.data[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.GeneralDataEntity generalData = 5; */
    if (message.generalData)
      GeneralDataEntity.internalBinaryWrite(
        message.generalData,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseDataResponse
 */
export const EnterpriseDataResponse = new EnterpriseDataResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupRequest", [
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
 * @generated MessageType for protobuf message Enterprise.BackupRequest
 */
export const BackupRequest = new BackupRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupRecord", [
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.BackupKeyType", BackupKeyType],
      },
      { no: 5, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "extra", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userId = 0;
    message.recordUid = new Uint8Array(0);
    message.key = new Uint8Array(0);
    message.keyType = 0;
    message.version = 0;
    message.data = new Uint8Array(0);
    message.extra = new Uint8Array(0);
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
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* bytes key */ 3:
          message.key = reader.bytes();
          break;
        case /* Enterprise.BackupKeyType keyType */ 4:
          message.keyType = reader.int32();
          break;
        case /* int32 version */ 5:
          message.version = reader.int32();
          break;
        case /* bytes data */ 6:
          message.data = reader.bytes();
          break;
        case /* bytes extra */ 7:
          message.extra = reader.bytes();
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
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes key = 3; */
    if (message.key.length) writer.tag(3, WireType.LengthDelimited).bytes(message.key);
    /* Enterprise.BackupKeyType keyType = 4; */
    if (message.keyType !== 0) writer.tag(4, WireType.Varint).int32(message.keyType);
    /* int32 version = 5; */
    if (message.version !== 0) writer.tag(5, WireType.Varint).int32(message.version);
    /* bytes data = 6; */
    if (message.data.length) writer.tag(6, WireType.LengthDelimited).bytes(message.data);
    /* bytes extra = 7; */
    if (message.extra.length) writer.tag(7, WireType.LengthDelimited).bytes(message.extra);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupRecord
 */
export const BackupRecord = new BackupRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupKey$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupKey", [
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "backupKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userId = 0;
    message.backupKey = new Uint8Array(0);
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
        case /* bytes backupKey */ 2:
          message.backupKey = reader.bytes();
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
    /* bytes backupKey = 2; */
    if (message.backupKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.backupKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupKey
 */
export const BackupKey = new BackupKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupUser$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupUser", [
      { no: 1, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "userName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "dataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "dataKeyType",
        kind: "enum",
        T: () => ["Enterprise.BackupUserDataKeyType", BackupUserDataKeyType],
      },
      { no: 5, name: "privateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "treeKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 7,
        name: "treeKeyType",
        kind: "enum",
        T: () => ["Enterprise.BackupKeyType", BackupKeyType],
      },
      {
        no: 8,
        name: "backupKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BackupKey,
      },
      { no: 9, name: "privateECKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userId = 0;
    message.userName = "";
    message.dataKey = new Uint8Array(0);
    message.dataKeyType = 0;
    message.privateKey = new Uint8Array(0);
    message.treeKey = new Uint8Array(0);
    message.treeKeyType = 0;
    message.backupKeys = [];
    message.privateECKey = new Uint8Array(0);
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
        case /* string userName */ 2:
          message.userName = reader.string();
          break;
        case /* bytes dataKey */ 3:
          message.dataKey = reader.bytes();
          break;
        case /* Enterprise.BackupUserDataKeyType dataKeyType */ 4:
          message.dataKeyType = reader.int32();
          break;
        case /* bytes privateKey */ 5:
          message.privateKey = reader.bytes();
          break;
        case /* bytes treeKey */ 6:
          message.treeKey = reader.bytes();
          break;
        case /* Enterprise.BackupKeyType treeKeyType */ 7:
          message.treeKeyType = reader.int32();
          break;
        case /* repeated Enterprise.BackupKey backupKeys */ 8:
          message.backupKeys.push(BackupKey.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bytes privateECKey */ 9:
          message.privateECKey = reader.bytes();
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
    /* string userName = 2; */
    if (message.userName !== "") writer.tag(2, WireType.LengthDelimited).string(message.userName);
    /* bytes dataKey = 3; */
    if (message.dataKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.dataKey);
    /* Enterprise.BackupUserDataKeyType dataKeyType = 4; */
    if (message.dataKeyType !== 0) writer.tag(4, WireType.Varint).int32(message.dataKeyType);
    /* bytes privateKey = 5; */
    if (message.privateKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.privateKey);
    /* bytes treeKey = 6; */
    if (message.treeKey.length) writer.tag(6, WireType.LengthDelimited).bytes(message.treeKey);
    /* Enterprise.BackupKeyType treeKeyType = 7; */
    if (message.treeKeyType !== 0) writer.tag(7, WireType.Varint).int32(message.treeKeyType);
    /* repeated Enterprise.BackupKey backupKeys = 8; */
    for (let i = 0; i < message.backupKeys.length; i++)
      BackupKey.internalBinaryWrite(
        message.backupKeys[i],
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes privateECKey = 9; */
    if (message.privateECKey.length)
      writer.tag(9, WireType.LengthDelimited).bytes(message.privateECKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupUser
 */
export const BackupUser = new BackupUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupResponse", [
      { no: 1, name: "enterpriseEccPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BackupUser,
      },
      {
        no: 3,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BackupRecord,
      },
      { no: 4, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseEccPrivateKey = new Uint8Array(0);
    message.users = [];
    message.records = [];
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
        case /* bytes enterpriseEccPrivateKey */ 1:
          message.enterpriseEccPrivateKey = reader.bytes();
          break;
        case /* repeated Enterprise.BackupUser users */ 2:
          message.users.push(BackupUser.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.BackupRecord records */ 3:
          message.records.push(BackupRecord.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bytes continuationToken */ 4:
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
    /* bytes enterpriseEccPrivateKey = 1; */
    if (message.enterpriseEccPrivateKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.enterpriseEccPrivateKey);
    /* repeated Enterprise.BackupUser users = 2; */
    for (let i = 0; i < message.users.length; i++)
      BackupUser.internalBinaryWrite(
        message.users[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.BackupRecord records = 3; */
    for (let i = 0; i < message.records.length; i++)
      BackupRecord.internalBinaryWrite(
        message.records[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes continuationToken = 4; */
    if (message.continuationToken.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.continuationToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupResponse
 */
export const BackupResponse = new BackupResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupFile$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupFile", [
      { no: 1, name: "user", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "backupUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "fileName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "created",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "downloadUrl", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.user = "";
    message.backupUid = new Uint8Array(0);
    message.fileName = "";
    message.created = 0n;
    message.downloadUrl = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string user */ 1:
          message.user = reader.string();
          break;
        case /* bytes backupUid */ 2:
          message.backupUid = reader.bytes();
          break;
        case /* string fileName */ 3:
          message.fileName = reader.string();
          break;
        case /* int64 created */ 4:
          message.created = reader.int64().toBigInt();
          break;
        case /* string downloadUrl */ 5:
          message.downloadUrl = reader.string();
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
    /* string user = 1; */
    if (message.user !== "") writer.tag(1, WireType.LengthDelimited).string(message.user);
    /* bytes backupUid = 2; */
    if (message.backupUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.backupUid);
    /* string fileName = 3; */
    if (message.fileName !== "") writer.tag(3, WireType.LengthDelimited).string(message.fileName);
    /* int64 created = 4; */
    if (message.created !== 0n) writer.tag(4, WireType.Varint).int64(message.created);
    /* string downloadUrl = 5; */
    if (message.downloadUrl !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.downloadUrl);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupFile
 */
export const BackupFile = new BackupFile$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BackupsResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.BackupsResponse", [
      {
        no: 1,
        name: "files",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BackupFile,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.files = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.BackupFile files */ 1:
          message.files.push(BackupFile.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Enterprise.BackupFile files = 1; */
    for (let i = 0; i < message.files.length; i++)
      BackupFile.internalBinaryWrite(
        message.files[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.BackupsResponse
 */
export const BackupsResponse = new BackupsResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetEnterpriseDataKeysRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.GetEnterpriseDataKeysRequest", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated int64 roleId */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.roleId.push(reader.int64().toBigInt());
          else message.roleId.push(reader.int64().toBigInt());
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
    /* repeated int64 roleId = 1; */
    if (message.roleId.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.roleId.length; i++) writer.int64(message.roleId[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetEnterpriseDataKeysRequest
 */
export const GetEnterpriseDataKeysRequest = new GetEnterpriseDataKeysRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetEnterpriseDataKeysResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.GetEnterpriseDataKeysResponse", [
      {
        no: 1,
        name: "reEncryptedRoleKey",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReEncryptedRoleKey,
      },
      {
        no: 2,
        name: "roleKey",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleKey,
      },
      { no: 3, name: "mspKey", kind: "message", T: () => MspKey },
      { no: 4, name: "enterpriseKeys", kind: "message", T: () => EnterpriseKeys },
      { no: 5, name: "treeKey", kind: "message", T: () => TreeKey },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reEncryptedRoleKey = [];
    message.roleKey = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.ReEncryptedRoleKey reEncryptedRoleKey */ 1:
          message.reEncryptedRoleKey.push(
            ReEncryptedRoleKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.RoleKey roleKey */ 2:
          message.roleKey.push(RoleKey.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* Enterprise.MspKey mspKey */ 3:
          message.mspKey = MspKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.mspKey,
          );
          break;
        case /* Enterprise.EnterpriseKeys enterpriseKeys */ 4:
          message.enterpriseKeys = EnterpriseKeys.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.enterpriseKeys,
          );
          break;
        case /* Enterprise.TreeKey treeKey */ 5:
          message.treeKey = TreeKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.treeKey,
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
    /* repeated Enterprise.ReEncryptedRoleKey reEncryptedRoleKey = 1; */
    for (let i = 0; i < message.reEncryptedRoleKey.length; i++)
      ReEncryptedRoleKey.internalBinaryWrite(
        message.reEncryptedRoleKey[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.RoleKey roleKey = 2; */
    for (let i = 0; i < message.roleKey.length; i++)
      RoleKey.internalBinaryWrite(
        message.roleKey[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.MspKey mspKey = 3; */
    if (message.mspKey)
      MspKey.internalBinaryWrite(
        message.mspKey,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.EnterpriseKeys enterpriseKeys = 4; */
    if (message.enterpriseKeys)
      EnterpriseKeys.internalBinaryWrite(
        message.enterpriseKeys,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.TreeKey treeKey = 5; */
    if (message.treeKey)
      TreeKey.internalBinaryWrite(
        message.treeKey,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetEnterpriseDataKeysResponse
 */
export const GetEnterpriseDataKeysResponse = new GetEnterpriseDataKeysResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleKey$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleKey", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
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
    message.roleId = 0n;
    message.encryptedKey = "";
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
        case /* int64 roleId */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* string encryptedKey */ 2:
          message.encryptedKey = reader.string();
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
    /* int64 roleId = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* string encryptedKey = 2; */
    if (message.encryptedKey !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.encryptedKey);
    /* Enterprise.EncryptedKeyType keyType = 3; */
    if (message.keyType !== 0) writer.tag(3, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleKey
 */
export const RoleKey = new RoleKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MspKey$Type extends MessageType {
  constructor() {
    super("Enterprise.MspKey", [
      { no: 1, name: "encryptedMspTreeKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "encryptedMspTreeKeyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedMspTreeKey = "";
    message.encryptedMspTreeKeyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string encryptedMspTreeKey */ 1:
          message.encryptedMspTreeKey = reader.string();
          break;
        case /* Enterprise.EncryptedKeyType encryptedMspTreeKeyType */ 2:
          message.encryptedMspTreeKeyType = reader.int32();
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
    /* string encryptedMspTreeKey = 1; */
    if (message.encryptedMspTreeKey !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.encryptedMspTreeKey);
    /* Enterprise.EncryptedKeyType encryptedMspTreeKeyType = 2; */
    if (message.encryptedMspTreeKeyType !== 0)
      writer.tag(2, WireType.Varint).int32(message.encryptedMspTreeKeyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.MspKey
 */
export const MspKey = new MspKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseKeys$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseKeys", [
      { no: 1, name: "rsaPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "rsaEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "eccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "eccEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.rsaPublicKey = new Uint8Array(0);
    message.rsaEncryptedPrivateKey = new Uint8Array(0);
    message.eccPublicKey = new Uint8Array(0);
    message.eccEncryptedPrivateKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes rsaPublicKey */ 1:
          message.rsaPublicKey = reader.bytes();
          break;
        case /* bytes rsaEncryptedPrivateKey */ 2:
          message.rsaEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes eccPublicKey */ 3:
          message.eccPublicKey = reader.bytes();
          break;
        case /* bytes eccEncryptedPrivateKey */ 4:
          message.eccEncryptedPrivateKey = reader.bytes();
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
    /* bytes rsaPublicKey = 1; */
    if (message.rsaPublicKey.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.rsaPublicKey);
    /* bytes rsaEncryptedPrivateKey = 2; */
    if (message.rsaEncryptedPrivateKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.rsaEncryptedPrivateKey);
    /* bytes eccPublicKey = 3; */
    if (message.eccPublicKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.eccPublicKey);
    /* bytes eccEncryptedPrivateKey = 4; */
    if (message.eccEncryptedPrivateKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.eccEncryptedPrivateKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseKeys
 */
export const EnterpriseKeys = new EnterpriseKeys$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TreeKey$Type extends MessageType {
  constructor() {
    super("Enterprise.TreeKey", [
      { no: 1, name: "treeKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "keyTypeId",
        kind: "enum",
        T: () => ["Enterprise.BackupKeyType", BackupKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.treeKey = "";
    message.keyTypeId = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string treeKey */ 1:
          message.treeKey = reader.string();
          break;
        case /* Enterprise.BackupKeyType keyTypeId */ 2:
          message.keyTypeId = reader.int32();
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
    /* string treeKey = 1; */
    if (message.treeKey !== "") writer.tag(1, WireType.LengthDelimited).string(message.treeKey);
    /* Enterprise.BackupKeyType keyTypeId = 2; */
    if (message.keyTypeId !== 0) writer.tag(2, WireType.Varint).int32(message.keyTypeId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TreeKey
 */
export const TreeKey = new TreeKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedRecordResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.SharedRecordResponse", [
      {
        no: 1,
        name: "events",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecordEvent,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.events = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.SharedRecordEvent events */ 1:
          message.events.push(
            SharedRecordEvent.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.SharedRecordEvent events = 1; */
    for (let i = 0; i < message.events.length; i++)
      SharedRecordEvent.internalBinaryWrite(
        message.events[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SharedRecordResponse
 */
export const SharedRecordResponse = new SharedRecordResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedRecordEvent$Type extends MessageType {
  constructor() {
    super("Enterprise.SharedRecordEvent", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "userName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "canEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "canReshare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "shareFrom", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.userName = "";
    message.canEdit = false;
    message.canReshare = false;
    message.shareFrom = 0;
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
        case /* string userName */ 2:
          message.userName = reader.string();
          break;
        case /* bool canEdit */ 3:
          message.canEdit = reader.bool();
          break;
        case /* bool canReshare */ 4:
          message.canReshare = reader.bool();
          break;
        case /* int32 shareFrom */ 5:
          message.shareFrom = reader.int32();
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
    /* string userName = 2; */
    if (message.userName !== "") writer.tag(2, WireType.LengthDelimited).string(message.userName);
    /* bool canEdit = 3; */
    if (message.canEdit !== false) writer.tag(3, WireType.Varint).bool(message.canEdit);
    /* bool canReshare = 4; */
    if (message.canReshare !== false) writer.tag(4, WireType.Varint).bool(message.canReshare);
    /* int32 shareFrom = 5; */
    if (message.shareFrom !== 0) writer.tag(5, WireType.Varint).int32(message.shareFrom);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SharedRecordEvent
 */
export const SharedRecordEvent = new SharedRecordEvent$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SetRestrictVisibilityRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.SetRestrictVisibilityRequest", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
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
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SetRestrictVisibilityRequest
 */
export const SetRestrictVisibilityRequest = new SetRestrictVisibilityRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserAddRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.UserAddRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      { no: 5, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "suppressEmailInvite", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.nodeId = 0n;
    message.encryptedData = new Uint8Array(0);
    message.keyType = 0;
    message.fullName = "";
    message.jobTitle = "";
    message.email = "";
    message.suppressEmailInvite = false;
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
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedData */ 3:
          message.encryptedData = reader.bytes();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 4:
          message.keyType = reader.int32();
          break;
        case /* string fullName */ 5:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 6:
          message.jobTitle = reader.string();
          break;
        case /* string email */ 7:
          message.email = reader.string();
          break;
        case /* bool suppressEmailInvite */ 8:
          message.suppressEmailInvite = reader.bool();
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
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* bytes encryptedData = 3; */
    if (message.encryptedData.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedData);
    /* Enterprise.EncryptedKeyType keyType = 4; */
    if (message.keyType !== 0) writer.tag(4, WireType.Varint).int32(message.keyType);
    /* string fullName = 5; */
    if (message.fullName !== "") writer.tag(5, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 6; */
    if (message.jobTitle !== "") writer.tag(6, WireType.LengthDelimited).string(message.jobTitle);
    /* string email = 7; */
    if (message.email !== "") writer.tag(7, WireType.LengthDelimited).string(message.email);
    /* bool suppressEmailInvite = 8; */
    if (message.suppressEmailInvite !== false)
      writer.tag(8, WireType.Varint).bool(message.suppressEmailInvite);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserAddRequest
 */
export const UserAddRequest = new UserAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserUpdateRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.UserUpdateRequest", [
      {
        no: 1,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserUpdate,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.users = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.UserUpdate users */ 1:
          message.users.push(UserUpdate.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Enterprise.UserUpdate users = 1; */
    for (let i = 0; i < message.users.length; i++)
      UserUpdate.internalBinaryWrite(
        message.users[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserUpdateRequest
 */
export const UserUpdateRequest = new UserUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserUpdate$Type extends MessageType {
  constructor() {
    super("Enterprise.UserUpdate", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      { no: 5, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.nodeId = 0n;
    message.encryptedData = new Uint8Array(0);
    message.keyType = 0;
    message.fullName = "";
    message.jobTitle = "";
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* int64 nodeId */ 2:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* bytes encryptedData */ 3:
          message.encryptedData = reader.bytes();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 4:
          message.keyType = reader.int32();
          break;
        case /* string fullName */ 5:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 6:
          message.jobTitle = reader.string();
          break;
        case /* string email */ 7:
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* int64 nodeId = 2; */
    if (message.nodeId !== 0n) writer.tag(2, WireType.Varint).int64(message.nodeId);
    /* bytes encryptedData = 3; */
    if (message.encryptedData.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.encryptedData);
    /* Enterprise.EncryptedKeyType keyType = 4; */
    if (message.keyType !== 0) writer.tag(4, WireType.Varint).int32(message.keyType);
    /* string fullName = 5; */
    if (message.fullName !== "") writer.tag(5, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 6; */
    if (message.jobTitle !== "") writer.tag(6, WireType.LengthDelimited).string(message.jobTitle);
    /* string email = 7; */
    if (message.email !== "") writer.tag(7, WireType.LengthDelimited).string(message.email);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserUpdate
 */
export const UserUpdate = new UserUpdate$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserUpdateResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.UserUpdateResponse", [
      {
        no: 1,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserUpdateResult,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.users = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.UserUpdateResult users */ 1:
          message.users.push(UserUpdateResult.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Enterprise.UserUpdateResult users = 1; */
    for (let i = 0; i < message.users.length; i++)
      UserUpdateResult.internalBinaryWrite(
        message.users[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserUpdateResponse
 */
export const UserUpdateResponse = new UserUpdateResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserUpdateResult$Type extends MessageType {
  constructor() {
    super("Enterprise.UserUpdateResult", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Enterprise.UserUpdateStatus", UserUpdateStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* Enterprise.UserUpdateStatus status */ 2:
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* Enterprise.UserUpdateStatus status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserUpdateResult
 */
export const UserUpdateResult = new UserUpdateResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceRecordOwnersRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceRecordOwnersRequest", [
      {
        no: 1,
        name: "nodeIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "includeNonShared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeIds = [];
    message.includeNonShared = false;
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
        case /* bool includeNonShared */ 2:
          message.includeNonShared = reader.bool();
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
    /* bool includeNonShared = 2; */
    if (message.includeNonShared !== false)
      writer.tag(2, WireType.Varint).bool(message.includeNonShared);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceRecordOwnersRequest
 */
export const ComplianceRecordOwnersRequest = new ComplianceRecordOwnersRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceRecordOwnersResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceRecordOwnersResponse", [
      {
        no: 1,
        name: "recordOwners",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordOwner,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordOwners = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.RecordOwner recordOwners */ 1:
          message.recordOwners.push(
            RecordOwner.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.RecordOwner recordOwners = 1; */
    for (let i = 0; i < message.recordOwners.length; i++)
      RecordOwner.internalBinaryWrite(
        message.recordOwners[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceRecordOwnersResponse
 */
export const ComplianceRecordOwnersResponse = new ComplianceRecordOwnersResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordOwner$Type extends MessageType {
  constructor() {
    super("Enterprise.RecordOwner", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "shared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.shared = false;
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
        case /* bool shared */ 2:
          message.shared = reader.bool();
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
    /* bool shared = 2; */
    if (message.shared !== false) writer.tag(2, WireType.Varint).bool(message.shared);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RecordOwner
 */
export const RecordOwner = new RecordOwner$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreliminaryComplianceDataRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.PreliminaryComplianceDataRequest", [
      {
        no: 1,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "includeNonShared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "includeTotalMatchingRecordsInFirstResponse",
        kind: "scalar",
        T: 8 /*ScalarType.BOOL*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserIds = [];
    message.includeNonShared = false;
    message.continuationToken = new Uint8Array(0);
    message.includeTotalMatchingRecordsInFirstResponse = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated int64 enterpriseUserIds */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
          break;
        case /* bool includeNonShared */ 2:
          message.includeNonShared = reader.bool();
          break;
        case /* bytes continuationToken */ 3:
          message.continuationToken = reader.bytes();
          break;
        case /* bool includeTotalMatchingRecordsInFirstResponse */ 4:
          message.includeTotalMatchingRecordsInFirstResponse = reader.bool();
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
    /* repeated int64 enterpriseUserIds = 1; */
    if (message.enterpriseUserIds.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    /* bool includeNonShared = 2; */
    if (message.includeNonShared !== false)
      writer.tag(2, WireType.Varint).bool(message.includeNonShared);
    /* bytes continuationToken = 3; */
    if (message.continuationToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.continuationToken);
    /* bool includeTotalMatchingRecordsInFirstResponse = 4; */
    if (message.includeTotalMatchingRecordsInFirstResponse !== false)
      writer.tag(4, WireType.Varint).bool(message.includeTotalMatchingRecordsInFirstResponse);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.PreliminaryComplianceDataRequest
 */
export const PreliminaryComplianceDataRequest = new PreliminaryComplianceDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreliminaryComplianceDataResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.PreliminaryComplianceDataResponse", [
      {
        no: 1,
        name: "auditUserData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditUserData,
      },
      { no: 2, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "hasMore", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "totalMatchingRecords", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.auditUserData = [];
    message.continuationToken = new Uint8Array(0);
    message.hasMore = false;
    message.totalMatchingRecords = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.AuditUserData auditUserData */ 1:
          message.auditUserData.push(
            AuditUserData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bytes continuationToken */ 2:
          message.continuationToken = reader.bytes();
          break;
        case /* bool hasMore */ 3:
          message.hasMore = reader.bool();
          break;
        case /* int32 totalMatchingRecords */ 4:
          message.totalMatchingRecords = reader.int32();
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
    /* repeated Enterprise.AuditUserData auditUserData = 1; */
    for (let i = 0; i < message.auditUserData.length; i++)
      AuditUserData.internalBinaryWrite(
        message.auditUserData[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes continuationToken = 2; */
    if (message.continuationToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.continuationToken);
    /* bool hasMore = 3; */
    if (message.hasMore !== false) writer.tag(3, WireType.Varint).bool(message.hasMore);
    /* int32 totalMatchingRecords = 4; */
    if (message.totalMatchingRecords !== 0)
      writer.tag(4, WireType.Varint).int32(message.totalMatchingRecords);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.PreliminaryComplianceDataResponse
 */
export const PreliminaryComplianceDataResponse = new PreliminaryComplianceDataResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditUserRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditUserRecord", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "shared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.encryptedData = new Uint8Array(0);
    message.shared = false;
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
        case /* bytes encryptedData */ 2:
          message.encryptedData = reader.bytes();
          break;
        case /* bool shared */ 3:
          message.shared = reader.bool();
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
    /* bytes encryptedData = 2; */
    if (message.encryptedData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedData);
    /* bool shared = 3; */
    if (message.shared !== false) writer.tag(3, WireType.Varint).bool(message.shared);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditUserRecord
 */
export const AuditUserRecord = new AuditUserRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditUserData$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditUserData", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "auditUserRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditUserRecord,
      },
      {
        no: 3,
        name: "status",
        kind: "enum",
        T: () => ["Enterprise.AuditUserStatus", AuditUserStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.auditUserRecords = [];
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* repeated Enterprise.AuditUserRecord auditUserRecords */ 2:
          message.auditUserRecords.push(
            AuditUserRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Enterprise.AuditUserStatus status */ 3:
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* repeated Enterprise.AuditUserRecord auditUserRecords = 2; */
    for (let i = 0; i < message.auditUserRecords.length; i++)
      AuditUserRecord.internalBinaryWrite(
        message.auditUserRecords[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Enterprise.AuditUserStatus status = 3; */
    if (message.status !== 0) writer.tag(3, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditUserData
 */
export const AuditUserData = new AuditUserData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportFilters$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportFilters", [
      {
        no: 1,
        name: "recordTitles",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 2,
        name: "recordUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 3,
        name: "jobTitles",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "urls",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 5,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordTitles = [];
    message.recordUids = [];
    message.jobTitles = [];
    message.urls = [];
    message.enterpriseUserIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string recordTitles */ 1:
          message.recordTitles.push(reader.string());
          break;
        case /* repeated bytes recordUids */ 2:
          message.recordUids.push(reader.bytes());
          break;
        case /* repeated int64 jobTitles */ 3:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.jobTitles.push(reader.int64().toBigInt());
          else message.jobTitles.push(reader.int64().toBigInt());
          break;
        case /* repeated string urls */ 4:
          message.urls.push(reader.string());
          break;
        case /* repeated int64 enterpriseUserIds */ 5:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
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
    /* repeated string recordTitles = 1; */
    for (let i = 0; i < message.recordTitles.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.recordTitles[i]);
    /* repeated bytes recordUids = 2; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recordUids[i]);
    /* repeated int64 jobTitles = 3; */
    if (message.jobTitles.length) {
      writer.tag(3, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.jobTitles.length; i++) writer.int64(message.jobTitles[i]);
      writer.join();
    }
    /* repeated string urls = 4; */
    for (let i = 0; i < message.urls.length; i++)
      writer.tag(4, WireType.LengthDelimited).string(message.urls[i]);
    /* repeated int64 enterpriseUserIds = 5; */
    if (message.enterpriseUserIds.length) {
      writer.tag(5, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportFilters
 */
export const ComplianceReportFilters = new ComplianceReportFilters$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportRequest", [
      { no: 1, name: "complianceReportRun", kind: "message", T: () => ComplianceReportRun },
      { no: 2, name: "reportName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "saveReport", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reportName = "";
    message.saveReport = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Enterprise.ComplianceReportRun complianceReportRun */ 1:
          message.complianceReportRun = ComplianceReportRun.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.complianceReportRun,
          );
          break;
        case /* string reportName */ 2:
          message.reportName = reader.string();
          break;
        case /* bool saveReport */ 3:
          message.saveReport = reader.bool();
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
    /* Enterprise.ComplianceReportRun complianceReportRun = 1; */
    if (message.complianceReportRun)
      ComplianceReportRun.internalBinaryWrite(
        message.complianceReportRun,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string reportName = 2; */
    if (message.reportName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.reportName);
    /* bool saveReport = 3; */
    if (message.saveReport !== false) writer.tag(3, WireType.Varint).bool(message.saveReport);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportRequest
 */
export const ComplianceReportRequest = new ComplianceReportRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportRun$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportRun", [
      {
        no: 1,
        name: "reportCriteriaAndFilter",
        kind: "message",
        T: () => ComplianceReportCriteriaAndFilter,
      },
      {
        no: 2,
        name: "users",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "records",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.users = [];
    message.records = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Enterprise.ComplianceReportCriteriaAndFilter reportCriteriaAndFilter */ 1:
          message.reportCriteriaAndFilter = ComplianceReportCriteriaAndFilter.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.reportCriteriaAndFilter,
          );
          break;
        case /* repeated int64 users */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.users.push(reader.int64().toBigInt());
          else message.users.push(reader.int64().toBigInt());
          break;
        case /* repeated bytes records */ 3:
          message.records.push(reader.bytes());
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
    /* Enterprise.ComplianceReportCriteriaAndFilter reportCriteriaAndFilter = 1; */
    if (message.reportCriteriaAndFilter)
      ComplianceReportCriteriaAndFilter.internalBinaryWrite(
        message.reportCriteriaAndFilter,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated int64 users = 2; */
    if (message.users.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.users.length; i++) writer.int64(message.users[i]);
      writer.join();
    }
    /* repeated bytes records = 3; */
    for (let i = 0; i < message.records.length; i++)
      writer.tag(3, WireType.LengthDelimited).bytes(message.records[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportRun
 */
export const ComplianceReportRun = new ComplianceReportRun$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportCriteriaAndFilter$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportCriteriaAndFilter", [
      {
        no: 1,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "criteriaUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "criteriaName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "criteria", kind: "message", T: () => ComplianceReportCriteria },
      {
        no: 5,
        name: "filters",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ComplianceReportFilter,
      },
      {
        no: 6,
        name: "lastModified",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 7, name: "nodeEncryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.nodeId = 0n;
    message.criteriaUid = new Uint8Array(0);
    message.criteriaName = "";
    message.filters = [];
    message.lastModified = 0n;
    message.nodeEncryptedData = new Uint8Array(0);
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
        case /* bytes criteriaUid */ 2:
          message.criteriaUid = reader.bytes();
          break;
        case /* string criteriaName */ 3:
          message.criteriaName = reader.string();
          break;
        case /* Enterprise.ComplianceReportCriteria criteria */ 4:
          message.criteria = ComplianceReportCriteria.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.criteria,
          );
          break;
        case /* repeated Enterprise.ComplianceReportFilter filters */ 5:
          message.filters.push(
            ComplianceReportFilter.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 lastModified */ 6:
          message.lastModified = reader.int64().toBigInt();
          break;
        case /* bytes nodeEncryptedData */ 7:
          message.nodeEncryptedData = reader.bytes();
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
    /* bytes criteriaUid = 2; */
    if (message.criteriaUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.criteriaUid);
    /* string criteriaName = 3; */
    if (message.criteriaName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.criteriaName);
    /* Enterprise.ComplianceReportCriteria criteria = 4; */
    if (message.criteria)
      ComplianceReportCriteria.internalBinaryWrite(
        message.criteria,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ComplianceReportFilter filters = 5; */
    for (let i = 0; i < message.filters.length; i++)
      ComplianceReportFilter.internalBinaryWrite(
        message.filters[i],
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 lastModified = 6; */
    if (message.lastModified !== 0n) writer.tag(6, WireType.Varint).int64(message.lastModified);
    /* bytes nodeEncryptedData = 7; */
    if (message.nodeEncryptedData.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.nodeEncryptedData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportCriteriaAndFilter
 */
export const ComplianceReportCriteriaAndFilter = new ComplianceReportCriteriaAndFilter$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportCriteria$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportCriteria", [
      {
        no: 1,
        name: "jobTitles",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 2,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "includeNonShared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.jobTitles = [];
    message.enterpriseUserIds = [];
    message.includeNonShared = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string jobTitles */ 1:
          message.jobTitles.push(reader.string());
          break;
        case /* repeated int64 enterpriseUserIds */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
          break;
        case /* bool includeNonShared */ 3:
          message.includeNonShared = reader.bool();
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
    /* repeated string jobTitles = 1; */
    for (let i = 0; i < message.jobTitles.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.jobTitles[i]);
    /* repeated int64 enterpriseUserIds = 2; */
    if (message.enterpriseUserIds.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    /* bool includeNonShared = 3; */
    if (message.includeNonShared !== false)
      writer.tag(3, WireType.Varint).bool(message.includeNonShared);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportCriteria
 */
export const ComplianceReportCriteria = new ComplianceReportCriteria$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportFilter$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportFilter", [
      {
        no: 1,
        name: "recordTitles",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 2,
        name: "recordUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 3,
        name: "jobTitles",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 4,
        name: "urls",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 5,
        name: "recordTypes",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordTitles = [];
    message.recordUids = [];
    message.jobTitles = [];
    message.urls = [];
    message.recordTypes = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated string recordTitles */ 1:
          message.recordTitles.push(reader.string());
          break;
        case /* repeated bytes recordUids */ 2:
          message.recordUids.push(reader.bytes());
          break;
        case /* repeated string jobTitles */ 3:
          message.jobTitles.push(reader.string());
          break;
        case /* repeated string urls */ 4:
          message.urls.push(reader.string());
          break;
        case /* repeated string recordTypes */ 5:
          message.recordTypes.push(reader.string());
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
    /* repeated string recordTitles = 1; */
    for (let i = 0; i < message.recordTitles.length; i++)
      writer.tag(1, WireType.LengthDelimited).string(message.recordTitles[i]);
    /* repeated bytes recordUids = 2; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recordUids[i]);
    /* repeated string jobTitles = 3; */
    for (let i = 0; i < message.jobTitles.length; i++)
      writer.tag(3, WireType.LengthDelimited).string(message.jobTitles[i]);
    /* repeated string urls = 4; */
    for (let i = 0; i < message.urls.length; i++)
      writer.tag(4, WireType.LengthDelimited).string(message.urls[i]);
    /* repeated string recordTypes = 5; */
    for (let i = 0; i < message.recordTypes.length; i++)
      writer.tag(5, WireType.LengthDelimited).string(message.recordTypes[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportFilter
 */
export const ComplianceReportFilter = new ComplianceReportFilter$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportResponse", [
      {
        no: 1,
        name: "dateGenerated",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "runByUserName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "reportName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "reportUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "complianceReportRun", kind: "message", T: () => ComplianceReportRun },
      {
        no: 6,
        name: "userProfiles",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserProfile,
      },
      {
        no: 7,
        name: "auditTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditTeam,
      },
      {
        no: 8,
        name: "auditRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditRecord,
      },
      {
        no: 9,
        name: "userRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserRecord,
      },
      {
        no: 10,
        name: "sharedFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderRecord,
      },
      {
        no: 11,
        name: "sharedFolderUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderUser,
      },
      {
        no: 12,
        name: "sharedFolderTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderTeam,
      },
      {
        no: 13,
        name: "auditTeamUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditTeamUser,
      },
      {
        no: 14,
        name: "auditRoles",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => AuditRole,
      },
      {
        no: 15,
        name: "linkedRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => LinkedRecord,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.dateGenerated = 0n;
    message.runByUserName = "";
    message.reportName = "";
    message.reportUid = new Uint8Array(0);
    message.userProfiles = [];
    message.auditTeams = [];
    message.auditRecords = [];
    message.userRecords = [];
    message.sharedFolderRecords = [];
    message.sharedFolderUsers = [];
    message.sharedFolderTeams = [];
    message.auditTeamUsers = [];
    message.auditRoles = [];
    message.linkedRecords = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 dateGenerated */ 1:
          message.dateGenerated = reader.int64().toBigInt();
          break;
        case /* string runByUserName */ 2:
          message.runByUserName = reader.string();
          break;
        case /* string reportName */ 3:
          message.reportName = reader.string();
          break;
        case /* bytes reportUid */ 4:
          message.reportUid = reader.bytes();
          break;
        case /* Enterprise.ComplianceReportRun complianceReportRun */ 5:
          message.complianceReportRun = ComplianceReportRun.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.complianceReportRun,
          );
          break;
        case /* repeated Enterprise.UserProfile userProfiles */ 6:
          message.userProfiles.push(
            UserProfile.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.AuditTeam auditTeams */ 7:
          message.auditTeams.push(AuditTeam.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.AuditRecord auditRecords */ 8:
          message.auditRecords.push(
            AuditRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.UserRecord userRecords */ 9:
          message.userRecords.push(UserRecord.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.SharedFolderRecord sharedFolderRecords */ 10:
          message.sharedFolderRecords.push(
            SharedFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.SharedFolderUser sharedFolderUsers */ 11:
          message.sharedFolderUsers.push(
            SharedFolderUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.SharedFolderTeam sharedFolderTeams */ 12:
          message.sharedFolderTeams.push(
            SharedFolderTeam.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.AuditTeamUser auditTeamUsers */ 13:
          message.auditTeamUsers.push(
            AuditTeamUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.AuditRole auditRoles */ 14:
          message.auditRoles.push(AuditRole.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Enterprise.LinkedRecord linkedRecords */ 15:
          message.linkedRecords.push(
            LinkedRecord.internalBinaryRead(reader, reader.uint32(), options),
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
    /* int64 dateGenerated = 1; */
    if (message.dateGenerated !== 0n) writer.tag(1, WireType.Varint).int64(message.dateGenerated);
    /* string runByUserName = 2; */
    if (message.runByUserName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.runByUserName);
    /* string reportName = 3; */
    if (message.reportName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.reportName);
    /* bytes reportUid = 4; */
    if (message.reportUid.length) writer.tag(4, WireType.LengthDelimited).bytes(message.reportUid);
    /* Enterprise.ComplianceReportRun complianceReportRun = 5; */
    if (message.complianceReportRun)
      ComplianceReportRun.internalBinaryWrite(
        message.complianceReportRun,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.UserProfile userProfiles = 6; */
    for (let i = 0; i < message.userProfiles.length; i++)
      UserProfile.internalBinaryWrite(
        message.userProfiles[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.AuditTeam auditTeams = 7; */
    for (let i = 0; i < message.auditTeams.length; i++)
      AuditTeam.internalBinaryWrite(
        message.auditTeams[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.AuditRecord auditRecords = 8; */
    for (let i = 0; i < message.auditRecords.length; i++)
      AuditRecord.internalBinaryWrite(
        message.auditRecords[i],
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.UserRecord userRecords = 9; */
    for (let i = 0; i < message.userRecords.length; i++)
      UserRecord.internalBinaryWrite(
        message.userRecords[i],
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.SharedFolderRecord sharedFolderRecords = 10; */
    for (let i = 0; i < message.sharedFolderRecords.length; i++)
      SharedFolderRecord.internalBinaryWrite(
        message.sharedFolderRecords[i],
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.SharedFolderUser sharedFolderUsers = 11; */
    for (let i = 0; i < message.sharedFolderUsers.length; i++)
      SharedFolderUser.internalBinaryWrite(
        message.sharedFolderUsers[i],
        writer.tag(11, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.SharedFolderTeam sharedFolderTeams = 12; */
    for (let i = 0; i < message.sharedFolderTeams.length; i++)
      SharedFolderTeam.internalBinaryWrite(
        message.sharedFolderTeams[i],
        writer.tag(12, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.AuditTeamUser auditTeamUsers = 13; */
    for (let i = 0; i < message.auditTeamUsers.length; i++)
      AuditTeamUser.internalBinaryWrite(
        message.auditTeamUsers[i],
        writer.tag(13, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.AuditRole auditRoles = 14; */
    for (let i = 0; i < message.auditRoles.length; i++)
      AuditRole.internalBinaryWrite(
        message.auditRoles[i],
        writer.tag(14, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.LinkedRecord linkedRecords = 15; */
    for (let i = 0; i < message.linkedRecords.length; i++)
      LinkedRecord.internalBinaryWrite(
        message.linkedRecords[i],
        writer.tag(15, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportResponse
 */
export const ComplianceReportResponse = new ComplianceReportResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditRecord", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "auditData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "hasAttachments", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "inTrash", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "treeLeft", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "treeRight", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.auditData = new Uint8Array(0);
    message.hasAttachments = false;
    message.inTrash = false;
    message.treeLeft = 0;
    message.treeRight = 0;
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
        case /* bytes auditData */ 2:
          message.auditData = reader.bytes();
          break;
        case /* bool hasAttachments */ 3:
          message.hasAttachments = reader.bool();
          break;
        case /* bool inTrash */ 4:
          message.inTrash = reader.bool();
          break;
        case /* int32 treeLeft */ 5:
          message.treeLeft = reader.int32();
          break;
        case /* int32 treeRight */ 6:
          message.treeRight = reader.int32();
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
    /* bytes auditData = 2; */
    if (message.auditData.length) writer.tag(2, WireType.LengthDelimited).bytes(message.auditData);
    /* bool hasAttachments = 3; */
    if (message.hasAttachments !== false)
      writer.tag(3, WireType.Varint).bool(message.hasAttachments);
    /* bool inTrash = 4; */
    if (message.inTrash !== false) writer.tag(4, WireType.Varint).bool(message.inTrash);
    /* int32 treeLeft = 5; */
    if (message.treeLeft !== 0) writer.tag(5, WireType.Varint).int32(message.treeLeft);
    /* int32 treeRight = 6; */
    if (message.treeRight !== 0) writer.tag(6, WireType.Varint).int32(message.treeRight);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditRecord
 */
export const AuditRecord = new AuditRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditRole$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditRole", [
      {
        no: 1,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "restrictShareOutsideEnterprise", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "restrictShareAll", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "restrictShareOfAttachments", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 6,
        name: "restrictMaskPasswordsWhileEditing",
        kind: "scalar",
        T: 8 /*ScalarType.BOOL*/,
      },
      {
        no: 7,
        name: "roleNodeManagements",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RoleNodeManagement,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
    message.encryptedData = new Uint8Array(0);
    message.restrictShareOutsideEnterprise = false;
    message.restrictShareAll = false;
    message.restrictShareOfAttachments = false;
    message.restrictMaskPasswordsWhileEditing = false;
    message.roleNodeManagements = [];
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
        case /* bytes encryptedData */ 2:
          message.encryptedData = reader.bytes();
          break;
        case /* bool restrictShareOutsideEnterprise */ 3:
          message.restrictShareOutsideEnterprise = reader.bool();
          break;
        case /* bool restrictShareAll */ 4:
          message.restrictShareAll = reader.bool();
          break;
        case /* bool restrictShareOfAttachments */ 5:
          message.restrictShareOfAttachments = reader.bool();
          break;
        case /* bool restrictMaskPasswordsWhileEditing */ 6:
          message.restrictMaskPasswordsWhileEditing = reader.bool();
          break;
        case /* repeated Enterprise.RoleNodeManagement roleNodeManagements */ 7:
          message.roleNodeManagements.push(
            RoleNodeManagement.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes encryptedData = 2; */
    if (message.encryptedData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedData);
    /* bool restrictShareOutsideEnterprise = 3; */
    if (message.restrictShareOutsideEnterprise !== false)
      writer.tag(3, WireType.Varint).bool(message.restrictShareOutsideEnterprise);
    /* bool restrictShareAll = 4; */
    if (message.restrictShareAll !== false)
      writer.tag(4, WireType.Varint).bool(message.restrictShareAll);
    /* bool restrictShareOfAttachments = 5; */
    if (message.restrictShareOfAttachments !== false)
      writer.tag(5, WireType.Varint).bool(message.restrictShareOfAttachments);
    /* bool restrictMaskPasswordsWhileEditing = 6; */
    if (message.restrictMaskPasswordsWhileEditing !== false)
      writer.tag(6, WireType.Varint).bool(message.restrictMaskPasswordsWhileEditing);
    /* repeated Enterprise.RoleNodeManagement roleNodeManagements = 7; */
    for (let i = 0; i < message.roleNodeManagements.length; i++)
      RoleNodeManagement.internalBinaryWrite(
        message.roleNodeManagements[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditRole
 */
export const AuditRole = new AuditRole$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RoleNodeManagement$Type extends MessageType {
  constructor() {
    super("Enterprise.RoleNodeManagement", [
      { no: 1, name: "treeLeft", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "treeRight", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "cascade", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "privileges", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.treeLeft = 0;
    message.treeRight = 0;
    message.cascade = false;
    message.privileges = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 treeLeft */ 1:
          message.treeLeft = reader.int32();
          break;
        case /* int32 treeRight */ 2:
          message.treeRight = reader.int32();
          break;
        case /* bool cascade */ 3:
          message.cascade = reader.bool();
          break;
        case /* int32 privileges */ 4:
          message.privileges = reader.int32();
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
    /* int32 treeLeft = 1; */
    if (message.treeLeft !== 0) writer.tag(1, WireType.Varint).int32(message.treeLeft);
    /* int32 treeRight = 2; */
    if (message.treeRight !== 0) writer.tag(2, WireType.Varint).int32(message.treeRight);
    /* bool cascade = 3; */
    if (message.cascade !== false) writer.tag(3, WireType.Varint).bool(message.cascade);
    /* int32 privileges = 4; */
    if (message.privileges !== 0) writer.tag(4, WireType.Varint).int32(message.privileges);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RoleNodeManagement
 */
export const RoleNodeManagement = new RoleNodeManagement$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserProfile$Type extends MessageType {
  constructor() {
    super("Enterprise.UserProfile", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "roleIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.fullName = "";
    message.jobTitle = "";
    message.email = "";
    message.roleIds = [];
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
        case /* string fullName */ 2:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 3:
          message.jobTitle = reader.string();
          break;
        case /* string email */ 4:
          message.email = reader.string();
          break;
        case /* repeated int64 roleIds */ 5:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.roleIds.push(reader.int64().toBigInt());
          else message.roleIds.push(reader.int64().toBigInt());
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
    /* string fullName = 2; */
    if (message.fullName !== "") writer.tag(2, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 3; */
    if (message.jobTitle !== "") writer.tag(3, WireType.LengthDelimited).string(message.jobTitle);
    /* string email = 4; */
    if (message.email !== "") writer.tag(4, WireType.LengthDelimited).string(message.email);
    /* repeated int64 roleIds = 5; */
    if (message.roleIds.length) {
      writer.tag(5, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.roleIds.length; i++) writer.int64(message.roleIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserProfile
 */
export const UserProfile = new UserProfile$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordPermission$Type extends MessageType {
  constructor() {
    super("Enterprise.RecordPermission", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "permissionBits", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.permissionBits = 0;
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
        case /* int32 permissionBits */ 2:
          message.permissionBits = reader.int32();
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
    /* int32 permissionBits = 2; */
    if (message.permissionBits !== 0) writer.tag(2, WireType.Varint).int32(message.permissionBits);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.RecordPermission
 */
export const RecordPermission = new RecordPermission$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.UserRecord", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "recordPermissions",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordPermission,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.recordPermissions = [];
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
        case /* repeated Enterprise.RecordPermission recordPermissions */ 2:
          message.recordPermissions.push(
            RecordPermission.internalBinaryRead(reader, reader.uint32(), options),
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* repeated Enterprise.RecordPermission recordPermissions = 2; */
    for (let i = 0; i < message.recordPermissions.length; i++)
      RecordPermission.internalBinaryWrite(
        message.recordPermissions[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserRecord
 */
export const UserRecord = new UserRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditTeam$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditTeam", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "teamName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "restrictEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "restrictShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.teamName = "";
    message.restrictEdit = false;
    message.restrictShare = false;
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
        case /* string teamName */ 2:
          message.teamName = reader.string();
          break;
        case /* bool restrictEdit */ 3:
          message.restrictEdit = reader.bool();
          break;
        case /* bool restrictShare */ 4:
          message.restrictShare = reader.bool();
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
    /* string teamName = 2; */
    if (message.teamName !== "") writer.tag(2, WireType.LengthDelimited).string(message.teamName);
    /* bool restrictEdit = 3; */
    if (message.restrictEdit !== false) writer.tag(3, WireType.Varint).bool(message.restrictEdit);
    /* bool restrictShare = 4; */
    if (message.restrictShare !== false) writer.tag(4, WireType.Varint).bool(message.restrictShare);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditTeam
 */
export const AuditTeam = new AuditTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AuditTeamUser$Type extends MessageType {
  constructor() {
    super("Enterprise.AuditTeamUser", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.enterpriseUserIds = [];
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
        case /* repeated int64 enterpriseUserIds */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
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
    /* repeated int64 enterpriseUserIds = 2; */
    if (message.enterpriseUserIds.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.AuditTeamUser
 */
export const AuditTeamUser = new AuditTeamUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.SharedFolderRecord", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "recordPermissions",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordPermission,
      },
      {
        no: 3,
        name: "shareAdminRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareAdminRecord,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.recordPermissions = [];
    message.shareAdminRecords = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* repeated Enterprise.RecordPermission recordPermissions */ 2:
          message.recordPermissions.push(
            RecordPermission.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Enterprise.ShareAdminRecord shareAdminRecords */ 3:
          message.shareAdminRecords.push(
            ShareAdminRecord.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* repeated Enterprise.RecordPermission recordPermissions = 2; */
    for (let i = 0; i < message.recordPermissions.length; i++)
      RecordPermission.internalBinaryWrite(
        message.recordPermissions[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Enterprise.ShareAdminRecord shareAdminRecords = 3; */
    for (let i = 0; i < message.shareAdminRecords.length; i++)
      ShareAdminRecord.internalBinaryWrite(
        message.shareAdminRecords[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SharedFolderRecord
 */
export const SharedFolderRecord = new SharedFolderRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ShareAdminRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.ShareAdminRecord", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "recordPermissionIndexes",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 5 /*ScalarType.INT32*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.recordPermissionIndexes = [];
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
        case /* repeated int32 recordPermissionIndexes */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.recordPermissionIndexes.push(reader.int32());
          else message.recordPermissionIndexes.push(reader.int32());
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
    /* repeated int32 recordPermissionIndexes = 2; */
    if (message.recordPermissionIndexes.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.recordPermissionIndexes.length; i++)
        writer.int32(message.recordPermissionIndexes[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ShareAdminRecord
 */
export const ShareAdminRecord = new ShareAdminRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderUser$Type extends MessageType {
  constructor() {
    super("Enterprise.SharedFolderUser", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.enterpriseUserIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* repeated int64 enterpriseUserIds */ 2:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* repeated int64 enterpriseUserIds = 2; */
    if (message.enterpriseUserIds.length) {
      writer.tag(2, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SharedFolderUser
 */
export const SharedFolderUser = new SharedFolderUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderTeam$Type extends MessageType {
  constructor() {
    super("Enterprise.SharedFolderTeam", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "teamUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.teamUids = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* repeated bytes teamUids */ 2:
          message.teamUids.push(reader.bytes());
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* repeated bytes teamUids = 2; */
    for (let i = 0; i < message.teamUids.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.teamUids[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SharedFolderTeam
 */
export const SharedFolderTeam = new SharedFolderTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetComplianceReportRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.GetComplianceReportRequest", [
      { no: 1, name: "reportUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.reportUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes reportUid */ 1:
          message.reportUid = reader.bytes();
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
    /* bytes reportUid = 1; */
    if (message.reportUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.reportUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetComplianceReportRequest
 */
export const GetComplianceReportRequest = new GetComplianceReportRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetComplianceReportResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.GetComplianceReportResponse", [
      { no: 1, name: "downloadUrl", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.downloadUrl = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string downloadUrl */ 1:
          message.downloadUrl = reader.string();
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
    /* string downloadUrl = 1; */
    if (message.downloadUrl !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.downloadUrl);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetComplianceReportResponse
 */
export const GetComplianceReportResponse = new GetComplianceReportResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ComplianceReportCriteriaRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ComplianceReportCriteriaRequest", [
      { no: 1, name: "criteriaUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.criteriaUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes criteriaUid */ 1:
          message.criteriaUid = reader.bytes();
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
    /* bytes criteriaUid = 1; */
    if (message.criteriaUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.criteriaUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ComplianceReportCriteriaRequest
 */
export const ComplianceReportCriteriaRequest = new ComplianceReportCriteriaRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SaveComplianceReportCriteriaResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.SaveComplianceReportCriteriaResponse", [
      { no: 1, name: "criteriaUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.criteriaUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes criteriaUid */ 1:
          message.criteriaUid = reader.bytes();
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
    /* bytes criteriaUid = 1; */
    if (message.criteriaUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.criteriaUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.SaveComplianceReportCriteriaResponse
 */
export const SaveComplianceReportCriteriaResponse = new SaveComplianceReportCriteriaResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LinkedRecord$Type extends MessageType {
  constructor() {
    super("Enterprise.LinkedRecord", [
      { no: 1, name: "ownerUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "recordUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.ownerUid = new Uint8Array(0);
    message.recordUids = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes ownerUid */ 1:
          message.ownerUid = reader.bytes();
          break;
        case /* repeated bytes recordUids */ 2:
          message.recordUids.push(reader.bytes());
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
    /* bytes ownerUid = 1; */
    if (message.ownerUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.ownerUid);
    /* repeated bytes recordUids = 2; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recordUids[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.LinkedRecord
 */
export const LinkedRecord = new LinkedRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetSharingAdminsRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.GetSharingAdminsRequest", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* string username = 3; */
    if (message.username !== "") writer.tag(3, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetSharingAdminsRequest
 */
export const GetSharingAdminsRequest = new GetSharingAdminsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserProfileExt$Type extends MessageType {
  constructor() {
    super("Enterprise.UserProfileExt", [
      { no: 1, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "isMSPMCAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "isInSharedFolder", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "isShareAdminForRequestedObject", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "isShareAdminForSharedFolderOwner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "hasAccessToObject", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.email = "";
    message.fullName = "";
    message.jobTitle = "";
    message.isMSPMCAdmin = false;
    message.isInSharedFolder = false;
    message.isShareAdminForRequestedObject = false;
    message.isShareAdminForSharedFolderOwner = false;
    message.hasAccessToObject = false;
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
        case /* string fullName */ 2:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 3:
          message.jobTitle = reader.string();
          break;
        case /* bool isMSPMCAdmin */ 4:
          message.isMSPMCAdmin = reader.bool();
          break;
        case /* bool isInSharedFolder */ 5:
          message.isInSharedFolder = reader.bool();
          break;
        case /* bool isShareAdminForRequestedObject */ 6:
          message.isShareAdminForRequestedObject = reader.bool();
          break;
        case /* bool isShareAdminForSharedFolderOwner */ 7:
          message.isShareAdminForSharedFolderOwner = reader.bool();
          break;
        case /* bool hasAccessToObject */ 8:
          message.hasAccessToObject = reader.bool();
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
    /* string fullName = 2; */
    if (message.fullName !== "") writer.tag(2, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 3; */
    if (message.jobTitle !== "") writer.tag(3, WireType.LengthDelimited).string(message.jobTitle);
    /* bool isMSPMCAdmin = 4; */
    if (message.isMSPMCAdmin !== false) writer.tag(4, WireType.Varint).bool(message.isMSPMCAdmin);
    /* bool isInSharedFolder = 5; */
    if (message.isInSharedFolder !== false)
      writer.tag(5, WireType.Varint).bool(message.isInSharedFolder);
    /* bool isShareAdminForRequestedObject = 6; */
    if (message.isShareAdminForRequestedObject !== false)
      writer.tag(6, WireType.Varint).bool(message.isShareAdminForRequestedObject);
    /* bool isShareAdminForSharedFolderOwner = 7; */
    if (message.isShareAdminForSharedFolderOwner !== false)
      writer.tag(7, WireType.Varint).bool(message.isShareAdminForSharedFolderOwner);
    /* bool hasAccessToObject = 8; */
    if (message.hasAccessToObject !== false)
      writer.tag(8, WireType.Varint).bool(message.hasAccessToObject);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UserProfileExt
 */
export const UserProfileExt = new UserProfileExt$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetSharingAdminsResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.GetSharingAdminsResponse", [
      {
        no: 1,
        name: "userProfileExts",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserProfileExt,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.userProfileExts = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.UserProfileExt userProfileExts */ 1:
          message.userProfileExts.push(
            UserProfileExt.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.UserProfileExt userProfileExts = 1; */
    for (let i = 0; i < message.userProfileExts.length; i++)
      UserProfileExt.internalBinaryWrite(
        message.userProfileExts[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.GetSharingAdminsResponse
 */
export const GetSharingAdminsResponse = new GetSharingAdminsResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddRequest", [
      {
        no: 1,
        name: "teams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamsEnterpriseUsersAddTeamRequest,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teams = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.TeamsEnterpriseUsersAddTeamRequest teams */ 1:
          message.teams.push(
            TeamsEnterpriseUsersAddTeamRequest.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.TeamsEnterpriseUsersAddTeamRequest teams = 1; */
    for (let i = 0; i < message.teams.length; i++)
      TeamsEnterpriseUsersAddTeamRequest.internalBinaryWrite(
        message.teams[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddRequest
 */
export const TeamsEnterpriseUsersAddRequest = new TeamsEnterpriseUsersAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddTeamRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddTeamRequest", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamsEnterpriseUsersAddUserRequest,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.users = [];
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
        case /* repeated Enterprise.TeamsEnterpriseUsersAddUserRequest users */ 2:
          message.users.push(
            TeamsEnterpriseUsersAddUserRequest.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes teamUid = 1; */
    if (message.teamUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.teamUid);
    /* repeated Enterprise.TeamsEnterpriseUsersAddUserRequest users = 2; */
    for (let i = 0; i < message.users.length; i++)
      TeamsEnterpriseUsersAddUserRequest.internalBinaryWrite(
        message.users[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddTeamRequest
 */
export const TeamsEnterpriseUsersAddTeamRequest = new TeamsEnterpriseUsersAddTeamRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddUserRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddUserRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "userType", kind: "enum", T: () => ["Enterprise.TeamUserType", TeamUserType] },
      { no: 3, name: "teamKey", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "typedTeamKey", kind: "message", T: () => TypedKey },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.userType = 0;
    message.teamKey = "";
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
        case /* Enterprise.TeamUserType userType */ 2:
          message.userType = reader.int32();
          break;
        case /* string teamKey */ 3:
          message.teamKey = reader.string();
          break;
        case /* Enterprise.TypedKey typedTeamKey */ 4:
          message.typedTeamKey = TypedKey.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.typedTeamKey,
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* Enterprise.TeamUserType userType = 2; */
    if (message.userType !== 0) writer.tag(2, WireType.Varint).int32(message.userType);
    /* string teamKey = 3; */
    if (message.teamKey !== "") writer.tag(3, WireType.LengthDelimited).string(message.teamKey);
    /* Enterprise.TypedKey typedTeamKey = 4; */
    if (message.typedTeamKey)
      TypedKey.internalBinaryWrite(
        message.typedTeamKey,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddUserRequest
 */
export const TeamsEnterpriseUsersAddUserRequest = new TeamsEnterpriseUsersAddUserRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TypedKey$Type extends MessageType {
  constructor() {
    super("Enterprise.TypedKey", [
      { no: 1, name: "key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = new Uint8Array(0);
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
        case /* bytes key */ 1:
          message.key = reader.bytes();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 2:
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
    /* bytes key = 1; */
    if (message.key.length) writer.tag(1, WireType.LengthDelimited).bytes(message.key);
    /* Enterprise.EncryptedKeyType keyType = 2; */
    if (message.keyType !== 0) writer.tag(2, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TypedKey
 */
export const TypedKey = new TypedKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddResponse", [
      {
        no: 1,
        name: "teams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamsEnterpriseUsersAddTeamResponse,
      },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teams = [];
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
        case /* repeated Enterprise.TeamsEnterpriseUsersAddTeamResponse teams */ 1:
          message.teams.push(
            TeamsEnterpriseUsersAddTeamResponse.internalBinaryRead(
              reader,
              reader.uint32(),
              options,
            ),
          );
          break;
        case /* int64 revision */ 2:
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
    /* repeated Enterprise.TeamsEnterpriseUsersAddTeamResponse teams = 1; */
    for (let i = 0; i < message.teams.length; i++)
      TeamsEnterpriseUsersAddTeamResponse.internalBinaryWrite(
        message.teams[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddResponse
 */
export const TeamsEnterpriseUsersAddResponse = new TeamsEnterpriseUsersAddResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddTeamResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddTeamResponse", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TeamsEnterpriseUsersAddUserResponse,
      },
      { no: 3, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "resultCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "additionalInfo", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.users = [];
    message.success = false;
    message.message = "";
    message.resultCode = "";
    message.additionalInfo = "";
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
        case /* repeated Enterprise.TeamsEnterpriseUsersAddUserResponse users */ 2:
          message.users.push(
            TeamsEnterpriseUsersAddUserResponse.internalBinaryRead(
              reader,
              reader.uint32(),
              options,
            ),
          );
          break;
        case /* bool success */ 3:
          message.success = reader.bool();
          break;
        case /* string message */ 4:
          message.message = reader.string();
          break;
        case /* string resultCode */ 5:
          message.resultCode = reader.string();
          break;
        case /* string additionalInfo */ 6:
          message.additionalInfo = reader.string();
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
    /* repeated Enterprise.TeamsEnterpriseUsersAddUserResponse users = 2; */
    for (let i = 0; i < message.users.length; i++)
      TeamsEnterpriseUsersAddUserResponse.internalBinaryWrite(
        message.users[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool success = 3; */
    if (message.success !== false) writer.tag(3, WireType.Varint).bool(message.success);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    /* string resultCode = 5; */
    if (message.resultCode !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.resultCode);
    /* string additionalInfo = 6; */
    if (message.additionalInfo !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.additionalInfo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddTeamResponse
 */
export const TeamsEnterpriseUsersAddTeamResponse = new TeamsEnterpriseUsersAddTeamResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TeamsEnterpriseUsersAddUserResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.TeamsEnterpriseUsersAddUserResponse", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "resultCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "additionalInfo", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.revision = 0n;
    message.success = false;
    message.message = "";
    message.resultCode = "";
    message.additionalInfo = "";
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
        case /* int64 revision */ 2:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bool success */ 3:
          message.success = reader.bool();
          break;
        case /* string message */ 4:
          message.message = reader.string();
          break;
        case /* string resultCode */ 5:
          message.resultCode = reader.string();
          break;
        case /* string additionalInfo */ 6:
          message.additionalInfo = reader.string();
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
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    /* bool success = 3; */
    if (message.success !== false) writer.tag(3, WireType.Varint).bool(message.success);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    /* string resultCode = 5; */
    if (message.resultCode !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.resultCode);
    /* string additionalInfo = 6; */
    if (message.additionalInfo !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.additionalInfo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.TeamsEnterpriseUsersAddUserResponse
 */
export const TeamsEnterpriseUsersAddUserResponse = new TeamsEnterpriseUsersAddUserResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainAlias$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainAlias", [
      { no: 1, name: "domain", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "alias", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "status", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.domain = "";
    message.alias = "";
    message.status = 0;
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
        case /* string domain */ 1:
          message.domain = reader.string();
          break;
        case /* string alias */ 2:
          message.alias = reader.string();
          break;
        case /* int32 status */ 3:
          message.status = reader.int32();
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
    /* string domain = 1; */
    if (message.domain !== "") writer.tag(1, WireType.LengthDelimited).string(message.domain);
    /* string alias = 2; */
    if (message.alias !== "") writer.tag(2, WireType.LengthDelimited).string(message.alias);
    /* int32 status = 3; */
    if (message.status !== 0) writer.tag(3, WireType.Varint).int32(message.status);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainAlias
 */
export const DomainAlias = new DomainAlias$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainAliasRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainAliasRequest", [
      {
        no: 1,
        name: "domainAlias",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DomainAlias,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.domainAlias = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.DomainAlias domainAlias */ 1:
          message.domainAlias.push(
            DomainAlias.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.DomainAlias domainAlias = 1; */
    for (let i = 0; i < message.domainAlias.length; i++)
      DomainAlias.internalBinaryWrite(
        message.domainAlias[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainAliasRequest
 */
export const DomainAliasRequest = new DomainAliasRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DomainAliasResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.DomainAliasResponse", [
      {
        no: 1,
        name: "domainAlias",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DomainAlias,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.domainAlias = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.DomainAlias domainAlias */ 1:
          message.domainAlias.push(
            DomainAlias.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.DomainAlias domainAlias = 1; */
    for (let i = 0; i < message.domainAlias.length; i++)
      DomainAlias.internalBinaryWrite(
        message.domainAlias[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DomainAliasResponse
 */
export const DomainAliasResponse = new DomainAliasResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersProvisionRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersProvisionRequest", [
      {
        no: 1,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUsersProvision,
      },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.users = [];
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
        case /* repeated Enterprise.EnterpriseUsersProvision users */ 1:
          message.users.push(
            EnterpriseUsersProvision.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string clientVersion */ 2:
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
    /* repeated Enterprise.EnterpriseUsersProvision users = 1; */
    for (let i = 0; i < message.users.length; i++)
      EnterpriseUsersProvision.internalBinaryWrite(
        message.users[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersProvisionRequest
 */
export const EnterpriseUsersProvisionRequest = new EnterpriseUsersProvisionRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersProvision$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersProvision", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      { no: 6, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "enterpriseUsersDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 9, name: "authVerifier", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 10, name: "encryptionParams", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 11, name: "rsaPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 12, name: "rsaEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 13, name: "eccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 14, name: "eccEncryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 15, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 16, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.username = "";
    message.nodeId = 0n;
    message.encryptedData = "";
    message.keyType = 0;
    message.fullName = "";
    message.jobTitle = "";
    message.enterpriseUsersDataKey = new Uint8Array(0);
    message.authVerifier = new Uint8Array(0);
    message.encryptionParams = new Uint8Array(0);
    message.rsaPublicKey = new Uint8Array(0);
    message.rsaEncryptedPrivateKey = new Uint8Array(0);
    message.eccPublicKey = new Uint8Array(0);
    message.eccEncryptedPrivateKey = new Uint8Array(0);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.encryptedClientKey = new Uint8Array(0);
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
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* int64 nodeId */ 3:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 4:
          message.encryptedData = reader.string();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 5:
          message.keyType = reader.int32();
          break;
        case /* string fullName */ 6:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 7:
          message.jobTitle = reader.string();
          break;
        case /* bytes enterpriseUsersDataKey */ 8:
          message.enterpriseUsersDataKey = reader.bytes();
          break;
        case /* bytes authVerifier */ 9:
          message.authVerifier = reader.bytes();
          break;
        case /* bytes encryptionParams */ 10:
          message.encryptionParams = reader.bytes();
          break;
        case /* bytes rsaPublicKey */ 11:
          message.rsaPublicKey = reader.bytes();
          break;
        case /* bytes rsaEncryptedPrivateKey */ 12:
          message.rsaEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes eccPublicKey */ 13:
          message.eccPublicKey = reader.bytes();
          break;
        case /* bytes eccEncryptedPrivateKey */ 14:
          message.eccEncryptedPrivateKey = reader.bytes();
          break;
        case /* bytes encryptedDeviceToken */ 15:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* bytes encryptedClientKey */ 16:
          message.encryptedClientKey = reader.bytes();
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
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* int64 nodeId = 3; */
    if (message.nodeId !== 0n) writer.tag(3, WireType.Varint).int64(message.nodeId);
    /* string encryptedData = 4; */
    if (message.encryptedData !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.encryptedData);
    /* Enterprise.EncryptedKeyType keyType = 5; */
    if (message.keyType !== 0) writer.tag(5, WireType.Varint).int32(message.keyType);
    /* string fullName = 6; */
    if (message.fullName !== "") writer.tag(6, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 7; */
    if (message.jobTitle !== "") writer.tag(7, WireType.LengthDelimited).string(message.jobTitle);
    /* bytes enterpriseUsersDataKey = 8; */
    if (message.enterpriseUsersDataKey.length)
      writer.tag(8, WireType.LengthDelimited).bytes(message.enterpriseUsersDataKey);
    /* bytes authVerifier = 9; */
    if (message.authVerifier.length)
      writer.tag(9, WireType.LengthDelimited).bytes(message.authVerifier);
    /* bytes encryptionParams = 10; */
    if (message.encryptionParams.length)
      writer.tag(10, WireType.LengthDelimited).bytes(message.encryptionParams);
    /* bytes rsaPublicKey = 11; */
    if (message.rsaPublicKey.length)
      writer.tag(11, WireType.LengthDelimited).bytes(message.rsaPublicKey);
    /* bytes rsaEncryptedPrivateKey = 12; */
    if (message.rsaEncryptedPrivateKey.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.rsaEncryptedPrivateKey);
    /* bytes eccPublicKey = 13; */
    if (message.eccPublicKey.length)
      writer.tag(13, WireType.LengthDelimited).bytes(message.eccPublicKey);
    /* bytes eccEncryptedPrivateKey = 14; */
    if (message.eccEncryptedPrivateKey.length)
      writer.tag(14, WireType.LengthDelimited).bytes(message.eccEncryptedPrivateKey);
    /* bytes encryptedDeviceToken = 15; */
    if (message.encryptedDeviceToken.length)
      writer.tag(15, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* bytes encryptedClientKey = 16; */
    if (message.encryptedClientKey.length)
      writer.tag(16, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersProvision
 */
export const EnterpriseUsersProvision = new EnterpriseUsersProvision$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersProvisionResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersProvisionResponse", [
      {
        no: 1,
        name: "results",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUsersProvisionResult,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.results = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.EnterpriseUsersProvisionResult results */ 1:
          message.results.push(
            EnterpriseUsersProvisionResult.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.EnterpriseUsersProvisionResult results = 1; */
    for (let i = 0; i < message.results.length; i++)
      EnterpriseUsersProvisionResult.internalBinaryWrite(
        message.results[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersProvisionResponse
 */
export const EnterpriseUsersProvisionResponse = new EnterpriseUsersProvisionResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersProvisionResult$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersProvisionResult", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "code", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "additionalInfo", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.code = "";
    message.message = "";
    message.additionalInfo = "";
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
        case /* string code */ 2:
          message.code = reader.string();
          break;
        case /* string message */ 3:
          message.message = reader.string();
          break;
        case /* string additionalInfo */ 4:
          message.additionalInfo = reader.string();
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
    /* string code = 2; */
    if (message.code !== "") writer.tag(2, WireType.LengthDelimited).string(message.code);
    /* string message = 3; */
    if (message.message !== "") writer.tag(3, WireType.LengthDelimited).string(message.message);
    /* string additionalInfo = 4; */
    if (message.additionalInfo !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.additionalInfo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersProvisionResult
 */
export const EnterpriseUsersProvisionResult = new EnterpriseUsersProvisionResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersAddRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersAddRequest", [
      {
        no: 1,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUsersAdd,
      },
      { no: 2, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.users = [];
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
        case /* repeated Enterprise.EnterpriseUsersAdd users */ 1:
          message.users.push(
            EnterpriseUsersAdd.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string clientVersion */ 2:
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
    /* repeated Enterprise.EnterpriseUsersAdd users = 1; */
    for (let i = 0; i < message.users.length; i++)
      EnterpriseUsersAdd.internalBinaryWrite(
        message.users[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string clientVersion = 2; */
    if (message.clientVersion !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.clientVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersAddRequest
 */
export const EnterpriseUsersAddRequest = new EnterpriseUsersAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersAdd$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersAdd", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "nodeId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "encryptedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "keyType",
        kind: "enum",
        T: () => ["Enterprise.EncryptedKeyType", EncryptedKeyType],
      },
      { no: 6, name: "fullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "jobTitle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "suppressEmailInvite", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 9, name: "inviteeLocale", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 10, name: "move", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 11,
        name: "roleId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.username = "";
    message.nodeId = 0n;
    message.encryptedData = "";
    message.keyType = 0;
    message.fullName = "";
    message.jobTitle = "";
    message.suppressEmailInvite = false;
    message.inviteeLocale = "";
    message.move = false;
    message.roleId = 0n;
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
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* int64 nodeId */ 3:
          message.nodeId = reader.int64().toBigInt();
          break;
        case /* string encryptedData */ 4:
          message.encryptedData = reader.string();
          break;
        case /* Enterprise.EncryptedKeyType keyType */ 5:
          message.keyType = reader.int32();
          break;
        case /* string fullName */ 6:
          message.fullName = reader.string();
          break;
        case /* string jobTitle */ 7:
          message.jobTitle = reader.string();
          break;
        case /* bool suppressEmailInvite */ 8:
          message.suppressEmailInvite = reader.bool();
          break;
        case /* string inviteeLocale */ 9:
          message.inviteeLocale = reader.string();
          break;
        case /* bool move */ 10:
          message.move = reader.bool();
          break;
        case /* int64 roleId */ 11:
          message.roleId = reader.int64().toBigInt();
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
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* int64 nodeId = 3; */
    if (message.nodeId !== 0n) writer.tag(3, WireType.Varint).int64(message.nodeId);
    /* string encryptedData = 4; */
    if (message.encryptedData !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.encryptedData);
    /* Enterprise.EncryptedKeyType keyType = 5; */
    if (message.keyType !== 0) writer.tag(5, WireType.Varint).int32(message.keyType);
    /* string fullName = 6; */
    if (message.fullName !== "") writer.tag(6, WireType.LengthDelimited).string(message.fullName);
    /* string jobTitle = 7; */
    if (message.jobTitle !== "") writer.tag(7, WireType.LengthDelimited).string(message.jobTitle);
    /* bool suppressEmailInvite = 8; */
    if (message.suppressEmailInvite !== false)
      writer.tag(8, WireType.Varint).bool(message.suppressEmailInvite);
    /* string inviteeLocale = 9; */
    if (message.inviteeLocale !== "")
      writer.tag(9, WireType.LengthDelimited).string(message.inviteeLocale);
    /* bool move = 10; */
    if (message.move !== false) writer.tag(10, WireType.Varint).bool(message.move);
    /* int64 roleId = 11; */
    if (message.roleId !== 0n) writer.tag(11, WireType.Varint).int64(message.roleId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersAdd
 */
export const EnterpriseUsersAdd = new EnterpriseUsersAdd$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersAddResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersAddResponse", [
      {
        no: 1,
        name: "results",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => EnterpriseUsersAddResult,
      },
      { no: 2, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "code", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "additionalInfo", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.results = [];
    message.success = false;
    message.code = "";
    message.message = "";
    message.additionalInfo = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.EnterpriseUsersAddResult results */ 1:
          message.results.push(
            EnterpriseUsersAddResult.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bool success */ 2:
          message.success = reader.bool();
          break;
        case /* string code */ 3:
          message.code = reader.string();
          break;
        case /* string message */ 4:
          message.message = reader.string();
          break;
        case /* string additionalInfo */ 5:
          message.additionalInfo = reader.string();
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
    /* repeated Enterprise.EnterpriseUsersAddResult results = 1; */
    for (let i = 0; i < message.results.length; i++)
      EnterpriseUsersAddResult.internalBinaryWrite(
        message.results[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool success = 2; */
    if (message.success !== false) writer.tag(2, WireType.Varint).bool(message.success);
    /* string code = 3; */
    if (message.code !== "") writer.tag(3, WireType.LengthDelimited).string(message.code);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    /* string additionalInfo = 5; */
    if (message.additionalInfo !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.additionalInfo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersAddResponse
 */
export const EnterpriseUsersAddResponse = new EnterpriseUsersAddResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterpriseUsersAddResult$Type extends MessageType {
  constructor() {
    super("Enterprise.EnterpriseUsersAddResult", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "verificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "code", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "additionalInfo", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.success = false;
    message.verificationCode = "";
    message.code = "";
    message.message = "";
    message.additionalInfo = "";
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
        case /* bool success */ 2:
          message.success = reader.bool();
          break;
        case /* string verificationCode */ 3:
          message.verificationCode = reader.string();
          break;
        case /* string code */ 4:
          message.code = reader.string();
          break;
        case /* string message */ 5:
          message.message = reader.string();
          break;
        case /* string additionalInfo */ 6:
          message.additionalInfo = reader.string();
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
    /* bool success = 2; */
    if (message.success !== false) writer.tag(2, WireType.Varint).bool(message.success);
    /* string verificationCode = 3; */
    if (message.verificationCode !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.verificationCode);
    /* string code = 4; */
    if (message.code !== "") writer.tag(4, WireType.LengthDelimited).string(message.code);
    /* string message = 5; */
    if (message.message !== "") writer.tag(5, WireType.LengthDelimited).string(message.message);
    /* string additionalInfo = 6; */
    if (message.additionalInfo !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.additionalInfo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.EnterpriseUsersAddResult
 */
export const EnterpriseUsersAddResult = new EnterpriseUsersAddResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UpdateMSPPermitsRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.UpdateMSPPermitsRequest", [
      { no: 1, name: "mspEnterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "maxAllowedLicenses", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 3,
        name: "allowedMcProducts",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 4,
        name: "allowedAddOns",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      { no: 5, name: "maxFilePlanType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "allowUnlimitedLicenses", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.mspEnterpriseId = 0;
    message.maxAllowedLicenses = 0;
    message.allowedMcProducts = [];
    message.allowedAddOns = [];
    message.maxFilePlanType = "";
    message.allowUnlimitedLicenses = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 mspEnterpriseId */ 1:
          message.mspEnterpriseId = reader.int32();
          break;
        case /* int32 maxAllowedLicenses */ 2:
          message.maxAllowedLicenses = reader.int32();
          break;
        case /* repeated string allowedMcProducts */ 3:
          message.allowedMcProducts.push(reader.string());
          break;
        case /* repeated string allowedAddOns */ 4:
          message.allowedAddOns.push(reader.string());
          break;
        case /* string maxFilePlanType */ 5:
          message.maxFilePlanType = reader.string();
          break;
        case /* bool allowUnlimitedLicenses */ 6:
          message.allowUnlimitedLicenses = reader.bool();
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
    /* int32 mspEnterpriseId = 1; */
    if (message.mspEnterpriseId !== 0)
      writer.tag(1, WireType.Varint).int32(message.mspEnterpriseId);
    /* int32 maxAllowedLicenses = 2; */
    if (message.maxAllowedLicenses !== 0)
      writer.tag(2, WireType.Varint).int32(message.maxAllowedLicenses);
    /* repeated string allowedMcProducts = 3; */
    for (let i = 0; i < message.allowedMcProducts.length; i++)
      writer.tag(3, WireType.LengthDelimited).string(message.allowedMcProducts[i]);
    /* repeated string allowedAddOns = 4; */
    for (let i = 0; i < message.allowedAddOns.length; i++)
      writer.tag(4, WireType.LengthDelimited).string(message.allowedAddOns[i]);
    /* string maxFilePlanType = 5; */
    if (message.maxFilePlanType !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.maxFilePlanType);
    /* bool allowUnlimitedLicenses = 6; */
    if (message.allowUnlimitedLicenses !== false)
      writer.tag(6, WireType.Varint).bool(message.allowUnlimitedLicenses);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.UpdateMSPPermitsRequest
 */
export const UpdateMSPPermitsRequest = new UpdateMSPPermitsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeleteEnterpriseUsersRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.DeleteEnterpriseUsersRequest", [
      {
        no: 1,
        name: "enterpriseUserIds",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated int64 enterpriseUserIds */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserIds.push(reader.int64().toBigInt());
          else message.enterpriseUserIds.push(reader.int64().toBigInt());
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
    /* repeated int64 enterpriseUserIds = 1; */
    if (message.enterpriseUserIds.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserIds.length; i++)
        writer.int64(message.enterpriseUserIds[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DeleteEnterpriseUsersRequest
 */
export const DeleteEnterpriseUsersRequest = new DeleteEnterpriseUsersRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeleteEnterpriseUserStatus$Type extends MessageType {
  constructor() {
    super("Enterprise.DeleteEnterpriseUserStatus", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Enterprise.DeleteEnterpriseUsersResult", DeleteEnterpriseUsersResult],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
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
        case /* int64 enterpriseUserId */ 1:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* Enterprise.DeleteEnterpriseUsersResult status */ 2:
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
    /* int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(1, WireType.Varint).int64(message.enterpriseUserId);
    /* Enterprise.DeleteEnterpriseUsersResult status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DeleteEnterpriseUserStatus
 */
export const DeleteEnterpriseUserStatus = new DeleteEnterpriseUserStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeleteEnterpriseUsersResponse$Type extends MessageType {
  constructor() {
    super("Enterprise.DeleteEnterpriseUsersResponse", [
      {
        no: 1,
        name: "deleteStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DeleteEnterpriseUserStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deleteStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Enterprise.DeleteEnterpriseUserStatus deleteStatus */ 1:
          message.deleteStatus.push(
            DeleteEnterpriseUserStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Enterprise.DeleteEnterpriseUserStatus deleteStatus = 1; */
    for (let i = 0; i < message.deleteStatus.length; i++)
      DeleteEnterpriseUserStatus.internalBinaryWrite(
        message.deleteStatus[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.DeleteEnterpriseUsersResponse
 */
export const DeleteEnterpriseUsersResponse = new DeleteEnterpriseUsersResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ClearSecurityDataRequest$Type extends MessageType {
  constructor() {
    super("Enterprise.ClearSecurityDataRequest", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "allUsers", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 3,
        name: "type",
        kind: "enum",
        T: () => ["Enterprise.ClearSecurityDataType", ClearSecurityDataType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = [];
    message.allUsers = false;
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
        case /* repeated int64 enterpriseUserId */ 1:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseUserId.push(reader.int64().toBigInt());
          else message.enterpriseUserId.push(reader.int64().toBigInt());
          break;
        case /* bool allUsers */ 2:
          message.allUsers = reader.bool();
          break;
        case /* Enterprise.ClearSecurityDataType type */ 3:
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
    /* repeated int64 enterpriseUserId = 1; */
    if (message.enterpriseUserId.length) {
      writer.tag(1, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseUserId.length; i++)
        writer.int64(message.enterpriseUserId[i]);
      writer.join();
    }
    /* bool allUsers = 2; */
    if (message.allUsers !== false) writer.tag(2, WireType.Varint).bool(message.allUsers);
    /* Enterprise.ClearSecurityDataType type = 3; */
    if (message.type !== 0) writer.tag(3, WireType.Varint).int32(message.type);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Enterprise.ClearSecurityDataRequest
 */
export const ClearSecurityDataRequest = new ClearSecurityDataRequest$Type();
