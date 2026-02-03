// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace Records. */
export namespace Records {
  /** RecordTypeScope enum. */
  enum RecordTypeScope {
    RT_STANDARD = 0,
    RT_USER = 1,
    RT_ENTERPRISE = 2,
    RT_PAM = 3,
    RT_PAM_CONFIGURATION = 4,
  }

  /** RecordKeyType enum. */
  enum RecordKeyType {
    NO_KEY = 0,
    ENCRYPTED_BY_DATA_KEY = 1,
    ENCRYPTED_BY_PUBLIC_KEY = 2,
    ENCRYPTED_BY_DATA_KEY_GCM = 3,
    ENCRYPTED_BY_PUBLIC_KEY_ECC = 4,
    ENCRYPTED_BY_ROOT_KEY_CBC = 5,
    ENCRYPTED_BY_ROOT_KEY_GCM = 6,
  }

  /** RecordFolderType enum. */
  enum RecordFolderType {
    user_folder = 0,
    shared_folder = 1,
    shared_folder_folder = 2,
  }

  /** RecordModifyResult enum. */
  enum RecordModifyResult {
    RS_SUCCESS = 0,
    RS_OUT_OF_SYNC = 1,
    RS_ACCESS_DENIED = 2,
    RS_SHARE_DENIED = 3,
    RS_RECORD_EXISTS = 4,
    RS_OLD_RECORD_VERSION_TYPE = 5,
    RS_NEW_RECORD_VERSION_TYPE = 6,
    RS_FILES_NOT_MATCH = 7,
    RS_RECORD_NOT_SHAREABLE = 8,
    RS_ATTACHMENT_NOT_SHAREABLE = 9,
    RS_FILE_LIMIT_REACHED = 10,
    RS_SIZE_EXCEEDED_LIMIT = 11,
    RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS = 12,
  }

  /** FileAddResult enum. */
  enum FileAddResult {
    FA_SUCCESS = 0,
    FA_ERROR = 1,
  }

  /** FileGetResult enum. */
  enum FileGetResult {
    FG_SUCCESS = 0,
    FG_ERROR = 1,
    FG_ACCESS_DENIED = 2,
  }

  /** RecordDetailsInclude enum. */
  enum RecordDetailsInclude {
    DATA_PLUS_SHARE = 0,
    DATA_ONLY = 1,
    SHARE_ONLY = 2,
  }

  /** CheckShareAdminObjectType enum. */
  enum CheckShareAdminObjectType {
    CHECK_SA_INVALID_TYPE = 0,
    CHECK_SA_ON_SF = 1,
    CHECK_SA_ON_RECORD = 2,
  }

  /** ShareStatus enum. */
  enum ShareStatus {
    ACTIVE = 0,
    BLOCK = 1,
    INVITED = 2,
  }

  /** RecordTransactionType enum. */
  enum RecordTransactionType {
    RTT_GENERAL = 0,
    RTT_ROTATION = 1,
  }

  /** TimeLimitedAccessType enum. */
  enum TimeLimitedAccessType {
    INVALID_TIME_LIMITED_ACCESS_TYPE = 0,
    USER_ACCESS_TO_RECORD = 1,
    USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER = 2,
    RECORD_ACCESS_TO_SHAREDFOLDER = 3,
    USER_ACCESS_TO_SHAREDFOLDER = 4,
    TEAM_ACCESS_TO_SHAREDFOLDER = 5,
  }

  /** TimerNotificationType enum. */
  enum TimerNotificationType {
    NOTIFICATION_OFF = 0,
    NOTIFY_OWNER = 1,
    NOTIFY_PRIVILEGED_USERS = 2,
  }

  /** Properties of a RecordType. */
  interface IRecordType {
    /** RecordType recordTypeId */
    recordTypeId?: number | null;

    /** RecordType content */
    content?: string | null;

    /** RecordType scope */
    scope?: Records.RecordTypeScope | null;
  }

  /** Represents a RecordType. */
  class RecordType implements IRecordType {
    /**
     * Constructs a new RecordType.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordType);

    /** RecordType recordTypeId. */
    public recordTypeId: number;

    /** RecordType content. */
    public content: string;

    /** RecordType scope. */
    public scope: Records.RecordTypeScope;

    /**
     * Creates a new RecordType instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordType instance
     */
    public static create(properties?: Records.IRecordType): Records.RecordType;

    /**
     * Encodes the specified RecordType message. Does not implicitly {@link Records.RecordType.verify|verify} messages.
     * @param message RecordType message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IRecordType, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RecordType message, length delimited. Does not implicitly {@link Records.RecordType.verify|verify} messages.
     * @param message RecordType message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordType,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordType message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordType
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordType;

    /**
     * Decodes a RecordType message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordType
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordType;

    /**
     * Verifies a RecordType message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordType message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordType
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordType;

    /**
     * Creates a plain object from a RecordType message. Also converts values to other types if specified.
     * @param message RecordType
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordType,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordType to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordType
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordTypesRequest. */
  interface IRecordTypesRequest {
    /** RecordTypesRequest standard */
    standard?: boolean | null;

    /** RecordTypesRequest user */
    user?: boolean | null;

    /** RecordTypesRequest enterprise */
    enterprise?: boolean | null;

    /** RecordTypesRequest pam */
    pam?: boolean | null;
  }

  /** Represents a RecordTypesRequest. */
  class RecordTypesRequest implements IRecordTypesRequest {
    /**
     * Constructs a new RecordTypesRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordTypesRequest);

    /** RecordTypesRequest standard. */
    public standard: boolean;

    /** RecordTypesRequest user. */
    public user: boolean;

    /** RecordTypesRequest enterprise. */
    public enterprise: boolean;

    /** RecordTypesRequest pam. */
    public pam: boolean;

    /**
     * Creates a new RecordTypesRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordTypesRequest instance
     */
    public static create(properties?: Records.IRecordTypesRequest): Records.RecordTypesRequest;

    /**
     * Encodes the specified RecordTypesRequest message. Does not implicitly {@link Records.RecordTypesRequest.verify|verify} messages.
     * @param message RecordTypesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordTypesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordTypesRequest message, length delimited. Does not implicitly {@link Records.RecordTypesRequest.verify|verify} messages.
     * @param message RecordTypesRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordTypesRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordTypesRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordTypesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordTypesRequest;

    /**
     * Decodes a RecordTypesRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordTypesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordTypesRequest;

    /**
     * Verifies a RecordTypesRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordTypesRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordTypesRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordTypesRequest;

    /**
     * Creates a plain object from a RecordTypesRequest message. Also converts values to other types if specified.
     * @param message RecordTypesRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordTypesRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordTypesRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordTypesRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordTypesResponse. */
  interface IRecordTypesResponse {
    /** RecordTypesResponse recordTypes */
    recordTypes?: Records.IRecordType[] | null;

    /** RecordTypesResponse standardCounter */
    standardCounter?: number | null;

    /** RecordTypesResponse userCounter */
    userCounter?: number | null;

    /** RecordTypesResponse enterpriseCounter */
    enterpriseCounter?: number | null;

    /** RecordTypesResponse pamCounter */
    pamCounter?: number | null;
  }

  /** Represents a RecordTypesResponse. */
  class RecordTypesResponse implements IRecordTypesResponse {
    /**
     * Constructs a new RecordTypesResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordTypesResponse);

    /** RecordTypesResponse recordTypes. */
    public recordTypes: Records.IRecordType[];

    /** RecordTypesResponse standardCounter. */
    public standardCounter: number;

    /** RecordTypesResponse userCounter. */
    public userCounter: number;

    /** RecordTypesResponse enterpriseCounter. */
    public enterpriseCounter: number;

    /** RecordTypesResponse pamCounter. */
    public pamCounter: number;

    /**
     * Creates a new RecordTypesResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordTypesResponse instance
     */
    public static create(properties?: Records.IRecordTypesResponse): Records.RecordTypesResponse;

    /**
     * Encodes the specified RecordTypesResponse message. Does not implicitly {@link Records.RecordTypesResponse.verify|verify} messages.
     * @param message RecordTypesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordTypesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordTypesResponse message, length delimited. Does not implicitly {@link Records.RecordTypesResponse.verify|verify} messages.
     * @param message RecordTypesResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordTypesResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordTypesResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordTypesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordTypesResponse;

    /**
     * Decodes a RecordTypesResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordTypesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordTypesResponse;

    /**
     * Verifies a RecordTypesResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordTypesResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordTypesResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordTypesResponse;

    /**
     * Creates a plain object from a RecordTypesResponse message. Also converts values to other types if specified.
     * @param message RecordTypesResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordTypesResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordTypesResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordTypesResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordTypeModifyResponse. */
  interface IRecordTypeModifyResponse {
    /** RecordTypeModifyResponse recordTypeId */
    recordTypeId?: number | null;

    /** RecordTypeModifyResponse counter */
    counter?: number | null;
  }

  /** Represents a RecordTypeModifyResponse. */
  class RecordTypeModifyResponse implements IRecordTypeModifyResponse {
    /**
     * Constructs a new RecordTypeModifyResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordTypeModifyResponse);

    /** RecordTypeModifyResponse recordTypeId. */
    public recordTypeId: number;

    /** RecordTypeModifyResponse counter. */
    public counter: number;

    /**
     * Creates a new RecordTypeModifyResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordTypeModifyResponse instance
     */
    public static create(
      properties?: Records.IRecordTypeModifyResponse,
    ): Records.RecordTypeModifyResponse;

    /**
     * Encodes the specified RecordTypeModifyResponse message. Does not implicitly {@link Records.RecordTypeModifyResponse.verify|verify} messages.
     * @param message RecordTypeModifyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordTypeModifyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordTypeModifyResponse message, length delimited. Does not implicitly {@link Records.RecordTypeModifyResponse.verify|verify} messages.
     * @param message RecordTypeModifyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordTypeModifyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordTypeModifyResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordTypeModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordTypeModifyResponse;

    /**
     * Decodes a RecordTypeModifyResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordTypeModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordTypeModifyResponse;

    /**
     * Verifies a RecordTypeModifyResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordTypeModifyResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordTypeModifyResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordTypeModifyResponse;

    /**
     * Creates a plain object from a RecordTypeModifyResponse message. Also converts values to other types if specified.
     * @param message RecordTypeModifyResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordTypeModifyResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordTypeModifyResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordTypeModifyResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsGetRequest. */
  interface IRecordsGetRequest {
    /** RecordsGetRequest recordUids */
    recordUids?: Uint8Array[] | null;

    /** RecordsGetRequest clientTime */
    clientTime?: number | Long | null;
  }

  /** Represents a RecordsGetRequest. */
  class RecordsGetRequest implements IRecordsGetRequest {
    /**
     * Constructs a new RecordsGetRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsGetRequest);

    /** RecordsGetRequest recordUids. */
    public recordUids: Uint8Array[];

    /** RecordsGetRequest clientTime. */
    public clientTime: number | Long;

    /**
     * Creates a new RecordsGetRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsGetRequest instance
     */
    public static create(properties?: Records.IRecordsGetRequest): Records.RecordsGetRequest;

    /**
     * Encodes the specified RecordsGetRequest message. Does not implicitly {@link Records.RecordsGetRequest.verify|verify} messages.
     * @param message RecordsGetRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsGetRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsGetRequest message, length delimited. Does not implicitly {@link Records.RecordsGetRequest.verify|verify} messages.
     * @param message RecordsGetRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsGetRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsGetRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsGetRequest;

    /**
     * Decodes a RecordsGetRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordsGetRequest;

    /**
     * Verifies a RecordsGetRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsGetRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsGetRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsGetRequest;

    /**
     * Creates a plain object from a RecordsGetRequest message. Also converts values to other types if specified.
     * @param message RecordsGetRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsGetRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsGetRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsGetRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Record. */
  interface IRecord {
    /** Record recordUid */
    recordUid?: Uint8Array | null;

    /** Record recordKey */
    recordKey?: Uint8Array | null;

    /** Record recordKeyType */
    recordKeyType?: Records.RecordKeyType | null;

    /** Record data */
    data?: Uint8Array | null;

    /** Record extra */
    extra?: Uint8Array | null;

    /** Record version */
    version?: number | null;

    /** Record clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** Record revision */
    revision?: number | Long | null;

    /** Record fileIds */
    fileIds?: Uint8Array[] | null;
  }

  /** Represents a Record. */
  class Record implements IRecord {
    /**
     * Constructs a new Record.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecord);

    /** Record recordUid. */
    public recordUid: Uint8Array;

    /** Record recordKey. */
    public recordKey: Uint8Array;

    /** Record recordKeyType. */
    public recordKeyType: Records.RecordKeyType;

    /** Record data. */
    public data: Uint8Array;

    /** Record extra. */
    public extra: Uint8Array;

    /** Record version. */
    public version: number;

    /** Record clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** Record revision. */
    public revision: number | Long;

    /** Record fileIds. */
    public fileIds: Uint8Array[];

    /**
     * Creates a new Record instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Record instance
     */
    public static create(properties?: Records.IRecord): Records.Record;

    /**
     * Encodes the specified Record message. Does not implicitly {@link Records.Record.verify|verify} messages.
     * @param message Record message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Record message, length delimited. Does not implicitly {@link Records.Record.verify|verify} messages.
     * @param message Record message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Record message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.Record;

    /**
     * Decodes a Record message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.Record;

    /**
     * Verifies a Record message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Record message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Record
     */
    public static fromObject(object: { [k: string]: any }): Records.Record;

    /**
     * Creates a plain object from a Record message. Also converts values to other types if specified.
     * @param message Record
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.Record,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Record to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Record
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FolderRecordKey. */
  interface IFolderRecordKey {
    /** FolderRecordKey folderUid */
    folderUid?: Uint8Array | null;

    /** FolderRecordKey recordUid */
    recordUid?: Uint8Array | null;

    /** FolderRecordKey recordKey */
    recordKey?: Uint8Array | null;
  }

  /** Represents a FolderRecordKey. */
  class FolderRecordKey implements IFolderRecordKey {
    /**
     * Constructs a new FolderRecordKey.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFolderRecordKey);

    /** FolderRecordKey folderUid. */
    public folderUid: Uint8Array;

    /** FolderRecordKey recordUid. */
    public recordUid: Uint8Array;

    /** FolderRecordKey recordKey. */
    public recordKey: Uint8Array;

    /**
     * Creates a new FolderRecordKey instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FolderRecordKey instance
     */
    public static create(properties?: Records.IFolderRecordKey): Records.FolderRecordKey;

    /**
     * Encodes the specified FolderRecordKey message. Does not implicitly {@link Records.FolderRecordKey.verify|verify} messages.
     * @param message FolderRecordKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFolderRecordKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FolderRecordKey message, length delimited. Does not implicitly {@link Records.FolderRecordKey.verify|verify} messages.
     * @param message FolderRecordKey message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFolderRecordKey,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FolderRecordKey message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FolderRecordKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FolderRecordKey;

    /**
     * Decodes a FolderRecordKey message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FolderRecordKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FolderRecordKey;

    /**
     * Verifies a FolderRecordKey message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FolderRecordKey message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FolderRecordKey
     */
    public static fromObject(object: { [k: string]: any }): Records.FolderRecordKey;

    /**
     * Creates a plain object from a FolderRecordKey message. Also converts values to other types if specified.
     * @param message FolderRecordKey
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FolderRecordKey,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FolderRecordKey to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FolderRecordKey
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Folder. */
  interface IFolder {
    /** Folder folderUid */
    folderUid?: Uint8Array | null;

    /** Folder folderKey */
    folderKey?: Uint8Array | null;

    /** Folder folderKeyType */
    folderKeyType?: Records.RecordKeyType | null;
  }

  /** Represents a Folder. */
  class Folder implements IFolder {
    /**
     * Constructs a new Folder.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFolder);

    /** Folder folderUid. */
    public folderUid: Uint8Array;

    /** Folder folderKey. */
    public folderKey: Uint8Array;

    /** Folder folderKeyType. */
    public folderKeyType: Records.RecordKeyType;

    /**
     * Creates a new Folder instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Folder instance
     */
    public static create(properties?: Records.IFolder): Records.Folder;

    /**
     * Encodes the specified Folder message. Does not implicitly {@link Records.Folder.verify|verify} messages.
     * @param message Folder message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IFolder, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Folder message, length delimited. Does not implicitly {@link Records.Folder.verify|verify} messages.
     * @param message Folder message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFolder,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Folder message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Folder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.Folder;

    /**
     * Decodes a Folder message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Folder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.Folder;

    /**
     * Verifies a Folder message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Folder message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Folder
     */
    public static fromObject(object: { [k: string]: any }): Records.Folder;

    /**
     * Creates a plain object from a Folder message. Also converts values to other types if specified.
     * @param message Folder
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.Folder,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Folder to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Folder
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Team. */
  interface ITeam {
    /** Team teamUid */
    teamUid?: Uint8Array | null;

    /** Team teamKey */
    teamKey?: Uint8Array | null;

    /** Team teamPrivateKey */
    teamPrivateKey?: Uint8Array | null;

    /** Team teamKeyType */
    teamKeyType?: Records.RecordKeyType | null;

    /** Team folders */
    folders?: Records.IFolder[] | null;
  }

  /** Represents a Team. */
  class Team implements ITeam {
    /**
     * Constructs a new Team.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITeam);

    /** Team teamUid. */
    public teamUid: Uint8Array;

