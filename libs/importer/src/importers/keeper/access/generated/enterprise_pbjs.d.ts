// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace Enterprise. */
export namespace Enterprise {
  /** KeyType enum. */
  enum KeyType {
    RSA = 0,
    ECC = 1,
  }

  /** RoleUserModifyStatus enum. */
  enum RoleUserModifyStatus {
    ROLE_EXISTS = 0,
    MISSING_TREE_KEY = 1,
    MISSING_ROLE_KEY = 2,
    INVALID_ENTERPRISE_USER_ID = 3,
    PENDING_ENTERPRISE_USER = 4,
    INVALID_NODE_ID = 5,
    MAY_NOT_REMOVE_SELF_FROM_ROLE = 6,
    MUST_HAVE_ONE_USER_ADMIN = 7,
  }

  /** EnterpriseType enum. */
  enum EnterpriseType {
    ENTERPRISE_STANDARD = 0,
    ENTERPRISE_MSP = 1,
  }

  /** TransferAcceptanceStatus enum. */
  enum TransferAcceptanceStatus {
    UNDEFINED = 0,
    NOT_REQUIRED = 1,
    NOT_ACCEPTED = 2,
    PARTIALLY_ACCEPTED = 3,
    ACCEPTED = 4,
  }

  /** EnterpriseDataEntity enum. */
  enum EnterpriseDataEntity {
    UNKNOWN = 0,
    NODES = 1,
    ROLES = 2,
    USERS = 3,
    TEAMS = 4,
    TEAM_USERS = 5,
    ROLE_USERS = 6,
    ROLE_PRIVILEGES = 7,
    ROLE_ENFORCEMENTS = 8,
    ROLE_TEAMS = 9,
    LICENSES = 10,
    MANAGED_NODES = 11,
    MANAGED_COMPANIES = 12,
    BRIDGES = 13,
    SCIMS = 14,
    EMAIL_PROVISION = 15,
    QUEUED_TEAMS = 16,
    QUEUED_TEAM_USERS = 17,
    SSO_SERVICES = 18,
    REPORT_FILTER_USERS = 19,
    DEVICES_REQUEST_FOR_ADMIN_APPROVAL = 20,
    USER_ALIASES = 21,
    COMPLIANCE_REPORT_CRITERIA_AND_FILTER = 22,
    COMPLIANCE_REPORTS = 23,
    QUEUED_TEAM_USERS_INCLUDING_PENDING = 24,
  }

  /** CacheStatus enum. */
  enum CacheStatus {
    KEEP = 0,
    CLEAR = 1,
  }

  /** BackupKeyType enum. */
  enum BackupKeyType {
    NO_KEY = 0,
    ENCRYPTED_BY_DATA_KEY = 1,
    ENCRYPTED_BY_PUBLIC_KEY = 2,
    ENCRYPTED_BY_DATA_KEY_GCM = 3,
    ENCRYPTED_BY_PUBLIC_KEY_ECC = 4,
  }

  /** BackupUserDataKeyType enum. */
  enum BackupUserDataKeyType {
    OWN = 0,
    SHARED_TO_ENTERPRISE = 1,
  }

  /** EncryptedKeyType enum. */
  enum EncryptedKeyType {
    KT_NO_KEY = 0,
    KT_ENCRYPTED_BY_DATA_KEY = 1,
    KT_ENCRYPTED_BY_PUBLIC_KEY = 2,
    KT_ENCRYPTED_BY_DATA_KEY_GCM = 3,
    KT_ENCRYPTED_BY_PUBLIC_KEY_ECC = 4,
  }

  /** EnterpriseFlagType enum. */
  enum EnterpriseFlagType {
    INVALID = 0,
    ALLOW_PERSONAL_LICENSE = 1,
    SPECIAL_PROVISIONING = 2,
    RECORD_TYPES = 3,
    SECRETS_MANAGER = 4,
    ENTERPRISE_LOCKED = 5,
    FORBID_KEY_TYPE_2 = 6,
    CONSOLE_ONBOARDED = 7,
    FORBID_ACCOUNT_TRANSFER = 8,
    NPS_POPUP_OPT_OUT = 9,
    SHOW_USER_ONBOARD = 10,
  }

  /** UserUpdateStatus enum. */
  enum UserUpdateStatus {
    USER_UPDATE_OK = 0,
    USER_UPDATE_ACCESS_DENIED = 1,
  }

  /** AuditUserStatus enum. */
  enum AuditUserStatus {
    OK = 0,
    ACCESS_DENIED = 1,
    NO_LONGER_IN_ENTERPRISE = 2,
  }

  /** TeamUserType enum. */
  enum TeamUserType {
    USER = 0,
    ADMIN = 1,
    ADMIN_ONLY = 2,
  }

  /** AppClientType enum. */
  enum AppClientType {
    NOT_USED = 0,
    GENERAL = 1,
    DISCOVERY_AND_ROTATION_CONTROLLER = 2,
    KCM_CONTROLLER = 3,
    SELF_DESTRUCT = 4,
  }

  /** DeleteEnterpriseUsersResult enum. */
  enum DeleteEnterpriseUsersResult {
    SUCCESS = 0,
    NOT_AN_ENTERPRISE_USER = 1,
    CANNOT_DELETE_SELF = 2,
    BRIDGE_CANNOT_DELETE_ACTIVE_USER = 3,
    ERROR = 4,
  }

  /** ClearSecurityDataType enum. */
  enum ClearSecurityDataType {
    RECALCULATE_SUMMARY_REPORT = 0,
    FORCE_CLIENT_CHECK_FOR_MISSING_DATA = 1,
    FORCE_CLIENT_RESEND_SECURITY_DATA = 2,
  }

  /** Properties of an EnterpriseKeyPairRequest. */
  interface IEnterpriseKeyPairRequest {
    /** EnterpriseKeyPairRequest enterprisePublicKey */
    enterprisePublicKey?: Uint8Array | null;

    /** EnterpriseKeyPairRequest encryptedEnterprisePrivateKey */
    encryptedEnterprisePrivateKey?: Uint8Array | null;

    /** EnterpriseKeyPairRequest keyType */
    keyType?: Enterprise.KeyType | null;
  }

  /** Represents an EnterpriseKeyPairRequest. */
  class EnterpriseKeyPairRequest implements IEnterpriseKeyPairRequest {
    /**
     * Constructs a new EnterpriseKeyPairRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseKeyPairRequest);

    /** EnterpriseKeyPairRequest enterprisePublicKey. */
    public enterprisePublicKey: Uint8Array;

    /** EnterpriseKeyPairRequest encryptedEnterprisePrivateKey. */
    public encryptedEnterprisePrivateKey: Uint8Array;

    /** EnterpriseKeyPairRequest keyType. */
    public keyType: Enterprise.KeyType;

    /**
     * Creates a new EnterpriseKeyPairRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseKeyPairRequest instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseKeyPairRequest,
    ): Enterprise.EnterpriseKeyPairRequest;

    /**
     * Encodes the specified EnterpriseKeyPairRequest message. Does not implicitly {@link Enterprise.EnterpriseKeyPairRequest.verify|verify} messages.
     * @param message EnterpriseKeyPairRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseKeyPairRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseKeyPairRequest message, length delimited. Does not implicitly {@link Enterprise.EnterpriseKeyPairRequest.verify|verify} messages.
     * @param message EnterpriseKeyPairRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseKeyPairRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseKeyPairRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseKeyPairRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseKeyPairRequest;

    /**
     * Decodes an EnterpriseKeyPairRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseKeyPairRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseKeyPairRequest;

    /**
     * Verifies an EnterpriseKeyPairRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseKeyPairRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseKeyPairRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseKeyPairRequest;

    /**
     * Creates a plain object from an EnterpriseKeyPairRequest message. Also converts values to other types if specified.
     * @param message EnterpriseKeyPairRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseKeyPairRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseKeyPairRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseKeyPairRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetTeamMemberRequest. */
  interface IGetTeamMemberRequest {
    /** GetTeamMemberRequest teamUid */
    teamUid?: Uint8Array | null;
  }

  /** Represents a GetTeamMemberRequest. */
  class GetTeamMemberRequest implements IGetTeamMemberRequest {
    /**
     * Constructs a new GetTeamMemberRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetTeamMemberRequest);

    /** GetTeamMemberRequest teamUid. */
    public teamUid: Uint8Array;

    /**
     * Creates a new GetTeamMemberRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetTeamMemberRequest instance
     */
    public static create(
      properties?: Enterprise.IGetTeamMemberRequest,
    ): Enterprise.GetTeamMemberRequest;

    /**
     * Encodes the specified GetTeamMemberRequest message. Does not implicitly {@link Enterprise.GetTeamMemberRequest.verify|verify} messages.
     * @param message GetTeamMemberRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetTeamMemberRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetTeamMemberRequest message, length delimited. Does not implicitly {@link Enterprise.GetTeamMemberRequest.verify|verify} messages.
     * @param message GetTeamMemberRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetTeamMemberRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetTeamMemberRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetTeamMemberRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetTeamMemberRequest;

    /**
     * Decodes a GetTeamMemberRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetTeamMemberRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetTeamMemberRequest;

    /**
     * Verifies a GetTeamMemberRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetTeamMemberRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetTeamMemberRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetTeamMemberRequest;

    /**
     * Creates a plain object from a GetTeamMemberRequest message. Also converts values to other types if specified.
     * @param message GetTeamMemberRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetTeamMemberRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetTeamMemberRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetTeamMemberRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUser. */
  interface IEnterpriseUser {
    /** EnterpriseUser enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUser email */
    email?: string | null;

    /** EnterpriseUser enterpriseUsername */
    enterpriseUsername?: string | null;

    /** EnterpriseUser isShareAdmin */
    isShareAdmin?: boolean | null;

    /** EnterpriseUser username */
    username?: string | null;
  }

  /** Represents an EnterpriseUser. */
  class EnterpriseUser implements IEnterpriseUser {
    /**
     * Constructs a new EnterpriseUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUser);

    /** EnterpriseUser enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUser email. */
    public email: string;

    /** EnterpriseUser enterpriseUsername. */
    public enterpriseUsername: string;

    /** EnterpriseUser isShareAdmin. */
    public isShareAdmin: boolean;

    /** EnterpriseUser username. */
    public username: string;

    /**
     * Creates a new EnterpriseUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUser instance
     */
    public static create(properties?: Enterprise.IEnterpriseUser): Enterprise.EnterpriseUser;

    /**
     * Encodes the specified EnterpriseUser message. Does not implicitly {@link Enterprise.EnterpriseUser.verify|verify} messages.
     * @param message EnterpriseUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUser message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUser.verify|verify} messages.
     * @param message EnterpriseUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUser;

    /**
     * Decodes an EnterpriseUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.EnterpriseUser;

    /**
     * Verifies an EnterpriseUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUser;

    /**
     * Creates a plain object from an EnterpriseUser message. Also converts values to other types if specified.
     * @param message EnterpriseUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetTeamMemberResponse. */
  interface IGetTeamMemberResponse {
    /** GetTeamMemberResponse enterpriseUser */
    enterpriseUser?: Enterprise.IEnterpriseUser[] | null;
  }

  /** Represents a GetTeamMemberResponse. */
  class GetTeamMemberResponse implements IGetTeamMemberResponse {
    /**
     * Constructs a new GetTeamMemberResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetTeamMemberResponse);

    /** GetTeamMemberResponse enterpriseUser. */
    public enterpriseUser: Enterprise.IEnterpriseUser[];

    /**
     * Creates a new GetTeamMemberResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetTeamMemberResponse instance
     */
    public static create(
      properties?: Enterprise.IGetTeamMemberResponse,
    ): Enterprise.GetTeamMemberResponse;

    /**
     * Encodes the specified GetTeamMemberResponse message. Does not implicitly {@link Enterprise.GetTeamMemberResponse.verify|verify} messages.
     * @param message GetTeamMemberResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetTeamMemberResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetTeamMemberResponse message, length delimited. Does not implicitly {@link Enterprise.GetTeamMemberResponse.verify|verify} messages.
     * @param message GetTeamMemberResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetTeamMemberResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetTeamMemberResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetTeamMemberResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetTeamMemberResponse;

    /**
     * Decodes a GetTeamMemberResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetTeamMemberResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetTeamMemberResponse;

    /**
     * Verifies a GetTeamMemberResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetTeamMemberResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetTeamMemberResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetTeamMemberResponse;

    /**
     * Creates a plain object from a GetTeamMemberResponse message. Also converts values to other types if specified.
     * @param message GetTeamMemberResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetTeamMemberResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetTeamMemberResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetTeamMemberResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserIds. */
  interface IEnterpriseUserIds {
    /** EnterpriseUserIds enterpriseUserId */
    enterpriseUserId?: (number | Long)[] | null;
  }

  /** Represents an EnterpriseUserIds. */
  class EnterpriseUserIds implements IEnterpriseUserIds {
    /**
     * Constructs a new EnterpriseUserIds.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserIds);

    /** EnterpriseUserIds enterpriseUserId. */
    public enterpriseUserId: (number | Long)[];

    /**
     * Creates a new EnterpriseUserIds instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserIds instance
     */
    public static create(properties?: Enterprise.IEnterpriseUserIds): Enterprise.EnterpriseUserIds;

    /**
     * Encodes the specified EnterpriseUserIds message. Does not implicitly {@link Enterprise.EnterpriseUserIds.verify|verify} messages.
     * @param message EnterpriseUserIds message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserIds,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserIds message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserIds.verify|verify} messages.
     * @param message EnterpriseUserIds message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserIds,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserIds message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserIds
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserIds;

    /**
     * Decodes an EnterpriseUserIds message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserIds
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserIds;

    /**
     * Verifies an EnterpriseUserIds message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserIds message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserIds
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUserIds;

    /**
     * Creates a plain object from an EnterpriseUserIds message. Also converts values to other types if specified.
     * @param message EnterpriseUserIds
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserIds,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserIds to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserIds
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterprisePersonalAccount. */
  interface IEnterprisePersonalAccount {
    /** EnterprisePersonalAccount email */
    email?: string | null;

    /** EnterprisePersonalAccount OBSOLETE_FIELD */
    OBSOLETE_FIELD?: Uint8Array | null;
  }

  /** Represents an EnterprisePersonalAccount. */
  class EnterprisePersonalAccount implements IEnterprisePersonalAccount {
    /**
     * Constructs a new EnterprisePersonalAccount.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterprisePersonalAccount);

    /** EnterprisePersonalAccount email. */
    public email: string;

    /** EnterprisePersonalAccount OBSOLETE_FIELD. */
    public OBSOLETE_FIELD: Uint8Array;

    /**
     * Creates a new EnterprisePersonalAccount instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterprisePersonalAccount instance
     */
    public static create(
      properties?: Enterprise.IEnterprisePersonalAccount,
    ): Enterprise.EnterprisePersonalAccount;

    /**
     * Encodes the specified EnterprisePersonalAccount message. Does not implicitly {@link Enterprise.EnterprisePersonalAccount.verify|verify} messages.
     * @param message EnterprisePersonalAccount message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterprisePersonalAccount,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterprisePersonalAccount message, length delimited. Does not implicitly {@link Enterprise.EnterprisePersonalAccount.verify|verify} messages.
     * @param message EnterprisePersonalAccount message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterprisePersonalAccount,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterprisePersonalAccount message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterprisePersonalAccount
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterprisePersonalAccount;

    /**
     * Decodes an EnterprisePersonalAccount message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterprisePersonalAccount
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterprisePersonalAccount;

    /**
     * Verifies an EnterprisePersonalAccount message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterprisePersonalAccount message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterprisePersonalAccount
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterprisePersonalAccount;

    /**
     * Creates a plain object from an EnterprisePersonalAccount message. Also converts values to other types if specified.
     * @param message EnterprisePersonalAccount
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterprisePersonalAccount,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterprisePersonalAccount to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterprisePersonalAccount
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EncryptedTeamKeyRequest. */
  interface IEncryptedTeamKeyRequest {
    /** EncryptedTeamKeyRequest teamUid */
    teamUid?: Uint8Array | null;

    /** EncryptedTeamKeyRequest encryptedTeamKey */
    encryptedTeamKey?: Uint8Array | null;

    /** EncryptedTeamKeyRequest force */
    force?: boolean | null;
  }

  /** Represents an EncryptedTeamKeyRequest. */
  class EncryptedTeamKeyRequest implements IEncryptedTeamKeyRequest {
    /**
     * Constructs a new EncryptedTeamKeyRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEncryptedTeamKeyRequest);

    /** EncryptedTeamKeyRequest teamUid. */
    public teamUid: Uint8Array;

    /** EncryptedTeamKeyRequest encryptedTeamKey. */
    public encryptedTeamKey: Uint8Array;

    /** EncryptedTeamKeyRequest force. */
    public force: boolean;

    /**
     * Creates a new EncryptedTeamKeyRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EncryptedTeamKeyRequest instance
     */
    public static create(
      properties?: Enterprise.IEncryptedTeamKeyRequest,
    ): Enterprise.EncryptedTeamKeyRequest;

    /**
     * Encodes the specified EncryptedTeamKeyRequest message. Does not implicitly {@link Enterprise.EncryptedTeamKeyRequest.verify|verify} messages.
     * @param message EncryptedTeamKeyRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEncryptedTeamKeyRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EncryptedTeamKeyRequest message, length delimited. Does not implicitly {@link Enterprise.EncryptedTeamKeyRequest.verify|verify} messages.
     * @param message EncryptedTeamKeyRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEncryptedTeamKeyRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EncryptedTeamKeyRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EncryptedTeamKeyRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EncryptedTeamKeyRequest;

    /**
     * Decodes an EncryptedTeamKeyRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EncryptedTeamKeyRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EncryptedTeamKeyRequest;

    /**
     * Verifies an EncryptedTeamKeyRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EncryptedTeamKeyRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EncryptedTeamKeyRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EncryptedTeamKeyRequest;

    /**
     * Creates a plain object from an EncryptedTeamKeyRequest message. Also converts values to other types if specified.
     * @param message EncryptedTeamKeyRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EncryptedTeamKeyRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EncryptedTeamKeyRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EncryptedTeamKeyRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ReEncryptedData. */
  interface IReEncryptedData {
    /** ReEncryptedData id */
    id?: number | Long | null;

    /** ReEncryptedData data */
    data?: string | null;
  }

  /** Represents a ReEncryptedData. */
  class ReEncryptedData implements IReEncryptedData {
    /**
     * Constructs a new ReEncryptedData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IReEncryptedData);

    /** ReEncryptedData id. */
    public id: number | Long;

    /** ReEncryptedData data. */
    public data: string;

    /**
     * Creates a new ReEncryptedData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ReEncryptedData instance
     */
    public static create(properties?: Enterprise.IReEncryptedData): Enterprise.ReEncryptedData;

    /**
     * Encodes the specified ReEncryptedData message. Does not implicitly {@link Enterprise.ReEncryptedData.verify|verify} messages.
     * @param message ReEncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IReEncryptedData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ReEncryptedData message, length delimited. Does not implicitly {@link Enterprise.ReEncryptedData.verify|verify} messages.
     * @param message ReEncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IReEncryptedData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ReEncryptedData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ReEncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ReEncryptedData;

    /**
     * Decodes a ReEncryptedData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ReEncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ReEncryptedData;

    /**
     * Verifies a ReEncryptedData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ReEncryptedData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ReEncryptedData
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ReEncryptedData;

    /**
     * Creates a plain object from a ReEncryptedData message. Also converts values to other types if specified.
     * @param message ReEncryptedData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ReEncryptedData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ReEncryptedData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ReEncryptedData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ReEncryptedRoleKey. */
  interface IReEncryptedRoleKey {
    /** ReEncryptedRoleKey roleId */
    roleId?: number | Long | null;

    /** ReEncryptedRoleKey encryptedRoleKey */
    encryptedRoleKey?: Uint8Array | null;
  }

  /** Represents a ReEncryptedRoleKey. */
  class ReEncryptedRoleKey implements IReEncryptedRoleKey {
    /**
     * Constructs a new ReEncryptedRoleKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IReEncryptedRoleKey);

    /** ReEncryptedRoleKey roleId. */
    public roleId: number | Long;

    /** ReEncryptedRoleKey encryptedRoleKey. */
    public encryptedRoleKey: Uint8Array;

    /**
     * Creates a new ReEncryptedRoleKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ReEncryptedRoleKey instance
     */
    public static create(
      properties?: Enterprise.IReEncryptedRoleKey,
    ): Enterprise.ReEncryptedRoleKey;

    /**
     * Encodes the specified ReEncryptedRoleKey message. Does not implicitly {@link Enterprise.ReEncryptedRoleKey.verify|verify} messages.
     * @param message ReEncryptedRoleKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IReEncryptedRoleKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ReEncryptedRoleKey message, length delimited. Does not implicitly {@link Enterprise.ReEncryptedRoleKey.verify|verify} messages.
     * @param message ReEncryptedRoleKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IReEncryptedRoleKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ReEncryptedRoleKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ReEncryptedRoleKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ReEncryptedRoleKey;

    /**
     * Decodes a ReEncryptedRoleKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ReEncryptedRoleKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ReEncryptedRoleKey;

    /**
     * Verifies a ReEncryptedRoleKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ReEncryptedRoleKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ReEncryptedRoleKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ReEncryptedRoleKey;

    /**
     * Creates a plain object from a ReEncryptedRoleKey message. Also converts values to other types if specified.
     * @param message ReEncryptedRoleKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ReEncryptedRoleKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ReEncryptedRoleKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ReEncryptedRoleKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ReEncryptedUserDataKey. */
  interface IReEncryptedUserDataKey {
    /** ReEncryptedUserDataKey enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** ReEncryptedUserDataKey userEncryptedDataKey */
    userEncryptedDataKey?: Uint8Array | null;
  }

  /** Represents a ReEncryptedUserDataKey. */
  class ReEncryptedUserDataKey implements IReEncryptedUserDataKey {
    /**
     * Constructs a new ReEncryptedUserDataKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IReEncryptedUserDataKey);

    /** ReEncryptedUserDataKey enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** ReEncryptedUserDataKey userEncryptedDataKey. */
    public userEncryptedDataKey: Uint8Array;

    /**
     * Creates a new ReEncryptedUserDataKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ReEncryptedUserDataKey instance
     */
    public static create(
      properties?: Enterprise.IReEncryptedUserDataKey,
    ): Enterprise.ReEncryptedUserDataKey;

    /**
     * Encodes the specified ReEncryptedUserDataKey message. Does not implicitly {@link Enterprise.ReEncryptedUserDataKey.verify|verify} messages.
     * @param message ReEncryptedUserDataKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IReEncryptedUserDataKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ReEncryptedUserDataKey message, length delimited. Does not implicitly {@link Enterprise.ReEncryptedUserDataKey.verify|verify} messages.
     * @param message ReEncryptedUserDataKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IReEncryptedUserDataKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ReEncryptedUserDataKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ReEncryptedUserDataKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ReEncryptedUserDataKey;

    /**
     * Decodes a ReEncryptedUserDataKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ReEncryptedUserDataKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ReEncryptedUserDataKey;

    /**
     * Verifies a ReEncryptedUserDataKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ReEncryptedUserDataKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ReEncryptedUserDataKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ReEncryptedUserDataKey;

    /**
     * Creates a plain object from a ReEncryptedUserDataKey message. Also converts values to other types if specified.
     * @param message ReEncryptedUserDataKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ReEncryptedUserDataKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ReEncryptedUserDataKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ReEncryptedUserDataKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NodeToManagedCompanyRequest. */
  interface INodeToManagedCompanyRequest {
    /** NodeToManagedCompanyRequest companyId */
    companyId?: number | null;

    /** NodeToManagedCompanyRequest nodes */
    nodes?: Enterprise.IReEncryptedData[] | null;

    /** NodeToManagedCompanyRequest roles */
    roles?: Enterprise.IReEncryptedData[] | null;

    /** NodeToManagedCompanyRequest users */
    users?: Enterprise.IReEncryptedData[] | null;

    /** NodeToManagedCompanyRequest roleKeys */
    roleKeys?: Enterprise.IReEncryptedRoleKey[] | null;

    /** NodeToManagedCompanyRequest teamKeys */
    teamKeys?: Enterprise.IEncryptedTeamKeyRequest[] | null;

    /** NodeToManagedCompanyRequest usersDataKeys */
    usersDataKeys?: Enterprise.IReEncryptedUserDataKey[] | null;
  }

  /** Represents a NodeToManagedCompanyRequest. */
  class NodeToManagedCompanyRequest implements INodeToManagedCompanyRequest {
    /**
     * Constructs a new NodeToManagedCompanyRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.INodeToManagedCompanyRequest);

    /** NodeToManagedCompanyRequest companyId. */
    public companyId: number;

    /** NodeToManagedCompanyRequest nodes. */
    public nodes: Enterprise.IReEncryptedData[];

    /** NodeToManagedCompanyRequest roles. */
    public roles: Enterprise.IReEncryptedData[];

    /** NodeToManagedCompanyRequest users. */
    public users: Enterprise.IReEncryptedData[];

    /** NodeToManagedCompanyRequest roleKeys. */
    public roleKeys: Enterprise.IReEncryptedRoleKey[];

    /** NodeToManagedCompanyRequest teamKeys. */
    public teamKeys: Enterprise.IEncryptedTeamKeyRequest[];

    /** NodeToManagedCompanyRequest usersDataKeys. */
    public usersDataKeys: Enterprise.IReEncryptedUserDataKey[];

    /**
     * Creates a new NodeToManagedCompanyRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NodeToManagedCompanyRequest instance
     */
    public static create(
      properties?: Enterprise.INodeToManagedCompanyRequest,
    ): Enterprise.NodeToManagedCompanyRequest;

    /**
     * Encodes the specified NodeToManagedCompanyRequest message. Does not implicitly {@link Enterprise.NodeToManagedCompanyRequest.verify|verify} messages.
     * @param message NodeToManagedCompanyRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.INodeToManagedCompanyRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NodeToManagedCompanyRequest message, length delimited. Does not implicitly {@link Enterprise.NodeToManagedCompanyRequest.verify|verify} messages.
     * @param message NodeToManagedCompanyRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.INodeToManagedCompanyRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NodeToManagedCompanyRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NodeToManagedCompanyRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.NodeToManagedCompanyRequest;

    /**
     * Decodes a NodeToManagedCompanyRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NodeToManagedCompanyRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.NodeToManagedCompanyRequest;

    /**
     * Verifies a NodeToManagedCompanyRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NodeToManagedCompanyRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NodeToManagedCompanyRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.NodeToManagedCompanyRequest;

    /**
     * Creates a plain object from a NodeToManagedCompanyRequest message. Also converts values to other types if specified.
     * @param message NodeToManagedCompanyRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.NodeToManagedCompanyRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NodeToManagedCompanyRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NodeToManagedCompanyRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleTeam. */
  interface IRoleTeam {
    /** RoleTeam roleId */
    roleId?: number | Long | null;

    /** RoleTeam teamUid */
    teamUid?: Uint8Array | null;
  }

  /** Represents a RoleTeam. */
  class RoleTeam implements IRoleTeam {
    /**
     * Constructs a new RoleTeam.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleTeam);

    /** RoleTeam roleId. */
    public roleId: number | Long;

    /** RoleTeam teamUid. */
    public teamUid: Uint8Array;

    /**
     * Creates a new RoleTeam instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleTeam instance
     */
    public static create(properties?: Enterprise.IRoleTeam): Enterprise.RoleTeam;

    /**
     * Encodes the specified RoleTeam message. Does not implicitly {@link Enterprise.RoleTeam.verify|verify} messages.
     * @param message RoleTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleTeam message, length delimited. Does not implicitly {@link Enterprise.RoleTeam.verify|verify} messages.
     * @param message RoleTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleTeam message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleTeam;

    /**
     * Decodes a RoleTeam message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleTeam;

    /**
     * Verifies a RoleTeam message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleTeam message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleTeam
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleTeam;

    /**
     * Creates a plain object from a RoleTeam message. Also converts values to other types if specified.
     * @param message RoleTeam
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleTeam,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleTeam to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleTeam
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleTeams. */
  interface IRoleTeams {
    /** RoleTeams roleTeam */
    roleTeam?: Enterprise.IRoleTeam[] | null;
  }

  /** Represents a RoleTeams. */
  class RoleTeams implements IRoleTeams {
    /**
     * Constructs a new RoleTeams.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleTeams);

    /** RoleTeams roleTeam. */
    public roleTeam: Enterprise.IRoleTeam[];

    /**
     * Creates a new RoleTeams instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleTeams instance
     */
    public static create(properties?: Enterprise.IRoleTeams): Enterprise.RoleTeams;

    /**
     * Encodes the specified RoleTeams message. Does not implicitly {@link Enterprise.RoleTeams.verify|verify} messages.
     * @param message RoleTeams message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleTeams,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleTeams message, length delimited. Does not implicitly {@link Enterprise.RoleTeams.verify|verify} messages.
     * @param message RoleTeams message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleTeams,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleTeams message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleTeams
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleTeams;

    /**
     * Decodes a RoleTeams message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleTeams
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleTeams;

    /**
     * Verifies a RoleTeams message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleTeams message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleTeams
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleTeams;

    /**
     * Creates a plain object from a RoleTeams message. Also converts values to other types if specified.
     * @param message RoleTeams
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleTeams,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleTeams to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleTeams
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUserAddKeys. */
  interface IRoleUserAddKeys {
    /** RoleUserAddKeys enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** RoleUserAddKeys treeKey */
    treeKey?: string | null;

    /** RoleUserAddKeys roleAdminKey */
    roleAdminKey?: string | null;
  }

  /** Represents a RoleUserAddKeys. */
  class RoleUserAddKeys implements IRoleUserAddKeys {
    /**
     * Constructs a new RoleUserAddKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUserAddKeys);

    /** RoleUserAddKeys enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** RoleUserAddKeys treeKey. */
    public treeKey: string;

    /** RoleUserAddKeys roleAdminKey. */
    public roleAdminKey: string;

    /**
     * Creates a new RoleUserAddKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUserAddKeys instance
     */
    public static create(properties?: Enterprise.IRoleUserAddKeys): Enterprise.RoleUserAddKeys;

    /**
     * Encodes the specified RoleUserAddKeys message. Does not implicitly {@link Enterprise.RoleUserAddKeys.verify|verify} messages.
     * @param message RoleUserAddKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUserAddKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUserAddKeys message, length delimited. Does not implicitly {@link Enterprise.RoleUserAddKeys.verify|verify} messages.
     * @param message RoleUserAddKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUserAddKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUserAddKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUserAddKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUserAddKeys;

    /**
     * Decodes a RoleUserAddKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUserAddKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUserAddKeys;

    /**
     * Verifies a RoleUserAddKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUserAddKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUserAddKeys
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUserAddKeys;

    /**
     * Creates a plain object from a RoleUserAddKeys message. Also converts values to other types if specified.
     * @param message RoleUserAddKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUserAddKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUserAddKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUserAddKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUserAdd. */
  interface IRoleUserAdd {
    /** RoleUserAdd roleId */
    roleId?: number | Long | null;

    /** RoleUserAdd roleUserAddKeys */
    roleUserAddKeys?: Enterprise.IRoleUserAddKeys[] | null;
  }

  /** Represents a RoleUserAdd. */
  class RoleUserAdd implements IRoleUserAdd {
    /**
     * Constructs a new RoleUserAdd.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUserAdd);

    /** RoleUserAdd roleId. */
    public roleId: number | Long;

    /** RoleUserAdd roleUserAddKeys. */
    public roleUserAddKeys: Enterprise.IRoleUserAddKeys[];

    /**
     * Creates a new RoleUserAdd instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUserAdd instance
     */
    public static create(properties?: Enterprise.IRoleUserAdd): Enterprise.RoleUserAdd;

    /**
     * Encodes the specified RoleUserAdd message. Does not implicitly {@link Enterprise.RoleUserAdd.verify|verify} messages.
     * @param message RoleUserAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUserAdd,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUserAdd message, length delimited. Does not implicitly {@link Enterprise.RoleUserAdd.verify|verify} messages.
     * @param message RoleUserAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUserAdd,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUserAdd message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUserAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUserAdd;

    /**
     * Decodes a RoleUserAdd message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUserAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleUserAdd;

    /**
     * Verifies a RoleUserAdd message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUserAdd message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUserAdd
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUserAdd;

    /**
     * Creates a plain object from a RoleUserAdd message. Also converts values to other types if specified.
     * @param message RoleUserAdd
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUserAdd,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUserAdd to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUserAdd
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUsersAddRequest. */
  interface IRoleUsersAddRequest {
    /** RoleUsersAddRequest roleUserAdds */
    roleUserAdds?: Enterprise.IRoleUserAdd[] | null;
  }

  /** Represents a RoleUsersAddRequest. */
  class RoleUsersAddRequest implements IRoleUsersAddRequest {
    /**
     * Constructs a new RoleUsersAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUsersAddRequest);

    /** RoleUsersAddRequest roleUserAdds. */
    public roleUserAdds: Enterprise.IRoleUserAdd[];

    /**
     * Creates a new RoleUsersAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUsersAddRequest instance
     */
    public static create(
      properties?: Enterprise.IRoleUsersAddRequest,
    ): Enterprise.RoleUsersAddRequest;

    /**
     * Encodes the specified RoleUsersAddRequest message. Does not implicitly {@link Enterprise.RoleUsersAddRequest.verify|verify} messages.
     * @param message RoleUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUsersAddRequest message, length delimited. Does not implicitly {@link Enterprise.RoleUsersAddRequest.verify|verify} messages.
     * @param message RoleUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUsersAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUsersAddRequest;

    /**
     * Decodes a RoleUsersAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUsersAddRequest;

    /**
     * Verifies a RoleUsersAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUsersAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUsersAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUsersAddRequest;

    /**
     * Creates a plain object from a RoleUsersAddRequest message. Also converts values to other types if specified.
     * @param message RoleUsersAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUsersAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUsersAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUsersAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUserAddResult. */
  interface IRoleUserAddResult {
    /** RoleUserAddResult roleId */
    roleId?: number | Long | null;

    /** RoleUserAddResult enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** RoleUserAddResult status */
    status?: Enterprise.RoleUserModifyStatus | null;

    /** RoleUserAddResult message */
    message?: string | null;
  }

  /** Represents a RoleUserAddResult. */
  class RoleUserAddResult implements IRoleUserAddResult {
    /**
     * Constructs a new RoleUserAddResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUserAddResult);

    /** RoleUserAddResult roleId. */
    public roleId: number | Long;

    /** RoleUserAddResult enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** RoleUserAddResult status. */
    public status: Enterprise.RoleUserModifyStatus;

    /** RoleUserAddResult message. */
    public message: string;

    /**
     * Creates a new RoleUserAddResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUserAddResult instance
     */
    public static create(properties?: Enterprise.IRoleUserAddResult): Enterprise.RoleUserAddResult;

    /**
     * Encodes the specified RoleUserAddResult message. Does not implicitly {@link Enterprise.RoleUserAddResult.verify|verify} messages.
     * @param message RoleUserAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUserAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUserAddResult message, length delimited. Does not implicitly {@link Enterprise.RoleUserAddResult.verify|verify} messages.
     * @param message RoleUserAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUserAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUserAddResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUserAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUserAddResult;

    /**
     * Decodes a RoleUserAddResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUserAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUserAddResult;

    /**
     * Verifies a RoleUserAddResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUserAddResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUserAddResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUserAddResult;

    /**
     * Creates a plain object from a RoleUserAddResult message. Also converts values to other types if specified.
     * @param message RoleUserAddResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUserAddResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUserAddResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUserAddResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUsersAddResponse. */
  interface IRoleUsersAddResponse {
    /** RoleUsersAddResponse results */
    results?: Enterprise.IRoleUserAddResult[] | null;
  }

  /** Represents a RoleUsersAddResponse. */
  class RoleUsersAddResponse implements IRoleUsersAddResponse {
    /**
     * Constructs a new RoleUsersAddResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUsersAddResponse);

    /** RoleUsersAddResponse results. */
    public results: Enterprise.IRoleUserAddResult[];

    /**
     * Creates a new RoleUsersAddResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUsersAddResponse instance
     */
    public static create(
      properties?: Enterprise.IRoleUsersAddResponse,
    ): Enterprise.RoleUsersAddResponse;

    /**
     * Encodes the specified RoleUsersAddResponse message. Does not implicitly {@link Enterprise.RoleUsersAddResponse.verify|verify} messages.
     * @param message RoleUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUsersAddResponse message, length delimited. Does not implicitly {@link Enterprise.RoleUsersAddResponse.verify|verify} messages.
     * @param message RoleUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUsersAddResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUsersAddResponse;

    /**
     * Decodes a RoleUsersAddResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUsersAddResponse;

    /**
     * Verifies a RoleUsersAddResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUsersAddResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUsersAddResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUsersAddResponse;

    /**
     * Creates a plain object from a RoleUsersAddResponse message. Also converts values to other types if specified.
     * @param message RoleUsersAddResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUsersAddResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUsersAddResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUsersAddResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUserRemove. */
  interface IRoleUserRemove {
    /** RoleUserRemove roleId */
    roleId?: number | Long | null;

