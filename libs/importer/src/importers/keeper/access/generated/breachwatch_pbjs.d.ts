// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace BreachWatch. */
export namespace BreachWatch {
  /** BreachWatchInfoType enum. */
  enum BreachWatchInfoType {
    RECORD = 0,
    ALTERNATE_PASSWORD = 1,
  }

  /** Properties of a BreachWatchRecordRequest. */
  interface IBreachWatchRecordRequest {
    /** BreachWatchRecordRequest recordUid */
    recordUid?: Uint8Array | null;

    /** BreachWatchRecordRequest encryptedData */
    encryptedData?: Uint8Array | null;

    /** BreachWatchRecordRequest breachWatchInfoType */
    breachWatchInfoType?: BreachWatch.BreachWatchInfoType | null;

    /** BreachWatchRecordRequest updateUserWhoScanned */
    updateUserWhoScanned?: boolean | null;
  }

  /** Represents a BreachWatchRecordRequest. */
  class BreachWatchRecordRequest implements IBreachWatchRecordRequest {
    /**
     * Constructs a new BreachWatchRecordRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchRecordRequest);

    /** BreachWatchRecordRequest recordUid. */
    public recordUid: Uint8Array;

    /** BreachWatchRecordRequest encryptedData. */
    public encryptedData: Uint8Array;

    /** BreachWatchRecordRequest breachWatchInfoType. */
    public breachWatchInfoType: BreachWatch.BreachWatchInfoType;

    /** BreachWatchRecordRequest updateUserWhoScanned. */
    public updateUserWhoScanned: boolean;

    /**
     * Creates a new BreachWatchRecordRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchRecordRequest instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchRecordRequest,
    ): BreachWatch.BreachWatchRecordRequest;

    /**
     * Encodes the specified BreachWatchRecordRequest message. Does not implicitly {@link BreachWatch.BreachWatchRecordRequest.verify|verify} messages.
     * @param message BreachWatchRecordRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchRecordRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchRecordRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchRecordRequest.verify|verify} messages.
     * @param message BreachWatchRecordRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchRecordRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchRecordRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchRecordRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchRecordRequest;

    /**
     * Decodes a BreachWatchRecordRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchRecordRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchRecordRequest;

    /**
     * Verifies a BreachWatchRecordRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchRecordRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchRecordRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchRecordRequest;

    /**
     * Creates a plain object from a BreachWatchRecordRequest message. Also converts values to other types if specified.
     * @param message BreachWatchRecordRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchRecordRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchRecordRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchRecordRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchUpdateRequest. */
  interface IBreachWatchUpdateRequest {
    /** BreachWatchUpdateRequest breachWatchRecordRequest */
    breachWatchRecordRequest?: BreachWatch.IBreachWatchRecordRequest[] | null;

    /** BreachWatchUpdateRequest encryptedData */
    encryptedData?: Uint8Array | null;
  }

  /** Represents a BreachWatchUpdateRequest. */
  class BreachWatchUpdateRequest implements IBreachWatchUpdateRequest {
    /**
     * Constructs a new BreachWatchUpdateRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchUpdateRequest);

    /** BreachWatchUpdateRequest breachWatchRecordRequest. */
    public breachWatchRecordRequest: BreachWatch.IBreachWatchRecordRequest[];

    /** BreachWatchUpdateRequest encryptedData. */
    public encryptedData: Uint8Array;

    /**
     * Creates a new BreachWatchUpdateRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchUpdateRequest instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchUpdateRequest,
    ): BreachWatch.BreachWatchUpdateRequest;

    /**
     * Encodes the specified BreachWatchUpdateRequest message. Does not implicitly {@link BreachWatch.BreachWatchUpdateRequest.verify|verify} messages.
     * @param message BreachWatchUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchUpdateRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchUpdateRequest.verify|verify} messages.
     * @param message BreachWatchUpdateRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchUpdateRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchUpdateRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchUpdateRequest;

    /**
     * Decodes a BreachWatchUpdateRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchUpdateRequest;

    /**
     * Verifies a BreachWatchUpdateRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchUpdateRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchUpdateRequest;

    /**
     * Creates a plain object from a BreachWatchUpdateRequest message. Also converts values to other types if specified.
     * @param message BreachWatchUpdateRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchUpdateRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchUpdateRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchUpdateRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchRecordStatus. */
  interface IBreachWatchRecordStatus {
    /** BreachWatchRecordStatus recordUid */
    recordUid?: Uint8Array | null;

    /** BreachWatchRecordStatus status */
    status?: string | null;

    /** BreachWatchRecordStatus reason */
    reason?: string | null;
  }

  /** Represents a BreachWatchRecordStatus. */
  class BreachWatchRecordStatus implements IBreachWatchRecordStatus {
    /**
     * Constructs a new BreachWatchRecordStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchRecordStatus);

    /** BreachWatchRecordStatus recordUid. */
    public recordUid: Uint8Array;

    /** BreachWatchRecordStatus status. */
    public status: string;

    /** BreachWatchRecordStatus reason. */
    public reason: string;