    /** Team teamKey. */
    public teamKey: Uint8Array;

    /** Team teamPrivateKey. */
    public teamPrivateKey: Uint8Array;

    /** Team teamKeyType. */
    public teamKeyType: Records.RecordKeyType;

    /** Team folders. */
    public folders: Records.IFolder[];

    /**
     * Creates a new Team instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Team instance
     */
    public static create(properties?: Records.ITeam): Records.Team;

    /**
     * Encodes the specified Team message. Does not implicitly {@link Records.Team.verify|verify} messages.
     * @param message Team message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.ITeam, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Team message, length delimited. Does not implicitly {@link Records.Team.verify|verify} messages.
     * @param message Team message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITeam,
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
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.Team;

    /**
     * Decodes a Team message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Team
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.Team;

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
    public static fromObject(object: { [k: string]: any }): Records.Team;

    /**
     * Creates a plain object from a Team message. Also converts values to other types if specified.
     * @param message Team
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.Team,
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

  /** Properties of a RecordsGetResponse. */
  interface IRecordsGetResponse {
    /** RecordsGetResponse records */
    records?: Records.IRecord[] | null;

    /** RecordsGetResponse folderRecordKeys */
    folderRecordKeys?: Records.IFolderRecordKey[] | null;

    /** RecordsGetResponse folders */
    folders?: Records.IFolder[] | null;

    /** RecordsGetResponse teams */
    teams?: Records.ITeam[] | null;
  }

  /** Represents a RecordsGetResponse. */
  class RecordsGetResponse implements IRecordsGetResponse {
    /**
     * Constructs a new RecordsGetResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsGetResponse);

    /** RecordsGetResponse records. */
    public records: Records.IRecord[];

    /** RecordsGetResponse folderRecordKeys. */
    public folderRecordKeys: Records.IFolderRecordKey[];

    /** RecordsGetResponse folders. */
    public folders: Records.IFolder[];

    /** RecordsGetResponse teams. */
    public teams: Records.ITeam[];

    /**
     * Creates a new RecordsGetResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsGetResponse instance
     */
    public static create(properties?: Records.IRecordsGetResponse): Records.RecordsGetResponse;

    /**
     * Encodes the specified RecordsGetResponse message. Does not implicitly {@link Records.RecordsGetResponse.verify|verify} messages.
     * @param message RecordsGetResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsGetResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsGetResponse message, length delimited. Does not implicitly {@link Records.RecordsGetResponse.verify|verify} messages.
     * @param message RecordsGetResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsGetResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsGetResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsGetResponse;

    /**
     * Decodes a RecordsGetResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsGetResponse;

    /**
     * Verifies a RecordsGetResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsGetResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsGetResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsGetResponse;

    /**
     * Creates a plain object from a RecordsGetResponse message. Also converts values to other types if specified.
     * @param message RecordsGetResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsGetResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsGetResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsGetResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordLink. */
  interface IRecordLink {
    /** RecordLink recordUid */
    recordUid?: Uint8Array | null;

    /** RecordLink recordKey */
    recordKey?: Uint8Array | null;
  }

  /** Represents a RecordLink. */
  class RecordLink implements IRecordLink {
    /**
     * Constructs a new RecordLink.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordLink);

    /** RecordLink recordUid. */
    public recordUid: Uint8Array;

    /** RecordLink recordKey. */
    public recordKey: Uint8Array;

    /**
     * Creates a new RecordLink instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordLink instance
     */
    public static create(properties?: Records.IRecordLink): Records.RecordLink;

    /**
     * Encodes the specified RecordLink message. Does not implicitly {@link Records.RecordLink.verify|verify} messages.
     * @param message RecordLink message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IRecordLink, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RecordLink message, length delimited. Does not implicitly {@link Records.RecordLink.verify|verify} messages.
     * @param message RecordLink message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordLink,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordLink message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordLink
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordLink;

    /**
     * Decodes a RecordLink message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordLink
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordLink;

    /**
     * Verifies a RecordLink message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordLink message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordLink
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordLink;

    /**
     * Creates a plain object from a RecordLink message. Also converts values to other types if specified.
     * @param message RecordLink
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordLink,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordLink to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordLink
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordAudit. */
  interface IRecordAudit {
    /** RecordAudit version */
    version?: number | null;

    /** RecordAudit data */
    data?: Uint8Array | null;
  }

  /** Represents a RecordAudit. */
  class RecordAudit implements IRecordAudit {
    /**
     * Constructs a new RecordAudit.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordAudit);

    /** RecordAudit version. */
    public version: number;

    /** RecordAudit data. */
    public data: Uint8Array;

    /**
     * Creates a new RecordAudit instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordAudit instance
     */
    public static create(properties?: Records.IRecordAudit): Records.RecordAudit;

    /**
     * Encodes the specified RecordAudit message. Does not implicitly {@link Records.RecordAudit.verify|verify} messages.
     * @param message RecordAudit message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordAudit,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordAudit message, length delimited. Does not implicitly {@link Records.RecordAudit.verify|verify} messages.
     * @param message RecordAudit message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordAudit,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordAudit message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordAudit
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordAudit;

    /**
     * Decodes a RecordAudit message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordAudit
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordAudit;

    /**
     * Verifies a RecordAudit message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordAudit message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordAudit
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordAudit;

    /**
     * Creates a plain object from a RecordAudit message. Also converts values to other types if specified.
     * @param message RecordAudit
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordAudit,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordAudit to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordAudit
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SecurityData. */
  interface ISecurityData {
    /** SecurityData data */
    data?: Uint8Array | null;
  }

  /** Represents a SecurityData. */
  class SecurityData implements ISecurityData {
    /**
     * Constructs a new SecurityData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ISecurityData);

    /** SecurityData data. */
    public data: Uint8Array;

    /**
     * Creates a new SecurityData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SecurityData instance
     */
    public static create(properties?: Records.ISecurityData): Records.SecurityData;

    /**
     * Encodes the specified SecurityData message. Does not implicitly {@link Records.SecurityData.verify|verify} messages.
     * @param message SecurityData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ISecurityData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SecurityData message, length delimited. Does not implicitly {@link Records.SecurityData.verify|verify} messages.
     * @param message SecurityData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ISecurityData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SecurityData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SecurityData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.SecurityData;

    /**
     * Decodes a SecurityData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SecurityData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.SecurityData;

    /**
     * Verifies a SecurityData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SecurityData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SecurityData
     */
    public static fromObject(object: { [k: string]: any }): Records.SecurityData;

    /**
     * Creates a plain object from a SecurityData message. Also converts values to other types if specified.
     * @param message SecurityData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.SecurityData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SecurityData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SecurityData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SecurityScoreData. */
  interface ISecurityScoreData {
    /** SecurityScoreData data */
    data?: Uint8Array | null;
  }

  /** Represents a SecurityScoreData. */
  class SecurityScoreData implements ISecurityScoreData {
    /**
     * Constructs a new SecurityScoreData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ISecurityScoreData);

    /** SecurityScoreData data. */
    public data: Uint8Array;

    /**
     * Creates a new SecurityScoreData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SecurityScoreData instance
     */
    public static create(properties?: Records.ISecurityScoreData): Records.SecurityScoreData;

    /**
     * Encodes the specified SecurityScoreData message. Does not implicitly {@link Records.SecurityScoreData.verify|verify} messages.
     * @param message SecurityScoreData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ISecurityScoreData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SecurityScoreData message, length delimited. Does not implicitly {@link Records.SecurityScoreData.verify|verify} messages.
     * @param message SecurityScoreData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ISecurityScoreData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SecurityScoreData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SecurityScoreData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.SecurityScoreData;

    /**
     * Decodes a SecurityScoreData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SecurityScoreData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.SecurityScoreData;

    /**
     * Verifies a SecurityScoreData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SecurityScoreData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SecurityScoreData
     */
    public static fromObject(object: { [k: string]: any }): Records.SecurityScoreData;

    /**
     * Creates a plain object from a SecurityScoreData message. Also converts values to other types if specified.
     * @param message SecurityScoreData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.SecurityScoreData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SecurityScoreData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SecurityScoreData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordAdd. */
  interface IRecordAdd {
    /** RecordAdd recordUid */
    recordUid?: Uint8Array | null;

    /** RecordAdd recordKey */
    recordKey?: Uint8Array | null;

    /** RecordAdd clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** RecordAdd data */
    data?: Uint8Array | null;

    /** RecordAdd nonSharedData */
    nonSharedData?: Uint8Array | null;

    /** RecordAdd folderType */
    folderType?: Records.RecordFolderType | null;

    /** RecordAdd folderUid */
    folderUid?: Uint8Array | null;

    /** RecordAdd folderKey */
    folderKey?: Uint8Array | null;

    /** RecordAdd recordLinks */
    recordLinks?: Records.IRecordLink[] | null;

    /** RecordAdd audit */
    audit?: Records.IRecordAudit | null;

    /** RecordAdd securityData */
    securityData?: Records.ISecurityData | null;

    /** RecordAdd securityScoreData */
    securityScoreData?: Records.ISecurityScoreData | null;
  }

  /** Represents a RecordAdd. */
  class RecordAdd implements IRecordAdd {
    /**
     * Constructs a new RecordAdd.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordAdd);

    /** RecordAdd recordUid. */
    public recordUid: Uint8Array;

    /** RecordAdd recordKey. */
    public recordKey: Uint8Array;

    /** RecordAdd clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** RecordAdd data. */
    public data: Uint8Array;

    /** RecordAdd nonSharedData. */
    public nonSharedData: Uint8Array;

    /** RecordAdd folderType. */
    public folderType: Records.RecordFolderType;

    /** RecordAdd folderUid. */
    public folderUid: Uint8Array;

    /** RecordAdd folderKey. */
    public folderKey: Uint8Array;

    /** RecordAdd recordLinks. */
    public recordLinks: Records.IRecordLink[];

    /** RecordAdd audit. */
    public audit?: Records.IRecordAudit | null;

    /** RecordAdd securityData. */
    public securityData?: Records.ISecurityData | null;

    /** RecordAdd securityScoreData. */
    public securityScoreData?: Records.ISecurityScoreData | null;

    /**
     * Creates a new RecordAdd instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordAdd instance
     */
    public static create(properties?: Records.IRecordAdd): Records.RecordAdd;

    /**
     * Encodes the specified RecordAdd message. Does not implicitly {@link Records.RecordAdd.verify|verify} messages.
     * @param message RecordAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IRecordAdd, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RecordAdd message, length delimited. Does not implicitly {@link Records.RecordAdd.verify|verify} messages.
     * @param message RecordAdd message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordAdd,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordAdd message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.RecordAdd;

    /**
     * Decodes a RecordAdd message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordAdd;

    /**
     * Verifies a RecordAdd message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordAdd message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordAdd
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordAdd;

    /**
     * Creates a plain object from a RecordAdd message. Also converts values to other types if specified.
     * @param message RecordAdd
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordAdd,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordAdd to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordAdd
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsAddRequest. */
  interface IRecordsAddRequest {
    /** RecordsAddRequest records */
    records?: Records.IRecordAdd[] | null;

    /** RecordsAddRequest clientTime */
    clientTime?: number | Long | null;

    /** RecordsAddRequest securityDataKeyType */
    securityDataKeyType?: Records.RecordKeyType | null;
  }

  /** Represents a RecordsAddRequest. */
  class RecordsAddRequest implements IRecordsAddRequest {
    /**
     * Constructs a new RecordsAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsAddRequest);

    /** RecordsAddRequest records. */
    public records: Records.IRecordAdd[];

    /** RecordsAddRequest clientTime. */
    public clientTime: number | Long;

    /** RecordsAddRequest securityDataKeyType. */
    public securityDataKeyType: Records.RecordKeyType;

    /**
     * Creates a new RecordsAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsAddRequest instance
     */
    public static create(properties?: Records.IRecordsAddRequest): Records.RecordsAddRequest;

    /**
     * Encodes the specified RecordsAddRequest message. Does not implicitly {@link Records.RecordsAddRequest.verify|verify} messages.
     * @param message RecordsAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsAddRequest message, length delimited. Does not implicitly {@link Records.RecordsAddRequest.verify|verify} messages.
     * @param message RecordsAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsAddRequest;

    /**
     * Decodes a RecordsAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordsAddRequest;

    /**
     * Verifies a RecordsAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsAddRequest;

    /**
     * Creates a plain object from a RecordsAddRequest message. Also converts values to other types if specified.
     * @param message RecordsAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordUpdate. */
  interface IRecordUpdate {
    /** RecordUpdate recordUid */
    recordUid?: Uint8Array | null;

    /** RecordUpdate clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** RecordUpdate revision */
    revision?: number | Long | null;

    /** RecordUpdate data */
    data?: Uint8Array | null;

    /** RecordUpdate nonSharedData */
    nonSharedData?: Uint8Array | null;

    /** RecordUpdate recordLinksAdd */
    recordLinksAdd?: Records.IRecordLink[] | null;

    /** RecordUpdate recordLinksRemove */
    recordLinksRemove?: Uint8Array[] | null;

    /** RecordUpdate audit */
    audit?: Records.IRecordAudit | null;

    /** RecordUpdate securityData */
    securityData?: Records.ISecurityData | null;

    /** RecordUpdate securityScoreData */
    securityScoreData?: Records.ISecurityScoreData | null;
  }

  /** Represents a RecordUpdate. */
  class RecordUpdate implements IRecordUpdate {
    /**
     * Constructs a new RecordUpdate.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordUpdate);

    /** RecordUpdate recordUid. */
    public recordUid: Uint8Array;

    /** RecordUpdate clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** RecordUpdate revision. */
    public revision: number | Long;

    /** RecordUpdate data. */
    public data: Uint8Array;

    /** RecordUpdate nonSharedData. */
    public nonSharedData: Uint8Array;

    /** RecordUpdate recordLinksAdd. */
    public recordLinksAdd: Records.IRecordLink[];

    /** RecordUpdate recordLinksRemove. */
    public recordLinksRemove: Uint8Array[];

    /** RecordUpdate audit. */
    public audit?: Records.IRecordAudit | null;

    /** RecordUpdate securityData. */
    public securityData?: Records.ISecurityData | null;

    /** RecordUpdate securityScoreData. */
    public securityScoreData?: Records.ISecurityScoreData | null;

    /**
     * Creates a new RecordUpdate instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordUpdate instance
     */
    public static create(properties?: Records.IRecordUpdate): Records.RecordUpdate;

    /**
     * Encodes the specified RecordUpdate message. Does not implicitly {@link Records.RecordUpdate.verify|verify} messages.
     * @param message RecordUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordUpdate message, length delimited. Does not implicitly {@link Records.RecordUpdate.verify|verify} messages.
     * @param message RecordUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordUpdate message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordUpdate;

    /**
     * Decodes a RecordUpdate message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordUpdate;

    /**
     * Verifies a RecordUpdate message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordUpdate message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordUpdate
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordUpdate;

    /**
     * Creates a plain object from a RecordUpdate message. Also converts values to other types if specified.
     * @param message RecordUpdate
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordUpdate,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordUpdate to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordUpdate
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUpdateRequest. */
  interface IRecordsUpdateRequest {
    /** RecordsUpdateRequest records */
    records?: Records.IRecordUpdate[] | null;

    /** RecordsUpdateRequest clientTime */
    clientTime?: number | Long | null;

    /** RecordsUpdateRequest securityDataKeyType */
    securityDataKeyType?: Records.RecordKeyType | null;
  }

  /** Represents a RecordsUpdateRequest. */
  class RecordsUpdateRequest implements IRecordsUpdateRequest {
    /**
     * Constructs a new RecordsUpdateRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUpdateRequest);

    /** RecordsUpdateRequest records. */
    public records: Records.IRecordUpdate[];

    /** RecordsUpdateRequest clientTime. */
    public clientTime: number | Long;

    /** RecordsUpdateRequest securityDataKeyType. */
    public securityDataKeyType: Records.RecordKeyType;

    /**
     * Creates a new RecordsUpdateRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUpdateRequest instance
     */
    public static create(properties?: Records.IRecordsUpdateRequest): Records.RecordsUpdateRequest;

    /**
     * Encodes the specified RecordsUpdateRequest message. Does not implicitly {@link Records.RecordsUpdateRequest.verify|verify} messages.
     * @param message RecordsUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUpdateRequest message, length delimited. Does not implicitly {@link Records.RecordsUpdateRequest.verify|verify} messages.
     * @param message RecordsUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUpdateRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUpdateRequest;

    /**
     * Decodes a RecordsUpdateRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUpdateRequest;

    /**
     * Verifies a RecordsUpdateRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUpdateRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUpdateRequest;

    /**
     * Creates a plain object from a RecordsUpdateRequest message. Also converts values to other types if specified.
     * @param message RecordsUpdateRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUpdateRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUpdateRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUpdateRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordFileForConversion. */
  interface IRecordFileForConversion {
    /** RecordFileForConversion recordUid */
    recordUid?: Uint8Array | null;

    /** RecordFileForConversion fileFileId */
    fileFileId?: string | null;

    /** RecordFileForConversion thumbFileId */
    thumbFileId?: string | null;

    /** RecordFileForConversion data */
    data?: Uint8Array | null;

    /** RecordFileForConversion recordKey */
    recordKey?: Uint8Array | null;

    /** RecordFileForConversion linkKey */
    linkKey?: Uint8Array | null;
  }