    /** RoleUserRemove enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;
  }

  /** Represents a RoleUserRemove. */
  class RoleUserRemove implements IRoleUserRemove {
    /**
     * Constructs a new RoleUserRemove.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUserRemove);

    /** RoleUserRemove roleId. */
    public roleId: number | Long;

    /** RoleUserRemove enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /**
     * Creates a new RoleUserRemove instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUserRemove instance
     */
    public static create(properties?: Enterprise.IRoleUserRemove): Enterprise.RoleUserRemove;

    /**
     * Encodes the specified RoleUserRemove message. Does not implicitly {@link Enterprise.RoleUserRemove.verify|verify} messages.
     * @param message RoleUserRemove message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUserRemove,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUserRemove message, length delimited. Does not implicitly {@link Enterprise.RoleUserRemove.verify|verify} messages.
     * @param message RoleUserRemove message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUserRemove,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUserRemove message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUserRemove
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUserRemove;

    /**
     * Decodes a RoleUserRemove message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUserRemove
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleUserRemove;

    /**
     * Verifies a RoleUserRemove message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUserRemove message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUserRemove
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUserRemove;

    /**
     * Creates a plain object from a RoleUserRemove message. Also converts values to other types if specified.
     * @param message RoleUserRemove
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUserRemove,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUserRemove to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUserRemove
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUsersRemoveRequest. */
  interface IRoleUsersRemoveRequest {
    /** RoleUsersRemoveRequest roleUserRemoves */
    roleUserRemoves?: Enterprise.IRoleUserRemove[] | null;
  }

  /** Represents a RoleUsersRemoveRequest. */
  class RoleUsersRemoveRequest implements IRoleUsersRemoveRequest {
    /**
     * Constructs a new RoleUsersRemoveRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUsersRemoveRequest);

    /** RoleUsersRemoveRequest roleUserRemoves. */
    public roleUserRemoves: Enterprise.IRoleUserRemove[];

    /**
     * Creates a new RoleUsersRemoveRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUsersRemoveRequest instance
     */
    public static create(
      properties?: Enterprise.IRoleUsersRemoveRequest,
    ): Enterprise.RoleUsersRemoveRequest;

    /**
     * Encodes the specified RoleUsersRemoveRequest message. Does not implicitly {@link Enterprise.RoleUsersRemoveRequest.verify|verify} messages.
     * @param message RoleUsersRemoveRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUsersRemoveRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUsersRemoveRequest message, length delimited. Does not implicitly {@link Enterprise.RoleUsersRemoveRequest.verify|verify} messages.
     * @param message RoleUsersRemoveRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUsersRemoveRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUsersRemoveRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUsersRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUsersRemoveRequest;

    /**
     * Decodes a RoleUsersRemoveRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUsersRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUsersRemoveRequest;

    /**
     * Verifies a RoleUsersRemoveRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUsersRemoveRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUsersRemoveRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUsersRemoveRequest;

    /**
     * Creates a plain object from a RoleUsersRemoveRequest message. Also converts values to other types if specified.
     * @param message RoleUsersRemoveRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUsersRemoveRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUsersRemoveRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUsersRemoveRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUserRemoveResult. */
  interface IRoleUserRemoveResult {
    /** RoleUserRemoveResult roleId */
    roleId?: number | Long | null;

    /** RoleUserRemoveResult enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** RoleUserRemoveResult status */
    status?: Enterprise.RoleUserModifyStatus | null;

    /** RoleUserRemoveResult message */
    message?: string | null;
  }

  /** Represents a RoleUserRemoveResult. */
  class RoleUserRemoveResult implements IRoleUserRemoveResult {
    /**
     * Constructs a new RoleUserRemoveResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUserRemoveResult);

    /** RoleUserRemoveResult roleId. */
    public roleId: number | Long;

    /** RoleUserRemoveResult enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** RoleUserRemoveResult status. */
    public status: Enterprise.RoleUserModifyStatus;

    /** RoleUserRemoveResult message. */
    public message: string;

    /**
     * Creates a new RoleUserRemoveResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUserRemoveResult instance
     */
    public static create(
      properties?: Enterprise.IRoleUserRemoveResult,
    ): Enterprise.RoleUserRemoveResult;

    /**
     * Encodes the specified RoleUserRemoveResult message. Does not implicitly {@link Enterprise.RoleUserRemoveResult.verify|verify} messages.
     * @param message RoleUserRemoveResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUserRemoveResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUserRemoveResult message, length delimited. Does not implicitly {@link Enterprise.RoleUserRemoveResult.verify|verify} messages.
     * @param message RoleUserRemoveResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUserRemoveResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUserRemoveResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUserRemoveResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUserRemoveResult;

    /**
     * Decodes a RoleUserRemoveResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUserRemoveResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUserRemoveResult;

    /**
     * Verifies a RoleUserRemoveResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUserRemoveResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUserRemoveResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUserRemoveResult;

    /**
     * Creates a plain object from a RoleUserRemoveResult message. Also converts values to other types if specified.
     * @param message RoleUserRemoveResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUserRemoveResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUserRemoveResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUserRemoveResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUsersRemoveResponse. */
  interface IRoleUsersRemoveResponse {
    /** RoleUsersRemoveResponse results */
    results?: Enterprise.IRoleUserRemoveResult[] | null;
  }

  /** Represents a RoleUsersRemoveResponse. */
  class RoleUsersRemoveResponse implements IRoleUsersRemoveResponse {
    /**
     * Constructs a new RoleUsersRemoveResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUsersRemoveResponse);

    /** RoleUsersRemoveResponse results. */
    public results: Enterprise.IRoleUserRemoveResult[];

    /**
     * Creates a new RoleUsersRemoveResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUsersRemoveResponse instance
     */
    public static create(
      properties?: Enterprise.IRoleUsersRemoveResponse,
    ): Enterprise.RoleUsersRemoveResponse;

    /**
     * Encodes the specified RoleUsersRemoveResponse message. Does not implicitly {@link Enterprise.RoleUsersRemoveResponse.verify|verify} messages.
     * @param message RoleUsersRemoveResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUsersRemoveResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUsersRemoveResponse message, length delimited. Does not implicitly {@link Enterprise.RoleUsersRemoveResponse.verify|verify} messages.
     * @param message RoleUsersRemoveResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUsersRemoveResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUsersRemoveResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUsersRemoveResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUsersRemoveResponse;

    /**
     * Decodes a RoleUsersRemoveResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUsersRemoveResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleUsersRemoveResponse;

    /**
     * Verifies a RoleUsersRemoveResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUsersRemoveResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUsersRemoveResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUsersRemoveResponse;

    /**
     * Creates a plain object from a RoleUsersRemoveResponse message. Also converts values to other types if specified.
     * @param message RoleUsersRemoveResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUsersRemoveResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUsersRemoveResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUsersRemoveResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseRegistration. */
  interface IEnterpriseRegistration {
    /** EnterpriseRegistration encryptedTreeKey */
    encryptedTreeKey?: Uint8Array | null;

    /** EnterpriseRegistration enterpriseName */
    enterpriseName?: string | null;

    /** EnterpriseRegistration rootNodeData */
    rootNodeData?: Uint8Array | null;

    /** EnterpriseRegistration adminUserData */
    adminUserData?: Uint8Array | null;

    /** EnterpriseRegistration adminName */
    adminName?: string | null;

    /** EnterpriseRegistration roleData */
    roleData?: Uint8Array | null;

    /** EnterpriseRegistration rsaKeyPair */
    rsaKeyPair?: Enterprise.IEnterpriseKeyPairRequest | null;

    /** EnterpriseRegistration numberSeats */
    numberSeats?: number | null;

    /** EnterpriseRegistration enterpriseType */
    enterpriseType?: Enterprise.EnterpriseType | null;

    /** EnterpriseRegistration rolePublicKey */
    rolePublicKey?: Uint8Array | null;

    /** EnterpriseRegistration rolePrivateKeyEncryptedWithRoleKey */
    rolePrivateKeyEncryptedWithRoleKey?: Uint8Array | null;

    /** EnterpriseRegistration roleKeyEncryptedWithTreeKey */
    roleKeyEncryptedWithTreeKey?: Uint8Array | null;

    /** EnterpriseRegistration eccKeyPair */
    eccKeyPair?: Enterprise.IEnterpriseKeyPairRequest | null;

    /** EnterpriseRegistration allUsersRoleData */
    allUsersRoleData?: Uint8Array | null;

    /** EnterpriseRegistration roleKeyEncryptedWithUserPublicKey */
    roleKeyEncryptedWithUserPublicKey?: Uint8Array | null;

    /** EnterpriseRegistration approverRoleData */
    approverRoleData?: Uint8Array | null;
  }

  /** Represents an EnterpriseRegistration. */
  class EnterpriseRegistration implements IEnterpriseRegistration {
    /**
     * Constructs a new EnterpriseRegistration.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseRegistration);

    /** EnterpriseRegistration encryptedTreeKey. */
    public encryptedTreeKey: Uint8Array;

    /** EnterpriseRegistration enterpriseName. */
    public enterpriseName: string;

    /** EnterpriseRegistration rootNodeData. */
    public rootNodeData: Uint8Array;

    /** EnterpriseRegistration adminUserData. */
    public adminUserData: Uint8Array;

    /** EnterpriseRegistration adminName. */
    public adminName: string;

    /** EnterpriseRegistration roleData. */
    public roleData: Uint8Array;

    /** EnterpriseRegistration rsaKeyPair. */
    public rsaKeyPair?: Enterprise.IEnterpriseKeyPairRequest | null;

    /** EnterpriseRegistration numberSeats. */
    public numberSeats: number;

    /** EnterpriseRegistration enterpriseType. */
    public enterpriseType: Enterprise.EnterpriseType;

    /** EnterpriseRegistration rolePublicKey. */
    public rolePublicKey: Uint8Array;

    /** EnterpriseRegistration rolePrivateKeyEncryptedWithRoleKey. */
    public rolePrivateKeyEncryptedWithRoleKey: Uint8Array;

    /** EnterpriseRegistration roleKeyEncryptedWithTreeKey. */
    public roleKeyEncryptedWithTreeKey: Uint8Array;

    /** EnterpriseRegistration eccKeyPair. */
    public eccKeyPair?: Enterprise.IEnterpriseKeyPairRequest | null;

    /** EnterpriseRegistration allUsersRoleData. */
    public allUsersRoleData: Uint8Array;

    /** EnterpriseRegistration roleKeyEncryptedWithUserPublicKey. */
    public roleKeyEncryptedWithUserPublicKey: Uint8Array;

    /** EnterpriseRegistration approverRoleData. */
    public approverRoleData: Uint8Array;

    /**
     * Creates a new EnterpriseRegistration instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseRegistration instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseRegistration,
    ): Enterprise.EnterpriseRegistration;

    /**
     * Encodes the specified EnterpriseRegistration message. Does not implicitly {@link Enterprise.EnterpriseRegistration.verify|verify} messages.
     * @param message EnterpriseRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseRegistration,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseRegistration message, length delimited. Does not implicitly {@link Enterprise.EnterpriseRegistration.verify|verify} messages.
     * @param message EnterpriseRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseRegistration,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseRegistration message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseRegistration;

    /**
     * Decodes an EnterpriseRegistration message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseRegistration;

    /**
     * Verifies an EnterpriseRegistration message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseRegistration message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseRegistration
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseRegistration;

    /**
     * Creates a plain object from an EnterpriseRegistration message. Also converts values to other types if specified.
     * @param message EnterpriseRegistration
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseRegistration,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseRegistration to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseRegistration
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainPasswordRulesRequest. */
  interface IDomainPasswordRulesRequest {
    /** DomainPasswordRulesRequest username */
    username?: string | null;

    /** DomainPasswordRulesRequest verificationCode */
    verificationCode?: string | null;
  }

  /** Represents a DomainPasswordRulesRequest. */
  class DomainPasswordRulesRequest implements IDomainPasswordRulesRequest {
    /**
     * Constructs a new DomainPasswordRulesRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainPasswordRulesRequest);

    /** DomainPasswordRulesRequest username. */
    public username: string;

    /** DomainPasswordRulesRequest verificationCode. */
    public verificationCode: string;

    /**
     * Creates a new DomainPasswordRulesRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainPasswordRulesRequest instance
     */
    public static create(
      properties?: Enterprise.IDomainPasswordRulesRequest,
    ): Enterprise.DomainPasswordRulesRequest;

    /**
     * Encodes the specified DomainPasswordRulesRequest message. Does not implicitly {@link Enterprise.DomainPasswordRulesRequest.verify|verify} messages.
     * @param message DomainPasswordRulesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainPasswordRulesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainPasswordRulesRequest message, length delimited. Does not implicitly {@link Enterprise.DomainPasswordRulesRequest.verify|verify} messages.
     * @param message DomainPasswordRulesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainPasswordRulesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainPasswordRulesRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainPasswordRulesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainPasswordRulesRequest;

    /**
     * Decodes a DomainPasswordRulesRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainPasswordRulesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DomainPasswordRulesRequest;

    /**
     * Verifies a DomainPasswordRulesRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainPasswordRulesRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainPasswordRulesRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainPasswordRulesRequest;

    /**
     * Creates a plain object from a DomainPasswordRulesRequest message. Also converts values to other types if specified.
     * @param message DomainPasswordRulesRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainPasswordRulesRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainPasswordRulesRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainPasswordRulesRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainPasswordRulesFields. */
  interface IDomainPasswordRulesFields {
    /** DomainPasswordRulesFields type */
    type?: string | null;

    /** DomainPasswordRulesFields minimum */
    minimum?: number | null;

    /** DomainPasswordRulesFields maximum */
    maximum?: number | null;

    /** DomainPasswordRulesFields allowed */
    allowed?: boolean | null;
  }

  /** Represents a DomainPasswordRulesFields. */
  class DomainPasswordRulesFields implements IDomainPasswordRulesFields {
    /**
     * Constructs a new DomainPasswordRulesFields.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainPasswordRulesFields);

    /** DomainPasswordRulesFields type. */
    public type: string;

    /** DomainPasswordRulesFields minimum. */
    public minimum: number;

    /** DomainPasswordRulesFields maximum. */
    public maximum: number;

    /** DomainPasswordRulesFields allowed. */
    public allowed: boolean;

    /**
     * Creates a new DomainPasswordRulesFields instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainPasswordRulesFields instance
     */
    public static create(
      properties?: Enterprise.IDomainPasswordRulesFields,
    ): Enterprise.DomainPasswordRulesFields;

    /**
     * Encodes the specified DomainPasswordRulesFields message. Does not implicitly {@link Enterprise.DomainPasswordRulesFields.verify|verify} messages.
     * @param message DomainPasswordRulesFields message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainPasswordRulesFields,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainPasswordRulesFields message, length delimited. Does not implicitly {@link Enterprise.DomainPasswordRulesFields.verify|verify} messages.
     * @param message DomainPasswordRulesFields message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainPasswordRulesFields,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainPasswordRulesFields message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainPasswordRulesFields
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainPasswordRulesFields;

    /**
     * Decodes a DomainPasswordRulesFields message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainPasswordRulesFields
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DomainPasswordRulesFields;

    /**
     * Verifies a DomainPasswordRulesFields message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainPasswordRulesFields message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainPasswordRulesFields
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainPasswordRulesFields;

    /**
     * Creates a plain object from a DomainPasswordRulesFields message. Also converts values to other types if specified.
     * @param message DomainPasswordRulesFields
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainPasswordRulesFields,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainPasswordRulesFields to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainPasswordRulesFields
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a LoginToMcRequest. */
  interface ILoginToMcRequest {
    /** LoginToMcRequest mcEnterpriseId */
    mcEnterpriseId?: number | null;

    /** LoginToMcRequest messageSessionUid */
    messageSessionUid?: Uint8Array | null;
  }

  /** Represents a LoginToMcRequest. */
  class LoginToMcRequest implements ILoginToMcRequest {
    /**
     * Constructs a new LoginToMcRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ILoginToMcRequest);

    /** LoginToMcRequest mcEnterpriseId. */
    public mcEnterpriseId: number;

    /** LoginToMcRequest messageSessionUid. */
    public messageSessionUid: Uint8Array;

    /**
     * Creates a new LoginToMcRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns LoginToMcRequest instance
     */
    public static create(properties?: Enterprise.ILoginToMcRequest): Enterprise.LoginToMcRequest;

    /**
     * Encodes the specified LoginToMcRequest message. Does not implicitly {@link Enterprise.LoginToMcRequest.verify|verify} messages.
     * @param message LoginToMcRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ILoginToMcRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified LoginToMcRequest message, length delimited. Does not implicitly {@link Enterprise.LoginToMcRequest.verify|verify} messages.
     * @param message LoginToMcRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ILoginToMcRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a LoginToMcRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns LoginToMcRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.LoginToMcRequest;

    /**
     * Decodes a LoginToMcRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns LoginToMcRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.LoginToMcRequest;

    /**
     * Verifies a LoginToMcRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a LoginToMcRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns LoginToMcRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.LoginToMcRequest;

    /**
     * Creates a plain object from a LoginToMcRequest message. Also converts values to other types if specified.
     * @param message LoginToMcRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.LoginToMcRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this LoginToMcRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for LoginToMcRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a LoginToMcResponse. */
  interface ILoginToMcResponse {
    /** LoginToMcResponse encryptedSessionToken */
    encryptedSessionToken?: Uint8Array | null;

    /** LoginToMcResponse encryptedTreeKey */
    encryptedTreeKey?: string | null;
  }

  /** Represents a LoginToMcResponse. */
  class LoginToMcResponse implements ILoginToMcResponse {
    /**
     * Constructs a new LoginToMcResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ILoginToMcResponse);

    /** LoginToMcResponse encryptedSessionToken. */
    public encryptedSessionToken: Uint8Array;

    /** LoginToMcResponse encryptedTreeKey. */
    public encryptedTreeKey: string;

    /**
     * Creates a new LoginToMcResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns LoginToMcResponse instance
     */
    public static create(properties?: Enterprise.ILoginToMcResponse): Enterprise.LoginToMcResponse;

    /**
     * Encodes the specified LoginToMcResponse message. Does not implicitly {@link Enterprise.LoginToMcResponse.verify|verify} messages.
     * @param message LoginToMcResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ILoginToMcResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified LoginToMcResponse message, length delimited. Does not implicitly {@link Enterprise.LoginToMcResponse.verify|verify} messages.
     * @param message LoginToMcResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ILoginToMcResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a LoginToMcResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns LoginToMcResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.LoginToMcResponse;

    /**
     * Decodes a LoginToMcResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns LoginToMcResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.LoginToMcResponse;

    /**
     * Verifies a LoginToMcResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a LoginToMcResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns LoginToMcResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.LoginToMcResponse;

    /**
     * Creates a plain object from a LoginToMcResponse message. Also converts values to other types if specified.
     * @param message LoginToMcResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.LoginToMcResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this LoginToMcResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for LoginToMcResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainPasswordRulesResponse. */
  interface IDomainPasswordRulesResponse {
    /** DomainPasswordRulesResponse domainPasswordRulesFields */
    domainPasswordRulesFields?: Enterprise.IDomainPasswordRulesFields[] | null;
  }

  /** Represents a DomainPasswordRulesResponse. */
  class DomainPasswordRulesResponse implements IDomainPasswordRulesResponse {
    /**
     * Constructs a new DomainPasswordRulesResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainPasswordRulesResponse);

    /** DomainPasswordRulesResponse domainPasswordRulesFields. */
    public domainPasswordRulesFields: Enterprise.IDomainPasswordRulesFields[];

    /**
     * Creates a new DomainPasswordRulesResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainPasswordRulesResponse instance
     */
    public static create(
      properties?: Enterprise.IDomainPasswordRulesResponse,
    ): Enterprise.DomainPasswordRulesResponse;

    /**
     * Encodes the specified DomainPasswordRulesResponse message. Does not implicitly {@link Enterprise.DomainPasswordRulesResponse.verify|verify} messages.
     * @param message DomainPasswordRulesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainPasswordRulesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainPasswordRulesResponse message, length delimited. Does not implicitly {@link Enterprise.DomainPasswordRulesResponse.verify|verify} messages.
     * @param message DomainPasswordRulesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainPasswordRulesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainPasswordRulesResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainPasswordRulesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainPasswordRulesResponse;

    /**
     * Decodes a DomainPasswordRulesResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainPasswordRulesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DomainPasswordRulesResponse;

    /**
     * Verifies a DomainPasswordRulesResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainPasswordRulesResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainPasswordRulesResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainPasswordRulesResponse;

    /**
     * Creates a plain object from a DomainPasswordRulesResponse message. Also converts values to other types if specified.
     * @param message DomainPasswordRulesResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainPasswordRulesResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainPasswordRulesResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainPasswordRulesResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApproveUserDeviceRequest. */
  interface IApproveUserDeviceRequest {
    /** ApproveUserDeviceRequest enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** ApproveUserDeviceRequest encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** ApproveUserDeviceRequest encryptedDeviceDataKey */
    encryptedDeviceDataKey?: Uint8Array | null;

    /** ApproveUserDeviceRequest denyApproval */
    denyApproval?: boolean | null;
  }

  /** Represents an ApproveUserDeviceRequest. */
  class ApproveUserDeviceRequest implements IApproveUserDeviceRequest {
    /**
     * Constructs a new ApproveUserDeviceRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IApproveUserDeviceRequest);

    /** ApproveUserDeviceRequest enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** ApproveUserDeviceRequest encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** ApproveUserDeviceRequest encryptedDeviceDataKey. */
    public encryptedDeviceDataKey: Uint8Array;

    /** ApproveUserDeviceRequest denyApproval. */
    public denyApproval: boolean;

    /**
     * Creates a new ApproveUserDeviceRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApproveUserDeviceRequest instance
     */
    public static create(
      properties?: Enterprise.IApproveUserDeviceRequest,
    ): Enterprise.ApproveUserDeviceRequest;

    /**
     * Encodes the specified ApproveUserDeviceRequest message. Does not implicitly {@link Enterprise.ApproveUserDeviceRequest.verify|verify} messages.
     * @param message ApproveUserDeviceRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IApproveUserDeviceRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApproveUserDeviceRequest message, length delimited. Does not implicitly {@link Enterprise.ApproveUserDeviceRequest.verify|verify} messages.
     * @param message ApproveUserDeviceRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IApproveUserDeviceRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApproveUserDeviceRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApproveUserDeviceRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ApproveUserDeviceRequest;

    /**
     * Decodes an ApproveUserDeviceRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApproveUserDeviceRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ApproveUserDeviceRequest;

    /**
     * Verifies an ApproveUserDeviceRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApproveUserDeviceRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApproveUserDeviceRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ApproveUserDeviceRequest;

    /**
     * Creates a plain object from an ApproveUserDeviceRequest message. Also converts values to other types if specified.
     * @param message ApproveUserDeviceRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ApproveUserDeviceRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApproveUserDeviceRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApproveUserDeviceRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApproveUserDeviceResponse. */
  interface IApproveUserDeviceResponse {
    /** ApproveUserDeviceResponse enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** ApproveUserDeviceResponse encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** ApproveUserDeviceResponse failed */
    failed?: boolean | null;

    /** ApproveUserDeviceResponse message */
    message?: string | null;
  }

  /** Represents an ApproveUserDeviceResponse. */
  class ApproveUserDeviceResponse implements IApproveUserDeviceResponse {
    /**
     * Constructs a new ApproveUserDeviceResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IApproveUserDeviceResponse);

    /** ApproveUserDeviceResponse enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** ApproveUserDeviceResponse encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** ApproveUserDeviceResponse failed. */
    public failed: boolean;

    /** ApproveUserDeviceResponse message. */
    public message: string;

    /**
     * Creates a new ApproveUserDeviceResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApproveUserDeviceResponse instance
     */
    public static create(
      properties?: Enterprise.IApproveUserDeviceResponse,
    ): Enterprise.ApproveUserDeviceResponse;

    /**
     * Encodes the specified ApproveUserDeviceResponse message. Does not implicitly {@link Enterprise.ApproveUserDeviceResponse.verify|verify} messages.
     * @param message ApproveUserDeviceResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IApproveUserDeviceResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApproveUserDeviceResponse message, length delimited. Does not implicitly {@link Enterprise.ApproveUserDeviceResponse.verify|verify} messages.
     * @param message ApproveUserDeviceResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IApproveUserDeviceResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApproveUserDeviceResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApproveUserDeviceResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ApproveUserDeviceResponse;

    /**
     * Decodes an ApproveUserDeviceResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApproveUserDeviceResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ApproveUserDeviceResponse;

    /**
     * Verifies an ApproveUserDeviceResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApproveUserDeviceResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApproveUserDeviceResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ApproveUserDeviceResponse;

    /**
     * Creates a plain object from an ApproveUserDeviceResponse message. Also converts values to other types if specified.
     * @param message ApproveUserDeviceResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ApproveUserDeviceResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApproveUserDeviceResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApproveUserDeviceResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApproveUserDevicesRequest. */
  interface IApproveUserDevicesRequest {
    /** ApproveUserDevicesRequest deviceRequests */
    deviceRequests?: Enterprise.IApproveUserDeviceRequest[] | null;
  }

  /** Represents an ApproveUserDevicesRequest. */
  class ApproveUserDevicesRequest implements IApproveUserDevicesRequest {
    /**
     * Constructs a new ApproveUserDevicesRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IApproveUserDevicesRequest);

    /** ApproveUserDevicesRequest deviceRequests. */
    public deviceRequests: Enterprise.IApproveUserDeviceRequest[];

    /**
     * Creates a new ApproveUserDevicesRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApproveUserDevicesRequest instance
     */
    public static create(
      properties?: Enterprise.IApproveUserDevicesRequest,
    ): Enterprise.ApproveUserDevicesRequest;

    /**
     * Encodes the specified ApproveUserDevicesRequest message. Does not implicitly {@link Enterprise.ApproveUserDevicesRequest.verify|verify} messages.
     * @param message ApproveUserDevicesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IApproveUserDevicesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApproveUserDevicesRequest message, length delimited. Does not implicitly {@link Enterprise.ApproveUserDevicesRequest.verify|verify} messages.
     * @param message ApproveUserDevicesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IApproveUserDevicesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApproveUserDevicesRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApproveUserDevicesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ApproveUserDevicesRequest;

    /**
     * Decodes an ApproveUserDevicesRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApproveUserDevicesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ApproveUserDevicesRequest;

    /**
     * Verifies an ApproveUserDevicesRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApproveUserDevicesRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApproveUserDevicesRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ApproveUserDevicesRequest;

    /**
     * Creates a plain object from an ApproveUserDevicesRequest message. Also converts values to other types if specified.
     * @param message ApproveUserDevicesRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ApproveUserDevicesRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApproveUserDevicesRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApproveUserDevicesRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApproveUserDevicesResponse. */
  interface IApproveUserDevicesResponse {
    /** ApproveUserDevicesResponse deviceResponses */
    deviceResponses?: Enterprise.IApproveUserDeviceResponse[] | null;
  }

  /** Represents an ApproveUserDevicesResponse. */
  class ApproveUserDevicesResponse implements IApproveUserDevicesResponse {
    /**
     * Constructs a new ApproveUserDevicesResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IApproveUserDevicesResponse);

    /** ApproveUserDevicesResponse deviceResponses. */
    public deviceResponses: Enterprise.IApproveUserDeviceResponse[];

    /**
     * Creates a new ApproveUserDevicesResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApproveUserDevicesResponse instance
     */
    public static create(
      properties?: Enterprise.IApproveUserDevicesResponse,
    ): Enterprise.ApproveUserDevicesResponse;

    /**
     * Encodes the specified ApproveUserDevicesResponse message. Does not implicitly {@link Enterprise.ApproveUserDevicesResponse.verify|verify} messages.
     * @param message ApproveUserDevicesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IApproveUserDevicesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApproveUserDevicesResponse message, length delimited. Does not implicitly {@link Enterprise.ApproveUserDevicesResponse.verify|verify} messages.
     * @param message ApproveUserDevicesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IApproveUserDevicesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApproveUserDevicesResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApproveUserDevicesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ApproveUserDevicesResponse;

    /**
     * Decodes an ApproveUserDevicesResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApproveUserDevicesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ApproveUserDevicesResponse;

    /**
     * Verifies an ApproveUserDevicesResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApproveUserDevicesResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApproveUserDevicesResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ApproveUserDevicesResponse;

    /**
     * Creates a plain object from an ApproveUserDevicesResponse message. Also converts values to other types if specified.
     * @param message ApproveUserDevicesResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ApproveUserDevicesResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApproveUserDevicesResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApproveUserDevicesResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserDataKey. */
  interface IEnterpriseUserDataKey {
    /** EnterpriseUserDataKey enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUserDataKey userEncryptedDataKey */
    userEncryptedDataKey?: Uint8Array | null;

    /** EnterpriseUserDataKey keyTypeId */
    keyTypeId?: number | null;

    /** EnterpriseUserDataKey roleKey */
    roleKey?: Uint8Array | null;

    /** EnterpriseUserDataKey privateKey */
    privateKey?: Uint8Array | null;
  }

  /** Represents an EnterpriseUserDataKey. */
  class EnterpriseUserDataKey implements IEnterpriseUserDataKey {
    /**
     * Constructs a new EnterpriseUserDataKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserDataKey);

    /** EnterpriseUserDataKey enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUserDataKey userEncryptedDataKey. */
    public userEncryptedDataKey: Uint8Array;

    /** EnterpriseUserDataKey keyTypeId. */
    public keyTypeId: number;

    /** EnterpriseUserDataKey roleKey. */
    public roleKey: Uint8Array;

    /** EnterpriseUserDataKey privateKey. */
    public privateKey: Uint8Array;

    /**
     * Creates a new EnterpriseUserDataKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserDataKey instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUserDataKey,
    ): Enterprise.EnterpriseUserDataKey;

    /**
     * Encodes the specified EnterpriseUserDataKey message. Does not implicitly {@link Enterprise.EnterpriseUserDataKey.verify|verify} messages.
     * @param message EnterpriseUserDataKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserDataKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserDataKey message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserDataKey.verify|verify} messages.
     * @param message EnterpriseUserDataKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserDataKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserDataKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserDataKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserDataKey;

    /**
     * Decodes an EnterpriseUserDataKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserDataKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserDataKey;

    /**
     * Verifies an EnterpriseUserDataKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserDataKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserDataKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUserDataKey;

    /**
     * Creates a plain object from an EnterpriseUserDataKey message. Also converts values to other types if specified.
     * @param message EnterpriseUserDataKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserDataKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserDataKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserDataKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserDataKeys. */
  interface IEnterpriseUserDataKeys {
    /** EnterpriseUserDataKeys keys */
    keys?: Enterprise.IEnterpriseUserDataKey[] | null;
  }

  /** Represents an EnterpriseUserDataKeys. */
  class EnterpriseUserDataKeys implements IEnterpriseUserDataKeys {
    /**
     * Constructs a new EnterpriseUserDataKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserDataKeys);

    /** EnterpriseUserDataKeys keys. */
    public keys: Enterprise.IEnterpriseUserDataKey[];

    /**
     * Creates a new EnterpriseUserDataKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserDataKeys instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUserDataKeys,
    ): Enterprise.EnterpriseUserDataKeys;

    /**
     * Encodes the specified EnterpriseUserDataKeys message. Does not implicitly {@link Enterprise.EnterpriseUserDataKeys.verify|verify} messages.
     * @param message EnterpriseUserDataKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserDataKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserDataKeys message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserDataKeys.verify|verify} messages.
     * @param message EnterpriseUserDataKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserDataKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserDataKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserDataKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserDataKeys;

    /**
     * Decodes an EnterpriseUserDataKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserDataKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserDataKeys;

    /**
     * Verifies an EnterpriseUserDataKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserDataKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserDataKeys
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUserDataKeys;

    /**
     * Creates a plain object from an EnterpriseUserDataKeys message. Also converts values to other types if specified.
     * @param message EnterpriseUserDataKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserDataKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserDataKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserDataKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserDataKeyLight. */
  interface IEnterpriseUserDataKeyLight {
    /** EnterpriseUserDataKeyLight enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUserDataKeyLight userEncryptedDataKey */
    userEncryptedDataKey?: Uint8Array | null;

    /** EnterpriseUserDataKeyLight keyTypeId */
    keyTypeId?: number | null;
  }

  /** Represents an EnterpriseUserDataKeyLight. */
  class EnterpriseUserDataKeyLight implements IEnterpriseUserDataKeyLight {
    /**
     * Constructs a new EnterpriseUserDataKeyLight.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserDataKeyLight);

    /** EnterpriseUserDataKeyLight enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUserDataKeyLight userEncryptedDataKey. */
    public userEncryptedDataKey: Uint8Array;

    /** EnterpriseUserDataKeyLight keyTypeId. */
    public keyTypeId: number;

    /**
     * Creates a new EnterpriseUserDataKeyLight instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserDataKeyLight instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUserDataKeyLight,
    ): Enterprise.EnterpriseUserDataKeyLight;

    /**
     * Encodes the specified EnterpriseUserDataKeyLight message. Does not implicitly {@link Enterprise.EnterpriseUserDataKeyLight.verify|verify} messages.
     * @param message EnterpriseUserDataKeyLight message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserDataKeyLight,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserDataKeyLight message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserDataKeyLight.verify|verify} messages.
     * @param message EnterpriseUserDataKeyLight message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserDataKeyLight,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserDataKeyLight message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserDataKeyLight
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserDataKeyLight;

    /**
     * Decodes an EnterpriseUserDataKeyLight message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserDataKeyLight
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserDataKeyLight;

    /**
     * Verifies an EnterpriseUserDataKeyLight message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserDataKeyLight message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserDataKeyLight
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUserDataKeyLight;

    /**
     * Creates a plain object from an EnterpriseUserDataKeyLight message. Also converts values to other types if specified.
     * @param message EnterpriseUserDataKeyLight
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserDataKeyLight,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserDataKeyLight to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserDataKeyLight
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserDataKeysByNode. */
  interface IEnterpriseUserDataKeysByNode {
    /** EnterpriseUserDataKeysByNode nodeId */
    nodeId?: number | Long | null;

    /** EnterpriseUserDataKeysByNode keys */
    keys?: Enterprise.IEnterpriseUserDataKeyLight[] | null;
  }

  /** Represents an EnterpriseUserDataKeysByNode. */
  class EnterpriseUserDataKeysByNode implements IEnterpriseUserDataKeysByNode {
    /**
     * Constructs a new EnterpriseUserDataKeysByNode.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserDataKeysByNode);

    /** EnterpriseUserDataKeysByNode nodeId. */
    public nodeId: number | Long;

    /** EnterpriseUserDataKeysByNode keys. */
    public keys: Enterprise.IEnterpriseUserDataKeyLight[];

    /**
     * Creates a new EnterpriseUserDataKeysByNode instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserDataKeysByNode instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUserDataKeysByNode,
    ): Enterprise.EnterpriseUserDataKeysByNode;

    /**
     * Encodes the specified EnterpriseUserDataKeysByNode message. Does not implicitly {@link Enterprise.EnterpriseUserDataKeysByNode.verify|verify} messages.
     * @param message EnterpriseUserDataKeysByNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserDataKeysByNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserDataKeysByNode message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserDataKeysByNode.verify|verify} messages.
     * @param message EnterpriseUserDataKeysByNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserDataKeysByNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserDataKeysByNode message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserDataKeysByNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserDataKeysByNode;

    /**
     * Decodes an EnterpriseUserDataKeysByNode message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserDataKeysByNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserDataKeysByNode;

    /**
     * Verifies an EnterpriseUserDataKeysByNode message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserDataKeysByNode message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserDataKeysByNode
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUserDataKeysByNode;

    /**
     * Creates a plain object from an EnterpriseUserDataKeysByNode message. Also converts values to other types if specified.
     * @param message EnterpriseUserDataKeysByNode
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserDataKeysByNode,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserDataKeysByNode to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserDataKeysByNode
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUserDataKeysByNodeResponse. */
  interface IEnterpriseUserDataKeysByNodeResponse {
    /** EnterpriseUserDataKeysByNodeResponse keys */
    keys?: Enterprise.IEnterpriseUserDataKeysByNode[] | null;
  }