    /**
     * Creates a new BreachWatchRecordStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchRecordStatus instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchRecordStatus,
    ): BreachWatch.BreachWatchRecordStatus;

    /**
     * Encodes the specified BreachWatchRecordStatus message. Does not implicitly {@link BreachWatch.BreachWatchRecordStatus.verify|verify} messages.
     * @param message BreachWatchRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchRecordStatus message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchRecordStatus.verify|verify} messages.
     * @param message BreachWatchRecordStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchRecordStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchRecordStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchRecordStatus;

    /**
     * Decodes a BreachWatchRecordStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchRecordStatus;

    /**
     * Verifies a BreachWatchRecordStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchRecordStatus
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchRecordStatus;

    /**
     * Creates a plain object from a BreachWatchRecordStatus message. Also converts values to other types if specified.
     * @param message BreachWatchRecordStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchRecordStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchRecordStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchRecordStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchUpdateResponse. */
  interface IBreachWatchUpdateResponse {
    /** BreachWatchUpdateResponse breachWatchRecordStatus */
    breachWatchRecordStatus?: BreachWatch.IBreachWatchRecordStatus[] | null;
  }

  /** Represents a BreachWatchUpdateResponse. */
  class BreachWatchUpdateResponse implements IBreachWatchUpdateResponse {
    /**
     * Constructs a new BreachWatchUpdateResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchUpdateResponse);

    /** BreachWatchUpdateResponse breachWatchRecordStatus. */
    public breachWatchRecordStatus: BreachWatch.IBreachWatchRecordStatus[];

    /**
     * Creates a new BreachWatchUpdateResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchUpdateResponse instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchUpdateResponse,
    ): BreachWatch.BreachWatchUpdateResponse;

    /**
     * Encodes the specified BreachWatchUpdateResponse message. Does not implicitly {@link BreachWatch.BreachWatchUpdateResponse.verify|verify} messages.
     * @param message BreachWatchUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchUpdateResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchUpdateResponse.verify|verify} messages.
     * @param message BreachWatchUpdateResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchUpdateResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchUpdateResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchUpdateResponse;

    /**
     * Decodes a BreachWatchUpdateResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchUpdateResponse;

    /**
     * Verifies a BreachWatchUpdateResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchUpdateResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchUpdateResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchUpdateResponse;

    /**
     * Creates a plain object from a BreachWatchUpdateResponse message. Also converts values to other types if specified.
     * @param message BreachWatchUpdateResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchUpdateResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchUpdateResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchUpdateResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchTokenRequest. */
  interface IBreachWatchTokenRequest {
    /** BreachWatchTokenRequest breachWatchToken */
    breachWatchToken?: Uint8Array | null;
  }

  /** Represents a BreachWatchTokenRequest. */
  class BreachWatchTokenRequest implements IBreachWatchTokenRequest {
    /**
     * Constructs a new BreachWatchTokenRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchTokenRequest);

    /** BreachWatchTokenRequest breachWatchToken. */
    public breachWatchToken: Uint8Array;

    /**
     * Creates a new BreachWatchTokenRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchTokenRequest instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchTokenRequest,
    ): BreachWatch.BreachWatchTokenRequest;

    /**
     * Encodes the specified BreachWatchTokenRequest message. Does not implicitly {@link BreachWatch.BreachWatchTokenRequest.verify|verify} messages.
     * @param message BreachWatchTokenRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchTokenRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchTokenRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchTokenRequest.verify|verify} messages.
     * @param message BreachWatchTokenRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchTokenRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchTokenRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchTokenRequest;

    /**
     * Decodes a BreachWatchTokenRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchTokenRequest;

    /**
     * Verifies a BreachWatchTokenRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchTokenRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchTokenRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchTokenRequest;

    /**
     * Creates a plain object from a BreachWatchTokenRequest message. Also converts values to other types if specified.
     * @param message BreachWatchTokenRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchTokenRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchTokenRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchTokenRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchTokenResponse. */
  interface IBreachWatchTokenResponse {
    /** BreachWatchTokenResponse breachWatchToken */
    breachWatchToken?: Uint8Array | null;

    /** BreachWatchTokenResponse clientEncrypted */
    clientEncrypted?: boolean | null;
  }

  /** Represents a BreachWatchTokenResponse. */
  class BreachWatchTokenResponse implements IBreachWatchTokenResponse {
    /**
     * Constructs a new BreachWatchTokenResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchTokenResponse);

    /** BreachWatchTokenResponse breachWatchToken. */
    public breachWatchToken: Uint8Array;

    /** BreachWatchTokenResponse clientEncrypted. */
    public clientEncrypted: boolean;

