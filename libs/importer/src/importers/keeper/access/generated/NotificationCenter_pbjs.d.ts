// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace NotificationCenter. */
export namespace NotificationCenter {
  /** NotificationCategory enum. */
  enum NotificationCategory {
    NC_UNSPECIFIED = 0,
    NC_ACCOUNT = 1,
    NC_SHARING = 2,
    NC_ENTERPRISE = 3,
    NC_SECURITY = 4,
    NC_REQUEST = 5,
    NC_SYSTEM = 6,
    NC_PROMOTION = 7,
  }

  /** NotificationType enum. */
  enum NotificationType {
    NT_UNSPECIFIED = 0,
    NT_ALERT = 1,
    NT_DEVICE_APPROVAL = 2,
    NT_MASTER_PASS_UPDATED = 3,
    NT_SHARE_APPROVAL = 4,
    NT_SHARE_APPROVAL_APPROVED = 5,
    NT_SHARED = 6,
    NT_TRANSFERRED = 7,
    NT_LICENSE_LIMIT_REACHED = 8,
    NT_APPROVAL_REQUEST = 9,
    NT_APPROVED_RESPONSE = 10,
    NT_DENIED_RESPONSE = 11,
    NT_2FA_CONFIGURED = 12,
    NT_SHARE_APPROVAL_DENIED = 13,
  }

  /** NotificationReadStatus enum. */
  enum NotificationReadStatus {
    NRS_UNSPECIFIED = 0,
    NRS_LAST = 1,
    NRS_READ = 2,
    NRS_UNREAD = 3,
  }

  /** NotificationApprovalStatus enum. */
  enum NotificationApprovalStatus {
    NAS_UNSPECIFIED = 0,
    NAS_APPROVED = 1,
    NAS_DENIED = 2,
    NAS_LOST_APPROVAL_RIGHTS = 3,
    NAS_LOST_ACCESS = 4,
  }

  /** Properties of an EncryptedData. */
  interface IEncryptedData {
    /** EncryptedData version */
    version?: number | null;

    /** EncryptedData data */
    data?: Uint8Array | null;
  }

  /** Represents an EncryptedData. */
  class EncryptedData implements IEncryptedData {
    /**
     * Constructs a new EncryptedData.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.IEncryptedData);

    /** EncryptedData version. */
    public version: number;

    /** EncryptedData data. */
    public data: Uint8Array;

    /**
     * Creates a new EncryptedData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EncryptedData instance
     */
    public static create(
      properties?: NotificationCenter.IEncryptedData,
    ): NotificationCenter.EncryptedData;

    /**
     * Encodes the specified EncryptedData message. Does not implicitly {@link NotificationCenter.EncryptedData.verify|verify} messages.
     * @param message EncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.IEncryptedData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EncryptedData message, length delimited. Does not implicitly {@link NotificationCenter.EncryptedData.verify|verify} messages.
     * @param message EncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.IEncryptedData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EncryptedData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.EncryptedData;

    /**
     * Decodes an EncryptedData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.EncryptedData;

    /**
     * Verifies an EncryptedData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EncryptedData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EncryptedData
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.EncryptedData;

    /**
     * Creates a plain object from an EncryptedData message. Also converts values to other types if specified.
     * @param message EncryptedData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.EncryptedData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EncryptedData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EncryptedData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Notification. */
  interface INotification {
    /** Notification type */
    type?: NotificationCenter.NotificationType | null;

    /** Notification category */
    category?: NotificationCenter.NotificationCategory | null;

    /** Notification sender */
    sender?: GraphSync.IGraphSyncRef | null;

    /** Notification senderFullName */
    senderFullName?: string | null;

    /** Notification encryptedData */
    encryptedData?: NotificationCenter.IEncryptedData | null;

    /** Notification refs */
    refs?: GraphSync.IGraphSyncRef[] | null;

    /** Notification categories */
    categories?: NotificationCenter.NotificationCategory[] | null;
  }

  /** Represents a Notification. */
  class Notification implements INotification {
    /**
     * Constructs a new Notification.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotification);

    /** Notification type. */
    public type: NotificationCenter.NotificationType;

    /** Notification category. */
    public category: NotificationCenter.NotificationCategory;

    /** Notification sender. */
    public sender?: GraphSync.IGraphSyncRef | null;

    /** Notification senderFullName. */
    public senderFullName: string;

    /** Notification encryptedData. */
    public encryptedData?: NotificationCenter.IEncryptedData | null;

    /** Notification refs. */
    public refs: GraphSync.IGraphSyncRef[];

    /** Notification categories. */
    public categories: NotificationCenter.NotificationCategory[];

    /**
     * Creates a new Notification instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Notification instance
     */
    public static create(
      properties?: NotificationCenter.INotification,
    ): NotificationCenter.Notification;

    /**
     * Encodes the specified Notification message. Does not implicitly {@link NotificationCenter.Notification.verify|verify} messages.
     * @param message Notification message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotification,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Notification message, length delimited. Does not implicitly {@link NotificationCenter.Notification.verify|verify} messages.
     * @param message Notification message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotification,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Notification message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Notification
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.Notification;

    /**
     * Decodes a Notification message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Notification
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.Notification;

    /**
     * Verifies a Notification message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Notification message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Notification
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.Notification;

    /**
     * Creates a plain object from a Notification message. Also converts values to other types if specified.
     * @param message Notification
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.Notification,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Notification to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Notification
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationReadMark. */
  interface INotificationReadMark {
    /** NotificationReadMark uid */
    uid?: Uint8Array | null;

    /** NotificationReadMark notificationEdgeId */
    notificationEdgeId?: number | Long | null;