  /** Represents an EnterpriseUserDataKeysByNodeResponse. */
  class EnterpriseUserDataKeysByNodeResponse implements IEnterpriseUserDataKeysByNodeResponse {
    /**
     * Constructs a new EnterpriseUserDataKeysByNodeResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUserDataKeysByNodeResponse);

    /** EnterpriseUserDataKeysByNodeResponse keys. */
    public keys: Enterprise.IEnterpriseUserDataKeysByNode[];

    /**
     * Creates a new EnterpriseUserDataKeysByNodeResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUserDataKeysByNodeResponse instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUserDataKeysByNodeResponse,
    ): Enterprise.EnterpriseUserDataKeysByNodeResponse;

    /**
     * Encodes the specified EnterpriseUserDataKeysByNodeResponse message. Does not implicitly {@link Enterprise.EnterpriseUserDataKeysByNodeResponse.verify|verify} messages.
     * @param message EnterpriseUserDataKeysByNodeResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUserDataKeysByNodeResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUserDataKeysByNodeResponse message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUserDataKeysByNodeResponse.verify|verify} messages.
     * @param message EnterpriseUserDataKeysByNodeResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUserDataKeysByNodeResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUserDataKeysByNodeResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUserDataKeysByNodeResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUserDataKeysByNodeResponse;

    /**
     * Decodes an EnterpriseUserDataKeysByNodeResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUserDataKeysByNodeResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUserDataKeysByNodeResponse;

    /**
     * Verifies an EnterpriseUserDataKeysByNodeResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUserDataKeysByNodeResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUserDataKeysByNodeResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.EnterpriseUserDataKeysByNodeResponse;

    /**
     * Creates a plain object from an EnterpriseUserDataKeysByNodeResponse message. Also converts values to other types if specified.
     * @param message EnterpriseUserDataKeysByNodeResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUserDataKeysByNodeResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUserDataKeysByNodeResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUserDataKeysByNodeResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseDataRequest. */
  interface IEnterpriseDataRequest {
    /** EnterpriseDataRequest continuationToken */
    continuationToken?: Uint8Array | null;
  }

  /** Represents an EnterpriseDataRequest. */
  class EnterpriseDataRequest implements IEnterpriseDataRequest {
    /**
     * Constructs a new EnterpriseDataRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseDataRequest);

    /** EnterpriseDataRequest continuationToken. */
    public continuationToken: Uint8Array;

    /**
     * Creates a new EnterpriseDataRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseDataRequest instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseDataRequest,
    ): Enterprise.EnterpriseDataRequest;

    /**
     * Encodes the specified EnterpriseDataRequest message. Does not implicitly {@link Enterprise.EnterpriseDataRequest.verify|verify} messages.
     * @param message EnterpriseDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseDataRequest message, length delimited. Does not implicitly {@link Enterprise.EnterpriseDataRequest.verify|verify} messages.
     * @param message EnterpriseDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseDataRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseDataRequest;

    /**
     * Decodes an EnterpriseDataRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseDataRequest;

    /**
     * Verifies an EnterpriseDataRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseDataRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseDataRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseDataRequest;

    /**
     * Creates a plain object from an EnterpriseDataRequest message. Also converts values to other types if specified.
     * @param message EnterpriseDataRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseDataRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseDataRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseDataRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SpecialProvisioning. */
  interface ISpecialProvisioning {
    /** SpecialProvisioning url */
    url?: string | null;

    /** SpecialProvisioning name */
    name?: string | null;
  }

  /** Represents a SpecialProvisioning. */
  class SpecialProvisioning implements ISpecialProvisioning {
    /**
     * Constructs a new SpecialProvisioning.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISpecialProvisioning);

    /** SpecialProvisioning url. */
    public url: string;

    /** SpecialProvisioning name. */
    public name: string;

    /**
     * Creates a new SpecialProvisioning instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SpecialProvisioning instance
     */
    public static create(
      properties?: Enterprise.ISpecialProvisioning,
    ): Enterprise.SpecialProvisioning;

    /**
     * Encodes the specified SpecialProvisioning message. Does not implicitly {@link Enterprise.SpecialProvisioning.verify|verify} messages.
     * @param message SpecialProvisioning message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISpecialProvisioning,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SpecialProvisioning message, length delimited. Does not implicitly {@link Enterprise.SpecialProvisioning.verify|verify} messages.
     * @param message SpecialProvisioning message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISpecialProvisioning,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SpecialProvisioning message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SpecialProvisioning
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SpecialProvisioning;

    /**
     * Decodes a SpecialProvisioning message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SpecialProvisioning
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SpecialProvisioning;

    /**
     * Verifies a SpecialProvisioning message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SpecialProvisioning message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SpecialProvisioning
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SpecialProvisioning;

    /**
     * Creates a plain object from a SpecialProvisioning message. Also converts values to other types if specified.
     * @param message SpecialProvisioning
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SpecialProvisioning,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SpecialProvisioning to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SpecialProvisioning
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GeneralDataEntity. */
  interface IGeneralDataEntity {
    /** GeneralDataEntity enterpriseName */
    enterpriseName?: string | null;

    /** GeneralDataEntity restrictVisibility */
    restrictVisibility?: boolean | null;

    /** GeneralDataEntity specialProvisioning */
    specialProvisioning?: Enterprise.ISpecialProvisioning | null;

    /** GeneralDataEntity userPrivilege */
    userPrivilege?: Enterprise.IUserPrivilege | null;

    /** GeneralDataEntity distributor */
    distributor?: boolean | null;

    /** GeneralDataEntity forbidAccountTransfer */
    forbidAccountTransfer?: boolean | null;

    /** GeneralDataEntity showUserOnboard */
    showUserOnboard?: boolean | null;
  }

  /** Represents a GeneralDataEntity. */
  class GeneralDataEntity implements IGeneralDataEntity {
    /**
     * Constructs a new GeneralDataEntity.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGeneralDataEntity);

    /** GeneralDataEntity enterpriseName. */
    public enterpriseName: string;

    /** GeneralDataEntity restrictVisibility. */
    public restrictVisibility: boolean;

    /** GeneralDataEntity specialProvisioning. */
    public specialProvisioning?: Enterprise.ISpecialProvisioning | null;

    /** GeneralDataEntity userPrivilege. */
    public userPrivilege?: Enterprise.IUserPrivilege | null;

    /** GeneralDataEntity distributor. */
    public distributor: boolean;

    /** GeneralDataEntity forbidAccountTransfer. */
    public forbidAccountTransfer: boolean;

    /** GeneralDataEntity showUserOnboard. */
    public showUserOnboard: boolean;

    /**
     * Creates a new GeneralDataEntity instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GeneralDataEntity instance
     */
    public static create(properties?: Enterprise.IGeneralDataEntity): Enterprise.GeneralDataEntity;

    /**
     * Encodes the specified GeneralDataEntity message. Does not implicitly {@link Enterprise.GeneralDataEntity.verify|verify} messages.
     * @param message GeneralDataEntity message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGeneralDataEntity,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GeneralDataEntity message, length delimited. Does not implicitly {@link Enterprise.GeneralDataEntity.verify|verify} messages.
     * @param message GeneralDataEntity message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGeneralDataEntity,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GeneralDataEntity message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GeneralDataEntity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GeneralDataEntity;

    /**
     * Decodes a GeneralDataEntity message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GeneralDataEntity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GeneralDataEntity;

    /**
     * Verifies a GeneralDataEntity message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GeneralDataEntity message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GeneralDataEntity
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GeneralDataEntity;

    /**
     * Creates a plain object from a GeneralDataEntity message. Also converts values to other types if specified.
     * @param message GeneralDataEntity
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GeneralDataEntity,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GeneralDataEntity to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GeneralDataEntity
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Node. */
  interface INode {
    /** Node nodeId */
    nodeId?: number | Long | null;

    /** Node parentId */
    parentId?: number | Long | null;

    /** Node bridgeId */
    bridgeId?: number | Long | null;

    /** Node scimId */
    scimId?: number | Long | null;

    /** Node licenseId */
    licenseId?: number | Long | null;

    /** Node encryptedData */
    encryptedData?: string | null;

    /** Node duoEnabled */
    duoEnabled?: boolean | null;

    /** Node rsaEnabled */
    rsaEnabled?: boolean | null;

    /** Node ssoServiceProviderId */
    ssoServiceProviderId?: number | Long | null;

    /** Node restrictVisibility */
    restrictVisibility?: boolean | null;

    /** Node ssoServiceProviderIds */
    ssoServiceProviderIds?: (number | Long)[] | null;
  }

  /** Represents a Node. */
  class Node implements INode {
    /**
     * Constructs a new Node.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.INode);

    /** Node nodeId. */
    public nodeId: number | Long;

    /** Node parentId. */
    public parentId: number | Long;

    /** Node bridgeId. */
    public bridgeId: number | Long;

    /** Node scimId. */
    public scimId: number | Long;

    /** Node licenseId. */
    public licenseId: number | Long;

    /** Node encryptedData. */
    public encryptedData: string;

    /** Node duoEnabled. */
    public duoEnabled: boolean;

    /** Node rsaEnabled. */
    public rsaEnabled: boolean;

    /** Node ssoServiceProviderId. */
    public ssoServiceProviderId: number | Long;

    /** Node restrictVisibility. */
    public restrictVisibility: boolean;

    /** Node ssoServiceProviderIds. */
    public ssoServiceProviderIds: (number | Long)[];

    /**
     * Creates a new Node instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Node instance
     */
    public static create(properties?: Enterprise.INode): Enterprise.Node;

    /**
     * Encodes the specified Node message. Does not implicitly {@link Enterprise.Node.verify|verify} messages.
     * @param message Node message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.INode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Node message, length delimited. Does not implicitly {@link Enterprise.Node.verify|verify} messages.
     * @param message Node message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.INode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Node message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.Node;

    /**
     * Decodes a Node message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Node;

    /**
     * Verifies a Node message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Node message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Node
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Node;

    /**
     * Creates a plain object from a Node message. Also converts values to other types if specified.
     * @param message Node
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Node,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Node to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Node
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Role. */
  interface IRole {
    /** Role roleId */
    roleId?: number | Long | null;

    /** Role nodeId */
    nodeId?: number | Long | null;

    /** Role encryptedData */
    encryptedData?: string | null;

    /** Role keyType */
    keyType?: string | null;

    /** Role visibleBelow */
    visibleBelow?: boolean | null;

    /** Role newUserInherit */
    newUserInherit?: boolean | null;

    /** Role roleType */
    roleType?: string | null;
  }

  /** Represents a Role. */
  class Role implements IRole {
    /**
     * Constructs a new Role.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRole);

    /** Role roleId. */
    public roleId: number | Long;

    /** Role nodeId. */
    public nodeId: number | Long;

    /** Role encryptedData. */
    public encryptedData: string;

    /** Role keyType. */
    public keyType: string;

    /** Role visibleBelow. */
    public visibleBelow: boolean;

    /** Role newUserInherit. */
    public newUserInherit: boolean;

    /** Role roleType. */
    public roleType: string;

    /**
     * Creates a new Role instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Role instance
     */
    public static create(properties?: Enterprise.IRole): Enterprise.Role;

    /**
     * Encodes the specified Role message. Does not implicitly {@link Enterprise.Role.verify|verify} messages.
     * @param message Role message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IRole, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Role message, length delimited. Does not implicitly {@link Enterprise.Role.verify|verify} messages.
     * @param message Role message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRole,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Role message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Role
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.Role;

    /**
     * Decodes a Role message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Role
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Role;

    /**
     * Verifies a Role message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Role message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Role
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Role;

    /**
     * Creates a plain object from a Role message. Also converts values to other types if specified.
     * @param message Role
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Role,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Role to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Role
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a User. */
  interface IUser {
    /** User enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** User nodeId */
    nodeId?: number | Long | null;

    /** User encryptedData */
    encryptedData?: string | null;

    /** User keyType */
    keyType?: string | null;

    /** User username */
    username?: string | null;

    /** User status */
    status?: string | null;

    /** User lock */
    lock?: number | null;

    /** User userId */
    userId?: number | null;

    /** User accountShareExpiration */
    accountShareExpiration?: number | Long | null;

    /** User fullName */
    fullName?: string | null;

    /** User jobTitle */
    jobTitle?: string | null;

    /** User tfaEnabled */
    tfaEnabled?: boolean | null;

    /** User transferAcceptanceStatus */
    transferAcceptanceStatus?: Enterprise.TransferAcceptanceStatus | null;
  }

  /** Represents a User. */
  class User implements IUser {
    /**
     * Constructs a new User.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUser);

    /** User enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** User nodeId. */
    public nodeId: number | Long;

    /** User encryptedData. */
    public encryptedData: string;

    /** User keyType. */
    public keyType: string;

    /** User username. */
    public username: string;

    /** User status. */
    public status: string;

    /** User lock. */
    public lock: number;

    /** User userId. */
    public userId: number;

    /** User accountShareExpiration. */
    public accountShareExpiration: number | Long;

    /** User fullName. */
    public fullName: string;

    /** User jobTitle. */
    public jobTitle: string;

    /** User tfaEnabled. */
    public tfaEnabled: boolean;

    /** User transferAcceptanceStatus. */
    public transferAcceptanceStatus: Enterprise.TransferAcceptanceStatus;

    /**
     * Creates a new User instance using the specified properties.
     * @param [properties] Properties to set
     * @returns User instance
     */
    public static create(properties?: Enterprise.IUser): Enterprise.User;

    /**
     * Encodes the specified User message. Does not implicitly {@link Enterprise.User.verify|verify} messages.
     * @param message User message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IUser, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified User message, length delimited. Does not implicitly {@link Enterprise.User.verify|verify} messages.
     * @param message User message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a User message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns User
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.User;

    /**
     * Decodes a User message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns User
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.User;

    /**
     * Verifies a User message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a User message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns User
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.User;

    /**
     * Creates a plain object from a User message. Also converts values to other types if specified.
     * @param message User
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.User,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this User to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for User
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserAlias. */
  interface IUserAlias {
    /** UserAlias enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserAlias username */
    username?: string | null;
  }

  /** Represents a UserAlias. */
  class UserAlias implements IUserAlias {
    /**
     * Constructs a new UserAlias.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserAlias);

    /** UserAlias enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserAlias username. */
    public username: string;

    /**
     * Creates a new UserAlias instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserAlias instance
     */
    public static create(properties?: Enterprise.IUserAlias): Enterprise.UserAlias;

    /**
     * Encodes the specified UserAlias message. Does not implicitly {@link Enterprise.UserAlias.verify|verify} messages.
     * @param message UserAlias message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserAlias,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserAlias message, length delimited. Does not implicitly {@link Enterprise.UserAlias.verify|verify} messages.
     * @param message UserAlias message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserAlias,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserAlias message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserAlias
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserAlias;

    /**
     * Decodes a UserAlias message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserAlias
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserAlias;

    /**
     * Verifies a UserAlias message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserAlias message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserAlias
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserAlias;

    /**
     * Creates a plain object from a UserAlias message. Also converts values to other types if specified.
     * @param message UserAlias
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserAlias,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserAlias to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserAlias
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportMetaData. */
  interface IComplianceReportMetaData {
    /** ComplianceReportMetaData reportUid */
    reportUid?: Uint8Array | null;

    /** ComplianceReportMetaData nodeId */
    nodeId?: number | Long | null;

    /** ComplianceReportMetaData reportName */
    reportName?: string | null;

    /** ComplianceReportMetaData dateGenerated */
    dateGenerated?: number | Long | null;

    /** ComplianceReportMetaData runByName */
    runByName?: string | null;

    /** ComplianceReportMetaData numberOfOwners */
    numberOfOwners?: number | null;

    /** ComplianceReportMetaData numberOfRecords */
    numberOfRecords?: number | null;
  }

  /** Represents a ComplianceReportMetaData. */
  class ComplianceReportMetaData implements IComplianceReportMetaData {
    /**
     * Constructs a new ComplianceReportMetaData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportMetaData);

    /** ComplianceReportMetaData reportUid. */
    public reportUid: Uint8Array;

    /** ComplianceReportMetaData nodeId. */
    public nodeId: number | Long;

    /** ComplianceReportMetaData reportName. */
    public reportName: string;

    /** ComplianceReportMetaData dateGenerated. */
    public dateGenerated: number | Long;

    /** ComplianceReportMetaData runByName. */
    public runByName: string;

    /** ComplianceReportMetaData numberOfOwners. */
    public numberOfOwners: number;

    /** ComplianceReportMetaData numberOfRecords. */
    public numberOfRecords: number;

    /**
     * Creates a new ComplianceReportMetaData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportMetaData instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportMetaData,
    ): Enterprise.ComplianceReportMetaData;

    /**
     * Encodes the specified ComplianceReportMetaData message. Does not implicitly {@link Enterprise.ComplianceReportMetaData.verify|verify} messages.
     * @param message ComplianceReportMetaData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportMetaData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportMetaData message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportMetaData.verify|verify} messages.
     * @param message ComplianceReportMetaData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportMetaData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportMetaData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportMetaData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportMetaData;

    /**
     * Decodes a ComplianceReportMetaData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportMetaData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportMetaData;

    /**
     * Verifies a ComplianceReportMetaData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportMetaData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportMetaData
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportMetaData;

    /**
     * Creates a plain object from a ComplianceReportMetaData message. Also converts values to other types if specified.
     * @param message ComplianceReportMetaData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportMetaData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportMetaData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportMetaData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ManagedNode. */
  interface IManagedNode {
    /** ManagedNode roleId */
    roleId?: number | Long | null;

    /** ManagedNode managedNodeId */
    managedNodeId?: number | Long | null;

    /** ManagedNode cascadeNodeManagement */
    cascadeNodeManagement?: boolean | null;
  }

  /** Represents a ManagedNode. */
  class ManagedNode implements IManagedNode {
    /**
     * Constructs a new ManagedNode.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IManagedNode);

    /** ManagedNode roleId. */
    public roleId: number | Long;

    /** ManagedNode managedNodeId. */
    public managedNodeId: number | Long;

    /** ManagedNode cascadeNodeManagement. */
    public cascadeNodeManagement: boolean;

    /**
     * Creates a new ManagedNode instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ManagedNode instance
     */
    public static create(properties?: Enterprise.IManagedNode): Enterprise.ManagedNode;

    /**
     * Encodes the specified ManagedNode message. Does not implicitly {@link Enterprise.ManagedNode.verify|verify} messages.
     * @param message ManagedNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IManagedNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ManagedNode message, length delimited. Does not implicitly {@link Enterprise.ManagedNode.verify|verify} messages.
     * @param message ManagedNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IManagedNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ManagedNode message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ManagedNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ManagedNode;

    /**
     * Decodes a ManagedNode message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ManagedNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.ManagedNode;

    /**
     * Verifies a ManagedNode message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ManagedNode message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ManagedNode
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ManagedNode;

    /**
     * Creates a plain object from a ManagedNode message. Also converts values to other types if specified.
     * @param message ManagedNode
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ManagedNode,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ManagedNode to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ManagedNode
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserManagedNode. */
  interface IUserManagedNode {
    /** UserManagedNode nodeId */
    nodeId?: number | Long | null;

    /** UserManagedNode cascadeNodeManagement */
    cascadeNodeManagement?: boolean | null;

    /** UserManagedNode privileges */
    privileges?: string[] | null;
  }

  /** Represents a UserManagedNode. */
  class UserManagedNode implements IUserManagedNode {
    /**
     * Constructs a new UserManagedNode.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserManagedNode);

    /** UserManagedNode nodeId. */
    public nodeId: number | Long;

    /** UserManagedNode cascadeNodeManagement. */
    public cascadeNodeManagement: boolean;

    /** UserManagedNode privileges. */
    public privileges: string[];

    /**
     * Creates a new UserManagedNode instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserManagedNode instance
     */
    public static create(properties?: Enterprise.IUserManagedNode): Enterprise.UserManagedNode;

    /**
     * Encodes the specified UserManagedNode message. Does not implicitly {@link Enterprise.UserManagedNode.verify|verify} messages.
     * @param message UserManagedNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserManagedNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserManagedNode message, length delimited. Does not implicitly {@link Enterprise.UserManagedNode.verify|verify} messages.
     * @param message UserManagedNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserManagedNode,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserManagedNode message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserManagedNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserManagedNode;

    /**
     * Decodes a UserManagedNode message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserManagedNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.UserManagedNode;

    /**
     * Verifies a UserManagedNode message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserManagedNode message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserManagedNode
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserManagedNode;

    /**
     * Creates a plain object from a UserManagedNode message. Also converts values to other types if specified.
     * @param message UserManagedNode
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserManagedNode,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserManagedNode to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserManagedNode
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserPrivilege. */
  interface IUserPrivilege {
    /** UserPrivilege userManagedNodes */
    userManagedNodes?: Enterprise.IUserManagedNode[] | null;

    /** UserPrivilege enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserPrivilege encryptedData */
    encryptedData?: string | null;
  }

  /** Represents a UserPrivilege. */
  class UserPrivilege implements IUserPrivilege {
    /**
     * Constructs a new UserPrivilege.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserPrivilege);

    /** UserPrivilege userManagedNodes. */
    public userManagedNodes: Enterprise.IUserManagedNode[];

    /** UserPrivilege enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserPrivilege encryptedData. */
    public encryptedData: string;

    /**
     * Creates a new UserPrivilege instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserPrivilege instance
     */
    public static create(properties?: Enterprise.IUserPrivilege): Enterprise.UserPrivilege;

    /**
     * Encodes the specified UserPrivilege message. Does not implicitly {@link Enterprise.UserPrivilege.verify|verify} messages.
     * @param message UserPrivilege message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserPrivilege,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserPrivilege message, length delimited. Does not implicitly {@link Enterprise.UserPrivilege.verify|verify} messages.
     * @param message UserPrivilege message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserPrivilege,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserPrivilege message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserPrivilege
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserPrivilege;

    /**
     * Decodes a UserPrivilege message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserPrivilege
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserPrivilege;

    /**
     * Verifies a UserPrivilege message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserPrivilege message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserPrivilege
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserPrivilege;

    /**
     * Creates a plain object from a UserPrivilege message. Also converts values to other types if specified.
     * @param message UserPrivilege
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserPrivilege,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserPrivilege to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserPrivilege
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleUser. */
  interface IRoleUser {
    /** RoleUser roleId */
    roleId?: number | Long | null;

    /** RoleUser enterpriseUserId */
    enterpriseUserId?: number | Long | null;
  }

  /** Represents a RoleUser. */
  class RoleUser implements IRoleUser {
    /**
     * Constructs a new RoleUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleUser);

    /** RoleUser roleId. */
    public roleId: number | Long;

    /** RoleUser enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /**
     * Creates a new RoleUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleUser instance
     */
    public static create(properties?: Enterprise.IRoleUser): Enterprise.RoleUser;

    /**
     * Encodes the specified RoleUser message. Does not implicitly {@link Enterprise.RoleUser.verify|verify} messages.
     * @param message RoleUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleUser message, length delimited. Does not implicitly {@link Enterprise.RoleUser.verify|verify} messages.
     * @param message RoleUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleUser;

    /**
     * Decodes a RoleUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleUser;

    /**
     * Verifies a RoleUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleUser;

    /**
     * Creates a plain object from a RoleUser message. Also converts values to other types if specified.
     * @param message RoleUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RolePrivilege. */
  interface IRolePrivilege {
    /** RolePrivilege managedNodeId */
    managedNodeId?: number | Long | null;

    /** RolePrivilege roleId */
    roleId?: number | Long | null;

    /** RolePrivilege privilegeType */
    privilegeType?: string | null;
  }

  /** Represents a RolePrivilege. */
  class RolePrivilege implements IRolePrivilege {
    /**
     * Constructs a new RolePrivilege.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRolePrivilege);

    /** RolePrivilege managedNodeId. */
    public managedNodeId: number | Long;

    /** RolePrivilege roleId. */
    public roleId: number | Long;

    /** RolePrivilege privilegeType. */
    public privilegeType: string;

    /**
     * Creates a new RolePrivilege instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RolePrivilege instance
     */
    public static create(properties?: Enterprise.IRolePrivilege): Enterprise.RolePrivilege;

    /**
     * Encodes the specified RolePrivilege message. Does not implicitly {@link Enterprise.RolePrivilege.verify|verify} messages.
     * @param message RolePrivilege message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRolePrivilege,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RolePrivilege message, length delimited. Does not implicitly {@link Enterprise.RolePrivilege.verify|verify} messages.
     * @param message RolePrivilege message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRolePrivilege,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RolePrivilege message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RolePrivilege
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RolePrivilege;

    /**
     * Decodes a RolePrivilege message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RolePrivilege
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RolePrivilege;

    /**
     * Verifies a RolePrivilege message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RolePrivilege message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RolePrivilege
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RolePrivilege;

    /**
     * Creates a plain object from a RolePrivilege message. Also converts values to other types if specified.
     * @param message RolePrivilege
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RolePrivilege,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RolePrivilege to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RolePrivilege
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleEnforcement. */
  interface IRoleEnforcement {
    /** RoleEnforcement roleId */
    roleId?: number | Long | null;

    /** RoleEnforcement enforcementType */
    enforcementType?: string | null;

    /** RoleEnforcement value */
    value?: string | null;
  }

  /** Represents a RoleEnforcement. */
  class RoleEnforcement implements IRoleEnforcement {
    /**
     * Constructs a new RoleEnforcement.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleEnforcement);

    /** RoleEnforcement roleId. */
    public roleId: number | Long;

    /** RoleEnforcement enforcementType. */
    public enforcementType: string;

    /** RoleEnforcement value. */
    public value: string;

    /**
     * Creates a new RoleEnforcement instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleEnforcement instance
     */
    public static create(properties?: Enterprise.IRoleEnforcement): Enterprise.RoleEnforcement;

    /**
     * Encodes the specified RoleEnforcement message. Does not implicitly {@link Enterprise.RoleEnforcement.verify|verify} messages.
     * @param message RoleEnforcement message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleEnforcement,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleEnforcement message, length delimited. Does not implicitly {@link Enterprise.RoleEnforcement.verify|verify} messages.
     * @param message RoleEnforcement message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleEnforcement,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleEnforcement message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleEnforcement
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleEnforcement;

    /**
     * Decodes a RoleEnforcement message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleEnforcement
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleEnforcement;

    /**
     * Verifies a RoleEnforcement message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleEnforcement message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleEnforcement
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleEnforcement;

    /**
     * Creates a plain object from a RoleEnforcement message. Also converts values to other types if specified.
     * @param message RoleEnforcement
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleEnforcement,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleEnforcement to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleEnforcement
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Team. */
  interface ITeam {
    /** Team teamUid */
    teamUid?: Uint8Array | null;

    /** Team name */
    name?: string | null;

    /** Team nodeId */
    nodeId?: number | Long | null;

    /** Team restrictEdit */
    restrictEdit?: boolean | null;

    /** Team restrictShare */
    restrictShare?: boolean | null;

    /** Team restrictView */
    restrictView?: boolean | null;

    /** Team encryptedData */
    encryptedData?: string | null;

    /** Team encryptedTeamKey */
    encryptedTeamKey?: string | null;
  }

  /** Represents a Team. */
  class Team implements ITeam {
    /**
     * Constructs a new Team.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeam);

    /** Team teamUid. */
    public teamUid: Uint8Array;

    /** Team name. */
    public name: string;

    /** Team nodeId. */
    public nodeId: number | Long;

    /** Team restrictEdit. */
    public restrictEdit: boolean;

    /** Team restrictShare. */
    public restrictShare: boolean;

    /** Team restrictView. */
    public restrictView: boolean;

    /** Team encryptedData. */
    public encryptedData: string;

    /** Team encryptedTeamKey. */
    public encryptedTeamKey: string;

    /**
     * Creates a new Team instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Team instance
     */
    public static create(properties?: Enterprise.ITeam): Enterprise.Team;

    /**
     * Encodes the specified Team message. Does not implicitly {@link Enterprise.Team.verify|verify} messages.
     * @param message Team message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.ITeam, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Team message, length delimited. Does not implicitly {@link Enterprise.Team.verify|verify} messages.
     * @param message Team message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Team message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Team
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.Team;

    /**
     * Decodes a Team message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Team
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Team;

    /**
     * Verifies a Team message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Team message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Team
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Team;

    /**
     * Creates a plain object from a Team message. Also converts values to other types if specified.
     * @param message Team
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Team,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Team to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Team
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamUser. */
  interface ITeamUser {
    /** TeamUser teamUid */
    teamUid?: Uint8Array | null;

    /** TeamUser enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** TeamUser userType */
    userType?: string | null;
  }

  /** Represents a TeamUser. */
  class TeamUser implements ITeamUser {
    /**
     * Constructs a new TeamUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamUser);

    /** TeamUser teamUid. */
    public teamUid: Uint8Array;

    /** TeamUser enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** TeamUser userType. */
    public userType: string;

    /**
     * Creates a new TeamUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamUser instance
     */
    public static create(properties?: Enterprise.ITeamUser): Enterprise.TeamUser;

    /**
     * Encodes the specified TeamUser message. Does not implicitly {@link Enterprise.TeamUser.verify|verify} messages.
     * @param message TeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamUser message, length delimited. Does not implicitly {@link Enterprise.TeamUser.verify|verify} messages.
     * @param message TeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamUser;

    /**
     * Decodes a TeamUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.TeamUser;

    /**
     * Verifies a TeamUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.TeamUser;

    /**
     * Creates a plain object from a TeamUser message. Also converts values to other types if specified.
     * @param message TeamUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetDistributorInfoResponse. */
  interface IGetDistributorInfoResponse {
    /** GetDistributorInfoResponse distributors */
    distributors?: Enterprise.IDistributor[] | null;
  }

  /** Represents a GetDistributorInfoResponse. */
  class GetDistributorInfoResponse implements IGetDistributorInfoResponse {
    /**
     * Constructs a new GetDistributorInfoResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetDistributorInfoResponse);

    /** GetDistributorInfoResponse distributors. */
    public distributors: Enterprise.IDistributor[];

    /**
     * Creates a new GetDistributorInfoResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetDistributorInfoResponse instance
     */
    public static create(
      properties?: Enterprise.IGetDistributorInfoResponse,
    ): Enterprise.GetDistributorInfoResponse;

    /**
     * Encodes the specified GetDistributorInfoResponse message. Does not implicitly {@link Enterprise.GetDistributorInfoResponse.verify|verify} messages.
     * @param message GetDistributorInfoResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetDistributorInfoResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetDistributorInfoResponse message, length delimited. Does not implicitly {@link Enterprise.GetDistributorInfoResponse.verify|verify} messages.
     * @param message GetDistributorInfoResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetDistributorInfoResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetDistributorInfoResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetDistributorInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetDistributorInfoResponse;

    /**
     * Decodes a GetDistributorInfoResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetDistributorInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetDistributorInfoResponse;

    /**
     * Verifies a GetDistributorInfoResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetDistributorInfoResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetDistributorInfoResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetDistributorInfoResponse;

    /**
     * Creates a plain object from a GetDistributorInfoResponse message. Also converts values to other types if specified.
     * @param message GetDistributorInfoResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetDistributorInfoResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetDistributorInfoResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetDistributorInfoResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Distributor. */
  interface IDistributor {
    /** Distributor name */
    name?: string | null;

    /** Distributor mspInfos */
    mspInfos?: Enterprise.IMspInfo[] | null;
  }

  /** Represents a Distributor. */
  class Distributor implements IDistributor {
    /**
     * Constructs a new Distributor.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDistributor);

    /** Distributor name. */
    public name: string;

    /** Distributor mspInfos. */
    public mspInfos: Enterprise.IMspInfo[];

    /**
     * Creates a new Distributor instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Distributor instance
     */
    public static create(properties?: Enterprise.IDistributor): Enterprise.Distributor;

    /**
     * Encodes the specified Distributor message. Does not implicitly {@link Enterprise.Distributor.verify|verify} messages.
     * @param message Distributor message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDistributor,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Distributor message, length delimited. Does not implicitly {@link Enterprise.Distributor.verify|verify} messages.
     * @param message Distributor message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDistributor,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Distributor message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Distributor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.Distributor;

    /**
     * Decodes a Distributor message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Distributor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Distributor;

    /**
     * Verifies a Distributor message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Distributor message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Distributor
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Distributor;

    /**
     * Creates a plain object from a Distributor message. Also converts values to other types if specified.
     * @param message Distributor
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Distributor,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Distributor to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Distributor
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MspInfo. */
  interface IMspInfo {
    /** MspInfo enterpriseId */
    enterpriseId?: number | null;

    /** MspInfo enterpriseName */
    enterpriseName?: string | null;

    /** MspInfo allocatedLicenses */
    allocatedLicenses?: number | null;

    /** MspInfo allowedMcProducts */
    allowedMcProducts?: string[] | null;

    /** MspInfo allowedAddOns */
    allowedAddOns?: string[] | null;

    /** MspInfo maxFilePlanType */
    maxFilePlanType?: string | null;

    /** MspInfo managedCompanies */
    managedCompanies?: Enterprise.IManagedCompany[] | null;

    /** MspInfo allowUnlimitedLicenses */
    allowUnlimitedLicenses?: boolean | null;

    /** MspInfo addOns */
    addOns?: Enterprise.ILicenseAddOn[] | null;
  }

  /** Represents a MspInfo. */
  class MspInfo implements IMspInfo {
    /**
     * Constructs a new MspInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMspInfo);

    /** MspInfo enterpriseId. */
    public enterpriseId: number;

    /** MspInfo enterpriseName. */
    public enterpriseName: string;

    /** MspInfo allocatedLicenses. */
    public allocatedLicenses: number;

    /** MspInfo allowedMcProducts. */
    public allowedMcProducts: string[];

    /** MspInfo allowedAddOns. */
    public allowedAddOns: string[];

    /** MspInfo maxFilePlanType. */
    public maxFilePlanType: string;

    /** MspInfo managedCompanies. */
    public managedCompanies: Enterprise.IManagedCompany[];

    /** MspInfo allowUnlimitedLicenses. */
    public allowUnlimitedLicenses: boolean;

    /** MspInfo addOns. */
    public addOns: Enterprise.ILicenseAddOn[];

    /**
     * Creates a new MspInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MspInfo instance
     */
    public static create(properties?: Enterprise.IMspInfo): Enterprise.MspInfo;

    /**
     * Encodes the specified MspInfo message. Does not implicitly {@link Enterprise.MspInfo.verify|verify} messages.
     * @param message MspInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IMspInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MspInfo message, length delimited. Does not implicitly {@link Enterprise.MspInfo.verify|verify} messages.
     * @param message MspInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMspInfo,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MspInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MspInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.MspInfo;

    /**
     * Decodes a MspInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MspInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MspInfo;

    /**
     * Verifies a MspInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MspInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MspInfo
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MspInfo;

    /**
     * Creates a plain object from a MspInfo message. Also converts values to other types if specified.
     * @param message MspInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MspInfo,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MspInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MspInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ManagedCompany. */
  interface IManagedCompany {
    /** ManagedCompany mcEnterpriseId */
    mcEnterpriseId?: number | null;

    /** ManagedCompany mcEnterpriseName */
    mcEnterpriseName?: string | null;

    /** ManagedCompany mspNodeId */
    mspNodeId?: number | Long | null;

    /** ManagedCompany numberOfSeats */
    numberOfSeats?: number | null;

    /** ManagedCompany numberOfUsers */
    numberOfUsers?: number | null;

    /** ManagedCompany productId */
    productId?: string | null;

    /** ManagedCompany isExpired */
    isExpired?: boolean | null;

    /** ManagedCompany treeKey */
    treeKey?: string | null;

    /** ManagedCompany treeKeyRole */
    treeKeyRole?: number | Long | null;

    /** ManagedCompany filePlanType */
    filePlanType?: string | null;

    /** ManagedCompany addOns */
    addOns?: Enterprise.ILicenseAddOn[] | null;
  }

  /** Represents a ManagedCompany. */
  class ManagedCompany implements IManagedCompany {
    /**
     * Constructs a new ManagedCompany.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IManagedCompany);

    /** ManagedCompany mcEnterpriseId. */
    public mcEnterpriseId: number;

    /** ManagedCompany mcEnterpriseName. */
    public mcEnterpriseName: string;

    /** ManagedCompany mspNodeId. */
    public mspNodeId: number | Long;

    /** ManagedCompany numberOfSeats. */
    public numberOfSeats: number;

    /** ManagedCompany numberOfUsers. */
    public numberOfUsers: number;

    /** ManagedCompany productId. */
    public productId: string;

    /** ManagedCompany isExpired. */
    public isExpired: boolean;