    /**
     * Creates a new BreachWatchTokenResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchTokenResponse instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchTokenResponse,
    ): BreachWatch.BreachWatchTokenResponse;

    /**
     * Encodes the specified BreachWatchTokenResponse message. Does not implicitly {@link BreachWatch.BreachWatchTokenResponse.verify|verify} messages.
     * @param message BreachWatchTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchTokenResponse.verify|verify} messages.
     * @param message BreachWatchTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchTokenResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchTokenResponse;

    /**
     * Decodes a BreachWatchTokenResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchTokenResponse;

    /**
     * Verifies a BreachWatchTokenResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchTokenResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchTokenResponse;

    /**
     * Creates a plain object from a BreachWatchTokenResponse message. Also converts values to other types if specified.
     * @param message BreachWatchTokenResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchTokenResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchTokenResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchTokenResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AnonymizedTokenResponse. */
  interface IAnonymizedTokenResponse {
    /** AnonymizedTokenResponse domainToken */
    domainToken?: Uint8Array | null;

    /** AnonymizedTokenResponse emailToken */
    emailToken?: Uint8Array | null;

    /** AnonymizedTokenResponse passwordToken */
    passwordToken?: Uint8Array | null;
  }

  /** Represents an AnonymizedTokenResponse. */
  class AnonymizedTokenResponse implements IAnonymizedTokenResponse {
    /**
     * Constructs a new AnonymizedTokenResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IAnonymizedTokenResponse);

    /** AnonymizedTokenResponse domainToken. */
    public domainToken: Uint8Array;

    /** AnonymizedTokenResponse emailToken. */
    public emailToken: Uint8Array;

    /** AnonymizedTokenResponse passwordToken. */
    public passwordToken: Uint8Array;

    /**
     * Creates a new AnonymizedTokenResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AnonymizedTokenResponse instance
     */
    public static create(
      properties?: BreachWatch.IAnonymizedTokenResponse,
    ): BreachWatch.AnonymizedTokenResponse;

    /**
     * Encodes the specified AnonymizedTokenResponse message. Does not implicitly {@link BreachWatch.AnonymizedTokenResponse.verify|verify} messages.
     * @param message AnonymizedTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IAnonymizedTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AnonymizedTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.AnonymizedTokenResponse.verify|verify} messages.
     * @param message AnonymizedTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IAnonymizedTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AnonymizedTokenResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AnonymizedTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.AnonymizedTokenResponse;

    /**
     * Decodes an AnonymizedTokenResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AnonymizedTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.AnonymizedTokenResponse;

    /**
     * Verifies an AnonymizedTokenResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AnonymizedTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AnonymizedTokenResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.AnonymizedTokenResponse;

    /**
     * Creates a plain object from an AnonymizedTokenResponse message. Also converts values to other types if specified.
     * @param message AnonymizedTokenResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.AnonymizedTokenResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AnonymizedTokenResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AnonymizedTokenResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a HashCheck. */
  interface IHashCheck {
    /** HashCheck hash1 */
    hash1?: Uint8Array | null;

    /** HashCheck euid */
    euid?: Uint8Array | null;
  }

  /** Represents a HashCheck. */
  class HashCheck implements IHashCheck {
    /**
     * Constructs a new HashCheck.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IHashCheck);

    /** HashCheck hash1. */
    public hash1: Uint8Array;

    /** HashCheck euid. */
    public euid: Uint8Array;

    /**
     * Creates a new HashCheck instance using the specified properties.
     * @param [properties] Properties to set
     * @returns HashCheck instance
     */
    public static create(properties?: BreachWatch.IHashCheck): BreachWatch.HashCheck;

    /**
     * Encodes the specified HashCheck message. Does not implicitly {@link BreachWatch.HashCheck.verify|verify} messages.
     * @param message HashCheck message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IHashCheck,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified HashCheck message, length delimited. Does not implicitly {@link BreachWatch.HashCheck.verify|verify} messages.
     * @param message HashCheck message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IHashCheck,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a HashCheck message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns HashCheck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.HashCheck;

    /**
     * Decodes a HashCheck message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns HashCheck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): BreachWatch.HashCheck;

    /**
     * Verifies a HashCheck message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a HashCheck message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns HashCheck
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.HashCheck;

    /**
     * Creates a plain object from a HashCheck message. Also converts values to other types if specified.
     * @param message HashCheck
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.HashCheck,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this HashCheck to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for HashCheck
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchStatusRequest. */
  interface IBreachWatchStatusRequest {
    /** BreachWatchStatusRequest anonymizedToken */
    anonymizedToken?: Uint8Array | null;

    /** BreachWatchStatusRequest hashCheck */
    hashCheck?: BreachWatch.IHashCheck[] | null;

    /** BreachWatchStatusRequest removedEuid */
    removedEuid?: Uint8Array[] | null;
  }

  /** Represents a BreachWatchStatusRequest. */
  class BreachWatchStatusRequest implements IBreachWatchStatusRequest {
    /**
     * Constructs a new BreachWatchStatusRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchStatusRequest);

    /** BreachWatchStatusRequest anonymizedToken. */
    public anonymizedToken: Uint8Array;

    /** BreachWatchStatusRequest hashCheck. */
    public hashCheck: BreachWatch.IHashCheck[];

    /** BreachWatchStatusRequest removedEuid. */
    public removedEuid: Uint8Array[];