    /** NotificationReadMark markEdgeId */
    markEdgeId?: number | Long | null;

    /** NotificationReadMark readStatus */
    readStatus?: NotificationCenter.NotificationReadStatus | null;
  }

  /** Represents a NotificationReadMark. */
  class NotificationReadMark implements INotificationReadMark {
    /**
     * Constructs a new NotificationReadMark.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationReadMark);

    /** NotificationReadMark uid. */
    public uid: Uint8Array;

    /** NotificationReadMark notificationEdgeId. */
    public notificationEdgeId: number | Long;

    /** NotificationReadMark markEdgeId. */
    public markEdgeId: number | Long;

    /** NotificationReadMark readStatus. */
    public readStatus: NotificationCenter.NotificationReadStatus;

    /**
     * Creates a new NotificationReadMark instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationReadMark instance
     */
    public static create(
      properties?: NotificationCenter.INotificationReadMark,
    ): NotificationCenter.NotificationReadMark;

    /**
     * Encodes the specified NotificationReadMark message. Does not implicitly {@link NotificationCenter.NotificationReadMark.verify|verify} messages.
     * @param message NotificationReadMark message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationReadMark,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationReadMark message, length delimited. Does not implicitly {@link NotificationCenter.NotificationReadMark.verify|verify} messages.
     * @param message NotificationReadMark message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationReadMark,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationReadMark message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationReadMark
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationReadMark;

    /**
     * Decodes a NotificationReadMark message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationReadMark
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationReadMark;

    /**
     * Verifies a NotificationReadMark message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationReadMark message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationReadMark
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.NotificationReadMark;

    /**
     * Creates a plain object from a NotificationReadMark message. Also converts values to other types if specified.
     * @param message NotificationReadMark
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationReadMark,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationReadMark to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationReadMark
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationContent. */
  interface INotificationContent {
    /** NotificationContent notification */
    notification?: NotificationCenter.INotification | null;

    /** NotificationContent readStatus */
    readStatus?: NotificationCenter.NotificationReadStatus | null;

    /** NotificationContent approvalStatus */
    approvalStatus?: NotificationCenter.NotificationApprovalStatus | null;

    /** NotificationContent trimmingPoint */
    trimmingPoint?: boolean | null;

    /** NotificationContent clientTypeIDs */
    clientTypeIDs?: number[] | null;

    /** NotificationContent deviceIDs */
    deviceIDs?: (number | Long)[] | null;
  }

  /** Represents a NotificationContent. */
  class NotificationContent implements INotificationContent {
    /**
     * Constructs a new NotificationContent.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationContent);

    /** NotificationContent notification. */
    public notification?: NotificationCenter.INotification | null;

    /** NotificationContent readStatus. */
    public readStatus?: NotificationCenter.NotificationReadStatus | null;

    /** NotificationContent approvalStatus. */
    public approvalStatus?: NotificationCenter.NotificationApprovalStatus | null;

    /** NotificationContent trimmingPoint. */
    public trimmingPoint?: boolean | null;

    /** NotificationContent clientTypeIDs. */
    public clientTypeIDs: number[];

    /** NotificationContent deviceIDs. */
    public deviceIDs: (number | Long)[];

    /** NotificationContent type. */
    public type?: "notification" | "readStatus" | "approvalStatus" | "trimmingPoint";

    /**
     * Creates a new NotificationContent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationContent instance
     */
    public static create(
      properties?: NotificationCenter.INotificationContent,
    ): NotificationCenter.NotificationContent;

    /**
     * Encodes the specified NotificationContent message. Does not implicitly {@link NotificationCenter.NotificationContent.verify|verify} messages.
     * @param message NotificationContent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationContent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationContent message, length delimited. Does not implicitly {@link NotificationCenter.NotificationContent.verify|verify} messages.
     * @param message NotificationContent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationContent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationContent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationContent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationContent;

    /**
     * Decodes a NotificationContent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationContent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationContent;

    /**
     * Verifies a NotificationContent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationContent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationContent
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.NotificationContent;

    /**
     * Creates a plain object from a NotificationContent message. Also converts values to other types if specified.
     * @param message NotificationContent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationContent,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationContent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationContent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationWrapper. */
  interface INotificationWrapper {
    /** NotificationWrapper uid */
    uid?: Uint8Array | null;

    /** NotificationWrapper content */
    content?: NotificationCenter.INotificationContent | null;

    /** NotificationWrapper timestamp */
    timestamp?: number | Long | null;
  }

  /** Represents a NotificationWrapper. */
  class NotificationWrapper implements INotificationWrapper {
    /**
     * Constructs a new NotificationWrapper.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationWrapper);

    /** NotificationWrapper uid. */
    public uid: Uint8Array;

    /** NotificationWrapper content. */
    public content?: NotificationCenter.INotificationContent | null;

    /** NotificationWrapper timestamp. */
    public timestamp: number | Long;

    /**
     * Creates a new NotificationWrapper instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationWrapper instance
     */
    public static create(
      properties?: NotificationCenter.INotificationWrapper,
    ): NotificationCenter.NotificationWrapper;