    /** ManagedCompany treeKey. */
    public treeKey: string;

    /** ManagedCompany treeKeyRole. */
    public treeKeyRole: number | Long;

    /** ManagedCompany filePlanType. */
    public filePlanType: string;

    /** ManagedCompany addOns. */
    public addOns: Enterprise.ILicenseAddOn[];

    /**
     * Creates a new ManagedCompany instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ManagedCompany instance
     */
    public static create(properties?: Enterprise.IManagedCompany): Enterprise.ManagedCompany;

    /**
     * Encodes the specified ManagedCompany message. Does not implicitly {@link Enterprise.ManagedCompany.verify|verify} messages.
     * @param message ManagedCompany message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IManagedCompany,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ManagedCompany message, length delimited. Does not implicitly {@link Enterprise.ManagedCompany.verify|verify} messages.
     * @param message ManagedCompany message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IManagedCompany,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ManagedCompany message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ManagedCompany
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ManagedCompany;

    /**
     * Decodes a ManagedCompany message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ManagedCompany
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.ManagedCompany;

    /**
     * Verifies a ManagedCompany message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ManagedCompany message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ManagedCompany
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ManagedCompany;

    /**
     * Creates a plain object from a ManagedCompany message. Also converts values to other types if specified.
     * @param message ManagedCompany
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ManagedCompany,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ManagedCompany to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ManagedCompany
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MSPPool. */
  interface IMSPPool {
    /** MSPPool productId */
    productId?: string | null;

    /** MSPPool seats */
    seats?: number | null;

    /** MSPPool availableSeats */
    availableSeats?: number | null;

    /** MSPPool stash */
    stash?: number | null;
  }

  /** Represents a MSPPool. */
  class MSPPool implements IMSPPool {
    /**
     * Constructs a new MSPPool.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMSPPool);

    /** MSPPool productId. */
    public productId: string;

    /** MSPPool seats. */
    public seats: number;

    /** MSPPool availableSeats. */
    public availableSeats: number;

    /** MSPPool stash. */
    public stash: number;

    /**
     * Creates a new MSPPool instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MSPPool instance
     */
    public static create(properties?: Enterprise.IMSPPool): Enterprise.MSPPool;

    /**
     * Encodes the specified MSPPool message. Does not implicitly {@link Enterprise.MSPPool.verify|verify} messages.
     * @param message MSPPool message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IMSPPool, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MSPPool message, length delimited. Does not implicitly {@link Enterprise.MSPPool.verify|verify} messages.
     * @param message MSPPool message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMSPPool,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MSPPool message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MSPPool
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.MSPPool;

    /**
     * Decodes a MSPPool message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MSPPool
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MSPPool;

    /**
     * Verifies a MSPPool message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MSPPool message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MSPPool
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MSPPool;

    /**
     * Creates a plain object from a MSPPool message. Also converts values to other types if specified.
     * @param message MSPPool
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MSPPool,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MSPPool to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MSPPool
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MSPContact. */
  interface IMSPContact {
    /** MSPContact enterpriseId */
    enterpriseId?: number | null;

    /** MSPContact enterpriseName */
    enterpriseName?: string | null;
  }

  /** Represents a MSPContact. */
  class MSPContact implements IMSPContact {
    /**
     * Constructs a new MSPContact.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMSPContact);

    /** MSPContact enterpriseId. */
    public enterpriseId: number;

    /** MSPContact enterpriseName. */
    public enterpriseName: string;

    /**
     * Creates a new MSPContact instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MSPContact instance
     */
    public static create(properties?: Enterprise.IMSPContact): Enterprise.MSPContact;

    /**
     * Encodes the specified MSPContact message. Does not implicitly {@link Enterprise.MSPContact.verify|verify} messages.
     * @param message MSPContact message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IMSPContact,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified MSPContact message, length delimited. Does not implicitly {@link Enterprise.MSPContact.verify|verify} messages.
     * @param message MSPContact message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMSPContact,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MSPContact message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MSPContact
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.MSPContact;

    /**
     * Decodes a MSPContact message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MSPContact
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MSPContact;

    /**
     * Verifies a MSPContact message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MSPContact message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MSPContact
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MSPContact;

    /**
     * Creates a plain object from a MSPContact message. Also converts values to other types if specified.
     * @param message MSPContact
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MSPContact,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MSPContact to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MSPContact
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a LicenseAddOn. */
  interface ILicenseAddOn {
    /** LicenseAddOn name */
    name?: string | null;

    /** LicenseAddOn enabled */
    enabled?: boolean | null;

    /** LicenseAddOn isTrial */
    isTrial?: boolean | null;

    /** LicenseAddOn expiration */
    expiration?: number | Long | null;

    /** LicenseAddOn created */
    created?: number | Long | null;

    /** LicenseAddOn seats */
    seats?: number | null;

    /** LicenseAddOn activationTime */
    activationTime?: number | Long | null;

    /** LicenseAddOn includedInProduct */
    includedInProduct?: boolean | null;

    /** LicenseAddOn apiCallCount */
    apiCallCount?: number | null;

    /** LicenseAddOn tierDescription */
    tierDescription?: string | null;

    /** LicenseAddOn seatsAllocated */
    seatsAllocated?: number | null;
  }

  /** Represents a LicenseAddOn. */
  class LicenseAddOn implements ILicenseAddOn {
    /**
     * Constructs a new LicenseAddOn.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ILicenseAddOn);

    /** LicenseAddOn name. */
    public name: string;

    /** LicenseAddOn enabled. */
    public enabled: boolean;

    /** LicenseAddOn isTrial. */
    public isTrial: boolean;

    /** LicenseAddOn expiration. */
    public expiration: number | Long;

    /** LicenseAddOn created. */
    public created: number | Long;

    /** LicenseAddOn seats. */
    public seats: number;

    /** LicenseAddOn activationTime. */
    public activationTime: number | Long;

    /** LicenseAddOn includedInProduct. */
    public includedInProduct: boolean;

    /** LicenseAddOn apiCallCount. */
    public apiCallCount: number;

    /** LicenseAddOn tierDescription. */
    public tierDescription: string;

    /** LicenseAddOn seatsAllocated. */
    public seatsAllocated: number;

    /**
     * Creates a new LicenseAddOn instance using the specified properties.
     * @param [properties] Properties to set
     * @returns LicenseAddOn instance
     */
    public static create(properties?: Enterprise.ILicenseAddOn): Enterprise.LicenseAddOn;

    /**
     * Encodes the specified LicenseAddOn message. Does not implicitly {@link Enterprise.LicenseAddOn.verify|verify} messages.
     * @param message LicenseAddOn message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ILicenseAddOn,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified LicenseAddOn message, length delimited. Does not implicitly {@link Enterprise.LicenseAddOn.verify|verify} messages.
     * @param message LicenseAddOn message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ILicenseAddOn,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a LicenseAddOn message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns LicenseAddOn
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.LicenseAddOn;

    /**
     * Decodes a LicenseAddOn message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns LicenseAddOn
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.LicenseAddOn;

    /**
     * Verifies a LicenseAddOn message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a LicenseAddOn message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns LicenseAddOn
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.LicenseAddOn;

    /**
     * Creates a plain object from a LicenseAddOn message. Also converts values to other types if specified.
     * @param message LicenseAddOn
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.LicenseAddOn,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this LicenseAddOn to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for LicenseAddOn
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MCDefault. */
  interface IMCDefault {
    /** MCDefault mcProduct */
    mcProduct?: string | null;

    /** MCDefault addOns */
    addOns?: string[] | null;

    /** MCDefault filePlanType */
    filePlanType?: string | null;

    /** MCDefault maxLicenses */
    maxLicenses?: number | null;

    /** MCDefault fixedMaxLicenses */
    fixedMaxLicenses?: boolean | null;
  }

  /** Represents a MCDefault. */
  class MCDefault implements IMCDefault {
    /**
     * Constructs a new MCDefault.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMCDefault);

    /** MCDefault mcProduct. */
    public mcProduct: string;

    /** MCDefault addOns. */
    public addOns: string[];

    /** MCDefault filePlanType. */
    public filePlanType: string;

    /** MCDefault maxLicenses. */
    public maxLicenses: number;

    /** MCDefault fixedMaxLicenses. */
    public fixedMaxLicenses: boolean;

    /**
     * Creates a new MCDefault instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MCDefault instance
     */
    public static create(properties?: Enterprise.IMCDefault): Enterprise.MCDefault;

    /**
     * Encodes the specified MCDefault message. Does not implicitly {@link Enterprise.MCDefault.verify|verify} messages.
     * @param message MCDefault message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IMCDefault,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified MCDefault message, length delimited. Does not implicitly {@link Enterprise.MCDefault.verify|verify} messages.
     * @param message MCDefault message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMCDefault,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MCDefault message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MCDefault
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.MCDefault;

    /**
     * Decodes a MCDefault message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MCDefault
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MCDefault;

    /**
     * Verifies a MCDefault message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MCDefault message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MCDefault
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MCDefault;

    /**
     * Creates a plain object from a MCDefault message. Also converts values to other types if specified.
     * @param message MCDefault
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MCDefault,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MCDefault to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MCDefault
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MSPPermits. */
  interface IMSPPermits {
    /** MSPPermits restricted */
    restricted?: boolean | null;

    /** MSPPermits maxAllowedLicenses */
    maxAllowedLicenses?: number | null;

    /** MSPPermits allowedMcProducts */
    allowedMcProducts?: string[] | null;

    /** MSPPermits allowedAddOns */
    allowedAddOns?: string[] | null;

    /** MSPPermits maxFilePlanType */
    maxFilePlanType?: string | null;

    /** MSPPermits allowUnlimitedLicenses */
    allowUnlimitedLicenses?: boolean | null;

    /** MSPPermits mcDefaults */
    mcDefaults?: Enterprise.IMCDefault[] | null;
  }

  /** Represents a MSPPermits. */
  class MSPPermits implements IMSPPermits {
    /**
     * Constructs a new MSPPermits.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMSPPermits);

    /** MSPPermits restricted. */
    public restricted: boolean;

    /** MSPPermits maxAllowedLicenses. */
    public maxAllowedLicenses: number;

    /** MSPPermits allowedMcProducts. */
    public allowedMcProducts: string[];

    /** MSPPermits allowedAddOns. */
    public allowedAddOns: string[];

    /** MSPPermits maxFilePlanType. */
    public maxFilePlanType: string;

    /** MSPPermits allowUnlimitedLicenses. */
    public allowUnlimitedLicenses: boolean;

    /** MSPPermits mcDefaults. */
    public mcDefaults: Enterprise.IMCDefault[];

    /**
     * Creates a new MSPPermits instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MSPPermits instance
     */
    public static create(properties?: Enterprise.IMSPPermits): Enterprise.MSPPermits;

    /**
     * Encodes the specified MSPPermits message. Does not implicitly {@link Enterprise.MSPPermits.verify|verify} messages.
     * @param message MSPPermits message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IMSPPermits,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified MSPPermits message, length delimited. Does not implicitly {@link Enterprise.MSPPermits.verify|verify} messages.
     * @param message MSPPermits message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMSPPermits,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MSPPermits message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MSPPermits
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.MSPPermits;

    /**
     * Decodes a MSPPermits message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MSPPermits
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MSPPermits;

    /**
     * Verifies a MSPPermits message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MSPPermits message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MSPPermits
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MSPPermits;

    /**
     * Creates a plain object from a MSPPermits message. Also converts values to other types if specified.
     * @param message MSPPermits
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MSPPermits,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MSPPermits to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MSPPermits
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a License. */
  interface ILicense {
    /** License paid */
    paid?: boolean | null;

    /** License numberOfSeats */
    numberOfSeats?: number | null;

    /** License expiration */
    expiration?: number | Long | null;

    /** License licenseKeyId */
    licenseKeyId?: number | null;

    /** License productTypeId */
    productTypeId?: number | null;

    /** License name */
    name?: string | null;

    /** License enterpriseLicenseId */
    enterpriseLicenseId?: number | Long | null;

    /** License seatsAllocated */
    seatsAllocated?: number | null;

    /** License seatsPending */
    seatsPending?: number | null;

    /** License tier */
    tier?: number | null;

    /** License filePlanTypeId */
    filePlanTypeId?: number | null;

    /** License maxBytes */
    maxBytes?: number | Long | null;

    /** License storageExpiration */
    storageExpiration?: number | Long | null;

    /** License licenseStatus */
    licenseStatus?: string | null;

    /** License mspPool */
    mspPool?: Enterprise.IMSPPool[] | null;

    /** License managedBy */
    managedBy?: Enterprise.IMSPContact | null;

    /** License addOns */
    addOns?: Enterprise.ILicenseAddOn[] | null;

    /** License nextBillingDate */
    nextBillingDate?: number | Long | null;

    /** License hasMSPLegacyLog */
    hasMSPLegacyLog?: boolean | null;

    /** License mspPermits */
    mspPermits?: Enterprise.IMSPPermits | null;

    /** License distributor */
    distributor?: boolean | null;
  }

  /** Represents a License. */
  class License implements ILicense {
    /**
     * Constructs a new License.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ILicense);

    /** License paid. */
    public paid: boolean;

    /** License numberOfSeats. */
    public numberOfSeats: number;

    /** License expiration. */
    public expiration: number | Long;

    /** License licenseKeyId. */
    public licenseKeyId: number;

    /** License productTypeId. */
    public productTypeId: number;

    /** License name. */
    public name: string;

    /** License enterpriseLicenseId. */
    public enterpriseLicenseId: number | Long;

    /** License seatsAllocated. */
    public seatsAllocated: number;

    /** License seatsPending. */
    public seatsPending: number;

    /** License tier. */
    public tier: number;

    /** License filePlanTypeId. */
    public filePlanTypeId: number;

    /** License maxBytes. */
    public maxBytes: number | Long;

    /** License storageExpiration. */
    public storageExpiration: number | Long;

    /** License licenseStatus. */
    public licenseStatus: string;

    /** License mspPool. */
    public mspPool: Enterprise.IMSPPool[];

    /** License managedBy. */
    public managedBy?: Enterprise.IMSPContact | null;

    /** License addOns. */
    public addOns: Enterprise.ILicenseAddOn[];

    /** License nextBillingDate. */
    public nextBillingDate: number | Long;

    /** License hasMSPLegacyLog. */
    public hasMSPLegacyLog: boolean;

    /** License mspPermits. */
    public mspPermits?: Enterprise.IMSPPermits | null;

    /** License distributor. */
    public distributor: boolean;

    /**
     * Creates a new License instance using the specified properties.
     * @param [properties] Properties to set
     * @returns License instance
     */
    public static create(properties?: Enterprise.ILicense): Enterprise.License;

    /**
     * Encodes the specified License message. Does not implicitly {@link Enterprise.License.verify|verify} messages.
     * @param message License message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.ILicense, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified License message, length delimited. Does not implicitly {@link Enterprise.License.verify|verify} messages.
     * @param message License message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ILicense,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a License message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns License
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.License;

    /**
     * Decodes a License message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns License
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.License;

    /**
     * Verifies a License message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a License message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns License
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.License;

    /**
     * Creates a plain object from a License message. Also converts values to other types if specified.
     * @param message License
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.License,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this License to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for License
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Bridge. */
  interface IBridge {
    /** Bridge bridgeId */
    bridgeId?: number | Long | null;

    /** Bridge nodeId */
    nodeId?: number | Long | null;

    /** Bridge wanIpEnforcement */
    wanIpEnforcement?: string | null;

    /** Bridge lanIpEnforcement */
    lanIpEnforcement?: string | null;

    /** Bridge status */
    status?: string | null;
  }

  /** Represents a Bridge. */
  class Bridge implements IBridge {
    /**
     * Constructs a new Bridge.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBridge);

    /** Bridge bridgeId. */
    public bridgeId: number | Long;

    /** Bridge nodeId. */
    public nodeId: number | Long;

    /** Bridge wanIpEnforcement. */
    public wanIpEnforcement: string;

    /** Bridge lanIpEnforcement. */
    public lanIpEnforcement: string;

    /** Bridge status. */
    public status: string;

    /**
     * Creates a new Bridge instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Bridge instance
     */
    public static create(properties?: Enterprise.IBridge): Enterprise.Bridge;

    /**
     * Encodes the specified Bridge message. Does not implicitly {@link Enterprise.Bridge.verify|verify} messages.
     * @param message Bridge message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IBridge, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Bridge message, length delimited. Does not implicitly {@link Enterprise.Bridge.verify|verify} messages.
     * @param message Bridge message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBridge,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Bridge message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Bridge
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.Bridge;

    /**
     * Decodes a Bridge message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Bridge
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Bridge;

    /**
     * Verifies a Bridge message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Bridge message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Bridge
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Bridge;

    /**
     * Creates a plain object from a Bridge message. Also converts values to other types if specified.
     * @param message Bridge
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Bridge,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Bridge to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Bridge
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Scim. */
  interface IScim {
    /** Scim scimId */
    scimId?: number | Long | null;

    /** Scim nodeId */
    nodeId?: number | Long | null;

    /** Scim status */
    status?: string | null;

    /** Scim lastSynced */
    lastSynced?: number | Long | null;

    /** Scim rolePrefix */
    rolePrefix?: string | null;

    /** Scim uniqueGroups */
    uniqueGroups?: boolean | null;
  }

  /** Represents a Scim. */
  class Scim implements IScim {
    /**
     * Constructs a new Scim.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IScim);

    /** Scim scimId. */
    public scimId: number | Long;

    /** Scim nodeId. */
    public nodeId: number | Long;

    /** Scim status. */
    public status: string;

    /** Scim lastSynced. */
    public lastSynced: number | Long;

    /** Scim rolePrefix. */
    public rolePrefix: string;

    /** Scim uniqueGroups. */
    public uniqueGroups: boolean;

    /**
     * Creates a new Scim instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Scim instance
     */
    public static create(properties?: Enterprise.IScim): Enterprise.Scim;

    /**
     * Encodes the specified Scim message. Does not implicitly {@link Enterprise.Scim.verify|verify} messages.
     * @param message Scim message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IScim, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Scim message, length delimited. Does not implicitly {@link Enterprise.Scim.verify|verify} messages.
     * @param message Scim message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IScim,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Scim message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Scim
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.Scim;

    /**
     * Decodes a Scim message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Scim
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.Scim;

    /**
     * Verifies a Scim message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Scim message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Scim
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.Scim;

    /**
     * Creates a plain object from a Scim message. Also converts values to other types if specified.
     * @param message Scim
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.Scim,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Scim to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Scim
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EmailProvision. */
  interface IEmailProvision {
    /** EmailProvision id */
    id?: number | null;

    /** EmailProvision nodeId */
    nodeId?: number | Long | null;

    /** EmailProvision domain */
    domain?: string | null;

    /** EmailProvision method */
    method?: string | null;
  }

  /** Represents an EmailProvision. */
  class EmailProvision implements IEmailProvision {
    /**
     * Constructs a new EmailProvision.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEmailProvision);

    /** EmailProvision id. */
    public id: number;

    /** EmailProvision nodeId. */
    public nodeId: number | Long;

    /** EmailProvision domain. */
    public domain: string;

    /** EmailProvision method. */
    public method: string;

    /**
     * Creates a new EmailProvision instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EmailProvision instance
     */
    public static create(properties?: Enterprise.IEmailProvision): Enterprise.EmailProvision;

    /**
     * Encodes the specified EmailProvision message. Does not implicitly {@link Enterprise.EmailProvision.verify|verify} messages.
     * @param message EmailProvision message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEmailProvision,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EmailProvision message, length delimited. Does not implicitly {@link Enterprise.EmailProvision.verify|verify} messages.
     * @param message EmailProvision message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEmailProvision,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EmailProvision message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EmailProvision
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EmailProvision;

    /**
     * Decodes an EmailProvision message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EmailProvision
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.EmailProvision;

    /**
     * Verifies an EmailProvision message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EmailProvision message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EmailProvision
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EmailProvision;

    /**
     * Creates a plain object from an EmailProvision message. Also converts values to other types if specified.
     * @param message EmailProvision
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EmailProvision,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EmailProvision to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EmailProvision
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a QueuedTeam. */
  interface IQueuedTeam {
    /** QueuedTeam teamUid */
    teamUid?: Uint8Array | null;

    /** QueuedTeam name */
    name?: string | null;

    /** QueuedTeam nodeId */
    nodeId?: number | Long | null;

    /** QueuedTeam encryptedData */
    encryptedData?: string | null;
  }

  /** Represents a QueuedTeam. */
  class QueuedTeam implements IQueuedTeam {
    /**
     * Constructs a new QueuedTeam.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IQueuedTeam);

    /** QueuedTeam teamUid. */
    public teamUid: Uint8Array;

    /** QueuedTeam name. */
    public name: string;

    /** QueuedTeam nodeId. */
    public nodeId: number | Long;

    /** QueuedTeam encryptedData. */
    public encryptedData: string;

    /**
     * Creates a new QueuedTeam instance using the specified properties.
     * @param [properties] Properties to set
     * @returns QueuedTeam instance
     */
    public static create(properties?: Enterprise.IQueuedTeam): Enterprise.QueuedTeam;

    /**
     * Encodes the specified QueuedTeam message. Does not implicitly {@link Enterprise.QueuedTeam.verify|verify} messages.
     * @param message QueuedTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IQueuedTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified QueuedTeam message, length delimited. Does not implicitly {@link Enterprise.QueuedTeam.verify|verify} messages.
     * @param message QueuedTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IQueuedTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a QueuedTeam message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns QueuedTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.QueuedTeam;

    /**
     * Decodes a QueuedTeam message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns QueuedTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.QueuedTeam;

    /**
     * Verifies a QueuedTeam message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a QueuedTeam message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns QueuedTeam
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.QueuedTeam;

    /**
     * Creates a plain object from a QueuedTeam message. Also converts values to other types if specified.
     * @param message QueuedTeam
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.QueuedTeam,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this QueuedTeam to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for QueuedTeam
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a QueuedTeamUser. */
  interface IQueuedTeamUser {
    /** QueuedTeamUser teamUid */
    teamUid?: Uint8Array | null;

    /** QueuedTeamUser users */
    users?: (number | Long)[] | null;
  }

  /** Represents a QueuedTeamUser. */
  class QueuedTeamUser implements IQueuedTeamUser {
    /**
     * Constructs a new QueuedTeamUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IQueuedTeamUser);

    /** QueuedTeamUser teamUid. */
    public teamUid: Uint8Array;

    /** QueuedTeamUser users. */
    public users: (number | Long)[];

    /**
     * Creates a new QueuedTeamUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns QueuedTeamUser instance
     */
    public static create(properties?: Enterprise.IQueuedTeamUser): Enterprise.QueuedTeamUser;

    /**
     * Encodes the specified QueuedTeamUser message. Does not implicitly {@link Enterprise.QueuedTeamUser.verify|verify} messages.
     * @param message QueuedTeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IQueuedTeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified QueuedTeamUser message, length delimited. Does not implicitly {@link Enterprise.QueuedTeamUser.verify|verify} messages.
     * @param message QueuedTeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IQueuedTeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a QueuedTeamUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns QueuedTeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.QueuedTeamUser;

    /**
     * Decodes a QueuedTeamUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns QueuedTeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.QueuedTeamUser;

    /**
     * Verifies a QueuedTeamUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a QueuedTeamUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns QueuedTeamUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.QueuedTeamUser;

    /**
     * Creates a plain object from a QueuedTeamUser message. Also converts values to other types if specified.
     * @param message QueuedTeamUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.QueuedTeamUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this QueuedTeamUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for QueuedTeamUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsAddResult. */
  interface ITeamsAddResult {
    /** TeamsAddResult successfulTeamAdd */
    successfulTeamAdd?: Enterprise.ITeamAddResult[] | null;

    /** TeamsAddResult unsuccessfulTeamAdd */
    unsuccessfulTeamAdd?: Enterprise.ITeamAddResult[] | null;

    /** TeamsAddResult result */
    result?: string | null;

    /** TeamsAddResult errorMessage */
    errorMessage?: string | null;
  }

  /** Represents a TeamsAddResult. */
  class TeamsAddResult implements ITeamsAddResult {
    /**
     * Constructs a new TeamsAddResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsAddResult);

    /** TeamsAddResult successfulTeamAdd. */
    public successfulTeamAdd: Enterprise.ITeamAddResult[];

    /** TeamsAddResult unsuccessfulTeamAdd. */
    public unsuccessfulTeamAdd: Enterprise.ITeamAddResult[];

    /** TeamsAddResult result. */
    public result: string;

    /** TeamsAddResult errorMessage. */
    public errorMessage: string;

    /**
     * Creates a new TeamsAddResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsAddResult instance
     */
    public static create(properties?: Enterprise.ITeamsAddResult): Enterprise.TeamsAddResult;

    /**
     * Encodes the specified TeamsAddResult message. Does not implicitly {@link Enterprise.TeamsAddResult.verify|verify} messages.
     * @param message TeamsAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsAddResult message, length delimited. Does not implicitly {@link Enterprise.TeamsAddResult.verify|verify} messages.
     * @param message TeamsAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsAddResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsAddResult;

    /**
     * Decodes a TeamsAddResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.TeamsAddResult;

    /**
     * Verifies a TeamsAddResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsAddResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsAddResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.TeamsAddResult;

    /**
     * Creates a plain object from a TeamsAddResult message. Also converts values to other types if specified.
     * @param message TeamsAddResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsAddResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsAddResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsAddResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamAddResult. */
  interface ITeamAddResult {
    /** TeamAddResult team */
    team?: Enterprise.ITeam | null;

    /** TeamAddResult result */
    result?: string | null;

    /** TeamAddResult errorMessage */
    errorMessage?: string | null;
  }

  /** Represents a TeamAddResult. */
  class TeamAddResult implements ITeamAddResult {
    /**
     * Constructs a new TeamAddResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamAddResult);

    /** TeamAddResult team. */
    public team?: Enterprise.ITeam | null;

    /** TeamAddResult result. */
    public result: string;

    /** TeamAddResult errorMessage. */
    public errorMessage: string;

    /**
     * Creates a new TeamAddResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamAddResult instance
     */
    public static create(properties?: Enterprise.ITeamAddResult): Enterprise.TeamAddResult;

    /**
     * Encodes the specified TeamAddResult message. Does not implicitly {@link Enterprise.TeamAddResult.verify|verify} messages.
     * @param message TeamAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamAddResult message, length delimited. Does not implicitly {@link Enterprise.TeamAddResult.verify|verify} messages.
     * @param message TeamAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamAddResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamAddResult;

    /**
     * Decodes a TeamAddResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.TeamAddResult;

    /**
     * Verifies a TeamAddResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamAddResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamAddResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.TeamAddResult;

    /**
     * Creates a plain object from a TeamAddResult message. Also converts values to other types if specified.
     * @param message TeamAddResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamAddResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamAddResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamAddResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SsoService. */
  interface ISsoService {
    /** SsoService ssoServiceProviderId */
    ssoServiceProviderId?: number | Long | null;

    /** SsoService nodeId */
    nodeId?: number | Long | null;

    /** SsoService name */
    name?: string | null;

    /** SsoService spUrl */
    spUrl?: string | null;

    /** SsoService inviteNewUsers */
    inviteNewUsers?: boolean | null;

    /** SsoService active */
    active?: boolean | null;

    /** SsoService isCloud */
    isCloud?: boolean | null;
  }

  /** Represents a SsoService. */
  class SsoService implements ISsoService {
    /**
     * Constructs a new SsoService.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISsoService);

    /** SsoService ssoServiceProviderId. */
    public ssoServiceProviderId: number | Long;

    /** SsoService nodeId. */
    public nodeId: number | Long;

    /** SsoService name. */
    public name: string;

    /** SsoService spUrl. */
    public spUrl: string;

    /** SsoService inviteNewUsers. */
    public inviteNewUsers: boolean;

    /** SsoService active. */
    public active: boolean;

    /** SsoService isCloud. */
    public isCloud: boolean;

    /**
     * Creates a new SsoService instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SsoService instance
     */
    public static create(properties?: Enterprise.ISsoService): Enterprise.SsoService;

    /**
     * Encodes the specified SsoService message. Does not implicitly {@link Enterprise.SsoService.verify|verify} messages.
     * @param message SsoService message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISsoService,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SsoService message, length delimited. Does not implicitly {@link Enterprise.SsoService.verify|verify} messages.
     * @param message SsoService message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISsoService,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SsoService message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SsoService
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SsoService;

    /**
     * Decodes a SsoService message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SsoService
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.SsoService;

    /**
     * Verifies a SsoService message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SsoService message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SsoService
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SsoService;

    /**
     * Creates a plain object from a SsoService message. Also converts values to other types if specified.
     * @param message SsoService
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SsoService,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SsoService to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SsoService
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ReportFilterUser. */
  interface IReportFilterUser {
    /** ReportFilterUser userId */
    userId?: number | null;

    /** ReportFilterUser email */
    email?: string | null;
  }

  /** Represents a ReportFilterUser. */
  class ReportFilterUser implements IReportFilterUser {
    /**
     * Constructs a new ReportFilterUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IReportFilterUser);

    /** ReportFilterUser userId. */
    public userId: number;

    /** ReportFilterUser email. */
    public email: string;

    /**
     * Creates a new ReportFilterUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ReportFilterUser instance
     */
    public static create(properties?: Enterprise.IReportFilterUser): Enterprise.ReportFilterUser;

    /**
     * Encodes the specified ReportFilterUser message. Does not implicitly {@link Enterprise.ReportFilterUser.verify|verify} messages.
     * @param message ReportFilterUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IReportFilterUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ReportFilterUser message, length delimited. Does not implicitly {@link Enterprise.ReportFilterUser.verify|verify} messages.
     * @param message ReportFilterUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IReportFilterUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ReportFilterUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ReportFilterUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ReportFilterUser;

    /**
     * Decodes a ReportFilterUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ReportFilterUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ReportFilterUser;

    /**
     * Verifies a ReportFilterUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ReportFilterUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ReportFilterUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ReportFilterUser;

    /**
     * Creates a plain object from a ReportFilterUser message. Also converts values to other types if specified.
     * @param message ReportFilterUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ReportFilterUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ReportFilterUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ReportFilterUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DeviceRequestForAdminApproval. */
  interface IDeviceRequestForAdminApproval {
    /** DeviceRequestForAdminApproval deviceId */
    deviceId?: number | Long | null;

    /** DeviceRequestForAdminApproval enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** DeviceRequestForAdminApproval encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** DeviceRequestForAdminApproval devicePublicKey */
    devicePublicKey?: Uint8Array | null;

    /** DeviceRequestForAdminApproval deviceName */
    deviceName?: string | null;

    /** DeviceRequestForAdminApproval clientVersion */
    clientVersion?: string | null;

    /** DeviceRequestForAdminApproval deviceType */
    deviceType?: string | null;

    /** DeviceRequestForAdminApproval date */
    date?: number | Long | null;

    /** DeviceRequestForAdminApproval ipAddress */
    ipAddress?: string | null;

    /** DeviceRequestForAdminApproval location */
    location?: string | null;

    /** DeviceRequestForAdminApproval email */
    email?: string | null;

    /** DeviceRequestForAdminApproval accountUid */
    accountUid?: Uint8Array | null;
  }

  /** Represents a DeviceRequestForAdminApproval. */
  class DeviceRequestForAdminApproval implements IDeviceRequestForAdminApproval {
    /**
     * Constructs a new DeviceRequestForAdminApproval.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDeviceRequestForAdminApproval);

    /** DeviceRequestForAdminApproval deviceId. */
    public deviceId: number | Long;

    /** DeviceRequestForAdminApproval enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** DeviceRequestForAdminApproval encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** DeviceRequestForAdminApproval devicePublicKey. */
    public devicePublicKey: Uint8Array;

    /** DeviceRequestForAdminApproval deviceName. */
    public deviceName: string;

    /** DeviceRequestForAdminApproval clientVersion. */
    public clientVersion: string;

    /** DeviceRequestForAdminApproval deviceType. */
    public deviceType: string;

    /** DeviceRequestForAdminApproval date. */
    public date: number | Long;

    /** DeviceRequestForAdminApproval ipAddress. */
    public ipAddress: string;

    /** DeviceRequestForAdminApproval location. */
    public location: string;

    /** DeviceRequestForAdminApproval email. */
    public email: string;

    /** DeviceRequestForAdminApproval accountUid. */
    public accountUid: Uint8Array;

    /**
     * Creates a new DeviceRequestForAdminApproval instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeviceRequestForAdminApproval instance
     */
    public static create(
      properties?: Enterprise.IDeviceRequestForAdminApproval,
    ): Enterprise.DeviceRequestForAdminApproval;

    /**
     * Encodes the specified DeviceRequestForAdminApproval message. Does not implicitly {@link Enterprise.DeviceRequestForAdminApproval.verify|verify} messages.
     * @param message DeviceRequestForAdminApproval message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDeviceRequestForAdminApproval,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DeviceRequestForAdminApproval message, length delimited. Does not implicitly {@link Enterprise.DeviceRequestForAdminApproval.verify|verify} messages.
     * @param message DeviceRequestForAdminApproval message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDeviceRequestForAdminApproval,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DeviceRequestForAdminApproval message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeviceRequestForAdminApproval
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DeviceRequestForAdminApproval;

    /**
     * Decodes a DeviceRequestForAdminApproval message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeviceRequestForAdminApproval
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DeviceRequestForAdminApproval;

    /**
     * Verifies a DeviceRequestForAdminApproval message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DeviceRequestForAdminApproval message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeviceRequestForAdminApproval
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.DeviceRequestForAdminApproval;

    /**
     * Creates a plain object from a DeviceRequestForAdminApproval message. Also converts values to other types if specified.
     * @param message DeviceRequestForAdminApproval
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DeviceRequestForAdminApproval,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DeviceRequestForAdminApproval to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeviceRequestForAdminApproval
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseData. */
  interface IEnterpriseData {
    /** EnterpriseData entity */
    entity?: Enterprise.EnterpriseDataEntity | null;

    /** EnterpriseData delete */
    delete?: boolean | null;

    /** EnterpriseData data */
    data?: Uint8Array[] | null;
  }

  /** Represents an EnterpriseData. */
  class EnterpriseData implements IEnterpriseData {
    /**
     * Constructs a new EnterpriseData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseData);

    /** EnterpriseData entity. */
    public entity: Enterprise.EnterpriseDataEntity;

    /** EnterpriseData delete. */
    public delete: boolean;

    /** EnterpriseData data. */
    public data: Uint8Array[];

    /**
     * Creates a new EnterpriseData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseData instance
     */
    public static create(properties?: Enterprise.IEnterpriseData): Enterprise.EnterpriseData;

    /**
     * Encodes the specified EnterpriseData message. Does not implicitly {@link Enterprise.EnterpriseData.verify|verify} messages.
     * @param message EnterpriseData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseData message, length delimited. Does not implicitly {@link Enterprise.EnterpriseData.verify|verify} messages.
     * @param message EnterpriseData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseData;

    /**
     * Decodes an EnterpriseData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.EnterpriseData;

    /**
     * Verifies an EnterpriseData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseData
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseData;

    /**
     * Creates a plain object from an EnterpriseData message. Also converts values to other types if specified.
     * @param message EnterpriseData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseDataResponse. */
  interface IEnterpriseDataResponse {
    /** EnterpriseDataResponse continuationToken */
    continuationToken?: Uint8Array | null;

    /** EnterpriseDataResponse hasMore */
    hasMore?: boolean | null;

    /** EnterpriseDataResponse cacheStatus */
    cacheStatus?: Enterprise.CacheStatus | null;

    /** EnterpriseDataResponse data */
    data?: Enterprise.IEnterpriseData[] | null;

    /** EnterpriseDataResponse generalData */
    generalData?: Enterprise.IGeneralDataEntity | null;
  }

  /** Represents an EnterpriseDataResponse. */
  class EnterpriseDataResponse implements IEnterpriseDataResponse {
    /**
     * Constructs a new EnterpriseDataResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseDataResponse);

    /** EnterpriseDataResponse continuationToken. */
    public continuationToken: Uint8Array;

    /** EnterpriseDataResponse hasMore. */
    public hasMore: boolean;

    /** EnterpriseDataResponse cacheStatus. */
    public cacheStatus: Enterprise.CacheStatus;

    /** EnterpriseDataResponse data. */
    public data: Enterprise.IEnterpriseData[];

    /** EnterpriseDataResponse generalData. */
    public generalData?: Enterprise.IGeneralDataEntity | null;