    /**
     * Creates a new BreachWatchStatusRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchStatusRequest instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchStatusRequest,
    ): BreachWatch.BreachWatchStatusRequest;

    /**
     * Encodes the specified BreachWatchStatusRequest message. Does not implicitly {@link BreachWatch.BreachWatchStatusRequest.verify|verify} messages.
     * @param message BreachWatchStatusRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchStatusRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchStatusRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchStatusRequest.verify|verify} messages.
     * @param message BreachWatchStatusRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchStatusRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchStatusRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchStatusRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchStatusRequest;

    /**
     * Decodes a BreachWatchStatusRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchStatusRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchStatusRequest;

    /**
     * Verifies a BreachWatchStatusRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchStatusRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchStatusRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchStatusRequest;

    /**
     * Creates a plain object from a BreachWatchStatusRequest message. Also converts values to other types if specified.
     * @param message BreachWatchStatusRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchStatusRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchStatusRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchStatusRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a HashStatus. */
  interface IHashStatus {
    /** HashStatus hash1 */
    hash1?: Uint8Array | null;

    /** HashStatus euid */
    euid?: Uint8Array | null;

    /** HashStatus breachDetected */
    breachDetected?: boolean | null;
  }

  /** Represents a HashStatus. */
  class HashStatus implements IHashStatus {
    /**
     * Constructs a new HashStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IHashStatus);

    /** HashStatus hash1. */
    public hash1: Uint8Array;

    /** HashStatus euid. */
    public euid: Uint8Array;

    /** HashStatus breachDetected. */
    public breachDetected: boolean;

    /**
     * Creates a new HashStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns HashStatus instance
     */
    public static create(properties?: BreachWatch.IHashStatus): BreachWatch.HashStatus;

    /**
     * Encodes the specified HashStatus message. Does not implicitly {@link BreachWatch.HashStatus.verify|verify} messages.
     * @param message HashStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IHashStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified HashStatus message, length delimited. Does not implicitly {@link BreachWatch.HashStatus.verify|verify} messages.
     * @param message HashStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IHashStatus,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a HashStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns HashStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.HashStatus;

    /**
     * Decodes a HashStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns HashStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): BreachWatch.HashStatus;

    /**
     * Verifies a HashStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a HashStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns HashStatus
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.HashStatus;

    /**
     * Creates a plain object from a HashStatus message. Also converts values to other types if specified.
     * @param message HashStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.HashStatus,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this HashStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for HashStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachWatchStatusResponse. */
  interface IBreachWatchStatusResponse {
    /** BreachWatchStatusResponse hashStatus */
    hashStatus?: BreachWatch.IHashStatus[] | null;
  }

  /** Represents a BreachWatchStatusResponse. */
  class BreachWatchStatusResponse implements IBreachWatchStatusResponse {
    /**
     * Constructs a new BreachWatchStatusResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachWatchStatusResponse);

    /** BreachWatchStatusResponse hashStatus. */
    public hashStatus: BreachWatch.IHashStatus[];

    /**
     * Creates a new BreachWatchStatusResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachWatchStatusResponse instance
     */
    public static create(
      properties?: BreachWatch.IBreachWatchStatusResponse,
    ): BreachWatch.BreachWatchStatusResponse;

    /**
     * Encodes the specified BreachWatchStatusResponse message. Does not implicitly {@link BreachWatch.BreachWatchStatusResponse.verify|verify} messages.
     * @param message BreachWatchStatusResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachWatchStatusResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachWatchStatusResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchStatusResponse.verify|verify} messages.
     * @param message BreachWatchStatusResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachWatchStatusResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachWatchStatusResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachWatchStatusResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachWatchStatusResponse;

    /**
     * Decodes a BreachWatchStatusResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachWatchStatusResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.BreachWatchStatusResponse;

    /**
     * Verifies a BreachWatchStatusResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachWatchStatusResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachWatchStatusResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachWatchStatusResponse;

    /**
     * Creates a plain object from a BreachWatchStatusResponse message. Also converts values to other types if specified.
     * @param message BreachWatchStatusResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachWatchStatusResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachWatchStatusResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachWatchStatusResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an EnterprisePublicKeyResponse. */
  interface IEnterprisePublicKeyResponse {
    /** EnterprisePublicKeyResponse enterprisePublicKey */
    enterprisePublicKey?: Uint8Array | null;

    /** EnterprisePublicKeyResponse enterpriseECCPublicKey */
    enterpriseECCPublicKey?: Uint8Array | null;
  }

  /** Represents an EnterprisePublicKeyResponse. */
  class EnterprisePublicKeyResponse implements IEnterprisePublicKeyResponse {
    /**
     * Constructs a new EnterprisePublicKeyResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IEnterprisePublicKeyResponse);

    /** EnterprisePublicKeyResponse enterprisePublicKey. */
    public enterprisePublicKey: Uint8Array;

    /** EnterprisePublicKeyResponse enterpriseECCPublicKey. */
    public enterpriseECCPublicKey: Uint8Array;