  /** Represents a RecordFileForConversion. */
  class RecordFileForConversion implements IRecordFileForConversion {
    /**
     * Constructs a new RecordFileForConversion.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordFileForConversion);

    /** RecordFileForConversion recordUid. */
    public recordUid: Uint8Array;

    /** RecordFileForConversion fileFileId. */
    public fileFileId: string;

    /** RecordFileForConversion thumbFileId. */
    public thumbFileId: string;

    /** RecordFileForConversion data. */
    public data: Uint8Array;

    /** RecordFileForConversion recordKey. */
    public recordKey: Uint8Array;

    /** RecordFileForConversion linkKey. */
    public linkKey: Uint8Array;

    /**
     * Creates a new RecordFileForConversion instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordFileForConversion instance
     */
    public static create(
      properties?: Records.IRecordFileForConversion,
    ): Records.RecordFileForConversion;

    /**
     * Encodes the specified RecordFileForConversion message. Does not implicitly {@link Records.RecordFileForConversion.verify|verify} messages.
     * @param message RecordFileForConversion message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordFileForConversion,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordFileForConversion message, length delimited. Does not implicitly {@link Records.RecordFileForConversion.verify|verify} messages.
     * @param message RecordFileForConversion message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordFileForConversion,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordFileForConversion message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordFileForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordFileForConversion;

    /**
     * Decodes a RecordFileForConversion message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordFileForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordFileForConversion;

    /**
     * Verifies a RecordFileForConversion message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordFileForConversion message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordFileForConversion
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordFileForConversion;

    /**
     * Creates a plain object from a RecordFileForConversion message. Also converts values to other types if specified.
     * @param message RecordFileForConversion
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordFileForConversion,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordFileForConversion to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordFileForConversion
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordFolderForConversion. */
  interface IRecordFolderForConversion {
    /** RecordFolderForConversion folderUid */
    folderUid?: Uint8Array | null;

    /** RecordFolderForConversion recordFolderKey */
    recordFolderKey?: Uint8Array | null;
  }

  /** Represents a RecordFolderForConversion. */
  class RecordFolderForConversion implements IRecordFolderForConversion {
    /**
     * Constructs a new RecordFolderForConversion.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordFolderForConversion);

    /** RecordFolderForConversion folderUid. */
    public folderUid: Uint8Array;

    /** RecordFolderForConversion recordFolderKey. */
    public recordFolderKey: Uint8Array;

    /**
     * Creates a new RecordFolderForConversion instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordFolderForConversion instance
     */
    public static create(
      properties?: Records.IRecordFolderForConversion,
    ): Records.RecordFolderForConversion;

    /**
     * Encodes the specified RecordFolderForConversion message. Does not implicitly {@link Records.RecordFolderForConversion.verify|verify} messages.
     * @param message RecordFolderForConversion message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordFolderForConversion,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordFolderForConversion message, length delimited. Does not implicitly {@link Records.RecordFolderForConversion.verify|verify} messages.
     * @param message RecordFolderForConversion message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordFolderForConversion,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordFolderForConversion message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordFolderForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordFolderForConversion;

    /**
     * Decodes a RecordFolderForConversion message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordFolderForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordFolderForConversion;

    /**
     * Verifies a RecordFolderForConversion message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordFolderForConversion message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordFolderForConversion
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordFolderForConversion;

    /**
     * Creates a plain object from a RecordFolderForConversion message. Also converts values to other types if specified.
     * @param message RecordFolderForConversion
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordFolderForConversion,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordFolderForConversion to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordFolderForConversion
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordConvertToV3. */
  interface IRecordConvertToV3 {
    /** RecordConvertToV3 recordUid */
    recordUid?: Uint8Array | null;

    /** RecordConvertToV3 clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** RecordConvertToV3 revision */
    revision?: number | Long | null;

    /** RecordConvertToV3 data */
    data?: Uint8Array | null;

    /** RecordConvertToV3 nonSharedData */
    nonSharedData?: Uint8Array | null;

    /** RecordConvertToV3 audit */
    audit?: Records.IRecordAudit | null;

    /** RecordConvertToV3 recordFile */
    recordFile?: Records.IRecordFileForConversion[] | null;

    /** RecordConvertToV3 folderKey */
    folderKey?: Records.IRecordFolderForConversion[] | null;
  }

  /** Represents a RecordConvertToV3. */
  class RecordConvertToV3 implements IRecordConvertToV3 {
    /**
     * Constructs a new RecordConvertToV3.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordConvertToV3);

    /** RecordConvertToV3 recordUid. */
    public recordUid: Uint8Array;

    /** RecordConvertToV3 clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** RecordConvertToV3 revision. */
    public revision: number | Long;

    /** RecordConvertToV3 data. */
    public data: Uint8Array;

    /** RecordConvertToV3 nonSharedData. */
    public nonSharedData: Uint8Array;

    /** RecordConvertToV3 audit. */
    public audit?: Records.IRecordAudit | null;

    /** RecordConvertToV3 recordFile. */
    public recordFile: Records.IRecordFileForConversion[];

    /** RecordConvertToV3 folderKey. */
    public folderKey: Records.IRecordFolderForConversion[];

    /**
     * Creates a new RecordConvertToV3 instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordConvertToV3 instance
     */
    public static create(properties?: Records.IRecordConvertToV3): Records.RecordConvertToV3;

    /**
     * Encodes the specified RecordConvertToV3 message. Does not implicitly {@link Records.RecordConvertToV3.verify|verify} messages.
     * @param message RecordConvertToV3 message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordConvertToV3,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordConvertToV3 message, length delimited. Does not implicitly {@link Records.RecordConvertToV3.verify|verify} messages.
     * @param message RecordConvertToV3 message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordConvertToV3,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordConvertToV3 message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordConvertToV3
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordConvertToV3;

    /**
     * Decodes a RecordConvertToV3 message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordConvertToV3
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordConvertToV3;

    /**
     * Verifies a RecordConvertToV3 message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordConvertToV3 message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordConvertToV3
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordConvertToV3;

    /**
     * Creates a plain object from a RecordConvertToV3 message. Also converts values to other types if specified.
     * @param message RecordConvertToV3
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordConvertToV3,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordConvertToV3 to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordConvertToV3
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsConvertToV3Request. */
  interface IRecordsConvertToV3Request {
    /** RecordsConvertToV3Request records */
    records?: Records.IRecordConvertToV3[] | null;

    /** RecordsConvertToV3Request clientTime */
    clientTime?: number | Long | null;
  }

  /** Represents a RecordsConvertToV3Request. */
  class RecordsConvertToV3Request implements IRecordsConvertToV3Request {
    /**
     * Constructs a new RecordsConvertToV3Request.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsConvertToV3Request);

    /** RecordsConvertToV3Request records. */
    public records: Records.IRecordConvertToV3[];

    /** RecordsConvertToV3Request clientTime. */
    public clientTime: number | Long;

    /**
     * Creates a new RecordsConvertToV3Request instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsConvertToV3Request instance
     */
    public static create(
      properties?: Records.IRecordsConvertToV3Request,
    ): Records.RecordsConvertToV3Request;

    /**
     * Encodes the specified RecordsConvertToV3Request message. Does not implicitly {@link Records.RecordsConvertToV3Request.verify|verify} messages.
     * @param message RecordsConvertToV3Request message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsConvertToV3Request,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsConvertToV3Request message, length delimited. Does not implicitly {@link Records.RecordsConvertToV3Request.verify|verify} messages.
     * @param message RecordsConvertToV3Request message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsConvertToV3Request,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsConvertToV3Request message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsConvertToV3Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsConvertToV3Request;

    /**
     * Decodes a RecordsConvertToV3Request message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsConvertToV3Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsConvertToV3Request;

    /**
     * Verifies a RecordsConvertToV3Request message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsConvertToV3Request message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsConvertToV3Request
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsConvertToV3Request;

    /**
     * Creates a plain object from a RecordsConvertToV3Request message. Also converts values to other types if specified.
     * @param message RecordsConvertToV3Request
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsConvertToV3Request,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsConvertToV3Request to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsConvertToV3Request
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsRemoveRequest. */
  interface IRecordsRemoveRequest {
    /** RecordsRemoveRequest records */
    records?: Uint8Array[] | null;
  }

  /** Represents a RecordsRemoveRequest. */
  class RecordsRemoveRequest implements IRecordsRemoveRequest {
    /**
     * Constructs a new RecordsRemoveRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsRemoveRequest);

    /** RecordsRemoveRequest records. */
    public records: Uint8Array[];

    /**
     * Creates a new RecordsRemoveRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsRemoveRequest instance
     */
    public static create(properties?: Records.IRecordsRemoveRequest): Records.RecordsRemoveRequest;

    /**
     * Encodes the specified RecordsRemoveRequest message. Does not implicitly {@link Records.RecordsRemoveRequest.verify|verify} messages.
     * @param message RecordsRemoveRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsRemoveRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsRemoveRequest message, length delimited. Does not implicitly {@link Records.RecordsRemoveRequest.verify|verify} messages.
     * @param message RecordsRemoveRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsRemoveRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsRemoveRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsRemoveRequest;

    /**
     * Decodes a RecordsRemoveRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsRemoveRequest;

    /**
     * Verifies a RecordsRemoveRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsRemoveRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsRemoveRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsRemoveRequest;

    /**
     * Creates a plain object from a RecordsRemoveRequest message. Also converts values to other types if specified.
     * @param message RecordsRemoveRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsRemoveRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsRemoveRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsRemoveRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordRevert. */
  interface IRecordRevert {
    /** RecordRevert recordUid */
    recordUid?: Uint8Array | null;

    /** RecordRevert revertToRevision */
    revertToRevision?: number | Long | null;
  }

  /** Represents a RecordRevert. */
  class RecordRevert implements IRecordRevert {
    /**
     * Constructs a new RecordRevert.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordRevert);

    /** RecordRevert recordUid. */
    public recordUid: Uint8Array;

    /** RecordRevert revertToRevision. */
    public revertToRevision: number | Long;

    /**
     * Creates a new RecordRevert instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordRevert instance
     */
    public static create(properties?: Records.IRecordRevert): Records.RecordRevert;

    /**
     * Encodes the specified RecordRevert message. Does not implicitly {@link Records.RecordRevert.verify|verify} messages.
     * @param message RecordRevert message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordRevert,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordRevert message, length delimited. Does not implicitly {@link Records.RecordRevert.verify|verify} messages.
     * @param message RecordRevert message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordRevert,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordRevert message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordRevert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordRevert;

    /**
     * Decodes a RecordRevert message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordRevert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordRevert;

    /**
     * Verifies a RecordRevert message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordRevert message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordRevert
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordRevert;

    /**
     * Creates a plain object from a RecordRevert message. Also converts values to other types if specified.
     * @param message RecordRevert
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordRevert,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordRevert to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordRevert
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsRevertRequest. */
  interface IRecordsRevertRequest {
    /** RecordsRevertRequest records */
    records?: Records.IRecordRevert[] | null;
  }

  /** Represents a RecordsRevertRequest. */
  class RecordsRevertRequest implements IRecordsRevertRequest {
    /**
     * Constructs a new RecordsRevertRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsRevertRequest);

    /** RecordsRevertRequest records. */
    public records: Records.IRecordRevert[];

    /**
     * Creates a new RecordsRevertRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsRevertRequest instance
     */
    public static create(properties?: Records.IRecordsRevertRequest): Records.RecordsRevertRequest;

    /**
     * Encodes the specified RecordsRevertRequest message. Does not implicitly {@link Records.RecordsRevertRequest.verify|verify} messages.
     * @param message RecordsRevertRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsRevertRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsRevertRequest message, length delimited. Does not implicitly {@link Records.RecordsRevertRequest.verify|verify} messages.
     * @param message RecordsRevertRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsRevertRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsRevertRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsRevertRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsRevertRequest;

    /**
     * Decodes a RecordsRevertRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsRevertRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsRevertRequest;

    /**
     * Verifies a RecordsRevertRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsRevertRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsRevertRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsRevertRequest;

    /**
     * Creates a plain object from a RecordsRevertRequest message. Also converts values to other types if specified.
     * @param message RecordsRevertRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsRevertRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsRevertRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsRevertRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordLinkError. */
  interface IRecordLinkError {
    /** RecordLinkError recordUid */
    recordUid?: Uint8Array | null;

    /** RecordLinkError status */
    status?: Records.RecordModifyResult | null;

    /** RecordLinkError message */
    message?: string | null;
  }

  /** Represents a RecordLinkError. */
  class RecordLinkError implements IRecordLinkError {
    /**
     * Constructs a new RecordLinkError.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordLinkError);

    /** RecordLinkError recordUid. */
    public recordUid: Uint8Array;

    /** RecordLinkError status. */
    public status: Records.RecordModifyResult;

    /** RecordLinkError message. */
    public message: string;

    /**
     * Creates a new RecordLinkError instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordLinkError instance
     */
    public static create(properties?: Records.IRecordLinkError): Records.RecordLinkError;

    /**
     * Encodes the specified RecordLinkError message. Does not implicitly {@link Records.RecordLinkError.verify|verify} messages.
     * @param message RecordLinkError message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordLinkError,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordLinkError message, length delimited. Does not implicitly {@link Records.RecordLinkError.verify|verify} messages.
     * @param message RecordLinkError message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordLinkError,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordLinkError message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordLinkError
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordLinkError;

    /**
     * Decodes a RecordLinkError message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordLinkError
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordLinkError;

    /**
     * Verifies a RecordLinkError message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordLinkError message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordLinkError
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordLinkError;

    /**
     * Creates a plain object from a RecordLinkError message. Also converts values to other types if specified.
     * @param message RecordLinkError
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordLinkError,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordLinkError to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordLinkError
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordModifyStatus. */
  interface IRecordModifyStatus {
    /** RecordModifyStatus recordUid */
    recordUid?: Uint8Array | null;

    /** RecordModifyStatus status */
    status?: Records.RecordModifyResult | null;

    /** RecordModifyStatus message */
    message?: string | null;

    /** RecordModifyStatus linkErrors */
    linkErrors?: Records.IRecordLinkError[] | null;
  }

  /** Represents a RecordModifyStatus. */
  class RecordModifyStatus implements IRecordModifyStatus {
    /**
     * Constructs a new RecordModifyStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordModifyStatus);

    /** RecordModifyStatus recordUid. */
    public recordUid: Uint8Array;

    /** RecordModifyStatus status. */
    public status: Records.RecordModifyResult;

    /** RecordModifyStatus message. */
    public message: string;

    /** RecordModifyStatus linkErrors. */
    public linkErrors: Records.IRecordLinkError[];

    /**
     * Creates a new RecordModifyStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordModifyStatus instance
     */
    public static create(properties?: Records.IRecordModifyStatus): Records.RecordModifyStatus;

    /**
     * Encodes the specified RecordModifyStatus message. Does not implicitly {@link Records.RecordModifyStatus.verify|verify} messages.
     * @param message RecordModifyStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordModifyStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordModifyStatus message, length delimited. Does not implicitly {@link Records.RecordModifyStatus.verify|verify} messages.
     * @param message RecordModifyStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordModifyStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordModifyStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordModifyStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordModifyStatus;

    /**
     * Decodes a RecordModifyStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordModifyStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordModifyStatus;

    /**
     * Verifies a RecordModifyStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordModifyStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordModifyStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordModifyStatus;

    /**
     * Creates a plain object from a RecordModifyStatus message. Also converts values to other types if specified.
     * @param message RecordModifyStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordModifyStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordModifyStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordModifyStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsModifyResponse. */
  interface IRecordsModifyResponse {
    /** RecordsModifyResponse records */
    records?: Records.IRecordModifyStatus[] | null;

    /** RecordsModifyResponse revision */
    revision?: number | Long | null;
  }

  /** Represents a RecordsModifyResponse. */
  class RecordsModifyResponse implements IRecordsModifyResponse {
    /**
     * Constructs a new RecordsModifyResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsModifyResponse);

    /** RecordsModifyResponse records. */
    public records: Records.IRecordModifyStatus[];

    /** RecordsModifyResponse revision. */
    public revision: number | Long;

    /**
     * Creates a new RecordsModifyResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsModifyResponse instance
     */
    public static create(
      properties?: Records.IRecordsModifyResponse,
    ): Records.RecordsModifyResponse;

    /**
     * Encodes the specified RecordsModifyResponse message. Does not implicitly {@link Records.RecordsModifyResponse.verify|verify} messages.
     * @param message RecordsModifyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsModifyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsModifyResponse message, length delimited. Does not implicitly {@link Records.RecordsModifyResponse.verify|verify} messages.
     * @param message RecordsModifyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsModifyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsModifyResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsModifyResponse;

    /**
     * Decodes a RecordsModifyResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsModifyResponse;

    /**
     * Verifies a RecordsModifyResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsModifyResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsModifyResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsModifyResponse;

    /**
     * Creates a plain object from a RecordsModifyResponse message. Also converts values to other types if specified.
     * @param message RecordsModifyResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsModifyResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsModifyResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsModifyResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordAddAuditData. */
  interface IRecordAddAuditData {
    /** RecordAddAuditData recordUid */
    recordUid?: Uint8Array | null;

    /** RecordAddAuditData revision */
    revision?: number | Long | null;

    /** RecordAddAuditData data */
    data?: Uint8Array | null;

