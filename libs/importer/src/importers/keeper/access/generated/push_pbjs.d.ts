// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace Push. */
export namespace Push {
  /** MessageType enum. */
  enum MessageType {
    UNKNOWN = 0,
    DNA = 1,
    SSO = 2,
    CHAT = 3,
    USER = 4,
    ENTERPRISE = 5,
    KEEPER = 6,
    SESSION = 7,
    DEVICE = 8,
    TOTP = 9,
  }

  /** Properties of a UserRegistrationRequest. */
  interface IUserRegistrationRequest {
    /** UserRegistrationRequest messageSessionUid */
    messageSessionUid?: Uint8Array | null;

    /** UserRegistrationRequest userId */
    userId?: number | null;

    /** UserRegistrationRequest enterpriseId */
    enterpriseId?: number | null;
  }

  /** Represents a UserRegistrationRequest. */
  class UserRegistrationRequest implements IUserRegistrationRequest {
    /**
     * Constructs a new UserRegistrationRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.IUserRegistrationRequest);

    /** UserRegistrationRequest messageSessionUid. */
    public messageSessionUid: Uint8Array;

    /** UserRegistrationRequest userId. */
    public userId: number;

    /** UserRegistrationRequest enterpriseId. */
    public enterpriseId: number;

    /**
     * Creates a new UserRegistrationRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserRegistrationRequest instance
     */
    public static create(properties?: Push.IUserRegistrationRequest): Push.UserRegistrationRequest;

    /**
     * Encodes the specified UserRegistrationRequest message. Does not implicitly {@link Push.UserRegistrationRequest.verify|verify} messages.
     * @param message UserRegistrationRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Push.IUserRegistrationRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UserRegistrationRequest message, length delimited. Does not implicitly {@link Push.UserRegistrationRequest.verify|verify} messages.
     * @param message UserRegistrationRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.IUserRegistrationRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UserRegistrationRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Push.UserRegistrationRequest;

    /**
     * Decodes a UserRegistrationRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Push.UserRegistrationRequest;

    /**
     * Verifies a UserRegistrationRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UserRegistrationRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserRegistrationRequest
     */
    public static fromObject(object: { [k: string]: any }): Push.UserRegistrationRequest;

    /**
     * Creates a plain object from a UserRegistrationRequest message. Also converts values to other types if specified.
     * @param message UserRegistrationRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.UserRegistrationRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UserRegistrationRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UserRegistrationRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a KAToPushServerRequest. */
  interface IKAToPushServerRequest {
    /** KAToPushServerRequest messageType */
    messageType?: Push.MessageType | null;

    /** KAToPushServerRequest message */
    message?: string | null;

    /** KAToPushServerRequest messageSessionUid */
    messageSessionUid?: Uint8Array | null;

    /** KAToPushServerRequest encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array[] | null;

    /** KAToPushServerRequest userId */
    userId?: number[] | null;

    /** KAToPushServerRequest enterpriseId */
    enterpriseId?: number[] | null;
  }

  /** Represents a KAToPushServerRequest. */
  class KAToPushServerRequest implements IKAToPushServerRequest {
    /**
     * Constructs a new KAToPushServerRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.IKAToPushServerRequest);

    /** KAToPushServerRequest messageType. */
    public messageType: Push.MessageType;

    /** KAToPushServerRequest message. */
    public message: string;

    /** KAToPushServerRequest messageSessionUid. */
    public messageSessionUid: Uint8Array;

    /** KAToPushServerRequest encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array[];

    /** KAToPushServerRequest userId. */
    public userId: number[];

    /** KAToPushServerRequest enterpriseId. */
    public enterpriseId: number[];

    /**
     * Creates a new KAToPushServerRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns KAToPushServerRequest instance
     */
    public static create(properties?: Push.IKAToPushServerRequest): Push.KAToPushServerRequest;

    /**
     * Encodes the specified KAToPushServerRequest message. Does not implicitly {@link Push.KAToPushServerRequest.verify|verify} messages.
     * @param message KAToPushServerRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Push.IKAToPushServerRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified KAToPushServerRequest message, length delimited. Does not implicitly {@link Push.KAToPushServerRequest.verify|verify} messages.
     * @param message KAToPushServerRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.IKAToPushServerRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a KAToPushServerRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns KAToPushServerRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Push.KAToPushServerRequest;

    /**
     * Decodes a KAToPushServerRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns KAToPushServerRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Push.KAToPushServerRequest;

    /**
     * Verifies a KAToPushServerRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a KAToPushServerRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns KAToPushServerRequest
     */
    public static fromObject(object: { [k: string]: any }): Push.KAToPushServerRequest;

