import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType as MessageType$ } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf enum Push.MessageType
 */
export var MessageType;
(function (MessageType) {
  /**
   * @generated from protobuf enum value: UNKNOWN = 0;
   */
  MessageType[(MessageType["UNKNOWN"] = 0)] = "UNKNOWN";
  /**
   * @generated from protobuf enum value: DNA = 1;
   */
  MessageType[(MessageType["DNA"] = 1)] = "DNA";
  /**
   * @generated from protobuf enum value: SSO = 2;
   */
  MessageType[(MessageType["SSO"] = 2)] = "SSO";
  /**
   * @generated from protobuf enum value: CHAT = 3;
   */
  MessageType[(MessageType["CHAT"] = 3)] = "CHAT";
  /**
   * @generated from protobuf enum value: USER = 4;
   */
  MessageType[(MessageType["USER"] = 4)] = "USER";
  /**
   * @generated from protobuf enum value: ENTERPRISE = 5;
   */
  MessageType[(MessageType["ENTERPRISE"] = 5)] = "ENTERPRISE";
  /**
   * @generated from protobuf enum value: KEEPER = 6;
   */
  MessageType[(MessageType["KEEPER"] = 6)] = "KEEPER";
  /**
   * @generated from protobuf enum value: SESSION = 7;
   */
  MessageType[(MessageType["SESSION"] = 7)] = "SESSION";
  /**
   * @generated from protobuf enum value: DEVICE = 8;
   */
  MessageType[(MessageType["DEVICE"] = 8)] = "DEVICE";
  /**
   * @generated from protobuf enum value: TOTP = 9;
   */
  MessageType[(MessageType["TOTP"] = 9)] = "TOTP";
})(MessageType || (MessageType = {}));
// @generated message type with reflection information, may provide speed optimized methods
class UserRegistrationRequest$Type extends MessageType$ {
  constructor() {
    super("Push.UserRegistrationRequest", [
      { no: 1, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageSessionUid = new Uint8Array(0);
    message.userId = 0;
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
        case /* bytes messageSessionUid */ 1:
          message.messageSessionUid = reader.bytes();
          break;
        case /* int32 userId */ 2:
          message.userId = reader.int32();
          break;
        case /* int32 enterpriseId */ 3:
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
    /* bytes messageSessionUid = 1; */
    if (message.messageSessionUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* int32 userId = 2; */
    if (message.userId !== 0) writer.tag(2, WireType.Varint).int32(message.userId);
    /* int32 enterpriseId = 3; */
    if (message.enterpriseId !== 0) writer.tag(3, WireType.Varint).int32(message.enterpriseId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.UserRegistrationRequest
 */
export const UserRegistrationRequest = new UserRegistrationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KAToPushServerRequest$Type extends MessageType$ {
  constructor() {
    super("Push.KAToPushServerRequest", [
      { no: 1, name: "messageType", kind: "enum", T: () => ["Push.MessageType", MessageType] },
      { no: 2, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "encryptedDeviceToken",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 5,
        name: "userId",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 5 /*ScalarType.INT32*/,
      },
      {
        no: 6,
        name: "enterpriseId",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 5 /*ScalarType.INT32*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageType = 0;
    message.message = "";
    message.messageSessionUid = new Uint8Array(0);
    message.encryptedDeviceToken = [];
    message.userId = [];
    message.enterpriseId = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Push.MessageType messageType */ 1:
          message.messageType = reader.int32();
          break;
        case /* string message */ 2:
          message.message = reader.string();
          break;
        case /* bytes messageSessionUid */ 3:
          message.messageSessionUid = reader.bytes();
          break;
        case /* repeated bytes encryptedDeviceToken */ 4:
          message.encryptedDeviceToken.push(reader.bytes());
          break;
        case /* repeated int32 userId */ 5:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.userId.push(reader.int32());
          else message.userId.push(reader.int32());
          break;
        case /* repeated int32 enterpriseId */ 6:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.enterpriseId.push(reader.int32());
          else message.enterpriseId.push(reader.int32());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Push.MessageType messageType = 1; */
    if (message.messageType !== 0) writer.tag(1, WireType.Varint).int32(message.messageType);
    /* string message = 2; */
    if (message.message !== "") writer.tag(2, WireType.LengthDelimited).string(message.message);
    /* bytes messageSessionUid = 3; */
    if (message.messageSessionUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.messageSessionUid);
    /* repeated bytes encryptedDeviceToken = 4; */
    for (let i = 0; i < message.encryptedDeviceToken.length; i++)
      writer.tag(4, WireType.LengthDelimited).bytes(message.encryptedDeviceToken[i]);
    /* repeated int32 userId = 5; */
    if (message.userId.length) {
      writer.tag(5, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.userId.length; i++) writer.int32(message.userId[i]);
      writer.join();
    }
    /* repeated int32 enterpriseId = 6; */
    if (message.enterpriseId.length) {
      writer.tag(6, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.enterpriseId.length; i++) writer.int32(message.enterpriseId[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.KAToPushServerRequest
 */
export const KAToPushServerRequest = new KAToPushServerRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class WssConnectionRequest$Type extends MessageType$ {
  constructor() {
    super("Push.WssConnectionRequest", [
      { no: 1, name: "messageSessionUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "deviceTimeStamp",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageSessionUid = new Uint8Array(0);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.deviceTimeStamp = 0n;
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
        case /* bytes encryptedDeviceToken */ 2:
          message.encryptedDeviceToken = reader.bytes();
          break;
        case /* int64 deviceTimeStamp */ 3:
          message.deviceTimeStamp = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes encryptedDeviceToken = 2; */
    if (message.encryptedDeviceToken.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDeviceToken);
    /* int64 deviceTimeStamp = 3; */
    if (message.deviceTimeStamp !== 0n)
      writer.tag(3, WireType.Varint).int64(message.deviceTimeStamp);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.WssConnectionRequest
 */
export const WssConnectionRequest = new WssConnectionRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class WssClientResponse$Type extends MessageType$ {
  constructor() {
    super("Push.WssClientResponse", [
      { no: 1, name: "messageType", kind: "enum", T: () => ["Push.MessageType", MessageType] },
      { no: 2, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageType = 0;
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
        case /* Push.MessageType messageType */ 1:
          message.messageType = reader.int32();
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
    /* Push.MessageType messageType = 1; */
    if (message.messageType !== 0) writer.tag(1, WireType.Varint).int32(message.messageType);
    /* string message = 2; */
    if (message.message !== "") writer.tag(2, WireType.LengthDelimited).string(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.WssClientResponse
 */
export const WssClientResponse = new WssClientResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PushServerDeviceRegistrationRequest$Type extends MessageType$ {
  constructor() {
    super("Push.PushServerDeviceRegistrationRequest", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "pushToken", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "mobilePushPlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "transmissionKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.pushToken = "";
    message.mobilePushPlatform = "";
    message.transmissionKey = new Uint8Array(0);
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
        case /* string pushToken */ 2:
          message.pushToken = reader.string();
          break;
        case /* string mobilePushPlatform */ 3:
          message.mobilePushPlatform = reader.string();
          break;
        case /* bytes transmissionKey */ 4:
          message.transmissionKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* string pushToken = 2; */
    if (message.pushToken !== "") writer.tag(2, WireType.LengthDelimited).string(message.pushToken);
    /* string mobilePushPlatform = 3; */
    if (message.mobilePushPlatform !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.mobilePushPlatform);
    /* bytes transmissionKey = 4; */
    if (message.transmissionKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.transmissionKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.PushServerDeviceRegistrationRequest
 */
export const PushServerDeviceRegistrationRequest = new PushServerDeviceRegistrationRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SnsMessage$Type extends MessageType$ {
  constructor() {
    super("Push.SnsMessage", [
      { no: 1, name: "messageType", kind: "enum", T: () => ["Push.MessageType", MessageType] },
      { no: 2, name: "message", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.messageType = 0;
    message.message = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* Push.MessageType messageType */ 1:
          message.messageType = reader.int32();
          break;
        case /* bytes message */ 2:
          message.message = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* Push.MessageType messageType = 1; */
    if (message.messageType !== 0) writer.tag(1, WireType.Varint).int32(message.messageType);
    /* bytes message = 2; */
    if (message.message.length) writer.tag(2, WireType.LengthDelimited).bytes(message.message);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Push.SnsMessage
 */
export const SnsMessage = new SnsMessage$Type();
