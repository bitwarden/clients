// @ts-nocheck
import * as $protobuf from "protobufjs";
import Long = require("long");
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