    /**
     * Creates a new EnterprisePublicKeyResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnterprisePublicKeyResponse instance
     */
    public static create(
      properties?: BreachWatch.IEnterprisePublicKeyResponse,
    ): BreachWatch.EnterprisePublicKeyResponse;

    /**
     * Encodes the specified EnterprisePublicKeyResponse message. Does not implicitly {@link BreachWatch.EnterprisePublicKeyResponse.verify|verify} messages.
     * @param message EnterprisePublicKeyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IEnterprisePublicKeyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified EnterprisePublicKeyResponse message, length delimited. Does not implicitly {@link BreachWatch.EnterprisePublicKeyResponse.verify|verify} messages.
     * @param message EnterprisePublicKeyResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IEnterprisePublicKeyResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an EnterprisePublicKeyResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnterprisePublicKeyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.EnterprisePublicKeyResponse;

    /**
     * Decodes an EnterprisePublicKeyResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnterprisePublicKeyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.EnterprisePublicKeyResponse;

    /**
     * Verifies an EnterprisePublicKeyResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an EnterprisePublicKeyResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnterprisePublicKeyResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.EnterprisePublicKeyResponse;

    /**
     * Creates a plain object from an EnterprisePublicKeyResponse message. Also converts values to other types if specified.
     * @param message EnterprisePublicKeyResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.EnterprisePublicKeyResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this EnterprisePublicKeyResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnterprisePublicKeyResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FreeScanRequest. */
  interface IFreeScanRequest {
    /** FreeScanRequest hashedEmail */
    hashedEmail?: Uint8Array | null;
  }

  /** Represents a FreeScanRequest. */
  class FreeScanRequest implements IFreeScanRequest {
    /**
     * Constructs a new FreeScanRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IFreeScanRequest);

    /** FreeScanRequest hashedEmail. */
    public hashedEmail: Uint8Array;

    /**
     * Creates a new FreeScanRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FreeScanRequest instance
     */
    public static create(properties?: BreachWatch.IFreeScanRequest): BreachWatch.FreeScanRequest;

    /**
     * Encodes the specified FreeScanRequest message. Does not implicitly {@link BreachWatch.FreeScanRequest.verify|verify} messages.
     * @param message FreeScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IFreeScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FreeScanRequest message, length delimited. Does not implicitly {@link BreachWatch.FreeScanRequest.verify|verify} messages.
     * @param message FreeScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IFreeScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FreeScanRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FreeScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.FreeScanRequest;

    /**
     * Decodes a FreeScanRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FreeScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.FreeScanRequest;

    /**
     * Verifies a FreeScanRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FreeScanRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FreeScanRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.FreeScanRequest;

    /**
     * Creates a plain object from a FreeScanRequest message. Also converts values to other types if specified.
     * @param message FreeScanRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.FreeScanRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FreeScanRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FreeScanRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FreeScanResponse. */
  interface IFreeScanResponse {
    /** FreeScanResponse emailBreaches */
    emailBreaches?: number | null;

    /** FreeScanResponse passwordBreaches */
    passwordBreaches?: number | null;
  }

  /** Represents a FreeScanResponse. */
  class FreeScanResponse implements IFreeScanResponse {
    /**
     * Constructs a new FreeScanResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IFreeScanResponse);

    /** FreeScanResponse emailBreaches. */
    public emailBreaches: number;

    /** FreeScanResponse passwordBreaches. */
    public passwordBreaches: number;

    /**
     * Creates a new FreeScanResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FreeScanResponse instance
     */
    public static create(properties?: BreachWatch.IFreeScanResponse): BreachWatch.FreeScanResponse;

    /**
     * Encodes the specified FreeScanResponse message. Does not implicitly {@link BreachWatch.FreeScanResponse.verify|verify} messages.
     * @param message FreeScanResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IFreeScanResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FreeScanResponse message, length delimited. Does not implicitly {@link BreachWatch.FreeScanResponse.verify|verify} messages.
     * @param message FreeScanResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IFreeScanResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FreeScanResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FreeScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.FreeScanResponse;

    /**
     * Decodes a FreeScanResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FreeScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.FreeScanResponse;

    /**
     * Verifies a FreeScanResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FreeScanResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FreeScanResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.FreeScanResponse;

    /**
     * Creates a plain object from a FreeScanResponse message. Also converts values to other types if specified.
     * @param message FreeScanResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.FreeScanResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FreeScanResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FreeScanResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a PaidUserRequest. */
  interface IPaidUserRequest {
    /** PaidUserRequest email */
    email?: string | null;
  }

  /** Represents a PaidUserRequest. */
  class PaidUserRequest implements IPaidUserRequest {
    /**
     * Constructs a new PaidUserRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IPaidUserRequest);

    /** PaidUserRequest email. */
    public email: string;

    /**
     * Creates a new PaidUserRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PaidUserRequest instance
     */
    public static create(properties?: BreachWatch.IPaidUserRequest): BreachWatch.PaidUserRequest;

