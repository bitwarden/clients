/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const Push = ($root.Push = (() => {
  /**
   * Namespace Push.
   * @exports Push
   * @namespace
   */
  const Push = {};

  /**
   * MessageType enum.
   * @name Push.MessageType
   * @enum {number}
   * @property {number} UNKNOWN=0 UNKNOWN value
   * @property {number} DNA=1 DNA value
   * @property {number} SSO=2 SSO value
   * @property {number} CHAT=3 CHAT value
   * @property {number} USER=4 USER value
   * @property {number} ENTERPRISE=5 ENTERPRISE value
   * @property {number} KEEPER=6 KEEPER value
   * @property {number} SESSION=7 SESSION value
   * @property {number} DEVICE=8 DEVICE value
   * @property {number} TOTP=9 TOTP value
   */
  Push.MessageType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "UNKNOWN")] = 0;
    values[(valuesById[1] = "DNA")] = 1;
    values[(valuesById[2] = "SSO")] = 2;
    values[(valuesById[3] = "CHAT")] = 3;
    values[(valuesById[4] = "USER")] = 4;
    values[(valuesById[5] = "ENTERPRISE")] = 5;
    values[(valuesById[6] = "KEEPER")] = 6;
    values[(valuesById[7] = "SESSION")] = 7;
    values[(valuesById[8] = "DEVICE")] = 8;
    values[(valuesById[9] = "TOTP")] = 9;
    return values;
  })();

  Push.UserRegistrationRequest = (function () {
    /**
     * Properties of a UserRegistrationRequest.
     * @memberof Push
     * @interface IUserRegistrationRequest
     * @property {Uint8Array|null} [messageSessionUid] UserRegistrationRequest messageSessionUid
     * @property {number|null} [userId] UserRegistrationRequest userId
     * @property {number|null} [enterpriseId] UserRegistrationRequest enterpriseId
     */

    /**
     * Constructs a new UserRegistrationRequest.
     * @memberof Push
     * @classdesc Represents a UserRegistrationRequest.
     * @implements IUserRegistrationRequest
     * @constructor
     * @param {Push.IUserRegistrationRequest=} [properties] Properties to set
     */
    function UserRegistrationRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserRegistrationRequest messageSessionUid.
     * @member {Uint8Array} messageSessionUid
     * @memberof Push.UserRegistrationRequest
     * @instance
     */
    UserRegistrationRequest.prototype.messageSessionUid = $util.newBuffer([]);

    /**
     * UserRegistrationRequest userId.
     * @member {number} userId
     * @memberof Push.UserRegistrationRequest
     * @instance
     */
    UserRegistrationRequest.prototype.userId = 0;

    /**
     * UserRegistrationRequest enterpriseId.
     * @member {number} enterpriseId
     * @memberof Push.UserRegistrationRequest
     * @instance
     */
    UserRegistrationRequest.prototype.enterpriseId = 0;

    /**
     * Creates a new UserRegistrationRequest instance using the specified properties.
     * @function create
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Push.IUserRegistrationRequest=} [properties] Properties to set
     * @returns {Push.UserRegistrationRequest} UserRegistrationRequest instance
     */
    UserRegistrationRequest.create = function create(properties) {
      return new UserRegistrationRequest(properties);
    };

    /**
     * Encodes the specified UserRegistrationRequest message. Does not implicitly {@link Push.UserRegistrationRequest.verify|verify} messages.
     * @function encode
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Push.IUserRegistrationRequest} message UserRegistrationRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserRegistrationRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.messageSessionUid != null &&
        Object.hasOwnProperty.call(message, "messageSessionUid")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.messageSessionUid);
      if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.userId);
      if (message.enterpriseId != null && Object.hasOwnProperty.call(message, "enterpriseId"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.enterpriseId);
      return writer;
    };

    /**
     * Encodes the specified UserRegistrationRequest message, length delimited. Does not implicitly {@link Push.UserRegistrationRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Push.IUserRegistrationRequest} message UserRegistrationRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserRegistrationRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserRegistrationRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.UserRegistrationRequest} UserRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserRegistrationRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.UserRegistrationRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.messageSessionUid = reader.bytes();
            break;
          }
          case 2: {
            message.userId = reader.int32();
            break;
          }
          case 3: {
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
     * Decodes a UserRegistrationRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.UserRegistrationRequest} UserRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserRegistrationRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserRegistrationRequest message.
     * @function verify
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserRegistrationRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        if (
          !(
            (message.messageSessionUid && typeof message.messageSessionUid.length === "number") ||
            $util.isString(message.messageSessionUid)
          )
        )
          return "messageSessionUid: buffer expected";
      if (message.userId != null && message.hasOwnProperty("userId"))
        if (!$util.isInteger(message.userId)) return "userId: integer expected";
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        if (!$util.isInteger(message.enterpriseId)) return "enterpriseId: integer expected";
      return null;
    };

    /**
     * Creates a UserRegistrationRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.UserRegistrationRequest} UserRegistrationRequest
     */
    UserRegistrationRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.UserRegistrationRequest) return object;
      let message = new $root.Push.UserRegistrationRequest();
      if (object.messageSessionUid != null)
        if (typeof object.messageSessionUid === "string")
          $util.base64.decode(
            object.messageSessionUid,
            (message.messageSessionUid = $util.newBuffer(
              $util.base64.length(object.messageSessionUid),
            )),
            0,
          );
        else if (object.messageSessionUid.length >= 0)
          message.messageSessionUid = object.messageSessionUid;
      if (object.userId != null) message.userId = object.userId | 0;
      if (object.enterpriseId != null) message.enterpriseId = object.enterpriseId | 0;
      return message;
    };

    /**
     * Creates a plain object from a UserRegistrationRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {Push.UserRegistrationRequest} message UserRegistrationRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserRegistrationRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.messageSessionUid = "";
        else {
          object.messageSessionUid = [];
          if (options.bytes !== Array)
            object.messageSessionUid = $util.newBuffer(object.messageSessionUid);
        }
        object.userId = 0;
        object.enterpriseId = 0;
      }
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        object.messageSessionUid =
          options.bytes === String
            ? $util.base64.encode(message.messageSessionUid, 0, message.messageSessionUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.messageSessionUid)
              : message.messageSessionUid;
      if (message.userId != null && message.hasOwnProperty("userId"))
        object.userId = message.userId;
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId"))
        object.enterpriseId = message.enterpriseId;
      return object;
    };

    /**
     * Converts this UserRegistrationRequest to JSON.
     * @function toJSON
     * @memberof Push.UserRegistrationRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserRegistrationRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UserRegistrationRequest
     * @function getTypeUrl
     * @memberof Push.UserRegistrationRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UserRegistrationRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.UserRegistrationRequest";
    };

    return UserRegistrationRequest;
  })();

  Push.KAToPushServerRequest = (function () {
    /**
     * Properties of a KAToPushServerRequest.
     * @memberof Push
     * @interface IKAToPushServerRequest
     * @property {Push.MessageType|null} [messageType] KAToPushServerRequest messageType
     * @property {string|null} [message] KAToPushServerRequest message
     * @property {Uint8Array|null} [messageSessionUid] KAToPushServerRequest messageSessionUid
     * @property {Array.<Uint8Array>|null} [encryptedDeviceToken] KAToPushServerRequest encryptedDeviceToken
     * @property {Array.<number>|null} [userId] KAToPushServerRequest userId
     * @property {Array.<number>|null} [enterpriseId] KAToPushServerRequest enterpriseId
     */

    /**
     * Constructs a new KAToPushServerRequest.
     * @memberof Push
     * @classdesc Represents a KAToPushServerRequest.
     * @implements IKAToPushServerRequest
     * @constructor
     * @param {Push.IKAToPushServerRequest=} [properties] Properties to set
     */
    function KAToPushServerRequest(properties) {
      this.encryptedDeviceToken = [];
      this.userId = [];
      this.enterpriseId = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * KAToPushServerRequest messageType.
     * @member {Push.MessageType} messageType
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.messageType = 0;

    /**
     * KAToPushServerRequest message.
     * @member {string} message
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.message = "";

    /**
     * KAToPushServerRequest messageSessionUid.
     * @member {Uint8Array} messageSessionUid
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.messageSessionUid = $util.newBuffer([]);

    /**
     * KAToPushServerRequest encryptedDeviceToken.
     * @member {Array.<Uint8Array>} encryptedDeviceToken
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.encryptedDeviceToken = $util.emptyArray;

    /**
     * KAToPushServerRequest userId.
     * @member {Array.<number>} userId
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.userId = $util.emptyArray;

    /**
     * KAToPushServerRequest enterpriseId.
     * @member {Array.<number>} enterpriseId
     * @memberof Push.KAToPushServerRequest
     * @instance
     */
    KAToPushServerRequest.prototype.enterpriseId = $util.emptyArray;

    /**
     * Creates a new KAToPushServerRequest instance using the specified properties.
     * @function create
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Push.IKAToPushServerRequest=} [properties] Properties to set
     * @returns {Push.KAToPushServerRequest} KAToPushServerRequest instance
     */
    KAToPushServerRequest.create = function create(properties) {
      return new KAToPushServerRequest(properties);
    };

    /**
     * Encodes the specified KAToPushServerRequest message. Does not implicitly {@link Push.KAToPushServerRequest.verify|verify} messages.
     * @function encode
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Push.IKAToPushServerRequest} message KAToPushServerRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    KAToPushServerRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.messageType != null && Object.hasOwnProperty.call(message, "messageType"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.messageType);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.message);
      if (
        message.messageSessionUid != null &&
        Object.hasOwnProperty.call(message, "messageSessionUid")
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.messageSessionUid);
      if (message.encryptedDeviceToken != null && message.encryptedDeviceToken.length)
        for (let i = 0; i < message.encryptedDeviceToken.length; ++i)
          writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.encryptedDeviceToken[i]);
      if (message.userId != null && message.userId.length) {
        writer.uint32(/* id 5, wireType 2 =*/ 42).fork();
        for (let i = 0; i < message.userId.length; ++i) writer.int32(message.userId[i]);
        writer.ldelim();
      }
      if (message.enterpriseId != null && message.enterpriseId.length) {
        writer.uint32(/* id 6, wireType 2 =*/ 50).fork();
        for (let i = 0; i < message.enterpriseId.length; ++i) writer.int32(message.enterpriseId[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified KAToPushServerRequest message, length delimited. Does not implicitly {@link Push.KAToPushServerRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Push.IKAToPushServerRequest} message KAToPushServerRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    KAToPushServerRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a KAToPushServerRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.KAToPushServerRequest} KAToPushServerRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    KAToPushServerRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.KAToPushServerRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.messageType = reader.int32();
            break;
          }
          case 2: {
            message.message = reader.string();
            break;
          }
          case 3: {
            message.messageSessionUid = reader.bytes();
            break;
          }
          case 4: {
            if (!(message.encryptedDeviceToken && message.encryptedDeviceToken.length))
              message.encryptedDeviceToken = [];
            message.encryptedDeviceToken.push(reader.bytes());
            break;
          }
          case 5: {
            if (!(message.userId && message.userId.length)) message.userId = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.userId.push(reader.int32());
            } else message.userId.push(reader.int32());
            break;
          }
          case 6: {
            if (!(message.enterpriseId && message.enterpriseId.length)) message.enterpriseId = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.enterpriseId.push(reader.int32());
            } else message.enterpriseId.push(reader.int32());
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
     * Decodes a KAToPushServerRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.KAToPushServerRequest} KAToPushServerRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    KAToPushServerRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a KAToPushServerRequest message.
     * @function verify
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    KAToPushServerRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        switch (message.messageType) {
          default:
            return "messageType: enum value expected";
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
            break;
        }
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        if (
          !(
            (message.messageSessionUid && typeof message.messageSessionUid.length === "number") ||
            $util.isString(message.messageSessionUid)
          )
        )
          return "messageSessionUid: buffer expected";
      if (message.encryptedDeviceToken != null && message.hasOwnProperty("encryptedDeviceToken")) {
        if (!Array.isArray(message.encryptedDeviceToken))
          return "encryptedDeviceToken: array expected";
        for (let i = 0; i < message.encryptedDeviceToken.length; ++i)
          if (
            !(
              (message.encryptedDeviceToken[i] &&
                typeof message.encryptedDeviceToken[i].length === "number") ||
              $util.isString(message.encryptedDeviceToken[i])
            )
          )
            return "encryptedDeviceToken: buffer[] expected";
      }
      if (message.userId != null && message.hasOwnProperty("userId")) {
        if (!Array.isArray(message.userId)) return "userId: array expected";
        for (let i = 0; i < message.userId.length; ++i)
          if (!$util.isInteger(message.userId[i])) return "userId: integer[] expected";
      }
      if (message.enterpriseId != null && message.hasOwnProperty("enterpriseId")) {
        if (!Array.isArray(message.enterpriseId)) return "enterpriseId: array expected";
        for (let i = 0; i < message.enterpriseId.length; ++i)
          if (!$util.isInteger(message.enterpriseId[i])) return "enterpriseId: integer[] expected";
      }
      return null;
    };

    /**
     * Creates a KAToPushServerRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.KAToPushServerRequest} KAToPushServerRequest
     */
    KAToPushServerRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.KAToPushServerRequest) return object;
      let message = new $root.Push.KAToPushServerRequest();
      switch (object.messageType) {
        default:
          if (typeof object.messageType === "number") {
            message.messageType = object.messageType;
            break;
          }
          break;
        case "UNKNOWN":
        case 0:
          message.messageType = 0;
          break;
        case "DNA":
        case 1:
          message.messageType = 1;
          break;
        case "SSO":
        case 2:
          message.messageType = 2;
          break;
        case "CHAT":
        case 3:
          message.messageType = 3;
          break;
        case "USER":
        case 4:
          message.messageType = 4;
          break;
        case "ENTERPRISE":
        case 5:
          message.messageType = 5;
          break;
        case "KEEPER":
        case 6:
          message.messageType = 6;
          break;
        case "SESSION":
        case 7:
          message.messageType = 7;
          break;
        case "DEVICE":
        case 8:
          message.messageType = 8;
          break;
        case "TOTP":
        case 9:
          message.messageType = 9;
          break;
      }
      if (object.message != null) message.message = String(object.message);
      if (object.messageSessionUid != null)
        if (typeof object.messageSessionUid === "string")
          $util.base64.decode(
            object.messageSessionUid,
            (message.messageSessionUid = $util.newBuffer(
              $util.base64.length(object.messageSessionUid),
            )),
            0,
          );
        else if (object.messageSessionUid.length >= 0)
          message.messageSessionUid = object.messageSessionUid;
      if (object.encryptedDeviceToken) {
        if (!Array.isArray(object.encryptedDeviceToken))
          throw TypeError(".Push.KAToPushServerRequest.encryptedDeviceToken: array expected");
        message.encryptedDeviceToken = [];
        for (let i = 0; i < object.encryptedDeviceToken.length; ++i)
          if (typeof object.encryptedDeviceToken[i] === "string")
            $util.base64.decode(
              object.encryptedDeviceToken[i],
              (message.encryptedDeviceToken[i] = $util.newBuffer(
                $util.base64.length(object.encryptedDeviceToken[i]),
              )),
              0,
            );
          else if (object.encryptedDeviceToken[i].length >= 0)
            message.encryptedDeviceToken[i] = object.encryptedDeviceToken[i];
      }
      if (object.userId) {
        if (!Array.isArray(object.userId))
          throw TypeError(".Push.KAToPushServerRequest.userId: array expected");
        message.userId = [];
        for (let i = 0; i < object.userId.length; ++i) message.userId[i] = object.userId[i] | 0;
      }
      if (object.enterpriseId) {
        if (!Array.isArray(object.enterpriseId))
          throw TypeError(".Push.KAToPushServerRequest.enterpriseId: array expected");
        message.enterpriseId = [];
        for (let i = 0; i < object.enterpriseId.length; ++i)
          message.enterpriseId[i] = object.enterpriseId[i] | 0;
      }
      return message;
    };

    /**
     * Creates a plain object from a KAToPushServerRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {Push.KAToPushServerRequest} message KAToPushServerRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    KAToPushServerRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.encryptedDeviceToken = [];
        object.userId = [];
        object.enterpriseId = [];
      }
      if (options.defaults) {
        object.messageType = options.enums === String ? "UNKNOWN" : 0;
        object.message = "";
        if (options.bytes === String) object.messageSessionUid = "";
        else {
          object.messageSessionUid = [];
          if (options.bytes !== Array)
            object.messageSessionUid = $util.newBuffer(object.messageSessionUid);
        }
      }
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        object.messageType =
          options.enums === String
            ? $root.Push.MessageType[message.messageType] === undefined
              ? message.messageType
              : $root.Push.MessageType[message.messageType]
            : message.messageType;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        object.messageSessionUid =
          options.bytes === String
            ? $util.base64.encode(message.messageSessionUid, 0, message.messageSessionUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.messageSessionUid)
              : message.messageSessionUid;
      if (message.encryptedDeviceToken && message.encryptedDeviceToken.length) {
        object.encryptedDeviceToken = [];
        for (let j = 0; j < message.encryptedDeviceToken.length; ++j)
          object.encryptedDeviceToken[j] =
            options.bytes === String
              ? $util.base64.encode(
                  message.encryptedDeviceToken[j],
                  0,
                  message.encryptedDeviceToken[j].length,
                )
              : options.bytes === Array
                ? Array.prototype.slice.call(message.encryptedDeviceToken[j])
                : message.encryptedDeviceToken[j];
      }
      if (message.userId && message.userId.length) {
        object.userId = [];
        for (let j = 0; j < message.userId.length; ++j) object.userId[j] = message.userId[j];
      }
      if (message.enterpriseId && message.enterpriseId.length) {
        object.enterpriseId = [];
        for (let j = 0; j < message.enterpriseId.length; ++j)
          object.enterpriseId[j] = message.enterpriseId[j];
      }
      return object;
    };

    /**
     * Converts this KAToPushServerRequest to JSON.
     * @function toJSON
     * @memberof Push.KAToPushServerRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    KAToPushServerRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for KAToPushServerRequest
     * @function getTypeUrl
     * @memberof Push.KAToPushServerRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    KAToPushServerRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.KAToPushServerRequest";
    };

    return KAToPushServerRequest;
  })();

  Push.WssConnectionRequest = (function () {
    /**
     * Properties of a WssConnectionRequest.
     * @memberof Push
     * @interface IWssConnectionRequest
     * @property {Uint8Array|null} [messageSessionUid] WssConnectionRequest messageSessionUid
     * @property {Uint8Array|null} [encryptedDeviceToken] WssConnectionRequest encryptedDeviceToken
     * @property {number|Long|null} [deviceTimeStamp] WssConnectionRequest deviceTimeStamp
     */

    /**
     * Constructs a new WssConnectionRequest.
     * @memberof Push
     * @classdesc Represents a WssConnectionRequest.
     * @implements IWssConnectionRequest
     * @constructor
     * @param {Push.IWssConnectionRequest=} [properties] Properties to set
     */
    function WssConnectionRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * WssConnectionRequest messageSessionUid.
     * @member {Uint8Array} messageSessionUid
     * @memberof Push.WssConnectionRequest
     * @instance
     */
    WssConnectionRequest.prototype.messageSessionUid = $util.newBuffer([]);

    /**
     * WssConnectionRequest encryptedDeviceToken.
     * @member {Uint8Array} encryptedDeviceToken
     * @memberof Push.WssConnectionRequest
     * @instance
     */
    WssConnectionRequest.prototype.encryptedDeviceToken = $util.newBuffer([]);

    /**
     * WssConnectionRequest deviceTimeStamp.
     * @member {number|Long} deviceTimeStamp
     * @memberof Push.WssConnectionRequest
     * @instance
     */
    WssConnectionRequest.prototype.deviceTimeStamp = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * Creates a new WssConnectionRequest instance using the specified properties.
     * @function create
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Push.IWssConnectionRequest=} [properties] Properties to set
     * @returns {Push.WssConnectionRequest} WssConnectionRequest instance
     */
    WssConnectionRequest.create = function create(properties) {
      return new WssConnectionRequest(properties);
    };

    /**
     * Encodes the specified WssConnectionRequest message. Does not implicitly {@link Push.WssConnectionRequest.verify|verify} messages.
     * @function encode
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Push.IWssConnectionRequest} message WssConnectionRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    WssConnectionRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.messageSessionUid != null &&
        Object.hasOwnProperty.call(message, "messageSessionUid")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.messageSessionUid);
      if (
        message.encryptedDeviceToken != null &&
        Object.hasOwnProperty.call(message, "encryptedDeviceToken")
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.encryptedDeviceToken);
      if (message.deviceTimeStamp != null && Object.hasOwnProperty.call(message, "deviceTimeStamp"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.deviceTimeStamp);
      return writer;
    };

    /**
     * Encodes the specified WssConnectionRequest message, length delimited. Does not implicitly {@link Push.WssConnectionRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Push.IWssConnectionRequest} message WssConnectionRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    WssConnectionRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a WssConnectionRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.WssConnectionRequest} WssConnectionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    WssConnectionRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.WssConnectionRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.messageSessionUid = reader.bytes();
            break;
          }
          case 2: {
            message.encryptedDeviceToken = reader.bytes();
            break;
          }
          case 3: {
            message.deviceTimeStamp = reader.int64();
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
     * Decodes a WssConnectionRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.WssConnectionRequest} WssConnectionRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    WssConnectionRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a WssConnectionRequest message.
     * @function verify
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    WssConnectionRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        if (
          !(
            (message.messageSessionUid && typeof message.messageSessionUid.length === "number") ||
            $util.isString(message.messageSessionUid)
          )
        )
          return "messageSessionUid: buffer expected";
      if (message.encryptedDeviceToken != null && message.hasOwnProperty("encryptedDeviceToken"))
        if (
          !(
            (message.encryptedDeviceToken &&
              typeof message.encryptedDeviceToken.length === "number") ||
            $util.isString(message.encryptedDeviceToken)
          )
        )
          return "encryptedDeviceToken: buffer expected";
      if (message.deviceTimeStamp != null && message.hasOwnProperty("deviceTimeStamp"))
        if (
          !$util.isInteger(message.deviceTimeStamp) &&
          !(
            message.deviceTimeStamp &&
            $util.isInteger(message.deviceTimeStamp.low) &&
            $util.isInteger(message.deviceTimeStamp.high)
          )
        )
          return "deviceTimeStamp: integer|Long expected";
      return null;
    };

    /**
     * Creates a WssConnectionRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.WssConnectionRequest} WssConnectionRequest
     */
    WssConnectionRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.WssConnectionRequest) return object;
      let message = new $root.Push.WssConnectionRequest();
      if (object.messageSessionUid != null)
        if (typeof object.messageSessionUid === "string")
          $util.base64.decode(
            object.messageSessionUid,
            (message.messageSessionUid = $util.newBuffer(
              $util.base64.length(object.messageSessionUid),
            )),
            0,
          );
        else if (object.messageSessionUid.length >= 0)
          message.messageSessionUid = object.messageSessionUid;
      if (object.encryptedDeviceToken != null)
        if (typeof object.encryptedDeviceToken === "string")
          $util.base64.decode(
            object.encryptedDeviceToken,
            (message.encryptedDeviceToken = $util.newBuffer(
              $util.base64.length(object.encryptedDeviceToken),
            )),
            0,
          );
        else if (object.encryptedDeviceToken.length >= 0)
          message.encryptedDeviceToken = object.encryptedDeviceToken;
      if (object.deviceTimeStamp != null)
        if ($util.Long)
          (message.deviceTimeStamp = $util.Long.fromValue(object.deviceTimeStamp)).unsigned = false;
        else if (typeof object.deviceTimeStamp === "string")
          message.deviceTimeStamp = parseInt(object.deviceTimeStamp, 10);
        else if (typeof object.deviceTimeStamp === "number")
          message.deviceTimeStamp = object.deviceTimeStamp;
        else if (typeof object.deviceTimeStamp === "object")
          message.deviceTimeStamp = new $util.LongBits(
            object.deviceTimeStamp.low >>> 0,
            object.deviceTimeStamp.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a WssConnectionRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {Push.WssConnectionRequest} message WssConnectionRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    WssConnectionRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.messageSessionUid = "";
        else {
          object.messageSessionUid = [];
          if (options.bytes !== Array)
            object.messageSessionUid = $util.newBuffer(object.messageSessionUid);
        }
        if (options.bytes === String) object.encryptedDeviceToken = "";
        else {
          object.encryptedDeviceToken = [];
          if (options.bytes !== Array)
            object.encryptedDeviceToken = $util.newBuffer(object.encryptedDeviceToken);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.deviceTimeStamp =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.deviceTimeStamp = options.longs === String ? "0" : 0;
      }
      if (message.messageSessionUid != null && message.hasOwnProperty("messageSessionUid"))
        object.messageSessionUid =
          options.bytes === String
            ? $util.base64.encode(message.messageSessionUid, 0, message.messageSessionUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.messageSessionUid)
              : message.messageSessionUid;
      if (message.encryptedDeviceToken != null && message.hasOwnProperty("encryptedDeviceToken"))
        object.encryptedDeviceToken =
          options.bytes === String
            ? $util.base64.encode(
                message.encryptedDeviceToken,
                0,
                message.encryptedDeviceToken.length,
              )
            : options.bytes === Array
              ? Array.prototype.slice.call(message.encryptedDeviceToken)
              : message.encryptedDeviceToken;
      if (message.deviceTimeStamp != null && message.hasOwnProperty("deviceTimeStamp"))
        if (typeof message.deviceTimeStamp === "number")
          object.deviceTimeStamp =
            options.longs === String ? String(message.deviceTimeStamp) : message.deviceTimeStamp;
        else
          object.deviceTimeStamp =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.deviceTimeStamp)
              : options.longs === Number
                ? new $util.LongBits(
                    message.deviceTimeStamp.low >>> 0,
                    message.deviceTimeStamp.high >>> 0,
                  ).toNumber()
                : message.deviceTimeStamp;
      return object;
    };

    /**
     * Converts this WssConnectionRequest to JSON.
     * @function toJSON
     * @memberof Push.WssConnectionRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    WssConnectionRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for WssConnectionRequest
     * @function getTypeUrl
     * @memberof Push.WssConnectionRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    WssConnectionRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.WssConnectionRequest";
    };

    return WssConnectionRequest;
  })();

  Push.WssClientResponse = (function () {
    /**
     * Properties of a WssClientResponse.
     * @memberof Push
     * @interface IWssClientResponse
     * @property {Push.MessageType|null} [messageType] WssClientResponse messageType
     * @property {string|null} [message] WssClientResponse message
     */

    /**
     * Constructs a new WssClientResponse.
     * @memberof Push
     * @classdesc Represents a WssClientResponse.
     * @implements IWssClientResponse
     * @constructor
     * @param {Push.IWssClientResponse=} [properties] Properties to set
     */
    function WssClientResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * WssClientResponse messageType.
     * @member {Push.MessageType} messageType
     * @memberof Push.WssClientResponse
     * @instance
     */
    WssClientResponse.prototype.messageType = 0;

    /**
     * WssClientResponse message.
     * @member {string} message
     * @memberof Push.WssClientResponse
     * @instance
     */
    WssClientResponse.prototype.message = "";

    /**
     * Creates a new WssClientResponse instance using the specified properties.
     * @function create
     * @memberof Push.WssClientResponse
     * @static
     * @param {Push.IWssClientResponse=} [properties] Properties to set
     * @returns {Push.WssClientResponse} WssClientResponse instance
     */
    WssClientResponse.create = function create(properties) {
      return new WssClientResponse(properties);
    };

    /**
     * Encodes the specified WssClientResponse message. Does not implicitly {@link Push.WssClientResponse.verify|verify} messages.
     * @function encode
     * @memberof Push.WssClientResponse
     * @static
     * @param {Push.IWssClientResponse} message WssClientResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    WssClientResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.messageType != null && Object.hasOwnProperty.call(message, "messageType"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.messageType);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.message);
      return writer;
    };

    /**
     * Encodes the specified WssClientResponse message, length delimited. Does not implicitly {@link Push.WssClientResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.WssClientResponse
     * @static
     * @param {Push.IWssClientResponse} message WssClientResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    WssClientResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a WssClientResponse message from the specified reader or buffer.
     * @function decode
     * @memberof Push.WssClientResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.WssClientResponse} WssClientResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    WssClientResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.WssClientResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.messageType = reader.int32();
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
     * Decodes a WssClientResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.WssClientResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.WssClientResponse} WssClientResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    WssClientResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a WssClientResponse message.
     * @function verify
     * @memberof Push.WssClientResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    WssClientResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        switch (message.messageType) {
          default:
            return "messageType: enum value expected";
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
            break;
        }
      if (message.message != null && message.hasOwnProperty("message"))
        if (!$util.isString(message.message)) return "message: string expected";
      return null;
    };

    /**
     * Creates a WssClientResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.WssClientResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.WssClientResponse} WssClientResponse
     */
    WssClientResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.WssClientResponse) return object;
      let message = new $root.Push.WssClientResponse();
      switch (object.messageType) {
        default:
          if (typeof object.messageType === "number") {
            message.messageType = object.messageType;
            break;
          }
          break;
        case "UNKNOWN":
        case 0:
          message.messageType = 0;
          break;
        case "DNA":
        case 1:
          message.messageType = 1;
          break;
        case "SSO":
        case 2:
          message.messageType = 2;
          break;
        case "CHAT":
        case 3:
          message.messageType = 3;
          break;
        case "USER":
        case 4:
          message.messageType = 4;
          break;
        case "ENTERPRISE":
        case 5:
          message.messageType = 5;
          break;
        case "KEEPER":
        case 6:
          message.messageType = 6;
          break;
        case "SESSION":
        case 7:
          message.messageType = 7;
          break;
        case "DEVICE":
        case 8:
          message.messageType = 8;
          break;
        case "TOTP":
        case 9:
          message.messageType = 9;
          break;
      }
      if (object.message != null) message.message = String(object.message);
      return message;
    };

    /**
     * Creates a plain object from a WssClientResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.WssClientResponse
     * @static
     * @param {Push.WssClientResponse} message WssClientResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    WssClientResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.messageType = options.enums === String ? "UNKNOWN" : 0;
        object.message = "";
      }
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        object.messageType =
          options.enums === String
            ? $root.Push.MessageType[message.messageType] === undefined
              ? message.messageType
              : $root.Push.MessageType[message.messageType]
            : message.messageType;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message = message.message;
      return object;
    };

    /**
     * Converts this WssClientResponse to JSON.
     * @function toJSON
     * @memberof Push.WssClientResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    WssClientResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for WssClientResponse
     * @function getTypeUrl
     * @memberof Push.WssClientResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    WssClientResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.WssClientResponse";
    };

    return WssClientResponse;
  })();

  Push.PushServerDeviceRegistrationRequest = (function () {
    /**
     * Properties of a PushServerDeviceRegistrationRequest.
     * @memberof Push
     * @interface IPushServerDeviceRegistrationRequest
     * @property {Uint8Array|null} [encryptedDeviceToken] PushServerDeviceRegistrationRequest encryptedDeviceToken
     * @property {string|null} [pushToken] PushServerDeviceRegistrationRequest pushToken
     * @property {string|null} [mobilePushPlatform] PushServerDeviceRegistrationRequest mobilePushPlatform
     * @property {Uint8Array|null} [transmissionKey] PushServerDeviceRegistrationRequest transmissionKey
     */

    /**
     * Constructs a new PushServerDeviceRegistrationRequest.
     * @memberof Push
     * @classdesc Represents a PushServerDeviceRegistrationRequest.
     * @implements IPushServerDeviceRegistrationRequest
     * @constructor
     * @param {Push.IPushServerDeviceRegistrationRequest=} [properties] Properties to set
     */
    function PushServerDeviceRegistrationRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * PushServerDeviceRegistrationRequest encryptedDeviceToken.
     * @member {Uint8Array} encryptedDeviceToken
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @instance
     */
    PushServerDeviceRegistrationRequest.prototype.encryptedDeviceToken = $util.newBuffer([]);

    /**
     * PushServerDeviceRegistrationRequest pushToken.
     * @member {string} pushToken
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @instance
     */
    PushServerDeviceRegistrationRequest.prototype.pushToken = "";

    /**
     * PushServerDeviceRegistrationRequest mobilePushPlatform.
     * @member {string} mobilePushPlatform
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @instance
     */
    PushServerDeviceRegistrationRequest.prototype.mobilePushPlatform = "";

    /**
     * PushServerDeviceRegistrationRequest transmissionKey.
     * @member {Uint8Array} transmissionKey
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @instance
     */
    PushServerDeviceRegistrationRequest.prototype.transmissionKey = $util.newBuffer([]);

    /**
     * Creates a new PushServerDeviceRegistrationRequest instance using the specified properties.
     * @function create
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Push.IPushServerDeviceRegistrationRequest=} [properties] Properties to set
     * @returns {Push.PushServerDeviceRegistrationRequest} PushServerDeviceRegistrationRequest instance
     */
    PushServerDeviceRegistrationRequest.create = function create(properties) {
      return new PushServerDeviceRegistrationRequest(properties);
    };

    /**
     * Encodes the specified PushServerDeviceRegistrationRequest message. Does not implicitly {@link Push.PushServerDeviceRegistrationRequest.verify|verify} messages.
     * @function encode
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Push.IPushServerDeviceRegistrationRequest} message PushServerDeviceRegistrationRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PushServerDeviceRegistrationRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.encryptedDeviceToken != null &&
        Object.hasOwnProperty.call(message, "encryptedDeviceToken")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.encryptedDeviceToken);
      if (message.pushToken != null && Object.hasOwnProperty.call(message, "pushToken"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.pushToken);
      if (
        message.mobilePushPlatform != null &&
        Object.hasOwnProperty.call(message, "mobilePushPlatform")
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.mobilePushPlatform);
      if (message.transmissionKey != null && Object.hasOwnProperty.call(message, "transmissionKey"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.transmissionKey);
      return writer;
    };

    /**
     * Encodes the specified PushServerDeviceRegistrationRequest message, length delimited. Does not implicitly {@link Push.PushServerDeviceRegistrationRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Push.IPushServerDeviceRegistrationRequest} message PushServerDeviceRegistrationRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PushServerDeviceRegistrationRequest.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a PushServerDeviceRegistrationRequest message from the specified reader or buffer.
     * @function decode
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.PushServerDeviceRegistrationRequest} PushServerDeviceRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PushServerDeviceRegistrationRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.PushServerDeviceRegistrationRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.encryptedDeviceToken = reader.bytes();
            break;
          }
          case 2: {
            message.pushToken = reader.string();
            break;
          }
          case 3: {
            message.mobilePushPlatform = reader.string();
            break;
          }
          case 4: {
            message.transmissionKey = reader.bytes();
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
     * Decodes a PushServerDeviceRegistrationRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.PushServerDeviceRegistrationRequest} PushServerDeviceRegistrationRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PushServerDeviceRegistrationRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a PushServerDeviceRegistrationRequest message.
     * @function verify
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    PushServerDeviceRegistrationRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.encryptedDeviceToken != null && message.hasOwnProperty("encryptedDeviceToken"))
        if (
          !(
            (message.encryptedDeviceToken &&
              typeof message.encryptedDeviceToken.length === "number") ||
            $util.isString(message.encryptedDeviceToken)
          )
        )
          return "encryptedDeviceToken: buffer expected";
      if (message.pushToken != null && message.hasOwnProperty("pushToken"))
        if (!$util.isString(message.pushToken)) return "pushToken: string expected";
      if (message.mobilePushPlatform != null && message.hasOwnProperty("mobilePushPlatform"))
        if (!$util.isString(message.mobilePushPlatform))
          return "mobilePushPlatform: string expected";
      if (message.transmissionKey != null && message.hasOwnProperty("transmissionKey"))
        if (
          !(
            (message.transmissionKey && typeof message.transmissionKey.length === "number") ||
            $util.isString(message.transmissionKey)
          )
        )
          return "transmissionKey: buffer expected";
      return null;
    };

    /**
     * Creates a PushServerDeviceRegistrationRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.PushServerDeviceRegistrationRequest} PushServerDeviceRegistrationRequest
     */
    PushServerDeviceRegistrationRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.PushServerDeviceRegistrationRequest) return object;
      let message = new $root.Push.PushServerDeviceRegistrationRequest();
      if (object.encryptedDeviceToken != null)
        if (typeof object.encryptedDeviceToken === "string")
          $util.base64.decode(
            object.encryptedDeviceToken,
            (message.encryptedDeviceToken = $util.newBuffer(
              $util.base64.length(object.encryptedDeviceToken),
            )),
            0,
          );
        else if (object.encryptedDeviceToken.length >= 0)
          message.encryptedDeviceToken = object.encryptedDeviceToken;
      if (object.pushToken != null) message.pushToken = String(object.pushToken);
      if (object.mobilePushPlatform != null)
        message.mobilePushPlatform = String(object.mobilePushPlatform);
      if (object.transmissionKey != null)
        if (typeof object.transmissionKey === "string")
          $util.base64.decode(
            object.transmissionKey,
            (message.transmissionKey = $util.newBuffer(
              $util.base64.length(object.transmissionKey),
            )),
            0,
          );
        else if (object.transmissionKey.length >= 0)
          message.transmissionKey = object.transmissionKey;
      return message;
    };

    /**
     * Creates a plain object from a PushServerDeviceRegistrationRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {Push.PushServerDeviceRegistrationRequest} message PushServerDeviceRegistrationRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    PushServerDeviceRegistrationRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.encryptedDeviceToken = "";
        else {
          object.encryptedDeviceToken = [];
          if (options.bytes !== Array)
            object.encryptedDeviceToken = $util.newBuffer(object.encryptedDeviceToken);
        }
        object.pushToken = "";
        object.mobilePushPlatform = "";
        if (options.bytes === String) object.transmissionKey = "";
        else {
          object.transmissionKey = [];
          if (options.bytes !== Array)
            object.transmissionKey = $util.newBuffer(object.transmissionKey);
        }
      }
      if (message.encryptedDeviceToken != null && message.hasOwnProperty("encryptedDeviceToken"))
        object.encryptedDeviceToken =
          options.bytes === String
            ? $util.base64.encode(
                message.encryptedDeviceToken,
                0,
                message.encryptedDeviceToken.length,
              )
            : options.bytes === Array
              ? Array.prototype.slice.call(message.encryptedDeviceToken)
              : message.encryptedDeviceToken;
      if (message.pushToken != null && message.hasOwnProperty("pushToken"))
        object.pushToken = message.pushToken;
      if (message.mobilePushPlatform != null && message.hasOwnProperty("mobilePushPlatform"))
        object.mobilePushPlatform = message.mobilePushPlatform;
      if (message.transmissionKey != null && message.hasOwnProperty("transmissionKey"))
        object.transmissionKey =
          options.bytes === String
            ? $util.base64.encode(message.transmissionKey, 0, message.transmissionKey.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.transmissionKey)
              : message.transmissionKey;
      return object;
    };

    /**
     * Converts this PushServerDeviceRegistrationRequest to JSON.
     * @function toJSON
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    PushServerDeviceRegistrationRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for PushServerDeviceRegistrationRequest
     * @function getTypeUrl
     * @memberof Push.PushServerDeviceRegistrationRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    PushServerDeviceRegistrationRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.PushServerDeviceRegistrationRequest";
    };

    return PushServerDeviceRegistrationRequest;
  })();

  Push.SnsMessage = (function () {
    /**
     * Properties of a SnsMessage.
     * @memberof Push
     * @interface ISnsMessage
     * @property {Push.MessageType|null} [messageType] SnsMessage messageType
     * @property {Uint8Array|null} [message] SnsMessage message
     */

    /**
     * Constructs a new SnsMessage.
     * @memberof Push
     * @classdesc Represents a SnsMessage.
     * @implements ISnsMessage
     * @constructor
     * @param {Push.ISnsMessage=} [properties] Properties to set
     */
    function SnsMessage(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SnsMessage messageType.
     * @member {Push.MessageType} messageType
     * @memberof Push.SnsMessage
     * @instance
     */
    SnsMessage.prototype.messageType = 0;

    /**
     * SnsMessage message.
     * @member {Uint8Array} message
     * @memberof Push.SnsMessage
     * @instance
     */
    SnsMessage.prototype.message = $util.newBuffer([]);

    /**
     * Creates a new SnsMessage instance using the specified properties.
     * @function create
     * @memberof Push.SnsMessage
     * @static
     * @param {Push.ISnsMessage=} [properties] Properties to set
     * @returns {Push.SnsMessage} SnsMessage instance
     */
    SnsMessage.create = function create(properties) {
      return new SnsMessage(properties);
    };

    /**
     * Encodes the specified SnsMessage message. Does not implicitly {@link Push.SnsMessage.verify|verify} messages.
     * @function encode
     * @memberof Push.SnsMessage
     * @static
     * @param {Push.ISnsMessage} message SnsMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SnsMessage.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.messageType != null && Object.hasOwnProperty.call(message, "messageType"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.messageType);
      if (message.message != null && Object.hasOwnProperty.call(message, "message"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.message);
      return writer;
    };

    /**
     * Encodes the specified SnsMessage message, length delimited. Does not implicitly {@link Push.SnsMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Push.SnsMessage
     * @static
     * @param {Push.ISnsMessage} message SnsMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SnsMessage.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SnsMessage message from the specified reader or buffer.
     * @function decode
     * @memberof Push.SnsMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Push.SnsMessage} SnsMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SnsMessage.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.Push.SnsMessage();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.messageType = reader.int32();
            break;
          }
          case 2: {
            message.message = reader.bytes();
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
     * Decodes a SnsMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Push.SnsMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Push.SnsMessage} SnsMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SnsMessage.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SnsMessage message.
     * @function verify
     * @memberof Push.SnsMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SnsMessage.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        switch (message.messageType) {
          default:
            return "messageType: enum value expected";
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
            break;
        }
      if (message.message != null && message.hasOwnProperty("message"))
        if (
          !(
            (message.message && typeof message.message.length === "number") ||
            $util.isString(message.message)
          )
        )
          return "message: buffer expected";
      return null;
    };

    /**
     * Creates a SnsMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Push.SnsMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Push.SnsMessage} SnsMessage
     */
    SnsMessage.fromObject = function fromObject(object) {
      if (object instanceof $root.Push.SnsMessage) return object;
      let message = new $root.Push.SnsMessage();
      switch (object.messageType) {
        default:
          if (typeof object.messageType === "number") {
            message.messageType = object.messageType;
            break;
          }
          break;
        case "UNKNOWN":
        case 0:
          message.messageType = 0;
          break;
        case "DNA":
        case 1:
          message.messageType = 1;
          break;
        case "SSO":
        case 2:
          message.messageType = 2;
          break;
        case "CHAT":
        case 3:
          message.messageType = 3;
          break;
        case "USER":
        case 4:
          message.messageType = 4;
          break;
        case "ENTERPRISE":
        case 5:
          message.messageType = 5;
          break;
        case "KEEPER":
        case 6:
          message.messageType = 6;
          break;
        case "SESSION":
        case 7:
          message.messageType = 7;
          break;
        case "DEVICE":
        case 8:
          message.messageType = 8;
          break;
        case "TOTP":
        case 9:
          message.messageType = 9;
          break;
      }
      if (object.message != null)
        if (typeof object.message === "string")
          $util.base64.decode(
            object.message,
            (message.message = $util.newBuffer($util.base64.length(object.message))),
            0,
          );
        else if (object.message.length >= 0) message.message = object.message;
      return message;
    };

    /**
     * Creates a plain object from a SnsMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Push.SnsMessage
     * @static
     * @param {Push.SnsMessage} message SnsMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SnsMessage.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.messageType = options.enums === String ? "UNKNOWN" : 0;
        if (options.bytes === String) object.message = "";
        else {
          object.message = [];
          if (options.bytes !== Array) object.message = $util.newBuffer(object.message);
        }
      }
      if (message.messageType != null && message.hasOwnProperty("messageType"))
        object.messageType =
          options.enums === String
            ? $root.Push.MessageType[message.messageType] === undefined
              ? message.messageType
              : $root.Push.MessageType[message.messageType]
            : message.messageType;
      if (message.message != null && message.hasOwnProperty("message"))
        object.message =
          options.bytes === String
            ? $util.base64.encode(message.message, 0, message.message.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.message)
              : message.message;
      return object;
    };

    /**
     * Converts this SnsMessage to JSON.
     * @function toJSON
     * @memberof Push.SnsMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SnsMessage.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SnsMessage
     * @function getTypeUrl
     * @memberof Push.SnsMessage
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SnsMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/Push.SnsMessage";
    };

    return SnsMessage;
  })();

  return Push;
})());

export { $root as default };
