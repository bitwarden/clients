import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
import { GraphSyncRef } from "./GraphSync";
/**
 * @generated from protobuf enum NotificationCenter.NotificationCategory
 */
export var NotificationCategory;
(function (NotificationCategory) {
  /**
   * @generated from protobuf enum value: NC_UNSPECIFIED = 0;
   */
  NotificationCategory[(NotificationCategory["NC_UNSPECIFIED"] = 0)] = "NC_UNSPECIFIED";
  /**
   * @generated from protobuf enum value: NC_ACCOUNT = 1;
   */
  NotificationCategory[(NotificationCategory["NC_ACCOUNT"] = 1)] = "NC_ACCOUNT";
  /**
   * @generated from protobuf enum value: NC_SHARING = 2;
   */
  NotificationCategory[(NotificationCategory["NC_SHARING"] = 2)] = "NC_SHARING";
  /**
   * @generated from protobuf enum value: NC_ENTERPRISE = 3;
   */
  NotificationCategory[(NotificationCategory["NC_ENTERPRISE"] = 3)] = "NC_ENTERPRISE";
  /**
   * @generated from protobuf enum value: NC_SECURITY = 4;
   */
  NotificationCategory[(NotificationCategory["NC_SECURITY"] = 4)] = "NC_SECURITY";
  /**
   * @generated from protobuf enum value: NC_REQUEST = 5;
   */
  NotificationCategory[(NotificationCategory["NC_REQUEST"] = 5)] = "NC_REQUEST";
  /**
   * @generated from protobuf enum value: NC_SYSTEM = 6;
   */
  NotificationCategory[(NotificationCategory["NC_SYSTEM"] = 6)] = "NC_SYSTEM";
  /**
   * @generated from protobuf enum value: NC_PROMOTION = 7;
   */
  NotificationCategory[(NotificationCategory["NC_PROMOTION"] = 7)] = "NC_PROMOTION";
})(NotificationCategory || (NotificationCategory = {}));
/**
 * @generated from protobuf enum NotificationCenter.NotificationType
 */
export var NotificationType;
(function (NotificationType) {
  /**
   * @generated from protobuf enum value: NT_UNSPECIFIED = 0;
   */
  NotificationType[(NotificationType["NT_UNSPECIFIED"] = 0)] = "NT_UNSPECIFIED";
  /**
   * @generated from protobuf enum value: NT_ALERT = 1;
   */
  NotificationType[(NotificationType["NT_ALERT"] = 1)] = "NT_ALERT";
  /**
   * @generated from protobuf enum value: NT_DEVICE_APPROVAL = 2;
   */
  NotificationType[(NotificationType["NT_DEVICE_APPROVAL"] = 2)] = "NT_DEVICE_APPROVAL";
  /**
   * @generated from protobuf enum value: NT_MASTER_PASS_UPDATED = 3;
   */
  NotificationType[(NotificationType["NT_MASTER_PASS_UPDATED"] = 3)] = "NT_MASTER_PASS_UPDATED";
  /**
   * @generated from protobuf enum value: NT_SHARE_APPROVAL = 4;
   */
  NotificationType[(NotificationType["NT_SHARE_APPROVAL"] = 4)] = "NT_SHARE_APPROVAL";
  /**
   * @generated from protobuf enum value: NT_SHARE_APPROVAL_APPROVED = 5;
   */
  NotificationType[(NotificationType["NT_SHARE_APPROVAL_APPROVED"] = 5)] =
    "NT_SHARE_APPROVAL_APPROVED";
  /**
   * @generated from protobuf enum value: NT_SHARED = 6;
   */
  NotificationType[(NotificationType["NT_SHARED"] = 6)] = "NT_SHARED";
  /**
   * @generated from protobuf enum value: NT_TRANSFERRED = 7;
   */
  NotificationType[(NotificationType["NT_TRANSFERRED"] = 7)] = "NT_TRANSFERRED";
  /**
   * @generated from protobuf enum value: NT_LICENSE_LIMIT_REACHED = 8;
   */
  NotificationType[(NotificationType["NT_LICENSE_LIMIT_REACHED"] = 8)] = "NT_LICENSE_LIMIT_REACHED";
  /**
   * @generated from protobuf enum value: NT_APPROVAL_REQUEST = 9;
   */
  NotificationType[(NotificationType["NT_APPROVAL_REQUEST"] = 9)] = "NT_APPROVAL_REQUEST";
  /**
   * @generated from protobuf enum value: NT_APPROVED_RESPONSE = 10;
   */
  NotificationType[(NotificationType["NT_APPROVED_RESPONSE"] = 10)] = "NT_APPROVED_RESPONSE";
  /**
   * @generated from protobuf enum value: NT_DENIED_RESPONSE = 11;
   */
  NotificationType[(NotificationType["NT_DENIED_RESPONSE"] = 11)] = "NT_DENIED_RESPONSE";
  /**
   * @generated from protobuf enum value: NT_2FA_CONFIGURED = 12;
   */
  NotificationType[(NotificationType["NT_2FA_CONFIGURED"] = 12)] = "NT_2FA_CONFIGURED";
  /**
   * @generated from protobuf enum value: NT_SHARE_APPROVAL_DENIED = 13;
   */
  NotificationType[(NotificationType["NT_SHARE_APPROVAL_DENIED"] = 13)] =
    "NT_SHARE_APPROVAL_DENIED";
})(NotificationType || (NotificationType = {}));
/**
 * @generated from protobuf enum NotificationCenter.NotificationReadStatus
 */
