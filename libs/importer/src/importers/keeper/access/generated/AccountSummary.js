import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
import { TwoFactorChannelType } from "./APIRequest";
import { ClientFormFactor } from "./APIRequest";
import { DeviceStatus } from "./APIRequest";
// @generated message type with reflection information, may provide speed optimized methods
class AccountSummaryRequest$Type extends MessageType {
  constructor() {
    super("AccountSummary.AccountSummaryRequest", [
      { no: 1, name: "summaryVersion", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "includeRecentActivity", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.summaryVersion = 0;
    message.includeRecentActivity = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 summaryVersion */ 1:
          message.summaryVersion = reader.int32();
          break;
        case /* bool includeRecentActivity */ 2:
          message.includeRecentActivity = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 summaryVersion = 1; */
    if (message.summaryVersion !== 0) writer.tag(1, WireType.Varint).int32(message.summaryVersion);
    /* bool includeRecentActivity = 2; */
    if (message.includeRecentActivity !== false)
      writer.tag(2, WireType.Varint).bool(message.includeRecentActivity);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.AccountSummaryRequest
 */
export const AccountSummaryRequest = new AccountSummaryRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AccountSummaryElements$Type extends MessageType {
  constructor() {
    super("AccountSummary.AccountSummaryElements", [
      { no: 1, name: "clientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "settings", kind: "message", T: () => Settings },
      { no: 3, name: "keysInfo", kind: "message", T: () => KeysInfo },
      {
        no: 4,
        name: "syncLogs",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SyncLog,
      },
      { no: 5, name: "isEnterpriseAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "license", kind: "message", T: () => License },
      { no: 7, name: "group", kind: "message", T: () => Group },
      {
        no: 8,
        name: "Enforcements",
        kind: "message",
        jsonName: "Enforcements",
        T: () => Enforcements,
      },
      {
        no: 9,
        name: "Images",
        kind: "message",
        jsonName: "Images",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValue,
      },
      { no: 10, name: "personalLicense", kind: "message", T: () => License },
      { no: 11, name: "fixSharedFolderRecords", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 12,
        name: "usernames",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
      {
        no: 13,
        name: "devices",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => DeviceInfo,
      },
      { no: 14, name: "isShareAdmin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 15, name: "accountRecovery", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 16, name: "accountRecoveryPrompt", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 17,
        name: "minMasterPasswordLengthNoPrompt",
        kind: "scalar",
        T: 5 /*ScalarType.INT32*/,
      },
      { no: 18, name: "forbidKeyType2", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.clientKey = new Uint8Array(0);
    message.syncLogs = [];
    message.isEnterpriseAdmin = false;
    message.images = [];
    message.fixSharedFolderRecords = false;
    message.usernames = [];
    message.devices = [];
    message.isShareAdmin = false;
    message.accountRecovery = false;
    message.accountRecoveryPrompt = false;
    message.minMasterPasswordLengthNoPrompt = 0;
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
        case /* bytes clientKey */ 1:
          message.clientKey = reader.bytes();
          break;
        case /* AccountSummary.Settings settings */ 2:
          message.settings = Settings.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.settings,
          );
          break;
        case /* AccountSummary.KeysInfo keysInfo */ 3:
          message.keysInfo = KeysInfo.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.keysInfo,
          );
          break;
        case /* repeated AccountSummary.SyncLog syncLogs */ 4:
          message.syncLogs.push(SyncLog.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bool isEnterpriseAdmin */ 5:
          message.isEnterpriseAdmin = reader.bool();
          break;
        case /* AccountSummary.License license */ 6:
          message.license = License.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.license,
          );
          break;
        case /* AccountSummary.Group group */ 7:
          message.group = Group.internalBinaryRead(reader, reader.uint32(), options, message.group);
          break;
        case /* AccountSummary.Enforcements Enforcements */ 8:
          message.enforcements = Enforcements.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.enforcements,
          );
          break;
        case /* repeated AccountSummary.KeyValue Images */ 9:
          message.images.push(KeyValue.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* AccountSummary.License personalLicense */ 10:
          message.personalLicense = License.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.personalLicense,
          );
          break;
        case /* bool fixSharedFolderRecords */ 11:
          message.fixSharedFolderRecords = reader.bool();
          break;
        case /* repeated string usernames */ 12:
          message.usernames.push(reader.string());
          break;
        case /* repeated AccountSummary.DeviceInfo devices */ 13:
          message.devices.push(DeviceInfo.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bool isShareAdmin */ 14:
          message.isShareAdmin = reader.bool();
          break;
        case /* bool accountRecovery */ 15:
          message.accountRecovery = reader.bool();
          break;
        case /* bool accountRecoveryPrompt */ 16:
          message.accountRecoveryPrompt = reader.bool();
          break;
        case /* int32 minMasterPasswordLengthNoPrompt */ 17:
          message.minMasterPasswordLengthNoPrompt = reader.int32();
          break;
        case /* bool forbidKeyType2 */ 18:
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
    /* bytes clientKey = 1; */
    if (message.clientKey.length) writer.tag(1, WireType.LengthDelimited).bytes(message.clientKey);
    /* AccountSummary.Settings settings = 2; */
    if (message.settings)
      Settings.internalBinaryWrite(
        message.settings,
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* AccountSummary.KeysInfo keysInfo = 3; */
    if (message.keysInfo)
      KeysInfo.internalBinaryWrite(
        message.keysInfo,
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.SyncLog syncLogs = 4; */
    for (let i = 0; i < message.syncLogs.length; i++)
      SyncLog.internalBinaryWrite(
        message.syncLogs[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool isEnterpriseAdmin = 5; */
    if (message.isEnterpriseAdmin !== false)
      writer.tag(5, WireType.Varint).bool(message.isEnterpriseAdmin);
    /* AccountSummary.License license = 6; */
    if (message.license)
      License.internalBinaryWrite(
        message.license,
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* AccountSummary.Group group = 7; */
    if (message.group)
      Group.internalBinaryWrite(
        message.group,
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* AccountSummary.Enforcements Enforcements = 8; */
    if (message.enforcements)
      Enforcements.internalBinaryWrite(
        message.enforcements,
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.KeyValue Images = 9; */
    for (let i = 0; i < message.images.length; i++)
      KeyValue.internalBinaryWrite(
        message.images[i],
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* AccountSummary.License personalLicense = 10; */
    if (message.personalLicense)
      License.internalBinaryWrite(
        message.personalLicense,
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool fixSharedFolderRecords = 11; */
    if (message.fixSharedFolderRecords !== false)
      writer.tag(11, WireType.Varint).bool(message.fixSharedFolderRecords);
    /* repeated string usernames = 12; */
    for (let i = 0; i < message.usernames.length; i++)
      writer.tag(12, WireType.LengthDelimited).string(message.usernames[i]);
    /* repeated AccountSummary.DeviceInfo devices = 13; */
    for (let i = 0; i < message.devices.length; i++)
      DeviceInfo.internalBinaryWrite(
        message.devices[i],
        writer.tag(13, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool isShareAdmin = 14; */
    if (message.isShareAdmin !== false) writer.tag(14, WireType.Varint).bool(message.isShareAdmin);
    /* bool accountRecovery = 15; */
    if (message.accountRecovery !== false)
      writer.tag(15, WireType.Varint).bool(message.accountRecovery);
    /* bool accountRecoveryPrompt = 16; */
    if (message.accountRecoveryPrompt !== false)
      writer.tag(16, WireType.Varint).bool(message.accountRecoveryPrompt);
    /* int32 minMasterPasswordLengthNoPrompt = 17; */
    if (message.minMasterPasswordLengthNoPrompt !== 0)
      writer.tag(17, WireType.Varint).int32(message.minMasterPasswordLengthNoPrompt);
    /* bool forbidKeyType2 = 18; */
    if (message.forbidKeyType2 !== false)
      writer.tag(18, WireType.Varint).bool(message.forbidKeyType2);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.AccountSummaryElements
 */
export const AccountSummaryElements = new AccountSummaryElements$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceInfo$Type extends MessageType {
  constructor() {
    super("AccountSummary.DeviceInfo", [
      { no: 1, name: "encryptedDeviceToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "deviceStatus",
        kind: "enum",
        T: () => ["Authentication.DeviceStatus", DeviceStatus],
      },
      { no: 4, name: "devicePublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptedDataKeyDoNotUse", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "clientVersion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 7, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "ipAddress", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 9,
        name: "approveRequestTime",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 10, name: "encryptedDataKeyPresent", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 11,
        name: "groupId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 12, name: "devicePlatform", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 13,
        name: "clientFormFactor",
        kind: "enum",
        T: () => ["Authentication.ClientFormFactor", ClientFormFactor],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptedDeviceToken = new Uint8Array(0);
    message.deviceName = "";
    message.deviceStatus = 0;
    message.devicePublicKey = new Uint8Array(0);
    message.encryptedDataKeyDoNotUse = new Uint8Array(0);
    message.clientVersion = "";
    message.username = "";
    message.ipAddress = "";
    message.approveRequestTime = 0n;
    message.encryptedDataKeyPresent = false;
    message.groupId = 0n;
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
        case /* string deviceName */ 2:
          message.deviceName = reader.string();
          break;
        case /* Authentication.DeviceStatus deviceStatus */ 3:
          message.deviceStatus = reader.int32();
          break;
        case /* bytes devicePublicKey */ 4:
          message.devicePublicKey = reader.bytes();
          break;
        case /* bytes encryptedDataKeyDoNotUse */ 5:
          message.encryptedDataKeyDoNotUse = reader.bytes();
          break;
        case /* string clientVersion */ 6:
          message.clientVersion = reader.string();
          break;
        case /* string username */ 7:
          message.username = reader.string();
          break;
        case /* string ipAddress */ 8:
          message.ipAddress = reader.string();
          break;
        case /* int64 approveRequestTime */ 9:
          message.approveRequestTime = reader.int64().toBigInt();
          break;
        case /* bool encryptedDataKeyPresent */ 10:
          message.encryptedDataKeyPresent = reader.bool();
          break;
        case /* int64 groupId */ 11:
          message.groupId = reader.int64().toBigInt();
          break;
        case /* string devicePlatform */ 12:
          message.devicePlatform = reader.string();
          break;
        case /* Authentication.ClientFormFactor clientFormFactor */ 13:
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
    /* string deviceName = 2; */
    if (message.deviceName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.deviceName);
    /* Authentication.DeviceStatus deviceStatus = 3; */
    if (message.deviceStatus !== 0) writer.tag(3, WireType.Varint).int32(message.deviceStatus);
    /* bytes devicePublicKey = 4; */
    if (message.devicePublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.devicePublicKey);
    /* bytes encryptedDataKeyDoNotUse = 5; */
    if (message.encryptedDataKeyDoNotUse.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedDataKeyDoNotUse);
    /* string clientVersion = 6; */
    if (message.clientVersion !== "")
      writer.tag(6, WireType.LengthDelimited).string(message.clientVersion);
    /* string username = 7; */
    if (message.username !== "") writer.tag(7, WireType.LengthDelimited).string(message.username);
    /* string ipAddress = 8; */
    if (message.ipAddress !== "") writer.tag(8, WireType.LengthDelimited).string(message.ipAddress);
    /* int64 approveRequestTime = 9; */
    if (message.approveRequestTime !== 0n)
      writer.tag(9, WireType.Varint).int64(message.approveRequestTime);
    /* bool encryptedDataKeyPresent = 10; */
    if (message.encryptedDataKeyPresent !== false)
      writer.tag(10, WireType.Varint).bool(message.encryptedDataKeyPresent);
    /* int64 groupId = 11; */
    if (message.groupId !== 0n) writer.tag(11, WireType.Varint).int64(message.groupId);
    /* string devicePlatform = 12; */
    if (message.devicePlatform !== "")
      writer.tag(12, WireType.LengthDelimited).string(message.devicePlatform);
    /* Authentication.ClientFormFactor clientFormFactor = 13; */
    if (message.clientFormFactor !== 0)
      writer.tag(13, WireType.Varint).int32(message.clientFormFactor);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.DeviceInfo
 */
export const DeviceInfo = new DeviceInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KeysInfo$Type extends MessageType {
  constructor() {
    super("AccountSummary.KeysInfo", [
      { no: 1, name: "encryptionParams", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "encryptedDataKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "dataKeyBackupDate", kind: "scalar", T: 1 /*ScalarType.DOUBLE*/ },
      { no: 4, name: "userAuthUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "encryptedPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "encryptedEccPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "eccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.encryptionParams = new Uint8Array(0);
    message.encryptedDataKey = new Uint8Array(0);
    message.dataKeyBackupDate = 0;
    message.userAuthUid = new Uint8Array(0);
    message.encryptedPrivateKey = new Uint8Array(0);
    message.encryptedEccPrivateKey = new Uint8Array(0);
    message.eccPublicKey = new Uint8Array(0);
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bytes encryptionParams */ 1:
          message.encryptionParams = reader.bytes();
          break;
        case /* bytes encryptedDataKey */ 2:
          message.encryptedDataKey = reader.bytes();
          break;
        case /* double dataKeyBackupDate */ 3:
          message.dataKeyBackupDate = reader.double();
          break;
        case /* bytes userAuthUid */ 4:
          message.userAuthUid = reader.bytes();
          break;
        case /* bytes encryptedPrivateKey */ 5:
          message.encryptedPrivateKey = reader.bytes();
          break;
        case /* bytes encryptedEccPrivateKey */ 6:
          message.encryptedEccPrivateKey = reader.bytes();
          break;
        case /* bytes eccPublicKey */ 7:
          message.eccPublicKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bytes encryptionParams = 1; */
    if (message.encryptionParams.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.encryptionParams);
    /* bytes encryptedDataKey = 2; */
    if (message.encryptedDataKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.encryptedDataKey);
    /* double dataKeyBackupDate = 3; */
    if (message.dataKeyBackupDate !== 0)
      writer.tag(3, WireType.Bit64).double(message.dataKeyBackupDate);
    /* bytes userAuthUid = 4; */
    if (message.userAuthUid.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.userAuthUid);
    /* bytes encryptedPrivateKey = 5; */
    if (message.encryptedPrivateKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.encryptedPrivateKey);
    /* bytes encryptedEccPrivateKey = 6; */
    if (message.encryptedEccPrivateKey.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.encryptedEccPrivateKey);
    /* bytes eccPublicKey = 7; */
    if (message.eccPublicKey.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.eccPublicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.KeysInfo
 */
export const KeysInfo = new KeysInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SyncLog$Type extends MessageType {
  constructor() {
    super("AccountSummary.SyncLog", [
      { no: 1, name: "countryName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 2,
        name: "secondsAgo",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "countryCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "deviceUID", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "ipAddress", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.countryName = "";
    message.secondsAgo = 0n;
    message.deviceName = "";
    message.countryCode = "";
    message.deviceUID = new Uint8Array(0);
    message.ipAddress = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string countryName */ 1:
          message.countryName = reader.string();
          break;
        case /* int64 secondsAgo */ 2:
          message.secondsAgo = reader.int64().toBigInt();
          break;
        case /* string deviceName */ 3:
          message.deviceName = reader.string();
          break;
        case /* string countryCode */ 4:
          message.countryCode = reader.string();
          break;
        case /* bytes deviceUID */ 5:
          message.deviceUID = reader.bytes();
          break;
        case /* string ipAddress */ 6:
          message.ipAddress = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string countryName = 1; */
    if (message.countryName !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.countryName);
    /* int64 secondsAgo = 2; */
    if (message.secondsAgo !== 0n) writer.tag(2, WireType.Varint).int64(message.secondsAgo);
    /* string deviceName = 3; */
    if (message.deviceName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.deviceName);
    /* string countryCode = 4; */
    if (message.countryCode !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.countryCode);
    /* bytes deviceUID = 5; */
    if (message.deviceUID.length) writer.tag(5, WireType.LengthDelimited).bytes(message.deviceUID);
    /* string ipAddress = 6; */
    if (message.ipAddress !== "") writer.tag(6, WireType.LengthDelimited).string(message.ipAddress);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.SyncLog
 */
export const SyncLog = new SyncLog$Type();
// @generated message type with reflection information, may provide speed optimized methods
class License$Type extends MessageType {
  constructor() {
    super("AccountSummary.License", [
      { no: 1, name: "subscriptionCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "productTypeId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 3, name: "productTypeName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "expirationDate", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "secondsUntilExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "maxDevices", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 7, name: "filePlanType", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 8,
        name: "bytesUsed",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 9,
        name: "bytesTotal",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 10,
        name: "secondsUntilStorageExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 11, name: "storageExpirationDate", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 12,
        name: "hasAutoRenewableAppstoreSubscription",
        kind: "scalar",
        T: 8 /*ScalarType.BOOL*/,
      },
      { no: 13, name: "accountType", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 14, name: "uploadsRemaining", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 15, name: "enterpriseId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 16, name: "chatEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 17, name: "auditAndReportingEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 18, name: "breachWatchFeatureDisable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 19, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 20, name: "allowPersonalLicense", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 21, name: "licensedBy", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 22, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 23, name: "breachWatchEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 24, name: "breachWatchScanned", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 25,
        name: "breachWatchExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 26,
        name: "breachWatchDateCreated",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 27, name: "error", kind: "message", T: () => Result },
      {
        no: 29,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 30,
        name: "storageExpiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 31, name: "uploadsCount", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 32, name: "units", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 33, name: "pendingEnterprise", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 34, name: "isPamEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 35, name: "isKsmEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.subscriptionCode = "";
    message.productTypeId = 0;
    message.productTypeName = "";
    message.expirationDate = "";
    message.secondsUntilExpiration = 0n;
    message.maxDevices = 0;
    message.filePlanType = 0;
    message.bytesUsed = 0n;
    message.bytesTotal = 0n;
    message.secondsUntilStorageExpiration = 0n;
    message.storageExpirationDate = "";
    message.hasAutoRenewableAppstoreSubscription = false;
    message.accountType = 0;
    message.uploadsRemaining = 0;
    message.enterpriseId = 0;
    message.chatEnabled = false;
    message.auditAndReportingEnabled = false;
    message.breachWatchFeatureDisable = false;
    message.accountUid = new Uint8Array(0);
    message.allowPersonalLicense = false;
    message.licensedBy = "";
    message.email = "";
    message.breachWatchEnabled = false;
    message.breachWatchScanned = false;
    message.breachWatchExpiration = 0n;
    message.breachWatchDateCreated = 0n;
    message.expiration = 0n;
    message.storageExpiration = 0n;
    message.uploadsCount = 0;
    message.units = 0;
    message.pendingEnterprise = false;
    message.isPamEnabled = false;
    message.isKsmEnabled = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string subscriptionCode */ 1:
          message.subscriptionCode = reader.string();
          break;
        case /* int32 productTypeId */ 2:
          message.productTypeId = reader.int32();
          break;
        case /* string productTypeName */ 3:
          message.productTypeName = reader.string();
          break;
        case /* string expirationDate */ 4:
          message.expirationDate = reader.string();
          break;
        case /* int64 secondsUntilExpiration */ 5:
          message.secondsUntilExpiration = reader.int64().toBigInt();
          break;
        case /* int32 maxDevices */ 6:
          message.maxDevices = reader.int32();
          break;
        case /* int32 filePlanType */ 7:
          message.filePlanType = reader.int32();
          break;
        case /* int64 bytesUsed */ 8:
          message.bytesUsed = reader.int64().toBigInt();
          break;
        case /* int64 bytesTotal */ 9:
          message.bytesTotal = reader.int64().toBigInt();
          break;
        case /* int64 secondsUntilStorageExpiration */ 10:
          message.secondsUntilStorageExpiration = reader.int64().toBigInt();
          break;
        case /* string storageExpirationDate */ 11:
          message.storageExpirationDate = reader.string();
          break;
        case /* bool hasAutoRenewableAppstoreSubscription */ 12:
          message.hasAutoRenewableAppstoreSubscription = reader.bool();
          break;
        case /* int32 accountType */ 13:
          message.accountType = reader.int32();
          break;
        case /* int32 uploadsRemaining */ 14:
          message.uploadsRemaining = reader.int32();
          break;
        case /* int32 enterpriseId */ 15:
          message.enterpriseId = reader.int32();
          break;
        case /* bool chatEnabled */ 16:
          message.chatEnabled = reader.bool();
          break;
        case /* bool auditAndReportingEnabled */ 17:
          message.auditAndReportingEnabled = reader.bool();
          break;
        case /* bool breachWatchFeatureDisable */ 18:
          message.breachWatchFeatureDisable = reader.bool();
          break;
        case /* bytes accountUid */ 19:
          message.accountUid = reader.bytes();
          break;
        case /* bool allowPersonalLicense */ 20:
          message.allowPersonalLicense = reader.bool();
          break;
        case /* string licensedBy */ 21:
          message.licensedBy = reader.string();
          break;
        case /* string email */ 22:
          message.email = reader.string();
          break;
        case /* bool breachWatchEnabled */ 23:
          message.breachWatchEnabled = reader.bool();
          break;
        case /* bool breachWatchScanned */ 24:
          message.breachWatchScanned = reader.bool();
          break;
        case /* int64 breachWatchExpiration */ 25:
          message.breachWatchExpiration = reader.int64().toBigInt();
          break;
        case /* int64 breachWatchDateCreated */ 26:
          message.breachWatchDateCreated = reader.int64().toBigInt();
          break;
        case /* AccountSummary.Result error */ 27:
          message.error = Result.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.error,
          );
          break;
        case /* int64 expiration */ 29:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* int64 storageExpiration */ 30:
          message.storageExpiration = reader.int64().toBigInt();
          break;
        case /* int32 uploadsCount */ 31:
          message.uploadsCount = reader.int32();
          break;
        case /* int32 units */ 32:
          message.units = reader.int32();
          break;
        case /* bool pendingEnterprise */ 33:
          message.pendingEnterprise = reader.bool();
          break;
        case /* bool isPamEnabled */ 34:
          message.isPamEnabled = reader.bool();
          break;
        case /* bool isKsmEnabled */ 35:
          message.isKsmEnabled = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string subscriptionCode = 1; */
    if (message.subscriptionCode !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.subscriptionCode);
    /* int32 productTypeId = 2; */
    if (message.productTypeId !== 0) writer.tag(2, WireType.Varint).int32(message.productTypeId);
    /* string productTypeName = 3; */
    if (message.productTypeName !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.productTypeName);
    /* string expirationDate = 4; */
    if (message.expirationDate !== "")
      writer.tag(4, WireType.LengthDelimited).string(message.expirationDate);
    /* int64 secondsUntilExpiration = 5; */
    if (message.secondsUntilExpiration !== 0n)
      writer.tag(5, WireType.Varint).int64(message.secondsUntilExpiration);
    /* int32 maxDevices = 6; */
    if (message.maxDevices !== 0) writer.tag(6, WireType.Varint).int32(message.maxDevices);
    /* int32 filePlanType = 7; */
    if (message.filePlanType !== 0) writer.tag(7, WireType.Varint).int32(message.filePlanType);
    /* int64 bytesUsed = 8; */
    if (message.bytesUsed !== 0n) writer.tag(8, WireType.Varint).int64(message.bytesUsed);
    /* int64 bytesTotal = 9; */
    if (message.bytesTotal !== 0n) writer.tag(9, WireType.Varint).int64(message.bytesTotal);
    /* int64 secondsUntilStorageExpiration = 10; */
    if (message.secondsUntilStorageExpiration !== 0n)
      writer.tag(10, WireType.Varint).int64(message.secondsUntilStorageExpiration);
    /* string storageExpirationDate = 11; */
    if (message.storageExpirationDate !== "")
      writer.tag(11, WireType.LengthDelimited).string(message.storageExpirationDate);
    /* bool hasAutoRenewableAppstoreSubscription = 12; */
    if (message.hasAutoRenewableAppstoreSubscription !== false)
      writer.tag(12, WireType.Varint).bool(message.hasAutoRenewableAppstoreSubscription);
    /* int32 accountType = 13; */
    if (message.accountType !== 0) writer.tag(13, WireType.Varint).int32(message.accountType);
    /* int32 uploadsRemaining = 14; */
    if (message.uploadsRemaining !== 0)
      writer.tag(14, WireType.Varint).int32(message.uploadsRemaining);
    /* int32 enterpriseId = 15; */
    if (message.enterpriseId !== 0) writer.tag(15, WireType.Varint).int32(message.enterpriseId);
    /* bool chatEnabled = 16; */
    if (message.chatEnabled !== false) writer.tag(16, WireType.Varint).bool(message.chatEnabled);
    /* bool auditAndReportingEnabled = 17; */
    if (message.auditAndReportingEnabled !== false)
      writer.tag(17, WireType.Varint).bool(message.auditAndReportingEnabled);
    /* bool breachWatchFeatureDisable = 18; */
    if (message.breachWatchFeatureDisable !== false)
      writer.tag(18, WireType.Varint).bool(message.breachWatchFeatureDisable);
    /* bytes accountUid = 19; */
    if (message.accountUid.length)
      writer.tag(19, WireType.LengthDelimited).bytes(message.accountUid);
    /* bool allowPersonalLicense = 20; */
    if (message.allowPersonalLicense !== false)
      writer.tag(20, WireType.Varint).bool(message.allowPersonalLicense);
    /* string licensedBy = 21; */
    if (message.licensedBy !== "")
      writer.tag(21, WireType.LengthDelimited).string(message.licensedBy);
    /* string email = 22; */
    if (message.email !== "") writer.tag(22, WireType.LengthDelimited).string(message.email);
    /* bool breachWatchEnabled = 23; */
    if (message.breachWatchEnabled !== false)
      writer.tag(23, WireType.Varint).bool(message.breachWatchEnabled);
    /* bool breachWatchScanned = 24; */
    if (message.breachWatchScanned !== false)
      writer.tag(24, WireType.Varint).bool(message.breachWatchScanned);
    /* int64 breachWatchExpiration = 25; */
    if (message.breachWatchExpiration !== 0n)
      writer.tag(25, WireType.Varint).int64(message.breachWatchExpiration);
    /* int64 breachWatchDateCreated = 26; */
    if (message.breachWatchDateCreated !== 0n)
      writer.tag(26, WireType.Varint).int64(message.breachWatchDateCreated);
    /* AccountSummary.Result error = 27; */
    if (message.error)
      Result.internalBinaryWrite(
        message.error,
        writer.tag(27, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* int64 expiration = 29; */
    if (message.expiration !== 0n) writer.tag(29, WireType.Varint).int64(message.expiration);
    /* int64 storageExpiration = 30; */
    if (message.storageExpiration !== 0n)
      writer.tag(30, WireType.Varint).int64(message.storageExpiration);
    /* int32 uploadsCount = 31; */
    if (message.uploadsCount !== 0) writer.tag(31, WireType.Varint).int32(message.uploadsCount);
    /* int32 units = 32; */
    if (message.units !== 0) writer.tag(32, WireType.Varint).int32(message.units);
    /* bool pendingEnterprise = 33; */
    if (message.pendingEnterprise !== false)
      writer.tag(33, WireType.Varint).bool(message.pendingEnterprise);
    /* bool isPamEnabled = 34; */
    if (message.isPamEnabled !== false) writer.tag(34, WireType.Varint).bool(message.isPamEnabled);
    /* bool isKsmEnabled = 35; */
    if (message.isKsmEnabled !== false) writer.tag(35, WireType.Varint).bool(message.isKsmEnabled);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.License
 */
export const License = new License$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AddOn$Type extends MessageType {
  constructor() {
    super("AccountSummary.AddOn", [
      { no: 1, name: "licenseKeyId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "expirationDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "createdDate",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "isTrial", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "enabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "scanned", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "featureDisable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.licenseKeyId = 0;
    message.name = "";
    message.expirationDate = 0n;
    message.createdDate = 0n;
    message.isTrial = false;
    message.enabled = false;
    message.scanned = false;
    message.featureDisable = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* int32 licenseKeyId */ 1:
          message.licenseKeyId = reader.int32();
          break;
        case /* string name */ 2:
          message.name = reader.string();
          break;
        case /* int64 expirationDate */ 3:
          message.expirationDate = reader.int64().toBigInt();
          break;
        case /* int64 createdDate */ 4:
          message.createdDate = reader.int64().toBigInt();
          break;
        case /* bool isTrial */ 5:
          message.isTrial = reader.bool();
          break;
        case /* bool enabled */ 6:
          message.enabled = reader.bool();
          break;
        case /* bool scanned */ 7:
          message.scanned = reader.bool();
          break;
        case /* bool featureDisable */ 8:
          message.featureDisable = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* int32 licenseKeyId = 1; */
    if (message.licenseKeyId !== 0) writer.tag(1, WireType.Varint).int32(message.licenseKeyId);
    /* string name = 2; */
    if (message.name !== "") writer.tag(2, WireType.LengthDelimited).string(message.name);
    /* int64 expirationDate = 3; */
    if (message.expirationDate !== 0n) writer.tag(3, WireType.Varint).int64(message.expirationDate);
    /* int64 createdDate = 4; */
    if (message.createdDate !== 0n) writer.tag(4, WireType.Varint).int64(message.createdDate);
    /* bool isTrial = 5; */
    if (message.isTrial !== false) writer.tag(5, WireType.Varint).bool(message.isTrial);
    /* bool enabled = 6; */
    if (message.enabled !== false) writer.tag(6, WireType.Varint).bool(message.enabled);
    /* bool scanned = 7; */
    if (message.scanned !== false) writer.tag(7, WireType.Varint).bool(message.scanned);
    /* bool featureDisable = 8; */
    if (message.featureDisable !== false)
      writer.tag(8, WireType.Varint).bool(message.featureDisable);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.AddOn
 */
export const AddOn = new AddOn$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Settings$Type extends MessageType {
  constructor() {
    super("AccountSummary.Settings", [
      { no: 1, name: "audit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 2,
        name: "mustPerformAccountShareBy",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 3,
        name: "shareAccountTo",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => MissingAccountShareKey,
      },
      {
        no: 4,
        name: "rules",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => PasswordRule,
      },
      { no: 5, name: "passwordRulesIntro", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "autoBackupDays", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 7, name: "theme", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "channel", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 9, name: "channelValue", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 10, name: "rsaConfigured", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 11, name: "emailVerified", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 12, name: "masterPasswordLastModified", kind: "scalar", T: 1 /*ScalarType.DOUBLE*/ },
      { no: 13, name: "accountFolderKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 14,
        name: "securityKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityKey,
      },
      {
        no: 15,
        name: "keyValues",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValue,
      },
      { no: 16, name: "ssoUser", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 17, name: "onlineAccessOnly", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 18, name: "masterPasswordExpiry", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 19, name: "twoFactorRequired", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 20, name: "disallowExport", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 21, name: "restrictFiles", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 22, name: "restrictAllSharing", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 23, name: "restrictSharing", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 24, name: "restrictSharingIncomingAll", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 25,
        name: "restrictSharingIncomingEnterprise",
        kind: "scalar",
        T: 8 /*ScalarType.BOOL*/,
      },
      {
        no: 26,
        name: "logoutTimer",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 27, name: "persistentLogin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 28, name: "ipDisableAutoApprove", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 29, name: "shareDataKeyWithEccPublicKey", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 30, name: "shareDataKeyWithDevicePublicKey", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 31,
        name: "RecordTypesCounter",
        kind: "scalar",
        jsonName: "RecordTypesCounter",
        T: 5 /*ScalarType.INT32*/,
      },
      {
        no: 32,
        name: "RecordTypesEnterpriseCounter",
        kind: "scalar",
        jsonName: "RecordTypesEnterpriseCounter",
        T: 5 /*ScalarType.INT32*/,
      },
      { no: 33, name: "recordTypesEnabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 34, name: "canManageRecordTypes", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 35, name: "recordTypesPAMCounter", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 36, name: "logoutTimerMinutes", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 37, name: "securityKeysNoUserVerify", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 38,
        name: "channels",
        kind: "enum",
        repeat: 1 /*RepeatType.PACKED*/,
        T: () => ["Authentication.TwoFactorChannelType", TwoFactorChannelType],
      },
      {
        no: 39,
        name: "personalUsernames",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 9 /*ScalarType.STRING*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.audit = false;
    message.mustPerformAccountShareBy = 0n;
    message.shareAccountTo = [];
    message.rules = [];
    message.passwordRulesIntro = "";
    message.autoBackupDays = 0;
    message.theme = "";
    message.channel = "";
    message.channelValue = "";
    message.rsaConfigured = false;
    message.emailVerified = false;
    message.masterPasswordLastModified = 0;
    message.accountFolderKey = new Uint8Array(0);
    message.securityKeys = [];
    message.keyValues = [];
    message.ssoUser = false;
    message.onlineAccessOnly = false;
    message.masterPasswordExpiry = 0;
    message.twoFactorRequired = false;
    message.disallowExport = false;
    message.restrictFiles = false;
    message.restrictAllSharing = false;
    message.restrictSharing = false;
    message.restrictSharingIncomingAll = false;
    message.restrictSharingIncomingEnterprise = false;
    message.logoutTimer = 0n;
    message.persistentLogin = false;
    message.ipDisableAutoApprove = false;
    message.shareDataKeyWithEccPublicKey = false;
    message.shareDataKeyWithDevicePublicKey = false;
    message.recordTypesCounter = 0;
    message.recordTypesEnterpriseCounter = 0;
    message.recordTypesEnabled = false;
    message.canManageRecordTypes = false;
    message.recordTypesPAMCounter = 0;
    message.logoutTimerMinutes = 0;
    message.securityKeysNoUserVerify = false;
    message.channels = [];
    message.personalUsernames = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool audit */ 1:
          message.audit = reader.bool();
          break;
        case /* int64 mustPerformAccountShareBy */ 2:
          message.mustPerformAccountShareBy = reader.int64().toBigInt();
          break;
        case /* repeated AccountSummary.MissingAccountShareKey shareAccountTo */ 3:
          message.shareAccountTo.push(
            MissingAccountShareKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated AccountSummary.PasswordRule rules */ 4:
          message.rules.push(PasswordRule.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* string passwordRulesIntro */ 5:
          message.passwordRulesIntro = reader.string();
          break;
        case /* int32 autoBackupDays */ 6:
          message.autoBackupDays = reader.int32();
          break;
        case /* string theme */ 7:
          message.theme = reader.string();
          break;
        case /* string channel */ 8:
          message.channel = reader.string();
          break;
        case /* string channelValue */ 9:
          message.channelValue = reader.string();
          break;
        case /* bool rsaConfigured */ 10:
          message.rsaConfigured = reader.bool();
          break;
        case /* bool emailVerified */ 11:
          message.emailVerified = reader.bool();
          break;
        case /* double masterPasswordLastModified */ 12:
          message.masterPasswordLastModified = reader.double();
          break;
        case /* bytes accountFolderKey */ 13:
          message.accountFolderKey = reader.bytes();
          break;
        case /* repeated AccountSummary.SecurityKey securityKeys */ 14:
          message.securityKeys.push(
            SecurityKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated AccountSummary.KeyValue keyValues */ 15:
          message.keyValues.push(KeyValue.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* bool ssoUser */ 16:
          message.ssoUser = reader.bool();
          break;
        case /* bool onlineAccessOnly */ 17:
          message.onlineAccessOnly = reader.bool();
          break;
        case /* int32 masterPasswordExpiry */ 18:
          message.masterPasswordExpiry = reader.int32();
          break;
        case /* bool twoFactorRequired */ 19:
          message.twoFactorRequired = reader.bool();
          break;
        case /* bool disallowExport */ 20:
          message.disallowExport = reader.bool();
          break;
        case /* bool restrictFiles */ 21:
          message.restrictFiles = reader.bool();
          break;
        case /* bool restrictAllSharing */ 22:
          message.restrictAllSharing = reader.bool();
          break;
        case /* bool restrictSharing */ 23:
          message.restrictSharing = reader.bool();
          break;
        case /* bool restrictSharingIncomingAll */ 24:
          message.restrictSharingIncomingAll = reader.bool();
          break;
        case /* bool restrictSharingIncomingEnterprise */ 25:
          message.restrictSharingIncomingEnterprise = reader.bool();
          break;
        case /* int64 logoutTimer */ 26:
          message.logoutTimer = reader.int64().toBigInt();
          break;
        case /* bool persistentLogin */ 27:
          message.persistentLogin = reader.bool();
          break;
        case /* bool ipDisableAutoApprove */ 28:
          message.ipDisableAutoApprove = reader.bool();
          break;
        case /* bool shareDataKeyWithEccPublicKey */ 29:
          message.shareDataKeyWithEccPublicKey = reader.bool();
          break;
        case /* bool shareDataKeyWithDevicePublicKey */ 30:
          message.shareDataKeyWithDevicePublicKey = reader.bool();
          break;
        case /* int32 RecordTypesCounter */ 31:
          message.recordTypesCounter = reader.int32();
          break;
        case /* int32 RecordTypesEnterpriseCounter */ 32:
          message.recordTypesEnterpriseCounter = reader.int32();
          break;
        case /* bool recordTypesEnabled */ 33:
          message.recordTypesEnabled = reader.bool();
          break;
        case /* bool canManageRecordTypes */ 34:
          message.canManageRecordTypes = reader.bool();
          break;
        case /* int32 recordTypesPAMCounter */ 35:
          message.recordTypesPAMCounter = reader.int32();
          break;
        case /* int32 logoutTimerMinutes */ 36:
          message.logoutTimerMinutes = reader.int32();
          break;
        case /* bool securityKeysNoUserVerify */ 37:
          message.securityKeysNoUserVerify = reader.bool();
          break;
        case /* repeated Authentication.TwoFactorChannelType channels */ 38:
          if (wireType === WireType.LengthDelimited)
            for (let e = reader.int32() + reader.pos; reader.pos < e; )
              message.channels.push(reader.int32());
          else message.channels.push(reader.int32());
          break;
        case /* repeated string personalUsernames */ 39:
          message.personalUsernames.push(reader.string());
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* bool audit = 1; */
    if (message.audit !== false) writer.tag(1, WireType.Varint).bool(message.audit);
    /* int64 mustPerformAccountShareBy = 2; */
    if (message.mustPerformAccountShareBy !== 0n)
      writer.tag(2, WireType.Varint).int64(message.mustPerformAccountShareBy);
    /* repeated AccountSummary.MissingAccountShareKey shareAccountTo = 3; */
    for (let i = 0; i < message.shareAccountTo.length; i++)
      MissingAccountShareKey.internalBinaryWrite(
        message.shareAccountTo[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.PasswordRule rules = 4; */
    for (let i = 0; i < message.rules.length; i++)
      PasswordRule.internalBinaryWrite(
        message.rules[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* string passwordRulesIntro = 5; */
    if (message.passwordRulesIntro !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.passwordRulesIntro);
    /* int32 autoBackupDays = 6; */
    if (message.autoBackupDays !== 0) writer.tag(6, WireType.Varint).int32(message.autoBackupDays);
    /* string theme = 7; */
    if (message.theme !== "") writer.tag(7, WireType.LengthDelimited).string(message.theme);
    /* string channel = 8; */
    if (message.channel !== "") writer.tag(8, WireType.LengthDelimited).string(message.channel);
    /* string channelValue = 9; */
    if (message.channelValue !== "")
      writer.tag(9, WireType.LengthDelimited).string(message.channelValue);
    /* bool rsaConfigured = 10; */
    if (message.rsaConfigured !== false)
      writer.tag(10, WireType.Varint).bool(message.rsaConfigured);
    /* bool emailVerified = 11; */
    if (message.emailVerified !== false)
      writer.tag(11, WireType.Varint).bool(message.emailVerified);
    /* double masterPasswordLastModified = 12; */
    if (message.masterPasswordLastModified !== 0)
      writer.tag(12, WireType.Bit64).double(message.masterPasswordLastModified);
    /* bytes accountFolderKey = 13; */
    if (message.accountFolderKey.length)
      writer.tag(13, WireType.LengthDelimited).bytes(message.accountFolderKey);
    /* repeated AccountSummary.SecurityKey securityKeys = 14; */
    for (let i = 0; i < message.securityKeys.length; i++)
      SecurityKey.internalBinaryWrite(
        message.securityKeys[i],
        writer.tag(14, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.KeyValue keyValues = 15; */
    for (let i = 0; i < message.keyValues.length; i++)
      KeyValue.internalBinaryWrite(
        message.keyValues[i],
        writer.tag(15, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bool ssoUser = 16; */
    if (message.ssoUser !== false) writer.tag(16, WireType.Varint).bool(message.ssoUser);
    /* bool onlineAccessOnly = 17; */
    if (message.onlineAccessOnly !== false)
      writer.tag(17, WireType.Varint).bool(message.onlineAccessOnly);
    /* int32 masterPasswordExpiry = 18; */
    if (message.masterPasswordExpiry !== 0)
      writer.tag(18, WireType.Varint).int32(message.masterPasswordExpiry);
    /* bool twoFactorRequired = 19; */
    if (message.twoFactorRequired !== false)
      writer.tag(19, WireType.Varint).bool(message.twoFactorRequired);
    /* bool disallowExport = 20; */
    if (message.disallowExport !== false)
      writer.tag(20, WireType.Varint).bool(message.disallowExport);
    /* bool restrictFiles = 21; */
    if (message.restrictFiles !== false)
      writer.tag(21, WireType.Varint).bool(message.restrictFiles);
    /* bool restrictAllSharing = 22; */
    if (message.restrictAllSharing !== false)
      writer.tag(22, WireType.Varint).bool(message.restrictAllSharing);
    /* bool restrictSharing = 23; */
    if (message.restrictSharing !== false)
      writer.tag(23, WireType.Varint).bool(message.restrictSharing);
    /* bool restrictSharingIncomingAll = 24; */
    if (message.restrictSharingIncomingAll !== false)
      writer.tag(24, WireType.Varint).bool(message.restrictSharingIncomingAll);
    /* bool restrictSharingIncomingEnterprise = 25; */
    if (message.restrictSharingIncomingEnterprise !== false)
      writer.tag(25, WireType.Varint).bool(message.restrictSharingIncomingEnterprise);
    /* int64 logoutTimer = 26; */
    if (message.logoutTimer !== 0n) writer.tag(26, WireType.Varint).int64(message.logoutTimer);
    /* bool persistentLogin = 27; */
    if (message.persistentLogin !== false)
      writer.tag(27, WireType.Varint).bool(message.persistentLogin);
    /* bool ipDisableAutoApprove = 28; */
    if (message.ipDisableAutoApprove !== false)
      writer.tag(28, WireType.Varint).bool(message.ipDisableAutoApprove);
    /* bool shareDataKeyWithEccPublicKey = 29; */
    if (message.shareDataKeyWithEccPublicKey !== false)
      writer.tag(29, WireType.Varint).bool(message.shareDataKeyWithEccPublicKey);
    /* bool shareDataKeyWithDevicePublicKey = 30; */
    if (message.shareDataKeyWithDevicePublicKey !== false)
      writer.tag(30, WireType.Varint).bool(message.shareDataKeyWithDevicePublicKey);
    /* int32 RecordTypesCounter = 31; */
    if (message.recordTypesCounter !== 0)
      writer.tag(31, WireType.Varint).int32(message.recordTypesCounter);
    /* int32 RecordTypesEnterpriseCounter = 32; */
    if (message.recordTypesEnterpriseCounter !== 0)
      writer.tag(32, WireType.Varint).int32(message.recordTypesEnterpriseCounter);
    /* bool recordTypesEnabled = 33; */
    if (message.recordTypesEnabled !== false)
      writer.tag(33, WireType.Varint).bool(message.recordTypesEnabled);
    /* bool canManageRecordTypes = 34; */
    if (message.canManageRecordTypes !== false)
      writer.tag(34, WireType.Varint).bool(message.canManageRecordTypes);
    /* int32 recordTypesPAMCounter = 35; */
    if (message.recordTypesPAMCounter !== 0)
      writer.tag(35, WireType.Varint).int32(message.recordTypesPAMCounter);
    /* int32 logoutTimerMinutes = 36; */
    if (message.logoutTimerMinutes !== 0)
      writer.tag(36, WireType.Varint).int32(message.logoutTimerMinutes);
    /* bool securityKeysNoUserVerify = 37; */
    if (message.securityKeysNoUserVerify !== false)
      writer.tag(37, WireType.Varint).bool(message.securityKeysNoUserVerify);
    /* repeated Authentication.TwoFactorChannelType channels = 38; */
    if (message.channels.length) {
      writer.tag(38, WireType.LengthDelimited).fork();
      for (let i = 0; i < message.channels.length; i++) writer.int32(message.channels[i]);
      writer.join();
    }
    /* repeated string personalUsernames = 39; */
    for (let i = 0; i < message.personalUsernames.length; i++)
      writer.tag(39, WireType.LengthDelimited).string(message.personalUsernames[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.Settings
 */
export const Settings = new Settings$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KeyValue$Type extends MessageType {
  constructor() {
    super("AccountSummary.KeyValue", [
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
 * @generated MessageType for protobuf message AccountSummary.KeyValue
 */
export const KeyValue = new KeyValue$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KeyValueBoolean$Type extends MessageType {
  constructor() {
    super("AccountSummary.KeyValueBoolean", [
      { no: 1, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "value", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = "";
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
        case /* string key */ 1:
          message.key = reader.string();
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
    /* string key = 1; */
    if (message.key !== "") writer.tag(1, WireType.LengthDelimited).string(message.key);
    /* bool value = 2; */
    if (message.value !== false) writer.tag(2, WireType.Varint).bool(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.KeyValueBoolean
 */
export const KeyValueBoolean = new KeyValueBoolean$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KeyValueLong$Type extends MessageType {
  constructor() {
    super("AccountSummary.KeyValueLong", [
      { no: 1, name: "key", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "value", kind: "scalar", T: 3 /*ScalarType.INT64*/, L: 0 /*LongType.BIGINT*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.key = "";
    message.value = 0n;
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
        case /* int64 value */ 2:
          message.value = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int64 value = 2; */
    if (message.value !== 0n) writer.tag(2, WireType.Varint).int64(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.KeyValueLong
 */
export const KeyValueLong = new KeyValueLong$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Result$Type extends MessageType {
  constructor() {
    super("AccountSummary.Result", [
      { no: 1, name: "resultCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "message", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "result", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.resultCode = "";
    message.message = "";
    message.result = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string resultCode */ 1:
          message.resultCode = reader.string();
          break;
        case /* string message */ 2:
          message.message = reader.string();
          break;
        case /* string result */ 3:
          message.result = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string resultCode = 1; */
    if (message.resultCode !== "")
      writer.tag(1, WireType.LengthDelimited).string(message.resultCode);
    /* string message = 2; */
    if (message.message !== "") writer.tag(2, WireType.LengthDelimited).string(message.message);
    /* string result = 3; */
    if (message.result !== "") writer.tag(3, WireType.LengthDelimited).string(message.result);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.Result
 */
export const Result = new Result$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Enforcements$Type extends MessageType {
  constructor() {
    super("AccountSummary.Enforcements", [
      {
        no: 1,
        name: "strings",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValue,
      },
      {
        no: 2,
        name: "booleans",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValueBoolean,
      },
      {
        no: 3,
        name: "longs",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValueLong,
      },
      {
        no: 4,
        name: "jsons",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KeyValue,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.strings = [];
    message.booleans = [];
    message.longs = [];
    message.jsons = [];
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* repeated AccountSummary.KeyValue strings */ 1:
          message.strings.push(KeyValue.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated AccountSummary.KeyValueBoolean booleans */ 2:
          message.booleans.push(
            KeyValueBoolean.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated AccountSummary.KeyValueLong longs */ 3:
          message.longs.push(KeyValueLong.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated AccountSummary.KeyValue jsons */ 4:
          message.jsons.push(KeyValue.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated AccountSummary.KeyValue strings = 1; */
    for (let i = 0; i < message.strings.length; i++)
      KeyValue.internalBinaryWrite(
        message.strings[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.KeyValueBoolean booleans = 2; */
    for (let i = 0; i < message.booleans.length; i++)
      KeyValueBoolean.internalBinaryWrite(
        message.booleans[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.KeyValueLong longs = 3; */
    for (let i = 0; i < message.longs.length; i++)
      KeyValueLong.internalBinaryWrite(
        message.longs[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated AccountSummary.KeyValue jsons = 4; */
    for (let i = 0; i < message.jsons.length; i++)
      KeyValue.internalBinaryWrite(
        message.jsons[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.Enforcements
 */
export const Enforcements = new Enforcements$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MissingAccountShareKey$Type extends MessageType {
  constructor() {
    super("AccountSummary.MissingAccountShareKey", [
      {
        no: 1,
        name: "role_id",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.roleId = 0n;
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
        case /* int64 role_id */ 1:
          message.roleId = reader.int64().toBigInt();
          break;
        case /* bytes publicKey */ 2:
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
    /* int64 role_id = 1; */
    if (message.roleId !== 0n) writer.tag(1, WireType.Varint).int64(message.roleId);
    /* bytes publicKey = 2; */
    if (message.publicKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.publicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.MissingAccountShareKey
 */
export const MissingAccountShareKey = new MissingAccountShareKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PasswordRule$Type extends MessageType {
  constructor() {
    super("AccountSummary.PasswordRule", [
      { no: 1, name: "ruleType", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "pattern", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "match", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "minimum", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "description", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 6, name: "value", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.ruleType = "";
    message.pattern = "";
    message.match = false;
    message.minimum = 0;
    message.description = "";
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
        case /* string pattern */ 2:
          message.pattern = reader.string();
          break;
        case /* bool match */ 3:
          message.match = reader.bool();
          break;
        case /* int32 minimum */ 4:
          message.minimum = reader.int32();
          break;
        case /* string description */ 5:
          message.description = reader.string();
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
    /* string pattern = 2; */
    if (message.pattern !== "") writer.tag(2, WireType.LengthDelimited).string(message.pattern);
    /* bool match = 3; */
    if (message.match !== false) writer.tag(3, WireType.Varint).bool(message.match);
    /* int32 minimum = 4; */
    if (message.minimum !== 0) writer.tag(4, WireType.Varint).int32(message.minimum);
    /* string description = 5; */
    if (message.description !== "")
      writer.tag(5, WireType.LengthDelimited).string(message.description);
    /* string value = 6; */
    if (message.value !== "") writer.tag(6, WireType.LengthDelimited).string(message.value);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.PasswordRule
 */
export const PasswordRule = new PasswordRule$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityKey$Type extends MessageType {
  constructor() {
    super("AccountSummary.SecurityKey", [
      {
        no: 1,
        name: "deviceId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "deviceName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 3,
        name: "dateAdded",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 4, name: "isValid", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "deviceRegistration", kind: "message", T: () => DeviceRegistration },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.deviceId = 0n;
    message.deviceName = "";
    message.dateAdded = 0n;
    message.isValid = false;
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
        case /* int64 dateAdded */ 3:
          message.dateAdded = reader.int64().toBigInt();
          break;
        case /* bool isValid */ 4:
          message.isValid = reader.bool();
          break;
        case /* AccountSummary.DeviceRegistration deviceRegistration */ 5:
          message.deviceRegistration = DeviceRegistration.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.deviceRegistration,
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
    /* int64 deviceId = 1; */
    if (message.deviceId !== 0n) writer.tag(1, WireType.Varint).int64(message.deviceId);
    /* string deviceName = 2; */
    if (message.deviceName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.deviceName);
    /* int64 dateAdded = 3; */
    if (message.dateAdded !== 0n) writer.tag(3, WireType.Varint).int64(message.dateAdded);
    /* bool isValid = 4; */
    if (message.isValid !== false) writer.tag(4, WireType.Varint).bool(message.isValid);
    /* AccountSummary.DeviceRegistration deviceRegistration = 5; */
    if (message.deviceRegistration)
      DeviceRegistration.internalBinaryWrite(
        message.deviceRegistration,
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.SecurityKey
 */
export const SecurityKey = new SecurityKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeviceRegistration$Type extends MessageType {
  constructor() {
    super("AccountSummary.DeviceRegistration", [
      { no: 1, name: "keyHandle", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "publicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "attestationCert", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 4,
        name: "counter",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 5, name: "compromised", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.keyHandle = "";
    message.publicKey = new Uint8Array(0);
    message.attestationCert = "";
    message.counter = 0n;
    message.compromised = false;
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string keyHandle */ 1:
          message.keyHandle = reader.string();
          break;
        case /* bytes publicKey */ 2:
          message.publicKey = reader.bytes();
          break;
        case /* string attestationCert */ 3:
          message.attestationCert = reader.string();
          break;
        case /* int64 counter */ 4:
          message.counter = reader.int64().toBigInt();
          break;
        case /* bool compromised */ 5:
          message.compromised = reader.bool();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string keyHandle = 1; */
    if (message.keyHandle !== "") writer.tag(1, WireType.LengthDelimited).string(message.keyHandle);
    /* bytes publicKey = 2; */
    if (message.publicKey.length) writer.tag(2, WireType.LengthDelimited).bytes(message.publicKey);
    /* string attestationCert = 3; */
    if (message.attestationCert !== "")
      writer.tag(3, WireType.LengthDelimited).string(message.attestationCert);
    /* int64 counter = 4; */
    if (message.counter !== 0n) writer.tag(4, WireType.Varint).int64(message.counter);
    /* bool compromised = 5; */
    if (message.compromised !== false) writer.tag(5, WireType.Varint).bool(message.compromised);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.DeviceRegistration
 */
export const DeviceRegistration = new DeviceRegistration$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Group$Type extends MessageType {
  constructor() {
    super("AccountSummary.Group", [
      { no: 1, name: "admin", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 2, name: "groupVerificationCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "administrator", kind: "message", T: () => Administrator },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.admin = false;
    message.groupVerificationCode = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* bool admin */ 1:
          message.admin = reader.bool();
          break;
        case /* string groupVerificationCode */ 2:
          message.groupVerificationCode = reader.string();
          break;
        case /* AccountSummary.Administrator administrator */ 4:
          message.administrator = Administrator.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.administrator,
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
    /* bool admin = 1; */
    if (message.admin !== false) writer.tag(1, WireType.Varint).bool(message.admin);
    /* string groupVerificationCode = 2; */
    if (message.groupVerificationCode !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.groupVerificationCode);
    /* AccountSummary.Administrator administrator = 4; */
    if (message.administrator)
      Administrator.internalBinaryWrite(
        message.administrator,
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.Group
 */
export const Group = new Group$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Administrator$Type extends MessageType {
  constructor() {
    super("AccountSummary.Administrator", [
      { no: 1, name: "firstName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 2, name: "lastName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "email", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "currentNumberOfUsers", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "numberOfUsers", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 7, name: "subscriptionCode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 8, name: "expirationDate", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 9, name: "purchaseDate", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.firstName = "";
    message.lastName = "";
    message.email = "";
    message.currentNumberOfUsers = 0;
    message.numberOfUsers = 0;
    message.subscriptionCode = "";
    message.expirationDate = "";
    message.purchaseDate = "";
    if (value !== undefined) reflectionMergePartial(this, message, value);
    return message;
  }
  internalBinaryRead(reader, length, options, target) {
    let message = target ?? this.create(),
      end = reader.pos + length;
    while (reader.pos < end) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case /* string firstName */ 1:
          message.firstName = reader.string();
          break;
        case /* string lastName */ 2:
          message.lastName = reader.string();
          break;
        case /* string email */ 3:
          message.email = reader.string();
          break;
        case /* int32 currentNumberOfUsers */ 4:
          message.currentNumberOfUsers = reader.int32();
          break;
        case /* int32 numberOfUsers */ 5:
          message.numberOfUsers = reader.int32();
          break;
        case /* string subscriptionCode */ 7:
          message.subscriptionCode = reader.string();
          break;
        case /* string expirationDate */ 8:
          message.expirationDate = reader.string();
          break;
        case /* string purchaseDate */ 9:
          message.purchaseDate = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* string firstName = 1; */
    if (message.firstName !== "") writer.tag(1, WireType.LengthDelimited).string(message.firstName);
    /* string lastName = 2; */
    if (message.lastName !== "") writer.tag(2, WireType.LengthDelimited).string(message.lastName);
    /* string email = 3; */
    if (message.email !== "") writer.tag(3, WireType.LengthDelimited).string(message.email);
    /* int32 currentNumberOfUsers = 4; */
    if (message.currentNumberOfUsers !== 0)
      writer.tag(4, WireType.Varint).int32(message.currentNumberOfUsers);
    /* int32 numberOfUsers = 5; */
    if (message.numberOfUsers !== 0) writer.tag(5, WireType.Varint).int32(message.numberOfUsers);
    /* string subscriptionCode = 7; */
    if (message.subscriptionCode !== "")
      writer.tag(7, WireType.LengthDelimited).string(message.subscriptionCode);
    /* string expirationDate = 8; */
    if (message.expirationDate !== "")
      writer.tag(8, WireType.LengthDelimited).string(message.expirationDate);
    /* string purchaseDate = 9; */
    if (message.purchaseDate !== "")
      writer.tag(9, WireType.LengthDelimited).string(message.purchaseDate);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message AccountSummary.Administrator
 */
export const Administrator = new Administrator$Type();