    /** RecordAddAuditData version */
    version?: number | null;
  }

  /** Represents a RecordAddAuditData. */
  class RecordAddAuditData implements IRecordAddAuditData {
    /**
     * Constructs a new RecordAddAuditData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordAddAuditData);

    /** RecordAddAuditData recordUid. */
    public recordUid: Uint8Array;

    /** RecordAddAuditData revision. */
    public revision: number | Long;

    /** RecordAddAuditData data. */
    public data: Uint8Array;

    /** RecordAddAuditData version. */
    public version: number;

    /**
     * Creates a new RecordAddAuditData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordAddAuditData instance
     */
    public static create(properties?: Records.IRecordAddAuditData): Records.RecordAddAuditData;

    /**
     * Encodes the specified RecordAddAuditData message. Does not implicitly {@link Records.RecordAddAuditData.verify|verify} messages.
     * @param message RecordAddAuditData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordAddAuditData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordAddAuditData message, length delimited. Does not implicitly {@link Records.RecordAddAuditData.verify|verify} messages.
     * @param message RecordAddAuditData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordAddAuditData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordAddAuditData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordAddAuditData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordAddAuditData;

    /**
     * Decodes a RecordAddAuditData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordAddAuditData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordAddAuditData;

    /**
     * Verifies a RecordAddAuditData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordAddAuditData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordAddAuditData
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordAddAuditData;

    /**
     * Creates a plain object from a RecordAddAuditData message. Also converts values to other types if specified.
     * @param message RecordAddAuditData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordAddAuditData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordAddAuditData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordAddAuditData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AddAuditDataRequest. */
  interface IAddAuditDataRequest {
    /** AddAuditDataRequest records */
    records?: Records.IRecordAddAuditData[] | null;
  }

  /** Represents an AddAuditDataRequest. */
  class AddAuditDataRequest implements IAddAuditDataRequest {
    /**
     * Constructs a new AddAuditDataRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IAddAuditDataRequest);

    /** AddAuditDataRequest records. */
    public records: Records.IRecordAddAuditData[];

    /**
     * Creates a new AddAuditDataRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AddAuditDataRequest instance
     */
    public static create(properties?: Records.IAddAuditDataRequest): Records.AddAuditDataRequest;

    /**
     * Encodes the specified AddAuditDataRequest message. Does not implicitly {@link Records.AddAuditDataRequest.verify|verify} messages.
     * @param message AddAuditDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IAddAuditDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AddAuditDataRequest message, length delimited. Does not implicitly {@link Records.AddAuditDataRequest.verify|verify} messages.
     * @param message AddAuditDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IAddAuditDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AddAuditDataRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AddAuditDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.AddAuditDataRequest;

    /**
     * Decodes an AddAuditDataRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AddAuditDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.AddAuditDataRequest;

    /**
     * Verifies an AddAuditDataRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AddAuditDataRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AddAuditDataRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.AddAuditDataRequest;

    /**
     * Creates a plain object from an AddAuditDataRequest message. Also converts values to other types if specified.
     * @param message AddAuditDataRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.AddAuditDataRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AddAuditDataRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AddAuditDataRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a File. */
  interface IFile {
    /** File recordUid */
    recordUid?: Uint8Array | null;

    /** File recordKey */
    recordKey?: Uint8Array | null;

    /** File data */
    data?: Uint8Array | null;

    /** File fileSize */
    fileSize?: number | Long | null;

    /** File thumbSize */
    thumbSize?: number | null;

    /** File isScript */
    isScript?: boolean | null;
  }

  /** Represents a File. */
  class File implements IFile {
    /**
     * Constructs a new File.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFile);

    /** File recordUid. */
    public recordUid: Uint8Array;

    /** File recordKey. */
    public recordKey: Uint8Array;

    /** File data. */
    public data: Uint8Array;

    /** File fileSize. */
    public fileSize: number | Long;

    /** File thumbSize. */
    public thumbSize: number;

    /** File isScript. */
    public isScript: boolean;

    /**
     * Creates a new File instance using the specified properties.
     * @param [properties] Properties to set
     * @returns File instance
     */
    public static create(properties?: Records.IFile): Records.File;

    /**
     * Encodes the specified File message. Does not implicitly {@link Records.File.verify|verify} messages.
     * @param message File message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IFile, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified File message, length delimited. Does not implicitly {@link Records.File.verify|verify} messages.
     * @param message File message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFile,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a File message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.File;

    /**
     * Decodes a File message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.File;

    /**
     * Verifies a File message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a File message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns File
     */
    public static fromObject(object: { [k: string]: any }): Records.File;

    /**
     * Creates a plain object from a File message. Also converts values to other types if specified.
     * @param message File
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.File,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this File to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for File
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FilesAddRequest. */
  interface IFilesAddRequest {
    /** FilesAddRequest files */
    files?: Records.IFile[] | null;

    /** FilesAddRequest clientTime */
    clientTime?: number | Long | null;
  }

  /** Represents a FilesAddRequest. */
  class FilesAddRequest implements IFilesAddRequest {
    /**
     * Constructs a new FilesAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFilesAddRequest);

    /** FilesAddRequest files. */
    public files: Records.IFile[];

    /** FilesAddRequest clientTime. */
    public clientTime: number | Long;

    /**
     * Creates a new FilesAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FilesAddRequest instance
     */
    public static create(properties?: Records.IFilesAddRequest): Records.FilesAddRequest;

    /**
     * Encodes the specified FilesAddRequest message. Does not implicitly {@link Records.FilesAddRequest.verify|verify} messages.
     * @param message FilesAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFilesAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FilesAddRequest message, length delimited. Does not implicitly {@link Records.FilesAddRequest.verify|verify} messages.
     * @param message FilesAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFilesAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FilesAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FilesAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FilesAddRequest;

    /**
     * Decodes a FilesAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FilesAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FilesAddRequest;

    /**
     * Verifies a FilesAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FilesAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FilesAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.FilesAddRequest;

    /**
     * Creates a plain object from a FilesAddRequest message. Also converts values to other types if specified.
     * @param message FilesAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FilesAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FilesAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FilesAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FileAddStatus. */
  interface IFileAddStatus {
    /** FileAddStatus recordUid */
    recordUid?: Uint8Array | null;

    /** FileAddStatus status */
    status?: Records.FileAddResult | null;

    /** FileAddStatus url */
    url?: string | null;

    /** FileAddStatus parameters */
    parameters?: string | null;

    /** FileAddStatus thumbnailParameters */
    thumbnailParameters?: string | null;

    /** FileAddStatus successStatusCode */
    successStatusCode?: number | null;
  }

  /** Represents a FileAddStatus. */
  class FileAddStatus implements IFileAddStatus {
    /**
     * Constructs a new FileAddStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFileAddStatus);

    /** FileAddStatus recordUid. */
    public recordUid: Uint8Array;

    /** FileAddStatus status. */
    public status: Records.FileAddResult;

    /** FileAddStatus url. */
    public url: string;

    /** FileAddStatus parameters. */
    public parameters: string;

    /** FileAddStatus thumbnailParameters. */
    public thumbnailParameters: string;

    /** FileAddStatus successStatusCode. */
    public successStatusCode: number;

    /**
     * Creates a new FileAddStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FileAddStatus instance
     */
    public static create(properties?: Records.IFileAddStatus): Records.FileAddStatus;

    /**
     * Encodes the specified FileAddStatus message. Does not implicitly {@link Records.FileAddStatus.verify|verify} messages.
     * @param message FileAddStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFileAddStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FileAddStatus message, length delimited. Does not implicitly {@link Records.FileAddStatus.verify|verify} messages.
     * @param message FileAddStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFileAddStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FileAddStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FileAddStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FileAddStatus;

    /**
     * Decodes a FileAddStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FileAddStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FileAddStatus;

    /**
     * Verifies a FileAddStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FileAddStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FileAddStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.FileAddStatus;

    /**
     * Creates a plain object from a FileAddStatus message. Also converts values to other types if specified.
     * @param message FileAddStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FileAddStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FileAddStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FileAddStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FilesAddResponse. */
  interface IFilesAddResponse {
    /** FilesAddResponse files */
    files?: Records.IFileAddStatus[] | null;

    /** FilesAddResponse revision */
    revision?: number | Long | null;
  }

  /** Represents a FilesAddResponse. */
  class FilesAddResponse implements IFilesAddResponse {
    /**
     * Constructs a new FilesAddResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFilesAddResponse);

    /** FilesAddResponse files. */
    public files: Records.IFileAddStatus[];

    /** FilesAddResponse revision. */
    public revision: number | Long;

    /**
     * Creates a new FilesAddResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FilesAddResponse instance
     */
    public static create(properties?: Records.IFilesAddResponse): Records.FilesAddResponse;

    /**
     * Encodes the specified FilesAddResponse message. Does not implicitly {@link Records.FilesAddResponse.verify|verify} messages.
     * @param message FilesAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFilesAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FilesAddResponse message, length delimited. Does not implicitly {@link Records.FilesAddResponse.verify|verify} messages.
     * @param message FilesAddResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFilesAddResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FilesAddResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FilesAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FilesAddResponse;

    /**
     * Decodes a FilesAddResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FilesAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FilesAddResponse;

    /**
     * Verifies a FilesAddResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FilesAddResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FilesAddResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.FilesAddResponse;

    /**
     * Creates a plain object from a FilesAddResponse message. Also converts values to other types if specified.
     * @param message FilesAddResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FilesAddResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FilesAddResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FilesAddResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FilesGetRequest. */
  interface IFilesGetRequest {
    /** FilesGetRequest recordUids */
    recordUids?: Uint8Array[] | null;

    /** FilesGetRequest forThumbnails */
    forThumbnails?: boolean | null;

    /** FilesGetRequest emergencyAccessAccountOwner */
    emergencyAccessAccountOwner?: string | null;
  }

  /** Represents a FilesGetRequest. */
  class FilesGetRequest implements IFilesGetRequest {
    /**
     * Constructs a new FilesGetRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFilesGetRequest);

    /** FilesGetRequest recordUids. */
    public recordUids: Uint8Array[];

    /** FilesGetRequest forThumbnails. */
    public forThumbnails: boolean;

    /** FilesGetRequest emergencyAccessAccountOwner. */
    public emergencyAccessAccountOwner: string;

    /**
     * Creates a new FilesGetRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FilesGetRequest instance
     */
    public static create(properties?: Records.IFilesGetRequest): Records.FilesGetRequest;

    /**
     * Encodes the specified FilesGetRequest message. Does not implicitly {@link Records.FilesGetRequest.verify|verify} messages.
     * @param message FilesGetRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFilesGetRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FilesGetRequest message, length delimited. Does not implicitly {@link Records.FilesGetRequest.verify|verify} messages.
     * @param message FilesGetRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFilesGetRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FilesGetRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FilesGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FilesGetRequest;

    /**
     * Decodes a FilesGetRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FilesGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FilesGetRequest;

    /**
     * Verifies a FilesGetRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FilesGetRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FilesGetRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.FilesGetRequest;

    /**
     * Creates a plain object from a FilesGetRequest message. Also converts values to other types if specified.
     * @param message FilesGetRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FilesGetRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FilesGetRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FilesGetRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FileGetStatus. */
  interface IFileGetStatus {
    /** FileGetStatus recordUid */
    recordUid?: Uint8Array | null;

    /** FileGetStatus status */
    status?: Records.FileGetResult | null;

    /** FileGetStatus url */
    url?: string | null;

    /** FileGetStatus successStatusCode */
    successStatusCode?: number | null;

    /** FileGetStatus fileKeyType */
    fileKeyType?: Records.RecordKeyType | null;
  }

  /** Represents a FileGetStatus. */
  class FileGetStatus implements IFileGetStatus {
    /**
     * Constructs a new FileGetStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFileGetStatus);

    /** FileGetStatus recordUid. */
    public recordUid: Uint8Array;

    /** FileGetStatus status. */
    public status: Records.FileGetResult;

    /** FileGetStatus url. */
    public url: string;

    /** FileGetStatus successStatusCode. */
    public successStatusCode: number;

    /** FileGetStatus fileKeyType. */
    public fileKeyType: Records.RecordKeyType;

    /**
     * Creates a new FileGetStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FileGetStatus instance
     */
    public static create(properties?: Records.IFileGetStatus): Records.FileGetStatus;

    /**
     * Encodes the specified FileGetStatus message. Does not implicitly {@link Records.FileGetStatus.verify|verify} messages.
     * @param message FileGetStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFileGetStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FileGetStatus message, length delimited. Does not implicitly {@link Records.FileGetStatus.verify|verify} messages.
     * @param message FileGetStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFileGetStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FileGetStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FileGetStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FileGetStatus;

    /**
     * Decodes a FileGetStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FileGetStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FileGetStatus;

    /**
     * Verifies a FileGetStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FileGetStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FileGetStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.FileGetStatus;

    /**
     * Creates a plain object from a FileGetStatus message. Also converts values to other types if specified.
     * @param message FileGetStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FileGetStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FileGetStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FileGetStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FilesGetResponse. */
  interface IFilesGetResponse {
    /** FilesGetResponse files */
    files?: Records.IFileGetStatus[] | null;
  }

  /** Represents a FilesGetResponse. */
  class FilesGetResponse implements IFilesGetResponse {
    /**
     * Constructs a new FilesGetResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IFilesGetResponse);

    /** FilesGetResponse files. */
    public files: Records.IFileGetStatus[];

    /**
     * Creates a new FilesGetResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FilesGetResponse instance
     */
    public static create(properties?: Records.IFilesGetResponse): Records.FilesGetResponse;

    /**
     * Encodes the specified FilesGetResponse message. Does not implicitly {@link Records.FilesGetResponse.verify|verify} messages.
     * @param message FilesGetResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IFilesGetResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FilesGetResponse message, length delimited. Does not implicitly {@link Records.FilesGetResponse.verify|verify} messages.
     * @param message FilesGetResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IFilesGetResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FilesGetResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FilesGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.FilesGetResponse;

    /**
     * Decodes a FilesGetResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FilesGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.FilesGetResponse;

    /**
     * Verifies a FilesGetResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FilesGetResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FilesGetResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.FilesGetResponse;

    /**
     * Creates a plain object from a FilesGetResponse message. Also converts values to other types if specified.
     * @param message FilesGetResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.FilesGetResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FilesGetResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FilesGetResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApplicationAddRequest. */
  interface IApplicationAddRequest {
    /** ApplicationAddRequest appUid */
    appUid?: Uint8Array | null;

    /** ApplicationAddRequest recordKey */
    recordKey?: Uint8Array | null;

    /** ApplicationAddRequest clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** ApplicationAddRequest data */
    data?: Uint8Array | null;

    /** ApplicationAddRequest audit */
    audit?: Records.IRecordAudit | null;
  }

  /** Represents an ApplicationAddRequest. */
  class ApplicationAddRequest implements IApplicationAddRequest {
    /**
     * Constructs a new ApplicationAddRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IApplicationAddRequest);

    /** ApplicationAddRequest appUid. */
    public appUid: Uint8Array;

    /** ApplicationAddRequest recordKey. */
    public recordKey: Uint8Array;

    /** ApplicationAddRequest clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** ApplicationAddRequest data. */
    public data: Uint8Array;

    /** ApplicationAddRequest audit. */
    public audit?: Records.IRecordAudit | null;

    /**
     * Creates a new ApplicationAddRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApplicationAddRequest instance
     */
    public static create(
      properties?: Records.IApplicationAddRequest,
    ): Records.ApplicationAddRequest;

    /**
     * Encodes the specified ApplicationAddRequest message. Does not implicitly {@link Records.ApplicationAddRequest.verify|verify} messages.
     * @param message ApplicationAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IApplicationAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApplicationAddRequest message, length delimited. Does not implicitly {@link Records.ApplicationAddRequest.verify|verify} messages.
     * @param message ApplicationAddRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IApplicationAddRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApplicationAddRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApplicationAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.ApplicationAddRequest;

    /**
     * Decodes an ApplicationAddRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApplicationAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.ApplicationAddRequest;

    /**
     * Verifies an ApplicationAddRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApplicationAddRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApplicationAddRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.ApplicationAddRequest;

    /**
     * Creates a plain object from an ApplicationAddRequest message. Also converts values to other types if specified.
     * @param message ApplicationAddRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.ApplicationAddRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApplicationAddRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApplicationAddRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetRecordDataWithAccessInfoRequest. */
  interface IGetRecordDataWithAccessInfoRequest {
    /** GetRecordDataWithAccessInfoRequest clientTime */
    clientTime?: number | Long | null;

    /** GetRecordDataWithAccessInfoRequest recordUid */
    recordUid?: Uint8Array[] | null;

    /** GetRecordDataWithAccessInfoRequest recordDetailsInclude */
    recordDetailsInclude?: Records.RecordDetailsInclude | null;
  }

  /** Represents a GetRecordDataWithAccessInfoRequest. */
  class GetRecordDataWithAccessInfoRequest implements IGetRecordDataWithAccessInfoRequest {
    /**
     * Constructs a new GetRecordDataWithAccessInfoRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetRecordDataWithAccessInfoRequest);

    /** GetRecordDataWithAccessInfoRequest clientTime. */
    public clientTime: number | Long;

    /** GetRecordDataWithAccessInfoRequest recordUid. */
    public recordUid: Uint8Array[];

    /** GetRecordDataWithAccessInfoRequest recordDetailsInclude. */
    public recordDetailsInclude: Records.RecordDetailsInclude;