    /**
     * Creates a new EnterpriseDataResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseDataResponse instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseDataResponse,
    ): Enterprise.EnterpriseDataResponse;

    /**
     * Encodes the specified EnterpriseDataResponse message. Does not implicitly {@link Enterprise.EnterpriseDataResponse.verify|verify} messages.
     * @param message EnterpriseDataResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseDataResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseDataResponse message, length delimited. Does not implicitly {@link Enterprise.EnterpriseDataResponse.verify|verify} messages.
     * @param message EnterpriseDataResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseDataResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseDataResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseDataResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseDataResponse;

    /**
     * Decodes an EnterpriseDataResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseDataResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseDataResponse;

    /**
     * Verifies an EnterpriseDataResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseDataResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseDataResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseDataResponse;

    /**
     * Creates a plain object from an EnterpriseDataResponse message. Also converts values to other types if specified.
     * @param message EnterpriseDataResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseDataResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseDataResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseDataResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupRequest. */
  interface IBackupRequest {
    /** BackupRequest continuationToken */
    continuationToken?: Uint8Array | null;
  }

  /** Represents a BackupRequest. */
  class BackupRequest implements IBackupRequest {
    /**
     * Constructs a new BackupRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupRequest);

    /** BackupRequest continuationToken. */
    public continuationToken: Uint8Array;

    /**
     * Creates a new BackupRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupRequest instance
     */
    public static create(properties?: Enterprise.IBackupRequest): Enterprise.BackupRequest;

    /**
     * Encodes the specified BackupRequest message. Does not implicitly {@link Enterprise.BackupRequest.verify|verify} messages.
     * @param message BackupRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupRequest message, length delimited. Does not implicitly {@link Enterprise.BackupRequest.verify|verify} messages.
     * @param message BackupRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupRequest;

    /**
     * Decodes a BackupRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupRequest;

    /**
     * Verifies a BackupRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupRequest;

    /**
     * Creates a plain object from a BackupRequest message. Also converts values to other types if specified.
     * @param message BackupRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupRecord. */
  interface IBackupRecord {
    /** BackupRecord userId */
    userId?: number | null;

    /** BackupRecord recordUid */
    recordUid?: Uint8Array | null;

    /** BackupRecord key */
    key?: Uint8Array | null;

    /** BackupRecord keyType */
    keyType?: Enterprise.BackupKeyType | null;

    /** BackupRecord version */
    version?: number | null;

    /** BackupRecord data */
    data?: Uint8Array | null;

    /** BackupRecord extra */
    extra?: Uint8Array | null;
  }

  /** Represents a BackupRecord. */
  class BackupRecord implements IBackupRecord {
    /**
     * Constructs a new BackupRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupRecord);

    /** BackupRecord userId. */
    public userId: number;

    /** BackupRecord recordUid. */
    public recordUid: Uint8Array;

    /** BackupRecord key. */
    public key: Uint8Array;

    /** BackupRecord keyType. */
    public keyType: Enterprise.BackupKeyType;

    /** BackupRecord version. */
    public version: number;

    /** BackupRecord data. */
    public data: Uint8Array;

    /** BackupRecord extra. */
    public extra: Uint8Array;

    /**
     * Creates a new BackupRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupRecord instance
     */
    public static create(properties?: Enterprise.IBackupRecord): Enterprise.BackupRecord;

    /**
     * Encodes the specified BackupRecord message. Does not implicitly {@link Enterprise.BackupRecord.verify|verify} messages.
     * @param message BackupRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupRecord message, length delimited. Does not implicitly {@link Enterprise.BackupRecord.verify|verify} messages.
     * @param message BackupRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupRecord;

    /**
     * Decodes a BackupRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupRecord;

    /**
     * Verifies a BackupRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupRecord;

    /**
     * Creates a plain object from a BackupRecord message. Also converts values to other types if specified.
     * @param message BackupRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupKey. */
  interface IBackupKey {
    /** BackupKey userId */
    userId?: number | null;

    /** BackupKey backupKey */
    backupKey?: Uint8Array | null;
  }

  /** Represents a BackupKey. */
  class BackupKey implements IBackupKey {
    /**
     * Constructs a new BackupKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupKey);

    /** BackupKey userId. */
    public userId: number;

    /** BackupKey backupKey. */
    public backupKey: Uint8Array;

    /**
     * Creates a new BackupKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupKey instance
     */
    public static create(properties?: Enterprise.IBackupKey): Enterprise.BackupKey;

    /**
     * Encodes the specified BackupKey message. Does not implicitly {@link Enterprise.BackupKey.verify|verify} messages.
     * @param message BackupKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupKey message, length delimited. Does not implicitly {@link Enterprise.BackupKey.verify|verify} messages.
     * @param message BackupKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupKey;

    /**
     * Decodes a BackupKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupKey;

    /**
     * Verifies a BackupKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupKey;

    /**
     * Creates a plain object from a BackupKey message. Also converts values to other types if specified.
     * @param message BackupKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupUser. */
  interface IBackupUser {
    /** BackupUser userId */
    userId?: number | null;

    /** BackupUser userName */
    userName?: string | null;

    /** BackupUser dataKey */
    dataKey?: Uint8Array | null;

    /** BackupUser dataKeyType */
    dataKeyType?: Enterprise.BackupUserDataKeyType | null;

    /** BackupUser privateKey */
    privateKey?: Uint8Array | null;

    /** BackupUser treeKey */
    treeKey?: Uint8Array | null;

    /** BackupUser treeKeyType */
    treeKeyType?: Enterprise.BackupKeyType | null;

    /** BackupUser backupKeys */
    backupKeys?: Enterprise.IBackupKey[] | null;

    /** BackupUser privateECKey */
    privateECKey?: Uint8Array | null;
  }

  /** Represents a BackupUser. */
  class BackupUser implements IBackupUser {
    /**
     * Constructs a new BackupUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupUser);

    /** BackupUser userId. */
    public userId: number;

    /** BackupUser userName. */
    public userName: string;

    /** BackupUser dataKey. */
    public dataKey: Uint8Array;

    /** BackupUser dataKeyType. */
    public dataKeyType: Enterprise.BackupUserDataKeyType;

    /** BackupUser privateKey. */
    public privateKey: Uint8Array;

    /** BackupUser treeKey. */
    public treeKey: Uint8Array;

    /** BackupUser treeKeyType. */
    public treeKeyType: Enterprise.BackupKeyType;

    /** BackupUser backupKeys. */
    public backupKeys: Enterprise.IBackupKey[];

    /** BackupUser privateECKey. */
    public privateECKey: Uint8Array;

    /**
     * Creates a new BackupUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupUser instance
     */
    public static create(properties?: Enterprise.IBackupUser): Enterprise.BackupUser;

    /**
     * Encodes the specified BackupUser message. Does not implicitly {@link Enterprise.BackupUser.verify|verify} messages.
     * @param message BackupUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupUser message, length delimited. Does not implicitly {@link Enterprise.BackupUser.verify|verify} messages.
     * @param message BackupUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupUser;

    /**
     * Decodes a BackupUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupUser;

    /**
     * Verifies a BackupUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupUser;

    /**
     * Creates a plain object from a BackupUser message. Also converts values to other types if specified.
     * @param message BackupUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupResponse. */
  interface IBackupResponse {
    /** BackupResponse enterpriseEccPrivateKey */
    enterpriseEccPrivateKey?: Uint8Array | null;

    /** BackupResponse users */
    users?: Enterprise.IBackupUser[] | null;

    /** BackupResponse records */
    records?: Enterprise.IBackupRecord[] | null;

    /** BackupResponse continuationToken */
    continuationToken?: Uint8Array | null;
  }

  /** Represents a BackupResponse. */
  class BackupResponse implements IBackupResponse {
    /**
     * Constructs a new BackupResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupResponse);

    /** BackupResponse enterpriseEccPrivateKey. */
    public enterpriseEccPrivateKey: Uint8Array;

    /** BackupResponse users. */
    public users: Enterprise.IBackupUser[];

    /** BackupResponse records. */
    public records: Enterprise.IBackupRecord[];

    /** BackupResponse continuationToken. */
    public continuationToken: Uint8Array;

    /**
     * Creates a new BackupResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupResponse instance
     */
    public static create(properties?: Enterprise.IBackupResponse): Enterprise.BackupResponse;

    /**
     * Encodes the specified BackupResponse message. Does not implicitly {@link Enterprise.BackupResponse.verify|verify} messages.
     * @param message BackupResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupResponse message, length delimited. Does not implicitly {@link Enterprise.BackupResponse.verify|verify} messages.
     * @param message BackupResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupResponse;

    /**
     * Decodes a BackupResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupResponse;

    /**
     * Verifies a BackupResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupResponse;

    /**
     * Creates a plain object from a BackupResponse message. Also converts values to other types if specified.
     * @param message BackupResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupFile. */
  interface IBackupFile {
    /** BackupFile user */
    user?: string | null;

    /** BackupFile backupUid */
    backupUid?: Uint8Array | null;

    /** BackupFile fileName */
    fileName?: string | null;

    /** BackupFile created */
    created?: number | Long | null;

    /** BackupFile downloadUrl */
    downloadUrl?: string | null;
  }

  /** Represents a BackupFile. */
  class BackupFile implements IBackupFile {
    /**
     * Constructs a new BackupFile.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupFile);

    /** BackupFile user. */
    public user: string;

    /** BackupFile backupUid. */
    public backupUid: Uint8Array;

    /** BackupFile fileName. */
    public fileName: string;

    /** BackupFile created. */
    public created: number | Long;

    /** BackupFile downloadUrl. */
    public downloadUrl: string;

    /**
     * Creates a new BackupFile instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupFile instance
     */
    public static create(properties?: Enterprise.IBackupFile): Enterprise.BackupFile;

    /**
     * Encodes the specified BackupFile message. Does not implicitly {@link Enterprise.BackupFile.verify|verify} messages.
     * @param message BackupFile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupFile,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupFile message, length delimited. Does not implicitly {@link Enterprise.BackupFile.verify|verify} messages.
     * @param message BackupFile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupFile,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupFile message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupFile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupFile;

    /**
     * Decodes a BackupFile message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupFile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.BackupFile;

    /**
     * Verifies a BackupFile message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupFile message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupFile
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupFile;

    /**
     * Creates a plain object from a BackupFile message. Also converts values to other types if specified.
     * @param message BackupFile
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupFile,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupFile to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupFile
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BackupsResponse. */
  interface IBackupsResponse {
    /** BackupsResponse files */
    files?: Enterprise.IBackupFile[] | null;
  }

  /** Represents a BackupsResponse. */
  class BackupsResponse implements IBackupsResponse {
    /**
     * Constructs a new BackupsResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IBackupsResponse);

    /** BackupsResponse files. */
    public files: Enterprise.IBackupFile[];

    /**
     * Creates a new BackupsResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackupsResponse instance
     */
    public static create(properties?: Enterprise.IBackupsResponse): Enterprise.BackupsResponse;

    /**
     * Encodes the specified BackupsResponse message. Does not implicitly {@link Enterprise.BackupsResponse.verify|verify} messages.
     * @param message BackupsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IBackupsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BackupsResponse message, length delimited. Does not implicitly {@link Enterprise.BackupsResponse.verify|verify} messages.
     * @param message BackupsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IBackupsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BackupsResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackupsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.BackupsResponse;

    /**
     * Decodes a BackupsResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackupsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.BackupsResponse;

    /**
     * Verifies a BackupsResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BackupsResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackupsResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.BackupsResponse;

    /**
     * Creates a plain object from a BackupsResponse message. Also converts values to other types if specified.
     * @param message BackupsResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.BackupsResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BackupsResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BackupsResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetEnterpriseDataKeysRequest. */
  interface IGetEnterpriseDataKeysRequest {
    /** GetEnterpriseDataKeysRequest roleId */
    roleId?: (number | Long)[] | null;
  }

  /** Represents a GetEnterpriseDataKeysRequest. */
  class GetEnterpriseDataKeysRequest implements IGetEnterpriseDataKeysRequest {
    /**
     * Constructs a new GetEnterpriseDataKeysRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetEnterpriseDataKeysRequest);

    /** GetEnterpriseDataKeysRequest roleId. */
    public roleId: (number | Long)[];

    /**
     * Creates a new GetEnterpriseDataKeysRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetEnterpriseDataKeysRequest instance
     */
    public static create(
      properties?: Enterprise.IGetEnterpriseDataKeysRequest,
    ): Enterprise.GetEnterpriseDataKeysRequest;

    /**
     * Encodes the specified GetEnterpriseDataKeysRequest message. Does not implicitly {@link Enterprise.GetEnterpriseDataKeysRequest.verify|verify} messages.
     * @param message GetEnterpriseDataKeysRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetEnterpriseDataKeysRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetEnterpriseDataKeysRequest message, length delimited. Does not implicitly {@link Enterprise.GetEnterpriseDataKeysRequest.verify|verify} messages.
     * @param message GetEnterpriseDataKeysRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetEnterpriseDataKeysRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetEnterpriseDataKeysRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetEnterpriseDataKeysRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetEnterpriseDataKeysRequest;

    /**
     * Decodes a GetEnterpriseDataKeysRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetEnterpriseDataKeysRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetEnterpriseDataKeysRequest;

    /**
     * Verifies a GetEnterpriseDataKeysRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetEnterpriseDataKeysRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetEnterpriseDataKeysRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetEnterpriseDataKeysRequest;

    /**
     * Creates a plain object from a GetEnterpriseDataKeysRequest message. Also converts values to other types if specified.
     * @param message GetEnterpriseDataKeysRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetEnterpriseDataKeysRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetEnterpriseDataKeysRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetEnterpriseDataKeysRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetEnterpriseDataKeysResponse. */
  interface IGetEnterpriseDataKeysResponse {
    /** GetEnterpriseDataKeysResponse reEncryptedRoleKey */
    reEncryptedRoleKey?: Enterprise.IReEncryptedRoleKey[] | null;

    /** GetEnterpriseDataKeysResponse roleKey */
    roleKey?: Enterprise.IRoleKey[] | null;

    /** GetEnterpriseDataKeysResponse mspKey */
    mspKey?: Enterprise.IMspKey | null;

    /** GetEnterpriseDataKeysResponse enterpriseKeys */
    enterpriseKeys?: Enterprise.IEnterpriseKeys | null;

    /** GetEnterpriseDataKeysResponse treeKey */
    treeKey?: Enterprise.ITreeKey | null;
  }

  /** Represents a GetEnterpriseDataKeysResponse. */
  class GetEnterpriseDataKeysResponse implements IGetEnterpriseDataKeysResponse {
    /**
     * Constructs a new GetEnterpriseDataKeysResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetEnterpriseDataKeysResponse);

    /** GetEnterpriseDataKeysResponse reEncryptedRoleKey. */
    public reEncryptedRoleKey: Enterprise.IReEncryptedRoleKey[];

    /** GetEnterpriseDataKeysResponse roleKey. */
    public roleKey: Enterprise.IRoleKey[];

    /** GetEnterpriseDataKeysResponse mspKey. */
    public mspKey?: Enterprise.IMspKey | null;

    /** GetEnterpriseDataKeysResponse enterpriseKeys. */
    public enterpriseKeys?: Enterprise.IEnterpriseKeys | null;

    /** GetEnterpriseDataKeysResponse treeKey. */
    public treeKey?: Enterprise.ITreeKey | null;

    /**
     * Creates a new GetEnterpriseDataKeysResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetEnterpriseDataKeysResponse instance
     */
    public static create(
      properties?: Enterprise.IGetEnterpriseDataKeysResponse,
    ): Enterprise.GetEnterpriseDataKeysResponse;

    /**
     * Encodes the specified GetEnterpriseDataKeysResponse message. Does not implicitly {@link Enterprise.GetEnterpriseDataKeysResponse.verify|verify} messages.
     * @param message GetEnterpriseDataKeysResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetEnterpriseDataKeysResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetEnterpriseDataKeysResponse message, length delimited. Does not implicitly {@link Enterprise.GetEnterpriseDataKeysResponse.verify|verify} messages.
     * @param message GetEnterpriseDataKeysResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetEnterpriseDataKeysResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetEnterpriseDataKeysResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetEnterpriseDataKeysResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetEnterpriseDataKeysResponse;

    /**
     * Decodes a GetEnterpriseDataKeysResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetEnterpriseDataKeysResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetEnterpriseDataKeysResponse;

    /**
     * Verifies a GetEnterpriseDataKeysResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetEnterpriseDataKeysResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetEnterpriseDataKeysResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.GetEnterpriseDataKeysResponse;

    /**
     * Creates a plain object from a GetEnterpriseDataKeysResponse message. Also converts values to other types if specified.
     * @param message GetEnterpriseDataKeysResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetEnterpriseDataKeysResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetEnterpriseDataKeysResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetEnterpriseDataKeysResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleKey. */
  interface IRoleKey {
    /** RoleKey roleId */
    roleId?: number | Long | null;

    /** RoleKey encryptedKey */
    encryptedKey?: string | null;

    /** RoleKey keyType */
    keyType?: Enterprise.EncryptedKeyType | null;
  }

  /** Represents a RoleKey. */
  class RoleKey implements IRoleKey {
    /**
     * Constructs a new RoleKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleKey);

    /** RoleKey roleId. */
    public roleId: number | Long;

    /** RoleKey encryptedKey. */
    public encryptedKey: string;

    /** RoleKey keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /**
     * Creates a new RoleKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleKey instance
     */
    public static create(properties?: Enterprise.IRoleKey): Enterprise.RoleKey;

    /**
     * Encodes the specified RoleKey message. Does not implicitly {@link Enterprise.RoleKey.verify|verify} messages.
     * @param message RoleKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IRoleKey, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RoleKey message, length delimited. Does not implicitly {@link Enterprise.RoleKey.verify|verify} messages.
     * @param message RoleKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleKey;

    /**
     * Decodes a RoleKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RoleKey;

    /**
     * Verifies a RoleKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleKey;

    /**
     * Creates a plain object from a RoleKey message. Also converts values to other types if specified.
     * @param message RoleKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a MspKey. */
  interface IMspKey {
    /** MspKey encryptedMspTreeKey */
    encryptedMspTreeKey?: string | null;

    /** MspKey encryptedMspTreeKeyType */
    encryptedMspTreeKeyType?: Enterprise.EncryptedKeyType | null;
  }

  /** Represents a MspKey. */
  class MspKey implements IMspKey {
    /**
     * Constructs a new MspKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IMspKey);

    /** MspKey encryptedMspTreeKey. */
    public encryptedMspTreeKey: string;

    /** MspKey encryptedMspTreeKeyType. */
    public encryptedMspTreeKeyType: Enterprise.EncryptedKeyType;

    /**
     * Creates a new MspKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MspKey instance
     */
    public static create(properties?: Enterprise.IMspKey): Enterprise.MspKey;

    /**
     * Encodes the specified MspKey message. Does not implicitly {@link Enterprise.MspKey.verify|verify} messages.
     * @param message MspKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.IMspKey, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MspKey message, length delimited. Does not implicitly {@link Enterprise.MspKey.verify|verify} messages.
     * @param message MspKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IMspKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a MspKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MspKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Enterprise.MspKey;

    /**
     * Decodes a MspKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MspKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.MspKey;

    /**
     * Verifies a MspKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a MspKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MspKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.MspKey;

    /**
     * Creates a plain object from a MspKey message. Also converts values to other types if specified.
     * @param message MspKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.MspKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this MspKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MspKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseKeys. */
  interface IEnterpriseKeys {
    /** EnterpriseKeys rsaPublicKey */
    rsaPublicKey?: Uint8Array | null;

    /** EnterpriseKeys rsaEncryptedPrivateKey */
    rsaEncryptedPrivateKey?: Uint8Array | null;

    /** EnterpriseKeys eccPublicKey */
    eccPublicKey?: Uint8Array | null;

    /** EnterpriseKeys eccEncryptedPrivateKey */
    eccEncryptedPrivateKey?: Uint8Array | null;
  }

  /** Represents an EnterpriseKeys. */
  class EnterpriseKeys implements IEnterpriseKeys {
    /**
     * Constructs a new EnterpriseKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseKeys);

    /** EnterpriseKeys rsaPublicKey. */
    public rsaPublicKey: Uint8Array;

    /** EnterpriseKeys rsaEncryptedPrivateKey. */
    public rsaEncryptedPrivateKey: Uint8Array;

    /** EnterpriseKeys eccPublicKey. */
    public eccPublicKey: Uint8Array;

    /** EnterpriseKeys eccEncryptedPrivateKey. */
    public eccEncryptedPrivateKey: Uint8Array;

    /**
     * Creates a new EnterpriseKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseKeys instance
     */
    public static create(properties?: Enterprise.IEnterpriseKeys): Enterprise.EnterpriseKeys;

    /**
     * Encodes the specified EnterpriseKeys message. Does not implicitly {@link Enterprise.EnterpriseKeys.verify|verify} messages.
     * @param message EnterpriseKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseKeys message, length delimited. Does not implicitly {@link Enterprise.EnterpriseKeys.verify|verify} messages.
     * @param message EnterpriseKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseKeys;

    /**
     * Decodes an EnterpriseKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.EnterpriseKeys;

    /**
     * Verifies an EnterpriseKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseKeys
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseKeys;

    /**
     * Creates a plain object from an EnterpriseKeys message. Also converts values to other types if specified.
     * @param message EnterpriseKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TreeKey. */
  interface ITreeKey {
    /** TreeKey treeKey */
    treeKey?: string | null;

    /** TreeKey keyTypeId */
    keyTypeId?: Enterprise.BackupKeyType | null;
  }

  /** Represents a TreeKey. */
  class TreeKey implements ITreeKey {
    /**
     * Constructs a new TreeKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITreeKey);

    /** TreeKey treeKey. */
    public treeKey: string;

    /** TreeKey keyTypeId. */
    public keyTypeId: Enterprise.BackupKeyType;

    /**
     * Creates a new TreeKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TreeKey instance
     */
    public static create(properties?: Enterprise.ITreeKey): Enterprise.TreeKey;

    /**
     * Encodes the specified TreeKey message. Does not implicitly {@link Enterprise.TreeKey.verify|verify} messages.
     * @param message TreeKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Enterprise.ITreeKey, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TreeKey message, length delimited. Does not implicitly {@link Enterprise.TreeKey.verify|verify} messages.
     * @param message TreeKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITreeKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TreeKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TreeKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TreeKey;

    /**
     * Decodes a TreeKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TreeKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.TreeKey;

    /**
     * Verifies a TreeKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TreeKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TreeKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.TreeKey;

    /**
     * Creates a plain object from a TreeKey message. Also converts values to other types if specified.
     * @param message TreeKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TreeKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TreeKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TreeKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedRecordResponse. */
  interface ISharedRecordResponse {
    /** SharedRecordResponse events */
    events?: Enterprise.ISharedRecordEvent[] | null;
  }

  /** Represents a SharedRecordResponse. */
  class SharedRecordResponse implements ISharedRecordResponse {
    /**
     * Constructs a new SharedRecordResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISharedRecordResponse);

    /** SharedRecordResponse events. */
    public events: Enterprise.ISharedRecordEvent[];

    /**
     * Creates a new SharedRecordResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedRecordResponse instance
     */
    public static create(
      properties?: Enterprise.ISharedRecordResponse,
    ): Enterprise.SharedRecordResponse;

    /**
     * Encodes the specified SharedRecordResponse message. Does not implicitly {@link Enterprise.SharedRecordResponse.verify|verify} messages.
     * @param message SharedRecordResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISharedRecordResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedRecordResponse message, length delimited. Does not implicitly {@link Enterprise.SharedRecordResponse.verify|verify} messages.
     * @param message SharedRecordResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISharedRecordResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedRecordResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedRecordResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SharedRecordResponse;

    /**
     * Decodes a SharedRecordResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedRecordResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SharedRecordResponse;

    /**
     * Verifies a SharedRecordResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedRecordResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedRecordResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SharedRecordResponse;

    /**
     * Creates a plain object from a SharedRecordResponse message. Also converts values to other types if specified.
     * @param message SharedRecordResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SharedRecordResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedRecordResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedRecordResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedRecordEvent. */
  interface ISharedRecordEvent {
    /** SharedRecordEvent recordUid */
    recordUid?: Uint8Array | null;

    /** SharedRecordEvent userName */
    userName?: string | null;

    /** SharedRecordEvent canEdit */
    canEdit?: boolean | null;

    /** SharedRecordEvent canReshare */
    canReshare?: boolean | null;

    /** SharedRecordEvent shareFrom */
    shareFrom?: number | null;
  }

  /** Represents a SharedRecordEvent. */
  class SharedRecordEvent implements ISharedRecordEvent {
    /**
     * Constructs a new SharedRecordEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISharedRecordEvent);

    /** SharedRecordEvent recordUid. */
    public recordUid: Uint8Array;

    /** SharedRecordEvent userName. */
    public userName: string;

    /** SharedRecordEvent canEdit. */
    public canEdit: boolean;

    /** SharedRecordEvent canReshare. */
    public canReshare: boolean;

    /** SharedRecordEvent shareFrom. */
    public shareFrom: number;

    /**
     * Creates a new SharedRecordEvent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedRecordEvent instance
     */
    public static create(properties?: Enterprise.ISharedRecordEvent): Enterprise.SharedRecordEvent;

    /**
     * Encodes the specified SharedRecordEvent message. Does not implicitly {@link Enterprise.SharedRecordEvent.verify|verify} messages.
     * @param message SharedRecordEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISharedRecordEvent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedRecordEvent message, length delimited. Does not implicitly {@link Enterprise.SharedRecordEvent.verify|verify} messages.
     * @param message SharedRecordEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISharedRecordEvent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedRecordEvent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedRecordEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SharedRecordEvent;

    /**
     * Decodes a SharedRecordEvent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedRecordEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SharedRecordEvent;

    /**
     * Verifies a SharedRecordEvent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedRecordEvent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedRecordEvent
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SharedRecordEvent;

    /**
     * Creates a plain object from a SharedRecordEvent message. Also converts values to other types if specified.
     * @param message SharedRecordEvent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SharedRecordEvent,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedRecordEvent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedRecordEvent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetRestrictVisibilityRequest. */
  interface ISetRestrictVisibilityRequest {
    /** SetRestrictVisibilityRequest nodeId */
    nodeId?: number | Long | null;
  }

  /** Represents a SetRestrictVisibilityRequest. */
  class SetRestrictVisibilityRequest implements ISetRestrictVisibilityRequest {
    /**
     * Constructs a new SetRestrictVisibilityRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISetRestrictVisibilityRequest);

    /** SetRestrictVisibilityRequest nodeId. */
    public nodeId: number | Long;

    /**
     * Creates a new SetRestrictVisibilityRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetRestrictVisibilityRequest instance
     */
    public static create(
      properties?: Enterprise.ISetRestrictVisibilityRequest,
    ): Enterprise.SetRestrictVisibilityRequest;

    /**
     * Encodes the specified SetRestrictVisibilityRequest message. Does not implicitly {@link Enterprise.SetRestrictVisibilityRequest.verify|verify} messages.
     * @param message SetRestrictVisibilityRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISetRestrictVisibilityRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetRestrictVisibilityRequest message, length delimited. Does not implicitly {@link Enterprise.SetRestrictVisibilityRequest.verify|verify} messages.
     * @param message SetRestrictVisibilityRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISetRestrictVisibilityRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetRestrictVisibilityRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetRestrictVisibilityRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SetRestrictVisibilityRequest;

    /**
     * Decodes a SetRestrictVisibilityRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetRestrictVisibilityRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SetRestrictVisibilityRequest;

    /**
     * Verifies a SetRestrictVisibilityRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetRestrictVisibilityRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetRestrictVisibilityRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SetRestrictVisibilityRequest;

    /**
     * Creates a plain object from a SetRestrictVisibilityRequest message. Also converts values to other types if specified.
     * @param message SetRestrictVisibilityRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SetRestrictVisibilityRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetRestrictVisibilityRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetRestrictVisibilityRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserAddRequest. */
  interface IUserAddRequest {
    /** UserAddRequest enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserAddRequest nodeId */
    nodeId?: number | Long | null;

    /** UserAddRequest encryptedData */
    encryptedData?: Uint8Array | null;

    /** UserAddRequest keyType */
    keyType?: Enterprise.EncryptedKeyType | null;

    /** UserAddRequest fullName */
    fullName?: string | null;

    /** UserAddRequest jobTitle */
    jobTitle?: string | null;

    /** UserAddRequest email */
    email?: string | null;

    /** UserAddRequest suppressEmailInvite */
    suppressEmailInvite?: boolean | null;
  }

  /** Represents a UserAddRequest. */
  class UserAddRequest implements IUserAddRequest {
    /**
     * Constructs a new UserAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserAddRequest);

    /** UserAddRequest enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserAddRequest nodeId. */
    public nodeId: number | Long;

    /** UserAddRequest encryptedData. */
    public encryptedData: Uint8Array;

    /** UserAddRequest keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /** UserAddRequest fullName. */
    public fullName: string;

    /** UserAddRequest jobTitle. */
    public jobTitle: string;

    /** UserAddRequest email. */
    public email: string;

    /** UserAddRequest suppressEmailInvite. */
    public suppressEmailInvite: boolean;

    /**
     * Creates a new UserAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserAddRequest instance
     */
    public static create(properties?: Enterprise.IUserAddRequest): Enterprise.UserAddRequest;

    /**
     * Encodes the specified UserAddRequest message. Does not implicitly {@link Enterprise.UserAddRequest.verify|verify} messages.
     * @param message UserAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserAddRequest message, length delimited. Does not implicitly {@link Enterprise.UserAddRequest.verify|verify} messages.
     * @param message UserAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserAddRequest;

    /**
     * Decodes a UserAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserAddRequest;

    /**
     * Verifies a UserAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserAddRequest;

    /**
     * Creates a plain object from a UserAddRequest message. Also converts values to other types if specified.
     * @param message UserAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserUpdateRequest. */
  interface IUserUpdateRequest {
    /** UserUpdateRequest users */
    users?: Enterprise.IUserUpdate[] | null;
  }

  /** Represents a UserUpdateRequest. */
  class UserUpdateRequest implements IUserUpdateRequest {
    /**
     * Constructs a new UserUpdateRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserUpdateRequest);

    /** UserUpdateRequest users. */
    public users: Enterprise.IUserUpdate[];

    /**
     * Creates a new UserUpdateRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserUpdateRequest instance
     */
    public static create(properties?: Enterprise.IUserUpdateRequest): Enterprise.UserUpdateRequest;

    /**
     * Encodes the specified UserUpdateRequest message. Does not implicitly {@link Enterprise.UserUpdateRequest.verify|verify} messages.
     * @param message UserUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserUpdateRequest message, length delimited. Does not implicitly {@link Enterprise.UserUpdateRequest.verify|verify} messages.
     * @param message UserUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserUpdateRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserUpdateRequest;

    /**
     * Decodes a UserUpdateRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.UserUpdateRequest;

    /**
     * Verifies a UserUpdateRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserUpdateRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserUpdateRequest;

    /**
     * Creates a plain object from a UserUpdateRequest message. Also converts values to other types if specified.
     * @param message UserUpdateRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserUpdateRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserUpdateRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserUpdateRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserUpdate. */
  interface IUserUpdate {
    /** UserUpdate enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserUpdate nodeId */
    nodeId?: number | Long | null;

    /** UserUpdate encryptedData */
    encryptedData?: Uint8Array | null;

    /** UserUpdate keyType */
    keyType?: Enterprise.EncryptedKeyType | null;

    /** UserUpdate fullName */
    fullName?: string | null;

    /** UserUpdate jobTitle */
    jobTitle?: string | null;

    /** UserUpdate email */
    email?: string | null;
  }

  /** Represents a UserUpdate. */
  class UserUpdate implements IUserUpdate {
    /**
     * Constructs a new UserUpdate.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserUpdate);

    /** UserUpdate enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserUpdate nodeId. */
    public nodeId: number | Long;

    /** UserUpdate encryptedData. */
    public encryptedData: Uint8Array;

    /** UserUpdate keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /** UserUpdate fullName. */
    public fullName: string;

    /** UserUpdate jobTitle. */
    public jobTitle: string;

    /** UserUpdate email. */
    public email: string;

    /**
     * Creates a new UserUpdate instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserUpdate instance
     */
    public static create(properties?: Enterprise.IUserUpdate): Enterprise.UserUpdate;

    /**
     * Encodes the specified UserUpdate message. Does not implicitly {@link Enterprise.UserUpdate.verify|verify} messages.
     * @param message UserUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserUpdate message, length delimited. Does not implicitly {@link Enterprise.UserUpdate.verify|verify} messages.
     * @param message UserUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserUpdate message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserUpdate;

    /**
     * Decodes a UserUpdate message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserUpdate;

    /**
     * Verifies a UserUpdate message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserUpdate message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserUpdate
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserUpdate;

    /**
     * Creates a plain object from a UserUpdate message. Also converts values to other types if specified.
     * @param message UserUpdate
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserUpdate,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserUpdate to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserUpdate
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserUpdateResponse. */
  interface IUserUpdateResponse {
    /** UserUpdateResponse users */
    users?: Enterprise.IUserUpdateResult[] | null;
  }

  /** Represents a UserUpdateResponse. */
  class UserUpdateResponse implements IUserUpdateResponse {
    /**
     * Constructs a new UserUpdateResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserUpdateResponse);

    /** UserUpdateResponse users. */
    public users: Enterprise.IUserUpdateResult[];

    /**
     * Creates a new UserUpdateResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserUpdateResponse instance
     */
    public static create(
      properties?: Enterprise.IUserUpdateResponse,
    ): Enterprise.UserUpdateResponse;

    /**
     * Encodes the specified UserUpdateResponse message. Does not implicitly {@link Enterprise.UserUpdateResponse.verify|verify} messages.
     * @param message UserUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserUpdateResponse message, length delimited. Does not implicitly {@link Enterprise.UserUpdateResponse.verify|verify} messages.
     * @param message UserUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserUpdateResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserUpdateResponse;

    /**
     * Decodes a UserUpdateResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.UserUpdateResponse;

    /**
     * Verifies a UserUpdateResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserUpdateResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserUpdateResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserUpdateResponse;

    /**
     * Creates a plain object from a UserUpdateResponse message. Also converts values to other types if specified.
     * @param message UserUpdateResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserUpdateResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserUpdateResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserUpdateResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserUpdateResult. */
  interface IUserUpdateResult {
    /** UserUpdateResult enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserUpdateResult status */
    status?: Enterprise.UserUpdateStatus | null;
  }

  /** Represents a UserUpdateResult. */
  class UserUpdateResult implements IUserUpdateResult {
    /**
     * Constructs a new UserUpdateResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserUpdateResult);

    /** UserUpdateResult enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserUpdateResult status. */
    public status: Enterprise.UserUpdateStatus;

    /**
     * Creates a new UserUpdateResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserUpdateResult instance
     */
    public static create(properties?: Enterprise.IUserUpdateResult): Enterprise.UserUpdateResult;

    /**
     * Encodes the specified UserUpdateResult message. Does not implicitly {@link Enterprise.UserUpdateResult.verify|verify} messages.
     * @param message UserUpdateResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserUpdateResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserUpdateResult message, length delimited. Does not implicitly {@link Enterprise.UserUpdateResult.verify|verify} messages.
     * @param message UserUpdateResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserUpdateResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserUpdateResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserUpdateResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserUpdateResult;

    /**
     * Decodes a UserUpdateResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserUpdateResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.UserUpdateResult;

    /**
     * Verifies a UserUpdateResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserUpdateResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserUpdateResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserUpdateResult;

    /**
     * Creates a plain object from a UserUpdateResult message. Also converts values to other types if specified.
     * @param message UserUpdateResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserUpdateResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserUpdateResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserUpdateResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceRecordOwnersRequest. */
  interface IComplianceRecordOwnersRequest {
    /** ComplianceRecordOwnersRequest nodeIds */
    nodeIds?: (number | Long)[] | null;

    /** ComplianceRecordOwnersRequest includeNonShared */
    includeNonShared?: boolean | null;
  }

  /** Represents a ComplianceRecordOwnersRequest. */
  class ComplianceRecordOwnersRequest implements IComplianceRecordOwnersRequest {
    /**
     * Constructs a new ComplianceRecordOwnersRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceRecordOwnersRequest);

    /** ComplianceRecordOwnersRequest nodeIds. */
    public nodeIds: (number | Long)[];

    /** ComplianceRecordOwnersRequest includeNonShared. */
    public includeNonShared: boolean;

    /**
     * Creates a new ComplianceRecordOwnersRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceRecordOwnersRequest instance
     */
    public static create(
      properties?: Enterprise.IComplianceRecordOwnersRequest,
    ): Enterprise.ComplianceRecordOwnersRequest;