    /**
     * Encodes the specified NotificationWrapper message. Does not implicitly {@link NotificationCenter.NotificationWrapper.verify|verify} messages.
     * @param message NotificationWrapper message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationWrapper,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationWrapper message, length delimited. Does not implicitly {@link NotificationCenter.NotificationWrapper.verify|verify} messages.
     * @param message NotificationWrapper message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationWrapper,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationWrapper message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationWrapper
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationWrapper;

    /**
     * Decodes a NotificationWrapper message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationWrapper
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationWrapper;

    /**
     * Verifies a NotificationWrapper message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationWrapper message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationWrapper
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.NotificationWrapper;

    /**
     * Creates a plain object from a NotificationWrapper message. Also converts values to other types if specified.
     * @param message NotificationWrapper
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationWrapper,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationWrapper to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationWrapper
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationSync. */
  interface INotificationSync {
    /** NotificationSync data */
    data?: NotificationCenter.INotificationWrapper[] | null;

    /** NotificationSync syncPoint */
    syncPoint?: number | Long | null;

    /** NotificationSync hasMore */
    hasMore?: boolean | null;
  }

  /** Represents a NotificationSync. */
  class NotificationSync implements INotificationSync {
    /**
     * Constructs a new NotificationSync.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationSync);

    /** NotificationSync data. */
    public data: NotificationCenter.INotificationWrapper[];

    /** NotificationSync syncPoint. */
    public syncPoint: number | Long;

    /** NotificationSync hasMore. */
    public hasMore: boolean;

    /**
     * Creates a new NotificationSync instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationSync instance
     */
    public static create(
      properties?: NotificationCenter.INotificationSync,
    ): NotificationCenter.NotificationSync;

    /**
     * Encodes the specified NotificationSync message. Does not implicitly {@link NotificationCenter.NotificationSync.verify|verify} messages.
     * @param message NotificationSync message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationSync,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationSync message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSync.verify|verify} messages.
     * @param message NotificationSync message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationSync,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationSync message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationSync
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationSync;

    /**
     * Decodes a NotificationSync message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationSync
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationSync;

    /**
     * Verifies a NotificationSync message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationSync message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationSync
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.NotificationSync;

    /**
     * Creates a plain object from a NotificationSync message. Also converts values to other types if specified.
     * @param message NotificationSync
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationSync,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationSync to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationSync
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ReadStatusUpdate. */
  interface IReadStatusUpdate {
    /** ReadStatusUpdate notificationUid */
    notificationUid?: Uint8Array | null;

    /** ReadStatusUpdate status */
    status?: NotificationCenter.NotificationReadStatus | null;
  }

  /** Represents a ReadStatusUpdate. */
  class ReadStatusUpdate implements IReadStatusUpdate {
    /**
     * Constructs a new ReadStatusUpdate.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.IReadStatusUpdate);

    /** ReadStatusUpdate notificationUid. */
    public notificationUid: Uint8Array;

    /** ReadStatusUpdate status. */
    public status: NotificationCenter.NotificationReadStatus;

    /**
     * Creates a new ReadStatusUpdate instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ReadStatusUpdate instance
     */
    public static create(
      properties?: NotificationCenter.IReadStatusUpdate,
    ): NotificationCenter.ReadStatusUpdate;

    /**
     * Encodes the specified ReadStatusUpdate message. Does not implicitly {@link NotificationCenter.ReadStatusUpdate.verify|verify} messages.
     * @param message ReadStatusUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.IReadStatusUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ReadStatusUpdate message, length delimited. Does not implicitly {@link NotificationCenter.ReadStatusUpdate.verify|verify} messages.
     * @param message ReadStatusUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.IReadStatusUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ReadStatusUpdate message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ReadStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.ReadStatusUpdate;

    /**
     * Decodes a ReadStatusUpdate message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ReadStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.ReadStatusUpdate;

    /**
     * Verifies a ReadStatusUpdate message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ReadStatusUpdate message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ReadStatusUpdate
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.ReadStatusUpdate;

    /**
     * Creates a plain object from a ReadStatusUpdate message. Also converts values to other types if specified.
     * @param message ReadStatusUpdate
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.ReadStatusUpdate,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ReadStatusUpdate to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ReadStatusUpdate
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ApprovalStatusUpdate. */
  interface IApprovalStatusUpdate {
    /** ApprovalStatusUpdate notificationUid */
    notificationUid?: Uint8Array | null;

    /** ApprovalStatusUpdate status */
    status?: NotificationCenter.NotificationApprovalStatus | null;
  }

  /** Represents an ApprovalStatusUpdate. */
  class ApprovalStatusUpdate implements IApprovalStatusUpdate {
    /**
     * Constructs a new ApprovalStatusUpdate.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.IApprovalStatusUpdate);

    /** ApprovalStatusUpdate notificationUid. */
    public notificationUid: Uint8Array;

    /** ApprovalStatusUpdate status. */
    public status: NotificationCenter.NotificationApprovalStatus;

    /**
     * Creates a new ApprovalStatusUpdate instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ApprovalStatusUpdate instance
     */
    public static create(
      properties?: NotificationCenter.IApprovalStatusUpdate,
    ): NotificationCenter.ApprovalStatusUpdate;

    /**
     * Encodes the specified ApprovalStatusUpdate message. Does not implicitly {@link NotificationCenter.ApprovalStatusUpdate.verify|verify} messages.
     * @param message ApprovalStatusUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.IApprovalStatusUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ApprovalStatusUpdate message, length delimited. Does not implicitly {@link NotificationCenter.ApprovalStatusUpdate.verify|verify} messages.
     * @param message ApprovalStatusUpdate message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.IApprovalStatusUpdate,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ApprovalStatusUpdate message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ApprovalStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.ApprovalStatusUpdate;

    /**
     * Decodes an ApprovalStatusUpdate message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ApprovalStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.ApprovalStatusUpdate;

    /**
     * Verifies an ApprovalStatusUpdate message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ApprovalStatusUpdate message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ApprovalStatusUpdate
     */
    public static fromObject(object: { [k: string]: any }): NotificationCenter.ApprovalStatusUpdate;

