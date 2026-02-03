/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const BreachWatch = ($root.BreachWatch = (() => {
  /**
   * Namespace BreachWatch.
   * @exports BreachWatch
   * @namespace
   */
  const BreachWatch = {};

  /**
   * BreachWatchInfoType enum.
   * @name BreachWatch.BreachWatchInfoType
   * @enum {number}
   * @property {number} RECORD=0 RECORD value
   * @property {number} ALTERNATE_PASSWORD=1 ALTERNATE_PASSWORD value
   */
  BreachWatch.BreachWatchInfoType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "RECORD")] = 0;
    values[(valuesById[1] = "ALTERNATE_PASSWORD")] = 1;
    return values;
  })();

  BreachWatch.BreachWatchRecordRequest = (function () {
    /**
     * Properties of a BreachWatchRecordRequest.
     * @memberof BreachWatch
     * @interface IBreachWatchRecordRequest
     * @property {Uint8Array|null} [recordUid] BreachWatchRecordRequest recordUid
     * @property {Uint8Array|null} [encryptedData] BreachWatchRecordRequest encryptedData
     * @property {BreachWatch.BreachWatchInfoType|null} [breachWatchInfoType] BreachWatchRecordRequest breachWatchInfoType
     * @property {boolean|null} [updateUserWhoScanned] BreachWatchRecordRequest updateUserWhoScanned
     */

    /**
     * Constructs a new BreachWatchRecordRequest.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchRecordRequest.
     * @implements IBreachWatchRecordRequest
     * @constructor
     * @param {BreachWatch.IBreachWatchRecordRequest=} [properties] Properties to set
     */
    function BreachWatchRecordRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchRecordRequest recordUid.
     * @member {Uint8Array} recordUid
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @instance
     */
    BreachWatchRecordRequest.prototype.recordUid = $util.newBuffer([]);

    /**
     * BreachWatchRecordRequest encryptedData.
     * @member {Uint8Array} encryptedData
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @instance
     */
    BreachWatchRecordRequest.prototype.encryptedData = $util.newBuffer([]);

    /**
     * BreachWatchRecordRequest breachWatchInfoType.
     * @member {BreachWatch.BreachWatchInfoType} breachWatchInfoType
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @instance
     */
    BreachWatchRecordRequest.prototype.breachWatchInfoType = 0;

    /**
     * BreachWatchRecordRequest updateUserWhoScanned.
     * @member {boolean} updateUserWhoScanned
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @instance
     */
    BreachWatchRecordRequest.prototype.updateUserWhoScanned = false;

    /**
     * Creates a new BreachWatchRecordRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {BreachWatch.IBreachWatchRecordRequest=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchRecordRequest} BreachWatchRecordRequest instance
     */
    BreachWatchRecordRequest.create = function create(properties) {
      return new BreachWatchRecordRequest(properties);
    };

    /**
     * Encodes the specified BreachWatchRecordRequest message. Does not implicitly {@link BreachWatch.BreachWatchRecordRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {BreachWatch.IBreachWatchRecordRequest} message BreachWatchRecordRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchRecordRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.encryptedData != null && Object.hasOwnProperty.call(message, "encryptedData"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.encryptedData);
      if (
        message.breachWatchInfoType != null &&
        Object.hasOwnProperty.call(message, "breachWatchInfoType")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.breachWatchInfoType);
      if (
        message.updateUserWhoScanned != null &&
        Object.hasOwnProperty.call(message, "updateUserWhoScanned")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.updateUserWhoScanned);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchRecordRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchRecordRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {BreachWatch.IBreachWatchRecordRequest} message BreachWatchRecordRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchRecordRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchRecordRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchRecordRequest} BreachWatchRecordRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchRecordRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchRecordRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.recordUid = reader.bytes();
            break;
          }
          case 2: {
            message.encryptedData = reader.bytes();
            break;
          }
          case 3: {
            message.breachWatchInfoType = reader.int32();
            break;
          }
          case 4: {
            message.updateUserWhoScanned = reader.bool();
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
     * Decodes a BreachWatchRecordRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchRecordRequest} BreachWatchRecordRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchRecordRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchRecordRequest message.
     * @function verify
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchRecordRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        if (
          !(
            (message.recordUid && typeof message.recordUid.length === "number") ||
            $util.isString(message.recordUid)
          )
        )
          return "recordUid: buffer expected";
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData"))
        if (
          !(
            (message.encryptedData && typeof message.encryptedData.length === "number") ||
            $util.isString(message.encryptedData)
          )
        )
          return "encryptedData: buffer expected";
      if (message.breachWatchInfoType != null && message.hasOwnProperty("breachWatchInfoType"))
        switch (message.breachWatchInfoType) {
          default:
            return "breachWatchInfoType: enum value expected";
          case 0:
          case 1:
            break;
        }
      if (message.updateUserWhoScanned != null && message.hasOwnProperty("updateUserWhoScanned"))
        if (typeof message.updateUserWhoScanned !== "boolean")
          return "updateUserWhoScanned: boolean expected";
      return null;
    };

    /**
     * Creates a BreachWatchRecordRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchRecordRequest} BreachWatchRecordRequest
     */
    BreachWatchRecordRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchRecordRequest) return object;
      let message = new $root.BreachWatch.BreachWatchRecordRequest();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.encryptedData != null)
        if (typeof object.encryptedData === "string")
          $util.base64.decode(
            object.encryptedData,
            (message.encryptedData = $util.newBuffer($util.base64.length(object.encryptedData))),
            0,
          );
        else if (object.encryptedData.length >= 0) message.encryptedData = object.encryptedData;
      switch (object.breachWatchInfoType) {
        default:
          if (typeof object.breachWatchInfoType === "number") {
            message.breachWatchInfoType = object.breachWatchInfoType;
            break;
          }
          break;
        case "RECORD":
        case 0:
          message.breachWatchInfoType = 0;
          break;
        case "ALTERNATE_PASSWORD":
        case 1:
          message.breachWatchInfoType = 1;
          break;
      }
      if (object.updateUserWhoScanned != null)
        message.updateUserWhoScanned = Boolean(object.updateUserWhoScanned);
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchRecordRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {BreachWatch.BreachWatchRecordRequest} message BreachWatchRecordRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchRecordRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        if (options.bytes === String) object.encryptedData = "";
        else {
          object.encryptedData = [];
          if (options.bytes !== Array) object.encryptedData = $util.newBuffer(object.encryptedData);
        }
        object.breachWatchInfoType = options.enums === String ? "RECORD" : 0;
        object.updateUserWhoScanned = false;
      }
      if (message.recordUid != null && message.hasOwnProperty("recordUid"))
        object.recordUid =
          options.bytes === String
            ? $util.base64.encode(message.recordUid, 0, message.recordUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.recordUid)
              : message.recordUid;
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData"))
        object.encryptedData =
          options.bytes === String
            ? $util.base64.encode(message.encryptedData, 0, message.encryptedData.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.encryptedData)
              : message.encryptedData;
      if (message.breachWatchInfoType != null && message.hasOwnProperty("breachWatchInfoType"))
        object.breachWatchInfoType =
          options.enums === String
            ? $root.BreachWatch.BreachWatchInfoType[message.breachWatchInfoType] === undefined
              ? message.breachWatchInfoType
              : $root.BreachWatch.BreachWatchInfoType[message.breachWatchInfoType]
            : message.breachWatchInfoType;
      if (message.updateUserWhoScanned != null && message.hasOwnProperty("updateUserWhoScanned"))
        object.updateUserWhoScanned = message.updateUserWhoScanned;
      return object;
    };

    /**
     * Converts this BreachWatchRecordRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchRecordRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchRecordRequest
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchRecordRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchRecordRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchRecordRequest";
    };

    return BreachWatchRecordRequest;
  })();

  BreachWatch.BreachWatchUpdateRequest = (function () {
    /**
     * Properties of a BreachWatchUpdateRequest.
     * @memberof BreachWatch
     * @interface IBreachWatchUpdateRequest
     * @property {Array.<BreachWatch.IBreachWatchRecordRequest>|null} [breachWatchRecordRequest] BreachWatchUpdateRequest breachWatchRecordRequest
     * @property {Uint8Array|null} [encryptedData] BreachWatchUpdateRequest encryptedData
     */

    /**
     * Constructs a new BreachWatchUpdateRequest.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchUpdateRequest.
     * @implements IBreachWatchUpdateRequest
     * @constructor
     * @param {BreachWatch.IBreachWatchUpdateRequest=} [properties] Properties to set
     */
    function BreachWatchUpdateRequest(properties) {
      this.breachWatchRecordRequest = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchUpdateRequest breachWatchRecordRequest.
     * @member {Array.<BreachWatch.IBreachWatchRecordRequest>} breachWatchRecordRequest
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @instance
     */
    BreachWatchUpdateRequest.prototype.breachWatchRecordRequest = $util.emptyArray;

    /**
     * BreachWatchUpdateRequest encryptedData.
     * @member {Uint8Array} encryptedData
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @instance
     */
    BreachWatchUpdateRequest.prototype.encryptedData = $util.newBuffer([]);

    /**
     * Creates a new BreachWatchUpdateRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {BreachWatch.IBreachWatchUpdateRequest=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchUpdateRequest} BreachWatchUpdateRequest instance
     */
    BreachWatchUpdateRequest.create = function create(properties) {
      return new BreachWatchUpdateRequest(properties);
    };

    /**
     * Encodes the specified BreachWatchUpdateRequest message. Does not implicitly {@link BreachWatch.BreachWatchUpdateRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {BreachWatch.IBreachWatchUpdateRequest} message BreachWatchUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchUpdateRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.breachWatchRecordRequest != null && message.breachWatchRecordRequest.length)
        for (let i = 0; i < message.breachWatchRecordRequest.length; ++i)
          $root.BreachWatch.BreachWatchRecordRequest.encode(
            message.breachWatchRecordRequest[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.encryptedData != null && Object.hasOwnProperty.call(message, "encryptedData"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.encryptedData);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchUpdateRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchUpdateRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {BreachWatch.IBreachWatchUpdateRequest} message BreachWatchUpdateRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchUpdateRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchUpdateRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchUpdateRequest} BreachWatchUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchUpdateRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchUpdateRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.breachWatchRecordRequest && message.breachWatchRecordRequest.length))
              message.breachWatchRecordRequest = [];
            message.breachWatchRecordRequest.push(
              $root.BreachWatch.BreachWatchRecordRequest.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            message.encryptedData = reader.bytes();
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
     * Decodes a BreachWatchUpdateRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchUpdateRequest} BreachWatchUpdateRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchUpdateRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchUpdateRequest message.
     * @function verify
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchUpdateRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (
        message.breachWatchRecordRequest != null &&
        message.hasOwnProperty("breachWatchRecordRequest")
      ) {
        if (!Array.isArray(message.breachWatchRecordRequest))
          return "breachWatchRecordRequest: array expected";
        for (let i = 0; i < message.breachWatchRecordRequest.length; ++i) {
          let error = $root.BreachWatch.BreachWatchRecordRequest.verify(
            message.breachWatchRecordRequest[i],
          );
          if (error) return "breachWatchRecordRequest." + error;
        }
      }
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData"))
        if (
          !(
            (message.encryptedData && typeof message.encryptedData.length === "number") ||
            $util.isString(message.encryptedData)
          )
        )
          return "encryptedData: buffer expected";
      return null;
    };

    /**
     * Creates a BreachWatchUpdateRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchUpdateRequest} BreachWatchUpdateRequest
     */
    BreachWatchUpdateRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchUpdateRequest) return object;
      let message = new $root.BreachWatch.BreachWatchUpdateRequest();
      if (object.breachWatchRecordRequest) {
        if (!Array.isArray(object.breachWatchRecordRequest))
          throw TypeError(
            ".BreachWatch.BreachWatchUpdateRequest.breachWatchRecordRequest: array expected",
          );
        message.breachWatchRecordRequest = [];
        for (let i = 0; i < object.breachWatchRecordRequest.length; ++i) {
          if (typeof object.breachWatchRecordRequest[i] !== "object")
            throw TypeError(
              ".BreachWatch.BreachWatchUpdateRequest.breachWatchRecordRequest: object expected",
            );
          message.breachWatchRecordRequest[i] =
            $root.BreachWatch.BreachWatchRecordRequest.fromObject(
              object.breachWatchRecordRequest[i],
            );
        }
      }
      if (object.encryptedData != null)
        if (typeof object.encryptedData === "string")
          $util.base64.decode(
            object.encryptedData,
            (message.encryptedData = $util.newBuffer($util.base64.length(object.encryptedData))),
            0,
          );
        else if (object.encryptedData.length >= 0) message.encryptedData = object.encryptedData;
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchUpdateRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {BreachWatch.BreachWatchUpdateRequest} message BreachWatchUpdateRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchUpdateRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.breachWatchRecordRequest = [];
      if (options.defaults)
        if (options.bytes === String) object.encryptedData = "";
        else {
          object.encryptedData = [];
          if (options.bytes !== Array) object.encryptedData = $util.newBuffer(object.encryptedData);
        }
      if (message.breachWatchRecordRequest && message.breachWatchRecordRequest.length) {
        object.breachWatchRecordRequest = [];
        for (let j = 0; j < message.breachWatchRecordRequest.length; ++j)
          object.breachWatchRecordRequest[j] = $root.BreachWatch.BreachWatchRecordRequest.toObject(
            message.breachWatchRecordRequest[j],
            options,
          );
      }
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData"))
        object.encryptedData =
          options.bytes === String
            ? $util.base64.encode(message.encryptedData, 0, message.encryptedData.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.encryptedData)
              : message.encryptedData;
      return object;
    };

    /**
     * Converts this BreachWatchUpdateRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchUpdateRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchUpdateRequest
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchUpdateRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchUpdateRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchUpdateRequest";
    };

    return BreachWatchUpdateRequest;
  })();

  BreachWatch.BreachWatchRecordStatus = (function () {
    /**
     * Properties of a BreachWatchRecordStatus.
     * @memberof BreachWatch
     * @interface IBreachWatchRecordStatus
     * @property {Uint8Array|null} [recordUid] BreachWatchRecordStatus recordUid
     * @property {string|null} [status] BreachWatchRecordStatus status
     * @property {string|null} [reason] BreachWatchRecordStatus reason
     */

    /**
     * Constructs a new BreachWatchRecordStatus.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchRecordStatus.
     * @implements IBreachWatchRecordStatus
     * @constructor
     * @param {BreachWatch.IBreachWatchRecordStatus=} [properties] Properties to set
     */
    function BreachWatchRecordStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchRecordStatus recordUid.
     * @member {Uint8Array} recordUid
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @instance
     */
    BreachWatchRecordStatus.prototype.recordUid = $util.newBuffer([]);

    /**
     * BreachWatchRecordStatus status.
     * @member {string} status
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @instance
     */
    BreachWatchRecordStatus.prototype.status = "";

    /**
     * BreachWatchRecordStatus reason.
     * @member {string} reason
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @instance
     */
    BreachWatchRecordStatus.prototype.reason = "";

    /**
     * Creates a new BreachWatchRecordStatus instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {BreachWatch.IBreachWatchRecordStatus=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchRecordStatus} BreachWatchRecordStatus instance
     */
    BreachWatchRecordStatus.create = function create(properties) {
      return new BreachWatchRecordStatus(properties);
    };

    /**
     * Encodes the specified BreachWatchRecordStatus message. Does not implicitly {@link BreachWatch.BreachWatchRecordStatus.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {BreachWatch.IBreachWatchRecordStatus} message BreachWatchRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchRecordStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recordUid != null && Object.hasOwnProperty.call(message, "recordUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.recordUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.status);
      if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.reason);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchRecordStatus message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchRecordStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {BreachWatch.IBreachWatchRecordStatus} message BreachWatchRecordStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchRecordStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchRecordStatus message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchRecordStatus} BreachWatchRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchRecordStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchRecordStatus();
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
            message.reason = reader.string();
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
     * Decodes a BreachWatchRecordStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchRecordStatus} BreachWatchRecordStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchRecordStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchRecordStatus message.
     * @function verify
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchRecordStatus.verify = function verify(message) {
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
      if (message.reason != null && message.hasOwnProperty("reason"))
        if (!$util.isString(message.reason)) return "reason: string expected";
      return null;
    };

    /**
     * Creates a BreachWatchRecordStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchRecordStatus} BreachWatchRecordStatus
     */
    BreachWatchRecordStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchRecordStatus) return object;
      let message = new $root.BreachWatch.BreachWatchRecordStatus();
      if (object.recordUid != null)
        if (typeof object.recordUid === "string")
          $util.base64.decode(
            object.recordUid,
            (message.recordUid = $util.newBuffer($util.base64.length(object.recordUid))),
            0,
          );
        else if (object.recordUid.length >= 0) message.recordUid = object.recordUid;
      if (object.status != null) message.status = String(object.status);
      if (object.reason != null) message.reason = String(object.reason);
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchRecordStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {BreachWatch.BreachWatchRecordStatus} message BreachWatchRecordStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchRecordStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.recordUid = "";
        else {
          object.recordUid = [];
          if (options.bytes !== Array) object.recordUid = $util.newBuffer(object.recordUid);
        }
        object.status = "";
        object.reason = "";
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
      if (message.reason != null && message.hasOwnProperty("reason"))
        object.reason = message.reason;
      return object;
    };

    /**
     * Converts this BreachWatchRecordStatus to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchRecordStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchRecordStatus
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchRecordStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchRecordStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchRecordStatus";
    };

    return BreachWatchRecordStatus;
  })();

  BreachWatch.BreachWatchUpdateResponse = (function () {
    /**
     * Properties of a BreachWatchUpdateResponse.
     * @memberof BreachWatch
     * @interface IBreachWatchUpdateResponse
     * @property {Array.<BreachWatch.IBreachWatchRecordStatus>|null} [breachWatchRecordStatus] BreachWatchUpdateResponse breachWatchRecordStatus
     */

    /**
     * Constructs a new BreachWatchUpdateResponse.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchUpdateResponse.
     * @implements IBreachWatchUpdateResponse
     * @constructor
     * @param {BreachWatch.IBreachWatchUpdateResponse=} [properties] Properties to set
     */
    function BreachWatchUpdateResponse(properties) {
      this.breachWatchRecordStatus = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchUpdateResponse breachWatchRecordStatus.
     * @member {Array.<BreachWatch.IBreachWatchRecordStatus>} breachWatchRecordStatus
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @instance
     */
    BreachWatchUpdateResponse.prototype.breachWatchRecordStatus = $util.emptyArray;

    /**
     * Creates a new BreachWatchUpdateResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {BreachWatch.IBreachWatchUpdateResponse=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchUpdateResponse} BreachWatchUpdateResponse instance
     */
    BreachWatchUpdateResponse.create = function create(properties) {
      return new BreachWatchUpdateResponse(properties);
    };

    /**
     * Encodes the specified BreachWatchUpdateResponse message. Does not implicitly {@link BreachWatch.BreachWatchUpdateResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {BreachWatch.IBreachWatchUpdateResponse} message BreachWatchUpdateResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchUpdateResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.breachWatchRecordStatus != null && message.breachWatchRecordStatus.length)
        for (let i = 0; i < message.breachWatchRecordStatus.length; ++i)
          $root.BreachWatch.BreachWatchRecordStatus.encode(
            message.breachWatchRecordStatus[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified BreachWatchUpdateResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchUpdateResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {BreachWatch.IBreachWatchUpdateResponse} message BreachWatchUpdateResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchUpdateResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchUpdateResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchUpdateResponse} BreachWatchUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchUpdateResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchUpdateResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.breachWatchRecordStatus && message.breachWatchRecordStatus.length))
              message.breachWatchRecordStatus = [];
            message.breachWatchRecordStatus.push(
              $root.BreachWatch.BreachWatchRecordStatus.decode(reader, reader.uint32()),
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
     * Decodes a BreachWatchUpdateResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchUpdateResponse} BreachWatchUpdateResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchUpdateResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchUpdateResponse message.
     * @function verify
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchUpdateResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (
        message.breachWatchRecordStatus != null &&
        message.hasOwnProperty("breachWatchRecordStatus")
      ) {
        if (!Array.isArray(message.breachWatchRecordStatus))
          return "breachWatchRecordStatus: array expected";
        for (let i = 0; i < message.breachWatchRecordStatus.length; ++i) {
          let error = $root.BreachWatch.BreachWatchRecordStatus.verify(
            message.breachWatchRecordStatus[i],
          );
          if (error) return "breachWatchRecordStatus." + error;
        }
      }
      return null;
    };

    /**
     * Creates a BreachWatchUpdateResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchUpdateResponse} BreachWatchUpdateResponse
     */
    BreachWatchUpdateResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchUpdateResponse) return object;
      let message = new $root.BreachWatch.BreachWatchUpdateResponse();
      if (object.breachWatchRecordStatus) {
        if (!Array.isArray(object.breachWatchRecordStatus))
          throw TypeError(
            ".BreachWatch.BreachWatchUpdateResponse.breachWatchRecordStatus: array expected",
          );
        message.breachWatchRecordStatus = [];
        for (let i = 0; i < object.breachWatchRecordStatus.length; ++i) {
          if (typeof object.breachWatchRecordStatus[i] !== "object")
            throw TypeError(
              ".BreachWatch.BreachWatchUpdateResponse.breachWatchRecordStatus: object expected",
            );
          message.breachWatchRecordStatus[i] = $root.BreachWatch.BreachWatchRecordStatus.fromObject(
            object.breachWatchRecordStatus[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchUpdateResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {BreachWatch.BreachWatchUpdateResponse} message BreachWatchUpdateResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchUpdateResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.breachWatchRecordStatus = [];
      if (message.breachWatchRecordStatus && message.breachWatchRecordStatus.length) {
        object.breachWatchRecordStatus = [];
        for (let j = 0; j < message.breachWatchRecordStatus.length; ++j)
          object.breachWatchRecordStatus[j] = $root.BreachWatch.BreachWatchRecordStatus.toObject(
            message.breachWatchRecordStatus[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this BreachWatchUpdateResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchUpdateResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchUpdateResponse
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchUpdateResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchUpdateResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchUpdateResponse";
    };

    return BreachWatchUpdateResponse;
  })();

  BreachWatch.BreachWatchTokenRequest = (function () {
    /**
     * Properties of a BreachWatchTokenRequest.
     * @memberof BreachWatch
     * @interface IBreachWatchTokenRequest
     * @property {Uint8Array|null} [breachWatchToken] BreachWatchTokenRequest breachWatchToken
     */

    /**
     * Constructs a new BreachWatchTokenRequest.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchTokenRequest.
     * @implements IBreachWatchTokenRequest
     * @constructor
     * @param {BreachWatch.IBreachWatchTokenRequest=} [properties] Properties to set
     */
    function BreachWatchTokenRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchTokenRequest breachWatchToken.
     * @member {Uint8Array} breachWatchToken
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @instance
     */
    BreachWatchTokenRequest.prototype.breachWatchToken = $util.newBuffer([]);

    /**
     * Creates a new BreachWatchTokenRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {BreachWatch.IBreachWatchTokenRequest=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchTokenRequest} BreachWatchTokenRequest instance
     */
    BreachWatchTokenRequest.create = function create(properties) {
      return new BreachWatchTokenRequest(properties);
    };

    /**
     * Encodes the specified BreachWatchTokenRequest message. Does not implicitly {@link BreachWatch.BreachWatchTokenRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {BreachWatch.IBreachWatchTokenRequest} message BreachWatchTokenRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchTokenRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.breachWatchToken != null &&
        Object.hasOwnProperty.call(message, "breachWatchToken")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.breachWatchToken);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchTokenRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchTokenRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {BreachWatch.IBreachWatchTokenRequest} message BreachWatchTokenRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchTokenRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchTokenRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchTokenRequest} BreachWatchTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchTokenRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchTokenRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.breachWatchToken = reader.bytes();
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
     * Decodes a BreachWatchTokenRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchTokenRequest} BreachWatchTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchTokenRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchTokenRequest message.
     * @function verify
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchTokenRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.breachWatchToken != null && message.hasOwnProperty("breachWatchToken"))
        if (
          !(
            (message.breachWatchToken && typeof message.breachWatchToken.length === "number") ||
            $util.isString(message.breachWatchToken)
          )
        )
          return "breachWatchToken: buffer expected";
      return null;
    };

    /**
     * Creates a BreachWatchTokenRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchTokenRequest} BreachWatchTokenRequest
     */
    BreachWatchTokenRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchTokenRequest) return object;
      let message = new $root.BreachWatch.BreachWatchTokenRequest();
      if (object.breachWatchToken != null)
        if (typeof object.breachWatchToken === "string")
          $util.base64.decode(
            object.breachWatchToken,
            (message.breachWatchToken = $util.newBuffer(
              $util.base64.length(object.breachWatchToken),
            )),
            0,
          );
        else if (object.breachWatchToken.length >= 0)
          message.breachWatchToken = object.breachWatchToken;
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchTokenRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {BreachWatch.BreachWatchTokenRequest} message BreachWatchTokenRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchTokenRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.breachWatchToken = "";
        else {
          object.breachWatchToken = [];
          if (options.bytes !== Array)
            object.breachWatchToken = $util.newBuffer(object.breachWatchToken);
        }
      if (message.breachWatchToken != null && message.hasOwnProperty("breachWatchToken"))
        object.breachWatchToken =
          options.bytes === String
            ? $util.base64.encode(message.breachWatchToken, 0, message.breachWatchToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.breachWatchToken)
              : message.breachWatchToken;
      return object;
    };

    /**
     * Converts this BreachWatchTokenRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchTokenRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchTokenRequest
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchTokenRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchTokenRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchTokenRequest";
    };

    return BreachWatchTokenRequest;
  })();

  BreachWatch.BreachWatchTokenResponse = (function () {
    /**
     * Properties of a BreachWatchTokenResponse.
     * @memberof BreachWatch
     * @interface IBreachWatchTokenResponse
     * @property {Uint8Array|null} [breachWatchToken] BreachWatchTokenResponse breachWatchToken
     * @property {boolean|null} [clientEncrypted] BreachWatchTokenResponse clientEncrypted
     */

    /**
     * Constructs a new BreachWatchTokenResponse.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchTokenResponse.
     * @implements IBreachWatchTokenResponse
     * @constructor
     * @param {BreachWatch.IBreachWatchTokenResponse=} [properties] Properties to set
     */
    function BreachWatchTokenResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchTokenResponse breachWatchToken.
     * @member {Uint8Array} breachWatchToken
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @instance
     */
    BreachWatchTokenResponse.prototype.breachWatchToken = $util.newBuffer([]);

    /**
     * BreachWatchTokenResponse clientEncrypted.
     * @member {boolean} clientEncrypted
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @instance
     */
    BreachWatchTokenResponse.prototype.clientEncrypted = false;

    /**
     * Creates a new BreachWatchTokenResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {BreachWatch.IBreachWatchTokenResponse=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchTokenResponse} BreachWatchTokenResponse instance
     */
    BreachWatchTokenResponse.create = function create(properties) {
      return new BreachWatchTokenResponse(properties);
    };

    /**
     * Encodes the specified BreachWatchTokenResponse message. Does not implicitly {@link BreachWatch.BreachWatchTokenResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {BreachWatch.IBreachWatchTokenResponse} message BreachWatchTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchTokenResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.breachWatchToken != null &&
        Object.hasOwnProperty.call(message, "breachWatchToken")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.breachWatchToken);
      if (message.clientEncrypted != null && Object.hasOwnProperty.call(message, "clientEncrypted"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.clientEncrypted);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchTokenResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {BreachWatch.IBreachWatchTokenResponse} message BreachWatchTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchTokenResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchTokenResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchTokenResponse} BreachWatchTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchTokenResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchTokenResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.breachWatchToken = reader.bytes();
            break;
          }
          case 2: {
            message.clientEncrypted = reader.bool();
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
     * Decodes a BreachWatchTokenResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchTokenResponse} BreachWatchTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchTokenResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchTokenResponse message.
     * @function verify
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchTokenResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.breachWatchToken != null && message.hasOwnProperty("breachWatchToken"))
        if (
          !(
            (message.breachWatchToken && typeof message.breachWatchToken.length === "number") ||
            $util.isString(message.breachWatchToken)
          )
        )
          return "breachWatchToken: buffer expected";
      if (message.clientEncrypted != null && message.hasOwnProperty("clientEncrypted"))
        if (typeof message.clientEncrypted !== "boolean")
          return "clientEncrypted: boolean expected";
      return null;
    };

    /**
     * Creates a BreachWatchTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchTokenResponse} BreachWatchTokenResponse
     */
    BreachWatchTokenResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchTokenResponse) return object;
      let message = new $root.BreachWatch.BreachWatchTokenResponse();
      if (object.breachWatchToken != null)
        if (typeof object.breachWatchToken === "string")
          $util.base64.decode(
            object.breachWatchToken,
            (message.breachWatchToken = $util.newBuffer(
              $util.base64.length(object.breachWatchToken),
            )),
            0,
          );
        else if (object.breachWatchToken.length >= 0)
          message.breachWatchToken = object.breachWatchToken;
      if (object.clientEncrypted != null) message.clientEncrypted = Boolean(object.clientEncrypted);
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchTokenResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {BreachWatch.BreachWatchTokenResponse} message BreachWatchTokenResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchTokenResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.breachWatchToken = "";
        else {
          object.breachWatchToken = [];
          if (options.bytes !== Array)
            object.breachWatchToken = $util.newBuffer(object.breachWatchToken);
        }
        object.clientEncrypted = false;
      }
      if (message.breachWatchToken != null && message.hasOwnProperty("breachWatchToken"))
        object.breachWatchToken =
          options.bytes === String
            ? $util.base64.encode(message.breachWatchToken, 0, message.breachWatchToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.breachWatchToken)
              : message.breachWatchToken;
      if (message.clientEncrypted != null && message.hasOwnProperty("clientEncrypted"))
        object.clientEncrypted = message.clientEncrypted;
      return object;
    };

    /**
     * Converts this BreachWatchTokenResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchTokenResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchTokenResponse
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchTokenResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchTokenResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchTokenResponse";
    };

    return BreachWatchTokenResponse;
  })();

  BreachWatch.AnonymizedTokenResponse = (function () {
    /**
     * Properties of an AnonymizedTokenResponse.
     * @memberof BreachWatch
     * @interface IAnonymizedTokenResponse
     * @property {Uint8Array|null} [domainToken] AnonymizedTokenResponse domainToken
     * @property {Uint8Array|null} [emailToken] AnonymizedTokenResponse emailToken
     * @property {Uint8Array|null} [passwordToken] AnonymizedTokenResponse passwordToken
     */

    /**
     * Constructs a new AnonymizedTokenResponse.
     * @memberof BreachWatch
     * @classdesc Represents an AnonymizedTokenResponse.
     * @implements IAnonymizedTokenResponse
     * @constructor
     * @param {BreachWatch.IAnonymizedTokenResponse=} [properties] Properties to set
     */
    function AnonymizedTokenResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AnonymizedTokenResponse domainToken.
     * @member {Uint8Array} domainToken
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @instance
     */
    AnonymizedTokenResponse.prototype.domainToken = $util.newBuffer([]);

    /**
     * AnonymizedTokenResponse emailToken.
     * @member {Uint8Array} emailToken
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @instance
     */
    AnonymizedTokenResponse.prototype.emailToken = $util.newBuffer([]);

    /**
     * AnonymizedTokenResponse passwordToken.
     * @member {Uint8Array} passwordToken
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @instance
     */
    AnonymizedTokenResponse.prototype.passwordToken = $util.newBuffer([]);

    /**
     * Creates a new AnonymizedTokenResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {BreachWatch.IAnonymizedTokenResponse=} [properties] Properties to set
     * @returns {BreachWatch.AnonymizedTokenResponse} AnonymizedTokenResponse instance
     */
    AnonymizedTokenResponse.create = function create(properties) {
      return new AnonymizedTokenResponse(properties);
    };

    /**
     * Encodes the specified AnonymizedTokenResponse message. Does not implicitly {@link BreachWatch.AnonymizedTokenResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {BreachWatch.IAnonymizedTokenResponse} message AnonymizedTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AnonymizedTokenResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.domainToken != null && Object.hasOwnProperty.call(message, "domainToken"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.domainToken);
      if (message.emailToken != null && Object.hasOwnProperty.call(message, "emailToken"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.emailToken);
      if (message.passwordToken != null && Object.hasOwnProperty.call(message, "passwordToken"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.passwordToken);
      return writer;
    };

    /**
     * Encodes the specified AnonymizedTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.AnonymizedTokenResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {BreachWatch.IAnonymizedTokenResponse} message AnonymizedTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AnonymizedTokenResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AnonymizedTokenResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.AnonymizedTokenResponse} AnonymizedTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AnonymizedTokenResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.AnonymizedTokenResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.domainToken = reader.bytes();
            break;
          }
          case 2: {
            message.emailToken = reader.bytes();
            break;
          }
          case 3: {
            message.passwordToken = reader.bytes();
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
     * Decodes an AnonymizedTokenResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.AnonymizedTokenResponse} AnonymizedTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AnonymizedTokenResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AnonymizedTokenResponse message.
     * @function verify
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AnonymizedTokenResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.domainToken != null && message.hasOwnProperty("domainToken"))
        if (
          !(
            (message.domainToken && typeof message.domainToken.length === "number") ||
            $util.isString(message.domainToken)
          )
        )
          return "domainToken: buffer expected";
      if (message.emailToken != null && message.hasOwnProperty("emailToken"))
        if (
          !(
            (message.emailToken && typeof message.emailToken.length === "number") ||
            $util.isString(message.emailToken)
          )
        )
          return "emailToken: buffer expected";
      if (message.passwordToken != null && message.hasOwnProperty("passwordToken"))
        if (
          !(
            (message.passwordToken && typeof message.passwordToken.length === "number") ||
            $util.isString(message.passwordToken)
          )
        )
          return "passwordToken: buffer expected";
      return null;
    };

    /**
     * Creates an AnonymizedTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.AnonymizedTokenResponse} AnonymizedTokenResponse
     */
    AnonymizedTokenResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.AnonymizedTokenResponse) return object;
      let message = new $root.BreachWatch.AnonymizedTokenResponse();
      if (object.domainToken != null)
        if (typeof object.domainToken === "string")
          $util.base64.decode(
            object.domainToken,
            (message.domainToken = $util.newBuffer($util.base64.length(object.domainToken))),
            0,
          );
        else if (object.domainToken.length >= 0) message.domainToken = object.domainToken;
      if (object.emailToken != null)
        if (typeof object.emailToken === "string")
          $util.base64.decode(
            object.emailToken,
            (message.emailToken = $util.newBuffer($util.base64.length(object.emailToken))),
            0,
          );
        else if (object.emailToken.length >= 0) message.emailToken = object.emailToken;
      if (object.passwordToken != null)
        if (typeof object.passwordToken === "string")
          $util.base64.decode(
            object.passwordToken,
            (message.passwordToken = $util.newBuffer($util.base64.length(object.passwordToken))),
            0,
          );
        else if (object.passwordToken.length >= 0) message.passwordToken = object.passwordToken;
      return message;
    };

    /**
     * Creates a plain object from an AnonymizedTokenResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {BreachWatch.AnonymizedTokenResponse} message AnonymizedTokenResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AnonymizedTokenResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.domainToken = "";
        else {
          object.domainToken = [];
          if (options.bytes !== Array) object.domainToken = $util.newBuffer(object.domainToken);
        }
        if (options.bytes === String) object.emailToken = "";
        else {
          object.emailToken = [];
          if (options.bytes !== Array) object.emailToken = $util.newBuffer(object.emailToken);
        }
        if (options.bytes === String) object.passwordToken = "";
        else {
          object.passwordToken = [];
          if (options.bytes !== Array) object.passwordToken = $util.newBuffer(object.passwordToken);
        }
      }
      if (message.domainToken != null && message.hasOwnProperty("domainToken"))
        object.domainToken =
          options.bytes === String
            ? $util.base64.encode(message.domainToken, 0, message.domainToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.domainToken)
              : message.domainToken;
      if (message.emailToken != null && message.hasOwnProperty("emailToken"))
        object.emailToken =
          options.bytes === String
            ? $util.base64.encode(message.emailToken, 0, message.emailToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.emailToken)
              : message.emailToken;
      if (message.passwordToken != null && message.hasOwnProperty("passwordToken"))
        object.passwordToken =
          options.bytes === String
            ? $util.base64.encode(message.passwordToken, 0, message.passwordToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.passwordToken)
              : message.passwordToken;
      return object;
    };

    /**
     * Converts this AnonymizedTokenResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AnonymizedTokenResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AnonymizedTokenResponse
     * @function getTypeUrl
     * @memberof BreachWatch.AnonymizedTokenResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AnonymizedTokenResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.AnonymizedTokenResponse";
    };

    return AnonymizedTokenResponse;
  })();

  BreachWatch.HashCheck = (function () {
    /**
     * Properties of a HashCheck.
     * @memberof BreachWatch
     * @interface IHashCheck
     * @property {Uint8Array|null} [hash1] HashCheck hash1
     * @property {Uint8Array|null} [euid] HashCheck euid
     */

    /**
     * Constructs a new HashCheck.
     * @memberof BreachWatch
     * @classdesc Represents a HashCheck.
     * @implements IHashCheck
     * @constructor
     * @param {BreachWatch.IHashCheck=} [properties] Properties to set
     */
    function HashCheck(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * HashCheck hash1.
     * @member {Uint8Array} hash1
     * @memberof BreachWatch.HashCheck
     * @instance
     */
    HashCheck.prototype.hash1 = $util.newBuffer([]);

    /**
     * HashCheck euid.
     * @member {Uint8Array} euid
     * @memberof BreachWatch.HashCheck
     * @instance
     */
    HashCheck.prototype.euid = $util.newBuffer([]);

    /**
     * Creates a new HashCheck instance using the specified properties.
     * @function create
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {BreachWatch.IHashCheck=} [properties] Properties to set
     * @returns {BreachWatch.HashCheck} HashCheck instance
     */
    HashCheck.create = function create(properties) {
      return new HashCheck(properties);
    };

    /**
     * Encodes the specified HashCheck message. Does not implicitly {@link BreachWatch.HashCheck.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {BreachWatch.IHashCheck} message HashCheck message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    HashCheck.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.hash1 != null && Object.hasOwnProperty.call(message, "hash1"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.hash1);
      if (message.euid != null && Object.hasOwnProperty.call(message, "euid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.euid);
      return writer;
    };

    /**
     * Encodes the specified HashCheck message, length delimited. Does not implicitly {@link BreachWatch.HashCheck.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {BreachWatch.IHashCheck} message HashCheck message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    HashCheck.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a HashCheck message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.HashCheck} HashCheck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    HashCheck.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.HashCheck();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.hash1 = reader.bytes();
            break;
          }
          case 2: {
            message.euid = reader.bytes();
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
     * Decodes a HashCheck message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.HashCheck} HashCheck
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    HashCheck.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a HashCheck message.
     * @function verify
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    HashCheck.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.hash1 != null && message.hasOwnProperty("hash1"))
        if (
          !(
            (message.hash1 && typeof message.hash1.length === "number") ||
            $util.isString(message.hash1)
          )
        )
          return "hash1: buffer expected";
      if (message.euid != null && message.hasOwnProperty("euid"))
        if (
          !(
            (message.euid && typeof message.euid.length === "number") ||
            $util.isString(message.euid)
          )
        )
          return "euid: buffer expected";
      return null;
    };

    /**
     * Creates a HashCheck message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.HashCheck} HashCheck
     */
    HashCheck.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.HashCheck) return object;
      let message = new $root.BreachWatch.HashCheck();
      if (object.hash1 != null)
        if (typeof object.hash1 === "string")
          $util.base64.decode(
            object.hash1,
            (message.hash1 = $util.newBuffer($util.base64.length(object.hash1))),
            0,
          );
        else if (object.hash1.length >= 0) message.hash1 = object.hash1;
      if (object.euid != null)
        if (typeof object.euid === "string")
          $util.base64.decode(
            object.euid,
            (message.euid = $util.newBuffer($util.base64.length(object.euid))),
            0,
          );
        else if (object.euid.length >= 0) message.euid = object.euid;
      return message;
    };

    /**
     * Creates a plain object from a HashCheck message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {BreachWatch.HashCheck} message HashCheck
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    HashCheck.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.hash1 = "";
        else {
          object.hash1 = [];
          if (options.bytes !== Array) object.hash1 = $util.newBuffer(object.hash1);
        }
        if (options.bytes === String) object.euid = "";
        else {
          object.euid = [];
          if (options.bytes !== Array) object.euid = $util.newBuffer(object.euid);
        }
      }
      if (message.hash1 != null && message.hasOwnProperty("hash1"))
        object.hash1 =
          options.bytes === String
            ? $util.base64.encode(message.hash1, 0, message.hash1.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.hash1)
              : message.hash1;
      if (message.euid != null && message.hasOwnProperty("euid"))
        object.euid =
          options.bytes === String
            ? $util.base64.encode(message.euid, 0, message.euid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.euid)
              : message.euid;
      return object;
    };

    /**
     * Converts this HashCheck to JSON.
     * @function toJSON
     * @memberof BreachWatch.HashCheck
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    HashCheck.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for HashCheck
     * @function getTypeUrl
     * @memberof BreachWatch.HashCheck
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    HashCheck.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.HashCheck";
    };

    return HashCheck;
  })();

  BreachWatch.BreachWatchStatusRequest = (function () {
    /**
     * Properties of a BreachWatchStatusRequest.
     * @memberof BreachWatch
     * @interface IBreachWatchStatusRequest
     * @property {Uint8Array|null} [anonymizedToken] BreachWatchStatusRequest anonymizedToken
     * @property {Array.<BreachWatch.IHashCheck>|null} [hashCheck] BreachWatchStatusRequest hashCheck
     * @property {Array.<Uint8Array>|null} [removedEuid] BreachWatchStatusRequest removedEuid
     */

    /**
     * Constructs a new BreachWatchStatusRequest.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchStatusRequest.
     * @implements IBreachWatchStatusRequest
     * @constructor
     * @param {BreachWatch.IBreachWatchStatusRequest=} [properties] Properties to set
     */
    function BreachWatchStatusRequest(properties) {
      this.hashCheck = [];
      this.removedEuid = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchStatusRequest anonymizedToken.
     * @member {Uint8Array} anonymizedToken
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @instance
     */
    BreachWatchStatusRequest.prototype.anonymizedToken = $util.newBuffer([]);

    /**
     * BreachWatchStatusRequest hashCheck.
     * @member {Array.<BreachWatch.IHashCheck>} hashCheck
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @instance
     */
    BreachWatchStatusRequest.prototype.hashCheck = $util.emptyArray;

    /**
     * BreachWatchStatusRequest removedEuid.
     * @member {Array.<Uint8Array>} removedEuid
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @instance
     */
    BreachWatchStatusRequest.prototype.removedEuid = $util.emptyArray;

    /**
     * Creates a new BreachWatchStatusRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {BreachWatch.IBreachWatchStatusRequest=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchStatusRequest} BreachWatchStatusRequest instance
     */
    BreachWatchStatusRequest.create = function create(properties) {
      return new BreachWatchStatusRequest(properties);
    };

    /**
     * Encodes the specified BreachWatchStatusRequest message. Does not implicitly {@link BreachWatch.BreachWatchStatusRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {BreachWatch.IBreachWatchStatusRequest} message BreachWatchStatusRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchStatusRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.anonymizedToken != null && Object.hasOwnProperty.call(message, "anonymizedToken"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.anonymizedToken);
      if (message.hashCheck != null && message.hashCheck.length)
        for (let i = 0; i < message.hashCheck.length; ++i)
          $root.BreachWatch.HashCheck.encode(
            message.hashCheck[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (message.removedEuid != null && message.removedEuid.length)
        for (let i = 0; i < message.removedEuid.length; ++i)
          writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.removedEuid[i]);
      return writer;
    };

    /**
     * Encodes the specified BreachWatchStatusRequest message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchStatusRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {BreachWatch.IBreachWatchStatusRequest} message BreachWatchStatusRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchStatusRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchStatusRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchStatusRequest} BreachWatchStatusRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchStatusRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchStatusRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.anonymizedToken = reader.bytes();
            break;
          }
          case 2: {
            if (!(message.hashCheck && message.hashCheck.length)) message.hashCheck = [];
            message.hashCheck.push($root.BreachWatch.HashCheck.decode(reader, reader.uint32()));
            break;
          }
          case 3: {
            if (!(message.removedEuid && message.removedEuid.length)) message.removedEuid = [];
            message.removedEuid.push(reader.bytes());
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
     * Decodes a BreachWatchStatusRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchStatusRequest} BreachWatchStatusRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchStatusRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchStatusRequest message.
     * @function verify
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchStatusRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.anonymizedToken != null && message.hasOwnProperty("anonymizedToken"))
        if (
          !(
            (message.anonymizedToken && typeof message.anonymizedToken.length === "number") ||
            $util.isString(message.anonymizedToken)
          )
        )
          return "anonymizedToken: buffer expected";
      if (message.hashCheck != null && message.hasOwnProperty("hashCheck")) {
        if (!Array.isArray(message.hashCheck)) return "hashCheck: array expected";
        for (let i = 0; i < message.hashCheck.length; ++i) {
          let error = $root.BreachWatch.HashCheck.verify(message.hashCheck[i]);
          if (error) return "hashCheck." + error;
        }
      }
      if (message.removedEuid != null && message.hasOwnProperty("removedEuid")) {
        if (!Array.isArray(message.removedEuid)) return "removedEuid: array expected";
        for (let i = 0; i < message.removedEuid.length; ++i)
          if (
            !(
              (message.removedEuid[i] && typeof message.removedEuid[i].length === "number") ||
              $util.isString(message.removedEuid[i])
            )
          )
            return "removedEuid: buffer[] expected";
      }
      return null;
    };

    /**
     * Creates a BreachWatchStatusRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchStatusRequest} BreachWatchStatusRequest
     */
    BreachWatchStatusRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchStatusRequest) return object;
      let message = new $root.BreachWatch.BreachWatchStatusRequest();
      if (object.anonymizedToken != null)
        if (typeof object.anonymizedToken === "string")
          $util.base64.decode(
            object.anonymizedToken,
            (message.anonymizedToken = $util.newBuffer(
              $util.base64.length(object.anonymizedToken),
            )),
            0,
          );
        else if (object.anonymizedToken.length >= 0)
          message.anonymizedToken = object.anonymizedToken;
      if (object.hashCheck) {
        if (!Array.isArray(object.hashCheck))
          throw TypeError(".BreachWatch.BreachWatchStatusRequest.hashCheck: array expected");
        message.hashCheck = [];
        for (let i = 0; i < object.hashCheck.length; ++i) {
          if (typeof object.hashCheck[i] !== "object")
            throw TypeError(".BreachWatch.BreachWatchStatusRequest.hashCheck: object expected");
          message.hashCheck[i] = $root.BreachWatch.HashCheck.fromObject(object.hashCheck[i]);
        }
      }
      if (object.removedEuid) {
        if (!Array.isArray(object.removedEuid))
          throw TypeError(".BreachWatch.BreachWatchStatusRequest.removedEuid: array expected");
        message.removedEuid = [];
        for (let i = 0; i < object.removedEuid.length; ++i)
          if (typeof object.removedEuid[i] === "string")
            $util.base64.decode(
              object.removedEuid[i],
              (message.removedEuid[i] = $util.newBuffer(
                $util.base64.length(object.removedEuid[i]),
              )),
              0,
            );
          else if (object.removedEuid[i].length >= 0)
            message.removedEuid[i] = object.removedEuid[i];
      }
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchStatusRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {BreachWatch.BreachWatchStatusRequest} message BreachWatchStatusRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchStatusRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.hashCheck = [];
        object.removedEuid = [];
      }
      if (options.defaults)
        if (options.bytes === String) object.anonymizedToken = "";
        else {
          object.anonymizedToken = [];
          if (options.bytes !== Array)
            object.anonymizedToken = $util.newBuffer(object.anonymizedToken);
        }
      if (message.anonymizedToken != null && message.hasOwnProperty("anonymizedToken"))
        object.anonymizedToken =
          options.bytes === String
            ? $util.base64.encode(message.anonymizedToken, 0, message.anonymizedToken.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.anonymizedToken)
              : message.anonymizedToken;
      if (message.hashCheck && message.hashCheck.length) {
        object.hashCheck = [];
        for (let j = 0; j < message.hashCheck.length; ++j)
          object.hashCheck[j] = $root.BreachWatch.HashCheck.toObject(message.hashCheck[j], options);
      }
      if (message.removedEuid && message.removedEuid.length) {
        object.removedEuid = [];
        for (let j = 0; j < message.removedEuid.length; ++j)
          object.removedEuid[j] =
            options.bytes === String
              ? $util.base64.encode(message.removedEuid[j], 0, message.removedEuid[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.removedEuid[j])
                : message.removedEuid[j];
      }
      return object;
    };

    /**
     * Converts this BreachWatchStatusRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchStatusRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchStatusRequest
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchStatusRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchStatusRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchStatusRequest";
    };

    return BreachWatchStatusRequest;
  })();

  BreachWatch.HashStatus = (function () {
    /**
     * Properties of a HashStatus.
     * @memberof BreachWatch
     * @interface IHashStatus
     * @property {Uint8Array|null} [hash1] HashStatus hash1
     * @property {Uint8Array|null} [euid] HashStatus euid
     * @property {boolean|null} [breachDetected] HashStatus breachDetected
     */

    /**
     * Constructs a new HashStatus.
     * @memberof BreachWatch
     * @classdesc Represents a HashStatus.
     * @implements IHashStatus
     * @constructor
     * @param {BreachWatch.IHashStatus=} [properties] Properties to set
     */
    function HashStatus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * HashStatus hash1.
     * @member {Uint8Array} hash1
     * @memberof BreachWatch.HashStatus
     * @instance
     */
    HashStatus.prototype.hash1 = $util.newBuffer([]);

    /**
     * HashStatus euid.
     * @member {Uint8Array} euid
     * @memberof BreachWatch.HashStatus
     * @instance
     */
    HashStatus.prototype.euid = $util.newBuffer([]);

    /**
     * HashStatus breachDetected.
     * @member {boolean} breachDetected
     * @memberof BreachWatch.HashStatus
     * @instance
     */
    HashStatus.prototype.breachDetected = false;

    /**
     * Creates a new HashStatus instance using the specified properties.
     * @function create
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {BreachWatch.IHashStatus=} [properties] Properties to set
     * @returns {BreachWatch.HashStatus} HashStatus instance
     */
    HashStatus.create = function create(properties) {
      return new HashStatus(properties);
    };

    /**
     * Encodes the specified HashStatus message. Does not implicitly {@link BreachWatch.HashStatus.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {BreachWatch.IHashStatus} message HashStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    HashStatus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.hash1 != null && Object.hasOwnProperty.call(message, "hash1"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.hash1);
      if (message.euid != null && Object.hasOwnProperty.call(message, "euid"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.euid);
      if (message.breachDetected != null && Object.hasOwnProperty.call(message, "breachDetected"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.breachDetected);
      return writer;
    };

    /**
     * Encodes the specified HashStatus message, length delimited. Does not implicitly {@link BreachWatch.HashStatus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {BreachWatch.IHashStatus} message HashStatus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    HashStatus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a HashStatus message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.HashStatus} HashStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    HashStatus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.HashStatus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.hash1 = reader.bytes();
            break;
          }
          case 2: {
            message.euid = reader.bytes();
            break;
          }
          case 3: {
            message.breachDetected = reader.bool();
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
     * Decodes a HashStatus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.HashStatus} HashStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    HashStatus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a HashStatus message.
     * @function verify
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    HashStatus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.hash1 != null && message.hasOwnProperty("hash1"))
        if (
          !(
            (message.hash1 && typeof message.hash1.length === "number") ||
            $util.isString(message.hash1)
          )
        )
          return "hash1: buffer expected";
      if (message.euid != null && message.hasOwnProperty("euid"))
        if (
          !(
            (message.euid && typeof message.euid.length === "number") ||
            $util.isString(message.euid)
          )
        )
          return "euid: buffer expected";
      if (message.breachDetected != null && message.hasOwnProperty("breachDetected"))
        if (typeof message.breachDetected !== "boolean") return "breachDetected: boolean expected";
      return null;
    };

    /**
     * Creates a HashStatus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.HashStatus} HashStatus
     */
    HashStatus.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.HashStatus) return object;
      let message = new $root.BreachWatch.HashStatus();
      if (object.hash1 != null)
        if (typeof object.hash1 === "string")
          $util.base64.decode(
            object.hash1,
            (message.hash1 = $util.newBuffer($util.base64.length(object.hash1))),
            0,
          );
        else if (object.hash1.length >= 0) message.hash1 = object.hash1;
      if (object.euid != null)
        if (typeof object.euid === "string")
          $util.base64.decode(
            object.euid,
            (message.euid = $util.newBuffer($util.base64.length(object.euid))),
            0,
          );
        else if (object.euid.length >= 0) message.euid = object.euid;
      if (object.breachDetected != null) message.breachDetected = Boolean(object.breachDetected);
      return message;
    };

    /**
     * Creates a plain object from a HashStatus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {BreachWatch.HashStatus} message HashStatus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    HashStatus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.hash1 = "";
        else {
          object.hash1 = [];
          if (options.bytes !== Array) object.hash1 = $util.newBuffer(object.hash1);
        }
        if (options.bytes === String) object.euid = "";
        else {
          object.euid = [];
          if (options.bytes !== Array) object.euid = $util.newBuffer(object.euid);
        }
        object.breachDetected = false;
      }
      if (message.hash1 != null && message.hasOwnProperty("hash1"))
        object.hash1 =
          options.bytes === String
            ? $util.base64.encode(message.hash1, 0, message.hash1.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.hash1)
              : message.hash1;
      if (message.euid != null && message.hasOwnProperty("euid"))
        object.euid =
          options.bytes === String
            ? $util.base64.encode(message.euid, 0, message.euid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.euid)
              : message.euid;
      if (message.breachDetected != null && message.hasOwnProperty("breachDetected"))
        object.breachDetected = message.breachDetected;
      return object;
    };

    /**
     * Converts this HashStatus to JSON.
     * @function toJSON
     * @memberof BreachWatch.HashStatus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    HashStatus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for HashStatus
     * @function getTypeUrl
     * @memberof BreachWatch.HashStatus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    HashStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.HashStatus";
    };

    return HashStatus;
  })();

  BreachWatch.BreachWatchStatusResponse = (function () {
    /**
     * Properties of a BreachWatchStatusResponse.
     * @memberof BreachWatch
     * @interface IBreachWatchStatusResponse
     * @property {Array.<BreachWatch.IHashStatus>|null} [hashStatus] BreachWatchStatusResponse hashStatus
     */

    /**
     * Constructs a new BreachWatchStatusResponse.
     * @memberof BreachWatch
     * @classdesc Represents a BreachWatchStatusResponse.
     * @implements IBreachWatchStatusResponse
     * @constructor
     * @param {BreachWatch.IBreachWatchStatusResponse=} [properties] Properties to set
     */
    function BreachWatchStatusResponse(properties) {
      this.hashStatus = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachWatchStatusResponse hashStatus.
     * @member {Array.<BreachWatch.IHashStatus>} hashStatus
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @instance
     */
    BreachWatchStatusResponse.prototype.hashStatus = $util.emptyArray;

    /**
     * Creates a new BreachWatchStatusResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {BreachWatch.IBreachWatchStatusResponse=} [properties] Properties to set
     * @returns {BreachWatch.BreachWatchStatusResponse} BreachWatchStatusResponse instance
     */
    BreachWatchStatusResponse.create = function create(properties) {
      return new BreachWatchStatusResponse(properties);
    };

    /**
     * Encodes the specified BreachWatchStatusResponse message. Does not implicitly {@link BreachWatch.BreachWatchStatusResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {BreachWatch.IBreachWatchStatusResponse} message BreachWatchStatusResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchStatusResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.hashStatus != null && message.hashStatus.length)
        for (let i = 0; i < message.hashStatus.length; ++i)
          $root.BreachWatch.HashStatus.encode(
            message.hashStatus[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified BreachWatchStatusResponse message, length delimited. Does not implicitly {@link BreachWatch.BreachWatchStatusResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {BreachWatch.IBreachWatchStatusResponse} message BreachWatchStatusResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachWatchStatusResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachWatchStatusResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachWatchStatusResponse} BreachWatchStatusResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchStatusResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachWatchStatusResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 2: {
            if (!(message.hashStatus && message.hashStatus.length)) message.hashStatus = [];
            message.hashStatus.push($root.BreachWatch.HashStatus.decode(reader, reader.uint32()));
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
     * Decodes a BreachWatchStatusResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachWatchStatusResponse} BreachWatchStatusResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachWatchStatusResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachWatchStatusResponse message.
     * @function verify
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachWatchStatusResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.hashStatus != null && message.hasOwnProperty("hashStatus")) {
        if (!Array.isArray(message.hashStatus)) return "hashStatus: array expected";
        for (let i = 0; i < message.hashStatus.length; ++i) {
          let error = $root.BreachWatch.HashStatus.verify(message.hashStatus[i]);
          if (error) return "hashStatus." + error;
        }
      }
      return null;
    };

    /**
     * Creates a BreachWatchStatusResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachWatchStatusResponse} BreachWatchStatusResponse
     */
    BreachWatchStatusResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachWatchStatusResponse) return object;
      let message = new $root.BreachWatch.BreachWatchStatusResponse();
      if (object.hashStatus) {
        if (!Array.isArray(object.hashStatus))
          throw TypeError(".BreachWatch.BreachWatchStatusResponse.hashStatus: array expected");
        message.hashStatus = [];
        for (let i = 0; i < object.hashStatus.length; ++i) {
          if (typeof object.hashStatus[i] !== "object")
            throw TypeError(".BreachWatch.BreachWatchStatusResponse.hashStatus: object expected");
          message.hashStatus[i] = $root.BreachWatch.HashStatus.fromObject(object.hashStatus[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a BreachWatchStatusResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {BreachWatch.BreachWatchStatusResponse} message BreachWatchStatusResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachWatchStatusResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.hashStatus = [];
      if (message.hashStatus && message.hashStatus.length) {
        object.hashStatus = [];
        for (let j = 0; j < message.hashStatus.length; ++j)
          object.hashStatus[j] = $root.BreachWatch.HashStatus.toObject(
            message.hashStatus[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this BreachWatchStatusResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachWatchStatusResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachWatchStatusResponse
     * @function getTypeUrl
     * @memberof BreachWatch.BreachWatchStatusResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachWatchStatusResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachWatchStatusResponse";
    };

    return BreachWatchStatusResponse;
  })();

  BreachWatch.EnterprisePublicKeyResponse = (function () {
    /**
     * Properties of an EnterprisePublicKeyResponse.
     * @memberof BreachWatch
     * @interface IEnterprisePublicKeyResponse
     * @property {Uint8Array|null} [enterprisePublicKey] EnterprisePublicKeyResponse enterprisePublicKey
     * @property {Uint8Array|null} [enterpriseECCPublicKey] EnterprisePublicKeyResponse enterpriseECCPublicKey
     */

    /**
     * Constructs a new EnterprisePublicKeyResponse.
     * @memberof BreachWatch
     * @classdesc Represents an EnterprisePublicKeyResponse.
     * @implements IEnterprisePublicKeyResponse
     * @constructor
     * @param {BreachWatch.IEnterprisePublicKeyResponse=} [properties] Properties to set
     */
    function EnterprisePublicKeyResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * EnterprisePublicKeyResponse enterprisePublicKey.
     * @member {Uint8Array} enterprisePublicKey
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @instance
     */
    EnterprisePublicKeyResponse.prototype.enterprisePublicKey = $util.newBuffer([]);

    /**
     * EnterprisePublicKeyResponse enterpriseECCPublicKey.
     * @member {Uint8Array} enterpriseECCPublicKey
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @instance
     */
    EnterprisePublicKeyResponse.prototype.enterpriseECCPublicKey = $util.newBuffer([]);

    /**
     * Creates a new EnterprisePublicKeyResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {BreachWatch.IEnterprisePublicKeyResponse=} [properties] Properties to set
     * @returns {BreachWatch.EnterprisePublicKeyResponse} EnterprisePublicKeyResponse instance
     */
    EnterprisePublicKeyResponse.create = function create(properties) {
      return new EnterprisePublicKeyResponse(properties);
    };

    /**
     * Encodes the specified EnterprisePublicKeyResponse message. Does not implicitly {@link BreachWatch.EnterprisePublicKeyResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {BreachWatch.IEnterprisePublicKeyResponse} message EnterprisePublicKeyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EnterprisePublicKeyResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.enterprisePublicKey != null &&
        Object.hasOwnProperty.call(message, "enterprisePublicKey")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.enterprisePublicKey);
      if (
        message.enterpriseECCPublicKey != null &&
        Object.hasOwnProperty.call(message, "enterpriseECCPublicKey")
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.enterpriseECCPublicKey);
      return writer;
    };

    /**
     * Encodes the specified EnterprisePublicKeyResponse message, length delimited. Does not implicitly {@link BreachWatch.EnterprisePublicKeyResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {BreachWatch.IEnterprisePublicKeyResponse} message EnterprisePublicKeyResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EnterprisePublicKeyResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an EnterprisePublicKeyResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.EnterprisePublicKeyResponse} EnterprisePublicKeyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EnterprisePublicKeyResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.EnterprisePublicKeyResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.enterprisePublicKey = reader.bytes();
            break;
          }
          case 2: {
            message.enterpriseECCPublicKey = reader.bytes();
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
     * Decodes an EnterprisePublicKeyResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.EnterprisePublicKeyResponse} EnterprisePublicKeyResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EnterprisePublicKeyResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an EnterprisePublicKeyResponse message.
     * @function verify
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    EnterprisePublicKeyResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.enterprisePublicKey != null && message.hasOwnProperty("enterprisePublicKey"))
        if (
          !(
            (message.enterprisePublicKey &&
              typeof message.enterprisePublicKey.length === "number") ||
            $util.isString(message.enterprisePublicKey)
          )
        )
          return "enterprisePublicKey: buffer expected";
      if (
        message.enterpriseECCPublicKey != null &&
        message.hasOwnProperty("enterpriseECCPublicKey")
      )
        if (
          !(
            (message.enterpriseECCPublicKey &&
              typeof message.enterpriseECCPublicKey.length === "number") ||
            $util.isString(message.enterpriseECCPublicKey)
          )
        )
          return "enterpriseECCPublicKey: buffer expected";
      return null;
    };

    /**
     * Creates an EnterprisePublicKeyResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.EnterprisePublicKeyResponse} EnterprisePublicKeyResponse
     */
    EnterprisePublicKeyResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.EnterprisePublicKeyResponse) return object;
      let message = new $root.BreachWatch.EnterprisePublicKeyResponse();
      if (object.enterprisePublicKey != null)
        if (typeof object.enterprisePublicKey === "string")
          $util.base64.decode(
            object.enterprisePublicKey,
            (message.enterprisePublicKey = $util.newBuffer(
              $util.base64.length(object.enterprisePublicKey),
            )),
            0,
          );
        else if (object.enterprisePublicKey.length >= 0)
          message.enterprisePublicKey = object.enterprisePublicKey;
      if (object.enterpriseECCPublicKey != null)
        if (typeof object.enterpriseECCPublicKey === "string")
          $util.base64.decode(
            object.enterpriseECCPublicKey,
            (message.enterpriseECCPublicKey = $util.newBuffer(
              $util.base64.length(object.enterpriseECCPublicKey),
            )),
            0,
          );
        else if (object.enterpriseECCPublicKey.length >= 0)
          message.enterpriseECCPublicKey = object.enterpriseECCPublicKey;
      return message;
    };

    /**
     * Creates a plain object from an EnterprisePublicKeyResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {BreachWatch.EnterprisePublicKeyResponse} message EnterprisePublicKeyResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    EnterprisePublicKeyResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.enterprisePublicKey = "";
        else {
          object.enterprisePublicKey = [];
          if (options.bytes !== Array)
            object.enterprisePublicKey = $util.newBuffer(object.enterprisePublicKey);
        }
        if (options.bytes === String) object.enterpriseECCPublicKey = "";
        else {
          object.enterpriseECCPublicKey = [];
          if (options.bytes !== Array)
            object.enterpriseECCPublicKey = $util.newBuffer(object.enterpriseECCPublicKey);
        }
      }
      if (message.enterprisePublicKey != null && message.hasOwnProperty("enterprisePublicKey"))
        object.enterprisePublicKey =
          options.bytes === String
            ? $util.base64.encode(
                message.enterprisePublicKey,
                0,
                message.enterprisePublicKey.length,
              )
            : options.bytes === Array
              ? Array.prototype.slice.call(message.enterprisePublicKey)
              : message.enterprisePublicKey;
      if (
        message.enterpriseECCPublicKey != null &&
        message.hasOwnProperty("enterpriseECCPublicKey")
      )
        object.enterpriseECCPublicKey =
          options.bytes === String
            ? $util.base64.encode(
                message.enterpriseECCPublicKey,
                0,
                message.enterpriseECCPublicKey.length,
              )
            : options.bytes === Array
              ? Array.prototype.slice.call(message.enterpriseECCPublicKey)
              : message.enterpriseECCPublicKey;
      return object;
    };

    /**
     * Converts this EnterprisePublicKeyResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    EnterprisePublicKeyResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for EnterprisePublicKeyResponse
     * @function getTypeUrl
     * @memberof BreachWatch.EnterprisePublicKeyResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    EnterprisePublicKeyResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.EnterprisePublicKeyResponse";
    };

    return EnterprisePublicKeyResponse;
  })();

  BreachWatch.FreeScanRequest = (function () {
    /**
     * Properties of a FreeScanRequest.
     * @memberof BreachWatch
     * @interface IFreeScanRequest
     * @property {Uint8Array|null} [hashedEmail] FreeScanRequest hashedEmail
     */

    /**
     * Constructs a new FreeScanRequest.
     * @memberof BreachWatch
     * @classdesc Represents a FreeScanRequest.
     * @implements IFreeScanRequest
     * @constructor
     * @param {BreachWatch.IFreeScanRequest=} [properties] Properties to set
     */
    function FreeScanRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FreeScanRequest hashedEmail.
     * @member {Uint8Array} hashedEmail
     * @memberof BreachWatch.FreeScanRequest
     * @instance
     */
    FreeScanRequest.prototype.hashedEmail = $util.newBuffer([]);

    /**
     * Creates a new FreeScanRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {BreachWatch.IFreeScanRequest=} [properties] Properties to set
     * @returns {BreachWatch.FreeScanRequest} FreeScanRequest instance
     */
    FreeScanRequest.create = function create(properties) {
      return new FreeScanRequest(properties);
    };

    /**
     * Encodes the specified FreeScanRequest message. Does not implicitly {@link BreachWatch.FreeScanRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {BreachWatch.IFreeScanRequest} message FreeScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreeScanRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.hashedEmail != null && Object.hasOwnProperty.call(message, "hashedEmail"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.hashedEmail);
      return writer;
    };

    /**
     * Encodes the specified FreeScanRequest message, length delimited. Does not implicitly {@link BreachWatch.FreeScanRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {BreachWatch.IFreeScanRequest} message FreeScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreeScanRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FreeScanRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.FreeScanRequest} FreeScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreeScanRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.FreeScanRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.hashedEmail = reader.bytes();
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
     * Decodes a FreeScanRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.FreeScanRequest} FreeScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreeScanRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FreeScanRequest message.
     * @function verify
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FreeScanRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.hashedEmail != null && message.hasOwnProperty("hashedEmail"))
        if (
          !(
            (message.hashedEmail && typeof message.hashedEmail.length === "number") ||
            $util.isString(message.hashedEmail)
          )
        )
          return "hashedEmail: buffer expected";
      return null;
    };

    /**
     * Creates a FreeScanRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.FreeScanRequest} FreeScanRequest
     */
    FreeScanRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.FreeScanRequest) return object;
      let message = new $root.BreachWatch.FreeScanRequest();
      if (object.hashedEmail != null)
        if (typeof object.hashedEmail === "string")
          $util.base64.decode(
            object.hashedEmail,
            (message.hashedEmail = $util.newBuffer($util.base64.length(object.hashedEmail))),
            0,
          );
        else if (object.hashedEmail.length >= 0) message.hashedEmail = object.hashedEmail;
      return message;
    };

    /**
     * Creates a plain object from a FreeScanRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {BreachWatch.FreeScanRequest} message FreeScanRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FreeScanRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.hashedEmail = "";
        else {
          object.hashedEmail = [];
          if (options.bytes !== Array) object.hashedEmail = $util.newBuffer(object.hashedEmail);
        }
      if (message.hashedEmail != null && message.hasOwnProperty("hashedEmail"))
        object.hashedEmail =
          options.bytes === String
            ? $util.base64.encode(message.hashedEmail, 0, message.hashedEmail.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.hashedEmail)
              : message.hashedEmail;
      return object;
    };

    /**
     * Converts this FreeScanRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.FreeScanRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FreeScanRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FreeScanRequest
     * @function getTypeUrl
     * @memberof BreachWatch.FreeScanRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FreeScanRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.FreeScanRequest";
    };

    return FreeScanRequest;
  })();

  BreachWatch.FreeScanResponse = (function () {
    /**
     * Properties of a FreeScanResponse.
     * @memberof BreachWatch
     * @interface IFreeScanResponse
     * @property {number|null} [emailBreaches] FreeScanResponse emailBreaches
     * @property {number|null} [passwordBreaches] FreeScanResponse passwordBreaches
     */

    /**
     * Constructs a new FreeScanResponse.
     * @memberof BreachWatch
     * @classdesc Represents a FreeScanResponse.
     * @implements IFreeScanResponse
     * @constructor
     * @param {BreachWatch.IFreeScanResponse=} [properties] Properties to set
     */
    function FreeScanResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FreeScanResponse emailBreaches.
     * @member {number} emailBreaches
     * @memberof BreachWatch.FreeScanResponse
     * @instance
     */
    FreeScanResponse.prototype.emailBreaches = 0;

    /**
     * FreeScanResponse passwordBreaches.
     * @member {number} passwordBreaches
     * @memberof BreachWatch.FreeScanResponse
     * @instance
     */
    FreeScanResponse.prototype.passwordBreaches = 0;

    /**
     * Creates a new FreeScanResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {BreachWatch.IFreeScanResponse=} [properties] Properties to set
     * @returns {BreachWatch.FreeScanResponse} FreeScanResponse instance
     */
    FreeScanResponse.create = function create(properties) {
      return new FreeScanResponse(properties);
    };

    /**
     * Encodes the specified FreeScanResponse message. Does not implicitly {@link BreachWatch.FreeScanResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {BreachWatch.IFreeScanResponse} message FreeScanResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreeScanResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.emailBreaches != null && Object.hasOwnProperty.call(message, "emailBreaches"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.emailBreaches);
      if (
        message.passwordBreaches != null &&
        Object.hasOwnProperty.call(message, "passwordBreaches")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.passwordBreaches);
      return writer;
    };

    /**
     * Encodes the specified FreeScanResponse message, length delimited. Does not implicitly {@link BreachWatch.FreeScanResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {BreachWatch.IFreeScanResponse} message FreeScanResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreeScanResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FreeScanResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.FreeScanResponse} FreeScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreeScanResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.FreeScanResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.emailBreaches = reader.int32();
            break;
          }
          case 2: {
            message.passwordBreaches = reader.int32();
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
     * Decodes a FreeScanResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.FreeScanResponse} FreeScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreeScanResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FreeScanResponse message.
     * @function verify
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FreeScanResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.emailBreaches != null && message.hasOwnProperty("emailBreaches"))
        if (!$util.isInteger(message.emailBreaches)) return "emailBreaches: integer expected";
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        if (!$util.isInteger(message.passwordBreaches)) return "passwordBreaches: integer expected";
      return null;
    };

    /**
     * Creates a FreeScanResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.FreeScanResponse} FreeScanResponse
     */
    FreeScanResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.FreeScanResponse) return object;
      let message = new $root.BreachWatch.FreeScanResponse();
      if (object.emailBreaches != null) message.emailBreaches = object.emailBreaches | 0;
      if (object.passwordBreaches != null) message.passwordBreaches = object.passwordBreaches | 0;
      return message;
    };

    /**
     * Creates a plain object from a FreeScanResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {BreachWatch.FreeScanResponse} message FreeScanResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FreeScanResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.emailBreaches = 0;
        object.passwordBreaches = 0;
      }
      if (message.emailBreaches != null && message.hasOwnProperty("emailBreaches"))
        object.emailBreaches = message.emailBreaches;
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        object.passwordBreaches = message.passwordBreaches;
      return object;
    };

    /**
     * Converts this FreeScanResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.FreeScanResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FreeScanResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FreeScanResponse
     * @function getTypeUrl
     * @memberof BreachWatch.FreeScanResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FreeScanResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.FreeScanResponse";
    };

    return FreeScanResponse;
  })();

  BreachWatch.PaidUserRequest = (function () {
    /**
     * Properties of a PaidUserRequest.
     * @memberof BreachWatch
     * @interface IPaidUserRequest
     * @property {string|null} [email] PaidUserRequest email
     */

    /**
     * Constructs a new PaidUserRequest.
     * @memberof BreachWatch
     * @classdesc Represents a PaidUserRequest.
     * @implements IPaidUserRequest
     * @constructor
     * @param {BreachWatch.IPaidUserRequest=} [properties] Properties to set
     */
    function PaidUserRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * PaidUserRequest email.
     * @member {string} email
     * @memberof BreachWatch.PaidUserRequest
     * @instance
     */
    PaidUserRequest.prototype.email = "";

    /**
     * Creates a new PaidUserRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {BreachWatch.IPaidUserRequest=} [properties] Properties to set
     * @returns {BreachWatch.PaidUserRequest} PaidUserRequest instance
     */
    PaidUserRequest.create = function create(properties) {
      return new PaidUserRequest(properties);
    };

    /**
     * Encodes the specified PaidUserRequest message. Does not implicitly {@link BreachWatch.PaidUserRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {BreachWatch.IPaidUserRequest} message PaidUserRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PaidUserRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.email != null && Object.hasOwnProperty.call(message, "email"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.email);
      return writer;
    };

    /**
     * Encodes the specified PaidUserRequest message, length delimited. Does not implicitly {@link BreachWatch.PaidUserRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {BreachWatch.IPaidUserRequest} message PaidUserRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PaidUserRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a PaidUserRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.PaidUserRequest} PaidUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PaidUserRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.PaidUserRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.email = reader.string();
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
     * Decodes a PaidUserRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.PaidUserRequest} PaidUserRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PaidUserRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a PaidUserRequest message.
     * @function verify
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    PaidUserRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.email != null && message.hasOwnProperty("email"))
        if (!$util.isString(message.email)) return "email: string expected";
      return null;
    };

    /**
     * Creates a PaidUserRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.PaidUserRequest} PaidUserRequest
     */
    PaidUserRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.PaidUserRequest) return object;
      let message = new $root.BreachWatch.PaidUserRequest();
      if (object.email != null) message.email = String(object.email);
      return message;
    };

    /**
     * Creates a plain object from a PaidUserRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {BreachWatch.PaidUserRequest} message PaidUserRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    PaidUserRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) object.email = "";
      if (message.email != null && message.hasOwnProperty("email")) object.email = message.email;
      return object;
    };

    /**
     * Converts this PaidUserRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.PaidUserRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    PaidUserRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for PaidUserRequest
     * @function getTypeUrl
     * @memberof BreachWatch.PaidUserRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    PaidUserRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.PaidUserRequest";
    };

    return PaidUserRequest;
  })();

  BreachWatch.PaidUserResponse = (function () {
    /**
     * Properties of a PaidUserResponse.
     * @memberof BreachWatch
     * @interface IPaidUserResponse
     * @property {boolean|null} [paidUser] PaidUserResponse paidUser
     */

    /**
     * Constructs a new PaidUserResponse.
     * @memberof BreachWatch
     * @classdesc Represents a PaidUserResponse.
     * @implements IPaidUserResponse
     * @constructor
     * @param {BreachWatch.IPaidUserResponse=} [properties] Properties to set
     */
    function PaidUserResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * PaidUserResponse paidUser.
     * @member {boolean} paidUser
     * @memberof BreachWatch.PaidUserResponse
     * @instance
     */
    PaidUserResponse.prototype.paidUser = false;

    /**
     * Creates a new PaidUserResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {BreachWatch.IPaidUserResponse=} [properties] Properties to set
     * @returns {BreachWatch.PaidUserResponse} PaidUserResponse instance
     */
    PaidUserResponse.create = function create(properties) {
      return new PaidUserResponse(properties);
    };

    /**
     * Encodes the specified PaidUserResponse message. Does not implicitly {@link BreachWatch.PaidUserResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {BreachWatch.IPaidUserResponse} message PaidUserResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PaidUserResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.paidUser != null && Object.hasOwnProperty.call(message, "paidUser"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).bool(message.paidUser);
      return writer;
    };

    /**
     * Encodes the specified PaidUserResponse message, length delimited. Does not implicitly {@link BreachWatch.PaidUserResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {BreachWatch.IPaidUserResponse} message PaidUserResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PaidUserResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a PaidUserResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.PaidUserResponse} PaidUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PaidUserResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.PaidUserResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.paidUser = reader.bool();
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
     * Decodes a PaidUserResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.PaidUserResponse} PaidUserResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PaidUserResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a PaidUserResponse message.
     * @function verify
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    PaidUserResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.paidUser != null && message.hasOwnProperty("paidUser"))
        if (typeof message.paidUser !== "boolean") return "paidUser: boolean expected";
      return null;
    };

    /**
     * Creates a PaidUserResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.PaidUserResponse} PaidUserResponse
     */
    PaidUserResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.PaidUserResponse) return object;
      let message = new $root.BreachWatch.PaidUserResponse();
      if (object.paidUser != null) message.paidUser = Boolean(object.paidUser);
      return message;
    };

    /**
     * Creates a plain object from a PaidUserResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {BreachWatch.PaidUserResponse} message PaidUserResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    PaidUserResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) object.paidUser = false;
      if (message.paidUser != null && message.hasOwnProperty("paidUser"))
        object.paidUser = message.paidUser;
      return object;
    };

    /**
     * Converts this PaidUserResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.PaidUserResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    PaidUserResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for PaidUserResponse
     * @function getTypeUrl
     * @memberof BreachWatch.PaidUserResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    PaidUserResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.PaidUserResponse";
    };

    return PaidUserResponse;
  })();

  BreachWatch.DetailedScanRequest = (function () {
    /**
     * Properties of a DetailedScanRequest.
     * @memberof BreachWatch
     * @interface IDetailedScanRequest
     * @property {string|null} [email] DetailedScanRequest email
     */

    /**
     * Constructs a new DetailedScanRequest.
     * @memberof BreachWatch
     * @classdesc Represents a DetailedScanRequest.
     * @implements IDetailedScanRequest
     * @constructor
     * @param {BreachWatch.IDetailedScanRequest=} [properties] Properties to set
     */
    function DetailedScanRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * DetailedScanRequest email.
     * @member {string} email
     * @memberof BreachWatch.DetailedScanRequest
     * @instance
     */
    DetailedScanRequest.prototype.email = "";

    /**
     * Creates a new DetailedScanRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {BreachWatch.IDetailedScanRequest=} [properties] Properties to set
     * @returns {BreachWatch.DetailedScanRequest} DetailedScanRequest instance
     */
    DetailedScanRequest.create = function create(properties) {
      return new DetailedScanRequest(properties);
    };

    /**
     * Encodes the specified DetailedScanRequest message. Does not implicitly {@link BreachWatch.DetailedScanRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {BreachWatch.IDetailedScanRequest} message DetailedScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DetailedScanRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.email != null && Object.hasOwnProperty.call(message, "email"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.email);
      return writer;
    };

    /**
     * Encodes the specified DetailedScanRequest message, length delimited. Does not implicitly {@link BreachWatch.DetailedScanRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {BreachWatch.IDetailedScanRequest} message DetailedScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DetailedScanRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DetailedScanRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.DetailedScanRequest} DetailedScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DetailedScanRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.DetailedScanRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.email = reader.string();
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
     * Decodes a DetailedScanRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.DetailedScanRequest} DetailedScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DetailedScanRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DetailedScanRequest message.
     * @function verify
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DetailedScanRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.email != null && message.hasOwnProperty("email"))
        if (!$util.isString(message.email)) return "email: string expected";
      return null;
    };

    /**
     * Creates a DetailedScanRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.DetailedScanRequest} DetailedScanRequest
     */
    DetailedScanRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.DetailedScanRequest) return object;
      let message = new $root.BreachWatch.DetailedScanRequest();
      if (object.email != null) message.email = String(object.email);
      return message;
    };

    /**
     * Creates a plain object from a DetailedScanRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {BreachWatch.DetailedScanRequest} message DetailedScanRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DetailedScanRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) object.email = "";
      if (message.email != null && message.hasOwnProperty("email")) object.email = message.email;
      return object;
    };

    /**
     * Converts this DetailedScanRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.DetailedScanRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DetailedScanRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for DetailedScanRequest
     * @function getTypeUrl
     * @memberof BreachWatch.DetailedScanRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    DetailedScanRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.DetailedScanRequest";
    };

    return DetailedScanRequest;
  })();

  BreachWatch.UseOneTimeTokenRequest = (function () {
    /**
     * Properties of a UseOneTimeTokenRequest.
     * @memberof BreachWatch
     * @interface IUseOneTimeTokenRequest
     * @property {Uint8Array|null} [token] UseOneTimeTokenRequest token
     */

    /**
     * Constructs a new UseOneTimeTokenRequest.
     * @memberof BreachWatch
     * @classdesc Represents a UseOneTimeTokenRequest.
     * @implements IUseOneTimeTokenRequest
     * @constructor
     * @param {BreachWatch.IUseOneTimeTokenRequest=} [properties] Properties to set
     */
    function UseOneTimeTokenRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UseOneTimeTokenRequest token.
     * @member {Uint8Array} token
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @instance
     */
    UseOneTimeTokenRequest.prototype.token = $util.newBuffer([]);

    /**
     * Creates a new UseOneTimeTokenRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {BreachWatch.IUseOneTimeTokenRequest=} [properties] Properties to set
     * @returns {BreachWatch.UseOneTimeTokenRequest} UseOneTimeTokenRequest instance
     */
    UseOneTimeTokenRequest.create = function create(properties) {
      return new UseOneTimeTokenRequest(properties);
    };

    /**
     * Encodes the specified UseOneTimeTokenRequest message. Does not implicitly {@link BreachWatch.UseOneTimeTokenRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {BreachWatch.IUseOneTimeTokenRequest} message UseOneTimeTokenRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UseOneTimeTokenRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.token != null && Object.hasOwnProperty.call(message, "token"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.token);
      return writer;
    };

    /**
     * Encodes the specified UseOneTimeTokenRequest message, length delimited. Does not implicitly {@link BreachWatch.UseOneTimeTokenRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {BreachWatch.IUseOneTimeTokenRequest} message UseOneTimeTokenRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UseOneTimeTokenRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UseOneTimeTokenRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.UseOneTimeTokenRequest} UseOneTimeTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UseOneTimeTokenRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.UseOneTimeTokenRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.token = reader.bytes();
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
     * Decodes a UseOneTimeTokenRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.UseOneTimeTokenRequest} UseOneTimeTokenRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UseOneTimeTokenRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UseOneTimeTokenRequest message.
     * @function verify
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UseOneTimeTokenRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.token != null && message.hasOwnProperty("token"))
        if (
          !(
            (message.token && typeof message.token.length === "number") ||
            $util.isString(message.token)
          )
        )
          return "token: buffer expected";
      return null;
    };

    /**
     * Creates a UseOneTimeTokenRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.UseOneTimeTokenRequest} UseOneTimeTokenRequest
     */
    UseOneTimeTokenRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.UseOneTimeTokenRequest) return object;
      let message = new $root.BreachWatch.UseOneTimeTokenRequest();
      if (object.token != null)
        if (typeof object.token === "string")
          $util.base64.decode(
            object.token,
            (message.token = $util.newBuffer($util.base64.length(object.token))),
            0,
          );
        else if (object.token.length >= 0) message.token = object.token;
      return message;
    };

    /**
     * Creates a plain object from a UseOneTimeTokenRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {BreachWatch.UseOneTimeTokenRequest} message UseOneTimeTokenRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UseOneTimeTokenRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.token = "";
        else {
          object.token = [];
          if (options.bytes !== Array) object.token = $util.newBuffer(object.token);
        }
      if (message.token != null && message.hasOwnProperty("token"))
        object.token =
          options.bytes === String
            ? $util.base64.encode(message.token, 0, message.token.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.token)
              : message.token;
      return object;
    };

    /**
     * Converts this UseOneTimeTokenRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UseOneTimeTokenRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UseOneTimeTokenRequest
     * @function getTypeUrl
     * @memberof BreachWatch.UseOneTimeTokenRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UseOneTimeTokenRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.UseOneTimeTokenRequest";
    };

    return UseOneTimeTokenRequest;
  })();

  BreachWatch.BreachEvent = (function () {
    /**
     * Properties of a BreachEvent.
     * @memberof BreachWatch
     * @interface IBreachEvent
     * @property {string|null} [site] BreachEvent site
     * @property {string|null} [email] BreachEvent email
     * @property {boolean|null} [passwordInBreach] BreachEvent passwordInBreach
     * @property {string|null} [date] BreachEvent date
     * @property {string|null} [description] BreachEvent description
     */

    /**
     * Constructs a new BreachEvent.
     * @memberof BreachWatch
     * @classdesc Represents a BreachEvent.
     * @implements IBreachEvent
     * @constructor
     * @param {BreachWatch.IBreachEvent=} [properties] Properties to set
     */
    function BreachEvent(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * BreachEvent site.
     * @member {string} site
     * @memberof BreachWatch.BreachEvent
     * @instance
     */
    BreachEvent.prototype.site = "";

    /**
     * BreachEvent email.
     * @member {string} email
     * @memberof BreachWatch.BreachEvent
     * @instance
     */
    BreachEvent.prototype.email = "";

    /**
     * BreachEvent passwordInBreach.
     * @member {boolean} passwordInBreach
     * @memberof BreachWatch.BreachEvent
     * @instance
     */
    BreachEvent.prototype.passwordInBreach = false;

    /**
     * BreachEvent date.
     * @member {string} date
     * @memberof BreachWatch.BreachEvent
     * @instance
     */
    BreachEvent.prototype.date = "";

    /**
     * BreachEvent description.
     * @member {string} description
     * @memberof BreachWatch.BreachEvent
     * @instance
     */
    BreachEvent.prototype.description = "";

    /**
     * Creates a new BreachEvent instance using the specified properties.
     * @function create
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {BreachWatch.IBreachEvent=} [properties] Properties to set
     * @returns {BreachWatch.BreachEvent} BreachEvent instance
     */
    BreachEvent.create = function create(properties) {
      return new BreachEvent(properties);
    };

    /**
     * Encodes the specified BreachEvent message. Does not implicitly {@link BreachWatch.BreachEvent.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {BreachWatch.IBreachEvent} message BreachEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachEvent.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.site != null && Object.hasOwnProperty.call(message, "site"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.site);
      if (message.email != null && Object.hasOwnProperty.call(message, "email"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.email);
      if (
        message.passwordInBreach != null &&
        Object.hasOwnProperty.call(message, "passwordInBreach")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.passwordInBreach);
      if (message.date != null && Object.hasOwnProperty.call(message, "date"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.date);
      if (message.description != null && Object.hasOwnProperty.call(message, "description"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.description);
      return writer;
    };

    /**
     * Encodes the specified BreachEvent message, length delimited. Does not implicitly {@link BreachWatch.BreachEvent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {BreachWatch.IBreachEvent} message BreachEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BreachEvent.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BreachEvent message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.BreachEvent} BreachEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachEvent.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.BreachEvent();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.site = reader.string();
            break;
          }
          case 2: {
            message.email = reader.string();
            break;
          }
          case 3: {
            message.passwordInBreach = reader.bool();
            break;
          }
          case 4: {
            message.date = reader.string();
            break;
          }
          case 5: {
            message.description = reader.string();
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
     * Decodes a BreachEvent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.BreachEvent} BreachEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BreachEvent.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BreachEvent message.
     * @function verify
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BreachEvent.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.site != null && message.hasOwnProperty("site"))
        if (!$util.isString(message.site)) return "site: string expected";
      if (message.email != null && message.hasOwnProperty("email"))
        if (!$util.isString(message.email)) return "email: string expected";
      if (message.passwordInBreach != null && message.hasOwnProperty("passwordInBreach"))
        if (typeof message.passwordInBreach !== "boolean")
          return "passwordInBreach: boolean expected";
      if (message.date != null && message.hasOwnProperty("date"))
        if (!$util.isString(message.date)) return "date: string expected";
      if (message.description != null && message.hasOwnProperty("description"))
        if (!$util.isString(message.description)) return "description: string expected";
      return null;
    };

    /**
     * Creates a BreachEvent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.BreachEvent} BreachEvent
     */
    BreachEvent.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.BreachEvent) return object;
      let message = new $root.BreachWatch.BreachEvent();
      if (object.site != null) message.site = String(object.site);
      if (object.email != null) message.email = String(object.email);
      if (object.passwordInBreach != null)
        message.passwordInBreach = Boolean(object.passwordInBreach);
      if (object.date != null) message.date = String(object.date);
      if (object.description != null) message.description = String(object.description);
      return message;
    };

    /**
     * Creates a plain object from a BreachEvent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {BreachWatch.BreachEvent} message BreachEvent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BreachEvent.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.site = "";
        object.email = "";
        object.passwordInBreach = false;
        object.date = "";
        object.description = "";
      }
      if (message.site != null && message.hasOwnProperty("site")) object.site = message.site;
      if (message.email != null && message.hasOwnProperty("email")) object.email = message.email;
      if (message.passwordInBreach != null && message.hasOwnProperty("passwordInBreach"))
        object.passwordInBreach = message.passwordInBreach;
      if (message.date != null && message.hasOwnProperty("date")) object.date = message.date;
      if (message.description != null && message.hasOwnProperty("description"))
        object.description = message.description;
      return object;
    };

    /**
     * Converts this BreachEvent to JSON.
     * @function toJSON
     * @memberof BreachWatch.BreachEvent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BreachEvent.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for BreachEvent
     * @function getTypeUrl
     * @memberof BreachWatch.BreachEvent
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    BreachEvent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.BreachEvent";
    };

    return BreachEvent;
  })();

  BreachWatch.UseOneTimeTokenResponse = (function () {
    /**
     * Properties of a UseOneTimeTokenResponse.
     * @memberof BreachWatch
     * @interface IUseOneTimeTokenResponse
     * @property {number|null} [emailBreaches] UseOneTimeTokenResponse emailBreaches
     * @property {number|null} [passwordBreaches] UseOneTimeTokenResponse passwordBreaches
     * @property {Array.<BreachWatch.IBreachEvent>|null} [breachEvents] UseOneTimeTokenResponse breachEvents
     * @property {string|null} [email] UseOneTimeTokenResponse email
     */

    /**
     * Constructs a new UseOneTimeTokenResponse.
     * @memberof BreachWatch
     * @classdesc Represents a UseOneTimeTokenResponse.
     * @implements IUseOneTimeTokenResponse
     * @constructor
     * @param {BreachWatch.IUseOneTimeTokenResponse=} [properties] Properties to set
     */
    function UseOneTimeTokenResponse(properties) {
      this.breachEvents = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UseOneTimeTokenResponse emailBreaches.
     * @member {number} emailBreaches
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @instance
     */
    UseOneTimeTokenResponse.prototype.emailBreaches = 0;

    /**
     * UseOneTimeTokenResponse passwordBreaches.
     * @member {number} passwordBreaches
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @instance
     */
    UseOneTimeTokenResponse.prototype.passwordBreaches = 0;

    /**
     * UseOneTimeTokenResponse breachEvents.
     * @member {Array.<BreachWatch.IBreachEvent>} breachEvents
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @instance
     */
    UseOneTimeTokenResponse.prototype.breachEvents = $util.emptyArray;

    /**
     * UseOneTimeTokenResponse email.
     * @member {string} email
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @instance
     */
    UseOneTimeTokenResponse.prototype.email = "";

    /**
     * Creates a new UseOneTimeTokenResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {BreachWatch.IUseOneTimeTokenResponse=} [properties] Properties to set
     * @returns {BreachWatch.UseOneTimeTokenResponse} UseOneTimeTokenResponse instance
     */
    UseOneTimeTokenResponse.create = function create(properties) {
      return new UseOneTimeTokenResponse(properties);
    };

    /**
     * Encodes the specified UseOneTimeTokenResponse message. Does not implicitly {@link BreachWatch.UseOneTimeTokenResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {BreachWatch.IUseOneTimeTokenResponse} message UseOneTimeTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UseOneTimeTokenResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.emailBreaches != null && Object.hasOwnProperty.call(message, "emailBreaches"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.emailBreaches);
      if (
        message.passwordBreaches != null &&
        Object.hasOwnProperty.call(message, "passwordBreaches")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.passwordBreaches);
      if (message.breachEvents != null && message.breachEvents.length)
        for (let i = 0; i < message.breachEvents.length; ++i)
          $root.BreachWatch.BreachEvent.encode(
            message.breachEvents[i],
            writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          ).ldelim();
      if (message.email != null && Object.hasOwnProperty.call(message, "email"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.email);
      return writer;
    };

    /**
     * Encodes the specified UseOneTimeTokenResponse message, length delimited. Does not implicitly {@link BreachWatch.UseOneTimeTokenResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {BreachWatch.IUseOneTimeTokenResponse} message UseOneTimeTokenResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UseOneTimeTokenResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UseOneTimeTokenResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.UseOneTimeTokenResponse} UseOneTimeTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UseOneTimeTokenResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.UseOneTimeTokenResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.emailBreaches = reader.int32();
            break;
          }
          case 2: {
            message.passwordBreaches = reader.int32();
            break;
          }
          case 3: {
            if (!(message.breachEvents && message.breachEvents.length)) message.breachEvents = [];
            message.breachEvents.push(
              $root.BreachWatch.BreachEvent.decode(reader, reader.uint32()),
            );
            break;
          }
          case 4: {
            message.email = reader.string();
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
     * Decodes a UseOneTimeTokenResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.UseOneTimeTokenResponse} UseOneTimeTokenResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UseOneTimeTokenResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UseOneTimeTokenResponse message.
     * @function verify
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UseOneTimeTokenResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.emailBreaches != null && message.hasOwnProperty("emailBreaches"))
        if (!$util.isInteger(message.emailBreaches)) return "emailBreaches: integer expected";
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        if (!$util.isInteger(message.passwordBreaches)) return "passwordBreaches: integer expected";
      if (message.breachEvents != null && message.hasOwnProperty("breachEvents")) {
        if (!Array.isArray(message.breachEvents)) return "breachEvents: array expected";
        for (let i = 0; i < message.breachEvents.length; ++i) {
          let error = $root.BreachWatch.BreachEvent.verify(message.breachEvents[i]);
          if (error) return "breachEvents." + error;
        }
      }
      if (message.email != null && message.hasOwnProperty("email"))
        if (!$util.isString(message.email)) return "email: string expected";
      return null;
    };

    /**
     * Creates a UseOneTimeTokenResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.UseOneTimeTokenResponse} UseOneTimeTokenResponse
     */
    UseOneTimeTokenResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.UseOneTimeTokenResponse) return object;
      let message = new $root.BreachWatch.UseOneTimeTokenResponse();
      if (object.emailBreaches != null) message.emailBreaches = object.emailBreaches | 0;
      if (object.passwordBreaches != null) message.passwordBreaches = object.passwordBreaches | 0;
      if (object.breachEvents) {
        if (!Array.isArray(object.breachEvents))
          throw TypeError(".BreachWatch.UseOneTimeTokenResponse.breachEvents: array expected");
        message.breachEvents = [];
        for (let i = 0; i < object.breachEvents.length; ++i) {
          if (typeof object.breachEvents[i] !== "object")
            throw TypeError(".BreachWatch.UseOneTimeTokenResponse.breachEvents: object expected");
          message.breachEvents[i] = $root.BreachWatch.BreachEvent.fromObject(
            object.breachEvents[i],
          );
        }
      }
      if (object.email != null) message.email = String(object.email);
      return message;
    };

    /**
     * Creates a plain object from a UseOneTimeTokenResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {BreachWatch.UseOneTimeTokenResponse} message UseOneTimeTokenResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UseOneTimeTokenResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.breachEvents = [];
      if (options.defaults) {
        object.emailBreaches = 0;
        object.passwordBreaches = 0;
        object.email = "";
      }
      if (message.emailBreaches != null && message.hasOwnProperty("emailBreaches"))
        object.emailBreaches = message.emailBreaches;
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        object.passwordBreaches = message.passwordBreaches;
      if (message.breachEvents && message.breachEvents.length) {
        object.breachEvents = [];
        for (let j = 0; j < message.breachEvents.length; ++j)
          object.breachEvents[j] = $root.BreachWatch.BreachEvent.toObject(
            message.breachEvents[j],
            options,
          );
      }
      if (message.email != null && message.hasOwnProperty("email")) object.email = message.email;
      return object;
    };

    /**
     * Converts this UseOneTimeTokenResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UseOneTimeTokenResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UseOneTimeTokenResponse
     * @function getTypeUrl
     * @memberof BreachWatch.UseOneTimeTokenResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UseOneTimeTokenResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.UseOneTimeTokenResponse";
    };

    return UseOneTimeTokenResponse;
  })();

  BreachWatch.OneTimeUseToken = (function () {
    /**
     * Properties of an OneTimeUseToken.
     * @memberof BreachWatch
     * @interface IOneTimeUseToken
     * @property {string|null} [email] OneTimeUseToken email
     * @property {string|null} [pad] OneTimeUseToken pad
     */

    /**
     * Constructs a new OneTimeUseToken.
     * @memberof BreachWatch
     * @classdesc Represents an OneTimeUseToken.
     * @implements IOneTimeUseToken
     * @constructor
     * @param {BreachWatch.IOneTimeUseToken=} [properties] Properties to set
     */
    function OneTimeUseToken(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * OneTimeUseToken email.
     * @member {string} email
     * @memberof BreachWatch.OneTimeUseToken
     * @instance
     */
    OneTimeUseToken.prototype.email = "";

    /**
     * OneTimeUseToken pad.
     * @member {string} pad
     * @memberof BreachWatch.OneTimeUseToken
     * @instance
     */
    OneTimeUseToken.prototype.pad = "";

    /**
     * Creates a new OneTimeUseToken instance using the specified properties.
     * @function create
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {BreachWatch.IOneTimeUseToken=} [properties] Properties to set
     * @returns {BreachWatch.OneTimeUseToken} OneTimeUseToken instance
     */
    OneTimeUseToken.create = function create(properties) {
      return new OneTimeUseToken(properties);
    };

    /**
     * Encodes the specified OneTimeUseToken message. Does not implicitly {@link BreachWatch.OneTimeUseToken.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {BreachWatch.IOneTimeUseToken} message OneTimeUseToken message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    OneTimeUseToken.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.email != null && Object.hasOwnProperty.call(message, "email"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.email);
      if (message.pad != null && Object.hasOwnProperty.call(message, "pad"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.pad);
      return writer;
    };

    /**
     * Encodes the specified OneTimeUseToken message, length delimited. Does not implicitly {@link BreachWatch.OneTimeUseToken.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {BreachWatch.IOneTimeUseToken} message OneTimeUseToken message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    OneTimeUseToken.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an OneTimeUseToken message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.OneTimeUseToken} OneTimeUseToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    OneTimeUseToken.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.OneTimeUseToken();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.email = reader.string();
            break;
          }
          case 2: {
            message.pad = reader.string();
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
     * Decodes an OneTimeUseToken message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.OneTimeUseToken} OneTimeUseToken
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    OneTimeUseToken.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an OneTimeUseToken message.
     * @function verify
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    OneTimeUseToken.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.email != null && message.hasOwnProperty("email"))
        if (!$util.isString(message.email)) return "email: string expected";
      if (message.pad != null && message.hasOwnProperty("pad"))
        if (!$util.isString(message.pad)) return "pad: string expected";
      return null;
    };

    /**
     * Creates an OneTimeUseToken message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.OneTimeUseToken} OneTimeUseToken
     */
    OneTimeUseToken.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.OneTimeUseToken) return object;
      let message = new $root.BreachWatch.OneTimeUseToken();
      if (object.email != null) message.email = String(object.email);
      if (object.pad != null) message.pad = String(object.pad);
      return message;
    };

    /**
     * Creates a plain object from an OneTimeUseToken message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {BreachWatch.OneTimeUseToken} message OneTimeUseToken
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    OneTimeUseToken.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.email = "";
        object.pad = "";
      }
      if (message.email != null && message.hasOwnProperty("email")) object.email = message.email;
      if (message.pad != null && message.hasOwnProperty("pad")) object.pad = message.pad;
      return object;
    };

    /**
     * Converts this OneTimeUseToken to JSON.
     * @function toJSON
     * @memberof BreachWatch.OneTimeUseToken
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    OneTimeUseToken.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for OneTimeUseToken
     * @function getTypeUrl
     * @memberof BreachWatch.OneTimeUseToken
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    OneTimeUseToken.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.OneTimeUseToken";
    };

    return OneTimeUseToken;
  })();

  BreachWatch.FreePasswordScanRequest = (function () {
    /**
     * Properties of a FreePasswordScanRequest.
     * @memberof BreachWatch
     * @interface IFreePasswordScanRequest
     * @property {Uint8Array|null} [hashedPassword] FreePasswordScanRequest hashedPassword
     */

    /**
     * Constructs a new FreePasswordScanRequest.
     * @memberof BreachWatch
     * @classdesc Represents a FreePasswordScanRequest.
     * @implements IFreePasswordScanRequest
     * @constructor
     * @param {BreachWatch.IFreePasswordScanRequest=} [properties] Properties to set
     */
    function FreePasswordScanRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FreePasswordScanRequest hashedPassword.
     * @member {Uint8Array} hashedPassword
     * @memberof BreachWatch.FreePasswordScanRequest
     * @instance
     */
    FreePasswordScanRequest.prototype.hashedPassword = $util.newBuffer([]);

    /**
     * Creates a new FreePasswordScanRequest instance using the specified properties.
     * @function create
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {BreachWatch.IFreePasswordScanRequest=} [properties] Properties to set
     * @returns {BreachWatch.FreePasswordScanRequest} FreePasswordScanRequest instance
     */
    FreePasswordScanRequest.create = function create(properties) {
      return new FreePasswordScanRequest(properties);
    };

    /**
     * Encodes the specified FreePasswordScanRequest message. Does not implicitly {@link BreachWatch.FreePasswordScanRequest.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {BreachWatch.IFreePasswordScanRequest} message FreePasswordScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreePasswordScanRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.hashedPassword != null && Object.hasOwnProperty.call(message, "hashedPassword"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.hashedPassword);
      return writer;
    };

    /**
     * Encodes the specified FreePasswordScanRequest message, length delimited. Does not implicitly {@link BreachWatch.FreePasswordScanRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {BreachWatch.IFreePasswordScanRequest} message FreePasswordScanRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreePasswordScanRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FreePasswordScanRequest message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.FreePasswordScanRequest} FreePasswordScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreePasswordScanRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.FreePasswordScanRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.hashedPassword = reader.bytes();
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
     * Decodes a FreePasswordScanRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.FreePasswordScanRequest} FreePasswordScanRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreePasswordScanRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FreePasswordScanRequest message.
     * @function verify
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FreePasswordScanRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.hashedPassword != null && message.hasOwnProperty("hashedPassword"))
        if (
          !(
            (message.hashedPassword && typeof message.hashedPassword.length === "number") ||
            $util.isString(message.hashedPassword)
          )
        )
          return "hashedPassword: buffer expected";
      return null;
    };

    /**
     * Creates a FreePasswordScanRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.FreePasswordScanRequest} FreePasswordScanRequest
     */
    FreePasswordScanRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.FreePasswordScanRequest) return object;
      let message = new $root.BreachWatch.FreePasswordScanRequest();
      if (object.hashedPassword != null)
        if (typeof object.hashedPassword === "string")
          $util.base64.decode(
            object.hashedPassword,
            (message.hashedPassword = $util.newBuffer($util.base64.length(object.hashedPassword))),
            0,
          );
        else if (object.hashedPassword.length >= 0) message.hashedPassword = object.hashedPassword;
      return message;
    };

    /**
     * Creates a plain object from a FreePasswordScanRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {BreachWatch.FreePasswordScanRequest} message FreePasswordScanRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FreePasswordScanRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if (options.bytes === String) object.hashedPassword = "";
        else {
          object.hashedPassword = [];
          if (options.bytes !== Array)
            object.hashedPassword = $util.newBuffer(object.hashedPassword);
        }
      if (message.hashedPassword != null && message.hasOwnProperty("hashedPassword"))
        object.hashedPassword =
          options.bytes === String
            ? $util.base64.encode(message.hashedPassword, 0, message.hashedPassword.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.hashedPassword)
              : message.hashedPassword;
      return object;
    };

    /**
     * Converts this FreePasswordScanRequest to JSON.
     * @function toJSON
     * @memberof BreachWatch.FreePasswordScanRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FreePasswordScanRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FreePasswordScanRequest
     * @function getTypeUrl
     * @memberof BreachWatch.FreePasswordScanRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FreePasswordScanRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.FreePasswordScanRequest";
    };

    return FreePasswordScanRequest;
  })();

  BreachWatch.FreePasswordScanResponse = (function () {
    /**
     * Properties of a FreePasswordScanResponse.
     * @memberof BreachWatch
     * @interface IFreePasswordScanResponse
     * @property {number|Long|null} [passwordBreaches] FreePasswordScanResponse passwordBreaches
     */

    /**
     * Constructs a new FreePasswordScanResponse.
     * @memberof BreachWatch
     * @classdesc Represents a FreePasswordScanResponse.
     * @implements IFreePasswordScanResponse
     * @constructor
     * @param {BreachWatch.IFreePasswordScanResponse=} [properties] Properties to set
     */
    function FreePasswordScanResponse(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FreePasswordScanResponse passwordBreaches.
     * @member {number|Long} passwordBreaches
     * @memberof BreachWatch.FreePasswordScanResponse
     * @instance
     */
    FreePasswordScanResponse.prototype.passwordBreaches = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * Creates a new FreePasswordScanResponse instance using the specified properties.
     * @function create
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {BreachWatch.IFreePasswordScanResponse=} [properties] Properties to set
     * @returns {BreachWatch.FreePasswordScanResponse} FreePasswordScanResponse instance
     */
    FreePasswordScanResponse.create = function create(properties) {
      return new FreePasswordScanResponse(properties);
    };

    /**
     * Encodes the specified FreePasswordScanResponse message. Does not implicitly {@link BreachWatch.FreePasswordScanResponse.verify|verify} messages.
     * @function encode
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {BreachWatch.IFreePasswordScanResponse} message FreePasswordScanResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreePasswordScanResponse.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.passwordBreaches != null &&
        Object.hasOwnProperty.call(message, "passwordBreaches")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.passwordBreaches);
      return writer;
    };

    /**
     * Encodes the specified FreePasswordScanResponse message, length delimited. Does not implicitly {@link BreachWatch.FreePasswordScanResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {BreachWatch.IFreePasswordScanResponse} message FreePasswordScanResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FreePasswordScanResponse.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FreePasswordScanResponse message from the specified reader or buffer.
     * @function decode
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BreachWatch.FreePasswordScanResponse} FreePasswordScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreePasswordScanResponse.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.BreachWatch.FreePasswordScanResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.passwordBreaches = reader.int64();
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
     * Decodes a FreePasswordScanResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BreachWatch.FreePasswordScanResponse} FreePasswordScanResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FreePasswordScanResponse.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FreePasswordScanResponse message.
     * @function verify
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FreePasswordScanResponse.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        if (
          !$util.isInteger(message.passwordBreaches) &&
          !(
            message.passwordBreaches &&
            $util.isInteger(message.passwordBreaches.low) &&
            $util.isInteger(message.passwordBreaches.high)
          )
        )
          return "passwordBreaches: integer|Long expected";
      return null;
    };

    /**
     * Creates a FreePasswordScanResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BreachWatch.FreePasswordScanResponse} FreePasswordScanResponse
     */
    FreePasswordScanResponse.fromObject = function fromObject(object) {
      if (object instanceof $root.BreachWatch.FreePasswordScanResponse) return object;
      let message = new $root.BreachWatch.FreePasswordScanResponse();
      if (object.passwordBreaches != null)
        if ($util.Long)
          (message.passwordBreaches = $util.Long.fromValue(object.passwordBreaches)).unsigned =
            false;
        else if (typeof object.passwordBreaches === "string")
          message.passwordBreaches = parseInt(object.passwordBreaches, 10);
        else if (typeof object.passwordBreaches === "number")
          message.passwordBreaches = object.passwordBreaches;
        else if (typeof object.passwordBreaches === "object")
          message.passwordBreaches = new $util.LongBits(
            object.passwordBreaches.low >>> 0,
            object.passwordBreaches.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a FreePasswordScanResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {BreachWatch.FreePasswordScanResponse} message FreePasswordScanResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FreePasswordScanResponse.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.passwordBreaches =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.passwordBreaches = options.longs === String ? "0" : 0;
      if (message.passwordBreaches != null && message.hasOwnProperty("passwordBreaches"))
        if (typeof message.passwordBreaches === "number")
          object.passwordBreaches =
            options.longs === String ? String(message.passwordBreaches) : message.passwordBreaches;
        else
          object.passwordBreaches =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.passwordBreaches)
              : options.longs === Number
                ? new $util.LongBits(
                    message.passwordBreaches.low >>> 0,
                    message.passwordBreaches.high >>> 0,
                  ).toNumber()
                : message.passwordBreaches;
      return object;
    };

    /**
     * Converts this FreePasswordScanResponse to JSON.
     * @function toJSON
     * @memberof BreachWatch.FreePasswordScanResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FreePasswordScanResponse.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FreePasswordScanResponse
     * @function getTypeUrl
     * @memberof BreachWatch.FreePasswordScanResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FreePasswordScanResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/BreachWatch.FreePasswordScanResponse";
    };

    return FreePasswordScanResponse;
  })();

  return BreachWatch;
})());

export { $root as default };