    /**
     * Encodes the specified PaidUserRequest message. Does not implicitly {@link BreachWatch.PaidUserRequest.verify|verify} messages.
     * @param message PaidUserRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IPaidUserRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified PaidUserRequest message, length delimited. Does not implicitly {@link BreachWatch.PaidUserRequest.verify|verify} messages.
     * @param message PaidUserRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IPaidUserRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a PaidUserRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PaidUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.PaidUserRequest;

    /**
     * Decodes a PaidUserRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PaidUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.PaidUserRequest;

    /**
     * Verifies a PaidUserRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a PaidUserRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PaidUserRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.PaidUserRequest;

    /**
     * Creates a plain object from a PaidUserRequest message. Also converts values to other types if specified.
     * @param message PaidUserRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.PaidUserRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this PaidUserRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PaidUserRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a PaidUserResponse. */
  interface IPaidUserResponse {
    /** PaidUserResponse paidUser */
    paidUser?: boolean | null;
  }

  /** Represents a PaidUserResponse. */
  class PaidUserResponse implements IPaidUserResponse {
    /**
     * Constructs a new PaidUserResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IPaidUserResponse);

    /** PaidUserResponse paidUser. */
    public paidUser: boolean;

    /**
     * Creates a new PaidUserResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PaidUserResponse instance
     */
    public static create(properties?: BreachWatch.IPaidUserResponse): BreachWatch.PaidUserResponse;

    /**
     * Encodes the specified PaidUserResponse message. Does not implicitly {@link BreachWatch.PaidUserResponse.verify|verify} messages.
     * @param message PaidUserResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IPaidUserResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified PaidUserResponse message, length delimited. Does not implicitly {@link BreachWatch.PaidUserResponse.verify|verify} messages.
     * @param message PaidUserResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IPaidUserResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a PaidUserResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PaidUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.PaidUserResponse;

    /**
     * Decodes a PaidUserResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PaidUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.PaidUserResponse;

    /**
     * Verifies a PaidUserResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a PaidUserResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PaidUserResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.PaidUserResponse;

    /**
     * Creates a plain object from a PaidUserResponse message. Also converts values to other types if specified.
     * @param message PaidUserResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.PaidUserResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this PaidUserResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PaidUserResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DetailedScanRequest. */
  interface IDetailedScanRequest {
    /** DetailedScanRequest email */
    email?: string | null;
  }

  /** Represents a DetailedScanRequest. */
  class DetailedScanRequest implements IDetailedScanRequest {
    /**
     * Constructs a new DetailedScanRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IDetailedScanRequest);

    /** DetailedScanRequest email. */
    public email: string;

    /**
     * Creates a new DetailedScanRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DetailedScanRequest instance
     */
    public static create(
      properties?: BreachWatch.IDetailedScanRequest,
    ): BreachWatch.DetailedScanRequest;

    /**
     * Encodes the specified DetailedScanRequest message. Does not implicitly {@link BreachWatch.DetailedScanRequest.verify|verify} messages.
     * @param message DetailedScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IDetailedScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DetailedScanRequest message, length delimited. Does not implicitly {@link BreachWatch.DetailedScanRequest.verify|verify} messages.
     * @param message DetailedScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IDetailedScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DetailedScanRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DetailedScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.DetailedScanRequest;

    /**
     * Decodes a DetailedScanRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DetailedScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.DetailedScanRequest;

    /**
     * Verifies a DetailedScanRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DetailedScanRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DetailedScanRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.DetailedScanRequest;

    /**
     * Creates a plain object from a DetailedScanRequest message. Also converts values to other types if specified.
     * @param message DetailedScanRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.DetailedScanRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DetailedScanRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DetailedScanRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UseOneTimeTokenRequest. */
  interface IUseOneTimeTokenRequest {
    /** UseOneTimeTokenRequest token */
    token?: Uint8Array | null;
  }

  /** Represents a UseOneTimeTokenRequest. */
  class UseOneTimeTokenRequest implements IUseOneTimeTokenRequest {
    /**
     * Constructs a new UseOneTimeTokenRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IUseOneTimeTokenRequest);

    /** UseOneTimeTokenRequest token. */
    public token: Uint8Array;

    /**
     * Creates a new UseOneTimeTokenRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UseOneTimeTokenRequest instance
     */
    public static create(
      properties?: BreachWatch.IUseOneTimeTokenRequest,
    ): BreachWatch.UseOneTimeTokenRequest;

    /**
     * Encodes the specified UseOneTimeTokenRequest message. Does not implicitly {@link BreachWatch.UseOneTimeTokenRequest.verify|verify} messages.
     * @param message UseOneTimeTokenRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IUseOneTimeTokenRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UseOneTimeTokenRequest message, length delimited. Does not implicitly {@link BreachWatch.UseOneTimeTokenRequest.verify|verify} messages.
     * @param message UseOneTimeTokenRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IUseOneTimeTokenRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UseOneTimeTokenRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UseOneTimeTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.UseOneTimeTokenRequest;

    /**
     * Decodes a UseOneTimeTokenRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UseOneTimeTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.UseOneTimeTokenRequest;

    /**
     * Verifies a UseOneTimeTokenRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UseOneTimeTokenRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UseOneTimeTokenRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.UseOneTimeTokenRequest;

    /**
     * Creates a plain object from a UseOneTimeTokenRequest message. Also converts values to other types if specified.
     * @param message UseOneTimeTokenRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.UseOneTimeTokenRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UseOneTimeTokenRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UseOneTimeTokenRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a BreachEvent. */
  interface IBreachEvent {
    /** BreachEvent site */
    site?: string | null;