    /**
     * Creates a new GetRecordDataWithAccessInfoRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetRecordDataWithAccessInfoRequest instance
     */
    public static create(
      properties?: Records.IGetRecordDataWithAccessInfoRequest,
    ): Records.GetRecordDataWithAccessInfoRequest;

    /**
     * Encodes the specified GetRecordDataWithAccessInfoRequest message. Does not implicitly {@link Records.GetRecordDataWithAccessInfoRequest.verify|verify} messages.
     * @param message GetRecordDataWithAccessInfoRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetRecordDataWithAccessInfoRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetRecordDataWithAccessInfoRequest message, length delimited. Does not implicitly {@link Records.GetRecordDataWithAccessInfoRequest.verify|verify} messages.
     * @param message GetRecordDataWithAccessInfoRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetRecordDataWithAccessInfoRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetRecordDataWithAccessInfoRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetRecordDataWithAccessInfoRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetRecordDataWithAccessInfoRequest;

    /**
     * Decodes a GetRecordDataWithAccessInfoRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetRecordDataWithAccessInfoRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetRecordDataWithAccessInfoRequest;

    /**
     * Verifies a GetRecordDataWithAccessInfoRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetRecordDataWithAccessInfoRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetRecordDataWithAccessInfoRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Records.GetRecordDataWithAccessInfoRequest;

    /**
     * Creates a plain object from a GetRecordDataWithAccessInfoRequest message. Also converts values to other types if specified.
     * @param message GetRecordDataWithAccessInfoRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetRecordDataWithAccessInfoRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetRecordDataWithAccessInfoRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetRecordDataWithAccessInfoRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UserPermission. */
  interface IUserPermission {
    /** UserPermission username */
    username?: string | null;

    /** UserPermission owner */
    owner?: boolean | null;

    /** UserPermission shareAdmin */
    shareAdmin?: boolean | null;

    /** UserPermission sharable */
    sharable?: boolean | null;

    /** UserPermission editable */
    editable?: boolean | null;

    /** UserPermission awaitingApproval */
    awaitingApproval?: boolean | null;

    /** UserPermission expiration */
    expiration?: number | Long | null;

    /** UserPermission accountUid */
    accountUid?: Uint8Array | null;

    /** UserPermission timerNotificationType */
    timerNotificationType?: Records.TimerNotificationType | null;

    /** UserPermission rotateOnExpiration */
    rotateOnExpiration?: boolean | null;
  }

  /** Represents a UserPermission. */
  class UserPermission implements IUserPermission {
    /**
     * Constructs a new UserPermission.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IUserPermission);

    /** UserPermission username. */
    public username: string;

    /** UserPermission owner. */
    public owner: boolean;

    /** UserPermission shareAdmin. */
    public shareAdmin: boolean;

    /** UserPermission sharable. */
    public sharable: boolean;

    /** UserPermission editable. */
    public editable: boolean;

    /** UserPermission awaitingApproval. */
    public awaitingApproval: boolean;

    /** UserPermission expiration. */
    public expiration: number | Long;

    /** UserPermission accountUid. */
    public accountUid: Uint8Array;

    /** UserPermission timerNotificationType. */
    public timerNotificationType: Records.TimerNotificationType;

    /** UserPermission rotateOnExpiration. */
    public rotateOnExpiration: boolean;

    /**
     * Creates a new UserPermission instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserPermission instance
     */
    public static create(properties?: Records.IUserPermission): Records.UserPermission;

    /**
     * Encodes the specified UserPermission message. Does not implicitly {@link Records.UserPermission.verify|verify} messages.
     * @param message UserPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IUserPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserPermission message, length delimited. Does not implicitly {@link Records.UserPermission.verify|verify} messages.
     * @param message UserPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IUserPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserPermission message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.UserPermission;

    /**
     * Decodes a UserPermission message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.UserPermission;

    /**
     * Verifies a UserPermission message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserPermission message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserPermission
     */
    public static fromObject(object: { [k: string]: any }): Records.UserPermission;

    /**
     * Creates a plain object from a UserPermission message. Also converts values to other types if specified.
     * @param message UserPermission
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.UserPermission,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserPermission to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserPermission
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedFolderPermission. */
  interface ISharedFolderPermission {
    /** SharedFolderPermission sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** SharedFolderPermission resharable */
    resharable?: boolean | null;

    /** SharedFolderPermission editable */
    editable?: boolean | null;

    /** SharedFolderPermission revision */
    revision?: number | Long | null;

    /** SharedFolderPermission expiration */
    expiration?: number | Long | null;

    /** SharedFolderPermission timerNotificationType */
    timerNotificationType?: Records.TimerNotificationType | null;

    /** SharedFolderPermission rotateOnExpiration */
    rotateOnExpiration?: boolean | null;
  }

  /** Represents a SharedFolderPermission. */
  class SharedFolderPermission implements ISharedFolderPermission {
    /**
     * Constructs a new SharedFolderPermission.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ISharedFolderPermission);

    /** SharedFolderPermission sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** SharedFolderPermission resharable. */
    public resharable: boolean;

    /** SharedFolderPermission editable. */
    public editable: boolean;

    /** SharedFolderPermission revision. */
    public revision: number | Long;

    /** SharedFolderPermission expiration. */
    public expiration: number | Long;

    /** SharedFolderPermission timerNotificationType. */
    public timerNotificationType: Records.TimerNotificationType;

    /** SharedFolderPermission rotateOnExpiration. */
    public rotateOnExpiration: boolean;

    /**
     * Creates a new SharedFolderPermission instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedFolderPermission instance
     */
    public static create(
      properties?: Records.ISharedFolderPermission,
    ): Records.SharedFolderPermission;

    /**
     * Encodes the specified SharedFolderPermission message. Does not implicitly {@link Records.SharedFolderPermission.verify|verify} messages.
     * @param message SharedFolderPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ISharedFolderPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedFolderPermission message, length delimited. Does not implicitly {@link Records.SharedFolderPermission.verify|verify} messages.
     * @param message SharedFolderPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ISharedFolderPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedFolderPermission message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedFolderPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.SharedFolderPermission;

    /**
     * Decodes a SharedFolderPermission message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedFolderPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.SharedFolderPermission;

    /**
     * Verifies a SharedFolderPermission message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedFolderPermission message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedFolderPermission
     */
    public static fromObject(object: { [k: string]: any }): Records.SharedFolderPermission;

    /**
     * Creates a plain object from a SharedFolderPermission message. Also converts values to other types if specified.
     * @param message SharedFolderPermission
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.SharedFolderPermission,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedFolderPermission to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedFolderPermission
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordData. */
  interface IRecordData {
    /** RecordData revision */
    revision?: number | Long | null;

    /** RecordData version */
    version?: number | null;

    /** RecordData shared */
    shared?: boolean | null;

    /** RecordData encryptedRecordData */
    encryptedRecordData?: string | null;

    /** RecordData encryptedExtraData */
    encryptedExtraData?: string | null;

    /** RecordData clientModifiedTime */
    clientModifiedTime?: number | Long | null;

    /** RecordData nonSharedData */
    nonSharedData?: string | null;

    /** RecordData linkedRecordData */
    linkedRecordData?: Records.IRecordData[] | null;

    /** RecordData fileId */
    fileId?: Uint8Array[] | null;

    /** RecordData fileSize */
    fileSize?: number | Long | null;

    /** RecordData thumbnailSize */
    thumbnailSize?: number | Long | null;

    /** RecordData recordKeyType */
    recordKeyType?: Records.RecordKeyType | null;

    /** RecordData recordKey */
    recordKey?: Uint8Array | null;

    /** RecordData recordUid */
    recordUid?: Uint8Array | null;
  }

  /** Represents a RecordData. */
  class RecordData implements IRecordData {
    /**
     * Constructs a new RecordData.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordData);

    /** RecordData revision. */
    public revision: number | Long;

    /** RecordData version. */
    public version: number;

    /** RecordData shared. */
    public shared: boolean;

    /** RecordData encryptedRecordData. */
    public encryptedRecordData: string;

    /** RecordData encryptedExtraData. */
    public encryptedExtraData: string;

    /** RecordData clientModifiedTime. */
    public clientModifiedTime: number | Long;

    /** RecordData nonSharedData. */
    public nonSharedData: string;

    /** RecordData linkedRecordData. */
    public linkedRecordData: Records.IRecordData[];

    /** RecordData fileId. */
    public fileId: Uint8Array[];

    /** RecordData fileSize. */
    public fileSize: number | Long;

    /** RecordData thumbnailSize. */
    public thumbnailSize: number | Long;

    /** RecordData recordKeyType. */
    public recordKeyType: Records.RecordKeyType;

    /** RecordData recordKey. */
    public recordKey: Uint8Array;

    /** RecordData recordUid. */
    public recordUid: Uint8Array;

    /**
     * Creates a new RecordData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordData instance
     */
    public static create(properties?: Records.IRecordData): Records.RecordData;

    /**
     * Encodes the specified RecordData message. Does not implicitly {@link Records.RecordData.verify|verify} messages.
     * @param message RecordData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IRecordData, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RecordData message, length delimited. Does not implicitly {@link Records.RecordData.verify|verify} messages.
     * @param message RecordData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordData;

    /**
     * Decodes a RecordData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordData;

    /**
     * Verifies a RecordData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordData
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordData;

    /**
     * Creates a plain object from a RecordData message. Also converts values to other types if specified.
     * @param message RecordData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordDataWithAccessInfo. */
  interface IRecordDataWithAccessInfo {
    /** RecordDataWithAccessInfo recordUid */
    recordUid?: Uint8Array | null;

    /** RecordDataWithAccessInfo recordData */
    recordData?: Records.IRecordData | null;

    /** RecordDataWithAccessInfo userPermission */
    userPermission?: Records.IUserPermission[] | null;

    /** RecordDataWithAccessInfo sharedFolderPermission */
    sharedFolderPermission?: Records.ISharedFolderPermission[] | null;
  }

  /** Represents a RecordDataWithAccessInfo. */
  class RecordDataWithAccessInfo implements IRecordDataWithAccessInfo {
    /**
     * Constructs a new RecordDataWithAccessInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordDataWithAccessInfo);

    /** RecordDataWithAccessInfo recordUid. */
    public recordUid: Uint8Array;

    /** RecordDataWithAccessInfo recordData. */
    public recordData?: Records.IRecordData | null;

    /** RecordDataWithAccessInfo userPermission. */
    public userPermission: Records.IUserPermission[];

    /** RecordDataWithAccessInfo sharedFolderPermission. */
    public sharedFolderPermission: Records.ISharedFolderPermission[];

    /**
     * Creates a new RecordDataWithAccessInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordDataWithAccessInfo instance
     */
    public static create(
      properties?: Records.IRecordDataWithAccessInfo,
    ): Records.RecordDataWithAccessInfo;

    /**
     * Encodes the specified RecordDataWithAccessInfo message. Does not implicitly {@link Records.RecordDataWithAccessInfo.verify|verify} messages.
     * @param message RecordDataWithAccessInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordDataWithAccessInfo,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordDataWithAccessInfo message, length delimited. Does not implicitly {@link Records.RecordDataWithAccessInfo.verify|verify} messages.
     * @param message RecordDataWithAccessInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordDataWithAccessInfo,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordDataWithAccessInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordDataWithAccessInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordDataWithAccessInfo;

    /**
     * Decodes a RecordDataWithAccessInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordDataWithAccessInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordDataWithAccessInfo;

    /**
     * Verifies a RecordDataWithAccessInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordDataWithAccessInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordDataWithAccessInfo
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordDataWithAccessInfo;

    /**
     * Creates a plain object from a RecordDataWithAccessInfo message. Also converts values to other types if specified.
     * @param message RecordDataWithAccessInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordDataWithAccessInfo,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordDataWithAccessInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordDataWithAccessInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetRecordDataWithAccessInfoResponse. */
  interface IGetRecordDataWithAccessInfoResponse {
    /** GetRecordDataWithAccessInfoResponse recordDataWithAccessInfo */
    recordDataWithAccessInfo?: Records.IRecordDataWithAccessInfo[] | null;

    /** GetRecordDataWithAccessInfoResponse noPermissionRecordUid */
    noPermissionRecordUid?: Uint8Array[] | null;
  }

  /** Represents a GetRecordDataWithAccessInfoResponse. */
  class GetRecordDataWithAccessInfoResponse implements IGetRecordDataWithAccessInfoResponse {
    /**
     * Constructs a new GetRecordDataWithAccessInfoResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetRecordDataWithAccessInfoResponse);

    /** GetRecordDataWithAccessInfoResponse recordDataWithAccessInfo. */
    public recordDataWithAccessInfo: Records.IRecordDataWithAccessInfo[];

    /** GetRecordDataWithAccessInfoResponse noPermissionRecordUid. */
    public noPermissionRecordUid: Uint8Array[];

    /**
     * Creates a new GetRecordDataWithAccessInfoResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetRecordDataWithAccessInfoResponse instance
     */
    public static create(
      properties?: Records.IGetRecordDataWithAccessInfoResponse,
    ): Records.GetRecordDataWithAccessInfoResponse;

    /**
     * Encodes the specified GetRecordDataWithAccessInfoResponse message. Does not implicitly {@link Records.GetRecordDataWithAccessInfoResponse.verify|verify} messages.
     * @param message GetRecordDataWithAccessInfoResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetRecordDataWithAccessInfoResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetRecordDataWithAccessInfoResponse message, length delimited. Does not implicitly {@link Records.GetRecordDataWithAccessInfoResponse.verify|verify} messages.
     * @param message GetRecordDataWithAccessInfoResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetRecordDataWithAccessInfoResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetRecordDataWithAccessInfoResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetRecordDataWithAccessInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetRecordDataWithAccessInfoResponse;

    /**
     * Decodes a GetRecordDataWithAccessInfoResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetRecordDataWithAccessInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetRecordDataWithAccessInfoResponse;

    /**
     * Verifies a GetRecordDataWithAccessInfoResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetRecordDataWithAccessInfoResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetRecordDataWithAccessInfoResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Records.GetRecordDataWithAccessInfoResponse;

    /**
     * Creates a plain object from a GetRecordDataWithAccessInfoResponse message. Also converts values to other types if specified.
     * @param message GetRecordDataWithAccessInfoResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetRecordDataWithAccessInfoResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetRecordDataWithAccessInfoResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetRecordDataWithAccessInfoResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an IsObjectShareAdmin. */
  interface IIsObjectShareAdmin {
    /** IsObjectShareAdmin uid */
    uid?: Uint8Array | null;

    /** IsObjectShareAdmin isAdmin */
    isAdmin?: boolean | null;

    /** IsObjectShareAdmin objectType */
    objectType?: Records.CheckShareAdminObjectType | null;
  }

  /** Represents an IsObjectShareAdmin. */
  class IsObjectShareAdmin implements IIsObjectShareAdmin {
    /**
     * Constructs a new IsObjectShareAdmin.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IIsObjectShareAdmin);

    /** IsObjectShareAdmin uid. */
    public uid: Uint8Array;

    /** IsObjectShareAdmin isAdmin. */
    public isAdmin: boolean;

    /** IsObjectShareAdmin objectType. */
    public objectType: Records.CheckShareAdminObjectType;

    /**
     * Creates a new IsObjectShareAdmin instance using the specified properties.
     * @param [properties] Properties to set
     * @returns IsObjectShareAdmin instance
     */
    public static create(properties?: Records.IIsObjectShareAdmin): Records.IsObjectShareAdmin;

    /**
     * Encodes the specified IsObjectShareAdmin message. Does not implicitly {@link Records.IsObjectShareAdmin.verify|verify} messages.
     * @param message IsObjectShareAdmin message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IIsObjectShareAdmin,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified IsObjectShareAdmin message, length delimited. Does not implicitly {@link Records.IsObjectShareAdmin.verify|verify} messages.
     * @param message IsObjectShareAdmin message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IIsObjectShareAdmin,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an IsObjectShareAdmin message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns IsObjectShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.IsObjectShareAdmin;

    /**
     * Decodes an IsObjectShareAdmin message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns IsObjectShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.IsObjectShareAdmin;

    /**
     * Verifies an IsObjectShareAdmin message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an IsObjectShareAdmin message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns IsObjectShareAdmin
     */
    public static fromObject(object: { [k: string]: any }): Records.IsObjectShareAdmin;

    /**
     * Creates a plain object from an IsObjectShareAdmin message. Also converts values to other types if specified.
     * @param message IsObjectShareAdmin
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.IsObjectShareAdmin,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this IsObjectShareAdmin to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for IsObjectShareAdmin
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AmIShareAdmin. */
  interface IAmIShareAdmin {
    /** AmIShareAdmin isObjectShareAdmin */
    isObjectShareAdmin?: Records.IIsObjectShareAdmin[] | null;
  }

  /** Represents an AmIShareAdmin. */
  class AmIShareAdmin implements IAmIShareAdmin {
    /**
     * Constructs a new AmIShareAdmin.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IAmIShareAdmin);

    /** AmIShareAdmin isObjectShareAdmin. */
    public isObjectShareAdmin: Records.IIsObjectShareAdmin[];

    /**
     * Creates a new AmIShareAdmin instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AmIShareAdmin instance
     */
    public static create(properties?: Records.IAmIShareAdmin): Records.AmIShareAdmin;