    /**
     * Creates a plain object from an ApprovalStatusUpdate message. Also converts values to other types if specified.
     * @param message ApprovalStatusUpdate
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.ApprovalStatusUpdate,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ApprovalStatusUpdate to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ApprovalStatusUpdate
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ProcessMarkReadEventsRequest. */
  interface IProcessMarkReadEventsRequest {
    /** ProcessMarkReadEventsRequest readStatusUpdate */
    readStatusUpdate?: NotificationCenter.IReadStatusUpdate[] | null;
  }

  /** Represents a ProcessMarkReadEventsRequest. */
  class ProcessMarkReadEventsRequest implements IProcessMarkReadEventsRequest {
    /**
     * Constructs a new ProcessMarkReadEventsRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.IProcessMarkReadEventsRequest);

    /** ProcessMarkReadEventsRequest readStatusUpdate. */
    public readStatusUpdate: NotificationCenter.IReadStatusUpdate[];

    /**
     * Creates a new ProcessMarkReadEventsRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ProcessMarkReadEventsRequest instance
     */
    public static create(
      properties?: NotificationCenter.IProcessMarkReadEventsRequest,
    ): NotificationCenter.ProcessMarkReadEventsRequest;

    /**
     * Encodes the specified ProcessMarkReadEventsRequest message. Does not implicitly {@link NotificationCenter.ProcessMarkReadEventsRequest.verify|verify} messages.
     * @param message ProcessMarkReadEventsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.IProcessMarkReadEventsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ProcessMarkReadEventsRequest message, length delimited. Does not implicitly {@link NotificationCenter.ProcessMarkReadEventsRequest.verify|verify} messages.
     * @param message ProcessMarkReadEventsRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.IProcessMarkReadEventsRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ProcessMarkReadEventsRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProcessMarkReadEventsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.ProcessMarkReadEventsRequest;

    /**
     * Decodes a ProcessMarkReadEventsRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ProcessMarkReadEventsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.ProcessMarkReadEventsRequest;

    /**
     * Verifies a ProcessMarkReadEventsRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ProcessMarkReadEventsRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ProcessMarkReadEventsRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): NotificationCenter.ProcessMarkReadEventsRequest;

    /**
     * Creates a plain object from a ProcessMarkReadEventsRequest message. Also converts values to other types if specified.
     * @param message ProcessMarkReadEventsRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.ProcessMarkReadEventsRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ProcessMarkReadEventsRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ProcessMarkReadEventsRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationSendRequest. */
  interface INotificationSendRequest {
    /** NotificationSendRequest recipients */
    recipients?: GraphSync.IGraphSyncRef[] | null;

    /** NotificationSendRequest notification */
    notification?: NotificationCenter.INotification | null;

    /** NotificationSendRequest clientTypeIDs */
    clientTypeIDs?: number[] | null;

    /** NotificationSendRequest deviceIDs */
    deviceIDs?: (number | Long)[] | null;
  }

  /** Represents a NotificationSendRequest. */
  class NotificationSendRequest implements INotificationSendRequest {
    /**
     * Constructs a new NotificationSendRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationSendRequest);

    /** NotificationSendRequest recipients. */
    public recipients: GraphSync.IGraphSyncRef[];

    /** NotificationSendRequest notification. */
    public notification?: NotificationCenter.INotification | null;

    /** NotificationSendRequest clientTypeIDs. */
    public clientTypeIDs: number[];

    /** NotificationSendRequest deviceIDs. */
    public deviceIDs: (number | Long)[];

    /**
     * Creates a new NotificationSendRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationSendRequest instance
     */
    public static create(
      properties?: NotificationCenter.INotificationSendRequest,
    ): NotificationCenter.NotificationSendRequest;

    /**
     * Encodes the specified NotificationSendRequest message. Does not implicitly {@link NotificationCenter.NotificationSendRequest.verify|verify} messages.
     * @param message NotificationSendRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationSendRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationSendRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSendRequest.verify|verify} messages.
     * @param message NotificationSendRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationSendRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationSendRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationSendRequest;

    /**
     * Decodes a NotificationSendRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationSendRequest;

    /**
     * Verifies a NotificationSendRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationSendRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationSendRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): NotificationCenter.NotificationSendRequest;

    /**
     * Creates a plain object from a NotificationSendRequest message. Also converts values to other types if specified.
     * @param message NotificationSendRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationSendRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationSendRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationSendRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationsSendRequest. */
  interface INotificationsSendRequest {
    /** NotificationsSendRequest notifications */
    notifications?: NotificationCenter.INotificationSendRequest[] | null;
  }

  /** Represents a NotificationsSendRequest. */
  class NotificationsSendRequest implements INotificationsSendRequest {
    /**
     * Constructs a new NotificationsSendRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationsSendRequest);

    /** NotificationsSendRequest notifications. */
    public notifications: NotificationCenter.INotificationSendRequest[];

    /**
     * Creates a new NotificationsSendRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationsSendRequest instance
     */
    public static create(
      properties?: NotificationCenter.INotificationsSendRequest,
    ): NotificationCenter.NotificationsSendRequest;

