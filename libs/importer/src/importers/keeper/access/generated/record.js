import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf enum Records.RecordTypeScope
 */
export var RecordTypeScope;
(function (RecordTypeScope) {
  /**
   * @generated from protobuf enum value: RT_STANDARD = 0;
   */
  RecordTypeScope[(RecordTypeScope["RT_STANDARD"] = 0)] = "RT_STANDARD";
  /**
   * @generated from protobuf enum value: RT_USER = 1;
   */
  RecordTypeScope[(RecordTypeScope["RT_USER"] = 1)] = "RT_USER";
  /**
   * @generated from protobuf enum value: RT_ENTERPRISE = 2;
   */
  RecordTypeScope[(RecordTypeScope["RT_ENTERPRISE"] = 2)] = "RT_ENTERPRISE";
  /**
   * @generated from protobuf enum value: RT_PAM = 3;
   */
  RecordTypeScope[(RecordTypeScope["RT_PAM"] = 3)] = "RT_PAM";
  /**
   * @generated from protobuf enum value: RT_PAM_CONFIGURATION = 4;
   */
  RecordTypeScope[(RecordTypeScope["RT_PAM_CONFIGURATION"] = 4)] = "RT_PAM_CONFIGURATION";
})(RecordTypeScope || (RecordTypeScope = {}));
/**
 * @generated from protobuf enum Records.RecordKeyType
 */
export var RecordKeyType;
(function (RecordKeyType) {
  /**
   * @generated from protobuf enum value: NO_KEY = 0;
   */
  RecordKeyType[(RecordKeyType["NO_KEY"] = 0)] = "NO_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_DATA_KEY = 1;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_DATA_KEY"] = 1)] = "ENCRYPTED_BY_DATA_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_PUBLIC_KEY = 2;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_PUBLIC_KEY"] = 2)] = "ENCRYPTED_BY_PUBLIC_KEY";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_DATA_KEY_GCM = 3;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_DATA_KEY_GCM"] = 3)] = "ENCRYPTED_BY_DATA_KEY_GCM";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_PUBLIC_KEY_ECC = 4;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_PUBLIC_KEY_ECC"] = 4)] = "ENCRYPTED_BY_PUBLIC_KEY_ECC";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_ROOT_KEY_CBC = 5;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_ROOT_KEY_CBC"] = 5)] = "ENCRYPTED_BY_ROOT_KEY_CBC";
  /**
   * @generated from protobuf enum value: ENCRYPTED_BY_ROOT_KEY_GCM = 6;
   */
  RecordKeyType[(RecordKeyType["ENCRYPTED_BY_ROOT_KEY_GCM"] = 6)] = "ENCRYPTED_BY_ROOT_KEY_GCM";
})(RecordKeyType || (RecordKeyType = {}));
/**
 * @generated from protobuf enum Records.RecordFolderType
 */
export var RecordFolderType;
(function (RecordFolderType) {
  /**
   * @generated from protobuf enum value: user_folder = 0;
   */
  RecordFolderType[(RecordFolderType["user_folder"] = 0)] = "user_folder";
  /**
   * @generated from protobuf enum value: shared_folder = 1;
   */
  RecordFolderType[(RecordFolderType["shared_folder"] = 1)] = "shared_folder";
  /**
   * @generated from protobuf enum value: shared_folder_folder = 2;
   */
  RecordFolderType[(RecordFolderType["shared_folder_folder"] = 2)] = "shared_folder_folder";
})(RecordFolderType || (RecordFolderType = {}));
/**
 * @generated from protobuf enum Records.RecordModifyResult
 */
export var RecordModifyResult;
(function (RecordModifyResult) {
  /**
   * @generated from protobuf enum value: RS_SUCCESS = 0;
   */
  RecordModifyResult[(RecordModifyResult["RS_SUCCESS"] = 0)] = "RS_SUCCESS";
  /**
   * @generated from protobuf enum value: RS_OUT_OF_SYNC = 1;
   */
  RecordModifyResult[(RecordModifyResult["RS_OUT_OF_SYNC"] = 1)] = "RS_OUT_OF_SYNC";
  /**
   * @generated from protobuf enum value: RS_ACCESS_DENIED = 2;
   */
  RecordModifyResult[(RecordModifyResult["RS_ACCESS_DENIED"] = 2)] = "RS_ACCESS_DENIED";
  /**
   * @generated from protobuf enum value: RS_SHARE_DENIED = 3;
   */
  RecordModifyResult[(RecordModifyResult["RS_SHARE_DENIED"] = 3)] = "RS_SHARE_DENIED";
  /**
   * @generated from protobuf enum value: RS_RECORD_EXISTS = 4;
   */
  RecordModifyResult[(RecordModifyResult["RS_RECORD_EXISTS"] = 4)] = "RS_RECORD_EXISTS";
  /**
   * @generated from protobuf enum value: RS_OLD_RECORD_VERSION_TYPE = 5;
   */
  RecordModifyResult[(RecordModifyResult["RS_OLD_RECORD_VERSION_TYPE"] = 5)] =
    "RS_OLD_RECORD_VERSION_TYPE";
  /**
   * @generated from protobuf enum value: RS_NEW_RECORD_VERSION_TYPE = 6;
   */
  RecordModifyResult[(RecordModifyResult["RS_NEW_RECORD_VERSION_TYPE"] = 6)] =
    "RS_NEW_RECORD_VERSION_TYPE";
  /**
   * @generated from protobuf enum value: RS_FILES_NOT_MATCH = 7;
   */
  RecordModifyResult[(RecordModifyResult["RS_FILES_NOT_MATCH"] = 7)] = "RS_FILES_NOT_MATCH";
  /**
   * @generated from protobuf enum value: RS_RECORD_NOT_SHAREABLE = 8;
   */
  RecordModifyResult[(RecordModifyResult["RS_RECORD_NOT_SHAREABLE"] = 8)] =
    "RS_RECORD_NOT_SHAREABLE";
  /**
   * @generated from protobuf enum value: RS_ATTACHMENT_NOT_SHAREABLE = 9;
   */
  RecordModifyResult[(RecordModifyResult["RS_ATTACHMENT_NOT_SHAREABLE"] = 9)] =
    "RS_ATTACHMENT_NOT_SHAREABLE";
  /**
   * @generated from protobuf enum value: RS_FILE_LIMIT_REACHED = 10;
   */
  RecordModifyResult[(RecordModifyResult["RS_FILE_LIMIT_REACHED"] = 10)] = "RS_FILE_LIMIT_REACHED";
  /**
   * @generated from protobuf enum value: RS_SIZE_EXCEEDED_LIMIT = 11;
   */
  RecordModifyResult[(RecordModifyResult["RS_SIZE_EXCEEDED_LIMIT"] = 11)] =
    "RS_SIZE_EXCEEDED_LIMIT";
  /**
   * @generated from protobuf enum value: RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS = 12;
   */
  RecordModifyResult[(RecordModifyResult["RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS"] = 12)] =
    "RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS";
})(RecordModifyResult || (RecordModifyResult = {}));
/**
 * @generated from protobuf enum Records.FileAddResult
 */
export var FileAddResult;
(function (FileAddResult) {
  /**
   * @generated from protobuf enum value: FA_SUCCESS = 0;
   */
  FileAddResult[(FileAddResult["FA_SUCCESS"] = 0)] = "FA_SUCCESS";
  /**
   * @generated from protobuf enum value: FA_ERROR = 1;
   */
  FileAddResult[(FileAddResult["FA_ERROR"] = 1)] = "FA_ERROR";
})(FileAddResult || (FileAddResult = {}));
/**
 * @generated from protobuf enum Records.FileGetResult
 */
export var FileGetResult;
(function (FileGetResult) {
  /**
   * @generated from protobuf enum value: FG_SUCCESS = 0;
   */
  FileGetResult[(FileGetResult["FG_SUCCESS"] = 0)] = "FG_SUCCESS";
  /**
   * @generated from protobuf enum value: FG_ERROR = 1;
   */
  FileGetResult[(FileGetResult["FG_ERROR"] = 1)] = "FG_ERROR";
  /**
   * @generated from protobuf enum value: FG_ACCESS_DENIED = 2;
   */
  FileGetResult[(FileGetResult["FG_ACCESS_DENIED"] = 2)] = "FG_ACCESS_DENIED";
})(FileGetResult || (FileGetResult = {}));
/**
 * @generated from protobuf enum Records.RecordDetailsInclude
 */
export var RecordDetailsInclude;
(function (RecordDetailsInclude) {
  /**
   * @generated from protobuf enum value: DATA_PLUS_SHARE = 0;
   */
  RecordDetailsInclude[(RecordDetailsInclude["DATA_PLUS_SHARE"] = 0)] = "DATA_PLUS_SHARE";
  /**
   * @generated from protobuf enum value: DATA_ONLY = 1;
   */
  RecordDetailsInclude[(RecordDetailsInclude["DATA_ONLY"] = 1)] = "DATA_ONLY";
  /**
   * @generated from protobuf enum value: SHARE_ONLY = 2;
   */
  RecordDetailsInclude[(RecordDetailsInclude["SHARE_ONLY"] = 2)] = "SHARE_ONLY";
})(RecordDetailsInclude || (RecordDetailsInclude = {}));
/**
 * @generated from protobuf enum Records.CheckShareAdminObjectType
 */
export var CheckShareAdminObjectType;
(function (CheckShareAdminObjectType) {
  /**
   * @generated from protobuf enum value: CHECK_SA_INVALID_TYPE = 0;
   */
  CheckShareAdminObjectType[(CheckShareAdminObjectType["CHECK_SA_INVALID_TYPE"] = 0)] =
    "CHECK_SA_INVALID_TYPE";
  /**
   * @generated from protobuf enum value: CHECK_SA_ON_SF = 1;
   */
  CheckShareAdminObjectType[(CheckShareAdminObjectType["CHECK_SA_ON_SF"] = 1)] = "CHECK_SA_ON_SF";
  /**
   * @generated from protobuf enum value: CHECK_SA_ON_RECORD = 2;
   */
  CheckShareAdminObjectType[(CheckShareAdminObjectType["CHECK_SA_ON_RECORD"] = 2)] =
    "CHECK_SA_ON_RECORD";
})(CheckShareAdminObjectType || (CheckShareAdminObjectType = {}));
/**
 * @generated from protobuf enum Records.ShareStatus
 */
export var ShareStatus;
(function (ShareStatus) {
  /**
   * @generated from protobuf enum value: ACTIVE = 0;
   */
  ShareStatus[(ShareStatus["ACTIVE"] = 0)] = "ACTIVE";
  /**
   * @generated from protobuf enum value: BLOCK = 1;
   */
  ShareStatus[(ShareStatus["BLOCK"] = 1)] = "BLOCK";
  /**
   * @generated from protobuf enum value: INVITED = 2;
   */
  ShareStatus[(ShareStatus["INVITED"] = 2)] = "INVITED";
})(ShareStatus || (ShareStatus = {}));
/**
 * @generated from protobuf enum Records.RecordTransactionType
 */