    /**
     * Encodes the specified AmIShareAdmin message. Does not implicitly {@link Records.AmIShareAdmin.verify|verify} messages.
     * @param message AmIShareAdmin message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IAmIShareAdmin,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AmIShareAdmin message, length delimited. Does not implicitly {@link Records.AmIShareAdmin.verify|verify} messages.
     * @param message AmIShareAdmin message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IAmIShareAdmin,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AmIShareAdmin message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AmIShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.AmIShareAdmin;

    /**
     * Decodes an AmIShareAdmin message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AmIShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.AmIShareAdmin;

    /**
     * Verifies an AmIShareAdmin message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AmIShareAdmin message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AmIShareAdmin
     */
    public static fromObject(object: { [k: string]: any }): Records.AmIShareAdmin;

    /**
     * Creates a plain object from an AmIShareAdmin message. Also converts values to other types if specified.
     * @param message AmIShareAdmin
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.AmIShareAdmin,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AmIShareAdmin to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AmIShareAdmin
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordShareUpdateRequest. */
  interface IRecordShareUpdateRequest {
    /** RecordShareUpdateRequest addSharedRecord */
    addSharedRecord?: Records.ISharedRecord[] | null;

    /** RecordShareUpdateRequest updateSharedRecord */
    updateSharedRecord?: Records.ISharedRecord[] | null;

    /** RecordShareUpdateRequest removeSharedRecord */
    removeSharedRecord?: Records.ISharedRecord[] | null;

    /** RecordShareUpdateRequest pt */
    pt?: string | null;
  }

  /** Represents a RecordShareUpdateRequest. */
  class RecordShareUpdateRequest implements IRecordShareUpdateRequest {
    /**
     * Constructs a new RecordShareUpdateRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordShareUpdateRequest);

    /** RecordShareUpdateRequest addSharedRecord. */
    public addSharedRecord: Records.ISharedRecord[];

    /** RecordShareUpdateRequest updateSharedRecord. */
    public updateSharedRecord: Records.ISharedRecord[];

    /** RecordShareUpdateRequest removeSharedRecord. */
    public removeSharedRecord: Records.ISharedRecord[];

    /** RecordShareUpdateRequest pt. */
    public pt: string;

    /**
     * Creates a new RecordShareUpdateRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordShareUpdateRequest instance
     */
    public static create(
      properties?: Records.IRecordShareUpdateRequest,
    ): Records.RecordShareUpdateRequest;

    /**
     * Encodes the specified RecordShareUpdateRequest message. Does not implicitly {@link Records.RecordShareUpdateRequest.verify|verify} messages.
     * @param message RecordShareUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordShareUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordShareUpdateRequest message, length delimited. Does not implicitly {@link Records.RecordShareUpdateRequest.verify|verify} messages.
     * @param message RecordShareUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordShareUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordShareUpdateRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordShareUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordShareUpdateRequest;

    /**
     * Decodes a RecordShareUpdateRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordShareUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordShareUpdateRequest;

    /**
     * Verifies a RecordShareUpdateRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordShareUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordShareUpdateRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordShareUpdateRequest;

    /**
     * Creates a plain object from a RecordShareUpdateRequest message. Also converts values to other types if specified.
     * @param message RecordShareUpdateRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordShareUpdateRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordShareUpdateRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordShareUpdateRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedRecord. */
  interface ISharedRecord {
    /** SharedRecord toUsername */
    toUsername?: string | null;

    /** SharedRecord recordUid */
    recordUid?: Uint8Array | null;

    /** SharedRecord recordKey */
    recordKey?: Uint8Array | null;

    /** SharedRecord sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;

    /** SharedRecord teamUid */
    teamUid?: Uint8Array | null;

    /** SharedRecord editable */
    editable?: boolean | null;

    /** SharedRecord shareable */
    shareable?: boolean | null;

    /** SharedRecord transfer */
    transfer?: boolean | null;

    /** SharedRecord useEccKey */
    useEccKey?: boolean | null;

    /** SharedRecord removeVaultData */
    removeVaultData?: boolean | null;

    /** SharedRecord expiration */
    expiration?: number | Long | null;

    /** SharedRecord timerNotificationType */
    timerNotificationType?: Records.TimerNotificationType | null;

    /** SharedRecord rotateOnExpiration */
    rotateOnExpiration?: boolean | null;
  }

  /** Represents a SharedRecord. */
  class SharedRecord implements ISharedRecord {
    /**
     * Constructs a new SharedRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ISharedRecord);

    /** SharedRecord toUsername. */
    public toUsername: string;

    /** SharedRecord recordUid. */
    public recordUid: Uint8Array;

    /** SharedRecord recordKey. */
    public recordKey: Uint8Array;

    /** SharedRecord sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /** SharedRecord teamUid. */
    public teamUid: Uint8Array;

    /** SharedRecord editable. */
    public editable: boolean;

    /** SharedRecord shareable. */
    public shareable: boolean;

    /** SharedRecord transfer. */
    public transfer: boolean;

    /** SharedRecord useEccKey. */
    public useEccKey: boolean;

    /** SharedRecord removeVaultData. */
    public removeVaultData: boolean;

    /** SharedRecord expiration. */
    public expiration: number | Long;

    /** SharedRecord timerNotificationType. */
    public timerNotificationType: Records.TimerNotificationType;

    /** SharedRecord rotateOnExpiration. */
    public rotateOnExpiration: boolean;

    /**
     * Creates a new SharedRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedRecord instance
     */
    public static create(properties?: Records.ISharedRecord): Records.SharedRecord;

    /**
     * Encodes the specified SharedRecord message. Does not implicitly {@link Records.SharedRecord.verify|verify} messages.
     * @param message SharedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ISharedRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedRecord message, length delimited. Does not implicitly {@link Records.SharedRecord.verify|verify} messages.
     * @param message SharedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ISharedRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.SharedRecord;

    /**
     * Decodes a SharedRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.SharedRecord;

    /**
     * Verifies a SharedRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedRecord
     */
    public static fromObject(object: { [k: string]: any }): Records.SharedRecord;

    /**
     * Creates a plain object from a SharedRecord message. Also converts values to other types if specified.
     * @param message SharedRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.SharedRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordShareUpdateResponse. */
  interface IRecordShareUpdateResponse {
    /** RecordShareUpdateResponse addSharedRecordStatus */
    addSharedRecordStatus?: Records.ISharedRecordStatus[] | null;

    /** RecordShareUpdateResponse updateSharedRecordStatus */
    updateSharedRecordStatus?: Records.ISharedRecordStatus[] | null;

    /** RecordShareUpdateResponse removeSharedRecordStatus */
    removeSharedRecordStatus?: Records.ISharedRecordStatus[] | null;
  }

  /** Represents a RecordShareUpdateResponse. */
  class RecordShareUpdateResponse implements IRecordShareUpdateResponse {
    /**
     * Constructs a new RecordShareUpdateResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordShareUpdateResponse);

    /** RecordShareUpdateResponse addSharedRecordStatus. */
    public addSharedRecordStatus: Records.ISharedRecordStatus[];

    /** RecordShareUpdateResponse updateSharedRecordStatus. */
    public updateSharedRecordStatus: Records.ISharedRecordStatus[];

    /** RecordShareUpdateResponse removeSharedRecordStatus. */
    public removeSharedRecordStatus: Records.ISharedRecordStatus[];

    /**
     * Creates a new RecordShareUpdateResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordShareUpdateResponse instance
     */
    public static create(
      properties?: Records.IRecordShareUpdateResponse,
    ): Records.RecordShareUpdateResponse;

    /**
     * Encodes the specified RecordShareUpdateResponse message. Does not implicitly {@link Records.RecordShareUpdateResponse.verify|verify} messages.
     * @param message RecordShareUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordShareUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordShareUpdateResponse message, length delimited. Does not implicitly {@link Records.RecordShareUpdateResponse.verify|verify} messages.
     * @param message RecordShareUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordShareUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordShareUpdateResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordShareUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordShareUpdateResponse;

    /**
     * Decodes a RecordShareUpdateResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordShareUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordShareUpdateResponse;

    /**
     * Verifies a RecordShareUpdateResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordShareUpdateResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordShareUpdateResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordShareUpdateResponse;

    /**
     * Creates a plain object from a RecordShareUpdateResponse message. Also converts values to other types if specified.
     * @param message RecordShareUpdateResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordShareUpdateResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordShareUpdateResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordShareUpdateResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SharedRecordStatus. */
  interface ISharedRecordStatus {
    /** SharedRecordStatus recordUid */
    recordUid?: Uint8Array | null;

    /** SharedRecordStatus status */
    status?: string | null;

    /** SharedRecordStatus message */
    message?: string | null;

    /** SharedRecordStatus username */
    username?: string | null;
  }

  /** Represents a SharedRecordStatus. */
  class SharedRecordStatus implements ISharedRecordStatus {
    /**
     * Constructs a new SharedRecordStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ISharedRecordStatus);

    /** SharedRecordStatus recordUid. */
    public recordUid: Uint8Array;

    /** SharedRecordStatus status. */
    public status: string;

    /** SharedRecordStatus message. */
    public message: string;

    /** SharedRecordStatus username. */
    public username: string;

    /**
     * Creates a new SharedRecordStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SharedRecordStatus instance
     */
    public static create(properties?: Records.ISharedRecordStatus): Records.SharedRecordStatus;

    /**
     * Encodes the specified SharedRecordStatus message. Does not implicitly {@link Records.SharedRecordStatus.verify|verify} messages.
     * @param message SharedRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ISharedRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SharedRecordStatus message, length delimited. Does not implicitly {@link Records.SharedRecordStatus.verify|verify} messages.
     * @param message SharedRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ISharedRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SharedRecordStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SharedRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.SharedRecordStatus;

    /**
     * Decodes a SharedRecordStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SharedRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.SharedRecordStatus;

    /**
     * Verifies a SharedRecordStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SharedRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SharedRecordStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.SharedRecordStatus;

    /**
     * Creates a plain object from a SharedRecordStatus message. Also converts values to other types if specified.
     * @param message SharedRecordStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.SharedRecordStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SharedRecordStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SharedRecordStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetRecordPermissionsRequest. */
  interface IGetRecordPermissionsRequest {
    /** GetRecordPermissionsRequest recordUids */
    recordUids?: Uint8Array[] | null;

    /** GetRecordPermissionsRequest isShareAdmin */
    isShareAdmin?: boolean | null;
  }

  /** Represents a GetRecordPermissionsRequest. */
  class GetRecordPermissionsRequest implements IGetRecordPermissionsRequest {
    /**
     * Constructs a new GetRecordPermissionsRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetRecordPermissionsRequest);

    /** GetRecordPermissionsRequest recordUids. */
    public recordUids: Uint8Array[];

    /** GetRecordPermissionsRequest isShareAdmin. */
    public isShareAdmin: boolean;

    /**
     * Creates a new GetRecordPermissionsRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetRecordPermissionsRequest instance
     */
    public static create(
      properties?: Records.IGetRecordPermissionsRequest,
    ): Records.GetRecordPermissionsRequest;

    /**
     * Encodes the specified GetRecordPermissionsRequest message. Does not implicitly {@link Records.GetRecordPermissionsRequest.verify|verify} messages.
     * @param message GetRecordPermissionsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetRecordPermissionsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetRecordPermissionsRequest message, length delimited. Does not implicitly {@link Records.GetRecordPermissionsRequest.verify|verify} messages.
     * @param message GetRecordPermissionsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetRecordPermissionsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetRecordPermissionsRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetRecordPermissionsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetRecordPermissionsRequest;

    /**
     * Decodes a GetRecordPermissionsRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetRecordPermissionsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetRecordPermissionsRequest;

    /**
     * Verifies a GetRecordPermissionsRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetRecordPermissionsRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetRecordPermissionsRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.GetRecordPermissionsRequest;

    /**
     * Creates a plain object from a GetRecordPermissionsRequest message. Also converts values to other types if specified.
     * @param message GetRecordPermissionsRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetRecordPermissionsRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetRecordPermissionsRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetRecordPermissionsRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetRecordPermissionsResponse. */
  interface IGetRecordPermissionsResponse {
    /** GetRecordPermissionsResponse recordPermissions */
    recordPermissions?: Records.IRecordPermission[] | null;
  }

  /** Represents a GetRecordPermissionsResponse. */
  class GetRecordPermissionsResponse implements IGetRecordPermissionsResponse {
    /**
     * Constructs a new GetRecordPermissionsResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetRecordPermissionsResponse);

    /** GetRecordPermissionsResponse recordPermissions. */
    public recordPermissions: Records.IRecordPermission[];

    /**
     * Creates a new GetRecordPermissionsResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetRecordPermissionsResponse instance
     */
    public static create(
      properties?: Records.IGetRecordPermissionsResponse,
    ): Records.GetRecordPermissionsResponse;

    /**
     * Encodes the specified GetRecordPermissionsResponse message. Does not implicitly {@link Records.GetRecordPermissionsResponse.verify|verify} messages.
     * @param message GetRecordPermissionsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetRecordPermissionsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetRecordPermissionsResponse message, length delimited. Does not implicitly {@link Records.GetRecordPermissionsResponse.verify|verify} messages.
     * @param message GetRecordPermissionsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetRecordPermissionsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetRecordPermissionsResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetRecordPermissionsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetRecordPermissionsResponse;

    /**
     * Decodes a GetRecordPermissionsResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetRecordPermissionsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetRecordPermissionsResponse;

    /**
     * Verifies a GetRecordPermissionsResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetRecordPermissionsResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetRecordPermissionsResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.GetRecordPermissionsResponse;

    /**
     * Creates a plain object from a GetRecordPermissionsResponse message. Also converts values to other types if specified.
     * @param message GetRecordPermissionsResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetRecordPermissionsResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetRecordPermissionsResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetRecordPermissionsResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordPermission. */
  interface IRecordPermission {
    /** RecordPermission recordUid */
    recordUid?: Uint8Array | null;

    /** RecordPermission owner */
    owner?: boolean | null;

    /** RecordPermission canEdit */
    canEdit?: boolean | null;

    /** RecordPermission canShare */
    canShare?: boolean | null;

    /** RecordPermission canTransfer */
    canTransfer?: boolean | null;
  }

  /** Represents a RecordPermission. */
  class RecordPermission implements IRecordPermission {
    /**
     * Constructs a new RecordPermission.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordPermission);

    /** RecordPermission recordUid. */
    public recordUid: Uint8Array;

    /** RecordPermission owner. */
    public owner: boolean;

    /** RecordPermission canEdit. */
    public canEdit: boolean;

    /** RecordPermission canShare. */
    public canShare: boolean;

    /** RecordPermission canTransfer. */
    public canTransfer: boolean;

    /**
     * Creates a new RecordPermission instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordPermission instance
     */
    public static create(properties?: Records.IRecordPermission): Records.RecordPermission;

    /**
     * Encodes the specified RecordPermission message. Does not implicitly {@link Records.RecordPermission.verify|verify} messages.
     * @param message RecordPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordPermission,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordPermission message, length delimited. Does not implicitly {@link Records.RecordPermission.verify|verify} messages.
     * @param message RecordPermission message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordPermission,
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
    ): Records.RecordPermission;

    /**
     * Decodes a RecordPermission message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.RecordPermission;

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
    public static fromObject(object: { [k: string]: any }): Records.RecordPermission;

    /**
     * Creates a plain object from a RecordPermission message. Also converts values to other types if specified.
     * @param message RecordPermission
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordPermission,
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

  /** Properties of a GetShareObjectsRequest. */
  interface IGetShareObjectsRequest {
    /** GetShareObjectsRequest startWith */
    startWith?: string | null;

    /** GetShareObjectsRequest contains */
    contains?: string | null;

    /** GetShareObjectsRequest filtered */
    filtered?: boolean | null;

    /** GetShareObjectsRequest sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;
  }

  /** Represents a GetShareObjectsRequest. */
  class GetShareObjectsRequest implements IGetShareObjectsRequest {
    /**
     * Constructs a new GetShareObjectsRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetShareObjectsRequest);

    /** GetShareObjectsRequest startWith. */
    public startWith: string;

    /** GetShareObjectsRequest contains. */
    public contains: string;

    /** GetShareObjectsRequest filtered. */
    public filtered: boolean;

    /** GetShareObjectsRequest sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /**
     * Creates a new GetShareObjectsRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetShareObjectsRequest instance
     */
    public static create(
      properties?: Records.IGetShareObjectsRequest,
    ): Records.GetShareObjectsRequest;

    /**
     * Encodes the specified GetShareObjectsRequest message. Does not implicitly {@link Records.GetShareObjectsRequest.verify|verify} messages.
     * @param message GetShareObjectsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetShareObjectsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetShareObjectsRequest message, length delimited. Does not implicitly {@link Records.GetShareObjectsRequest.verify|verify} messages.
     * @param message GetShareObjectsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetShareObjectsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetShareObjectsRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetShareObjectsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetShareObjectsRequest;

    /**
     * Decodes a GetShareObjectsRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetShareObjectsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetShareObjectsRequest;

    /**
     * Verifies a GetShareObjectsRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetShareObjectsRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetShareObjectsRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.GetShareObjectsRequest;

    /**
     * Creates a plain object from a GetShareObjectsRequest message. Also converts values to other types if specified.
     * @param message GetShareObjectsRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetShareObjectsRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetShareObjectsRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetShareObjectsRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GetShareObjectsResponse. */
  interface IGetShareObjectsResponse {
    /** GetShareObjectsResponse shareRelationships */
    shareRelationships?: Records.IShareUser[] | null;

