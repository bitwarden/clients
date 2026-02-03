import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
import { AppClientType } from "./enterprise";
import { LoginType } from "./APIRequest";
import { BreachWatchInfoType } from "./breachwatch";
import { TimerNotificationType } from "./record";
import { RecordKeyType } from "./record";
import { NotificationWrapper } from "./NotificationCenter";
/**
 * @generated from protobuf enum Vault.CacheStatus
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
 * @generated from protobuf enum Vault.RecordRotationStatus
 */
export var RecordRotationStatus;
(function (RecordRotationStatus) {
  /**
   * @generated from protobuf enum value: RRST_NOT_ROTATED = 0;
   */
  RecordRotationStatus[(RecordRotationStatus["RRST_NOT_ROTATED"] = 0)] = "RRST_NOT_ROTATED";
  /**
   * @generated from protobuf enum value: RRST_IN_PROGRESS = 1;
   */
  RecordRotationStatus[(RecordRotationStatus["RRST_IN_PROGRESS"] = 1)] = "RRST_IN_PROGRESS";
  /**
   * @generated from protobuf enum value: RRST_SUCCESS = 2;
   */
  RecordRotationStatus[(RecordRotationStatus["RRST_SUCCESS"] = 2)] = "RRST_SUCCESS";
  /**
   * @generated from protobuf enum value: RRST_FAILURE = 3;
   */
  RecordRotationStatus[(RecordRotationStatus["RRST_FAILURE"] = 3)] = "RRST_FAILURE";
})(RecordRotationStatus || (RecordRotationStatus = {}));
// @generated message type with reflection information, may provide speed optimized methods
class SyncDownRequest$Type extends MessageType {
  constructor() {
    super("Vault.SyncDownRequest", [
      { no: 1, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "dataVersion", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.continuationToken = new Uint8Array(0);
    message.dataVersion = 0;
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
        case /* int32 dataVersion */ 2:
          message.dataVersion = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int32 dataVersion = 2; */
    if (message.dataVersion !== 0) writer.tag(2, WireType.Varint).int32(message.dataVersion);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SyncDownRequest
 */
export const SyncDownRequest = new SyncDownRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SyncDownResponse$Type extends MessageType {
  constructor() {
    super("Vault.SyncDownResponse", [
      { no: 1, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "hasMore", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "cacheStatus", kind: "enum", T: () => ["Vault.CacheStatus", CacheStatus] },
      {
        no: 4,
        name: "userFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserFolder,
      },
      {
        no: 5,
        name: "sharedFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolder,
      },
      {
        no: 6,
        name: "userFolderSharedFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserFolderSharedFolder,
      },
      {
        no: 7,
        name: "sharedFolderFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderFolder,
      },
      {
        no: 8,
        name: "records",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => Record,
      },
      {
        no: 9,
        name: "recordMetaData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordMetaData,
      },
      {
        no: 10,
        name: "nonSharedData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => NonSharedData,
      },
      {
        no: 11,
        name: "recordLinks",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordLink,
      },
      {
        no: 12,
        name: "userFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserFolderRecord,
      },
      {
        no: 13,
        name: "sharedFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderRecord,
      },
      {
        no: 14,
        name: "sharedFolderFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderFolderRecord,
      },
      {
        no: 15,
        name: "sharedFolderUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderUser,
      },
      {
        no: 16,
        name: "sharedFolderTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderTeam,
      },
      {
        no: 17,
        name: "recordAddAuditData",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 18, name: "teams", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => Team },
      {
        no: 19,
        name: "sharingChanges",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharingChange,
      },
      { no: 20, name: "profile", kind: "message", T: () => Profile },
      { no: 21, name: "profilePic", kind: "message", T: () => ProfilePic },
      {
        no: 22,
        name: "pendingTeamMembers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => PendingTeamMember,
      },
      {
        no: 23,
        name: "breachWatchRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchRecord,
      },
      {
        no: 24,
        name: "userAuths",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserAuth,
      },
      {
        no: 25,
        name: "breachWatchSecurityData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchSecurityData,
      },
      { no: 26, name: "reusedPasswords", kind: "message", T: () => ReusedPasswords },
      {
        no: 27,
        name: "removedUserFolders",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 28,
        name: "removedSharedFolders",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 29,
        name: "removedUserFolderSharedFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserFolderSharedFolder,
      },
      {
        no: 30,
        name: "removedSharedFolderFolders",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderFolder,
      },
      {
        no: 31,
        name: "removedRecords",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 32,
        name: "removedRecordLinks",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordLink,
      },
      {
        no: 33,
        name: "removedUserFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => UserFolderRecord,
      },
      {
        no: 34,
        name: "removedSharedFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderRecord,
      },
      {
        no: 35,
        name: "removedSharedFolderFolderRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderFolderRecord,
      },
      {
        no: 36,
        name: "removedSharedFolderUsers",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderUser,
      },
      {
        no: 37,
        name: "removedSharedFolderTeams",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderTeam,
      },
      {
        no: 38,
        name: "removedTeams",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 39,
        name: "ksmAppShares",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KsmChange,
      },
      {
        no: 40,
        name: "ksmAppClients",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => KsmChange,
      },
      {
        no: 41,
        name: "shareInvitations",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => ShareInvitation,
      },
      { no: 42, name: "diagnostics", kind: "message", T: () => SyncDiagnostics },
      {
        no: 43,
        name: "recordRotations",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => RecordRotation,
      },
      { no: 44, name: "users", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => User },
      {
        no: 45,
        name: "removedUsers",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 46,
        name: "securityScoreData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SecurityScoreData,
      },
      {
        no: 47,
        name: "notificationSync",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => NotificationWrapper,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.continuationToken = new Uint8Array(0);
    message.hasMore = false;
    message.cacheStatus = 0;
    message.userFolders = [];
    message.sharedFolders = [];
    message.userFolderSharedFolders = [];
    message.sharedFolderFolders = [];
    message.records = [];
    message.recordMetaData = [];
    message.nonSharedData = [];
    message.recordLinks = [];
    message.userFolderRecords = [];
    message.sharedFolderRecords = [];
    message.sharedFolderFolderRecords = [];
    message.sharedFolderUsers = [];
    message.sharedFolderTeams = [];
    message.recordAddAuditData = [];
    message.teams = [];
    message.sharingChanges = [];
    message.pendingTeamMembers = [];
    message.breachWatchRecords = [];
    message.userAuths = [];
    message.breachWatchSecurityData = [];
    message.removedUserFolders = [];
    message.removedSharedFolders = [];
    message.removedUserFolderSharedFolders = [];
    message.removedSharedFolderFolders = [];
    message.removedRecords = [];
    message.removedRecordLinks = [];
    message.removedUserFolderRecords = [];
    message.removedSharedFolderRecords = [];
    message.removedSharedFolderFolderRecords = [];
    message.removedSharedFolderUsers = [];
    message.removedSharedFolderTeams = [];
    message.removedTeams = [];
    message.ksmAppShares = [];
    message.ksmAppClients = [];
    message.shareInvitations = [];
    message.recordRotations = [];
    message.users = [];
    message.removedUsers = [];
    message.securityScoreData = [];
    message.notificationSync = [];
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
        case /* Vault.CacheStatus cacheStatus */ 3:
          message.cacheStatus = reader.int32();
          break;
        case /* repeated Vault.UserFolder userFolders */ 4:
          message.userFolders.push(UserFolder.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.SharedFolder sharedFolders */ 5:
          message.sharedFolders.push(
            SharedFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.UserFolderSharedFolder userFolderSharedFolders */ 6:
          message.userFolderSharedFolders.push(
            UserFolderSharedFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderFolder sharedFolderFolders */ 7:
          message.sharedFolderFolders.push(
            SharedFolderFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.Record records */ 8:
          message.records.push(Record.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.RecordMetaData recordMetaData */ 9:
          message.recordMetaData.push(
            RecordMetaData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.NonSharedData nonSharedData */ 10:
          message.nonSharedData.push(
            NonSharedData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.RecordLink recordLinks */ 11:
          message.recordLinks.push(RecordLink.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.UserFolderRecord userFolderRecords */ 12:
          message.userFolderRecords.push(
            UserFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderRecord sharedFolderRecords */ 13:
          message.sharedFolderRecords.push(
            SharedFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderFolderRecord sharedFolderFolderRecords */ 14:
          message.sharedFolderFolderRecords.push(
            SharedFolderFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderUser sharedFolderUsers */ 15:
          message.sharedFolderUsers.push(
            SharedFolderUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderTeam sharedFolderTeams */ 16:
          message.sharedFolderTeams.push(
            SharedFolderTeam.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes recordAddAuditData */ 17:
          message.recordAddAuditData.push(reader.bytes());
          break;
        case /* repeated Vault.Team teams */ 18:
          message.teams.push(Team.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.SharingChange sharingChanges */ 19:
          message.sharingChanges.push(
            SharingChange.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Vault.Profile profile */ 20:
          message.profile = Profile.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.profile,
          );
          break;
        case /* Vault.ProfilePic profilePic */ 21:
          message.profilePic = ProfilePic.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.profilePic,
          );
          break;
        case /* repeated Vault.PendingTeamMember pendingTeamMembers */ 22:
          message.pendingTeamMembers.push(
            PendingTeamMember.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.BreachWatchRecord breachWatchRecords */ 23:
          message.breachWatchRecords.push(
            BreachWatchRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.UserAuth userAuths */ 24:
          message.userAuths.push(UserAuth.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.BreachWatchSecurityData breachWatchSecurityData */ 25:
          message.breachWatchSecurityData.push(
            BreachWatchSecurityData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Vault.ReusedPasswords reusedPasswords */ 26:
          message.reusedPasswords = ReusedPasswords.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.reusedPasswords,
          );
          break;
        case /* repeated bytes removedUserFolders */ 27:
          message.removedUserFolders.push(reader.bytes());
          break;
        case /* repeated bytes removedSharedFolders */ 28:
          message.removedSharedFolders.push(reader.bytes());
          break;
        case /* repeated Vault.UserFolderSharedFolder removedUserFolderSharedFolders */ 29:
          message.removedUserFolderSharedFolders.push(
            UserFolderSharedFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderFolder removedSharedFolderFolders */ 30:
          message.removedSharedFolderFolders.push(
            SharedFolderFolder.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes removedRecords */ 31:
          message.removedRecords.push(reader.bytes());
          break;
        case /* repeated Vault.RecordLink removedRecordLinks */ 32:
          message.removedRecordLinks.push(
            RecordLink.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.UserFolderRecord removedUserFolderRecords */ 33:
          message.removedUserFolderRecords.push(
            UserFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderRecord removedSharedFolderRecords */ 34:
          message.removedSharedFolderRecords.push(
            SharedFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderFolderRecord removedSharedFolderFolderRecords */ 35:
          message.removedSharedFolderFolderRecords.push(
            SharedFolderFolderRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderUser removedSharedFolderUsers */ 36:
          message.removedSharedFolderUsers.push(
            SharedFolderUser.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.SharedFolderTeam removedSharedFolderTeams */ 37:
          message.removedSharedFolderTeams.push(
            SharedFolderTeam.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated bytes removedTeams */ 38:
          message.removedTeams.push(reader.bytes());
          break;
        case /* repeated Vault.KsmChange ksmAppShares */ 39:
          message.ksmAppShares.push(KsmChange.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated Vault.KsmChange ksmAppClients */ 40:
          message.ksmAppClients.push(
            KsmChange.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.ShareInvitation shareInvitations */ 41:
          message.shareInvitations.push(
            ShareInvitation.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* Vault.SyncDiagnostics diagnostics */ 42:
          message.diagnostics = SyncDiagnostics.internalBinaryRead(
            reader,
            reader.uint32(),
            options,
            message.diagnostics,
          );
          break;
        case /* repeated Vault.RecordRotation recordRotations */ 43:
          message.recordRotations.push(
            RecordRotation.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.User users */ 44:
          message.users.push(User.internalBinaryRead(reader, reader.uint32(), options));
          break;
        case /* repeated bytes removedUsers */ 45:
          message.removedUsers.push(reader.bytes());
          break;
        case /* repeated Vault.SecurityScoreData securityScoreData */ 46:
          message.securityScoreData.push(
            SecurityScoreData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated NotificationCenter.NotificationWrapper notificationSync */ 47:
          message.notificationSync.push(
            NotificationWrapper.internalBinaryRead(reader, reader.uint32(), options),
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
    /* Vault.CacheStatus cacheStatus = 3; */
    if (message.cacheStatus !== 0) writer.tag(3, WireType.Varint).int32(message.cacheStatus);
    /* repeated Vault.UserFolder userFolders = 4; */
    for (let i = 0; i < message.userFolders.length; i++)
      UserFolder.internalBinaryWrite(
        message.userFolders[i],
        writer.tag(4, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolder sharedFolders = 5; */
    for (let i = 0; i < message.sharedFolders.length; i++)
      SharedFolder.internalBinaryWrite(
        message.sharedFolders[i],
        writer.tag(5, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.UserFolderSharedFolder userFolderSharedFolders = 6; */
    for (let i = 0; i < message.userFolderSharedFolders.length; i++)
      UserFolderSharedFolder.internalBinaryWrite(
        message.userFolderSharedFolders[i],
        writer.tag(6, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderFolder sharedFolderFolders = 7; */
    for (let i = 0; i < message.sharedFolderFolders.length; i++)
      SharedFolderFolder.internalBinaryWrite(
        message.sharedFolderFolders[i],
        writer.tag(7, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.Record records = 8; */
    for (let i = 0; i < message.records.length; i++)
      Record.internalBinaryWrite(
        message.records[i],
        writer.tag(8, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.RecordMetaData recordMetaData = 9; */
    for (let i = 0; i < message.recordMetaData.length; i++)
      RecordMetaData.internalBinaryWrite(
        message.recordMetaData[i],
        writer.tag(9, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.NonSharedData nonSharedData = 10; */
    for (let i = 0; i < message.nonSharedData.length; i++)
      NonSharedData.internalBinaryWrite(
        message.nonSharedData[i],
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.RecordLink recordLinks = 11; */
    for (let i = 0; i < message.recordLinks.length; i++)
      RecordLink.internalBinaryWrite(
        message.recordLinks[i],
        writer.tag(11, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.UserFolderRecord userFolderRecords = 12; */
    for (let i = 0; i < message.userFolderRecords.length; i++)
      UserFolderRecord.internalBinaryWrite(
        message.userFolderRecords[i],
        writer.tag(12, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderRecord sharedFolderRecords = 13; */
    for (let i = 0; i < message.sharedFolderRecords.length; i++)
      SharedFolderRecord.internalBinaryWrite(
        message.sharedFolderRecords[i],
        writer.tag(13, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderFolderRecord sharedFolderFolderRecords = 14; */
    for (let i = 0; i < message.sharedFolderFolderRecords.length; i++)
      SharedFolderFolderRecord.internalBinaryWrite(
        message.sharedFolderFolderRecords[i],
        writer.tag(14, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderUser sharedFolderUsers = 15; */
    for (let i = 0; i < message.sharedFolderUsers.length; i++)
      SharedFolderUser.internalBinaryWrite(
        message.sharedFolderUsers[i],
        writer.tag(15, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderTeam sharedFolderTeams = 16; */
    for (let i = 0; i < message.sharedFolderTeams.length; i++)
      SharedFolderTeam.internalBinaryWrite(
        message.sharedFolderTeams[i],
        writer.tag(16, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes recordAddAuditData = 17; */
    for (let i = 0; i < message.recordAddAuditData.length; i++)
      writer.tag(17, WireType.LengthDelimited).bytes(message.recordAddAuditData[i]);
    /* repeated Vault.Team teams = 18; */
    for (let i = 0; i < message.teams.length; i++)
      Team.internalBinaryWrite(
        message.teams[i],
        writer.tag(18, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharingChange sharingChanges = 19; */
    for (let i = 0; i < message.sharingChanges.length; i++)
      SharingChange.internalBinaryWrite(
        message.sharingChanges[i],
        writer.tag(19, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Vault.Profile profile = 20; */
    if (message.profile)
      Profile.internalBinaryWrite(
        message.profile,
        writer.tag(20, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Vault.ProfilePic profilePic = 21; */
    if (message.profilePic)
      ProfilePic.internalBinaryWrite(
        message.profilePic,
        writer.tag(21, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.PendingTeamMember pendingTeamMembers = 22; */
    for (let i = 0; i < message.pendingTeamMembers.length; i++)
      PendingTeamMember.internalBinaryWrite(
        message.pendingTeamMembers[i],
        writer.tag(22, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.BreachWatchRecord breachWatchRecords = 23; */
    for (let i = 0; i < message.breachWatchRecords.length; i++)
      BreachWatchRecord.internalBinaryWrite(
        message.breachWatchRecords[i],
        writer.tag(23, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.UserAuth userAuths = 24; */
    for (let i = 0; i < message.userAuths.length; i++)
      UserAuth.internalBinaryWrite(
        message.userAuths[i],
        writer.tag(24, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.BreachWatchSecurityData breachWatchSecurityData = 25; */
    for (let i = 0; i < message.breachWatchSecurityData.length; i++)
      BreachWatchSecurityData.internalBinaryWrite(
        message.breachWatchSecurityData[i],
        writer.tag(25, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Vault.ReusedPasswords reusedPasswords = 26; */
    if (message.reusedPasswords)
      ReusedPasswords.internalBinaryWrite(
        message.reusedPasswords,
        writer.tag(26, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes removedUserFolders = 27; */
    for (let i = 0; i < message.removedUserFolders.length; i++)
      writer.tag(27, WireType.LengthDelimited).bytes(message.removedUserFolders[i]);
    /* repeated bytes removedSharedFolders = 28; */
    for (let i = 0; i < message.removedSharedFolders.length; i++)
      writer.tag(28, WireType.LengthDelimited).bytes(message.removedSharedFolders[i]);
    /* repeated Vault.UserFolderSharedFolder removedUserFolderSharedFolders = 29; */
    for (let i = 0; i < message.removedUserFolderSharedFolders.length; i++)
      UserFolderSharedFolder.internalBinaryWrite(
        message.removedUserFolderSharedFolders[i],
        writer.tag(29, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderFolder removedSharedFolderFolders = 30; */
    for (let i = 0; i < message.removedSharedFolderFolders.length; i++)
      SharedFolderFolder.internalBinaryWrite(
        message.removedSharedFolderFolders[i],
        writer.tag(30, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes removedRecords = 31; */
    for (let i = 0; i < message.removedRecords.length; i++)
      writer.tag(31, WireType.LengthDelimited).bytes(message.removedRecords[i]);
    /* repeated Vault.RecordLink removedRecordLinks = 32; */
    for (let i = 0; i < message.removedRecordLinks.length; i++)
      RecordLink.internalBinaryWrite(
        message.removedRecordLinks[i],
        writer.tag(32, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.UserFolderRecord removedUserFolderRecords = 33; */
    for (let i = 0; i < message.removedUserFolderRecords.length; i++)
      UserFolderRecord.internalBinaryWrite(
        message.removedUserFolderRecords[i],
        writer.tag(33, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderRecord removedSharedFolderRecords = 34; */
    for (let i = 0; i < message.removedSharedFolderRecords.length; i++)
      SharedFolderRecord.internalBinaryWrite(
        message.removedSharedFolderRecords[i],
        writer.tag(34, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderFolderRecord removedSharedFolderFolderRecords = 35; */
    for (let i = 0; i < message.removedSharedFolderFolderRecords.length; i++)
      SharedFolderFolderRecord.internalBinaryWrite(
        message.removedSharedFolderFolderRecords[i],
        writer.tag(35, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderUser removedSharedFolderUsers = 36; */
    for (let i = 0; i < message.removedSharedFolderUsers.length; i++)
      SharedFolderUser.internalBinaryWrite(
        message.removedSharedFolderUsers[i],
        writer.tag(36, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.SharedFolderTeam removedSharedFolderTeams = 37; */
    for (let i = 0; i < message.removedSharedFolderTeams.length; i++)
      SharedFolderTeam.internalBinaryWrite(
        message.removedSharedFolderTeams[i],
        writer.tag(37, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes removedTeams = 38; */
    for (let i = 0; i < message.removedTeams.length; i++)
      writer.tag(38, WireType.LengthDelimited).bytes(message.removedTeams[i]);
    /* repeated Vault.KsmChange ksmAppShares = 39; */
    for (let i = 0; i < message.ksmAppShares.length; i++)
      KsmChange.internalBinaryWrite(
        message.ksmAppShares[i],
        writer.tag(39, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.KsmChange ksmAppClients = 40; */
    for (let i = 0; i < message.ksmAppClients.length; i++)
      KsmChange.internalBinaryWrite(
        message.ksmAppClients[i],
        writer.tag(40, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.ShareInvitation shareInvitations = 41; */
    for (let i = 0; i < message.shareInvitations.length; i++)
      ShareInvitation.internalBinaryWrite(
        message.shareInvitations[i],
        writer.tag(41, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* Vault.SyncDiagnostics diagnostics = 42; */
    if (message.diagnostics)
      SyncDiagnostics.internalBinaryWrite(
        message.diagnostics,
        writer.tag(42, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.RecordRotation recordRotations = 43; */
    for (let i = 0; i < message.recordRotations.length; i++)
      RecordRotation.internalBinaryWrite(
        message.recordRotations[i],
        writer.tag(43, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.User users = 44; */
    for (let i = 0; i < message.users.length; i++)
      User.internalBinaryWrite(
        message.users[i],
        writer.tag(44, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated bytes removedUsers = 45; */
    for (let i = 0; i < message.removedUsers.length; i++)
      writer.tag(45, WireType.LengthDelimited).bytes(message.removedUsers[i]);
    /* repeated Vault.SecurityScoreData securityScoreData = 46; */
    for (let i = 0; i < message.securityScoreData.length; i++)
      SecurityScoreData.internalBinaryWrite(
        message.securityScoreData[i],
        writer.tag(46, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated NotificationCenter.NotificationWrapper notificationSync = 47; */
    for (let i = 0; i < message.notificationSync.length; i++)
      NotificationWrapper.internalBinaryWrite(
        message.notificationSync[i],
        writer.tag(47, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SyncDownResponse
 */
export const SyncDownResponse = new SyncDownResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserFolder$Type extends MessageType {
  constructor() {
    super("Vault.UserFolder", [
      { no: 1, name: "folderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "parentUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "userFolderKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "keyType", kind: "enum", T: () => ["Records.RecordKeyType", RecordKeyType] },
      {
        no: 5,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.folderUid = new Uint8Array(0);
    message.parentUid = new Uint8Array(0);
    message.userFolderKey = new Uint8Array(0);
    message.keyType = 0;
    message.revision = 0n;
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
        case /* bytes folderUid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes parentUid */ 2:
          message.parentUid = reader.bytes();
          break;
        case /* bytes userFolderKey */ 3:
          message.userFolderKey = reader.bytes();
          break;
        case /* Records.RecordKeyType keyType */ 4:
          message.keyType = reader.int32();
          break;
        case /* int64 revision */ 5:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes data */ 6:
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
    /* bytes folderUid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes parentUid = 2; */
    if (message.parentUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.parentUid);
    /* bytes userFolderKey = 3; */
    if (message.userFolderKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.userFolderKey);
    /* Records.RecordKeyType keyType = 4; */
    if (message.keyType !== 0) writer.tag(4, WireType.Varint).int32(message.keyType);
    /* int64 revision = 5; */
    if (message.revision !== 0n) writer.tag(5, WireType.Varint).int64(message.revision);
    /* bytes data = 6; */
    if (message.data.length) writer.tag(6, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.UserFolder
 */
export const UserFolder = new UserFolder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolder$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolder", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "sharedFolderKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "keyType", kind: "enum", T: () => ["Records.RecordKeyType", RecordKeyType] },
      { no: 5, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "defaultManageRecords", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "defaultManageUsers", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "defaultCanEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 9, name: "defaultCanReshare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 10, name: "cacheStatus", kind: "enum", T: () => ["Vault.CacheStatus", CacheStatus] },
      { no: 11, name: "owner", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 12, name: "ownerAccountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 13, name: "name", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.revision = 0n;
    message.sharedFolderKey = new Uint8Array(0);
    message.keyType = 0;
    message.data = new Uint8Array(0);
    message.defaultManageRecords = false;
    message.defaultManageUsers = false;
    message.defaultCanEdit = false;
    message.defaultCanReshare = false;
    message.cacheStatus = 0;
    message.owner = "";
    message.ownerAccountUid = new Uint8Array(0);
    message.name = new Uint8Array(0);
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
        case /* int64 revision */ 2:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes sharedFolderKey */ 3:
          message.sharedFolderKey = reader.bytes();
          break;
        case /* Records.RecordKeyType keyType */ 4:
          message.keyType = reader.int32();
          break;
        case /* bytes data */ 5:
          message.data = reader.bytes();
          break;
        case /* bool defaultManageRecords */ 6:
          message.defaultManageRecords = reader.bool();
          break;
        case /* bool defaultManageUsers */ 7:
          message.defaultManageUsers = reader.bool();
          break;
        case /* bool defaultCanEdit */ 8:
          message.defaultCanEdit = reader.bool();
          break;
        case /* bool defaultCanReshare */ 9:
          message.defaultCanReshare = reader.bool();
          break;
        case /* Vault.CacheStatus cacheStatus */ 10:
          message.cacheStatus = reader.int32();
          break;
        case /* string owner */ 11:
          message.owner = reader.string();
          break;
        case /* bytes ownerAccountUid */ 12:
          message.ownerAccountUid = reader.bytes();
          break;
        case /* bytes name */ 13:
          message.name = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    /* bytes sharedFolderKey = 3; */
    if (message.sharedFolderKey.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.sharedFolderKey);
    /* Records.RecordKeyType keyType = 4; */
    if (message.keyType !== 0) writer.tag(4, WireType.Varint).int32(message.keyType);
    /* bytes data = 5; */
    if (message.data.length) writer.tag(5, WireType.LengthDelimited).bytes(message.data);
    /* bool defaultManageRecords = 6; */
    if (message.defaultManageRecords !== false)
      writer.tag(6, WireType.Varint).bool(message.defaultManageRecords);
    /* bool defaultManageUsers = 7; */
    if (message.defaultManageUsers !== false)
      writer.tag(7, WireType.Varint).bool(message.defaultManageUsers);
    /* bool defaultCanEdit = 8; */
    if (message.defaultCanEdit !== false)
      writer.tag(8, WireType.Varint).bool(message.defaultCanEdit);
    /* bool defaultCanReshare = 9; */
    if (message.defaultCanReshare !== false)
      writer.tag(9, WireType.Varint).bool(message.defaultCanReshare);
    /* Vault.CacheStatus cacheStatus = 10; */
    if (message.cacheStatus !== 0) writer.tag(10, WireType.Varint).int32(message.cacheStatus);
    /* string owner = 11; */
    if (message.owner !== "") writer.tag(11, WireType.LengthDelimited).string(message.owner);
    /* bytes ownerAccountUid = 12; */
    if (message.ownerAccountUid.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.ownerAccountUid);
    /* bytes name = 13; */
    if (message.name.length) writer.tag(13, WireType.LengthDelimited).bytes(message.name);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolder
 */
export const SharedFolder = new SharedFolder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserFolderSharedFolder$Type extends MessageType {
  constructor() {
    super("Vault.UserFolderSharedFolder", [
      { no: 1, name: "folderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
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
    message.folderUid = new Uint8Array(0);
    message.sharedFolderUid = new Uint8Array(0);
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
        case /* bytes folderUid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes sharedFolderUid */ 2:
          message.sharedFolderUid = reader.bytes();
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
    /* bytes folderUid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes sharedFolderUid = 2; */
    if (message.sharedFolderUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.UserFolderSharedFolder
 */
export const UserFolderSharedFolder = new UserFolderSharedFolder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderFolder$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderFolder", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "folderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "parentUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "sharedFolderFolderKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 5, name: "keyType", kind: "enum", T: () => ["Records.RecordKeyType", RecordKeyType] },
      {
        no: 6,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 7, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.folderUid = new Uint8Array(0);
    message.parentUid = new Uint8Array(0);
    message.sharedFolderFolderKey = new Uint8Array(0);
    message.keyType = 0;
    message.revision = 0n;
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
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* bytes folderUid */ 2:
          message.folderUid = reader.bytes();
          break;
        case /* bytes parentUid */ 3:
          message.parentUid = reader.bytes();
          break;
        case /* bytes sharedFolderFolderKey */ 4:
          message.sharedFolderFolderKey = reader.bytes();
          break;
        case /* Records.RecordKeyType keyType */ 5:
          message.keyType = reader.int32();
          break;
        case /* int64 revision */ 6:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes data */ 7:
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* bytes folderUid = 2; */
    if (message.folderUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes parentUid = 3; */
    if (message.parentUid.length) writer.tag(3, WireType.LengthDelimited).bytes(message.parentUid);
    /* bytes sharedFolderFolderKey = 4; */
    if (message.sharedFolderFolderKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.sharedFolderFolderKey);
    /* Records.RecordKeyType keyType = 5; */
    if (message.keyType !== 0) writer.tag(5, WireType.Varint).int32(message.keyType);
    /* int64 revision = 6; */
    if (message.revision !== 0n) writer.tag(6, WireType.Varint).int64(message.revision);
    /* bytes data = 7; */
    if (message.data.length) writer.tag(7, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderFolder
 */
export const SharedFolderFolder = new SharedFolderFolder$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderKey$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderKey", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "sharedFolderKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "keyType", kind: "enum", T: () => ["Records.RecordKeyType", RecordKeyType] },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.sharedFolderKey = new Uint8Array(0);
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
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* bytes sharedFolderKey */ 2:
          message.sharedFolderKey = reader.bytes();
          break;
        case /* Records.RecordKeyType keyType */ 3:
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* bytes sharedFolderKey = 2; */
    if (message.sharedFolderKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.sharedFolderKey);
    /* Records.RecordKeyType keyType = 3; */
    if (message.keyType !== 0) writer.tag(3, WireType.Varint).int32(message.keyType);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderKey
 */
export const SharedFolderKey = new SharedFolderKey$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Team$Type extends MessageType {
  constructor() {
    super("Vault.Team", [
      { no: 1, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "teamKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "teamKeyType",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
      { no: 5, name: "teamPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "restrictEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "restrictShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 8, name: "restrictView", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 9,
        name: "removedSharedFolders",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      {
        no: 10,
        name: "sharedFolderKeys",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => SharedFolderKey,
      },
      { no: 11, name: "teamEccPrivateKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 12, name: "teamEccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.teamUid = new Uint8Array(0);
    message.name = "";
    message.teamKey = new Uint8Array(0);
    message.teamKeyType = 0;
    message.teamPrivateKey = new Uint8Array(0);
    message.restrictEdit = false;
    message.restrictShare = false;
    message.restrictView = false;
    message.removedSharedFolders = [];
    message.sharedFolderKeys = [];
    message.teamEccPrivateKey = new Uint8Array(0);
    message.teamEccPublicKey = new Uint8Array(0);
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
        case /* bytes teamKey */ 3:
          message.teamKey = reader.bytes();
          break;
        case /* Records.RecordKeyType teamKeyType */ 4:
          message.teamKeyType = reader.int32();
          break;
        case /* bytes teamPrivateKey */ 5:
          message.teamPrivateKey = reader.bytes();
          break;
        case /* bool restrictEdit */ 6:
          message.restrictEdit = reader.bool();
          break;
        case /* bool restrictShare */ 7:
          message.restrictShare = reader.bool();
          break;
        case /* bool restrictView */ 8:
          message.restrictView = reader.bool();
          break;
        case /* repeated bytes removedSharedFolders */ 9:
          message.removedSharedFolders.push(reader.bytes());
          break;
        case /* repeated Vault.SharedFolderKey sharedFolderKeys */ 10:
          message.sharedFolderKeys.push(
            SharedFolderKey.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* bytes teamEccPrivateKey */ 11:
          message.teamEccPrivateKey = reader.bytes();
          break;
        case /* bytes teamEccPublicKey */ 12:
          message.teamEccPublicKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes teamKey = 3; */
    if (message.teamKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.teamKey);
    /* Records.RecordKeyType teamKeyType = 4; */
    if (message.teamKeyType !== 0) writer.tag(4, WireType.Varint).int32(message.teamKeyType);
    /* bytes teamPrivateKey = 5; */
    if (message.teamPrivateKey.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.teamPrivateKey);
    /* bool restrictEdit = 6; */
    if (message.restrictEdit !== false) writer.tag(6, WireType.Varint).bool(message.restrictEdit);
    /* bool restrictShare = 7; */
    if (message.restrictShare !== false) writer.tag(7, WireType.Varint).bool(message.restrictShare);
    /* bool restrictView = 8; */
    if (message.restrictView !== false) writer.tag(8, WireType.Varint).bool(message.restrictView);
    /* repeated bytes removedSharedFolders = 9; */
    for (let i = 0; i < message.removedSharedFolders.length; i++)
      writer.tag(9, WireType.LengthDelimited).bytes(message.removedSharedFolders[i]);
    /* repeated Vault.SharedFolderKey sharedFolderKeys = 10; */
    for (let i = 0; i < message.sharedFolderKeys.length; i++)
      SharedFolderKey.internalBinaryWrite(
        message.sharedFolderKeys[i],
        writer.tag(10, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* bytes teamEccPrivateKey = 11; */
    if (message.teamEccPrivateKey.length)
      writer.tag(11, WireType.LengthDelimited).bytes(message.teamEccPrivateKey);
    /* bytes teamEccPublicKey = 12; */
    if (message.teamEccPublicKey.length)
      writer.tag(12, WireType.LengthDelimited).bytes(message.teamEccPublicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.Team
 */
export const Team = new Team$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Record$Type extends MessageType {
  constructor() {
    super("Vault.Record", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "version", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 4, name: "shared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 5,
        name: "clientModifiedTime",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 7, name: "extra", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 8, name: "udata", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 9,
        name: "fileSize",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 10,
        name: "thumbnailSize",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.revision = 0n;
    message.version = 0;
    message.shared = false;
    message.clientModifiedTime = 0n;
    message.data = new Uint8Array(0);
    message.extra = new Uint8Array(0);
    message.udata = "";
    message.fileSize = 0n;
    message.thumbnailSize = 0n;
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
        case /* int64 revision */ 2:
          message.revision = reader.int64().toBigInt();
          break;
        case /* int32 version */ 3:
          message.version = reader.int32();
          break;
        case /* bool shared */ 4:
          message.shared = reader.bool();
          break;
        case /* int64 clientModifiedTime */ 5:
          message.clientModifiedTime = reader.int64().toBigInt();
          break;
        case /* bytes data */ 6:
          message.data = reader.bytes();
          break;
        case /* bytes extra */ 7:
          message.extra = reader.bytes();
          break;
        case /* string udata */ 8:
          message.udata = reader.string();
          break;
        case /* int64 fileSize */ 9:
          message.fileSize = reader.int64().toBigInt();
          break;
        case /* int64 thumbnailSize */ 10:
          message.thumbnailSize = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    /* int32 version = 3; */
    if (message.version !== 0) writer.tag(3, WireType.Varint).int32(message.version);
    /* bool shared = 4; */
    if (message.shared !== false) writer.tag(4, WireType.Varint).bool(message.shared);
    /* int64 clientModifiedTime = 5; */
    if (message.clientModifiedTime !== 0n)
      writer.tag(5, WireType.Varint).int64(message.clientModifiedTime);
    /* bytes data = 6; */
    if (message.data.length) writer.tag(6, WireType.LengthDelimited).bytes(message.data);
    /* bytes extra = 7; */
    if (message.extra.length) writer.tag(7, WireType.LengthDelimited).bytes(message.extra);
    /* string udata = 8; */
    if (message.udata !== "") writer.tag(8, WireType.LengthDelimited).string(message.udata);
    /* int64 fileSize = 9; */
    if (message.fileSize !== 0n) writer.tag(9, WireType.Varint).int64(message.fileSize);
    /* int64 thumbnailSize = 10; */
    if (message.thumbnailSize !== 0n) writer.tag(10, WireType.Varint).int64(message.thumbnailSize);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.Record
 */
export const Record = new Record$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordLink$Type extends MessageType {
  constructor() {
    super("Vault.RecordLink", [
      { no: 1, name: "parentRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "childRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.parentRecordUid = new Uint8Array(0);
    message.childRecordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
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
        case /* bytes parentRecordUid */ 1:
          message.parentRecordUid = reader.bytes();
          break;
        case /* bytes childRecordUid */ 2:
          message.childRecordUid = reader.bytes();
          break;
        case /* bytes recordKey */ 3:
          message.recordKey = reader.bytes();
          break;
        case /* int64 revision */ 4:
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
    /* bytes parentRecordUid = 1; */
    if (message.parentRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.parentRecordUid);
    /* bytes childRecordUid = 2; */
    if (message.childRecordUid.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.childRecordUid);
    /* bytes recordKey = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    /* int64 revision = 4; */
    if (message.revision !== 0n) writer.tag(4, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.RecordLink
 */
export const RecordLink = new RecordLink$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserFolderRecord$Type extends MessageType {
  constructor() {
    super("Vault.UserFolderRecord", [
      { no: 1, name: "folderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
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
    message.folderUid = new Uint8Array(0);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes folderUid */ 1:
          message.folderUid = reader.bytes();
          break;
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
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
    /* bytes folderUid = 1; */
    if (message.folderUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.UserFolderRecord
 */
export const UserFolderRecord = new UserFolderRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderFolderRecord$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderFolderRecord", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "folderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.folderUid = new Uint8Array(0);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes sharedFolderUid */ 1:
          message.sharedFolderUid = reader.bytes();
          break;
        case /* bytes folderUid */ 2:
          message.folderUid = reader.bytes();
          break;
        case /* bytes recordUid */ 3:
          message.recordUid = reader.bytes();
          break;
        case /* int64 revision */ 4:
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
    /* bytes sharedFolderUid = 1; */
    if (message.sharedFolderUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.sharedFolderUid);
    /* bytes folderUid = 2; */
    if (message.folderUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.folderUid);
    /* bytes recordUid = 3; */
    if (message.recordUid.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 revision = 4; */
    if (message.revision !== 0n) writer.tag(4, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderFolderRecord
 */
export const SharedFolderFolderRecord = new SharedFolderFolderRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class NonSharedData$Type extends MessageType {
  constructor() {
    super("Vault.NonSharedData", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes data = 2; */
    if (message.data.length) writer.tag(2, WireType.LengthDelimited).bytes(message.data);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.NonSharedData
 */
export const NonSharedData = new NonSharedData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordMetaData$Type extends MessageType {
  constructor() {
    super("Vault.RecordMetaData", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "owner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 3, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 4,
        name: "recordKeyType",
        kind: "enum",
        T: () => ["Records.RecordKeyType", RecordKeyType],
      },
      { no: 5, name: "canShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "canEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "ownerAccountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 8,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 9,
        name: "expirationNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 10, name: "ownerUsername", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.owner = false;
    message.recordKey = new Uint8Array(0);
    message.recordKeyType = 0;
    message.canShare = false;
    message.canEdit = false;
    message.ownerAccountUid = new Uint8Array(0);
    message.expiration = 0n;
    message.expirationNotificationType = 0;
    message.ownerUsername = "";
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
        case /* bytes recordKey */ 3:
          message.recordKey = reader.bytes();
          break;
        case /* Records.RecordKeyType recordKeyType */ 4:
          message.recordKeyType = reader.int32();
          break;
        case /* bool canShare */ 5:
          message.canShare = reader.bool();
          break;
        case /* bool canEdit */ 6:
          message.canEdit = reader.bool();
          break;
        case /* bytes ownerAccountUid */ 7:
          message.ownerAccountUid = reader.bytes();
          break;
        case /* int64 expiration */ 8:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType expirationNotificationType */ 9:
          message.expirationNotificationType = reader.int32();
          break;
        case /* string ownerUsername */ 10:
          message.ownerUsername = reader.string();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes recordKey = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    /* Records.RecordKeyType recordKeyType = 4; */
    if (message.recordKeyType !== 0) writer.tag(4, WireType.Varint).int32(message.recordKeyType);
    /* bool canShare = 5; */
    if (message.canShare !== false) writer.tag(5, WireType.Varint).bool(message.canShare);
    /* bool canEdit = 6; */
    if (message.canEdit !== false) writer.tag(6, WireType.Varint).bool(message.canEdit);
    /* bytes ownerAccountUid = 7; */
    if (message.ownerAccountUid.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.ownerAccountUid);
    /* int64 expiration = 8; */
    if (message.expiration !== 0n) writer.tag(8, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType expirationNotificationType = 9; */
    if (message.expirationNotificationType !== 0)
      writer.tag(9, WireType.Varint).int32(message.expirationNotificationType);
    /* string ownerUsername = 10; */
    if (message.ownerUsername !== "")
      writer.tag(10, WireType.LengthDelimited).string(message.ownerUsername);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.RecordMetaData
 */
export const RecordMetaData = new RecordMetaData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharingChange$Type extends MessageType {
  constructor() {
    super("Vault.SharingChange", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "shared", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* bool shared = 2; */
    if (message.shared !== false) writer.tag(2, WireType.Varint).bool(message.shared);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharingChange
 */
export const SharingChange = new SharingChange$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Profile$Type extends MessageType {
  constructor() {
    super("Vault.Profile", [
      { no: 1, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "profileName", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
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
    message.data = new Uint8Array(0);
    message.profileName = "";
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
        case /* bytes data */ 1:
          message.data = reader.bytes();
          break;
        case /* string profileName */ 2:
          message.profileName = reader.string();
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
    /* bytes data = 1; */
    if (message.data.length) writer.tag(1, WireType.LengthDelimited).bytes(message.data);
    /* string profileName = 2; */
    if (message.profileName !== "")
      writer.tag(2, WireType.LengthDelimited).string(message.profileName);
    /* int64 revision = 3; */
    if (message.revision !== 0n) writer.tag(3, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.Profile
 */
export const Profile = new Profile$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ProfilePic$Type extends MessageType {
  constructor() {
    super("Vault.ProfilePic", [
      { no: 1, name: "url", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
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
    message.url = "";
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
        case /* string url */ 1:
          message.url = reader.string();
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
    /* string url = 1; */
    if (message.url !== "") writer.tag(1, WireType.LengthDelimited).string(message.url);
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.ProfilePic
 */
export const ProfilePic = new ProfilePic$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PendingTeamMember$Type extends MessageType {
  constructor() {
    super("Vault.PendingTeamMember", [
      {
        no: 1,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 2, name: "userPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "teamUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
      { no: 4, name: "userEccPublicKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.enterpriseUserId = 0n;
    message.userPublicKey = new Uint8Array(0);
    message.teamUids = [];
    message.userEccPublicKey = new Uint8Array(0);
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
        case /* bytes userPublicKey */ 2:
          message.userPublicKey = reader.bytes();
          break;
        case /* repeated bytes teamUids */ 3:
          message.teamUids.push(reader.bytes());
          break;
        case /* bytes userEccPublicKey */ 4:
          message.userEccPublicKey = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes userPublicKey = 2; */
    if (message.userPublicKey.length)
      writer.tag(2, WireType.LengthDelimited).bytes(message.userPublicKey);
    /* repeated bytes teamUids = 3; */
    for (let i = 0; i < message.teamUids.length; i++)
      writer.tag(3, WireType.LengthDelimited).bytes(message.teamUids[i]);
    /* bytes userEccPublicKey = 4; */
    if (message.userEccPublicKey.length)
      writer.tag(4, WireType.LengthDelimited).bytes(message.userEccPublicKey);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.PendingTeamMember
 */
export const PendingTeamMember = new PendingTeamMember$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchRecord$Type extends MessageType {
  constructor() {
    super("Vault.BreachWatchRecord", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "data", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 3,
        name: "type",
        kind: "enum",
        T: () => ["BreachWatch.BreachWatchInfoType", BreachWatchInfoType],
      },
      { no: 4, name: "scannedBy", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      {
        no: 5,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 6, name: "scannedByAccountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.data = new Uint8Array(0);
    message.type = 0;
    message.scannedBy = "";
    message.revision = 0n;
    message.scannedByAccountUid = new Uint8Array(0);
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
        case /* bytes data */ 2:
          message.data = reader.bytes();
          break;
        case /* BreachWatch.BreachWatchInfoType type */ 3:
          message.type = reader.int32();
          break;
        case /* string scannedBy */ 4:
          message.scannedBy = reader.string();
          break;
        case /* int64 revision */ 5:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes scannedByAccountUid */ 6:
          message.scannedByAccountUid = reader.bytes();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* bytes data = 2; */
    if (message.data.length) writer.tag(2, WireType.LengthDelimited).bytes(message.data);
    /* BreachWatch.BreachWatchInfoType type = 3; */
    if (message.type !== 0) writer.tag(3, WireType.Varint).int32(message.type);
    /* string scannedBy = 4; */
    if (message.scannedBy !== "") writer.tag(4, WireType.LengthDelimited).string(message.scannedBy);
    /* int64 revision = 5; */
    if (message.revision !== 0n) writer.tag(5, WireType.Varint).int64(message.revision);
    /* bytes scannedByAccountUid = 6; */
    if (message.scannedByAccountUid.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.scannedByAccountUid);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.BreachWatchRecord
 */
export const BreachWatchRecord = new BreachWatchRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class UserAuth$Type extends MessageType {
  constructor() {
    super("Vault.UserAuth", [
      { no: 1, name: "uid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "loginType", kind: "enum", T: () => ["Authentication.LoginType", LoginType] },
      { no: 3, name: "deleted", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "iterations", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      { no: 5, name: "salt", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "encryptedClientKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 7,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 8, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.uid = new Uint8Array(0);
    message.loginType = 0;
    message.deleted = false;
    message.iterations = 0;
    message.salt = new Uint8Array(0);
    message.encryptedClientKey = new Uint8Array(0);
    message.revision = 0n;
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
        case /* bytes uid */ 1:
          message.uid = reader.bytes();
          break;
        case /* Authentication.LoginType loginType */ 2:
          message.loginType = reader.int32();
          break;
        case /* bool deleted */ 3:
          message.deleted = reader.bool();
          break;
        case /* int32 iterations */ 4:
          message.iterations = reader.int32();
          break;
        case /* bytes salt */ 5:
          message.salt = reader.bytes();
          break;
        case /* bytes encryptedClientKey */ 6:
          message.encryptedClientKey = reader.bytes();
          break;
        case /* int64 revision */ 7:
          message.revision = reader.int64().toBigInt();
          break;
        case /* string name */ 8:
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
    /* bytes uid = 1; */
    if (message.uid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.uid);
    /* Authentication.LoginType loginType = 2; */
    if (message.loginType !== 0) writer.tag(2, WireType.Varint).int32(message.loginType);
    /* bool deleted = 3; */
    if (message.deleted !== false) writer.tag(3, WireType.Varint).bool(message.deleted);
    /* int32 iterations = 4; */
    if (message.iterations !== 0) writer.tag(4, WireType.Varint).int32(message.iterations);
    /* bytes salt = 5; */
    if (message.salt.length) writer.tag(5, WireType.LengthDelimited).bytes(message.salt);
    /* bytes encryptedClientKey = 6; */
    if (message.encryptedClientKey.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.encryptedClientKey);
    /* int64 revision = 7; */
    if (message.revision !== 0n) writer.tag(7, WireType.Varint).int64(message.revision);
    /* string name = 8; */
    if (message.name !== "") writer.tag(8, WireType.LengthDelimited).string(message.name);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.UserAuth
 */
export const UserAuth = new UserAuth$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchSecurityData$Type extends MessageType {
  constructor() {
    super("Vault.BreachWatchSecurityData", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
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
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.BreachWatchSecurityData
 */
export const BreachWatchSecurityData = new BreachWatchSecurityData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ReusedPasswords$Type extends MessageType {
  constructor() {
    super("Vault.ReusedPasswords", [
      { no: 1, name: "count", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
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
    message.count = 0;
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
        case /* int32 count */ 1:
          message.count = reader.int32();
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
    /* int32 count = 1; */
    if (message.count !== 0) writer.tag(1, WireType.Varint).int32(message.count);
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.ReusedPasswords
 */
export const ReusedPasswords = new ReusedPasswords$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderRecord$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderRecord", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "recordKey", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "canShare", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "canEdit", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 6, name: "ownerAccountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 7,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 8, name: "owner", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 9,
        name: "expirationNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 10, name: "ownerUsername", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 11, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.recordUid = new Uint8Array(0);
    message.recordKey = new Uint8Array(0);
    message.canShare = false;
    message.canEdit = false;
    message.ownerAccountUid = new Uint8Array(0);
    message.expiration = 0n;
    message.owner = false;
    message.expirationNotificationType = 0;
    message.ownerUsername = "";
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
        case /* bytes recordUid */ 2:
          message.recordUid = reader.bytes();
          break;
        case /* bytes recordKey */ 3:
          message.recordKey = reader.bytes();
          break;
        case /* bool canShare */ 4:
          message.canShare = reader.bool();
          break;
        case /* bool canEdit */ 5:
          message.canEdit = reader.bool();
          break;
        case /* bytes ownerAccountUid */ 6:
          message.ownerAccountUid = reader.bytes();
          break;
        case /* int64 expiration */ 7:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* bool owner */ 8:
          message.owner = reader.bool();
          break;
        case /* Records.TimerNotificationType expirationNotificationType */ 9:
          message.expirationNotificationType = reader.int32();
          break;
        case /* string ownerUsername */ 10:
          message.ownerUsername = reader.string();
          break;
        case /* bool rotateOnExpiration */ 11:
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
    /* bytes recordUid = 2; */
    if (message.recordUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.recordUid);
    /* bytes recordKey = 3; */
    if (message.recordKey.length) writer.tag(3, WireType.LengthDelimited).bytes(message.recordKey);
    /* bool canShare = 4; */
    if (message.canShare !== false) writer.tag(4, WireType.Varint).bool(message.canShare);
    /* bool canEdit = 5; */
    if (message.canEdit !== false) writer.tag(5, WireType.Varint).bool(message.canEdit);
    /* bytes ownerAccountUid = 6; */
    if (message.ownerAccountUid.length)
      writer.tag(6, WireType.LengthDelimited).bytes(message.ownerAccountUid);
    /* int64 expiration = 7; */
    if (message.expiration !== 0n) writer.tag(7, WireType.Varint).int64(message.expiration);
    /* bool owner = 8; */
    if (message.owner !== false) writer.tag(8, WireType.Varint).bool(message.owner);
    /* Records.TimerNotificationType expirationNotificationType = 9; */
    if (message.expirationNotificationType !== 0)
      writer.tag(9, WireType.Varint).int32(message.expirationNotificationType);
    /* string ownerUsername = 10; */
    if (message.ownerUsername !== "")
      writer.tag(10, WireType.LengthDelimited).string(message.ownerUsername);
    /* bool rotateOnExpiration = 11; */
    if (message.rotateOnExpiration !== false)
      writer.tag(11, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderRecord
 */
export const SharedFolderRecord = new SharedFolderRecord$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderUser$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderUser", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 3, name: "manageRecords", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 4, name: "manageUsers", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 6,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 7,
        name: "expirationNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 8, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.username = "";
    message.manageRecords = false;
    message.manageUsers = false;
    message.accountUid = new Uint8Array(0);
    message.expiration = 0n;
    message.expirationNotificationType = 0;
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
        case /* string username */ 2:
          message.username = reader.string();
          break;
        case /* bool manageRecords */ 3:
          message.manageRecords = reader.bool();
          break;
        case /* bool manageUsers */ 4:
          message.manageUsers = reader.bool();
          break;
        case /* bytes accountUid */ 5:
          message.accountUid = reader.bytes();
          break;
        case /* int64 expiration */ 6:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType expirationNotificationType */ 7:
          message.expirationNotificationType = reader.int32();
          break;
        case /* bool rotateOnExpiration */ 8:
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
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    /* bool manageRecords = 3; */
    if (message.manageRecords !== false) writer.tag(3, WireType.Varint).bool(message.manageRecords);
    /* bool manageUsers = 4; */
    if (message.manageUsers !== false) writer.tag(4, WireType.Varint).bool(message.manageUsers);
    /* bytes accountUid = 5; */
    if (message.accountUid.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.accountUid);
    /* int64 expiration = 6; */
    if (message.expiration !== 0n) writer.tag(6, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType expirationNotificationType = 7; */
    if (message.expirationNotificationType !== 0)
      writer.tag(7, WireType.Varint).int32(message.expirationNotificationType);
    /* bool rotateOnExpiration = 8; */
    if (message.rotateOnExpiration !== false)
      writer.tag(8, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderUser
 */
export const SharedFolderUser = new SharedFolderUser$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SharedFolderTeam$Type extends MessageType {
  constructor() {
    super("Vault.SharedFolderTeam", [
      { no: 1, name: "sharedFolderUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "teamUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 4, name: "manageRecords", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 5, name: "manageUsers", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 6,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 7,
        name: "expirationNotificationType",
        kind: "enum",
        T: () => ["Records.TimerNotificationType", TimerNotificationType],
      },
      { no: 8, name: "rotateOnExpiration", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.sharedFolderUid = new Uint8Array(0);
    message.teamUid = new Uint8Array(0);
    message.name = "";
    message.manageRecords = false;
    message.manageUsers = false;
    message.expiration = 0n;
    message.expirationNotificationType = 0;
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
        case /* bytes teamUid */ 2:
          message.teamUid = reader.bytes();
          break;
        case /* string name */ 3:
          message.name = reader.string();
          break;
        case /* bool manageRecords */ 4:
          message.manageRecords = reader.bool();
          break;
        case /* bool manageUsers */ 5:
          message.manageUsers = reader.bool();
          break;
        case /* int64 expiration */ 6:
          message.expiration = reader.int64().toBigInt();
          break;
        case /* Records.TimerNotificationType expirationNotificationType */ 7:
          message.expirationNotificationType = reader.int32();
          break;
        case /* bool rotateOnExpiration */ 8:
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
    /* bytes teamUid = 2; */
    if (message.teamUid.length) writer.tag(2, WireType.LengthDelimited).bytes(message.teamUid);
    /* string name = 3; */
    if (message.name !== "") writer.tag(3, WireType.LengthDelimited).string(message.name);
    /* bool manageRecords = 4; */
    if (message.manageRecords !== false) writer.tag(4, WireType.Varint).bool(message.manageRecords);
    /* bool manageUsers = 5; */
    if (message.manageUsers !== false) writer.tag(5, WireType.Varint).bool(message.manageUsers);
    /* int64 expiration = 6; */
    if (message.expiration !== 0n) writer.tag(6, WireType.Varint).int64(message.expiration);
    /* Records.TimerNotificationType expirationNotificationType = 7; */
    if (message.expirationNotificationType !== 0)
      writer.tag(7, WireType.Varint).int32(message.expirationNotificationType);
    /* bool rotateOnExpiration = 8; */
    if (message.rotateOnExpiration !== false)
      writer.tag(8, WireType.Varint).bool(message.rotateOnExpiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SharedFolderTeam
 */
export const SharedFolderTeam = new SharedFolderTeam$Type();
// @generated message type with reflection information, may provide speed optimized methods
class KsmChange$Type extends MessageType {
  constructor() {
    super("Vault.KsmChange", [
      { no: 1, name: "appRecordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "detailId", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 3, name: "removed", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      {
        no: 4,
        name: "appClientType",
        kind: "enum",
        T: () => ["Enterprise.AppClientType", AppClientType],
      },
      {
        no: 5,
        name: "expiration",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.appRecordUid = new Uint8Array(0);
    message.detailId = new Uint8Array(0);
    message.removed = false;
    message.appClientType = 0;
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
        case /* bytes appRecordUid */ 1:
          message.appRecordUid = reader.bytes();
          break;
        case /* bytes detailId */ 2:
          message.detailId = reader.bytes();
          break;
        case /* bool removed */ 3:
          message.removed = reader.bool();
          break;
        case /* Enterprise.AppClientType appClientType */ 4:
          message.appClientType = reader.int32();
          break;
        case /* int64 expiration */ 5:
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
    /* bytes appRecordUid = 1; */
    if (message.appRecordUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.appRecordUid);
    /* bytes detailId = 2; */
    if (message.detailId.length) writer.tag(2, WireType.LengthDelimited).bytes(message.detailId);
    /* bool removed = 3; */
    if (message.removed !== false) writer.tag(3, WireType.Varint).bool(message.removed);
    /* Enterprise.AppClientType appClientType = 4; */
    if (message.appClientType !== 0) writer.tag(4, WireType.Varint).int32(message.appClientType);
    /* int64 expiration = 5; */
    if (message.expiration !== 0n) writer.tag(5, WireType.Varint).int64(message.expiration);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.KsmChange
 */
export const KsmChange = new KsmChange$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ShareInvitation$Type extends MessageType {
  constructor() {
    super("Vault.ShareInvitation", [
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
 * @generated MessageType for protobuf message Vault.ShareInvitation
 */
export const ShareInvitation = new ShareInvitation$Type();
// @generated message type with reflection information, may provide speed optimized methods
class User$Type extends MessageType {
  constructor() {
    super("Vault.User", [
      { no: 1, name: "accountUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "username", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.accountUid = new Uint8Array(0);
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
        case /* bytes accountUid */ 1:
          message.accountUid = reader.bytes();
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
    /* bytes accountUid = 1; */
    if (message.accountUid.length)
      writer.tag(1, WireType.LengthDelimited).bytes(message.accountUid);
    /* string username = 2; */
    if (message.username !== "") writer.tag(2, WireType.LengthDelimited).string(message.username);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.User
 */
export const User = new User$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SyncDiagnostics$Type extends MessageType {
  constructor() {
    super("Vault.SyncDiagnostics", [
      { no: 1, name: "continuationToken", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 2, name: "userId", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
      {
        no: 3,
        name: "enterpriseUserId",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 4,
        name: "syncedTo",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 5,
        name: "syncingTo",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.continuationToken = new Uint8Array(0);
    message.userId = 0;
    message.enterpriseUserId = 0n;
    message.syncedTo = 0n;
    message.syncingTo = 0n;
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
        case /* int32 userId */ 2:
          message.userId = reader.int32();
          break;
        case /* int64 enterpriseUserId */ 3:
          message.enterpriseUserId = reader.int64().toBigInt();
          break;
        case /* int64 syncedTo */ 4:
          message.syncedTo = reader.int64().toBigInt();
          break;
        case /* int64 syncingTo */ 5:
          message.syncingTo = reader.int64().toBigInt();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int32 userId = 2; */
    if (message.userId !== 0) writer.tag(2, WireType.Varint).int32(message.userId);
    /* int64 enterpriseUserId = 3; */
    if (message.enterpriseUserId !== 0n)
      writer.tag(3, WireType.Varint).int64(message.enterpriseUserId);
    /* int64 syncedTo = 4; */
    if (message.syncedTo !== 0n) writer.tag(4, WireType.Varint).int64(message.syncedTo);
    /* int64 syncingTo = 5; */
    if (message.syncingTo !== 0n) writer.tag(5, WireType.Varint).int64(message.syncingTo);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.SyncDiagnostics
 */
export const SyncDiagnostics = new SyncDiagnostics$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecordRotation$Type extends MessageType {
  constructor() {
    super("Vault.RecordRotation", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 2,
        name: "revision",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      { no: 3, name: "configurationUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 4, name: "schedule", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
      { no: 5, name: "pwdComplexity", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      { no: 6, name: "disabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
      { no: 7, name: "resourceUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
      {
        no: 8,
        name: "lastRotation",
        kind: "scalar",
        T: 3 /*ScalarType.INT64*/,
        L: 0 /*LongType.BIGINT*/,
      },
      {
        no: 9,
        name: "lastRotationStatus",
        kind: "enum",
        T: () => ["Vault.RecordRotationStatus", RecordRotationStatus],
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.recordUid = new Uint8Array(0);
    message.revision = 0n;
    message.configurationUid = new Uint8Array(0);
    message.schedule = "";
    message.pwdComplexity = new Uint8Array(0);
    message.disabled = false;
    message.resourceUid = new Uint8Array(0);
    message.lastRotation = 0n;
    message.lastRotationStatus = 0;
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
        case /* int64 revision */ 2:
          message.revision = reader.int64().toBigInt();
          break;
        case /* bytes configurationUid */ 3:
          message.configurationUid = reader.bytes();
          break;
        case /* string schedule */ 4:
          message.schedule = reader.string();
          break;
        case /* bytes pwdComplexity */ 5:
          message.pwdComplexity = reader.bytes();
          break;
        case /* bool disabled */ 6:
          message.disabled = reader.bool();
          break;
        case /* bytes resourceUid */ 7:
          message.resourceUid = reader.bytes();
          break;
        case /* int64 lastRotation */ 8:
          message.lastRotation = reader.int64().toBigInt();
          break;
        case /* Vault.RecordRotationStatus lastRotationStatus */ 9:
          message.lastRotationStatus = reader.int32();
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
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
    /* int64 revision = 2; */
    if (message.revision !== 0n) writer.tag(2, WireType.Varint).int64(message.revision);
    /* bytes configurationUid = 3; */
    if (message.configurationUid.length)
      writer.tag(3, WireType.LengthDelimited).bytes(message.configurationUid);
    /* string schedule = 4; */
    if (message.schedule !== "") writer.tag(4, WireType.LengthDelimited).string(message.schedule);
    /* bytes pwdComplexity = 5; */
    if (message.pwdComplexity.length)
      writer.tag(5, WireType.LengthDelimited).bytes(message.pwdComplexity);
    /* bool disabled = 6; */
    if (message.disabled !== false) writer.tag(6, WireType.Varint).bool(message.disabled);
    /* bytes resourceUid = 7; */
    if (message.resourceUid.length)
      writer.tag(7, WireType.LengthDelimited).bytes(message.resourceUid);
    /* int64 lastRotation = 8; */
    if (message.lastRotation !== 0n) writer.tag(8, WireType.Varint).int64(message.lastRotation);
    /* Vault.RecordRotationStatus lastRotationStatus = 9; */
    if (message.lastRotationStatus !== 0)
      writer.tag(9, WireType.Varint).int32(message.lastRotationStatus);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.RecordRotation
 */
export const RecordRotation = new RecordRotation$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SecurityScoreData$Type extends MessageType {
  constructor() {
    super("Vault.SecurityScoreData", [
      { no: 1, name: "recordUid", kind: "scalar", T: 12 /*ScalarType.BYTES*/ },
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
    message.recordUid = new Uint8Array(0);
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
        case /* bytes recordUid */ 1:
          message.recordUid = reader.bytes();
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
    /* bytes recordUid = 1; */
    if (message.recordUid.length) writer.tag(1, WireType.LengthDelimited).bytes(message.recordUid);
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
 * @generated MessageType for protobuf message Vault.SecurityScoreData
 */
export const SecurityScoreData = new SecurityScoreData$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchGetSyncDataRequest$Type extends MessageType {
  constructor() {
    super("Vault.BreachWatchGetSyncDataRequest", [
      {
        no: 1,
        name: "recordUids",
        kind: "scalar",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: 12 /*ScalarType.BYTES*/,
      },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
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
        case /* repeated bytes recordUids */ 1:
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
    /* repeated bytes recordUids = 1; */
    for (let i = 0; i < message.recordUids.length; i++)
      writer.tag(1, WireType.LengthDelimited).bytes(message.recordUids[i]);
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.BreachWatchGetSyncDataRequest
 */
export const BreachWatchGetSyncDataRequest = new BreachWatchGetSyncDataRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class BreachWatchGetSyncDataResponse$Type extends MessageType {
  constructor() {
    super("Vault.BreachWatchGetSyncDataResponse", [
      {
        no: 1,
        name: "breachWatchRecords",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchRecord,
      },
      {
        no: 2,
        name: "breachWatchSecurityData",
        kind: "message",
        repeat: 2 /*RepeatType.UNPACKED*/,
        T: () => BreachWatchSecurityData,
      },
      { no: 3, name: "users", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => User },
    ]);
  }
  create(value) {
    const message = globalThis.Object.create(this.messagePrototype);
    message.breachWatchRecords = [];
    message.breachWatchSecurityData = [];
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
        case /* repeated Vault.BreachWatchRecord breachWatchRecords */ 1:
          message.breachWatchRecords.push(
            BreachWatchRecord.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.BreachWatchSecurityData breachWatchSecurityData */ 2:
          message.breachWatchSecurityData.push(
            BreachWatchSecurityData.internalBinaryRead(reader, reader.uint32(), options),
          );
          break;
        case /* repeated Vault.User users */ 3:
          message.users.push(User.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Vault.BreachWatchRecord breachWatchRecords = 1; */
    for (let i = 0; i < message.breachWatchRecords.length; i++)
      BreachWatchRecord.internalBinaryWrite(
        message.breachWatchRecords[i],
        writer.tag(1, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.BreachWatchSecurityData breachWatchSecurityData = 2; */
    for (let i = 0; i < message.breachWatchSecurityData.length; i++)
      BreachWatchSecurityData.internalBinaryWrite(
        message.breachWatchSecurityData[i],
        writer.tag(2, WireType.LengthDelimited).fork(),
        options,
      ).join();
    /* repeated Vault.User users = 3; */
    for (let i = 0; i < message.users.length; i++)
      User.internalBinaryWrite(
        message.users[i],
        writer.tag(3, WireType.LengthDelimited).fork(),
        options,
      ).join();
    let u = options.writeUnknownFields;
    if (u !== false) (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
    return writer;
  }
}
/**
 * @generated MessageType for protobuf message Vault.BreachWatchGetSyncDataResponse
 */
export const BreachWatchGetSyncDataResponse = new BreachWatchGetSyncDataResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class GetAccountUidMapResponse$Type extends MessageType {
  constructor() {
    super("Vault.GetAccountUidMapResponse", [
      { no: 1, name: "users", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => User },
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
        case /* repeated Vault.User users */ 1:
          message.users.push(User.internalBinaryRead(reader, reader.uint32(), options));
          break;
        default:
          let u = options.readUnknownField;
          if (u === "throw")
            throw new globalThis.Error(
              `Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
            );
          let d = reader.skip(wireType);
          if (u !== false)
            (u === true ? UnknownFieldHandler.onRead : u)(
              this.typeName,
              message,
              fieldNo,
              wireType,
              d,
            );
      }
    }
    return message;
  }
  internalBinaryWrite(message, writer, options) {
    /* repeated Vault.User users = 1; */
    for (let i = 0; i < message.users.length; i++)
      User.internalBinaryWrite(
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
 * @generated MessageType for protobuf message Vault.GetAccountUidMapResponse
 */
export const GetAccountUidMapResponse = new GetAccountUidMapResponse$Type();