export var RecordTransactionType;
(function (RecordTransactionType) {
  /**
   * @generated from protobuf enum value: RTT_GENERAL = 0;
   */
  RecordTransactionType[(RecordTransactionType["RTT_GENERAL"] = 0)] = "RTT_GENERAL";
  /**
   * @generated from protobuf enum value: RTT_ROTATION = 1;
   */
  RecordTransactionType[(RecordTransactionType["RTT_ROTATION"] = 1)] = "RTT_ROTATION";
})(RecordTransactionType || (RecordTransactionType = {}));
/**
 * @generated from protobuf enum Records.TimeLimitedAccessType
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
  /**
   * @generated from protobuf enum value: USER_ACCESS_TO_SHAREDFOLDER = 4;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["USER_ACCESS_TO_SHAREDFOLDER"] = 4)] =
    "USER_ACCESS_TO_SHAREDFOLDER";
  /**
   * @generated from protobuf enum value: TEAM_ACCESS_TO_SHAREDFOLDER = 5;
   */
  TimeLimitedAccessType[(TimeLimitedAccessType["TEAM_ACCESS_TO_SHAREDFOLDER"] = 5)] =
    "TEAM_ACCESS_TO_SHAREDFOLDER";
})(TimeLimitedAccessType || (TimeLimitedAccessType = {}));
/**
 * @generated from protobuf enum Records.TimerNotificationType
 */