    /**
     * Encodes the specified ComplianceRecordOwnersRequest message. Does not implicitly {@link Enterprise.ComplianceRecordOwnersRequest.verify|verify} messages.
     * @param message ComplianceRecordOwnersRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceRecordOwnersRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceRecordOwnersRequest message, length delimited. Does not implicitly {@link Enterprise.ComplianceRecordOwnersRequest.verify|verify} messages.
     * @param message ComplianceRecordOwnersRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceRecordOwnersRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceRecordOwnersRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceRecordOwnersRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceRecordOwnersRequest;

    /**
     * Decodes a ComplianceRecordOwnersRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceRecordOwnersRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceRecordOwnersRequest;

    /**
     * Verifies a ComplianceRecordOwnersRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceRecordOwnersRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceRecordOwnersRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.ComplianceRecordOwnersRequest;

    /**
     * Creates a plain object from a ComplianceRecordOwnersRequest message. Also converts values to other types if specified.
     * @param message ComplianceRecordOwnersRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceRecordOwnersRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceRecordOwnersRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceRecordOwnersRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceRecordOwnersResponse. */
  interface IComplianceRecordOwnersResponse {
    /** ComplianceRecordOwnersResponse recordOwners */
    recordOwners?: Enterprise.IRecordOwner[] | null;
  }

  /** Represents a ComplianceRecordOwnersResponse. */
  class ComplianceRecordOwnersResponse implements IComplianceRecordOwnersResponse {
    /**
     * Constructs a new ComplianceRecordOwnersResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceRecordOwnersResponse);

    /** ComplianceRecordOwnersResponse recordOwners. */
    public recordOwners: Enterprise.IRecordOwner[];

    /**
     * Creates a new ComplianceRecordOwnersResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceRecordOwnersResponse instance
     */
    public static create(
      properties?: Enterprise.IComplianceRecordOwnersResponse,
    ): Enterprise.ComplianceRecordOwnersResponse;

    /**
     * Encodes the specified ComplianceRecordOwnersResponse message. Does not implicitly {@link Enterprise.ComplianceRecordOwnersResponse.verify|verify} messages.
     * @param message ComplianceRecordOwnersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceRecordOwnersResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceRecordOwnersResponse message, length delimited. Does not implicitly {@link Enterprise.ComplianceRecordOwnersResponse.verify|verify} messages.
     * @param message ComplianceRecordOwnersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceRecordOwnersResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceRecordOwnersResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceRecordOwnersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceRecordOwnersResponse;

    /**
     * Decodes a ComplianceRecordOwnersResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceRecordOwnersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceRecordOwnersResponse;

    /**
     * Verifies a ComplianceRecordOwnersResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceRecordOwnersResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceRecordOwnersResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.ComplianceRecordOwnersResponse;

    /**
     * Creates a plain object from a ComplianceRecordOwnersResponse message. Also converts values to other types if specified.
     * @param message ComplianceRecordOwnersResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceRecordOwnersResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceRecordOwnersResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceRecordOwnersResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordOwner. */
  interface IRecordOwner {
    /** RecordOwner enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** RecordOwner shared */
    shared?: boolean | null;
  }

  /** Represents a RecordOwner. */
  class RecordOwner implements IRecordOwner {
    /**
     * Constructs a new RecordOwner.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRecordOwner);

    /** RecordOwner enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** RecordOwner shared. */
    public shared: boolean;

    /**
     * Creates a new RecordOwner instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordOwner instance
     */
    public static create(properties?: Enterprise.IRecordOwner): Enterprise.RecordOwner;

    /**
     * Encodes the specified RecordOwner message. Does not implicitly {@link Enterprise.RecordOwner.verify|verify} messages.
     * @param message RecordOwner message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRecordOwner,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordOwner message, length delimited. Does not implicitly {@link Enterprise.RecordOwner.verify|verify} messages.
     * @param message RecordOwner message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRecordOwner,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordOwner message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordOwner
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RecordOwner;

    /**
     * Decodes a RecordOwner message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordOwner
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.RecordOwner;

    /**
     * Verifies a RecordOwner message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordOwner message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordOwner
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RecordOwner;

    /**
     * Creates a plain object from a RecordOwner message. Also converts values to other types if specified.
     * @param message RecordOwner
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RecordOwner,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordOwner to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordOwner
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a PreliminaryComplianceDataRequest. */
  interface IPreliminaryComplianceDataRequest {
    /** PreliminaryComplianceDataRequest enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;

    /** PreliminaryComplianceDataRequest includeNonShared */
    includeNonShared?: boolean | null;

    /** PreliminaryComplianceDataRequest continuationToken */
    continuationToken?: Uint8Array | null;

    /** PreliminaryComplianceDataRequest includeTotalMatchingRecordsInFirstResponse */
    includeTotalMatchingRecordsInFirstResponse?: boolean | null;
  }

  /** Represents a PreliminaryComplianceDataRequest. */
  class PreliminaryComplianceDataRequest implements IPreliminaryComplianceDataRequest {
    /**
     * Constructs a new PreliminaryComplianceDataRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IPreliminaryComplianceDataRequest);

    /** PreliminaryComplianceDataRequest enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /** PreliminaryComplianceDataRequest includeNonShared. */
    public includeNonShared: boolean;

    /** PreliminaryComplianceDataRequest continuationToken. */
    public continuationToken: Uint8Array;

    /** PreliminaryComplianceDataRequest includeTotalMatchingRecordsInFirstResponse. */
    public includeTotalMatchingRecordsInFirstResponse: boolean;

    /**
     * Creates a new PreliminaryComplianceDataRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PreliminaryComplianceDataRequest instance
     */
    public static create(
      properties?: Enterprise.IPreliminaryComplianceDataRequest,
    ): Enterprise.PreliminaryComplianceDataRequest;

    /**
     * Encodes the specified PreliminaryComplianceDataRequest message. Does not implicitly {@link Enterprise.PreliminaryComplianceDataRequest.verify|verify} messages.
     * @param message PreliminaryComplianceDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IPreliminaryComplianceDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified PreliminaryComplianceDataRequest message, length delimited. Does not implicitly {@link Enterprise.PreliminaryComplianceDataRequest.verify|verify} messages.
     * @param message PreliminaryComplianceDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IPreliminaryComplianceDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a PreliminaryComplianceDataRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PreliminaryComplianceDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.PreliminaryComplianceDataRequest;

    /**
     * Decodes a PreliminaryComplianceDataRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PreliminaryComplianceDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.PreliminaryComplianceDataRequest;

    /**
     * Verifies a PreliminaryComplianceDataRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a PreliminaryComplianceDataRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PreliminaryComplianceDataRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.PreliminaryComplianceDataRequest;

    /**
     * Creates a plain object from a PreliminaryComplianceDataRequest message. Also converts values to other types if specified.
     * @param message PreliminaryComplianceDataRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.PreliminaryComplianceDataRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this PreliminaryComplianceDataRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PreliminaryComplianceDataRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a PreliminaryComplianceDataResponse. */
  interface IPreliminaryComplianceDataResponse {
    /** PreliminaryComplianceDataResponse auditUserData */
    auditUserData?: Enterprise.IAuditUserData[] | null;

    /** PreliminaryComplianceDataResponse continuationToken */
    continuationToken?: Uint8Array | null;

    /** PreliminaryComplianceDataResponse hasMore */
    hasMore?: boolean | null;

    /** PreliminaryComplianceDataResponse totalMatchingRecords */
    totalMatchingRecords?: number | null;
  }

  /** Represents a PreliminaryComplianceDataResponse. */
  class PreliminaryComplianceDataResponse implements IPreliminaryComplianceDataResponse {
    /**
     * Constructs a new PreliminaryComplianceDataResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IPreliminaryComplianceDataResponse);

    /** PreliminaryComplianceDataResponse auditUserData. */
    public auditUserData: Enterprise.IAuditUserData[];

    /** PreliminaryComplianceDataResponse continuationToken. */
    public continuationToken: Uint8Array;

    /** PreliminaryComplianceDataResponse hasMore. */
    public hasMore: boolean;

    /** PreliminaryComplianceDataResponse totalMatchingRecords. */
    public totalMatchingRecords: number;

    /**
     * Creates a new PreliminaryComplianceDataResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PreliminaryComplianceDataResponse instance
     */
    public static create(
      properties?: Enterprise.IPreliminaryComplianceDataResponse,
    ): Enterprise.PreliminaryComplianceDataResponse;

    /**
     * Encodes the specified PreliminaryComplianceDataResponse message. Does not implicitly {@link Enterprise.PreliminaryComplianceDataResponse.verify|verify} messages.
     * @param message PreliminaryComplianceDataResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IPreliminaryComplianceDataResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified PreliminaryComplianceDataResponse message, length delimited. Does not implicitly {@link Enterprise.PreliminaryComplianceDataResponse.verify|verify} messages.
     * @param message PreliminaryComplianceDataResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IPreliminaryComplianceDataResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a PreliminaryComplianceDataResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PreliminaryComplianceDataResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.PreliminaryComplianceDataResponse;

    /**
     * Decodes a PreliminaryComplianceDataResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PreliminaryComplianceDataResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.PreliminaryComplianceDataResponse;

    /**
     * Verifies a PreliminaryComplianceDataResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a PreliminaryComplianceDataResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PreliminaryComplianceDataResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.PreliminaryComplianceDataResponse;

    /**
     * Creates a plain object from a PreliminaryComplianceDataResponse message. Also converts values to other types if specified.
     * @param message PreliminaryComplianceDataResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.PreliminaryComplianceDataResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this PreliminaryComplianceDataResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PreliminaryComplianceDataResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditUserRecord. */
  interface IAuditUserRecord {
    /** AuditUserRecord recordUid */
    recordUid?: Uint8Array | null;

    /** AuditUserRecord encryptedData */
    encryptedData?: Uint8Array | null;

    /** AuditUserRecord shared */
    shared?: boolean | null;
  }

  /** Represents an AuditUserRecord. */
  class AuditUserRecord implements IAuditUserRecord {
    /**
     * Constructs a new AuditUserRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditUserRecord);

    /** AuditUserRecord recordUid. */
    public recordUid: Uint8Array;

    /** AuditUserRecord encryptedData. */
    public encryptedData: Uint8Array;

    /** AuditUserRecord shared. */
    public shared: boolean;

    /**
     * Creates a new AuditUserRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditUserRecord instance
     */
    public static create(properties?: Enterprise.IAuditUserRecord): Enterprise.AuditUserRecord;

    /**
     * Encodes the specified AuditUserRecord message. Does not implicitly {@link Enterprise.AuditUserRecord.verify|verify} messages.
     * @param message AuditUserRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditUserRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditUserRecord message, length delimited. Does not implicitly {@link Enterprise.AuditUserRecord.verify|verify} messages.
     * @param message AuditUserRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditUserRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditUserRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditUserRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditUserRecord;

    /**
     * Decodes an AuditUserRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditUserRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.AuditUserRecord;

    /**
     * Verifies an AuditUserRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditUserRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditUserRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditUserRecord;

    /**
     * Creates a plain object from an AuditUserRecord message. Also converts values to other types if specified.
     * @param message AuditUserRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditUserRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditUserRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditUserRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditUserData. */
  interface IAuditUserData {
    /** AuditUserData enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** AuditUserData auditUserRecords */
    auditUserRecords?: Enterprise.IAuditUserRecord[] | null;

    /** AuditUserData status */
    status?: Enterprise.AuditUserStatus | null;
  }

  /** Represents an AuditUserData. */
  class AuditUserData implements IAuditUserData {
    /**
     * Constructs a new AuditUserData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditUserData);

    /** AuditUserData enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** AuditUserData auditUserRecords. */
    public auditUserRecords: Enterprise.IAuditUserRecord[];

    /** AuditUserData status. */
    public status: Enterprise.AuditUserStatus;

    /**
     * Creates a new AuditUserData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditUserData instance
     */
    public static create(properties?: Enterprise.IAuditUserData): Enterprise.AuditUserData;

    /**
     * Encodes the specified AuditUserData message. Does not implicitly {@link Enterprise.AuditUserData.verify|verify} messages.
     * @param message AuditUserData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditUserData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditUserData message, length delimited. Does not implicitly {@link Enterprise.AuditUserData.verify|verify} messages.
     * @param message AuditUserData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditUserData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditUserData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditUserData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditUserData;

    /**
     * Decodes an AuditUserData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditUserData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.AuditUserData;

    /**
     * Verifies an AuditUserData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditUserData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditUserData
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditUserData;

    /**
     * Creates a plain object from an AuditUserData message. Also converts values to other types if specified.
     * @param message AuditUserData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditUserData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditUserData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditUserData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportFilters. */
  interface IComplianceReportFilters {
    /** ComplianceReportFilters recordTitles */
    recordTitles?: string[] | null;

    /** ComplianceReportFilters recordUids */
    recordUids?: Uint8Array[] | null;

    /** ComplianceReportFilters jobTitles */
    jobTitles?: (number | Long)[] | null;

    /** ComplianceReportFilters urls */
    urls?: string[] | null;

    /** ComplianceReportFilters enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;
  }

  /** Represents a ComplianceReportFilters. */
  class ComplianceReportFilters implements IComplianceReportFilters {
    /**
     * Constructs a new ComplianceReportFilters.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportFilters);

    /** ComplianceReportFilters recordTitles. */
    public recordTitles: string[];

    /** ComplianceReportFilters recordUids. */
    public recordUids: Uint8Array[];

    /** ComplianceReportFilters jobTitles. */
    public jobTitles: (number | Long)[];

    /** ComplianceReportFilters urls. */
    public urls: string[];

    /** ComplianceReportFilters enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /**
     * Creates a new ComplianceReportFilters instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportFilters instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportFilters,
    ): Enterprise.ComplianceReportFilters;

    /**
     * Encodes the specified ComplianceReportFilters message. Does not implicitly {@link Enterprise.ComplianceReportFilters.verify|verify} messages.
     * @param message ComplianceReportFilters message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportFilters,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportFilters message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportFilters.verify|verify} messages.
     * @param message ComplianceReportFilters message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportFilters,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportFilters message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportFilters
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportFilters;

    /**
     * Decodes a ComplianceReportFilters message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportFilters
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportFilters;

    /**
     * Verifies a ComplianceReportFilters message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportFilters message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportFilters
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportFilters;

    /**
     * Creates a plain object from a ComplianceReportFilters message. Also converts values to other types if specified.
     * @param message ComplianceReportFilters
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportFilters,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportFilters to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportFilters
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportRequest. */
  interface IComplianceReportRequest {
    /** ComplianceReportRequest complianceReportRun */
    complianceReportRun?: Enterprise.IComplianceReportRun | null;

    /** ComplianceReportRequest reportName */
    reportName?: string | null;

    /** ComplianceReportRequest saveReport */
    saveReport?: boolean | null;
  }

  /** Represents a ComplianceReportRequest. */
  class ComplianceReportRequest implements IComplianceReportRequest {
    /**
     * Constructs a new ComplianceReportRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportRequest);

    /** ComplianceReportRequest complianceReportRun. */
    public complianceReportRun?: Enterprise.IComplianceReportRun | null;

    /** ComplianceReportRequest reportName. */
    public reportName: string;

    /** ComplianceReportRequest saveReport. */
    public saveReport: boolean;

    /**
     * Creates a new ComplianceReportRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportRequest instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportRequest,
    ): Enterprise.ComplianceReportRequest;

    /**
     * Encodes the specified ComplianceReportRequest message. Does not implicitly {@link Enterprise.ComplianceReportRequest.verify|verify} messages.
     * @param message ComplianceReportRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportRequest message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportRequest.verify|verify} messages.
     * @param message ComplianceReportRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportRequest;

    /**
     * Decodes a ComplianceReportRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportRequest;

    /**
     * Verifies a ComplianceReportRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportRequest;

    /**
     * Creates a plain object from a ComplianceReportRequest message. Also converts values to other types if specified.
     * @param message ComplianceReportRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportRun. */
  interface IComplianceReportRun {
    /** ComplianceReportRun reportCriteriaAndFilter */
    reportCriteriaAndFilter?: Enterprise.IComplianceReportCriteriaAndFilter | null;

    /** ComplianceReportRun users */
    users?: (number | Long)[] | null;

    /** ComplianceReportRun records */
    records?: Uint8Array[] | null;
  }

  /** Represents a ComplianceReportRun. */
  class ComplianceReportRun implements IComplianceReportRun {
    /**
     * Constructs a new ComplianceReportRun.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportRun);

    /** ComplianceReportRun reportCriteriaAndFilter. */
    public reportCriteriaAndFilter?: Enterprise.IComplianceReportCriteriaAndFilter | null;

    /** ComplianceReportRun users. */
    public users: (number | Long)[];

    /** ComplianceReportRun records. */
    public records: Uint8Array[];

    /**
     * Creates a new ComplianceReportRun instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportRun instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportRun,
    ): Enterprise.ComplianceReportRun;

    /**
     * Encodes the specified ComplianceReportRun message. Does not implicitly {@link Enterprise.ComplianceReportRun.verify|verify} messages.
     * @param message ComplianceReportRun message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportRun,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportRun message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportRun.verify|verify} messages.
     * @param message ComplianceReportRun message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportRun,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportRun message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportRun
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportRun;

    /**
     * Decodes a ComplianceReportRun message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportRun
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportRun;

    /**
     * Verifies a ComplianceReportRun message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportRun message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportRun
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportRun;

    /**
     * Creates a plain object from a ComplianceReportRun message. Also converts values to other types if specified.
     * @param message ComplianceReportRun
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportRun,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportRun to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportRun
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportCriteriaAndFilter. */
  interface IComplianceReportCriteriaAndFilter {
    /** ComplianceReportCriteriaAndFilter nodeId */
    nodeId?: number | Long | null;

    /** ComplianceReportCriteriaAndFilter criteriaUid */
    criteriaUid?: Uint8Array | null;

    /** ComplianceReportCriteriaAndFilter criteriaName */
    criteriaName?: string | null;

    /** ComplianceReportCriteriaAndFilter criteria */
    criteria?: Enterprise.IComplianceReportCriteria | null;

    /** ComplianceReportCriteriaAndFilter filters */
    filters?: Enterprise.IComplianceReportFilter[] | null;

    /** ComplianceReportCriteriaAndFilter lastModified */
    lastModified?: number | Long | null;

    /** ComplianceReportCriteriaAndFilter nodeEncryptedData */
    nodeEncryptedData?: Uint8Array | null;
  }

  /** Represents a ComplianceReportCriteriaAndFilter. */
  class ComplianceReportCriteriaAndFilter implements IComplianceReportCriteriaAndFilter {
    /**
     * Constructs a new ComplianceReportCriteriaAndFilter.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportCriteriaAndFilter);

    /** ComplianceReportCriteriaAndFilter nodeId. */
    public nodeId: number | Long;

    /** ComplianceReportCriteriaAndFilter criteriaUid. */
    public criteriaUid: Uint8Array;

    /** ComplianceReportCriteriaAndFilter criteriaName. */
    public criteriaName: string;

    /** ComplianceReportCriteriaAndFilter criteria. */
    public criteria?: Enterprise.IComplianceReportCriteria | null;

    /** ComplianceReportCriteriaAndFilter filters. */
    public filters: Enterprise.IComplianceReportFilter[];

    /** ComplianceReportCriteriaAndFilter lastModified. */
    public lastModified: number | Long;

    /** ComplianceReportCriteriaAndFilter nodeEncryptedData. */
    public nodeEncryptedData: Uint8Array;

    /**
     * Creates a new ComplianceReportCriteriaAndFilter instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportCriteriaAndFilter instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportCriteriaAndFilter,
    ): Enterprise.ComplianceReportCriteriaAndFilter;

    /**
     * Encodes the specified ComplianceReportCriteriaAndFilter message. Does not implicitly {@link Enterprise.ComplianceReportCriteriaAndFilter.verify|verify} messages.
     * @param message ComplianceReportCriteriaAndFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportCriteriaAndFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportCriteriaAndFilter message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportCriteriaAndFilter.verify|verify} messages.
     * @param message ComplianceReportCriteriaAndFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportCriteriaAndFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportCriteriaAndFilter message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportCriteriaAndFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportCriteriaAndFilter;

    /**
     * Decodes a ComplianceReportCriteriaAndFilter message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportCriteriaAndFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportCriteriaAndFilter;

    /**
     * Verifies a ComplianceReportCriteriaAndFilter message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportCriteriaAndFilter message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportCriteriaAndFilter
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.ComplianceReportCriteriaAndFilter;

    /**
     * Creates a plain object from a ComplianceReportCriteriaAndFilter message. Also converts values to other types if specified.
     * @param message ComplianceReportCriteriaAndFilter
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportCriteriaAndFilter,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportCriteriaAndFilter to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportCriteriaAndFilter
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportCriteria. */
  interface IComplianceReportCriteria {
    /** ComplianceReportCriteria jobTitles */
    jobTitles?: string[] | null;

    /** ComplianceReportCriteria enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;

    /** ComplianceReportCriteria includeNonShared */
    includeNonShared?: boolean | null;
  }

  /** Represents a ComplianceReportCriteria. */
  class ComplianceReportCriteria implements IComplianceReportCriteria {
    /**
     * Constructs a new ComplianceReportCriteria.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportCriteria);

    /** ComplianceReportCriteria jobTitles. */
    public jobTitles: string[];

    /** ComplianceReportCriteria enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /** ComplianceReportCriteria includeNonShared. */
    public includeNonShared: boolean;

    /**
     * Creates a new ComplianceReportCriteria instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportCriteria instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportCriteria,
    ): Enterprise.ComplianceReportCriteria;

    /**
     * Encodes the specified ComplianceReportCriteria message. Does not implicitly {@link Enterprise.ComplianceReportCriteria.verify|verify} messages.
     * @param message ComplianceReportCriteria message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportCriteria,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportCriteria message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportCriteria.verify|verify} messages.
     * @param message ComplianceReportCriteria message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportCriteria,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportCriteria message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportCriteria
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportCriteria;

    /**
     * Decodes a ComplianceReportCriteria message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportCriteria
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportCriteria;

    /**
     * Verifies a ComplianceReportCriteria message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportCriteria message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportCriteria
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportCriteria;

    /**
     * Creates a plain object from a ComplianceReportCriteria message. Also converts values to other types if specified.
     * @param message ComplianceReportCriteria
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportCriteria,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportCriteria to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportCriteria
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportFilter. */
  interface IComplianceReportFilter {
    /** ComplianceReportFilter recordTitles */
    recordTitles?: string[] | null;

    /** ComplianceReportFilter recordUids */
    recordUids?: Uint8Array[] | null;

    /** ComplianceReportFilter jobTitles */
    jobTitles?: string[] | null;

    /** ComplianceReportFilter urls */
    urls?: string[] | null;

    /** ComplianceReportFilter recordTypes */
    recordTypes?: string[] | null;
  }

  /** Represents a ComplianceReportFilter. */
  class ComplianceReportFilter implements IComplianceReportFilter {
    /**
     * Constructs a new ComplianceReportFilter.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportFilter);

    /** ComplianceReportFilter recordTitles. */
    public recordTitles: string[];

    /** ComplianceReportFilter recordUids. */
    public recordUids: Uint8Array[];

    /** ComplianceReportFilter jobTitles. */
    public jobTitles: string[];

    /** ComplianceReportFilter urls. */
    public urls: string[];

    /** ComplianceReportFilter recordTypes. */
    public recordTypes: string[];

    /**
     * Creates a new ComplianceReportFilter instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportFilter instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportFilter,
    ): Enterprise.ComplianceReportFilter;

    /**
     * Encodes the specified ComplianceReportFilter message. Does not implicitly {@link Enterprise.ComplianceReportFilter.verify|verify} messages.
     * @param message ComplianceReportFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportFilter message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportFilter.verify|verify} messages.
     * @param message ComplianceReportFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportFilter message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportFilter;

    /**
     * Decodes a ComplianceReportFilter message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportFilter;

    /**
     * Verifies a ComplianceReportFilter message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportFilter message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportFilter
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportFilter;

    /**
     * Creates a plain object from a ComplianceReportFilter message. Also converts values to other types if specified.
     * @param message ComplianceReportFilter
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportFilter,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportFilter to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportFilter
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportResponse. */
  interface IComplianceReportResponse {
    /** ComplianceReportResponse dateGenerated */
    dateGenerated?: number | Long | null;

    /** ComplianceReportResponse runByUserName */
    runByUserName?: string | null;

    /** ComplianceReportResponse reportName */
    reportName?: string | null;

    /** ComplianceReportResponse reportUid */
    reportUid?: Uint8Array | null;

    /** ComplianceReportResponse complianceReportRun */
    complianceReportRun?: Enterprise.IComplianceReportRun | null;

    /** ComplianceReportResponse userProfiles */
    userProfiles?: Enterprise.IUserProfile[] | null;

    /** ComplianceReportResponse auditTeams */
    auditTeams?: Enterprise.IAuditTeam[] | null;

    /** ComplianceReportResponse auditRecords */
    auditRecords?: Enterprise.IAuditRecord[] | null;

    /** ComplianceReportResponse userRecords */
    userRecords?: Enterprise.IUserRecord[] | null;

    /** ComplianceReportResponse sharedFolderRecords */
    sharedFolderRecords?: Enterprise.ISharedFolderRecord[] | null;

    /** ComplianceReportResponse sharedFolderUsers */
    sharedFolderUsers?: Enterprise.ISharedFolderUser[] | null;

    /** ComplianceReportResponse sharedFolderTeams */
    sharedFolderTeams?: Enterprise.ISharedFolderTeam[] | null;

    /** ComplianceReportResponse auditTeamUsers */
    auditTeamUsers?: Enterprise.IAuditTeamUser[] | null;

    /** ComplianceReportResponse auditRoles */
    auditRoles?: Enterprise.IAuditRole[] | null;

    /** ComplianceReportResponse linkedRecords */
    linkedRecords?: Enterprise.ILinkedRecord[] | null;
  }

  /** Represents a ComplianceReportResponse. */
  class ComplianceReportResponse implements IComplianceReportResponse {
    /**
     * Constructs a new ComplianceReportResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportResponse);

    /** ComplianceReportResponse dateGenerated. */
    public dateGenerated: number | Long;

    /** ComplianceReportResponse runByUserName. */
    public runByUserName: string;

    /** ComplianceReportResponse reportName. */
    public reportName: string;

    /** ComplianceReportResponse reportUid. */
    public reportUid: Uint8Array;

    /** ComplianceReportResponse complianceReportRun. */
    public complianceReportRun?: Enterprise.IComplianceReportRun | null;

    /** ComplianceReportResponse userProfiles. */
    public userProfiles: Enterprise.IUserProfile[];

    /** ComplianceReportResponse auditTeams. */
    public auditTeams: Enterprise.IAuditTeam[];

    /** ComplianceReportResponse auditRecords. */
    public auditRecords: Enterprise.IAuditRecord[];

    /** ComplianceReportResponse userRecords. */
    public userRecords: Enterprise.IUserRecord[];

    /** ComplianceReportResponse sharedFolderRecords. */
    public sharedFolderRecords: Enterprise.ISharedFolderRecord[];

    /** ComplianceReportResponse sharedFolderUsers. */
    public sharedFolderUsers: Enterprise.ISharedFolderUser[];

    /** ComplianceReportResponse sharedFolderTeams. */
    public sharedFolderTeams: Enterprise.ISharedFolderTeam[];

    /** ComplianceReportResponse auditTeamUsers. */
    public auditTeamUsers: Enterprise.IAuditTeamUser[];

    /** ComplianceReportResponse auditRoles. */
    public auditRoles: Enterprise.IAuditRole[];

    /** ComplianceReportResponse linkedRecords. */
    public linkedRecords: Enterprise.ILinkedRecord[];

    /**
     * Creates a new ComplianceReportResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportResponse instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportResponse,
    ): Enterprise.ComplianceReportResponse;

    /**
     * Encodes the specified ComplianceReportResponse message. Does not implicitly {@link Enterprise.ComplianceReportResponse.verify|verify} messages.
     * @param message ComplianceReportResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportResponse message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportResponse.verify|verify} messages.
     * @param message ComplianceReportResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportResponse;

    /**
     * Decodes a ComplianceReportResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportResponse;

    /**
     * Verifies a ComplianceReportResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ComplianceReportResponse;

    /**
     * Creates a plain object from a ComplianceReportResponse message. Also converts values to other types if specified.
     * @param message ComplianceReportResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditRecord. */
  interface IAuditRecord {
    /** AuditRecord recordUid */
    recordUid?: Uint8Array | null;

    /** AuditRecord auditData */
    auditData?: Uint8Array | null;

    /** AuditRecord hasAttachments */
    hasAttachments?: boolean | null;

    /** AuditRecord inTrash */
    inTrash?: boolean | null;

    /** AuditRecord treeLeft */
    treeLeft?: number | null;

    /** AuditRecord treeRight */
    treeRight?: number | null;
  }

  /** Represents an AuditRecord. */
  class AuditRecord implements IAuditRecord {
    /**
     * Constructs a new AuditRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditRecord);

    /** AuditRecord recordUid. */
    public recordUid: Uint8Array;

    /** AuditRecord auditData. */
    public auditData: Uint8Array;

    /** AuditRecord hasAttachments. */
    public hasAttachments: boolean;

    /** AuditRecord inTrash. */
    public inTrash: boolean;

    /** AuditRecord treeLeft. */
    public treeLeft: number;

    /** AuditRecord treeRight. */
    public treeRight: number;

    /**
     * Creates a new AuditRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditRecord instance
     */
    public static create(properties?: Enterprise.IAuditRecord): Enterprise.AuditRecord;

    /**
     * Encodes the specified AuditRecord message. Does not implicitly {@link Enterprise.AuditRecord.verify|verify} messages.
     * @param message AuditRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditRecord message, length delimited. Does not implicitly {@link Enterprise.AuditRecord.verify|verify} messages.
     * @param message AuditRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditRecord;

    /**
     * Decodes an AuditRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.AuditRecord;

    /**
     * Verifies an AuditRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditRecord;

    /**
     * Creates a plain object from an AuditRecord message. Also converts values to other types if specified.
     * @param message AuditRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditRole. */
  interface IAuditRole {
    /** AuditRole roleId */
    roleId?: number | Long | null;

    /** AuditRole encryptedData */
    encryptedData?: Uint8Array | null;

    /** AuditRole restrictShareOutsideEnterprise */
    restrictShareOutsideEnterprise?: boolean | null;

    /** AuditRole restrictShareAll */
    restrictShareAll?: boolean | null;

    /** AuditRole restrictShareOfAttachments */
    restrictShareOfAttachments?: boolean | null;

    /** AuditRole restrictMaskPasswordsWhileEditing */
    restrictMaskPasswordsWhileEditing?: boolean | null;

    /** AuditRole roleNodeManagements */
    roleNodeManagements?: Enterprise.IRoleNodeManagement[] | null;
  }

  /** Represents an AuditRole. */
  class AuditRole implements IAuditRole {
    /**
     * Constructs a new AuditRole.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditRole);

    /** AuditRole roleId. */
    public roleId: number | Long;

    /** AuditRole encryptedData. */
    public encryptedData: Uint8Array;

    /** AuditRole restrictShareOutsideEnterprise. */
    public restrictShareOutsideEnterprise: boolean;

    /** AuditRole restrictShareAll. */
    public restrictShareAll: boolean;

    /** AuditRole restrictShareOfAttachments. */
    public restrictShareOfAttachments: boolean;

    /** AuditRole restrictMaskPasswordsWhileEditing. */
    public restrictMaskPasswordsWhileEditing: boolean;

    /** AuditRole roleNodeManagements. */
    public roleNodeManagements: Enterprise.IRoleNodeManagement[];

    /**
     * Creates a new AuditRole instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditRole instance
     */
    public static create(properties?: Enterprise.IAuditRole): Enterprise.AuditRole;

    /**
     * Encodes the specified AuditRole message. Does not implicitly {@link Enterprise.AuditRole.verify|verify} messages.
     * @param message AuditRole message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditRole,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditRole message, length delimited. Does not implicitly {@link Enterprise.AuditRole.verify|verify} messages.
     * @param message AuditRole message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditRole,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditRole message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditRole
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditRole;

    /**
     * Decodes an AuditRole message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditRole
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.AuditRole;

    /**
     * Verifies an AuditRole message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditRole message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditRole
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditRole;

    /**
     * Creates a plain object from an AuditRole message. Also converts values to other types if specified.
     * @param message AuditRole
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditRole,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditRole to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditRole
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RoleNodeManagement. */
  interface IRoleNodeManagement {
    /** RoleNodeManagement treeLeft */
    treeLeft?: number | null;

    /** RoleNodeManagement treeRight */
    treeRight?: number | null;

    /** RoleNodeManagement cascade */
    cascade?: boolean | null;

    /** RoleNodeManagement privileges */
    privileges?: number | null;
  }

  /** Represents a RoleNodeManagement. */
  class RoleNodeManagement implements IRoleNodeManagement {
    /**
     * Constructs a new RoleNodeManagement.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRoleNodeManagement);

    /** RoleNodeManagement treeLeft. */
    public treeLeft: number;

    /** RoleNodeManagement treeRight. */
    public treeRight: number;

    /** RoleNodeManagement cascade. */
    public cascade: boolean;

    /** RoleNodeManagement privileges. */
    public privileges: number;

    /**
     * Creates a new RoleNodeManagement instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoleNodeManagement instance
     */
    public static create(
      properties?: Enterprise.IRoleNodeManagement,
    ): Enterprise.RoleNodeManagement;

    /**
     * Encodes the specified RoleNodeManagement message. Does not implicitly {@link Enterprise.RoleNodeManagement.verify|verify} messages.
     * @param message RoleNodeManagement message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRoleNodeManagement,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RoleNodeManagement message, length delimited. Does not implicitly {@link Enterprise.RoleNodeManagement.verify|verify} messages.
     * @param message RoleNodeManagement message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRoleNodeManagement,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RoleNodeManagement message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoleNodeManagement
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RoleNodeManagement;

    /**
     * Decodes a RoleNodeManagement message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoleNodeManagement
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RoleNodeManagement;

    /**
     * Verifies a RoleNodeManagement message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RoleNodeManagement message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoleNodeManagement
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RoleNodeManagement;

    /**
     * Creates a plain object from a RoleNodeManagement message. Also converts values to other types if specified.
     * @param message RoleNodeManagement
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RoleNodeManagement,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RoleNodeManagement to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoleNodeManagement
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserProfile. */
  interface IUserProfile {
    /** UserProfile enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserProfile fullName */
    fullName?: string | null;

    /** UserProfile jobTitle */
    jobTitle?: string | null;

    /** UserProfile email */
    email?: string | null;

    /** UserProfile roleIds */
    roleIds?: (number | Long)[] | null;
  }

  /** Represents a UserProfile. */
  class UserProfile implements IUserProfile {
    /**
     * Constructs a new UserProfile.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserProfile);

    /** UserProfile enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserProfile fullName. */
    public fullName: string;

    /** UserProfile jobTitle. */
    public jobTitle: string;

    /** UserProfile email. */
    public email: string;

    /** UserProfile roleIds. */
    public roleIds: (number | Long)[];

    /**
     * Creates a new UserProfile instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserProfile instance
     */
    public static create(properties?: Enterprise.IUserProfile): Enterprise.UserProfile;

    /**
     * Encodes the specified UserProfile message. Does not implicitly {@link Enterprise.UserProfile.verify|verify} messages.
     * @param message UserProfile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserProfile,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserProfile message, length delimited. Does not implicitly {@link Enterprise.UserProfile.verify|verify} messages.
     * @param message UserProfile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserProfile,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserProfile message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserProfile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserProfile;

    /**
     * Decodes a UserProfile message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserProfile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserProfile;

    /**
     * Verifies a UserProfile message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserProfile message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserProfile
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserProfile;

    /**
     * Creates a plain object from a UserProfile message. Also converts values to other types if specified.
     * @param message UserProfile
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserProfile,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserProfile to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserProfile
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordPermission. */
  interface IRecordPermission {
    /** RecordPermission recordUid */
    recordUid?: Uint8Array | null;

    /** RecordPermission permissionBits */
    permissionBits?: number | null;
  }

  /** Represents a RecordPermission. */
  class RecordPermission implements IRecordPermission {
    /**
     * Constructs a new RecordPermission.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IRecordPermission);

    /** RecordPermission recordUid. */
    public recordUid: Uint8Array;

    /** RecordPermission permissionBits. */
    public permissionBits: number;

    /**
     * Creates a new RecordPermission instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordPermission instance
     */
    public static create(properties?: Enterprise.IRecordPermission): Enterprise.RecordPermission;