    /** BreachEvent email */
    email?: string | null;

    /** BreachEvent passwordInBreach */
    passwordInBreach?: boolean | null;

    /** BreachEvent date */
    date?: string | null;

    /** BreachEvent description */
    description?: string | null;
  }

  /** Represents a BreachEvent. */
  class BreachEvent implements IBreachEvent {
    /**
     * Constructs a new BreachEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IBreachEvent);

    /** BreachEvent site. */
    public site: string;

    /** BreachEvent email. */
    public email: string;

    /** BreachEvent passwordInBreach. */
    public passwordInBreach: boolean;

    /** BreachEvent date. */
    public date: string;

    /** BreachEvent description. */
    public description: string;

    /**
     * Creates a new BreachEvent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BreachEvent instance
     */
    public static create(properties?: BreachWatch.IBreachEvent): BreachWatch.BreachEvent;

    /**
     * Encodes the specified BreachEvent message. Does not implicitly {@link BreachWatch.BreachEvent.verify|verify} messages.
     * @param message BreachEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IBreachEvent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified BreachEvent message, length delimited. Does not implicitly {@link BreachWatch.BreachEvent.verify|verify} messages.
     * @param message BreachEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IBreachEvent,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a BreachEvent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BreachEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.BreachEvent;

    /**
     * Decodes a BreachEvent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BreachEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: $protobuf.Reader | Uint8Array): BreachWatch.BreachEvent;

    /**
     * Verifies a BreachEvent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a BreachEvent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BreachEvent
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.BreachEvent;

    /**
     * Creates a plain object from a BreachEvent message. Also converts values to other types if specified.
     * @param message BreachEvent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.BreachEvent,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this BreachEvent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for BreachEvent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a UseOneTimeTokenResponse. */
  interface IUseOneTimeTokenResponse {
    /** UseOneTimeTokenResponse emailBreaches */
    emailBreaches?: number | null;

    /** UseOneTimeTokenResponse passwordBreaches */
    passwordBreaches?: number | null;

    /** UseOneTimeTokenResponse breachEvents */
    breachEvents?: BreachWatch.IBreachEvent[] | null;

    /** UseOneTimeTokenResponse email */
    email?: string | null;
  }

  /** Represents a UseOneTimeTokenResponse. */
  class UseOneTimeTokenResponse implements IUseOneTimeTokenResponse {
    /**
     * Constructs a new UseOneTimeTokenResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IUseOneTimeTokenResponse);

    /** UseOneTimeTokenResponse emailBreaches. */
    public emailBreaches: number;

    /** UseOneTimeTokenResponse passwordBreaches. */
    public passwordBreaches: number;

    /** UseOneTimeTokenResponse breachEvents. */
    public breachEvents: BreachWatch.IBreachEvent[];

    /** UseOneTimeTokenResponse email. */
    public email: string;

    /**
     * Creates a new UseOneTimeTokenResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UseOneTimeTokenResponse instance
     */
    public static create(
      properties?: BreachWatch.IUseOneTimeTokenResponse,
    ): BreachWatch.UseOneTimeTokenResponse;

    /**
     * Encodes the specified UseOneTimeTokenResponse message. Does not implicitly {@link BreachWatch.UseOneTimeTokenResponse.verify|verify} messages.
     * @param message UseOneTimeTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IUseOneTimeTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UseOneTimeTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.UseOneTimeTokenResponse.verify|verify} messages.
     * @param message UseOneTimeTokenResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IUseOneTimeTokenResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a UseOneTimeTokenResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UseOneTimeTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.UseOneTimeTokenResponse;

    /**
     * Decodes a UseOneTimeTokenResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UseOneTimeTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.UseOneTimeTokenResponse;

    /**
     * Verifies a UseOneTimeTokenResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a UseOneTimeTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UseOneTimeTokenResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.UseOneTimeTokenResponse;

    /**
     * Creates a plain object from a UseOneTimeTokenResponse message. Also converts values to other types if specified.
     * @param message UseOneTimeTokenResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.UseOneTimeTokenResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UseOneTimeTokenResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UseOneTimeTokenResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an OneTimeUseToken. */
  interface IOneTimeUseToken {
    /** OneTimeUseToken email */
    email?: string | null;

    /** OneTimeUseToken pad */
    pad?: string | null;
  }

  /** Represents an OneTimeUseToken. */
  class OneTimeUseToken implements IOneTimeUseToken {
    /**
     * Constructs a new OneTimeUseToken.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IOneTimeUseToken);

    /** OneTimeUseToken email. */
    public email: string;