    /**
     * Creates a plain object from a KAToPushServerRequest message. Also converts values to other types if specified.
     * @param message KAToPushServerRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.KAToPushServerRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this KAToPushServerRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for KAToPushServerRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a WssConnectionRequest. */
  interface IWssConnectionRequest {
    /** WssConnectionRequest messageSessionUid */
    messageSessionUid?: Uint8Array | null;

    /** WssConnectionRequest encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** WssConnectionRequest deviceTimeStamp */
    deviceTimeStamp?: number | Long | null;
  }

  /** Represents a WssConnectionRequest. */
  class WssConnectionRequest implements IWssConnectionRequest {
    /**
     * Constructs a new WssConnectionRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.IWssConnectionRequest);

    /** WssConnectionRequest messageSessionUid. */
    public messageSessionUid: Uint8Array;

    /** WssConnectionRequest encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** WssConnectionRequest deviceTimeStamp. */
    public deviceTimeStamp: number | Long;

    /**
     * Creates a new WssConnectionRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns WssConnectionRequest instance
     */
    public static create(properties?: Push.IWssConnectionRequest): Push.WssConnectionRequest;

    /**
     * Encodes the specified WssConnectionRequest message. Does not implicitly {@link Push.WssConnectionRequest.verify|verify} messages.
     * @param message WssConnectionRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Push.IWssConnectionRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified WssConnectionRequest message, length delimited. Does not implicitly {@link Push.WssConnectionRequest.verify|verify} messages.
     * @param message WssConnectionRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.IWssConnectionRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a WssConnectionRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns WssConnectionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Push.WssConnectionRequest;

    /**
     * Decodes a WssConnectionRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns WssConnectionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Push.WssConnectionRequest;

    /**
     * Verifies a WssConnectionRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a WssConnectionRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns WssConnectionRequest
     */
    public static fromObject(object: { [k: string]: any }): Push.WssConnectionRequest;

    /**
     * Creates a plain object from a WssConnectionRequest message. Also converts values to other types if specified.
     * @param message WssConnectionRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.WssConnectionRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this WssConnectionRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for WssConnectionRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a WssClientResponse. */
  interface IWssClientResponse {
    /** WssClientResponse messageType */
    messageType?: Push.MessageType | null;

    /** WssClientResponse message */
    message?: string | null;
  }

  /** Represents a WssClientResponse. */
  class WssClientResponse implements IWssClientResponse {
    /**
     * Constructs a new WssClientResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.IWssClientResponse);

    /** WssClientResponse messageType. */
    public messageType: Push.MessageType;

    /** WssClientResponse message. */
    public message: string;

    /**
     * Creates a new WssClientResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns WssClientResponse instance
     */
    public static create(properties?: Push.IWssClientResponse): Push.WssClientResponse;

    /**
     * Encodes the specified WssClientResponse message. Does not implicitly {@link Push.WssClientResponse.verify|verify} messages.
     * @param message WssClientResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Push.IWssClientResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified WssClientResponse message, length delimited. Does not implicitly {@link Push.WssClientResponse.verify|verify} messages.
     * @param message WssClientResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.IWssClientResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a WssClientResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns WssClientResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Push.WssClientResponse;

    /**
     * Decodes a WssClientResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns WssClientResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Push.WssClientResponse;

    /**
     * Verifies a WssClientResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a WssClientResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns WssClientResponse
     */
    public static fromObject(object: { [k: string]: any }): Push.WssClientResponse;

    /**
     * Creates a plain object from a WssClientResponse message. Also converts values to other types if specified.
     * @param message WssClientResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.WssClientResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this WssClientResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for WssClientResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a PushServerDeviceRegistrationRequest. */
  interface IPushServerDeviceRegistrationRequest {
    /** PushServerDeviceRegistrationRequest encryptedDeviceToken */
    encryptedDeviceToken?: Uint8Array | null;