    /** GetShareObjectsResponse shareFamilyUsers */
    shareFamilyUsers?: Records.IShareUser[] | null;

    /** GetShareObjectsResponse shareEnterpriseUsers */
    shareEnterpriseUsers?: Records.IShareUser[] | null;

    /** GetShareObjectsResponse shareTeams */
    shareTeams?: Records.IShareTeam[] | null;

    /** GetShareObjectsResponse shareMCTeams */
    shareMCTeams?: Records.IShareTeam[] | null;

    /** GetShareObjectsResponse shareMCEnterpriseUsers */
    shareMCEnterpriseUsers?: Records.IShareUser[] | null;

    /** GetShareObjectsResponse shareEnterpriseNames */
    shareEnterpriseNames?: Records.IShareEnterprise[] | null;
  }

  /** Represents a GetShareObjectsResponse. */
  class GetShareObjectsResponse implements IGetShareObjectsResponse {
    /**
     * Constructs a new GetShareObjectsResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IGetShareObjectsResponse);

    /** GetShareObjectsResponse shareRelationships. */
    public shareRelationships: Records.IShareUser[];

    /** GetShareObjectsResponse shareFamilyUsers. */
    public shareFamilyUsers: Records.IShareUser[];

    /** GetShareObjectsResponse shareEnterpriseUsers. */
    public shareEnterpriseUsers: Records.IShareUser[];

    /** GetShareObjectsResponse shareTeams. */
    public shareTeams: Records.IShareTeam[];

    /** GetShareObjectsResponse shareMCTeams. */
    public shareMCTeams: Records.IShareTeam[];

    /** GetShareObjectsResponse shareMCEnterpriseUsers. */
    public shareMCEnterpriseUsers: Records.IShareUser[];

    /** GetShareObjectsResponse shareEnterpriseNames. */
    public shareEnterpriseNames: Records.IShareEnterprise[];

    /**
     * Creates a new GetShareObjectsResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GetShareObjectsResponse instance
     */
    public static create(
      properties?: Records.IGetShareObjectsResponse,
    ): Records.GetShareObjectsResponse;

    /**
     * Encodes the specified GetShareObjectsResponse message. Does not implicitly {@link Records.GetShareObjectsResponse.verify|verify} messages.
     * @param message GetShareObjectsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IGetShareObjectsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GetShareObjectsResponse message, length delimited. Does not implicitly {@link Records.GetShareObjectsResponse.verify|verify} messages.
     * @param message GetShareObjectsResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IGetShareObjectsResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GetShareObjectsResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GetShareObjectsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.GetShareObjectsResponse;

    /**
     * Decodes a GetShareObjectsResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GetShareObjectsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.GetShareObjectsResponse;

    /**
     * Verifies a GetShareObjectsResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GetShareObjectsResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GetShareObjectsResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.GetShareObjectsResponse;

    /**
     * Creates a plain object from a GetShareObjectsResponse message. Also converts values to other types if specified.
     * @param message GetShareObjectsResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.GetShareObjectsResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GetShareObjectsResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GetShareObjectsResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ShareUser. */
  interface IShareUser {
    /** ShareUser username */
    username?: string | null;

    /** ShareUser fullname */
    fullname?: string | null;

    /** ShareUser enterpriseId */
    enterpriseId?: number | null;

    /** ShareUser status */
    status?: Records.ShareStatus | null;

    /** ShareUser isShareAdmin */
    isShareAdmin?: boolean | null;

    /** ShareUser isAdminOfSharedFolderOwner */
    isAdminOfSharedFolderOwner?: boolean | null;
  }

  /** Represents a ShareUser. */
  class ShareUser implements IShareUser {
    /**
     * Constructs a new ShareUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IShareUser);

    /** ShareUser username. */
    public username: string;

    /** ShareUser fullname. */
    public fullname: string;

    /** ShareUser enterpriseId. */
    public enterpriseId: number;

    /** ShareUser status. */
    public status: Records.ShareStatus;

    /** ShareUser isShareAdmin. */
    public isShareAdmin: boolean;

    /** ShareUser isAdminOfSharedFolderOwner. */
    public isAdminOfSharedFolderOwner: boolean;

    /**
     * Creates a new ShareUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ShareUser instance
     */
    public static create(properties?: Records.IShareUser): Records.ShareUser;

    /**
     * Encodes the specified ShareUser message. Does not implicitly {@link Records.ShareUser.verify|verify} messages.
     * @param message ShareUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IShareUser, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ShareUser message, length delimited. Does not implicitly {@link Records.ShareUser.verify|verify} messages.
     * @param message ShareUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IShareUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ShareUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ShareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.ShareUser;

    /**
     * Decodes a ShareUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ShareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.ShareUser;

    /**
     * Verifies a ShareUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ShareUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ShareUser
     */
    public static fromObject(object: { [k: string]: any }): Records.ShareUser;

    /**
     * Creates a plain object from a ShareUser message. Also converts values to other types if specified.
     * @param message ShareUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.ShareUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ShareUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ShareUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ShareTeam. */
  interface IShareTeam {
    /** ShareTeam teamname */
    teamname?: string | null;

    /** ShareTeam enterpriseId */
    enterpriseId?: number | null;

    /** ShareTeam teamUid */
    teamUid?: Uint8Array | null;
  }

  /** Represents a ShareTeam. */
  class ShareTeam implements IShareTeam {
    /**
     * Constructs a new ShareTeam.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IShareTeam);

    /** ShareTeam teamname. */
    public teamname: string;

    /** ShareTeam enterpriseId. */
    public enterpriseId: number;

    /** ShareTeam teamUid. */
    public teamUid: Uint8Array;

    /**
     * Creates a new ShareTeam instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ShareTeam instance
     */
    public static create(properties?: Records.IShareTeam): Records.ShareTeam;

    /**
     * Encodes the specified ShareTeam message. Does not implicitly {@link Records.ShareTeam.verify|verify} messages.
     * @param message ShareTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Records.IShareTeam, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ShareTeam message, length delimited. Does not implicitly {@link Records.ShareTeam.verify|verify} messages.
     * @param message ShareTeam message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IShareTeam,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ShareTeam message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ShareTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Records.ShareTeam;

    /**
     * Decodes a ShareTeam message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ShareTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.ShareTeam;

    /**
     * Verifies a ShareTeam message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ShareTeam message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ShareTeam
     */
    public static fromObject(object: { [k: string]: any }): Records.ShareTeam;

    /**
     * Creates a plain object from a ShareTeam message. Also converts values to other types if specified.
     * @param message ShareTeam
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.ShareTeam,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ShareTeam to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ShareTeam
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ShareEnterprise. */
  interface IShareEnterprise {
    /** ShareEnterprise enterprisename */
    enterprisename?: string | null;

    /** ShareEnterprise enterpriseId */
    enterpriseId?: number | null;
  }

  /** Represents a ShareEnterprise. */
  class ShareEnterprise implements IShareEnterprise {
    /**
     * Constructs a new ShareEnterprise.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IShareEnterprise);

    /** ShareEnterprise enterprisename. */
    public enterprisename: string;

    /** ShareEnterprise enterpriseId. */
    public enterpriseId: number;

    /**
     * Creates a new ShareEnterprise instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ShareEnterprise instance
     */
    public static create(properties?: Records.IShareEnterprise): Records.ShareEnterprise;

    /**
     * Encodes the specified ShareEnterprise message. Does not implicitly {@link Records.ShareEnterprise.verify|verify} messages.
     * @param message ShareEnterprise message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IShareEnterprise,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ShareEnterprise message, length delimited. Does not implicitly {@link Records.ShareEnterprise.verify|verify} messages.
     * @param message ShareEnterprise message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IShareEnterprise,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ShareEnterprise message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ShareEnterprise
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.ShareEnterprise;

    /**
     * Decodes a ShareEnterprise message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ShareEnterprise
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.ShareEnterprise;

    /**
     * Verifies a ShareEnterprise message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ShareEnterprise message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ShareEnterprise
     */
    public static fromObject(object: { [k: string]: any }): Records.ShareEnterprise;

    /**
     * Creates a plain object from a ShareEnterprise message. Also converts values to other types if specified.
     * @param message ShareEnterprise
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.ShareEnterprise,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ShareEnterprise to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ShareEnterprise
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsOnwershipTransferRequest. */
  interface IRecordsOnwershipTransferRequest {
    /** RecordsOnwershipTransferRequest transferRecords */
    transferRecords?: Records.ITransferRecord[] | null;
  }

  /** Represents a RecordsOnwershipTransferRequest. */
  class RecordsOnwershipTransferRequest implements IRecordsOnwershipTransferRequest {
    /**
     * Constructs a new RecordsOnwershipTransferRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsOnwershipTransferRequest);

    /** RecordsOnwershipTransferRequest transferRecords. */
    public transferRecords: Records.ITransferRecord[];

    /**
     * Creates a new RecordsOnwershipTransferRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsOnwershipTransferRequest instance
     */
    public static create(
      properties?: Records.IRecordsOnwershipTransferRequest,
    ): Records.RecordsOnwershipTransferRequest;

    /**
     * Encodes the specified RecordsOnwershipTransferRequest message. Does not implicitly {@link Records.RecordsOnwershipTransferRequest.verify|verify} messages.
     * @param message RecordsOnwershipTransferRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsOnwershipTransferRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsOnwershipTransferRequest message, length delimited. Does not implicitly {@link Records.RecordsOnwershipTransferRequest.verify|verify} messages.
     * @param message RecordsOnwershipTransferRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsOnwershipTransferRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsOnwershipTransferRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsOnwershipTransferRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsOnwershipTransferRequest;

    /**
     * Decodes a RecordsOnwershipTransferRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsOnwershipTransferRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsOnwershipTransferRequest;

    /**
     * Verifies a RecordsOnwershipTransferRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsOnwershipTransferRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsOnwershipTransferRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsOnwershipTransferRequest;

    /**
     * Creates a plain object from a RecordsOnwershipTransferRequest message. Also converts values to other types if specified.
     * @param message RecordsOnwershipTransferRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsOnwershipTransferRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsOnwershipTransferRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsOnwershipTransferRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TransferRecord. */
  interface ITransferRecord {
    /** TransferRecord username */
    username?: string | null;

    /** TransferRecord recordUid */
    recordUid?: Uint8Array | null;

    /** TransferRecord recordKey */
    recordKey?: Uint8Array | null;

    /** TransferRecord useEccKey */
    useEccKey?: boolean | null;
  }

  /** Represents a TransferRecord. */
  class TransferRecord implements ITransferRecord {
    /**
     * Constructs a new TransferRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITransferRecord);

    /** TransferRecord username. */
    public username: string;

    /** TransferRecord recordUid. */
    public recordUid: Uint8Array;

    /** TransferRecord recordKey. */
    public recordKey: Uint8Array;

    /** TransferRecord useEccKey. */
    public useEccKey: boolean;

    /**
     * Creates a new TransferRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TransferRecord instance
     */
    public static create(properties?: Records.ITransferRecord): Records.TransferRecord;

    /**
     * Encodes the specified TransferRecord message. Does not implicitly {@link Records.TransferRecord.verify|verify} messages.
     * @param message TransferRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITransferRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TransferRecord message, length delimited. Does not implicitly {@link Records.TransferRecord.verify|verify} messages.
     * @param message TransferRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITransferRecord,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TransferRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TransferRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TransferRecord;

    /**
     * Decodes a TransferRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TransferRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Records.TransferRecord;

    /**
     * Verifies a TransferRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TransferRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TransferRecord
     */
    public static fromObject(object: { [k: string]: any }): Records.TransferRecord;

    /**
     * Creates a plain object from a TransferRecord message. Also converts values to other types if specified.
     * @param message TransferRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TransferRecord,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TransferRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TransferRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsOnwershipTransferResponse. */
  interface IRecordsOnwershipTransferResponse {
    /** RecordsOnwershipTransferResponse transferRecordStatus */
    transferRecordStatus?: Records.ITransferRecordStatus[] | null;
  }

  /** Represents a RecordsOnwershipTransferResponse. */
  class RecordsOnwershipTransferResponse implements IRecordsOnwershipTransferResponse {
    /**
     * Constructs a new RecordsOnwershipTransferResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsOnwershipTransferResponse);

    /** RecordsOnwershipTransferResponse transferRecordStatus. */
    public transferRecordStatus: Records.ITransferRecordStatus[];

    /**
     * Creates a new RecordsOnwershipTransferResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsOnwershipTransferResponse instance
     */
    public static create(
      properties?: Records.IRecordsOnwershipTransferResponse,
    ): Records.RecordsOnwershipTransferResponse;

    /**
     * Encodes the specified RecordsOnwershipTransferResponse message. Does not implicitly {@link Records.RecordsOnwershipTransferResponse.verify|verify} messages.
     * @param message RecordsOnwershipTransferResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsOnwershipTransferResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsOnwershipTransferResponse message, length delimited. Does not implicitly {@link Records.RecordsOnwershipTransferResponse.verify|verify} messages.
     * @param message RecordsOnwershipTransferResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsOnwershipTransferResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsOnwershipTransferResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsOnwershipTransferResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsOnwershipTransferResponse;

    /**
     * Decodes a RecordsOnwershipTransferResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsOnwershipTransferResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsOnwershipTransferResponse;

    /**
     * Verifies a RecordsOnwershipTransferResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsOnwershipTransferResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsOnwershipTransferResponse
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Records.RecordsOnwershipTransferResponse;

    /**
     * Creates a plain object from a RecordsOnwershipTransferResponse message. Also converts values to other types if specified.
     * @param message RecordsOnwershipTransferResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsOnwershipTransferResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsOnwershipTransferResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsOnwershipTransferResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TransferRecordStatus. */
  interface ITransferRecordStatus {
    /** TransferRecordStatus username */
    username?: string | null;

    /** TransferRecordStatus recordUid */
    recordUid?: Uint8Array | null;

    /** TransferRecordStatus status */
    status?: string | null;

    /** TransferRecordStatus message */
    message?: string | null;
  }

  /** Represents a TransferRecordStatus. */
  class TransferRecordStatus implements ITransferRecordStatus {
    /**
     * Constructs a new TransferRecordStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITransferRecordStatus);

    /** TransferRecordStatus username. */
    public username: string;

    /** TransferRecordStatus recordUid. */
    public recordUid: Uint8Array;

    /** TransferRecordStatus status. */
    public status: string;

    /** TransferRecordStatus message. */
    public message: string;

    /**
     * Creates a new TransferRecordStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TransferRecordStatus instance
     */
    public static create(properties?: Records.ITransferRecordStatus): Records.TransferRecordStatus;

    /**
     * Encodes the specified TransferRecordStatus message. Does not implicitly {@link Records.TransferRecordStatus.verify|verify} messages.
     * @param message TransferRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITransferRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TransferRecordStatus message, length delimited. Does not implicitly {@link Records.TransferRecordStatus.verify|verify} messages.
     * @param message TransferRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITransferRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TransferRecordStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TransferRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TransferRecordStatus;

    /**
     * Decodes a TransferRecordStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TransferRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.TransferRecordStatus;

    /**
     * Verifies a TransferRecordStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TransferRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TransferRecordStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.TransferRecordStatus;

    /**
     * Creates a plain object from a TransferRecordStatus message. Also converts values to other types if specified.
     * @param message TransferRecordStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TransferRecordStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TransferRecordStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TransferRecordStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareRequest. */
  interface IRecordsUnshareRequest {
    /** RecordsUnshareRequest sharedFolders */
    sharedFolders?: Records.IRecordsUnshareFolder[] | null;

    /** RecordsUnshareRequest users */
    users?: Records.IRecordsUnshareUser[] | null;
  }

  /** Represents a RecordsUnshareRequest. */
  class RecordsUnshareRequest implements IRecordsUnshareRequest {
    /**
     * Constructs a new RecordsUnshareRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareRequest);

    /** RecordsUnshareRequest sharedFolders. */
    public sharedFolders: Records.IRecordsUnshareFolder[];

    /** RecordsUnshareRequest users. */
    public users: Records.IRecordsUnshareUser[];

    /**
     * Creates a new RecordsUnshareRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareRequest instance
     */
    public static create(
      properties?: Records.IRecordsUnshareRequest,
    ): Records.RecordsUnshareRequest;

    /**
     * Encodes the specified RecordsUnshareRequest message. Does not implicitly {@link Records.RecordsUnshareRequest.verify|verify} messages.
     * @param message RecordsUnshareRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareRequest message, length delimited. Does not implicitly {@link Records.RecordsUnshareRequest.verify|verify} messages.
     * @param message RecordsUnshareRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareRequest;

    /**
     * Decodes a RecordsUnshareRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareRequest;

    /**
     * Verifies a RecordsUnshareRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareRequest;

    /**
     * Creates a plain object from a RecordsUnshareRequest message. Also converts values to other types if specified.
     * @param message RecordsUnshareRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareResponse. */
  interface IRecordsUnshareResponse {
    /** RecordsUnshareResponse sharedFolders */
    sharedFolders?: Records.IRecordsUnshareFolderStatus[] | null;

    /** RecordsUnshareResponse users */
    users?: Records.IRecordsUnshareUserStatus[] | null;
  }

  /** Represents a RecordsUnshareResponse. */
  class RecordsUnshareResponse implements IRecordsUnshareResponse {
    /**
     * Constructs a new RecordsUnshareResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareResponse);

    /** RecordsUnshareResponse sharedFolders. */
    public sharedFolders: Records.IRecordsUnshareFolderStatus[];