    /** OneTimeUseToken pad. */
    public pad: string;

    /**
     * Creates a new OneTimeUseToken instance using the specified properties.
     * @param [properties] Properties to set
     * @returns OneTimeUseToken instance
     */
    public static create(properties?: BreachWatch.IOneTimeUseToken): BreachWatch.OneTimeUseToken;

    /**
     * Encodes the specified OneTimeUseToken message. Does not implicitly {@link BreachWatch.OneTimeUseToken.verify|verify} messages.
     * @param message OneTimeUseToken message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IOneTimeUseToken,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified OneTimeUseToken message, length delimited. Does not implicitly {@link BreachWatch.OneTimeUseToken.verify|verify} messages.
     * @param message OneTimeUseToken message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IOneTimeUseToken,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an OneTimeUseToken message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns OneTimeUseToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.OneTimeUseToken;

    /**
     * Decodes an OneTimeUseToken message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns OneTimeUseToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.OneTimeUseToken;

    /**
     * Verifies an OneTimeUseToken message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an OneTimeUseToken message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns OneTimeUseToken
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.OneTimeUseToken;

    /**
     * Creates a plain object from an OneTimeUseToken message. Also converts values to other types if specified.
     * @param message OneTimeUseToken
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.OneTimeUseToken,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this OneTimeUseToken to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for OneTimeUseToken
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FreePasswordScanRequest. */
  interface IFreePasswordScanRequest {
    /** FreePasswordScanRequest hashedPassword */
    hashedPassword?: Uint8Array | null;
  }

  /** Represents a FreePasswordScanRequest. */
  class FreePasswordScanRequest implements IFreePasswordScanRequest {
    /**
     * Constructs a new FreePasswordScanRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IFreePasswordScanRequest);

    /** FreePasswordScanRequest hashedPassword. */
    public hashedPassword: Uint8Array;

    /**
     * Creates a new FreePasswordScanRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FreePasswordScanRequest instance
     */
    public static create(
      properties?: BreachWatch.IFreePasswordScanRequest,
    ): BreachWatch.FreePasswordScanRequest;

    /**
     * Encodes the specified FreePasswordScanRequest message. Does not implicitly {@link BreachWatch.FreePasswordScanRequest.verify|verify} messages.
     * @param message FreePasswordScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IFreePasswordScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FreePasswordScanRequest message, length delimited. Does not implicitly {@link BreachWatch.FreePasswordScanRequest.verify|verify} messages.
     * @param message FreePasswordScanRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IFreePasswordScanRequest,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FreePasswordScanRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FreePasswordScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.FreePasswordScanRequest;

    /**
     * Decodes a FreePasswordScanRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FreePasswordScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.FreePasswordScanRequest;

    /**
     * Verifies a FreePasswordScanRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FreePasswordScanRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FreePasswordScanRequest
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.FreePasswordScanRequest;

    /**
     * Creates a plain object from a FreePasswordScanRequest message. Also converts values to other types if specified.
     * @param message FreePasswordScanRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.FreePasswordScanRequest,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FreePasswordScanRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FreePasswordScanRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a FreePasswordScanResponse. */
  interface IFreePasswordScanResponse {
    /** FreePasswordScanResponse passwordBreaches */
    passwordBreaches?: number | Long | null;
  }

  /** Represents a FreePasswordScanResponse. */
  class FreePasswordScanResponse implements IFreePasswordScanResponse {
    /**
     * Constructs a new FreePasswordScanResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: BreachWatch.IFreePasswordScanResponse);

    /** FreePasswordScanResponse passwordBreaches. */
    public passwordBreaches: number | Long;

    /**
     * Creates a new FreePasswordScanResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FreePasswordScanResponse instance
     */
    public static create(
      properties?: BreachWatch.IFreePasswordScanResponse,
    ): BreachWatch.FreePasswordScanResponse;

    /**
     * Encodes the specified FreePasswordScanResponse message. Does not implicitly {@link BreachWatch.FreePasswordScanResponse.verify|verify} messages.
     * @param message FreePasswordScanResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: BreachWatch.IFreePasswordScanResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified FreePasswordScanResponse message, length delimited. Does not implicitly {@link BreachWatch.FreePasswordScanResponse.verify|verify} messages.
     * @param message FreePasswordScanResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: BreachWatch.IFreePasswordScanResponse,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a FreePasswordScanResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FreePasswordScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): BreachWatch.FreePasswordScanResponse;

    /**
     * Decodes a FreePasswordScanResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FreePasswordScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): BreachWatch.FreePasswordScanResponse;

    /**
     * Verifies a FreePasswordScanResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a FreePasswordScanResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FreePasswordScanResponse
     */
    public static fromObject(object: { [k: string]: any }): BreachWatch.FreePasswordScanResponse;

    /**
     * Creates a plain object from a FreePasswordScanResponse message. Also converts values to other types if specified.
     * @param message FreePasswordScanResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: BreachWatch.FreePasswordScanResponse,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this FreePasswordScanResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FreePasswordScanResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