    /** PushServerDeviceRegistrationRequest pushToken */
    pushToken?: string | null;

    /** PushServerDeviceRegistrationRequest mobilePushPlatform */
    mobilePushPlatform?: string | null;

    /** PushServerDeviceRegistrationRequest transmissionKey */
    transmissionKey?: Uint8Array | null;
  }

  /** Represents a PushServerDeviceRegistrationRequest. */
  class PushServerDeviceRegistrationRequest implements IPushServerDeviceRegistrationRequest {
    /**
     * Constructs a new PushServerDeviceRegistrationRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.IPushServerDeviceRegistrationRequest);

    /** PushServerDeviceRegistrationRequest encryptedDeviceToken. */
    public encryptedDeviceToken: Uint8Array;

    /** PushServerDeviceRegistrationRequest pushToken. */
    public pushToken: string;

    /** PushServerDeviceRegistrationRequest mobilePushPlatform. */
    public mobilePushPlatform: string;

    /** PushServerDeviceRegistrationRequest transmissionKey. */
    public transmissionKey: Uint8Array;

    /**
     * Creates a new PushServerDeviceRegistrationRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PushServerDeviceRegistrationRequest instance
     */
    public static create(
      properties?: Push.IPushServerDeviceRegistrationRequest,
    ): Push.PushServerDeviceRegistrationRequest;

    /**
     * Encodes the specified PushServerDeviceRegistrationRequest message. Does not implicitly {@link Push.PushServerDeviceRegistrationRequest.verify|verify} messages.
     * @param message PushServerDeviceRegistrationRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: Push.IPushServerDeviceRegistrationRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified PushServerDeviceRegistrationRequest message, length delimited. Does not implicitly {@link Push.PushServerDeviceRegistrationRequest.verify|verify} messages.
     * @param message PushServerDeviceRegistrationRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.IPushServerDeviceRegistrationRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a PushServerDeviceRegistrationRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PushServerDeviceRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): Push.PushServerDeviceRegistrationRequest;

    /**
     * Decodes a PushServerDeviceRegistrationRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PushServerDeviceRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): Push.PushServerDeviceRegistrationRequest;

    /**
     * Verifies a PushServerDeviceRegistrationRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a PushServerDeviceRegistrationRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PushServerDeviceRegistrationRequest
     */
    public static fromObject(object: {
      [k: string]: any;
    }): Push.PushServerDeviceRegistrationRequest;

    /**
     * Creates a plain object from a PushServerDeviceRegistrationRequest message. Also converts values to other types if specified.
     * @param message PushServerDeviceRegistrationRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.PushServerDeviceRegistrationRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this PushServerDeviceRegistrationRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PushServerDeviceRegistrationRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SnsMessage. */
  interface ISnsMessage {
    /** SnsMessage messageType */
    messageType?: Push.MessageType | null;

    /** SnsMessage message */
    message?: Uint8Array | null;
  }

  /** Represents a SnsMessage. */
  class SnsMessage implements ISnsMessage {
    /**
     * Constructs a new SnsMessage.
     * @param [properties] Properties to set
     */
    constructor(properties?: Push.ISnsMessage);

    /** SnsMessage messageType. */
    public messageType: Push.MessageType;

    /** SnsMessage message. */
    public message: Uint8Array;

    /**
     * Creates a new SnsMessage instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SnsMessage instance
     */
    public static create(properties?: Push.ISnsMessage): Push.SnsMessage;

    /**
     * Encodes the specified SnsMessage message. Does not implicitly {@link Push.SnsMessage.verify|verify} messages.
     * @param message SnsMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: Push.ISnsMessage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SnsMessage message, length delimited. Does not implicitly {@link Push.SnsMessage.verify|verify} messages.
     * @param message SnsMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: Push.ISnsMessage,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SnsMessage message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SnsMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: $protobuf.Reader | Uint8Array, length?: number): Push.SnsMessage;

    /**
     * Decodes a SnsMessage message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SnsMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): Push.SnsMessage;

    /**
     * Verifies a SnsMessage message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SnsMessage message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SnsMessage
     */
    public static fromObject(object: { [k: string]: any }): Push.SnsMessage;

    /**
     * Creates a plain object from a SnsMessage message. Also converts values to other types if specified.
     * @param message SnsMessage
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: Push.SnsMessage,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SnsMessage to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SnsMessage
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
