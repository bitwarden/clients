import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf enum BreachWatch.BreachWatchInfoType
 */
export var BreachWatchInfoType;
(function (BreachWatchInfoType) {
  /**
   * @generated from protobuf enum value: RECORD = 0;
   */
  BreachWatchInfoType[(BreachWatchInfoType["RECORD"] = 0)] = "RECORD";
  /**
   * @generated from protobuf enum value: ALTERNATE_PASSWORD = 1;
   */
  BreachWatchInfoType[(BreachWatchInfoType["ALTERNATE_PASSWORD"] = 1)] = "ALTERNATE_PASSWORD";
})(BreachWatchInfoType || (BreachWatchInfoType = {}));
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchRecordRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchRecordRequest", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "breachWatchInfoType",
        kind: "enum",
        T: () => ["BreachWatch.BreachWatchInfoType", BreachWatchInfoType],
      },
      { no: 4, name: "updateUserWhoScanned", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.encryptedData = new Uint8Array(0);
    message.breachWatchInfoType = 0;
    message.updateUserWhoScanned = false;
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
        case /* BreachWatch.BreachWatchInfoType breachWatchInfoType */ 3:
          message.breachWatchInfoType = reader.int32();
          break;
        case /* bool updateUserWhoScanned */ 4:
          message.updateUserWhoScanned = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* BreachWatch.BreachWatchInfoType breachWatchInfoType = 3; */
    if (message.breachWatchInfoType !== 0)
      writer.tag(3, WireType.Varint).int32(message.breachWatchInfoType);
    /* bool updateUserWhoScanned = 4; */
    if (message.updateUserWhoScanned !== false)
      writer.tag(4, WireType.Varint).bool(message.updateUserWhoScanned);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchRecordRequest
 */
export const BreachWatchRecordRequest = new BreachWatchRecordRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchUpdateRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchUpdateRequest", [
      {
        no: 1,
        name: "breachWatchRecordRequest",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchRecordRequest,
      },
      { no: 2, name: "encryptedData", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.breachWatchRecordRequest = [];
    message.encryptedData = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated BreachWatch.BreachWatchRecordRequest breachWatchRecordRequest */ 1:
          message.breachWatchRecordRequest.push(
            BreachWatchRecordRequest.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bytes encryptedData */ 2:
          message.encryptedData = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated BreachWatch.BreachWatchRecordRequest breachWatchRecordRequest = 1; */
    for (let i = 0; i < message.breachWatchRecordRequest.length; i++)
      BreachWatchRecordRequest.internalBinaryWrite(
        message.breachWatchRecordRequest[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes encryptedData = 2; */
    if (message.encryptedData.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedData);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchUpdateRequest
 */
export const BreachWatchUpdateRequest = new BreachWatchUpdateRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchRecordStatus$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchRecordStatus", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "status", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "reason", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
          break;
        case /* string status */ 2:
          message.status = reader.string();
          break;
        case /* string reason */ 3:
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* string status = 2; */
    if (message.status !== "") writer.tag(2, WireType.LengthDelimited).string(message.status);
    /* string reason = 3; */
    if (message.reason !== "") writer.tag(3, WireType.LengthDelimited).string(message.reason);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchRecordStatus
 */
export const BreachWatchRecordStatus = new BreachWatchRecordStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchUpdateResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchUpdateResponse", [
      {
        no: 1,
        name: "breachWatchRecordStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchRecordStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.breachWatchRecordStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated BreachWatch.BreachWatchRecordStatus breachWatchRecordStatus */ 1:
          message.breachWatchRecordStatus.push(
            BreachWatchRecordStatus.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated BreachWatch.BreachWatchRecordStatus breachWatchRecordStatus = 1; */
    for (let i = 0; i < message.breachWatchRecordStatus.length; i++)
      BreachWatchRecordStatus.internalBinaryWrite(
        message.breachWatchRecordStatus[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchUpdateResponse
 */
export const BreachWatchUpdateResponse = new BreachWatchUpdateResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchTokenRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchTokenRequest", [
      { no: 1, name: "breachWatchToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.breachWatchToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes breachWatchToken */ 1:
          message.breachWatchToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes breachWatchToken = 1; */
    if (message.breachWatchToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.breachWatchToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchTokenRequest
 */
export const BreachWatchTokenRequest = new BreachWatchTokenRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchTokenResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchTokenResponse", [
      { no: 1, name: "breachWatchToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "clientEncrypted", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.breachWatchToken = new Uint8Array(0);
    message.clientEncrypted = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes breachWatchToken */ 1:
          message.breachWatchToken = reader.bytes();
          break;
        case /* bool clientEncrypted */ 2:
          message.clientEncrypted = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes breachWatchToken = 1; */
    if (message.breachWatchToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.breachWatchToken);
    /* bool clientEncrypted = 2; */
    if (message.clientEncrypted !== false)
      writer.tag(2, WireType.Varint).bool(message.clientEncrypted);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchTokenResponse
 */
export const BreachWatchTokenResponse = new BreachWatchTokenResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnonymizedTokenResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.AnonymizedTokenResponse", [
      { no: 1, name: "domainToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "emailToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "passwordToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.domainToken = new Uint8Array(0);
    message.emailToken = new Uint8Array(0);
    message.passwordToken = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes domainToken */ 1:
          message.domainToken = reader.bytes();
          break;
        case /* bytes emailToken */ 2:
          message.emailToken = reader.bytes();
          break;
        case /* bytes passwordToken */ 3:
          message.passwordToken = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes domainToken = 1; */
    if (message.domainToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.domainToken);
    /* bytes emailToken = 2; */
    if (message.emailToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.emailToken);
    /* bytes passwordToken = 3; */
    if (message.passwordToken.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.passwordToken);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.AnonymizedTokenResponse
 */
export const AnonymizedTokenResponse = new AnonymizedTokenResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class HashCheck$Type extends MessageType {
  constructor() {
    super("BreachWatch.HashCheck", [
      { no: 1, name: "hash1", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "euid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.hash1 = new Uint8Array(0);
    message.euid = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes hash1 */ 1:
          message.hash1 = reader.bytes();
          break;
        case /* bytes euid */ 2:
          message.euid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes hash1 = 1; */
    if (message.hash1.length) writer.tag(1, WireType.LengthDelimited).bytes(message.hash1);
    /* bytes euid = 2; */
    if (message.euid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.euid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.HashCheck
 */
export const HashCheck = new HashCheck$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchStatusRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchStatusRequest", [
      { no: 1, name: "anonymizedToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "hashCheck",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => HashCheck,
      },
      {
        no: 3,
        name: "removedEuid",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.anonymizedToken = new Uint8Array(0);
    message.hashCheck = [];
    message.removedEuid = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes anonymizedToken */ 1:
          message.anonymizedToken = reader.bytes();
          break;
        case /* repeated BreachWatch.HashCheck hashCheck */ 2:
          message.hashCheck.push(HashCheck.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated bytes removedEuid */ 3:
          message.removedEuid.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes anonymizedToken = 1; */
    if (message.anonymizedToken.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.anonymizedToken);
    /* repeated BreachWatch.HashCheck hashCheck = 2; */
    for (let i = 0; i < message.hashCheck.length; i++)
      HashCheck.internalBinaryWrite(
        message.hashCheck[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes removedEuid = 3; */
    for (let i = 0; i < message.removedEuid.length; i++)
      writer.tag(3, WireType.LengthDelimited).bytes(message.removedEuid[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchStatusRequest
 */
export const BreachWatchStatusRequest = new BreachWatchStatusRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class HashStatus$Type extends MessageType {
  constructor() {
    super("BreachWatch.HashStatus", [
      { no: 1, name: "hash1", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "euid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "breachDetected", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.hash1 = new Uint8Array(0);
    message.euid = new Uint8Array(0);
    message.breachDetected = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes hash1 */ 1:
          message.hash1 = reader.bytes();
          break;
        case /* bytes euid */ 2:
          message.euid = reader.bytes();
          break;
        case /* bool breachDetected */ 3:
          message.breachDetected = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes hash1 = 1; */
    if (message.hash1.length) writer.tag(1, WireType.LengthDelimited).bytes(message.hash1);
    /* bytes euid = 2; */
    if (message.euid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.euid);
    /* bool breachDetected = 3; */
    if (message.breachDetected !== false)
      writer.tag(3, WireType.Varint).bool(message.breachDetected);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.HashStatus
 */
export const HashStatus = new HashStatus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchStatusResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachWatchStatusResponse", [
      {
        no: 2,
        name: "hashStatus",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => HashStatus,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.hashStatus = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated BreachWatch.HashStatus hashStatus */ 2:
          message.hashStatus.push(HashStatus.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated BreachWatch.HashStatus hashStatus = 2; */
    for (let i = 0; i < message.hashStatus.length; i++)
      HashStatus.internalBinaryWrite(
        message.hashStatus[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachWatchStatusResponse
 */
export const BreachWatchStatusResponse = new BreachWatchStatusResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class EnterprisePublicKeyResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.EnterprisePublicKeyResponse", [
      { no: 1, name: "enterprisePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "enterpriseECCPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterprisePublicKey = new Uint8Array(0);
    message.enterpriseECCPublicKey = new Uint8Array(0);
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
        case /* bytes enterpriseECCPublicKey */ 2:
          message.enterpriseECCPublicKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes enterpriseECCPublicKey = 2; */
    if (message.enterpriseECCPublicKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.enterpriseECCPublicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.EnterprisePublicKeyResponse
 */
export const EnterprisePublicKeyResponse = new EnterprisePublicKeyResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FreeScanRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.FreeScanRequest", [
      { no: 1, name: "hashedEmail", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.hashedEmail = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes hashedEmail */ 1:
          message.hashedEmail = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes hashedEmail = 1; */
    if (message.hashedEmail.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.hashedEmail);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.FreeScanRequest
 */
export const FreeScanRequest = new FreeScanRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FreeScanResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.FreeScanResponse", [
      { no: 1, name: "emailBreaches", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "passwordBreaches", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.emailBreaches = 0;
    message.passwordBreaches = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 emailBreaches */ 1:
          message.emailBreaches = reader.int32();
          break;
        case /* int32 passwordBreaches */ 2:
          message.passwordBreaches = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 emailBreaches = 1; */
    if (message.emailBreaches !== 0) writer.tag(1, WireType.Varint).int32(message.emailBreaches);
    /* int32 passwordBreaches = 2; */
    if (message.passwordBreaches !== 0)
      writer.tag(2, WireType.Varint).int32(message.passwordBreaches);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.FreeScanResponse
 */
export const FreeScanResponse = new FreeScanResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PaidUserRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.PaidUserRequest", [
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
 * @generated MessageType for protobuf message BreachWatch.PaidUserRequest
 */
export const PaidUserRequest = new PaidUserRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PaidUserResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.PaidUserResponse", [
      { no: 1, name: "paidUser", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.paidUser = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool paidUser */ 1:
          message.paidUser = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool paidUser = 1; */
    if (message.paidUser !== false) writer.tag(1, WireType.Varint).bool(message.paidUser);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.PaidUserResponse
 */
export const PaidUserResponse = new PaidUserResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DetailedScanRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.DetailedScanRequest", [
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
 * @generated MessageType for protobuf message BreachWatch.DetailedScanRequest
 */
export const DetailedScanRequest = new DetailedScanRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UseOneTimeTokenRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.UseOneTimeTokenRequest", [
      { no: 1, name: "token", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.token = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes token */ 1:
          message.token = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes token = 1; */
    if (message.token.length) writer.tag(1, WireType.LengthDelimited).bytes(message.token);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.UseOneTimeTokenRequest
 */
export const UseOneTimeTokenRequest = new UseOneTimeTokenRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachEvent$Type extends MessageType {
  constructor() {
    super("BreachWatch.BreachEvent", [
      { no: 1, name: "site", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "passwordInBreach", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "date", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "description", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.site = "";
    message.email = "";
    message.passwordInBreach = false;
    message.date = "";
    message.description = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string site */ 1:
          message.site = reader.string();
          break;
        case /* string email */ 2:
          message.email = reader.string();
          break;
        case /* bool passwordInBreach */ 3:
          message.passwordInBreach = reader.bool();
          break;
        case /* string date */ 4:
          message.date = reader.string();
          break;
        case /* string description */ 5:
          message.description = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string site = 1; */
    if (message.site !== "") writer.tag(1, WireType.LengthDelimited).string(message.site);
    /* string email = 2; */
    if (message.email !== "") writer.tag(2, WireType.LengthDelimited).string(message.email);
    /* bool passwordInBreach = 3; */
    if (message.passwordInBreach !== false)
      writer.tag(3, WireType.Varint).bool(message.passwordInBreach);
    /* string date = 4; */
    if (message.date !== "") writer.tag(4, WireType.LengthDelimited).string(message.date);
    /* string description = 5; */
    if (message.description !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.description);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.BreachEvent
 */
export const BreachEvent = new BreachEvent$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UseOneTimeTokenResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.UseOneTimeTokenResponse", [
      { no: 1, name: "emailBreaches", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "passwordBreaches", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 3,
        name: "breachEvents",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachEvent,
      },
      { no: 4, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.emailBreaches = 0;
    message.passwordBreaches = 0;
    message.breachEvents = [];
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
        case /* int32 emailBreaches */ 1:
          message.emailBreaches = reader.int32();
          break;
        case /* int32 passwordBreaches */ 2:
          message.passwordBreaches = reader.int32();
          break;
        case /* repeated BreachWatch.BreachEvent breachEvents */ 3:
          message.breachEvents.push(
            BreachEvent.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* string email */ 4:
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
    /* int32 emailBreaches = 1; */
    if (message.emailBreaches !== 0) writer.tag(1, WireType.Varint).int32(message.emailBreaches);
    /* int32 passwordBreaches = 2; */
    if (message.passwordBreaches !== 0)
      writer.tag(2, WireType.Varint).int32(message.passwordBreaches);
    /* repeated BreachWatch.BreachEvent breachEvents = 3; */
    for (let i = 0; i < message.breachEvents.length; i++)
      BreachEvent.internalBinaryWrite(
        message.breachEvents[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string email = 4; */
    if (message.email !== "") writer.tag(4, WireType.LengthDelimited).string(message.email);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.UseOneTimeTokenResponse
 */
export const UseOneTimeTokenResponse = new UseOneTimeTokenResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class OneTimeUseToken$Type extends MessageType {
  constructor() {
    super("BreachWatch.OneTimeUseToken", [
      { no: 1, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "pad", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.email = "";
    message.pad = "";
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
        case /* string pad */ 2:
          message.pad = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* string pad = 2; */
    if (message.pad !== "") writer.tag(2, WireType.LengthDelimited).string(message.pad);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.OneTimeUseToken
 */
export const OneTimeUseToken = new OneTimeUseToken$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FreePasswordScanRequest$Type extends MessageType {
  constructor() {
    super("BreachWatch.FreePasswordScanRequest", [
      { no: 1, name: "hashedPassword", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.hashedPassword = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes hashedPassword */ 1:
          message.hashedPassword = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes hashedPassword = 1; */
    if (message.hashedPassword.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.hashedPassword);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.FreePasswordScanRequest
 */
export const FreePasswordScanRequest = new FreePasswordScanRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class FreePasswordScanResponse$Type extends MessageType {
  constructor() {
    super("BreachWatch.FreePasswordScanResponse", [
      {
        no: 1,
        name: "passwordBreaches",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.passwordBreaches = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 passwordBreaches */ 1:
          message.passwordBreaches = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 passwordBreaches = 1; */
    if (message.passwordBreaches !== 0n)
      writer.tag(1, WireType.Varint).int64(message.passwordBreaches);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message BreachWatch.FreePasswordScanResponse
 */
export const FreePasswordScanResponse = new FreePasswordScanResponse$Type();