    /** RecordsUnshareResponse users. */
    public users: Records.IRecordsUnshareUserStatus[];

    /**
     * Creates a new RecordsUnshareResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareResponse instance
     */
    public static create(
      properties?: Records.IRecordsUnshareResponse,
    ): Records.RecordsUnshareResponse;

    /**
     * Encodes the specified RecordsUnshareResponse message. Does not implicitly {@link Records.RecordsUnshareResponse.verify|verify} messages.
     * @param message RecordsUnshareResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareResponse message, length delimited. Does not implicitly {@link Records.RecordsUnshareResponse.verify|verify} messages.
     * @param message RecordsUnshareResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareResponse;

    /**
     * Decodes a RecordsUnshareResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareResponse;

    /**
     * Verifies a RecordsUnshareResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareResponse;

    /**
     * Creates a plain object from a RecordsUnshareResponse message. Also converts values to other types if specified.
     * @param message RecordsUnshareResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareFolder. */
  interface IRecordsUnshareFolder {
    /** RecordsUnshareFolder recordUid */
    recordUid?: Uint8Array | null;

    /** RecordsUnshareFolder sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;
  }

  /** Represents a RecordsUnshareFolder. */
  class RecordsUnshareFolder implements IRecordsUnshareFolder {
    /**
     * Constructs a new RecordsUnshareFolder.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareFolder);

    /** RecordsUnshareFolder recordUid. */
    public recordUid: Uint8Array;

    /** RecordsUnshareFolder sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /**
     * Creates a new RecordsUnshareFolder instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareFolder instance
     */
    public static create(properties?: Records.IRecordsUnshareFolder): Records.RecordsUnshareFolder;

    /**
     * Encodes the specified RecordsUnshareFolder message. Does not implicitly {@link Records.RecordsUnshareFolder.verify|verify} messages.
     * @param message RecordsUnshareFolder message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareFolder,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareFolder message, length delimited. Does not implicitly {@link Records.RecordsUnshareFolder.verify|verify} messages.
     * @param message RecordsUnshareFolder message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareFolder,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareFolder message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareFolder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareFolder;

    /**
     * Decodes a RecordsUnshareFolder message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareFolder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareFolder;

    /**
     * Verifies a RecordsUnshareFolder message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareFolder message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareFolder
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareFolder;

    /**
     * Creates a plain object from a RecordsUnshareFolder message. Also converts values to other types if specified.
     * @param message RecordsUnshareFolder
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareFolder,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareFolder to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareFolder
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareUser. */
  interface IRecordsUnshareUser {
    /** RecordsUnshareUser recordUid */
    recordUid?: Uint8Array | null;

    /** RecordsUnshareUser accountUid */
    accountUid?: Uint8Array | null;
  }

  /** Represents a RecordsUnshareUser. */
  class RecordsUnshareUser implements IRecordsUnshareUser {
    /**
     * Constructs a new RecordsUnshareUser.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareUser);

    /** RecordsUnshareUser recordUid. */
    public recordUid: Uint8Array;

    /** RecordsUnshareUser accountUid. */
    public accountUid: Uint8Array;

    /**
     * Creates a new RecordsUnshareUser instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareUser instance
     */
    public static create(properties?: Records.IRecordsUnshareUser): Records.RecordsUnshareUser;

    /**
     * Encodes the specified RecordsUnshareUser message. Does not implicitly {@link Records.RecordsUnshareUser.verify|verify} messages.
     * @param message RecordsUnshareUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareUser message, length delimited. Does not implicitly {@link Records.RecordsUnshareUser.verify|verify} messages.
     * @param message RecordsUnshareUser message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareUser,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareUser message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareUser;

    /**
     * Decodes a RecordsUnshareUser message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareUser;

    /**
     * Verifies a RecordsUnshareUser message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareUser message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareUser
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareUser;

    /**
     * Creates a plain object from a RecordsUnshareUser message. Also converts values to other types if specified.
     * @param message RecordsUnshareUser
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareUser,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareUser to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareUser
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareFolderStatus. */
  interface IRecordsUnshareFolderStatus {
    /** RecordsUnshareFolderStatus recordUid */
    recordUid?: Uint8Array | null;

    /** RecordsUnshareFolderStatus sharedFolderUid */
    sharedFolderUid?: Uint8Array | null;
  }

  /** Represents a RecordsUnshareFolderStatus. */
  class RecordsUnshareFolderStatus implements IRecordsUnshareFolderStatus {
    /**
     * Constructs a new RecordsUnshareFolderStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareFolderStatus);

    /** RecordsUnshareFolderStatus recordUid. */
    public recordUid: Uint8Array;

    /** RecordsUnshareFolderStatus sharedFolderUid. */
    public sharedFolderUid: Uint8Array;

    /**
     * Creates a new RecordsUnshareFolderStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareFolderStatus instance
     */
    public static create(
      properties?: Records.IRecordsUnshareFolderStatus,
    ): Records.RecordsUnshareFolderStatus;

    /**
     * Encodes the specified RecordsUnshareFolderStatus message. Does not implicitly {@link Records.RecordsUnshareFolderStatus.verify|verify} messages.
     * @param message RecordsUnshareFolderStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareFolderStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareFolderStatus message, length delimited. Does not implicitly {@link Records.RecordsUnshareFolderStatus.verify|verify} messages.
     * @param message RecordsUnshareFolderStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareFolderStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareFolderStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareFolderStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareFolderStatus;

    /**
     * Decodes a RecordsUnshareFolderStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareFolderStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareFolderStatus;

    /**
     * Verifies a RecordsUnshareFolderStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareFolderStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareFolderStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareFolderStatus;

    /**
     * Creates a plain object from a RecordsUnshareFolderStatus message. Also converts values to other types if specified.
     * @param message RecordsUnshareFolderStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareFolderStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareFolderStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareFolderStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RecordsUnshareUserStatus. */
  interface IRecordsUnshareUserStatus {
    /** RecordsUnshareUserStatus recordUid */
    recordUid?: Uint8Array | null;

    /** RecordsUnshareUserStatus accountUid */
    accountUid?: Uint8Array | null;
  }

  /** Represents a RecordsUnshareUserStatus. */
  class RecordsUnshareUserStatus implements IRecordsUnshareUserStatus {
    /**
     * Constructs a new RecordsUnshareUserStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.IRecordsUnshareUserStatus);

    /** RecordsUnshareUserStatus recordUid. */
    public recordUid: Uint8Array;

    /** RecordsUnshareUserStatus accountUid. */
    public accountUid: Uint8Array;

    /**
     * Creates a new RecordsUnshareUserStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RecordsUnshareUserStatus instance
     */
    public static create(
      properties?: Records.IRecordsUnshareUserStatus,
    ): Records.RecordsUnshareUserStatus;

    /**
     * Encodes the specified RecordsUnshareUserStatus message. Does not implicitly {@link Records.RecordsUnshareUserStatus.verify|verify} messages.
     * @param message RecordsUnshareUserStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.IRecordsUnshareUserStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RecordsUnshareUserStatus message, length delimited. Does not implicitly {@link Records.RecordsUnshareUserStatus.verify|verify} messages.
     * @param message RecordsUnshareUserStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.IRecordsUnshareUserStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RecordsUnshareUserStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RecordsUnshareUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.RecordsUnshareUserStatus;

    /**
     * Decodes a RecordsUnshareUserStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RecordsUnshareUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.RecordsUnshareUserStatus;

    /**
     * Verifies a RecordsUnshareUserStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RecordsUnshareUserStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RecordsUnshareUserStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.RecordsUnshareUserStatus;

    /**
     * Creates a plain object from a RecordsUnshareUserStatus message. Also converts values to other types if specified.
     * @param message RecordsUnshareUserStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.RecordsUnshareUserStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RecordsUnshareUserStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RecordsUnshareUserStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TimedAccessCallbackPayload. */
  interface ITimedAccessCallbackPayload {
    /** TimedAccessCallbackPayload timeLimitedAccessType */
    timeLimitedAccessType?: Records.TimeLimitedAccessType | null;
  }

  /** Represents a TimedAccessCallbackPayload. */
  class TimedAccessCallbackPayload implements ITimedAccessCallbackPayload {
    /**
     * Constructs a new TimedAccessCallbackPayload.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITimedAccessCallbackPayload);

    /** TimedAccessCallbackPayload timeLimitedAccessType. */
    public timeLimitedAccessType: Records.TimeLimitedAccessType;

    /**
     * Creates a new TimedAccessCallbackPayload instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimedAccessCallbackPayload instance
     */
    public static create(
      properties?: Records.ITimedAccessCallbackPayload,
    ): Records.TimedAccessCallbackPayload;

    /**
     * Encodes the specified TimedAccessCallbackPayload message. Does not implicitly {@link Records.TimedAccessCallbackPayload.verify|verify} messages.
     * @param message TimedAccessCallbackPayload message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITimedAccessCallbackPayload,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TimedAccessCallbackPayload message, length delimited. Does not implicitly {@link Records.TimedAccessCallbackPayload.verify|verify} messages.
     * @param message TimedAccessCallbackPayload message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITimedAccessCallbackPayload,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TimedAccessCallbackPayload message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimedAccessCallbackPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TimedAccessCallbackPayload;

    /**
     * Decodes a TimedAccessCallbackPayload message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimedAccessCallbackPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.TimedAccessCallbackPayload;

    /**
     * Verifies a TimedAccessCallbackPayload message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TimedAccessCallbackPayload message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimedAccessCallbackPayload
     */
    public static fromObject(object: { [k: string]: any }): Records.TimedAccessCallbackPayload;

    /**
     * Creates a plain object from a TimedAccessCallbackPayload message. Also converts values to other types if specified.
     * @param message TimedAccessCallbackPayload
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TimedAccessCallbackPayload,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TimedAccessCallbackPayload to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TimedAccessCallbackPayload
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TimeLimitedAccessRequest. */
  interface ITimeLimitedAccessRequest {
    /** TimeLimitedAccessRequest accountUid */
    accountUid?: Uint8Array[] | null;

    /** TimeLimitedAccessRequest teamUid */
    teamUid?: Uint8Array[] | null;

    /** TimeLimitedAccessRequest recordUid */
    recordUid?: Uint8Array[] | null;

    /** TimeLimitedAccessRequest sharedObjectUid */
    sharedObjectUid?: Uint8Array | null;

    /** TimeLimitedAccessRequest timeLimitedAccessType */
    timeLimitedAccessType?: Records.TimeLimitedAccessType | null;

    /** TimeLimitedAccessRequest expiration */
    expiration?: number | Long | null;

    /** TimeLimitedAccessRequest timerNotificationType */
    timerNotificationType?: Records.TimerNotificationType | null;
  }

  /** Represents a TimeLimitedAccessRequest. */
  class TimeLimitedAccessRequest implements ITimeLimitedAccessRequest {
    /**
     * Constructs a new TimeLimitedAccessRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITimeLimitedAccessRequest);

    /** TimeLimitedAccessRequest accountUid. */
    public accountUid: Uint8Array[];

    /** TimeLimitedAccessRequest teamUid. */
    public teamUid: Uint8Array[];

    /** TimeLimitedAccessRequest recordUid. */
    public recordUid: Uint8Array[];

    /** TimeLimitedAccessRequest sharedObjectUid. */
    public sharedObjectUid: Uint8Array;

    /** TimeLimitedAccessRequest timeLimitedAccessType. */
    public timeLimitedAccessType: Records.TimeLimitedAccessType;

    /** TimeLimitedAccessRequest expiration. */
    public expiration: number | Long;

    /** TimeLimitedAccessRequest timerNotificationType. */
    public timerNotificationType: Records.TimerNotificationType;

    /**
     * Creates a new TimeLimitedAccessRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimeLimitedAccessRequest instance
     */
    public static create(
      properties?: Records.ITimeLimitedAccessRequest,
    ): Records.TimeLimitedAccessRequest;

    /**
     * Encodes the specified TimeLimitedAccessRequest message. Does not implicitly {@link Records.TimeLimitedAccessRequest.verify|verify} messages.
     * @param message TimeLimitedAccessRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITimeLimitedAccessRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TimeLimitedAccessRequest message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessRequest.verify|verify} messages.
     * @param message TimeLimitedAccessRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITimeLimitedAccessRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TimeLimitedAccessRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimeLimitedAccessRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TimeLimitedAccessRequest;

    /**
     * Decodes a TimeLimitedAccessRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimeLimitedAccessRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.TimeLimitedAccessRequest;

    /**
     * Verifies a TimeLimitedAccessRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TimeLimitedAccessRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimeLimitedAccessRequest
     */
    public static fromObject(object: { [k: string]: any }): Records.TimeLimitedAccessRequest;

    /**
     * Creates a plain object from a TimeLimitedAccessRequest message. Also converts values to other types if specified.
     * @param message TimeLimitedAccessRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TimeLimitedAccessRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TimeLimitedAccessRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TimeLimitedAccessRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TimeLimitedAccessStatus. */
  interface ITimeLimitedAccessStatus {
    /** TimeLimitedAccessStatus uid */
    uid?: Uint8Array | null;

    /** TimeLimitedAccessStatus message */
    message?: string | null;
  }

  /** Represents a TimeLimitedAccessStatus. */
  class TimeLimitedAccessStatus implements ITimeLimitedAccessStatus {
    /**
     * Constructs a new TimeLimitedAccessStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITimeLimitedAccessStatus);

    /** TimeLimitedAccessStatus uid. */
    public uid: Uint8Array;

    /** TimeLimitedAccessStatus message. */
    public message: string;

    /**
     * Creates a new TimeLimitedAccessStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimeLimitedAccessStatus instance
     */
    public static create(
      properties?: Records.ITimeLimitedAccessStatus,
    ): Records.TimeLimitedAccessStatus;

    /**
     * Encodes the specified TimeLimitedAccessStatus message. Does not implicitly {@link Records.TimeLimitedAccessStatus.verify|verify} messages.
     * @param message TimeLimitedAccessStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITimeLimitedAccessStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TimeLimitedAccessStatus message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessStatus.verify|verify} messages.
     * @param message TimeLimitedAccessStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITimeLimitedAccessStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TimeLimitedAccessStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimeLimitedAccessStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TimeLimitedAccessStatus;

    /**
     * Decodes a TimeLimitedAccessStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimeLimitedAccessStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.TimeLimitedAccessStatus;

    /**
     * Verifies a TimeLimitedAccessStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TimeLimitedAccessStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimeLimitedAccessStatus
     */
    public static fromObject(object: { [k: string]: any }): Records.TimeLimitedAccessStatus;

    /**
     * Creates a plain object from a TimeLimitedAccessStatus message. Also converts values to other types if specified.
     * @param message TimeLimitedAccessStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TimeLimitedAccessStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TimeLimitedAccessStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TimeLimitedAccessStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a TimeLimitedAccessResponse. */
  interface ITimeLimitedAccessResponse {
    /** TimeLimitedAccessResponse revision */
    revision?: number | Long | null;

    /** TimeLimitedAccessResponse userAccessStatus */
    userAccessStatus?: Records.ITimeLimitedAccessStatus[] | null;

    /** TimeLimitedAccessResponse teamAccessStatus */
    teamAccessStatus?: Records.ITimeLimitedAccessStatus[] | null;

    /** TimeLimitedAccessResponse recordAccessStatus */
    recordAccessStatus?: Records.ITimeLimitedAccessStatus[] | null;
  }

  /** Represents a TimeLimitedAccessResponse. */
  class TimeLimitedAccessResponse implements ITimeLimitedAccessResponse {
    /**
     * Constructs a new TimeLimitedAccessResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Records.ITimeLimitedAccessResponse);

    /** TimeLimitedAccessResponse revision. */
    public revision: number | Long;

    /** TimeLimitedAccessResponse userAccessStatus. */
    public userAccessStatus: Records.ITimeLimitedAccessStatus[];

    /** TimeLimitedAccessResponse teamAccessStatus. */
    public teamAccessStatus: Records.ITimeLimitedAccessStatus[];

    /** TimeLimitedAccessResponse recordAccessStatus. */
    public recordAccessStatus: Records.ITimeLimitedAccessStatus[];

    /**
     * Creates a new TimeLimitedAccessResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimeLimitedAccessResponse instance
     */
    public static create(
      properties?: Records.ITimeLimitedAccessResponse,
    ): Records.TimeLimitedAccessResponse;

    /**
     * Encodes the specified TimeLimitedAccessResponse message. Does not implicitly {@link Records.TimeLimitedAccessResponse.verify|verify} messages.
     * @param message TimeLimitedAccessResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Records.ITimeLimitedAccessResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified TimeLimitedAccessResponse message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessResponse.verify|verify} messages.
     * @param message TimeLimitedAccessResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Records.ITimeLimitedAccessResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a TimeLimitedAccessResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimeLimitedAccessResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Records.TimeLimitedAccessResponse;

    /**
     * Decodes a TimeLimitedAccessResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimeLimitedAccessResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Records.TimeLimitedAccessResponse;

    /**
     * Verifies a TimeLimitedAccessResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a TimeLimitedAccessResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimeLimitedAccessResponse
     */
    public static fromObject(object: { [k: string]: any }): Records.TimeLimitedAccessResponse;

    /**
     * Creates a plain object from a TimeLimitedAccessResponse message. Also converts values to other types if specified.
     * @param message TimeLimitedAccessResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Records.TimeLimitedAccessResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this TimeLimitedAccessResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TimeLimitedAccessResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