    /**
     * Encodes the specified RecordPermission message. Does not implicitly {@link Enterprise.RecordPermission.verify|verify} messages.
     * @param message RecordPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IRecordPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordPermission message, length delimited. Does not implicitly {@link Enterprise.RecordPermission.verify|verify} messages.
     * @param message RecordPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IRecordPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordPermission message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.RecordPermission;

    /**
     * Decodes a RecordPermission message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.RecordPermission;

    /**
     * Verifies a RecordPermission message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordPermission message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordPermission
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.RecordPermission;

    /**
     * Creates a plain object from a RecordPermission message. Also converts values to other types if specified.
     * @param message RecordPermission
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.RecordPermission,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordPermission to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordPermission
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserRecord. */
  interface IUserRecord {
    /** UserRecord enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** UserRecord recordPermissions */
    recordPermissions?: Enterprise.IRecordPermission[] | null;
  }

  /** Represents a UserRecord. */
  class UserRecord implements IUserRecord {
    /**
     * Constructs a new UserRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserRecord);

    /** UserRecord enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** UserRecord recordPermissions. */
    public recordPermissions: Enterprise.IRecordPermission[];

    /**
     * Creates a new UserRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserRecord instance
     */
    public static create(properties?: Enterprise.IUserRecord): Enterprise.UserRecord;

    /**
     * Encodes the specified UserRecord message. Does not implicitly {@link Enterprise.UserRecord.verify|verify} messages.
     * @param message UserRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserRecord message, length delimited. Does not implicitly {@link Enterprise.UserRecord.verify|verify} messages.
     * @param message UserRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserRecord;

    /**
     * Decodes a UserRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserRecord;

    /**
     * Verifies a UserRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserRecord;

    /**
     * Creates a plain object from a UserRecord message. Also converts values to other types if specified.
     * @param message UserRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditTeam. */
  interface IAuditTeam {
    /** AuditTeam teamUid */
    teamUid?: Uint8Array | null;

    /** AuditTeam teamName */
    teamName?: string | null;

    /** AuditTeam restrictEdit */
    restrictEdit?: boolean | null;

    /** AuditTeam restrictShare */
    restrictShare?: boolean | null;
  }

  /** Represents an AuditTeam. */
  class AuditTeam implements IAuditTeam {
    /**
     * Constructs a new AuditTeam.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditTeam);

    /** AuditTeam teamUid. */
    public teamUid: Uint8Array;

    /** AuditTeam teamName. */
    public teamName: string;

    /** AuditTeam restrictEdit. */
    public restrictEdit: boolean;

    /** AuditTeam restrictShare. */
    public restrictShare: boolean;

    /**
     * Creates a new AuditTeam instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditTeam instance
     */
    public static create(properties?: Enterprise.IAuditTeam): Enterprise.AuditTeam;

    /**
     * Encodes the specified AuditTeam message. Does not implicitly {@link Enterprise.AuditTeam.verify|verify} messages.
     * @param message AuditTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditTeam message, length delimited. Does not implicitly {@link Enterprise.AuditTeam.verify|verify} messages.
     * @param message AuditTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditTeam message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditTeam;

    /**
     * Decodes an AuditTeam message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.AuditTeam;

    /**
     * Verifies an AuditTeam message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditTeam message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditTeam
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditTeam;

    /**
     * Creates a plain object from an AuditTeam message. Also converts values to other types if specified.
     * @param message AuditTeam
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditTeam,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditTeam to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditTeam
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AuditTeamUser. */
  interface IAuditTeamUser {
    /** AuditTeamUser teamUid */
    teamUid?: Uint8Array | null;

    /** AuditTeamUser enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;
  }

  /** Represents an AuditTeamUser. */
  class AuditTeamUser implements IAuditTeamUser {
    /**
     * Constructs a new AuditTeamUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IAuditTeamUser);

    /** AuditTeamUser teamUid. */
    public teamUid: Uint8Array;

    /** AuditTeamUser enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /**
     * Creates a new AuditTeamUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AuditTeamUser instance
     */
    public static create(properties?: Enterprise.IAuditTeamUser): Enterprise.AuditTeamUser;

    /**
     * Encodes the specified AuditTeamUser message. Does not implicitly {@link Enterprise.AuditTeamUser.verify|verify} messages.
     * @param message AuditTeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IAuditTeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AuditTeamUser message, length delimited. Does not implicitly {@link Enterprise.AuditTeamUser.verify|verify} messages.
     * @param message AuditTeamUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IAuditTeamUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AuditTeamUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AuditTeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.AuditTeamUser;

    /**
     * Decodes an AuditTeamUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AuditTeamUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.AuditTeamUser;

    /**
     * Verifies an AuditTeamUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AuditTeamUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AuditTeamUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.AuditTeamUser;

    /**
     * Creates a plain object from an AuditTeamUser message. Also converts values to other types if specified.
     * @param message AuditTeamUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.AuditTeamUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AuditTeamUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AuditTeamUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedFolderRecord. */
  interface ISharedFolderRecord {
    /** SharedFolderRecord sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** SharedFolderRecord recordPermissions */
    recordPermissions?: Enterprise.IRecordPermission[] | null;

    /** SharedFolderRecord shareAdminRecords */
    shareAdminRecords?: Enterprise.IShareAdminRecord[] | null;
  }

  /** Represents a SharedFolderRecord. */
  class SharedFolderRecord implements ISharedFolderRecord {
    /**
     * Constructs a new SharedFolderRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISharedFolderRecord);

    /** SharedFolderRecord sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** SharedFolderRecord recordPermissions. */
    public recordPermissions: Enterprise.IRecordPermission[];

    /** SharedFolderRecord shareAdminRecords. */
    public shareAdminRecords: Enterprise.IShareAdminRecord[];

    /**
     * Creates a new SharedFolderRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedFolderRecord instance
     */
    public static create(
      properties?: Enterprise.ISharedFolderRecord,
    ): Enterprise.SharedFolderRecord;

    /**
     * Encodes the specified SharedFolderRecord message. Does not implicitly {@link Enterprise.SharedFolderRecord.verify|verify} messages.
     * @param message SharedFolderRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISharedFolderRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedFolderRecord message, length delimited. Does not implicitly {@link Enterprise.SharedFolderRecord.verify|verify} messages.
     * @param message SharedFolderRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISharedFolderRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedFolderRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedFolderRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SharedFolderRecord;

    /**
     * Decodes a SharedFolderRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedFolderRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SharedFolderRecord;

    /**
     * Verifies a SharedFolderRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedFolderRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedFolderRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SharedFolderRecord;

    /**
     * Creates a plain object from a SharedFolderRecord message. Also converts values to other types if specified.
     * @param message SharedFolderRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SharedFolderRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedFolderRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedFolderRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ShareAdminRecord. */
  interface IShareAdminRecord {
    /** ShareAdminRecord enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** ShareAdminRecord recordPermissionIndexes */
    recordPermissionIndexes?: number[] | null;
  }

  /** Represents a ShareAdminRecord. */
  class ShareAdminRecord implements IShareAdminRecord {
    /**
     * Constructs a new ShareAdminRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IShareAdminRecord);

    /** ShareAdminRecord enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** ShareAdminRecord recordPermissionIndexes. */
    public recordPermissionIndexes: number[];

    /**
     * Creates a new ShareAdminRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ShareAdminRecord instance
     */
    public static create(properties?: Enterprise.IShareAdminRecord): Enterprise.ShareAdminRecord;

    /**
     * Encodes the specified ShareAdminRecord message. Does not implicitly {@link Enterprise.ShareAdminRecord.verify|verify} messages.
     * @param message ShareAdminRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IShareAdminRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ShareAdminRecord message, length delimited. Does not implicitly {@link Enterprise.ShareAdminRecord.verify|verify} messages.
     * @param message ShareAdminRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IShareAdminRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ShareAdminRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ShareAdminRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ShareAdminRecord;

    /**
     * Decodes a ShareAdminRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ShareAdminRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ShareAdminRecord;

    /**
     * Verifies a ShareAdminRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ShareAdminRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ShareAdminRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ShareAdminRecord;

    /**
     * Creates a plain object from a ShareAdminRecord message. Also converts values to other types if specified.
     * @param message ShareAdminRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ShareAdminRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ShareAdminRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ShareAdminRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedFolderUser. */
  interface ISharedFolderUser {
    /** SharedFolderUser sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** SharedFolderUser enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;
  }

  /** Represents a SharedFolderUser. */
  class SharedFolderUser implements ISharedFolderUser {
    /**
     * Constructs a new SharedFolderUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISharedFolderUser);

    /** SharedFolderUser sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** SharedFolderUser enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /**
     * Creates a new SharedFolderUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedFolderUser instance
     */
    public static create(properties?: Enterprise.ISharedFolderUser): Enterprise.SharedFolderUser;

    /**
     * Encodes the specified SharedFolderUser message. Does not implicitly {@link Enterprise.SharedFolderUser.verify|verify} messages.
     * @param message SharedFolderUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISharedFolderUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedFolderUser message, length delimited. Does not implicitly {@link Enterprise.SharedFolderUser.verify|verify} messages.
     * @param message SharedFolderUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISharedFolderUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedFolderUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedFolderUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SharedFolderUser;

    /**
     * Decodes a SharedFolderUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedFolderUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SharedFolderUser;

    /**
     * Verifies a SharedFolderUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedFolderUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedFolderUser
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SharedFolderUser;

    /**
     * Creates a plain object from a SharedFolderUser message. Also converts values to other types if specified.
     * @param message SharedFolderUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SharedFolderUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedFolderUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedFolderUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedFolderTeam. */
  interface ISharedFolderTeam {
    /** SharedFolderTeam sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** SharedFolderTeam teamUids */
    teamUids?: Uint8Array[] | null;
  }

  /** Represents a SharedFolderTeam. */
  class SharedFolderTeam implements ISharedFolderTeam {
    /**
     * Constructs a new SharedFolderTeam.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISharedFolderTeam);

    /** SharedFolderTeam sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** SharedFolderTeam teamUids. */
    public teamUids: Uint8Array[];

    /**
     * Creates a new SharedFolderTeam instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedFolderTeam instance
     */
    public static create(properties?: Enterprise.ISharedFolderTeam): Enterprise.SharedFolderTeam;

    /**
     * Encodes the specified SharedFolderTeam message. Does not implicitly {@link Enterprise.SharedFolderTeam.verify|verify} messages.
     * @param message SharedFolderTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISharedFolderTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedFolderTeam message, length delimited. Does not implicitly {@link Enterprise.SharedFolderTeam.verify|verify} messages.
     * @param message SharedFolderTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISharedFolderTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedFolderTeam message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedFolderTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SharedFolderTeam;

    /**
     * Decodes a SharedFolderTeam message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedFolderTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SharedFolderTeam;

    /**
     * Verifies a SharedFolderTeam message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedFolderTeam message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedFolderTeam
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.SharedFolderTeam;

    /**
     * Creates a plain object from a SharedFolderTeam message. Also converts values to other types if specified.
     * @param message SharedFolderTeam
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SharedFolderTeam,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedFolderTeam to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedFolderTeam
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetComplianceReportRequest. */
  interface IGetComplianceReportRequest {
    /** GetComplianceReportRequest reportUid */
    reportUid?: Uint8Array | null;
  }

  /** Represents a GetComplianceReportRequest. */
  class GetComplianceReportRequest implements IGetComplianceReportRequest {
    /**
     * Constructs a new GetComplianceReportRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetComplianceReportRequest);

    /** GetComplianceReportRequest reportUid. */
    public reportUid: Uint8Array;

    /**
     * Creates a new GetComplianceReportRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetComplianceReportRequest instance
     */
    public static create(
      properties?: Enterprise.IGetComplianceReportRequest,
    ): Enterprise.GetComplianceReportRequest;

    /**
     * Encodes the specified GetComplianceReportRequest message. Does not implicitly {@link Enterprise.GetComplianceReportRequest.verify|verify} messages.
     * @param message GetComplianceReportRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetComplianceReportRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetComplianceReportRequest message, length delimited. Does not implicitly {@link Enterprise.GetComplianceReportRequest.verify|verify} messages.
     * @param message GetComplianceReportRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetComplianceReportRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetComplianceReportRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetComplianceReportRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetComplianceReportRequest;

    /**
     * Decodes a GetComplianceReportRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetComplianceReportRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetComplianceReportRequest;

    /**
     * Verifies a GetComplianceReportRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetComplianceReportRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetComplianceReportRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetComplianceReportRequest;

    /**
     * Creates a plain object from a GetComplianceReportRequest message. Also converts values to other types if specified.
     * @param message GetComplianceReportRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetComplianceReportRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetComplianceReportRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetComplianceReportRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetComplianceReportResponse. */
  interface IGetComplianceReportResponse {
    /** GetComplianceReportResponse downloadUrl */
    downloadUrl?: string | null;
  }

  /** Represents a GetComplianceReportResponse. */
  class GetComplianceReportResponse implements IGetComplianceReportResponse {
    /**
     * Constructs a new GetComplianceReportResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetComplianceReportResponse);

    /** GetComplianceReportResponse downloadUrl. */
    public downloadUrl: string;

    /**
     * Creates a new GetComplianceReportResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetComplianceReportResponse instance
     */
    public static create(
      properties?: Enterprise.IGetComplianceReportResponse,
    ): Enterprise.GetComplianceReportResponse;

    /**
     * Encodes the specified GetComplianceReportResponse message. Does not implicitly {@link Enterprise.GetComplianceReportResponse.verify|verify} messages.
     * @param message GetComplianceReportResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetComplianceReportResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetComplianceReportResponse message, length delimited. Does not implicitly {@link Enterprise.GetComplianceReportResponse.verify|verify} messages.
     * @param message GetComplianceReportResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetComplianceReportResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetComplianceReportResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetComplianceReportResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetComplianceReportResponse;

    /**
     * Decodes a GetComplianceReportResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetComplianceReportResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetComplianceReportResponse;

    /**
     * Verifies a GetComplianceReportResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetComplianceReportResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetComplianceReportResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetComplianceReportResponse;

    /**
     * Creates a plain object from a GetComplianceReportResponse message. Also converts values to other types if specified.
     * @param message GetComplianceReportResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetComplianceReportResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetComplianceReportResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetComplianceReportResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ComplianceReportCriteriaRequest. */
  interface IComplianceReportCriteriaRequest {
    /** ComplianceReportCriteriaRequest criteriaUid */
    criteriaUid?: Uint8Array | null;
  }

  /** Represents a ComplianceReportCriteriaRequest. */
  class ComplianceReportCriteriaRequest implements IComplianceReportCriteriaRequest {
    /**
     * Constructs a new ComplianceReportCriteriaRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IComplianceReportCriteriaRequest);

    /** ComplianceReportCriteriaRequest criteriaUid. */
    public criteriaUid: Uint8Array;

    /**
     * Creates a new ComplianceReportCriteriaRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComplianceReportCriteriaRequest instance
     */
    public static create(
      properties?: Enterprise.IComplianceReportCriteriaRequest,
    ): Enterprise.ComplianceReportCriteriaRequest;

    /**
     * Encodes the specified ComplianceReportCriteriaRequest message. Does not implicitly {@link Enterprise.ComplianceReportCriteriaRequest.verify|verify} messages.
     * @param message ComplianceReportCriteriaRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IComplianceReportCriteriaRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ComplianceReportCriteriaRequest message, length delimited. Does not implicitly {@link Enterprise.ComplianceReportCriteriaRequest.verify|verify} messages.
     * @param message ComplianceReportCriteriaRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IComplianceReportCriteriaRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ComplianceReportCriteriaRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComplianceReportCriteriaRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ComplianceReportCriteriaRequest;

    /**
     * Decodes a ComplianceReportCriteriaRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComplianceReportCriteriaRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ComplianceReportCriteriaRequest;

    /**
     * Verifies a ComplianceReportCriteriaRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ComplianceReportCriteriaRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComplianceReportCriteriaRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.ComplianceReportCriteriaRequest;

    /**
     * Creates a plain object from a ComplianceReportCriteriaRequest message. Also converts values to other types if specified.
     * @param message ComplianceReportCriteriaRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ComplianceReportCriteriaRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ComplianceReportCriteriaRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComplianceReportCriteriaRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SaveComplianceReportCriteriaResponse. */
  interface ISaveComplianceReportCriteriaResponse {
    /** SaveComplianceReportCriteriaResponse criteriaUid */
    criteriaUid?: Uint8Array | null;
  }

  /** Represents a SaveComplianceReportCriteriaResponse. */
  class SaveComplianceReportCriteriaResponse implements ISaveComplianceReportCriteriaResponse {
    /**
     * Constructs a new SaveComplianceReportCriteriaResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ISaveComplianceReportCriteriaResponse);

    /** SaveComplianceReportCriteriaResponse criteriaUid. */
    public criteriaUid: Uint8Array;

    /**
     * Creates a new SaveComplianceReportCriteriaResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SaveComplianceReportCriteriaResponse instance
     */
    public static create(
      properties?: Enterprise.ISaveComplianceReportCriteriaResponse,
    ): Enterprise.SaveComplianceReportCriteriaResponse;

    /**
     * Encodes the specified SaveComplianceReportCriteriaResponse message. Does not implicitly {@link Enterprise.SaveComplianceReportCriteriaResponse.verify|verify} messages.
     * @param message SaveComplianceReportCriteriaResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ISaveComplianceReportCriteriaResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SaveComplianceReportCriteriaResponse message, length delimited. Does not implicitly {@link Enterprise.SaveComplianceReportCriteriaResponse.verify|verify} messages.
     * @param message SaveComplianceReportCriteriaResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ISaveComplianceReportCriteriaResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SaveComplianceReportCriteriaResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SaveComplianceReportCriteriaResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.SaveComplianceReportCriteriaResponse;

    /**
     * Decodes a SaveComplianceReportCriteriaResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SaveComplianceReportCriteriaResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.SaveComplianceReportCriteriaResponse;

    /**
     * Verifies a SaveComplianceReportCriteriaResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SaveComplianceReportCriteriaResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SaveComplianceReportCriteriaResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.SaveComplianceReportCriteriaResponse;

    /**
     * Creates a plain object from a SaveComplianceReportCriteriaResponse message. Also converts values to other types if specified.
     * @param message SaveComplianceReportCriteriaResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.SaveComplianceReportCriteriaResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SaveComplianceReportCriteriaResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SaveComplianceReportCriteriaResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a LinkedRecord. */
  interface ILinkedRecord {
    /** LinkedRecord ownerUid */
    ownerUid?: Uint8Array | null;

    /** LinkedRecord recordUids */
    recordUids?: Uint8Array[] | null;
  }

  /** Represents a LinkedRecord. */
  class LinkedRecord implements ILinkedRecord {
    /**
     * Constructs a new LinkedRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ILinkedRecord);

    /** LinkedRecord ownerUid. */
    public ownerUid: Uint8Array;

    /** LinkedRecord recordUids. */
    public recordUids: Uint8Array[];

    /**
     * Creates a new LinkedRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns LinkedRecord instance
     */
    public static create(properties?: Enterprise.ILinkedRecord): Enterprise.LinkedRecord;

    /**
     * Encodes the specified LinkedRecord message. Does not implicitly {@link Enterprise.LinkedRecord.verify|verify} messages.
     * @param message LinkedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ILinkedRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified LinkedRecord message, length delimited. Does not implicitly {@link Enterprise.LinkedRecord.verify|verify} messages.
     * @param message LinkedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ILinkedRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a LinkedRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns LinkedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.LinkedRecord;

    /**
     * Decodes a LinkedRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns LinkedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.LinkedRecord;

    /**
     * Verifies a LinkedRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a LinkedRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns LinkedRecord
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.LinkedRecord;

    /**
     * Creates a plain object from a LinkedRecord message. Also converts values to other types if specified.
     * @param message LinkedRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.LinkedRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this LinkedRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for LinkedRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetSharingAdminsRequest. */
  interface IGetSharingAdminsRequest {
    /** GetSharingAdminsRequest sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** GetSharingAdminsRequest recordUid */
    recordUid?: Uint8Array | null;

    /** GetSharingAdminsRequest username */
    username?: string | null;
  }

  /** Represents a GetSharingAdminsRequest. */
  class GetSharingAdminsRequest implements IGetSharingAdminsRequest {
    /**
     * Constructs a new GetSharingAdminsRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetSharingAdminsRequest);

    /** GetSharingAdminsRequest sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** GetSharingAdminsRequest recordUid. */
    public recordUid: Uint8Array;

    /** GetSharingAdminsRequest username. */
    public username: string;

    /**
     * Creates a new GetSharingAdminsRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetSharingAdminsRequest instance
     */
    public static create(
      properties?: Enterprise.IGetSharingAdminsRequest,
    ): Enterprise.GetSharingAdminsRequest;

    /**
     * Encodes the specified GetSharingAdminsRequest message. Does not implicitly {@link Enterprise.GetSharingAdminsRequest.verify|verify} messages.
     * @param message GetSharingAdminsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetSharingAdminsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetSharingAdminsRequest message, length delimited. Does not implicitly {@link Enterprise.GetSharingAdminsRequest.verify|verify} messages.
     * @param message GetSharingAdminsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetSharingAdminsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetSharingAdminsRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetSharingAdminsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetSharingAdminsRequest;

    /**
     * Decodes a GetSharingAdminsRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetSharingAdminsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetSharingAdminsRequest;

    /**
     * Verifies a GetSharingAdminsRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetSharingAdminsRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetSharingAdminsRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetSharingAdminsRequest;

    /**
     * Creates a plain object from a GetSharingAdminsRequest message. Also converts values to other types if specified.
     * @param message GetSharingAdminsRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetSharingAdminsRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetSharingAdminsRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetSharingAdminsRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserProfileExt. */
  interface IUserProfileExt {
    /** UserProfileExt email */
    email?: string | null;

    /** UserProfileExt fullName */
    fullName?: string | null;

    /** UserProfileExt jobTitle */
    jobTitle?: string | null;

    /** UserProfileExt isMSPMCAdmin */
    isMSPMCAdmin?: boolean | null;

    /** UserProfileExt isInSharedFolder */
    isInSharedFolder?: boolean | null;

    /** UserProfileExt isShareAdminForRequestedObject */
    isShareAdminForRequestedObject?: boolean | null;

    /** UserProfileExt isShareAdminForSharedFolderOwner */
    isShareAdminForSharedFolderOwner?: boolean | null;

    /** UserProfileExt hasAccessToObject */
    hasAccessToObject?: boolean | null;
  }

  /** Represents a UserProfileExt. */
  class UserProfileExt implements IUserProfileExt {
    /**
     * Constructs a new UserProfileExt.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUserProfileExt);

    /** UserProfileExt email. */
    public email: string;

    /** UserProfileExt fullName. */
    public fullName: string;

    /** UserProfileExt jobTitle. */
    public jobTitle: string;

    /** UserProfileExt isMSPMCAdmin. */
    public isMSPMCAdmin: boolean;

    /** UserProfileExt isInSharedFolder. */
    public isInSharedFolder: boolean;

    /** UserProfileExt isShareAdminForRequestedObject. */
    public isShareAdminForRequestedObject: boolean;

    /** UserProfileExt isShareAdminForSharedFolderOwner. */
    public isShareAdminForSharedFolderOwner: boolean;

    /** UserProfileExt hasAccessToObject. */
    public hasAccessToObject: boolean;

    /**
     * Creates a new UserProfileExt instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserProfileExt instance
     */
    public static create(properties?: Enterprise.IUserProfileExt): Enterprise.UserProfileExt;

    /**
     * Encodes the specified UserProfileExt message. Does not implicitly {@link Enterprise.UserProfileExt.verify|verify} messages.
     * @param message UserProfileExt message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUserProfileExt,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserProfileExt message, length delimited. Does not implicitly {@link Enterprise.UserProfileExt.verify|verify} messages.
     * @param message UserProfileExt message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUserProfileExt,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserProfileExt message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserProfileExt
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UserProfileExt;

    /**
     * Decodes a UserProfileExt message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserProfileExt
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.UserProfileExt;

    /**
     * Verifies a UserProfileExt message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserProfileExt message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserProfileExt
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UserProfileExt;

    /**
     * Creates a plain object from a UserProfileExt message. Also converts values to other types if specified.
     * @param message UserProfileExt
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UserProfileExt,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserProfileExt to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserProfileExt
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetSharingAdminsResponse. */
  interface IGetSharingAdminsResponse {
    /** GetSharingAdminsResponse userProfileExts */
    userProfileExts?: Enterprise.IUserProfileExt[] | null;
  }

  /** Represents a GetSharingAdminsResponse. */
  class GetSharingAdminsResponse implements IGetSharingAdminsResponse {
    /**
     * Constructs a new GetSharingAdminsResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IGetSharingAdminsResponse);

    /** GetSharingAdminsResponse userProfileExts. */
    public userProfileExts: Enterprise.IUserProfileExt[];

    /**
     * Creates a new GetSharingAdminsResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetSharingAdminsResponse instance
     */
    public static create(
      properties?: Enterprise.IGetSharingAdminsResponse,
    ): Enterprise.GetSharingAdminsResponse;

    /**
     * Encodes the specified GetSharingAdminsResponse message. Does not implicitly {@link Enterprise.GetSharingAdminsResponse.verify|verify} messages.
     * @param message GetSharingAdminsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IGetSharingAdminsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetSharingAdminsResponse message, length delimited. Does not implicitly {@link Enterprise.GetSharingAdminsResponse.verify|verify} messages.
     * @param message GetSharingAdminsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IGetSharingAdminsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetSharingAdminsResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetSharingAdminsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.GetSharingAdminsResponse;

    /**
     * Decodes a GetSharingAdminsResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetSharingAdminsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.GetSharingAdminsResponse;

    /**
     * Verifies a GetSharingAdminsResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetSharingAdminsResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetSharingAdminsResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.GetSharingAdminsResponse;

    /**
     * Creates a plain object from a GetSharingAdminsResponse message. Also converts values to other types if specified.
     * @param message GetSharingAdminsResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.GetSharingAdminsResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetSharingAdminsResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetSharingAdminsResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddRequest. */
  interface ITeamsEnterpriseUsersAddRequest {
    /** TeamsEnterpriseUsersAddRequest teams */
    teams?: Enterprise.ITeamsEnterpriseUsersAddTeamRequest[] | null;
  }

  /** Represents a TeamsEnterpriseUsersAddRequest. */
  class TeamsEnterpriseUsersAddRequest implements ITeamsEnterpriseUsersAddRequest {
    /**
     * Constructs a new TeamsEnterpriseUsersAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddRequest);

    /** TeamsEnterpriseUsersAddRequest teams. */
    public teams: Enterprise.ITeamsEnterpriseUsersAddTeamRequest[];

    /**
     * Creates a new TeamsEnterpriseUsersAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddRequest instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddRequest,
    ): Enterprise.TeamsEnterpriseUsersAddRequest;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddRequest message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddRequest message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddRequest;

    /**
     * Decodes a TeamsEnterpriseUsersAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddRequest;

    /**
     * Verifies a TeamsEnterpriseUsersAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddRequest;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddRequest message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddTeamRequest. */
  interface ITeamsEnterpriseUsersAddTeamRequest {
    /** TeamsEnterpriseUsersAddTeamRequest teamUid */
    teamUid?: Uint8Array | null;

    /** TeamsEnterpriseUsersAddTeamRequest users */
    users?: Enterprise.ITeamsEnterpriseUsersAddUserRequest[] | null;
  }

  /** Represents a TeamsEnterpriseUsersAddTeamRequest. */
  class TeamsEnterpriseUsersAddTeamRequest implements ITeamsEnterpriseUsersAddTeamRequest {
    /**
     * Constructs a new TeamsEnterpriseUsersAddTeamRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddTeamRequest);

    /** TeamsEnterpriseUsersAddTeamRequest teamUid. */
    public teamUid: Uint8Array;

    /** TeamsEnterpriseUsersAddTeamRequest users. */
    public users: Enterprise.ITeamsEnterpriseUsersAddUserRequest[];

    /**
     * Creates a new TeamsEnterpriseUsersAddTeamRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddTeamRequest instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddTeamRequest,
    ): Enterprise.TeamsEnterpriseUsersAddTeamRequest;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddTeamRequest message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddTeamRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddTeamRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddTeamRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddTeamRequest message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddTeamRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddTeamRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddTeamRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddTeamRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddTeamRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddTeamRequest;

    /**
     * Decodes a TeamsEnterpriseUsersAddTeamRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddTeamRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddTeamRequest;

    /**
     * Verifies a TeamsEnterpriseUsersAddTeamRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddTeamRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddTeamRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddTeamRequest;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddTeamRequest message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddTeamRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddTeamRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddTeamRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddTeamRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddUserRequest. */
  interface ITeamsEnterpriseUsersAddUserRequest {
    /** TeamsEnterpriseUsersAddUserRequest enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** TeamsEnterpriseUsersAddUserRequest userType */
    userType?: Enterprise.TeamUserType | null;

    /** TeamsEnterpriseUsersAddUserRequest teamKey */
    teamKey?: string | null;

    /** TeamsEnterpriseUsersAddUserRequest typedTeamKey */
    typedTeamKey?: Enterprise.ITypedKey | null;
  }

  /** Represents a TeamsEnterpriseUsersAddUserRequest. */
  class TeamsEnterpriseUsersAddUserRequest implements ITeamsEnterpriseUsersAddUserRequest {
    /**
     * Constructs a new TeamsEnterpriseUsersAddUserRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddUserRequest);

    /** TeamsEnterpriseUsersAddUserRequest enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** TeamsEnterpriseUsersAddUserRequest userType. */
    public userType: Enterprise.TeamUserType;

    /** TeamsEnterpriseUsersAddUserRequest teamKey. */
    public teamKey: string;

    /** TeamsEnterpriseUsersAddUserRequest typedTeamKey. */
    public typedTeamKey?: Enterprise.ITypedKey | null;

    /**
     * Creates a new TeamsEnterpriseUsersAddUserRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddUserRequest instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddUserRequest,
    ): Enterprise.TeamsEnterpriseUsersAddUserRequest;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddUserRequest message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddUserRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddUserRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddUserRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddUserRequest message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddUserRequest.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddUserRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddUserRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddUserRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddUserRequest;

    /**
     * Decodes a TeamsEnterpriseUsersAddUserRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddUserRequest;

    /**
     * Verifies a TeamsEnterpriseUsersAddUserRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddUserRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddUserRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddUserRequest;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddUserRequest message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddUserRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddUserRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddUserRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddUserRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TypedKey. */
  interface ITypedKey {
    /** TypedKey key */
    key?: Uint8Array | null;

    /** TypedKey keyType */
    keyType?: Enterprise.EncryptedKeyType | null;
  }

  /** Represents a TypedKey. */
  class TypedKey implements ITypedKey {
    /**
     * Constructs a new TypedKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITypedKey);

    /** TypedKey key. */
    public key: Uint8Array;

    /** TypedKey keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /**
     * Creates a new TypedKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TypedKey instance
     */
    public static create(properties?: Enterprise.ITypedKey): Enterprise.TypedKey;

    /**
     * Encodes the specified TypedKey message. Does not implicitly {@link Enterprise.TypedKey.verify|verify} messages.
     * @param message TypedKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITypedKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TypedKey message, length delimited. Does not implicitly {@link Enterprise.TypedKey.verify|verify} messages.
     * @param message TypedKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITypedKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TypedKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TypedKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TypedKey;

    /**
     * Decodes a TypedKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TypedKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.TypedKey;

    /**
     * Verifies a TypedKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TypedKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TypedKey
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.TypedKey;

    /**
     * Creates a plain object from a TypedKey message. Also converts values to other types if specified.
     * @param message TypedKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TypedKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TypedKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TypedKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddResponse. */
  interface ITeamsEnterpriseUsersAddResponse {
    /** TeamsEnterpriseUsersAddResponse teams */
    teams?: Enterprise.ITeamsEnterpriseUsersAddTeamResponse[] | null;

    /** TeamsEnterpriseUsersAddResponse revision */
    revision?: number | Long | null;
  }

  /** Represents a TeamsEnterpriseUsersAddResponse. */
  class TeamsEnterpriseUsersAddResponse implements ITeamsEnterpriseUsersAddResponse {
    /**
     * Constructs a new TeamsEnterpriseUsersAddResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddResponse);

    /** TeamsEnterpriseUsersAddResponse teams. */
    public teams: Enterprise.ITeamsEnterpriseUsersAddTeamResponse[];

    /** TeamsEnterpriseUsersAddResponse revision. */
    public revision: number | Long;

    /**
     * Creates a new TeamsEnterpriseUsersAddResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddResponse instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddResponse,
    ): Enterprise.TeamsEnterpriseUsersAddResponse;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddResponse message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddResponse message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddResponse;

    /**
     * Decodes a TeamsEnterpriseUsersAddResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddResponse;

    /**
     * Verifies a TeamsEnterpriseUsersAddResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddResponse;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddResponse message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddTeamResponse. */
  interface ITeamsEnterpriseUsersAddTeamResponse {
    /** TeamsEnterpriseUsersAddTeamResponse teamUid */
    teamUid?: Uint8Array | null;

    /** TeamsEnterpriseUsersAddTeamResponse users */
    users?: Enterprise.ITeamsEnterpriseUsersAddUserResponse[] | null;

    /** TeamsEnterpriseUsersAddTeamResponse success */
    success?: boolean | null;

    /** TeamsEnterpriseUsersAddTeamResponse message */
    message?: string | null;

    /** TeamsEnterpriseUsersAddTeamResponse resultCode */
    resultCode?: string | null;

    /** TeamsEnterpriseUsersAddTeamResponse additionalInfo */
    additionalInfo?: string | null;
  }

  /** Represents a TeamsEnterpriseUsersAddTeamResponse. */
  class TeamsEnterpriseUsersAddTeamResponse implements ITeamsEnterpriseUsersAddTeamResponse {
    /**
     * Constructs a new TeamsEnterpriseUsersAddTeamResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddTeamResponse);

    /** TeamsEnterpriseUsersAddTeamResponse teamUid. */
    public teamUid: Uint8Array;

    /** TeamsEnterpriseUsersAddTeamResponse users. */
    public users: Enterprise.ITeamsEnterpriseUsersAddUserResponse[];

    /** TeamsEnterpriseUsersAddTeamResponse success. */
    public success: boolean;

    /** TeamsEnterpriseUsersAddTeamResponse message. */
    public message: string;

    /** TeamsEnterpriseUsersAddTeamResponse resultCode. */
    public resultCode: string;

    /** TeamsEnterpriseUsersAddTeamResponse additionalInfo. */
    public additionalInfo: string;

    /**
     * Creates a new TeamsEnterpriseUsersAddTeamResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddTeamResponse instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddTeamResponse,
    ): Enterprise.TeamsEnterpriseUsersAddTeamResponse;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddTeamResponse message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddTeamResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddTeamResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddTeamResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddTeamResponse message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddTeamResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddTeamResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddTeamResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddTeamResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddTeamResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddTeamResponse;

    /**
     * Decodes a TeamsEnterpriseUsersAddTeamResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddTeamResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddTeamResponse;

    /**
     * Verifies a TeamsEnterpriseUsersAddTeamResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddTeamResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddTeamResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddTeamResponse;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddTeamResponse message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddTeamResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddTeamResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddTeamResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddTeamResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TeamsEnterpriseUsersAddUserResponse. */
  interface ITeamsEnterpriseUsersAddUserResponse {
    /** TeamsEnterpriseUsersAddUserResponse enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** TeamsEnterpriseUsersAddUserResponse revision */
    revision?: number | Long | null;

    /** TeamsEnterpriseUsersAddUserResponse success */
    success?: boolean | null;

    /** TeamsEnterpriseUsersAddUserResponse message */
    message?: string | null;

    /** TeamsEnterpriseUsersAddUserResponse resultCode */
    resultCode?: string | null;

    /** TeamsEnterpriseUsersAddUserResponse additionalInfo */
    additionalInfo?: string | null;
  }

  /** Represents a TeamsEnterpriseUsersAddUserResponse. */
  class TeamsEnterpriseUsersAddUserResponse implements ITeamsEnterpriseUsersAddUserResponse {
    /**
     * Constructs a new TeamsEnterpriseUsersAddUserResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.ITeamsEnterpriseUsersAddUserResponse);

    /** TeamsEnterpriseUsersAddUserResponse enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** TeamsEnterpriseUsersAddUserResponse revision. */
    public revision: number | Long;