    /**
     * Encodes the specified NotificationsSendRequest message. Does not implicitly {@link NotificationCenter.NotificationsSendRequest.verify|verify} messages.
     * @param message NotificationsSendRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationsSendRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationsSendRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationsSendRequest.verify|verify} messages.
     * @param message NotificationsSendRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationsSendRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationsSendRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationsSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationsSendRequest;

    /**
     * Decodes a NotificationsSendRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationsSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationsSendRequest;

    /**
     * Verifies a NotificationsSendRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationsSendRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationsSendRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): NotificationCenter.NotificationsSendRequest;

    /**
     * Creates a plain object from a NotificationsSendRequest message. Also converts values to other types if specified.
     * @param message NotificationsSendRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationsSendRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationsSendRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationsSendRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a NotificationSyncRequest. */
  interface INotificationSyncRequest {
    /** NotificationSyncRequest syncPoint */
    syncPoint?: number | Long | null;
  }

  /** Represents a NotificationSyncRequest. */
  class NotificationSyncRequest implements INotificationSyncRequest {
    /**
     * Constructs a new NotificationSyncRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: NotificationCenter.INotificationSyncRequest);

    /** NotificationSyncRequest syncPoint. */
    public syncPoint: number | Long;

    /**
     * Creates a new NotificationSyncRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NotificationSyncRequest instance
     */
    public static create(
      properties?: NotificationCenter.INotificationSyncRequest,
    ): NotificationCenter.NotificationSyncRequest;

    /**
     * Encodes the specified NotificationSyncRequest message. Does not implicitly {@link NotificationCenter.NotificationSyncRequest.verify|verify} messages.
     * @param message NotificationSyncRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: NotificationCenter.INotificationSyncRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified NotificationSyncRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSyncRequest.verify|verify} messages.
     * @param message NotificationSyncRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: NotificationCenter.INotificationSyncRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a NotificationSyncRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NotificationSyncRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): NotificationCenter.NotificationSyncRequest;

    /**
     * Decodes a NotificationSyncRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NotificationSyncRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): NotificationCenter.NotificationSyncRequest;

    /**
     * Verifies a NotificationSyncRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a NotificationSyncRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NotificationSyncRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): NotificationCenter.NotificationSyncRequest;

    /**
     * Creates a plain object from a NotificationSyncRequest message. Also converts values to other types if specified.
     * @param message NotificationSyncRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: NotificationCenter.NotificationSyncRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this NotificationSyncRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NotificationSyncRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}

/** Namespace GraphSync. */
export namespace GraphSync {
  /** RefType enum. */
  enum RefType {
    RFT_GENERAL = 0,
    RFT_USER = 1,
    RFT_DEVICE = 2,
    RFT_REC = 3,
    RFT_FOLDER = 4,
    RFT_TEAM = 5,
    RFT_ENTERPRISE = 6,
    RFT_PAM_DIRECTORY = 7,
    RFT_PAM_MACHINE = 8,
    RFT_PAM_DATABASE = 9,
    RFT_PAM_USER = 10,
    RFT_PAM_NETWORK = 11,
    RFT_PAM_BROWSER = 12,
    RFT_CONNECTION = 13,
    RFT_WORKFLOW = 14,
    RFT_NOTIFICATION = 15,
    RFT_USER_INFO = 16,
    RFT_TEAM_INFO = 17,
    RFT_ROLE = 18,
  }

  /** GraphSyncDataType enum. */
  enum GraphSyncDataType {
    GSE_DATA = 0,
    GSE_KEY = 1,
    GSE_LINK = 2,
    GSE_ACL = 3,
    GSE_DELETION = 4,
  }

  /** GraphSyncActorType enum. */
  enum GraphSyncActorType {
    GSA_USER = 0,
    GSA_SERVICE = 1,
    GSA_PAM_GATEWAY = 2,
  }

  /** Properties of a GraphSyncRef. */
  interface IGraphSyncRef {
    /** GraphSyncRef type */
    type?: GraphSync.RefType | null;

    /** GraphSyncRef value */
    value?: Uint8Array | null;

    /** GraphSyncRef name */
    name?: string | null;
  }

  /** Represents a GraphSyncRef. */
  class GraphSyncRef implements IGraphSyncRef {
    /**
     * Constructs a new GraphSyncRef.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncRef);

    /** GraphSyncRef type. */
    public type: GraphSync.RefType;

    /** GraphSyncRef value. */
    public value: Uint8Array;

    /** GraphSyncRef name. */
    public name: string;

    /**
     * Creates a new GraphSyncRef instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncRef instance
     */
    public static create(properties?: GraphSync.IGraphSyncRef): GraphSync.GraphSyncRef;

    /**
     * Encodes the specified GraphSyncRef message. Does not implicitly {@link GraphSync.GraphSyncRef.verify|verify} messages.
     * @param message GraphSyncRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncRef,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncRef message, length delimited. Does not implicitly {@link GraphSync.GraphSyncRef.verify|verify} messages.
     * @param message GraphSyncRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncRef,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncRef message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncRef;

    /**
     * Decodes a GraphSyncRef message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): GraphSync.GraphSyncRef;

    /**
     * Verifies a GraphSyncRef message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncRef message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncRef
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncRef;

    /**
     * Creates a plain object from a GraphSyncRef message. Also converts values to other types if specified.
     * @param message GraphSyncRef
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncRef,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncRef to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncRef
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncActor. */
  interface IGraphSyncActor {
    /** GraphSyncActor type */
    type?: GraphSync.GraphSyncActorType | null;

    /** GraphSyncActor id */
    id?: Uint8Array | null;

    /** GraphSyncActor name */
    name?: string | null;

    /** GraphSyncActor effectiveUserId */
    effectiveUserId?: Uint8Array | null;
  }

  /** Represents a GraphSyncActor. */
  class GraphSyncActor implements IGraphSyncActor {
    /**
     * Constructs a new GraphSyncActor.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncActor);

    /** GraphSyncActor type. */
    public type: GraphSync.GraphSyncActorType;