export var TimerNotificationType;
(function (TimerNotificationType) {
  /**
   * @generated from protobuf enum value: NOTIFICATION_OFF = 0;
   */
  TimerNotificationType[(TimerNotificationType["NOTIFICATION_OFF"] = 0)] = "NOTIFICATION_OFF";
  /**
   * @generated from protobuf enum value: NOTIFY_OWNER = 1;
   */
  TimerNotificationType[(TimerNotificationType["NOTIFY_OWNER"] = 1)] = "NOTIFY_OWNER";
  /**
   * @generated from protobuf enum value: NOTIFY_PRIVILEGED_USERS = 2;
   */
  TimerNotificationType[(TimerNotificationType["NOTIFY_PRIVILEGED_USERS"] = 2)] =
    "NOTIFY_PRIVILEGED_USERS";
})(TimerNotificationType || (TimerNotificationType = {}));
// @generated message type with reflection information, may provide speed optimized methods
class RecordType$Type extends MessageType {
  constructor() {
    super("Records.RecordType", [
      { no: 1, name: "recordTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "content", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "scope", kind: "enum", T: () => ["Records.RecordTypeScope", RecordTypeScope] },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordTypeId = 0;
    message.content = "";
    message.scope = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 recordTypeId */ 1:
          message.recordTypeId = reader.int32();
          break;
        case /* string content */ 2:
          message.content = reader.string();
          break;
        case /* Records.RecordTypeScope scope */ 3:
          message.scope = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 recordTypeId = 1; */
    if (message.recordTypeId !== 0) writer.tag(1, WireType.Varint).int32(message.recordTypeId);
    /* string content = 2; */
    if (message.content !== "") writer.tag(2, WireType.LengthDelimited).string(message.content);
    /* Records.RecordTypeScope scope = 3; */
    if (message.scope !== 0) writer.tag(3, WireType.Varint).int32(message.scope);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordType
 */
export const RecordType = new RecordType$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordTypesRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordTypesRequest", [
      { no: 1, name: "standard", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 2, name: "user", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "enterprise", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "pam", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.standard = false;
    message.user = false;
    message.enterprise = false;
    message.pam = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool standard */ 1:
          message.standard = reader.bool();
          break;
        case /* bool user */ 2:
          message.user = reader.bool();
          break;
        case /* bool enterprise */ 3:
          message.enterprise = reader.bool();
          break;
        case /* bool pam */ 4:
          message.pam = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool standard = 1; */
    if (message.standard !== false) writer.tag(1, WireType.Varint).bool(message.standard);
    /* bool user = 2; */
    if (message.user !== false) writer.tag(2, WireType.Varint).bool(message.user);
    /* bool enterprise = 3; */
    if (message.enterprise !== false) writer.tag(3, WireType.Varint).bool(message.enterprise);
    /* bool pam = 4; */
    if (message.pam !== false) writer.tag(4, WireType.Varint).bool(message.pam);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordTypesRequest
 */
export const RecordTypesRequest = new RecordTypesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordTypesResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordTypesResponse", [
      {
        no: 1,
        name: "recordTypes",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordType,
      },
      { no: 2, name: "standardCounter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "userCounter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "enterpriseCounter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "pamCounter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordTypes = [];
    message.standardCounter = 0;
    message.userCounter = 0;
    message.enterpriseCounter = 0;
    message.pamCounter = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.RecordType recordTypes */ 1:
          message.recordTypes.push(RecordType.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* int32 standardCounter */ 2:
          message.standardCounter = reader.int32();
          break;
        case /* int32 userCounter */ 3:
          message.userCounter = reader.int32();
          break;
        case /* int32 enterpriseCounter */ 4:
          message.enterpriseCounter = reader.int32();
          break;
        case /* int32 pamCounter */ 5:
          message.pamCounter = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordType recordTypes = 1; */
    for (let i = 0; i < message.recordTypes.length; i++)
      RecordType.internalBinaryWrite(
        message.recordTypes[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int32 standardCounter = 2; */
    if (message.standardCounter !== 0)
      writer.tag(2, WireType.Varint).int32(message.standardCounter);
    /* int32 userCounter = 3; */
    if (message.userCounter !== 0) writer.tag(3, WireType.Varint).int32(message.userCounter);
    /* int32 enterpriseCounter = 4; */
    if (message.enterpriseCounter !== 0)
      writer.tag(4, WireType.Varint).int32(message.enterpriseCounter);
    /* int32 pamCounter = 5; */
    if (message.pamCounter !== 0) writer.tag(5, WireType.Varint).int32(message.pamCounter);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordTypesResponse
 */
export const RecordTypesResponse = new RecordTypesResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordTypeModifyResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordTypeModifyResponse", [
      { no: 1, name: "recordTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "counter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordTypeId = 0;
    message.counter = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 recordTypeId */ 1:
          message.recordTypeId = reader.int32();
          break;
        case /* int32 counter */ 2:
          message.counter = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 recordTypeId = 1; */
    if (message.recordTypeId !== 0) writer.tag(1, WireType.Varint).int32(message.recordTypeId);
    /* int32 counter = 2; */
    if (message.counter !== 0) writer.tag(2, WireType.Varint).int32(message.counter);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordTypeModifyResponse
 */
export const RecordTypeModifyResponse = new RecordTypeModifyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsGetRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsGetRequest", [
      {
        no: 1,
        name: "record_uids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 2,
        name: "client_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUids = [];
    message.clientTime = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes record_uids */ 1:
          message.recordUids.push(reader.bytes());
          break;
        case /* int64 client_time */ 2:
          message.clientTime = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes record_uids = 1; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.recordUids[i]);
    /* int64 client_time = 2; */
    if (message.clientTime !== 0n) writer.tag(2, WireType.Varint).int64(message.clientTime);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsGetRequest
 */
export const RecordsGetRequest = new RecordsGetRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Record$Type extends MessageType {
  constructor() {
    super("Records.Record", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "record_key_type",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "extra", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 7,
        name: "client_modified_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 8,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 9,
        name: "file_ids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.recordKeyType = 0;
    message.data = new Uint8Array(0);
    message.extra = new Uint8Array(0);
    message.version = 0;
    message.clientModifiedTime = 0n;
    message.revision = 0n;
    message.fileIds = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes record_key */ 2:
          message.recordKey = reader.bytes();
          break;
        case /* Records.RecordKeyType record_key_type */ 3:
          message.recordKeyType = reader.int32();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* bytes extra */ 5:
          message.extra = reader.bytes();
          break;
        case /* int32 version */ 6:
          message.version = reader.int32();
          break;
        case /* int64 client_modified_time */ 7:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* int64 revision */ 8:
          message.revision = reader.int64().toBigInt();
          break;
        case /* repeated bytes file_ids */ 9:
          message.fileIds.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes record_key = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    /* Records.RecordKeyType record_key_type = 3; */
    if (message.recordKeyType !== 0) writer.tag(3, WireType.Varint).int32(message.recordKeyType);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* bytes extra = 5; */
    if (message.extra.length) writer.tag(5, WireType.LengthDelimited).bytes(message.extra);
    /* int32 version = 6; */
    if (message.version !== 0) writer.tag(6, WireType.Varint).int32(message.version);
    /* int64 client_modified_time = 7; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(7, WireType.Varint).int64(message.clientModifiedTime);
    /* int64 revision = 8; */
    if (message.revision !== 0n) writer.tag(8, WireType.Varint).int64(message.revision);
    /* repeated bytes file_ids = 9; */
    for (let i = 0; i < message.fileIds.length; i++)
      writer.tag(9, WireType.LengthDelimited).bytes(message.fileIds[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.Record
 */
export const Record = new Record$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FolderRecordKey$Type extends MessageType {
  constructor() {
    super("Records.FolderRecordKey", [
      { no: 1, name: "folder_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.folderUid = new Uint8Array(0);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes folder_uid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes record_uid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* bytes record_key */ 3:
          message.recordKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes folder_uid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes record_uid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes record_key = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.FolderRecordKey
 */
export const FolderRecordKey = new FolderRecordKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Folder$Type extends MessageType {
  constructor() {
    super("Records.Folder", [
      { no: 1, name: "folder_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "folder_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "folder_key_type",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.folderUid = new Uint8Array(0);
    message.folderKey = new Uint8Array(0);
    message.folderKeyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes folder_uid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes folder_key */ 2:
          message.folderKey = reader.bytes();
          break;
        case /* Records.RecordKeyType folder_key_type */ 3:
          message.folderKeyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes folder_uid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes folder_key = 2; */
    if (message.folderKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.folderKey);
    /* Records.RecordKeyType folder_key_type = 3; */
    if (message.folderKeyType !== 0) writer.tag(3, WireType.Varint).int32(message.folderKeyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.Folder
 */
export const Folder = new Folder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Team$Type extends MessageType {
  constructor() {
    super("Records.Team", [
      { no: 1, name: "team_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "team_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "team_private_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "team_key_type",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
      {
        no: 5,
        name: "folders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Folder,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.teamKey = new Uint8Array(0);
    message.teamPrivateKey = new Uint8Array(0);
    message.teamKeyType = 0;
    message.folders = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes team_uid */ 1:
          message.teamUid = reader.bytes();
          break;
        case /* bytes team_key */ 2:
          message.teamKey = reader.bytes();
          break;
        case /* bytes team_private_key */ 3:
          message.teamPrivateKey = reader.bytes();
          break;
        case /* Records.RecordKeyType team_key_type */ 4:
          message.teamKeyType = reader.int32();
          break;
        case /* repeated Records.Folder folders */ 5:
          message.folders.push(Folder.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes team_uid = 1; */
    if (message.teamUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.teamUid);
    /* bytes team_key = 2; */
    if (message.teamKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.teamKey);
    /* bytes team_private_key = 3; */
    if (message.teamPrivateKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.teamPrivateKey);
    /* Records.RecordKeyType team_key_type = 4; */
    if (message.teamKeyType !== 0) writer.tag(4, WireType.Varint).int32(message.teamKeyType);
    /* repeated Records.Folder folders = 5; */
    for (let i = 0; i < message.folders.length; i++)
      Folder.internalBinaryWrite(
        message.folders[i],
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.Team
 */
export const Team = new Team$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsGetResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordsGetResponse", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Record,
      },
      {
        no: 2,
        name: "folder_record_keys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => FolderRecordKey,
      },
      {
        no: 3,
        name: "folders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Folder,
      },
      { no: 4, name: "teams", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => Team },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.records = [];
    message.folderRecordKeys = [];
    message.folders = [];
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
        case /* repeated Records.Record records */ 1:
          message.records.push(Record.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Records.FolderRecordKey folder_record_keys */ 2:
          message.folderRecordKeys.push(
            FolderRecordKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.Folder folders */ 3:
          message.folders.push(Folder.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Records.Team teams */ 4:
          message.teams.push(Team.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.Record records = 1; */
    for (let i = 0; i < message.records.length; i++)
      Record.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.FolderRecordKey folder_record_keys = 2; */
    for (let i = 0; i < message.folderRecordKeys.length; i++)
      FolderRecordKey.internalBinaryWrite(
        message.folderRecordKeys[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.Folder folders = 3; */
    for (let i = 0; i < message.folders.length; i++)
      Folder.internalBinaryWrite(
        message.folders[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.Team teams = 4; */
    for (let i = 0; i < message.teams.length; i++)
      Team.internalBinaryWrite(
        message.teams[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsGetResponse
 */
export const RecordsGetResponse = new RecordsGetResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordLink$Type extends MessageType {
  constructor() {
    super("Records.RecordLink", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes record_key */ 2:
          message.recordKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes record_key = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordLink
 */
export const RecordLink = new RecordLink$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordAudit$Type extends MessageType {
  constructor() {
    super("Records.RecordAudit", [
      { no: 1, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.version = 0;
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
        case /* int32 version */ 1:
          message.version = reader.int32();
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
    /* int32 version = 1; */
    if (message.version !== 0) writer.tag(1, WireType.Varint).int32(message.version);
    /* bytes data = 2; */
    if (message.data.length) writer.tag(2, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordAudit
 */
export const RecordAudit = new RecordAudit$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityData$Type extends MessageType {
  constructor() {
    super("Records.SecurityData", [
      { no: 1, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* bytes data */ 1:
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
    /* bytes data = 1; */
    if (message.data.length) writer.tag(1, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.SecurityData
 */
export const SecurityData = new SecurityData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityScoreData$Type extends MessageType {
  constructor() {
    super("Records.SecurityScoreData", [
      { no: 1, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* bytes data */ 1:
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
    /* bytes data = 1; */
    if (message.data.length) writer.tag(1, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.SecurityScoreData
 */
export const SecurityScoreData = new SecurityScoreData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordAdd$Type extends MessageType {
  constructor() {
    super("Records.RecordAdd", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "client_modified_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "non_shared_data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 6,
        name: "folder_type",
        kind: "enum",
        T: () => ["Records.RecordFolderType", RecordFolderType],
      },
      { no: 7, name: "folder_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 8, name: "folder_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 9,
        name: "record_links",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordLink,
      },
      { no: 10, name: "audit", kind: "message", T: () => RecordAudit },
      { no: 11, name: "securityData", kind: "message", T: () => SecurityData },
      { no: 12, name: "securityScoreData", kind: "message", T: () => SecurityScoreData },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.clientModifiedTime = 0n;
    message.data = new Uint8Array(0);
    message.nonSharedData = new Uint8Array(0);
    message.folderType = 0;
    message.folderUid = new Uint8Array(0);
    message.folderKey = new Uint8Array(0);
    message.recordLinks = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes record_key */ 2:
          message.recordKey = reader.bytes();
          break;
        case /* int64 client_modified_time */ 3:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* bytes non_shared_data */ 5:
          message.nonSharedData = reader.bytes();
          break;
        case /* Records.RecordFolderType folder_type */ 6:
          message.folderType = reader.int32();
          break;
        case /* bytes folder_uid */ 7:
          message.folderUid = reader.bytes();
          break;
        case /* bytes folder_key */ 8:
          message.folderKey = reader.bytes();
          break;
        case /* repeated Records.RecordLink record_links */ 9:
          message.recordLinks.push(RecordLink.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* Records.RecordAudit audit */ 10:
          message.audit = RecordAudit.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.audit,
          );
          break;
        case /* Records.SecurityData securityData */ 11:
          message.securityData = SecurityData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.securityData,
          );
          break;
        case /* Records.SecurityScoreData securityScoreData */ 12:
          message.securityScoreData = SecurityScoreData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.securityScoreData,
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes record_key = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    /* int64 client_modified_time = 3; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(3, WireType.Varint).int64(message.clientModifiedTime);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* bytes non_shared_data = 5; */
    if (message.nonSharedData.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.nonSharedData);
    /* Records.RecordFolderType folder_type = 6; */
    if (message.folderType !== 0) writer.tag(6, WireType.Varint).int32(message.folderType);
    /* bytes folder_uid = 7; */
    if (message.folderUid.length) writer.tag(7, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes folder_key = 8; */
    if (message.folderKey.length) writer.tag(8, WireType.LengthDelimited).bytes(message.folderKey);
    /* repeated Records.RecordLink record_links = 9; */
    for (let i = 0; i < message.recordLinks.length; i++)
      RecordLink.internalBinaryWrite(
        message.recordLinks[i],
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Records.RecordAudit audit = 10; */
    if (message.audit)
      RecordAudit.internalBinaryWrite(
        message.audit,
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Records.SecurityData securityData = 11; */
    if (message.securityData)
      SecurityData.internalBinaryWrite(
        message.securityData,
        writer.tag(11, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Records.SecurityScoreData securityScoreData = 12; */
    if (message.securityScoreData)
      SecurityScoreData.internalBinaryWrite(
        message.securityScoreData,
        writer.tag(12, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordAdd
 */
export const RecordAdd = new RecordAdd$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsAddRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsAddRequest", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordAdd,
      },
      {
        no: 2,
        name: "client_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "security_data_key_type",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.records = [];
    message.clientTime = 0n;
    message.securityDataKeyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.RecordAdd records */ 1:
          message.records.push(RecordAdd.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* int64 client_time */ 2:
          message.clientTime = reader.int64().toBigInt();
          break;
        case /* Records.RecordKeyType security_data_key_type */ 3:
          message.securityDataKeyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordAdd records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordAdd.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 client_time = 2; */
    if (message.clientTime !== 0n) writer.tag(2, WireType.Varint).int64(message.clientTime);
    /* Records.RecordKeyType security_data_key_type = 3; */
    if (message.securityDataKeyType !== 0)
      writer.tag(3, WireType.Varint).int32(message.securityDataKeyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsAddRequest
 */
export const RecordsAddRequest = new RecordsAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordUpdate$Type extends MessageType {
  constructor() {
    super("Records.RecordUpdate", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "client_modified_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "non_shared_data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 6,
        name: "record_links_add",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordLink,
      },
      {
        no: 7,
        name: "record_links_remove",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 8, name: "audit", kind: "message", T: () => RecordAudit },
      { no: 9, name: "securityData", kind: "message", T: () => SecurityData },
      { no: 10, name: "securityScoreData", kind: "message", T: () => SecurityScoreData },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.clientModifiedTime = 0n;
    message.revision = 0n;
    message.data = new Uint8Array(0);
    message.nonSharedData = new Uint8Array(0);
    message.recordLinksAdd = [];
    message.recordLinksRemove = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* int64 client_modified_time */ 2:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* int64 revision */ 3:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* bytes non_shared_data */ 5:
          message.nonSharedData = reader.bytes();
          break;
        case /* repeated Records.RecordLink record_links_add */ 6:
          message.recordLinksAdd.push(
            RecordLink.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes record_links_remove */ 7:
          message.recordLinksRemove.push(reader.bytes());
          break;
        case /* Records.RecordAudit audit */ 8:
          message.audit = RecordAudit.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.audit,
          );
          break;
        case /* Records.SecurityData securityData */ 9:
          message.securityData = SecurityData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.securityData,
          );
          break;
        case /* Records.SecurityScoreData securityScoreData */ 10:
          message.securityScoreData = SecurityScoreData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.securityScoreData,
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 client_modified_time = 2; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(2, WireType.Varint).int64(message.clientModifiedTime);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* bytes non_shared_data = 5; */
    if (message.nonSharedData.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.nonSharedData);
    /* repeated Records.RecordLink record_links_add = 6; */
    for (let i = 0; i < message.recordLinksAdd.length; i++)
      RecordLink.internalBinaryWrite(
        message.recordLinksAdd[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes record_links_remove = 7; */
    for (let i = 0; i < message.recordLinksRemove.length; i++)
      writer.tag(7, WireType.LengthDelimited).bytes(message.recordLinksRemove[i]);
    /* Records.RecordAudit audit = 8; */
    if (message.audit)
      RecordAudit.internalBinaryWrite(
        message.audit,
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Records.SecurityData securityData = 9; */
    if (message.securityData)
      SecurityData.internalBinaryWrite(
        message.securityData,
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Records.SecurityScoreData securityScoreData = 10; */
    if (message.securityScoreData)
      SecurityScoreData.internalBinaryWrite(
        message.securityScoreData,
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordUpdate
 */
export const RecordUpdate = new RecordUpdate$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUpdateRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsUpdateRequest", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordUpdate,
      },
      {
        no: 2,
        name: "client_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "security_data_key_type",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.records = [];
    message.clientTime = 0n;
    message.securityDataKeyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.RecordUpdate records */ 1:
          message.records.push(RecordUpdate.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* int64 client_time */ 2:
          message.clientTime = reader.int64().toBigInt();
          break;
        case /* Records.RecordKeyType security_data_key_type */ 3:
          message.securityDataKeyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordUpdate records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordUpdate.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 client_time = 2; */
    if (message.clientTime !== 0n) writer.tag(2, WireType.Varint).int64(message.clientTime);
    /* Records.RecordKeyType security_data_key_type = 3; */
    if (message.securityDataKeyType !== 0)
      writer.tag(3, WireType.Varint).int32(message.securityDataKeyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsUpdateRequest
 */
export const RecordsUpdateRequest = new RecordsUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordFileForConversion$Type extends MessageType {
  constructor() {
    super("Records.RecordFileForConversion", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "file_file_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "thumb_file_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "link_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.fileFileId = "";
    message.thumbFileId = "";
    message.data = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.linkKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* string file_file_id */ 2:
          message.fileFileId = reader.string();
          break;
        case /* string thumb_file_id */ 3:
          message.thumbFileId = reader.string();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* bytes record_key */ 5:
          message.recordKey = reader.bytes();
          break;
        case /* bytes link_key */ 6:
          message.linkKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* string file_file_id = 2; */
    if (message.fileFileId !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.fileFileId);
    /* string thumb_file_id = 3; */
    if (message.thumbFileId !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.thumbFileId);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* bytes record_key = 5; */
    if (message.recordKey.length) writer.tag(5, WireType.LengthDelimited).bytes(message.recordKey);
    /* bytes link_key = 6; */
    if (message.linkKey.length) writer.tag(6, WireType.LengthDelimited).bytes(message.linkKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordFileForConversion
 */
export const RecordFileForConversion = new RecordFileForConversion$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordFolderForConversion$Type extends MessageType {
  constructor() {
    super("Records.RecordFolderForConversion", [
      { no: 1, name: "folder_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_folder_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.folderUid = new Uint8Array(0);
    message.recordFolderKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes folder_uid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes record_folder_key */ 2:
          message.recordFolderKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes folder_uid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes record_folder_key = 2; */
    if (message.recordFolderKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recordFolderKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordFolderForConversion
 */
export const RecordFolderForConversion = new RecordFolderForConversion$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordConvertToV3$Type extends MessageType {
  constructor() {
    super("Records.RecordConvertToV3", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "client_modified_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "non_shared_data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "audit", kind: "message", T: () => RecordAudit },
      {
        no: 7,
        name: "record_file",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordFileForConversion,
      },
      {
        no: 8,
        name: "folder_key",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordFolderForConversion,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.clientModifiedTime = 0n;
    message.revision = 0n;
    message.data = new Uint8Array(0);
    message.nonSharedData = new Uint8Array(0);
    message.recordFile = [];
    message.folderKey = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* int64 client_modified_time */ 2:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* int64 revision */ 3:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* bytes non_shared_data */ 5:
          message.nonSharedData = reader.bytes();
          break;
        case /* Records.RecordAudit audit */ 6:
          message.audit = RecordAudit.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.audit,
          );
          break;
        case /* repeated Records.RecordFileForConversion record_file */ 7:
          message.recordFile.push(
            RecordFileForConversion.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.RecordFolderForConversion folder_key */ 8:
          message.folderKey.push(
            RecordFolderForConversion.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 client_modified_time = 2; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(2, WireType.Varint).int64(message.clientModifiedTime);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* bytes non_shared_data = 5; */
    if (message.nonSharedData.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.nonSharedData);
    /* Records.RecordAudit audit = 6; */
    if (message.audit)
      RecordAudit.internalBinaryWrite(
        message.audit,
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.RecordFileForConversion record_file = 7; */
    for (let i = 0; i < message.recordFile.length; i++)
      RecordFileForConversion.internalBinaryWrite(
        message.recordFile[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.RecordFolderForConversion folder_key = 8; */
    for (let i = 0; i < message.folderKey.length; i++)
      RecordFolderForConversion.internalBinaryWrite(
        message.folderKey[i],
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordConvertToV3
 */
export const RecordConvertToV3 = new RecordConvertToV3$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsConvertToV3Request$Type extends MessageType {
  constructor() {
    super("Records.RecordsConvertToV3Request", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordConvertToV3,
      },
      {
        no: 2,
        name: "client_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.records = [];
    message.clientTime = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.RecordConvertToV3 records */ 1:
          message.records.push(
            RecordConvertToV3.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 client_time */ 2:
          message.clientTime = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordConvertToV3 records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordConvertToV3.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 client_time = 2; */
    if (message.clientTime !== 0n) writer.tag(2, WireType.Varint).int64(message.clientTime);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsConvertToV3Request
 */
export const RecordsConvertToV3Request = new RecordsConvertToV3Request$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsRemoveRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsRemoveRequest", [
      {
        no: 1,
        name: "records",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* repeated bytes records */ 1:
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
    /* repeated bytes records = 1; */
    for (let i = 0; i < message.records.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.records[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsRemoveRequest
 */
export const RecordsRemoveRequest = new RecordsRemoveRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordRevert$Type extends MessageType {
  constructor() {
    super("Records.RecordRevert", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "revert_to_revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.revertToRevision = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* int64 revert_to_revision */ 2:
          message.revertToRevision = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 revert_to_revision = 2; */
    if (message.revertToRevision !== 0n)
      writer.tag(2, WireType.Varint).int64(message.revertToRevision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordRevert
 */
export const RecordRevert = new RecordRevert$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsRevertRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsRevertRequest", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordRevert,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* repeated Records.RecordRevert records */ 1:
          message.records.push(RecordRevert.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordRevert records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordRevert.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsRevertRequest
 */
export const RecordsRevertRequest = new RecordsRevertRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordLinkError$Type extends MessageType {
  constructor() {
    super("Records.RecordLinkError", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Records.RecordModifyResult", RecordModifyResult],
      },
      { no: 3, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* Records.RecordModifyResult status */ 2:
          message.status = reader.int32();
          break;
        case /* string message */ 3:
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* Records.RecordModifyResult status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    /* string message = 3; */
    if (message.message !== "") writer.tag(3, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordLinkError
 */
export const RecordLinkError = new RecordLinkError$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordModifyStatus$Type extends MessageType {
  constructor() {
    super("Records.RecordModifyStatus", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["Records.RecordModifyResult", RecordModifyResult],
      },
      { no: 3, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "link_errors",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordLinkError,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.status = 0;
    message.message = "";
    message.linkErrors = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* Records.RecordModifyResult status */ 2:
          message.status = reader.int32();
          break;
        case /* string message */ 3:
          message.message = reader.string();
          break;
        case /* repeated Records.RecordLinkError link_errors */ 4:
          message.linkErrors.push(
            RecordLinkError.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* Records.RecordModifyResult status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    /* string message = 3; */
    if (message.message !== "") writer.tag(3, WireType.LengthDelimited).string(message.message);
    /* repeated Records.RecordLinkError link_errors = 4; */
    for (let i = 0; i < message.linkErrors.length; i++)
      RecordLinkError.internalBinaryWrite(
        message.linkErrors[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordModifyStatus
 */
export const RecordModifyStatus = new RecordModifyStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsModifyResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordsModifyResponse", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordModifyStatus,
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
    message.records = [];
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
        case /* repeated Records.RecordModifyStatus records */ 1:
          message.records.push(
            RecordModifyStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.RecordModifyStatus records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordModifyStatus.internalBinaryWrite(
        message.records[i],
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
 * @generated MessageType for protobuf message Records.RecordsModifyResponse
 */
export const RecordsModifyResponse = new RecordsModifyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordAddAuditData$Type extends MessageType {
  constructor() {
    super("Records.RecordAddAuditData", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.revision = 0n;
    message.data = new Uint8Array(0);
    message.version = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* int64 revision */ 2:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes data */ 3:
          message.data = reader.bytes();
          break;
        case /* int32 version */ 4:
          message.version = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    /* bytes data = 3; */
    if (message.data.length) writer.tag(3, WireType.LengthDelimited).bytes(message.data);
    /* int32 version = 4; */
    if (message.version !== 0) writer.tag(4, WireType.Varint).int32(message.version);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordAddAuditData
 */
export const RecordAddAuditData = new RecordAddAuditData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AddAuditDataRequest$Type extends MessageType {
  constructor() {
    super("Records.AddAuditDataRequest", [
      {
        no: 1,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordAddAuditData,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* repeated Records.RecordAddAuditData records */ 1:
          message.records.push(
            RecordAddAuditData.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.RecordAddAuditData records = 1; */
    for (let i = 0; i < message.records.length; i++)
      RecordAddAuditData.internalBinaryWrite(
        message.records[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.AddAuditDataRequest
 */
export const AddAuditDataRequest = new AddAuditDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class File$Type extends MessageType {
  constructor() {
    super("Records.File", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "fileSize",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "thumbSize", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 6, name: "is_script", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.data = new Uint8Array(0);
    message.fileSize = 0n;
    message.thumbSize = 0;
    message.isScript = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes record_key */ 2:
          message.recordKey = reader.bytes();
          break;
        case /* bytes data */ 3:
          message.data = reader.bytes();
          break;
        case /* int64 fileSize */ 4:
          message.fileSize = reader.int64().toBigInt();
          break;
        case /* int32 thumbSize */ 5:
          message.thumbSize = reader.int32();
          break;
        case /* bool is_script */ 6:
          message.isScript = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes record_key = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    /* bytes data = 3; */
    if (message.data.length) writer.tag(3, WireType.LengthDelimited).bytes(message.data);
    /* int64 fileSize = 4; */
    if (message.fileSize !== 0n) writer.tag(4, WireType.Varint).int64(message.fileSize);
    /* int32 thumbSize = 5; */
    if (message.thumbSize !== 0) writer.tag(5, WireType.Varint).int32(message.thumbSize);
    /* bool is_script = 6; */
    if (message.isScript !== false) writer.tag(6, WireType.Varint).bool(message.isScript);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.File
 */
export const File = new File$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FilesAddRequest$Type extends MessageType {
  constructor() {
    super("Records.FilesAddRequest", [
      { no: 1, name: "files", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => File },
      {
        no: 2,
        name: "client_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.files = [];
    message.clientTime = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.File files */ 1:
          message.files.push(File.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* int64 client_time */ 2:
          message.clientTime = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.File files = 1; */
    for (let i = 0; i < message.files.length; i++)
      File.internalBinaryWrite(
        message.files[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 client_time = 2; */
    if (message.clientTime !== 0n) writer.tag(2, WireType.Varint).int64(message.clientTime);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.FilesAddRequest
 */
export const FilesAddRequest = new FilesAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FileAddStatus$Type extends MessageType {
  constructor() {
    super("Records.FileAddStatus", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "status", kind: "enum", T: () => ["Records.FileAddResult", FileAddResult] },
      { no: 3, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "parameters", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "thumbnail_parameters", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "success_status_code", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.status = 0;
    message.url = "";
    message.parameters = "";
    message.thumbnailParameters = "";
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
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* Records.FileAddResult status */ 2:
          message.status = reader.int32();
          break;
        case /* string url */ 3:
          message.url = reader.string();
          break;
        case /* string parameters */ 4:
          message.parameters = reader.string();
          break;
        case /* string thumbnail_parameters */ 5:
          message.thumbnailParameters = reader.string();
          break;
        case /* int32 success_status_code */ 6:
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
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* Records.FileAddResult status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    /* string url = 3; */
    if (message.url !== "") writer.tag(3, WireType.LengthDelimited).string(message.url);
    /* string parameters = 4; */
    if (message.parameters !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.parameters);
    /* string thumbnail_parameters = 5; */
    if (message.thumbnailParameters !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.thumbnailParameters);
    /* int32 success_status_code = 6; */
    if (message.successStatusCode !== 0)
      writer.tag(6, WireType.Varint).int32(message.successStatusCode);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.FileAddStatus
 */
export const FileAddStatus = new FileAddStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FilesAddResponse$Type extends MessageType {
  constructor() {
    super("Records.FilesAddResponse", [
      {
        no: 1,
        name: "files",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => FileAddStatus,
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
    message.files = [];
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
        case /* repeated Records.FileAddStatus files */ 1:
          message.files.push(FileAddStatus.internalBinaryRead(reader, reader.uint32(), options));
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
    /* repeated Records.FileAddStatus files = 1; */
    for (let i = 0; i < message.files.length; i++)
      FileAddStatus.internalBinaryWrite(
        message.files[i],
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
 * @generated MessageType for protobuf message Records.FilesAddResponse
 */
export const FilesAddResponse = new FilesAddResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FilesGetRequest$Type extends MessageType {
  constructor() {
    super("Records.FilesGetRequest", [
      {
        no: 1,
        name: "record_uids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 2, name: "for_thumbnails", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "emergency_access_account_owner", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUids = [];
    message.forThumbnails = false;
    message.emergencyAccessAccountOwner = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes record_uids */ 1:
          message.recordUids.push(reader.bytes());
          break;
        case /* bool for_thumbnails */ 2:
          message.forThumbnails = reader.bool();
          break;
        case /* string emergency_access_account_owner */ 3:
          message.emergencyAccessAccountOwner = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes record_uids = 1; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.recordUids[i]);
    /* bool for_thumbnails = 2; */
    if (message.forThumbnails !== false) writer.tag(2, WireType.Varint).bool(message.forThumbnails);
    /* string emergency_access_account_owner = 3; */
    if (message.emergencyAccessAccountOwner !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.emergencyAccessAccountOwner);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.FilesGetRequest
 */
export const FilesGetRequest = new FilesGetRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FileGetStatus$Type extends MessageType {
  constructor() {
    super("Records.FileGetStatus", [
      { no: 1, name: "record_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "status", kind: "enum", T: () => ["Records.FileGetResult", FileGetResult] },
      { no: 3, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "success_status_code", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 5,
        name: "fileKeyType",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.status = 0;
    message.url = "";
    message.successStatusCode = 0;
    message.fileKeyType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes record_uid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* Records.FileGetResult status */ 2:
          message.status = reader.int32();
          break;
        case /* string url */ 3:
          message.url = reader.string();
          break;
        case /* int32 success_status_code */ 4:
          message.successStatusCode = reader.int32();
          break;
        case /* Records.RecordKeyType fileKeyType */ 5:
          message.fileKeyType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes record_uid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* Records.FileGetResult status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    /* string url = 3; */
    if (message.url !== "") writer.tag(3, WireType.LengthDelimited).string(message.url);
    /* int32 success_status_code = 4; */
    if (message.successStatusCode !== 0)
      writer.tag(4, WireType.Varint).int32(message.successStatusCode);
    /* Records.RecordKeyType fileKeyType = 5; */
    if (message.fileKeyType !== 0) writer.tag(5, WireType.Varint).int32(message.fileKeyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.FileGetStatus
 */
export const FileGetStatus = new FileGetStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FilesGetResponse$Type extends MessageType {
  constructor() {
    super("Records.FilesGetResponse", [
      {
        no: 1,
        name: "files",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => FileGetStatus,
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
        case /* repeated Records.FileGetStatus files */ 1:
          message.files.push(FileGetStatus.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.FileGetStatus files = 1; */
    for (let i = 0; i < message.files.length; i++)
      FileGetStatus.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Records.FilesGetResponse
 */
export const FilesGetResponse = new FilesGetResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApplicationAddRequest$Type extends MessageType {
  constructor() {
    super("Records.ApplicationAddRequest", [
      { no: 1, name: "app_uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "record_key", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "client_modified_time",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "audit", kind: "message", T: () => RecordAudit },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.clientModifiedTime = 0n;
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
        case /* bytes app_uid */ 1:
          message.appUid = reader.bytes();
          break;
        case /* bytes record_key */ 2:
          message.recordKey = reader.bytes();
          break;
        case /* int64 client_modified_time */ 3:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* bytes data */ 4:
          message.data = reader.bytes();
          break;
        case /* Records.RecordAudit audit */ 5:
          message.audit = RecordAudit.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.audit,
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
    /* bytes app_uid = 1; */
    if (message.appUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.appUid);
    /* bytes record_key = 2; */
    if (message.recordKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordKey);
    /* int64 client_modified_time = 3; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(3, WireType.Varint).int64(message.clientModifiedTime);
    /* bytes data = 4; */
    if (message.data.length) writer.tag(4, WireType.LengthDelimited).bytes(message.data);
    /* Records.RecordAudit audit = 5; */
    if (message.audit)
      RecordAudit.internalBinaryWrite(
        message.audit,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.ApplicationAddRequest
 */
export const ApplicationAddRequest = new ApplicationAddRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetRecordDataWithAccessInfoRequest$Type extends MessageType {
  constructor() {
    super("Records.GetRecordDataWithAccessInfoRequest", [
      {
        no: 1,
        name: "clientTime",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 2,
        name: "recordUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 3,
        name: "recordDetailsInclude",
        kind: "enum",
        T: () => ["Records.RecordDetailsInclude", RecordDetailsInclude],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientTime = 0n;
    message.recordUid = [];
    message.recordDetailsInclude = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 clientTime */ 1:
          message.clientTime = reader.int64().toBigInt();
          break;
        case /* repeated bytes recordUid */ 2:
          message.recordUid.push(reader.bytes());
          break;
        case /* Records.RecordDetailsInclude recordDetailsInclude */ 3:
          message.recordDetailsInclude = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 clientTime = 1; */
    if (message.clientTime !== 0n) writer.tag(1, WireType.Varint).int64(message.clientTime);
    /* repeated bytes recordUid = 2; */
    for (let i = 0; i < message.recordUid.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid[i]);
    /* Records.RecordDetailsInclude recordDetailsInclude = 3; */
    if (message.recordDetailsInclude !== 0)
      writer.tag(3, WireType.Varint).int32(message.recordDetailsInclude);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetRecordDataWithAccessInfoRequest
 */
export const GetRecordDataWithAccessInfoRequest = new GetRecordDataWithAccessInfoRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserPermission$Type extends MessageType {
  constructor() {
    super("Records.UserPermission", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "owner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "shareAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "sharable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "editable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "awaitingApproval", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 7,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 8, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 9,
        name: "timerNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 10, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.owner = false;
    message.shareAdmin = false;
    message.sharable = false;
    message.editable = false;
    message.awaitingApproval = false;
    message.expiration = 0n;
    message.accountUid = new Uint8Array(0);
    message.timerNotificationType = 0;
    message.rotateOnExpiration = false;
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
        case /* bool owner */ 2:
          message.owner = reader.bool();
          break;
        case /* bool shareAdmin */ 3:
          message.shareAdmin = reader.bool();
          break;
        case /* bool sharable */ 4:
          message.sharable = reader.bool();
          break;
        case /* bool editable */ 5:
          message.editable = reader.bool();
          break;
        case /* bool awaitingApproval */ 6:
          message.awaitingApproval = reader.bool();
          break;
        case /* int64 expiration */ 7:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* bytes accountUid */ 8:
          message.accountUid = reader.bytes();
          break;
        case /* Records.TimerNotificationType timerNotificationType */ 9:
          message.timerNotificationType = reader.int32();
          break;
        case /* bool rotateOnExpiration */ 10:
          message.rotateOnExpiration = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bool owner = 2; */
    if (message.owner !== false) writer.tag(2, WireType.Varint).bool(message.owner);
    /* bool shareAdmin = 3; */
    if (message.shareAdmin !== false) writer.tag(3, WireType.Varint).bool(message.shareAdmin);
    /* bool sharable = 4; */
    if (message.sharable !== false) writer.tag(4, WireType.Varint).bool(message.sharable);
    /* bool editable = 5; */
    if (message.editable !== false) writer.tag(5, WireType.Varint).bool(message.editable);
    /* bool awaitingApproval = 6; */
    if (message.awaitingApproval !== false)
      writer.tag(6, WireType.Varint).bool(message.awaitingApproval);
    /* int64 expiration = 7; */
    if (message.expiration !== 0n) writer.tag(7, WireType.Varint).int64(message.expiration);
    /* bytes accountUid = 8; */
    if (message.accountUid.length)
      writer.tag(8, WireType.LengthDelimited).bytes(message.accountUid);
    /* Records.TimerNotificationType timerNotificationType = 9; */
    if (message.timerNotificationType !== 0)
      writer.tag(9, WireType.Varint).int32(message.timerNotificationType);
    /* bool rotateOnExpiration = 10; */
    if (message.rotateOnExpiration !== false)
      writer.tag(10, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.UserPermission
 */
export const UserPermission = new UserPermission$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderPermission$Type extends MessageType {
  constructor() {
    super("Records.SharedFolderPermission", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "resharable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "editable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 4,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 6,
        name: "timerNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 7, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.resharable = false;
    message.editable = false;
    message.revision = 0n;
    message.expiration = 0n;
    message.timerNotificationType = 0;
    message.rotateOnExpiration = false;
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
        case /* bool resharable */ 2:
          message.resharable = reader.bool();
          break;
        case /* bool editable */ 3:
          message.editable = reader.bool();
          break;
        case /* int64 revision */ 4:
          message.revision = reader.int64().toBigInt();
          break;
        case /* int64 expiration */ 5:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType timerNotificationType */ 6:
          message.timerNotificationType = reader.int32();
          break;
        case /* bool rotateOnExpiration */ 7:
          message.rotateOnExpiration = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bool resharable = 2; */
    if (message.resharable !== false) writer.tag(2, WireType.Varint).bool(message.resharable);
    /* bool editable = 3; */
    if (message.editable !== false) writer.tag(3, WireType.Varint).bool(message.editable);
    /* int64 revision = 4; */
    if (message.revision !== 0n) writer.tag(4, WireType.Varint).int64(message.revision);
    /* int64 expiration = 5; */
    if (message.expiration !== 0n) writer.tag(5, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType timerNotificationType = 6; */
    if (message.timerNotificationType !== 0)
      writer.tag(6, WireType.Varint).int32(message.timerNotificationType);
    /* bool rotateOnExpiration = 7; */
    if (message.rotateOnExpiration !== false)
      writer.tag(7, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.SharedFolderPermission
 */
export const SharedFolderPermission = new SharedFolderPermission$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordData$Type extends MessageType {
  constructor() {
    super("Records.RecordData", [
      {
        no: 1,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "shared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "encryptedRecordData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "encryptedExtraData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 6,
        name: "clientModifiedTime",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 7, name: "nonSharedData", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 8,
        name: "linkedRecordData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordData,
      },
      {
        no: 9,
        name: "fileId",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 10,
        name: "fileSize",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 11,
        name: "thumbnailSize",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 12,
        name: "recordKeyType",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
      { no: 13, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 14, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.revision = 0n;
    message.version = 0;
    message.shared = false;
    message.encryptedRecordData = "";
    message.encryptedExtraData = "";
    message.clientModifiedTime = 0n;
    message.nonSharedData = "";
    message.linkedRecordData = [];
    message.fileId = [];
    message.fileSize = 0n;
    message.thumbnailSize = 0n;
    message.recordKeyType = 0;
    message.recordKey = new Uint8Array(0);
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
        case /* int64 revision */ 1:
          message.revision = reader.int64().toBigInt();
          break;
        case /* int32 version */ 2:
          message.version = reader.int32();
          break;
        case /* bool shared */ 3:
          message.shared = reader.bool();
          break;
        case /* string encryptedRecordData */ 4:
          message.encryptedRecordData = reader.string();
          break;
        case /* string encryptedExtraData */ 5:
          message.encryptedExtraData = reader.string();
          break;
        case /* int64 clientModifiedTime */ 6:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* string nonSharedData */ 7:
          message.nonSharedData = reader.string();
          break;
        case /* repeated Records.RecordData linkedRecordData */ 8:
          message.linkedRecordData.push(
            RecordData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes fileId */ 9:
          message.fileId.push(reader.bytes());
          break;
        case /* int64 fileSize */ 10:
          message.fileSize = reader.int64().toBigInt();
          break;
        case /* int64 thumbnailSize */ 11:
          message.thumbnailSize = reader.int64().toBigInt();
          break;
        case /* Records.RecordKeyType recordKeyType */ 12:
          message.recordKeyType = reader.int32();
          break;
        case /* bytes recordKey */ 13:
          message.recordKey = reader.bytes();
          break;
        case /* bytes recordUid */ 14:
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
    /* int64 revision = 1; */
    if (message.revision !== 0n) writer.tag(1, WireType.Varint).int64(message.revision);
    /* int32 version = 2; */
    if (message.version !== 0) writer.tag(2, WireType.Varint).int32(message.version);
    /* bool shared = 3; */
    if (message.shared !== false) writer.tag(3, WireType.Varint).bool(message.shared);
    /* string encryptedRecordData = 4; */
    if (message.encryptedRecordData !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.encryptedRecordData);
    /* string encryptedExtraData = 5; */
    if (message.encryptedExtraData !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.encryptedExtraData);
    /* int64 clientModifiedTime = 6; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(6, WireType.Varint).int64(message.clientModifiedTime);
    /* string nonSharedData = 7; */
    if (message.nonSharedData !== "")
      writer.tag(7, WireType.LengthDelimited).string(message.nonSharedData);
    /* repeated Records.RecordData linkedRecordData = 8; */
    for (let i = 0; i < message.linkedRecordData.length; i++)
      RecordData.internalBinaryWrite(
        message.linkedRecordData[i],
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes fileId = 9; */
    for (let i = 0; i < message.fileId.length; i++)
      writer.tag(9, WireType.LengthDelimited).bytes(message.fileId[i]);
    /* int64 fileSize = 10; */
    if (message.fileSize !== 0n) writer.tag(10, WireType.Varint).int64(message.fileSize);
    /* int64 thumbnailSize = 11; */
    if (message.thumbnailSize !== 0n) writer.tag(11, WireType.Varint).int64(message.thumbnailSize);
    /* Records.RecordKeyType recordKeyType = 12; */
    if (message.recordKeyType !== 0) writer.tag(12, WireType.Varint).int32(message.recordKeyType);
    /* bytes recordKey = 13; */
    if (message.recordKey.length) writer.tag(13, WireType.LengthDelimited).bytes(message.recordKey);
    /* bytes recordUid = 14; */
    if (message.recordUid.length) writer.tag(14, WireType.LengthDelimited).bytes(message.recordUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordData
 */
export const RecordData = new RecordData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordDataWithAccessInfo$Type extends MessageType {
  constructor() {
    super("Records.RecordDataWithAccessInfo", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recordData", kind: "message", T: () => RecordData },
      {
        no: 3,
        name: "userPermission",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserPermission,
      },
      {
        no: 4,
        name: "sharedFolderPermission",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderPermission,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.userPermission = [];
    message.sharedFolderPermission = [];
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
        case /* Records.RecordData recordData */ 2:
          message.recordData = RecordData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.recordData,
          );
          break;
        case /* repeated Records.UserPermission userPermission */ 3:
          message.userPermission.push(
            UserPermission.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.SharedFolderPermission sharedFolderPermission */ 4:
          message.sharedFolderPermission.push(
            SharedFolderPermission.internalBinaryRead(reader, reader.uint32(), options),
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* Records.RecordData recordData = 2; */
    if (message.recordData)
      RecordData.internalBinaryWrite(
        message.recordData,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.UserPermission userPermission = 3; */
    for (let i = 0; i < message.userPermission.length; i++)
      UserPermission.internalBinaryWrite(
        message.userPermission[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.SharedFolderPermission sharedFolderPermission = 4; */
    for (let i = 0; i < message.sharedFolderPermission.length; i++)
      SharedFolderPermission.internalBinaryWrite(
        message.sharedFolderPermission[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordDataWithAccessInfo
 */
export const RecordDataWithAccessInfo = new RecordDataWithAccessInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetRecordDataWithAccessInfoResponse$Type extends MessageType {
  constructor() {
    super("Records.GetRecordDataWithAccessInfoResponse", [
      {
        no: 1,
        name: "recordDataWithAccessInfo",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordDataWithAccessInfo,
      },
      {
        no: 2,
        name: "noPermissionRecordUid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordDataWithAccessInfo = [];
    message.noPermissionRecordUid = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.RecordDataWithAccessInfo recordDataWithAccessInfo */ 1:
          message.recordDataWithAccessInfo.push(
            RecordDataWithAccessInfo.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes noPermissionRecordUid */ 2:
          message.noPermissionRecordUid.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.RecordDataWithAccessInfo recordDataWithAccessInfo = 1; */
    for (let i = 0; i < message.recordDataWithAccessInfo.length; i++)
      RecordDataWithAccessInfo.internalBinaryWrite(
        message.recordDataWithAccessInfo[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes noPermissionRecordUid = 2; */
    for (let i = 0; i < message.noPermissionRecordUid.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.noPermissionRecordUid[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetRecordDataWithAccessInfoResponse
 */
export const GetRecordDataWithAccessInfoResponse = new GetRecordDataWithAccessInfoResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class IsObjectShareAdmin$Type extends MessageType {
  constructor() {
    super("Records.IsObjectShareAdmin", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "isAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 3,
        name: "objectType",
        kind: "enum",
        T: () => ["Records.CheckShareAdminObjectType", CheckShareAdminObjectType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.isAdmin = false;
    message.objectType = 0;
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
        case /* bool isAdmin */ 2:
          message.isAdmin = reader.bool();
          break;
        case /* Records.CheckShareAdminObjectType objectType */ 3:
          message.objectType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bool isAdmin = 2; */
    if (message.isAdmin !== false) writer.tag(2, WireType.Varint).bool(message.isAdmin);
    /* Records.CheckShareAdminObjectType objectType = 3; */
    if (message.objectType !== 0) writer.tag(3, WireType.Varint).int32(message.objectType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.IsObjectShareAdmin
 */
export const IsObjectShareAdmin = new IsObjectShareAdmin$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AmIShareAdmin$Type extends MessageType {
  constructor() {
    super("Records.AmIShareAdmin", [
      {
        no: 1,
        name: "isObjectShareAdmin",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => IsObjectShareAdmin,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.isObjectShareAdmin = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.IsObjectShareAdmin isObjectShareAdmin */ 1:
          message.isObjectShareAdmin.push(
            IsObjectShareAdmin.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.IsObjectShareAdmin isObjectShareAdmin = 1; */
    for (let i = 0; i < message.isObjectShareAdmin.length; i++)
      IsObjectShareAdmin.internalBinaryWrite(
        message.isObjectShareAdmin[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.AmIShareAdmin
 */
export const AmIShareAdmin = new AmIShareAdmin$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordShareUpdateRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordShareUpdateRequest", [
      {
        no: 1,
        name: "addSharedRecord",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecord,
      },
      {
        no: 2,
        name: "updateSharedRecord",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecord,
      },
      {
        no: 3,
        name: "removeSharedRecord",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecord,
      },
      { no: 4, name: "pt", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.addSharedRecord = [];
    message.updateSharedRecord = [];
    message.removeSharedRecord = [];
    message.pt = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.SharedRecord addSharedRecord */ 1:
          message.addSharedRecord.push(
            SharedRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.SharedRecord updateSharedRecord */ 2:
          message.updateSharedRecord.push(
            SharedRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.SharedRecord removeSharedRecord */ 3:
          message.removeSharedRecord.push(
            SharedRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string pt */ 4:
          message.pt = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Records.SharedRecord addSharedRecord = 1; */
    for (let i = 0; i < message.addSharedRecord.length; i++)
      SharedRecord.internalBinaryWrite(
        message.addSharedRecord[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.SharedRecord updateSharedRecord = 2; */
    for (let i = 0; i < message.updateSharedRecord.length; i++)
      SharedRecord.internalBinaryWrite(
        message.updateSharedRecord[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.SharedRecord removeSharedRecord = 3; */
    for (let i = 0; i < message.removeSharedRecord.length; i++)
      SharedRecord.internalBinaryWrite(
        message.removeSharedRecord[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string pt = 4; */
    if (message.pt !== "") writer.tag(4, WireType.LengthDelimited).string(message.pt);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordShareUpdateRequest
 */
export const RecordShareUpdateRequest = new RecordShareUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedRecord$Type extends MessageType {
  constructor() {
    super("Records.SharedRecord", [
      { no: 1, name: "toUsername", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "editable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "shareable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "transfer", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 9, name: "useEccKey", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 10, name: "removeVaultData", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 11,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 12,
        name: "timerNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 13, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.toUsername = "";
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.sharedFolderUid = new Uint8Array(0);
    message.teamUid = new Uint8Array(0);
    message.editable = false;
    message.shareable = false;
    message.transfer = false;
    message.useEccKey = false;
    message.removeVaultData = false;
    message.expiration = 0n;
    message.timerNotificationType = 0;
    message.rotateOnExpiration = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string toUsername */ 1:
          message.toUsername = reader.string();
          break;
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* bytes recordKey */ 3:
          message.recordKey = reader.bytes();
          break;
        case /* bytes sharedFolderUid */ 4:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* bytes teamUid */ 5:
          message.teamUid = reader.bytes();
          break;
        case /* bool editable */ 6:
          message.editable = reader.bool();
          break;
        case /* bool shareable */ 7:
          message.shareable = reader.bool();
          break;
        case /* bool transfer */ 8:
          message.transfer = reader.bool();
          break;
        case /* bool useEccKey */ 9:
          message.useEccKey = reader.bool();
          break;
        case /* bool removeVaultData */ 10:
          message.removeVaultData = reader.bool();
          break;
        case /* int64 expiration */ 11:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType timerNotificationType */ 12:
          message.timerNotificationType = reader.int32();
          break;
        case /* bool rotateOnExpiration */ 13:
          message.rotateOnExpiration = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string toUsername = 1; */
    if (message.toUsername !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.toUsername);
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes recordKey = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    /* bytes sharedFolderUid = 4; */
    if (message.sharedFolderUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* bytes teamUid = 5; */
    if (message.teamUid.length) writer.tag(5, WireType.LengthDelimited).bytes(message.teamUid);
    /* bool editable = 6; */
    if (message.editable !== false) writer.tag(6, WireType.Varint).bool(message.editable);
    /* bool shareable = 7; */
    if (message.shareable !== false) writer.tag(7, WireType.Varint).bool(message.shareable);
    /* bool transfer = 8; */
    if (message.transfer !== false) writer.tag(8, WireType.Varint).bool(message.transfer);
    /* bool useEccKey = 9; */
    if (message.useEccKey !== false) writer.tag(9, WireType.Varint).bool(message.useEccKey);
    /* bool removeVaultData = 10; */
    if (message.removeVaultData !== false)
      writer.tag(10, WireType.Varint).bool(message.removeVaultData);
    /* int64 expiration = 11; */
    if (message.expiration !== 0n) writer.tag(11, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType timerNotificationType = 12; */
    if (message.timerNotificationType !== 0)
      writer.tag(12, WireType.Varint).int32(message.timerNotificationType);
    /* bool rotateOnExpiration = 13; */
    if (message.rotateOnExpiration !== false)
      writer.tag(13, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.SharedRecord
 */
export const SharedRecord = new SharedRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordShareUpdateResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordShareUpdateResponse", [
      {
        no: 1,
        name: "addSharedRecordStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecordStatus,
      },
      {
        no: 2,
        name: "updateSharedRecordStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecordStatus,
      },
      {
        no: 3,
        name: "removeSharedRecordStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedRecordStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.addSharedRecordStatus = [];
    message.updateSharedRecordStatus = [];
    message.removeSharedRecordStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.SharedRecordStatus addSharedRecordStatus */ 1:
          message.addSharedRecordStatus.push(
            SharedRecordStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.SharedRecordStatus updateSharedRecordStatus */ 2:
          message.updateSharedRecordStatus.push(
            SharedRecordStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.SharedRecordStatus removeSharedRecordStatus */ 3:
          message.removeSharedRecordStatus.push(
            SharedRecordStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.SharedRecordStatus addSharedRecordStatus = 1; */
    for (let i = 0; i < message.addSharedRecordStatus.length; i++)
      SharedRecordStatus.internalBinaryWrite(
        message.addSharedRecordStatus[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.SharedRecordStatus updateSharedRecordStatus = 2; */
    for (let i = 0; i < message.updateSharedRecordStatus.length; i++)
      SharedRecordStatus.internalBinaryWrite(
        message.updateSharedRecordStatus[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.SharedRecordStatus removeSharedRecordStatus = 3; */
    for (let i = 0; i < message.removeSharedRecordStatus.length; i++)
      SharedRecordStatus.internalBinaryWrite(
        message.removeSharedRecordStatus[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordShareUpdateResponse
 */
export const RecordShareUpdateResponse = new RecordShareUpdateResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedRecordStatus$Type extends MessageType {
  constructor() {
    super("Records.SharedRecordStatus", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.status = "";
    message.message = "";
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* string status */ 2:
          message.status = reader.string();
          break;
        case /* string message */ 3:
          message.message = reader.string();
          break;
        case /* string username */ 4:
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* string status = 2; */
    if (message.status !== "") writer.tag(2, WireType.LengthDelimited).string(message.status);
    /* string message = 3; */
    if (message.message !== "") writer.tag(3, WireType.LengthDelimited).string(message.message);
    /* string username = 4; */
    if (message.username !== "") writer.tag(4, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.SharedRecordStatus
 */
export const SharedRecordStatus = new SharedRecordStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetRecordPermissionsRequest$Type extends MessageType {
  constructor() {
    super("Records.GetRecordPermissionsRequest", [
      {
        no: 1,
        name: "recordUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 2, name: "isShareAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUids = [];
    message.isShareAdmin = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes recordUids */ 1:
          message.recordUids.push(reader.bytes());
          break;
        case /* bool isShareAdmin */ 2:
          message.isShareAdmin = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes recordUids = 1; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.recordUids[i]);
    /* bool isShareAdmin = 2; */
    if (message.isShareAdmin !== false) writer.tag(2, WireType.Varint).bool(message.isShareAdmin);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetRecordPermissionsRequest
 */
export const GetRecordPermissionsRequest = new GetRecordPermissionsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetRecordPermissionsResponse$Type extends MessageType {
  constructor() {
    super("Records.GetRecordPermissionsResponse", [
      {
        no: 1,
        name: "recordPermissions",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordPermission,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* repeated Records.RecordPermission recordPermissions */ 1:
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
    /* repeated Records.RecordPermission recordPermissions = 1; */
    for (let i = 0; i < message.recordPermissions.length; i++)
      RecordPermission.internalBinaryWrite(
        message.recordPermissions[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetRecordPermissionsResponse
 */
export const GetRecordPermissionsResponse = new GetRecordPermissionsResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordPermission$Type extends MessageType {
  constructor() {
    super("Records.RecordPermission", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "owner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "canEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "canShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "canTransfer", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.owner = false;
    message.canEdit = false;
    message.canShare = false;
    message.canTransfer = false;
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
        case /* bool owner */ 2:
          message.owner = reader.bool();
          break;
        case /* bool canEdit */ 3:
          message.canEdit = reader.bool();
          break;
        case /* bool canShare */ 4:
          message.canShare = reader.bool();
          break;
        case /* bool canTransfer */ 5:
          message.canTransfer = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bool owner = 2; */
    if (message.owner !== false) writer.tag(2, WireType.Varint).bool(message.owner);
    /* bool canEdit = 3; */
    if (message.canEdit !== false) writer.tag(3, WireType.Varint).bool(message.canEdit);
    /* bool canShare = 4; */
    if (message.canShare !== false) writer.tag(4, WireType.Varint).bool(message.canShare);
    /* bool canTransfer = 5; */
    if (message.canTransfer !== false) writer.tag(5, WireType.Varint).bool(message.canTransfer);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordPermission
 */
export const RecordPermission = new RecordPermission$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetShareObjectsRequest$Type extends MessageType {
  constructor() {
    super("Records.GetShareObjectsRequest", [
      { no: 1, name: "startWith", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "contains", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "filtered", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.startWith = "";
    message.contains = "";
    message.filtered = false;
    message.sharedFolderUid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string startWith */ 1:
          message.startWith = reader.string();
          break;
        case /* string contains */ 2:
          message.contains = reader.string();
          break;
        case /* bool filtered */ 3:
          message.filtered = reader.bool();
          break;
        case /* bytes sharedFolderUid */ 4:
          message.sharedFolderUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string startWith = 1; */
    if (message.startWith !== "") writer.tag(1, WireType.LengthDelimited).string(message.startWith);
    /* string contains = 2; */
    if (message.contains !== "") writer.tag(2, WireType.LengthDelimited).string(message.contains);
    /* bool filtered = 3; */
    if (message.filtered !== false) writer.tag(3, WireType.Varint).bool(message.filtered);
    /* bytes sharedFolderUid = 4; */
    if (message.sharedFolderUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetShareObjectsRequest
 */
export const GetShareObjectsRequest = new GetShareObjectsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetShareObjectsResponse$Type extends MessageType {
  constructor() {
    super("Records.GetShareObjectsResponse", [
      {
        no: 1,
        name: "shareRelationships",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareUser,
      },
      {
        no: 2,
        name: "shareFamilyUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareUser,
      },
      {
        no: 3,
        name: "shareEnterpriseUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareUser,
      },
      {
        no: 4,
        name: "shareTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareTeam,
      },
      {
        no: 5,
        name: "shareMCTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareTeam,
      },
      {
        no: 6,
        name: "shareMCEnterpriseUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareUser,
      },
      {
        no: 7,
        name: "shareEnterpriseNames",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareEnterprise,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.shareRelationships = [];
    message.shareFamilyUsers = [];
    message.shareEnterpriseUsers = [];
    message.shareTeams = [];
    message.shareMCTeams = [];
    message.shareMCEnterpriseUsers = [];
    message.shareEnterpriseNames = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.ShareUser shareRelationships */ 1:
          message.shareRelationships.push(
            ShareUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.ShareUser shareFamilyUsers */ 2:
          message.shareFamilyUsers.push(
            ShareUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.ShareUser shareEnterpriseUsers */ 3:
          message.shareEnterpriseUsers.push(
            ShareUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.ShareTeam shareTeams */ 4:
          message.shareTeams.push(ShareTeam.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Records.ShareTeam shareMCTeams */ 5:
          message.shareMCTeams.push(ShareTeam.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Records.ShareUser shareMCEnterpriseUsers */ 6:
          message.shareMCEnterpriseUsers.push(
            ShareUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.ShareEnterprise shareEnterpriseNames */ 7:
          message.shareEnterpriseNames.push(
            ShareEnterprise.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.ShareUser shareRelationships = 1; */
    for (let i = 0; i < message.shareRelationships.length; i++)
      ShareUser.internalBinaryWrite(
        message.shareRelationships[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareUser shareFamilyUsers = 2; */
    for (let i = 0; i < message.shareFamilyUsers.length; i++)
      ShareUser.internalBinaryWrite(
        message.shareFamilyUsers[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareUser shareEnterpriseUsers = 3; */
    for (let i = 0; i < message.shareEnterpriseUsers.length; i++)
      ShareUser.internalBinaryWrite(
        message.shareEnterpriseUsers[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareTeam shareTeams = 4; */
    for (let i = 0; i < message.shareTeams.length; i++)
      ShareTeam.internalBinaryWrite(
        message.shareTeams[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareTeam shareMCTeams = 5; */
    for (let i = 0; i < message.shareMCTeams.length; i++)
      ShareTeam.internalBinaryWrite(
        message.shareMCTeams[i],
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareUser shareMCEnterpriseUsers = 6; */
    for (let i = 0; i < message.shareMCEnterpriseUsers.length; i++)
      ShareUser.internalBinaryWrite(
        message.shareMCEnterpriseUsers[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.ShareEnterprise shareEnterpriseNames = 7; */
    for (let i = 0; i < message.shareEnterpriseNames.length; i++)
      ShareEnterprise.internalBinaryWrite(
        message.shareEnterpriseNames[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.GetShareObjectsResponse
 */
export const GetShareObjectsResponse = new GetShareObjectsResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ShareUser$Type extends MessageType {
  constructor() {
    super("Records.ShareUser", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "fullname", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "status", kind: "enum", T: () => ["Records.ShareStatus", ShareStatus] },
      { no: 5, name: "isShareAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "isAdminOfSharedFolderOwner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.fullname = "";
    message.enterpriseId = 0;
    message.status = 0;
    message.isShareAdmin = false;
    message.isAdminOfSharedFolderOwner = false;
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
        case /* string fullname */ 2:
          message.fullname = reader.string();
          break;
        case /* int32 enterpriseId */ 3:
          message.enterpriseId = reader.int32();
          break;
        case /* Records.ShareStatus status */ 4:
          message.status = reader.int32();
          break;
        case /* bool isShareAdmin */ 5:
          message.isShareAdmin = reader.bool();
          break;
        case /* bool isAdminOfSharedFolderOwner */ 6:
          message.isAdminOfSharedFolderOwner = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* string fullname = 2; */
    if (message.fullname !== "") writer.tag(2, WireType.LengthDelimited).string(message.fullname);
    /* int32 enterpriseId = 3; */
    if (message.enterpriseId !== 0) writer.tag(3, WireType.Varint).int32(message.enterpriseId);
    /* Records.ShareStatus status = 4; */
    if (message.status !== 0) writer.tag(4, WireType.Varint).int32(message.status);
    /* bool isShareAdmin = 5; */
    if (message.isShareAdmin !== false) writer.tag(5, WireType.Varint).bool(message.isShareAdmin);
    /* bool isAdminOfSharedFolderOwner = 6; */
    if (message.isAdminOfSharedFolderOwner !== false)
      writer.tag(6, WireType.Varint).bool(message.isAdminOfSharedFolderOwner);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.ShareUser
 */
export const ShareUser = new ShareUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ShareTeam$Type extends MessageType {
  constructor() {
    super("Records.ShareTeam", [
      { no: 1, name: "teamname", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamname = "";
    message.enterpriseId = 0;
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
        case /* string teamname */ 1:
          message.teamname = reader.string();
          break;
        case /* int32 enterpriseId */ 2:
          message.enterpriseId = reader.int32();
          break;
        case /* bytes teamUid */ 3:
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
    /* string teamname = 1; */
    if (message.teamname !== "") writer.tag(1, WireType.LengthDelimited).string(message.teamname);
    /* int32 enterpriseId = 2; */
    if (message.enterpriseId !== 0) writer.tag(2, WireType.Varint).int32(message.enterpriseId);
    /* bytes teamUid = 3; */
    if (message.teamUid.length) writer.tag(3, WireType.LengthDelimited).bytes(message.teamUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.ShareTeam
 */
export const ShareTeam = new ShareTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ShareEnterprise$Type extends MessageType {
  constructor() {
    super("Records.ShareEnterprise", [
      { no: 1, name: "enterprisename", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterprisename = "";
    message.enterpriseId = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string enterprisename */ 1:
          message.enterprisename = reader.string();
          break;
        case /* int32 enterpriseId */ 2:
          message.enterpriseId = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string enterprisename = 1; */
    if (message.enterprisename !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.enterprisename);
    /* int32 enterpriseId = 2; */
    if (message.enterpriseId !== 0) writer.tag(2, WireType.Varint).int32(message.enterpriseId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.ShareEnterprise
 */
export const ShareEnterprise = new ShareEnterprise$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsOnwershipTransferRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsOnwershipTransferRequest", [
      {
        no: 1,
        name: "transferRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TransferRecord,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.transferRecords = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.TransferRecord transferRecords */ 1:
          message.transferRecords.push(
            TransferRecord.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.TransferRecord transferRecords = 1; */
    for (let i = 0; i < message.transferRecords.length; i++)
      TransferRecord.internalBinaryWrite(
        message.transferRecords[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsOnwershipTransferRequest
 */
export const RecordsOnwershipTransferRequest = new RecordsOnwershipTransferRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TransferRecord$Type extends MessageType {
  constructor() {
    super("Records.TransferRecord", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "useEccKey", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.useEccKey = false;
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
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* bytes recordKey */ 3:
          message.recordKey = reader.bytes();
          break;
        case /* bool useEccKey */ 4:
          message.useEccKey = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes recordKey = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    /* bool useEccKey = 4; */
    if (message.useEccKey !== false) writer.tag(4, WireType.Varint).bool(message.useEccKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.TransferRecord
 */
export const TransferRecord = new TransferRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsOnwershipTransferResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordsOnwershipTransferResponse", [
      {
        no: 1,
        name: "transferRecordStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => TransferRecordStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.transferRecordStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated Records.TransferRecordStatus transferRecordStatus */ 1:
          message.transferRecordStatus.push(
            TransferRecordStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.TransferRecordStatus transferRecordStatus = 1; */
    for (let i = 0; i < message.transferRecordStatus.length; i++)
      TransferRecordStatus.internalBinaryWrite(
        message.transferRecordStatus[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsOnwershipTransferResponse
 */
export const RecordsOnwershipTransferResponse = new RecordsOnwershipTransferResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TransferRecordStatus$Type extends MessageType {
  constructor() {
    super("Records.TransferRecordStatus", [
      { no: 1, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.username = "";
    message.recordUid = new Uint8Array(0);
    message.status = "";
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
        case /* string username */ 1:
          message.username = reader.string();
          break;
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* string status */ 3:
          message.status = reader.string();
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
    /* string username = 1; */
    if (message.username !== "") writer.tag(1, WireType.LengthDelimited).string(message.username);
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* string status = 3; */
    if (message.status !== "") writer.tag(3, WireType.LengthDelimited).string(message.status);
    /* string message = 4; */
    if (message.message !== "") writer.tag(4, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.TransferRecordStatus
 */
export const TransferRecordStatus = new TransferRecordStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareRequest$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareRequest", [
      {
        no: 1,
        name: "sharedFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordsUnshareFolder,
      },
      {
        no: 2,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordsUnshareUser,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolders = [];
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
        case /* repeated Records.RecordsUnshareFolder sharedFolders */ 1:
          message.sharedFolders.push(
            RecordsUnshareFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.RecordsUnshareUser users */ 2:
          message.users.push(
            RecordsUnshareUser.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.RecordsUnshareFolder sharedFolders = 1; */
    for (let i = 0; i < message.sharedFolders.length; i++)
      RecordsUnshareFolder.internalBinaryWrite(
        message.sharedFolders[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.RecordsUnshareUser users = 2; */
    for (let i = 0; i < message.users.length; i++)
      RecordsUnshareUser.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Records.RecordsUnshareRequest
 */
export const RecordsUnshareRequest = new RecordsUnshareRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareResponse$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareResponse", [
      {
        no: 1,
        name: "sharedFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordsUnshareFolderStatus,
      },
      {
        no: 2,
        name: "users",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordsUnshareUserStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolders = [];
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
        case /* repeated Records.RecordsUnshareFolderStatus sharedFolders */ 1:
          message.sharedFolders.push(
            RecordsUnshareFolderStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.RecordsUnshareUserStatus users */ 2:
          message.users.push(
            RecordsUnshareUserStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated Records.RecordsUnshareFolderStatus sharedFolders = 1; */
    for (let i = 0; i < message.sharedFolders.length; i++)
      RecordsUnshareFolderStatus.internalBinaryWrite(
        message.sharedFolders[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.RecordsUnshareUserStatus users = 2; */
    for (let i = 0; i < message.users.length; i++)
      RecordsUnshareUserStatus.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Records.RecordsUnshareResponse
 */
export const RecordsUnshareResponse = new RecordsUnshareResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareFolder$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareFolder", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.sharedFolderUid = new Uint8Array(0);
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
        case /* bytes sharedFolderUid */ 2:
          message.sharedFolderUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes sharedFolderUid = 2; */
    if (message.sharedFolderUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsUnshareFolder
 */
export const RecordsUnshareFolder = new RecordsUnshareFolder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareUser$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareUser", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes accountUid */ 2:
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes accountUid = 2; */
    if (message.accountUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.accountUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsUnshareUser
 */
export const RecordsUnshareUser = new RecordsUnshareUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareFolderStatus$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareFolderStatus", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.sharedFolderUid = new Uint8Array(0);
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
        case /* bytes sharedFolderUid */ 2:
          message.sharedFolderUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes sharedFolderUid = 2; */
    if (message.sharedFolderUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsUnshareFolderStatus
 */
export const RecordsUnshareFolderStatus = new RecordsUnshareFolderStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordsUnshareUserStatus$Type extends MessageType {
  constructor() {
    super("Records.RecordsUnshareUserStatus", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* bytes accountUid */ 2:
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes accountUid = 2; */
    if (message.accountUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.accountUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.RecordsUnshareUserStatus
 */
export const RecordsUnshareUserStatus = new RecordsUnshareUserStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimedAccessCallbackPayload$Type extends MessageType {
  constructor() {
    super("Records.TimedAccessCallbackPayload", [
      {
        no: 1,
        name: "timeLimitedAccessType",
        kind: "enum",
        T: () => ["Records.TimeLimitedAccessType", TimeLimitedAccessType],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.timeLimitedAccessType = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Records.TimeLimitedAccessType timeLimitedAccessType */ 1:
          message.timeLimitedAccessType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Records.TimeLimitedAccessType timeLimitedAccessType = 1; */
    if (message.timeLimitedAccessType !== 0)
      writer.tag(1, WireType.Varint).int32(message.timeLimitedAccessType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.TimedAccessCallbackPayload
 */
export const TimedAccessCallbackPayload = new TimedAccessCallbackPayload$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessRequest$Type extends MessageType {
  constructor() {
    super("Records.TimeLimitedAccessRequest", [
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
        T: () => ["Records.TimeLimitedAccessType", TimeLimitedAccessType],
      },
      {
        no: 6,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 7,
        name: "timerNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
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
    message.timerNotificationType = 0;
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
        case /* Records.TimeLimitedAccessType timeLimitedAccessType */ 5:
          message.timeLimitedAccessType = reader.int32();
          break;
        case /* int64 expiration */ 6:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType timerNotificationType */ 7:
          message.timerNotificationType = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* Records.TimeLimitedAccessType timeLimitedAccessType = 5; */
    if (message.timeLimitedAccessType !== 0)
      writer.tag(5, WireType.Varint).int32(message.timeLimitedAccessType);
    /* int64 expiration = 6; */
    if (message.expiration !== 0n) writer.tag(6, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType timerNotificationType = 7; */
    if (message.timerNotificationType !== 0)
      writer.tag(7, WireType.Varint).int32(message.timerNotificationType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Records.TimeLimitedAccessRequest
 */
export const TimeLimitedAccessRequest = new TimeLimitedAccessRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessStatus$Type extends MessageType {
  constructor() {
    super("Records.TimeLimitedAccessStatus", [
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
 * @generated MessageType for protobuf message Records.TimeLimitedAccessStatus
 */
export const TimeLimitedAccessStatus = new TimeLimitedAccessStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class TimeLimitedAccessResponse$Type extends MessageType {
  constructor() {
    super("Records.TimeLimitedAccessResponse", [
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
        case /* repeated Records.TimeLimitedAccessStatus userAccessStatus */ 2:
          message.userAccessStatus.push(
            TimeLimitedAccessStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.TimeLimitedAccessStatus teamAccessStatus */ 3:
          message.teamAccessStatus.push(
            TimeLimitedAccessStatus.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Records.TimeLimitedAccessStatus recordAccessStatus */ 4:
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
    /* repeated Records.TimeLimitedAccessStatus userAccessStatus = 2; */
    for (let i = 0; i < message.userAccessStatus.length; i++)
      TimeLimitedAccessStatus.internalBinaryWrite(
        message.userAccessStatus[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.TimeLimitedAccessStatus teamAccessStatus = 3; */
    for (let i = 0; i < message.teamAccessStatus.length; i++)
      TimeLimitedAccessStatus.internalBinaryWrite(
        message.teamAccessStatus[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Records.TimeLimitedAccessStatus recordAccessStatus = 4; */
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
 * @generated MessageType for protobuf message Records.TimeLimitedAccessResponse
 */
export const TimeLimitedAccessResponse = new TimeLimitedAccessResponse$Type();