    /** TeamsEnterpriseUsersAddUserResponse success. */
    public success: boolean;

    /** TeamsEnterpriseUsersAddUserResponse message. */
    public message: string;

    /** TeamsEnterpriseUsersAddUserResponse resultCode. */
    public resultCode: string;

    /** TeamsEnterpriseUsersAddUserResponse additionalInfo. */
    public additionalInfo: string;

    /**
     * Creates a new TeamsEnterpriseUsersAddUserResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TeamsEnterpriseUsersAddUserResponse instance
     */
    public static create(
      properties?: Enterprise.ITeamsEnterpriseUsersAddUserResponse,
    ): Enterprise.TeamsEnterpriseUsersAddUserResponse;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddUserResponse message. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddUserResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddUserResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.ITeamsEnterpriseUsersAddUserResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TeamsEnterpriseUsersAddUserResponse message, length delimited. Does not implicitly {@link Enterprise.TeamsEnterpriseUsersAddUserResponse.verify|verify} messages.
     * @param message TeamsEnterpriseUsersAddUserResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.ITeamsEnterpriseUsersAddUserResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TeamsEnterpriseUsersAddUserResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TeamsEnterpriseUsersAddUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.TeamsEnterpriseUsersAddUserResponse;

    /**
     * Decodes a TeamsEnterpriseUsersAddUserResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TeamsEnterpriseUsersAddUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.TeamsEnterpriseUsersAddUserResponse;

    /**
     * Verifies a TeamsEnterpriseUsersAddUserResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TeamsEnterpriseUsersAddUserResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TeamsEnterpriseUsersAddUserResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.TeamsEnterpriseUsersAddUserResponse;

    /**
     * Creates a plain object from a TeamsEnterpriseUsersAddUserResponse message. Also converts values to other types if specified.
     * @param message TeamsEnterpriseUsersAddUserResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.TeamsEnterpriseUsersAddUserResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TeamsEnterpriseUsersAddUserResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TeamsEnterpriseUsersAddUserResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainAlias. */
  interface IDomainAlias {
    /** DomainAlias domain */
    domain?: string | null;

    /** DomainAlias alias */
    alias?: string | null;

    /** DomainAlias status */
    status?: number | null;

    /** DomainAlias message */
    message?: string | null;
  }

  /** Represents a DomainAlias. */
  class DomainAlias implements IDomainAlias {
    /**
     * Constructs a new DomainAlias.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainAlias);

    /** DomainAlias domain. */
    public domain: string;

    /** DomainAlias alias. */
    public alias: string;

    /** DomainAlias status. */
    public status: number;

    /** DomainAlias message. */
    public message: string;

    /**
     * Creates a new DomainAlias instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainAlias instance
     */
    public static create(properties?: Enterprise.IDomainAlias): Enterprise.DomainAlias;

    /**
     * Encodes the specified DomainAlias message. Does not implicitly {@link Enterprise.DomainAlias.verify|verify} messages.
     * @param message DomainAlias message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainAlias,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainAlias message, length delimited. Does not implicitly {@link Enterprise.DomainAlias.verify|verify} messages.
     * @param message DomainAlias message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainAlias,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainAlias message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainAlias
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainAlias;

    /**
     * Decodes a DomainAlias message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainAlias
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Enterprise.DomainAlias;

    /**
     * Verifies a DomainAlias message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainAlias message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainAlias
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainAlias;

    /**
     * Creates a plain object from a DomainAlias message. Also converts values to other types if specified.
     * @param message DomainAlias
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainAlias,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainAlias to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainAlias
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainAliasRequest. */
  interface IDomainAliasRequest {
    /** DomainAliasRequest domainAlias */
    domainAlias?: Enterprise.IDomainAlias[] | null;
  }

  /** Represents a DomainAliasRequest. */
  class DomainAliasRequest implements IDomainAliasRequest {
    /**
     * Constructs a new DomainAliasRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainAliasRequest);

    /** DomainAliasRequest domainAlias. */
    public domainAlias: Enterprise.IDomainAlias[];

    /**
     * Creates a new DomainAliasRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainAliasRequest instance
     */
    public static create(
      properties?: Enterprise.IDomainAliasRequest,
    ): Enterprise.DomainAliasRequest;

    /**
     * Encodes the specified DomainAliasRequest message. Does not implicitly {@link Enterprise.DomainAliasRequest.verify|verify} messages.
     * @param message DomainAliasRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainAliasRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainAliasRequest message, length delimited. Does not implicitly {@link Enterprise.DomainAliasRequest.verify|verify} messages.
     * @param message DomainAliasRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainAliasRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainAliasRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainAliasRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainAliasRequest;

    /**
     * Decodes a DomainAliasRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainAliasRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DomainAliasRequest;

    /**
     * Verifies a DomainAliasRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainAliasRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainAliasRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainAliasRequest;

    /**
     * Creates a plain object from a DomainAliasRequest message. Also converts values to other types if specified.
     * @param message DomainAliasRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainAliasRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainAliasRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainAliasRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DomainAliasResponse. */
  interface IDomainAliasResponse {
    /** DomainAliasResponse domainAlias */
    domainAlias?: Enterprise.IDomainAlias[] | null;
  }

  /** Represents a DomainAliasResponse. */
  class DomainAliasResponse implements IDomainAliasResponse {
    /**
     * Constructs a new DomainAliasResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDomainAliasResponse);

    /** DomainAliasResponse domainAlias. */
    public domainAlias: Enterprise.IDomainAlias[];

    /**
     * Creates a new DomainAliasResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DomainAliasResponse instance
     */
    public static create(
      properties?: Enterprise.IDomainAliasResponse,
    ): Enterprise.DomainAliasResponse;

    /**
     * Encodes the specified DomainAliasResponse message. Does not implicitly {@link Enterprise.DomainAliasResponse.verify|verify} messages.
     * @param message DomainAliasResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDomainAliasResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DomainAliasResponse message, length delimited. Does not implicitly {@link Enterprise.DomainAliasResponse.verify|verify} messages.
     * @param message DomainAliasResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDomainAliasResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DomainAliasResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DomainAliasResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DomainAliasResponse;

    /**
     * Decodes a DomainAliasResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DomainAliasResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DomainAliasResponse;

    /**
     * Verifies a DomainAliasResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DomainAliasResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DomainAliasResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DomainAliasResponse;

    /**
     * Creates a plain object from a DomainAliasResponse message. Also converts values to other types if specified.
     * @param message DomainAliasResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DomainAliasResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DomainAliasResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DomainAliasResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersProvisionRequest. */
  interface IEnterpriseUsersProvisionRequest {
    /** EnterpriseUsersProvisionRequest users */
    users?: Enterprise.IEnterpriseUsersProvision[] | null;

    /** EnterpriseUsersProvisionRequest clientVersion */
    clientVersion?: string | null;
  }

  /** Represents an EnterpriseUsersProvisionRequest. */
  class EnterpriseUsersProvisionRequest implements IEnterpriseUsersProvisionRequest {
    /**
     * Constructs a new EnterpriseUsersProvisionRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersProvisionRequest);

    /** EnterpriseUsersProvisionRequest users. */
    public users: Enterprise.IEnterpriseUsersProvision[];

    /** EnterpriseUsersProvisionRequest clientVersion. */
    public clientVersion: string;

    /**
     * Creates a new EnterpriseUsersProvisionRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersProvisionRequest instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersProvisionRequest,
    ): Enterprise.EnterpriseUsersProvisionRequest;

    /**
     * Encodes the specified EnterpriseUsersProvisionRequest message. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionRequest.verify|verify} messages.
     * @param message EnterpriseUsersProvisionRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersProvisionRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersProvisionRequest message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionRequest.verify|verify} messages.
     * @param message EnterpriseUsersProvisionRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersProvisionRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersProvisionRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersProvisionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersProvisionRequest;

    /**
     * Decodes an EnterpriseUsersProvisionRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersProvisionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersProvisionRequest;

    /**
     * Verifies an EnterpriseUsersProvisionRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersProvisionRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersProvisionRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.EnterpriseUsersProvisionRequest;

    /**
     * Creates a plain object from an EnterpriseUsersProvisionRequest message. Also converts values to other types if specified.
     * @param message EnterpriseUsersProvisionRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersProvisionRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersProvisionRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersProvisionRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersProvision. */
  interface IEnterpriseUsersProvision {
    /** EnterpriseUsersProvision enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUsersProvision username */
    username?: string | null;

    /** EnterpriseUsersProvision nodeId */
    nodeId?: number | Long | null;

    /** EnterpriseUsersProvision encryptedData */
    encryptedData?: string | null;

    /** EnterpriseUsersProvision keyType */
    keyType?: Enterprise.EncryptedKeyType | null;

    /** EnterpriseUsersProvision fullName */
    fullName?: string | null;

    /** EnterpriseUsersProvision jobTitle */
    jobTitle?: string | null;

    /** EnterpriseUsersProvision enterpriseUsersDataKey */
    enterpriseUsersDataKey?: Uint8Array | null;

    /** EnterpriseUsersProvision authVerifier */
    authVerifier?: Uint8Array | null;

    /** EnterpriseUsersProvision encryptionParams */
    encryptionParams?: Uint8Array | null;

    /** EnterpriseUsersProvision rsaPublicKey */
    rsaPublicKey?: Uint8Array | null;

    /** EnterpriseUsersProvision rsaEncryptedPrivateKey */
    rsaEncryptedPrivateKey?: Uint8Array | null;

    /** EnterpriseUsersProvision eccPublicKey */
    eccPublicKey?: Uint8Array | null;

    /** EnterpriseUsersProvision eccEncryptedPrivateKey */
    eccEncryptedPrivateKey?: Uint8Array | null;

    /** EnterpriseUsersProvision encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** EnterpriseUsersProvision encryptedClientKey */
    encryptedClientKey?: Uint8Array | null;
  }

  /** Represents an EnterpriseUsersProvision. */
  class EnterpriseUsersProvision implements IEnterpriseUsersProvision {
    /**
     * Constructs a new EnterpriseUsersProvision.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersProvision);

    /** EnterpriseUsersProvision enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUsersProvision username. */
    public username: string;

    /** EnterpriseUsersProvision nodeId. */
    public nodeId: number | Long;

    /** EnterpriseUsersProvision encryptedData. */
    public encryptedData: string;

    /** EnterpriseUsersProvision keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /** EnterpriseUsersProvision fullName. */
    public fullName: string;

    /** EnterpriseUsersProvision jobTitle. */
    public jobTitle: string;

    /** EnterpriseUsersProvision enterpriseUsersDataKey. */
    public enterpriseUsersDataKey: Uint8Array;

    /** EnterpriseUsersProvision authVerifier. */
    public authVerifier: Uint8Array;

    /** EnterpriseUsersProvision encryptionParams. */
    public encryptionParams: Uint8Array;

    /** EnterpriseUsersProvision rsaPublicKey. */
    public rsaPublicKey: Uint8Array;

    /** EnterpriseUsersProvision rsaEncryptedPrivateKey. */
    public rsaEncryptedPrivateKey: Uint8Array;

    /** EnterpriseUsersProvision eccPublicKey. */
    public eccPublicKey: Uint8Array;

    /** EnterpriseUsersProvision eccEncryptedPrivateKey. */
    public eccEncryptedPrivateKey: Uint8Array;

    /** EnterpriseUsersProvision encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** EnterpriseUsersProvision encryptedClientKey. */
    public encryptedClientKey: Uint8Array;

    /**
     * Creates a new EnterpriseUsersProvision instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersProvision instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersProvision,
    ): Enterprise.EnterpriseUsersProvision;

    /**
     * Encodes the specified EnterpriseUsersProvision message. Does not implicitly {@link Enterprise.EnterpriseUsersProvision.verify|verify} messages.
     * @param message EnterpriseUsersProvision message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersProvision,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersProvision message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersProvision.verify|verify} messages.
     * @param message EnterpriseUsersProvision message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersProvision,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersProvision message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersProvision
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersProvision;

    /**
     * Decodes an EnterpriseUsersProvision message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersProvision
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersProvision;

    /**
     * Verifies an EnterpriseUsersProvision message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersProvision message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersProvision
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUsersProvision;

    /**
     * Creates a plain object from an EnterpriseUsersProvision message. Also converts values to other types if specified.
     * @param message EnterpriseUsersProvision
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersProvision,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersProvision to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersProvision
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersProvisionResponse. */
  interface IEnterpriseUsersProvisionResponse {
    /** EnterpriseUsersProvisionResponse results */
    results?: Enterprise.IEnterpriseUsersProvisionResult[] | null;
  }

  /** Represents an EnterpriseUsersProvisionResponse. */
  class EnterpriseUsersProvisionResponse implements IEnterpriseUsersProvisionResponse {
    /**
     * Constructs a new EnterpriseUsersProvisionResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersProvisionResponse);

    /** EnterpriseUsersProvisionResponse results. */
    public results: Enterprise.IEnterpriseUsersProvisionResult[];

    /**
     * Creates a new EnterpriseUsersProvisionResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersProvisionResponse instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersProvisionResponse,
    ): Enterprise.EnterpriseUsersProvisionResponse;

    /**
     * Encodes the specified EnterpriseUsersProvisionResponse message. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionResponse.verify|verify} messages.
     * @param message EnterpriseUsersProvisionResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersProvisionResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersProvisionResponse message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionResponse.verify|verify} messages.
     * @param message EnterpriseUsersProvisionResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersProvisionResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersProvisionResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersProvisionResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersProvisionResponse;

    /**
     * Decodes an EnterpriseUsersProvisionResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersProvisionResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersProvisionResponse;

    /**
     * Verifies an EnterpriseUsersProvisionResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersProvisionResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersProvisionResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.EnterpriseUsersProvisionResponse;

    /**
     * Creates a plain object from an EnterpriseUsersProvisionResponse message. Also converts values to other types if specified.
     * @param message EnterpriseUsersProvisionResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersProvisionResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersProvisionResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersProvisionResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersProvisionResult. */
  interface IEnterpriseUsersProvisionResult {
    /** EnterpriseUsersProvisionResult enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUsersProvisionResult code */
    code?: string | null;

    /** EnterpriseUsersProvisionResult message */
    message?: string | null;

    /** EnterpriseUsersProvisionResult additionalInfo */
    additionalInfo?: string | null;
  }

  /** Represents an EnterpriseUsersProvisionResult. */
  class EnterpriseUsersProvisionResult implements IEnterpriseUsersProvisionResult {
    /**
     * Constructs a new EnterpriseUsersProvisionResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersProvisionResult);

    /** EnterpriseUsersProvisionResult enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUsersProvisionResult code. */
    public code: string;

    /** EnterpriseUsersProvisionResult message. */
    public message: string;

    /** EnterpriseUsersProvisionResult additionalInfo. */
    public additionalInfo: string;

    /**
     * Creates a new EnterpriseUsersProvisionResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersProvisionResult instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersProvisionResult,
    ): Enterprise.EnterpriseUsersProvisionResult;

    /**
     * Encodes the specified EnterpriseUsersProvisionResult message. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionResult.verify|verify} messages.
     * @param message EnterpriseUsersProvisionResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersProvisionResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersProvisionResult message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersProvisionResult.verify|verify} messages.
     * @param message EnterpriseUsersProvisionResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersProvisionResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersProvisionResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersProvisionResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersProvisionResult;

    /**
     * Decodes an EnterpriseUsersProvisionResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersProvisionResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersProvisionResult;

    /**
     * Verifies an EnterpriseUsersProvisionResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersProvisionResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersProvisionResult
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.EnterpriseUsersProvisionResult;

    /**
     * Creates a plain object from an EnterpriseUsersProvisionResult message. Also converts values to other types if specified.
     * @param message EnterpriseUsersProvisionResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersProvisionResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersProvisionResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersProvisionResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersAddRequest. */
  interface IEnterpriseUsersAddRequest {
    /** EnterpriseUsersAddRequest users */
    users?: Enterprise.IEnterpriseUsersAdd[] | null;

    /** EnterpriseUsersAddRequest clientVersion */
    clientVersion?: string | null;
  }

  /** Represents an EnterpriseUsersAddRequest. */
  class EnterpriseUsersAddRequest implements IEnterpriseUsersAddRequest {
    /**
     * Constructs a new EnterpriseUsersAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersAddRequest);

    /** EnterpriseUsersAddRequest users. */
    public users: Enterprise.IEnterpriseUsersAdd[];

    /** EnterpriseUsersAddRequest clientVersion. */
    public clientVersion: string;

    /**
     * Creates a new EnterpriseUsersAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersAddRequest instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersAddRequest,
    ): Enterprise.EnterpriseUsersAddRequest;

    /**
     * Encodes the specified EnterpriseUsersAddRequest message. Does not implicitly {@link Enterprise.EnterpriseUsersAddRequest.verify|verify} messages.
     * @param message EnterpriseUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersAddRequest message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersAddRequest.verify|verify} messages.
     * @param message EnterpriseUsersAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersAddRequest;

    /**
     * Decodes an EnterpriseUsersAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersAddRequest;

    /**
     * Verifies an EnterpriseUsersAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUsersAddRequest;

    /**
     * Creates a plain object from an EnterpriseUsersAddRequest message. Also converts values to other types if specified.
     * @param message EnterpriseUsersAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersAdd. */
  interface IEnterpriseUsersAdd {
    /** EnterpriseUsersAdd enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUsersAdd username */
    username?: string | null;

    /** EnterpriseUsersAdd nodeId */
    nodeId?: number | Long | null;

    /** EnterpriseUsersAdd encryptedData */
    encryptedData?: string | null;

    /** EnterpriseUsersAdd keyType */
    keyType?: Enterprise.EncryptedKeyType | null;

    /** EnterpriseUsersAdd fullName */
    fullName?: string | null;

    /** EnterpriseUsersAdd jobTitle */
    jobTitle?: string | null;

    /** EnterpriseUsersAdd suppressEmailInvite */
    suppressEmailInvite?: boolean | null;

    /** EnterpriseUsersAdd inviteeLocale */
    inviteeLocale?: string | null;

    /** EnterpriseUsersAdd move */
    move?: boolean | null;

    /** EnterpriseUsersAdd roleId */
    roleId?: number | Long | null;
  }

  /** Represents an EnterpriseUsersAdd. */
  class EnterpriseUsersAdd implements IEnterpriseUsersAdd {
    /**
     * Constructs a new EnterpriseUsersAdd.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersAdd);

    /** EnterpriseUsersAdd enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUsersAdd username. */
    public username: string;

    /** EnterpriseUsersAdd nodeId. */
    public nodeId: number | Long;

    /** EnterpriseUsersAdd encryptedData. */
    public encryptedData: string;

    /** EnterpriseUsersAdd keyType. */
    public keyType: Enterprise.EncryptedKeyType;

    /** EnterpriseUsersAdd fullName. */
    public fullName: string;

    /** EnterpriseUsersAdd jobTitle. */
    public jobTitle: string;

    /** EnterpriseUsersAdd suppressEmailInvite. */
    public suppressEmailInvite: boolean;

    /** EnterpriseUsersAdd inviteeLocale. */
    public inviteeLocale: string;

    /** EnterpriseUsersAdd move. */
    public move: boolean;

    /** EnterpriseUsersAdd roleId. */
    public roleId: number | Long;

    /**
     * Creates a new EnterpriseUsersAdd instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersAdd instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersAdd,
    ): Enterprise.EnterpriseUsersAdd;

    /**
     * Encodes the specified EnterpriseUsersAdd message. Does not implicitly {@link Enterprise.EnterpriseUsersAdd.verify|verify} messages.
     * @param message EnterpriseUsersAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersAdd,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersAdd message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersAdd.verify|verify} messages.
     * @param message EnterpriseUsersAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersAdd,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersAdd message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersAdd;

    /**
     * Decodes an EnterpriseUsersAdd message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersAdd;

    /**
     * Verifies an EnterpriseUsersAdd message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersAdd message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersAdd
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUsersAdd;

    /**
     * Creates a plain object from an EnterpriseUsersAdd message. Also converts values to other types if specified.
     * @param message EnterpriseUsersAdd
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersAdd,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersAdd to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersAdd
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersAddResponse. */
  interface IEnterpriseUsersAddResponse {
    /** EnterpriseUsersAddResponse results */
    results?: Enterprise.IEnterpriseUsersAddResult[] | null;

    /** EnterpriseUsersAddResponse success */
    success?: boolean | null;

    /** EnterpriseUsersAddResponse code */
    code?: string | null;

    /** EnterpriseUsersAddResponse message */
    message?: string | null;

    /** EnterpriseUsersAddResponse additionalInfo */
    additionalInfo?: string | null;
  }

  /** Represents an EnterpriseUsersAddResponse. */
  class EnterpriseUsersAddResponse implements IEnterpriseUsersAddResponse {
    /**
     * Constructs a new EnterpriseUsersAddResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersAddResponse);

    /** EnterpriseUsersAddResponse results. */
    public results: Enterprise.IEnterpriseUsersAddResult[];

    /** EnterpriseUsersAddResponse success. */
    public success: boolean;

    /** EnterpriseUsersAddResponse code. */
    public code: string;

    /** EnterpriseUsersAddResponse message. */
    public message: string;

    /** EnterpriseUsersAddResponse additionalInfo. */
    public additionalInfo: string;

    /**
     * Creates a new EnterpriseUsersAddResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersAddResponse instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersAddResponse,
    ): Enterprise.EnterpriseUsersAddResponse;

    /**
     * Encodes the specified EnterpriseUsersAddResponse message. Does not implicitly {@link Enterprise.EnterpriseUsersAddResponse.verify|verify} messages.
     * @param message EnterpriseUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersAddResponse message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersAddResponse.verify|verify} messages.
     * @param message EnterpriseUsersAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersAddResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersAddResponse;

    /**
     * Decodes an EnterpriseUsersAddResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersAddResponse;

    /**
     * Verifies an EnterpriseUsersAddResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersAddResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersAddResponse
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUsersAddResponse;

    /**
     * Creates a plain object from an EnterpriseUsersAddResponse message. Also converts values to other types if specified.
     * @param message EnterpriseUsersAddResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersAddResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersAddResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersAddResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterpriseUsersAddResult. */
  interface IEnterpriseUsersAddResult {
    /** EnterpriseUsersAddResult enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** EnterpriseUsersAddResult success */
    success?: boolean | null;

    /** EnterpriseUsersAddResult verificationCode */
    verificationCode?: string | null;

    /** EnterpriseUsersAddResult code */
    code?: string | null;

    /** EnterpriseUsersAddResult message */
    message?: string | null;

    /** EnterpriseUsersAddResult additionalInfo */
    additionalInfo?: string | null;
  }

  /** Represents an EnterpriseUsersAddResult. */
  class EnterpriseUsersAddResult implements IEnterpriseUsersAddResult {
    /**
     * Constructs a new EnterpriseUsersAddResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IEnterpriseUsersAddResult);

    /** EnterpriseUsersAddResult enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** EnterpriseUsersAddResult success. */
    public success: boolean;

    /** EnterpriseUsersAddResult verificationCode. */
    public verificationCode: string;

    /** EnterpriseUsersAddResult code. */
    public code: string;

    /** EnterpriseUsersAddResult message. */
    public message: string;

    /** EnterpriseUsersAddResult additionalInfo. */
    public additionalInfo: string;

    /**
     * Creates a new EnterpriseUsersAddResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterpriseUsersAddResult instance
     */
    public static create(
      properties?: Enterprise.IEnterpriseUsersAddResult,
    ): Enterprise.EnterpriseUsersAddResult;

    /**
     * Encodes the specified EnterpriseUsersAddResult message. Does not implicitly {@link Enterprise.EnterpriseUsersAddResult.verify|verify} messages.
     * @param message EnterpriseUsersAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IEnterpriseUsersAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterpriseUsersAddResult message, length delimited. Does not implicitly {@link Enterprise.EnterpriseUsersAddResult.verify|verify} messages.
     * @param message EnterpriseUsersAddResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IEnterpriseUsersAddResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterpriseUsersAddResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterpriseUsersAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.EnterpriseUsersAddResult;

    /**
     * Decodes an EnterpriseUsersAddResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterpriseUsersAddResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.EnterpriseUsersAddResult;

    /**
     * Verifies an EnterpriseUsersAddResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterpriseUsersAddResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterpriseUsersAddResult
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.EnterpriseUsersAddResult;

    /**
     * Creates a plain object from an EnterpriseUsersAddResult message. Also converts values to other types if specified.
     * @param message EnterpriseUsersAddResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.EnterpriseUsersAddResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterpriseUsersAddResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterpriseUsersAddResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an UpdateMSPPermitsRequest. */
  interface IUpdateMSPPermitsRequest {
    /** UpdateMSPPermitsRequest mspEnterpriseId */
    mspEnterpriseId?: number | null;

    /** UpdateMSPPermitsRequest maxAllowedLicenses */
    maxAllowedLicenses?: number | null;

    /** UpdateMSPPermitsRequest allowedMcProducts */
    allowedMcProducts?: string[] | null;

    /** UpdateMSPPermitsRequest allowedAddOns */
    allowedAddOns?: string[] | null;

    /** UpdateMSPPermitsRequest maxFilePlanType */
    maxFilePlanType?: string | null;

    /** UpdateMSPPermitsRequest allowUnlimitedLicenses */
    allowUnlimitedLicenses?: boolean | null;
  }

  /** Represents an UpdateMSPPermitsRequest. */
  class UpdateMSPPermitsRequest implements IUpdateMSPPermitsRequest {
    /**
     * Constructs a new UpdateMSPPermitsRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IUpdateMSPPermitsRequest);

    /** UpdateMSPPermitsRequest mspEnterpriseId. */
    public mspEnterpriseId: number;

    /** UpdateMSPPermitsRequest maxAllowedLicenses. */
    public maxAllowedLicenses: number;

    /** UpdateMSPPermitsRequest allowedMcProducts. */
    public allowedMcProducts: string[];

    /** UpdateMSPPermitsRequest allowedAddOns. */
    public allowedAddOns: string[];

    /** UpdateMSPPermitsRequest maxFilePlanType. */
    public maxFilePlanType: string;

    /** UpdateMSPPermitsRequest allowUnlimitedLicenses. */
    public allowUnlimitedLicenses: boolean;

    /**
     * Creates a new UpdateMSPPermitsRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UpdateMSPPermitsRequest instance
     */
    public static create(
      properties?: Enterprise.IUpdateMSPPermitsRequest,
    ): Enterprise.UpdateMSPPermitsRequest;

    /**
     * Encodes the specified UpdateMSPPermitsRequest message. Does not implicitly {@link Enterprise.UpdateMSPPermitsRequest.verify|verify} messages.
     * @param message UpdateMSPPermitsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IUpdateMSPPermitsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UpdateMSPPermitsRequest message, length delimited. Does not implicitly {@link Enterprise.UpdateMSPPermitsRequest.verify|verify} messages.
     * @param message UpdateMSPPermitsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IUpdateMSPPermitsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an UpdateMSPPermitsRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UpdateMSPPermitsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.UpdateMSPPermitsRequest;

    /**
     * Decodes an UpdateMSPPermitsRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UpdateMSPPermitsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.UpdateMSPPermitsRequest;

    /**
     * Verifies an UpdateMSPPermitsRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an UpdateMSPPermitsRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UpdateMSPPermitsRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.UpdateMSPPermitsRequest;

    /**
     * Creates a plain object from an UpdateMSPPermitsRequest message. Also converts values to other types if specified.
     * @param message UpdateMSPPermitsRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.UpdateMSPPermitsRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UpdateMSPPermitsRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UpdateMSPPermitsRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DeleteEnterpriseUsersRequest. */
  interface IDeleteEnterpriseUsersRequest {
    /** DeleteEnterpriseUsersRequest enterpriseUserIds */
    enterpriseUserIds?: (number | Long)[] | null;
  }

  /** Represents a DeleteEnterpriseUsersRequest. */
  class DeleteEnterpriseUsersRequest implements IDeleteEnterpriseUsersRequest {
    /**
     * Constructs a new DeleteEnterpriseUsersRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDeleteEnterpriseUsersRequest);

    /** DeleteEnterpriseUsersRequest enterpriseUserIds. */
    public enterpriseUserIds: (number | Long)[];

    /**
     * Creates a new DeleteEnterpriseUsersRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeleteEnterpriseUsersRequest instance
     */
    public static create(
      properties?: Enterprise.IDeleteEnterpriseUsersRequest,
    ): Enterprise.DeleteEnterpriseUsersRequest;

    /**
     * Encodes the specified DeleteEnterpriseUsersRequest message. Does not implicitly {@link Enterprise.DeleteEnterpriseUsersRequest.verify|verify} messages.
     * @param message DeleteEnterpriseUsersRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDeleteEnterpriseUsersRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DeleteEnterpriseUsersRequest message, length delimited. Does not implicitly {@link Enterprise.DeleteEnterpriseUsersRequest.verify|verify} messages.
     * @param message DeleteEnterpriseUsersRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDeleteEnterpriseUsersRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DeleteEnterpriseUsersRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeleteEnterpriseUsersRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DeleteEnterpriseUsersRequest;

    /**
     * Decodes a DeleteEnterpriseUsersRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeleteEnterpriseUsersRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DeleteEnterpriseUsersRequest;

    /**
     * Verifies a DeleteEnterpriseUsersRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DeleteEnterpriseUsersRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeleteEnterpriseUsersRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DeleteEnterpriseUsersRequest;

    /**
     * Creates a plain object from a DeleteEnterpriseUsersRequest message. Also converts values to other types if specified.
     * @param message DeleteEnterpriseUsersRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DeleteEnterpriseUsersRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DeleteEnterpriseUsersRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeleteEnterpriseUsersRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DeleteEnterpriseUserStatus. */
  interface IDeleteEnterpriseUserStatus {
    /** DeleteEnterpriseUserStatus enterpriseUserId */
    enterpriseUserId?: number | Long | null;

    /** DeleteEnterpriseUserStatus status */
    status?: Enterprise.DeleteEnterpriseUsersResult | null;
  }

  /** Represents a DeleteEnterpriseUserStatus. */
  class DeleteEnterpriseUserStatus implements IDeleteEnterpriseUserStatus {
    /**
     * Constructs a new DeleteEnterpriseUserStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDeleteEnterpriseUserStatus);

    /** DeleteEnterpriseUserStatus enterpriseUserId. */
    public enterpriseUserId: number | Long;

    /** DeleteEnterpriseUserStatus status. */
    public status: Enterprise.DeleteEnterpriseUsersResult;

    /**
     * Creates a new DeleteEnterpriseUserStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeleteEnterpriseUserStatus instance
     */
    public static create(
      properties?: Enterprise.IDeleteEnterpriseUserStatus,
    ): Enterprise.DeleteEnterpriseUserStatus;

    /**
     * Encodes the specified DeleteEnterpriseUserStatus message. Does not implicitly {@link Enterprise.DeleteEnterpriseUserStatus.verify|verify} messages.
     * @param message DeleteEnterpriseUserStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDeleteEnterpriseUserStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DeleteEnterpriseUserStatus message, length delimited. Does not implicitly {@link Enterprise.DeleteEnterpriseUserStatus.verify|verify} messages.
     * @param message DeleteEnterpriseUserStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDeleteEnterpriseUserStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DeleteEnterpriseUserStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeleteEnterpriseUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DeleteEnterpriseUserStatus;

    /**
     * Decodes a DeleteEnterpriseUserStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeleteEnterpriseUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DeleteEnterpriseUserStatus;

    /**
     * Verifies a DeleteEnterpriseUserStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DeleteEnterpriseUserStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeleteEnterpriseUserStatus
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.DeleteEnterpriseUserStatus;

    /**
     * Creates a plain object from a DeleteEnterpriseUserStatus message. Also converts values to other types if specified.
     * @param message DeleteEnterpriseUserStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DeleteEnterpriseUserStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DeleteEnterpriseUserStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeleteEnterpriseUserStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DeleteEnterpriseUsersResponse. */
  interface IDeleteEnterpriseUsersResponse {
    /** DeleteEnterpriseUsersResponse deleteStatus */
    deleteStatus?: Enterprise.IDeleteEnterpriseUserStatus[] | null;
  }

  /** Represents a DeleteEnterpriseUsersResponse. */
  class DeleteEnterpriseUsersResponse implements IDeleteEnterpriseUsersResponse {
    /**
     * Constructs a new DeleteEnterpriseUsersResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IDeleteEnterpriseUsersResponse);

    /** DeleteEnterpriseUsersResponse deleteStatus. */
    public deleteStatus: Enterprise.IDeleteEnterpriseUserStatus[];

    /**
     * Creates a new DeleteEnterpriseUsersResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeleteEnterpriseUsersResponse instance
     */
    public static create(
      properties?: Enterprise.IDeleteEnterpriseUsersResponse,
    ): Enterprise.DeleteEnterpriseUsersResponse;

    /**
     * Encodes the specified DeleteEnterpriseUsersResponse message. Does not implicitly {@link Enterprise.DeleteEnterpriseUsersResponse.verify|verify} messages.
     * @param message DeleteEnterpriseUsersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IDeleteEnterpriseUsersResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DeleteEnterpriseUsersResponse message, length delimited. Does not implicitly {@link Enterprise.DeleteEnterpriseUsersResponse.verify|verify} messages.
     * @param message DeleteEnterpriseUsersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IDeleteEnterpriseUsersResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DeleteEnterpriseUsersResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeleteEnterpriseUsersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.DeleteEnterpriseUsersResponse;

    /**
     * Decodes a DeleteEnterpriseUsersResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeleteEnterpriseUsersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.DeleteEnterpriseUsersResponse;

    /**
     * Verifies a DeleteEnterpriseUsersResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DeleteEnterpriseUsersResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeleteEnterpriseUsersResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Enterprise.DeleteEnterpriseUsersResponse;

    /**
     * Creates a plain object from a DeleteEnterpriseUsersResponse message. Also converts values to other types if specified.
     * @param message DeleteEnterpriseUsersResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.DeleteEnterpriseUsersResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DeleteEnterpriseUsersResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeleteEnterpriseUsersResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ClearSecurityDataRequest. */
  interface IClearSecurityDataRequest {
    /** ClearSecurityDataRequest enterpriseUserId */
    enterpriseUserId?: (number | Long)[] | null;

    /** ClearSecurityDataRequest allUsers */
    allUsers?: boolean | null;

    /** ClearSecurityDataRequest type */
    type?: Enterprise.ClearSecurityDataType | null;
  }

  /** Represents a ClearSecurityDataRequest. */
  class ClearSecurityDataRequest implements IClearSecurityDataRequest {
    /**
     * Constructs a new ClearSecurityDataRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Enterprise.IClearSecurityDataRequest);

    /** ClearSecurityDataRequest enterpriseUserId. */
    public enterpriseUserId: (number | Long)[];

    /** ClearSecurityDataRequest allUsers. */
    public allUsers: boolean;

    /** ClearSecurityDataRequest type. */
    public type: Enterprise.ClearSecurityDataType;

    /**
     * Creates a new ClearSecurityDataRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ClearSecurityDataRequest instance
     */
    public static create(
      properties?: Enterprise.IClearSecurityDataRequest,
    ): Enterprise.ClearSecurityDataRequest;

    /**
     * Encodes the specified ClearSecurityDataRequest message. Does not implicitly {@link Enterprise.ClearSecurityDataRequest.verify|verify} messages.
     * @param message ClearSecurityDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Enterprise.IClearSecurityDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ClearSecurityDataRequest message, length delimited. Does not implicitly {@link Enterprise.ClearSecurityDataRequest.verify|verify} messages.
     * @param message ClearSecurityDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Enterprise.IClearSecurityDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ClearSecurityDataRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ClearSecurityDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Enterprise.ClearSecurityDataRequest;

    /**
     * Decodes a ClearSecurityDataRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ClearSecurityDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Enterprise.ClearSecurityDataRequest;

    /**
     * Verifies a ClearSecurityDataRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ClearSecurityDataRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ClearSecurityDataRequest
     */
    public static fromObject(object: { [k: string]: any }): Enterprise.ClearSecurityDataRequest;

    /**
     * Creates a plain object from a ClearSecurityDataRequest message. Also converts values to other types if specified.
     * @param message ClearSecurityDataRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Enterprise.ClearSecurityDataRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ClearSecurityDataRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ClearSecurityDataRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