    /** GraphSyncActor id. */
    public id: Uint8Array;

    /** GraphSyncActor name. */
    public name: string;

    /** GraphSyncActor effectiveUserId. */
    public effectiveUserId: Uint8Array;

    /**
     * Creates a new GraphSyncActor instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncActor instance
     */
    public static create(properties?: GraphSync.IGraphSyncActor): GraphSync.GraphSyncActor;

    /**
     * Encodes the specified GraphSyncActor message. Does not implicitly {@link GraphSync.GraphSyncActor.verify|verify} messages.
     * @param message GraphSyncActor message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncActor,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncActor message, length delimited. Does not implicitly {@link GraphSync.GraphSyncActor.verify|verify} messages.
     * @param message GraphSyncActor message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncActor,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncActor message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncActor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncActor;

    /**
     * Decodes a GraphSyncActor message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncActor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): GraphSync.GraphSyncActor;

    /**
     * Verifies a GraphSyncActor message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncActor message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncActor
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncActor;

    /**
     * Creates a plain object from a GraphSyncActor message. Also converts values to other types if specified.
     * @param message GraphSyncActor
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncActor,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncActor to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncActor
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncData. */
  interface IGraphSyncData {
    /** GraphSyncData type */
    type?: GraphSync.GraphSyncDataType | null;

    /** GraphSyncData ref */
    ref?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncData parentRef */
    parentRef?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncData content */
    content?: Uint8Array | null;

    /** GraphSyncData path */
    path?: string | null;
  }

  /** Represents a GraphSyncData. */
  class GraphSyncData implements IGraphSyncData {
    /**
     * Constructs a new GraphSyncData.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncData);

    /** GraphSyncData type. */
    public type: GraphSync.GraphSyncDataType;

    /** GraphSyncData ref. */
    public ref?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncData parentRef. */
    public parentRef?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncData content. */
    public content: Uint8Array;

    /** GraphSyncData path. */
    public path: string;

    /**
     * Creates a new GraphSyncData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncData instance
     */
    public static create(properties?: GraphSync.IGraphSyncData): GraphSync.GraphSyncData;

    /**
     * Encodes the specified GraphSyncData message. Does not implicitly {@link GraphSync.GraphSyncData.verify|verify} messages.
     * @param message GraphSyncData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncData message, length delimited. Does not implicitly {@link GraphSync.GraphSyncData.verify|verify} messages.
     * @param message GraphSyncData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncData;

    /**
     * Decodes a GraphSyncData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): GraphSync.GraphSyncData;

    /**
     * Verifies a GraphSyncData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncData
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncData;

    /**
     * Creates a plain object from a GraphSyncData message. Also converts values to other types if specified.
     * @param message GraphSyncData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncData,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncDataPlus. */
  interface IGraphSyncDataPlus {
    /** GraphSyncDataPlus data */
    data?: GraphSync.IGraphSyncData | null;

    /** GraphSyncDataPlus timestamp */
    timestamp?: number | Long | null;

    /** GraphSyncDataPlus actor */
    actor?: GraphSync.IGraphSyncActor | null;
  }

  /** Represents a GraphSyncDataPlus. */
  class GraphSyncDataPlus implements IGraphSyncDataPlus {
    /**
     * Constructs a new GraphSyncDataPlus.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncDataPlus);

    /** GraphSyncDataPlus data. */
    public data?: GraphSync.IGraphSyncData | null;

    /** GraphSyncDataPlus timestamp. */
    public timestamp: number | Long;

    /** GraphSyncDataPlus actor. */
    public actor?: GraphSync.IGraphSyncActor | null;

    /**
     * Creates a new GraphSyncDataPlus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncDataPlus instance
     */
    public static create(properties?: GraphSync.IGraphSyncDataPlus): GraphSync.GraphSyncDataPlus;

    /**
     * Encodes the specified GraphSyncDataPlus message. Does not implicitly {@link GraphSync.GraphSyncDataPlus.verify|verify} messages.
     * @param message GraphSyncDataPlus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncDataPlus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncDataPlus message, length delimited. Does not implicitly {@link GraphSync.GraphSyncDataPlus.verify|verify} messages.
     * @param message GraphSyncDataPlus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncDataPlus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncDataPlus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncDataPlus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncDataPlus;

    /**
     * Decodes a GraphSyncDataPlus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncDataPlus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncDataPlus;

    /**
     * Verifies a GraphSyncDataPlus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncDataPlus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncDataPlus
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncDataPlus;

    /**
     * Creates a plain object from a GraphSyncDataPlus message. Also converts values to other types if specified.
     * @param message GraphSyncDataPlus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncDataPlus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncDataPlus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncDataPlus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncQuery. */
  interface IGraphSyncQuery {
    /** GraphSyncQuery streamId */
    streamId?: Uint8Array | null;

    /** GraphSyncQuery origin */
    origin?: Uint8Array | null;

    /** GraphSyncQuery syncPoint */
    syncPoint?: number | Long | null;

    /** GraphSyncQuery maxCount */
    maxCount?: number | null;
  }

  /** Represents a GraphSyncQuery. */
  class GraphSyncQuery implements IGraphSyncQuery {
    /**
     * Constructs a new GraphSyncQuery.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncQuery);

    /** GraphSyncQuery streamId. */
    public streamId: Uint8Array;

    /** GraphSyncQuery origin. */
    public origin: Uint8Array;

    /** GraphSyncQuery syncPoint. */
    public syncPoint: number | Long;

