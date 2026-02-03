import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf enum GraphSync.RefType
 */
export var RefType;
(function (RefType) {
  /**
   * @generated from protobuf enum value: RFT_GENERAL = 0;
   */
  RefType[(RefType["RFT_GENERAL"] = 0)] = "RFT_GENERAL";
  /**
   * @generated from protobuf enum value: RFT_USER = 1;
   */
  RefType[(RefType["RFT_USER"] = 1)] = "RFT_USER";
  /**
   * @generated from protobuf enum value: RFT_DEVICE = 2;
   */
  RefType[(RefType["RFT_DEVICE"] = 2)] = "RFT_DEVICE";
  /**
   * @generated from protobuf enum value: RFT_REC = 3;
   */
  RefType[(RefType["RFT_REC"] = 3)] = "RFT_REC";
  /**
   * @generated from protobuf enum value: RFT_FOLDER = 4;
   */
  RefType[(RefType["RFT_FOLDER"] = 4)] = "RFT_FOLDER";
  /**
   * @generated from protobuf enum value: RFT_TEAM = 5;
   */
  RefType[(RefType["RFT_TEAM"] = 5)] = "RFT_TEAM";
  /**
   * @generated from protobuf enum value: RFT_ENTERPRISE = 6;
   */
  RefType[(RefType["RFT_ENTERPRISE"] = 6)] = "RFT_ENTERPRISE";
  /**
   * @generated from protobuf enum value: RFT_PAM_DIRECTORY = 7;
   */
  RefType[(RefType["RFT_PAM_DIRECTORY"] = 7)] = "RFT_PAM_DIRECTORY";
  /**
   * @generated from protobuf enum value: RFT_PAM_MACHINE = 8;
   */
  RefType[(RefType["RFT_PAM_MACHINE"] = 8)] = "RFT_PAM_MACHINE";
  /**
   * @generated from protobuf enum value: RFT_PAM_DATABASE = 9;
   */
  RefType[(RefType["RFT_PAM_DATABASE"] = 9)] = "RFT_PAM_DATABASE";
  /**
   * @generated from protobuf enum value: RFT_PAM_USER = 10;
   */
  RefType[(RefType["RFT_PAM_USER"] = 10)] = "RFT_PAM_USER";
  /**
   * @generated from protobuf enum value: RFT_PAM_NETWORK = 11;
   */
  RefType[(RefType["RFT_PAM_NETWORK"] = 11)] = "RFT_PAM_NETWORK";
  /**
   * @generated from protobuf enum value: RFT_PAM_BROWSER = 12;
   */
  RefType[(RefType["RFT_PAM_BROWSER"] = 12)] = "RFT_PAM_BROWSER";
  /**
   * @generated from protobuf enum value: RFT_CONNECTION = 13;
   */
  RefType[(RefType["RFT_CONNECTION"] = 13)] = "RFT_CONNECTION";
  /**
   * @generated from protobuf enum value: RFT_WORKFLOW = 14;
   */
  RefType[(RefType["RFT_WORKFLOW"] = 14)] = "RFT_WORKFLOW";
  /**
   * @generated from protobuf enum value: RFT_NOTIFICATION = 15;
   */
  RefType[(RefType["RFT_NOTIFICATION"] = 15)] = "RFT_NOTIFICATION";
  /**
   * @generated from protobuf enum value: RFT_USER_INFO = 16;
   */
  RefType[(RefType["RFT_USER_INFO"] = 16)] = "RFT_USER_INFO";
  /**
   * @generated from protobuf enum value: RFT_TEAM_INFO = 17;
   */
  RefType[(RefType["RFT_TEAM_INFO"] = 17)] = "RFT_TEAM_INFO";
  /**
   * @generated from protobuf enum value: RFT_ROLE = 18;
   */
  RefType[(RefType["RFT_ROLE"] = 18)] = "RFT_ROLE";
})(RefType || (RefType = {}));
/**
 * @generated from protobuf enum GraphSync.GraphSyncDataType
 */