export var NotificationReadStatus;
(function (NotificationReadStatus) {
  /**
   * @generated from protobuf enum value: NRS_UNSPECIFIED = 0;
   */
  NotificationReadStatus[(NotificationReadStatus["NRS_UNSPECIFIED"] = 0)] = "NRS_UNSPECIFIED";
  /**
   * @generated from protobuf enum value: NRS_LAST = 1;
   */
  NotificationReadStatus[(NotificationReadStatus["NRS_LAST"] = 1)] = "NRS_LAST";
  /**
   * @generated from protobuf enum value: NRS_READ = 2;
   */
  NotificationReadStatus[(NotificationReadStatus["NRS_READ"] = 2)] = "NRS_READ";
  /**
   * @generated from protobuf enum value: NRS_UNREAD = 3;
   */
  NotificationReadStatus[(NotificationReadStatus["NRS_UNREAD"] = 3)] = "NRS_UNREAD";
})(NotificationReadStatus || (NotificationReadStatus = {}));
/**
 * @generated from protobuf enum NotificationCenter.NotificationApprovalStatus
 */
export var NotificationApprovalStatus;
(function (NotificationApprovalStatus) {
  /**
   * @generated from protobuf enum value: NAS_UNSPECIFIED = 0;
   */
  NotificationApprovalStatus[(NotificationApprovalStatus["NAS_UNSPECIFIED"] = 0)] =
    "NAS_UNSPECIFIED";
  /**
   * @generated from protobuf enum value: NAS_APPROVED = 1;
   */
  NotificationApprovalStatus[(NotificationApprovalStatus["NAS_APPROVED"] = 1)] = "NAS_APPROVED";
  /**
   * @generated from protobuf enum value: NAS_DENIED = 2;
   */
  NotificationApprovalStatus[(NotificationApprovalStatus["NAS_DENIED"] = 2)] = "NAS_DENIED";
  /**
   * @generated from protobuf enum value: NAS_LOST_APPROVAL_RIGHTS = 3;
   */
  NotificationApprovalStatus[(NotificationApprovalStatus["NAS_LOST_APPROVAL_RIGHTS"] = 3)] =
    "NAS_LOST_APPROVAL_RIGHTS";
  /**
   * @generated from protobuf enum value: NAS_LOST_ACCESS = 4;
   */
  NotificationApprovalStatus[(NotificationApprovalStatus["NAS_LOST_ACCESS"] = 4)] =
    "NAS_LOST_ACCESS";
})(NotificationApprovalStatus || (NotificationApprovalStatus = {}));
// @generated message type with reflection information, may provide speed optimized methods
class EncryptedData$Type extends MessageType {
  constructor() {
    super("NotificationCenter.EncryptedData", [
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
 * @generated MessageType for protobuf message NotificationCenter.EncryptedData
 */
export const EncryptedData = new EncryptedData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Notification$Type extends MessageType {
  constructor() {
    super("NotificationCenter.Notification", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        T: () => ["NotificationCenter.NotificationType", NotificationType],
      },
      {
        no: 2,
        name: "category",
        kind: "enum",
        T: () => ["NotificationCenter.NotificationCategory", NotificationCategory],
      },
      { no: 3, name: "sender", kind: "message", T: () => GraphSyncRef },
      { no: 4, name: "senderFullName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "encryptedData", kind: "message", T: () => EncryptedData },
      {
        no: 6,
        name: "refs",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncRef,
      },
      {
        no: 7,
        name: "categories",
        kind: "enum",
        repeat: 1 /*RepeatType.PACKED*/,
        T: () => ["NotificationCenter.NotificationCategory", NotificationCategory],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    message.category = 0;
    message.senderFullName = "";
    message.refs = [];
    message.categories = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* NotificationCenter.NotificationType type */ 1:
          message.type = reader.int32();
          break;
        case /* NotificationCenter.NotificationCategory category */ 2:
          message.category = reader.int32();
          break;
        case /* GraphSync.GraphSyncRef sender */ 3:
          message.sender = GraphSyncRef.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.sender,
          );
          break;
        case /* string senderFullName */ 4:
          message.senderFullName = reader.string();
          break;
        case /* NotificationCenter.EncryptedData encryptedData */ 5:
          message.encryptedData = EncryptedData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.encryptedData,
          );
          break;
        case /* repeated GraphSync.GraphSyncRef refs */ 6:
          message.refs.push(GraphSyncRef.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated NotificationCenter.NotificationCategory categories */ 7:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.categories.push(reader.int32());
          else message.categories.push(reader.int32());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* NotificationCenter.NotificationType type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    /* NotificationCenter.NotificationCategory category = 2; */
    if (message.category !== 0) writer.tag(2, WireType.Varint).int32(message.category);
    /* GraphSync.GraphSyncRef sender = 3; */
    if (message.sender)
      GraphSyncRef.internalBinaryWrite(
        message.sender,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string senderFullName = 4; */
    if (message.senderFullName !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.senderFullName);
    /* NotificationCenter.EncryptedData encryptedData = 5; */
    if (message.encryptedData)
      EncryptedData.internalBinaryWrite(
        message.encryptedData,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated GraphSync.GraphSyncRef refs = 6; */
    for (let i = 0; i < message.refs.length; i++)
      GraphSyncRef.internalBinaryWrite(
        message.refs[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated NotificationCenter.NotificationCategory categories = 7; */
    if (message.categories.length) {
      writer.tag(7, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.categories.length; i++) writer.int32(message.categories[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.Notification
 */
export const Notification = new Notification$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationReadMark$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationReadMark", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "notification_edge_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "mark_edge_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "readStatus",
        kind: "enum",
        T: () => ["NotificationCenter.NotificationReadStatus", NotificationReadStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.notificationEdgeId = 0n;
    message.markEdgeId = 0n;
    message.readStatus = 0;
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
        case /* int64 notification_edge_id */ 2:
          message.notificationEdgeId = reader.int64().toBigInt();
          break;
        case /* int64 mark_edge_id */ 3:
          message.markEdgeId = reader.int64().toBigInt();
          break;
        case /* NotificationCenter.NotificationReadStatus readStatus */ 4:
          message.readStatus = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int64 notification_edge_id = 2; */
    if (message.notificationEdgeId !== 0n)
      writer.tag(2, WireType.Varint).int64(message.notificationEdgeId);
    /* int64 mark_edge_id = 3; */
    if (message.markEdgeId !== 0n) writer.tag(3, WireType.Varint).int64(message.markEdgeId);
    /* NotificationCenter.NotificationReadStatus readStatus = 4; */
    if (message.readStatus !== 0) writer.tag(4, WireType.Varint).int32(message.readStatus);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationReadMark
 */
export const NotificationReadMark = new NotificationReadMark$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationContent$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationContent", [
      { no: 1, name: "notification", kind: "message", oneof: "type", T: () => Notification },
      {
        no: 2,
        name: "readStatus",
        kind: "enum",
        oneof: "type",
        T: () => ["NotificationCenter.NotificationReadStatus", NotificationReadStatus],
      },
      {
        no: 3,
        name: "approvalStatus",
        kind: "enum",
        oneof: "type",
        T: () => ["NotificationCenter.NotificationApprovalStatus", NotificationApprovalStatus],
      },
      { no: 4, name: "trimmingPoint", kind: "scalar", oneof: "type", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 5,
        name: "clientTypeIDs",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 5 /*ScalarType.INT32*/,
      },
      {
        no: 6,
        name: "deviceIDs",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = { oneofKind: undefined };
    message.clientTypeIDs = [];
    message.deviceIDs = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* NotificationCenter.Notification notification */ 1:
          message.type = {
            oneofKind: "notification",
            notification: Notification.internalBinaryRead(
              reader,
              reader.uint32(),
              options,
              message.type.notification,
            ),
          };
          break;
        case /* NotificationCenter.NotificationReadStatus readStatus */ 2:
          message.type = {
            oneofKind: "readStatus",
            readStatus: reader.int32(),
          };
          break;
        case /* NotificationCenter.NotificationApprovalStatus approvalStatus */ 3:
          message.type = {
            oneofKind: "approvalStatus",
            approvalStatus: reader.int32(),
          };
          break;
        case /* bool trimmingPoint */ 4:
          message.type = {
            oneofKind: "trimmingPoint",
            trimmingPoint: reader.bool(),
          };
          break;
        case /* repeated int32 clientTypeIDs */ 5:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.clientTypeIDs.push(reader.int32());
          else message.clientTypeIDs.push(reader.int32());
          break;
        case /* repeated int64 deviceIDs */ 6:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.deviceIDs.push(reader.int64().toBigInt());
          else message.deviceIDs.push(reader.int64().toBigInt());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* NotificationCenter.Notification notification = 1; */
    if (message.type.oneofKind === "notification")
      Notification.internalBinaryWrite(
        message.type.notification,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* NotificationCenter.NotificationReadStatus readStatus = 2; */
    if (message.type.oneofKind === "readStatus")
      writer.tag(2, WireType.Varint).int32(message.type.readStatus);
    /* NotificationCenter.NotificationApprovalStatus approvalStatus = 3; */
    if (message.type.oneofKind === "approvalStatus")
      writer.tag(3, WireType.Varint).int32(message.type.approvalStatus);
    /* bool trimmingPoint = 4; */
    if (message.type.oneofKind === "trimmingPoint")
      writer.tag(4, WireType.Varint).bool(message.type.trimmingPoint);
    /* repeated int32 clientTypeIDs = 5; */
    if (message.clientTypeIDs.length) {
      writer.tag(5, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.clientTypeIDs.length; i++) writer.int32(message.clientTypeIDs[i]);
      writer.join();
    }
    /* repeated int64 deviceIDs = 6; */
    if (message.deviceIDs.length) {
      writer.tag(6, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.deviceIDs.length; i++) writer.int64(message.deviceIDs[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationContent
 */
export const NotificationContent = new NotificationContent$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationWrapper$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationWrapper", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "content", kind: "message", T: () => NotificationContent },
      {
        no: 3,
        name: "timestamp",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.timestamp = 0n;
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
        case /* NotificationCenter.NotificationContent content */ 2:
          message.content = NotificationContent.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.content,
          );
          break;
        case /* int64 timestamp */ 3:
          message.timestamp = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* NotificationCenter.NotificationContent content = 2; */
    if (message.content)
      NotificationContent.internalBinaryWrite(
        message.content,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 timestamp = 3; */
    if (message.timestamp !== 0n) writer.tag(3, WireType.Varint).int64(message.timestamp);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationWrapper
 */
export const NotificationWrapper = new NotificationWrapper$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationSync$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationSync", [
      {
        no: 1,
        name: "data",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => NotificationWrapper,
      },
      {
        no: 2,
        name: "syncPoint",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "hasMore", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.data = [];
    message.syncPoint = 0n;
    message.hasMore = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated NotificationCenter.NotificationWrapper data */ 1:
          message.data.push(
            NotificationWrapper.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* int64 syncPoint */ 2:
          message.syncPoint = reader.int64().toBigInt();
          break;
        case /* bool hasMore */ 3:
          message.hasMore = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated NotificationCenter.NotificationWrapper data = 1; */
    for (let i = 0; i < message.data.length; i++)
      NotificationWrapper.internalBinaryWrite(
        message.data[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 syncPoint = 2; */
    if (message.syncPoint !== 0n) writer.tag(2, WireType.Varint).int64(message.syncPoint);
    /* bool hasMore = 3; */
    if (message.hasMore !== false) writer.tag(3, WireType.Varint).bool(message.hasMore);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationSync
 */
export const NotificationSync = new NotificationSync$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReadStatusUpdate$Type extends MessageType {
  constructor() {
    super("NotificationCenter.ReadStatusUpdate", [
      { no: 1, name: "notificationUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["NotificationCenter.NotificationReadStatus", NotificationReadStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.notificationUid = new Uint8Array(0);
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
        case /* bytes notificationUid */ 1:
          message.notificationUid = reader.bytes();
          break;
        case /* NotificationCenter.NotificationReadStatus status */ 2:
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
    /* bytes notificationUid = 1; */
    if (message.notificationUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.notificationUid);
    /* NotificationCenter.NotificationReadStatus status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.ReadStatusUpdate
 */
export const ReadStatusUpdate = new ReadStatusUpdate$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ApprovalStatusUpdate$Type extends MessageType {
  constructor() {
    super("NotificationCenter.ApprovalStatusUpdate", [
      { no: 1, name: "notificationUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "status",
        kind: "enum",
        T: () => ["NotificationCenter.NotificationApprovalStatus", NotificationApprovalStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.notificationUid = new Uint8Array(0);
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
        case /* bytes notificationUid */ 1:
          message.notificationUid = reader.bytes();
          break;
        case /* NotificationCenter.NotificationApprovalStatus status */ 2:
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
    /* bytes notificationUid = 1; */
    if (message.notificationUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.notificationUid);
    /* NotificationCenter.NotificationApprovalStatus status = 2; */
    if (message.status !== 0) writer.tag(2, WireType.Varint).int32(message.status);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.ApprovalStatusUpdate
 */
export const ApprovalStatusUpdate = new ApprovalStatusUpdate$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ProcessMarkReadEventsRequest$Type extends MessageType {
  constructor() {
    super("NotificationCenter.ProcessMarkReadEventsRequest", [
      {
        no: 1,
        name: "readStatusUpdate",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ReadStatusUpdate,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.readStatusUpdate = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated NotificationCenter.ReadStatusUpdate readStatusUpdate */ 1:
          message.readStatusUpdate.push(
            ReadStatusUpdate.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated NotificationCenter.ReadStatusUpdate readStatusUpdate = 1; */
    for (let i = 0; i < message.readStatusUpdate.length; i++)
      ReadStatusUpdate.internalBinaryWrite(
        message.readStatusUpdate[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.ProcessMarkReadEventsRequest
 */
export const ProcessMarkReadEventsRequest = new ProcessMarkReadEventsRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationSendRequest$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationSendRequest", [
      {
        no: 1,
        name: "recipients",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncRef,
      },
      { no: 2, name: "notification", kind: "message", T: () => Notification },
      {
        no: 3,
        name: "clientTypeIDs",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 5 /*ScalarType.INT32*/,
      },
      {
        no: 4,
        name: "deviceIDs",
        kind: "scalar",
        repeat: 1 /*RepeatType.PACKED*/,
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recipients = [];
    message.clientTypeIDs = [];
    message.deviceIDs = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated GraphSync.GraphSyncRef recipients */ 1:
          message.recipients.push(
            GraphSyncRef.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* NotificationCenter.Notification notification */ 2:
          message.notification = Notification.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.notification,
          );
          break;
        case /* repeated int32 clientTypeIDs */ 3:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.clientTypeIDs.push(reader.int32());
          else message.clientTypeIDs.push(reader.int32());
          break;
        case /* repeated int64 deviceIDs */ 4:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.deviceIDs.push(reader.int64().toBigInt());
          else message.deviceIDs.push(reader.int64().toBigInt());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated GraphSync.GraphSyncRef recipients = 1; */
    for (let i = 0; i < message.recipients.length; i++)
      GraphSyncRef.internalBinaryWrite(
        message.recipients[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* NotificationCenter.Notification notification = 2; */
    if (message.notification)
      Notification.internalBinaryWrite(
        message.notification,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated int32 clientTypeIDs = 3; */
    if (message.clientTypeIDs.length) {
      writer.tag(3, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.clientTypeIDs.length; i++) writer.int32(message.clientTypeIDs[i]);
      writer.join();
    }
    /* repeated int64 deviceIDs = 4; */
    if (message.deviceIDs.length) {
      writer.tag(4, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.deviceIDs.length; i++) writer.int64(message.deviceIDs[i]);
      writer.join();
    }
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationSendRequest
 */
export const NotificationSendRequest = new NotificationSendRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationsSendRequest$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationsSendRequest", [
      {
        no: 1,
        name: "notifications",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => NotificationSendRequest,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.notifications = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated NotificationCenter.NotificationSendRequest notifications */ 1:
          message.notifications.push(
            NotificationSendRequest.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated NotificationCenter.NotificationSendRequest notifications = 1; */
    for (let i = 0; i < message.notifications.length; i++)
      NotificationSendRequest.internalBinaryWrite(
        message.notifications[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationsSendRequest
 */
export const NotificationsSendRequest = new NotificationsSendRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NotificationSyncRequest$Type extends MessageType {
  constructor() {
    super("NotificationCenter.NotificationSyncRequest", [
      {
        no: 1,
        name: "syncPoint",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.syncPoint = 0n;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int64 syncPoint */ 1:
          message.syncPoint = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int64 syncPoint = 1; */
    if (message.syncPoint !== 0n) writer.tag(1, WireType.Varint).int64(message.syncPoint);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message NotificationCenter.NotificationSyncRequest
 */
export const NotificationSyncRequest = new NotificationSyncRequest$Type();