    /** GraphSyncQuery maxCount. */
    public maxCount: number;

    /**
     * Creates a new GraphSyncQuery instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncQuery instance
     */
    public static create(properties?: GraphSync.IGraphSyncQuery): GraphSync.GraphSyncQuery;

    /**
     * Encodes the specified GraphSyncQuery message. Does not implicitly {@link GraphSync.GraphSyncQuery.verify|verify} messages.
     * @param message GraphSyncQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncQuery.verify|verify} messages.
     * @param message GraphSyncQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncQuery message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncQuery;

    /**
     * Decodes a GraphSyncQuery message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): GraphSync.GraphSyncQuery;

    /**
     * Verifies a GraphSyncQuery message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncQuery message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncQuery
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncQuery;

    /**
     * Creates a plain object from a GraphSyncQuery message. Also converts values to other types if specified.
     * @param message GraphSyncQuery
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncQuery,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncQuery to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncQuery
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncResult. */
  interface IGraphSyncResult {
    /** GraphSyncResult streamId */
    streamId?: Uint8Array | null;

    /** GraphSyncResult syncPoint */
    syncPoint?: number | Long | null;

    /** GraphSyncResult data */
    data?: GraphSync.IGraphSyncDataPlus[] | null;

    /** GraphSyncResult hasMore */
    hasMore?: boolean | null;
  }

  /** Represents a GraphSyncResult. */
  class GraphSyncResult implements IGraphSyncResult {
    /**
     * Constructs a new GraphSyncResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncResult);

    /** GraphSyncResult streamId. */
    public streamId: Uint8Array;

    /** GraphSyncResult syncPoint. */
    public syncPoint: number | Long;

    /** GraphSyncResult data. */
    public data: GraphSync.IGraphSyncDataPlus[];

    /** GraphSyncResult hasMore. */
    public hasMore: boolean;

    /**
     * Creates a new GraphSyncResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncResult instance
     */
    public static create(properties?: GraphSync.IGraphSyncResult): GraphSync.GraphSyncResult;

    /**
     * Encodes the specified GraphSyncResult message. Does not implicitly {@link GraphSync.GraphSyncResult.verify|verify} messages.
     * @param message GraphSyncResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncResult.verify|verify} messages.
     * @param message GraphSyncResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncResult;

    /**
     * Decodes a GraphSyncResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): GraphSync.GraphSyncResult;

    /**
     * Verifies a GraphSyncResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncResult
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncResult;

    /**
     * Creates a plain object from a GraphSyncResult message. Also converts values to other types if specified.
     * @param message GraphSyncResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncMultiQuery. */
  interface IGraphSyncMultiQuery {
    /** GraphSyncMultiQuery queries */
    queries?: GraphSync.IGraphSyncQuery[] | null;
  }

  /** Represents a GraphSyncMultiQuery. */
  class GraphSyncMultiQuery implements IGraphSyncMultiQuery {
    /**
     * Constructs a new GraphSyncMultiQuery.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncMultiQuery);

    /** GraphSyncMultiQuery queries. */
    public queries: GraphSync.IGraphSyncQuery[];

    /**
     * Creates a new GraphSyncMultiQuery instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncMultiQuery instance
     */
    public static create(
      properties?: GraphSync.IGraphSyncMultiQuery,
    ): GraphSync.GraphSyncMultiQuery;

    /**
     * Encodes the specified GraphSyncMultiQuery message. Does not implicitly {@link GraphSync.GraphSyncMultiQuery.verify|verify} messages.
     * @param message GraphSyncMultiQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncMultiQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncMultiQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncMultiQuery.verify|verify} messages.
     * @param message GraphSyncMultiQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncMultiQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncMultiQuery message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncMultiQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncMultiQuery;

    /**
     * Decodes a GraphSyncMultiQuery message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncMultiQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncMultiQuery;

    /**
     * Verifies a GraphSyncMultiQuery message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncMultiQuery message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncMultiQuery
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncMultiQuery;

    /**
     * Creates a plain object from a GraphSyncMultiQuery message. Also converts values to other types if specified.
     * @param message GraphSyncMultiQuery
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncMultiQuery,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncMultiQuery to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncMultiQuery
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncMultiResult. */
  interface IGraphSyncMultiResult {
    /** GraphSyncMultiResult results */
    results?: GraphSync.IGraphSyncResult[] | null;
  }

  /** Represents a GraphSyncMultiResult. */
  class GraphSyncMultiResult implements IGraphSyncMultiResult {
    /**
     * Constructs a new GraphSyncMultiResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncMultiResult);

    /** GraphSyncMultiResult results. */
    public results: GraphSync.IGraphSyncResult[];

    /**
     * Creates a new GraphSyncMultiResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncMultiResult instance
     */
    public static create(
      properties?: GraphSync.IGraphSyncMultiResult,
    ): GraphSync.GraphSyncMultiResult;

    /**
     * Encodes the specified GraphSyncMultiResult message. Does not implicitly {@link GraphSync.GraphSyncMultiResult.verify|verify} messages.
     * @param message GraphSyncMultiResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncMultiResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncMultiResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncMultiResult.verify|verify} messages.
     * @param message GraphSyncMultiResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncMultiResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncMultiResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncMultiResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncMultiResult;

    /**
     * Decodes a GraphSyncMultiResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncMultiResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncMultiResult;

    /**
     * Verifies a GraphSyncMultiResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncMultiResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncMultiResult
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncMultiResult;

    /**
     * Creates a plain object from a GraphSyncMultiResult message. Also converts values to other types if specified.
     * @param message GraphSyncMultiResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncMultiResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncMultiResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncMultiResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncAddDataRequest. */
  interface IGraphSyncAddDataRequest {
    /** GraphSyncAddDataRequest origin */
    origin?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncAddDataRequest data */
    data?: GraphSync.IGraphSyncData[] | null;
  }