export var GraphSyncDataType;
(function (GraphSyncDataType) {
  /**
   * @generated from protobuf enum value: GSE_DATA = 0;
   */
  GraphSyncDataType[(GraphSyncDataType["GSE_DATA"] = 0)] = "GSE_DATA";
  /**
   * @generated from protobuf enum value: GSE_KEY = 1;
   */
  GraphSyncDataType[(GraphSyncDataType["GSE_KEY"] = 1)] = "GSE_KEY";
  /**
   * @generated from protobuf enum value: GSE_LINK = 2;
   */
  GraphSyncDataType[(GraphSyncDataType["GSE_LINK"] = 2)] = "GSE_LINK";
  /**
   * @generated from protobuf enum value: GSE_ACL = 3;
   */
  GraphSyncDataType[(GraphSyncDataType["GSE_ACL"] = 3)] = "GSE_ACL";
  /**
   * @generated from protobuf enum value: GSE_DELETION = 4;
   */
  GraphSyncDataType[(GraphSyncDataType["GSE_DELETION"] = 4)] = "GSE_DELETION";
})(GraphSyncDataType || (GraphSyncDataType = {}));
/**
 * @generated from protobuf enum GraphSync.GraphSyncActorType
 */
export var GraphSyncActorType;
(function (GraphSyncActorType) {
  /**
   * @generated from protobuf enum value: GSA_USER = 0;
   */
  GraphSyncActorType[(GraphSyncActorType["GSA_USER"] = 0)] = "GSA_USER";
  /**
   * @generated from protobuf enum value: GSA_SERVICE = 1;
   */
  GraphSyncActorType[(GraphSyncActorType["GSA_SERVICE"] = 1)] = "GSA_SERVICE";
  /**
   * @generated from protobuf enum value: GSA_PAM_GATEWAY = 2;
   */
  GraphSyncActorType[(GraphSyncActorType["GSA_PAM_GATEWAY"] = 2)] = "GSA_PAM_GATEWAY";
})(GraphSyncActorType || (GraphSyncActorType = {}));
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncRef$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncRef", [
      { no: 1, name: "type", kind: "enum", T: () => ["GraphSync.RefType", RefType] },
      { no: 2, name: "value", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    message.value = new Uint8Array(0);
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
        case /* GraphSync.RefType type */ 1:
          message.type = reader.int32();
          break;
        case /* bytes value */ 2:
          message.value = reader.bytes();
          break;
        case /* string name */ 3:
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
    /* GraphSync.RefType type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    /* bytes value = 2; */
    if (message.value.length) writer.tag(2, WireType.LengthDelimited).bytes(message.value);
    /* string name = 3; */
    if (message.name !== "") writer.tag(3, WireType.LengthDelimited).string(message.name);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncRef
 */
export const GraphSyncRef = new GraphSyncRef$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncActor$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncActor", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        T: () => ["GraphSync.GraphSyncActorType", GraphSyncActorType],
      },
      { no: 2, name: "id", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "effectiveUserId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    message.id = new Uint8Array(0);
    message.name = "";
    message.effectiveUserId = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* GraphSync.GraphSyncActorType type */ 1:
          message.type = reader.int32();
          break;
        case /* bytes id */ 2:
          message.id = reader.bytes();
          break;
        case /* string name */ 3:
          message.name = reader.string();
          break;
        case /* bytes effectiveUserId */ 4:
          message.effectiveUserId = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* GraphSync.GraphSyncActorType type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    /* bytes id = 2; */
    if (message.id.length) writer.tag(2, WireType.LengthDelimited).bytes(message.id);
    /* string name = 3; */
    if (message.name !== "") writer.tag(3, WireType.LengthDelimited).string(message.name);
    /* bytes effectiveUserId = 4; */
    if (message.effectiveUserId.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.effectiveUserId);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncActor
 */
export const GraphSyncActor = new GraphSyncActor$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncData$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncData", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        T: () => ["GraphSync.GraphSyncDataType", GraphSyncDataType],
      },
      { no: 2, name: "ref", kind: "message", T: () => GraphSyncRef },
      { no: 3, name: "parentRef", kind: "message", T: () => GraphSyncRef },
      { no: 4, name: "content", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "path", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.type = 0;
    message.content = new Uint8Array(0);
    message.path = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* GraphSync.GraphSyncDataType type */ 1:
          message.type = reader.int32();
          break;
        case /* GraphSync.GraphSyncRef ref */ 2:
          message.ref = GraphSyncRef.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.ref,
          );
          break;
        case /* GraphSync.GraphSyncRef parentRef */ 3:
          message.parentRef = GraphSyncRef.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.parentRef,
          );
          break;
        case /* bytes content */ 4:
          message.content = reader.bytes();
          break;
        case /* string path */ 5:
          message.path = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* GraphSync.GraphSyncDataType type = 1; */
    if (message.type !== 0) writer.tag(1, WireType.Varint).int32(message.type);
    /* GraphSync.GraphSyncRef ref = 2; */
    if (message.ref)
      GraphSyncRef.internalBinaryWrite(
        message.ref,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* GraphSync.GraphSyncRef parentRef = 3; */
    if (message.parentRef)
      GraphSyncRef.internalBinaryWrite(
        message.parentRef,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes content = 4; */
    if (message.content.length) writer.tag(4, WireType.LengthDelimited).bytes(message.content);
    /* string path = 5; */
    if (message.path !== "") writer.tag(5, WireType.LengthDelimited).string(message.path);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncData
 */
export const GraphSyncData = new GraphSyncData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncDataPlus$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncDataPlus", [
      { no: 1, name: "data", kind: "message", T: () => GraphSyncData },
      {
        no: 2,
        name: "timestamp",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "actor", kind: "message", T: () => GraphSyncActor },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* GraphSync.GraphSyncData data */ 1:
          message.data = GraphSyncData.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.data,
          );
          break;
        case /* int64 timestamp */ 2:
          message.timestamp = reader.int64().toBigInt();
          break;
        case /* GraphSync.GraphSyncActor actor */ 3:
          message.actor = GraphSyncActor.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.actor,
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
    /* GraphSync.GraphSyncData data = 1; */
    if (message.data)
      GraphSyncData.internalBinaryWrite(
        message.data,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 timestamp = 2; */
    if (message.timestamp !== 0n) writer.tag(2, WireType.Varint).int64(message.timestamp);
    /* GraphSync.GraphSyncActor actor = 3; */
    if (message.actor)
      GraphSyncActor.internalBinaryWrite(
        message.actor,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncDataPlus
 */
export const GraphSyncDataPlus = new GraphSyncDataPlus$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncQuery$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncQuery", [
      { no: 1, name: "streamId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "origin", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "syncPoint",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "maxCount", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.streamId = new Uint8Array(0);
    message.origin = new Uint8Array(0);
    message.syncPoint = 0n;
    message.maxCount = 0;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes streamId */ 1:
          message.streamId = reader.bytes();
          break;
        case /* bytes origin */ 2:
          message.origin = reader.bytes();
          break;
        case /* int64 syncPoint */ 3:
          message.syncPoint = reader.int64().toBigInt();
          break;
        case /* int32 maxCount */ 4:
          message.maxCount = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes streamId = 1; */
    if (message.streamId.length) writer.tag(1, WireType.LengthDelimited).bytes(message.streamId);
    /* bytes origin = 2; */
    if (message.origin.length) writer.tag(2, WireType.LengthDelimited).bytes(message.origin);
    /* int64 syncPoint = 3; */
    if (message.syncPoint !== 0n) writer.tag(3, WireType.Varint).int64(message.syncPoint);
    /* int32 maxCount = 4; */
    if (message.maxCount !== 0) writer.tag(4, WireType.Varint).int32(message.maxCount);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncQuery
 */
export const GraphSyncQuery = new GraphSyncQuery$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncResult$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncResult", [
      { no: 2, name: "streamId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "syncPoint",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "data",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncDataPlus,
      },
      { no: 5, name: "hasMore", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.streamId = new Uint8Array(0);
    message.syncPoint = 0n;
    message.data = [];
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
        case /* bytes streamId */ 2:
          message.streamId = reader.bytes();
          break;
        case /* int64 syncPoint */ 3:
          message.syncPoint = reader.int64().toBigInt();
          break;
        case /* repeated GraphSync.GraphSyncDataPlus data */ 4:
          message.data.push(GraphSyncDataPlus.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bool hasMore */ 5:
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
    /* bytes streamId = 2; */
    if (message.streamId.length) writer.tag(2, WireType.LengthDelimited).bytes(message.streamId);
    /* int64 syncPoint = 3; */
    if (message.syncPoint !== 0n) writer.tag(3, WireType.Varint).int64(message.syncPoint);
    /* repeated GraphSync.GraphSyncDataPlus data = 4; */
    for (let i = 0; i < message.data.length; i++)
      GraphSyncDataPlus.internalBinaryWrite(
        message.data[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool hasMore = 5; */
    if (message.hasMore !== false) writer.tag(5, WireType.Varint).bool(message.hasMore);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncResult
 */
export const GraphSyncResult = new GraphSyncResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncMultiQuery$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncMultiQuery", [
      {
        no: 1,
        name: "queries",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncQuery,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.queries = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated GraphSync.GraphSyncQuery queries */ 1:
          message.queries.push(GraphSyncQuery.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated GraphSync.GraphSyncQuery queries = 1; */
    for (let i = 0; i < message.queries.length; i++)
      GraphSyncQuery.internalBinaryWrite(
        message.queries[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncMultiQuery
 */
export const GraphSyncMultiQuery = new GraphSyncMultiQuery$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncMultiResult$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncMultiResult", [
      {
        no: 1,
        name: "results",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncResult,
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
        case /* repeated GraphSync.GraphSyncResult results */ 1:
          message.results.push(
            GraphSyncResult.internalBinaryRead(reader, reader.uint32(), options),
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
    /* repeated GraphSync.GraphSyncResult results = 1; */
    for (let i = 0; i < message.results.length; i++)
      GraphSyncResult.internalBinaryWrite(
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
 * @generated MessageType for protobuf message GraphSync.GraphSyncMultiResult
 */
export const GraphSyncMultiResult = new GraphSyncMultiResult$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncAddDataRequest$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncAddDataRequest", [
      { no: 1, name: "origin", kind: "message", T: () => GraphSyncRef },
      {
        no: 2,
        name: "data",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncData,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* GraphSync.GraphSyncRef origin */ 1:
          message.origin = GraphSyncRef.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.origin,
          );
          break;
        case /* repeated GraphSync.GraphSyncData data */ 2:
          message.data.push(GraphSyncData.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* GraphSync.GraphSyncRef origin = 1; */
    if (message.origin)
      GraphSyncRef.internalBinaryWrite(
        message.origin,
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated GraphSync.GraphSyncData data = 2; */
    for (let i = 0; i < message.data.length; i++)
      GraphSyncData.internalBinaryWrite(
        message.data[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncAddDataRequest
 */
export const GraphSyncAddDataRequest = new GraphSyncAddDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncLeafsQuery$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncLeafsQuery", [
      {
        no: 2,
        name: "vertices",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.vertices = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated bytes vertices */ 2:
          message.vertices.push(reader.bytes());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated bytes vertices = 2; */
    for (let i = 0; i < message.vertices.length; i++)
      writer.tag(2, WireType.LengthDelimited).bytes(message.vertices[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncLeafsQuery
 */
export const GraphSyncLeafsQuery = new GraphSyncLeafsQuery$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GraphSyncRefsResult$Type extends MessageType {
  constructor() {
    super("GraphSync.GraphSyncRefsResult", [
      {
        no: 1,
        name: "refs",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => GraphSyncRef,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.refs = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated GraphSync.GraphSyncRef refs */ 1:
          message.refs.push(GraphSyncRef.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated GraphSync.GraphSyncRef refs = 1; */
    for (let i = 0; i < message.refs.length; i++)
      GraphSyncRef.internalBinaryWrite(
        message.refs[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message GraphSync.GraphSyncRefsResult
 */
export const GraphSyncRefsResult = new GraphSyncRefsResult$Type();
