/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const Records = ($root.Records = (() => {
  /**
   * Namespace Records.
   * @exports Records
   * @namespace
   */
  const Records = {};

  /**
   * RecordTypeScope enum.
   * @name Records.RecordTypeScope
   * @enum {number}
   * @property {number} RT_STANDARD=0 RT_STANDARD value
   * @property {number} RT_USER=1 RT_USER value
   * @property {number} RT_ENTERPRISE=2 RT_ENTERPRISE value
   * @property {number} RT_PAM=3 RT_PAM value
   * @property {number} RT_PAM_CONFIGURATION=4 RT_PAM_CONFIGURATION value
   */
  Records.RecordTypeScope = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "RT_STANDARD")] = 0;
    values[(valuesById[1] = "RT_USER")] = 1;
    values[(valuesById[2] = "RT_ENTERPRISE")] = 2;
    values[(valuesById[3] = "RT_PAM")] = 3;
    values[(valuesById[4] = "RT_PAM_CONFIGURATION")] = 4;
    return values;
  })();

  /**
   * RecordKeyType enum.
   * @name Records.RecordKeyType
   * @enum {number}
   * @property {number} NO_KEY=0 NO_KEY value
   * @property {number} ENCRYPTED_BY_DATA_KEY=1 ENCRYPTED_BY_DATA_KEY value
   * @property {number} ENCRYPTED_BY_PUBLIC_KEY=2 ENCRYPTED_BY_PUBLIC_KEY value
   * @property {number} ENCRYPTED_BY_DATA_KEY_GCM=3 ENCRYPTED_BY_DATA_KEY_GCM value
   * @property {number} ENCRYPTED_BY_PUBLIC_KEY_ECC=4 ENCRYPTED_BY_PUBLIC_KEY_ECC value
   * @property {number} ENCRYPTED_BY_ROOT_KEY_CBC=5 ENCRYPTED_BY_ROOT_KEY_CBC value
   * @property {number} ENCRYPTED_BY_ROOT_KEY_GCM=6 ENCRYPTED_BY_ROOT_KEY_GCM value
   */
  Records.RecordKeyType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NO_KEY")] = 0;
    values[(valuesById[1] = "ENCRYPTED_BY_DATA_KEY")] = 1;
    values[(valuesById[2] = "ENCRYPTED_BY_PUBLIC_KEY")] = 2;
    values[(valuesById[3] = "ENCRYPTED_BY_DATA_KEY_GCM")] = 3;
    values[(valuesById[4] = "ENCRYPTED_BY_PUBLIC_KEY_ECC")] = 4;
    values[(valuesById[5] = "ENCRYPTED_BY_ROOT_KEY_CBC")] = 5;
    values[(valuesById[6] = "ENCRYPTED_BY_ROOT_KEY_GCM")] = 6;
    return values;
  })();

  /**
   * RecordFolderType enum.
   * @name Records.RecordFolderType
   * @enum {number}
   * @property {number} user_folder=0 user_folder value
   * @property {number} shared_folder=1 shared_folder value
   * @property {number} shared_folder_folder=2 shared_folder_folder value
   */
  Records.RecordFolderType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "user_folder")] = 0;
    values[(valuesById[1] = "shared_folder")] = 1;
    values[(valuesById[2] = "shared_folder_folder")] = 2;
    return values;
  })();

  /**
   * RecordModifyResult enum.
   * @name Records.RecordModifyResult
   * @enum {number}
   * @property {number} RS_SUCCESS=0 RS_SUCCESS value
   * @property {number} RS_OUT_OF_SYNC=1 RS_OUT_OF_SYNC value
   * @property {number} RS_ACCESS_DENIED=2 RS_ACCESS_DENIED value
   * @property {number} RS_SHARE_DENIED=3 RS_SHARE_DENIED value
   * @property {number} RS_RECORD_EXISTS=4 RS_RECORD_EXISTS value
   * @property {number} RS_OLD_RECORD_VERSION_TYPE=5 RS_OLD_RECORD_VERSION_TYPE value
   * @property {number} RS_NEW_RECORD_VERSION_TYPE=6 RS_NEW_RECORD_VERSION_TYPE value
   * @property {number} RS_FILES_NOT_MATCH=7 RS_FILES_NOT_MATCH value
   * @property {number} RS_RECORD_NOT_SHAREABLE=8 RS_RECORD_NOT_SHAREABLE value
   * @property {number} RS_ATTACHMENT_NOT_SHAREABLE=9 RS_ATTACHMENT_NOT_SHAREABLE value
   * @property {number} RS_FILE_LIMIT_REACHED=10 RS_FILE_LIMIT_REACHED value
   * @property {number} RS_SIZE_EXCEEDED_LIMIT=11 RS_SIZE_EXCEEDED_LIMIT value
   * @property {number} RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS=12 RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS value
   */
  Records.RecordModifyResult = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "RS_SUCCESS")] = 0;
    values[(valuesById[1] = "RS_OUT_OF_SYNC")] = 1;
    values[(valuesById[2] = "RS_ACCESS_DENIED")] = 2;
    values[(valuesById[3] = "RS_SHARE_DENIED")] = 3;
    values[(valuesById[4] = "RS_RECORD_EXISTS")] = 4;
    values[(valuesById[5] = "RS_OLD_RECORD_VERSION_TYPE")] = 5;
    values[(valuesById[6] = "RS_NEW_RECORD_VERSION_TYPE")] = 6;
    values[(valuesById[7] = "RS_FILES_NOT_MATCH")] = 7;
    values[(valuesById[8] = "RS_RECORD_NOT_SHAREABLE")] = 8;
    values[(valuesById[9] = "RS_ATTACHMENT_NOT_SHAREABLE")] = 9;
    values[(valuesById[10] = "RS_FILE_LIMIT_REACHED")] = 10;
    values[(valuesById[11] = "RS_SIZE_EXCEEDED_LIMIT")] = 11;
    values[(valuesById[12] = "RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS")] = 12;
    return values;
  })();

  /**
   * FileAddResult enum.
   * @name Records.FileAddResult
   * @enum {number}
   * @property {number} FA_SUCCESS=0 FA_SUCCESS value
   * @property {number} FA_ERROR=1 FA_ERROR value
   */
  Records.FileAddResult = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "FA_SUCCESS")] = 0;
    values[(valuesById[1] = "FA_ERROR")] = 1;
    return values;
  })();

  /**
   * FileGetResult enum.
   * @name Records.FileGetResult
   * @enum {number}
   * @property {number} FG_SUCCESS=0 FG_SUCCESS value
   * @property {number} FG_ERROR=1 FG_ERROR value
   * @property {number} FG_ACCESS_DENIED=2 FG_ACCESS_DENIED value
   */
  Records.FileGetResult = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "FG_SUCCESS")] = 0;
    values[(valuesById[1] = "FG_ERROR")] = 1;
    values[(valuesById[2] = "FG_ACCESS_DENIED")] = 2;
    return values;
  })();

  /**
   * RecordDetailsInclude enum.
   * @name Records.RecordDetailsInclude
   * @enum {number}
   * @property {number} DATA_PLUS_SHARE=0 DATA_PLUS_SHARE value
   * @property {number} DATA_ONLY=1 DATA_ONLY value
   * @property {number} SHARE_ONLY=2 SHARE_ONLY value
   */
  Records.RecordDetailsInclude = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "DATA_PLUS_SHARE")] = 0;
    values[(valuesById[1] = "DATA_ONLY")] = 1;
    values[(valuesById[2] = "SHARE_ONLY")] = 2;
    return values;
  })();

  /**
   * CheckShareAdminObjectType enum.
   * @name Records.CheckShareAdminObjectType
   * @enum {number}
   * @property {number} CHECK_SA_INVALID_TYPE=0 CHECK_SA_INVALID_TYPE value
   * @property {number} CHECK_SA_ON_SF=1 CHECK_SA_ON_SF value
   * @property {number} CHECK_SA_ON_RECORD=2 CHECK_SA_ON_RECORD value
   */
  Records.CheckShareAdminObjectType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "CHECK_SA_INVALID_TYPE")] = 0;
    values[(valuesById[1] = "CHECK_SA_ON_SF")] = 1;
    values[(valuesById[2] = "CHECK_SA_ON_RECORD")] = 2;
    return values;
  })();

  /**
   * ShareStatus enum.
   * @name Records.ShareStatus
   * @enum {number}
   * @property {number} ACTIVE=0 ACTIVE value
   * @property {number} BLOCK=1 BLOCK value
   * @property {number} INVITED=2 INVITED value
   */
  Records.ShareStatus = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "ACTIVE")] = 0;
    values[(valuesById[1] = "BLOCK")] = 1;
    values[(valuesById[2] = "INVITED")] = 2;
    return values;
  })();

  /**
   * RecordTransactionType enum.
   * @name Records.RecordTransactionType
   * @enum {number}
   * @property {number} RTT_GENERAL=0 RTT_GENERAL value
   * @property {number} RTT_ROTATION=1 RTT_ROTATION value
   */
  Records.RecordTransactionType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "RTT_GENERAL")] = 0;
    values[(valuesById[1] = "RTT_ROTATION")] = 1;
    return values;
  })();

  /**
   * TimeLimitedAccessType enum.
   * @name Records.TimeLimitedAccessType
   * @enum {number}
   * @property {number} INVALID_TIME_LIMITED_ACCESS_TYPE=0 INVALID_TIME_LIMITED_ACCESS_TYPE value
   * @property {number} USER_ACCESS_TO_RECORD=1 USER_ACCESS_TO_RECORD value
   * @property {number} USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER=2 USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER value
   * @property {number} RECORD_ACCESS_TO_SHAREDFOLDER=3 RECORD_ACCESS_TO_SHAREDFOLDER value
   * @property {number} USER_ACCESS_TO_SHAREDFOLDER=4 USER_ACCESS_TO_SHAREDFOLDER value
   * @property {number} TEAM_ACCESS_TO_SHAREDFOLDER=5 TEAM_ACCESS_TO_SHAREDFOLDER value
   */
  Records.TimeLimitedAccessType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "INVALID_TIME_LIMITED_ACCESS_TYPE")] = 0;
    values[(valuesById[1] = "USER_ACCESS_TO_RECORD")] = 1;
    values[(valuesById[2] = "USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER")] = 2;
    values[(valuesById[3] = "RECORD_ACCESS_TO_SHAREDFOLDER")] = 3;
    values[(valuesById[4] = "USER_ACCESS_TO_SHAREDFOLDER")] = 4;
    values[(valuesById[5] = "TEAM_ACCESS_TO_SHAREDFOLDER")] = 5;
    return values;
  })();

  /**
   * TimerNotificationType enum.
   * @name Records.TimerNotificationType
   * @enum {number}
   * @property {number} NOTIFICATION_OFF=0 NOTIFICATION_OFF value
   * @property {number} NOTIFY_OWNER=1 NOTIFY_OWNER value
   * @property {number} NOTIFY_PRIVILEGED_USERS=2 NOTIFY_PRIVILEGED_USERS value
   */
  Records.TimerNotificationType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NOTIFICATION_OFF")] = 0;
    values[(valuesById[1] = "NOTIFY_OWNER")] = 1;
    values[(valuesById[2] = "NOTIFY_PRIVILEGED_USERS")] = 2;
    return values;
  })();

  Records.RecordType = (function () {
    /**
     * Properties of a RecordType.
     * @memberof Records
     * @interface IRecordType
     * @property {number|null} [recordTypeId] RecordType recordTypeId
     * @property {string|null} [content] RecordType content
     * @property {Records.RecordTypeScope|null} [scope] RecordType scope
     */

    /**
     * Constructs a new RecordType.
     * @memberof Records
     * @classdesc Represents a RecordType.
     * @implements IRecordType
     * @constructor
     * @param {Records.IRecordType=} [properties] Properties to set
     */
    function RecordType(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordType recordTypeId.
     * @member {number} recordTypeId
     * @memberof Records.RecordType
     * @instance
     */
    RecordType.prototype.recordTypeId = 0;

    /**
     * RecordType content.
     * @member {string} content
     * @memberof Records.RecordType
     * @instance
     */
    RecordType.prototype.content = "";

    /**
     * RecordType scope.
     * @member {Records.RecordTypeScope} scope
     * @memberof Records.RecordType
     * @instance
     */
    RecordType.prototype.scope = 0;

    /**
     * Creates a new RecordType instance using the specified properties.
     * @function create
     * @memberof Records.RecordType
     * @static
     * @param {Records.IRecordType=} [properties] Properties to set
     * @returns {Records.RecordType} RecordType instance
     */
    RecordType.create = function create(properties) {
      return new RecordType(properties);
    };

    /**
     * Encodes the specified RecordType message. Does not implicitly {@link Records.RecordType.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordType
     * @static
     * @param {Records.IRecordType} message RecordType message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordType.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordTypeId != null && Object.hasOwnProperty.call(message, "recordTypeId"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.recordTypeId);
      if (message.content != null && Object.hasOwnProperty.call(message, "content"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.content);
      if (message.scope != null && Object.hasOwnProperty.call(message, "scope"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.scope);
      return writer;
    };

    /**
     * Encodes the specified RecordType message, length delimited. Does not implicitly {@link Records.RecordType.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordType
     * @static
     * @param {Records.IRecordType} message RecordType message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordType.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordType message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordType
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordType} RecordType
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordType.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordType();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordTypeId = reader.int32();
            break;
          }
          case 2: {
            message.content = reader.string();
            break;
          }
          case 3: {
            message.scope = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordType message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordType
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordType} RecordType
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordType.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordType message.
     * @function verify
     * @memberof Records.RecordType
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordType.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordTypeId != null && message.hasOwnProperty("recordTypeId"))
        if (!$util.isInteger(message.recordTypeId)) return "recordTypeId: integer expected";
      if (message.content != null && message.hasOwnProperty("content"))
        if (!$util.isString(message.content)) return "content: string expected";
      if (message.scope != null && message.hasOwnProperty("scope"))
        switch (message.scope) {
          default:
            return "scope: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
            break;
        }
      return null;
    };

    /**
     * Creates a RecordType message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordType
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordType} RecordType
     */
    RecordType.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordType) return object;
      let message = new $root.Records.RecordType();
      if (object.recordTypeId != null) message.recordTypeId = object.recordTypeId | 0;
      if (object.content != null) message.content = String(object.content);
      switch (object.scope) {
        default:
          if (typeof object.scope === "number") {
            message.scope = object.scope;
            break;
          }
          break;
        case "RT_STANDARD":
        case 0:
          message.scope = 0;
          break;
        case "RT_USER":
        case 1:
          message.scope = 1;
          break;
        case "RT_ENTERPRISE":
        case 2:
          message.scope = 2;
          break;
        case "RT_PAM":
        case 3:
          message.scope = 3;
          break;
        case "RT_PAM_CONFIGURATION":
        case 4:
          message.scope = 4;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordType message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordType
     * @static
     * @param {Records.RecordType} message RecordType
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordType.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.recordTypeId = 0;
        object.content = "";
        object.scope = options.enums === String ? "RT_STANDARD" : 0;
      }
      if (message.recordTypeId != null && message.hasOwnProperty("recordTypeId"))
        object.recordTypeId = message.recordTypeId;
      if (message.content != null && message.hasOwnProperty("content"))
        object.content = message.content;
      if (message.scope != null && message.hasOwnProperty("scope"))
        object.scope =
          options.enums === String
            ? $root.Records.RecordTypeScope[message.scope] === undefined
              ? message.scope
              : $root.Records.RecordTypeScope[message.scope]
            : message.scope;
      return object;
    };

    /**
     * Converts this RecordType to JSON.
     * @function toJSON
     * @memberof Records.RecordType
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordType.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordType
     * @function getTypeUrl
     * @memberof Records.RecordType
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordType";
    };

    return RecordType;
  })();

  Records.RecordTypesRequest = (function () {
    /**
     * Properties of a RecordTypesRequest.
     * @memberof Records
     * @interface IRecordTypesRequest
     * @property {boolean|null} [standard] RecordTypesRequest standard
     * @property {boolean|null} [user] RecordTypesRequest user
     * @property {boolean|null} [enterprise] RecordTypesRequest enterprise
     * @property {boolean|null} [pam] RecordTypesRequest pam
     */

    /**
     * Constructs a new RecordTypesRequest.
     * @memberof Records
     * @classdesc Represents a RecordTypesRequest.
     * @implements IRecordTypesRequest
     * @constructor
     * @param {Records.IRecordTypesRequest=} [properties] Properties to set
     */
    function RecordTypesRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordTypesRequest standard.
     * @member {boolean} standard
     * @memberof Records.RecordTypesRequest
     * @instance
     */
    RecordTypesRequest.prototype.standard = false;

    /**
     * RecordTypesRequest user.
     * @member {boolean} user
     * @memberof Records.RecordTypesRequest
     * @instance
     */
    RecordTypesRequest.prototype.user = false;

    /**
     * RecordTypesRequest enterprise.
     * @member {boolean} enterprise
     * @memberof Records.RecordTypesRequest
     * @instance
     */
    RecordTypesRequest.prototype.enterprise = false;

    /**
     * RecordTypesRequest pam.
     * @member {boolean} pam
     * @memberof Records.RecordTypesRequest
     * @instance
     */
    RecordTypesRequest.prototype.pam = false;

    /**
     * Creates a new RecordTypesRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Records.IRecordTypesRequest=} [properties] Properties to set
     * @returns {Records.RecordTypesRequest} RecordTypesRequest instance
     */
    RecordTypesRequest.create = function create(properties) {
      return new RecordTypesRequest(properties);
    };

    /**
     * Encodes the specified RecordTypesRequest message. Does not implicitly {@link Records.RecordTypesRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Records.IRecordTypesRequest} message RecordTypesRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypesRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.standard != null && Object.hasOwnProperty.call(message, "standard"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).bool(message.standard);
      if (message.user != null && Object.hasOwnProperty.call(message, "user"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.user);
      if (message.enterprise != null && Object.hasOwnProperty.call(message, "enterprise"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.enterprise);
      if (message.pam != null && Object.hasOwnProperty.call(message, "pam"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.pam);
      return writer;
    };

    /**
     * Encodes the specified RecordTypesRequest message, length delimited. Does not implicitly {@link Records.RecordTypesRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Records.IRecordTypesRequest} message RecordTypesRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypesRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordTypesRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordTypesRequest} RecordTypesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypesRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordTypesRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.standard = reader.bool();
            break;
          }
          case 2: {
            message.user = reader.bool();
            break;
          }
          case 3: {
            message.enterprise = reader.bool();
            break;
          }
          case 4: {
            message.pam = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordTypesRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordTypesRequest} RecordTypesRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypesRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordTypesRequest message.
     * @function verify
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordTypesRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.standard != null && message.hasOwnProperty("standard"))
        if (typeof message.standard !== "boolean") return "standard: boolean expected";
      if (message.user != null && message.hasOwnProperty("user"))
        if (typeof message.user !== "boolean") return "user: boolean expected";
      if (message.enterprise != null && message.hasOwnProperty("enterprise"))
        if (typeof message.enterprise !== "boolean") return "enterprise: boolean expected";
      if (message.pam != null && message.hasOwnProperty("pam"))
        if (typeof message.pam !== "boolean") return "pam: boolean expected";
      return null;
    };

    /**
     * Creates a RecordTypesRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordTypesRequest} RecordTypesRequest
     */
    RecordTypesRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordTypesRequest) return object;
      let message = new $root.Records.RecordTypesRequest();
      if (object.standard != null) message.standard = Boolean(object.standard);
      if (object.user != null) message.user = Boolean(object.user);
      if (object.enterprise != null) message.enterprise = Boolean(object.enterprise);
      if (object.pam != null) message.pam = Boolean(object.pam);
      return message;
    };

    /**
     * Creates a plain object from a RecordTypesRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {Records.RecordTypesRequest} message RecordTypesRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordTypesRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.standard = false;
        object.user = false;
        object.enterprise = false;
        object.pam = false;
      }
      if (message.standard != null && message.hasOwnProperty("standard"))
        object.standard = message.standard;
      if (message.user != null && message.hasOwnProperty("user")) object.user = message.user;
      if (message.enterprise != null && message.hasOwnProperty("enterprise"))
        object.enterprise = message.enterprise;
      if (message.pam != null && message.hasOwnProperty("pam")) object.pam = message.pam;
      return object;
    };

    /**
     * Converts this RecordTypesRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordTypesRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordTypesRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordTypesRequest
     * @function getTypeUrl
     * @memberof Records.RecordTypesRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordTypesRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordTypesRequest";
    };

    return RecordTypesRequest;
  })();

  Records.RecordTypesResponse = (function () {
    /**
     * Properties of a RecordTypesResponse.
     * @memberof Records
     * @interface IRecordTypesResponse
     * @property {Array.<Records.IRecordType>|null} [recordTypes] RecordTypesResponse recordTypes
     * @property {number|null} [standardCounter] RecordTypesResponse standardCounter
     * @property {number|null} [userCounter] RecordTypesResponse userCounter
     * @property {number|null} [enterpriseCounter] RecordTypesResponse enterpriseCounter
     * @property {number|null} [pamCounter] RecordTypesResponse pamCounter
     */

    /**
     * Constructs a new RecordTypesResponse.
     * @memberof Records
     * @classdesc Represents a RecordTypesResponse.
     * @implements IRecordTypesResponse
     * @constructor
     * @param {Records.IRecordTypesResponse=} [properties] Properties to set
     */
    function RecordTypesResponse(properties) {
      this.recordTypes = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordTypesResponse recordTypes.
     * @member {Array.<Records.IRecordType>} recordTypes
     * @memberof Records.RecordTypesResponse
     * @instance
     */
    RecordTypesResponse.prototype.recordTypes = $util.emptyArray;

    /**
     * RecordTypesResponse standardCounter.
     * @member {number} standardCounter
     * @memberof Records.RecordTypesResponse
     * @instance
     */
    RecordTypesResponse.prototype.standardCounter = 0;

    /**
     * RecordTypesResponse userCounter.
     * @member {number} userCounter
     * @memberof Records.RecordTypesResponse
     * @instance
     */
    RecordTypesResponse.prototype.userCounter = 0;

    /**
     * RecordTypesResponse enterpriseCounter.
     * @member {number} enterpriseCounter
     * @memberof Records.RecordTypesResponse
     * @instance
     */
    RecordTypesResponse.prototype.enterpriseCounter = 0;

    /**
     * RecordTypesResponse pamCounter.
     * @member {number} pamCounter
     * @memberof Records.RecordTypesResponse
     * @instance
     */
    RecordTypesResponse.prototype.pamCounter = 0;

    /**
     * Creates a new RecordTypesResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Records.IRecordTypesResponse=} [properties] Properties to set
     * @returns {Records.RecordTypesResponse} RecordTypesResponse instance
     */
    RecordTypesResponse.create = function create(properties) {
      return new RecordTypesResponse(properties);
    };

    /**
     * Encodes the specified RecordTypesResponse message. Does not implicitly {@link Records.RecordTypesResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Records.IRecordTypesResponse} message RecordTypesResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypesResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordTypes != null && message.recordTypes.length)
        for (let i = 0; i < message.recordTypes.length; ++i)
          $root.Records.RecordType.encode(
            message.recordTypes[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.standardCounter != null && Object.hasOwnProperty.call(message, "standardCounter"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.standardCounter);
      if (message.userCounter != null && Object.hasOwnProperty.call(message, "userCounter"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.userCounter);
      if (
        message.enterpriseCounter != null &&
        Object.hasOwnProperty.call(message, "enterpriseCounter")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.enterpriseCounter);
      if (message.pamCounter != null && Object.hasOwnProperty.call(message, "pamCounter"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.pamCounter);
      return writer;
    };

    /**
     * Encodes the specified RecordTypesResponse message, length delimited. Does not implicitly {@link Records.RecordTypesResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Records.IRecordTypesResponse} message RecordTypesResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypesResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordTypesResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordTypesResponse} RecordTypesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypesResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordTypesResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordTypes && message.recordTypes.length)) message.recordTypes = [];
            message.recordTypes.push($root.Records.RecordType.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.standardCounter = reader.int32();
            break;
          }
          case 3: {
            message.userCounter = reader.int32();
            break;
          }
          case 4: {
            message.enterpriseCounter = reader.int32();
            break;
          }
          case 5: {
            message.pamCounter = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordTypesResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordTypesResponse} RecordTypesResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypesResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordTypesResponse message.
     * @function verify
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordTypesResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordTypes != null && message.hasOwnProperty("recordTypes")) {
        if (!Array.isArray(message.recordTypes)) return "recordTypes: array expected";
        for (let i = 0; i < message.recordTypes.length; ++i) {
          let error = $root.Records.RecordType.verify(message.recordTypes[i]);
          if (error) return "recordTypes." + error;
        }
      }
      if (message.standardCounter != null && message.hasOwnProperty("standardCounter"))
        if (!$util.isInteger(message.standardCounter)) return "standardCounter: integer expected";
      if (message.userCounter != null && message.hasOwnProperty("userCounter"))
        if (!$util.isInteger(message.userCounter)) return "userCounter: integer expected";
      if (message.enterpriseCounter != null && message.hasOwnProperty("enterpriseCounter"))
        if (!$util.isInteger(message.enterpriseCounter))
          return "enterpriseCounter: integer expected";
      if (message.pamCounter != null && message.hasOwnProperty("pamCounter"))
        if (!$util.isInteger(message.pamCounter)) return "pamCounter: integer expected";
      return null;
    };

    /**
     * Creates a RecordTypesResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordTypesResponse} RecordTypesResponse
     */
    RecordTypesResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordTypesResponse) return object;
      let message = new $root.Records.RecordTypesResponse();
      if (object.recordTypes) {
        if (!Array.isArray(object.recordTypes))
          throw TypeError(".Records.RecordTypesResponse.recordTypes: array expected");
        message.recordTypes = [];
        for (let i = 0; i < object.recordTypes.length; ++i) {
          if (typeof object.recordTypes[i] !== "object")
            throw TypeError(".Records.RecordTypesResponse.recordTypes: object expected");
          message.recordTypes[i] = $root.Records.RecordType.fromObject(object.recordTypes[i]);
        }
      }
      if (object.standardCounter != null) message.standardCounter = object.standardCounter | 0;
      if (object.userCounter != null) message.userCounter = object.userCounter | 0;
      if (object.enterpriseCounter != null)
        message.enterpriseCounter = object.enterpriseCounter | 0;
      if (object.pamCounter != null) message.pamCounter = object.pamCounter | 0;
      return message;
    };

    /**
     * Creates a plain object from a RecordTypesResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {Records.RecordTypesResponse} message RecordTypesResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordTypesResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordTypes = [];
      if (options.defaults) {
        object.standardCounter = 0;
        object.userCounter = 0;
        object.enterpriseCounter = 0;
        object.pamCounter = 0;
      }
      if (message.recordTypes && message.recordTypes.length) {
        object.recordTypes = [];
        for (let j = 0; j < message.recordTypes.length; ++j)
          object.recordTypes[j] = $root.Records.RecordType.toObject(
            message.recordTypes[j],
            options,
          );
      }
      if (message.standardCounter != null && message.hasOwnProperty("standardCounter"))
        object.standardCounter = message.standardCounter;
      if (message.userCounter != null && message.hasOwnProperty("userCounter"))
        object.userCounter = message.userCounter;
      if (message.enterpriseCounter != null && message.hasOwnProperty("enterpriseCounter"))
        object.enterpriseCounter = message.enterpriseCounter;
      if (message.pamCounter != null && message.hasOwnProperty("pamCounter"))
        object.pamCounter = message.pamCounter;
      return object;
    };

    /**
     * Converts this RecordTypesResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordTypesResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordTypesResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordTypesResponse
     * @function getTypeUrl
     * @memberof Records.RecordTypesResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordTypesResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordTypesResponse";
    };

    return RecordTypesResponse;
  })();

  Records.RecordTypeModifyResponse = (function () {
    /**
     * Properties of a RecordTypeModifyResponse.
     * @memberof Records
     * @interface IRecordTypeModifyResponse
     * @property {number|null} [recordTypeId] RecordTypeModifyResponse recordTypeId
     * @property {number|null} [counter] RecordTypeModifyResponse counter
     */

    /**
     * Constructs a new RecordTypeModifyResponse.
     * @memberof Records
     * @classdesc Represents a RecordTypeModifyResponse.
     * @implements IRecordTypeModifyResponse
     * @constructor
     * @param {Records.IRecordTypeModifyResponse=} [properties] Properties to set
     */
    function RecordTypeModifyResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordTypeModifyResponse recordTypeId.
     * @member {number} recordTypeId
     * @memberof Records.RecordTypeModifyResponse
     * @instance
     */
    RecordTypeModifyResponse.prototype.recordTypeId = 0;

    /**
     * RecordTypeModifyResponse counter.
     * @member {number} counter
     * @memberof Records.RecordTypeModifyResponse
     * @instance
     */
    RecordTypeModifyResponse.prototype.counter = 0;

    /**
     * Creates a new RecordTypeModifyResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Records.IRecordTypeModifyResponse=} [properties] Properties to set
     * @returns {Records.RecordTypeModifyResponse} RecordTypeModifyResponse instance
     */
    RecordTypeModifyResponse.create = function create(properties) {
      return new RecordTypeModifyResponse(properties);
    };

    /**
     * Encodes the specified RecordTypeModifyResponse message. Does not implicitly {@link Records.RecordTypeModifyResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Records.IRecordTypeModifyResponse} message RecordTypeModifyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypeModifyResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordTypeId != null && Object.hasOwnProperty.call(message, "recordTypeId"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.recordTypeId);
      if (message.counter != null && Object.hasOwnProperty.call(message, "counter"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.counter);
      return writer;
    };

    /**
     * Encodes the specified RecordTypeModifyResponse message, length delimited. Does not implicitly {@link Records.RecordTypeModifyResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Records.IRecordTypeModifyResponse} message RecordTypeModifyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordTypeModifyResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordTypeModifyResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordTypeModifyResponse} RecordTypeModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypeModifyResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordTypeModifyResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordTypeId = reader.int32();
            break;
          }
          case 2: {
            message.counter = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordTypeModifyResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordTypeModifyResponse} RecordTypeModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordTypeModifyResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordTypeModifyResponse message.
     * @function verify
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordTypeModifyResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordTypeId != null && message.hasOwnProperty("recordTypeId"))
        if (!$util.isInteger(message.recordTypeId)) return "recordTypeId: integer expected";
      if (message.counter != null && message.hasOwnProperty("counter"))
        if (!$util.isInteger(message.counter)) return "counter: integer expected";
      return null;
    };

    /**
     * Creates a RecordTypeModifyResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordTypeModifyResponse} RecordTypeModifyResponse
     */
    RecordTypeModifyResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordTypeModifyResponse) return object;
      let message = new $root.Records.RecordTypeModifyResponse();
      if (object.recordTypeId != null) message.recordTypeId = object.recordTypeId | 0;
      if (object.counter != null) message.counter = object.counter | 0;
      return message;
    };

    /**
     * Creates a plain object from a RecordTypeModifyResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {Records.RecordTypeModifyResponse} message RecordTypeModifyResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordTypeModifyResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.recordTypeId = 0;
        object.counter = 0;
      }
      if (message.recordTypeId != null && message.hasOwnProperty("recordTypeId"))
        object.recordTypeId = message.recordTypeId;
      if (message.counter != null && message.hasOwnProperty("counter"))
        object.counter = message.counter;
      return object;
    };

    /**
     * Converts this RecordTypeModifyResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordTypeModifyResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordTypeModifyResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordTypeModifyResponse
     * @function getTypeUrl
     * @memberof Records.RecordTypeModifyResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordTypeModifyResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordTypeModifyResponse";
    };

    return RecordTypeModifyResponse;
  })();

  Records.RecordsGetRequest = (function () {
    /**
     * Properties of a RecordsGetRequest.
     * @memberof Records
     * @interface IRecordsGetRequest
     * @property {Array.<Uint8Array>|null} [recordUids] RecordsGetRequest recordUids
     * @property {number|Long|null} [clientTime] RecordsGetRequest clientTime
     */

    /**
     * Constructs a new RecordsGetRequest.
     * @memberof Records
     * @classdesc Represents a RecordsGetRequest.
     * @implements IRecordsGetRequest
     * @constructor
     * @param {Records.IRecordsGetRequest=} [properties] Properties to set
     */
    function RecordsGetRequest(properties) {
      this.recordUids = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsGetRequest recordUids.
     * @member {Array.<Uint8Array>} recordUids
     * @memberof Records.RecordsGetRequest
     * @instance
     */
    RecordsGetRequest.prototype.recordUids = $util.emptyArray;

    /**
     * RecordsGetRequest clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.RecordsGetRequest
     * @instance
     */
    RecordsGetRequest.prototype.clientTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new RecordsGetRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Records.IRecordsGetRequest=} [properties] Properties to set
     * @returns {Records.RecordsGetRequest} RecordsGetRequest instance
     */
    RecordsGetRequest.create = function create(properties) {
      return new RecordsGetRequest(properties);
    };

    /**
     * Encodes the specified RecordsGetRequest message. Does not implicitly {@link Records.RecordsGetRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Records.IRecordsGetRequest} message RecordsGetRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsGetRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUids != null && message.recordUids.length)
        for (let i = 0; i < message.recordUids.length; ++i)
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUids[i]);
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientTime);
      return writer;
    };

    /**
     * Encodes the specified RecordsGetRequest message, length delimited. Does not implicitly {@link Records.RecordsGetRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Records.IRecordsGetRequest} message RecordsGetRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsGetRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsGetRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsGetRequest} RecordsGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsGetRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsGetRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordUids && message.recordUids.length)) message.recordUids = [];
            message.recordUids.push(reader.bytes());
            break;
          }
          case 2: {
            message.clientTime = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsGetRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsGetRequest} RecordsGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsGetRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsGetRequest message.
     * @function verify
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsGetRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUids != null && message.hasOwnProperty("recordUids")) {
        if (!Array.isArray(message.recordUids)) return "recordUids: array expected";
        for (let i = 0; i < message.recordUids.length; ++i)
          if (
            !(
              (message.recordUids[i] && typeof message.recordUids[i].length === "number") ||
              $util.isString(message.recordUids[i])
            )
          )
            return "recordUids: buffer[] expected";
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      return null;
    };

    /**
     * Creates a RecordsGetRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsGetRequest} RecordsGetRequest
     */
    RecordsGetRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsGetRequest) return object;
      let message = new $root.Records.RecordsGetRequest();
      if (object.recordUids) {
        if (!Array.isArray(object.recordUids))
          throw TypeError(".Records.RecordsGetRequest.recordUids: array expected");
        message.recordUids = [];
        for (let i = 0; i < object.recordUids.length; ++i)
          if (typeof object.recordUids[i] === "string")
            $util.base64.decode(
              object.recordUids[i],
              (message.recordUids[i] = $util.newBuffer($util.base64.length(object.recordUids[i]))),
              0,
            );
          else if (object.recordUids[i].length >= 0) message.recordUids[i] = object.recordUids[i];
      }
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a RecordsGetRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {Records.RecordsGetRequest} message RecordsGetRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsGetRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordUids = [];
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
      if (message.recordUids && message.recordUids.length) {
        object.recordUids = [];
        for (let j = 0; j < message.recordUids.length; ++j)
          object.recordUids[j] =
            options.bytes === String
              ? $util.base64.encode(message.recordUids[j], 0, message.recordUids[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordUids[j])
                : message.recordUids[j];
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      return object;
    };

    /**
     * Converts this RecordsGetRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsGetRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsGetRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsGetRequest
     * @function getTypeUrl
     * @memberof Records.RecordsGetRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsGetRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsGetRequest";
    };

    return RecordsGetRequest;
  })();

  Records.Record = (function () {
    /**
     * Properties of a Record.
     * @memberof Records
     * @interface IRecord
     * @property {Uint8Array|null} [recordUid] Record recordUid
     * @property {Uint8Array|null} [recordKey] Record recordKey
     * @property {Records.RecordKeyType|null} [recordKeyType] Record recordKeyType
     * @property {Uint8Array|null} [data] Record data
     * @property {Uint8Array|null} [extra] Record extra
     * @property {number|null} [version] Record version
     * @property {number|Long|null} [clientModifiedTime] Record clientModifiedTime
     * @property {number|Long|null} [revision] Record revision
     * @property {Array.<Uint8Array>|null} [fileIds] Record fileIds
     */

    /**
     * Constructs a new Record.
     * @memberof Records
     * @classdesc Represents a Record.
     * @implements IRecord
     * @constructor
     * @param {Records.IRecord=} [properties] Properties to set
     */
    function Record(properties) {
      this.fileIds = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Record recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.recordUid = $util.newBuffer([]);

    /**
     * Record recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.recordKey = $util.newBuffer([]);

    /**
     * Record recordKeyType.
     * @member {Records.RecordKeyType} recordKeyType
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.recordKeyType = 0;

    /**
     * Record data.
     * @member {Uint8Array} data
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.data = $util.newBuffer([]);

    /**
     * Record extra.
     * @member {Uint8Array} extra
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.extra = $util.newBuffer([]);

    /**
     * Record version.
     * @member {number} version
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.version = 0;

    /**
     * Record clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.clientModifiedTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Record revision.
     * @member {number|Long} revision
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Record fileIds.
     * @member {Array.<Uint8Array>} fileIds
     * @memberof Records.Record
     * @instance
     */
    Record.prototype.fileIds = $util.emptyArray;

    /**
     * Creates a new Record instance using the specified properties.
     * @function create
     * @memberof Records.Record
     * @static
     * @param {Records.IRecord=} [properties] Properties to set
     * @returns {Records.Record} Record instance
     */
    Record.create = function create(properties) {
      return new Record(properties);
    };

    /**
     * Encodes the specified Record message. Does not implicitly {@link Records.Record.verify|verify} messages.
     * @function encode
     * @memberof Records.Record
     * @static
     * @param {Records.IRecord} message Record message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Record.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordKey);
      if (message.recordKeyType != null && Object.hasOwnProperty.call(message, "recordKeyType"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.recordKeyType);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.extra != null && Object.hasOwnProperty.call(message, "extra"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.extra);
      if (message.version != null && Object.hasOwnProperty.call(message, "version"))
        writer.uint32(/* id 6, wireType 0 =*/ 48).int32(message.version);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 7, wireType 0 =*/ 56).int64(message.clientModifiedTime);
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 8, wireType 0 =*/ 64).int64(message.revision);
      if (message.fileIds != null && message.fileIds.length)
        for (let i = 0; i < message.fileIds.length; ++i)
          writer.uint32(/* id 9, wireType 2 =*/ 74).bytes(message.fileIds[i]);
      return writer;
    };

    /**
     * Encodes the specified Record message, length delimited. Does not implicitly {@link Records.Record.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.Record
     * @static
     * @param {Records.IRecord} message Record message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Record.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Record message from the specified reader or buffer.
     * @function decode
     * @memberof Records.Record
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.Record} Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Record.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.Record();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordKey = reader.bytes();
            break;
          }
          case 3: {
            message.recordKeyType = reader.int32();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.extra = reader.bytes();
            break;
          }
          case 6: {
            message.version = reader.int32();
            break;
          }
          case 7: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 8: {
            message.revision = reader.int64();
            break;
          }
          case 9: {
            if (!(message.fileIds && message.fileIds.length)) message.fileIds = [];
            message.fileIds.push(reader.bytes());
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a Record message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.Record
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.Record} Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Record.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Record message.
     * @function verify
     * @memberof Records.Record
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Record.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.recordKeyType != null && message.hasOwnProperty("recordKeyType"))
        switch (message.recordKeyType) {
          default:
            return "recordKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.extra != null && message.hasOwnProperty("extra"))
        if (
          !(
            (message.extra && typeof message.extra.length === "number") ||
            $util.isString(message.extra)
          )
        )
          return "extra: buffer expected";
      if (message.version != null && message.hasOwnProperty("version"))
        if (!$util.isInteger(message.version)) return "version: integer expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.fileIds != null && message.hasOwnProperty("fileIds")) {
        if (!Array.isArray(message.fileIds)) return "fileIds: array expected";
        for (let i = 0; i < message.fileIds.length; ++i)
          if (
            !(
              (message.fileIds[i] && typeof message.fileIds[i].length === "number") ||
              $util.isString(message.fileIds[i])
            )
          )
            return "fileIds: buffer[] expected";
      }
      return null;
    };

    /**
     * Creates a Record message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.Record
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.Record} Record
     */
    Record.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.Record) return object;
      let message = new $root.Records.Record();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      switch (object.recordKeyType) {
        default:
          if (typeof object.recordKeyType === "number") {
            message.recordKeyType = object.recordKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.recordKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.recordKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.recordKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.recordKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.recordKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.recordKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.recordKeyType = 6;
          break;
      }
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.extra != null)
        if (typeof object.extra === "string")
          $util.base64.decode(
            object.extra,
            (message.extra = $util.newBuffer($util.base64.length(object.extra))),
            0,
          );
        else if (object.extra.length >= 0) message.extra = object.extra;
      if (object.version != null) message.version = object.version | 0;
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.fileIds) {
        if (!Array.isArray(object.fileIds))
          throw TypeError(".Records.Record.fileIds: array expected");
        message.fileIds = [];
        for (let i = 0; i < object.fileIds.length; ++i)
          if (typeof object.fileIds[i] === "string")
            $util.base64.decode(
              object.fileIds[i],
              (message.fileIds[i] = $util.newBuffer($util.base64.length(object.fileIds[i]))),
              0,
            );
          else if (object.fileIds[i].length >= 0) message.fileIds[i] = object.fileIds[i];
      }
      return message;
    };

    /**
     * Creates a plain object from a Record message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.Record
     * @static
     * @param {Records.Record} message Record
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Record.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.fileIds = [];
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        object.recordKeyType = options.enums === String ? "NO_KEY" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if (options.bytes === String) object.extra = "";
        else {
          object.extra = [];
          if (options.bytes !== Array) object.extra = $util.newBuffer(object.extra);
        }
        object.version = 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.recordKeyType != null && message.hasOwnProperty("recordKeyType"))
        object.recordKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.recordKeyType] === undefined
              ? message.recordKeyType
              : $root.Records.RecordKeyType[message.recordKeyType]
            : message.recordKeyType;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.extra != null && message.hasOwnProperty("extra"))
        object.extra =
          options.bytes === String
            ? $util.base64.encode(message.extra, 0, message.extra.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.extra)
              : message.extra;
      if (message.version != null && message.hasOwnProperty("version"))
        object.version = message.version;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.fileIds && message.fileIds.length) {
        object.fileIds = [];
        for (let j = 0; j < message.fileIds.length; ++j)
          object.fileIds[j] =
            options.bytes === String
              ? $util.base64.encode(message.fileIds[j], 0, message.fileIds[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.fileIds[j])
                : message.fileIds[j];
      }
      return object;
    };

    /**
     * Converts this Record to JSON.
     * @function toJSON
     * @memberof Records.Record
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Record.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Record
     * @function getTypeUrl
     * @memberof Records.Record
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Record.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.Record";
    };

    return Record;
  })();

  Records.FolderRecordKey = (function () {
    /**
     * Properties of a FolderRecordKey.
     * @memberof Records
     * @interface IFolderRecordKey
     * @property {Uint8Array|null} [folderUid] FolderRecordKey folderUid
     * @property {Uint8Array|null} [recordUid] FolderRecordKey recordUid
     * @property {Uint8Array|null} [recordKey] FolderRecordKey recordKey
     */

    /**
     * Constructs a new FolderRecordKey.
     * @memberof Records
     * @classdesc Represents a FolderRecordKey.
     * @implements IFolderRecordKey
     * @constructor
     * @param {Records.IFolderRecordKey=} [properties] Properties to set
     */
    function FolderRecordKey(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FolderRecordKey folderUid.
     * @member {Uint8Array} folderUid
     * @memberof Records.FolderRecordKey
     * @instance
     */
    FolderRecordKey.prototype.folderUid = $util.newBuffer([]);

    /**
     * FolderRecordKey recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.FolderRecordKey
     * @instance
     */
    FolderRecordKey.prototype.recordUid = $util.newBuffer([]);

    /**
     * FolderRecordKey recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.FolderRecordKey
     * @instance
     */
    FolderRecordKey.prototype.recordKey = $util.newBuffer([]);

    /**
     * Creates a new FolderRecordKey instance using the specified properties.
     * @function create
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Records.IFolderRecordKey=} [properties] Properties to set
     * @returns {Records.FolderRecordKey} FolderRecordKey instance
     */
    FolderRecordKey.create = function create(properties) {
      return new FolderRecordKey(properties);
    };

    /**
     * Encodes the specified FolderRecordKey message. Does not implicitly {@link Records.FolderRecordKey.verify|verify} messages.
     * @function encode
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Records.IFolderRecordKey} message FolderRecordKey message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FolderRecordKey.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.folderUid != null && Object.hasOwnProperty.call(message, "folderUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.folderUid);
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.recordKey);
      return writer;
    };

    /**
     * Encodes the specified FolderRecordKey message, length delimited. Does not implicitly {@link Records.FolderRecordKey.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Records.IFolderRecordKey} message FolderRecordKey message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FolderRecordKey.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FolderRecordKey message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FolderRecordKey
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FolderRecordKey} FolderRecordKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FolderRecordKey.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FolderRecordKey();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.folderUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordUid = reader.bytes();
            break;
          }
          case 3: {
            message.recordKey = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FolderRecordKey message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FolderRecordKey
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FolderRecordKey} FolderRecordKey
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FolderRecordKey.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FolderRecordKey message.
     * @function verify
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FolderRecordKey.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        if (
          !(
            (message.folderUid && typeof message.folderUid.length === "number") ||
            $util.isString(message.folderUid)
          )
        )
          return "folderUid: buffer expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      return null;
    };

    /**
     * Creates a FolderRecordKey message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FolderRecordKey} FolderRecordKey
     */
    FolderRecordKey.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FolderRecordKey) return object;
      let message = new $root.Records.FolderRecordKey();
      if (object.folderUid != null)
        if (typeof object.folderUid === "string")
          $util.base64.decode(
            object.folderUid,
            (message.folderUid = $util.newBuffer($util.base64.length(object.folderUid))),
            0,
          );
        else if (object.folderUid.length >= 0) message.folderUid = object.folderUid;
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      return message;
    };

    /**
     * Creates a plain object from a FolderRecordKey message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FolderRecordKey
     * @static
     * @param {Records.FolderRecordKey} message FolderRecordKey
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FolderRecordKey.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.folderUid = "";
        else {
          object.folderUid = [];
          if (options.bytes !== Array) object.folderUid = $util.newBuffer(object.folderUid);
        }
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
      }
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        object.folderUid =
          options.bytes === String
            ? $util.base64.encode(message.folderUid, 0, message.folderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderUid)
              : message.folderUid;
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      return object;
    };

    /**
     * Converts this FolderRecordKey to JSON.
     * @function toJSON
     * @memberof Records.FolderRecordKey
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FolderRecordKey.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FolderRecordKey
     * @function getTypeUrl
     * @memberof Records.FolderRecordKey
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FolderRecordKey.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FolderRecordKey";
    };

    return FolderRecordKey;
  })();

  Records.Folder = (function () {
    /**
     * Properties of a Folder.
     * @memberof Records
     * @interface IFolder
     * @property {Uint8Array|null} [folderUid] Folder folderUid
     * @property {Uint8Array|null} [folderKey] Folder folderKey
     * @property {Records.RecordKeyType|null} [folderKeyType] Folder folderKeyType
     */

    /**
     * Constructs a new Folder.
     * @memberof Records
     * @classdesc Represents a Folder.
     * @implements IFolder
     * @constructor
     * @param {Records.IFolder=} [properties] Properties to set
     */
    function Folder(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Folder folderUid.
     * @member {Uint8Array} folderUid
     * @memberof Records.Folder
     * @instance
     */
    Folder.prototype.folderUid = $util.newBuffer([]);

    /**
     * Folder folderKey.
     * @member {Uint8Array} folderKey
     * @memberof Records.Folder
     * @instance
     */
    Folder.prototype.folderKey = $util.newBuffer([]);

    /**
     * Folder folderKeyType.
     * @member {Records.RecordKeyType} folderKeyType
     * @memberof Records.Folder
     * @instance
     */
    Folder.prototype.folderKeyType = 0;

    /**
     * Creates a new Folder instance using the specified properties.
     * @function create
     * @memberof Records.Folder
     * @static
     * @param {Records.IFolder=} [properties] Properties to set
     * @returns {Records.Folder} Folder instance
     */
    Folder.create = function create(properties) {
      return new Folder(properties);
    };

    /**
     * Encodes the specified Folder message. Does not implicitly {@link Records.Folder.verify|verify} messages.
     * @function encode
     * @memberof Records.Folder
     * @static
     * @param {Records.IFolder} message Folder message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Folder.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.folderUid != null && Object.hasOwnProperty.call(message, "folderUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.folderUid);
      if (message.folderKey != null && Object.hasOwnProperty.call(message, "folderKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.folderKey);
      if (message.folderKeyType != null && Object.hasOwnProperty.call(message, "folderKeyType"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.folderKeyType);
      return writer;
    };

    /**
     * Encodes the specified Folder message, length delimited. Does not implicitly {@link Records.Folder.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.Folder
     * @static
     * @param {Records.IFolder} message Folder message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Folder.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Folder message from the specified reader or buffer.
     * @function decode
     * @memberof Records.Folder
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.Folder} Folder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Folder.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.Folder();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.folderUid = reader.bytes();
            break;
          }
          case 2: {
            message.folderKey = reader.bytes();
            break;
          }
          case 3: {
            message.folderKeyType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a Folder message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.Folder
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.Folder} Folder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Folder.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Folder message.
     * @function verify
     * @memberof Records.Folder
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Folder.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        if (
          !(
            (message.folderUid && typeof message.folderUid.length === "number") ||
            $util.isString(message.folderUid)
          )
        )
          return "folderUid: buffer expected";
      if (message.folderKey != null && message.hasOwnProperty("folderKey"))
        if (
          !(
            (message.folderKey && typeof message.folderKey.length === "number") ||
            $util.isString(message.folderKey)
          )
        )
          return "folderKey: buffer expected";
      if (message.folderKeyType != null && message.hasOwnProperty("folderKeyType"))
        switch (message.folderKeyType) {
          default:
            return "folderKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      return null;
    };

    /**
     * Creates a Folder message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.Folder
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.Folder} Folder
     */
    Folder.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.Folder) return object;
      let message = new $root.Records.Folder();
      if (object.folderUid != null)
        if (typeof object.folderUid === "string")
          $util.base64.decode(
            object.folderUid,
            (message.folderUid = $util.newBuffer($util.base64.length(object.folderUid))),
            0,
          );
        else if (object.folderUid.length >= 0) message.folderUid = object.folderUid;
      if (object.folderKey != null)
        if (typeof object.folderKey === "string")
          $util.base64.decode(
            object.folderKey,
            (message.folderKey = $util.newBuffer($util.base64.length(object.folderKey))),
            0,
          );
        else if (object.folderKey.length >= 0) message.folderKey = object.folderKey;
      switch (object.folderKeyType) {
        default:
          if (typeof object.folderKeyType === "number") {
            message.folderKeyType = object.folderKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.folderKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.folderKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.folderKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.folderKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.folderKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.folderKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.folderKeyType = 6;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a Folder message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.Folder
     * @static
     * @param {Records.Folder} message Folder
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Folder.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.folderUid = "";
        else {
          object.folderUid = [];
          if (options.bytes !== Array) object.folderUid = $util.newBuffer(object.folderUid);
        }
        if (options.bytes === String) object.folderKey = "";
        else {
          object.folderKey = [];
          if (options.bytes !== Array) object.folderKey = $util.newBuffer(object.folderKey);
        }
        object.folderKeyType = options.enums === String ? "NO_KEY" : 0;
      }
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        object.folderUid =
          options.bytes === String
            ? $util.base64.encode(message.folderUid, 0, message.folderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderUid)
              : message.folderUid;
      if (message.folderKey != null && message.hasOwnProperty("folderKey"))
        object.folderKey =
          options.bytes === String
            ? $util.base64.encode(message.folderKey, 0, message.folderKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderKey)
              : message.folderKey;
      if (message.folderKeyType != null && message.hasOwnProperty("folderKeyType"))
        object.folderKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.folderKeyType] === undefined
              ? message.folderKeyType
              : $root.Records.RecordKeyType[message.folderKeyType]
            : message.folderKeyType;
      return object;
    };

    /**
     * Converts this Folder to JSON.
     * @function toJSON
     * @memberof Records.Folder
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Folder.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Folder
     * @function getTypeUrl
     * @memberof Records.Folder
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Folder.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.Folder";
    };

    return Folder;
  })();

  Records.Team = (function () {
    /**
     * Properties of a Team.
     * @memberof Records
     * @interface ITeam
     * @property {Uint8Array|null} [teamUid] Team teamUid
     * @property {Uint8Array|null} [teamKey] Team teamKey
     * @property {Uint8Array|null} [teamPrivateKey] Team teamPrivateKey
     * @property {Records.RecordKeyType|null} [teamKeyType] Team teamKeyType
     * @property {Array.<Records.IFolder>|null} [folders] Team folders
     */

    /**
     * Constructs a new Team.
     * @memberof Records
     * @classdesc Represents a Team.
     * @implements ITeam
     * @constructor
     * @param {Records.ITeam=} [properties] Properties to set
     */
    function Team(properties) {
      this.folders = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Team teamUid.
     * @member {Uint8Array} teamUid
     * @memberof Records.Team
     * @instance
     */
    Team.prototype.teamUid = $util.newBuffer([]);

    /**
     * Team teamKey.
     * @member {Uint8Array} teamKey
     * @memberof Records.Team
     * @instance
     */
    Team.prototype.teamKey = $util.newBuffer([]);

    /**
     * Team teamPrivateKey.
     * @member {Uint8Array} teamPrivateKey
     * @memberof Records.Team
     * @instance
     */
    Team.prototype.teamPrivateKey = $util.newBuffer([]);

    /**
     * Team teamKeyType.
     * @member {Records.RecordKeyType} teamKeyType
     * @memberof Records.Team
     * @instance
     */
    Team.prototype.teamKeyType = 0;

    /**
     * Team folders.
     * @member {Array.<Records.IFolder>} folders
     * @memberof Records.Team
     * @instance
     */
    Team.prototype.folders = $util.emptyArray;

    /**
     * Creates a new Team instance using the specified properties.
     * @function create
     * @memberof Records.Team
     * @static
     * @param {Records.ITeam=} [properties] Properties to set
     * @returns {Records.Team} Team instance
     */
    Team.create = function create(properties) {
      return new Team(properties);
    };

    /**
     * Encodes the specified Team message. Does not implicitly {@link Records.Team.verify|verify} messages.
     * @function encode
     * @memberof Records.Team
     * @static
     * @param {Records.ITeam} message Team message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Team.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.teamUid != null && Object.hasOwnProperty.call(message, "teamUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.teamUid);
      if (message.teamKey != null && Object.hasOwnProperty.call(message, "teamKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.teamKey);
      if (message.teamPrivateKey != null && Object.hasOwnProperty.call(message, "teamPrivateKey"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.teamPrivateKey);
      if (message.teamKeyType != null && Object.hasOwnProperty.call(message, "teamKeyType"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.teamKeyType);
      if (message.folders != null && message.folders.length)
        for (let i = 0; i < message.folders.length; ++i)
          $root.Records.Folder.encode(
            message.folders[i],
            writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified Team message, length delimited. Does not implicitly {@link Records.Team.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.Team
     * @static
     * @param {Records.ITeam} message Team message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Team.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Team message from the specified reader or buffer.
     * @function decode
     * @memberof Records.Team
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.Team} Team
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Team.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.Team();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.teamUid = reader.bytes();
            break;
          }
          case 2: {
            message.teamKey = reader.bytes();
            break;
          }
          case 3: {
            message.teamPrivateKey = reader.bytes();
            break;
          }
          case 4: {
            message.teamKeyType = reader.int32();
            break;
          }
          case 5: {
            if (!(message.folders && message.folders.length)) message.folders = [];
            message.folders.push($root.Records.Folder.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a Team message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.Team
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.Team} Team
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Team.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Team message.
     * @function verify
     * @memberof Records.Team
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Team.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        if (
          !(
            (message.teamUid && typeof message.teamUid.length === "number") ||
            $util.isString(message.teamUid)
          )
        )
          return "teamUid: buffer expected";
      if (message.teamKey != null && message.hasOwnProperty("teamKey"))
        if (
          !(
            (message.teamKey && typeof message.teamKey.length === "number") ||
            $util.isString(message.teamKey)
          )
        )
          return "teamKey: buffer expected";
      if (message.teamPrivateKey != null && message.hasOwnProperty("teamPrivateKey"))
        if (
          !(
            (message.teamPrivateKey && typeof message.teamPrivateKey.length === "number") ||
            $util.isString(message.teamPrivateKey)
          )
        )
          return "teamPrivateKey: buffer expected";
      if (message.teamKeyType != null && message.hasOwnProperty("teamKeyType"))
        switch (message.teamKeyType) {
          default:
            return "teamKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      if (message.folders != null && message.hasOwnProperty("folders")) {
        if (!Array.isArray(message.folders)) return "folders: array expected";
        for (let i = 0; i < message.folders.length; ++i) {
          let error = $root.Records.Folder.verify(message.folders[i]);
          if (error) return "folders." + error;
        }
      }
      return null;
    };

    /**
     * Creates a Team message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.Team
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.Team} Team
     */
    Team.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.Team) return object;
      let message = new $root.Records.Team();
      if (object.teamUid != null)
        if (typeof object.teamUid === "string")
          $util.base64.decode(
            object.teamUid,
            (message.teamUid = $util.newBuffer($util.base64.length(object.teamUid))),
            0,
          );
        else if (object.teamUid.length >= 0) message.teamUid = object.teamUid;
      if (object.teamKey != null)
        if (typeof object.teamKey === "string")
          $util.base64.decode(
            object.teamKey,
            (message.teamKey = $util.newBuffer($util.base64.length(object.teamKey))),
            0,
          );
        else if (object.teamKey.length >= 0) message.teamKey = object.teamKey;
      if (object.teamPrivateKey != null)
        if (typeof object.teamPrivateKey === "string")
          $util.base64.decode(
            object.teamPrivateKey,
            (message.teamPrivateKey = $util.newBuffer($util.base64.length(object.teamPrivateKey))),
            0,
          );
        else if (object.teamPrivateKey.length >= 0) message.teamPrivateKey = object.teamPrivateKey;
      switch (object.teamKeyType) {
        default:
          if (typeof object.teamKeyType === "number") {
            message.teamKeyType = object.teamKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.teamKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.teamKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.teamKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.teamKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.teamKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.teamKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.teamKeyType = 6;
          break;
      }
      if (object.folders) {
        if (!Array.isArray(object.folders))
          throw TypeError(".Records.Team.folders: array expected");
        message.folders = [];
        for (let i = 0; i < object.folders.length; ++i) {
          if (typeof object.folders[i] !== "object")
            throw TypeError(".Records.Team.folders: object expected");
          message.folders[i] = $root.Records.Folder.fromObject(object.folders[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a Team message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.Team
     * @static
     * @param {Records.Team} message Team
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Team.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.folders = [];
      if (options.defaults) {
        if (options.bytes === String) object.teamUid = "";
        else {
          object.teamUid = [];
          if (options.bytes !== Array) object.teamUid = $util.newBuffer(object.teamUid);
        }
        if (options.bytes === String) object.teamKey = "";
        else {
          object.teamKey = [];
          if (options.bytes !== Array) object.teamKey = $util.newBuffer(object.teamKey);
        }
        if (options.bytes === String) object.teamPrivateKey = "";
        else {
          object.teamPrivateKey = [];
          if (options.bytes !== Array)
            object.teamPrivateKey = $util.newBuffer(object.teamPrivateKey);
        }
        object.teamKeyType = options.enums === String ? "NO_KEY" : 0;
      }
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        object.teamUid =
          options.bytes === String
            ? $util.base64.encode(message.teamUid, 0, message.teamUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.teamUid)
              : message.teamUid;
      if (message.teamKey != null && message.hasOwnProperty("teamKey"))
        object.teamKey =
          options.bytes === String
            ? $util.base64.encode(message.teamKey, 0, message.teamKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.teamKey)
              : message.teamKey;
      if (message.teamPrivateKey != null && message.hasOwnProperty("teamPrivateKey"))
        object.teamPrivateKey =
          options.bytes === String
            ? $util.base64.encode(message.teamPrivateKey, 0, message.teamPrivateKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.teamPrivateKey)
              : message.teamPrivateKey;
      if (message.teamKeyType != null && message.hasOwnProperty("teamKeyType"))
        object.teamKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.teamKeyType] === undefined
              ? message.teamKeyType
              : $root.Records.RecordKeyType[message.teamKeyType]
            : message.teamKeyType;
      if (message.folders && message.folders.length) {
        object.folders = [];
        for (let j = 0; j < message.folders.length; ++j)
          object.folders[j] = $root.Records.Folder.toObject(message.folders[j], options);
      }
      return object;
    };

    /**
     * Converts this Team to JSON.
     * @function toJSON
     * @memberof Records.Team
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Team.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Team
     * @function getTypeUrl
     * @memberof Records.Team
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Team.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.Team";
    };

    return Team;
  })();

  Records.RecordsGetResponse = (function () {
    /**
     * Properties of a RecordsGetResponse.
     * @memberof Records
     * @interface IRecordsGetResponse
     * @property {Array.<Records.IRecord>|null} [records] RecordsGetResponse records
     * @property {Array.<Records.IFolderRecordKey>|null} [folderRecordKeys] RecordsGetResponse folderRecordKeys
     * @property {Array.<Records.IFolder>|null} [folders] RecordsGetResponse folders
     * @property {Array.<Records.ITeam>|null} [teams] RecordsGetResponse teams
     */

    /**
     * Constructs a new RecordsGetResponse.
     * @memberof Records
     * @classdesc Represents a RecordsGetResponse.
     * @implements IRecordsGetResponse
     * @constructor
     * @param {Records.IRecordsGetResponse=} [properties] Properties to set
     */
    function RecordsGetResponse(properties) {
      this.records = [];
      this.folderRecordKeys = [];
      this.folders = [];
      this.teams = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsGetResponse records.
     * @member {Array.<Records.IRecord>} records
     * @memberof Records.RecordsGetResponse
     * @instance
     */
    RecordsGetResponse.prototype.records = $util.emptyArray;

    /**
     * RecordsGetResponse folderRecordKeys.
     * @member {Array.<Records.IFolderRecordKey>} folderRecordKeys
     * @memberof Records.RecordsGetResponse
     * @instance
     */
    RecordsGetResponse.prototype.folderRecordKeys = $util.emptyArray;

    /**
     * RecordsGetResponse folders.
     * @member {Array.<Records.IFolder>} folders
     * @memberof Records.RecordsGetResponse
     * @instance
     */
    RecordsGetResponse.prototype.folders = $util.emptyArray;

    /**
     * RecordsGetResponse teams.
     * @member {Array.<Records.ITeam>} teams
     * @memberof Records.RecordsGetResponse
     * @instance
     */
    RecordsGetResponse.prototype.teams = $util.emptyArray;

    /**
     * Creates a new RecordsGetResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Records.IRecordsGetResponse=} [properties] Properties to set
     * @returns {Records.RecordsGetResponse} RecordsGetResponse instance
     */
    RecordsGetResponse.create = function create(properties) {
      return new RecordsGetResponse(properties);
    };

    /**
     * Encodes the specified RecordsGetResponse message. Does not implicitly {@link Records.RecordsGetResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Records.IRecordsGetResponse} message RecordsGetResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsGetResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.Record.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.folderRecordKeys != null && message.folderRecordKeys.length)
        for (let i = 0; i < message.folderRecordKeys.length; ++i)
          $root.Records.FolderRecordKey.encode(
            message.folderRecordKeys[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.folders != null && message.folders.length)
        for (let i = 0; i < message.folders.length; ++i)
          $root.Records.Folder.encode(
            message.folders[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.teams != null && message.teams.length)
        for (let i = 0; i < message.teams.length; ++i)
          $root.Records.Team.encode(
            message.teams[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsGetResponse message, length delimited. Does not implicitly {@link Records.RecordsGetResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Records.IRecordsGetResponse} message RecordsGetResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsGetResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsGetResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsGetResponse} RecordsGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsGetResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsGetResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.Record.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            if (!(message.folderRecordKeys && message.folderRecordKeys.length))
              message.folderRecordKeys = [];
            message.folderRecordKeys.push(
              $root.Records.FolderRecordKey.decode(reader, reader.uint32()),
            );
            break;
          }
          case 3: {
            if (!(message.folders && message.folders.length)) message.folders = [];
            message.folders.push($root.Records.Folder.decode(reader, reader.uint32()));
            break;
          }
          case 4: {
            if (!(message.teams && message.teams.length)) message.teams = [];
            message.teams.push($root.Records.Team.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsGetResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsGetResponse} RecordsGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsGetResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsGetResponse message.
     * @function verify
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsGetResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.Record.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      if (message.folderRecordKeys != null && message.hasOwnProperty("folderRecordKeys")) {
        if (!Array.isArray(message.folderRecordKeys)) return "folderRecordKeys: array expected";
        for (let i = 0; i < message.folderRecordKeys.length; ++i) {
          let error = $root.Records.FolderRecordKey.verify(message.folderRecordKeys[i]);
          if (error) return "folderRecordKeys." + error;
        }
      }
      if (message.folders != null && message.hasOwnProperty("folders")) {
        if (!Array.isArray(message.folders)) return "folders: array expected";
        for (let i = 0; i < message.folders.length; ++i) {
          let error = $root.Records.Folder.verify(message.folders[i]);
          if (error) return "folders." + error;
        }
      }
      if (message.teams != null && message.hasOwnProperty("teams")) {
        if (!Array.isArray(message.teams)) return "teams: array expected";
        for (let i = 0; i < message.teams.length; ++i) {
          let error = $root.Records.Team.verify(message.teams[i]);
          if (error) return "teams." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsGetResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsGetResponse} RecordsGetResponse
     */
    RecordsGetResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsGetResponse) return object;
      let message = new $root.Records.RecordsGetResponse();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsGetResponse.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsGetResponse.records: object expected");
          message.records[i] = $root.Records.Record.fromObject(object.records[i]);
        }
      }
      if (object.folderRecordKeys) {
        if (!Array.isArray(object.folderRecordKeys))
          throw TypeError(".Records.RecordsGetResponse.folderRecordKeys: array expected");
        message.folderRecordKeys = [];
        for (let i = 0; i < object.folderRecordKeys.length; ++i) {
          if (typeof object.folderRecordKeys[i] !== "object")
            throw TypeError(".Records.RecordsGetResponse.folderRecordKeys: object expected");
          message.folderRecordKeys[i] = $root.Records.FolderRecordKey.fromObject(
            object.folderRecordKeys[i],
          );
        }
      }
      if (object.folders) {
        if (!Array.isArray(object.folders))
          throw TypeError(".Records.RecordsGetResponse.folders: array expected");
        message.folders = [];
        for (let i = 0; i < object.folders.length; ++i) {
          if (typeof object.folders[i] !== "object")
            throw TypeError(".Records.RecordsGetResponse.folders: object expected");
          message.folders[i] = $root.Records.Folder.fromObject(object.folders[i]);
        }
      }
      if (object.teams) {
        if (!Array.isArray(object.teams))
          throw TypeError(".Records.RecordsGetResponse.teams: array expected");
        message.teams = [];
        for (let i = 0; i < object.teams.length; ++i) {
          if (typeof object.teams[i] !== "object")
            throw TypeError(".Records.RecordsGetResponse.teams: object expected");
          message.teams[i] = $root.Records.Team.fromObject(object.teams[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsGetResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {Records.RecordsGetResponse} message RecordsGetResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsGetResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.records = [];
        object.folderRecordKeys = [];
        object.folders = [];
        object.teams = [];
      }
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.Record.toObject(message.records[j], options);
      }
      if (message.folderRecordKeys && message.folderRecordKeys.length) {
        object.folderRecordKeys = [];
        for (let j = 0; j < message.folderRecordKeys.length; ++j)
          object.folderRecordKeys[j] = $root.Records.FolderRecordKey.toObject(
            message.folderRecordKeys[j],
            options,
          );
      }
      if (message.folders && message.folders.length) {
        object.folders = [];
        for (let j = 0; j < message.folders.length; ++j)
          object.folders[j] = $root.Records.Folder.toObject(message.folders[j], options);
      }
      if (message.teams && message.teams.length) {
        object.teams = [];
        for (let j = 0; j < message.teams.length; ++j)
          object.teams[j] = $root.Records.Team.toObject(message.teams[j], options);
      }
      return object;
    };

    /**
     * Converts this RecordsGetResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordsGetResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsGetResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsGetResponse
     * @function getTypeUrl
     * @memberof Records.RecordsGetResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsGetResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsGetResponse";
    };

    return RecordsGetResponse;
  })();

  Records.RecordLink = (function () {
    /**
     * Properties of a RecordLink.
     * @memberof Records
     * @interface IRecordLink
     * @property {Uint8Array|null} [recordUid] RecordLink recordUid
     * @property {Uint8Array|null} [recordKey] RecordLink recordKey
     */

    /**
     * Constructs a new RecordLink.
     * @memberof Records
     * @classdesc Represents a RecordLink.
     * @implements IRecordLink
     * @constructor
     * @param {Records.IRecordLink=} [properties] Properties to set
     */
    function RecordLink(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordLink recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordLink
     * @instance
     */
    RecordLink.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordLink recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.RecordLink
     * @instance
     */
    RecordLink.prototype.recordKey = $util.newBuffer([]);

    /**
     * Creates a new RecordLink instance using the specified properties.
     * @function create
     * @memberof Records.RecordLink
     * @static
     * @param {Records.IRecordLink=} [properties] Properties to set
     * @returns {Records.RecordLink} RecordLink instance
     */
    RecordLink.create = function create(properties) {
      return new RecordLink(properties);
    };

    /**
     * Encodes the specified RecordLink message. Does not implicitly {@link Records.RecordLink.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordLink
     * @static
     * @param {Records.IRecordLink} message RecordLink message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordLink.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordKey);
      return writer;
    };

    /**
     * Encodes the specified RecordLink message, length delimited. Does not implicitly {@link Records.RecordLink.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordLink
     * @static
     * @param {Records.IRecordLink} message RecordLink message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordLink.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordLink message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordLink
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordLink} RecordLink
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordLink.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordLink();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordKey = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordLink message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordLink
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordLink} RecordLink
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordLink.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordLink message.
     * @function verify
     * @memberof Records.RecordLink
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordLink.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      return null;
    };

    /**
     * Creates a RecordLink message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordLink
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordLink} RecordLink
     */
    RecordLink.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordLink) return object;
      let message = new $root.Records.RecordLink();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      return message;
    };

    /**
     * Creates a plain object from a RecordLink message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordLink
     * @static
     * @param {Records.RecordLink} message RecordLink
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordLink.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      return object;
    };

    /**
     * Converts this RecordLink to JSON.
     * @function toJSON
     * @memberof Records.RecordLink
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordLink.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordLink
     * @function getTypeUrl
     * @memberof Records.RecordLink
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordLink.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordLink";
    };

    return RecordLink;
  })();

  Records.RecordAudit = (function () {
    /**
     * Properties of a RecordAudit.
     * @memberof Records
     * @interface IRecordAudit
     * @property {number|null} [version] RecordAudit version
     * @property {Uint8Array|null} [data] RecordAudit data
     */

    /**
     * Constructs a new RecordAudit.
     * @memberof Records
     * @classdesc Represents a RecordAudit.
     * @implements IRecordAudit
     * @constructor
     * @param {Records.IRecordAudit=} [properties] Properties to set
     */
    function RecordAudit(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordAudit version.
     * @member {number} version
     * @memberof Records.RecordAudit
     * @instance
     */
    RecordAudit.prototype.version = 0;

    /**
     * RecordAudit data.
     * @member {Uint8Array} data
     * @memberof Records.RecordAudit
     * @instance
     */
    RecordAudit.prototype.data = $util.newBuffer([]);

    /**
     * Creates a new RecordAudit instance using the specified properties.
     * @function create
     * @memberof Records.RecordAudit
     * @static
     * @param {Records.IRecordAudit=} [properties] Properties to set
     * @returns {Records.RecordAudit} RecordAudit instance
     */
    RecordAudit.create = function create(properties) {
      return new RecordAudit(properties);
    };

    /**
     * Encodes the specified RecordAudit message. Does not implicitly {@link Records.RecordAudit.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordAudit
     * @static
     * @param {Records.IRecordAudit} message RecordAudit message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAudit.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.version != null && Object.hasOwnProperty.call(message, "version"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.version);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.data);
      return writer;
    };

    /**
     * Encodes the specified RecordAudit message, length delimited. Does not implicitly {@link Records.RecordAudit.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordAudit
     * @static
     * @param {Records.IRecordAudit} message RecordAudit message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAudit.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordAudit message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordAudit
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordAudit} RecordAudit
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAudit.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordAudit();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.version = reader.int32();
            break;
          }
          case 2: {
            message.data = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordAudit message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordAudit
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordAudit} RecordAudit
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAudit.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordAudit message.
     * @function verify
     * @memberof Records.RecordAudit
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordAudit.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.version != null && message.hasOwnProperty("version"))
        if (!$util.isInteger(message.version)) return "version: integer expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      return null;
    };

    /**
     * Creates a RecordAudit message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordAudit
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordAudit} RecordAudit
     */
    RecordAudit.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordAudit) return object;
      let message = new $root.Records.RecordAudit();
      if (object.version != null) message.version = object.version | 0;
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      return message;
    };

    /**
     * Creates a plain object from a RecordAudit message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordAudit
     * @static
     * @param {Records.RecordAudit} message RecordAudit
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordAudit.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.version = 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
      }
      if (message.version != null && message.hasOwnProperty("version"))
        object.version = message.version;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      return object;
    };

    /**
     * Converts this RecordAudit to JSON.
     * @function toJSON
     * @memberof Records.RecordAudit
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordAudit.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordAudit
     * @function getTypeUrl
     * @memberof Records.RecordAudit
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordAudit.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordAudit";
    };

    return RecordAudit;
  })();

  Records.SecurityData = (function () {
    /**
     * Properties of a SecurityData.
     * @memberof Records
     * @interface ISecurityData
     * @property {Uint8Array|null} [data] SecurityData data
     */

    /**
     * Constructs a new SecurityData.
     * @memberof Records
     * @classdesc Represents a SecurityData.
     * @implements ISecurityData
     * @constructor
     * @param {Records.ISecurityData=} [properties] Properties to set
     */
    function SecurityData(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SecurityData data.
     * @member {Uint8Array} data
     * @memberof Records.SecurityData
     * @instance
     */
    SecurityData.prototype.data = $util.newBuffer([]);

    /**
     * Creates a new SecurityData instance using the specified properties.
     * @function create
     * @memberof Records.SecurityData
     * @static
     * @param {Records.ISecurityData=} [properties] Properties to set
     * @returns {Records.SecurityData} SecurityData instance
     */
    SecurityData.create = function create(properties) {
      return new SecurityData(properties);
    };

    /**
     * Encodes the specified SecurityData message. Does not implicitly {@link Records.SecurityData.verify|verify} messages.
     * @function encode
     * @memberof Records.SecurityData
     * @static
     * @param {Records.ISecurityData} message SecurityData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SecurityData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.data);
      return writer;
    };

    /**
     * Encodes the specified SecurityData message, length delimited. Does not implicitly {@link Records.SecurityData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.SecurityData
     * @static
     * @param {Records.ISecurityData} message SecurityData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SecurityData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SecurityData message from the specified reader or buffer.
     * @function decode
     * @memberof Records.SecurityData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.SecurityData} SecurityData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SecurityData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.SecurityData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.data = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a SecurityData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.SecurityData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.SecurityData} SecurityData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SecurityData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SecurityData message.
     * @function verify
     * @memberof Records.SecurityData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SecurityData.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      return null;
    };

    /**
     * Creates a SecurityData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.SecurityData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.SecurityData} SecurityData
     */
    SecurityData.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.SecurityData) return object;
      let message = new $root.Records.SecurityData();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      return message;
    };

    /**
     * Creates a plain object from a SecurityData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.SecurityData
     * @static
     * @param {Records.SecurityData} message SecurityData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SecurityData.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      return object;
    };

    /**
     * Converts this SecurityData to JSON.
     * @function toJSON
     * @memberof Records.SecurityData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SecurityData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SecurityData
     * @function getTypeUrl
     * @memberof Records.SecurityData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SecurityData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.SecurityData";
    };

    return SecurityData;
  })();

  Records.SecurityScoreData = (function () {
    /**
     * Properties of a SecurityScoreData.
     * @memberof Records
     * @interface ISecurityScoreData
     * @property {Uint8Array|null} [data] SecurityScoreData data
     */

    /**
     * Constructs a new SecurityScoreData.
     * @memberof Records
     * @classdesc Represents a SecurityScoreData.
     * @implements ISecurityScoreData
     * @constructor
     * @param {Records.ISecurityScoreData=} [properties] Properties to set
     */
    function SecurityScoreData(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SecurityScoreData data.
     * @member {Uint8Array} data
     * @memberof Records.SecurityScoreData
     * @instance
     */
    SecurityScoreData.prototype.data = $util.newBuffer([]);

    /**
     * Creates a new SecurityScoreData instance using the specified properties.
     * @function create
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Records.ISecurityScoreData=} [properties] Properties to set
     * @returns {Records.SecurityScoreData} SecurityScoreData instance
     */
    SecurityScoreData.create = function create(properties) {
      return new SecurityScoreData(properties);
    };

    /**
     * Encodes the specified SecurityScoreData message. Does not implicitly {@link Records.SecurityScoreData.verify|verify} messages.
     * @function encode
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Records.ISecurityScoreData} message SecurityScoreData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SecurityScoreData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.data);
      return writer;
    };

    /**
     * Encodes the specified SecurityScoreData message, length delimited. Does not implicitly {@link Records.SecurityScoreData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Records.ISecurityScoreData} message SecurityScoreData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SecurityScoreData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SecurityScoreData message from the specified reader or buffer.
     * @function decode
     * @memberof Records.SecurityScoreData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.SecurityScoreData} SecurityScoreData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SecurityScoreData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.SecurityScoreData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.data = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a SecurityScoreData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.SecurityScoreData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.SecurityScoreData} SecurityScoreData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SecurityScoreData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SecurityScoreData message.
     * @function verify
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SecurityScoreData.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      return null;
    };

    /**
     * Creates a SecurityScoreData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.SecurityScoreData} SecurityScoreData
     */
    SecurityScoreData.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.SecurityScoreData) return object;
      let message = new $root.Records.SecurityScoreData();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      return message;
    };

    /**
     * Creates a plain object from a SecurityScoreData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.SecurityScoreData
     * @static
     * @param {Records.SecurityScoreData} message SecurityScoreData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SecurityScoreData.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      return object;
    };

    /**
     * Converts this SecurityScoreData to JSON.
     * @function toJSON
     * @memberof Records.SecurityScoreData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SecurityScoreData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SecurityScoreData
     * @function getTypeUrl
     * @memberof Records.SecurityScoreData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SecurityScoreData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.SecurityScoreData";
    };

    return SecurityScoreData;
  })();

  Records.RecordAdd = (function () {
    /**
     * Properties of a RecordAdd.
     * @memberof Records
     * @interface IRecordAdd
     * @property {Uint8Array|null} [recordUid] RecordAdd recordUid
     * @property {Uint8Array|null} [recordKey] RecordAdd recordKey
     * @property {number|Long|null} [clientModifiedTime] RecordAdd clientModifiedTime
     * @property {Uint8Array|null} [data] RecordAdd data
     * @property {Uint8Array|null} [nonSharedData] RecordAdd nonSharedData
     * @property {Records.RecordFolderType|null} [folderType] RecordAdd folderType
     * @property {Uint8Array|null} [folderUid] RecordAdd folderUid
     * @property {Uint8Array|null} [folderKey] RecordAdd folderKey
     * @property {Array.<Records.IRecordLink>|null} [recordLinks] RecordAdd recordLinks
     * @property {Records.IRecordAudit|null} [audit] RecordAdd audit
     * @property {Records.ISecurityData|null} [securityData] RecordAdd securityData
     * @property {Records.ISecurityScoreData|null} [securityScoreData] RecordAdd securityScoreData
     */

    /**
     * Constructs a new RecordAdd.
     * @memberof Records
     * @classdesc Represents a RecordAdd.
     * @implements IRecordAdd
     * @constructor
     * @param {Records.IRecordAdd=} [properties] Properties to set
     */
    function RecordAdd(properties) {
      this.recordLinks = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordAdd recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordAdd recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.recordKey = $util.newBuffer([]);

    /**
     * RecordAdd clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.clientModifiedTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordAdd data.
     * @member {Uint8Array} data
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.data = $util.newBuffer([]);

    /**
     * RecordAdd nonSharedData.
     * @member {Uint8Array} nonSharedData
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.nonSharedData = $util.newBuffer([]);

    /**
     * RecordAdd folderType.
     * @member {Records.RecordFolderType} folderType
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.folderType = 0;

    /**
     * RecordAdd folderUid.
     * @member {Uint8Array} folderUid
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.folderUid = $util.newBuffer([]);

    /**
     * RecordAdd folderKey.
     * @member {Uint8Array} folderKey
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.folderKey = $util.newBuffer([]);

    /**
     * RecordAdd recordLinks.
     * @member {Array.<Records.IRecordLink>} recordLinks
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.recordLinks = $util.emptyArray;

    /**
     * RecordAdd audit.
     * @member {Records.IRecordAudit|null|undefined} audit
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.audit = null;

    /**
     * RecordAdd securityData.
     * @member {Records.ISecurityData|null|undefined} securityData
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.securityData = null;

    /**
     * RecordAdd securityScoreData.
     * @member {Records.ISecurityScoreData|null|undefined} securityScoreData
     * @memberof Records.RecordAdd
     * @instance
     */
    RecordAdd.prototype.securityScoreData = null;

    /**
     * Creates a new RecordAdd instance using the specified properties.
     * @function create
     * @memberof Records.RecordAdd
     * @static
     * @param {Records.IRecordAdd=} [properties] Properties to set
     * @returns {Records.RecordAdd} RecordAdd instance
     */
    RecordAdd.create = function create(properties) {
      return new RecordAdd(properties);
    };

    /**
     * Encodes the specified RecordAdd message. Does not implicitly {@link Records.RecordAdd.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordAdd
     * @static
     * @param {Records.IRecordAdd} message RecordAdd message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAdd.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordKey);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.clientModifiedTime);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.nonSharedData != null && Object.hasOwnProperty.call(message, "nonSharedData"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.nonSharedData);
      if (message.folderType != null && Object.hasOwnProperty.call(message, "folderType"))
        writer.uint32(/* id 6, wireType 0 =*/ 48).int32(message.folderType);
      if (message.folderUid != null && Object.hasOwnProperty.call(message, "folderUid"))
        writer.uint32(/* id 7, wireType 2 =*/ 58).bytes(message.folderUid);
      if (message.folderKey != null && Object.hasOwnProperty.call(message, "folderKey"))
        writer.uint32(/* id 8, wireType 2 =*/ 66).bytes(message.folderKey);
      if (message.recordLinks != null && message.recordLinks.length)
        for (let i = 0; i < message.recordLinks.length; ++i)
          $root.Records.RecordLink.encode(
            message.recordLinks[i],
            writer.uint32(/* id 9, wireType 2 =*/ 74).fork(),
          ).ldelim();
      if (message.audit != null && Object.hasOwnProperty.call(message, "audit"))
        $root.Records.RecordAudit.encode(
          message.audit,
          writer.uint32(/* id 10, wireType 2 =*/ 82).fork(),
        ).ldelim();
      if (message.securityData != null && Object.hasOwnProperty.call(message, "securityData"))
        $root.Records.SecurityData.encode(
          message.securityData,
          writer.uint32(/* id 11, wireType 2 =*/ 90).fork(),
        ).ldelim();
      if (
        message.securityScoreData != null &&
        Object.hasOwnProperty.call(message, "securityScoreData")
      )
        $root.Records.SecurityScoreData.encode(
          message.securityScoreData,
          writer.uint32(/* id 12, wireType 2 =*/ 98).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordAdd message, length delimited. Does not implicitly {@link Records.RecordAdd.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordAdd
     * @static
     * @param {Records.IRecordAdd} message RecordAdd message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAdd.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordAdd message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordAdd
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordAdd} RecordAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAdd.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordAdd();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordKey = reader.bytes();
            break;
          }
          case 3: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.nonSharedData = reader.bytes();
            break;
          }
          case 6: {
            message.folderType = reader.int32();
            break;
          }
          case 7: {
            message.folderUid = reader.bytes();
            break;
          }
          case 8: {
            message.folderKey = reader.bytes();
            break;
          }
          case 9: {
            if (!(message.recordLinks && message.recordLinks.length)) message.recordLinks = [];
            message.recordLinks.push($root.Records.RecordLink.decode(reader, reader.uint32()));
            break;
          }
          case 10: {
            message.audit = $root.Records.RecordAudit.decode(reader, reader.uint32());
            break;
          }
          case 11: {
            message.securityData = $root.Records.SecurityData.decode(reader, reader.uint32());
            break;
          }
          case 12: {
            message.securityScoreData = $root.Records.SecurityScoreData.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordAdd message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordAdd
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordAdd} RecordAdd
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAdd.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordAdd message.
     * @function verify
     * @memberof Records.RecordAdd
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordAdd.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        if (
          !(
            (message.nonSharedData && typeof message.nonSharedData.length === "number") ||
            $util.isString(message.nonSharedData)
          )
        )
          return "nonSharedData: buffer expected";
      if (message.folderType != null && message.hasOwnProperty("folderType"))
        switch (message.folderType) {
          default:
            return "folderType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        if (
          !(
            (message.folderUid && typeof message.folderUid.length === "number") ||
            $util.isString(message.folderUid)
          )
        )
          return "folderUid: buffer expected";
      if (message.folderKey != null && message.hasOwnProperty("folderKey"))
        if (
          !(
            (message.folderKey && typeof message.folderKey.length === "number") ||
            $util.isString(message.folderKey)
          )
        )
          return "folderKey: buffer expected";
      if (message.recordLinks != null && message.hasOwnProperty("recordLinks")) {
        if (!Array.isArray(message.recordLinks)) return "recordLinks: array expected";
        for (let i = 0; i < message.recordLinks.length; ++i) {
          let error = $root.Records.RecordLink.verify(message.recordLinks[i]);
          if (error) return "recordLinks." + error;
        }
      }
      if (message.audit != null && message.hasOwnProperty("audit")) {
        let error = $root.Records.RecordAudit.verify(message.audit);
        if (error) return "audit." + error;
      }
      if (message.securityData != null && message.hasOwnProperty("securityData")) {
        let error = $root.Records.SecurityData.verify(message.securityData);
        if (error) return "securityData." + error;
      }
      if (message.securityScoreData != null && message.hasOwnProperty("securityScoreData")) {
        let error = $root.Records.SecurityScoreData.verify(message.securityScoreData);
        if (error) return "securityScoreData." + error;
      }
      return null;
    };

    /**
     * Creates a RecordAdd message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordAdd
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordAdd} RecordAdd
     */
    RecordAdd.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordAdd) return object;
      let message = new $root.Records.RecordAdd();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.nonSharedData != null)
        if (typeof object.nonSharedData === "string")
          $util.base64.decode(
            object.nonSharedData,
            (message.nonSharedData = $util.newBuffer($util.base64.length(object.nonSharedData))),
            0,
          );
        else if (object.nonSharedData.length >= 0) message.nonSharedData = object.nonSharedData;
      switch (object.folderType) {
        default:
          if (typeof object.folderType === "number") {
            message.folderType = object.folderType;
            break;
          }
          break;
        case "user_folder":
        case 0:
          message.folderType = 0;
          break;
        case "shared_folder":
        case 1:
          message.folderType = 1;
          break;
        case "shared_folder_folder":
        case 2:
          message.folderType = 2;
          break;
      }
      if (object.folderUid != null)
        if (typeof object.folderUid === "string")
          $util.base64.decode(
            object.folderUid,
            (message.folderUid = $util.newBuffer($util.base64.length(object.folderUid))),
            0,
          );
        else if (object.folderUid.length >= 0) message.folderUid = object.folderUid;
      if (object.folderKey != null)
        if (typeof object.folderKey === "string")
          $util.base64.decode(
            object.folderKey,
            (message.folderKey = $util.newBuffer($util.base64.length(object.folderKey))),
            0,
          );
        else if (object.folderKey.length >= 0) message.folderKey = object.folderKey;
      if (object.recordLinks) {
        if (!Array.isArray(object.recordLinks))
          throw TypeError(".Records.RecordAdd.recordLinks: array expected");
        message.recordLinks = [];
        for (let i = 0; i < object.recordLinks.length; ++i) {
          if (typeof object.recordLinks[i] !== "object")
            throw TypeError(".Records.RecordAdd.recordLinks: object expected");
          message.recordLinks[i] = $root.Records.RecordLink.fromObject(object.recordLinks[i]);
        }
      }
      if (object.audit != null) {
        if (typeof object.audit !== "object")
          throw TypeError(".Records.RecordAdd.audit: object expected");
        message.audit = $root.Records.RecordAudit.fromObject(object.audit);
      }
      if (object.securityData != null) {
        if (typeof object.securityData !== "object")
          throw TypeError(".Records.RecordAdd.securityData: object expected");
        message.securityData = $root.Records.SecurityData.fromObject(object.securityData);
      }
      if (object.securityScoreData != null) {
        if (typeof object.securityScoreData !== "object")
          throw TypeError(".Records.RecordAdd.securityScoreData: object expected");
        message.securityScoreData = $root.Records.SecurityScoreData.fromObject(
          object.securityScoreData,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordAdd message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordAdd
     * @static
     * @param {Records.RecordAdd} message RecordAdd
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordAdd.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordLinks = [];
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if (options.bytes === String) object.nonSharedData = "";
        else {
          object.nonSharedData = [];
          if (options.bytes !== Array) object.nonSharedData = $util.newBuffer(object.nonSharedData);
        }
        object.folderType = options.enums === String ? "user_folder" : 0;
        if (options.bytes === String) object.folderUid = "";
        else {
          object.folderUid = [];
          if (options.bytes !== Array) object.folderUid = $util.newBuffer(object.folderUid);
        }
        if (options.bytes === String) object.folderKey = "";
        else {
          object.folderKey = [];
          if (options.bytes !== Array) object.folderKey = $util.newBuffer(object.folderKey);
        }
        object.audit = null;
        object.securityData = null;
        object.securityScoreData = null;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        object.nonSharedData =
          options.bytes === String
            ? $util.base64.encode(message.nonSharedData, 0, message.nonSharedData.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.nonSharedData)
              : message.nonSharedData;
      if (message.folderType != null && message.hasOwnProperty("folderType"))
        object.folderType =
          options.enums === String
            ? $root.Records.RecordFolderType[message.folderType] === undefined
              ? message.folderType
              : $root.Records.RecordFolderType[message.folderType]
            : message.folderType;
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        object.folderUid =
          options.bytes === String
            ? $util.base64.encode(message.folderUid, 0, message.folderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderUid)
              : message.folderUid;
      if (message.folderKey != null && message.hasOwnProperty("folderKey"))
        object.folderKey =
          options.bytes === String
            ? $util.base64.encode(message.folderKey, 0, message.folderKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderKey)
              : message.folderKey;
      if (message.recordLinks && message.recordLinks.length) {
        object.recordLinks = [];
        for (let j = 0; j < message.recordLinks.length; ++j)
          object.recordLinks[j] = $root.Records.RecordLink.toObject(
            message.recordLinks[j],
            options,
          );
      }
      if (message.audit != null && message.hasOwnProperty("audit"))
        object.audit = $root.Records.RecordAudit.toObject(message.audit, options);
      if (message.securityData != null && message.hasOwnProperty("securityData"))
        object.securityData = $root.Records.SecurityData.toObject(message.securityData, options);
      if (message.securityScoreData != null && message.hasOwnProperty("securityScoreData"))
        object.securityScoreData = $root.Records.SecurityScoreData.toObject(
          message.securityScoreData,
          options,
        );
      return object;
    };

    /**
     * Converts this RecordAdd to JSON.
     * @function toJSON
     * @memberof Records.RecordAdd
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordAdd.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordAdd
     * @function getTypeUrl
     * @memberof Records.RecordAdd
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordAdd.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordAdd";
    };

    return RecordAdd;
  })();

  Records.RecordsAddRequest = (function () {
    /**
     * Properties of a RecordsAddRequest.
     * @memberof Records
     * @interface IRecordsAddRequest
     * @property {Array.<Records.IRecordAdd>|null} [records] RecordsAddRequest records
     * @property {number|Long|null} [clientTime] RecordsAddRequest clientTime
     * @property {Records.RecordKeyType|null} [securityDataKeyType] RecordsAddRequest securityDataKeyType
     */

    /**
     * Constructs a new RecordsAddRequest.
     * @memberof Records
     * @classdesc Represents a RecordsAddRequest.
     * @implements IRecordsAddRequest
     * @constructor
     * @param {Records.IRecordsAddRequest=} [properties] Properties to set
     */
    function RecordsAddRequest(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsAddRequest records.
     * @member {Array.<Records.IRecordAdd>} records
     * @memberof Records.RecordsAddRequest
     * @instance
     */
    RecordsAddRequest.prototype.records = $util.emptyArray;

    /**
     * RecordsAddRequest clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.RecordsAddRequest
     * @instance
     */
    RecordsAddRequest.prototype.clientTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordsAddRequest securityDataKeyType.
     * @member {Records.RecordKeyType} securityDataKeyType
     * @memberof Records.RecordsAddRequest
     * @instance
     */
    RecordsAddRequest.prototype.securityDataKeyType = 0;

    /**
     * Creates a new RecordsAddRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Records.IRecordsAddRequest=} [properties] Properties to set
     * @returns {Records.RecordsAddRequest} RecordsAddRequest instance
     */
    RecordsAddRequest.create = function create(properties) {
      return new RecordsAddRequest(properties);
    };

    /**
     * Encodes the specified RecordsAddRequest message. Does not implicitly {@link Records.RecordsAddRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Records.IRecordsAddRequest} message RecordsAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsAddRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordAdd.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientTime);
      if (
        message.securityDataKeyType != null &&
        Object.hasOwnProperty.call(message, "securityDataKeyType")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.securityDataKeyType);
      return writer;
    };

    /**
     * Encodes the specified RecordsAddRequest message, length delimited. Does not implicitly {@link Records.RecordsAddRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Records.IRecordsAddRequest} message RecordsAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsAddRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsAddRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsAddRequest} RecordsAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsAddRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsAddRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordAdd.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.clientTime = reader.int64();
            break;
          }
          case 3: {
            message.securityDataKeyType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsAddRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsAddRequest} RecordsAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsAddRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsAddRequest message.
     * @function verify
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsAddRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordAdd.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      if (message.securityDataKeyType != null && message.hasOwnProperty("securityDataKeyType"))
        switch (message.securityDataKeyType) {
          default:
            return "securityDataKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      return null;
    };

    /**
     * Creates a RecordsAddRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsAddRequest} RecordsAddRequest
     */
    RecordsAddRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsAddRequest) return object;
      let message = new $root.Records.RecordsAddRequest();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsAddRequest.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsAddRequest.records: object expected");
          message.records[i] = $root.Records.RecordAdd.fromObject(object.records[i]);
        }
      }
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      switch (object.securityDataKeyType) {
        default:
          if (typeof object.securityDataKeyType === "number") {
            message.securityDataKeyType = object.securityDataKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.securityDataKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.securityDataKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.securityDataKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.securityDataKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.securityDataKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.securityDataKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.securityDataKeyType = 6;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsAddRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {Records.RecordsAddRequest} message RecordsAddRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsAddRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (options.defaults) {
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
        object.securityDataKeyType = options.enums === String ? "NO_KEY" : 0;
      }
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordAdd.toObject(message.records[j], options);
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      if (message.securityDataKeyType != null && message.hasOwnProperty("securityDataKeyType"))
        object.securityDataKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.securityDataKeyType] === undefined
              ? message.securityDataKeyType
              : $root.Records.RecordKeyType[message.securityDataKeyType]
            : message.securityDataKeyType;
      return object;
    };

    /**
     * Converts this RecordsAddRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsAddRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsAddRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsAddRequest
     * @function getTypeUrl
     * @memberof Records.RecordsAddRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsAddRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsAddRequest";
    };

    return RecordsAddRequest;
  })();

  Records.RecordUpdate = (function () {
    /**
     * Properties of a RecordUpdate.
     * @memberof Records
     * @interface IRecordUpdate
     * @property {Uint8Array|null} [recordUid] RecordUpdate recordUid
     * @property {number|Long|null} [clientModifiedTime] RecordUpdate clientModifiedTime
     * @property {number|Long|null} [revision] RecordUpdate revision
     * @property {Uint8Array|null} [data] RecordUpdate data
     * @property {Uint8Array|null} [nonSharedData] RecordUpdate nonSharedData
     * @property {Array.<Records.IRecordLink>|null} [recordLinksAdd] RecordUpdate recordLinksAdd
     * @property {Array.<Uint8Array>|null} [recordLinksRemove] RecordUpdate recordLinksRemove
     * @property {Records.IRecordAudit|null} [audit] RecordUpdate audit
     * @property {Records.ISecurityData|null} [securityData] RecordUpdate securityData
     * @property {Records.ISecurityScoreData|null} [securityScoreData] RecordUpdate securityScoreData
     */

    /**
     * Constructs a new RecordUpdate.
     * @memberof Records
     * @classdesc Represents a RecordUpdate.
     * @implements IRecordUpdate
     * @constructor
     * @param {Records.IRecordUpdate=} [properties] Properties to set
     */
    function RecordUpdate(properties) {
      this.recordLinksAdd = [];
      this.recordLinksRemove = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordUpdate recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordUpdate clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.clientModifiedTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordUpdate revision.
     * @member {number|Long} revision
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordUpdate data.
     * @member {Uint8Array} data
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.data = $util.newBuffer([]);

    /**
     * RecordUpdate nonSharedData.
     * @member {Uint8Array} nonSharedData
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.nonSharedData = $util.newBuffer([]);

    /**
     * RecordUpdate recordLinksAdd.
     * @member {Array.<Records.IRecordLink>} recordLinksAdd
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.recordLinksAdd = $util.emptyArray;

    /**
     * RecordUpdate recordLinksRemove.
     * @member {Array.<Uint8Array>} recordLinksRemove
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.recordLinksRemove = $util.emptyArray;

    /**
     * RecordUpdate audit.
     * @member {Records.IRecordAudit|null|undefined} audit
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.audit = null;

    /**
     * RecordUpdate securityData.
     * @member {Records.ISecurityData|null|undefined} securityData
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.securityData = null;

    /**
     * RecordUpdate securityScoreData.
     * @member {Records.ISecurityScoreData|null|undefined} securityScoreData
     * @memberof Records.RecordUpdate
     * @instance
     */
    RecordUpdate.prototype.securityScoreData = null;

    /**
     * Creates a new RecordUpdate instance using the specified properties.
     * @function create
     * @memberof Records.RecordUpdate
     * @static
     * @param {Records.IRecordUpdate=} [properties] Properties to set
     * @returns {Records.RecordUpdate} RecordUpdate instance
     */
    RecordUpdate.create = function create(properties) {
      return new RecordUpdate(properties);
    };

    /**
     * Encodes the specified RecordUpdate message. Does not implicitly {@link Records.RecordUpdate.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordUpdate
     * @static
     * @param {Records.IRecordUpdate} message RecordUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordUpdate.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientModifiedTime);
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.revision);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.nonSharedData != null && Object.hasOwnProperty.call(message, "nonSharedData"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.nonSharedData);
      if (message.recordLinksAdd != null && message.recordLinksAdd.length)
        for (let i = 0; i < message.recordLinksAdd.length; ++i)
          $root.Records.RecordLink.encode(
            message.recordLinksAdd[i],
            writer.uint32(/* id 6, wireType 2 =*/ 50).fork(),
          ).ldelim();
      if (message.recordLinksRemove != null && message.recordLinksRemove.length)
        for (let i = 0; i < message.recordLinksRemove.length; ++i)
          writer.uint32(/* id 7, wireType 2 =*/ 58).bytes(message.recordLinksRemove[i]);
      if (message.audit != null && Object.hasOwnProperty.call(message, "audit"))
        $root.Records.RecordAudit.encode(
          message.audit,
          writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
        ).ldelim();
      if (message.securityData != null && Object.hasOwnProperty.call(message, "securityData"))
        $root.Records.SecurityData.encode(
          message.securityData,
          writer.uint32(/* id 9, wireType 2 =*/ 74).fork(),
        ).ldelim();
      if (
        message.securityScoreData != null &&
        Object.hasOwnProperty.call(message, "securityScoreData")
      )
        $root.Records.SecurityScoreData.encode(
          message.securityScoreData,
          writer.uint32(/* id 10, wireType 2 =*/ 82).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordUpdate message, length delimited. Does not implicitly {@link Records.RecordUpdate.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordUpdate
     * @static
     * @param {Records.IRecordUpdate} message RecordUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordUpdate.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordUpdate message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordUpdate} RecordUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordUpdate.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordUpdate();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 3: {
            message.revision = reader.int64();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.nonSharedData = reader.bytes();
            break;
          }
          case 6: {
            if (!(message.recordLinksAdd && message.recordLinksAdd.length))
              message.recordLinksAdd = [];
            message.recordLinksAdd.push($root.Records.RecordLink.decode(reader, reader.uint32()));
            break;
          }
          case 7: {
            if (!(message.recordLinksRemove && message.recordLinksRemove.length))
              message.recordLinksRemove = [];
            message.recordLinksRemove.push(reader.bytes());
            break;
          }
          case 8: {
            message.audit = $root.Records.RecordAudit.decode(reader, reader.uint32());
            break;
          }
          case 9: {
            message.securityData = $root.Records.SecurityData.decode(reader, reader.uint32());
            break;
          }
          case 10: {
            message.securityScoreData = $root.Records.SecurityScoreData.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordUpdate message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordUpdate} RecordUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordUpdate.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordUpdate message.
     * @function verify
     * @memberof Records.RecordUpdate
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordUpdate.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        if (
          !(
            (message.nonSharedData && typeof message.nonSharedData.length === "number") ||
            $util.isString(message.nonSharedData)
          )
        )
          return "nonSharedData: buffer expected";
      if (message.recordLinksAdd != null && message.hasOwnProperty("recordLinksAdd")) {
        if (!Array.isArray(message.recordLinksAdd)) return "recordLinksAdd: array expected";
        for (let i = 0; i < message.recordLinksAdd.length; ++i) {
          let error = $root.Records.RecordLink.verify(message.recordLinksAdd[i]);
          if (error) return "recordLinksAdd." + error;
        }
      }
      if (message.recordLinksRemove != null && message.hasOwnProperty("recordLinksRemove")) {
        if (!Array.isArray(message.recordLinksRemove)) return "recordLinksRemove: array expected";
        for (let i = 0; i < message.recordLinksRemove.length; ++i)
          if (
            !(
              (message.recordLinksRemove[i] &&
                typeof message.recordLinksRemove[i].length === "number") ||
              $util.isString(message.recordLinksRemove[i])
            )
          )
            return "recordLinksRemove: buffer[] expected";
      }
      if (message.audit != null && message.hasOwnProperty("audit")) {
        let error = $root.Records.RecordAudit.verify(message.audit);
        if (error) return "audit." + error;
      }
      if (message.securityData != null && message.hasOwnProperty("securityData")) {
        let error = $root.Records.SecurityData.verify(message.securityData);
        if (error) return "securityData." + error;
      }
      if (message.securityScoreData != null && message.hasOwnProperty("securityScoreData")) {
        let error = $root.Records.SecurityScoreData.verify(message.securityScoreData);
        if (error) return "securityScoreData." + error;
      }
      return null;
    };

    /**
     * Creates a RecordUpdate message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordUpdate
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordUpdate} RecordUpdate
     */
    RecordUpdate.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordUpdate) return object;
      let message = new $root.Records.RecordUpdate();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.nonSharedData != null)
        if (typeof object.nonSharedData === "string")
          $util.base64.decode(
            object.nonSharedData,
            (message.nonSharedData = $util.newBuffer($util.base64.length(object.nonSharedData))),
            0,
          );
        else if (object.nonSharedData.length >= 0) message.nonSharedData = object.nonSharedData;
      if (object.recordLinksAdd) {
        if (!Array.isArray(object.recordLinksAdd))
          throw TypeError(".Records.RecordUpdate.recordLinksAdd: array expected");
        message.recordLinksAdd = [];
        for (let i = 0; i < object.recordLinksAdd.length; ++i) {
          if (typeof object.recordLinksAdd[i] !== "object")
            throw TypeError(".Records.RecordUpdate.recordLinksAdd: object expected");
          message.recordLinksAdd[i] = $root.Records.RecordLink.fromObject(object.recordLinksAdd[i]);
        }
      }
      if (object.recordLinksRemove) {
        if (!Array.isArray(object.recordLinksRemove))
          throw TypeError(".Records.RecordUpdate.recordLinksRemove: array expected");
        message.recordLinksRemove = [];
        for (let i = 0; i < object.recordLinksRemove.length; ++i)
          if (typeof object.recordLinksRemove[i] === "string")
            $util.base64.decode(
              object.recordLinksRemove[i],
              (message.recordLinksRemove[i] = $util.newBuffer(
                $util.base64.length(object.recordLinksRemove[i]),
              )),
              0,
            );
          else if (object.recordLinksRemove[i].length >= 0)
            message.recordLinksRemove[i] = object.recordLinksRemove[i];
      }
      if (object.audit != null) {
        if (typeof object.audit !== "object")
          throw TypeError(".Records.RecordUpdate.audit: object expected");
        message.audit = $root.Records.RecordAudit.fromObject(object.audit);
      }
      if (object.securityData != null) {
        if (typeof object.securityData !== "object")
          throw TypeError(".Records.RecordUpdate.securityData: object expected");
        message.securityData = $root.Records.SecurityData.fromObject(object.securityData);
      }
      if (object.securityScoreData != null) {
        if (typeof object.securityScoreData !== "object")
          throw TypeError(".Records.RecordUpdate.securityScoreData: object expected");
        message.securityScoreData = $root.Records.SecurityScoreData.fromObject(
          object.securityScoreData,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordUpdate message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordUpdate
     * @static
     * @param {Records.RecordUpdate} message RecordUpdate
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordUpdate.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.recordLinksAdd = [];
        object.recordLinksRemove = [];
      }
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if (options.bytes === String) object.nonSharedData = "";
        else {
          object.nonSharedData = [];
          if (options.bytes !== Array) object.nonSharedData = $util.newBuffer(object.nonSharedData);
        }
        object.audit = null;
        object.securityData = null;
        object.securityScoreData = null;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        object.nonSharedData =
          options.bytes === String
            ? $util.base64.encode(message.nonSharedData, 0, message.nonSharedData.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.nonSharedData)
              : message.nonSharedData;
      if (message.recordLinksAdd && message.recordLinksAdd.length) {
        object.recordLinksAdd = [];
        for (let j = 0; j < message.recordLinksAdd.length; ++j)
          object.recordLinksAdd[j] = $root.Records.RecordLink.toObject(
            message.recordLinksAdd[j],
            options,
          );
      }
      if (message.recordLinksRemove && message.recordLinksRemove.length) {
        object.recordLinksRemove = [];
        for (let j = 0; j < message.recordLinksRemove.length; ++j)
          object.recordLinksRemove[j] =
            options.bytes === String
              ? $util.base64.encode(
                  message.recordLinksRemove[j],
                  0,
                  message.recordLinksRemove[j].length,
                )
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordLinksRemove[j])
                : message.recordLinksRemove[j];
      }
      if (message.audit != null && message.hasOwnProperty("audit"))
        object.audit = $root.Records.RecordAudit.toObject(message.audit, options);
      if (message.securityData != null && message.hasOwnProperty("securityData"))
        object.securityData = $root.Records.SecurityData.toObject(message.securityData, options);
      if (message.securityScoreData != null && message.hasOwnProperty("securityScoreData"))
        object.securityScoreData = $root.Records.SecurityScoreData.toObject(
          message.securityScoreData,
          options,
        );
      return object;
    };

    /**
     * Converts this RecordUpdate to JSON.
     * @function toJSON
     * @memberof Records.RecordUpdate
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordUpdate.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordUpdate
     * @function getTypeUrl
     * @memberof Records.RecordUpdate
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordUpdate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordUpdate";
    };

    return RecordUpdate;
  })();

  Records.RecordsUpdateRequest = (function () {
    /**
     * Properties of a RecordsUpdateRequest.
     * @memberof Records
     * @interface IRecordsUpdateRequest
     * @property {Array.<Records.IRecordUpdate>|null} [records] RecordsUpdateRequest records
     * @property {number|Long|null} [clientTime] RecordsUpdateRequest clientTime
     * @property {Records.RecordKeyType|null} [securityDataKeyType] RecordsUpdateRequest securityDataKeyType
     */

    /**
     * Constructs a new RecordsUpdateRequest.
     * @memberof Records
     * @classdesc Represents a RecordsUpdateRequest.
     * @implements IRecordsUpdateRequest
     * @constructor
     * @param {Records.IRecordsUpdateRequest=} [properties] Properties to set
     */
    function RecordsUpdateRequest(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUpdateRequest records.
     * @member {Array.<Records.IRecordUpdate>} records
     * @memberof Records.RecordsUpdateRequest
     * @instance
     */
    RecordsUpdateRequest.prototype.records = $util.emptyArray;

    /**
     * RecordsUpdateRequest clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.RecordsUpdateRequest
     * @instance
     */
    RecordsUpdateRequest.prototype.clientTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordsUpdateRequest securityDataKeyType.
     * @member {Records.RecordKeyType} securityDataKeyType
     * @memberof Records.RecordsUpdateRequest
     * @instance
     */
    RecordsUpdateRequest.prototype.securityDataKeyType = 0;

    /**
     * Creates a new RecordsUpdateRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Records.IRecordsUpdateRequest=} [properties] Properties to set
     * @returns {Records.RecordsUpdateRequest} RecordsUpdateRequest instance
     */
    RecordsUpdateRequest.create = function create(properties) {
      return new RecordsUpdateRequest(properties);
    };

    /**
     * Encodes the specified RecordsUpdateRequest message. Does not implicitly {@link Records.RecordsUpdateRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Records.IRecordsUpdateRequest} message RecordsUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUpdateRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordUpdate.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientTime);
      if (
        message.securityDataKeyType != null &&
        Object.hasOwnProperty.call(message, "securityDataKeyType")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.securityDataKeyType);
      return writer;
    };

    /**
     * Encodes the specified RecordsUpdateRequest message, length delimited. Does not implicitly {@link Records.RecordsUpdateRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Records.IRecordsUpdateRequest} message RecordsUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUpdateRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUpdateRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUpdateRequest} RecordsUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUpdateRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUpdateRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordUpdate.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.clientTime = reader.int64();
            break;
          }
          case 3: {
            message.securityDataKeyType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUpdateRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUpdateRequest} RecordsUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUpdateRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUpdateRequest message.
     * @function verify
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUpdateRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordUpdate.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      if (message.securityDataKeyType != null && message.hasOwnProperty("securityDataKeyType"))
        switch (message.securityDataKeyType) {
          default:
            return "securityDataKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      return null;
    };

    /**
     * Creates a RecordsUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUpdateRequest} RecordsUpdateRequest
     */
    RecordsUpdateRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUpdateRequest) return object;
      let message = new $root.Records.RecordsUpdateRequest();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsUpdateRequest.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsUpdateRequest.records: object expected");
          message.records[i] = $root.Records.RecordUpdate.fromObject(object.records[i]);
        }
      }
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      switch (object.securityDataKeyType) {
        default:
          if (typeof object.securityDataKeyType === "number") {
            message.securityDataKeyType = object.securityDataKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.securityDataKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.securityDataKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.securityDataKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.securityDataKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.securityDataKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.securityDataKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.securityDataKeyType = 6;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsUpdateRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {Records.RecordsUpdateRequest} message RecordsUpdateRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUpdateRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (options.defaults) {
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
        object.securityDataKeyType = options.enums === String ? "NO_KEY" : 0;
      }
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordUpdate.toObject(message.records[j], options);
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      if (message.securityDataKeyType != null && message.hasOwnProperty("securityDataKeyType"))
        object.securityDataKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.securityDataKeyType] === undefined
              ? message.securityDataKeyType
              : $root.Records.RecordKeyType[message.securityDataKeyType]
            : message.securityDataKeyType;
      return object;
    };

    /**
     * Converts this RecordsUpdateRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsUpdateRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUpdateRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUpdateRequest
     * @function getTypeUrl
     * @memberof Records.RecordsUpdateRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUpdateRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUpdateRequest";
    };

    return RecordsUpdateRequest;
  })();

  Records.RecordFileForConversion = (function () {
    /**
     * Properties of a RecordFileForConversion.
     * @memberof Records
     * @interface IRecordFileForConversion
     * @property {Uint8Array|null} [recordUid] RecordFileForConversion recordUid
     * @property {string|null} [fileFileId] RecordFileForConversion fileFileId
     * @property {string|null} [thumbFileId] RecordFileForConversion thumbFileId
     * @property {Uint8Array|null} [data] RecordFileForConversion data
     * @property {Uint8Array|null} [recordKey] RecordFileForConversion recordKey
     * @property {Uint8Array|null} [linkKey] RecordFileForConversion linkKey
     */

    /**
     * Constructs a new RecordFileForConversion.
     * @memberof Records
     * @classdesc Represents a RecordFileForConversion.
     * @implements IRecordFileForConversion
     * @constructor
     * @param {Records.IRecordFileForConversion=} [properties] Properties to set
     */
    function RecordFileForConversion(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordFileForConversion recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordFileForConversion fileFileId.
     * @member {string} fileFileId
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.fileFileId = "";

    /**
     * RecordFileForConversion thumbFileId.
     * @member {string} thumbFileId
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.thumbFileId = "";

    /**
     * RecordFileForConversion data.
     * @member {Uint8Array} data
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.data = $util.newBuffer([]);

    /**
     * RecordFileForConversion recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.recordKey = $util.newBuffer([]);

    /**
     * RecordFileForConversion linkKey.
     * @member {Uint8Array} linkKey
     * @memberof Records.RecordFileForConversion
     * @instance
     */
    RecordFileForConversion.prototype.linkKey = $util.newBuffer([]);

    /**
     * Creates a new RecordFileForConversion instance using the specified properties.
     * @function create
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Records.IRecordFileForConversion=} [properties] Properties to set
     * @returns {Records.RecordFileForConversion} RecordFileForConversion instance
     */
    RecordFileForConversion.create = function create(properties) {
      return new RecordFileForConversion(properties);
    };

    /**
     * Encodes the specified RecordFileForConversion message. Does not implicitly {@link Records.RecordFileForConversion.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Records.IRecordFileForConversion} message RecordFileForConversion message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordFileForConversion.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.fileFileId != null && Object.hasOwnProperty.call(message, "fileFileId"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.fileFileId);
      if (message.thumbFileId != null && Object.hasOwnProperty.call(message, "thumbFileId"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.thumbFileId);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.recordKey);
      if (message.linkKey != null && Object.hasOwnProperty.call(message, "linkKey"))
        writer.uint32(/* id 6, wireType 2 =*/ 50).bytes(message.linkKey);
      return writer;
    };

    /**
     * Encodes the specified RecordFileForConversion message, length delimited. Does not implicitly {@link Records.RecordFileForConversion.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Records.IRecordFileForConversion} message RecordFileForConversion message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordFileForConversion.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordFileForConversion message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordFileForConversion} RecordFileForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordFileForConversion.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordFileForConversion();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.fileFileId = reader.string();
            break;
          }
          case 3: {
            message.thumbFileId = reader.string();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.recordKey = reader.bytes();
            break;
          }
          case 6: {
            message.linkKey = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordFileForConversion message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordFileForConversion} RecordFileForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordFileForConversion.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordFileForConversion message.
     * @function verify
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordFileForConversion.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.fileFileId != null && message.hasOwnProperty("fileFileId"))
        if (!$util.isString(message.fileFileId)) return "fileFileId: string expected";
      if (message.thumbFileId != null && message.hasOwnProperty("thumbFileId"))
        if (!$util.isString(message.thumbFileId)) return "thumbFileId: string expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.linkKey != null && message.hasOwnProperty("linkKey"))
        if (
          !(
            (message.linkKey && typeof message.linkKey.length === "number") ||
            $util.isString(message.linkKey)
          )
        )
          return "linkKey: buffer expected";
      return null;
    };

    /**
     * Creates a RecordFileForConversion message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordFileForConversion} RecordFileForConversion
     */
    RecordFileForConversion.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordFileForConversion) return object;
      let message = new $root.Records.RecordFileForConversion();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.fileFileId != null) message.fileFileId = String(object.fileFileId);
      if (object.thumbFileId != null) message.thumbFileId = String(object.thumbFileId);
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.linkKey != null)
        if (typeof object.linkKey === "string")
          $util.base64.decode(
            object.linkKey,
            (message.linkKey = $util.newBuffer($util.base64.length(object.linkKey))),
            0,
          );
        else if (object.linkKey.length >= 0) message.linkKey = object.linkKey;
      return message;
    };

    /**
     * Creates a plain object from a RecordFileForConversion message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {Records.RecordFileForConversion} message RecordFileForConversion
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordFileForConversion.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.fileFileId = "";
        object.thumbFileId = "";
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if (options.bytes === String) object.linkKey = "";
        else {
          object.linkKey = [];
          if (options.bytes !== Array) object.linkKey = $util.newBuffer(object.linkKey);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.fileFileId != null && message.hasOwnProperty("fileFileId"))
        object.fileFileId = message.fileFileId;
      if (message.thumbFileId != null && message.hasOwnProperty("thumbFileId"))
        object.thumbFileId = message.thumbFileId;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.linkKey != null && message.hasOwnProperty("linkKey"))
        object.linkKey =
          options.bytes === String
            ? $util.base64.encode(message.linkKey, 0, message.linkKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.linkKey)
              : message.linkKey;
      return object;
    };

    /**
     * Converts this RecordFileForConversion to JSON.
     * @function toJSON
     * @memberof Records.RecordFileForConversion
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordFileForConversion.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordFileForConversion
     * @function getTypeUrl
     * @memberof Records.RecordFileForConversion
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordFileForConversion.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordFileForConversion";
    };

    return RecordFileForConversion;
  })();

  Records.RecordFolderForConversion = (function () {
    /**
     * Properties of a RecordFolderForConversion.
     * @memberof Records
     * @interface IRecordFolderForConversion
     * @property {Uint8Array|null} [folderUid] RecordFolderForConversion folderUid
     * @property {Uint8Array|null} [recordFolderKey] RecordFolderForConversion recordFolderKey
     */

    /**
     * Constructs a new RecordFolderForConversion.
     * @memberof Records
     * @classdesc Represents a RecordFolderForConversion.
     * @implements IRecordFolderForConversion
     * @constructor
     * @param {Records.IRecordFolderForConversion=} [properties] Properties to set
     */
    function RecordFolderForConversion(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordFolderForConversion folderUid.
     * @member {Uint8Array} folderUid
     * @memberof Records.RecordFolderForConversion
     * @instance
     */
    RecordFolderForConversion.prototype.folderUid = $util.newBuffer([]);

    /**
     * RecordFolderForConversion recordFolderKey.
     * @member {Uint8Array} recordFolderKey
     * @memberof Records.RecordFolderForConversion
     * @instance
     */
    RecordFolderForConversion.prototype.recordFolderKey = $util.newBuffer([]);

    /**
     * Creates a new RecordFolderForConversion instance using the specified properties.
     * @function create
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Records.IRecordFolderForConversion=} [properties] Properties to set
     * @returns {Records.RecordFolderForConversion} RecordFolderForConversion instance
     */
    RecordFolderForConversion.create = function create(properties) {
      return new RecordFolderForConversion(properties);
    };

    /**
     * Encodes the specified RecordFolderForConversion message. Does not implicitly {@link Records.RecordFolderForConversion.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Records.IRecordFolderForConversion} message RecordFolderForConversion message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordFolderForConversion.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.folderUid != null && Object.hasOwnProperty.call(message, "folderUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.folderUid);
      if (message.recordFolderKey != null && Object.hasOwnProperty.call(message, "recordFolderKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordFolderKey);
      return writer;
    };

    /**
     * Encodes the specified RecordFolderForConversion message, length delimited. Does not implicitly {@link Records.RecordFolderForConversion.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Records.IRecordFolderForConversion} message RecordFolderForConversion message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordFolderForConversion.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordFolderForConversion message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordFolderForConversion} RecordFolderForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordFolderForConversion.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordFolderForConversion();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.folderUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordFolderKey = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordFolderForConversion message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordFolderForConversion} RecordFolderForConversion
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordFolderForConversion.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordFolderForConversion message.
     * @function verify
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordFolderForConversion.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        if (
          !(
            (message.folderUid && typeof message.folderUid.length === "number") ||
            $util.isString(message.folderUid)
          )
        )
          return "folderUid: buffer expected";
      if (message.recordFolderKey != null && message.hasOwnProperty("recordFolderKey"))
        if (
          !(
            (message.recordFolderKey && typeof message.recordFolderKey.length === "number") ||
            $util.isString(message.recordFolderKey)
          )
        )
          return "recordFolderKey: buffer expected";
      return null;
    };

    /**
     * Creates a RecordFolderForConversion message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordFolderForConversion} RecordFolderForConversion
     */
    RecordFolderForConversion.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordFolderForConversion) return object;
      let message = new $root.Records.RecordFolderForConversion();
      if (object.folderUid != null)
        if (typeof object.folderUid === "string")
          $util.base64.decode(
            object.folderUid,
            (message.folderUid = $util.newBuffer($util.base64.length(object.folderUid))),
            0,
          );
        else if (object.folderUid.length >= 0) message.folderUid = object.folderUid;
      if (object.recordFolderKey != null)
        if (typeof object.recordFolderKey === "string")
          $util.base64.decode(
            object.recordFolderKey,
            (message.recordFolderKey = $util.newBuffer(
              $util.base64.length(object.recordFolderKey),
            )),
            0,
          );
        else if (object.recordFolderKey.length >= 0)
          message.recordFolderKey = object.recordFolderKey;
      return message;
    };

    /**
     * Creates a plain object from a RecordFolderForConversion message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {Records.RecordFolderForConversion} message RecordFolderForConversion
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordFolderForConversion.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.folderUid = "";
        else {
          object.folderUid = [];
          if (options.bytes !== Array) object.folderUid = $util.newBuffer(object.folderUid);
        }
        if (options.bytes === String) object.recordFolderKey = "";
        else {
          object.recordFolderKey = [];
          if (options.bytes !== Array)
            object.recordFolderKey = $util.newBuffer(object.recordFolderKey);
        }
      }
      if (message.folderUid != null && message.hasOwnProperty("folderUid"))
        object.folderUid =
          options.bytes === String
            ? $util.base64.encode(message.folderUid, 0, message.folderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.folderUid)
              : message.folderUid;
      if (message.recordFolderKey != null && message.hasOwnProperty("recordFolderKey"))
        object.recordFolderKey =
          options.bytes === String
            ? $util.base64.encode(message.recordFolderKey, 0, message.recordFolderKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordFolderKey)
              : message.recordFolderKey;
      return object;
    };

    /**
     * Converts this RecordFolderForConversion to JSON.
     * @function toJSON
     * @memberof Records.RecordFolderForConversion
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordFolderForConversion.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordFolderForConversion
     * @function getTypeUrl
     * @memberof Records.RecordFolderForConversion
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordFolderForConversion.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordFolderForConversion";
    };

    return RecordFolderForConversion;
  })();

  Records.RecordConvertToV3 = (function () {
    /**
     * Properties of a RecordConvertToV3.
     * @memberof Records
     * @interface IRecordConvertToV3
     * @property {Uint8Array|null} [recordUid] RecordConvertToV3 recordUid
     * @property {number|Long|null} [clientModifiedTime] RecordConvertToV3 clientModifiedTime
     * @property {number|Long|null} [revision] RecordConvertToV3 revision
     * @property {Uint8Array|null} [data] RecordConvertToV3 data
     * @property {Uint8Array|null} [nonSharedData] RecordConvertToV3 nonSharedData
     * @property {Records.IRecordAudit|null} [audit] RecordConvertToV3 audit
     * @property {Array.<Records.IRecordFileForConversion>|null} [recordFile] RecordConvertToV3 recordFile
     * @property {Array.<Records.IRecordFolderForConversion>|null} [folderKey] RecordConvertToV3 folderKey
     */

    /**
     * Constructs a new RecordConvertToV3.
     * @memberof Records
     * @classdesc Represents a RecordConvertToV3.
     * @implements IRecordConvertToV3
     * @constructor
     * @param {Records.IRecordConvertToV3=} [properties] Properties to set
     */
    function RecordConvertToV3(properties) {
      this.recordFile = [];
      this.folderKey = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordConvertToV3 recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordConvertToV3 clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.clientModifiedTime = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * RecordConvertToV3 revision.
     * @member {number|Long} revision
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordConvertToV3 data.
     * @member {Uint8Array} data
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.data = $util.newBuffer([]);

    /**
     * RecordConvertToV3 nonSharedData.
     * @member {Uint8Array} nonSharedData
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.nonSharedData = $util.newBuffer([]);

    /**
     * RecordConvertToV3 audit.
     * @member {Records.IRecordAudit|null|undefined} audit
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.audit = null;

    /**
     * RecordConvertToV3 recordFile.
     * @member {Array.<Records.IRecordFileForConversion>} recordFile
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.recordFile = $util.emptyArray;

    /**
     * RecordConvertToV3 folderKey.
     * @member {Array.<Records.IRecordFolderForConversion>} folderKey
     * @memberof Records.RecordConvertToV3
     * @instance
     */
    RecordConvertToV3.prototype.folderKey = $util.emptyArray;

    /**
     * Creates a new RecordConvertToV3 instance using the specified properties.
     * @function create
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Records.IRecordConvertToV3=} [properties] Properties to set
     * @returns {Records.RecordConvertToV3} RecordConvertToV3 instance
     */
    RecordConvertToV3.create = function create(properties) {
      return new RecordConvertToV3(properties);
    };

    /**
     * Encodes the specified RecordConvertToV3 message. Does not implicitly {@link Records.RecordConvertToV3.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Records.IRecordConvertToV3} message RecordConvertToV3 message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordConvertToV3.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientModifiedTime);
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.revision);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.nonSharedData != null && Object.hasOwnProperty.call(message, "nonSharedData"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.nonSharedData);
      if (message.audit != null && Object.hasOwnProperty.call(message, "audit"))
        $root.Records.RecordAudit.encode(
          message.audit,
          writer.uint32(/* id 6, wireType 2 =*/ 50).fork(),
        ).ldelim();
      if (message.recordFile != null && message.recordFile.length)
        for (let i = 0; i < message.recordFile.length; ++i)
          $root.Records.RecordFileForConversion.encode(
            message.recordFile[i],
            writer.uint32(/* id 7, wireType 2 =*/ 58).fork(),
          ).ldelim();
      if (message.folderKey != null && message.folderKey.length)
        for (let i = 0; i < message.folderKey.length; ++i)
          $root.Records.RecordFolderForConversion.encode(
            message.folderKey[i],
            writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordConvertToV3 message, length delimited. Does not implicitly {@link Records.RecordConvertToV3.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Records.IRecordConvertToV3} message RecordConvertToV3 message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordConvertToV3.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordConvertToV3 message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordConvertToV3} RecordConvertToV3
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordConvertToV3.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordConvertToV3();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 3: {
            message.revision = reader.int64();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.nonSharedData = reader.bytes();
            break;
          }
          case 6: {
            message.audit = $root.Records.RecordAudit.decode(reader, reader.uint32());
            break;
          }
          case 7: {
            if (!(message.recordFile && message.recordFile.length)) message.recordFile = [];
            message.recordFile.push(
              $root.Records.RecordFileForConversion.decode(reader, reader.uint32()),
            );
            break;
          }
          case 8: {
            if (!(message.folderKey && message.folderKey.length)) message.folderKey = [];
            message.folderKey.push(
              $root.Records.RecordFolderForConversion.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordConvertToV3 message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordConvertToV3} RecordConvertToV3
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordConvertToV3.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordConvertToV3 message.
     * @function verify
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordConvertToV3.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        if (
          !(
            (message.nonSharedData && typeof message.nonSharedData.length === "number") ||
            $util.isString(message.nonSharedData)
          )
        )
          return "nonSharedData: buffer expected";
      if (message.audit != null && message.hasOwnProperty("audit")) {
        let error = $root.Records.RecordAudit.verify(message.audit);
        if (error) return "audit." + error;
      }
      if (message.recordFile != null && message.hasOwnProperty("recordFile")) {
        if (!Array.isArray(message.recordFile)) return "recordFile: array expected";
        for (let i = 0; i < message.recordFile.length; ++i) {
          let error = $root.Records.RecordFileForConversion.verify(message.recordFile[i]);
          if (error) return "recordFile." + error;
        }
      }
      if (message.folderKey != null && message.hasOwnProperty("folderKey")) {
        if (!Array.isArray(message.folderKey)) return "folderKey: array expected";
        for (let i = 0; i < message.folderKey.length; ++i) {
          let error = $root.Records.RecordFolderForConversion.verify(message.folderKey[i]);
          if (error) return "folderKey." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordConvertToV3 message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordConvertToV3} RecordConvertToV3
     */
    RecordConvertToV3.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordConvertToV3) return object;
      let message = new $root.Records.RecordConvertToV3();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.nonSharedData != null)
        if (typeof object.nonSharedData === "string")
          $util.base64.decode(
            object.nonSharedData,
            (message.nonSharedData = $util.newBuffer($util.base64.length(object.nonSharedData))),
            0,
          );
        else if (object.nonSharedData.length >= 0) message.nonSharedData = object.nonSharedData;
      if (object.audit != null) {
        if (typeof object.audit !== "object")
          throw TypeError(".Records.RecordConvertToV3.audit: object expected");
        message.audit = $root.Records.RecordAudit.fromObject(object.audit);
      }
      if (object.recordFile) {
        if (!Array.isArray(object.recordFile))
          throw TypeError(".Records.RecordConvertToV3.recordFile: array expected");
        message.recordFile = [];
        for (let i = 0; i < object.recordFile.length; ++i) {
          if (typeof object.recordFile[i] !== "object")
            throw TypeError(".Records.RecordConvertToV3.recordFile: object expected");
          message.recordFile[i] = $root.Records.RecordFileForConversion.fromObject(
            object.recordFile[i],
          );
        }
      }
      if (object.folderKey) {
        if (!Array.isArray(object.folderKey))
          throw TypeError(".Records.RecordConvertToV3.folderKey: array expected");
        message.folderKey = [];
        for (let i = 0; i < object.folderKey.length; ++i) {
          if (typeof object.folderKey[i] !== "object")
            throw TypeError(".Records.RecordConvertToV3.folderKey: object expected");
          message.folderKey[i] = $root.Records.RecordFolderForConversion.fromObject(
            object.folderKey[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordConvertToV3 message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {Records.RecordConvertToV3} message RecordConvertToV3
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordConvertToV3.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.recordFile = [];
        object.folderKey = [];
      }
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if (options.bytes === String) object.nonSharedData = "";
        else {
          object.nonSharedData = [];
          if (options.bytes !== Array) object.nonSharedData = $util.newBuffer(object.nonSharedData);
        }
        object.audit = null;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        object.nonSharedData =
          options.bytes === String
            ? $util.base64.encode(message.nonSharedData, 0, message.nonSharedData.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.nonSharedData)
              : message.nonSharedData;
      if (message.audit != null && message.hasOwnProperty("audit"))
        object.audit = $root.Records.RecordAudit.toObject(message.audit, options);
      if (message.recordFile && message.recordFile.length) {
        object.recordFile = [];
        for (let j = 0; j < message.recordFile.length; ++j)
          object.recordFile[j] = $root.Records.RecordFileForConversion.toObject(
            message.recordFile[j],
            options,
          );
      }
      if (message.folderKey && message.folderKey.length) {
        object.folderKey = [];
        for (let j = 0; j < message.folderKey.length; ++j)
          object.folderKey[j] = $root.Records.RecordFolderForConversion.toObject(
            message.folderKey[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordConvertToV3 to JSON.
     * @function toJSON
     * @memberof Records.RecordConvertToV3
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordConvertToV3.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordConvertToV3
     * @function getTypeUrl
     * @memberof Records.RecordConvertToV3
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordConvertToV3.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordConvertToV3";
    };

    return RecordConvertToV3;
  })();

  Records.RecordsConvertToV3Request = (function () {
    /**
     * Properties of a RecordsConvertToV3Request.
     * @memberof Records
     * @interface IRecordsConvertToV3Request
     * @property {Array.<Records.IRecordConvertToV3>|null} [records] RecordsConvertToV3Request records
     * @property {number|Long|null} [clientTime] RecordsConvertToV3Request clientTime
     */

    /**
     * Constructs a new RecordsConvertToV3Request.
     * @memberof Records
     * @classdesc Represents a RecordsConvertToV3Request.
     * @implements IRecordsConvertToV3Request
     * @constructor
     * @param {Records.IRecordsConvertToV3Request=} [properties] Properties to set
     */
    function RecordsConvertToV3Request(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsConvertToV3Request records.
     * @member {Array.<Records.IRecordConvertToV3>} records
     * @memberof Records.RecordsConvertToV3Request
     * @instance
     */
    RecordsConvertToV3Request.prototype.records = $util.emptyArray;

    /**
     * RecordsConvertToV3Request clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.RecordsConvertToV3Request
     * @instance
     */
    RecordsConvertToV3Request.prototype.clientTime = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * Creates a new RecordsConvertToV3Request instance using the specified properties.
     * @function create
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Records.IRecordsConvertToV3Request=} [properties] Properties to set
     * @returns {Records.RecordsConvertToV3Request} RecordsConvertToV3Request instance
     */
    RecordsConvertToV3Request.create = function create(properties) {
      return new RecordsConvertToV3Request(properties);
    };

    /**
     * Encodes the specified RecordsConvertToV3Request message. Does not implicitly {@link Records.RecordsConvertToV3Request.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Records.IRecordsConvertToV3Request} message RecordsConvertToV3Request message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsConvertToV3Request.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordConvertToV3.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientTime);
      return writer;
    };

    /**
     * Encodes the specified RecordsConvertToV3Request message, length delimited. Does not implicitly {@link Records.RecordsConvertToV3Request.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Records.IRecordsConvertToV3Request} message RecordsConvertToV3Request message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsConvertToV3Request.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsConvertToV3Request message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsConvertToV3Request} RecordsConvertToV3Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsConvertToV3Request.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsConvertToV3Request();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordConvertToV3.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.clientTime = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsConvertToV3Request message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsConvertToV3Request} RecordsConvertToV3Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsConvertToV3Request.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsConvertToV3Request message.
     * @function verify
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsConvertToV3Request.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordConvertToV3.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      return null;
    };

    /**
     * Creates a RecordsConvertToV3Request message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsConvertToV3Request} RecordsConvertToV3Request
     */
    RecordsConvertToV3Request.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsConvertToV3Request) return object;
      let message = new $root.Records.RecordsConvertToV3Request();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsConvertToV3Request.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsConvertToV3Request.records: object expected");
          message.records[i] = $root.Records.RecordConvertToV3.fromObject(object.records[i]);
        }
      }
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a RecordsConvertToV3Request message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {Records.RecordsConvertToV3Request} message RecordsConvertToV3Request
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsConvertToV3Request.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordConvertToV3.toObject(message.records[j], options);
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      return object;
    };

    /**
     * Converts this RecordsConvertToV3Request to JSON.
     * @function toJSON
     * @memberof Records.RecordsConvertToV3Request
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsConvertToV3Request.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsConvertToV3Request
     * @function getTypeUrl
     * @memberof Records.RecordsConvertToV3Request
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsConvertToV3Request.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsConvertToV3Request";
    };

    return RecordsConvertToV3Request;
  })();

  Records.RecordsRemoveRequest = (function () {
    /**
     * Properties of a RecordsRemoveRequest.
     * @memberof Records
     * @interface IRecordsRemoveRequest
     * @property {Array.<Uint8Array>|null} [records] RecordsRemoveRequest records
     */

    /**
     * Constructs a new RecordsRemoveRequest.
     * @memberof Records
     * @classdesc Represents a RecordsRemoveRequest.
     * @implements IRecordsRemoveRequest
     * @constructor
     * @param {Records.IRecordsRemoveRequest=} [properties] Properties to set
     */
    function RecordsRemoveRequest(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsRemoveRequest records.
     * @member {Array.<Uint8Array>} records
     * @memberof Records.RecordsRemoveRequest
     * @instance
     */
    RecordsRemoveRequest.prototype.records = $util.emptyArray;

    /**
     * Creates a new RecordsRemoveRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Records.IRecordsRemoveRequest=} [properties] Properties to set
     * @returns {Records.RecordsRemoveRequest} RecordsRemoveRequest instance
     */
    RecordsRemoveRequest.create = function create(properties) {
      return new RecordsRemoveRequest(properties);
    };

    /**
     * Encodes the specified RecordsRemoveRequest message. Does not implicitly {@link Records.RecordsRemoveRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Records.IRecordsRemoveRequest} message RecordsRemoveRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsRemoveRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.records[i]);
      return writer;
    };

    /**
     * Encodes the specified RecordsRemoveRequest message, length delimited. Does not implicitly {@link Records.RecordsRemoveRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Records.IRecordsRemoveRequest} message RecordsRemoveRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsRemoveRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsRemoveRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsRemoveRequest} RecordsRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsRemoveRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsRemoveRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push(reader.bytes());
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsRemoveRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsRemoveRequest} RecordsRemoveRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsRemoveRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsRemoveRequest message.
     * @function verify
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsRemoveRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i)
          if (
            !(
              (message.records[i] && typeof message.records[i].length === "number") ||
              $util.isString(message.records[i])
            )
          )
            return "records: buffer[] expected";
      }
      return null;
    };

    /**
     * Creates a RecordsRemoveRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsRemoveRequest} RecordsRemoveRequest
     */
    RecordsRemoveRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsRemoveRequest) return object;
      let message = new $root.Records.RecordsRemoveRequest();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsRemoveRequest.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i)
          if (typeof object.records[i] === "string")
            $util.base64.decode(
              object.records[i],
              (message.records[i] = $util.newBuffer($util.base64.length(object.records[i]))),
              0,
            );
          else if (object.records[i].length >= 0) message.records[i] = object.records[i];
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsRemoveRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {Records.RecordsRemoveRequest} message RecordsRemoveRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsRemoveRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] =
            options.bytes === String
              ? $util.base64.encode(message.records[j], 0, message.records[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.records[j])
                : message.records[j];
      }
      return object;
    };

    /**
     * Converts this RecordsRemoveRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsRemoveRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsRemoveRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsRemoveRequest
     * @function getTypeUrl
     * @memberof Records.RecordsRemoveRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsRemoveRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsRemoveRequest";
    };

    return RecordsRemoveRequest;
  })();

  Records.RecordRevert = (function () {
    /**
     * Properties of a RecordRevert.
     * @memberof Records
     * @interface IRecordRevert
     * @property {Uint8Array|null} [recordUid] RecordRevert recordUid
     * @property {number|Long|null} [revertToRevision] RecordRevert revertToRevision
     */

    /**
     * Constructs a new RecordRevert.
     * @memberof Records
     * @classdesc Represents a RecordRevert.
     * @implements IRecordRevert
     * @constructor
     * @param {Records.IRecordRevert=} [properties] Properties to set
     */
    function RecordRevert(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordRevert recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordRevert
     * @instance
     */
    RecordRevert.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordRevert revertToRevision.
     * @member {number|Long} revertToRevision
     * @memberof Records.RecordRevert
     * @instance
     */
    RecordRevert.prototype.revertToRevision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new RecordRevert instance using the specified properties.
     * @function create
     * @memberof Records.RecordRevert
     * @static
     * @param {Records.IRecordRevert=} [properties] Properties to set
     * @returns {Records.RecordRevert} RecordRevert instance
     */
    RecordRevert.create = function create(properties) {
      return new RecordRevert(properties);
    };

    /**
     * Encodes the specified RecordRevert message. Does not implicitly {@link Records.RecordRevert.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordRevert
     * @static
     * @param {Records.IRecordRevert} message RecordRevert message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordRevert.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (
        message.revertToRevision != null &&
        Object.hasOwnProperty.call(message, "revertToRevision")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.revertToRevision);
      return writer;
    };

    /**
     * Encodes the specified RecordRevert message, length delimited. Does not implicitly {@link Records.RecordRevert.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordRevert
     * @static
     * @param {Records.IRecordRevert} message RecordRevert message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordRevert.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordRevert message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordRevert
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordRevert} RecordRevert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordRevert.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordRevert();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.revertToRevision = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordRevert message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordRevert
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordRevert} RecordRevert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordRevert.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordRevert message.
     * @function verify
     * @memberof Records.RecordRevert
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordRevert.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.revertToRevision != null && message.hasOwnProperty("revertToRevision"))
        if (
          !$util.isInteger(message.revertToRevision) &&
          !(
            message.revertToRevision &&
            $util.isInteger(message.revertToRevision.low) &&
            $util.isInteger(message.revertToRevision.high)
          )
        )
          return "revertToRevision: integer|Long expected";
      return null;
    };

    /**
     * Creates a RecordRevert message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordRevert
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordRevert} RecordRevert
     */
    RecordRevert.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordRevert) return object;
      let message = new $root.Records.RecordRevert();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.revertToRevision != null)
        if ($util.Long)
          (message.revertToRevision = $util.Long.fromValue(object.revertToRevision)).unsigned =
            false;
        else if (typeof object.revertToRevision === "string")
          message.revertToRevision = parseInt(object.revertToRevision, 10);
        else if (typeof object.revertToRevision === "number")
          message.revertToRevision = object.revertToRevision;
        else if (typeof object.revertToRevision === "object")
          message.revertToRevision = new $util.LongBits(
            object.revertToRevision.low >>> 0,
            object.revertToRevision.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a RecordRevert message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordRevert
     * @static
     * @param {Records.RecordRevert} message RecordRevert
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordRevert.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revertToRevision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revertToRevision = options.longs === String ? "0" : 0;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.revertToRevision != null && message.hasOwnProperty("revertToRevision"))
        if (typeof message.revertToRevision === "number")
          object.revertToRevision =
            options.longs === String ? String(message.revertToRevision) : message.revertToRevision;
        else
          object.revertToRevision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revertToRevision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revertToRevision.low >>> 0,
                    message.revertToRevision.high >>> 0,
                  ).toNumber()
                : message.revertToRevision;
      return object;
    };

    /**
     * Converts this RecordRevert to JSON.
     * @function toJSON
     * @memberof Records.RecordRevert
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordRevert.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordRevert
     * @function getTypeUrl
     * @memberof Records.RecordRevert
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordRevert.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordRevert";
    };

    return RecordRevert;
  })();

  Records.RecordsRevertRequest = (function () {
    /**
     * Properties of a RecordsRevertRequest.
     * @memberof Records
     * @interface IRecordsRevertRequest
     * @property {Array.<Records.IRecordRevert>|null} [records] RecordsRevertRequest records
     */

    /**
     * Constructs a new RecordsRevertRequest.
     * @memberof Records
     * @classdesc Represents a RecordsRevertRequest.
     * @implements IRecordsRevertRequest
     * @constructor
     * @param {Records.IRecordsRevertRequest=} [properties] Properties to set
     */
    function RecordsRevertRequest(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsRevertRequest records.
     * @member {Array.<Records.IRecordRevert>} records
     * @memberof Records.RecordsRevertRequest
     * @instance
     */
    RecordsRevertRequest.prototype.records = $util.emptyArray;

    /**
     * Creates a new RecordsRevertRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Records.IRecordsRevertRequest=} [properties] Properties to set
     * @returns {Records.RecordsRevertRequest} RecordsRevertRequest instance
     */
    RecordsRevertRequest.create = function create(properties) {
      return new RecordsRevertRequest(properties);
    };

    /**
     * Encodes the specified RecordsRevertRequest message. Does not implicitly {@link Records.RecordsRevertRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Records.IRecordsRevertRequest} message RecordsRevertRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsRevertRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordRevert.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsRevertRequest message, length delimited. Does not implicitly {@link Records.RecordsRevertRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Records.IRecordsRevertRequest} message RecordsRevertRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsRevertRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsRevertRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsRevertRequest} RecordsRevertRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsRevertRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsRevertRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordRevert.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsRevertRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsRevertRequest} RecordsRevertRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsRevertRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsRevertRequest message.
     * @function verify
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsRevertRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordRevert.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsRevertRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsRevertRequest} RecordsRevertRequest
     */
    RecordsRevertRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsRevertRequest) return object;
      let message = new $root.Records.RecordsRevertRequest();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsRevertRequest.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsRevertRequest.records: object expected");
          message.records[i] = $root.Records.RecordRevert.fromObject(object.records[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsRevertRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {Records.RecordsRevertRequest} message RecordsRevertRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsRevertRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordRevert.toObject(message.records[j], options);
      }
      return object;
    };

    /**
     * Converts this RecordsRevertRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsRevertRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsRevertRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsRevertRequest
     * @function getTypeUrl
     * @memberof Records.RecordsRevertRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsRevertRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsRevertRequest";
    };

    return RecordsRevertRequest;
  })();

  Records.RecordLinkError = (function () {
    /**
     * Properties of a RecordLinkError.
     * @memberof Records
     * @interface IRecordLinkError
     * @property {Uint8Array|null} [recordUid] RecordLinkError recordUid
     * @property {Records.RecordModifyResult|null} [status] RecordLinkError status
     * @property {string|null} [message] RecordLinkError message
     */

    /**
     * Constructs a new RecordLinkError.
     * @memberof Records
     * @classdesc Represents a RecordLinkError.
     * @implements IRecordLinkError
     * @constructor
     * @param {Records.IRecordLinkError=} [properties] Properties to set
     */
    function RecordLinkError(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordLinkError recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordLinkError
     * @instance
     */
    RecordLinkError.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordLinkError status.
     * @member {Records.RecordModifyResult} status
     * @memberof Records.RecordLinkError
     * @instance
     */
    RecordLinkError.prototype.status = 0;

    /**
     * RecordLinkError message.
     * @member {string} message
     * @memberof Records.RecordLinkError
     * @instance
     */
    RecordLinkError.prototype.message = "";

    /**
     * Creates a new RecordLinkError instance using the specified properties.
     * @function create
     * @memberof Records.RecordLinkError
     * @static
     * @param {Records.IRecordLinkError=} [properties] Properties to set
     * @returns {Records.RecordLinkError} RecordLinkError instance
     */
    RecordLinkError.create = function create(properties) {
      return new RecordLinkError(properties);
    };

    /**
     * Encodes the specified RecordLinkError message. Does not implicitly {@link Records.RecordLinkError.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordLinkError
     * @static
     * @param {Records.IRecordLinkError} message RecordLinkError message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordLinkError.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.message);
      return writer;
    };

    /**
     * Encodes the specified RecordLinkError message, length delimited. Does not implicitly {@link Records.RecordLinkError.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordLinkError
     * @static
     * @param {Records.IRecordLinkError} message RecordLinkError message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordLinkError.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordLinkError message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordLinkError
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordLinkError} RecordLinkError
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordLinkError.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordLinkError();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
            break;
          }
          case 3: {
            message.message = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordLinkError message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordLinkError
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordLinkError} RecordLinkError
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordLinkError.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordLinkError message.
     * @function verify
     * @memberof Records.RecordLinkError
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordLinkError.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 10:
          case 11:
          case 12:
            break;
        }
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      return null;
    };

    /**
     * Creates a RecordLinkError message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordLinkError
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordLinkError} RecordLinkError
     */
    RecordLinkError.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordLinkError) return object;
      let message = new $root.Records.RecordLinkError();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "RS_SUCCESS":
        case 0:
          message.status = 0;
          break;
        case "RS_OUT_OF_SYNC":
        case 1:
          message.status = 1;
          break;
        case "RS_ACCESS_DENIED":
        case 2:
          message.status = 2;
          break;
        case "RS_SHARE_DENIED":
        case 3:
          message.status = 3;
          break;
        case "RS_RECORD_EXISTS":
        case 4:
          message.status = 4;
          break;
        case "RS_OLD_RECORD_VERSION_TYPE":
        case 5:
          message.status = 5;
          break;
        case "RS_NEW_RECORD_VERSION_TYPE":
        case 6:
          message.status = 6;
          break;
        case "RS_FILES_NOT_MATCH":
        case 7:
          message.status = 7;
          break;
        case "RS_RECORD_NOT_SHAREABLE":
        case 8:
          message.status = 8;
          break;
        case "RS_ATTACHMENT_NOT_SHAREABLE":
        case 9:
          message.status = 9;
          break;
        case "RS_FILE_LIMIT_REACHED":
        case 10:
          message.status = 10;
          break;
        case "RS_SIZE_EXCEEDED_LIMIT":
        case 11:
          message.status = 11;
          break;
        case "RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS":
        case 12:
          message.status = 12;
          break;
      }
      if (object.message != null) message.message = String(object.message);
      return message;
    };

    /**
     * Creates a plain object from a RecordLinkError message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordLinkError
     * @static
     * @param {Records.RecordLinkError} message RecordLinkError
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordLinkError.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = options.enums === String ? "RS_SUCCESS" : 0;
        object.message = "";
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.Records.RecordModifyResult[message.status] === undefined
              ? message.status
              : $root.Records.RecordModifyResult[message.status]
            : message.status;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      return object;
    };

    /**
     * Converts this RecordLinkError to JSON.
     * @function toJSON
     * @memberof Records.RecordLinkError
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordLinkError.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordLinkError
     * @function getTypeUrl
     * @memberof Records.RecordLinkError
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordLinkError.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordLinkError";
    };

    return RecordLinkError;
  })();

  Records.RecordModifyStatus = (function () {
    /**
     * Properties of a RecordModifyStatus.
     * @memberof Records
     * @interface IRecordModifyStatus
     * @property {Uint8Array|null} [recordUid] RecordModifyStatus recordUid
     * @property {Records.RecordModifyResult|null} [status] RecordModifyStatus status
     * @property {string|null} [message] RecordModifyStatus message
     * @property {Array.<Records.IRecordLinkError>|null} [linkErrors] RecordModifyStatus linkErrors
     */

    /**
     * Constructs a new RecordModifyStatus.
     * @memberof Records
     * @classdesc Represents a RecordModifyStatus.
     * @implements IRecordModifyStatus
     * @constructor
     * @param {Records.IRecordModifyStatus=} [properties] Properties to set
     */
    function RecordModifyStatus(properties) {
      this.linkErrors = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordModifyStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordModifyStatus
     * @instance
     */
    RecordModifyStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordModifyStatus status.
     * @member {Records.RecordModifyResult} status
     * @memberof Records.RecordModifyStatus
     * @instance
     */
    RecordModifyStatus.prototype.status = 0;

    /**
     * RecordModifyStatus message.
     * @member {string} message
     * @memberof Records.RecordModifyStatus
     * @instance
     */
    RecordModifyStatus.prototype.message = "";

    /**
     * RecordModifyStatus linkErrors.
     * @member {Array.<Records.IRecordLinkError>} linkErrors
     * @memberof Records.RecordModifyStatus
     * @instance
     */
    RecordModifyStatus.prototype.linkErrors = $util.emptyArray;

    /**
     * Creates a new RecordModifyStatus instance using the specified properties.
     * @function create
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Records.IRecordModifyStatus=} [properties] Properties to set
     * @returns {Records.RecordModifyStatus} RecordModifyStatus instance
     */
    RecordModifyStatus.create = function create(properties) {
      return new RecordModifyStatus(properties);
    };

    /**
     * Encodes the specified RecordModifyStatus message. Does not implicitly {@link Records.RecordModifyStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Records.IRecordModifyStatus} message RecordModifyStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordModifyStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.message);
      if (message.linkErrors != null && message.linkErrors.length)
        for (let i = 0; i < message.linkErrors.length; ++i)
          $root.Records.RecordLinkError.encode(
            message.linkErrors[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordModifyStatus message, length delimited. Does not implicitly {@link Records.RecordModifyStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Records.IRecordModifyStatus} message RecordModifyStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordModifyStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordModifyStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordModifyStatus} RecordModifyStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordModifyStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordModifyStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
            break;
          }
          case 3: {
            message.message = reader.string();
            break;
          }
          case 4: {
            if (!(message.linkErrors && message.linkErrors.length)) message.linkErrors = [];
            message.linkErrors.push($root.Records.RecordLinkError.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordModifyStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordModifyStatus} RecordModifyStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordModifyStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordModifyStatus message.
     * @function verify
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordModifyStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 10:
          case 11:
          case 12:
            break;
        }
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      if (message.linkErrors != null && message.hasOwnProperty("linkErrors")) {
        if (!Array.isArray(message.linkErrors)) return "linkErrors: array expected";
        for (let i = 0; i < message.linkErrors.length; ++i) {
          let error = $root.Records.RecordLinkError.verify(message.linkErrors[i]);
          if (error) return "linkErrors." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordModifyStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordModifyStatus} RecordModifyStatus
     */
    RecordModifyStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordModifyStatus) return object;
      let message = new $root.Records.RecordModifyStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "RS_SUCCESS":
        case 0:
          message.status = 0;
          break;
        case "RS_OUT_OF_SYNC":
        case 1:
          message.status = 1;
          break;
        case "RS_ACCESS_DENIED":
        case 2:
          message.status = 2;
          break;
        case "RS_SHARE_DENIED":
        case 3:
          message.status = 3;
          break;
        case "RS_RECORD_EXISTS":
        case 4:
          message.status = 4;
          break;
        case "RS_OLD_RECORD_VERSION_TYPE":
        case 5:
          message.status = 5;
          break;
        case "RS_NEW_RECORD_VERSION_TYPE":
        case 6:
          message.status = 6;
          break;
        case "RS_FILES_NOT_MATCH":
        case 7:
          message.status = 7;
          break;
        case "RS_RECORD_NOT_SHAREABLE":
        case 8:
          message.status = 8;
          break;
        case "RS_ATTACHMENT_NOT_SHAREABLE":
        case 9:
          message.status = 9;
          break;
        case "RS_FILE_LIMIT_REACHED":
        case 10:
          message.status = 10;
          break;
        case "RS_SIZE_EXCEEDED_LIMIT":
        case 11:
          message.status = 11;
          break;
        case "RS_ONLY_OWNER_CAN_MODIFY_SCRIPTS":
        case 12:
          message.status = 12;
          break;
      }
      if (object.message != null) message.message = String(object.message);
      if (object.linkErrors) {
        if (!Array.isArray(object.linkErrors))
          throw TypeError(".Records.RecordModifyStatus.linkErrors: array expected");
        message.linkErrors = [];
        for (let i = 0; i < object.linkErrors.length; ++i) {
          if (typeof object.linkErrors[i] !== "object")
            throw TypeError(".Records.RecordModifyStatus.linkErrors: object expected");
          message.linkErrors[i] = $root.Records.RecordLinkError.fromObject(object.linkErrors[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordModifyStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {Records.RecordModifyStatus} message RecordModifyStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordModifyStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.linkErrors = [];
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = options.enums === String ? "RS_SUCCESS" : 0;
        object.message = "";
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.Records.RecordModifyResult[message.status] === undefined
              ? message.status
              : $root.Records.RecordModifyResult[message.status]
            : message.status;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      if (message.linkErrors && message.linkErrors.length) {
        object.linkErrors = [];
        for (let j = 0; j < message.linkErrors.length; ++j)
          object.linkErrors[j] = $root.Records.RecordLinkError.toObject(
            message.linkErrors[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordModifyStatus to JSON.
     * @function toJSON
     * @memberof Records.RecordModifyStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordModifyStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordModifyStatus
     * @function getTypeUrl
     * @memberof Records.RecordModifyStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordModifyStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordModifyStatus";
    };

    return RecordModifyStatus;
  })();

  Records.RecordsModifyResponse = (function () {
    /**
     * Properties of a RecordsModifyResponse.
     * @memberof Records
     * @interface IRecordsModifyResponse
     * @property {Array.<Records.IRecordModifyStatus>|null} [records] RecordsModifyResponse records
     * @property {number|Long|null} [revision] RecordsModifyResponse revision
     */

    /**
     * Constructs a new RecordsModifyResponse.
     * @memberof Records
     * @classdesc Represents a RecordsModifyResponse.
     * @implements IRecordsModifyResponse
     * @constructor
     * @param {Records.IRecordsModifyResponse=} [properties] Properties to set
     */
    function RecordsModifyResponse(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsModifyResponse records.
     * @member {Array.<Records.IRecordModifyStatus>} records
     * @memberof Records.RecordsModifyResponse
     * @instance
     */
    RecordsModifyResponse.prototype.records = $util.emptyArray;

    /**
     * RecordsModifyResponse revision.
     * @member {number|Long} revision
     * @memberof Records.RecordsModifyResponse
     * @instance
     */
    RecordsModifyResponse.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new RecordsModifyResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Records.IRecordsModifyResponse=} [properties] Properties to set
     * @returns {Records.RecordsModifyResponse} RecordsModifyResponse instance
     */
    RecordsModifyResponse.create = function create(properties) {
      return new RecordsModifyResponse(properties);
    };

    /**
     * Encodes the specified RecordsModifyResponse message. Does not implicitly {@link Records.RecordsModifyResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Records.IRecordsModifyResponse} message RecordsModifyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsModifyResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordModifyStatus.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.revision);
      return writer;
    };

    /**
     * Encodes the specified RecordsModifyResponse message, length delimited. Does not implicitly {@link Records.RecordsModifyResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Records.IRecordsModifyResponse} message RecordsModifyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsModifyResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsModifyResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsModifyResponse} RecordsModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsModifyResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsModifyResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordModifyStatus.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.revision = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsModifyResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsModifyResponse} RecordsModifyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsModifyResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsModifyResponse message.
     * @function verify
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsModifyResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordModifyStatus.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      return null;
    };

    /**
     * Creates a RecordsModifyResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsModifyResponse} RecordsModifyResponse
     */
    RecordsModifyResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsModifyResponse) return object;
      let message = new $root.Records.RecordsModifyResponse();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.RecordsModifyResponse.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.RecordsModifyResponse.records: object expected");
          message.records[i] = $root.Records.RecordModifyStatus.fromObject(object.records[i]);
        }
      }
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a RecordsModifyResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {Records.RecordsModifyResponse} message RecordsModifyResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsModifyResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordModifyStatus.toObject(
            message.records[j],
            options,
          );
      }
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      return object;
    };

    /**
     * Converts this RecordsModifyResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordsModifyResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsModifyResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsModifyResponse
     * @function getTypeUrl
     * @memberof Records.RecordsModifyResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsModifyResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsModifyResponse";
    };

    return RecordsModifyResponse;
  })();

  Records.RecordAddAuditData = (function () {
    /**
     * Properties of a RecordAddAuditData.
     * @memberof Records
     * @interface IRecordAddAuditData
     * @property {Uint8Array|null} [recordUid] RecordAddAuditData recordUid
     * @property {number|Long|null} [revision] RecordAddAuditData revision
     * @property {Uint8Array|null} [data] RecordAddAuditData data
     * @property {number|null} [version] RecordAddAuditData version
     */

    /**
     * Constructs a new RecordAddAuditData.
     * @memberof Records
     * @classdesc Represents a RecordAddAuditData.
     * @implements IRecordAddAuditData
     * @constructor
     * @param {Records.IRecordAddAuditData=} [properties] Properties to set
     */
    function RecordAddAuditData(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordAddAuditData recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordAddAuditData
     * @instance
     */
    RecordAddAuditData.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordAddAuditData revision.
     * @member {number|Long} revision
     * @memberof Records.RecordAddAuditData
     * @instance
     */
    RecordAddAuditData.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordAddAuditData data.
     * @member {Uint8Array} data
     * @memberof Records.RecordAddAuditData
     * @instance
     */
    RecordAddAuditData.prototype.data = $util.newBuffer([]);

    /**
     * RecordAddAuditData version.
     * @member {number} version
     * @memberof Records.RecordAddAuditData
     * @instance
     */
    RecordAddAuditData.prototype.version = 0;

    /**
     * Creates a new RecordAddAuditData instance using the specified properties.
     * @function create
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Records.IRecordAddAuditData=} [properties] Properties to set
     * @returns {Records.RecordAddAuditData} RecordAddAuditData instance
     */
    RecordAddAuditData.create = function create(properties) {
      return new RecordAddAuditData(properties);
    };

    /**
     * Encodes the specified RecordAddAuditData message. Does not implicitly {@link Records.RecordAddAuditData.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Records.IRecordAddAuditData} message RecordAddAuditData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAddAuditData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.revision);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.data);
      if (message.version != null && Object.hasOwnProperty.call(message, "version"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.version);
      return writer;
    };

    /**
     * Encodes the specified RecordAddAuditData message, length delimited. Does not implicitly {@link Records.RecordAddAuditData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Records.IRecordAddAuditData} message RecordAddAuditData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordAddAuditData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordAddAuditData message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordAddAuditData} RecordAddAuditData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAddAuditData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordAddAuditData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.revision = reader.int64();
            break;
          }
          case 3: {
            message.data = reader.bytes();
            break;
          }
          case 4: {
            message.version = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordAddAuditData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordAddAuditData} RecordAddAuditData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordAddAuditData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordAddAuditData message.
     * @function verify
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordAddAuditData.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.version != null && message.hasOwnProperty("version"))
        if (!$util.isInteger(message.version)) return "version: integer expected";
      return null;
    };

    /**
     * Creates a RecordAddAuditData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordAddAuditData} RecordAddAuditData
     */
    RecordAddAuditData.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordAddAuditData) return object;
      let message = new $root.Records.RecordAddAuditData();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.version != null) message.version = object.version | 0;
      return message;
    };

    /**
     * Creates a plain object from a RecordAddAuditData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {Records.RecordAddAuditData} message RecordAddAuditData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordAddAuditData.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        object.version = 0;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.version != null && message.hasOwnProperty("version"))
        object.version = message.version;
      return object;
    };

    /**
     * Converts this RecordAddAuditData to JSON.
     * @function toJSON
     * @memberof Records.RecordAddAuditData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordAddAuditData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordAddAuditData
     * @function getTypeUrl
     * @memberof Records.RecordAddAuditData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordAddAuditData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordAddAuditData";
    };

    return RecordAddAuditData;
  })();

  Records.AddAuditDataRequest = (function () {
    /**
     * Properties of an AddAuditDataRequest.
     * @memberof Records
     * @interface IAddAuditDataRequest
     * @property {Array.<Records.IRecordAddAuditData>|null} [records] AddAuditDataRequest records
     */

    /**
     * Constructs a new AddAuditDataRequest.
     * @memberof Records
     * @classdesc Represents an AddAuditDataRequest.
     * @implements IAddAuditDataRequest
     * @constructor
     * @param {Records.IAddAuditDataRequest=} [properties] Properties to set
     */
    function AddAuditDataRequest(properties) {
      this.records = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AddAuditDataRequest records.
     * @member {Array.<Records.IRecordAddAuditData>} records
     * @memberof Records.AddAuditDataRequest
     * @instance
     */
    AddAuditDataRequest.prototype.records = $util.emptyArray;

    /**
     * Creates a new AddAuditDataRequest instance using the specified properties.
     * @function create
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Records.IAddAuditDataRequest=} [properties] Properties to set
     * @returns {Records.AddAuditDataRequest} AddAuditDataRequest instance
     */
    AddAuditDataRequest.create = function create(properties) {
      return new AddAuditDataRequest(properties);
    };

    /**
     * Encodes the specified AddAuditDataRequest message. Does not implicitly {@link Records.AddAuditDataRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Records.IAddAuditDataRequest} message AddAuditDataRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddAuditDataRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.records != null && message.records.length)
        for (let i = 0; i < message.records.length; ++i)
          $root.Records.RecordAddAuditData.encode(
            message.records[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified AddAuditDataRequest message, length delimited. Does not implicitly {@link Records.AddAuditDataRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Records.IAddAuditDataRequest} message AddAuditDataRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddAuditDataRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AddAuditDataRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.AddAuditDataRequest} AddAuditDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddAuditDataRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.AddAuditDataRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.records && message.records.length)) message.records = [];
            message.records.push($root.Records.RecordAddAuditData.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes an AddAuditDataRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.AddAuditDataRequest} AddAuditDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddAuditDataRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AddAuditDataRequest message.
     * @function verify
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AddAuditDataRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.records != null && message.hasOwnProperty("records")) {
        if (!Array.isArray(message.records)) return "records: array expected";
        for (let i = 0; i < message.records.length; ++i) {
          let error = $root.Records.RecordAddAuditData.verify(message.records[i]);
          if (error) return "records." + error;
        }
      }
      return null;
    };

    /**
     * Creates an AddAuditDataRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.AddAuditDataRequest} AddAuditDataRequest
     */
    AddAuditDataRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.AddAuditDataRequest) return object;
      let message = new $root.Records.AddAuditDataRequest();
      if (object.records) {
        if (!Array.isArray(object.records))
          throw TypeError(".Records.AddAuditDataRequest.records: array expected");
        message.records = [];
        for (let i = 0; i < object.records.length; ++i) {
          if (typeof object.records[i] !== "object")
            throw TypeError(".Records.AddAuditDataRequest.records: object expected");
          message.records[i] = $root.Records.RecordAddAuditData.fromObject(object.records[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from an AddAuditDataRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {Records.AddAuditDataRequest} message AddAuditDataRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AddAuditDataRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.records = [];
      if (message.records && message.records.length) {
        object.records = [];
        for (let j = 0; j < message.records.length; ++j)
          object.records[j] = $root.Records.RecordAddAuditData.toObject(
            message.records[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this AddAuditDataRequest to JSON.
     * @function toJSON
     * @memberof Records.AddAuditDataRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AddAuditDataRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AddAuditDataRequest
     * @function getTypeUrl
     * @memberof Records.AddAuditDataRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AddAuditDataRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.AddAuditDataRequest";
    };

    return AddAuditDataRequest;
  })();

  Records.File = (function () {
    /**
     * Properties of a File.
     * @memberof Records
     * @interface IFile
     * @property {Uint8Array|null} [recordUid] File recordUid
     * @property {Uint8Array|null} [recordKey] File recordKey
     * @property {Uint8Array|null} [data] File data
     * @property {number|Long|null} [fileSize] File fileSize
     * @property {number|null} [thumbSize] File thumbSize
     * @property {boolean|null} [isScript] File isScript
     */

    /**
     * Constructs a new File.
     * @memberof Records
     * @classdesc Represents a File.
     * @implements IFile
     * @constructor
     * @param {Records.IFile=} [properties] Properties to set
     */
    function File(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * File recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.File
     * @instance
     */
    File.prototype.recordUid = $util.newBuffer([]);

    /**
     * File recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.File
     * @instance
     */
    File.prototype.recordKey = $util.newBuffer([]);

    /**
     * File data.
     * @member {Uint8Array} data
     * @memberof Records.File
     * @instance
     */
    File.prototype.data = $util.newBuffer([]);

    /**
     * File fileSize.
     * @member {number|Long} fileSize
     * @memberof Records.File
     * @instance
     */
    File.prototype.fileSize = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * File thumbSize.
     * @member {number} thumbSize
     * @memberof Records.File
     * @instance
     */
    File.prototype.thumbSize = 0;

    /**
     * File isScript.
     * @member {boolean} isScript
     * @memberof Records.File
     * @instance
     */
    File.prototype.isScript = false;

    /**
     * Creates a new File instance using the specified properties.
     * @function create
     * @memberof Records.File
     * @static
     * @param {Records.IFile=} [properties] Properties to set
     * @returns {Records.File} File instance
     */
    File.create = function create(properties) {
      return new File(properties);
    };

    /**
     * Encodes the specified File message. Does not implicitly {@link Records.File.verify|verify} messages.
     * @function encode
     * @memberof Records.File
     * @static
     * @param {Records.IFile} message File message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    File.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordKey);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.data);
      if (message.fileSize != null && Object.hasOwnProperty.call(message, "fileSize"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int64(message.fileSize);
      if (message.thumbSize != null && Object.hasOwnProperty.call(message, "thumbSize"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.thumbSize);
      if (message.isScript != null && Object.hasOwnProperty.call(message, "isScript"))
        writer.uint32(/* id 6, wireType 0 =*/ 48).bool(message.isScript);
      return writer;
    };

    /**
     * Encodes the specified File message, length delimited. Does not implicitly {@link Records.File.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.File
     * @static
     * @param {Records.IFile} message File message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    File.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a File message from the specified reader or buffer.
     * @function decode
     * @memberof Records.File
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.File} File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    File.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.File();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordKey = reader.bytes();
            break;
          }
          case 3: {
            message.data = reader.bytes();
            break;
          }
          case 4: {
            message.fileSize = reader.int64();
            break;
          }
          case 5: {
            message.thumbSize = reader.int32();
            break;
          }
          case 6: {
            message.isScript = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a File message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.File
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.File} File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    File.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a File message.
     * @function verify
     * @memberof Records.File
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    File.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.fileSize != null && message.hasOwnProperty("fileSize"))
        if (
          !$util.isInteger(message.fileSize) &&
          !(
            message.fileSize &&
            $util.isInteger(message.fileSize.low) &&
            $util.isInteger(message.fileSize.high)
          )
        )
          return "fileSize: integer|Long expected";
      if (message.thumbSize != null && message.hasOwnProperty("thumbSize"))
        if (!$util.isInteger(message.thumbSize)) return "thumbSize: integer expected";
      if (message.isScript != null && message.hasOwnProperty("isScript"))
        if (typeof message.isScript !== "boolean") return "isScript: boolean expected";
      return null;
    };

    /**
     * Creates a File message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.File
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.File} File
     */
    File.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.File) return object;
      let message = new $root.Records.File();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.fileSize != null)
        if ($util.Long) (message.fileSize = $util.Long.fromValue(object.fileSize)).unsigned = false;
        else if (typeof object.fileSize === "string")
          message.fileSize = parseInt(object.fileSize, 10);
        else if (typeof object.fileSize === "number") message.fileSize = object.fileSize;
        else if (typeof object.fileSize === "object")
          message.fileSize = new $util.LongBits(
            object.fileSize.low >>> 0,
            object.fileSize.high >>> 0,
          ).toNumber();
      if (object.thumbSize != null) message.thumbSize = object.thumbSize | 0;
      if (object.isScript != null) message.isScript = Boolean(object.isScript);
      return message;
    };

    /**
     * Creates a plain object from a File message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.File
     * @static
     * @param {Records.File} message File
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    File.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.fileSize =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.fileSize = options.longs === String ? "0" : 0;
        object.thumbSize = 0;
        object.isScript = false;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.fileSize != null && message.hasOwnProperty("fileSize"))
        if (typeof message.fileSize === "number")
          object.fileSize = options.longs === String ? String(message.fileSize) : message.fileSize;
        else
          object.fileSize =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.fileSize)
              : options.longs === Number
                ? new $util.LongBits(
                    message.fileSize.low >>> 0,
                    message.fileSize.high >>> 0,
                  ).toNumber()
                : message.fileSize;
      if (message.thumbSize != null && message.hasOwnProperty("thumbSize"))
        object.thumbSize = message.thumbSize;
      if (message.isScript != null && message.hasOwnProperty("isScript"))
        object.isScript = message.isScript;
      return object;
    };

    /**
     * Converts this File to JSON.
     * @function toJSON
     * @memberof Records.File
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    File.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for File
     * @function getTypeUrl
     * @memberof Records.File
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    File.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.File";
    };

    return File;
  })();

  Records.FilesAddRequest = (function () {
    /**
     * Properties of a FilesAddRequest.
     * @memberof Records
     * @interface IFilesAddRequest
     * @property {Array.<Records.IFile>|null} [files] FilesAddRequest files
     * @property {number|Long|null} [clientTime] FilesAddRequest clientTime
     */

    /**
     * Constructs a new FilesAddRequest.
     * @memberof Records
     * @classdesc Represents a FilesAddRequest.
     * @implements IFilesAddRequest
     * @constructor
     * @param {Records.IFilesAddRequest=} [properties] Properties to set
     */
    function FilesAddRequest(properties) {
      this.files = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FilesAddRequest files.
     * @member {Array.<Records.IFile>} files
     * @memberof Records.FilesAddRequest
     * @instance
     */
    FilesAddRequest.prototype.files = $util.emptyArray;

    /**
     * FilesAddRequest clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.FilesAddRequest
     * @instance
     */
    FilesAddRequest.prototype.clientTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new FilesAddRequest instance using the specified properties.
     * @function create
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Records.IFilesAddRequest=} [properties] Properties to set
     * @returns {Records.FilesAddRequest} FilesAddRequest instance
     */
    FilesAddRequest.create = function create(properties) {
      return new FilesAddRequest(properties);
    };

    /**
     * Encodes the specified FilesAddRequest message. Does not implicitly {@link Records.FilesAddRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Records.IFilesAddRequest} message FilesAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesAddRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.files != null && message.files.length)
        for (let i = 0; i < message.files.length; ++i)
          $root.Records.File.encode(
            message.files[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.clientTime);
      return writer;
    };

    /**
     * Encodes the specified FilesAddRequest message, length delimited. Does not implicitly {@link Records.FilesAddRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Records.IFilesAddRequest} message FilesAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesAddRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FilesAddRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FilesAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FilesAddRequest} FilesAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesAddRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FilesAddRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.files && message.files.length)) message.files = [];
            message.files.push($root.Records.File.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.clientTime = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FilesAddRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FilesAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FilesAddRequest} FilesAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesAddRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FilesAddRequest message.
     * @function verify
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FilesAddRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.files != null && message.hasOwnProperty("files")) {
        if (!Array.isArray(message.files)) return "files: array expected";
        for (let i = 0; i < message.files.length; ++i) {
          let error = $root.Records.File.verify(message.files[i]);
          if (error) return "files." + error;
        }
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      return null;
    };

    /**
     * Creates a FilesAddRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FilesAddRequest} FilesAddRequest
     */
    FilesAddRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FilesAddRequest) return object;
      let message = new $root.Records.FilesAddRequest();
      if (object.files) {
        if (!Array.isArray(object.files))
          throw TypeError(".Records.FilesAddRequest.files: array expected");
        message.files = [];
        for (let i = 0; i < object.files.length; ++i) {
          if (typeof object.files[i] !== "object")
            throw TypeError(".Records.FilesAddRequest.files: object expected");
          message.files[i] = $root.Records.File.fromObject(object.files[i]);
        }
      }
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a FilesAddRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FilesAddRequest
     * @static
     * @param {Records.FilesAddRequest} message FilesAddRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FilesAddRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.files = [];
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
      if (message.files && message.files.length) {
        object.files = [];
        for (let j = 0; j < message.files.length; ++j)
          object.files[j] = $root.Records.File.toObject(message.files[j], options);
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      return object;
    };

    /**
     * Converts this FilesAddRequest to JSON.
     * @function toJSON
     * @memberof Records.FilesAddRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FilesAddRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FilesAddRequest
     * @function getTypeUrl
     * @memberof Records.FilesAddRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FilesAddRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FilesAddRequest";
    };

    return FilesAddRequest;
  })();

  Records.FileAddStatus = (function () {
    /**
     * Properties of a FileAddStatus.
     * @memberof Records
     * @interface IFileAddStatus
     * @property {Uint8Array|null} [recordUid] FileAddStatus recordUid
     * @property {Records.FileAddResult|null} [status] FileAddStatus status
     * @property {string|null} [url] FileAddStatus url
     * @property {string|null} [parameters] FileAddStatus parameters
     * @property {string|null} [thumbnailParameters] FileAddStatus thumbnailParameters
     * @property {number|null} [successStatusCode] FileAddStatus successStatusCode
     */

    /**
     * Constructs a new FileAddStatus.
     * @memberof Records
     * @classdesc Represents a FileAddStatus.
     * @implements IFileAddStatus
     * @constructor
     * @param {Records.IFileAddStatus=} [properties] Properties to set
     */
    function FileAddStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FileAddStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * FileAddStatus status.
     * @member {Records.FileAddResult} status
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.status = 0;

    /**
     * FileAddStatus url.
     * @member {string} url
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.url = "";

    /**
     * FileAddStatus parameters.
     * @member {string} parameters
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.parameters = "";

    /**
     * FileAddStatus thumbnailParameters.
     * @member {string} thumbnailParameters
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.thumbnailParameters = "";

    /**
     * FileAddStatus successStatusCode.
     * @member {number} successStatusCode
     * @memberof Records.FileAddStatus
     * @instance
     */
    FileAddStatus.prototype.successStatusCode = 0;

    /**
     * Creates a new FileAddStatus instance using the specified properties.
     * @function create
     * @memberof Records.FileAddStatus
     * @static
     * @param {Records.IFileAddStatus=} [properties] Properties to set
     * @returns {Records.FileAddStatus} FileAddStatus instance
     */
    FileAddStatus.create = function create(properties) {
      return new FileAddStatus(properties);
    };

    /**
     * Encodes the specified FileAddStatus message. Does not implicitly {@link Records.FileAddStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.FileAddStatus
     * @static
     * @param {Records.IFileAddStatus} message FileAddStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FileAddStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      if (message.url != null && Object.hasOwnProperty.call(message, "url"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.url);
      if (message.parameters != null && Object.hasOwnProperty.call(message, "parameters"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.parameters);
      if (
        message.thumbnailParameters != null &&
        Object.hasOwnProperty.call(message, "thumbnailParameters")
      )
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.thumbnailParameters);
      if (
        message.successStatusCode != null &&
        Object.hasOwnProperty.call(message, "successStatusCode")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).int32(message.successStatusCode);
      return writer;
    };

    /**
     * Encodes the specified FileAddStatus message, length delimited. Does not implicitly {@link Records.FileAddStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FileAddStatus
     * @static
     * @param {Records.IFileAddStatus} message FileAddStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FileAddStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FileAddStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FileAddStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FileAddStatus} FileAddStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FileAddStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FileAddStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
            break;
          }
          case 3: {
            message.url = reader.string();
            break;
          }
          case 4: {
            message.parameters = reader.string();
            break;
          }
          case 5: {
            message.thumbnailParameters = reader.string();
            break;
          }
          case 6: {
            message.successStatusCode = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FileAddStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FileAddStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FileAddStatus} FileAddStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FileAddStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FileAddStatus message.
     * @function verify
     * @memberof Records.FileAddStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FileAddStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
            break;
        }
      if (message.url != null && message.hasOwnProperty("url"))
        if (!$util.isString(message.url)) return "url: string expected";
      if (message.parameters != null && message.hasOwnProperty("parameters"))
        if (!$util.isString(message.parameters)) return "parameters: string expected";
      if (message.thumbnailParameters != null && message.hasOwnProperty("thumbnailParameters"))
        if (!$util.isString(message.thumbnailParameters))
          return "thumbnailParameters: string expected";
      if (message.successStatusCode != null && message.hasOwnProperty("successStatusCode"))
        if (!$util.isInteger(message.successStatusCode))
          return "successStatusCode: integer expected";
      return null;
    };

    /**
     * Creates a FileAddStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FileAddStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FileAddStatus} FileAddStatus
     */
    FileAddStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FileAddStatus) return object;
      let message = new $root.Records.FileAddStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "FA_SUCCESS":
        case 0:
          message.status = 0;
          break;
        case "FA_ERROR":
        case 1:
          message.status = 1;
          break;
      }
      if (object.url != null) message.url = String(object.url);
      if (object.parameters != null) message.parameters = String(object.parameters);
      if (object.thumbnailParameters != null)
        message.thumbnailParameters = String(object.thumbnailParameters);
      if (object.successStatusCode != null)
        message.successStatusCode = object.successStatusCode | 0;
      return message;
    };

    /**
     * Creates a plain object from a FileAddStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FileAddStatus
     * @static
     * @param {Records.FileAddStatus} message FileAddStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FileAddStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = options.enums === String ? "FA_SUCCESS" : 0;
        object.url = "";
        object.parameters = "";
        object.thumbnailParameters = "";
        object.successStatusCode = 0;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.Records.FileAddResult[message.status] === undefined
              ? message.status
              : $root.Records.FileAddResult[message.status]
            : message.status;
      if (message.url != null && message.hasOwnProperty("url")) object.url = message.url;
      if (message.parameters != null && message.hasOwnProperty("parameters"))
        object.parameters = message.parameters;
      if (message.thumbnailParameters != null && message.hasOwnProperty("thumbnailParameters"))
        object.thumbnailParameters = message.thumbnailParameters;
      if (message.successStatusCode != null && message.hasOwnProperty("successStatusCode"))
        object.successStatusCode = message.successStatusCode;
      return object;
    };

    /**
     * Converts this FileAddStatus to JSON.
     * @function toJSON
     * @memberof Records.FileAddStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FileAddStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FileAddStatus
     * @function getTypeUrl
     * @memberof Records.FileAddStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FileAddStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FileAddStatus";
    };

    return FileAddStatus;
  })();

  Records.FilesAddResponse = (function () {
    /**
     * Properties of a FilesAddResponse.
     * @memberof Records
     * @interface IFilesAddResponse
     * @property {Array.<Records.IFileAddStatus>|null} [files] FilesAddResponse files
     * @property {number|Long|null} [revision] FilesAddResponse revision
     */

    /**
     * Constructs a new FilesAddResponse.
     * @memberof Records
     * @classdesc Represents a FilesAddResponse.
     * @implements IFilesAddResponse
     * @constructor
     * @param {Records.IFilesAddResponse=} [properties] Properties to set
     */
    function FilesAddResponse(properties) {
      this.files = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FilesAddResponse files.
     * @member {Array.<Records.IFileAddStatus>} files
     * @memberof Records.FilesAddResponse
     * @instance
     */
    FilesAddResponse.prototype.files = $util.emptyArray;

    /**
     * FilesAddResponse revision.
     * @member {number|Long} revision
     * @memberof Records.FilesAddResponse
     * @instance
     */
    FilesAddResponse.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new FilesAddResponse instance using the specified properties.
     * @function create
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Records.IFilesAddResponse=} [properties] Properties to set
     * @returns {Records.FilesAddResponse} FilesAddResponse instance
     */
    FilesAddResponse.create = function create(properties) {
      return new FilesAddResponse(properties);
    };

    /**
     * Encodes the specified FilesAddResponse message. Does not implicitly {@link Records.FilesAddResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Records.IFilesAddResponse} message FilesAddResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesAddResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.files != null && message.files.length)
        for (let i = 0; i < message.files.length; ++i)
          $root.Records.FileAddStatus.encode(
            message.files[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.revision);
      return writer;
    };

    /**
     * Encodes the specified FilesAddResponse message, length delimited. Does not implicitly {@link Records.FilesAddResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Records.IFilesAddResponse} message FilesAddResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesAddResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FilesAddResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FilesAddResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FilesAddResponse} FilesAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesAddResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FilesAddResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.files && message.files.length)) message.files = [];
            message.files.push($root.Records.FileAddStatus.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.revision = reader.int64();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FilesAddResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FilesAddResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FilesAddResponse} FilesAddResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesAddResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FilesAddResponse message.
     * @function verify
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FilesAddResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.files != null && message.hasOwnProperty("files")) {
        if (!Array.isArray(message.files)) return "files: array expected";
        for (let i = 0; i < message.files.length; ++i) {
          let error = $root.Records.FileAddStatus.verify(message.files[i]);
          if (error) return "files." + error;
        }
      }
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      return null;
    };

    /**
     * Creates a FilesAddResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FilesAddResponse} FilesAddResponse
     */
    FilesAddResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FilesAddResponse) return object;
      let message = new $root.Records.FilesAddResponse();
      if (object.files) {
        if (!Array.isArray(object.files))
          throw TypeError(".Records.FilesAddResponse.files: array expected");
        message.files = [];
        for (let i = 0; i < object.files.length; ++i) {
          if (typeof object.files[i] !== "object")
            throw TypeError(".Records.FilesAddResponse.files: object expected");
          message.files[i] = $root.Records.FileAddStatus.fromObject(object.files[i]);
        }
      }
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a FilesAddResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FilesAddResponse
     * @static
     * @param {Records.FilesAddResponse} message FilesAddResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FilesAddResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.files = [];
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
      if (message.files && message.files.length) {
        object.files = [];
        for (let j = 0; j < message.files.length; ++j)
          object.files[j] = $root.Records.FileAddStatus.toObject(message.files[j], options);
      }
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      return object;
    };

    /**
     * Converts this FilesAddResponse to JSON.
     * @function toJSON
     * @memberof Records.FilesAddResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FilesAddResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FilesAddResponse
     * @function getTypeUrl
     * @memberof Records.FilesAddResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FilesAddResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FilesAddResponse";
    };

    return FilesAddResponse;
  })();

  Records.FilesGetRequest = (function () {
    /**
     * Properties of a FilesGetRequest.
     * @memberof Records
     * @interface IFilesGetRequest
     * @property {Array.<Uint8Array>|null} [recordUids] FilesGetRequest recordUids
     * @property {boolean|null} [forThumbnails] FilesGetRequest forThumbnails
     * @property {string|null} [emergencyAccessAccountOwner] FilesGetRequest emergencyAccessAccountOwner
     */

    /**
     * Constructs a new FilesGetRequest.
     * @memberof Records
     * @classdesc Represents a FilesGetRequest.
     * @implements IFilesGetRequest
     * @constructor
     * @param {Records.IFilesGetRequest=} [properties] Properties to set
     */
    function FilesGetRequest(properties) {
      this.recordUids = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FilesGetRequest recordUids.
     * @member {Array.<Uint8Array>} recordUids
     * @memberof Records.FilesGetRequest
     * @instance
     */
    FilesGetRequest.prototype.recordUids = $util.emptyArray;

    /**
     * FilesGetRequest forThumbnails.
     * @member {boolean} forThumbnails
     * @memberof Records.FilesGetRequest
     * @instance
     */
    FilesGetRequest.prototype.forThumbnails = false;

    /**
     * FilesGetRequest emergencyAccessAccountOwner.
     * @member {string} emergencyAccessAccountOwner
     * @memberof Records.FilesGetRequest
     * @instance
     */
    FilesGetRequest.prototype.emergencyAccessAccountOwner = "";

    /**
     * Creates a new FilesGetRequest instance using the specified properties.
     * @function create
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Records.IFilesGetRequest=} [properties] Properties to set
     * @returns {Records.FilesGetRequest} FilesGetRequest instance
     */
    FilesGetRequest.create = function create(properties) {
      return new FilesGetRequest(properties);
    };

    /**
     * Encodes the specified FilesGetRequest message. Does not implicitly {@link Records.FilesGetRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Records.IFilesGetRequest} message FilesGetRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesGetRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUids != null && message.recordUids.length)
        for (let i = 0; i < message.recordUids.length; ++i)
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUids[i]);
      if (message.forThumbnails != null && Object.hasOwnProperty.call(message, "forThumbnails"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.forThumbnails);
      if (
        message.emergencyAccessAccountOwner != null &&
        Object.hasOwnProperty.call(message, "emergencyAccessAccountOwner")
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.emergencyAccessAccountOwner);
      return writer;
    };

    /**
     * Encodes the specified FilesGetRequest message, length delimited. Does not implicitly {@link Records.FilesGetRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Records.IFilesGetRequest} message FilesGetRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesGetRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FilesGetRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FilesGetRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FilesGetRequest} FilesGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesGetRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FilesGetRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordUids && message.recordUids.length)) message.recordUids = [];
            message.recordUids.push(reader.bytes());
            break;
          }
          case 2: {
            message.forThumbnails = reader.bool();
            break;
          }
          case 3: {
            message.emergencyAccessAccountOwner = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FilesGetRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FilesGetRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FilesGetRequest} FilesGetRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesGetRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FilesGetRequest message.
     * @function verify
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FilesGetRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUids != null && message.hasOwnProperty("recordUids")) {
        if (!Array.isArray(message.recordUids)) return "recordUids: array expected";
        for (let i = 0; i < message.recordUids.length; ++i)
          if (
            !(
              (message.recordUids[i] && typeof message.recordUids[i].length === "number") ||
              $util.isString(message.recordUids[i])
            )
          )
            return "recordUids: buffer[] expected";
      }
      if (message.forThumbnails != null && message.hasOwnProperty("forThumbnails"))
        if (typeof message.forThumbnails !== "boolean") return "forThumbnails: boolean expected";
      if (
        message.emergencyAccessAccountOwner != null &&
        message.hasOwnProperty("emergencyAccessAccountOwner")
      )
        if (!$util.isString(message.emergencyAccessAccountOwner))
          return "emergencyAccessAccountOwner: string expected";
      return null;
    };

    /**
     * Creates a FilesGetRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FilesGetRequest} FilesGetRequest
     */
    FilesGetRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FilesGetRequest) return object;
      let message = new $root.Records.FilesGetRequest();
      if (object.recordUids) {
        if (!Array.isArray(object.recordUids))
          throw TypeError(".Records.FilesGetRequest.recordUids: array expected");
        message.recordUids = [];
        for (let i = 0; i < object.recordUids.length; ++i)
          if (typeof object.recordUids[i] === "string")
            $util.base64.decode(
              object.recordUids[i],
              (message.recordUids[i] = $util.newBuffer($util.base64.length(object.recordUids[i]))),
              0,
            );
          else if (object.recordUids[i].length >= 0) message.recordUids[i] = object.recordUids[i];
      }
      if (object.forThumbnails != null) message.forThumbnails = Boolean(object.forThumbnails);
      if (object.emergencyAccessAccountOwner != null)
        message.emergencyAccessAccountOwner = String(object.emergencyAccessAccountOwner);
      return message;
    };

    /**
     * Creates a plain object from a FilesGetRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FilesGetRequest
     * @static
     * @param {Records.FilesGetRequest} message FilesGetRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FilesGetRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordUids = [];
      if (options.defaults) {
        object.forThumbnails = false;
        object.emergencyAccessAccountOwner = "";
      }
      if (message.recordUids && message.recordUids.length) {
        object.recordUids = [];
        for (let j = 0; j < message.recordUids.length; ++j)
          object.recordUids[j] =
            options.bytes === String
              ? $util.base64.encode(message.recordUids[j], 0, message.recordUids[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordUids[j])
                : message.recordUids[j];
      }
      if (message.forThumbnails != null && message.hasOwnProperty("forThumbnails"))
        object.forThumbnails = message.forThumbnails;
      if (
        message.emergencyAccessAccountOwner != null &&
        message.hasOwnProperty("emergencyAccessAccountOwner")
      )
        object.emergencyAccessAccountOwner = message.emergencyAccessAccountOwner;
      return object;
    };

    /**
     * Converts this FilesGetRequest to JSON.
     * @function toJSON
     * @memberof Records.FilesGetRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FilesGetRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FilesGetRequest
     * @function getTypeUrl
     * @memberof Records.FilesGetRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FilesGetRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FilesGetRequest";
    };

    return FilesGetRequest;
  })();

  Records.FileGetStatus = (function () {
    /**
     * Properties of a FileGetStatus.
     * @memberof Records
     * @interface IFileGetStatus
     * @property {Uint8Array|null} [recordUid] FileGetStatus recordUid
     * @property {Records.FileGetResult|null} [status] FileGetStatus status
     * @property {string|null} [url] FileGetStatus url
     * @property {number|null} [successStatusCode] FileGetStatus successStatusCode
     * @property {Records.RecordKeyType|null} [fileKeyType] FileGetStatus fileKeyType
     */

    /**
     * Constructs a new FileGetStatus.
     * @memberof Records
     * @classdesc Represents a FileGetStatus.
     * @implements IFileGetStatus
     * @constructor
     * @param {Records.IFileGetStatus=} [properties] Properties to set
     */
    function FileGetStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FileGetStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.FileGetStatus
     * @instance
     */
    FileGetStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * FileGetStatus status.
     * @member {Records.FileGetResult} status
     * @memberof Records.FileGetStatus
     * @instance
     */
    FileGetStatus.prototype.status = 0;

    /**
     * FileGetStatus url.
     * @member {string} url
     * @memberof Records.FileGetStatus
     * @instance
     */
    FileGetStatus.prototype.url = "";

    /**
     * FileGetStatus successStatusCode.
     * @member {number} successStatusCode
     * @memberof Records.FileGetStatus
     * @instance
     */
    FileGetStatus.prototype.successStatusCode = 0;

    /**
     * FileGetStatus fileKeyType.
     * @member {Records.RecordKeyType} fileKeyType
     * @memberof Records.FileGetStatus
     * @instance
     */
    FileGetStatus.prototype.fileKeyType = 0;

    /**
     * Creates a new FileGetStatus instance using the specified properties.
     * @function create
     * @memberof Records.FileGetStatus
     * @static
     * @param {Records.IFileGetStatus=} [properties] Properties to set
     * @returns {Records.FileGetStatus} FileGetStatus instance
     */
    FileGetStatus.create = function create(properties) {
      return new FileGetStatus(properties);
    };

    /**
     * Encodes the specified FileGetStatus message. Does not implicitly {@link Records.FileGetStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.FileGetStatus
     * @static
     * @param {Records.IFileGetStatus} message FileGetStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FileGetStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      if (message.url != null && Object.hasOwnProperty.call(message, "url"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.url);
      if (
        message.successStatusCode != null &&
        Object.hasOwnProperty.call(message, "successStatusCode")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.successStatusCode);
      if (message.fileKeyType != null && Object.hasOwnProperty.call(message, "fileKeyType"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.fileKeyType);
      return writer;
    };

    /**
     * Encodes the specified FileGetStatus message, length delimited. Does not implicitly {@link Records.FileGetStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FileGetStatus
     * @static
     * @param {Records.IFileGetStatus} message FileGetStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FileGetStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FileGetStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FileGetStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FileGetStatus} FileGetStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FileGetStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FileGetStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
            break;
          }
          case 3: {
            message.url = reader.string();
            break;
          }
          case 4: {
            message.successStatusCode = reader.int32();
            break;
          }
          case 5: {
            message.fileKeyType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FileGetStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FileGetStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FileGetStatus} FileGetStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FileGetStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FileGetStatus message.
     * @function verify
     * @memberof Records.FileGetStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FileGetStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.url != null && message.hasOwnProperty("url"))
        if (!$util.isString(message.url)) return "url: string expected";
      if (message.successStatusCode != null && message.hasOwnProperty("successStatusCode"))
        if (!$util.isInteger(message.successStatusCode))
          return "successStatusCode: integer expected";
      if (message.fileKeyType != null && message.hasOwnProperty("fileKeyType"))
        switch (message.fileKeyType) {
          default:
            return "fileKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      return null;
    };

    /**
     * Creates a FileGetStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FileGetStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FileGetStatus} FileGetStatus
     */
    FileGetStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FileGetStatus) return object;
      let message = new $root.Records.FileGetStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "FG_SUCCESS":
        case 0:
          message.status = 0;
          break;
        case "FG_ERROR":
        case 1:
          message.status = 1;
          break;
        case "FG_ACCESS_DENIED":
        case 2:
          message.status = 2;
          break;
      }
      if (object.url != null) message.url = String(object.url);
      if (object.successStatusCode != null)
        message.successStatusCode = object.successStatusCode | 0;
      switch (object.fileKeyType) {
        default:
          if (typeof object.fileKeyType === "number") {
            message.fileKeyType = object.fileKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.fileKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.fileKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.fileKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.fileKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.fileKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.fileKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.fileKeyType = 6;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a FileGetStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FileGetStatus
     * @static
     * @param {Records.FileGetStatus} message FileGetStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FileGetStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = options.enums === String ? "FG_SUCCESS" : 0;
        object.url = "";
        object.successStatusCode = 0;
        object.fileKeyType = options.enums === String ? "NO_KEY" : 0;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.Records.FileGetResult[message.status] === undefined
              ? message.status
              : $root.Records.FileGetResult[message.status]
            : message.status;
      if (message.url != null && message.hasOwnProperty("url")) object.url = message.url;
      if (message.successStatusCode != null && message.hasOwnProperty("successStatusCode"))
        object.successStatusCode = message.successStatusCode;
      if (message.fileKeyType != null && message.hasOwnProperty("fileKeyType"))
        object.fileKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.fileKeyType] === undefined
              ? message.fileKeyType
              : $root.Records.RecordKeyType[message.fileKeyType]
            : message.fileKeyType;
      return object;
    };

    /**
     * Converts this FileGetStatus to JSON.
     * @function toJSON
     * @memberof Records.FileGetStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FileGetStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FileGetStatus
     * @function getTypeUrl
     * @memberof Records.FileGetStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FileGetStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FileGetStatus";
    };

    return FileGetStatus;
  })();

  Records.FilesGetResponse = (function () {
    /**
     * Properties of a FilesGetResponse.
     * @memberof Records
     * @interface IFilesGetResponse
     * @property {Array.<Records.IFileGetStatus>|null} [files] FilesGetResponse files
     */

    /**
     * Constructs a new FilesGetResponse.
     * @memberof Records
     * @classdesc Represents a FilesGetResponse.
     * @implements IFilesGetResponse
     * @constructor
     * @param {Records.IFilesGetResponse=} [properties] Properties to set
     */
    function FilesGetResponse(properties) {
      this.files = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FilesGetResponse files.
     * @member {Array.<Records.IFileGetStatus>} files
     * @memberof Records.FilesGetResponse
     * @instance
     */
    FilesGetResponse.prototype.files = $util.emptyArray;

    /**
     * Creates a new FilesGetResponse instance using the specified properties.
     * @function create
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Records.IFilesGetResponse=} [properties] Properties to set
     * @returns {Records.FilesGetResponse} FilesGetResponse instance
     */
    FilesGetResponse.create = function create(properties) {
      return new FilesGetResponse(properties);
    };

    /**
     * Encodes the specified FilesGetResponse message. Does not implicitly {@link Records.FilesGetResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Records.IFilesGetResponse} message FilesGetResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesGetResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.files != null && message.files.length)
        for (let i = 0; i < message.files.length; ++i)
          $root.Records.FileGetStatus.encode(
            message.files[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified FilesGetResponse message, length delimited. Does not implicitly {@link Records.FilesGetResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Records.IFilesGetResponse} message FilesGetResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FilesGetResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FilesGetResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.FilesGetResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.FilesGetResponse} FilesGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesGetResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.FilesGetResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.files && message.files.length)) message.files = [];
            message.files.push($root.Records.FileGetStatus.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a FilesGetResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.FilesGetResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.FilesGetResponse} FilesGetResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FilesGetResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FilesGetResponse message.
     * @function verify
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FilesGetResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.files != null && message.hasOwnProperty("files")) {
        if (!Array.isArray(message.files)) return "files: array expected";
        for (let i = 0; i < message.files.length; ++i) {
          let error = $root.Records.FileGetStatus.verify(message.files[i]);
          if (error) return "files." + error;
        }
      }
      return null;
    };

    /**
     * Creates a FilesGetResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.FilesGetResponse} FilesGetResponse
     */
    FilesGetResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.FilesGetResponse) return object;
      let message = new $root.Records.FilesGetResponse();
      if (object.files) {
        if (!Array.isArray(object.files))
          throw TypeError(".Records.FilesGetResponse.files: array expected");
        message.files = [];
        for (let i = 0; i < object.files.length; ++i) {
          if (typeof object.files[i] !== "object")
            throw TypeError(".Records.FilesGetResponse.files: object expected");
          message.files[i] = $root.Records.FileGetStatus.fromObject(object.files[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a FilesGetResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.FilesGetResponse
     * @static
     * @param {Records.FilesGetResponse} message FilesGetResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FilesGetResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.files = [];
      if (message.files && message.files.length) {
        object.files = [];
        for (let j = 0; j < message.files.length; ++j)
          object.files[j] = $root.Records.FileGetStatus.toObject(message.files[j], options);
      }
      return object;
    };

    /**
     * Converts this FilesGetResponse to JSON.
     * @function toJSON
     * @memberof Records.FilesGetResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FilesGetResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FilesGetResponse
     * @function getTypeUrl
     * @memberof Records.FilesGetResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FilesGetResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.FilesGetResponse";
    };

    return FilesGetResponse;
  })();

  Records.ApplicationAddRequest = (function () {
    /**
     * Properties of an ApplicationAddRequest.
     * @memberof Records
     * @interface IApplicationAddRequest
     * @property {Uint8Array|null} [appUid] ApplicationAddRequest appUid
     * @property {Uint8Array|null} [recordKey] ApplicationAddRequest recordKey
     * @property {number|Long|null} [clientModifiedTime] ApplicationAddRequest clientModifiedTime
     * @property {Uint8Array|null} [data] ApplicationAddRequest data
     * @property {Records.IRecordAudit|null} [audit] ApplicationAddRequest audit
     */

    /**
     * Constructs a new ApplicationAddRequest.
     * @memberof Records
     * @classdesc Represents an ApplicationAddRequest.
     * @implements IApplicationAddRequest
     * @constructor
     * @param {Records.IApplicationAddRequest=} [properties] Properties to set
     */
    function ApplicationAddRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ApplicationAddRequest appUid.
     * @member {Uint8Array} appUid
     * @memberof Records.ApplicationAddRequest
     * @instance
     */
    ApplicationAddRequest.prototype.appUid = $util.newBuffer([]);

    /**
     * ApplicationAddRequest recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.ApplicationAddRequest
     * @instance
     */
    ApplicationAddRequest.prototype.recordKey = $util.newBuffer([]);

    /**
     * ApplicationAddRequest clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.ApplicationAddRequest
     * @instance
     */
    ApplicationAddRequest.prototype.clientModifiedTime = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * ApplicationAddRequest data.
     * @member {Uint8Array} data
     * @memberof Records.ApplicationAddRequest
     * @instance
     */
    ApplicationAddRequest.prototype.data = $util.newBuffer([]);

    /**
     * ApplicationAddRequest audit.
     * @member {Records.IRecordAudit|null|undefined} audit
     * @memberof Records.ApplicationAddRequest
     * @instance
     */
    ApplicationAddRequest.prototype.audit = null;

    /**
     * Creates a new ApplicationAddRequest instance using the specified properties.
     * @function create
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Records.IApplicationAddRequest=} [properties] Properties to set
     * @returns {Records.ApplicationAddRequest} ApplicationAddRequest instance
     */
    ApplicationAddRequest.create = function create(properties) {
      return new ApplicationAddRequest(properties);
    };

    /**
     * Encodes the specified ApplicationAddRequest message. Does not implicitly {@link Records.ApplicationAddRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Records.IApplicationAddRequest} message ApplicationAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ApplicationAddRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.appUid != null && Object.hasOwnProperty.call(message, "appUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.appUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordKey);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.clientModifiedTime);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.data);
      if (message.audit != null && Object.hasOwnProperty.call(message, "audit"))
        $root.Records.RecordAudit.encode(
          message.audit,
          writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified ApplicationAddRequest message, length delimited. Does not implicitly {@link Records.ApplicationAddRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Records.IApplicationAddRequest} message ApplicationAddRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ApplicationAddRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an ApplicationAddRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.ApplicationAddRequest} ApplicationAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ApplicationAddRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.ApplicationAddRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.appUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordKey = reader.bytes();
            break;
          }
          case 3: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 4: {
            message.data = reader.bytes();
            break;
          }
          case 5: {
            message.audit = $root.Records.RecordAudit.decode(reader, reader.uint32());
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes an ApplicationAddRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.ApplicationAddRequest} ApplicationAddRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ApplicationAddRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an ApplicationAddRequest message.
     * @function verify
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ApplicationAddRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.appUid != null && message.hasOwnProperty("appUid"))
        if (
          !(
            (message.appUid && typeof message.appUid.length === "number") ||
            $util.isString(message.appUid)
          )
        )
          return "appUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data"))
        if (
          !(
            (message.data && typeof message.data.length === "number") ||
            $util.isString(message.data)
          )
        )
          return "data: buffer expected";
      if (message.audit != null && message.hasOwnProperty("audit")) {
        let error = $root.Records.RecordAudit.verify(message.audit);
        if (error) return "audit." + error;
      }
      return null;
    };

    /**
     * Creates an ApplicationAddRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.ApplicationAddRequest} ApplicationAddRequest
     */
    ApplicationAddRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.ApplicationAddRequest) return object;
      let message = new $root.Records.ApplicationAddRequest();
      if (object.appUid != null)
        if (typeof object.appUid === "string")
          $util.base64.decode(
            object.appUid,
            (message.appUid = $util.newBuffer($util.base64.length(object.appUid))),
            0,
          );
        else if (object.appUid.length >= 0) message.appUid = object.appUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.data != null)
        if (typeof object.data === "string")
          $util.base64.decode(
            object.data,
            (message.data = $util.newBuffer($util.base64.length(object.data))),
            0,
          );
        else if (object.data.length >= 0) message.data = object.data;
      if (object.audit != null) {
        if (typeof object.audit !== "object")
          throw TypeError(".Records.ApplicationAddRequest.audit: object expected");
        message.audit = $root.Records.RecordAudit.fromObject(object.audit);
      }
      return message;
    };

    /**
     * Creates a plain object from an ApplicationAddRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {Records.ApplicationAddRequest} message ApplicationAddRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ApplicationAddRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.appUid = "";
        else {
          object.appUid = [];
          if (options.bytes !== Array) object.appUid = $util.newBuffer(object.appUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.data = "";
        else {
          object.data = [];
          if (options.bytes !== Array) object.data = $util.newBuffer(object.data);
        }
        object.audit = null;
      }
      if (message.appUid != null && message.hasOwnProperty("appUid"))
        object.appUid =
          options.bytes === String
            ? $util.base64.encode(message.appUid, 0, message.appUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.appUid)
              : message.appUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.data != null && message.hasOwnProperty("data"))
        object.data =
          options.bytes === String
            ? $util.base64.encode(message.data, 0, message.data.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.data)
              : message.data;
      if (message.audit != null && message.hasOwnProperty("audit"))
        object.audit = $root.Records.RecordAudit.toObject(message.audit, options);
      return object;
    };

    /**
     * Converts this ApplicationAddRequest to JSON.
     * @function toJSON
     * @memberof Records.ApplicationAddRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ApplicationAddRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ApplicationAddRequest
     * @function getTypeUrl
     * @memberof Records.ApplicationAddRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ApplicationAddRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.ApplicationAddRequest";
    };

    return ApplicationAddRequest;
  })();

  Records.GetRecordDataWithAccessInfoRequest = (function () {
    /**
     * Properties of a GetRecordDataWithAccessInfoRequest.
     * @memberof Records
     * @interface IGetRecordDataWithAccessInfoRequest
     * @property {number|Long|null} [clientTime] GetRecordDataWithAccessInfoRequest clientTime
     * @property {Array.<Uint8Array>|null} [recordUid] GetRecordDataWithAccessInfoRequest recordUid
     * @property {Records.RecordDetailsInclude|null} [recordDetailsInclude] GetRecordDataWithAccessInfoRequest recordDetailsInclude
     */

    /**
     * Constructs a new GetRecordDataWithAccessInfoRequest.
     * @memberof Records
     * @classdesc Represents a GetRecordDataWithAccessInfoRequest.
     * @implements IGetRecordDataWithAccessInfoRequest
     * @constructor
     * @param {Records.IGetRecordDataWithAccessInfoRequest=} [properties] Properties to set
     */
    function GetRecordDataWithAccessInfoRequest(properties) {
      this.recordUid = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetRecordDataWithAccessInfoRequest clientTime.
     * @member {number|Long} clientTime
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @instance
     */
    GetRecordDataWithAccessInfoRequest.prototype.clientTime = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * GetRecordDataWithAccessInfoRequest recordUid.
     * @member {Array.<Uint8Array>} recordUid
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @instance
     */
    GetRecordDataWithAccessInfoRequest.prototype.recordUid = $util.emptyArray;

    /**
     * GetRecordDataWithAccessInfoRequest recordDetailsInclude.
     * @member {Records.RecordDetailsInclude} recordDetailsInclude
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @instance
     */
    GetRecordDataWithAccessInfoRequest.prototype.recordDetailsInclude = 0;

    /**
     * Creates a new GetRecordDataWithAccessInfoRequest instance using the specified properties.
     * @function create
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoRequest=} [properties] Properties to set
     * @returns {Records.GetRecordDataWithAccessInfoRequest} GetRecordDataWithAccessInfoRequest instance
     */
    GetRecordDataWithAccessInfoRequest.create = function create(properties) {
      return new GetRecordDataWithAccessInfoRequest(properties);
    };

    /**
     * Encodes the specified GetRecordDataWithAccessInfoRequest message. Does not implicitly {@link Records.GetRecordDataWithAccessInfoRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoRequest} message GetRecordDataWithAccessInfoRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordDataWithAccessInfoRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.clientTime != null && Object.hasOwnProperty.call(message, "clientTime"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.clientTime);
      if (message.recordUid != null && message.recordUid.length)
        for (let i = 0; i < message.recordUid.length; ++i)
          writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordUid[i]);
      if (
        message.recordDetailsInclude != null &&
        Object.hasOwnProperty.call(message, "recordDetailsInclude")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.recordDetailsInclude);
      return writer;
    };

    /**
     * Encodes the specified GetRecordDataWithAccessInfoRequest message, length delimited. Does not implicitly {@link Records.GetRecordDataWithAccessInfoRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoRequest} message GetRecordDataWithAccessInfoRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordDataWithAccessInfoRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetRecordDataWithAccessInfoRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetRecordDataWithAccessInfoRequest} GetRecordDataWithAccessInfoRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordDataWithAccessInfoRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetRecordDataWithAccessInfoRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.clientTime = reader.int64();
            break;
          }
          case 2: {
            if (!(message.recordUid && message.recordUid.length)) message.recordUid = [];
            message.recordUid.push(reader.bytes());
            break;
          }
          case 3: {
            message.recordDetailsInclude = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetRecordDataWithAccessInfoRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetRecordDataWithAccessInfoRequest} GetRecordDataWithAccessInfoRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordDataWithAccessInfoRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetRecordDataWithAccessInfoRequest message.
     * @function verify
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetRecordDataWithAccessInfoRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (
          !$util.isInteger(message.clientTime) &&
          !(
            message.clientTime &&
            $util.isInteger(message.clientTime.low) &&
            $util.isInteger(message.clientTime.high)
          )
        )
          return "clientTime: integer|Long expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid")) {
        if (!Array.isArray(message.recordUid)) return "recordUid: array expected";
        for (let i = 0; i < message.recordUid.length; ++i)
          if (
            !(
              (message.recordUid[i] && typeof message.recordUid[i].length === "number") ||
              $util.isString(message.recordUid[i])
            )
          )
            return "recordUid: buffer[] expected";
      }
      if (message.recordDetailsInclude != null && message.hasOwnProperty("recordDetailsInclude"))
        switch (message.recordDetailsInclude) {
          default:
            return "recordDetailsInclude: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      return null;
    };

    /**
     * Creates a GetRecordDataWithAccessInfoRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetRecordDataWithAccessInfoRequest} GetRecordDataWithAccessInfoRequest
     */
    GetRecordDataWithAccessInfoRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetRecordDataWithAccessInfoRequest) return object;
      let message = new $root.Records.GetRecordDataWithAccessInfoRequest();
      if (object.clientTime != null)
        if ($util.Long)
          (message.clientTime = $util.Long.fromValue(object.clientTime)).unsigned = false;
        else if (typeof object.clientTime === "string")
          message.clientTime = parseInt(object.clientTime, 10);
        else if (typeof object.clientTime === "number") message.clientTime = object.clientTime;
        else if (typeof object.clientTime === "object")
          message.clientTime = new $util.LongBits(
            object.clientTime.low >>> 0,
            object.clientTime.high >>> 0,
          ).toNumber();
      if (object.recordUid) {
        if (!Array.isArray(object.recordUid))
          throw TypeError(".Records.GetRecordDataWithAccessInfoRequest.recordUid: array expected");
        message.recordUid = [];
        for (let i = 0; i < object.recordUid.length; ++i)
          if (typeof object.recordUid[i] === "string")
            $util.base64.decode(
              object.recordUid[i],
              (message.recordUid[i] = $util.newBuffer($util.base64.length(object.recordUid[i]))),
              0,
            );
          else if (object.recordUid[i].length >= 0) message.recordUid[i] = object.recordUid[i];
      }
      switch (object.recordDetailsInclude) {
        default:
          if (typeof object.recordDetailsInclude === "number") {
            message.recordDetailsInclude = object.recordDetailsInclude;
            break;
          }
          break;
        case "DATA_PLUS_SHARE":
        case 0:
          message.recordDetailsInclude = 0;
          break;
        case "DATA_ONLY":
        case 1:
          message.recordDetailsInclude = 1;
          break;
        case "SHARE_ONLY":
        case 2:
          message.recordDetailsInclude = 2;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a GetRecordDataWithAccessInfoRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {Records.GetRecordDataWithAccessInfoRequest} message GetRecordDataWithAccessInfoRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetRecordDataWithAccessInfoRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordUid = [];
      if (options.defaults) {
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientTime = options.longs === String ? "0" : 0;
        object.recordDetailsInclude = options.enums === String ? "DATA_PLUS_SHARE" : 0;
      }
      if (message.clientTime != null && message.hasOwnProperty("clientTime"))
        if (typeof message.clientTime === "number")
          object.clientTime =
            options.longs === String ? String(message.clientTime) : message.clientTime;
        else
          object.clientTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientTime.low >>> 0,
                    message.clientTime.high >>> 0,
                  ).toNumber()
                : message.clientTime;
      if (message.recordUid && message.recordUid.length) {
        object.recordUid = [];
        for (let j = 0; j < message.recordUid.length; ++j)
          object.recordUid[j] =
            options.bytes === String
              ? $util.base64.encode(message.recordUid[j], 0, message.recordUid[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordUid[j])
                : message.recordUid[j];
      }
      if (message.recordDetailsInclude != null && message.hasOwnProperty("recordDetailsInclude"))
        object.recordDetailsInclude =
          options.enums === String
            ? $root.Records.RecordDetailsInclude[message.recordDetailsInclude] === undefined
              ? message.recordDetailsInclude
              : $root.Records.RecordDetailsInclude[message.recordDetailsInclude]
            : message.recordDetailsInclude;
      return object;
    };

    /**
     * Converts this GetRecordDataWithAccessInfoRequest to JSON.
     * @function toJSON
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetRecordDataWithAccessInfoRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetRecordDataWithAccessInfoRequest
     * @function getTypeUrl
     * @memberof Records.GetRecordDataWithAccessInfoRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetRecordDataWithAccessInfoRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetRecordDataWithAccessInfoRequest";
    };

    return GetRecordDataWithAccessInfoRequest;
  })();

  Records.UserPermission = (function () {
    /**
     * Properties of a UserPermission.
     * @memberof Records
     * @interface IUserPermission
     * @property {string|null} [username] UserPermission username
     * @property {boolean|null} [owner] UserPermission owner
     * @property {boolean|null} [shareAdmin] UserPermission shareAdmin
     * @property {boolean|null} [sharable] UserPermission sharable
     * @property {boolean|null} [editable] UserPermission editable
     * @property {boolean|null} [awaitingApproval] UserPermission awaitingApproval
     * @property {number|Long|null} [expiration] UserPermission expiration
     * @property {Uint8Array|null} [accountUid] UserPermission accountUid
     * @property {Records.TimerNotificationType|null} [timerNotificationType] UserPermission timerNotificationType
     * @property {boolean|null} [rotateOnExpiration] UserPermission rotateOnExpiration
     */

    /**
     * Constructs a new UserPermission.
     * @memberof Records
     * @classdesc Represents a UserPermission.
     * @implements IUserPermission
     * @constructor
     * @param {Records.IUserPermission=} [properties] Properties to set
     */
    function UserPermission(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserPermission username.
     * @member {string} username
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.username = "";

    /**
     * UserPermission owner.
     * @member {boolean} owner
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.owner = false;

    /**
     * UserPermission shareAdmin.
     * @member {boolean} shareAdmin
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.shareAdmin = false;

    /**
     * UserPermission sharable.
     * @member {boolean} sharable
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.sharable = false;

    /**
     * UserPermission editable.
     * @member {boolean} editable
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.editable = false;

    /**
     * UserPermission awaitingApproval.
     * @member {boolean} awaitingApproval
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.awaitingApproval = false;

    /**
     * UserPermission expiration.
     * @member {number|Long} expiration
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.expiration = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * UserPermission accountUid.
     * @member {Uint8Array} accountUid
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.accountUid = $util.newBuffer([]);

    /**
     * UserPermission timerNotificationType.
     * @member {Records.TimerNotificationType} timerNotificationType
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.timerNotificationType = 0;

    /**
     * UserPermission rotateOnExpiration.
     * @member {boolean} rotateOnExpiration
     * @memberof Records.UserPermission
     * @instance
     */
    UserPermission.prototype.rotateOnExpiration = false;

    /**
     * Creates a new UserPermission instance using the specified properties.
     * @function create
     * @memberof Records.UserPermission
     * @static
     * @param {Records.IUserPermission=} [properties] Properties to set
     * @returns {Records.UserPermission} UserPermission instance
     */
    UserPermission.create = function create(properties) {
      return new UserPermission(properties);
    };

    /**
     * Encodes the specified UserPermission message. Does not implicitly {@link Records.UserPermission.verify|verify} messages.
     * @function encode
     * @memberof Records.UserPermission
     * @static
     * @param {Records.IUserPermission} message UserPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserPermission.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.username != null && Object.hasOwnProperty.call(message, "username"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.username);
      if (message.owner != null && Object.hasOwnProperty.call(message, "owner"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.owner);
      if (message.shareAdmin != null && Object.hasOwnProperty.call(message, "shareAdmin"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.shareAdmin);
      if (message.sharable != null && Object.hasOwnProperty.call(message, "sharable"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.sharable);
      if (message.editable != null && Object.hasOwnProperty.call(message, "editable"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).bool(message.editable);
      if (
        message.awaitingApproval != null &&
        Object.hasOwnProperty.call(message, "awaitingApproval")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).bool(message.awaitingApproval);
      if (message.expiration != null && Object.hasOwnProperty.call(message, "expiration"))
        writer.uint32(/* id 7, wireType 0 =*/ 56).int64(message.expiration);
      if (message.accountUid != null && Object.hasOwnProperty.call(message, "accountUid"))
        writer.uint32(/* id 8, wireType 2 =*/ 66).bytes(message.accountUid);
      if (
        message.timerNotificationType != null &&
        Object.hasOwnProperty.call(message, "timerNotificationType")
      )
        writer.uint32(/* id 9, wireType 0 =*/ 72).int32(message.timerNotificationType);
      if (
        message.rotateOnExpiration != null &&
        Object.hasOwnProperty.call(message, "rotateOnExpiration")
      )
        writer.uint32(/* id 10, wireType 0 =*/ 80).bool(message.rotateOnExpiration);
      return writer;
    };

    /**
     * Encodes the specified UserPermission message, length delimited. Does not implicitly {@link Records.UserPermission.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.UserPermission
     * @static
     * @param {Records.IUserPermission} message UserPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserPermission.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserPermission message from the specified reader or buffer.
     * @function decode
     * @memberof Records.UserPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.UserPermission} UserPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserPermission.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.UserPermission();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.username = reader.string();
            break;
          }
          case 2: {
            message.owner = reader.bool();
            break;
          }
          case 3: {
            message.shareAdmin = reader.bool();
            break;
          }
          case 4: {
            message.sharable = reader.bool();
            break;
          }
          case 5: {
            message.editable = reader.bool();
            break;
          }
          case 6: {
            message.awaitingApproval = reader.bool();
            break;
          }
          case 7: {
            message.expiration = reader.int64();
            break;
          }
          case 8: {
            message.accountUid = reader.bytes();
            break;
          }
          case 9: {
            message.timerNotificationType = reader.int32();
            break;
          }
          case 10: {
            message.rotateOnExpiration = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a UserPermission message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.UserPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.UserPermission} UserPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserPermission.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserPermission message.
     * @function verify
     * @memberof Records.UserPermission
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserPermission.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.username != null && message.hasOwnProperty("username"))
        if (!$util.isString(message.username)) return "username: string expected";
      if (message.owner != null && message.hasOwnProperty("owner"))
        if (typeof message.owner !== "boolean") return "owner: boolean expected";
      if (message.shareAdmin != null && message.hasOwnProperty("shareAdmin"))
        if (typeof message.shareAdmin !== "boolean") return "shareAdmin: boolean expected";
      if (message.sharable != null && message.hasOwnProperty("sharable"))
        if (typeof message.sharable !== "boolean") return "sharable: boolean expected";
      if (message.editable != null && message.hasOwnProperty("editable"))
        if (typeof message.editable !== "boolean") return "editable: boolean expected";
      if (message.awaitingApproval != null && message.hasOwnProperty("awaitingApproval"))
        if (typeof message.awaitingApproval !== "boolean")
          return "awaitingApproval: boolean expected";
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (
          !$util.isInteger(message.expiration) &&
          !(
            message.expiration &&
            $util.isInteger(message.expiration.low) &&
            $util.isInteger(message.expiration.high)
          )
        )
          return "expiration: integer|Long expected";
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        if (
          !(
            (message.accountUid && typeof message.accountUid.length === "number") ||
            $util.isString(message.accountUid)
          )
        )
          return "accountUid: buffer expected";
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        switch (message.timerNotificationType) {
          default:
            return "timerNotificationType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        if (typeof message.rotateOnExpiration !== "boolean")
          return "rotateOnExpiration: boolean expected";
      return null;
    };

    /**
     * Creates a UserPermission message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.UserPermission
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.UserPermission} UserPermission
     */
    UserPermission.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.UserPermission) return object;
      let message = new $root.Records.UserPermission();
      if (object.username != null) message.username = String(object.username);
      if (object.owner != null) message.owner = Boolean(object.owner);
      if (object.shareAdmin != null) message.shareAdmin = Boolean(object.shareAdmin);
      if (object.sharable != null) message.sharable = Boolean(object.sharable);
      if (object.editable != null) message.editable = Boolean(object.editable);
      if (object.awaitingApproval != null)
        message.awaitingApproval = Boolean(object.awaitingApproval);
      if (object.expiration != null)
        if ($util.Long)
          (message.expiration = $util.Long.fromValue(object.expiration)).unsigned = false;
        else if (typeof object.expiration === "string")
          message.expiration = parseInt(object.expiration, 10);
        else if (typeof object.expiration === "number") message.expiration = object.expiration;
        else if (typeof object.expiration === "object")
          message.expiration = new $util.LongBits(
            object.expiration.low >>> 0,
            object.expiration.high >>> 0,
          ).toNumber();
      if (object.accountUid != null)
        if (typeof object.accountUid === "string")
          $util.base64.decode(
            object.accountUid,
            (message.accountUid = $util.newBuffer($util.base64.length(object.accountUid))),
            0,
          );
        else if (object.accountUid.length >= 0) message.accountUid = object.accountUid;
      switch (object.timerNotificationType) {
        default:
          if (typeof object.timerNotificationType === "number") {
            message.timerNotificationType = object.timerNotificationType;
            break;
          }
          break;
        case "NOTIFICATION_OFF":
        case 0:
          message.timerNotificationType = 0;
          break;
        case "NOTIFY_OWNER":
        case 1:
          message.timerNotificationType = 1;
          break;
        case "NOTIFY_PRIVILEGED_USERS":
        case 2:
          message.timerNotificationType = 2;
          break;
      }
      if (object.rotateOnExpiration != null)
        message.rotateOnExpiration = Boolean(object.rotateOnExpiration);
      return message;
    };

    /**
     * Creates a plain object from a UserPermission message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.UserPermission
     * @static
     * @param {Records.UserPermission} message UserPermission
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserPermission.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.username = "";
        object.owner = false;
        object.shareAdmin = false;
        object.sharable = false;
        object.editable = false;
        object.awaitingApproval = false;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.expiration =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.expiration = options.longs === String ? "0" : 0;
        if (options.bytes === String) object.accountUid = "";
        else {
          object.accountUid = [];
          if (options.bytes !== Array) object.accountUid = $util.newBuffer(object.accountUid);
        }
        object.timerNotificationType = options.enums === String ? "NOTIFICATION_OFF" : 0;
        object.rotateOnExpiration = false;
      }
      if (message.username != null && message.hasOwnProperty("username"))
        object.username = message.username;
      if (message.owner != null && message.hasOwnProperty("owner")) object.owner = message.owner;
      if (message.shareAdmin != null && message.hasOwnProperty("shareAdmin"))
        object.shareAdmin = message.shareAdmin;
      if (message.sharable != null && message.hasOwnProperty("sharable"))
        object.sharable = message.sharable;
      if (message.editable != null && message.hasOwnProperty("editable"))
        object.editable = message.editable;
      if (message.awaitingApproval != null && message.hasOwnProperty("awaitingApproval"))
        object.awaitingApproval = message.awaitingApproval;
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (typeof message.expiration === "number")
          object.expiration =
            options.longs === String ? String(message.expiration) : message.expiration;
        else
          object.expiration =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.expiration)
              : options.longs === Number
                ? new $util.LongBits(
                    message.expiration.low >>> 0,
                    message.expiration.high >>> 0,
                  ).toNumber()
                : message.expiration;
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        object.accountUid =
          options.bytes === String
            ? $util.base64.encode(message.accountUid, 0, message.accountUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.accountUid)
              : message.accountUid;
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        object.timerNotificationType =
          options.enums === String
            ? $root.Records.TimerNotificationType[message.timerNotificationType] === undefined
              ? message.timerNotificationType
              : $root.Records.TimerNotificationType[message.timerNotificationType]
            : message.timerNotificationType;
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        object.rotateOnExpiration = message.rotateOnExpiration;
      return object;
    };

    /**
     * Converts this UserPermission to JSON.
     * @function toJSON
     * @memberof Records.UserPermission
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserPermission.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UserPermission
     * @function getTypeUrl
     * @memberof Records.UserPermission
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UserPermission.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.UserPermission";
    };

    return UserPermission;
  })();

  Records.SharedFolderPermission = (function () {
    /**
     * Properties of a SharedFolderPermission.
     * @memberof Records
     * @interface ISharedFolderPermission
     * @property {Uint8Array|null} [sharedFolderUid] SharedFolderPermission sharedFolderUid
     * @property {boolean|null} [resharable] SharedFolderPermission resharable
     * @property {boolean|null} [editable] SharedFolderPermission editable
     * @property {number|Long|null} [revision] SharedFolderPermission revision
     * @property {number|Long|null} [expiration] SharedFolderPermission expiration
     * @property {Records.TimerNotificationType|null} [timerNotificationType] SharedFolderPermission timerNotificationType
     * @property {boolean|null} [rotateOnExpiration] SharedFolderPermission rotateOnExpiration
     */

    /**
     * Constructs a new SharedFolderPermission.
     * @memberof Records
     * @classdesc Represents a SharedFolderPermission.
     * @implements ISharedFolderPermission
     * @constructor
     * @param {Records.ISharedFolderPermission=} [properties] Properties to set
     */
    function SharedFolderPermission(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SharedFolderPermission sharedFolderUid.
     * @member {Uint8Array} sharedFolderUid
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.sharedFolderUid = $util.newBuffer([]);

    /**
     * SharedFolderPermission resharable.
     * @member {boolean} resharable
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.resharable = false;

    /**
     * SharedFolderPermission editable.
     * @member {boolean} editable
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.editable = false;

    /**
     * SharedFolderPermission revision.
     * @member {number|Long} revision
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * SharedFolderPermission expiration.
     * @member {number|Long} expiration
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.expiration = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * SharedFolderPermission timerNotificationType.
     * @member {Records.TimerNotificationType} timerNotificationType
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.timerNotificationType = 0;

    /**
     * SharedFolderPermission rotateOnExpiration.
     * @member {boolean} rotateOnExpiration
     * @memberof Records.SharedFolderPermission
     * @instance
     */
    SharedFolderPermission.prototype.rotateOnExpiration = false;

    /**
     * Creates a new SharedFolderPermission instance using the specified properties.
     * @function create
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Records.ISharedFolderPermission=} [properties] Properties to set
     * @returns {Records.SharedFolderPermission} SharedFolderPermission instance
     */
    SharedFolderPermission.create = function create(properties) {
      return new SharedFolderPermission(properties);
    };

    /**
     * Encodes the specified SharedFolderPermission message. Does not implicitly {@link Records.SharedFolderPermission.verify|verify} messages.
     * @function encode
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Records.ISharedFolderPermission} message SharedFolderPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedFolderPermission.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.sharedFolderUid != null && Object.hasOwnProperty.call(message, "sharedFolderUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.sharedFolderUid);
      if (message.resharable != null && Object.hasOwnProperty.call(message, "resharable"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.resharable);
      if (message.editable != null && Object.hasOwnProperty.call(message, "editable"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.editable);
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int64(message.revision);
      if (message.expiration != null && Object.hasOwnProperty.call(message, "expiration"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).int64(message.expiration);
      if (
        message.timerNotificationType != null &&
        Object.hasOwnProperty.call(message, "timerNotificationType")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).int32(message.timerNotificationType);
      if (
        message.rotateOnExpiration != null &&
        Object.hasOwnProperty.call(message, "rotateOnExpiration")
      )
        writer.uint32(/* id 7, wireType 0 =*/ 56).bool(message.rotateOnExpiration);
      return writer;
    };

    /**
     * Encodes the specified SharedFolderPermission message, length delimited. Does not implicitly {@link Records.SharedFolderPermission.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Records.ISharedFolderPermission} message SharedFolderPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedFolderPermission.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SharedFolderPermission message from the specified reader or buffer.
     * @function decode
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.SharedFolderPermission} SharedFolderPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedFolderPermission.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.SharedFolderPermission();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.sharedFolderUid = reader.bytes();
            break;
          }
          case 2: {
            message.resharable = reader.bool();
            break;
          }
          case 3: {
            message.editable = reader.bool();
            break;
          }
          case 4: {
            message.revision = reader.int64();
            break;
          }
          case 5: {
            message.expiration = reader.int64();
            break;
          }
          case 6: {
            message.timerNotificationType = reader.int32();
            break;
          }
          case 7: {
            message.rotateOnExpiration = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a SharedFolderPermission message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.SharedFolderPermission} SharedFolderPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedFolderPermission.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SharedFolderPermission message.
     * @function verify
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SharedFolderPermission.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        if (
          !(
            (message.sharedFolderUid && typeof message.sharedFolderUid.length === "number") ||
            $util.isString(message.sharedFolderUid)
          )
        )
          return "sharedFolderUid: buffer expected";
      if (message.resharable != null && message.hasOwnProperty("resharable"))
        if (typeof message.resharable !== "boolean") return "resharable: boolean expected";
      if (message.editable != null && message.hasOwnProperty("editable"))
        if (typeof message.editable !== "boolean") return "editable: boolean expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (
          !$util.isInteger(message.expiration) &&
          !(
            message.expiration &&
            $util.isInteger(message.expiration.low) &&
            $util.isInteger(message.expiration.high)
          )
        )
          return "expiration: integer|Long expected";
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        switch (message.timerNotificationType) {
          default:
            return "timerNotificationType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        if (typeof message.rotateOnExpiration !== "boolean")
          return "rotateOnExpiration: boolean expected";
      return null;
    };

    /**
     * Creates a SharedFolderPermission message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.SharedFolderPermission} SharedFolderPermission
     */
    SharedFolderPermission.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.SharedFolderPermission) return object;
      let message = new $root.Records.SharedFolderPermission();
      if (object.sharedFolderUid != null)
        if (typeof object.sharedFolderUid === "string")
          $util.base64.decode(
            object.sharedFolderUid,
            (message.sharedFolderUid = $util.newBuffer(
              $util.base64.length(object.sharedFolderUid),
            )),
            0,
          );
        else if (object.sharedFolderUid.length >= 0)
          message.sharedFolderUid = object.sharedFolderUid;
      if (object.resharable != null) message.resharable = Boolean(object.resharable);
      if (object.editable != null) message.editable = Boolean(object.editable);
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.expiration != null)
        if ($util.Long)
          (message.expiration = $util.Long.fromValue(object.expiration)).unsigned = false;
        else if (typeof object.expiration === "string")
          message.expiration = parseInt(object.expiration, 10);
        else if (typeof object.expiration === "number") message.expiration = object.expiration;
        else if (typeof object.expiration === "object")
          message.expiration = new $util.LongBits(
            object.expiration.low >>> 0,
            object.expiration.high >>> 0,
          ).toNumber();
      switch (object.timerNotificationType) {
        default:
          if (typeof object.timerNotificationType === "number") {
            message.timerNotificationType = object.timerNotificationType;
            break;
          }
          break;
        case "NOTIFICATION_OFF":
        case 0:
          message.timerNotificationType = 0;
          break;
        case "NOTIFY_OWNER":
        case 1:
          message.timerNotificationType = 1;
          break;
        case "NOTIFY_PRIVILEGED_USERS":
        case 2:
          message.timerNotificationType = 2;
          break;
      }
      if (object.rotateOnExpiration != null)
        message.rotateOnExpiration = Boolean(object.rotateOnExpiration);
      return message;
    };

    /**
     * Creates a plain object from a SharedFolderPermission message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {Records.SharedFolderPermission} message SharedFolderPermission
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SharedFolderPermission.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.sharedFolderUid = "";
        else {
          object.sharedFolderUid = [];
          if (options.bytes !== Array)
            object.sharedFolderUid = $util.newBuffer(object.sharedFolderUid);
        }
        object.resharable = false;
        object.editable = false;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.expiration =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.expiration = options.longs === String ? "0" : 0;
        object.timerNotificationType = options.enums === String ? "NOTIFICATION_OFF" : 0;
        object.rotateOnExpiration = false;
      }
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        object.sharedFolderUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedFolderUid, 0, message.sharedFolderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedFolderUid)
              : message.sharedFolderUid;
      if (message.resharable != null && message.hasOwnProperty("resharable"))
        object.resharable = message.resharable;
      if (message.editable != null && message.hasOwnProperty("editable"))
        object.editable = message.editable;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (typeof message.expiration === "number")
          object.expiration =
            options.longs === String ? String(message.expiration) : message.expiration;
        else
          object.expiration =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.expiration)
              : options.longs === Number
                ? new $util.LongBits(
                    message.expiration.low >>> 0,
                    message.expiration.high >>> 0,
                  ).toNumber()
                : message.expiration;
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        object.timerNotificationType =
          options.enums === String
            ? $root.Records.TimerNotificationType[message.timerNotificationType] === undefined
              ? message.timerNotificationType
              : $root.Records.TimerNotificationType[message.timerNotificationType]
            : message.timerNotificationType;
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        object.rotateOnExpiration = message.rotateOnExpiration;
      return object;
    };

    /**
     * Converts this SharedFolderPermission to JSON.
     * @function toJSON
     * @memberof Records.SharedFolderPermission
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SharedFolderPermission.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SharedFolderPermission
     * @function getTypeUrl
     * @memberof Records.SharedFolderPermission
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SharedFolderPermission.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.SharedFolderPermission";
    };

    return SharedFolderPermission;
  })();

  Records.RecordData = (function () {
    /**
     * Properties of a RecordData.
     * @memberof Records
     * @interface IRecordData
     * @property {number|Long|null} [revision] RecordData revision
     * @property {number|null} [version] RecordData version
     * @property {boolean|null} [shared] RecordData shared
     * @property {string|null} [encryptedRecordData] RecordData encryptedRecordData
     * @property {string|null} [encryptedExtraData] RecordData encryptedExtraData
     * @property {number|Long|null} [clientModifiedTime] RecordData clientModifiedTime
     * @property {string|null} [nonSharedData] RecordData nonSharedData
     * @property {Array.<Records.IRecordData>|null} [linkedRecordData] RecordData linkedRecordData
     * @property {Array.<Uint8Array>|null} [fileId] RecordData fileId
     * @property {number|Long|null} [fileSize] RecordData fileSize
     * @property {number|Long|null} [thumbnailSize] RecordData thumbnailSize
     * @property {Records.RecordKeyType|null} [recordKeyType] RecordData recordKeyType
     * @property {Uint8Array|null} [recordKey] RecordData recordKey
     * @property {Uint8Array|null} [recordUid] RecordData recordUid
     */

    /**
     * Constructs a new RecordData.
     * @memberof Records
     * @classdesc Represents a RecordData.
     * @implements IRecordData
     * @constructor
     * @param {Records.IRecordData=} [properties] Properties to set
     */
    function RecordData(properties) {
      this.linkedRecordData = [];
      this.fileId = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordData revision.
     * @member {number|Long} revision
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.revision = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordData version.
     * @member {number} version
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.version = 0;

    /**
     * RecordData shared.
     * @member {boolean} shared
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.shared = false;

    /**
     * RecordData encryptedRecordData.
     * @member {string} encryptedRecordData
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.encryptedRecordData = "";

    /**
     * RecordData encryptedExtraData.
     * @member {string} encryptedExtraData
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.encryptedExtraData = "";

    /**
     * RecordData clientModifiedTime.
     * @member {number|Long} clientModifiedTime
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.clientModifiedTime = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordData nonSharedData.
     * @member {string} nonSharedData
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.nonSharedData = "";

    /**
     * RecordData linkedRecordData.
     * @member {Array.<Records.IRecordData>} linkedRecordData
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.linkedRecordData = $util.emptyArray;

    /**
     * RecordData fileId.
     * @member {Array.<Uint8Array>} fileId
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.fileId = $util.emptyArray;

    /**
     * RecordData fileSize.
     * @member {number|Long} fileSize
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.fileSize = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordData thumbnailSize.
     * @member {number|Long} thumbnailSize
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.thumbnailSize = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * RecordData recordKeyType.
     * @member {Records.RecordKeyType} recordKeyType
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.recordKeyType = 0;

    /**
     * RecordData recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.recordKey = $util.newBuffer([]);

    /**
     * RecordData recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordData
     * @instance
     */
    RecordData.prototype.recordUid = $util.newBuffer([]);

    /**
     * Creates a new RecordData instance using the specified properties.
     * @function create
     * @memberof Records.RecordData
     * @static
     * @param {Records.IRecordData=} [properties] Properties to set
     * @returns {Records.RecordData} RecordData instance
     */
    RecordData.create = function create(properties) {
      return new RecordData(properties);
    };

    /**
     * Encodes the specified RecordData message. Does not implicitly {@link Records.RecordData.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordData
     * @static
     * @param {Records.IRecordData} message RecordData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.revision);
      if (message.version != null && Object.hasOwnProperty.call(message, "version"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.version);
      if (message.shared != null && Object.hasOwnProperty.call(message, "shared"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.shared);
      if (
        message.encryptedRecordData != null &&
        Object.hasOwnProperty.call(message, "encryptedRecordData")
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.encryptedRecordData);
      if (
        message.encryptedExtraData != null &&
        Object.hasOwnProperty.call(message, "encryptedExtraData")
      )
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.encryptedExtraData);
      if (
        message.clientModifiedTime != null &&
        Object.hasOwnProperty.call(message, "clientModifiedTime")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).int64(message.clientModifiedTime);
      if (message.nonSharedData != null && Object.hasOwnProperty.call(message, "nonSharedData"))
        writer.uint32(/* id 7, wireType 2 =*/ 58).string(message.nonSharedData);
      if (message.linkedRecordData != null && message.linkedRecordData.length)
        for (let i = 0; i < message.linkedRecordData.length; ++i)
          $root.Records.RecordData.encode(
            message.linkedRecordData[i],
            writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
          ).ldelim();
      if (message.fileId != null && message.fileId.length)
        for (let i = 0; i < message.fileId.length; ++i)
          writer.uint32(/* id 9, wireType 2 =*/ 74).bytes(message.fileId[i]);
      if (message.fileSize != null && Object.hasOwnProperty.call(message, "fileSize"))
        writer.uint32(/* id 10, wireType 0 =*/ 80).int64(message.fileSize);
      if (message.thumbnailSize != null && Object.hasOwnProperty.call(message, "thumbnailSize"))
        writer.uint32(/* id 11, wireType 0 =*/ 88).int64(message.thumbnailSize);
      if (message.recordKeyType != null && Object.hasOwnProperty.call(message, "recordKeyType"))
        writer.uint32(/* id 12, wireType 0 =*/ 96).int32(message.recordKeyType);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 13, wireType 2 =*/ 106).bytes(message.recordKey);
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 14, wireType 2 =*/ 114).bytes(message.recordUid);
      return writer;
    };

    /**
     * Encodes the specified RecordData message, length delimited. Does not implicitly {@link Records.RecordData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordData
     * @static
     * @param {Records.IRecordData} message RecordData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordData message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordData} RecordData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.revision = reader.int64();
            break;
          }
          case 2: {
            message.version = reader.int32();
            break;
          }
          case 3: {
            message.shared = reader.bool();
            break;
          }
          case 4: {
            message.encryptedRecordData = reader.string();
            break;
          }
          case 5: {
            message.encryptedExtraData = reader.string();
            break;
          }
          case 6: {
            message.clientModifiedTime = reader.int64();
            break;
          }
          case 7: {
            message.nonSharedData = reader.string();
            break;
          }
          case 8: {
            if (!(message.linkedRecordData && message.linkedRecordData.length))
              message.linkedRecordData = [];
            message.linkedRecordData.push($root.Records.RecordData.decode(reader, reader.uint32()));
            break;
          }
          case 9: {
            if (!(message.fileId && message.fileId.length)) message.fileId = [];
            message.fileId.push(reader.bytes());
            break;
          }
          case 10: {
            message.fileSize = reader.int64();
            break;
          }
          case 11: {
            message.thumbnailSize = reader.int64();
            break;
          }
          case 12: {
            message.recordKeyType = reader.int32();
            break;
          }
          case 13: {
            message.recordKey = reader.bytes();
            break;
          }
          case 14: {
            message.recordUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordData} RecordData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordData message.
     * @function verify
     * @memberof Records.RecordData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordData.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.version != null && message.hasOwnProperty("version"))
        if (!$util.isInteger(message.version)) return "version: integer expected";
      if (message.shared != null && message.hasOwnProperty("shared"))
        if (typeof message.shared !== "boolean") return "shared: boolean expected";
      if (message.encryptedRecordData != null && message.hasOwnProperty("encryptedRecordData"))
        if (!$util.isString(message.encryptedRecordData))
          return "encryptedRecordData: string expected";
      if (message.encryptedExtraData != null && message.hasOwnProperty("encryptedExtraData"))
        if (!$util.isString(message.encryptedExtraData))
          return "encryptedExtraData: string expected";
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (
          !$util.isInteger(message.clientModifiedTime) &&
          !(
            message.clientModifiedTime &&
            $util.isInteger(message.clientModifiedTime.low) &&
            $util.isInteger(message.clientModifiedTime.high)
          )
        )
          return "clientModifiedTime: integer|Long expected";
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        if (!$util.isString(message.nonSharedData)) return "nonSharedData: string expected";
      if (message.linkedRecordData != null && message.hasOwnProperty("linkedRecordData")) {
        if (!Array.isArray(message.linkedRecordData)) return "linkedRecordData: array expected";
        for (let i = 0; i < message.linkedRecordData.length; ++i) {
          let error = $root.Records.RecordData.verify(message.linkedRecordData[i]);
          if (error) return "linkedRecordData." + error;
        }
      }
      if (message.fileId != null && message.hasOwnProperty("fileId")) {
        if (!Array.isArray(message.fileId)) return "fileId: array expected";
        for (let i = 0; i < message.fileId.length; ++i)
          if (
            !(
              (message.fileId[i] && typeof message.fileId[i].length === "number") ||
              $util.isString(message.fileId[i])
            )
          )
            return "fileId: buffer[] expected";
      }
      if (message.fileSize != null && message.hasOwnProperty("fileSize"))
        if (
          !$util.isInteger(message.fileSize) &&
          !(
            message.fileSize &&
            $util.isInteger(message.fileSize.low) &&
            $util.isInteger(message.fileSize.high)
          )
        )
          return "fileSize: integer|Long expected";
      if (message.thumbnailSize != null && message.hasOwnProperty("thumbnailSize"))
        if (
          !$util.isInteger(message.thumbnailSize) &&
          !(
            message.thumbnailSize &&
            $util.isInteger(message.thumbnailSize.low) &&
            $util.isInteger(message.thumbnailSize.high)
          )
        )
          return "thumbnailSize: integer|Long expected";
      if (message.recordKeyType != null && message.hasOwnProperty("recordKeyType"))
        switch (message.recordKeyType) {
          default:
            return "recordKeyType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      return null;
    };

    /**
     * Creates a RecordData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordData} RecordData
     */
    RecordData.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordData) return object;
      let message = new $root.Records.RecordData();
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.version != null) message.version = object.version | 0;
      if (object.shared != null) message.shared = Boolean(object.shared);
      if (object.encryptedRecordData != null)
        message.encryptedRecordData = String(object.encryptedRecordData);
      if (object.encryptedExtraData != null)
        message.encryptedExtraData = String(object.encryptedExtraData);
      if (object.clientModifiedTime != null)
        if ($util.Long)
          (message.clientModifiedTime = $util.Long.fromValue(object.clientModifiedTime)).unsigned =
            false;
        else if (typeof object.clientModifiedTime === "string")
          message.clientModifiedTime = parseInt(object.clientModifiedTime, 10);
        else if (typeof object.clientModifiedTime === "number")
          message.clientModifiedTime = object.clientModifiedTime;
        else if (typeof object.clientModifiedTime === "object")
          message.clientModifiedTime = new $util.LongBits(
            object.clientModifiedTime.low >>> 0,
            object.clientModifiedTime.high >>> 0,
          ).toNumber();
      if (object.nonSharedData != null) message.nonSharedData = String(object.nonSharedData);
      if (object.linkedRecordData) {
        if (!Array.isArray(object.linkedRecordData))
          throw TypeError(".Records.RecordData.linkedRecordData: array expected");
        message.linkedRecordData = [];
        for (let i = 0; i < object.linkedRecordData.length; ++i) {
          if (typeof object.linkedRecordData[i] !== "object")
            throw TypeError(".Records.RecordData.linkedRecordData: object expected");
          message.linkedRecordData[i] = $root.Records.RecordData.fromObject(
            object.linkedRecordData[i],
          );
        }
      }
      if (object.fileId) {
        if (!Array.isArray(object.fileId))
          throw TypeError(".Records.RecordData.fileId: array expected");
        message.fileId = [];
        for (let i = 0; i < object.fileId.length; ++i)
          if (typeof object.fileId[i] === "string")
            $util.base64.decode(
              object.fileId[i],
              (message.fileId[i] = $util.newBuffer($util.base64.length(object.fileId[i]))),
              0,
            );
          else if (object.fileId[i].length >= 0) message.fileId[i] = object.fileId[i];
      }
      if (object.fileSize != null)
        if ($util.Long) (message.fileSize = $util.Long.fromValue(object.fileSize)).unsigned = false;
        else if (typeof object.fileSize === "string")
          message.fileSize = parseInt(object.fileSize, 10);
        else if (typeof object.fileSize === "number") message.fileSize = object.fileSize;
        else if (typeof object.fileSize === "object")
          message.fileSize = new $util.LongBits(
            object.fileSize.low >>> 0,
            object.fileSize.high >>> 0,
          ).toNumber();
      if (object.thumbnailSize != null)
        if ($util.Long)
          (message.thumbnailSize = $util.Long.fromValue(object.thumbnailSize)).unsigned = false;
        else if (typeof object.thumbnailSize === "string")
          message.thumbnailSize = parseInt(object.thumbnailSize, 10);
        else if (typeof object.thumbnailSize === "number")
          message.thumbnailSize = object.thumbnailSize;
        else if (typeof object.thumbnailSize === "object")
          message.thumbnailSize = new $util.LongBits(
            object.thumbnailSize.low >>> 0,
            object.thumbnailSize.high >>> 0,
          ).toNumber();
      switch (object.recordKeyType) {
        default:
          if (typeof object.recordKeyType === "number") {
            message.recordKeyType = object.recordKeyType;
            break;
          }
          break;
        case "NO_KEY":
        case 0:
          message.recordKeyType = 0;
          break;
        case "ENCRYPTED_BY_DATA_KEY":
        case 1:
          message.recordKeyType = 1;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY":
        case 2:
          message.recordKeyType = 2;
          break;
        case "ENCRYPTED_BY_DATA_KEY_GCM":
        case 3:
          message.recordKeyType = 3;
          break;
        case "ENCRYPTED_BY_PUBLIC_KEY_ECC":
        case 4:
          message.recordKeyType = 4;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_CBC":
        case 5:
          message.recordKeyType = 5;
          break;
        case "ENCRYPTED_BY_ROOT_KEY_GCM":
        case 6:
          message.recordKeyType = 6;
          break;
      }
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      return message;
    };

    /**
     * Creates a plain object from a RecordData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordData
     * @static
     * @param {Records.RecordData} message RecordData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordData.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.linkedRecordData = [];
        object.fileId = [];
      }
      if (options.defaults) {
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
        object.version = 0;
        object.shared = false;
        object.encryptedRecordData = "";
        object.encryptedExtraData = "";
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.clientModifiedTime =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.clientModifiedTime = options.longs === String ? "0" : 0;
        object.nonSharedData = "";
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.fileSize =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.fileSize = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.thumbnailSize =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.thumbnailSize = options.longs === String ? "0" : 0;
        object.recordKeyType = options.enums === String ? "NO_KEY" : 0;
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
      }
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.version != null && message.hasOwnProperty("version"))
        object.version = message.version;
      if (message.shared != null && message.hasOwnProperty("shared"))
        object.shared = message.shared;
      if (message.encryptedRecordData != null && message.hasOwnProperty("encryptedRecordData"))
        object.encryptedRecordData = message.encryptedRecordData;
      if (message.encryptedExtraData != null && message.hasOwnProperty("encryptedExtraData"))
        object.encryptedExtraData = message.encryptedExtraData;
      if (message.clientModifiedTime != null && message.hasOwnProperty("clientModifiedTime"))
        if (typeof message.clientModifiedTime === "number")
          object.clientModifiedTime =
            options.longs === String
              ? String(message.clientModifiedTime)
              : message.clientModifiedTime;
        else
          object.clientModifiedTime =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.clientModifiedTime)
              : options.longs === Number
                ? new $util.LongBits(
                    message.clientModifiedTime.low >>> 0,
                    message.clientModifiedTime.high >>> 0,
                  ).toNumber()
                : message.clientModifiedTime;
      if (message.nonSharedData != null && message.hasOwnProperty("nonSharedData"))
        object.nonSharedData = message.nonSharedData;
      if (message.linkedRecordData && message.linkedRecordData.length) {
        object.linkedRecordData = [];
        for (let j = 0; j < message.linkedRecordData.length; ++j)
          object.linkedRecordData[j] = $root.Records.RecordData.toObject(
            message.linkedRecordData[j],
            options,
          );
      }
      if (message.fileId && message.fileId.length) {
        object.fileId = [];
        for (let j = 0; j < message.fileId.length; ++j)
          object.fileId[j] =
            options.bytes === String
              ? $util.base64.encode(message.fileId[j], 0, message.fileId[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.fileId[j])
                : message.fileId[j];
      }
      if (message.fileSize != null && message.hasOwnProperty("fileSize"))
        if (typeof message.fileSize === "number")
          object.fileSize = options.longs === String ? String(message.fileSize) : message.fileSize;
        else
          object.fileSize =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.fileSize)
              : options.longs === Number
                ? new $util.LongBits(
                    message.fileSize.low >>> 0,
                    message.fileSize.high >>> 0,
                  ).toNumber()
                : message.fileSize;
      if (message.thumbnailSize != null && message.hasOwnProperty("thumbnailSize"))
        if (typeof message.thumbnailSize === "number")
          object.thumbnailSize =
            options.longs === String ? String(message.thumbnailSize) : message.thumbnailSize;
        else
          object.thumbnailSize =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.thumbnailSize)
              : options.longs === Number
                ? new $util.LongBits(
                    message.thumbnailSize.low >>> 0,
                    message.thumbnailSize.high >>> 0,
                  ).toNumber()
                : message.thumbnailSize;
      if (message.recordKeyType != null && message.hasOwnProperty("recordKeyType"))
        object.recordKeyType =
          options.enums === String
            ? $root.Records.RecordKeyType[message.recordKeyType] === undefined
              ? message.recordKeyType
              : $root.Records.RecordKeyType[message.recordKeyType]
            : message.recordKeyType;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      return object;
    };

    /**
     * Converts this RecordData to JSON.
     * @function toJSON
     * @memberof Records.RecordData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordData
     * @function getTypeUrl
     * @memberof Records.RecordData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordData";
    };

    return RecordData;
  })();

  Records.RecordDataWithAccessInfo = (function () {
    /**
     * Properties of a RecordDataWithAccessInfo.
     * @memberof Records
     * @interface IRecordDataWithAccessInfo
     * @property {Uint8Array|null} [recordUid] RecordDataWithAccessInfo recordUid
     * @property {Records.IRecordData|null} [recordData] RecordDataWithAccessInfo recordData
     * @property {Array.<Records.IUserPermission>|null} [userPermission] RecordDataWithAccessInfo userPermission
     * @property {Array.<Records.ISharedFolderPermission>|null} [sharedFolderPermission] RecordDataWithAccessInfo sharedFolderPermission
     */

    /**
     * Constructs a new RecordDataWithAccessInfo.
     * @memberof Records
     * @classdesc Represents a RecordDataWithAccessInfo.
     * @implements IRecordDataWithAccessInfo
     * @constructor
     * @param {Records.IRecordDataWithAccessInfo=} [properties] Properties to set
     */
    function RecordDataWithAccessInfo(properties) {
      this.userPermission = [];
      this.sharedFolderPermission = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordDataWithAccessInfo recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordDataWithAccessInfo
     * @instance
     */
    RecordDataWithAccessInfo.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordDataWithAccessInfo recordData.
     * @member {Records.IRecordData|null|undefined} recordData
     * @memberof Records.RecordDataWithAccessInfo
     * @instance
     */
    RecordDataWithAccessInfo.prototype.recordData = null;

    /**
     * RecordDataWithAccessInfo userPermission.
     * @member {Array.<Records.IUserPermission>} userPermission
     * @memberof Records.RecordDataWithAccessInfo
     * @instance
     */
    RecordDataWithAccessInfo.prototype.userPermission = $util.emptyArray;

    /**
     * RecordDataWithAccessInfo sharedFolderPermission.
     * @member {Array.<Records.ISharedFolderPermission>} sharedFolderPermission
     * @memberof Records.RecordDataWithAccessInfo
     * @instance
     */
    RecordDataWithAccessInfo.prototype.sharedFolderPermission = $util.emptyArray;

    /**
     * Creates a new RecordDataWithAccessInfo instance using the specified properties.
     * @function create
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Records.IRecordDataWithAccessInfo=} [properties] Properties to set
     * @returns {Records.RecordDataWithAccessInfo} RecordDataWithAccessInfo instance
     */
    RecordDataWithAccessInfo.create = function create(properties) {
      return new RecordDataWithAccessInfo(properties);
    };

    /**
     * Encodes the specified RecordDataWithAccessInfo message. Does not implicitly {@link Records.RecordDataWithAccessInfo.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Records.IRecordDataWithAccessInfo} message RecordDataWithAccessInfo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordDataWithAccessInfo.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.recordData != null && Object.hasOwnProperty.call(message, "recordData"))
        $root.Records.RecordData.encode(
          message.recordData,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (message.userPermission != null && message.userPermission.length)
        for (let i = 0; i < message.userPermission.length; ++i)
          $root.Records.UserPermission.encode(
            message.userPermission[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.sharedFolderPermission != null && message.sharedFolderPermission.length)
        for (let i = 0; i < message.sharedFolderPermission.length; ++i)
          $root.Records.SharedFolderPermission.encode(
            message.sharedFolderPermission[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordDataWithAccessInfo message, length delimited. Does not implicitly {@link Records.RecordDataWithAccessInfo.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Records.IRecordDataWithAccessInfo} message RecordDataWithAccessInfo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordDataWithAccessInfo.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordDataWithAccessInfo message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordDataWithAccessInfo} RecordDataWithAccessInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordDataWithAccessInfo.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordDataWithAccessInfo();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.recordData = $root.Records.RecordData.decode(reader, reader.uint32());
            break;
          }
          case 3: {
            if (!(message.userPermission && message.userPermission.length))
              message.userPermission = [];
            message.userPermission.push(
              $root.Records.UserPermission.decode(reader, reader.uint32()),
            );
            break;
          }
          case 4: {
            if (!(message.sharedFolderPermission && message.sharedFolderPermission.length))
              message.sharedFolderPermission = [];
            message.sharedFolderPermission.push(
              $root.Records.SharedFolderPermission.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordDataWithAccessInfo message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordDataWithAccessInfo} RecordDataWithAccessInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordDataWithAccessInfo.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordDataWithAccessInfo message.
     * @function verify
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordDataWithAccessInfo.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordData != null && message.hasOwnProperty("recordData")) {
        let error = $root.Records.RecordData.verify(message.recordData);
        if (error) return "recordData." + error;
      }
      if (message.userPermission != null && message.hasOwnProperty("userPermission")) {
        if (!Array.isArray(message.userPermission)) return "userPermission: array expected";
        for (let i = 0; i < message.userPermission.length; ++i) {
          let error = $root.Records.UserPermission.verify(message.userPermission[i]);
          if (error) return "userPermission." + error;
        }
      }
      if (
        message.sharedFolderPermission != null &&
        message.hasOwnProperty("sharedFolderPermission")
      ) {
        if (!Array.isArray(message.sharedFolderPermission))
          return "sharedFolderPermission: array expected";
        for (let i = 0; i < message.sharedFolderPermission.length; ++i) {
          let error = $root.Records.SharedFolderPermission.verify(
            message.sharedFolderPermission[i],
          );
          if (error) return "sharedFolderPermission." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordDataWithAccessInfo message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordDataWithAccessInfo} RecordDataWithAccessInfo
     */
    RecordDataWithAccessInfo.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordDataWithAccessInfo) return object;
      let message = new $root.Records.RecordDataWithAccessInfo();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordData != null) {
        if (typeof object.recordData !== "object")
          throw TypeError(".Records.RecordDataWithAccessInfo.recordData: object expected");
        message.recordData = $root.Records.RecordData.fromObject(object.recordData);
      }
      if (object.userPermission) {
        if (!Array.isArray(object.userPermission))
          throw TypeError(".Records.RecordDataWithAccessInfo.userPermission: array expected");
        message.userPermission = [];
        for (let i = 0; i < object.userPermission.length; ++i) {
          if (typeof object.userPermission[i] !== "object")
            throw TypeError(".Records.RecordDataWithAccessInfo.userPermission: object expected");
          message.userPermission[i] = $root.Records.UserPermission.fromObject(
            object.userPermission[i],
          );
        }
      }
      if (object.sharedFolderPermission) {
        if (!Array.isArray(object.sharedFolderPermission))
          throw TypeError(
            ".Records.RecordDataWithAccessInfo.sharedFolderPermission: array expected",
          );
        message.sharedFolderPermission = [];
        for (let i = 0; i < object.sharedFolderPermission.length; ++i) {
          if (typeof object.sharedFolderPermission[i] !== "object")
            throw TypeError(
              ".Records.RecordDataWithAccessInfo.sharedFolderPermission: object expected",
            );
          message.sharedFolderPermission[i] = $root.Records.SharedFolderPermission.fromObject(
            object.sharedFolderPermission[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordDataWithAccessInfo message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {Records.RecordDataWithAccessInfo} message RecordDataWithAccessInfo
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordDataWithAccessInfo.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.userPermission = [];
        object.sharedFolderPermission = [];
      }
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.recordData = null;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordData != null && message.hasOwnProperty("recordData"))
        object.recordData = $root.Records.RecordData.toObject(message.recordData, options);
      if (message.userPermission && message.userPermission.length) {
        object.userPermission = [];
        for (let j = 0; j < message.userPermission.length; ++j)
          object.userPermission[j] = $root.Records.UserPermission.toObject(
            message.userPermission[j],
            options,
          );
      }
      if (message.sharedFolderPermission && message.sharedFolderPermission.length) {
        object.sharedFolderPermission = [];
        for (let j = 0; j < message.sharedFolderPermission.length; ++j)
          object.sharedFolderPermission[j] = $root.Records.SharedFolderPermission.toObject(
            message.sharedFolderPermission[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordDataWithAccessInfo to JSON.
     * @function toJSON
     * @memberof Records.RecordDataWithAccessInfo
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordDataWithAccessInfo.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordDataWithAccessInfo
     * @function getTypeUrl
     * @memberof Records.RecordDataWithAccessInfo
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordDataWithAccessInfo.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordDataWithAccessInfo";
    };

    return RecordDataWithAccessInfo;
  })();

  Records.GetRecordDataWithAccessInfoResponse = (function () {
    /**
     * Properties of a GetRecordDataWithAccessInfoResponse.
     * @memberof Records
     * @interface IGetRecordDataWithAccessInfoResponse
     * @property {Array.<Records.IRecordDataWithAccessInfo>|null} [recordDataWithAccessInfo] GetRecordDataWithAccessInfoResponse recordDataWithAccessInfo
     * @property {Array.<Uint8Array>|null} [noPermissionRecordUid] GetRecordDataWithAccessInfoResponse noPermissionRecordUid
     */

    /**
     * Constructs a new GetRecordDataWithAccessInfoResponse.
     * @memberof Records
     * @classdesc Represents a GetRecordDataWithAccessInfoResponse.
     * @implements IGetRecordDataWithAccessInfoResponse
     * @constructor
     * @param {Records.IGetRecordDataWithAccessInfoResponse=} [properties] Properties to set
     */
    function GetRecordDataWithAccessInfoResponse(properties) {
      this.recordDataWithAccessInfo = [];
      this.noPermissionRecordUid = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetRecordDataWithAccessInfoResponse recordDataWithAccessInfo.
     * @member {Array.<Records.IRecordDataWithAccessInfo>} recordDataWithAccessInfo
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @instance
     */
    GetRecordDataWithAccessInfoResponse.prototype.recordDataWithAccessInfo = $util.emptyArray;

    /**
     * GetRecordDataWithAccessInfoResponse noPermissionRecordUid.
     * @member {Array.<Uint8Array>} noPermissionRecordUid
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @instance
     */
    GetRecordDataWithAccessInfoResponse.prototype.noPermissionRecordUid = $util.emptyArray;

    /**
     * Creates a new GetRecordDataWithAccessInfoResponse instance using the specified properties.
     * @function create
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoResponse=} [properties] Properties to set
     * @returns {Records.GetRecordDataWithAccessInfoResponse} GetRecordDataWithAccessInfoResponse instance
     */
    GetRecordDataWithAccessInfoResponse.create = function create(properties) {
      return new GetRecordDataWithAccessInfoResponse(properties);
    };

    /**
     * Encodes the specified GetRecordDataWithAccessInfoResponse message. Does not implicitly {@link Records.GetRecordDataWithAccessInfoResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoResponse} message GetRecordDataWithAccessInfoResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordDataWithAccessInfoResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordDataWithAccessInfo != null && message.recordDataWithAccessInfo.length)
        for (let i = 0; i < message.recordDataWithAccessInfo.length; ++i)
          $root.Records.RecordDataWithAccessInfo.encode(
            message.recordDataWithAccessInfo[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.noPermissionRecordUid != null && message.noPermissionRecordUid.length)
        for (let i = 0; i < message.noPermissionRecordUid.length; ++i)
          writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.noPermissionRecordUid[i]);
      return writer;
    };

    /**
     * Encodes the specified GetRecordDataWithAccessInfoResponse message, length delimited. Does not implicitly {@link Records.GetRecordDataWithAccessInfoResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Records.IGetRecordDataWithAccessInfoResponse} message GetRecordDataWithAccessInfoResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordDataWithAccessInfoResponse.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetRecordDataWithAccessInfoResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetRecordDataWithAccessInfoResponse} GetRecordDataWithAccessInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordDataWithAccessInfoResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetRecordDataWithAccessInfoResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordDataWithAccessInfo && message.recordDataWithAccessInfo.length))
              message.recordDataWithAccessInfo = [];
            message.recordDataWithAccessInfo.push(
              $root.Records.RecordDataWithAccessInfo.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.noPermissionRecordUid && message.noPermissionRecordUid.length))
              message.noPermissionRecordUid = [];
            message.noPermissionRecordUid.push(reader.bytes());
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetRecordDataWithAccessInfoResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetRecordDataWithAccessInfoResponse} GetRecordDataWithAccessInfoResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordDataWithAccessInfoResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetRecordDataWithAccessInfoResponse message.
     * @function verify
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetRecordDataWithAccessInfoResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (
        message.recordDataWithAccessInfo != null &&
        message.hasOwnProperty("recordDataWithAccessInfo")
      ) {
        if (!Array.isArray(message.recordDataWithAccessInfo))
          return "recordDataWithAccessInfo: array expected";
        for (let i = 0; i < message.recordDataWithAccessInfo.length; ++i) {
          let error = $root.Records.RecordDataWithAccessInfo.verify(
            message.recordDataWithAccessInfo[i],
          );
          if (error) return "recordDataWithAccessInfo." + error;
        }
      }
      if (
        message.noPermissionRecordUid != null &&
        message.hasOwnProperty("noPermissionRecordUid")
      ) {
        if (!Array.isArray(message.noPermissionRecordUid))
          return "noPermissionRecordUid: array expected";
        for (let i = 0; i < message.noPermissionRecordUid.length; ++i)
          if (
            !(
              (message.noPermissionRecordUid[i] &&
                typeof message.noPermissionRecordUid[i].length === "number") ||
              $util.isString(message.noPermissionRecordUid[i])
            )
          )
            return "noPermissionRecordUid: buffer[] expected";
      }
      return null;
    };

    /**
     * Creates a GetRecordDataWithAccessInfoResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetRecordDataWithAccessInfoResponse} GetRecordDataWithAccessInfoResponse
     */
    GetRecordDataWithAccessInfoResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetRecordDataWithAccessInfoResponse) return object;
      let message = new $root.Records.GetRecordDataWithAccessInfoResponse();
      if (object.recordDataWithAccessInfo) {
        if (!Array.isArray(object.recordDataWithAccessInfo))
          throw TypeError(
            ".Records.GetRecordDataWithAccessInfoResponse.recordDataWithAccessInfo: array expected",
          );
        message.recordDataWithAccessInfo = [];
        for (let i = 0; i < object.recordDataWithAccessInfo.length; ++i) {
          if (typeof object.recordDataWithAccessInfo[i] !== "object")
            throw TypeError(
              ".Records.GetRecordDataWithAccessInfoResponse.recordDataWithAccessInfo: object expected",
            );
          message.recordDataWithAccessInfo[i] = $root.Records.RecordDataWithAccessInfo.fromObject(
            object.recordDataWithAccessInfo[i],
          );
        }
      }
      if (object.noPermissionRecordUid) {
        if (!Array.isArray(object.noPermissionRecordUid))
          throw TypeError(
            ".Records.GetRecordDataWithAccessInfoResponse.noPermissionRecordUid: array expected",
          );
        message.noPermissionRecordUid = [];
        for (let i = 0; i < object.noPermissionRecordUid.length; ++i)
          if (typeof object.noPermissionRecordUid[i] === "string")
            $util.base64.decode(
              object.noPermissionRecordUid[i],
              (message.noPermissionRecordUid[i] = $util.newBuffer(
                $util.base64.length(object.noPermissionRecordUid[i]),
              )),
              0,
            );
          else if (object.noPermissionRecordUid[i].length >= 0)
            message.noPermissionRecordUid[i] = object.noPermissionRecordUid[i];
      }
      return message;
    };

    /**
     * Creates a plain object from a GetRecordDataWithAccessInfoResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {Records.GetRecordDataWithAccessInfoResponse} message GetRecordDataWithAccessInfoResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetRecordDataWithAccessInfoResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.recordDataWithAccessInfo = [];
        object.noPermissionRecordUid = [];
      }
      if (message.recordDataWithAccessInfo && message.recordDataWithAccessInfo.length) {
        object.recordDataWithAccessInfo = [];
        for (let j = 0; j < message.recordDataWithAccessInfo.length; ++j)
          object.recordDataWithAccessInfo[j] = $root.Records.RecordDataWithAccessInfo.toObject(
            message.recordDataWithAccessInfo[j],
            options,
          );
      }
      if (message.noPermissionRecordUid && message.noPermissionRecordUid.length) {
        object.noPermissionRecordUid = [];
        for (let j = 0; j < message.noPermissionRecordUid.length; ++j)
          object.noPermissionRecordUid[j] =
            options.bytes === String
              ? $util.base64.encode(
                  message.noPermissionRecordUid[j],
                  0,
                  message.noPermissionRecordUid[j].length,
                )
              : options.bytes === Array
                ? Array.prototype.slice.call(message.noPermissionRecordUid[j])
                : message.noPermissionRecordUid[j];
      }
      return object;
    };

    /**
     * Converts this GetRecordDataWithAccessInfoResponse to JSON.
     * @function toJSON
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetRecordDataWithAccessInfoResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetRecordDataWithAccessInfoResponse
     * @function getTypeUrl
     * @memberof Records.GetRecordDataWithAccessInfoResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetRecordDataWithAccessInfoResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetRecordDataWithAccessInfoResponse";
    };

    return GetRecordDataWithAccessInfoResponse;
  })();

  Records.IsObjectShareAdmin = (function () {
    /**
     * Properties of an IsObjectShareAdmin.
     * @memberof Records
     * @interface IIsObjectShareAdmin
     * @property {Uint8Array|null} [uid] IsObjectShareAdmin uid
     * @property {boolean|null} [isAdmin] IsObjectShareAdmin isAdmin
     * @property {Records.CheckShareAdminObjectType|null} [objectType] IsObjectShareAdmin objectType
     */

    /**
     * Constructs a new IsObjectShareAdmin.
     * @memberof Records
     * @classdesc Represents an IsObjectShareAdmin.
     * @implements IIsObjectShareAdmin
     * @constructor
     * @param {Records.IIsObjectShareAdmin=} [properties] Properties to set
     */
    function IsObjectShareAdmin(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * IsObjectShareAdmin uid.
     * @member {Uint8Array} uid
     * @memberof Records.IsObjectShareAdmin
     * @instance
     */
    IsObjectShareAdmin.prototype.uid = $util.newBuffer([]);

    /**
     * IsObjectShareAdmin isAdmin.
     * @member {boolean} isAdmin
     * @memberof Records.IsObjectShareAdmin
     * @instance
     */
    IsObjectShareAdmin.prototype.isAdmin = false;

    /**
     * IsObjectShareAdmin objectType.
     * @member {Records.CheckShareAdminObjectType} objectType
     * @memberof Records.IsObjectShareAdmin
     * @instance
     */
    IsObjectShareAdmin.prototype.objectType = 0;

    /**
     * Creates a new IsObjectShareAdmin instance using the specified properties.
     * @function create
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Records.IIsObjectShareAdmin=} [properties] Properties to set
     * @returns {Records.IsObjectShareAdmin} IsObjectShareAdmin instance
     */
    IsObjectShareAdmin.create = function create(properties) {
      return new IsObjectShareAdmin(properties);
    };

    /**
     * Encodes the specified IsObjectShareAdmin message. Does not implicitly {@link Records.IsObjectShareAdmin.verify|verify} messages.
     * @function encode
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Records.IIsObjectShareAdmin} message IsObjectShareAdmin message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    IsObjectShareAdmin.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.uid != null && Object.hasOwnProperty.call(message, "uid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.uid);
      if (message.isAdmin != null && Object.hasOwnProperty.call(message, "isAdmin"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.isAdmin);
      if (message.objectType != null && Object.hasOwnProperty.call(message, "objectType"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.objectType);
      return writer;
    };

    /**
     * Encodes the specified IsObjectShareAdmin message, length delimited. Does not implicitly {@link Records.IsObjectShareAdmin.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Records.IIsObjectShareAdmin} message IsObjectShareAdmin message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    IsObjectShareAdmin.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an IsObjectShareAdmin message from the specified reader or buffer.
     * @function decode
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.IsObjectShareAdmin} IsObjectShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    IsObjectShareAdmin.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.IsObjectShareAdmin();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.uid = reader.bytes();
            break;
          }
          case 2: {
            message.isAdmin = reader.bool();
            break;
          }
          case 3: {
            message.objectType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes an IsObjectShareAdmin message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.IsObjectShareAdmin} IsObjectShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    IsObjectShareAdmin.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an IsObjectShareAdmin message.
     * @function verify
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    IsObjectShareAdmin.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.uid != null && message.hasOwnProperty("uid"))
        if (
          !((message.uid && typeof message.uid.length === "number") || $util.isString(message.uid))
        )
          return "uid: buffer expected";
      if (message.isAdmin != null && message.hasOwnProperty("isAdmin"))
        if (typeof message.isAdmin !== "boolean") return "isAdmin: boolean expected";
      if (message.objectType != null && message.hasOwnProperty("objectType"))
        switch (message.objectType) {
          default:
            return "objectType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      return null;
    };

    /**
     * Creates an IsObjectShareAdmin message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.IsObjectShareAdmin} IsObjectShareAdmin
     */
    IsObjectShareAdmin.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.IsObjectShareAdmin) return object;
      let message = new $root.Records.IsObjectShareAdmin();
      if (object.uid != null)
        if (typeof object.uid === "string")
          $util.base64.decode(
            object.uid,
            (message.uid = $util.newBuffer($util.base64.length(object.uid))),
            0,
          );
        else if (object.uid.length >= 0) message.uid = object.uid;
      if (object.isAdmin != null) message.isAdmin = Boolean(object.isAdmin);
      switch (object.objectType) {
        default:
          if (typeof object.objectType === "number") {
            message.objectType = object.objectType;
            break;
          }
          break;
        case "CHECK_SA_INVALID_TYPE":
        case 0:
          message.objectType = 0;
          break;
        case "CHECK_SA_ON_SF":
        case 1:
          message.objectType = 1;
          break;
        case "CHECK_SA_ON_RECORD":
        case 2:
          message.objectType = 2;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from an IsObjectShareAdmin message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {Records.IsObjectShareAdmin} message IsObjectShareAdmin
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    IsObjectShareAdmin.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.uid = "";
        else {
          object.uid = [];
          if (options.bytes !== Array) object.uid = $util.newBuffer(object.uid);
        }
        object.isAdmin = false;
        object.objectType = options.enums === String ? "CHECK_SA_INVALID_TYPE" : 0;
      }
      if (message.uid != null && message.hasOwnProperty("uid"))
        object.uid =
          options.bytes === String
            ? $util.base64.encode(message.uid, 0, message.uid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.uid)
              : message.uid;
      if (message.isAdmin != null && message.hasOwnProperty("isAdmin"))
        object.isAdmin = message.isAdmin;
      if (message.objectType != null && message.hasOwnProperty("objectType"))
        object.objectType =
          options.enums === String
            ? $root.Records.CheckShareAdminObjectType[message.objectType] === undefined
              ? message.objectType
              : $root.Records.CheckShareAdminObjectType[message.objectType]
            : message.objectType;
      return object;
    };

    /**
     * Converts this IsObjectShareAdmin to JSON.
     * @function toJSON
     * @memberof Records.IsObjectShareAdmin
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    IsObjectShareAdmin.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for IsObjectShareAdmin
     * @function getTypeUrl
     * @memberof Records.IsObjectShareAdmin
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    IsObjectShareAdmin.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.IsObjectShareAdmin";
    };

    return IsObjectShareAdmin;
  })();

  Records.AmIShareAdmin = (function () {
    /**
     * Properties of an AmIShareAdmin.
     * @memberof Records
     * @interface IAmIShareAdmin
     * @property {Array.<Records.IIsObjectShareAdmin>|null} [isObjectShareAdmin] AmIShareAdmin isObjectShareAdmin
     */

    /**
     * Constructs a new AmIShareAdmin.
     * @memberof Records
     * @classdesc Represents an AmIShareAdmin.
     * @implements IAmIShareAdmin
     * @constructor
     * @param {Records.IAmIShareAdmin=} [properties] Properties to set
     */
    function AmIShareAdmin(properties) {
      this.isObjectShareAdmin = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AmIShareAdmin isObjectShareAdmin.
     * @member {Array.<Records.IIsObjectShareAdmin>} isObjectShareAdmin
     * @memberof Records.AmIShareAdmin
     * @instance
     */
    AmIShareAdmin.prototype.isObjectShareAdmin = $util.emptyArray;

    /**
     * Creates a new AmIShareAdmin instance using the specified properties.
     * @function create
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Records.IAmIShareAdmin=} [properties] Properties to set
     * @returns {Records.AmIShareAdmin} AmIShareAdmin instance
     */
    AmIShareAdmin.create = function create(properties) {
      return new AmIShareAdmin(properties);
    };

    /**
     * Encodes the specified AmIShareAdmin message. Does not implicitly {@link Records.AmIShareAdmin.verify|verify} messages.
     * @function encode
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Records.IAmIShareAdmin} message AmIShareAdmin message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AmIShareAdmin.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.isObjectShareAdmin != null && message.isObjectShareAdmin.length)
        for (let i = 0; i < message.isObjectShareAdmin.length; ++i)
          $root.Records.IsObjectShareAdmin.encode(
            message.isObjectShareAdmin[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified AmIShareAdmin message, length delimited. Does not implicitly {@link Records.AmIShareAdmin.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Records.IAmIShareAdmin} message AmIShareAdmin message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AmIShareAdmin.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AmIShareAdmin message from the specified reader or buffer.
     * @function decode
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.AmIShareAdmin} AmIShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AmIShareAdmin.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.AmIShareAdmin();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.isObjectShareAdmin && message.isObjectShareAdmin.length))
              message.isObjectShareAdmin = [];
            message.isObjectShareAdmin.push(
              $root.Records.IsObjectShareAdmin.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes an AmIShareAdmin message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.AmIShareAdmin} AmIShareAdmin
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AmIShareAdmin.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AmIShareAdmin message.
     * @function verify
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AmIShareAdmin.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.isObjectShareAdmin != null && message.hasOwnProperty("isObjectShareAdmin")) {
        if (!Array.isArray(message.isObjectShareAdmin)) return "isObjectShareAdmin: array expected";
        for (let i = 0; i < message.isObjectShareAdmin.length; ++i) {
          let error = $root.Records.IsObjectShareAdmin.verify(message.isObjectShareAdmin[i]);
          if (error) return "isObjectShareAdmin." + error;
        }
      }
      return null;
    };

    /**
     * Creates an AmIShareAdmin message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.AmIShareAdmin} AmIShareAdmin
     */
    AmIShareAdmin.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.AmIShareAdmin) return object;
      let message = new $root.Records.AmIShareAdmin();
      if (object.isObjectShareAdmin) {
        if (!Array.isArray(object.isObjectShareAdmin))
          throw TypeError(".Records.AmIShareAdmin.isObjectShareAdmin: array expected");
        message.isObjectShareAdmin = [];
        for (let i = 0; i < object.isObjectShareAdmin.length; ++i) {
          if (typeof object.isObjectShareAdmin[i] !== "object")
            throw TypeError(".Records.AmIShareAdmin.isObjectShareAdmin: object expected");
          message.isObjectShareAdmin[i] = $root.Records.IsObjectShareAdmin.fromObject(
            object.isObjectShareAdmin[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from an AmIShareAdmin message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {Records.AmIShareAdmin} message AmIShareAdmin
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AmIShareAdmin.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.isObjectShareAdmin = [];
      if (message.isObjectShareAdmin && message.isObjectShareAdmin.length) {
        object.isObjectShareAdmin = [];
        for (let j = 0; j < message.isObjectShareAdmin.length; ++j)
          object.isObjectShareAdmin[j] = $root.Records.IsObjectShareAdmin.toObject(
            message.isObjectShareAdmin[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this AmIShareAdmin to JSON.
     * @function toJSON
     * @memberof Records.AmIShareAdmin
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AmIShareAdmin.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AmIShareAdmin
     * @function getTypeUrl
     * @memberof Records.AmIShareAdmin
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AmIShareAdmin.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.AmIShareAdmin";
    };

    return AmIShareAdmin;
  })();

  Records.RecordShareUpdateRequest = (function () {
    /**
     * Properties of a RecordShareUpdateRequest.
     * @memberof Records
     * @interface IRecordShareUpdateRequest
     * @property {Array.<Records.ISharedRecord>|null} [addSharedRecord] RecordShareUpdateRequest addSharedRecord
     * @property {Array.<Records.ISharedRecord>|null} [updateSharedRecord] RecordShareUpdateRequest updateSharedRecord
     * @property {Array.<Records.ISharedRecord>|null} [removeSharedRecord] RecordShareUpdateRequest removeSharedRecord
     * @property {string|null} [pt] RecordShareUpdateRequest pt
     */

    /**
     * Constructs a new RecordShareUpdateRequest.
     * @memberof Records
     * @classdesc Represents a RecordShareUpdateRequest.
     * @implements IRecordShareUpdateRequest
     * @constructor
     * @param {Records.IRecordShareUpdateRequest=} [properties] Properties to set
     */
    function RecordShareUpdateRequest(properties) {
      this.addSharedRecord = [];
      this.updateSharedRecord = [];
      this.removeSharedRecord = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordShareUpdateRequest addSharedRecord.
     * @member {Array.<Records.ISharedRecord>} addSharedRecord
     * @memberof Records.RecordShareUpdateRequest
     * @instance
     */
    RecordShareUpdateRequest.prototype.addSharedRecord = $util.emptyArray;

    /**
     * RecordShareUpdateRequest updateSharedRecord.
     * @member {Array.<Records.ISharedRecord>} updateSharedRecord
     * @memberof Records.RecordShareUpdateRequest
     * @instance
     */
    RecordShareUpdateRequest.prototype.updateSharedRecord = $util.emptyArray;

    /**
     * RecordShareUpdateRequest removeSharedRecord.
     * @member {Array.<Records.ISharedRecord>} removeSharedRecord
     * @memberof Records.RecordShareUpdateRequest
     * @instance
     */
    RecordShareUpdateRequest.prototype.removeSharedRecord = $util.emptyArray;

    /**
     * RecordShareUpdateRequest pt.
     * @member {string} pt
     * @memberof Records.RecordShareUpdateRequest
     * @instance
     */
    RecordShareUpdateRequest.prototype.pt = "";

    /**
     * Creates a new RecordShareUpdateRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Records.IRecordShareUpdateRequest=} [properties] Properties to set
     * @returns {Records.RecordShareUpdateRequest} RecordShareUpdateRequest instance
     */
    RecordShareUpdateRequest.create = function create(properties) {
      return new RecordShareUpdateRequest(properties);
    };

    /**
     * Encodes the specified RecordShareUpdateRequest message. Does not implicitly {@link Records.RecordShareUpdateRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Records.IRecordShareUpdateRequest} message RecordShareUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordShareUpdateRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.addSharedRecord != null && message.addSharedRecord.length)
        for (let i = 0; i < message.addSharedRecord.length; ++i)
          $root.Records.SharedRecord.encode(
            message.addSharedRecord[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.updateSharedRecord != null && message.updateSharedRecord.length)
        for (let i = 0; i < message.updateSharedRecord.length; ++i)
          $root.Records.SharedRecord.encode(
            message.updateSharedRecord[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.removeSharedRecord != null && message.removeSharedRecord.length)
        for (let i = 0; i < message.removeSharedRecord.length; ++i)
          $root.Records.SharedRecord.encode(
            message.removeSharedRecord[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.pt != null && Object.hasOwnProperty.call(message, "pt"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.pt);
      return writer;
    };

    /**
     * Encodes the specified RecordShareUpdateRequest message, length delimited. Does not implicitly {@link Records.RecordShareUpdateRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Records.IRecordShareUpdateRequest} message RecordShareUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordShareUpdateRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordShareUpdateRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordShareUpdateRequest} RecordShareUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordShareUpdateRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordShareUpdateRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.addSharedRecord && message.addSharedRecord.length))
              message.addSharedRecord = [];
            message.addSharedRecord.push(
              $root.Records.SharedRecord.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.updateSharedRecord && message.updateSharedRecord.length))
              message.updateSharedRecord = [];
            message.updateSharedRecord.push(
              $root.Records.SharedRecord.decode(reader, reader.uint32()),
            );
            break;
          }
          case 3: {
            if (!(message.removeSharedRecord && message.removeSharedRecord.length))
              message.removeSharedRecord = [];
            message.removeSharedRecord.push(
              $root.Records.SharedRecord.decode(reader, reader.uint32()),
            );
            break;
          }
          case 4: {
            message.pt = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordShareUpdateRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordShareUpdateRequest} RecordShareUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordShareUpdateRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordShareUpdateRequest message.
     * @function verify
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordShareUpdateRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.addSharedRecord != null && message.hasOwnProperty("addSharedRecord")) {
        if (!Array.isArray(message.addSharedRecord)) return "addSharedRecord: array expected";
        for (let i = 0; i < message.addSharedRecord.length; ++i) {
          let error = $root.Records.SharedRecord.verify(message.addSharedRecord[i]);
          if (error) return "addSharedRecord." + error;
        }
      }
      if (message.updateSharedRecord != null && message.hasOwnProperty("updateSharedRecord")) {
        if (!Array.isArray(message.updateSharedRecord)) return "updateSharedRecord: array expected";
        for (let i = 0; i < message.updateSharedRecord.length; ++i) {
          let error = $root.Records.SharedRecord.verify(message.updateSharedRecord[i]);
          if (error) return "updateSharedRecord." + error;
        }
      }
      if (message.removeSharedRecord != null && message.hasOwnProperty("removeSharedRecord")) {
        if (!Array.isArray(message.removeSharedRecord)) return "removeSharedRecord: array expected";
        for (let i = 0; i < message.removeSharedRecord.length; ++i) {
          let error = $root.Records.SharedRecord.verify(message.removeSharedRecord[i]);
          if (error) return "removeSharedRecord." + error;
        }
      }
      if (message.pt != null && message.hasOwnProperty("pt"))
        if (!$util.isString(message.pt)) return "pt: string expected";
      return null;
    };

    /**
     * Creates a RecordShareUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordShareUpdateRequest} RecordShareUpdateRequest
     */
    RecordShareUpdateRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordShareUpdateRequest) return object;
      let message = new $root.Records.RecordShareUpdateRequest();
      if (object.addSharedRecord) {
        if (!Array.isArray(object.addSharedRecord))
          throw TypeError(".Records.RecordShareUpdateRequest.addSharedRecord: array expected");
        message.addSharedRecord = [];
        for (let i = 0; i < object.addSharedRecord.length; ++i) {
          if (typeof object.addSharedRecord[i] !== "object")
            throw TypeError(".Records.RecordShareUpdateRequest.addSharedRecord: object expected");
          message.addSharedRecord[i] = $root.Records.SharedRecord.fromObject(
            object.addSharedRecord[i],
          );
        }
      }
      if (object.updateSharedRecord) {
        if (!Array.isArray(object.updateSharedRecord))
          throw TypeError(".Records.RecordShareUpdateRequest.updateSharedRecord: array expected");
        message.updateSharedRecord = [];
        for (let i = 0; i < object.updateSharedRecord.length; ++i) {
          if (typeof object.updateSharedRecord[i] !== "object")
            throw TypeError(
              ".Records.RecordShareUpdateRequest.updateSharedRecord: object expected",
            );
          message.updateSharedRecord[i] = $root.Records.SharedRecord.fromObject(
            object.updateSharedRecord[i],
          );
        }
      }
      if (object.removeSharedRecord) {
        if (!Array.isArray(object.removeSharedRecord))
          throw TypeError(".Records.RecordShareUpdateRequest.removeSharedRecord: array expected");
        message.removeSharedRecord = [];
        for (let i = 0; i < object.removeSharedRecord.length; ++i) {
          if (typeof object.removeSharedRecord[i] !== "object")
            throw TypeError(
              ".Records.RecordShareUpdateRequest.removeSharedRecord: object expected",
            );
          message.removeSharedRecord[i] = $root.Records.SharedRecord.fromObject(
            object.removeSharedRecord[i],
          );
        }
      }
      if (object.pt != null) message.pt = String(object.pt);
      return message;
    };

    /**
     * Creates a plain object from a RecordShareUpdateRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {Records.RecordShareUpdateRequest} message RecordShareUpdateRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordShareUpdateRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.addSharedRecord = [];
        object.updateSharedRecord = [];
        object.removeSharedRecord = [];
      }
      if (options.defaults) object.pt = "";
      if (message.addSharedRecord && message.addSharedRecord.length) {
        object.addSharedRecord = [];
        for (let j = 0; j < message.addSharedRecord.length; ++j)
          object.addSharedRecord[j] = $root.Records.SharedRecord.toObject(
            message.addSharedRecord[j],
            options,
          );
      }
      if (message.updateSharedRecord && message.updateSharedRecord.length) {
        object.updateSharedRecord = [];
        for (let j = 0; j < message.updateSharedRecord.length; ++j)
          object.updateSharedRecord[j] = $root.Records.SharedRecord.toObject(
            message.updateSharedRecord[j],
            options,
          );
      }
      if (message.removeSharedRecord && message.removeSharedRecord.length) {
        object.removeSharedRecord = [];
        for (let j = 0; j < message.removeSharedRecord.length; ++j)
          object.removeSharedRecord[j] = $root.Records.SharedRecord.toObject(
            message.removeSharedRecord[j],
            options,
          );
      }
      if (message.pt != null && message.hasOwnProperty("pt")) object.pt = message.pt;
      return object;
    };

    /**
     * Converts this RecordShareUpdateRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordShareUpdateRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordShareUpdateRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordShareUpdateRequest
     * @function getTypeUrl
     * @memberof Records.RecordShareUpdateRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordShareUpdateRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordShareUpdateRequest";
    };

    return RecordShareUpdateRequest;
  })();

  Records.SharedRecord = (function () {
    /**
     * Properties of a SharedRecord.
     * @memberof Records
     * @interface ISharedRecord
     * @property {string|null} [toUsername] SharedRecord toUsername
     * @property {Uint8Array|null} [recordUid] SharedRecord recordUid
     * @property {Uint8Array|null} [recordKey] SharedRecord recordKey
     * @property {Uint8Array|null} [sharedFolderUid] SharedRecord sharedFolderUid
     * @property {Uint8Array|null} [teamUid] SharedRecord teamUid
     * @property {boolean|null} [editable] SharedRecord editable
     * @property {boolean|null} [shareable] SharedRecord shareable
     * @property {boolean|null} [transfer] SharedRecord transfer
     * @property {boolean|null} [useEccKey] SharedRecord useEccKey
     * @property {boolean|null} [removeVaultData] SharedRecord removeVaultData
     * @property {number|Long|null} [expiration] SharedRecord expiration
     * @property {Records.TimerNotificationType|null} [timerNotificationType] SharedRecord timerNotificationType
     * @property {boolean|null} [rotateOnExpiration] SharedRecord rotateOnExpiration
     */

    /**
     * Constructs a new SharedRecord.
     * @memberof Records
     * @classdesc Represents a SharedRecord.
     * @implements ISharedRecord
     * @constructor
     * @param {Records.ISharedRecord=} [properties] Properties to set
     */
    function SharedRecord(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SharedRecord toUsername.
     * @member {string} toUsername
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.toUsername = "";

    /**
     * SharedRecord recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.recordUid = $util.newBuffer([]);

    /**
     * SharedRecord recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.recordKey = $util.newBuffer([]);

    /**
     * SharedRecord sharedFolderUid.
     * @member {Uint8Array} sharedFolderUid
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.sharedFolderUid = $util.newBuffer([]);

    /**
     * SharedRecord teamUid.
     * @member {Uint8Array} teamUid
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.teamUid = $util.newBuffer([]);

    /**
     * SharedRecord editable.
     * @member {boolean} editable
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.editable = false;

    /**
     * SharedRecord shareable.
     * @member {boolean} shareable
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.shareable = false;

    /**
     * SharedRecord transfer.
     * @member {boolean} transfer
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.transfer = false;

    /**
     * SharedRecord useEccKey.
     * @member {boolean} useEccKey
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.useEccKey = false;

    /**
     * SharedRecord removeVaultData.
     * @member {boolean} removeVaultData
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.removeVaultData = false;

    /**
     * SharedRecord expiration.
     * @member {number|Long} expiration
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.expiration = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * SharedRecord timerNotificationType.
     * @member {Records.TimerNotificationType} timerNotificationType
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.timerNotificationType = 0;

    /**
     * SharedRecord rotateOnExpiration.
     * @member {boolean} rotateOnExpiration
     * @memberof Records.SharedRecord
     * @instance
     */
    SharedRecord.prototype.rotateOnExpiration = false;

    /**
     * Creates a new SharedRecord instance using the specified properties.
     * @function create
     * @memberof Records.SharedRecord
     * @static
     * @param {Records.ISharedRecord=} [properties] Properties to set
     * @returns {Records.SharedRecord} SharedRecord instance
     */
    SharedRecord.create = function create(properties) {
      return new SharedRecord(properties);
    };

    /**
     * Encodes the specified SharedRecord message. Does not implicitly {@link Records.SharedRecord.verify|verify} messages.
     * @function encode
     * @memberof Records.SharedRecord
     * @static
     * @param {Records.ISharedRecord} message SharedRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedRecord.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.toUsername != null && Object.hasOwnProperty.call(message, "toUsername"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.toUsername);
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.recordKey);
      if (message.sharedFolderUid != null && Object.hasOwnProperty.call(message, "sharedFolderUid"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.sharedFolderUid);
      if (message.teamUid != null && Object.hasOwnProperty.call(message, "teamUid"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).bytes(message.teamUid);
      if (message.editable != null && Object.hasOwnProperty.call(message, "editable"))
        writer.uint32(/* id 6, wireType 0 =*/ 48).bool(message.editable);
      if (message.shareable != null && Object.hasOwnProperty.call(message, "shareable"))
        writer.uint32(/* id 7, wireType 0 =*/ 56).bool(message.shareable);
      if (message.transfer != null && Object.hasOwnProperty.call(message, "transfer"))
        writer.uint32(/* id 8, wireType 0 =*/ 64).bool(message.transfer);
      if (message.useEccKey != null && Object.hasOwnProperty.call(message, "useEccKey"))
        writer.uint32(/* id 9, wireType 0 =*/ 72).bool(message.useEccKey);
      if (message.removeVaultData != null && Object.hasOwnProperty.call(message, "removeVaultData"))
        writer.uint32(/* id 10, wireType 0 =*/ 80).bool(message.removeVaultData);
      if (message.expiration != null && Object.hasOwnProperty.call(message, "expiration"))
        writer.uint32(/* id 11, wireType 0 =*/ 88).int64(message.expiration);
      if (
        message.timerNotificationType != null &&
        Object.hasOwnProperty.call(message, "timerNotificationType")
      )
        writer.uint32(/* id 12, wireType 0 =*/ 96).int32(message.timerNotificationType);
      if (
        message.rotateOnExpiration != null &&
        Object.hasOwnProperty.call(message, "rotateOnExpiration")
      )
        writer.uint32(/* id 13, wireType 0 =*/ 104).bool(message.rotateOnExpiration);
      return writer;
    };

    /**
     * Encodes the specified SharedRecord message, length delimited. Does not implicitly {@link Records.SharedRecord.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.SharedRecord
     * @static
     * @param {Records.ISharedRecord} message SharedRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedRecord.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SharedRecord message from the specified reader or buffer.
     * @function decode
     * @memberof Records.SharedRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.SharedRecord} SharedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedRecord.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.SharedRecord();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.toUsername = reader.string();
            break;
          }
          case 2: {
            message.recordUid = reader.bytes();
            break;
          }
          case 3: {
            message.recordKey = reader.bytes();
            break;
          }
          case 4: {
            message.sharedFolderUid = reader.bytes();
            break;
          }
          case 5: {
            message.teamUid = reader.bytes();
            break;
          }
          case 6: {
            message.editable = reader.bool();
            break;
          }
          case 7: {
            message.shareable = reader.bool();
            break;
          }
          case 8: {
            message.transfer = reader.bool();
            break;
          }
          case 9: {
            message.useEccKey = reader.bool();
            break;
          }
          case 10: {
            message.removeVaultData = reader.bool();
            break;
          }
          case 11: {
            message.expiration = reader.int64();
            break;
          }
          case 12: {
            message.timerNotificationType = reader.int32();
            break;
          }
          case 13: {
            message.rotateOnExpiration = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a SharedRecord message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.SharedRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.SharedRecord} SharedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedRecord.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SharedRecord message.
     * @function verify
     * @memberof Records.SharedRecord
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SharedRecord.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.toUsername != null && message.hasOwnProperty("toUsername"))
        if (!$util.isString(message.toUsername)) return "toUsername: string expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        if (
          !(
            (message.sharedFolderUid && typeof message.sharedFolderUid.length === "number") ||
            $util.isString(message.sharedFolderUid)
          )
        )
          return "sharedFolderUid: buffer expected";
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        if (
          !(
            (message.teamUid && typeof message.teamUid.length === "number") ||
            $util.isString(message.teamUid)
          )
        )
          return "teamUid: buffer expected";
      if (message.editable != null && message.hasOwnProperty("editable"))
        if (typeof message.editable !== "boolean") return "editable: boolean expected";
      if (message.shareable != null && message.hasOwnProperty("shareable"))
        if (typeof message.shareable !== "boolean") return "shareable: boolean expected";
      if (message.transfer != null && message.hasOwnProperty("transfer"))
        if (typeof message.transfer !== "boolean") return "transfer: boolean expected";
      if (message.useEccKey != null && message.hasOwnProperty("useEccKey"))
        if (typeof message.useEccKey !== "boolean") return "useEccKey: boolean expected";
      if (message.removeVaultData != null && message.hasOwnProperty("removeVaultData"))
        if (typeof message.removeVaultData !== "boolean")
          return "removeVaultData: boolean expected";
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (
          !$util.isInteger(message.expiration) &&
          !(
            message.expiration &&
            $util.isInteger(message.expiration.low) &&
            $util.isInteger(message.expiration.high)
          )
        )
          return "expiration: integer|Long expected";
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        switch (message.timerNotificationType) {
          default:
            return "timerNotificationType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        if (typeof message.rotateOnExpiration !== "boolean")
          return "rotateOnExpiration: boolean expected";
      return null;
    };

    /**
     * Creates a SharedRecord message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.SharedRecord
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.SharedRecord} SharedRecord
     */
    SharedRecord.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.SharedRecord) return object;
      let message = new $root.Records.SharedRecord();
      if (object.toUsername != null) message.toUsername = String(object.toUsername);
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.sharedFolderUid != null)
        if (typeof object.sharedFolderUid === "string")
          $util.base64.decode(
            object.sharedFolderUid,
            (message.sharedFolderUid = $util.newBuffer(
              $util.base64.length(object.sharedFolderUid),
            )),
            0,
          );
        else if (object.sharedFolderUid.length >= 0)
          message.sharedFolderUid = object.sharedFolderUid;
      if (object.teamUid != null)
        if (typeof object.teamUid === "string")
          $util.base64.decode(
            object.teamUid,
            (message.teamUid = $util.newBuffer($util.base64.length(object.teamUid))),
            0,
          );
        else if (object.teamUid.length >= 0) message.teamUid = object.teamUid;
      if (object.editable != null) message.editable = Boolean(object.editable);
      if (object.shareable != null) message.shareable = Boolean(object.shareable);
      if (object.transfer != null) message.transfer = Boolean(object.transfer);
      if (object.useEccKey != null) message.useEccKey = Boolean(object.useEccKey);
      if (object.removeVaultData != null) message.removeVaultData = Boolean(object.removeVaultData);
      if (object.expiration != null)
        if ($util.Long)
          (message.expiration = $util.Long.fromValue(object.expiration)).unsigned = false;
        else if (typeof object.expiration === "string")
          message.expiration = parseInt(object.expiration, 10);
        else if (typeof object.expiration === "number") message.expiration = object.expiration;
        else if (typeof object.expiration === "object")
          message.expiration = new $util.LongBits(
            object.expiration.low >>> 0,
            object.expiration.high >>> 0,
          ).toNumber();
      switch (object.timerNotificationType) {
        default:
          if (typeof object.timerNotificationType === "number") {
            message.timerNotificationType = object.timerNotificationType;
            break;
          }
          break;
        case "NOTIFICATION_OFF":
        case 0:
          message.timerNotificationType = 0;
          break;
        case "NOTIFY_OWNER":
        case 1:
          message.timerNotificationType = 1;
          break;
        case "NOTIFY_PRIVILEGED_USERS":
        case 2:
          message.timerNotificationType = 2;
          break;
      }
      if (object.rotateOnExpiration != null)
        message.rotateOnExpiration = Boolean(object.rotateOnExpiration);
      return message;
    };

    /**
     * Creates a plain object from a SharedRecord message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.SharedRecord
     * @static
     * @param {Records.SharedRecord} message SharedRecord
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SharedRecord.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.toUsername = "";
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        if (options.bytes === String) object.sharedFolderUid = "";
        else {
          object.sharedFolderUid = [];
          if (options.bytes !== Array)
            object.sharedFolderUid = $util.newBuffer(object.sharedFolderUid);
        }
        if (options.bytes === String) object.teamUid = "";
        else {
          object.teamUid = [];
          if (options.bytes !== Array) object.teamUid = $util.newBuffer(object.teamUid);
        }
        object.editable = false;
        object.shareable = false;
        object.transfer = false;
        object.useEccKey = false;
        object.removeVaultData = false;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.expiration =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.expiration = options.longs === String ? "0" : 0;
        object.timerNotificationType = options.enums === String ? "NOTIFICATION_OFF" : 0;
        object.rotateOnExpiration = false;
      }
      if (message.toUsername != null && message.hasOwnProperty("toUsername"))
        object.toUsername = message.toUsername;
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        object.sharedFolderUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedFolderUid, 0, message.sharedFolderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedFolderUid)
              : message.sharedFolderUid;
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        object.teamUid =
          options.bytes === String
            ? $util.base64.encode(message.teamUid, 0, message.teamUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.teamUid)
              : message.teamUid;
      if (message.editable != null && message.hasOwnProperty("editable"))
        object.editable = message.editable;
      if (message.shareable != null && message.hasOwnProperty("shareable"))
        object.shareable = message.shareable;
      if (message.transfer != null && message.hasOwnProperty("transfer"))
        object.transfer = message.transfer;
      if (message.useEccKey != null && message.hasOwnProperty("useEccKey"))
        object.useEccKey = message.useEccKey;
      if (message.removeVaultData != null && message.hasOwnProperty("removeVaultData"))
        object.removeVaultData = message.removeVaultData;
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (typeof message.expiration === "number")
          object.expiration =
            options.longs === String ? String(message.expiration) : message.expiration;
        else
          object.expiration =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.expiration)
              : options.longs === Number
                ? new $util.LongBits(
                    message.expiration.low >>> 0,
                    message.expiration.high >>> 0,
                  ).toNumber()
                : message.expiration;
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        object.timerNotificationType =
          options.enums === String
            ? $root.Records.TimerNotificationType[message.timerNotificationType] === undefined
              ? message.timerNotificationType
              : $root.Records.TimerNotificationType[message.timerNotificationType]
            : message.timerNotificationType;
      if (message.rotateOnExpiration != null && message.hasOwnProperty("rotateOnExpiration"))
        object.rotateOnExpiration = message.rotateOnExpiration;
      return object;
    };

    /**
     * Converts this SharedRecord to JSON.
     * @function toJSON
     * @memberof Records.SharedRecord
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SharedRecord.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SharedRecord
     * @function getTypeUrl
     * @memberof Records.SharedRecord
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SharedRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.SharedRecord";
    };

    return SharedRecord;
  })();

  Records.RecordShareUpdateResponse = (function () {
    /**
     * Properties of a RecordShareUpdateResponse.
     * @memberof Records
     * @interface IRecordShareUpdateResponse
     * @property {Array.<Records.ISharedRecordStatus>|null} [addSharedRecordStatus] RecordShareUpdateResponse addSharedRecordStatus
     * @property {Array.<Records.ISharedRecordStatus>|null} [updateSharedRecordStatus] RecordShareUpdateResponse updateSharedRecordStatus
     * @property {Array.<Records.ISharedRecordStatus>|null} [removeSharedRecordStatus] RecordShareUpdateResponse removeSharedRecordStatus
     */

    /**
     * Constructs a new RecordShareUpdateResponse.
     * @memberof Records
     * @classdesc Represents a RecordShareUpdateResponse.
     * @implements IRecordShareUpdateResponse
     * @constructor
     * @param {Records.IRecordShareUpdateResponse=} [properties] Properties to set
     */
    function RecordShareUpdateResponse(properties) {
      this.addSharedRecordStatus = [];
      this.updateSharedRecordStatus = [];
      this.removeSharedRecordStatus = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordShareUpdateResponse addSharedRecordStatus.
     * @member {Array.<Records.ISharedRecordStatus>} addSharedRecordStatus
     * @memberof Records.RecordShareUpdateResponse
     * @instance
     */
    RecordShareUpdateResponse.prototype.addSharedRecordStatus = $util.emptyArray;

    /**
     * RecordShareUpdateResponse updateSharedRecordStatus.
     * @member {Array.<Records.ISharedRecordStatus>} updateSharedRecordStatus
     * @memberof Records.RecordShareUpdateResponse
     * @instance
     */
    RecordShareUpdateResponse.prototype.updateSharedRecordStatus = $util.emptyArray;

    /**
     * RecordShareUpdateResponse removeSharedRecordStatus.
     * @member {Array.<Records.ISharedRecordStatus>} removeSharedRecordStatus
     * @memberof Records.RecordShareUpdateResponse
     * @instance
     */
    RecordShareUpdateResponse.prototype.removeSharedRecordStatus = $util.emptyArray;

    /**
     * Creates a new RecordShareUpdateResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Records.IRecordShareUpdateResponse=} [properties] Properties to set
     * @returns {Records.RecordShareUpdateResponse} RecordShareUpdateResponse instance
     */
    RecordShareUpdateResponse.create = function create(properties) {
      return new RecordShareUpdateResponse(properties);
    };

    /**
     * Encodes the specified RecordShareUpdateResponse message. Does not implicitly {@link Records.RecordShareUpdateResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Records.IRecordShareUpdateResponse} message RecordShareUpdateResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordShareUpdateResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.addSharedRecordStatus != null && message.addSharedRecordStatus.length)
        for (let i = 0; i < message.addSharedRecordStatus.length; ++i)
          $root.Records.SharedRecordStatus.encode(
            message.addSharedRecordStatus[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.updateSharedRecordStatus != null && message.updateSharedRecordStatus.length)
        for (let i = 0; i < message.updateSharedRecordStatus.length; ++i)
          $root.Records.SharedRecordStatus.encode(
            message.updateSharedRecordStatus[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.removeSharedRecordStatus != null && message.removeSharedRecordStatus.length)
        for (let i = 0; i < message.removeSharedRecordStatus.length; ++i)
          $root.Records.SharedRecordStatus.encode(
            message.removeSharedRecordStatus[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordShareUpdateResponse message, length delimited. Does not implicitly {@link Records.RecordShareUpdateResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Records.IRecordShareUpdateResponse} message RecordShareUpdateResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordShareUpdateResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordShareUpdateResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordShareUpdateResponse} RecordShareUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordShareUpdateResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordShareUpdateResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.addSharedRecordStatus && message.addSharedRecordStatus.length))
              message.addSharedRecordStatus = [];
            message.addSharedRecordStatus.push(
              $root.Records.SharedRecordStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.updateSharedRecordStatus && message.updateSharedRecordStatus.length))
              message.updateSharedRecordStatus = [];
            message.updateSharedRecordStatus.push(
              $root.Records.SharedRecordStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          case 3: {
            if (!(message.removeSharedRecordStatus && message.removeSharedRecordStatus.length))
              message.removeSharedRecordStatus = [];
            message.removeSharedRecordStatus.push(
              $root.Records.SharedRecordStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordShareUpdateResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordShareUpdateResponse} RecordShareUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordShareUpdateResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordShareUpdateResponse message.
     * @function verify
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordShareUpdateResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (
        message.addSharedRecordStatus != null &&
        message.hasOwnProperty("addSharedRecordStatus")
      ) {
        if (!Array.isArray(message.addSharedRecordStatus))
          return "addSharedRecordStatus: array expected";
        for (let i = 0; i < message.addSharedRecordStatus.length; ++i) {
          let error = $root.Records.SharedRecordStatus.verify(message.addSharedRecordStatus[i]);
          if (error) return "addSharedRecordStatus." + error;
        }
      }
      if (
        message.updateSharedRecordStatus != null &&
        message.hasOwnProperty("updateSharedRecordStatus")
      ) {
        if (!Array.isArray(message.updateSharedRecordStatus))
          return "updateSharedRecordStatus: array expected";
        for (let i = 0; i < message.updateSharedRecordStatus.length; ++i) {
          let error = $root.Records.SharedRecordStatus.verify(message.updateSharedRecordStatus[i]);
          if (error) return "updateSharedRecordStatus." + error;
        }
      }
      if (
        message.removeSharedRecordStatus != null &&
        message.hasOwnProperty("removeSharedRecordStatus")
      ) {
        if (!Array.isArray(message.removeSharedRecordStatus))
          return "removeSharedRecordStatus: array expected";
        for (let i = 0; i < message.removeSharedRecordStatus.length; ++i) {
          let error = $root.Records.SharedRecordStatus.verify(message.removeSharedRecordStatus[i]);
          if (error) return "removeSharedRecordStatus." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordShareUpdateResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordShareUpdateResponse} RecordShareUpdateResponse
     */
    RecordShareUpdateResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordShareUpdateResponse) return object;
      let message = new $root.Records.RecordShareUpdateResponse();
      if (object.addSharedRecordStatus) {
        if (!Array.isArray(object.addSharedRecordStatus))
          throw TypeError(
            ".Records.RecordShareUpdateResponse.addSharedRecordStatus: array expected",
          );
        message.addSharedRecordStatus = [];
        for (let i = 0; i < object.addSharedRecordStatus.length; ++i) {
          if (typeof object.addSharedRecordStatus[i] !== "object")
            throw TypeError(
              ".Records.RecordShareUpdateResponse.addSharedRecordStatus: object expected",
            );
          message.addSharedRecordStatus[i] = $root.Records.SharedRecordStatus.fromObject(
            object.addSharedRecordStatus[i],
          );
        }
      }
      if (object.updateSharedRecordStatus) {
        if (!Array.isArray(object.updateSharedRecordStatus))
          throw TypeError(
            ".Records.RecordShareUpdateResponse.updateSharedRecordStatus: array expected",
          );
        message.updateSharedRecordStatus = [];
        for (let i = 0; i < object.updateSharedRecordStatus.length; ++i) {
          if (typeof object.updateSharedRecordStatus[i] !== "object")
            throw TypeError(
              ".Records.RecordShareUpdateResponse.updateSharedRecordStatus: object expected",
            );
          message.updateSharedRecordStatus[i] = $root.Records.SharedRecordStatus.fromObject(
            object.updateSharedRecordStatus[i],
          );
        }
      }
      if (object.removeSharedRecordStatus) {
        if (!Array.isArray(object.removeSharedRecordStatus))
          throw TypeError(
            ".Records.RecordShareUpdateResponse.removeSharedRecordStatus: array expected",
          );
        message.removeSharedRecordStatus = [];
        for (let i = 0; i < object.removeSharedRecordStatus.length; ++i) {
          if (typeof object.removeSharedRecordStatus[i] !== "object")
            throw TypeError(
              ".Records.RecordShareUpdateResponse.removeSharedRecordStatus: object expected",
            );
          message.removeSharedRecordStatus[i] = $root.Records.SharedRecordStatus.fromObject(
            object.removeSharedRecordStatus[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordShareUpdateResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {Records.RecordShareUpdateResponse} message RecordShareUpdateResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordShareUpdateResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.addSharedRecordStatus = [];
        object.updateSharedRecordStatus = [];
        object.removeSharedRecordStatus = [];
      }
      if (message.addSharedRecordStatus && message.addSharedRecordStatus.length) {
        object.addSharedRecordStatus = [];
        for (let j = 0; j < message.addSharedRecordStatus.length; ++j)
          object.addSharedRecordStatus[j] = $root.Records.SharedRecordStatus.toObject(
            message.addSharedRecordStatus[j],
            options,
          );
      }
      if (message.updateSharedRecordStatus && message.updateSharedRecordStatus.length) {
        object.updateSharedRecordStatus = [];
        for (let j = 0; j < message.updateSharedRecordStatus.length; ++j)
          object.updateSharedRecordStatus[j] = $root.Records.SharedRecordStatus.toObject(
            message.updateSharedRecordStatus[j],
            options,
          );
      }
      if (message.removeSharedRecordStatus && message.removeSharedRecordStatus.length) {
        object.removeSharedRecordStatus = [];
        for (let j = 0; j < message.removeSharedRecordStatus.length; ++j)
          object.removeSharedRecordStatus[j] = $root.Records.SharedRecordStatus.toObject(
            message.removeSharedRecordStatus[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordShareUpdateResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordShareUpdateResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordShareUpdateResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordShareUpdateResponse
     * @function getTypeUrl
     * @memberof Records.RecordShareUpdateResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordShareUpdateResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordShareUpdateResponse";
    };

    return RecordShareUpdateResponse;
  })();

  Records.SharedRecordStatus = (function () {
    /**
     * Properties of a SharedRecordStatus.
     * @memberof Records
     * @interface ISharedRecordStatus
     * @property {Uint8Array|null} [recordUid] SharedRecordStatus recordUid
     * @property {string|null} [status] SharedRecordStatus status
     * @property {string|null} [message] SharedRecordStatus message
     * @property {string|null} [username] SharedRecordStatus username
     */

    /**
     * Constructs a new SharedRecordStatus.
     * @memberof Records
     * @classdesc Represents a SharedRecordStatus.
     * @implements ISharedRecordStatus
     * @constructor
     * @param {Records.ISharedRecordStatus=} [properties] Properties to set
     */
    function SharedRecordStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SharedRecordStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.SharedRecordStatus
     * @instance
     */
    SharedRecordStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * SharedRecordStatus status.
     * @member {string} status
     * @memberof Records.SharedRecordStatus
     * @instance
     */
    SharedRecordStatus.prototype.status = "";

    /**
     * SharedRecordStatus message.
     * @member {string} message
     * @memberof Records.SharedRecordStatus
     * @instance
     */
    SharedRecordStatus.prototype.message = "";

    /**
     * SharedRecordStatus username.
     * @member {string} username
     * @memberof Records.SharedRecordStatus
     * @instance
     */
    SharedRecordStatus.prototype.username = "";

    /**
     * Creates a new SharedRecordStatus instance using the specified properties.
     * @function create
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Records.ISharedRecordStatus=} [properties] Properties to set
     * @returns {Records.SharedRecordStatus} SharedRecordStatus instance
     */
    SharedRecordStatus.create = function create(properties) {
      return new SharedRecordStatus(properties);
    };

    /**
     * Encodes the specified SharedRecordStatus message. Does not implicitly {@link Records.SharedRecordStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Records.ISharedRecordStatus} message SharedRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedRecordStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.status);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.message);
      if (message.username != null && Object.hasOwnProperty.call(message, "username"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.username);
      return writer;
    };

    /**
     * Encodes the specified SharedRecordStatus message, length delimited. Does not implicitly {@link Records.SharedRecordStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Records.ISharedRecordStatus} message SharedRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SharedRecordStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SharedRecordStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.SharedRecordStatus} SharedRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedRecordStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.SharedRecordStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.string();
            break;
          }
          case 3: {
            message.message = reader.string();
            break;
          }
          case 4: {
            message.username = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a SharedRecordStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.SharedRecordStatus} SharedRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SharedRecordStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SharedRecordStatus message.
     * @function verify
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SharedRecordStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        if (!$util.isString(message.status)) return "status: string expected";
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      if (message.username != null && message.hasOwnProperty("username"))
        if (!$util.isString(message.username)) return "username: string expected";
      return null;
    };

    /**
     * Creates a SharedRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.SharedRecordStatus} SharedRecordStatus
     */
    SharedRecordStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.SharedRecordStatus) return object;
      let message = new $root.Records.SharedRecordStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.status != null) message.status = String(object.status);
      if (object.message != null) message.message = String(object.message);
      if (object.username != null) message.username = String(object.username);
      return message;
    };

    /**
     * Creates a plain object from a SharedRecordStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {Records.SharedRecordStatus} message SharedRecordStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SharedRecordStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = "";
        object.message = "";
        object.username = "";
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status = message.status;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      if (message.username != null && message.hasOwnProperty("username"))
        object.username = message.username;
      return object;
    };

    /**
     * Converts this SharedRecordStatus to JSON.
     * @function toJSON
     * @memberof Records.SharedRecordStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SharedRecordStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SharedRecordStatus
     * @function getTypeUrl
     * @memberof Records.SharedRecordStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SharedRecordStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.SharedRecordStatus";
    };

    return SharedRecordStatus;
  })();

  Records.GetRecordPermissionsRequest = (function () {
    /**
     * Properties of a GetRecordPermissionsRequest.
     * @memberof Records
     * @interface IGetRecordPermissionsRequest
     * @property {Array.<Uint8Array>|null} [recordUids] GetRecordPermissionsRequest recordUids
     * @property {boolean|null} [isShareAdmin] GetRecordPermissionsRequest isShareAdmin
     */

    /**
     * Constructs a new GetRecordPermissionsRequest.
     * @memberof Records
     * @classdesc Represents a GetRecordPermissionsRequest.
     * @implements IGetRecordPermissionsRequest
     * @constructor
     * @param {Records.IGetRecordPermissionsRequest=} [properties] Properties to set
     */
    function GetRecordPermissionsRequest(properties) {
      this.recordUids = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetRecordPermissionsRequest recordUids.
     * @member {Array.<Uint8Array>} recordUids
     * @memberof Records.GetRecordPermissionsRequest
     * @instance
     */
    GetRecordPermissionsRequest.prototype.recordUids = $util.emptyArray;

    /**
     * GetRecordPermissionsRequest isShareAdmin.
     * @member {boolean} isShareAdmin
     * @memberof Records.GetRecordPermissionsRequest
     * @instance
     */
    GetRecordPermissionsRequest.prototype.isShareAdmin = false;

    /**
     * Creates a new GetRecordPermissionsRequest instance using the specified properties.
     * @function create
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Records.IGetRecordPermissionsRequest=} [properties] Properties to set
     * @returns {Records.GetRecordPermissionsRequest} GetRecordPermissionsRequest instance
     */
    GetRecordPermissionsRequest.create = function create(properties) {
      return new GetRecordPermissionsRequest(properties);
    };

    /**
     * Encodes the specified GetRecordPermissionsRequest message. Does not implicitly {@link Records.GetRecordPermissionsRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Records.IGetRecordPermissionsRequest} message GetRecordPermissionsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordPermissionsRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUids != null && message.recordUids.length)
        for (let i = 0; i < message.recordUids.length; ++i)
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUids[i]);
      if (message.isShareAdmin != null && Object.hasOwnProperty.call(message, "isShareAdmin"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.isShareAdmin);
      return writer;
    };

    /**
     * Encodes the specified GetRecordPermissionsRequest message, length delimited. Does not implicitly {@link Records.GetRecordPermissionsRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Records.IGetRecordPermissionsRequest} message GetRecordPermissionsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordPermissionsRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetRecordPermissionsRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetRecordPermissionsRequest} GetRecordPermissionsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordPermissionsRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetRecordPermissionsRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordUids && message.recordUids.length)) message.recordUids = [];
            message.recordUids.push(reader.bytes());
            break;
          }
          case 2: {
            message.isShareAdmin = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetRecordPermissionsRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetRecordPermissionsRequest} GetRecordPermissionsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordPermissionsRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetRecordPermissionsRequest message.
     * @function verify
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetRecordPermissionsRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUids != null && message.hasOwnProperty("recordUids")) {
        if (!Array.isArray(message.recordUids)) return "recordUids: array expected";
        for (let i = 0; i < message.recordUids.length; ++i)
          if (
            !(
              (message.recordUids[i] && typeof message.recordUids[i].length === "number") ||
              $util.isString(message.recordUids[i])
            )
          )
            return "recordUids: buffer[] expected";
      }
      if (message.isShareAdmin != null && message.hasOwnProperty("isShareAdmin"))
        if (typeof message.isShareAdmin !== "boolean") return "isShareAdmin: boolean expected";
      return null;
    };

    /**
     * Creates a GetRecordPermissionsRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetRecordPermissionsRequest} GetRecordPermissionsRequest
     */
    GetRecordPermissionsRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetRecordPermissionsRequest) return object;
      let message = new $root.Records.GetRecordPermissionsRequest();
      if (object.recordUids) {
        if (!Array.isArray(object.recordUids))
          throw TypeError(".Records.GetRecordPermissionsRequest.recordUids: array expected");
        message.recordUids = [];
        for (let i = 0; i < object.recordUids.length; ++i)
          if (typeof object.recordUids[i] === "string")
            $util.base64.decode(
              object.recordUids[i],
              (message.recordUids[i] = $util.newBuffer($util.base64.length(object.recordUids[i]))),
              0,
            );
          else if (object.recordUids[i].length >= 0) message.recordUids[i] = object.recordUids[i];
      }
      if (object.isShareAdmin != null) message.isShareAdmin = Boolean(object.isShareAdmin);
      return message;
    };

    /**
     * Creates a plain object from a GetRecordPermissionsRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {Records.GetRecordPermissionsRequest} message GetRecordPermissionsRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetRecordPermissionsRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordUids = [];
      if (options.defaults) object.isShareAdmin = false;
      if (message.recordUids && message.recordUids.length) {
        object.recordUids = [];
        for (let j = 0; j < message.recordUids.length; ++j)
          object.recordUids[j] =
            options.bytes === String
              ? $util.base64.encode(message.recordUids[j], 0, message.recordUids[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordUids[j])
                : message.recordUids[j];
      }
      if (message.isShareAdmin != null && message.hasOwnProperty("isShareAdmin"))
        object.isShareAdmin = message.isShareAdmin;
      return object;
    };

    /**
     * Converts this GetRecordPermissionsRequest to JSON.
     * @function toJSON
     * @memberof Records.GetRecordPermissionsRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetRecordPermissionsRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetRecordPermissionsRequest
     * @function getTypeUrl
     * @memberof Records.GetRecordPermissionsRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetRecordPermissionsRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetRecordPermissionsRequest";
    };

    return GetRecordPermissionsRequest;
  })();

  Records.GetRecordPermissionsResponse = (function () {
    /**
     * Properties of a GetRecordPermissionsResponse.
     * @memberof Records
     * @interface IGetRecordPermissionsResponse
     * @property {Array.<Records.IRecordPermission>|null} [recordPermissions] GetRecordPermissionsResponse recordPermissions
     */

    /**
     * Constructs a new GetRecordPermissionsResponse.
     * @memberof Records
     * @classdesc Represents a GetRecordPermissionsResponse.
     * @implements IGetRecordPermissionsResponse
     * @constructor
     * @param {Records.IGetRecordPermissionsResponse=} [properties] Properties to set
     */
    function GetRecordPermissionsResponse(properties) {
      this.recordPermissions = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetRecordPermissionsResponse recordPermissions.
     * @member {Array.<Records.IRecordPermission>} recordPermissions
     * @memberof Records.GetRecordPermissionsResponse
     * @instance
     */
    GetRecordPermissionsResponse.prototype.recordPermissions = $util.emptyArray;

    /**
     * Creates a new GetRecordPermissionsResponse instance using the specified properties.
     * @function create
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Records.IGetRecordPermissionsResponse=} [properties] Properties to set
     * @returns {Records.GetRecordPermissionsResponse} GetRecordPermissionsResponse instance
     */
    GetRecordPermissionsResponse.create = function create(properties) {
      return new GetRecordPermissionsResponse(properties);
    };

    /**
     * Encodes the specified GetRecordPermissionsResponse message. Does not implicitly {@link Records.GetRecordPermissionsResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Records.IGetRecordPermissionsResponse} message GetRecordPermissionsResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordPermissionsResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordPermissions != null && message.recordPermissions.length)
        for (let i = 0; i < message.recordPermissions.length; ++i)
          $root.Records.RecordPermission.encode(
            message.recordPermissions[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GetRecordPermissionsResponse message, length delimited. Does not implicitly {@link Records.GetRecordPermissionsResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Records.IGetRecordPermissionsResponse} message GetRecordPermissionsResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetRecordPermissionsResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetRecordPermissionsResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetRecordPermissionsResponse} GetRecordPermissionsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordPermissionsResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetRecordPermissionsResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recordPermissions && message.recordPermissions.length))
              message.recordPermissions = [];
            message.recordPermissions.push(
              $root.Records.RecordPermission.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetRecordPermissionsResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetRecordPermissionsResponse} GetRecordPermissionsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetRecordPermissionsResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetRecordPermissionsResponse message.
     * @function verify
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetRecordPermissionsResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordPermissions != null && message.hasOwnProperty("recordPermissions")) {
        if (!Array.isArray(message.recordPermissions)) return "recordPermissions: array expected";
        for (let i = 0; i < message.recordPermissions.length; ++i) {
          let error = $root.Records.RecordPermission.verify(message.recordPermissions[i]);
          if (error) return "recordPermissions." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GetRecordPermissionsResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetRecordPermissionsResponse} GetRecordPermissionsResponse
     */
    GetRecordPermissionsResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetRecordPermissionsResponse) return object;
      let message = new $root.Records.GetRecordPermissionsResponse();
      if (object.recordPermissions) {
        if (!Array.isArray(object.recordPermissions))
          throw TypeError(
            ".Records.GetRecordPermissionsResponse.recordPermissions: array expected",
          );
        message.recordPermissions = [];
        for (let i = 0; i < object.recordPermissions.length; ++i) {
          if (typeof object.recordPermissions[i] !== "object")
            throw TypeError(
              ".Records.GetRecordPermissionsResponse.recordPermissions: object expected",
            );
          message.recordPermissions[i] = $root.Records.RecordPermission.fromObject(
            object.recordPermissions[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GetRecordPermissionsResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {Records.GetRecordPermissionsResponse} message GetRecordPermissionsResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetRecordPermissionsResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.recordPermissions = [];
      if (message.recordPermissions && message.recordPermissions.length) {
        object.recordPermissions = [];
        for (let j = 0; j < message.recordPermissions.length; ++j)
          object.recordPermissions[j] = $root.Records.RecordPermission.toObject(
            message.recordPermissions[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this GetRecordPermissionsResponse to JSON.
     * @function toJSON
     * @memberof Records.GetRecordPermissionsResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetRecordPermissionsResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetRecordPermissionsResponse
     * @function getTypeUrl
     * @memberof Records.GetRecordPermissionsResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetRecordPermissionsResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetRecordPermissionsResponse";
    };

    return GetRecordPermissionsResponse;
  })();

  Records.RecordPermission = (function () {
    /**
     * Properties of a RecordPermission.
     * @memberof Records
     * @interface IRecordPermission
     * @property {Uint8Array|null} [recordUid] RecordPermission recordUid
     * @property {boolean|null} [owner] RecordPermission owner
     * @property {boolean|null} [canEdit] RecordPermission canEdit
     * @property {boolean|null} [canShare] RecordPermission canShare
     * @property {boolean|null} [canTransfer] RecordPermission canTransfer
     */

    /**
     * Constructs a new RecordPermission.
     * @memberof Records
     * @classdesc Represents a RecordPermission.
     * @implements IRecordPermission
     * @constructor
     * @param {Records.IRecordPermission=} [properties] Properties to set
     */
    function RecordPermission(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordPermission recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordPermission
     * @instance
     */
    RecordPermission.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordPermission owner.
     * @member {boolean} owner
     * @memberof Records.RecordPermission
     * @instance
     */
    RecordPermission.prototype.owner = false;

    /**
     * RecordPermission canEdit.
     * @member {boolean} canEdit
     * @memberof Records.RecordPermission
     * @instance
     */
    RecordPermission.prototype.canEdit = false;

    /**
     * RecordPermission canShare.
     * @member {boolean} canShare
     * @memberof Records.RecordPermission
     * @instance
     */
    RecordPermission.prototype.canShare = false;

    /**
     * RecordPermission canTransfer.
     * @member {boolean} canTransfer
     * @memberof Records.RecordPermission
     * @instance
     */
    RecordPermission.prototype.canTransfer = false;

    /**
     * Creates a new RecordPermission instance using the specified properties.
     * @function create
     * @memberof Records.RecordPermission
     * @static
     * @param {Records.IRecordPermission=} [properties] Properties to set
     * @returns {Records.RecordPermission} RecordPermission instance
     */
    RecordPermission.create = function create(properties) {
      return new RecordPermission(properties);
    };

    /**
     * Encodes the specified RecordPermission message. Does not implicitly {@link Records.RecordPermission.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordPermission
     * @static
     * @param {Records.IRecordPermission} message RecordPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordPermission.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.owner != null && Object.hasOwnProperty.call(message, "owner"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.owner);
      if (message.canEdit != null && Object.hasOwnProperty.call(message, "canEdit"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.canEdit);
      if (message.canShare != null && Object.hasOwnProperty.call(message, "canShare"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.canShare);
      if (message.canTransfer != null && Object.hasOwnProperty.call(message, "canTransfer"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).bool(message.canTransfer);
      return writer;
    };

    /**
     * Encodes the specified RecordPermission message, length delimited. Does not implicitly {@link Records.RecordPermission.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordPermission
     * @static
     * @param {Records.IRecordPermission} message RecordPermission message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordPermission.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordPermission message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordPermission} RecordPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordPermission.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordPermission();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.owner = reader.bool();
            break;
          }
          case 3: {
            message.canEdit = reader.bool();
            break;
          }
          case 4: {
            message.canShare = reader.bool();
            break;
          }
          case 5: {
            message.canTransfer = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordPermission message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordPermission
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordPermission} RecordPermission
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordPermission.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordPermission message.
     * @function verify
     * @memberof Records.RecordPermission
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordPermission.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.owner != null && message.hasOwnProperty("owner"))
        if (typeof message.owner !== "boolean") return "owner: boolean expected";
      if (message.canEdit != null && message.hasOwnProperty("canEdit"))
        if (typeof message.canEdit !== "boolean") return "canEdit: boolean expected";
      if (message.canShare != null && message.hasOwnProperty("canShare"))
        if (typeof message.canShare !== "boolean") return "canShare: boolean expected";
      if (message.canTransfer != null && message.hasOwnProperty("canTransfer"))
        if (typeof message.canTransfer !== "boolean") return "canTransfer: boolean expected";
      return null;
    };

    /**
     * Creates a RecordPermission message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordPermission
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordPermission} RecordPermission
     */
    RecordPermission.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordPermission) return object;
      let message = new $root.Records.RecordPermission();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.owner != null) message.owner = Boolean(object.owner);
      if (object.canEdit != null) message.canEdit = Boolean(object.canEdit);
      if (object.canShare != null) message.canShare = Boolean(object.canShare);
      if (object.canTransfer != null) message.canTransfer = Boolean(object.canTransfer);
      return message;
    };

    /**
     * Creates a plain object from a RecordPermission message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordPermission
     * @static
     * @param {Records.RecordPermission} message RecordPermission
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordPermission.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.owner = false;
        object.canEdit = false;
        object.canShare = false;
        object.canTransfer = false;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.owner != null && message.hasOwnProperty("owner")) object.owner = message.owner;
      if (message.canEdit != null && message.hasOwnProperty("canEdit"))
        object.canEdit = message.canEdit;
      if (message.canShare != null && message.hasOwnProperty("canShare"))
        object.canShare = message.canShare;
      if (message.canTransfer != null && message.hasOwnProperty("canTransfer"))
        object.canTransfer = message.canTransfer;
      return object;
    };

    /**
     * Converts this RecordPermission to JSON.
     * @function toJSON
     * @memberof Records.RecordPermission
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordPermission.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordPermission
     * @function getTypeUrl
     * @memberof Records.RecordPermission
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordPermission.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordPermission";
    };

    return RecordPermission;
  })();

  Records.GetShareObjectsRequest = (function () {
    /**
     * Properties of a GetShareObjectsRequest.
     * @memberof Records
     * @interface IGetShareObjectsRequest
     * @property {string|null} [startWith] GetShareObjectsRequest startWith
     * @property {string|null} [contains] GetShareObjectsRequest contains
     * @property {boolean|null} [filtered] GetShareObjectsRequest filtered
     * @property {Uint8Array|null} [sharedFolderUid] GetShareObjectsRequest sharedFolderUid
     */

    /**
     * Constructs a new GetShareObjectsRequest.
     * @memberof Records
     * @classdesc Represents a GetShareObjectsRequest.
     * @implements IGetShareObjectsRequest
     * @constructor
     * @param {Records.IGetShareObjectsRequest=} [properties] Properties to set
     */
    function GetShareObjectsRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetShareObjectsRequest startWith.
     * @member {string} startWith
     * @memberof Records.GetShareObjectsRequest
     * @instance
     */
    GetShareObjectsRequest.prototype.startWith = "";

    /**
     * GetShareObjectsRequest contains.
     * @member {string} contains
     * @memberof Records.GetShareObjectsRequest
     * @instance
     */
    GetShareObjectsRequest.prototype.contains = "";

    /**
     * GetShareObjectsRequest filtered.
     * @member {boolean} filtered
     * @memberof Records.GetShareObjectsRequest
     * @instance
     */
    GetShareObjectsRequest.prototype.filtered = false;

    /**
     * GetShareObjectsRequest sharedFolderUid.
     * @member {Uint8Array} sharedFolderUid
     * @memberof Records.GetShareObjectsRequest
     * @instance
     */
    GetShareObjectsRequest.prototype.sharedFolderUid = $util.newBuffer([]);

    /**
     * Creates a new GetShareObjectsRequest instance using the specified properties.
     * @function create
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Records.IGetShareObjectsRequest=} [properties] Properties to set
     * @returns {Records.GetShareObjectsRequest} GetShareObjectsRequest instance
     */
    GetShareObjectsRequest.create = function create(properties) {
      return new GetShareObjectsRequest(properties);
    };

    /**
     * Encodes the specified GetShareObjectsRequest message. Does not implicitly {@link Records.GetShareObjectsRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Records.IGetShareObjectsRequest} message GetShareObjectsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetShareObjectsRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.startWith != null && Object.hasOwnProperty.call(message, "startWith"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.startWith);
      if (message.contains != null && Object.hasOwnProperty.call(message, "contains"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.contains);
      if (message.filtered != null && Object.hasOwnProperty.call(message, "filtered"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.filtered);
      if (message.sharedFolderUid != null && Object.hasOwnProperty.call(message, "sharedFolderUid"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.sharedFolderUid);
      return writer;
    };

    /**
     * Encodes the specified GetShareObjectsRequest message, length delimited. Does not implicitly {@link Records.GetShareObjectsRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Records.IGetShareObjectsRequest} message GetShareObjectsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetShareObjectsRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetShareObjectsRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetShareObjectsRequest} GetShareObjectsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetShareObjectsRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetShareObjectsRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.startWith = reader.string();
            break;
          }
          case 2: {
            message.contains = reader.string();
            break;
          }
          case 3: {
            message.filtered = reader.bool();
            break;
          }
          case 4: {
            message.sharedFolderUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetShareObjectsRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetShareObjectsRequest} GetShareObjectsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetShareObjectsRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetShareObjectsRequest message.
     * @function verify
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetShareObjectsRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.startWith != null && message.hasOwnProperty("startWith"))
        if (!$util.isString(message.startWith)) return "startWith: string expected";
      if (message.contains != null && message.hasOwnProperty("contains"))
        if (!$util.isString(message.contains)) return "contains: string expected";
      if (message.filtered != null && message.hasOwnProperty("filtered"))
        if (typeof message.filtered !== "boolean") return "filtered: boolean expected";
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        if (
          !(
            (message.sharedFolderUid && typeof message.sharedFolderUid.length === "number") ||
            $util.isString(message.sharedFolderUid)
          )
        )
          return "sharedFolderUid: buffer expected";
      return null;
    };

    /**
     * Creates a GetShareObjectsRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetShareObjectsRequest} GetShareObjectsRequest
     */
    GetShareObjectsRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetShareObjectsRequest) return object;
      let message = new $root.Records.GetShareObjectsRequest();
      if (object.startWith != null) message.startWith = String(object.startWith);
      if (object.contains != null) message.contains = String(object.contains);
      if (object.filtered != null) message.filtered = Boolean(object.filtered);
      if (object.sharedFolderUid != null)
        if (typeof object.sharedFolderUid === "string")
          $util.base64.decode(
            object.sharedFolderUid,
            (message.sharedFolderUid = $util.newBuffer(
              $util.base64.length(object.sharedFolderUid),
            )),
            0,
          );
        else if (object.sharedFolderUid.length >= 0)
          message.sharedFolderUid = object.sharedFolderUid;
      return message;
    };

    /**
     * Creates a plain object from a GetShareObjectsRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {Records.GetShareObjectsRequest} message GetShareObjectsRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetShareObjectsRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.startWith = "";
        object.contains = "";
        object.filtered = false;
        if (options.bytes === String) object.sharedFolderUid = "";
        else {
          object.sharedFolderUid = [];
          if (options.bytes !== Array)
            object.sharedFolderUid = $util.newBuffer(object.sharedFolderUid);
        }
      }
      if (message.startWith != null && message.hasOwnProperty("startWith"))
        object.startWith = message.startWith;
      if (message.contains != null && message.hasOwnProperty("contains"))
        object.contains = message.contains;
      if (message.filtered != null && message.hasOwnProperty("filtered"))
        object.filtered = message.filtered;
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        object.sharedFolderUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedFolderUid, 0, message.sharedFolderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedFolderUid)
              : message.sharedFolderUid;
      return object;
    };

    /**
     * Converts this GetShareObjectsRequest to JSON.
     * @function toJSON
     * @memberof Records.GetShareObjectsRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetShareObjectsRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetShareObjectsRequest
     * @function getTypeUrl
     * @memberof Records.GetShareObjectsRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetShareObjectsRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetShareObjectsRequest";
    };

    return GetShareObjectsRequest;
  })();

  Records.GetShareObjectsResponse = (function () {
    /**
     * Properties of a GetShareObjectsResponse.
     * @memberof Records
     * @interface IGetShareObjectsResponse
     * @property {Array.<Records.IShareUser>|null} [shareRelationships] GetShareObjectsResponse shareRelationships
     * @property {Array.<Records.IShareUser>|null} [shareFamilyUsers] GetShareObjectsResponse shareFamilyUsers
     * @property {Array.<Records.IShareUser>|null} [shareEnterpriseUsers] GetShareObjectsResponse shareEnterpriseUsers
     * @property {Array.<Records.IShareTeam>|null} [shareTeams] GetShareObjectsResponse shareTeams
     * @property {Array.<Records.IShareTeam>|null} [shareMCTeams] GetShareObjectsResponse shareMCTeams
     * @property {Array.<Records.IShareUser>|null} [shareMCEnterpriseUsers] GetShareObjectsResponse shareMCEnterpriseUsers
     * @property {Array.<Records.IShareEnterprise>|null} [shareEnterpriseNames] GetShareObjectsResponse shareEnterpriseNames
     */

    /**
     * Constructs a new GetShareObjectsResponse.
     * @memberof Records
     * @classdesc Represents a GetShareObjectsResponse.
     * @implements IGetShareObjectsResponse
     * @constructor
     * @param {Records.IGetShareObjectsResponse=} [properties] Properties to set
     */
    function GetShareObjectsResponse(properties) {
      this.shareRelationships = [];
      this.shareFamilyUsers = [];
      this.shareEnterpriseUsers = [];
      this.shareTeams = [];
      this.shareMCTeams = [];
      this.shareMCEnterpriseUsers = [];
      this.shareEnterpriseNames = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GetShareObjectsResponse shareRelationships.
     * @member {Array.<Records.IShareUser>} shareRelationships
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareRelationships = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareFamilyUsers.
     * @member {Array.<Records.IShareUser>} shareFamilyUsers
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareFamilyUsers = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareEnterpriseUsers.
     * @member {Array.<Records.IShareUser>} shareEnterpriseUsers
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareEnterpriseUsers = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareTeams.
     * @member {Array.<Records.IShareTeam>} shareTeams
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareTeams = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareMCTeams.
     * @member {Array.<Records.IShareTeam>} shareMCTeams
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareMCTeams = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareMCEnterpriseUsers.
     * @member {Array.<Records.IShareUser>} shareMCEnterpriseUsers
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareMCEnterpriseUsers = $util.emptyArray;

    /**
     * GetShareObjectsResponse shareEnterpriseNames.
     * @member {Array.<Records.IShareEnterprise>} shareEnterpriseNames
     * @memberof Records.GetShareObjectsResponse
     * @instance
     */
    GetShareObjectsResponse.prototype.shareEnterpriseNames = $util.emptyArray;

    /**
     * Creates a new GetShareObjectsResponse instance using the specified properties.
     * @function create
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Records.IGetShareObjectsResponse=} [properties] Properties to set
     * @returns {Records.GetShareObjectsResponse} GetShareObjectsResponse instance
     */
    GetShareObjectsResponse.create = function create(properties) {
      return new GetShareObjectsResponse(properties);
    };

    /**
     * Encodes the specified GetShareObjectsResponse message. Does not implicitly {@link Records.GetShareObjectsResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Records.IGetShareObjectsResponse} message GetShareObjectsResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetShareObjectsResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.shareRelationships != null && message.shareRelationships.length)
        for (let i = 0; i < message.shareRelationships.length; ++i)
          $root.Records.ShareUser.encode(
            message.shareRelationships[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.shareFamilyUsers != null && message.shareFamilyUsers.length)
        for (let i = 0; i < message.shareFamilyUsers.length; ++i)
          $root.Records.ShareUser.encode(
            message.shareFamilyUsers[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.shareEnterpriseUsers != null && message.shareEnterpriseUsers.length)
        for (let i = 0; i < message.shareEnterpriseUsers.length; ++i)
          $root.Records.ShareUser.encode(
            message.shareEnterpriseUsers[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.shareTeams != null && message.shareTeams.length)
        for (let i = 0; i < message.shareTeams.length; ++i)
          $root.Records.ShareTeam.encode(
            message.shareTeams[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      if (message.shareMCTeams != null && message.shareMCTeams.length)
        for (let i = 0; i < message.shareMCTeams.length; ++i)
          $root.Records.ShareTeam.encode(
            message.shareMCTeams[i],
            writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
          ).ldelim();
      if (message.shareMCEnterpriseUsers != null && message.shareMCEnterpriseUsers.length)
        for (let i = 0; i < message.shareMCEnterpriseUsers.length; ++i)
          $root.Records.ShareUser.encode(
            message.shareMCEnterpriseUsers[i],
            writer.uint32(/* id 6, wireType 2 =*/ 50).fork(),
          ).ldelim();
      if (message.shareEnterpriseNames != null && message.shareEnterpriseNames.length)
        for (let i = 0; i < message.shareEnterpriseNames.length; ++i)
          $root.Records.ShareEnterprise.encode(
            message.shareEnterpriseNames[i],
            writer.uint32(/* id 7, wireType 2 =*/ 58).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GetShareObjectsResponse message, length delimited. Does not implicitly {@link Records.GetShareObjectsResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Records.IGetShareObjectsResponse} message GetShareObjectsResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetShareObjectsResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GetShareObjectsResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.GetShareObjectsResponse} GetShareObjectsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetShareObjectsResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.GetShareObjectsResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.shareRelationships && message.shareRelationships.length))
              message.shareRelationships = [];
            message.shareRelationships.push(
              $root.Records.ShareUser.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.shareFamilyUsers && message.shareFamilyUsers.length))
              message.shareFamilyUsers = [];
            message.shareFamilyUsers.push($root.Records.ShareUser.decode(reader, reader.uint32()));
            break;
          }
          case 3: {
            if (!(message.shareEnterpriseUsers && message.shareEnterpriseUsers.length))
              message.shareEnterpriseUsers = [];
            message.shareEnterpriseUsers.push(
              $root.Records.ShareUser.decode(reader, reader.uint32()),
            );
            break;
          }
          case 4: {
            if (!(message.shareTeams && message.shareTeams.length)) message.shareTeams = [];
            message.shareTeams.push($root.Records.ShareTeam.decode(reader, reader.uint32()));
            break;
          }
          case 5: {
            if (!(message.shareMCTeams && message.shareMCTeams.length)) message.shareMCTeams = [];
            message.shareMCTeams.push($root.Records.ShareTeam.decode(reader, reader.uint32()));
            break;
          }
          case 6: {
            if (!(message.shareMCEnterpriseUsers && message.shareMCEnterpriseUsers.length))
              message.shareMCEnterpriseUsers = [];
            message.shareMCEnterpriseUsers.push(
              $root.Records.ShareUser.decode(reader, reader.uint32()),
            );
            break;
          }
          case 7: {
            if (!(message.shareEnterpriseNames && message.shareEnterpriseNames.length))
              message.shareEnterpriseNames = [];
            message.shareEnterpriseNames.push(
              $root.Records.ShareEnterprise.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a GetShareObjectsResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.GetShareObjectsResponse} GetShareObjectsResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetShareObjectsResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetShareObjectsResponse message.
     * @function verify
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetShareObjectsResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.shareRelationships != null && message.hasOwnProperty("shareRelationships")) {
        if (!Array.isArray(message.shareRelationships)) return "shareRelationships: array expected";
        for (let i = 0; i < message.shareRelationships.length; ++i) {
          let error = $root.Records.ShareUser.verify(message.shareRelationships[i]);
          if (error) return "shareRelationships." + error;
        }
      }
      if (message.shareFamilyUsers != null && message.hasOwnProperty("shareFamilyUsers")) {
        if (!Array.isArray(message.shareFamilyUsers)) return "shareFamilyUsers: array expected";
        for (let i = 0; i < message.shareFamilyUsers.length; ++i) {
          let error = $root.Records.ShareUser.verify(message.shareFamilyUsers[i]);
          if (error) return "shareFamilyUsers." + error;
        }
      }
      if (message.shareEnterpriseUsers != null && message.hasOwnProperty("shareEnterpriseUsers")) {
        if (!Array.isArray(message.shareEnterpriseUsers))
          return "shareEnterpriseUsers: array expected";
        for (let i = 0; i < message.shareEnterpriseUsers.length; ++i) {
          let error = $root.Records.ShareUser.verify(message.shareEnterpriseUsers[i]);
          if (error) return "shareEnterpriseUsers." + error;
        }
      }
      if (message.shareTeams != null && message.hasOwnProperty("shareTeams")) {
        if (!Array.isArray(message.shareTeams)) return "shareTeams: array expected";
        for (let i = 0; i < message.shareTeams.length; ++i) {
          let error = $root.Records.ShareTeam.verify(message.shareTeams[i]);
          if (error) return "shareTeams." + error;
        }
      }
      if (message.shareMCTeams != null && message.hasOwnProperty("shareMCTeams")) {
        if (!Array.isArray(message.shareMCTeams)) return "shareMCTeams: array expected";
        for (let i = 0; i < message.shareMCTeams.length; ++i) {
          let error = $root.Records.ShareTeam.verify(message.shareMCTeams[i]);
          if (error) return "shareMCTeams." + error;
        }
      }
      if (
        message.shareMCEnterpriseUsers != null &&
        message.hasOwnProperty("shareMCEnterpriseUsers")
      ) {
        if (!Array.isArray(message.shareMCEnterpriseUsers))
          return "shareMCEnterpriseUsers: array expected";
        for (let i = 0; i < message.shareMCEnterpriseUsers.length; ++i) {
          let error = $root.Records.ShareUser.verify(message.shareMCEnterpriseUsers[i]);
          if (error) return "shareMCEnterpriseUsers." + error;
        }
      }
      if (message.shareEnterpriseNames != null && message.hasOwnProperty("shareEnterpriseNames")) {
        if (!Array.isArray(message.shareEnterpriseNames))
          return "shareEnterpriseNames: array expected";
        for (let i = 0; i < message.shareEnterpriseNames.length; ++i) {
          let error = $root.Records.ShareEnterprise.verify(message.shareEnterpriseNames[i]);
          if (error) return "shareEnterpriseNames." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GetShareObjectsResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.GetShareObjectsResponse} GetShareObjectsResponse
     */
    GetShareObjectsResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.GetShareObjectsResponse) return object;
      let message = new $root.Records.GetShareObjectsResponse();
      if (object.shareRelationships) {
        if (!Array.isArray(object.shareRelationships))
          throw TypeError(".Records.GetShareObjectsResponse.shareRelationships: array expected");
        message.shareRelationships = [];
        for (let i = 0; i < object.shareRelationships.length; ++i) {
          if (typeof object.shareRelationships[i] !== "object")
            throw TypeError(".Records.GetShareObjectsResponse.shareRelationships: object expected");
          message.shareRelationships[i] = $root.Records.ShareUser.fromObject(
            object.shareRelationships[i],
          );
        }
      }
      if (object.shareFamilyUsers) {
        if (!Array.isArray(object.shareFamilyUsers))
          throw TypeError(".Records.GetShareObjectsResponse.shareFamilyUsers: array expected");
        message.shareFamilyUsers = [];
        for (let i = 0; i < object.shareFamilyUsers.length; ++i) {
          if (typeof object.shareFamilyUsers[i] !== "object")
            throw TypeError(".Records.GetShareObjectsResponse.shareFamilyUsers: object expected");
          message.shareFamilyUsers[i] = $root.Records.ShareUser.fromObject(
            object.shareFamilyUsers[i],
          );
        }
      }
      if (object.shareEnterpriseUsers) {
        if (!Array.isArray(object.shareEnterpriseUsers))
          throw TypeError(".Records.GetShareObjectsResponse.shareEnterpriseUsers: array expected");
        message.shareEnterpriseUsers = [];
        for (let i = 0; i < object.shareEnterpriseUsers.length; ++i) {
          if (typeof object.shareEnterpriseUsers[i] !== "object")
            throw TypeError(
              ".Records.GetShareObjectsResponse.shareEnterpriseUsers: object expected",
            );
          message.shareEnterpriseUsers[i] = $root.Records.ShareUser.fromObject(
            object.shareEnterpriseUsers[i],
          );
        }
      }
      if (object.shareTeams) {
        if (!Array.isArray(object.shareTeams))
          throw TypeError(".Records.GetShareObjectsResponse.shareTeams: array expected");
        message.shareTeams = [];
        for (let i = 0; i < object.shareTeams.length; ++i) {
          if (typeof object.shareTeams[i] !== "object")
            throw TypeError(".Records.GetShareObjectsResponse.shareTeams: object expected");
          message.shareTeams[i] = $root.Records.ShareTeam.fromObject(object.shareTeams[i]);
        }
      }
      if (object.shareMCTeams) {
        if (!Array.isArray(object.shareMCTeams))
          throw TypeError(".Records.GetShareObjectsResponse.shareMCTeams: array expected");
        message.shareMCTeams = [];
        for (let i = 0; i < object.shareMCTeams.length; ++i) {
          if (typeof object.shareMCTeams[i] !== "object")
            throw TypeError(".Records.GetShareObjectsResponse.shareMCTeams: object expected");
          message.shareMCTeams[i] = $root.Records.ShareTeam.fromObject(object.shareMCTeams[i]);
        }
      }
      if (object.shareMCEnterpriseUsers) {
        if (!Array.isArray(object.shareMCEnterpriseUsers))
          throw TypeError(
            ".Records.GetShareObjectsResponse.shareMCEnterpriseUsers: array expected",
          );
        message.shareMCEnterpriseUsers = [];
        for (let i = 0; i < object.shareMCEnterpriseUsers.length; ++i) {
          if (typeof object.shareMCEnterpriseUsers[i] !== "object")
            throw TypeError(
              ".Records.GetShareObjectsResponse.shareMCEnterpriseUsers: object expected",
            );
          message.shareMCEnterpriseUsers[i] = $root.Records.ShareUser.fromObject(
            object.shareMCEnterpriseUsers[i],
          );
        }
      }
      if (object.shareEnterpriseNames) {
        if (!Array.isArray(object.shareEnterpriseNames))
          throw TypeError(".Records.GetShareObjectsResponse.shareEnterpriseNames: array expected");
        message.shareEnterpriseNames = [];
        for (let i = 0; i < object.shareEnterpriseNames.length; ++i) {
          if (typeof object.shareEnterpriseNames[i] !== "object")
            throw TypeError(
              ".Records.GetShareObjectsResponse.shareEnterpriseNames: object expected",
            );
          message.shareEnterpriseNames[i] = $root.Records.ShareEnterprise.fromObject(
            object.shareEnterpriseNames[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GetShareObjectsResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {Records.GetShareObjectsResponse} message GetShareObjectsResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetShareObjectsResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.shareRelationships = [];
        object.shareFamilyUsers = [];
        object.shareEnterpriseUsers = [];
        object.shareTeams = [];
        object.shareMCTeams = [];
        object.shareMCEnterpriseUsers = [];
        object.shareEnterpriseNames = [];
      }
      if (message.shareRelationships && message.shareRelationships.length) {
        object.shareRelationships = [];
        for (let j = 0; j < message.shareRelationships.length; ++j)
          object.shareRelationships[j] = $root.Records.ShareUser.toObject(
            message.shareRelationships[j],
            options,
          );
      }
      if (message.shareFamilyUsers && message.shareFamilyUsers.length) {
        object.shareFamilyUsers = [];
        for (let j = 0; j < message.shareFamilyUsers.length; ++j)
          object.shareFamilyUsers[j] = $root.Records.ShareUser.toObject(
            message.shareFamilyUsers[j],
            options,
          );
      }
      if (message.shareEnterpriseUsers && message.shareEnterpriseUsers.length) {
        object.shareEnterpriseUsers = [];
        for (let j = 0; j < message.shareEnterpriseUsers.length; ++j)
          object.shareEnterpriseUsers[j] = $root.Records.ShareUser.toObject(
            message.shareEnterpriseUsers[j],
            options,
          );
      }
      if (message.shareTeams && message.shareTeams.length) {
        object.shareTeams = [];
        for (let j = 0; j < message.shareTeams.length; ++j)
          object.shareTeams[j] = $root.Records.ShareTeam.toObject(message.shareTeams[j], options);
      }
      if (message.shareMCTeams && message.shareMCTeams.length) {
        object.shareMCTeams = [];
        for (let j = 0; j < message.shareMCTeams.length; ++j)
          object.shareMCTeams[j] = $root.Records.ShareTeam.toObject(
            message.shareMCTeams[j],
            options,
          );
      }
      if (message.shareMCEnterpriseUsers && message.shareMCEnterpriseUsers.length) {
        object.shareMCEnterpriseUsers = [];
        for (let j = 0; j < message.shareMCEnterpriseUsers.length; ++j)
          object.shareMCEnterpriseUsers[j] = $root.Records.ShareUser.toObject(
            message.shareMCEnterpriseUsers[j],
            options,
          );
      }
      if (message.shareEnterpriseNames && message.shareEnterpriseNames.length) {
        object.shareEnterpriseNames = [];
        for (let j = 0; j < message.shareEnterpriseNames.length; ++j)
          object.shareEnterpriseNames[j] = $root.Records.ShareEnterprise.toObject(
            message.shareEnterpriseNames[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this GetShareObjectsResponse to JSON.
     * @function toJSON
     * @memberof Records.GetShareObjectsResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetShareObjectsResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GetShareObjectsResponse
     * @function getTypeUrl
     * @memberof Records.GetShareObjectsResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GetShareObjectsResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.GetShareObjectsResponse";
    };

    return GetShareObjectsResponse;
  })();

  Records.ShareUser = (function () {
    /**
     * Properties of a ShareUser.
     * @memberof Records
     * @interface IShareUser
     * @property {string|null} [username] ShareUser username
     * @property {string|null} [fullname] ShareUser fullname
     * @property {number|null} [enterpriseId] ShareUser enterpriseId
     * @property {Records.ShareStatus|null} [status] ShareUser status
     * @property {boolean|null} [isShareAdmin] ShareUser isShareAdmin
     * @property {boolean|null} [isAdminOfSharedFolderOwner] ShareUser isAdminOfSharedFolderOwner
     */

    /**
     * Constructs a new ShareUser.
     * @memberof Records
     * @classdesc Represents a ShareUser.
     * @implements IShareUser
     * @constructor
     * @param {Records.IShareUser=} [properties] Properties to set
     */
    function ShareUser(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ShareUser username.
     * @member {string} username
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.username = "";

    /**
     * ShareUser fullname.
     * @member {string} fullname
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.fullname = "";

    /**
     * ShareUser enterpriseId.
     * @member {number} enterpriseId
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.enterpriseId = 0;

    /**
     * ShareUser status.
     * @member {Records.ShareStatus} status
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.status = 0;

    /**
     * ShareUser isShareAdmin.
     * @member {boolean} isShareAdmin
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.isShareAdmin = false;

    /**
     * ShareUser isAdminOfSharedFolderOwner.
     * @member {boolean} isAdminOfSharedFolderOwner
     * @memberof Records.ShareUser
     * @instance
     */
    ShareUser.prototype.isAdminOfSharedFolderOwner = false;

    /**
     * Creates a new ShareUser instance using the specified properties.
     * @function create
     * @memberof Records.ShareUser
     * @static
     * @param {Records.IShareUser=} [properties] Properties to set
     * @returns {Records.ShareUser} ShareUser instance
     */
    ShareUser.create = function create(properties) {
      return new ShareUser(properties);
    };

    /**
     * Encodes the specified ShareUser message. Does not implicitly {@link Records.ShareUser.verify|verify} messages.
     * @function encode
     * @memberof Records.ShareUser
     * @static
     * @param {Records.IShareUser} message ShareUser message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareUser.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.username != null && Object.hasOwnProperty.call(message, "username"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.username);
      if (message.fullname != null && Object.hasOwnProperty.call(message, "fullname"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.fullname);
      if (message.enterpriseId != null && Object.hasOwnProperty.call(message, "enterpriseId"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.enterpriseId);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.status);
      if (message.isShareAdmin != null && Object.hasOwnProperty.call(message, "isShareAdmin"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).bool(message.isShareAdmin);
      if (
        message.isAdminOfSharedFolderOwner != null &&
        Object.hasOwnProperty.call(message, "isAdminOfSharedFolderOwner")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).bool(message.isAdminOfSharedFolderOwner);
      return writer;
    };

    /**
     * Encodes the specified ShareUser message, length delimited. Does not implicitly {@link Records.ShareUser.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.ShareUser
     * @static
     * @param {Records.IShareUser} message ShareUser message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareUser.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ShareUser message from the specified reader or buffer.
     * @function decode
     * @memberof Records.ShareUser
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.ShareUser} ShareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareUser.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.ShareUser();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.username = reader.string();
            break;
          }
          case 2: {
            message.fullname = reader.string();
            break;
          }
          case 3: {
            message.enterpriseId = reader.int32();
            break;
          }
          case 4: {
            message.status = reader.int32();
            break;
          }
          case 5: {
            message.isShareAdmin = reader.bool();
            break;
          }
          case 6: {
            message.isAdminOfSharedFolderOwner = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a ShareUser message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.ShareUser
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.ShareUser} ShareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareUser.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ShareUser message.
     * @function verify
     * @memberof Records.ShareUser
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ShareUser.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.username != null && message.hasOwnProperty("username"))
        if (!$util.isString(message.username)) return "username: string expected";
      if (message.fullname != null && message.hasOwnProperty("fullname"))
        if (!$util.isString(message.fullname)) return "fullname: string expected";
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        if (!$util.isInteger(message.enterpriseId)) return "enterpriseId: integer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.isShareAdmin != null && message.hasOwnProperty("isShareAdmin"))
        if (typeof message.isShareAdmin !== "boolean") return "isShareAdmin: boolean expected";
      if (
        message.isAdminOfSharedFolderOwner != null &&
        message.hasOwnProperty("isAdminOfSharedFolderOwner")
      )
        if (typeof message.isAdminOfSharedFolderOwner !== "boolean")
          return "isAdminOfSharedFolderOwner: boolean expected";
      return null;
    };

    /**
     * Creates a ShareUser message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.ShareUser
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.ShareUser} ShareUser
     */
    ShareUser.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.ShareUser) return object;
      let message = new $root.Records.ShareUser();
      if (object.username != null) message.username = String(object.username);
      if (object.fullname != null) message.fullname = String(object.fullname);
      if (object.enterpriseId != null) message.enterpriseId = object.enterpriseId | 0;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "ACTIVE":
        case 0:
          message.status = 0;
          break;
        case "BLOCK":
        case 1:
          message.status = 1;
          break;
        case "INVITED":
        case 2:
          message.status = 2;
          break;
      }
      if (object.isShareAdmin != null) message.isShareAdmin = Boolean(object.isShareAdmin);
      if (object.isAdminOfSharedFolderOwner != null)
        message.isAdminOfSharedFolderOwner = Boolean(object.isAdminOfSharedFolderOwner);
      return message;
    };

    /**
     * Creates a plain object from a ShareUser message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.ShareUser
     * @static
     * @param {Records.ShareUser} message ShareUser
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ShareUser.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.username = "";
        object.fullname = "";
        object.enterpriseId = 0;
        object.status = options.enums === String ? "ACTIVE" : 0;
        object.isShareAdmin = false;
        object.isAdminOfSharedFolderOwner = false;
      }
      if (message.username != null && message.hasOwnProperty("username"))
        object.username = message.username;
      if (message.fullname != null && message.hasOwnProperty("fullname"))
        object.fullname = message.fullname;
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        object.enterpriseId = message.enterpriseId;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.Records.ShareStatus[message.status] === undefined
              ? message.status
              : $root.Records.ShareStatus[message.status]
            : message.status;
      if (message.isShareAdmin != null && message.hasOwnProperty("isShareAdmin"))
        object.isShareAdmin = message.isShareAdmin;
      if (
        message.isAdminOfSharedFolderOwner != null &&
        message.hasOwnProperty("isAdminOfSharedFolderOwner")
      )
        object.isAdminOfSharedFolderOwner = message.isAdminOfSharedFolderOwner;
      return object;
    };

    /**
     * Converts this ShareUser to JSON.
     * @function toJSON
     * @memberof Records.ShareUser
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ShareUser.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ShareUser
     * @function getTypeUrl
     * @memberof Records.ShareUser
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ShareUser.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.ShareUser";
    };

    return ShareUser;
  })();

  Records.ShareTeam = (function () {
    /**
     * Properties of a ShareTeam.
     * @memberof Records
     * @interface IShareTeam
     * @property {string|null} [teamname] ShareTeam teamname
     * @property {number|null} [enterpriseId] ShareTeam enterpriseId
     * @property {Uint8Array|null} [teamUid] ShareTeam teamUid
     */

    /**
     * Constructs a new ShareTeam.
     * @memberof Records
     * @classdesc Represents a ShareTeam.
     * @implements IShareTeam
     * @constructor
     * @param {Records.IShareTeam=} [properties] Properties to set
     */
    function ShareTeam(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ShareTeam teamname.
     * @member {string} teamname
     * @memberof Records.ShareTeam
     * @instance
     */
    ShareTeam.prototype.teamname = "";

    /**
     * ShareTeam enterpriseId.
     * @member {number} enterpriseId
     * @memberof Records.ShareTeam
     * @instance
     */
    ShareTeam.prototype.enterpriseId = 0;

    /**
     * ShareTeam teamUid.
     * @member {Uint8Array} teamUid
     * @memberof Records.ShareTeam
     * @instance
     */
    ShareTeam.prototype.teamUid = $util.newBuffer([]);

    /**
     * Creates a new ShareTeam instance using the specified properties.
     * @function create
     * @memberof Records.ShareTeam
     * @static
     * @param {Records.IShareTeam=} [properties] Properties to set
     * @returns {Records.ShareTeam} ShareTeam instance
     */
    ShareTeam.create = function create(properties) {
      return new ShareTeam(properties);
    };

    /**
     * Encodes the specified ShareTeam message. Does not implicitly {@link Records.ShareTeam.verify|verify} messages.
     * @function encode
     * @memberof Records.ShareTeam
     * @static
     * @param {Records.IShareTeam} message ShareTeam message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareTeam.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.teamname != null && Object.hasOwnProperty.call(message, "teamname"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.teamname);
      if (message.enterpriseId != null && Object.hasOwnProperty.call(message, "enterpriseId"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.enterpriseId);
      if (message.teamUid != null && Object.hasOwnProperty.call(message, "teamUid"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.teamUid);
      return writer;
    };

    /**
     * Encodes the specified ShareTeam message, length delimited. Does not implicitly {@link Records.ShareTeam.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.ShareTeam
     * @static
     * @param {Records.IShareTeam} message ShareTeam message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareTeam.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ShareTeam message from the specified reader or buffer.
     * @function decode
     * @memberof Records.ShareTeam
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.ShareTeam} ShareTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareTeam.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.ShareTeam();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.teamname = reader.string();
            break;
          }
          case 2: {
            message.enterpriseId = reader.int32();
            break;
          }
          case 3: {
            message.teamUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a ShareTeam message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.ShareTeam
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.ShareTeam} ShareTeam
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareTeam.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ShareTeam message.
     * @function verify
     * @memberof Records.ShareTeam
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ShareTeam.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.teamname != null && message.hasOwnProperty("teamname"))
        if (!$util.isString(message.teamname)) return "teamname: string expected";
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        if (!$util.isInteger(message.enterpriseId)) return "enterpriseId: integer expected";
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        if (
          !(
            (message.teamUid && typeof message.teamUid.length === "number") ||
            $util.isString(message.teamUid)
          )
        )
          return "teamUid: buffer expected";
      return null;
    };

    /**
     * Creates a ShareTeam message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.ShareTeam
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.ShareTeam} ShareTeam
     */
    ShareTeam.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.ShareTeam) return object;
      let message = new $root.Records.ShareTeam();
      if (object.teamname != null) message.teamname = String(object.teamname);
      if (object.enterpriseId != null) message.enterpriseId = object.enterpriseId | 0;
      if (object.teamUid != null)
        if (typeof object.teamUid === "string")
          $util.base64.decode(
            object.teamUid,
            (message.teamUid = $util.newBuffer($util.base64.length(object.teamUid))),
            0,
          );
        else if (object.teamUid.length >= 0) message.teamUid = object.teamUid;
      return message;
    };

    /**
     * Creates a plain object from a ShareTeam message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.ShareTeam
     * @static
     * @param {Records.ShareTeam} message ShareTeam
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ShareTeam.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.teamname = "";
        object.enterpriseId = 0;
        if (options.bytes === String) object.teamUid = "";
        else {
          object.teamUid = [];
          if (options.bytes !== Array) object.teamUid = $util.newBuffer(object.teamUid);
        }
      }
      if (message.teamname != null && message.hasOwnProperty("teamname"))
        object.teamname = message.teamname;
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        object.enterpriseId = message.enterpriseId;
      if (message.teamUid != null && message.hasOwnProperty("teamUid"))
        object.teamUid =
          options.bytes === String
            ? $util.base64.encode(message.teamUid, 0, message.teamUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.teamUid)
              : message.teamUid;
      return object;
    };

    /**
     * Converts this ShareTeam to JSON.
     * @function toJSON
     * @memberof Records.ShareTeam
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ShareTeam.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ShareTeam
     * @function getTypeUrl
     * @memberof Records.ShareTeam
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ShareTeam.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.ShareTeam";
    };

    return ShareTeam;
  })();

  Records.ShareEnterprise = (function () {
    /**
     * Properties of a ShareEnterprise.
     * @memberof Records
     * @interface IShareEnterprise
     * @property {string|null} [enterprisename] ShareEnterprise enterprisename
     * @property {number|null} [enterpriseId] ShareEnterprise enterpriseId
     */

    /**
     * Constructs a new ShareEnterprise.
     * @memberof Records
     * @classdesc Represents a ShareEnterprise.
     * @implements IShareEnterprise
     * @constructor
     * @param {Records.IShareEnterprise=} [properties] Properties to set
     */
    function ShareEnterprise(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ShareEnterprise enterprisename.
     * @member {string} enterprisename
     * @memberof Records.ShareEnterprise
     * @instance
     */
    ShareEnterprise.prototype.enterprisename = "";

    /**
     * ShareEnterprise enterpriseId.
     * @member {number} enterpriseId
     * @memberof Records.ShareEnterprise
     * @instance
     */
    ShareEnterprise.prototype.enterpriseId = 0;

    /**
     * Creates a new ShareEnterprise instance using the specified properties.
     * @function create
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Records.IShareEnterprise=} [properties] Properties to set
     * @returns {Records.ShareEnterprise} ShareEnterprise instance
     */
    ShareEnterprise.create = function create(properties) {
      return new ShareEnterprise(properties);
    };

    /**
     * Encodes the specified ShareEnterprise message. Does not implicitly {@link Records.ShareEnterprise.verify|verify} messages.
     * @function encode
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Records.IShareEnterprise} message ShareEnterprise message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareEnterprise.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.enterprisename != null && Object.hasOwnProperty.call(message, "enterprisename"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.enterprisename);
      if (message.enterpriseId != null && Object.hasOwnProperty.call(message, "enterpriseId"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.enterpriseId);
      return writer;
    };

    /**
     * Encodes the specified ShareEnterprise message, length delimited. Does not implicitly {@link Records.ShareEnterprise.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Records.IShareEnterprise} message ShareEnterprise message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShareEnterprise.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ShareEnterprise message from the specified reader or buffer.
     * @function decode
     * @memberof Records.ShareEnterprise
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.ShareEnterprise} ShareEnterprise
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareEnterprise.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.ShareEnterprise();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.enterprisename = reader.string();
            break;
          }
          case 2: {
            message.enterpriseId = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a ShareEnterprise message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.ShareEnterprise
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.ShareEnterprise} ShareEnterprise
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShareEnterprise.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ShareEnterprise message.
     * @function verify
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ShareEnterprise.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.enterprisename != null && message.hasOwnProperty("enterprisename"))
        if (!$util.isString(message.enterprisename)) return "enterprisename: string expected";
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        if (!$util.isInteger(message.enterpriseId)) return "enterpriseId: integer expected";
      return null;
    };

    /**
     * Creates a ShareEnterprise message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.ShareEnterprise} ShareEnterprise
     */
    ShareEnterprise.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.ShareEnterprise) return object;
      let message = new $root.Records.ShareEnterprise();
      if (object.enterprisename != null) message.enterprisename = String(object.enterprisename);
      if (object.enterpriseId != null) message.enterpriseId = object.enterpriseId | 0;
      return message;
    };

    /**
     * Creates a plain object from a ShareEnterprise message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.ShareEnterprise
     * @static
     * @param {Records.ShareEnterprise} message ShareEnterprise
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ShareEnterprise.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.enterprisename = "";
        object.enterpriseId = 0;
      }
      if (message.enterprisename != null && message.hasOwnProperty("enterprisename"))
        object.enterprisename = message.enterprisename;
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        object.enterpriseId = message.enterpriseId;
      return object;
    };

    /**
     * Converts this ShareEnterprise to JSON.
     * @function toJSON
     * @memberof Records.ShareEnterprise
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ShareEnterprise.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ShareEnterprise
     * @function getTypeUrl
     * @memberof Records.ShareEnterprise
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ShareEnterprise.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.ShareEnterprise";
    };

    return ShareEnterprise;
  })();

  Records.RecordsOnwershipTransferRequest = (function () {
    /**
     * Properties of a RecordsOnwershipTransferRequest.
     * @memberof Records
     * @interface IRecordsOnwershipTransferRequest
     * @property {Array.<Records.ITransferRecord>|null} [transferRecords] RecordsOnwershipTransferRequest transferRecords
     */

    /**
     * Constructs a new RecordsOnwershipTransferRequest.
     * @memberof Records
     * @classdesc Represents a RecordsOnwershipTransferRequest.
     * @implements IRecordsOnwershipTransferRequest
     * @constructor
     * @param {Records.IRecordsOnwershipTransferRequest=} [properties] Properties to set
     */
    function RecordsOnwershipTransferRequest(properties) {
      this.transferRecords = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsOnwershipTransferRequest transferRecords.
     * @member {Array.<Records.ITransferRecord>} transferRecords
     * @memberof Records.RecordsOnwershipTransferRequest
     * @instance
     */
    RecordsOnwershipTransferRequest.prototype.transferRecords = $util.emptyArray;

    /**
     * Creates a new RecordsOnwershipTransferRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Records.IRecordsOnwershipTransferRequest=} [properties] Properties to set
     * @returns {Records.RecordsOnwershipTransferRequest} RecordsOnwershipTransferRequest instance
     */
    RecordsOnwershipTransferRequest.create = function create(properties) {
      return new RecordsOnwershipTransferRequest(properties);
    };

    /**
     * Encodes the specified RecordsOnwershipTransferRequest message. Does not implicitly {@link Records.RecordsOnwershipTransferRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Records.IRecordsOnwershipTransferRequest} message RecordsOnwershipTransferRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsOnwershipTransferRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.transferRecords != null && message.transferRecords.length)
        for (let i = 0; i < message.transferRecords.length; ++i)
          $root.Records.TransferRecord.encode(
            message.transferRecords[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsOnwershipTransferRequest message, length delimited. Does not implicitly {@link Records.RecordsOnwershipTransferRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Records.IRecordsOnwershipTransferRequest} message RecordsOnwershipTransferRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsOnwershipTransferRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsOnwershipTransferRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsOnwershipTransferRequest} RecordsOnwershipTransferRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsOnwershipTransferRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsOnwershipTransferRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.transferRecords && message.transferRecords.length))
              message.transferRecords = [];
            message.transferRecords.push(
              $root.Records.TransferRecord.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsOnwershipTransferRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsOnwershipTransferRequest} RecordsOnwershipTransferRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsOnwershipTransferRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsOnwershipTransferRequest message.
     * @function verify
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsOnwershipTransferRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.transferRecords != null && message.hasOwnProperty("transferRecords")) {
        if (!Array.isArray(message.transferRecords)) return "transferRecords: array expected";
        for (let i = 0; i < message.transferRecords.length; ++i) {
          let error = $root.Records.TransferRecord.verify(message.transferRecords[i]);
          if (error) return "transferRecords." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsOnwershipTransferRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsOnwershipTransferRequest} RecordsOnwershipTransferRequest
     */
    RecordsOnwershipTransferRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsOnwershipTransferRequest) return object;
      let message = new $root.Records.RecordsOnwershipTransferRequest();
      if (object.transferRecords) {
        if (!Array.isArray(object.transferRecords))
          throw TypeError(
            ".Records.RecordsOnwershipTransferRequest.transferRecords: array expected",
          );
        message.transferRecords = [];
        for (let i = 0; i < object.transferRecords.length; ++i) {
          if (typeof object.transferRecords[i] !== "object")
            throw TypeError(
              ".Records.RecordsOnwershipTransferRequest.transferRecords: object expected",
            );
          message.transferRecords[i] = $root.Records.TransferRecord.fromObject(
            object.transferRecords[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsOnwershipTransferRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {Records.RecordsOnwershipTransferRequest} message RecordsOnwershipTransferRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsOnwershipTransferRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.transferRecords = [];
      if (message.transferRecords && message.transferRecords.length) {
        object.transferRecords = [];
        for (let j = 0; j < message.transferRecords.length; ++j)
          object.transferRecords[j] = $root.Records.TransferRecord.toObject(
            message.transferRecords[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordsOnwershipTransferRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsOnwershipTransferRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsOnwershipTransferRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsOnwershipTransferRequest
     * @function getTypeUrl
     * @memberof Records.RecordsOnwershipTransferRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsOnwershipTransferRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsOnwershipTransferRequest";
    };

    return RecordsOnwershipTransferRequest;
  })();

  Records.TransferRecord = (function () {
    /**
     * Properties of a TransferRecord.
     * @memberof Records
     * @interface ITransferRecord
     * @property {string|null} [username] TransferRecord username
     * @property {Uint8Array|null} [recordUid] TransferRecord recordUid
     * @property {Uint8Array|null} [recordKey] TransferRecord recordKey
     * @property {boolean|null} [useEccKey] TransferRecord useEccKey
     */

    /**
     * Constructs a new TransferRecord.
     * @memberof Records
     * @classdesc Represents a TransferRecord.
     * @implements ITransferRecord
     * @constructor
     * @param {Records.ITransferRecord=} [properties] Properties to set
     */
    function TransferRecord(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TransferRecord username.
     * @member {string} username
     * @memberof Records.TransferRecord
     * @instance
     */
    TransferRecord.prototype.username = "";

    /**
     * TransferRecord recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.TransferRecord
     * @instance
     */
    TransferRecord.prototype.recordUid = $util.newBuffer([]);

    /**
     * TransferRecord recordKey.
     * @member {Uint8Array} recordKey
     * @memberof Records.TransferRecord
     * @instance
     */
    TransferRecord.prototype.recordKey = $util.newBuffer([]);

    /**
     * TransferRecord useEccKey.
     * @member {boolean} useEccKey
     * @memberof Records.TransferRecord
     * @instance
     */
    TransferRecord.prototype.useEccKey = false;

    /**
     * Creates a new TransferRecord instance using the specified properties.
     * @function create
     * @memberof Records.TransferRecord
     * @static
     * @param {Records.ITransferRecord=} [properties] Properties to set
     * @returns {Records.TransferRecord} TransferRecord instance
     */
    TransferRecord.create = function create(properties) {
      return new TransferRecord(properties);
    };

    /**
     * Encodes the specified TransferRecord message. Does not implicitly {@link Records.TransferRecord.verify|verify} messages.
     * @function encode
     * @memberof Records.TransferRecord
     * @static
     * @param {Records.ITransferRecord} message TransferRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TransferRecord.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.username != null && Object.hasOwnProperty.call(message, "username"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.username);
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordUid);
      if (message.recordKey != null && Object.hasOwnProperty.call(message, "recordKey"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.recordKey);
      if (message.useEccKey != null && Object.hasOwnProperty.call(message, "useEccKey"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.useEccKey);
      return writer;
    };

    /**
     * Encodes the specified TransferRecord message, length delimited. Does not implicitly {@link Records.TransferRecord.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TransferRecord
     * @static
     * @param {Records.ITransferRecord} message TransferRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TransferRecord.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TransferRecord message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TransferRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TransferRecord} TransferRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TransferRecord.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TransferRecord();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.username = reader.string();
            break;
          }
          case 2: {
            message.recordUid = reader.bytes();
            break;
          }
          case 3: {
            message.recordKey = reader.bytes();
            break;
          }
          case 4: {
            message.useEccKey = reader.bool();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TransferRecord message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TransferRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TransferRecord} TransferRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TransferRecord.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TransferRecord message.
     * @function verify
     * @memberof Records.TransferRecord
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TransferRecord.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.username != null && message.hasOwnProperty("username"))
        if (!$util.isString(message.username)) return "username: string expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        if (
          !(
            (message.recordKey && typeof message.recordKey.length === "number") ||
            $util.isString(message.recordKey)
          )
        )
          return "recordKey: buffer expected";
      if (message.useEccKey != null && message.hasOwnProperty("useEccKey"))
        if (typeof message.useEccKey !== "boolean") return "useEccKey: boolean expected";
      return null;
    };

    /**
     * Creates a TransferRecord message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TransferRecord
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TransferRecord} TransferRecord
     */
    TransferRecord.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TransferRecord) return object;
      let message = new $root.Records.TransferRecord();
      if (object.username != null) message.username = String(object.username);
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.recordKey != null)
        if (typeof object.recordKey === "string")
          $util.base64.decode(
            object.recordKey,
            (message.recordKey = $util.newBuffer($util.base64.length(object.recordKey))),
            0,
          );
        else if (object.recordKey.length >= 0) message.recordKey = object.recordKey;
      if (object.useEccKey != null) message.useEccKey = Boolean(object.useEccKey);
      return message;
    };

    /**
     * Creates a plain object from a TransferRecord message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TransferRecord
     * @static
     * @param {Records.TransferRecord} message TransferRecord
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TransferRecord.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.username = "";
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.recordKey = "";
        else {
          object.recordKey = [];
          if (options.bytes !== Array) object.recordKey = $util.newBuffer(object.recordKey);
        }
        object.useEccKey = false;
      }
      if (message.username != null && message.hasOwnProperty("username"))
        object.username = message.username;
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.recordKey != null && message.hasOwnProperty("recordKey"))
        object.recordKey =
          options.bytes === String
            ? $util.base64.encode(message.recordKey, 0, message.recordKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordKey)
              : message.recordKey;
      if (message.useEccKey != null && message.hasOwnProperty("useEccKey"))
        object.useEccKey = message.useEccKey;
      return object;
    };

    /**
     * Converts this TransferRecord to JSON.
     * @function toJSON
     * @memberof Records.TransferRecord
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TransferRecord.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TransferRecord
     * @function getTypeUrl
     * @memberof Records.TransferRecord
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TransferRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TransferRecord";
    };

    return TransferRecord;
  })();

  Records.RecordsOnwershipTransferResponse = (function () {
    /**
     * Properties of a RecordsOnwershipTransferResponse.
     * @memberof Records
     * @interface IRecordsOnwershipTransferResponse
     * @property {Array.<Records.ITransferRecordStatus>|null} [transferRecordStatus] RecordsOnwershipTransferResponse transferRecordStatus
     */

    /**
     * Constructs a new RecordsOnwershipTransferResponse.
     * @memberof Records
     * @classdesc Represents a RecordsOnwershipTransferResponse.
     * @implements IRecordsOnwershipTransferResponse
     * @constructor
     * @param {Records.IRecordsOnwershipTransferResponse=} [properties] Properties to set
     */
    function RecordsOnwershipTransferResponse(properties) {
      this.transferRecordStatus = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsOnwershipTransferResponse transferRecordStatus.
     * @member {Array.<Records.ITransferRecordStatus>} transferRecordStatus
     * @memberof Records.RecordsOnwershipTransferResponse
     * @instance
     */
    RecordsOnwershipTransferResponse.prototype.transferRecordStatus = $util.emptyArray;

    /**
     * Creates a new RecordsOnwershipTransferResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Records.IRecordsOnwershipTransferResponse=} [properties] Properties to set
     * @returns {Records.RecordsOnwershipTransferResponse} RecordsOnwershipTransferResponse instance
     */
    RecordsOnwershipTransferResponse.create = function create(properties) {
      return new RecordsOnwershipTransferResponse(properties);
    };

    /**
     * Encodes the specified RecordsOnwershipTransferResponse message. Does not implicitly {@link Records.RecordsOnwershipTransferResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Records.IRecordsOnwershipTransferResponse} message RecordsOnwershipTransferResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsOnwershipTransferResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.transferRecordStatus != null && message.transferRecordStatus.length)
        for (let i = 0; i < message.transferRecordStatus.length; ++i)
          $root.Records.TransferRecordStatus.encode(
            message.transferRecordStatus[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsOnwershipTransferResponse message, length delimited. Does not implicitly {@link Records.RecordsOnwershipTransferResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Records.IRecordsOnwershipTransferResponse} message RecordsOnwershipTransferResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsOnwershipTransferResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsOnwershipTransferResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsOnwershipTransferResponse} RecordsOnwershipTransferResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsOnwershipTransferResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsOnwershipTransferResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.transferRecordStatus && message.transferRecordStatus.length))
              message.transferRecordStatus = [];
            message.transferRecordStatus.push(
              $root.Records.TransferRecordStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsOnwershipTransferResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsOnwershipTransferResponse} RecordsOnwershipTransferResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsOnwershipTransferResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsOnwershipTransferResponse message.
     * @function verify
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsOnwershipTransferResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.transferRecordStatus != null && message.hasOwnProperty("transferRecordStatus")) {
        if (!Array.isArray(message.transferRecordStatus))
          return "transferRecordStatus: array expected";
        for (let i = 0; i < message.transferRecordStatus.length; ++i) {
          let error = $root.Records.TransferRecordStatus.verify(message.transferRecordStatus[i]);
          if (error) return "transferRecordStatus." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsOnwershipTransferResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsOnwershipTransferResponse} RecordsOnwershipTransferResponse
     */
    RecordsOnwershipTransferResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsOnwershipTransferResponse) return object;
      let message = new $root.Records.RecordsOnwershipTransferResponse();
      if (object.transferRecordStatus) {
        if (!Array.isArray(object.transferRecordStatus))
          throw TypeError(
            ".Records.RecordsOnwershipTransferResponse.transferRecordStatus: array expected",
          );
        message.transferRecordStatus = [];
        for (let i = 0; i < object.transferRecordStatus.length; ++i) {
          if (typeof object.transferRecordStatus[i] !== "object")
            throw TypeError(
              ".Records.RecordsOnwershipTransferResponse.transferRecordStatus: object expected",
            );
          message.transferRecordStatus[i] = $root.Records.TransferRecordStatus.fromObject(
            object.transferRecordStatus[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsOnwershipTransferResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {Records.RecordsOnwershipTransferResponse} message RecordsOnwershipTransferResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsOnwershipTransferResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.transferRecordStatus = [];
      if (message.transferRecordStatus && message.transferRecordStatus.length) {
        object.transferRecordStatus = [];
        for (let j = 0; j < message.transferRecordStatus.length; ++j)
          object.transferRecordStatus[j] = $root.Records.TransferRecordStatus.toObject(
            message.transferRecordStatus[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordsOnwershipTransferResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordsOnwershipTransferResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsOnwershipTransferResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsOnwershipTransferResponse
     * @function getTypeUrl
     * @memberof Records.RecordsOnwershipTransferResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsOnwershipTransferResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsOnwershipTransferResponse";
    };

    return RecordsOnwershipTransferResponse;
  })();

  Records.TransferRecordStatus = (function () {
    /**
     * Properties of a TransferRecordStatus.
     * @memberof Records
     * @interface ITransferRecordStatus
     * @property {string|null} [username] TransferRecordStatus username
     * @property {Uint8Array|null} [recordUid] TransferRecordStatus recordUid
     * @property {string|null} [status] TransferRecordStatus status
     * @property {string|null} [message] TransferRecordStatus message
     */

    /**
     * Constructs a new TransferRecordStatus.
     * @memberof Records
     * @classdesc Represents a TransferRecordStatus.
     * @implements ITransferRecordStatus
     * @constructor
     * @param {Records.ITransferRecordStatus=} [properties] Properties to set
     */
    function TransferRecordStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TransferRecordStatus username.
     * @member {string} username
     * @memberof Records.TransferRecordStatus
     * @instance
     */
    TransferRecordStatus.prototype.username = "";

    /**
     * TransferRecordStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.TransferRecordStatus
     * @instance
     */
    TransferRecordStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * TransferRecordStatus status.
     * @member {string} status
     * @memberof Records.TransferRecordStatus
     * @instance
     */
    TransferRecordStatus.prototype.status = "";

    /**
     * TransferRecordStatus message.
     * @member {string} message
     * @memberof Records.TransferRecordStatus
     * @instance
     */
    TransferRecordStatus.prototype.message = "";

    /**
     * Creates a new TransferRecordStatus instance using the specified properties.
     * @function create
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Records.ITransferRecordStatus=} [properties] Properties to set
     * @returns {Records.TransferRecordStatus} TransferRecordStatus instance
     */
    TransferRecordStatus.create = function create(properties) {
      return new TransferRecordStatus(properties);
    };

    /**
     * Encodes the specified TransferRecordStatus message. Does not implicitly {@link Records.TransferRecordStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Records.ITransferRecordStatus} message TransferRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TransferRecordStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.username != null && Object.hasOwnProperty.call(message, "username"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.username);
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.status);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.message);
      return writer;
    };

    /**
     * Encodes the specified TransferRecordStatus message, length delimited. Does not implicitly {@link Records.TransferRecordStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Records.ITransferRecordStatus} message TransferRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TransferRecordStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TransferRecordStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TransferRecordStatus} TransferRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TransferRecordStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TransferRecordStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.username = reader.string();
            break;
          }
          case 2: {
            message.recordUid = reader.bytes();
            break;
          }
          case 3: {
            message.status = reader.string();
            break;
          }
          case 4: {
            message.message = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TransferRecordStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TransferRecordStatus} TransferRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TransferRecordStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TransferRecordStatus message.
     * @function verify
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TransferRecordStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.username != null && message.hasOwnProperty("username"))
        if (!$util.isString(message.username)) return "username: string expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        if (!$util.isString(message.status)) return "status: string expected";
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      return null;
    };

    /**
     * Creates a TransferRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TransferRecordStatus} TransferRecordStatus
     */
    TransferRecordStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TransferRecordStatus) return object;
      let message = new $root.Records.TransferRecordStatus();
      if (object.username != null) message.username = String(object.username);
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.status != null) message.status = String(object.status);
      if (object.message != null) message.message = String(object.message);
      return message;
    };

    /**
     * Creates a plain object from a TransferRecordStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {Records.TransferRecordStatus} message TransferRecordStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TransferRecordStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.username = "";
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = "";
        object.message = "";
      }
      if (message.username != null && message.hasOwnProperty("username"))
        object.username = message.username;
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status = message.status;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      return object;
    };

    /**
     * Converts this TransferRecordStatus to JSON.
     * @function toJSON
     * @memberof Records.TransferRecordStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TransferRecordStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TransferRecordStatus
     * @function getTypeUrl
     * @memberof Records.TransferRecordStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TransferRecordStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TransferRecordStatus";
    };

    return TransferRecordStatus;
  })();

  Records.RecordsUnshareRequest = (function () {
    /**
     * Properties of a RecordsUnshareRequest.
     * @memberof Records
     * @interface IRecordsUnshareRequest
     * @property {Array.<Records.IRecordsUnshareFolder>|null} [sharedFolders] RecordsUnshareRequest sharedFolders
     * @property {Array.<Records.IRecordsUnshareUser>|null} [users] RecordsUnshareRequest users
     */

    /**
     * Constructs a new RecordsUnshareRequest.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareRequest.
     * @implements IRecordsUnshareRequest
     * @constructor
     * @param {Records.IRecordsUnshareRequest=} [properties] Properties to set
     */
    function RecordsUnshareRequest(properties) {
      this.sharedFolders = [];
      this.users = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareRequest sharedFolders.
     * @member {Array.<Records.IRecordsUnshareFolder>} sharedFolders
     * @memberof Records.RecordsUnshareRequest
     * @instance
     */
    RecordsUnshareRequest.prototype.sharedFolders = $util.emptyArray;

    /**
     * RecordsUnshareRequest users.
     * @member {Array.<Records.IRecordsUnshareUser>} users
     * @memberof Records.RecordsUnshareRequest
     * @instance
     */
    RecordsUnshareRequest.prototype.users = $util.emptyArray;

    /**
     * Creates a new RecordsUnshareRequest instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Records.IRecordsUnshareRequest=} [properties] Properties to set
     * @returns {Records.RecordsUnshareRequest} RecordsUnshareRequest instance
     */
    RecordsUnshareRequest.create = function create(properties) {
      return new RecordsUnshareRequest(properties);
    };

    /**
     * Encodes the specified RecordsUnshareRequest message. Does not implicitly {@link Records.RecordsUnshareRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Records.IRecordsUnshareRequest} message RecordsUnshareRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.sharedFolders != null && message.sharedFolders.length)
        for (let i = 0; i < message.sharedFolders.length; ++i)
          $root.Records.RecordsUnshareFolder.encode(
            message.sharedFolders[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.users != null && message.users.length)
        for (let i = 0; i < message.users.length; ++i)
          $root.Records.RecordsUnshareUser.encode(
            message.users[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareRequest message, length delimited. Does not implicitly {@link Records.RecordsUnshareRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Records.IRecordsUnshareRequest} message RecordsUnshareRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareRequest} RecordsUnshareRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.sharedFolders && message.sharedFolders.length))
              message.sharedFolders = [];
            message.sharedFolders.push(
              $root.Records.RecordsUnshareFolder.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.users && message.users.length)) message.users = [];
            message.users.push($root.Records.RecordsUnshareUser.decode(reader, reader.uint32()));
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareRequest} RecordsUnshareRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareRequest message.
     * @function verify
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.sharedFolders != null && message.hasOwnProperty("sharedFolders")) {
        if (!Array.isArray(message.sharedFolders)) return "sharedFolders: array expected";
        for (let i = 0; i < message.sharedFolders.length; ++i) {
          let error = $root.Records.RecordsUnshareFolder.verify(message.sharedFolders[i]);
          if (error) return "sharedFolders." + error;
        }
      }
      if (message.users != null && message.hasOwnProperty("users")) {
        if (!Array.isArray(message.users)) return "users: array expected";
        for (let i = 0; i < message.users.length; ++i) {
          let error = $root.Records.RecordsUnshareUser.verify(message.users[i]);
          if (error) return "users." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsUnshareRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareRequest} RecordsUnshareRequest
     */
    RecordsUnshareRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareRequest) return object;
      let message = new $root.Records.RecordsUnshareRequest();
      if (object.sharedFolders) {
        if (!Array.isArray(object.sharedFolders))
          throw TypeError(".Records.RecordsUnshareRequest.sharedFolders: array expected");
        message.sharedFolders = [];
        for (let i = 0; i < object.sharedFolders.length; ++i) {
          if (typeof object.sharedFolders[i] !== "object")
            throw TypeError(".Records.RecordsUnshareRequest.sharedFolders: object expected");
          message.sharedFolders[i] = $root.Records.RecordsUnshareFolder.fromObject(
            object.sharedFolders[i],
          );
        }
      }
      if (object.users) {
        if (!Array.isArray(object.users))
          throw TypeError(".Records.RecordsUnshareRequest.users: array expected");
        message.users = [];
        for (let i = 0; i < object.users.length; ++i) {
          if (typeof object.users[i] !== "object")
            throw TypeError(".Records.RecordsUnshareRequest.users: object expected");
          message.users[i] = $root.Records.RecordsUnshareUser.fromObject(object.users[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {Records.RecordsUnshareRequest} message RecordsUnshareRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.sharedFolders = [];
        object.users = [];
      }
      if (message.sharedFolders && message.sharedFolders.length) {
        object.sharedFolders = [];
        for (let j = 0; j < message.sharedFolders.length; ++j)
          object.sharedFolders[j] = $root.Records.RecordsUnshareFolder.toObject(
            message.sharedFolders[j],
            options,
          );
      }
      if (message.users && message.users.length) {
        object.users = [];
        for (let j = 0; j < message.users.length; ++j)
          object.users[j] = $root.Records.RecordsUnshareUser.toObject(message.users[j], options);
      }
      return object;
    };

    /**
     * Converts this RecordsUnshareRequest to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareRequest
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareRequest";
    };

    return RecordsUnshareRequest;
  })();

  Records.RecordsUnshareResponse = (function () {
    /**
     * Properties of a RecordsUnshareResponse.
     * @memberof Records
     * @interface IRecordsUnshareResponse
     * @property {Array.<Records.IRecordsUnshareFolderStatus>|null} [sharedFolders] RecordsUnshareResponse sharedFolders
     * @property {Array.<Records.IRecordsUnshareUserStatus>|null} [users] RecordsUnshareResponse users
     */

    /**
     * Constructs a new RecordsUnshareResponse.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareResponse.
     * @implements IRecordsUnshareResponse
     * @constructor
     * @param {Records.IRecordsUnshareResponse=} [properties] Properties to set
     */
    function RecordsUnshareResponse(properties) {
      this.sharedFolders = [];
      this.users = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareResponse sharedFolders.
     * @member {Array.<Records.IRecordsUnshareFolderStatus>} sharedFolders
     * @memberof Records.RecordsUnshareResponse
     * @instance
     */
    RecordsUnshareResponse.prototype.sharedFolders = $util.emptyArray;

    /**
     * RecordsUnshareResponse users.
     * @member {Array.<Records.IRecordsUnshareUserStatus>} users
     * @memberof Records.RecordsUnshareResponse
     * @instance
     */
    RecordsUnshareResponse.prototype.users = $util.emptyArray;

    /**
     * Creates a new RecordsUnshareResponse instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Records.IRecordsUnshareResponse=} [properties] Properties to set
     * @returns {Records.RecordsUnshareResponse} RecordsUnshareResponse instance
     */
    RecordsUnshareResponse.create = function create(properties) {
      return new RecordsUnshareResponse(properties);
    };

    /**
     * Encodes the specified RecordsUnshareResponse message. Does not implicitly {@link Records.RecordsUnshareResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Records.IRecordsUnshareResponse} message RecordsUnshareResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.sharedFolders != null && message.sharedFolders.length)
        for (let i = 0; i < message.sharedFolders.length; ++i)
          $root.Records.RecordsUnshareFolderStatus.encode(
            message.sharedFolders[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.users != null && message.users.length)
        for (let i = 0; i < message.users.length; ++i)
          $root.Records.RecordsUnshareUserStatus.encode(
            message.users[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareResponse message, length delimited. Does not implicitly {@link Records.RecordsUnshareResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Records.IRecordsUnshareResponse} message RecordsUnshareResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareResponse} RecordsUnshareResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.sharedFolders && message.sharedFolders.length))
              message.sharedFolders = [];
            message.sharedFolders.push(
              $root.Records.RecordsUnshareFolderStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            if (!(message.users && message.users.length)) message.users = [];
            message.users.push(
              $root.Records.RecordsUnshareUserStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareResponse} RecordsUnshareResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareResponse message.
     * @function verify
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.sharedFolders != null && message.hasOwnProperty("sharedFolders")) {
        if (!Array.isArray(message.sharedFolders)) return "sharedFolders: array expected";
        for (let i = 0; i < message.sharedFolders.length; ++i) {
          let error = $root.Records.RecordsUnshareFolderStatus.verify(message.sharedFolders[i]);
          if (error) return "sharedFolders." + error;
        }
      }
      if (message.users != null && message.hasOwnProperty("users")) {
        if (!Array.isArray(message.users)) return "users: array expected";
        for (let i = 0; i < message.users.length; ++i) {
          let error = $root.Records.RecordsUnshareUserStatus.verify(message.users[i]);
          if (error) return "users." + error;
        }
      }
      return null;
    };

    /**
     * Creates a RecordsUnshareResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareResponse} RecordsUnshareResponse
     */
    RecordsUnshareResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareResponse) return object;
      let message = new $root.Records.RecordsUnshareResponse();
      if (object.sharedFolders) {
        if (!Array.isArray(object.sharedFolders))
          throw TypeError(".Records.RecordsUnshareResponse.sharedFolders: array expected");
        message.sharedFolders = [];
        for (let i = 0; i < object.sharedFolders.length; ++i) {
          if (typeof object.sharedFolders[i] !== "object")
            throw TypeError(".Records.RecordsUnshareResponse.sharedFolders: object expected");
          message.sharedFolders[i] = $root.Records.RecordsUnshareFolderStatus.fromObject(
            object.sharedFolders[i],
          );
        }
      }
      if (object.users) {
        if (!Array.isArray(object.users))
          throw TypeError(".Records.RecordsUnshareResponse.users: array expected");
        message.users = [];
        for (let i = 0; i < object.users.length; ++i) {
          if (typeof object.users[i] !== "object")
            throw TypeError(".Records.RecordsUnshareResponse.users: object expected");
          message.users[i] = $root.Records.RecordsUnshareUserStatus.fromObject(object.users[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {Records.RecordsUnshareResponse} message RecordsUnshareResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.sharedFolders = [];
        object.users = [];
      }
      if (message.sharedFolders && message.sharedFolders.length) {
        object.sharedFolders = [];
        for (let j = 0; j < message.sharedFolders.length; ++j)
          object.sharedFolders[j] = $root.Records.RecordsUnshareFolderStatus.toObject(
            message.sharedFolders[j],
            options,
          );
      }
      if (message.users && message.users.length) {
        object.users = [];
        for (let j = 0; j < message.users.length; ++j)
          object.users[j] = $root.Records.RecordsUnshareUserStatus.toObject(
            message.users[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this RecordsUnshareResponse to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareResponse
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareResponse";
    };

    return RecordsUnshareResponse;
  })();

  Records.RecordsUnshareFolder = (function () {
    /**
     * Properties of a RecordsUnshareFolder.
     * @memberof Records
     * @interface IRecordsUnshareFolder
     * @property {Uint8Array|null} [recordUid] RecordsUnshareFolder recordUid
     * @property {Uint8Array|null} [sharedFolderUid] RecordsUnshareFolder sharedFolderUid
     */

    /**
     * Constructs a new RecordsUnshareFolder.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareFolder.
     * @implements IRecordsUnshareFolder
     * @constructor
     * @param {Records.IRecordsUnshareFolder=} [properties] Properties to set
     */
    function RecordsUnshareFolder(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareFolder recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordsUnshareFolder
     * @instance
     */
    RecordsUnshareFolder.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordsUnshareFolder sharedFolderUid.
     * @member {Uint8Array} sharedFolderUid
     * @memberof Records.RecordsUnshareFolder
     * @instance
     */
    RecordsUnshareFolder.prototype.sharedFolderUid = $util.newBuffer([]);

    /**
     * Creates a new RecordsUnshareFolder instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Records.IRecordsUnshareFolder=} [properties] Properties to set
     * @returns {Records.RecordsUnshareFolder} RecordsUnshareFolder instance
     */
    RecordsUnshareFolder.create = function create(properties) {
      return new RecordsUnshareFolder(properties);
    };

    /**
     * Encodes the specified RecordsUnshareFolder message. Does not implicitly {@link Records.RecordsUnshareFolder.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Records.IRecordsUnshareFolder} message RecordsUnshareFolder message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareFolder.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.sharedFolderUid != null && Object.hasOwnProperty.call(message, "sharedFolderUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.sharedFolderUid);
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareFolder message, length delimited. Does not implicitly {@link Records.RecordsUnshareFolder.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Records.IRecordsUnshareFolder} message RecordsUnshareFolder message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareFolder.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareFolder message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareFolder} RecordsUnshareFolder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareFolder.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareFolder();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.sharedFolderUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareFolder message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareFolder} RecordsUnshareFolder
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareFolder.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareFolder message.
     * @function verify
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareFolder.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        if (
          !(
            (message.sharedFolderUid && typeof message.sharedFolderUid.length === "number") ||
            $util.isString(message.sharedFolderUid)
          )
        )
          return "sharedFolderUid: buffer expected";
      return null;
    };

    /**
     * Creates a RecordsUnshareFolder message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareFolder} RecordsUnshareFolder
     */
    RecordsUnshareFolder.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareFolder) return object;
      let message = new $root.Records.RecordsUnshareFolder();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.sharedFolderUid != null)
        if (typeof object.sharedFolderUid === "string")
          $util.base64.decode(
            object.sharedFolderUid,
            (message.sharedFolderUid = $util.newBuffer(
              $util.base64.length(object.sharedFolderUid),
            )),
            0,
          );
        else if (object.sharedFolderUid.length >= 0)
          message.sharedFolderUid = object.sharedFolderUid;
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareFolder message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {Records.RecordsUnshareFolder} message RecordsUnshareFolder
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareFolder.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.sharedFolderUid = "";
        else {
          object.sharedFolderUid = [];
          if (options.bytes !== Array)
            object.sharedFolderUid = $util.newBuffer(object.sharedFolderUid);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        object.sharedFolderUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedFolderUid, 0, message.sharedFolderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedFolderUid)
              : message.sharedFolderUid;
      return object;
    };

    /**
     * Converts this RecordsUnshareFolder to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareFolder
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareFolder.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareFolder
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareFolder
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareFolder.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareFolder";
    };

    return RecordsUnshareFolder;
  })();

  Records.RecordsUnshareUser = (function () {
    /**
     * Properties of a RecordsUnshareUser.
     * @memberof Records
     * @interface IRecordsUnshareUser
     * @property {Uint8Array|null} [recordUid] RecordsUnshareUser recordUid
     * @property {Uint8Array|null} [accountUid] RecordsUnshareUser accountUid
     */

    /**
     * Constructs a new RecordsUnshareUser.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareUser.
     * @implements IRecordsUnshareUser
     * @constructor
     * @param {Records.IRecordsUnshareUser=} [properties] Properties to set
     */
    function RecordsUnshareUser(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareUser recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordsUnshareUser
     * @instance
     */
    RecordsUnshareUser.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordsUnshareUser accountUid.
     * @member {Uint8Array} accountUid
     * @memberof Records.RecordsUnshareUser
     * @instance
     */
    RecordsUnshareUser.prototype.accountUid = $util.newBuffer([]);

    /**
     * Creates a new RecordsUnshareUser instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Records.IRecordsUnshareUser=} [properties] Properties to set
     * @returns {Records.RecordsUnshareUser} RecordsUnshareUser instance
     */
    RecordsUnshareUser.create = function create(properties) {
      return new RecordsUnshareUser(properties);
    };

    /**
     * Encodes the specified RecordsUnshareUser message. Does not implicitly {@link Records.RecordsUnshareUser.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Records.IRecordsUnshareUser} message RecordsUnshareUser message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareUser.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.accountUid != null && Object.hasOwnProperty.call(message, "accountUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.accountUid);
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareUser message, length delimited. Does not implicitly {@link Records.RecordsUnshareUser.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Records.IRecordsUnshareUser} message RecordsUnshareUser message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareUser.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareUser message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareUser} RecordsUnshareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareUser.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareUser();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.accountUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareUser message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareUser} RecordsUnshareUser
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareUser.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareUser message.
     * @function verify
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareUser.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        if (
          !(
            (message.accountUid && typeof message.accountUid.length === "number") ||
            $util.isString(message.accountUid)
          )
        )
          return "accountUid: buffer expected";
      return null;
    };

    /**
     * Creates a RecordsUnshareUser message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareUser} RecordsUnshareUser
     */
    RecordsUnshareUser.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareUser) return object;
      let message = new $root.Records.RecordsUnshareUser();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.accountUid != null)
        if (typeof object.accountUid === "string")
          $util.base64.decode(
            object.accountUid,
            (message.accountUid = $util.newBuffer($util.base64.length(object.accountUid))),
            0,
          );
        else if (object.accountUid.length >= 0) message.accountUid = object.accountUid;
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareUser message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {Records.RecordsUnshareUser} message RecordsUnshareUser
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareUser.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.accountUid = "";
        else {
          object.accountUid = [];
          if (options.bytes !== Array) object.accountUid = $util.newBuffer(object.accountUid);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        object.accountUid =
          options.bytes === String
            ? $util.base64.encode(message.accountUid, 0, message.accountUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.accountUid)
              : message.accountUid;
      return object;
    };

    /**
     * Converts this RecordsUnshareUser to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareUser
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareUser.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareUser
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareUser
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareUser.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareUser";
    };

    return RecordsUnshareUser;
  })();

  Records.RecordsUnshareFolderStatus = (function () {
    /**
     * Properties of a RecordsUnshareFolderStatus.
     * @memberof Records
     * @interface IRecordsUnshareFolderStatus
     * @property {Uint8Array|null} [recordUid] RecordsUnshareFolderStatus recordUid
     * @property {Uint8Array|null} [sharedFolderUid] RecordsUnshareFolderStatus sharedFolderUid
     */

    /**
     * Constructs a new RecordsUnshareFolderStatus.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareFolderStatus.
     * @implements IRecordsUnshareFolderStatus
     * @constructor
     * @param {Records.IRecordsUnshareFolderStatus=} [properties] Properties to set
     */
    function RecordsUnshareFolderStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareFolderStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordsUnshareFolderStatus
     * @instance
     */
    RecordsUnshareFolderStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordsUnshareFolderStatus sharedFolderUid.
     * @member {Uint8Array} sharedFolderUid
     * @memberof Records.RecordsUnshareFolderStatus
     * @instance
     */
    RecordsUnshareFolderStatus.prototype.sharedFolderUid = $util.newBuffer([]);

    /**
     * Creates a new RecordsUnshareFolderStatus instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Records.IRecordsUnshareFolderStatus=} [properties] Properties to set
     * @returns {Records.RecordsUnshareFolderStatus} RecordsUnshareFolderStatus instance
     */
    RecordsUnshareFolderStatus.create = function create(properties) {
      return new RecordsUnshareFolderStatus(properties);
    };

    /**
     * Encodes the specified RecordsUnshareFolderStatus message. Does not implicitly {@link Records.RecordsUnshareFolderStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Records.IRecordsUnshareFolderStatus} message RecordsUnshareFolderStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareFolderStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.sharedFolderUid != null && Object.hasOwnProperty.call(message, "sharedFolderUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.sharedFolderUid);
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareFolderStatus message, length delimited. Does not implicitly {@link Records.RecordsUnshareFolderStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Records.IRecordsUnshareFolderStatus} message RecordsUnshareFolderStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareFolderStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareFolderStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareFolderStatus} RecordsUnshareFolderStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareFolderStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareFolderStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.sharedFolderUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareFolderStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareFolderStatus} RecordsUnshareFolderStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareFolderStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareFolderStatus message.
     * @function verify
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareFolderStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        if (
          !(
            (message.sharedFolderUid && typeof message.sharedFolderUid.length === "number") ||
            $util.isString(message.sharedFolderUid)
          )
        )
          return "sharedFolderUid: buffer expected";
      return null;
    };

    /**
     * Creates a RecordsUnshareFolderStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareFolderStatus} RecordsUnshareFolderStatus
     */
    RecordsUnshareFolderStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareFolderStatus) return object;
      let message = new $root.Records.RecordsUnshareFolderStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.sharedFolderUid != null)
        if (typeof object.sharedFolderUid === "string")
          $util.base64.decode(
            object.sharedFolderUid,
            (message.sharedFolderUid = $util.newBuffer(
              $util.base64.length(object.sharedFolderUid),
            )),
            0,
          );
        else if (object.sharedFolderUid.length >= 0)
          message.sharedFolderUid = object.sharedFolderUid;
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareFolderStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {Records.RecordsUnshareFolderStatus} message RecordsUnshareFolderStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareFolderStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.sharedFolderUid = "";
        else {
          object.sharedFolderUid = [];
          if (options.bytes !== Array)
            object.sharedFolderUid = $util.newBuffer(object.sharedFolderUid);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.sharedFolderUid != null && message.hasOwnProperty("sharedFolderUid"))
        object.sharedFolderUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedFolderUid, 0, message.sharedFolderUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedFolderUid)
              : message.sharedFolderUid;
      return object;
    };

    /**
     * Converts this RecordsUnshareFolderStatus to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareFolderStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareFolderStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareFolderStatus
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareFolderStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareFolderStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareFolderStatus";
    };

    return RecordsUnshareFolderStatus;
  })();

  Records.RecordsUnshareUserStatus = (function () {
    /**
     * Properties of a RecordsUnshareUserStatus.
     * @memberof Records
     * @interface IRecordsUnshareUserStatus
     * @property {Uint8Array|null} [recordUid] RecordsUnshareUserStatus recordUid
     * @property {Uint8Array|null} [accountUid] RecordsUnshareUserStatus accountUid
     */

    /**
     * Constructs a new RecordsUnshareUserStatus.
     * @memberof Records
     * @classdesc Represents a RecordsUnshareUserStatus.
     * @implements IRecordsUnshareUserStatus
     * @constructor
     * @param {Records.IRecordsUnshareUserStatus=} [properties] Properties to set
     */
    function RecordsUnshareUserStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RecordsUnshareUserStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof Records.RecordsUnshareUserStatus
     * @instance
     */
    RecordsUnshareUserStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * RecordsUnshareUserStatus accountUid.
     * @member {Uint8Array} accountUid
     * @memberof Records.RecordsUnshareUserStatus
     * @instance
     */
    RecordsUnshareUserStatus.prototype.accountUid = $util.newBuffer([]);

    /**
     * Creates a new RecordsUnshareUserStatus instance using the specified properties.
     * @function create
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Records.IRecordsUnshareUserStatus=} [properties] Properties to set
     * @returns {Records.RecordsUnshareUserStatus} RecordsUnshareUserStatus instance
     */
    RecordsUnshareUserStatus.create = function create(properties) {
      return new RecordsUnshareUserStatus(properties);
    };

    /**
     * Encodes the specified RecordsUnshareUserStatus message. Does not implicitly {@link Records.RecordsUnshareUserStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Records.IRecordsUnshareUserStatus} message RecordsUnshareUserStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareUserStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.accountUid != null && Object.hasOwnProperty.call(message, "accountUid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.accountUid);
      return writer;
    };

    /**
     * Encodes the specified RecordsUnshareUserStatus message, length delimited. Does not implicitly {@link Records.RecordsUnshareUserStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Records.IRecordsUnshareUserStatus} message RecordsUnshareUserStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RecordsUnshareUserStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RecordsUnshareUserStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.RecordsUnshareUserStatus} RecordsUnshareUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareUserStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.RecordsUnshareUserStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.accountUid = reader.bytes();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a RecordsUnshareUserStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.RecordsUnshareUserStatus} RecordsUnshareUserStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RecordsUnshareUserStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RecordsUnshareUserStatus message.
     * @function verify
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RecordsUnshareUserStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        if (
          !(
            (message.accountUid && typeof message.accountUid.length === "number") ||
            $util.isString(message.accountUid)
          )
        )
          return "accountUid: buffer expected";
      return null;
    };

    /**
     * Creates a RecordsUnshareUserStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.RecordsUnshareUserStatus} RecordsUnshareUserStatus
     */
    RecordsUnshareUserStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.RecordsUnshareUserStatus) return object;
      let message = new $root.Records.RecordsUnshareUserStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.accountUid != null)
        if (typeof object.accountUid === "string")
          $util.base64.decode(
            object.accountUid,
            (message.accountUid = $util.newBuffer($util.base64.length(object.accountUid))),
            0,
          );
        else if (object.accountUid.length >= 0) message.accountUid = object.accountUid;
      return message;
    };

    /**
     * Creates a plain object from a RecordsUnshareUserStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {Records.RecordsUnshareUserStatus} message RecordsUnshareUserStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RecordsUnshareUserStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.accountUid = "";
        else {
          object.accountUid = [];
          if (options.bytes !== Array) object.accountUid = $util.newBuffer(object.accountUid);
        }
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.accountUid != null && message.hasOwnProperty("accountUid"))
        object.accountUid =
          options.bytes === String
            ? $util.base64.encode(message.accountUid, 0, message.accountUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.accountUid)
              : message.accountUid;
      return object;
    };

    /**
     * Converts this RecordsUnshareUserStatus to JSON.
     * @function toJSON
     * @memberof Records.RecordsUnshareUserStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RecordsUnshareUserStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RecordsUnshareUserStatus
     * @function getTypeUrl
     * @memberof Records.RecordsUnshareUserStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RecordsUnshareUserStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.RecordsUnshareUserStatus";
    };

    return RecordsUnshareUserStatus;
  })();

  Records.TimedAccessCallbackPayload = (function () {
    /**
     * Properties of a TimedAccessCallbackPayload.
     * @memberof Records
     * @interface ITimedAccessCallbackPayload
     * @property {Records.TimeLimitedAccessType|null} [timeLimitedAccessType] TimedAccessCallbackPayload timeLimitedAccessType
     */

    /**
     * Constructs a new TimedAccessCallbackPayload.
     * @memberof Records
     * @classdesc Represents a TimedAccessCallbackPayload.
     * @implements ITimedAccessCallbackPayload
     * @constructor
     * @param {Records.ITimedAccessCallbackPayload=} [properties] Properties to set
     */
    function TimedAccessCallbackPayload(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TimedAccessCallbackPayload timeLimitedAccessType.
     * @member {Records.TimeLimitedAccessType} timeLimitedAccessType
     * @memberof Records.TimedAccessCallbackPayload
     * @instance
     */
    TimedAccessCallbackPayload.prototype.timeLimitedAccessType = 0;

    /**
     * Creates a new TimedAccessCallbackPayload instance using the specified properties.
     * @function create
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Records.ITimedAccessCallbackPayload=} [properties] Properties to set
     * @returns {Records.TimedAccessCallbackPayload} TimedAccessCallbackPayload instance
     */
    TimedAccessCallbackPayload.create = function create(properties) {
      return new TimedAccessCallbackPayload(properties);
    };

    /**
     * Encodes the specified TimedAccessCallbackPayload message. Does not implicitly {@link Records.TimedAccessCallbackPayload.verify|verify} messages.
     * @function encode
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Records.ITimedAccessCallbackPayload} message TimedAccessCallbackPayload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimedAccessCallbackPayload.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.timeLimitedAccessType != null &&
        Object.hasOwnProperty.call(message, "timeLimitedAccessType")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.timeLimitedAccessType);
      return writer;
    };

    /**
     * Encodes the specified TimedAccessCallbackPayload message, length delimited. Does not implicitly {@link Records.TimedAccessCallbackPayload.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Records.ITimedAccessCallbackPayload} message TimedAccessCallbackPayload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimedAccessCallbackPayload.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TimedAccessCallbackPayload message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TimedAccessCallbackPayload} TimedAccessCallbackPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimedAccessCallbackPayload.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TimedAccessCallbackPayload();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.timeLimitedAccessType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TimedAccessCallbackPayload message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TimedAccessCallbackPayload} TimedAccessCallbackPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimedAccessCallbackPayload.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TimedAccessCallbackPayload message.
     * @function verify
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TimedAccessCallbackPayload.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.timeLimitedAccessType != null && message.hasOwnProperty("timeLimitedAccessType"))
        switch (message.timeLimitedAccessType) {
          default:
            return "timeLimitedAccessType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
        }
      return null;
    };

    /**
     * Creates a TimedAccessCallbackPayload message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TimedAccessCallbackPayload} TimedAccessCallbackPayload
     */
    TimedAccessCallbackPayload.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TimedAccessCallbackPayload) return object;
      let message = new $root.Records.TimedAccessCallbackPayload();
      switch (object.timeLimitedAccessType) {
        default:
          if (typeof object.timeLimitedAccessType === "number") {
            message.timeLimitedAccessType = object.timeLimitedAccessType;
            break;
          }
          break;
        case "INVALID_TIME_LIMITED_ACCESS_TYPE":
        case 0:
          message.timeLimitedAccessType = 0;
          break;
        case "USER_ACCESS_TO_RECORD":
        case 1:
          message.timeLimitedAccessType = 1;
          break;
        case "USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER":
        case 2:
          message.timeLimitedAccessType = 2;
          break;
        case "RECORD_ACCESS_TO_SHAREDFOLDER":
        case 3:
          message.timeLimitedAccessType = 3;
          break;
        case "USER_ACCESS_TO_SHAREDFOLDER":
        case 4:
          message.timeLimitedAccessType = 4;
          break;
        case "TEAM_ACCESS_TO_SHAREDFOLDER":
        case 5:
          message.timeLimitedAccessType = 5;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a TimedAccessCallbackPayload message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {Records.TimedAccessCallbackPayload} message TimedAccessCallbackPayload
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TimedAccessCallbackPayload.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        object.timeLimitedAccessType =
          options.enums === String ? "INVALID_TIME_LIMITED_ACCESS_TYPE" : 0;
      if (message.timeLimitedAccessType != null && message.hasOwnProperty("timeLimitedAccessType"))
        object.timeLimitedAccessType =
          options.enums === String
            ? $root.Records.TimeLimitedAccessType[message.timeLimitedAccessType] === undefined
              ? message.timeLimitedAccessType
              : $root.Records.TimeLimitedAccessType[message.timeLimitedAccessType]
            : message.timeLimitedAccessType;
      return object;
    };

    /**
     * Converts this TimedAccessCallbackPayload to JSON.
     * @function toJSON
     * @memberof Records.TimedAccessCallbackPayload
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TimedAccessCallbackPayload.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TimedAccessCallbackPayload
     * @function getTypeUrl
     * @memberof Records.TimedAccessCallbackPayload
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TimedAccessCallbackPayload.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TimedAccessCallbackPayload";
    };

    return TimedAccessCallbackPayload;
  })();

  Records.TimeLimitedAccessRequest = (function () {
    /**
     * Properties of a TimeLimitedAccessRequest.
     * @memberof Records
     * @interface ITimeLimitedAccessRequest
     * @property {Array.<Uint8Array>|null} [accountUid] TimeLimitedAccessRequest accountUid
     * @property {Array.<Uint8Array>|null} [teamUid] TimeLimitedAccessRequest teamUid
     * @property {Array.<Uint8Array>|null} [recordUid] TimeLimitedAccessRequest recordUid
     * @property {Uint8Array|null} [sharedObjectUid] TimeLimitedAccessRequest sharedObjectUid
     * @property {Records.TimeLimitedAccessType|null} [timeLimitedAccessType] TimeLimitedAccessRequest timeLimitedAccessType
     * @property {number|Long|null} [expiration] TimeLimitedAccessRequest expiration
     * @property {Records.TimerNotificationType|null} [timerNotificationType] TimeLimitedAccessRequest timerNotificationType
     */

    /**
     * Constructs a new TimeLimitedAccessRequest.
     * @memberof Records
     * @classdesc Represents a TimeLimitedAccessRequest.
     * @implements ITimeLimitedAccessRequest
     * @constructor
     * @param {Records.ITimeLimitedAccessRequest=} [properties] Properties to set
     */
    function TimeLimitedAccessRequest(properties) {
      this.accountUid = [];
      this.teamUid = [];
      this.recordUid = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TimeLimitedAccessRequest accountUid.
     * @member {Array.<Uint8Array>} accountUid
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.accountUid = $util.emptyArray;

    /**
     * TimeLimitedAccessRequest teamUid.
     * @member {Array.<Uint8Array>} teamUid
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.teamUid = $util.emptyArray;

    /**
     * TimeLimitedAccessRequest recordUid.
     * @member {Array.<Uint8Array>} recordUid
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.recordUid = $util.emptyArray;

    /**
     * TimeLimitedAccessRequest sharedObjectUid.
     * @member {Uint8Array} sharedObjectUid
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.sharedObjectUid = $util.newBuffer([]);

    /**
     * TimeLimitedAccessRequest timeLimitedAccessType.
     * @member {Records.TimeLimitedAccessType} timeLimitedAccessType
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.timeLimitedAccessType = 0;

    /**
     * TimeLimitedAccessRequest expiration.
     * @member {number|Long} expiration
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.expiration = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * TimeLimitedAccessRequest timerNotificationType.
     * @member {Records.TimerNotificationType} timerNotificationType
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     */
    TimeLimitedAccessRequest.prototype.timerNotificationType = 0;

    /**
     * Creates a new TimeLimitedAccessRequest instance using the specified properties.
     * @function create
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Records.ITimeLimitedAccessRequest=} [properties] Properties to set
     * @returns {Records.TimeLimitedAccessRequest} TimeLimitedAccessRequest instance
     */
    TimeLimitedAccessRequest.create = function create(properties) {
      return new TimeLimitedAccessRequest(properties);
    };

    /**
     * Encodes the specified TimeLimitedAccessRequest message. Does not implicitly {@link Records.TimeLimitedAccessRequest.verify|verify} messages.
     * @function encode
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Records.ITimeLimitedAccessRequest} message TimeLimitedAccessRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.accountUid != null && message.accountUid.length)
        for (let i = 0; i < message.accountUid.length; ++i)
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.accountUid[i]);
      if (message.teamUid != null && message.teamUid.length)
        for (let i = 0; i < message.teamUid.length; ++i)
          writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.teamUid[i]);
      if (message.recordUid != null && message.recordUid.length)
        for (let i = 0; i < message.recordUid.length; ++i)
          writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.recordUid[i]);
      if (message.sharedObjectUid != null && Object.hasOwnProperty.call(message, "sharedObjectUid"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.sharedObjectUid);
      if (
        message.timeLimitedAccessType != null &&
        Object.hasOwnProperty.call(message, "timeLimitedAccessType")
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.timeLimitedAccessType);
      if (message.expiration != null && Object.hasOwnProperty.call(message, "expiration"))
        writer.uint32(/* id 6, wireType 0 =*/ 48).int64(message.expiration);
      if (
        message.timerNotificationType != null &&
        Object.hasOwnProperty.call(message, "timerNotificationType")
      )
        writer.uint32(/* id 7, wireType 0 =*/ 56).int32(message.timerNotificationType);
      return writer;
    };

    /**
     * Encodes the specified TimeLimitedAccessRequest message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Records.ITimeLimitedAccessRequest} message TimeLimitedAccessRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TimeLimitedAccessRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TimeLimitedAccessRequest} TimeLimitedAccessRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TimeLimitedAccessRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.accountUid && message.accountUid.length)) message.accountUid = [];
            message.accountUid.push(reader.bytes());
            break;
          }
          case 2: {
            if (!(message.teamUid && message.teamUid.length)) message.teamUid = [];
            message.teamUid.push(reader.bytes());
            break;
          }
          case 3: {
            if (!(message.recordUid && message.recordUid.length)) message.recordUid = [];
            message.recordUid.push(reader.bytes());
            break;
          }
          case 4: {
            message.sharedObjectUid = reader.bytes();
            break;
          }
          case 5: {
            message.timeLimitedAccessType = reader.int32();
            break;
          }
          case 6: {
            message.expiration = reader.int64();
            break;
          }
          case 7: {
            message.timerNotificationType = reader.int32();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TimeLimitedAccessRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TimeLimitedAccessRequest} TimeLimitedAccessRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TimeLimitedAccessRequest message.
     * @function verify
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TimeLimitedAccessRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.accountUid != null && message.hasOwnProperty("accountUid")) {
        if (!Array.isArray(message.accountUid)) return "accountUid: array expected";
        for (let i = 0; i < message.accountUid.length; ++i)
          if (
            !(
              (message.accountUid[i] && typeof message.accountUid[i].length === "number") ||
              $util.isString(message.accountUid[i])
            )
          )
            return "accountUid: buffer[] expected";
      }
      if (message.teamUid != null && message.hasOwnProperty("teamUid")) {
        if (!Array.isArray(message.teamUid)) return "teamUid: array expected";
        for (let i = 0; i < message.teamUid.length; ++i)
          if (
            !(
              (message.teamUid[i] && typeof message.teamUid[i].length === "number") ||
              $util.isString(message.teamUid[i])
            )
          )
            return "teamUid: buffer[] expected";
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid")) {
        if (!Array.isArray(message.recordUid)) return "recordUid: array expected";
        for (let i = 0; i < message.recordUid.length; ++i)
          if (
            !(
              (message.recordUid[i] && typeof message.recordUid[i].length === "number") ||
              $util.isString(message.recordUid[i])
            )
          )
            return "recordUid: buffer[] expected";
      }
      if (message.sharedObjectUid != null && message.hasOwnProperty("sharedObjectUid"))
        if (
          !(
            (message.sharedObjectUid && typeof message.sharedObjectUid.length === "number") ||
            $util.isString(message.sharedObjectUid)
          )
        )
          return "sharedObjectUid: buffer expected";
      if (message.timeLimitedAccessType != null && message.hasOwnProperty("timeLimitedAccessType"))
        switch (message.timeLimitedAccessType) {
          default:
            return "timeLimitedAccessType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
        }
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (
          !$util.isInteger(message.expiration) &&
          !(
            message.expiration &&
            $util.isInteger(message.expiration.low) &&
            $util.isInteger(message.expiration.high)
          )
        )
          return "expiration: integer|Long expected";
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        switch (message.timerNotificationType) {
          default:
            return "timerNotificationType: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      return null;
    };

    /**
     * Creates a TimeLimitedAccessRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TimeLimitedAccessRequest} TimeLimitedAccessRequest
     */
    TimeLimitedAccessRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TimeLimitedAccessRequest) return object;
      let message = new $root.Records.TimeLimitedAccessRequest();
      if (object.accountUid) {
        if (!Array.isArray(object.accountUid))
          throw TypeError(".Records.TimeLimitedAccessRequest.accountUid: array expected");
        message.accountUid = [];
        for (let i = 0; i < object.accountUid.length; ++i)
          if (typeof object.accountUid[i] === "string")
            $util.base64.decode(
              object.accountUid[i],
              (message.accountUid[i] = $util.newBuffer($util.base64.length(object.accountUid[i]))),
              0,
            );
          else if (object.accountUid[i].length >= 0) message.accountUid[i] = object.accountUid[i];
      }
      if (object.teamUid) {
        if (!Array.isArray(object.teamUid))
          throw TypeError(".Records.TimeLimitedAccessRequest.teamUid: array expected");
        message.teamUid = [];
        for (let i = 0; i < object.teamUid.length; ++i)
          if (typeof object.teamUid[i] === "string")
            $util.base64.decode(
              object.teamUid[i],
              (message.teamUid[i] = $util.newBuffer($util.base64.length(object.teamUid[i]))),
              0,
            );
          else if (object.teamUid[i].length >= 0) message.teamUid[i] = object.teamUid[i];
      }
      if (object.recordUid) {
        if (!Array.isArray(object.recordUid))
          throw TypeError(".Records.TimeLimitedAccessRequest.recordUid: array expected");
        message.recordUid = [];
        for (let i = 0; i < object.recordUid.length; ++i)
          if (typeof object.recordUid[i] === "string")
            $util.base64.decode(
              object.recordUid[i],
              (message.recordUid[i] = $util.newBuffer($util.base64.length(object.recordUid[i]))),
              0,
            );
          else if (object.recordUid[i].length >= 0) message.recordUid[i] = object.recordUid[i];
      }
      if (object.sharedObjectUid != null)
        if (typeof object.sharedObjectUid === "string")
          $util.base64.decode(
            object.sharedObjectUid,
            (message.sharedObjectUid = $util.newBuffer(
              $util.base64.length(object.sharedObjectUid),
            )),
            0,
          );
        else if (object.sharedObjectUid.length >= 0)
          message.sharedObjectUid = object.sharedObjectUid;
      switch (object.timeLimitedAccessType) {
        default:
          if (typeof object.timeLimitedAccessType === "number") {
            message.timeLimitedAccessType = object.timeLimitedAccessType;
            break;
          }
          break;
        case "INVALID_TIME_LIMITED_ACCESS_TYPE":
        case 0:
          message.timeLimitedAccessType = 0;
          break;
        case "USER_ACCESS_TO_RECORD":
        case 1:
          message.timeLimitedAccessType = 1;
          break;
        case "USER_OR_TEAM_ACCESS_TO_SHAREDFOLDER":
        case 2:
          message.timeLimitedAccessType = 2;
          break;
        case "RECORD_ACCESS_TO_SHAREDFOLDER":
        case 3:
          message.timeLimitedAccessType = 3;
          break;
        case "USER_ACCESS_TO_SHAREDFOLDER":
        case 4:
          message.timeLimitedAccessType = 4;
          break;
        case "TEAM_ACCESS_TO_SHAREDFOLDER":
        case 5:
          message.timeLimitedAccessType = 5;
          break;
      }
      if (object.expiration != null)
        if ($util.Long)
          (message.expiration = $util.Long.fromValue(object.expiration)).unsigned = false;
        else if (typeof object.expiration === "string")
          message.expiration = parseInt(object.expiration, 10);
        else if (typeof object.expiration === "number") message.expiration = object.expiration;
        else if (typeof object.expiration === "object")
          message.expiration = new $util.LongBits(
            object.expiration.low >>> 0,
            object.expiration.high >>> 0,
          ).toNumber();
      switch (object.timerNotificationType) {
        default:
          if (typeof object.timerNotificationType === "number") {
            message.timerNotificationType = object.timerNotificationType;
            break;
          }
          break;
        case "NOTIFICATION_OFF":
        case 0:
          message.timerNotificationType = 0;
          break;
        case "NOTIFY_OWNER":
        case 1:
          message.timerNotificationType = 1;
          break;
        case "NOTIFY_PRIVILEGED_USERS":
        case 2:
          message.timerNotificationType = 2;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a TimeLimitedAccessRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {Records.TimeLimitedAccessRequest} message TimeLimitedAccessRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TimeLimitedAccessRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.accountUid = [];
        object.teamUid = [];
        object.recordUid = [];
      }
      if (options.defaults) {
        if (options.bytes === String) object.sharedObjectUid = "";
        else {
          object.sharedObjectUid = [];
          if (options.bytes !== Array)
            object.sharedObjectUid = $util.newBuffer(object.sharedObjectUid);
        }
        object.timeLimitedAccessType =
          options.enums === String ? "INVALID_TIME_LIMITED_ACCESS_TYPE" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.expiration =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.expiration = options.longs === String ? "0" : 0;
        object.timerNotificationType = options.enums === String ? "NOTIFICATION_OFF" : 0;
      }
      if (message.accountUid && message.accountUid.length) {
        object.accountUid = [];
        for (let j = 0; j < message.accountUid.length; ++j)
          object.accountUid[j] =
            options.bytes === String
              ? $util.base64.encode(message.accountUid[j], 0, message.accountUid[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.accountUid[j])
                : message.accountUid[j];
      }
      if (message.teamUid && message.teamUid.length) {
        object.teamUid = [];
        for (let j = 0; j < message.teamUid.length; ++j)
          object.teamUid[j] =
            options.bytes === String
              ? $util.base64.encode(message.teamUid[j], 0, message.teamUid[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.teamUid[j])
                : message.teamUid[j];
      }
      if (message.recordUid && message.recordUid.length) {
        object.recordUid = [];
        for (let j = 0; j < message.recordUid.length; ++j)
          object.recordUid[j] =
            options.bytes === String
              ? $util.base64.encode(message.recordUid[j], 0, message.recordUid[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.recordUid[j])
                : message.recordUid[j];
      }
      if (message.sharedObjectUid != null && message.hasOwnProperty("sharedObjectUid"))
        object.sharedObjectUid =
          options.bytes === String
            ? $util.base64.encode(message.sharedObjectUid, 0, message.sharedObjectUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.sharedObjectUid)
              : message.sharedObjectUid;
      if (message.timeLimitedAccessType != null && message.hasOwnProperty("timeLimitedAccessType"))
        object.timeLimitedAccessType =
          options.enums === String
            ? $root.Records.TimeLimitedAccessType[message.timeLimitedAccessType] === undefined
              ? message.timeLimitedAccessType
              : $root.Records.TimeLimitedAccessType[message.timeLimitedAccessType]
            : message.timeLimitedAccessType;
      if (message.expiration != null && message.hasOwnProperty("expiration"))
        if (typeof message.expiration === "number")
          object.expiration =
            options.longs === String ? String(message.expiration) : message.expiration;
        else
          object.expiration =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.expiration)
              : options.longs === Number
                ? new $util.LongBits(
                    message.expiration.low >>> 0,
                    message.expiration.high >>> 0,
                  ).toNumber()
                : message.expiration;
      if (message.timerNotificationType != null && message.hasOwnProperty("timerNotificationType"))
        object.timerNotificationType =
          options.enums === String
            ? $root.Records.TimerNotificationType[message.timerNotificationType] === undefined
              ? message.timerNotificationType
              : $root.Records.TimerNotificationType[message.timerNotificationType]
            : message.timerNotificationType;
      return object;
    };

    /**
     * Converts this TimeLimitedAccessRequest to JSON.
     * @function toJSON
     * @memberof Records.TimeLimitedAccessRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TimeLimitedAccessRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TimeLimitedAccessRequest
     * @function getTypeUrl
     * @memberof Records.TimeLimitedAccessRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TimeLimitedAccessRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TimeLimitedAccessRequest";
    };

    return TimeLimitedAccessRequest;
  })();

  Records.TimeLimitedAccessStatus = (function () {
    /**
     * Properties of a TimeLimitedAccessStatus.
     * @memberof Records
     * @interface ITimeLimitedAccessStatus
     * @property {Uint8Array|null} [uid] TimeLimitedAccessStatus uid
     * @property {string|null} [message] TimeLimitedAccessStatus message
     */

    /**
     * Constructs a new TimeLimitedAccessStatus.
     * @memberof Records
     * @classdesc Represents a TimeLimitedAccessStatus.
     * @implements ITimeLimitedAccessStatus
     * @constructor
     * @param {Records.ITimeLimitedAccessStatus=} [properties] Properties to set
     */
    function TimeLimitedAccessStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TimeLimitedAccessStatus uid.
     * @member {Uint8Array} uid
     * @memberof Records.TimeLimitedAccessStatus
     * @instance
     */
    TimeLimitedAccessStatus.prototype.uid = $util.newBuffer([]);

    /**
     * TimeLimitedAccessStatus message.
     * @member {string} message
     * @memberof Records.TimeLimitedAccessStatus
     * @instance
     */
    TimeLimitedAccessStatus.prototype.message = "";

    /**
     * Creates a new TimeLimitedAccessStatus instance using the specified properties.
     * @function create
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Records.ITimeLimitedAccessStatus=} [properties] Properties to set
     * @returns {Records.TimeLimitedAccessStatus} TimeLimitedAccessStatus instance
     */
    TimeLimitedAccessStatus.create = function create(properties) {
      return new TimeLimitedAccessStatus(properties);
    };

    /**
     * Encodes the specified TimeLimitedAccessStatus message. Does not implicitly {@link Records.TimeLimitedAccessStatus.verify|verify} messages.
     * @function encode
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Records.ITimeLimitedAccessStatus} message TimeLimitedAccessStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.uid != null && Object.hasOwnProperty.call(message, "uid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.uid);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.message);
      return writer;
    };

    /**
     * Encodes the specified TimeLimitedAccessStatus message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Records.ITimeLimitedAccessStatus} message TimeLimitedAccessStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TimeLimitedAccessStatus message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TimeLimitedAccessStatus} TimeLimitedAccessStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TimeLimitedAccessStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.uid = reader.bytes();
            break;
          }
          case 2: {
            message.message = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TimeLimitedAccessStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TimeLimitedAccessStatus} TimeLimitedAccessStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TimeLimitedAccessStatus message.
     * @function verify
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TimeLimitedAccessStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.uid != null && message.hasOwnProperty("uid"))
        if (
          !((message.uid && typeof message.uid.length === "number") || $util.isString(message.uid))
        )
          return "uid: buffer expected";
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      return null;
    };

    /**
     * Creates a TimeLimitedAccessStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TimeLimitedAccessStatus} TimeLimitedAccessStatus
     */
    TimeLimitedAccessStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TimeLimitedAccessStatus) return object;
      let message = new $root.Records.TimeLimitedAccessStatus();
      if (object.uid != null)
        if (typeof object.uid === "string")
          $util.base64.decode(
            object.uid,
            (message.uid = $util.newBuffer($util.base64.length(object.uid))),
            0,
          );
        else if (object.uid.length >= 0) message.uid = object.uid;
      if (object.message != null) message.message = String(object.message);
      return message;
    };

    /**
     * Creates a plain object from a TimeLimitedAccessStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {Records.TimeLimitedAccessStatus} message TimeLimitedAccessStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TimeLimitedAccessStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.uid = "";
        else {
          object.uid = [];
          if (options.bytes !== Array) object.uid = $util.newBuffer(object.uid);
        }
        object.message = "";
      }
      if (message.uid != null && message.hasOwnProperty("uid"))
        object.uid =
          options.bytes === String
            ? $util.base64.encode(message.uid, 0, message.uid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.uid)
              : message.uid;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      return object;
    };

    /**
     * Converts this TimeLimitedAccessStatus to JSON.
     * @function toJSON
     * @memberof Records.TimeLimitedAccessStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TimeLimitedAccessStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TimeLimitedAccessStatus
     * @function getTypeUrl
     * @memberof Records.TimeLimitedAccessStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TimeLimitedAccessStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TimeLimitedAccessStatus";
    };

    return TimeLimitedAccessStatus;
  })();

  Records.TimeLimitedAccessResponse = (function () {
    /**
     * Properties of a TimeLimitedAccessResponse.
     * @memberof Records
     * @interface ITimeLimitedAccessResponse
     * @property {number|Long|null} [revision] TimeLimitedAccessResponse revision
     * @property {Array.<Records.ITimeLimitedAccessStatus>|null} [userAccessStatus] TimeLimitedAccessResponse userAccessStatus
     * @property {Array.<Records.ITimeLimitedAccessStatus>|null} [teamAccessStatus] TimeLimitedAccessResponse teamAccessStatus
     * @property {Array.<Records.ITimeLimitedAccessStatus>|null} [recordAccessStatus] TimeLimitedAccessResponse recordAccessStatus
     */

    /**
     * Constructs a new TimeLimitedAccessResponse.
     * @memberof Records
     * @classdesc Represents a TimeLimitedAccessResponse.
     * @implements ITimeLimitedAccessResponse
     * @constructor
     * @param {Records.ITimeLimitedAccessResponse=} [properties] Properties to set
     */
    function TimeLimitedAccessResponse(properties) {
      this.userAccessStatus = [];
      this.teamAccessStatus = [];
      this.recordAccessStatus = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * TimeLimitedAccessResponse revision.
     * @member {number|Long} revision
     * @memberof Records.TimeLimitedAccessResponse
     * @instance
     */
    TimeLimitedAccessResponse.prototype.revision = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * TimeLimitedAccessResponse userAccessStatus.
     * @member {Array.<Records.ITimeLimitedAccessStatus>} userAccessStatus
     * @memberof Records.TimeLimitedAccessResponse
     * @instance
     */
    TimeLimitedAccessResponse.prototype.userAccessStatus = $util.emptyArray;

    /**
     * TimeLimitedAccessResponse teamAccessStatus.
     * @member {Array.<Records.ITimeLimitedAccessStatus>} teamAccessStatus
     * @memberof Records.TimeLimitedAccessResponse
     * @instance
     */
    TimeLimitedAccessResponse.prototype.teamAccessStatus = $util.emptyArray;

    /**
     * TimeLimitedAccessResponse recordAccessStatus.
     * @member {Array.<Records.ITimeLimitedAccessStatus>} recordAccessStatus
     * @memberof Records.TimeLimitedAccessResponse
     * @instance
     */
    TimeLimitedAccessResponse.prototype.recordAccessStatus = $util.emptyArray;

    /**
     * Creates a new TimeLimitedAccessResponse instance using the specified properties.
     * @function create
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Records.ITimeLimitedAccessResponse=} [properties] Properties to set
     * @returns {Records.TimeLimitedAccessResponse} TimeLimitedAccessResponse instance
     */
    TimeLimitedAccessResponse.create = function create(properties) {
      return new TimeLimitedAccessResponse(properties);
    };

    /**
     * Encodes the specified TimeLimitedAccessResponse message. Does not implicitly {@link Records.TimeLimitedAccessResponse.verify|verify} messages.
     * @function encode
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Records.ITimeLimitedAccessResponse} message TimeLimitedAccessResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.revision != null && Object.hasOwnProperty.call(message, "revision"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.revision);
      if (message.userAccessStatus != null && message.userAccessStatus.length)
        for (let i = 0; i < message.userAccessStatus.length; ++i)
          $root.Records.TimeLimitedAccessStatus.encode(
            message.userAccessStatus[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.teamAccessStatus != null && message.teamAccessStatus.length)
        for (let i = 0; i < message.teamAccessStatus.length; ++i)
          $root.Records.TimeLimitedAccessStatus.encode(
            message.teamAccessStatus[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.recordAccessStatus != null && message.recordAccessStatus.length)
        for (let i = 0; i < message.recordAccessStatus.length; ++i)
          $root.Records.TimeLimitedAccessStatus.encode(
            message.recordAccessStatus[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified TimeLimitedAccessResponse message, length delimited. Does not implicitly {@link Records.TimeLimitedAccessResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Records.ITimeLimitedAccessResponse} message TimeLimitedAccessResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimeLimitedAccessResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TimeLimitedAccessResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Records.TimeLimitedAccessResponse} TimeLimitedAccessResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Records.TimeLimitedAccessResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.revision = reader.int64();
            break;
          }
          case 2: {
            if (!(message.userAccessStatus && message.userAccessStatus.length))
              message.userAccessStatus = [];
            message.userAccessStatus.push(
              $root.Records.TimeLimitedAccessStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          case 3: {
            if (!(message.teamAccessStatus && message.teamAccessStatus.length))
              message.teamAccessStatus = [];
            message.teamAccessStatus.push(
              $root.Records.TimeLimitedAccessStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          case 4: {
            if (!(message.recordAccessStatus && message.recordAccessStatus.length))
              message.recordAccessStatus = [];
            message.recordAccessStatus.push(
              $root.Records.TimeLimitedAccessStatus.decode(reader, reader.uint32()),
            );
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    };

    /**
     * Decodes a TimeLimitedAccessResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Records.TimeLimitedAccessResponse} TimeLimitedAccessResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimeLimitedAccessResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TimeLimitedAccessResponse message.
     * @function verify
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TimeLimitedAccessResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (
          !$util.isInteger(message.revision) &&
          !(
            message.revision &&
            $util.isInteger(message.revision.low) &&
            $util.isInteger(message.revision.high)
          )
        )
          return "revision: integer|Long expected";
      if (message.userAccessStatus != null && message.hasOwnProperty("userAccessStatus")) {
        if (!Array.isArray(message.userAccessStatus)) return "userAccessStatus: array expected";
        for (let i = 0; i < message.userAccessStatus.length; ++i) {
          let error = $root.Records.TimeLimitedAccessStatus.verify(message.userAccessStatus[i]);
          if (error) return "userAccessStatus." + error;
        }
      }
      if (message.teamAccessStatus != null && message.hasOwnProperty("teamAccessStatus")) {
        if (!Array.isArray(message.teamAccessStatus)) return "teamAccessStatus: array expected";
        for (let i = 0; i < message.teamAccessStatus.length; ++i) {
          let error = $root.Records.TimeLimitedAccessStatus.verify(message.teamAccessStatus[i]);
          if (error) return "teamAccessStatus." + error;
        }
      }
      if (message.recordAccessStatus != null && message.hasOwnProperty("recordAccessStatus")) {
        if (!Array.isArray(message.recordAccessStatus)) return "recordAccessStatus: array expected";
        for (let i = 0; i < message.recordAccessStatus.length; ++i) {
          let error = $root.Records.TimeLimitedAccessStatus.verify(message.recordAccessStatus[i]);
          if (error) return "recordAccessStatus." + error;
        }
      }
      return null;
    };

    /**
     * Creates a TimeLimitedAccessResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Records.TimeLimitedAccessResponse} TimeLimitedAccessResponse
     */
    TimeLimitedAccessResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Records.TimeLimitedAccessResponse) return object;
      let message = new $root.Records.TimeLimitedAccessResponse();
      if (object.revision != null)
        if ($util.Long) (message.revision = $util.Long.fromValue(object.revision)).unsigned = false;
        else if (typeof object.revision === "string")
          message.revision = parseInt(object.revision, 10);
        else if (typeof object.revision === "number") message.revision = object.revision;
        else if (typeof object.revision === "object")
          message.revision = new $util.LongBits(
            object.revision.low >>> 0,
            object.revision.high >>> 0,
          ).toNumber();
      if (object.userAccessStatus) {
        if (!Array.isArray(object.userAccessStatus))
          throw TypeError(".Records.TimeLimitedAccessResponse.userAccessStatus: array expected");
        message.userAccessStatus = [];
        for (let i = 0; i < object.userAccessStatus.length; ++i) {
          if (typeof object.userAccessStatus[i] !== "object")
            throw TypeError(".Records.TimeLimitedAccessResponse.userAccessStatus: object expected");
          message.userAccessStatus[i] = $root.Records.TimeLimitedAccessStatus.fromObject(
            object.userAccessStatus[i],
          );
        }
      }
      if (object.teamAccessStatus) {
        if (!Array.isArray(object.teamAccessStatus))
          throw TypeError(".Records.TimeLimitedAccessResponse.teamAccessStatus: array expected");
        message.teamAccessStatus = [];
        for (let i = 0; i < object.teamAccessStatus.length; ++i) {
          if (typeof object.teamAccessStatus[i] !== "object")
            throw TypeError(".Records.TimeLimitedAccessResponse.teamAccessStatus: object expected");
          message.teamAccessStatus[i] = $root.Records.TimeLimitedAccessStatus.fromObject(
            object.teamAccessStatus[i],
          );
        }
      }
      if (object.recordAccessStatus) {
        if (!Array.isArray(object.recordAccessStatus))
          throw TypeError(".Records.TimeLimitedAccessResponse.recordAccessStatus: array expected");
        message.recordAccessStatus = [];
        for (let i = 0; i < object.recordAccessStatus.length; ++i) {
          if (typeof object.recordAccessStatus[i] !== "object")
            throw TypeError(
              ".Records.TimeLimitedAccessResponse.recordAccessStatus: object expected",
            );
          message.recordAccessStatus[i] = $root.Records.TimeLimitedAccessStatus.fromObject(
            object.recordAccessStatus[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a TimeLimitedAccessResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {Records.TimeLimitedAccessResponse} message TimeLimitedAccessResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TimeLimitedAccessResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.userAccessStatus = [];
        object.teamAccessStatus = [];
        object.recordAccessStatus = [];
      }
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.revision =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.revision = options.longs === String ? "0" : 0;
      if (message.revision != null && message.hasOwnProperty("revision"))
        if (typeof message.revision === "number")
          object.revision = options.longs === String ? String(message.revision) : message.revision;
        else
          object.revision =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.revision)
              : options.longs === Number
                ? new $util.LongBits(
                    message.revision.low >>> 0,
                    message.revision.high >>> 0,
                  ).toNumber()
                : message.revision;
      if (message.userAccessStatus && message.userAccessStatus.length) {
        object.userAccessStatus = [];
        for (let j = 0; j < message.userAccessStatus.length; ++j)
          object.userAccessStatus[j] = $root.Records.TimeLimitedAccessStatus.toObject(
            message.userAccessStatus[j],
            options,
          );
      }
      if (message.teamAccessStatus && message.teamAccessStatus.length) {
        object.teamAccessStatus = [];
        for (let j = 0; j < message.teamAccessStatus.length; ++j)
          object.teamAccessStatus[j] = $root.Records.TimeLimitedAccessStatus.toObject(
            message.teamAccessStatus[j],
            options,
          );
      }
      if (message.recordAccessStatus && message.recordAccessStatus.length) {
        object.recordAccessStatus = [];
        for (let j = 0; j < message.recordAccessStatus.length; ++j)
          object.recordAccessStatus[j] = $root.Records.TimeLimitedAccessStatus.toObject(
            message.recordAccessStatus[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this TimeLimitedAccessResponse to JSON.
     * @function toJSON
     * @memberof Records.TimeLimitedAccessResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TimeLimitedAccessResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for TimeLimitedAccessResponse
     * @function getTypeUrl
     * @memberof Records.TimeLimitedAccessResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    TimeLimitedAccessResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Records.TimeLimitedAccessResponse";
    };

    return TimeLimitedAccessResponse;
  })();

  return Records;
})());

export { $root as default };