  /** Represents a GraphSyncAddDataRequest. */
  class GraphSyncAddDataRequest implements IGraphSyncAddDataRequest {
    /**
     * Constructs a new GraphSyncAddDataRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncAddDataRequest);

    /** GraphSyncAddDataRequest origin. */
    public origin?: GraphSync.IGraphSyncRef | null;

    /** GraphSyncAddDataRequest data. */
    public data: GraphSync.IGraphSyncData[];

    /**
     * Creates a new GraphSyncAddDataRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncAddDataRequest instance
     */
    public static create(
      properties?: GraphSync.IGraphSyncAddDataRequest,
    ): GraphSync.GraphSyncAddDataRequest;

    /**
     * Encodes the specified GraphSyncAddDataRequest message. Does not implicitly {@link GraphSync.GraphSyncAddDataRequest.verify|verify} messages.
     * @param message GraphSyncAddDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncAddDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncAddDataRequest message, length delimited. Does not implicitly {@link GraphSync.GraphSyncAddDataRequest.verify|verify} messages.
     * @param message GraphSyncAddDataRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncAddDataRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncAddDataRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncAddDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncAddDataRequest;

    /**
     * Decodes a GraphSyncAddDataRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncAddDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncAddDataRequest;

    /**
     * Verifies a GraphSyncAddDataRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncAddDataRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncAddDataRequest
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncAddDataRequest;

    /**
     * Creates a plain object from a GraphSyncAddDataRequest message. Also converts values to other types if specified.
     * @param message GraphSyncAddDataRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncAddDataRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncAddDataRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncAddDataRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncLeafsQuery. */
  interface IGraphSyncLeafsQuery {
    /** GraphSyncLeafsQuery vertices */
    vertices?: Uint8Array[] | null;
  }

  /** Represents a GraphSyncLeafsQuery. */
  class GraphSyncLeafsQuery implements IGraphSyncLeafsQuery {
    /**
     * Constructs a new GraphSyncLeafsQuery.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncLeafsQuery);

    /** GraphSyncLeafsQuery vertices. */
    public vertices: Uint8Array[];

    /**
     * Creates a new GraphSyncLeafsQuery instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncLeafsQuery instance
     */
    public static create(
      properties?: GraphSync.IGraphSyncLeafsQuery,
    ): GraphSync.GraphSyncLeafsQuery;

    /**
     * Encodes the specified GraphSyncLeafsQuery message. Does not implicitly {@link GraphSync.GraphSyncLeafsQuery.verify|verify} messages.
     * @param message GraphSyncLeafsQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncLeafsQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncLeafsQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncLeafsQuery.verify|verify} messages.
     * @param message GraphSyncLeafsQuery message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncLeafsQuery,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncLeafsQuery message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncLeafsQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncLeafsQuery;

    /**
     * Decodes a GraphSyncLeafsQuery message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncLeafsQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncLeafsQuery;

    /**
     * Verifies a GraphSyncLeafsQuery message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncLeafsQuery message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncLeafsQuery
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncLeafsQuery;

    /**
     * Creates a plain object from a GraphSyncLeafsQuery message. Also converts values to other types if specified.
     * @param message GraphSyncLeafsQuery
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncLeafsQuery,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncLeafsQuery to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncLeafsQuery
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a GraphSyncRefsResult. */
  interface IGraphSyncRefsResult {
    /** GraphSyncRefsResult refs */
    refs?: GraphSync.IGraphSyncRef[] | null;
  }

  /** Represents a GraphSyncRefsResult. */
  class GraphSyncRefsResult implements IGraphSyncRefsResult {
    /**
     * Constructs a new GraphSyncRefsResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: GraphSync.IGraphSyncRefsResult);

    /** GraphSyncRefsResult refs. */
    public refs: GraphSync.IGraphSyncRef[];

    /**
     * Creates a new GraphSyncRefsResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphSyncRefsResult instance
     */
    public static create(
      properties?: GraphSync.IGraphSyncRefsResult,
    ): GraphSync.GraphSyncRefsResult;

    /**
     * Encodes the specified GraphSyncRefsResult message. Does not implicitly {@link GraphSync.GraphSyncRefsResult.verify|verify} messages.
     * @param message GraphSyncRefsResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: GraphSync.IGraphSyncRefsResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GraphSyncRefsResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncRefsResult.verify|verify} messages.
     * @param message GraphSyncRefsResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: GraphSync.IGraphSyncRefsResult,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GraphSyncRefsResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphSyncRefsResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): GraphSync.GraphSyncRefsResult;

    /**
     * Decodes a GraphSyncRefsResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphSyncRefsResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): GraphSync.GraphSyncRefsResult;

    /**
     * Verifies a GraphSyncRefsResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GraphSyncRefsResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphSyncRefsResult
     */
    public static fromObject(object: { [k: string]: any }): GraphSync.GraphSyncRefsResult;

    /**
     * Creates a plain object from a GraphSyncRefsResult message. Also converts values to other types if specified.
     * @param message GraphSyncRefsResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: GraphSync.GraphSyncRefsResult,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GraphSyncRefsResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GraphSyncRefsResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
