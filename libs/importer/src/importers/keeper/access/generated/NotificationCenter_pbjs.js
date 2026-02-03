/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const NotificationCenter = ($root.NotificationCenter = (() => {
  /**
   * Namespace NotificationCenter.
   * @exports NotificationCenter
   * @namespace
   */
  const NotificationCenter = {};

  /**
   * NotificationCategory enum.
   * @name NotificationCenter.NotificationCategory
   * @enum {number}
   * @property {number} NC_UNSPECIFIED=0 NC_UNSPECIFIED value
   * @property {number} NC_ACCOUNT=1 NC_ACCOUNT value
   * @property {number} NC_SHARING=2 NC_SHARING value
   * @property {number} NC_ENTERPRISE=3 NC_ENTERPRISE value
   * @property {number} NC_SECURITY=4 NC_SECURITY value
   * @property {number} NC_REQUEST=5 NC_REQUEST value
   * @property {number} NC_SYSTEM=6 NC_SYSTEM value
   * @property {number} NC_PROMOTION=7 NC_PROMOTION value
   */
  NotificationCenter.NotificationCategory = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NC_UNSPECIFIED")] = 0;
    values[(valuesById[1] = "NC_ACCOUNT")] = 1;
    values[(valuesById[2] = "NC_SHARING")] = 2;
    values[(valuesById[3] = "NC_ENTERPRISE")] = 3;
    values[(valuesById[4] = "NC_SECURITY")] = 4;
    values[(valuesById[5] = "NC_REQUEST")] = 5;
    values[(valuesById[6] = "NC_SYSTEM")] = 6;
    values[(valuesById[7] = "NC_PROMOTION")] = 7;
    return values;
  })();

  /**
   * NotificationType enum.
   * @name NotificationCenter.NotificationType
   * @enum {number}
   * @property {number} NT_UNSPECIFIED=0 NT_UNSPECIFIED value
   * @property {number} NT_ALERT=1 NT_ALERT value
   * @property {number} NT_DEVICE_APPROVAL=2 NT_DEVICE_APPROVAL value
   * @property {number} NT_MASTER_PASS_UPDATED=3 NT_MASTER_PASS_UPDATED value
   * @property {number} NT_SHARE_APPROVAL=4 NT_SHARE_APPROVAL value
   * @property {number} NT_SHARE_APPROVAL_APPROVED=5 NT_SHARE_APPROVAL_APPROVED value
   * @property {number} NT_SHARED=6 NT_SHARED value
   * @property {number} NT_TRANSFERRED=7 NT_TRANSFERRED value
   * @property {number} NT_LICENSE_LIMIT_REACHED=8 NT_LICENSE_LIMIT_REACHED value
   * @property {number} NT_APPROVAL_REQUEST=9 NT_APPROVAL_REQUEST value
   * @property {number} NT_APPROVED_RESPONSE=10 NT_APPROVED_RESPONSE value
   * @property {number} NT_DENIED_RESPONSE=11 NT_DENIED_RESPONSE value
   * @property {number} NT_2FA_CONFIGURED=12 NT_2FA_CONFIGURED value
   * @property {number} NT_SHARE_APPROVAL_DENIED=13 NT_SHARE_APPROVAL_DENIED value
   */
  NotificationCenter.NotificationType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NT_UNSPECIFIED")] = 0;
    values[(valuesById[1] = "NT_ALERT")] = 1;
    values[(valuesById[2] = "NT_DEVICE_APPROVAL")] = 2;
    values[(valuesById[3] = "NT_MASTER_PASS_UPDATED")] = 3;
    values[(valuesById[4] = "NT_SHARE_APPROVAL")] = 4;
    values[(valuesById[5] = "NT_SHARE_APPROVAL_APPROVED")] = 5;
    values[(valuesById[6] = "NT_SHARED")] = 6;
    values[(valuesById[7] = "NT_TRANSFERRED")] = 7;
    values[(valuesById[8] = "NT_LICENSE_LIMIT_REACHED")] = 8;
    values[(valuesById[9] = "NT_APPROVAL_REQUEST")] = 9;
    values[(valuesById[10] = "NT_APPROVED_RESPONSE")] = 10;
    values[(valuesById[11] = "NT_DENIED_RESPONSE")] = 11;
    values[(valuesById[12] = "NT_2FA_CONFIGURED")] = 12;
    values[(valuesById[13] = "NT_SHARE_APPROVAL_DENIED")] = 13;
    return values;
  })();

  /**
   * NotificationReadStatus enum.
   * @name NotificationCenter.NotificationReadStatus
   * @enum {number}
   * @property {number} NRS_UNSPECIFIED=0 NRS_UNSPECIFIED value
   * @property {number} NRS_LAST=1 NRS_LAST value
   * @property {number} NRS_READ=2 NRS_READ value
   * @property {number} NRS_UNREAD=3 NRS_UNREAD value
   */
  NotificationCenter.NotificationReadStatus = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NRS_UNSPECIFIED")] = 0;
    values[(valuesById[1] = "NRS_LAST")] = 1;
    values[(valuesById[2] = "NRS_READ")] = 2;
    values[(valuesById[3] = "NRS_UNREAD")] = 3;
    return values;
  })();

  /**
   * NotificationApprovalStatus enum.
   * @name NotificationCenter.NotificationApprovalStatus
   * @enum {number}
   * @property {number} NAS_UNSPECIFIED=0 NAS_UNSPECIFIED value
   * @property {number} NAS_APPROVED=1 NAS_APPROVED value
   * @property {number} NAS_DENIED=2 NAS_DENIED value
   * @property {number} NAS_LOST_APPROVAL_RIGHTS=3 NAS_LOST_APPROVAL_RIGHTS value
   * @property {number} NAS_LOST_ACCESS=4 NAS_LOST_ACCESS value
   */
  NotificationCenter.NotificationApprovalStatus = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "NAS_UNSPECIFIED")] = 0;
    values[(valuesById[1] = "NAS_APPROVED")] = 1;
    values[(valuesById[2] = "NAS_DENIED")] = 2;
    values[(valuesById[3] = "NAS_LOST_APPROVAL_RIGHTS")] = 3;
    values[(valuesById[4] = "NAS_LOST_ACCESS")] = 4;
    return values;
  })();

  NotificationCenter.EncryptedData = (function () {
    /**
     * Properties of an EncryptedData.
     * @memberof NotificationCenter
     * @interface IEncryptedData
     * @property {number|null} [version] EncryptedData version
     * @property {Uint8Array|null} [data] EncryptedData data
     */

    /**
     * Constructs a new EncryptedData.
     * @memberof NotificationCenter
     * @classdesc Represents an EncryptedData.
     * @implements IEncryptedData
     * @constructor
     * @param {NotificationCenter.IEncryptedData=} [properties] Properties to set
     */
    function EncryptedData(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * EncryptedData version.
     * @member {number} version
     * @memberof NotificationCenter.EncryptedData
     * @instance
     */
    EncryptedData.prototype.version = 0;

    /**
     * EncryptedData data.
     * @member {Uint8Array} data
     * @memberof NotificationCenter.EncryptedData
     * @instance
     */
    EncryptedData.prototype.data = $util.newBuffer([]);

    /**
     * Creates a new EncryptedData instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {NotificationCenter.IEncryptedData=} [properties] Properties to set
     * @returns {NotificationCenter.EncryptedData} EncryptedData instance
     */
    EncryptedData.create = function create(properties) {
      return new EncryptedData(properties);
    };

    /**
     * Encodes the specified EncryptedData message. Does not implicitly {@link NotificationCenter.EncryptedData.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {NotificationCenter.IEncryptedData} message EncryptedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.version != null && Object.hasOwnProperty.call(message, "version"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.version);
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.data);
      return writer;
    };

    /**
     * Encodes the specified EncryptedData message, length delimited. Does not implicitly {@link NotificationCenter.EncryptedData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {NotificationCenter.IEncryptedData} message EncryptedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an EncryptedData message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.EncryptedData} EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.EncryptedData();
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
     * Decodes an EncryptedData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.EncryptedData} EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an EncryptedData message.
     * @function verify
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    EncryptedData.verify = function verify(message) {
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
     * Creates an EncryptedData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.EncryptedData} EncryptedData
     */
    EncryptedData.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.EncryptedData) return object;
      let message = new $root.NotificationCenter.EncryptedData();
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
     * Creates a plain object from an EncryptedData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {NotificationCenter.EncryptedData} message EncryptedData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    EncryptedData.toObject = function toObject(message, options) {
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
     * Converts this EncryptedData to JSON.
     * @function toJSON
     * @memberof NotificationCenter.EncryptedData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    EncryptedData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for EncryptedData
     * @function getTypeUrl
     * @memberof NotificationCenter.EncryptedData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    EncryptedData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.EncryptedData";
    };

    return EncryptedData;
  })();

  NotificationCenter.Notification = (function () {
    /**
     * Properties of a Notification.
     * @memberof NotificationCenter
     * @interface INotification
     * @property {NotificationCenter.NotificationType|null} [type] Notification type
     * @property {NotificationCenter.NotificationCategory|null} [category] Notification category
     * @property {GraphSync.IGraphSyncRef|null} [sender] Notification sender
     * @property {string|null} [senderFullName] Notification senderFullName
     * @property {NotificationCenter.IEncryptedData|null} [encryptedData] Notification encryptedData
     * @property {Array.<GraphSync.IGraphSyncRef>|null} [refs] Notification refs
     * @property {Array.<NotificationCenter.NotificationCategory>|null} [categories] Notification categories
     */

    /**
     * Constructs a new Notification.
     * @memberof NotificationCenter
     * @classdesc Represents a Notification.
     * @implements INotification
     * @constructor
     * @param {NotificationCenter.INotification=} [properties] Properties to set
     */
    function Notification(properties) {
      this.refs = [];
      this.categories = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Notification type.
     * @member {NotificationCenter.NotificationType} type
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.type = 0;

    /**
     * Notification category.
     * @member {NotificationCenter.NotificationCategory} category
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.category = 0;

    /**
     * Notification sender.
     * @member {GraphSync.IGraphSyncRef|null|undefined} sender
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.sender = null;

    /**
     * Notification senderFullName.
     * @member {string} senderFullName
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.senderFullName = "";

    /**
     * Notification encryptedData.
     * @member {NotificationCenter.IEncryptedData|null|undefined} encryptedData
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.encryptedData = null;

    /**
     * Notification refs.
     * @member {Array.<GraphSync.IGraphSyncRef>} refs
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.refs = $util.emptyArray;

    /**
     * Notification categories.
     * @member {Array.<NotificationCenter.NotificationCategory>} categories
     * @memberof NotificationCenter.Notification
     * @instance
     */
    Notification.prototype.categories = $util.emptyArray;

    /**
     * Creates a new Notification instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.Notification
     * @static
     * @param {NotificationCenter.INotification=} [properties] Properties to set
     * @returns {NotificationCenter.Notification} Notification instance
     */
    Notification.create = function create(properties) {
      return new Notification(properties);
    };

    /**
     * Encodes the specified Notification message. Does not implicitly {@link NotificationCenter.Notification.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.Notification
     * @static
     * @param {NotificationCenter.INotification} message Notification message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Notification.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.type != null && Object.hasOwnProperty.call(message, "type"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.type);
      if (message.category != null && Object.hasOwnProperty.call(message, "category"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.category);
      if (message.sender != null && Object.hasOwnProperty.call(message, "sender"))
        $root.GraphSync.GraphSyncRef.encode(
          message.sender,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (message.senderFullName != null && Object.hasOwnProperty.call(message, "senderFullName"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.senderFullName);
      if (message.encryptedData != null && Object.hasOwnProperty.call(message, "encryptedData"))
        $root.NotificationCenter.EncryptedData.encode(
          message.encryptedData,
          writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
        ).ldelim();
      if (message.refs != null && message.refs.length)
        for (let i = 0; i < message.refs.length; ++i)
          $root.GraphSync.GraphSyncRef.encode(
            message.refs[i],
            writer.uint32(/* id 6, wireType 2 =*/ 50).fork(),
          ).ldelim();
      if (message.categories != null && message.categories.length) {
        writer.uint32(/* id 7, wireType 2 =*/ 58).fork();
        for (let i = 0; i < message.categories.length; ++i) writer.int32(message.categories[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified Notification message, length delimited. Does not implicitly {@link NotificationCenter.Notification.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.Notification
     * @static
     * @param {NotificationCenter.INotification} message Notification message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Notification.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Notification message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.Notification
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.Notification} Notification
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Notification.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.Notification();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.type = reader.int32();
            break;
          }
          case 2: {
            message.category = reader.int32();
            break;
          }
          case 3: {
            message.sender = $root.GraphSync.GraphSyncRef.decode(reader, reader.uint32());
            break;
          }
          case 4: {
            message.senderFullName = reader.string();
            break;
          }
          case 5: {
            message.encryptedData = $root.NotificationCenter.EncryptedData.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 6: {
            if (!(message.refs && message.refs.length)) message.refs = [];
            message.refs.push($root.GraphSync.GraphSyncRef.decode(reader, reader.uint32()));
            break;
          }
          case 7: {
            if (!(message.categories && message.categories.length)) message.categories = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.categories.push(reader.int32());
            } else message.categories.push(reader.int32());
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
     * Decodes a Notification message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.Notification
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.Notification} Notification
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Notification.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Notification message.
     * @function verify
     * @memberof NotificationCenter.Notification
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Notification.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.type != null && message.hasOwnProperty("type"))
        switch (message.type) {
          default:
            return "type: enum value expected";
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
          case 13:
            break;
        }
      if (message.category != null && message.hasOwnProperty("category"))
        switch (message.category) {
          default:
            return "category: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
            break;
        }
      if (message.sender != null && message.hasOwnProperty("sender")) {
        let error = $root.GraphSync.GraphSyncRef.verify(message.sender);
        if (error) return "sender." + error;
      }
      if (message.senderFullName != null && message.hasOwnProperty("senderFullName"))
        if (!$util.isString(message.senderFullName)) return "senderFullName: string expected";
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData")) {
        let error = $root.NotificationCenter.EncryptedData.verify(message.encryptedData);
        if (error) return "encryptedData." + error;
      }
      if (message.refs != null && message.hasOwnProperty("refs")) {
        if (!Array.isArray(message.refs)) return "refs: array expected";
        for (let i = 0; i < message.refs.length; ++i) {
          let error = $root.GraphSync.GraphSyncRef.verify(message.refs[i]);
          if (error) return "refs." + error;
        }
      }
      if (message.categories != null && message.hasOwnProperty("categories")) {
        if (!Array.isArray(message.categories)) return "categories: array expected";
        for (let i = 0; i < message.categories.length; ++i)
          switch (message.categories[i]) {
            default:
              return "categories: enum value[] expected";
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
              break;
          }
      }
      return null;
    };

    /**
     * Creates a Notification message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.Notification
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.Notification} Notification
     */
    Notification.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.Notification) return object;
      let message = new $root.NotificationCenter.Notification();
      switch (object.type) {
        default:
          if (typeof object.type === "number") {
            message.type = object.type;
            break;
          }
          break;
        case "NT_UNSPECIFIED":
        case 0:
          message.type = 0;
          break;
        case "NT_ALERT":
        case 1:
          message.type = 1;
          break;
        case "NT_DEVICE_APPROVAL":
        case 2:
          message.type = 2;
          break;
        case "NT_MASTER_PASS_UPDATED":
        case 3:
          message.type = 3;
          break;
        case "NT_SHARE_APPROVAL":
        case 4:
          message.type = 4;
          break;
        case "NT_SHARE_APPROVAL_APPROVED":
        case 5:
          message.type = 5;
          break;
        case "NT_SHARED":
        case 6:
          message.type = 6;
          break;
        case "NT_TRANSFERRED":
        case 7:
          message.type = 7;
          break;
        case "NT_LICENSE_LIMIT_REACHED":
        case 8:
          message.type = 8;
          break;
        case "NT_APPROVAL_REQUEST":
        case 9:
          message.type = 9;
          break;
        case "NT_APPROVED_RESPONSE":
        case 10:
          message.type = 10;
          break;
        case "NT_DENIED_RESPONSE":
        case 11:
          message.type = 11;
          break;
        case "NT_2FA_CONFIGURED":
        case 12:
          message.type = 12;
          break;
        case "NT_SHARE_APPROVAL_DENIED":
        case 13:
          message.type = 13;
          break;
      }
      switch (object.category) {
        default:
          if (typeof object.category === "number") {
            message.category = object.category;
            break;
          }
          break;
        case "NC_UNSPECIFIED":
        case 0:
          message.category = 0;
          break;
        case "NC_ACCOUNT":
        case 1:
          message.category = 1;
          break;
        case "NC_SHARING":
        case 2:
          message.category = 2;
          break;
        case "NC_ENTERPRISE":
        case 3:
          message.category = 3;
          break;
        case "NC_SECURITY":
        case 4:
          message.category = 4;
          break;
        case "NC_REQUEST":
        case 5:
          message.category = 5;
          break;
        case "NC_SYSTEM":
        case 6:
          message.category = 6;
          break;
        case "NC_PROMOTION":
        case 7:
          message.category = 7;
          break;
      }
      if (object.sender != null) {
        if (typeof object.sender !== "object")
          throw TypeError(".NotificationCenter.Notification.sender: object expected");
        message.sender = $root.GraphSync.GraphSyncRef.fromObject(object.sender);
      }
      if (object.senderFullName != null) message.senderFullName = String(object.senderFullName);
      if (object.encryptedData != null) {
        if (typeof object.encryptedData !== "object")
          throw TypeError(".NotificationCenter.Notification.encryptedData: object expected");
        message.encryptedData = $root.NotificationCenter.EncryptedData.fromObject(
          object.encryptedData,
        );
      }
      if (object.refs) {
        if (!Array.isArray(object.refs))
          throw TypeError(".NotificationCenter.Notification.refs: array expected");
        message.refs = [];
        for (let i = 0; i < object.refs.length; ++i) {
          if (typeof object.refs[i] !== "object")
            throw TypeError(".NotificationCenter.Notification.refs: object expected");
          message.refs[i] = $root.GraphSync.GraphSyncRef.fromObject(object.refs[i]);
        }
      }
      if (object.categories) {
        if (!Array.isArray(object.categories))
          throw TypeError(".NotificationCenter.Notification.categories: array expected");
        message.categories = [];
        for (let i = 0; i < object.categories.length; ++i)
          switch (object.categories[i]) {
            default:
              if (typeof object.categories[i] === "number") {
                message.categories[i] = object.categories[i];
                break;
              }
            case "NC_UNSPECIFIED":
            case 0:
              message.categories[i] = 0;
              break;
            case "NC_ACCOUNT":
            case 1:
              message.categories[i] = 1;
              break;
            case "NC_SHARING":
            case 2:
              message.categories[i] = 2;
              break;
            case "NC_ENTERPRISE":
            case 3:
              message.categories[i] = 3;
              break;
            case "NC_SECURITY":
            case 4:
              message.categories[i] = 4;
              break;
            case "NC_REQUEST":
            case 5:
              message.categories[i] = 5;
              break;
            case "NC_SYSTEM":
            case 6:
              message.categories[i] = 6;
              break;
            case "NC_PROMOTION":
            case 7:
              message.categories[i] = 7;
              break;
          }
      }
      return message;
    };

    /**
     * Creates a plain object from a Notification message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.Notification
     * @static
     * @param {NotificationCenter.Notification} message Notification
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Notification.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.refs = [];
        object.categories = [];
      }
      if (options.defaults) {
        object.type = options.enums === String ? "NT_UNSPECIFIED" : 0;
        object.category = options.enums === String ? "NC_UNSPECIFIED" : 0;
        object.sender = null;
        object.senderFullName = "";
        object.encryptedData = null;
      }
      if (message.type != null && message.hasOwnProperty("type"))
        object.type =
          options.enums === String
            ? $root.NotificationCenter.NotificationType[message.type] === undefined
              ? message.type
              : $root.NotificationCenter.NotificationType[message.type]
            : message.type;
      if (message.category != null && message.hasOwnProperty("category"))
        object.category =
          options.enums === String
            ? $root.NotificationCenter.NotificationCategory[message.category] === undefined
              ? message.category
              : $root.NotificationCenter.NotificationCategory[message.category]
            : message.category;
      if (message.sender != null && message.hasOwnProperty("sender"))
        object.sender = $root.GraphSync.GraphSyncRef.toObject(message.sender, options);
      if (message.senderFullName != null && message.hasOwnProperty("senderFullName"))
        object.senderFullName = message.senderFullName;
      if (message.encryptedData != null && message.hasOwnProperty("encryptedData"))
        object.encryptedData = $root.NotificationCenter.EncryptedData.toObject(
          message.encryptedData,
          options,
        );
      if (message.refs && message.refs.length) {
        object.refs = [];
        for (let j = 0; j < message.refs.length; ++j)
          object.refs[j] = $root.GraphSync.GraphSyncRef.toObject(message.refs[j], options);
      }
      if (message.categories && message.categories.length) {
        object.categories = [];
        for (let j = 0; j < message.categories.length; ++j)
          object.categories[j] =
            options.enums === String
              ? $root.NotificationCenter.NotificationCategory[message.categories[j]] === undefined
                ? message.categories[j]
                : $root.NotificationCenter.NotificationCategory[message.categories[j]]
              : message.categories[j];
      }
      return object;
    };

    /**
     * Converts this Notification to JSON.
     * @function toJSON
     * @memberof NotificationCenter.Notification
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Notification.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Notification
     * @function getTypeUrl
     * @memberof NotificationCenter.Notification
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Notification.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.Notification";
    };

    return Notification;
  })();

  NotificationCenter.NotificationReadMark = (function () {
    /**
     * Properties of a NotificationReadMark.
     * @memberof NotificationCenter
     * @interface INotificationReadMark
     * @property {Uint8Array|null} [uid] NotificationReadMark uid
     * @property {number|Long|null} [notificationEdgeId] NotificationReadMark notificationEdgeId
     * @property {number|Long|null} [markEdgeId] NotificationReadMark markEdgeId
     * @property {NotificationCenter.NotificationReadStatus|null} [readStatus] NotificationReadMark readStatus
     */

    /**
     * Constructs a new NotificationReadMark.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationReadMark.
     * @implements INotificationReadMark
     * @constructor
     * @param {NotificationCenter.INotificationReadMark=} [properties] Properties to set
     */
    function NotificationReadMark(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationReadMark uid.
     * @member {Uint8Array} uid
     * @memberof NotificationCenter.NotificationReadMark
     * @instance
     */
    NotificationReadMark.prototype.uid = $util.newBuffer([]);

    /**
     * NotificationReadMark notificationEdgeId.
     * @member {number|Long} notificationEdgeId
     * @memberof NotificationCenter.NotificationReadMark
     * @instance
     */
    NotificationReadMark.prototype.notificationEdgeId = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * NotificationReadMark markEdgeId.
     * @member {number|Long} markEdgeId
     * @memberof NotificationCenter.NotificationReadMark
     * @instance
     */
    NotificationReadMark.prototype.markEdgeId = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * NotificationReadMark readStatus.
     * @member {NotificationCenter.NotificationReadStatus} readStatus
     * @memberof NotificationCenter.NotificationReadMark
     * @instance
     */
    NotificationReadMark.prototype.readStatus = 0;

    /**
     * Creates a new NotificationReadMark instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {NotificationCenter.INotificationReadMark=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationReadMark} NotificationReadMark instance
     */
    NotificationReadMark.create = function create(properties) {
      return new NotificationReadMark(properties);
    };

    /**
     * Encodes the specified NotificationReadMark message. Does not implicitly {@link NotificationCenter.NotificationReadMark.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {NotificationCenter.INotificationReadMark} message NotificationReadMark message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationReadMark.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.uid != null && Object.hasOwnProperty.call(message, "uid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.uid);
      if (
        message.notificationEdgeId != null &&
        Object.hasOwnProperty.call(message, "notificationEdgeId")
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.notificationEdgeId);
      if (message.markEdgeId != null && Object.hasOwnProperty.call(message, "markEdgeId"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.markEdgeId);
      if (message.readStatus != null && Object.hasOwnProperty.call(message, "readStatus"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.readStatus);
      return writer;
    };

    /**
     * Encodes the specified NotificationReadMark message, length delimited. Does not implicitly {@link NotificationCenter.NotificationReadMark.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {NotificationCenter.INotificationReadMark} message NotificationReadMark message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationReadMark.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationReadMark message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationReadMark} NotificationReadMark
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationReadMark.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationReadMark();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.uid = reader.bytes();
            break;
          }
          case 2: {
            message.notificationEdgeId = reader.int64();
            break;
          }
          case 3: {
            message.markEdgeId = reader.int64();
            break;
          }
          case 4: {
            message.readStatus = reader.int32();
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
     * Decodes a NotificationReadMark message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationReadMark} NotificationReadMark
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationReadMark.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationReadMark message.
     * @function verify
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationReadMark.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.uid != null && message.hasOwnProperty("uid"))
        if (
          !((message.uid && typeof message.uid.length === "number") || $util.isString(message.uid))
        )
          return "uid: buffer expected";
      if (message.notificationEdgeId != null && message.hasOwnProperty("notificationEdgeId"))
        if (
          !$util.isInteger(message.notificationEdgeId) &&
          !(
            message.notificationEdgeId &&
            $util.isInteger(message.notificationEdgeId.low) &&
            $util.isInteger(message.notificationEdgeId.high)
          )
        )
          return "notificationEdgeId: integer|Long expected";
      if (message.markEdgeId != null && message.hasOwnProperty("markEdgeId"))
        if (
          !$util.isInteger(message.markEdgeId) &&
          !(
            message.markEdgeId &&
            $util.isInteger(message.markEdgeId.low) &&
            $util.isInteger(message.markEdgeId.high)
          )
        )
          return "markEdgeId: integer|Long expected";
      if (message.readStatus != null && message.hasOwnProperty("readStatus"))
        switch (message.readStatus) {
          default:
            return "readStatus: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      return null;
    };

    /**
     * Creates a NotificationReadMark message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationReadMark} NotificationReadMark
     */
    NotificationReadMark.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationReadMark) return object;
      let message = new $root.NotificationCenter.NotificationReadMark();
      if (object.uid != null)
        if (typeof object.uid === "string")
          $util.base64.decode(
            object.uid,
            (message.uid = $util.newBuffer($util.base64.length(object.uid))),
            0,
          );
        else if (object.uid.length >= 0) message.uid = object.uid;
      if (object.notificationEdgeId != null)
        if ($util.Long)
          (message.notificationEdgeId = $util.Long.fromValue(object.notificationEdgeId)).unsigned =
            false;
        else if (typeof object.notificationEdgeId === "string")
          message.notificationEdgeId = parseInt(object.notificationEdgeId, 10);
        else if (typeof object.notificationEdgeId === "number")
          message.notificationEdgeId = object.notificationEdgeId;
        else if (typeof object.notificationEdgeId === "object")
          message.notificationEdgeId = new $util.LongBits(
            object.notificationEdgeId.low >>> 0,
            object.notificationEdgeId.high >>> 0,
          ).toNumber();
      if (object.markEdgeId != null)
        if ($util.Long)
          (message.markEdgeId = $util.Long.fromValue(object.markEdgeId)).unsigned = false;
        else if (typeof object.markEdgeId === "string")
          message.markEdgeId = parseInt(object.markEdgeId, 10);
        else if (typeof object.markEdgeId === "number") message.markEdgeId = object.markEdgeId;
        else if (typeof object.markEdgeId === "object")
          message.markEdgeId = new $util.LongBits(
            object.markEdgeId.low >>> 0,
            object.markEdgeId.high >>> 0,
          ).toNumber();
      switch (object.readStatus) {
        default:
          if (typeof object.readStatus === "number") {
            message.readStatus = object.readStatus;
            break;
          }
          break;
        case "NRS_UNSPECIFIED":
        case 0:
          message.readStatus = 0;
          break;
        case "NRS_LAST":
        case 1:
          message.readStatus = 1;
          break;
        case "NRS_READ":
        case 2:
          message.readStatus = 2;
          break;
        case "NRS_UNREAD":
        case 3:
          message.readStatus = 3;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a NotificationReadMark message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {NotificationCenter.NotificationReadMark} message NotificationReadMark
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationReadMark.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.uid = "";
        else {
          object.uid = [];
          if (options.bytes !== Array) object.uid = $util.newBuffer(object.uid);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.notificationEdgeId =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.notificationEdgeId = options.longs === String ? "0" : 0;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.markEdgeId =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.markEdgeId = options.longs === String ? "0" : 0;
        object.readStatus = options.enums === String ? "NRS_UNSPECIFIED" : 0;
      }
      if (message.uid != null && message.hasOwnProperty("uid"))
        object.uid =
          options.bytes === String
            ? $util.base64.encode(message.uid, 0, message.uid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.uid)
              : message.uid;
      if (message.notificationEdgeId != null && message.hasOwnProperty("notificationEdgeId"))
        if (typeof message.notificationEdgeId === "number")
          object.notificationEdgeId =
            options.longs === String
              ? String(message.notificationEdgeId)
              : message.notificationEdgeId;
        else
          object.notificationEdgeId =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.notificationEdgeId)
              : options.longs === Number
                ? new $util.LongBits(
                    message.notificationEdgeId.low >>> 0,
                    message.notificationEdgeId.high >>> 0,
                  ).toNumber()
                : message.notificationEdgeId;
      if (message.markEdgeId != null && message.hasOwnProperty("markEdgeId"))
        if (typeof message.markEdgeId === "number")
          object.markEdgeId =
            options.longs === String ? String(message.markEdgeId) : message.markEdgeId;
        else
          object.markEdgeId =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.markEdgeId)
              : options.longs === Number
                ? new $util.LongBits(
                    message.markEdgeId.low >>> 0,
                    message.markEdgeId.high >>> 0,
                  ).toNumber()
                : message.markEdgeId;
      if (message.readStatus != null && message.hasOwnProperty("readStatus"))
        object.readStatus =
          options.enums === String
            ? $root.NotificationCenter.NotificationReadStatus[message.readStatus] === undefined
              ? message.readStatus
              : $root.NotificationCenter.NotificationReadStatus[message.readStatus]
            : message.readStatus;
      return object;
    };

    /**
     * Converts this NotificationReadMark to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationReadMark
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationReadMark.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationReadMark
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationReadMark
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationReadMark.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationReadMark";
    };

    return NotificationReadMark;
  })();

  NotificationCenter.NotificationContent = (function () {
    /**
     * Properties of a NotificationContent.
     * @memberof NotificationCenter
     * @interface INotificationContent
     * @property {NotificationCenter.INotification|null} [notification] NotificationContent notification
     * @property {NotificationCenter.NotificationReadStatus|null} [readStatus] NotificationContent readStatus
     * @property {NotificationCenter.NotificationApprovalStatus|null} [approvalStatus] NotificationContent approvalStatus
     * @property {boolean|null} [trimmingPoint] NotificationContent trimmingPoint
     * @property {Array.<number>|null} [clientTypeIDs] NotificationContent clientTypeIDs
     * @property {Array.<number|Long>|null} [deviceIDs] NotificationContent deviceIDs
     */

    /**
     * Constructs a new NotificationContent.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationContent.
     * @implements INotificationContent
     * @constructor
     * @param {NotificationCenter.INotificationContent=} [properties] Properties to set
     */
    function NotificationContent(properties) {
      this.clientTypeIDs = [];
      this.deviceIDs = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationContent notification.
     * @member {NotificationCenter.INotification|null|undefined} notification
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.notification = null;

    /**
     * NotificationContent readStatus.
     * @member {NotificationCenter.NotificationReadStatus|null|undefined} readStatus
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.readStatus = null;

    /**
     * NotificationContent approvalStatus.
     * @member {NotificationCenter.NotificationApprovalStatus|null|undefined} approvalStatus
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.approvalStatus = null;

    /**
     * NotificationContent trimmingPoint.
     * @member {boolean|null|undefined} trimmingPoint
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.trimmingPoint = null;

    /**
     * NotificationContent clientTypeIDs.
     * @member {Array.<number>} clientTypeIDs
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.clientTypeIDs = $util.emptyArray;

    /**
     * NotificationContent deviceIDs.
     * @member {Array.<number|Long>} deviceIDs
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    NotificationContent.prototype.deviceIDs = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * NotificationContent type.
     * @member {"notification"|"readStatus"|"approvalStatus"|"trimmingPoint"|undefined} type
     * @memberof NotificationCenter.NotificationContent
     * @instance
     */
    Object.defineProperty(NotificationContent.prototype, "type", {
      get: $util.oneOfGetter(
        ($oneOfFields = ["notification", "readStatus", "approvalStatus", "trimmingPoint"]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new NotificationContent instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {NotificationCenter.INotificationContent=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationContent} NotificationContent instance
     */
    NotificationContent.create = function create(properties) {
      return new NotificationContent(properties);
    };

    /**
     * Encodes the specified NotificationContent message. Does not implicitly {@link NotificationCenter.NotificationContent.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {NotificationCenter.INotificationContent} message NotificationContent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationContent.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.notification != null && Object.hasOwnProperty.call(message, "notification"))
        $root.NotificationCenter.Notification.encode(
          message.notification,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (message.readStatus != null && Object.hasOwnProperty.call(message, "readStatus"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.readStatus);
      if (message.approvalStatus != null && Object.hasOwnProperty.call(message, "approvalStatus"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int32(message.approvalStatus);
      if (message.trimmingPoint != null && Object.hasOwnProperty.call(message, "trimmingPoint"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.trimmingPoint);
      if (message.clientTypeIDs != null && message.clientTypeIDs.length) {
        writer.uint32(/* id 5, wireType 2 =*/ 42).fork();
        for (let i = 0; i < message.clientTypeIDs.length; ++i)
          writer.int32(message.clientTypeIDs[i]);
        writer.ldelim();
      }
      if (message.deviceIDs != null && message.deviceIDs.length) {
        writer.uint32(/* id 6, wireType 2 =*/ 50).fork();
        for (let i = 0; i < message.deviceIDs.length; ++i) writer.int64(message.deviceIDs[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified NotificationContent message, length delimited. Does not implicitly {@link NotificationCenter.NotificationContent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {NotificationCenter.INotificationContent} message NotificationContent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationContent.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationContent message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationContent} NotificationContent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationContent.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationContent();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.notification = $root.NotificationCenter.Notification.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 2: {
            message.readStatus = reader.int32();
            break;
          }
          case 3: {
            message.approvalStatus = reader.int32();
            break;
          }
          case 4: {
            message.trimmingPoint = reader.bool();
            break;
          }
          case 5: {
            if (!(message.clientTypeIDs && message.clientTypeIDs.length))
              message.clientTypeIDs = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.clientTypeIDs.push(reader.int32());
            } else message.clientTypeIDs.push(reader.int32());
            break;
          }
          case 6: {
            if (!(message.deviceIDs && message.deviceIDs.length)) message.deviceIDs = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.deviceIDs.push(reader.int64());
            } else message.deviceIDs.push(reader.int64());
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
     * Decodes a NotificationContent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationContent} NotificationContent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationContent.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationContent message.
     * @function verify
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationContent.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      let properties = {};
      if (message.notification != null && message.hasOwnProperty("notification")) {
        properties.type = 1;
        {
          let error = $root.NotificationCenter.Notification.verify(message.notification);
          if (error) return "notification." + error;
        }
      }
      if (message.readStatus != null && message.hasOwnProperty("readStatus")) {
        if (properties.type === 1) return "type: multiple values";
        properties.type = 1;
        switch (message.readStatus) {
          default:
            return "readStatus: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      }
      if (message.approvalStatus != null && message.hasOwnProperty("approvalStatus")) {
        if (properties.type === 1) return "type: multiple values";
        properties.type = 1;
        switch (message.approvalStatus) {
          default:
            return "approvalStatus: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
            break;
        }
      }
      if (message.trimmingPoint != null && message.hasOwnProperty("trimmingPoint")) {
        if (properties.type === 1) return "type: multiple values";
        properties.type = 1;
        if (typeof message.trimmingPoint !== "boolean") return "trimmingPoint: boolean expected";
      }
      if (message.clientTypeIDs != null && message.hasOwnProperty("clientTypeIDs")) {
        if (!Array.isArray(message.clientTypeIDs)) return "clientTypeIDs: array expected";
        for (let i = 0; i < message.clientTypeIDs.length; ++i)
          if (!$util.isInteger(message.clientTypeIDs[i]))
            return "clientTypeIDs: integer[] expected";
      }
      if (message.deviceIDs != null && message.hasOwnProperty("deviceIDs")) {
        if (!Array.isArray(message.deviceIDs)) return "deviceIDs: array expected";
        for (let i = 0; i < message.deviceIDs.length; ++i)
          if (
            !$util.isInteger(message.deviceIDs[i]) &&
            !(
              message.deviceIDs[i] &&
              $util.isInteger(message.deviceIDs[i].low) &&
              $util.isInteger(message.deviceIDs[i].high)
            )
          )
            return "deviceIDs: integer|Long[] expected";
      }
      return null;
    };

    /**
     * Creates a NotificationContent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationContent} NotificationContent
     */
    NotificationContent.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationContent) return object;
      let message = new $root.NotificationCenter.NotificationContent();
      if (object.notification != null) {
        if (typeof object.notification !== "object")
          throw TypeError(".NotificationCenter.NotificationContent.notification: object expected");
        message.notification = $root.NotificationCenter.Notification.fromObject(
          object.notification,
        );
      }
      switch (object.readStatus) {
        default:
          if (typeof object.readStatus === "number") {
            message.readStatus = object.readStatus;
            break;
          }
          break;
        case "NRS_UNSPECIFIED":
        case 0:
          message.readStatus = 0;
          break;
        case "NRS_LAST":
        case 1:
          message.readStatus = 1;
          break;
        case "NRS_READ":
        case 2:
          message.readStatus = 2;
          break;
        case "NRS_UNREAD":
        case 3:
          message.readStatus = 3;
          break;
      }
      switch (object.approvalStatus) {
        default:
          if (typeof object.approvalStatus === "number") {
            message.approvalStatus = object.approvalStatus;
            break;
          }
          break;
        case "NAS_UNSPECIFIED":
        case 0:
          message.approvalStatus = 0;
          break;
        case "NAS_APPROVED":
        case 1:
          message.approvalStatus = 1;
          break;
        case "NAS_DENIED":
        case 2:
          message.approvalStatus = 2;
          break;
        case "NAS_LOST_APPROVAL_RIGHTS":
        case 3:
          message.approvalStatus = 3;
          break;
        case "NAS_LOST_ACCESS":
        case 4:
          message.approvalStatus = 4;
          break;
      }
      if (object.trimmingPoint != null) message.trimmingPoint = Boolean(object.trimmingPoint);
      if (object.clientTypeIDs) {
        if (!Array.isArray(object.clientTypeIDs))
          throw TypeError(".NotificationCenter.NotificationContent.clientTypeIDs: array expected");
        message.clientTypeIDs = [];
        for (let i = 0; i < object.clientTypeIDs.length; ++i)
          message.clientTypeIDs[i] = object.clientTypeIDs[i] | 0;
      }
      if (object.deviceIDs) {
        if (!Array.isArray(object.deviceIDs))
          throw TypeError(".NotificationCenter.NotificationContent.deviceIDs: array expected");
        message.deviceIDs = [];
        for (let i = 0; i < object.deviceIDs.length; ++i)
          if ($util.Long)
            (message.deviceIDs[i] = $util.Long.fromValue(object.deviceIDs[i])).unsigned = false;
          else if (typeof object.deviceIDs[i] === "string")
            message.deviceIDs[i] = parseInt(object.deviceIDs[i], 10);
          else if (typeof object.deviceIDs[i] === "number")
            message.deviceIDs[i] = object.deviceIDs[i];
          else if (typeof object.deviceIDs[i] === "object")
            message.deviceIDs[i] = new $util.LongBits(
              object.deviceIDs[i].low >>> 0,
              object.deviceIDs[i].high >>> 0,
            ).toNumber();
      }
      return message;
    };

    /**
     * Creates a plain object from a NotificationContent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {NotificationCenter.NotificationContent} message NotificationContent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationContent.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.clientTypeIDs = [];
        object.deviceIDs = [];
      }
      if (message.notification != null && message.hasOwnProperty("notification")) {
        object.notification = $root.NotificationCenter.Notification.toObject(
          message.notification,
          options,
        );
        if (options.oneofs) object.type = "notification";
      }
      if (message.readStatus != null && message.hasOwnProperty("readStatus")) {
        object.readStatus =
          options.enums === String
            ? $root.NotificationCenter.NotificationReadStatus[message.readStatus] === undefined
              ? message.readStatus
              : $root.NotificationCenter.NotificationReadStatus[message.readStatus]
            : message.readStatus;
        if (options.oneofs) object.type = "readStatus";
      }
      if (message.approvalStatus != null && message.hasOwnProperty("approvalStatus")) {
        object.approvalStatus =
          options.enums === String
            ? $root.NotificationCenter.NotificationApprovalStatus[message.approvalStatus] ===
              undefined
              ? message.approvalStatus
              : $root.NotificationCenter.NotificationApprovalStatus[message.approvalStatus]
            : message.approvalStatus;
        if (options.oneofs) object.type = "approvalStatus";
      }
      if (message.trimmingPoint != null && message.hasOwnProperty("trimmingPoint")) {
        object.trimmingPoint = message.trimmingPoint;
        if (options.oneofs) object.type = "trimmingPoint";
      }
      if (message.clientTypeIDs && message.clientTypeIDs.length) {
        object.clientTypeIDs = [];
        for (let j = 0; j < message.clientTypeIDs.length; ++j)
          object.clientTypeIDs[j] = message.clientTypeIDs[j];
      }
      if (message.deviceIDs && message.deviceIDs.length) {
        object.deviceIDs = [];
        for (let j = 0; j < message.deviceIDs.length; ++j)
          if (typeof message.deviceIDs[j] === "number")
            object.deviceIDs[j] =
              options.longs === String ? String(message.deviceIDs[j]) : message.deviceIDs[j];
          else
            object.deviceIDs[j] =
              options.longs === String
                ? $util.Long.prototype.toString.call(message.deviceIDs[j])
                : options.longs === Number
                  ? new $util.LongBits(
                      message.deviceIDs[j].low >>> 0,
                      message.deviceIDs[j].high >>> 0,
                    ).toNumber()
                  : message.deviceIDs[j];
      }
      return object;
    };

    /**
     * Converts this NotificationContent to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationContent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationContent.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationContent
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationContent
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationContent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationContent";
    };

    return NotificationContent;
  })();

  NotificationCenter.NotificationWrapper = (function () {
    /**
     * Properties of a NotificationWrapper.
     * @memberof NotificationCenter
     * @interface INotificationWrapper
     * @property {Uint8Array|null} [uid] NotificationWrapper uid
     * @property {NotificationCenter.INotificationContent|null} [content] NotificationWrapper content
     * @property {number|Long|null} [timestamp] NotificationWrapper timestamp
     */

    /**
     * Constructs a new NotificationWrapper.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationWrapper.
     * @implements INotificationWrapper
     * @constructor
     * @param {NotificationCenter.INotificationWrapper=} [properties] Properties to set
     */
    function NotificationWrapper(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationWrapper uid.
     * @member {Uint8Array} uid
     * @memberof NotificationCenter.NotificationWrapper
     * @instance
     */
    NotificationWrapper.prototype.uid = $util.newBuffer([]);

    /**
     * NotificationWrapper content.
     * @member {NotificationCenter.INotificationContent|null|undefined} content
     * @memberof NotificationCenter.NotificationWrapper
     * @instance
     */
    NotificationWrapper.prototype.content = null;

    /**
     * NotificationWrapper timestamp.
     * @member {number|Long} timestamp
     * @memberof NotificationCenter.NotificationWrapper
     * @instance
     */
    NotificationWrapper.prototype.timestamp = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new NotificationWrapper instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {NotificationCenter.INotificationWrapper=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationWrapper} NotificationWrapper instance
     */
    NotificationWrapper.create = function create(properties) {
      return new NotificationWrapper(properties);
    };

    /**
     * Encodes the specified NotificationWrapper message. Does not implicitly {@link NotificationCenter.NotificationWrapper.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {NotificationCenter.INotificationWrapper} message NotificationWrapper message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationWrapper.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.uid != null && Object.hasOwnProperty.call(message, "uid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.uid);
      if (message.content != null && Object.hasOwnProperty.call(message, "content"))
        $root.NotificationCenter.NotificationContent.encode(
          message.content,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.timestamp);
      return writer;
    };

    /**
     * Encodes the specified NotificationWrapper message, length delimited. Does not implicitly {@link NotificationCenter.NotificationWrapper.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {NotificationCenter.INotificationWrapper} message NotificationWrapper message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationWrapper.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationWrapper message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationWrapper} NotificationWrapper
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationWrapper.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationWrapper();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.uid = reader.bytes();
            break;
          }
          case 2: {
            message.content = $root.NotificationCenter.NotificationContent.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 3: {
            message.timestamp = reader.int64();
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
     * Decodes a NotificationWrapper message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationWrapper} NotificationWrapper
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationWrapper.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationWrapper message.
     * @function verify
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationWrapper.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.uid != null && message.hasOwnProperty("uid"))
        if (
          !((message.uid && typeof message.uid.length === "number") || $util.isString(message.uid))
        )
          return "uid: buffer expected";
      if (message.content != null && message.hasOwnProperty("content")) {
        let error = $root.NotificationCenter.NotificationContent.verify(message.content);
        if (error) return "content." + error;
      }
      if (message.timestamp != null && message.hasOwnProperty("timestamp"))
        if (
          !$util.isInteger(message.timestamp) &&
          !(
            message.timestamp &&
            $util.isInteger(message.timestamp.low) &&
            $util.isInteger(message.timestamp.high)
          )
        )
          return "timestamp: integer|Long expected";
      return null;
    };

    /**
     * Creates a NotificationWrapper message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationWrapper} NotificationWrapper
     */
    NotificationWrapper.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationWrapper) return object;
      let message = new $root.NotificationCenter.NotificationWrapper();
      if (object.uid != null)
        if (typeof object.uid === "string")
          $util.base64.decode(
            object.uid,
            (message.uid = $util.newBuffer($util.base64.length(object.uid))),
            0,
          );
        else if (object.uid.length >= 0) message.uid = object.uid;
      if (object.content != null) {
        if (typeof object.content !== "object")
          throw TypeError(".NotificationCenter.NotificationWrapper.content: object expected");
        message.content = $root.NotificationCenter.NotificationContent.fromObject(object.content);
      }
      if (object.timestamp != null)
        if ($util.Long)
          (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = false;
        else if (typeof object.timestamp === "string")
          message.timestamp = parseInt(object.timestamp, 10);
        else if (typeof object.timestamp === "number") message.timestamp = object.timestamp;
        else if (typeof object.timestamp === "object")
          message.timestamp = new $util.LongBits(
            object.timestamp.low >>> 0,
            object.timestamp.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a NotificationWrapper message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {NotificationCenter.NotificationWrapper} message NotificationWrapper
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationWrapper.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.uid = "";
        else {
          object.uid = [];
          if (options.bytes !== Array) object.uid = $util.newBuffer(object.uid);
        }
        object.content = null;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.timestamp =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.timestamp = options.longs === String ? "0" : 0;
      }
      if (message.uid != null && message.hasOwnProperty("uid"))
        object.uid =
          options.bytes === String
            ? $util.base64.encode(message.uid, 0, message.uid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.uid)
              : message.uid;
      if (message.content != null && message.hasOwnProperty("content"))
        object.content = $root.NotificationCenter.NotificationContent.toObject(
          message.content,
          options,
        );
      if (message.timestamp != null && message.hasOwnProperty("timestamp"))
        if (typeof message.timestamp === "number")
          object.timestamp =
            options.longs === String ? String(message.timestamp) : message.timestamp;
        else
          object.timestamp =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.timestamp)
              : options.longs === Number
                ? new $util.LongBits(
                    message.timestamp.low >>> 0,
                    message.timestamp.high >>> 0,
                  ).toNumber()
                : message.timestamp;
      return object;
    };

    /**
     * Converts this NotificationWrapper to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationWrapper
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationWrapper.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationWrapper
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationWrapper
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationWrapper.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationWrapper";
    };

    return NotificationWrapper;
  })();

  NotificationCenter.NotificationSync = (function () {
    /**
     * Properties of a NotificationSync.
     * @memberof NotificationCenter
     * @interface INotificationSync
     * @property {Array.<NotificationCenter.INotificationWrapper>|null} [data] NotificationSync data
     * @property {number|Long|null} [syncPoint] NotificationSync syncPoint
     * @property {boolean|null} [hasMore] NotificationSync hasMore
     */

    /**
     * Constructs a new NotificationSync.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationSync.
     * @implements INotificationSync
     * @constructor
     * @param {NotificationCenter.INotificationSync=} [properties] Properties to set
     */
    function NotificationSync(properties) {
      this.data = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationSync data.
     * @member {Array.<NotificationCenter.INotificationWrapper>} data
     * @memberof NotificationCenter.NotificationSync
     * @instance
     */
    NotificationSync.prototype.data = $util.emptyArray;

    /**
     * NotificationSync syncPoint.
     * @member {number|Long} syncPoint
     * @memberof NotificationCenter.NotificationSync
     * @instance
     */
    NotificationSync.prototype.syncPoint = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * NotificationSync hasMore.
     * @member {boolean} hasMore
     * @memberof NotificationCenter.NotificationSync
     * @instance
     */
    NotificationSync.prototype.hasMore = false;

    /**
     * Creates a new NotificationSync instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {NotificationCenter.INotificationSync=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationSync} NotificationSync instance
     */
    NotificationSync.create = function create(properties) {
      return new NotificationSync(properties);
    };

    /**
     * Encodes the specified NotificationSync message. Does not implicitly {@link NotificationCenter.NotificationSync.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {NotificationCenter.INotificationSync} message NotificationSync message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSync.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.data != null && message.data.length)
        for (let i = 0; i < message.data.length; ++i)
          $root.NotificationCenter.NotificationWrapper.encode(
            message.data[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.syncPoint != null && Object.hasOwnProperty.call(message, "syncPoint"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.syncPoint);
      if (message.hasMore != null && Object.hasOwnProperty.call(message, "hasMore"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).bool(message.hasMore);
      return writer;
    };

    /**
     * Encodes the specified NotificationSync message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSync.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {NotificationCenter.INotificationSync} message NotificationSync message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSync.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationSync message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationSync} NotificationSync
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSync.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationSync();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.data && message.data.length)) message.data = [];
            message.data.push(
              $root.NotificationCenter.NotificationWrapper.decode(reader, reader.uint32()),
            );
            break;
          }
          case 2: {
            message.syncPoint = reader.int64();
            break;
          }
          case 3: {
            message.hasMore = reader.bool();
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
     * Decodes a NotificationSync message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationSync} NotificationSync
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSync.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationSync message.
     * @function verify
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationSync.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.data != null && message.hasOwnProperty("data")) {
        if (!Array.isArray(message.data)) return "data: array expected";
        for (let i = 0; i < message.data.length; ++i) {
          let error = $root.NotificationCenter.NotificationWrapper.verify(message.data[i]);
          if (error) return "data." + error;
        }
      }
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (
          !$util.isInteger(message.syncPoint) &&
          !(
            message.syncPoint &&
            $util.isInteger(message.syncPoint.low) &&
            $util.isInteger(message.syncPoint.high)
          )
        )
          return "syncPoint: integer|Long expected";
      if (message.hasMore != null && message.hasOwnProperty("hasMore"))
        if (typeof message.hasMore !== "boolean") return "hasMore: boolean expected";
      return null;
    };

    /**
     * Creates a NotificationSync message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationSync} NotificationSync
     */
    NotificationSync.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationSync) return object;
      let message = new $root.NotificationCenter.NotificationSync();
      if (object.data) {
        if (!Array.isArray(object.data))
          throw TypeError(".NotificationCenter.NotificationSync.data: array expected");
        message.data = [];
        for (let i = 0; i < object.data.length; ++i) {
          if (typeof object.data[i] !== "object")
            throw TypeError(".NotificationCenter.NotificationSync.data: object expected");
          message.data[i] = $root.NotificationCenter.NotificationWrapper.fromObject(object.data[i]);
        }
      }
      if (object.syncPoint != null)
        if ($util.Long)
          (message.syncPoint = $util.Long.fromValue(object.syncPoint)).unsigned = false;
        else if (typeof object.syncPoint === "string")
          message.syncPoint = parseInt(object.syncPoint, 10);
        else if (typeof object.syncPoint === "number") message.syncPoint = object.syncPoint;
        else if (typeof object.syncPoint === "object")
          message.syncPoint = new $util.LongBits(
            object.syncPoint.low >>> 0,
            object.syncPoint.high >>> 0,
          ).toNumber();
      if (object.hasMore != null) message.hasMore = Boolean(object.hasMore);
      return message;
    };

    /**
     * Creates a plain object from a NotificationSync message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {NotificationCenter.NotificationSync} message NotificationSync
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationSync.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.data = [];
      if (options.defaults) {
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.syncPoint =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.syncPoint = options.longs === String ? "0" : 0;
        object.hasMore = false;
      }
      if (message.data && message.data.length) {
        object.data = [];
        for (let j = 0; j < message.data.length; ++j)
          object.data[j] = $root.NotificationCenter.NotificationWrapper.toObject(
            message.data[j],
            options,
          );
      }
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (typeof message.syncPoint === "number")
          object.syncPoint =
            options.longs === String ? String(message.syncPoint) : message.syncPoint;
        else
          object.syncPoint =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.syncPoint)
              : options.longs === Number
                ? new $util.LongBits(
                    message.syncPoint.low >>> 0,
                    message.syncPoint.high >>> 0,
                  ).toNumber()
                : message.syncPoint;
      if (message.hasMore != null && message.hasOwnProperty("hasMore"))
        object.hasMore = message.hasMore;
      return object;
    };

    /**
     * Converts this NotificationSync to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationSync
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationSync.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationSync
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationSync
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationSync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationSync";
    };

    return NotificationSync;
  })();

  NotificationCenter.ReadStatusUpdate = (function () {
    /**
     * Properties of a ReadStatusUpdate.
     * @memberof NotificationCenter
     * @interface IReadStatusUpdate
     * @property {Uint8Array|null} [notificationUid] ReadStatusUpdate notificationUid
     * @property {NotificationCenter.NotificationReadStatus|null} [status] ReadStatusUpdate status
     */

    /**
     * Constructs a new ReadStatusUpdate.
     * @memberof NotificationCenter
     * @classdesc Represents a ReadStatusUpdate.
     * @implements IReadStatusUpdate
     * @constructor
     * @param {NotificationCenter.IReadStatusUpdate=} [properties] Properties to set
     */
    function ReadStatusUpdate(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ReadStatusUpdate notificationUid.
     * @member {Uint8Array} notificationUid
     * @memberof NotificationCenter.ReadStatusUpdate
     * @instance
     */
    ReadStatusUpdate.prototype.notificationUid = $util.newBuffer([]);

    /**
     * ReadStatusUpdate status.
     * @member {NotificationCenter.NotificationReadStatus} status
     * @memberof NotificationCenter.ReadStatusUpdate
     * @instance
     */
    ReadStatusUpdate.prototype.status = 0;

    /**
     * Creates a new ReadStatusUpdate instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {NotificationCenter.IReadStatusUpdate=} [properties] Properties to set
     * @returns {NotificationCenter.ReadStatusUpdate} ReadStatusUpdate instance
     */
    ReadStatusUpdate.create = function create(properties) {
      return new ReadStatusUpdate(properties);
    };

    /**
     * Encodes the specified ReadStatusUpdate message. Does not implicitly {@link NotificationCenter.ReadStatusUpdate.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {NotificationCenter.IReadStatusUpdate} message ReadStatusUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ReadStatusUpdate.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.notificationUid != null && Object.hasOwnProperty.call(message, "notificationUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.notificationUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      return writer;
    };

    /**
     * Encodes the specified ReadStatusUpdate message, length delimited. Does not implicitly {@link NotificationCenter.ReadStatusUpdate.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {NotificationCenter.IReadStatusUpdate} message ReadStatusUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ReadStatusUpdate.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ReadStatusUpdate message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.ReadStatusUpdate} ReadStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ReadStatusUpdate.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.ReadStatusUpdate();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.notificationUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
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
     * Decodes a ReadStatusUpdate message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.ReadStatusUpdate} ReadStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ReadStatusUpdate.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ReadStatusUpdate message.
     * @function verify
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ReadStatusUpdate.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.notificationUid != null && message.hasOwnProperty("notificationUid"))
        if (
          !(
            (message.notificationUid && typeof message.notificationUid.length === "number") ||
            $util.isString(message.notificationUid)
          )
        )
          return "notificationUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      return null;
    };

    /**
     * Creates a ReadStatusUpdate message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.ReadStatusUpdate} ReadStatusUpdate
     */
    ReadStatusUpdate.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.ReadStatusUpdate) return object;
      let message = new $root.NotificationCenter.ReadStatusUpdate();
      if (object.notificationUid != null)
        if (typeof object.notificationUid === "string")
          $util.base64.decode(
            object.notificationUid,
            (message.notificationUid = $util.newBuffer(
              $util.base64.length(object.notificationUid),
            )),
            0,
          );
        else if (object.notificationUid.length >= 0)
          message.notificationUid = object.notificationUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "NRS_UNSPECIFIED":
        case 0:
          message.status = 0;
          break;
        case "NRS_LAST":
        case 1:
          message.status = 1;
          break;
        case "NRS_READ":
        case 2:
          message.status = 2;
          break;
        case "NRS_UNREAD":
        case 3:
          message.status = 3;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from a ReadStatusUpdate message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {NotificationCenter.ReadStatusUpdate} message ReadStatusUpdate
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ReadStatusUpdate.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.notificationUid = "";
        else {
          object.notificationUid = [];
          if (options.bytes !== Array)
            object.notificationUid = $util.newBuffer(object.notificationUid);
        }
        object.status = options.enums === String ? "NRS_UNSPECIFIED" : 0;
      }
      if (message.notificationUid != null && message.hasOwnProperty("notificationUid"))
        object.notificationUid =
          options.bytes === String
            ? $util.base64.encode(message.notificationUid, 0, message.notificationUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.notificationUid)
              : message.notificationUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.NotificationCenter.NotificationReadStatus[message.status] === undefined
              ? message.status
              : $root.NotificationCenter.NotificationReadStatus[message.status]
            : message.status;
      return object;
    };

    /**
     * Converts this ReadStatusUpdate to JSON.
     * @function toJSON
     * @memberof NotificationCenter.ReadStatusUpdate
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ReadStatusUpdate.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ReadStatusUpdate
     * @function getTypeUrl
     * @memberof NotificationCenter.ReadStatusUpdate
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ReadStatusUpdate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.ReadStatusUpdate";
    };

    return ReadStatusUpdate;
  })();

  NotificationCenter.ApprovalStatusUpdate = (function () {
    /**
     * Properties of an ApprovalStatusUpdate.
     * @memberof NotificationCenter
     * @interface IApprovalStatusUpdate
     * @property {Uint8Array|null} [notificationUid] ApprovalStatusUpdate notificationUid
     * @property {NotificationCenter.NotificationApprovalStatus|null} [status] ApprovalStatusUpdate status
     */

    /**
     * Constructs a new ApprovalStatusUpdate.
     * @memberof NotificationCenter
     * @classdesc Represents an ApprovalStatusUpdate.
     * @implements IApprovalStatusUpdate
     * @constructor
     * @param {NotificationCenter.IApprovalStatusUpdate=} [properties] Properties to set
     */
    function ApprovalStatusUpdate(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ApprovalStatusUpdate notificationUid.
     * @member {Uint8Array} notificationUid
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @instance
     */
    ApprovalStatusUpdate.prototype.notificationUid = $util.newBuffer([]);

    /**
     * ApprovalStatusUpdate status.
     * @member {NotificationCenter.NotificationApprovalStatus} status
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @instance
     */
    ApprovalStatusUpdate.prototype.status = 0;

    /**
     * Creates a new ApprovalStatusUpdate instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {NotificationCenter.IApprovalStatusUpdate=} [properties] Properties to set
     * @returns {NotificationCenter.ApprovalStatusUpdate} ApprovalStatusUpdate instance
     */
    ApprovalStatusUpdate.create = function create(properties) {
      return new ApprovalStatusUpdate(properties);
    };

    /**
     * Encodes the specified ApprovalStatusUpdate message. Does not implicitly {@link NotificationCenter.ApprovalStatusUpdate.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {NotificationCenter.IApprovalStatusUpdate} message ApprovalStatusUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ApprovalStatusUpdate.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.notificationUid != null && Object.hasOwnProperty.call(message, "notificationUid"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.notificationUid);
      if (message.status != null && Object.hasOwnProperty.call(message, "status"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.status);
      return writer;
    };

    /**
     * Encodes the specified ApprovalStatusUpdate message, length delimited. Does not implicitly {@link NotificationCenter.ApprovalStatusUpdate.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {NotificationCenter.IApprovalStatusUpdate} message ApprovalStatusUpdate message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ApprovalStatusUpdate.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an ApprovalStatusUpdate message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.ApprovalStatusUpdate} ApprovalStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ApprovalStatusUpdate.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.ApprovalStatusUpdate();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.notificationUid = reader.bytes();
            break;
          }
          case 2: {
            message.status = reader.int32();
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
     * Decodes an ApprovalStatusUpdate message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.ApprovalStatusUpdate} ApprovalStatusUpdate
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ApprovalStatusUpdate.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an ApprovalStatusUpdate message.
     * @function verify
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ApprovalStatusUpdate.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.notificationUid != null && message.hasOwnProperty("notificationUid"))
        if (
          !(
            (message.notificationUid && typeof message.notificationUid.length === "number") ||
            $util.isString(message.notificationUid)
          )
        )
          return "notificationUid: buffer expected";
      if (message.status != null && message.hasOwnProperty("status"))
        switch (message.status) {
          default:
            return "status: enum value expected";
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
     * Creates an ApprovalStatusUpdate message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.ApprovalStatusUpdate} ApprovalStatusUpdate
     */
    ApprovalStatusUpdate.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.ApprovalStatusUpdate) return object;
      let message = new $root.NotificationCenter.ApprovalStatusUpdate();
      if (object.notificationUid != null)
        if (typeof object.notificationUid === "string")
          $util.base64.decode(
            object.notificationUid,
            (message.notificationUid = $util.newBuffer(
              $util.base64.length(object.notificationUid),
            )),
            0,
          );
        else if (object.notificationUid.length >= 0)
          message.notificationUid = object.notificationUid;
      switch (object.status) {
        default:
          if (typeof object.status === "number") {
            message.status = object.status;
            break;
          }
          break;
        case "NAS_UNSPECIFIED":
        case 0:
          message.status = 0;
          break;
        case "NAS_APPROVED":
        case 1:
          message.status = 1;
          break;
        case "NAS_DENIED":
        case 2:
          message.status = 2;
          break;
        case "NAS_LOST_APPROVAL_RIGHTS":
        case 3:
          message.status = 3;
          break;
        case "NAS_LOST_ACCESS":
        case 4:
          message.status = 4;
          break;
      }
      return message;
    };

    /**
     * Creates a plain object from an ApprovalStatusUpdate message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {NotificationCenter.ApprovalStatusUpdate} message ApprovalStatusUpdate
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ApprovalStatusUpdate.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.notificationUid = "";
        else {
          object.notificationUid = [];
          if (options.bytes !== Array)
            object.notificationUid = $util.newBuffer(object.notificationUid);
        }
        object.status = options.enums === String ? "NAS_UNSPECIFIED" : 0;
      }
      if (message.notificationUid != null && message.hasOwnProperty("notificationUid"))
        object.notificationUid =
          options.bytes === String
            ? $util.base64.encode(message.notificationUid, 0, message.notificationUid.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.notificationUid)
              : message.notificationUid;
      if (message.status != null && message.hasOwnProperty("status"))
        object.status =
          options.enums === String
            ? $root.NotificationCenter.NotificationApprovalStatus[message.status] === undefined
              ? message.status
              : $root.NotificationCenter.NotificationApprovalStatus[message.status]
            : message.status;
      return object;
    };

    /**
     * Converts this ApprovalStatusUpdate to JSON.
     * @function toJSON
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ApprovalStatusUpdate.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ApprovalStatusUpdate
     * @function getTypeUrl
     * @memberof NotificationCenter.ApprovalStatusUpdate
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ApprovalStatusUpdate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.ApprovalStatusUpdate";
    };

    return ApprovalStatusUpdate;
  })();

  NotificationCenter.ProcessMarkReadEventsRequest = (function () {
    /**
     * Properties of a ProcessMarkReadEventsRequest.
     * @memberof NotificationCenter
     * @interface IProcessMarkReadEventsRequest
     * @property {Array.<NotificationCenter.IReadStatusUpdate>|null} [readStatusUpdate] ProcessMarkReadEventsRequest readStatusUpdate
     */

    /**
     * Constructs a new ProcessMarkReadEventsRequest.
     * @memberof NotificationCenter
     * @classdesc Represents a ProcessMarkReadEventsRequest.
     * @implements IProcessMarkReadEventsRequest
     * @constructor
     * @param {NotificationCenter.IProcessMarkReadEventsRequest=} [properties] Properties to set
     */
    function ProcessMarkReadEventsRequest(properties) {
      this.readStatusUpdate = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ProcessMarkReadEventsRequest readStatusUpdate.
     * @member {Array.<NotificationCenter.IReadStatusUpdate>} readStatusUpdate
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @instance
     */
    ProcessMarkReadEventsRequest.prototype.readStatusUpdate = $util.emptyArray;

    /**
     * Creates a new ProcessMarkReadEventsRequest instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {NotificationCenter.IProcessMarkReadEventsRequest=} [properties] Properties to set
     * @returns {NotificationCenter.ProcessMarkReadEventsRequest} ProcessMarkReadEventsRequest instance
     */
    ProcessMarkReadEventsRequest.create = function create(properties) {
      return new ProcessMarkReadEventsRequest(properties);
    };

    /**
     * Encodes the specified ProcessMarkReadEventsRequest message. Does not implicitly {@link NotificationCenter.ProcessMarkReadEventsRequest.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {NotificationCenter.IProcessMarkReadEventsRequest} message ProcessMarkReadEventsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ProcessMarkReadEventsRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.readStatusUpdate != null && message.readStatusUpdate.length)
        for (let i = 0; i < message.readStatusUpdate.length; ++i)
          $root.NotificationCenter.ReadStatusUpdate.encode(
            message.readStatusUpdate[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified ProcessMarkReadEventsRequest message, length delimited. Does not implicitly {@link NotificationCenter.ProcessMarkReadEventsRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {NotificationCenter.IProcessMarkReadEventsRequest} message ProcessMarkReadEventsRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ProcessMarkReadEventsRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ProcessMarkReadEventsRequest message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.ProcessMarkReadEventsRequest} ProcessMarkReadEventsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ProcessMarkReadEventsRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.ProcessMarkReadEventsRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.readStatusUpdate && message.readStatusUpdate.length))
              message.readStatusUpdate = [];
            message.readStatusUpdate.push(
              $root.NotificationCenter.ReadStatusUpdate.decode(reader, reader.uint32()),
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
     * Decodes a ProcessMarkReadEventsRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.ProcessMarkReadEventsRequest} ProcessMarkReadEventsRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ProcessMarkReadEventsRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ProcessMarkReadEventsRequest message.
     * @function verify
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ProcessMarkReadEventsRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.readStatusUpdate != null && message.hasOwnProperty("readStatusUpdate")) {
        if (!Array.isArray(message.readStatusUpdate)) return "readStatusUpdate: array expected";
        for (let i = 0; i < message.readStatusUpdate.length; ++i) {
          let error = $root.NotificationCenter.ReadStatusUpdate.verify(message.readStatusUpdate[i]);
          if (error) return "readStatusUpdate." + error;
        }
      }
      return null;
    };

    /**
     * Creates a ProcessMarkReadEventsRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.ProcessMarkReadEventsRequest} ProcessMarkReadEventsRequest
     */
    ProcessMarkReadEventsRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.ProcessMarkReadEventsRequest) return object;
      let message = new $root.NotificationCenter.ProcessMarkReadEventsRequest();
      if (object.readStatusUpdate) {
        if (!Array.isArray(object.readStatusUpdate))
          throw TypeError(
            ".NotificationCenter.ProcessMarkReadEventsRequest.readStatusUpdate: array expected",
          );
        message.readStatusUpdate = [];
        for (let i = 0; i < object.readStatusUpdate.length; ++i) {
          if (typeof object.readStatusUpdate[i] !== "object")
            throw TypeError(
              ".NotificationCenter.ProcessMarkReadEventsRequest.readStatusUpdate: object expected",
            );
          message.readStatusUpdate[i] = $root.NotificationCenter.ReadStatusUpdate.fromObject(
            object.readStatusUpdate[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a ProcessMarkReadEventsRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {NotificationCenter.ProcessMarkReadEventsRequest} message ProcessMarkReadEventsRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ProcessMarkReadEventsRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.readStatusUpdate = [];
      if (message.readStatusUpdate && message.readStatusUpdate.length) {
        object.readStatusUpdate = [];
        for (let j = 0; j < message.readStatusUpdate.length; ++j)
          object.readStatusUpdate[j] = $root.NotificationCenter.ReadStatusUpdate.toObject(
            message.readStatusUpdate[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this ProcessMarkReadEventsRequest to JSON.
     * @function toJSON
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ProcessMarkReadEventsRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ProcessMarkReadEventsRequest
     * @function getTypeUrl
     * @memberof NotificationCenter.ProcessMarkReadEventsRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ProcessMarkReadEventsRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.ProcessMarkReadEventsRequest";
    };

    return ProcessMarkReadEventsRequest;
  })();

  NotificationCenter.NotificationSendRequest = (function () {
    /**
     * Properties of a NotificationSendRequest.
     * @memberof NotificationCenter
     * @interface INotificationSendRequest
     * @property {Array.<GraphSync.IGraphSyncRef>|null} [recipients] NotificationSendRequest recipients
     * @property {NotificationCenter.INotification|null} [notification] NotificationSendRequest notification
     * @property {Array.<number>|null} [clientTypeIDs] NotificationSendRequest clientTypeIDs
     * @property {Array.<number|Long>|null} [deviceIDs] NotificationSendRequest deviceIDs
     */

    /**
     * Constructs a new NotificationSendRequest.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationSendRequest.
     * @implements INotificationSendRequest
     * @constructor
     * @param {NotificationCenter.INotificationSendRequest=} [properties] Properties to set
     */
    function NotificationSendRequest(properties) {
      this.recipients = [];
      this.clientTypeIDs = [];
      this.deviceIDs = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationSendRequest recipients.
     * @member {Array.<GraphSync.IGraphSyncRef>} recipients
     * @memberof NotificationCenter.NotificationSendRequest
     * @instance
     */
    NotificationSendRequest.prototype.recipients = $util.emptyArray;

    /**
     * NotificationSendRequest notification.
     * @member {NotificationCenter.INotification|null|undefined} notification
     * @memberof NotificationCenter.NotificationSendRequest
     * @instance
     */
    NotificationSendRequest.prototype.notification = null;

    /**
     * NotificationSendRequest clientTypeIDs.
     * @member {Array.<number>} clientTypeIDs
     * @memberof NotificationCenter.NotificationSendRequest
     * @instance
     */
    NotificationSendRequest.prototype.clientTypeIDs = $util.emptyArray;

    /**
     * NotificationSendRequest deviceIDs.
     * @member {Array.<number|Long>} deviceIDs
     * @memberof NotificationCenter.NotificationSendRequest
     * @instance
     */
    NotificationSendRequest.prototype.deviceIDs = $util.emptyArray;

    /**
     * Creates a new NotificationSendRequest instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {NotificationCenter.INotificationSendRequest=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationSendRequest} NotificationSendRequest instance
     */
    NotificationSendRequest.create = function create(properties) {
      return new NotificationSendRequest(properties);
    };

    /**
     * Encodes the specified NotificationSendRequest message. Does not implicitly {@link NotificationCenter.NotificationSendRequest.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {NotificationCenter.INotificationSendRequest} message NotificationSendRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSendRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.recipients != null && message.recipients.length)
        for (let i = 0; i < message.recipients.length; ++i)
          $root.GraphSync.GraphSyncRef.encode(
            message.recipients[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      if (message.notification != null && Object.hasOwnProperty.call(message, "notification"))
        $root.NotificationCenter.Notification.encode(
          message.notification,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (message.clientTypeIDs != null && message.clientTypeIDs.length) {
        writer.uint32(/* id 3, wireType 2 =*/ 26).fork();
        for (let i = 0; i < message.clientTypeIDs.length; ++i)
          writer.int32(message.clientTypeIDs[i]);
        writer.ldelim();
      }
      if (message.deviceIDs != null && message.deviceIDs.length) {
        writer.uint32(/* id 4, wireType 2 =*/ 34).fork();
        for (let i = 0; i < message.deviceIDs.length; ++i) writer.int64(message.deviceIDs[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified NotificationSendRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSendRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {NotificationCenter.INotificationSendRequest} message NotificationSendRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSendRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationSendRequest message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationSendRequest} NotificationSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSendRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationSendRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.recipients && message.recipients.length)) message.recipients = [];
            message.recipients.push($root.GraphSync.GraphSyncRef.decode(reader, reader.uint32()));
            break;
          }
          case 2: {
            message.notification = $root.NotificationCenter.Notification.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 3: {
            if (!(message.clientTypeIDs && message.clientTypeIDs.length))
              message.clientTypeIDs = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.clientTypeIDs.push(reader.int32());
            } else message.clientTypeIDs.push(reader.int32());
            break;
          }
          case 4: {
            if (!(message.deviceIDs && message.deviceIDs.length)) message.deviceIDs = [];
            if ((tag & 7) === 2) {
              let end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2) message.deviceIDs.push(reader.int64());
            } else message.deviceIDs.push(reader.int64());
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
     * Decodes a NotificationSendRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationSendRequest} NotificationSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSendRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationSendRequest message.
     * @function verify
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationSendRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.recipients != null && message.hasOwnProperty("recipients")) {
        if (!Array.isArray(message.recipients)) return "recipients: array expected";
        for (let i = 0; i < message.recipients.length; ++i) {
          let error = $root.GraphSync.GraphSyncRef.verify(message.recipients[i]);
          if (error) return "recipients." + error;
        }
      }
      if (message.notification != null && message.hasOwnProperty("notification")) {
        let error = $root.NotificationCenter.Notification.verify(message.notification);
        if (error) return "notification." + error;
      }
      if (message.clientTypeIDs != null && message.hasOwnProperty("clientTypeIDs")) {
        if (!Array.isArray(message.clientTypeIDs)) return "clientTypeIDs: array expected";
        for (let i = 0; i < message.clientTypeIDs.length; ++i)
          if (!$util.isInteger(message.clientTypeIDs[i]))
            return "clientTypeIDs: integer[] expected";
      }
      if (message.deviceIDs != null && message.hasOwnProperty("deviceIDs")) {
        if (!Array.isArray(message.deviceIDs)) return "deviceIDs: array expected";
        for (let i = 0; i < message.deviceIDs.length; ++i)
          if (
            !$util.isInteger(message.deviceIDs[i]) &&
            !(
              message.deviceIDs[i] &&
              $util.isInteger(message.deviceIDs[i].low) &&
              $util.isInteger(message.deviceIDs[i].high)
            )
          )
            return "deviceIDs: integer|Long[] expected";
      }
      return null;
    };

    /**
     * Creates a NotificationSendRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationSendRequest} NotificationSendRequest
     */
    NotificationSendRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationSendRequest) return object;
      let message = new $root.NotificationCenter.NotificationSendRequest();
      if (object.recipients) {
        if (!Array.isArray(object.recipients))
          throw TypeError(".NotificationCenter.NotificationSendRequest.recipients: array expected");
        message.recipients = [];
        for (let i = 0; i < object.recipients.length; ++i) {
          if (typeof object.recipients[i] !== "object")
            throw TypeError(
              ".NotificationCenter.NotificationSendRequest.recipients: object expected",
            );
          message.recipients[i] = $root.GraphSync.GraphSyncRef.fromObject(object.recipients[i]);
        }
      }
      if (object.notification != null) {
        if (typeof object.notification !== "object")
          throw TypeError(
            ".NotificationCenter.NotificationSendRequest.notification: object expected",
          );
        message.notification = $root.NotificationCenter.Notification.fromObject(
          object.notification,
        );
      }
      if (object.clientTypeIDs) {
        if (!Array.isArray(object.clientTypeIDs))
          throw TypeError(
            ".NotificationCenter.NotificationSendRequest.clientTypeIDs: array expected",
          );
        message.clientTypeIDs = [];
        for (let i = 0; i < object.clientTypeIDs.length; ++i)
          message.clientTypeIDs[i] = object.clientTypeIDs[i] | 0;
      }
      if (object.deviceIDs) {
        if (!Array.isArray(object.deviceIDs))
          throw TypeError(".NotificationCenter.NotificationSendRequest.deviceIDs: array expected");
        message.deviceIDs = [];
        for (let i = 0; i < object.deviceIDs.length; ++i)
          if ($util.Long)
            (message.deviceIDs[i] = $util.Long.fromValue(object.deviceIDs[i])).unsigned = false;
          else if (typeof object.deviceIDs[i] === "string")
            message.deviceIDs[i] = parseInt(object.deviceIDs[i], 10);
          else if (typeof object.deviceIDs[i] === "number")
            message.deviceIDs[i] = object.deviceIDs[i];
          else if (typeof object.deviceIDs[i] === "object")
            message.deviceIDs[i] = new $util.LongBits(
              object.deviceIDs[i].low >>> 0,
              object.deviceIDs[i].high >>> 0,
            ).toNumber();
      }
      return message;
    };

    /**
     * Creates a plain object from a NotificationSendRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {NotificationCenter.NotificationSendRequest} message NotificationSendRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationSendRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) {
        object.recipients = [];
        object.clientTypeIDs = [];
        object.deviceIDs = [];
      }
      if (options.defaults) object.notification = null;
      if (message.recipients && message.recipients.length) {
        object.recipients = [];
        for (let j = 0; j < message.recipients.length; ++j)
          object.recipients[j] = $root.GraphSync.GraphSyncRef.toObject(
            message.recipients[j],
            options,
          );
      }
      if (message.notification != null && message.hasOwnProperty("notification"))
        object.notification = $root.NotificationCenter.Notification.toObject(
          message.notification,
          options,
        );
      if (message.clientTypeIDs && message.clientTypeIDs.length) {
        object.clientTypeIDs = [];
        for (let j = 0; j < message.clientTypeIDs.length; ++j)
          object.clientTypeIDs[j] = message.clientTypeIDs[j];
      }
      if (message.deviceIDs && message.deviceIDs.length) {
        object.deviceIDs = [];
        for (let j = 0; j < message.deviceIDs.length; ++j)
          if (typeof message.deviceIDs[j] === "number")
            object.deviceIDs[j] =
              options.longs === String ? String(message.deviceIDs[j]) : message.deviceIDs[j];
          else
            object.deviceIDs[j] =
              options.longs === String
                ? $util.Long.prototype.toString.call(message.deviceIDs[j])
                : options.longs === Number
                  ? new $util.LongBits(
                      message.deviceIDs[j].low >>> 0,
                      message.deviceIDs[j].high >>> 0,
                    ).toNumber()
                  : message.deviceIDs[j];
      }
      return object;
    };

    /**
     * Converts this NotificationSendRequest to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationSendRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationSendRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationSendRequest
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationSendRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationSendRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationSendRequest";
    };

    return NotificationSendRequest;
  })();

  NotificationCenter.NotificationsSendRequest = (function () {
    /**
     * Properties of a NotificationsSendRequest.
     * @memberof NotificationCenter
     * @interface INotificationsSendRequest
     * @property {Array.<NotificationCenter.INotificationSendRequest>|null} [notifications] NotificationsSendRequest notifications
     */

    /**
     * Constructs a new NotificationsSendRequest.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationsSendRequest.
     * @implements INotificationsSendRequest
     * @constructor
     * @param {NotificationCenter.INotificationsSendRequest=} [properties] Properties to set
     */
    function NotificationsSendRequest(properties) {
      this.notifications = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationsSendRequest notifications.
     * @member {Array.<NotificationCenter.INotificationSendRequest>} notifications
     * @memberof NotificationCenter.NotificationsSendRequest
     * @instance
     */
    NotificationsSendRequest.prototype.notifications = $util.emptyArray;

    /**
     * Creates a new NotificationsSendRequest instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {NotificationCenter.INotificationsSendRequest=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationsSendRequest} NotificationsSendRequest instance
     */
    NotificationsSendRequest.create = function create(properties) {
      return new NotificationsSendRequest(properties);
    };

    /**
     * Encodes the specified NotificationsSendRequest message. Does not implicitly {@link NotificationCenter.NotificationsSendRequest.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {NotificationCenter.INotificationsSendRequest} message NotificationsSendRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationsSendRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.notifications != null && message.notifications.length)
        for (let i = 0; i < message.notifications.length; ++i)
          $root.NotificationCenter.NotificationSendRequest.encode(
            message.notifications[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified NotificationsSendRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationsSendRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {NotificationCenter.INotificationsSendRequest} message NotificationsSendRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationsSendRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationsSendRequest message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationsSendRequest} NotificationsSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationsSendRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationsSendRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.notifications && message.notifications.length))
              message.notifications = [];
            message.notifications.push(
              $root.NotificationCenter.NotificationSendRequest.decode(reader, reader.uint32()),
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
     * Decodes a NotificationsSendRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationsSendRequest} NotificationsSendRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationsSendRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationsSendRequest message.
     * @function verify
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationsSendRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.notifications != null && message.hasOwnProperty("notifications")) {
        if (!Array.isArray(message.notifications)) return "notifications: array expected";
        for (let i = 0; i < message.notifications.length; ++i) {
          let error = $root.NotificationCenter.NotificationSendRequest.verify(
            message.notifications[i],
          );
          if (error) return "notifications." + error;
        }
      }
      return null;
    };

    /**
     * Creates a NotificationsSendRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationsSendRequest} NotificationsSendRequest
     */
    NotificationsSendRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationsSendRequest) return object;
      let message = new $root.NotificationCenter.NotificationsSendRequest();
      if (object.notifications) {
        if (!Array.isArray(object.notifications))
          throw TypeError(
            ".NotificationCenter.NotificationsSendRequest.notifications: array expected",
          );
        message.notifications = [];
        for (let i = 0; i < object.notifications.length; ++i) {
          if (typeof object.notifications[i] !== "object")
            throw TypeError(
              ".NotificationCenter.NotificationsSendRequest.notifications: object expected",
            );
          message.notifications[i] = $root.NotificationCenter.NotificationSendRequest.fromObject(
            object.notifications[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a NotificationsSendRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {NotificationCenter.NotificationsSendRequest} message NotificationsSendRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationsSendRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.notifications = [];
      if (message.notifications && message.notifications.length) {
        object.notifications = [];
        for (let j = 0; j < message.notifications.length; ++j)
          object.notifications[j] = $root.NotificationCenter.NotificationSendRequest.toObject(
            message.notifications[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this NotificationsSendRequest to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationsSendRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationsSendRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationsSendRequest
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationsSendRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationsSendRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationsSendRequest";
    };

    return NotificationsSendRequest;
  })();

  NotificationCenter.NotificationSyncRequest = (function () {
    /**
     * Properties of a NotificationSyncRequest.
     * @memberof NotificationCenter
     * @interface INotificationSyncRequest
     * @property {number|Long|null} [syncPoint] NotificationSyncRequest syncPoint
     */

    /**
     * Constructs a new NotificationSyncRequest.
     * @memberof NotificationCenter
     * @classdesc Represents a NotificationSyncRequest.
     * @implements INotificationSyncRequest
     * @constructor
     * @param {NotificationCenter.INotificationSyncRequest=} [properties] Properties to set
     */
    function NotificationSyncRequest(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * NotificationSyncRequest syncPoint.
     * @member {number|Long} syncPoint
     * @memberof NotificationCenter.NotificationSyncRequest
     * @instance
     */
    NotificationSyncRequest.prototype.syncPoint = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Creates a new NotificationSyncRequest instance using the specified properties.
     * @function create
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {NotificationCenter.INotificationSyncRequest=} [properties] Properties to set
     * @returns {NotificationCenter.NotificationSyncRequest} NotificationSyncRequest instance
     */
    NotificationSyncRequest.create = function create(properties) {
      return new NotificationSyncRequest(properties);
    };

    /**
     * Encodes the specified NotificationSyncRequest message. Does not implicitly {@link NotificationCenter.NotificationSyncRequest.verify|verify} messages.
     * @function encode
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {NotificationCenter.INotificationSyncRequest} message NotificationSyncRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSyncRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.syncPoint != null && Object.hasOwnProperty.call(message, "syncPoint"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.syncPoint);
      return writer;
    };

    /**
     * Encodes the specified NotificationSyncRequest message, length delimited. Does not implicitly {@link NotificationCenter.NotificationSyncRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {NotificationCenter.INotificationSyncRequest} message NotificationSyncRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NotificationSyncRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NotificationSyncRequest message from the specified reader or buffer.
     * @function decode
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NotificationCenter.NotificationSyncRequest} NotificationSyncRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSyncRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.NotificationCenter.NotificationSyncRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.syncPoint = reader.int64();
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
     * Decodes a NotificationSyncRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NotificationCenter.NotificationSyncRequest} NotificationSyncRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NotificationSyncRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NotificationSyncRequest message.
     * @function verify
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NotificationSyncRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (
          !$util.isInteger(message.syncPoint) &&
          !(
            message.syncPoint &&
            $util.isInteger(message.syncPoint.low) &&
            $util.isInteger(message.syncPoint.high)
          )
        )
          return "syncPoint: integer|Long expected";
      return null;
    };

    /**
     * Creates a NotificationSyncRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NotificationCenter.NotificationSyncRequest} NotificationSyncRequest
     */
    NotificationSyncRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.NotificationCenter.NotificationSyncRequest) return object;
      let message = new $root.NotificationCenter.NotificationSyncRequest();
      if (object.syncPoint != null)
        if ($util.Long)
          (message.syncPoint = $util.Long.fromValue(object.syncPoint)).unsigned = false;
        else if (typeof object.syncPoint === "string")
          message.syncPoint = parseInt(object.syncPoint, 10);
        else if (typeof object.syncPoint === "number") message.syncPoint = object.syncPoint;
        else if (typeof object.syncPoint === "object")
          message.syncPoint = new $util.LongBits(
            object.syncPoint.low >>> 0,
            object.syncPoint.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a NotificationSyncRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {NotificationCenter.NotificationSyncRequest} message NotificationSyncRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NotificationSyncRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults)
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.syncPoint =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.syncPoint = options.longs === String ? "0" : 0;
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (typeof message.syncPoint === "number")
          object.syncPoint =
            options.longs === String ? String(message.syncPoint) : message.syncPoint;
        else
          object.syncPoint =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.syncPoint)
              : options.longs === Number
                ? new $util.LongBits(
                    message.syncPoint.low >>> 0,
                    message.syncPoint.high >>> 0,
                  ).toNumber()
                : message.syncPoint;
      return object;
    };

    /**
     * Converts this NotificationSyncRequest to JSON.
     * @function toJSON
     * @memberof NotificationCenter.NotificationSyncRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NotificationSyncRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for NotificationSyncRequest
     * @function getTypeUrl
     * @memberof NotificationCenter.NotificationSyncRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    NotificationSyncRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/NotificationCenter.NotificationSyncRequest";
    };

    return NotificationSyncRequest;
  })();

  return NotificationCenter;
})());

export const GraphSync = ($root.GraphSync = (() => {
  /**
   * Namespace GraphSync.
   * @exports GraphSync
   * @namespace
   */
  const GraphSync = {};

  /**
   * RefType enum.
   * @name GraphSync.RefType
   * @enum {number}
   * @property {number} RFT_GENERAL=0 RFT_GENERAL value
   * @property {number} RFT_USER=1 RFT_USER value
   * @property {number} RFT_DEVICE=2 RFT_DEVICE value
   * @property {number} RFT_REC=3 RFT_REC value
   * @property {number} RFT_FOLDER=4 RFT_FOLDER value
   * @property {number} RFT_TEAM=5 RFT_TEAM value
   * @property {number} RFT_ENTERPRISE=6 RFT_ENTERPRISE value
   * @property {number} RFT_PAM_DIRECTORY=7 RFT_PAM_DIRECTORY value
   * @property {number} RFT_PAM_MACHINE=8 RFT_PAM_MACHINE value
   * @property {number} RFT_PAM_DATABASE=9 RFT_PAM_DATABASE value
   * @property {number} RFT_PAM_USER=10 RFT_PAM_USER value
   * @property {number} RFT_PAM_NETWORK=11 RFT_PAM_NETWORK value
   * @property {number} RFT_PAM_BROWSER=12 RFT_PAM_BROWSER value
   * @property {number} RFT_CONNECTION=13 RFT_CONNECTION value
   * @property {number} RFT_WORKFLOW=14 RFT_WORKFLOW value
   * @property {number} RFT_NOTIFICATION=15 RFT_NOTIFICATION value
   * @property {number} RFT_USER_INFO=16 RFT_USER_INFO value
   * @property {number} RFT_TEAM_INFO=17 RFT_TEAM_INFO value
   * @property {number} RFT_ROLE=18 RFT_ROLE value
   */
  GraphSync.RefType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "RFT_GENERAL")] = 0;
    values[(valuesById[1] = "RFT_USER")] = 1;
    values[(valuesById[2] = "RFT_DEVICE")] = 2;
    values[(valuesById[3] = "RFT_REC")] = 3;
    values[(valuesById[4] = "RFT_FOLDER")] = 4;
    values[(valuesById[5] = "RFT_TEAM")] = 5;
    values[(valuesById[6] = "RFT_ENTERPRISE")] = 6;
    values[(valuesById[7] = "RFT_PAM_DIRECTORY")] = 7;
    values[(valuesById[8] = "RFT_PAM_MACHINE")] = 8;
    values[(valuesById[9] = "RFT_PAM_DATABASE")] = 9;
    values[(valuesById[10] = "RFT_PAM_USER")] = 10;
    values[(valuesById[11] = "RFT_PAM_NETWORK")] = 11;
    values[(valuesById[12] = "RFT_PAM_BROWSER")] = 12;
    values[(valuesById[13] = "RFT_CONNECTION")] = 13;
    values[(valuesById[14] = "RFT_WORKFLOW")] = 14;
    values[(valuesById[15] = "RFT_NOTIFICATION")] = 15;
    values[(valuesById[16] = "RFT_USER_INFO")] = 16;
    values[(valuesById[17] = "RFT_TEAM_INFO")] = 17;
    values[(valuesById[18] = "RFT_ROLE")] = 18;
    return values;
  })();

  /**
   * GraphSyncDataType enum.
   * @name GraphSync.GraphSyncDataType
   * @enum {number}
   * @property {number} GSE_DATA=0 GSE_DATA value
   * @property {number} GSE_KEY=1 GSE_KEY value
   * @property {number} GSE_LINK=2 GSE_LINK value
   * @property {number} GSE_ACL=3 GSE_ACL value
   * @property {number} GSE_DELETION=4 GSE_DELETION value
   */
  GraphSync.GraphSyncDataType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "GSE_DATA")] = 0;
    values[(valuesById[1] = "GSE_KEY")] = 1;
    values[(valuesById[2] = "GSE_LINK")] = 2;
    values[(valuesById[3] = "GSE_ACL")] = 3;
    values[(valuesById[4] = "GSE_DELETION")] = 4;
    return values;
  })();

  /**
   * GraphSyncActorType enum.
   * @name GraphSync.GraphSyncActorType
   * @enum {number}
   * @property {number} GSA_USER=0 GSA_USER value
   * @property {number} GSA_SERVICE=1 GSA_SERVICE value
   * @property {number} GSA_PAM_GATEWAY=2 GSA_PAM_GATEWAY value
   */
  GraphSync.GraphSyncActorType = (function () {
    const valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "GSA_USER")] = 0;
    values[(valuesById[1] = "GSA_SERVICE")] = 1;
    values[(valuesById[2] = "GSA_PAM_GATEWAY")] = 2;
    return values;
  })();

  GraphSync.GraphSyncRef = (function () {
    /**
     * Properties of a GraphSyncRef.
     * @memberof GraphSync
     * @interface IGraphSyncRef
     * @property {GraphSync.RefType|null} [type] GraphSyncRef type
     * @property {Uint8Array|null} [value] GraphSyncRef value
     * @property {string|null} [name] GraphSyncRef name
     */

    /**
     * Constructs a new GraphSyncRef.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncRef.
     * @implements IGraphSyncRef
     * @constructor
     * @param {GraphSync.IGraphSyncRef=} [properties] Properties to set
     */
    function GraphSyncRef(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncRef type.
     * @member {GraphSync.RefType} type
     * @memberof GraphSync.GraphSyncRef
     * @instance
     */
    GraphSyncRef.prototype.type = 0;

    /**
     * GraphSyncRef value.
     * @member {Uint8Array} value
     * @memberof GraphSync.GraphSyncRef
     * @instance
     */
    GraphSyncRef.prototype.value = $util.newBuffer([]);

    /**
     * GraphSyncRef name.
     * @member {string} name
     * @memberof GraphSync.GraphSyncRef
     * @instance
     */
    GraphSyncRef.prototype.name = "";

    /**
     * Creates a new GraphSyncRef instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {GraphSync.IGraphSyncRef=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncRef} GraphSyncRef instance
     */
    GraphSyncRef.create = function create(properties) {
      return new GraphSyncRef(properties);
    };

    /**
     * Encodes the specified GraphSyncRef message. Does not implicitly {@link GraphSync.GraphSyncRef.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {GraphSync.IGraphSyncRef} message GraphSyncRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncRef.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.type != null && Object.hasOwnProperty.call(message, "type"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.type);
      if (message.value != null && Object.hasOwnProperty.call(message, "value"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.value);
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.name);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncRef message, length delimited. Does not implicitly {@link GraphSync.GraphSyncRef.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {GraphSync.IGraphSyncRef} message GraphSyncRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncRef.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncRef message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncRef} GraphSyncRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncRef.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncRef();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.type = reader.int32();
            break;
          }
          case 2: {
            message.value = reader.bytes();
            break;
          }
          case 3: {
            message.name = reader.string();
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
     * Decodes a GraphSyncRef message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncRef} GraphSyncRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncRef.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncRef message.
     * @function verify
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncRef.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.type != null && message.hasOwnProperty("type"))
        switch (message.type) {
          default:
            return "type: enum value expected";
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
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
          case 18:
            break;
        }
      if (message.value != null && message.hasOwnProperty("value"))
        if (
          !(
            (message.value && typeof message.value.length === "number") ||
            $util.isString(message.value)
          )
        )
          return "value: buffer expected";
      if (message.name != null && message.hasOwnProperty("name"))
        if (!$util.isString(message.name)) return "name: string expected";
      return null;
    };

    /**
     * Creates a GraphSyncRef message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncRef} GraphSyncRef
     */
    GraphSyncRef.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncRef) return object;
      let message = new $root.GraphSync.GraphSyncRef();
      switch (object.type) {
        default:
          if (typeof object.type === "number") {
            message.type = object.type;
            break;
          }
          break;
        case "RFT_GENERAL":
        case 0:
          message.type = 0;
          break;
        case "RFT_USER":
        case 1:
          message.type = 1;
          break;
        case "RFT_DEVICE":
        case 2:
          message.type = 2;
          break;
        case "RFT_REC":
        case 3:
          message.type = 3;
          break;
        case "RFT_FOLDER":
        case 4:
          message.type = 4;
          break;
        case "RFT_TEAM":
        case 5:
          message.type = 5;
          break;
        case "RFT_ENTERPRISE":
        case 6:
          message.type = 6;
          break;
        case "RFT_PAM_DIRECTORY":
        case 7:
          message.type = 7;
          break;
        case "RFT_PAM_MACHINE":
        case 8:
          message.type = 8;
          break;
        case "RFT_PAM_DATABASE":
        case 9:
          message.type = 9;
          break;
        case "RFT_PAM_USER":
        case 10:
          message.type = 10;
          break;
        case "RFT_PAM_NETWORK":
        case 11:
          message.type = 11;
          break;
        case "RFT_PAM_BROWSER":
        case 12:
          message.type = 12;
          break;
        case "RFT_CONNECTION":
        case 13:
          message.type = 13;
          break;
        case "RFT_WORKFLOW":
        case 14:
          message.type = 14;
          break;
        case "RFT_NOTIFICATION":
        case 15:
          message.type = 15;
          break;
        case "RFT_USER_INFO":
        case 16:
          message.type = 16;
          break;
        case "RFT_TEAM_INFO":
        case 17:
          message.type = 17;
          break;
        case "RFT_ROLE":
        case 18:
          message.type = 18;
          break;
      }
      if (object.value != null)
        if (typeof object.value === "string")
          $util.base64.decode(
            object.value,
            (message.value = $util.newBuffer($util.base64.length(object.value))),
            0,
          );
        else if (object.value.length >= 0) message.value = object.value;
      if (object.name != null) message.name = String(object.name);
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncRef message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {GraphSync.GraphSyncRef} message GraphSyncRef
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncRef.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.type = options.enums === String ? "RFT_GENERAL" : 0;
        if (options.bytes === String) object.value = "";
        else {
          object.value = [];
          if (options.bytes !== Array) object.value = $util.newBuffer(object.value);
        }
        object.name = "";
      }
      if (message.type != null && message.hasOwnProperty("type"))
        object.type =
          options.enums === String
            ? $root.GraphSync.RefType[message.type] === undefined
              ? message.type
              : $root.GraphSync.RefType[message.type]
            : message.type;
      if (message.value != null && message.hasOwnProperty("value"))
        object.value =
          options.bytes === String
            ? $util.base64.encode(message.value, 0, message.value.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.value)
              : message.value;
      if (message.name != null && message.hasOwnProperty("name")) object.name = message.name;
      return object;
    };

    /**
     * Converts this GraphSyncRef to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncRef
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncRef.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncRef
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncRef
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncRef";
    };

    return GraphSyncRef;
  })();

  GraphSync.GraphSyncActor = (function () {
    /**
     * Properties of a GraphSyncActor.
     * @memberof GraphSync
     * @interface IGraphSyncActor
     * @property {GraphSync.GraphSyncActorType|null} [type] GraphSyncActor type
     * @property {Uint8Array|null} [id] GraphSyncActor id
     * @property {string|null} [name] GraphSyncActor name
     * @property {Uint8Array|null} [effectiveUserId] GraphSyncActor effectiveUserId
     */

    /**
     * Constructs a new GraphSyncActor.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncActor.
     * @implements IGraphSyncActor
     * @constructor
     * @param {GraphSync.IGraphSyncActor=} [properties] Properties to set
     */
    function GraphSyncActor(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncActor type.
     * @member {GraphSync.GraphSyncActorType} type
     * @memberof GraphSync.GraphSyncActor
     * @instance
     */
    GraphSyncActor.prototype.type = 0;

    /**
     * GraphSyncActor id.
     * @member {Uint8Array} id
     * @memberof GraphSync.GraphSyncActor
     * @instance
     */
    GraphSyncActor.prototype.id = $util.newBuffer([]);

    /**
     * GraphSyncActor name.
     * @member {string} name
     * @memberof GraphSync.GraphSyncActor
     * @instance
     */
    GraphSyncActor.prototype.name = "";

    /**
     * GraphSyncActor effectiveUserId.
     * @member {Uint8Array} effectiveUserId
     * @memberof GraphSync.GraphSyncActor
     * @instance
     */
    GraphSyncActor.prototype.effectiveUserId = $util.newBuffer([]);

    /**
     * Creates a new GraphSyncActor instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {GraphSync.IGraphSyncActor=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncActor} GraphSyncActor instance
     */
    GraphSyncActor.create = function create(properties) {
      return new GraphSyncActor(properties);
    };

    /**
     * Encodes the specified GraphSyncActor message. Does not implicitly {@link GraphSync.GraphSyncActor.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {GraphSync.IGraphSyncActor} message GraphSyncActor message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncActor.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.type != null && Object.hasOwnProperty.call(message, "type"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.type);
      if (message.id != null && Object.hasOwnProperty.call(message, "id"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.id);
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.name);
      if (message.effectiveUserId != null && Object.hasOwnProperty.call(message, "effectiveUserId"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.effectiveUserId);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncActor message, length delimited. Does not implicitly {@link GraphSync.GraphSyncActor.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {GraphSync.IGraphSyncActor} message GraphSyncActor message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncActor.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncActor message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncActor} GraphSyncActor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncActor.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncActor();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.type = reader.int32();
            break;
          }
          case 2: {
            message.id = reader.bytes();
            break;
          }
          case 3: {
            message.name = reader.string();
            break;
          }
          case 4: {
            message.effectiveUserId = reader.bytes();
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
     * Decodes a GraphSyncActor message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncActor} GraphSyncActor
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncActor.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncActor message.
     * @function verify
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncActor.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.type != null && message.hasOwnProperty("type"))
        switch (message.type) {
          default:
            return "type: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.id != null && message.hasOwnProperty("id"))
        if (!((message.id && typeof message.id.length === "number") || $util.isString(message.id)))
          return "id: buffer expected";
      if (message.name != null && message.hasOwnProperty("name"))
        if (!$util.isString(message.name)) return "name: string expected";
      if (message.effectiveUserId != null && message.hasOwnProperty("effectiveUserId"))
        if (
          !(
            (message.effectiveUserId && typeof message.effectiveUserId.length === "number") ||
            $util.isString(message.effectiveUserId)
          )
        )
          return "effectiveUserId: buffer expected";
      return null;
    };

    /**
     * Creates a GraphSyncActor message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncActor} GraphSyncActor
     */
    GraphSyncActor.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncActor) return object;
      let message = new $root.GraphSync.GraphSyncActor();
      switch (object.type) {
        default:
          if (typeof object.type === "number") {
            message.type = object.type;
            break;
          }
          break;
        case "GSA_USER":
        case 0:
          message.type = 0;
          break;
        case "GSA_SERVICE":
        case 1:
          message.type = 1;
          break;
        case "GSA_PAM_GATEWAY":
        case 2:
          message.type = 2;
          break;
      }
      if (object.id != null)
        if (typeof object.id === "string")
          $util.base64.decode(
            object.id,
            (message.id = $util.newBuffer($util.base64.length(object.id))),
            0,
          );
        else if (object.id.length >= 0) message.id = object.id;
      if (object.name != null) message.name = String(object.name);
      if (object.effectiveUserId != null)
        if (typeof object.effectiveUserId === "string")
          $util.base64.decode(
            object.effectiveUserId,
            (message.effectiveUserId = $util.newBuffer(
              $util.base64.length(object.effectiveUserId),
            )),
            0,
          );
        else if (object.effectiveUserId.length >= 0)
          message.effectiveUserId = object.effectiveUserId;
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncActor message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {GraphSync.GraphSyncActor} message GraphSyncActor
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncActor.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.type = options.enums === String ? "GSA_USER" : 0;
        if (options.bytes === String) object.id = "";
        else {
          object.id = [];
          if (options.bytes !== Array) object.id = $util.newBuffer(object.id);
        }
        object.name = "";
        if (options.bytes === String) object.effectiveUserId = "";
        else {
          object.effectiveUserId = [];
          if (options.bytes !== Array)
            object.effectiveUserId = $util.newBuffer(object.effectiveUserId);
        }
      }
      if (message.type != null && message.hasOwnProperty("type"))
        object.type =
          options.enums === String
            ? $root.GraphSync.GraphSyncActorType[message.type] === undefined
              ? message.type
              : $root.GraphSync.GraphSyncActorType[message.type]
            : message.type;
      if (message.id != null && message.hasOwnProperty("id"))
        object.id =
          options.bytes === String
            ? $util.base64.encode(message.id, 0, message.id.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.id)
              : message.id;
      if (message.name != null && message.hasOwnProperty("name")) object.name = message.name;
      if (message.effectiveUserId != null && message.hasOwnProperty("effectiveUserId"))
        object.effectiveUserId =
          options.bytes === String
            ? $util.base64.encode(message.effectiveUserId, 0, message.effectiveUserId.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.effectiveUserId)
              : message.effectiveUserId;
      return object;
    };

    /**
     * Converts this GraphSyncActor to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncActor
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncActor.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncActor
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncActor
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncActor.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncActor";
    };

    return GraphSyncActor;
  })();

  GraphSync.GraphSyncData = (function () {
    /**
     * Properties of a GraphSyncData.
     * @memberof GraphSync
     * @interface IGraphSyncData
     * @property {GraphSync.GraphSyncDataType|null} [type] GraphSyncData type
     * @property {GraphSync.IGraphSyncRef|null} [ref] GraphSyncData ref
     * @property {GraphSync.IGraphSyncRef|null} [parentRef] GraphSyncData parentRef
     * @property {Uint8Array|null} [content] GraphSyncData content
     * @property {string|null} [path] GraphSyncData path
     */

    /**
     * Constructs a new GraphSyncData.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncData.
     * @implements IGraphSyncData
     * @constructor
     * @param {GraphSync.IGraphSyncData=} [properties] Properties to set
     */
    function GraphSyncData(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncData type.
     * @member {GraphSync.GraphSyncDataType} type
     * @memberof GraphSync.GraphSyncData
     * @instance
     */
    GraphSyncData.prototype.type = 0;

    /**
     * GraphSyncData ref.
     * @member {GraphSync.IGraphSyncRef|null|undefined} ref
     * @memberof GraphSync.GraphSyncData
     * @instance
     */
    GraphSyncData.prototype.ref = null;

    /**
     * GraphSyncData parentRef.
     * @member {GraphSync.IGraphSyncRef|null|undefined} parentRef
     * @memberof GraphSync.GraphSyncData
     * @instance
     */
    GraphSyncData.prototype.parentRef = null;

    /**
     * GraphSyncData content.
     * @member {Uint8Array} content
     * @memberof GraphSync.GraphSyncData
     * @instance
     */
    GraphSyncData.prototype.content = $util.newBuffer([]);

    /**
     * GraphSyncData path.
     * @member {string} path
     * @memberof GraphSync.GraphSyncData
     * @instance
     */
    GraphSyncData.prototype.path = "";

    /**
     * Creates a new GraphSyncData instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {GraphSync.IGraphSyncData=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncData} GraphSyncData instance
     */
    GraphSyncData.create = function create(properties) {
      return new GraphSyncData(properties);
    };

    /**
     * Encodes the specified GraphSyncData message. Does not implicitly {@link GraphSync.GraphSyncData.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {GraphSync.IGraphSyncData} message GraphSyncData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.type != null && Object.hasOwnProperty.call(message, "type"))
        writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.type);
      if (message.ref != null && Object.hasOwnProperty.call(message, "ref"))
        $root.GraphSync.GraphSyncRef.encode(
          message.ref,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (message.parentRef != null && Object.hasOwnProperty.call(message, "parentRef"))
        $root.GraphSync.GraphSyncRef.encode(
          message.parentRef,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (message.content != null && Object.hasOwnProperty.call(message, "content"))
        writer.uint32(/* id 4, wireType 2 =*/ 34).bytes(message.content);
      if (message.path != null && Object.hasOwnProperty.call(message, "path"))
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.path);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncData message, length delimited. Does not implicitly {@link GraphSync.GraphSyncData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {GraphSync.IGraphSyncData} message GraphSyncData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncData message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncData} GraphSyncData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.type = reader.int32();
            break;
          }
          case 2: {
            message.ref = $root.GraphSync.GraphSyncRef.decode(reader, reader.uint32());
            break;
          }
          case 3: {
            message.parentRef = $root.GraphSync.GraphSyncRef.decode(reader, reader.uint32());
            break;
          }
          case 4: {
            message.content = reader.bytes();
            break;
          }
          case 5: {
            message.path = reader.string();
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
     * Decodes a GraphSyncData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncData} GraphSyncData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncData message.
     * @function verify
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncData.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.type != null && message.hasOwnProperty("type"))
        switch (message.type) {
          default:
            return "type: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
            break;
        }
      if (message.ref != null && message.hasOwnProperty("ref")) {
        let error = $root.GraphSync.GraphSyncRef.verify(message.ref);
        if (error) return "ref." + error;
      }
      if (message.parentRef != null && message.hasOwnProperty("parentRef")) {
        let error = $root.GraphSync.GraphSyncRef.verify(message.parentRef);
        if (error) return "parentRef." + error;
      }
      if (message.content != null && message.hasOwnProperty("content"))
        if (
          !(
            (message.content && typeof message.content.length === "number") ||
            $util.isString(message.content)
          )
        )
          return "content: buffer expected";
      if (message.path != null && message.hasOwnProperty("path"))
        if (!$util.isString(message.path)) return "path: string expected";
      return null;
    };

    /**
     * Creates a GraphSyncData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncData} GraphSyncData
     */
    GraphSyncData.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncData) return object;
      let message = new $root.GraphSync.GraphSyncData();
      switch (object.type) {
        default:
          if (typeof object.type === "number") {
            message.type = object.type;
            break;
          }
          break;
        case "GSE_DATA":
        case 0:
          message.type = 0;
          break;
        case "GSE_KEY":
        case 1:
          message.type = 1;
          break;
        case "GSE_LINK":
        case 2:
          message.type = 2;
          break;
        case "GSE_ACL":
        case 3:
          message.type = 3;
          break;
        case "GSE_DELETION":
        case 4:
          message.type = 4;
          break;
      }
      if (object.ref != null) {
        if (typeof object.ref !== "object")
          throw TypeError(".GraphSync.GraphSyncData.ref: object expected");
        message.ref = $root.GraphSync.GraphSyncRef.fromObject(object.ref);
      }
      if (object.parentRef != null) {
        if (typeof object.parentRef !== "object")
          throw TypeError(".GraphSync.GraphSyncData.parentRef: object expected");
        message.parentRef = $root.GraphSync.GraphSyncRef.fromObject(object.parentRef);
      }
      if (object.content != null)
        if (typeof object.content === "string")
          $util.base64.decode(
            object.content,
            (message.content = $util.newBuffer($util.base64.length(object.content))),
            0,
          );
        else if (object.content.length >= 0) message.content = object.content;
      if (object.path != null) message.path = String(object.path);
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {GraphSync.GraphSyncData} message GraphSyncData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncData.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.type = options.enums === String ? "GSE_DATA" : 0;
        object.ref = null;
        object.parentRef = null;
        if (options.bytes === String) object.content = "";
        else {
          object.content = [];
          if (options.bytes !== Array) object.content = $util.newBuffer(object.content);
        }
        object.path = "";
      }
      if (message.type != null && message.hasOwnProperty("type"))
        object.type =
          options.enums === String
            ? $root.GraphSync.GraphSyncDataType[message.type] === undefined
              ? message.type
              : $root.GraphSync.GraphSyncDataType[message.type]
            : message.type;
      if (message.ref != null && message.hasOwnProperty("ref"))
        object.ref = $root.GraphSync.GraphSyncRef.toObject(message.ref, options);
      if (message.parentRef != null && message.hasOwnProperty("parentRef"))
        object.parentRef = $root.GraphSync.GraphSyncRef.toObject(message.parentRef, options);
      if (message.content != null && message.hasOwnProperty("content"))
        object.content =
          options.bytes === String
            ? $util.base64.encode(message.content, 0, message.content.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.content)
              : message.content;
      if (message.path != null && message.hasOwnProperty("path")) object.path = message.path;
      return object;
    };

    /**
     * Converts this GraphSyncData to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncData
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncData";
    };

    return GraphSyncData;
  })();

  GraphSync.GraphSyncDataPlus = (function () {
    /**
     * Properties of a GraphSyncDataPlus.
     * @memberof GraphSync
     * @interface IGraphSyncDataPlus
     * @property {GraphSync.IGraphSyncData|null} [data] GraphSyncDataPlus data
     * @property {number|Long|null} [timestamp] GraphSyncDataPlus timestamp
     * @property {GraphSync.IGraphSyncActor|null} [actor] GraphSyncDataPlus actor
     */

    /**
     * Constructs a new GraphSyncDataPlus.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncDataPlus.
     * @implements IGraphSyncDataPlus
     * @constructor
     * @param {GraphSync.IGraphSyncDataPlus=} [properties] Properties to set
     */
    function GraphSyncDataPlus(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncDataPlus data.
     * @member {GraphSync.IGraphSyncData|null|undefined} data
     * @memberof GraphSync.GraphSyncDataPlus
     * @instance
     */
    GraphSyncDataPlus.prototype.data = null;

    /**
     * GraphSyncDataPlus timestamp.
     * @member {number|Long} timestamp
     * @memberof GraphSync.GraphSyncDataPlus
     * @instance
     */
    GraphSyncDataPlus.prototype.timestamp = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * GraphSyncDataPlus actor.
     * @member {GraphSync.IGraphSyncActor|null|undefined} actor
     * @memberof GraphSync.GraphSyncDataPlus
     * @instance
     */
    GraphSyncDataPlus.prototype.actor = null;

    /**
     * Creates a new GraphSyncDataPlus instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {GraphSync.IGraphSyncDataPlus=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncDataPlus} GraphSyncDataPlus instance
     */
    GraphSyncDataPlus.create = function create(properties) {
      return new GraphSyncDataPlus(properties);
    };

    /**
     * Encodes the specified GraphSyncDataPlus message. Does not implicitly {@link GraphSync.GraphSyncDataPlus.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {GraphSync.IGraphSyncDataPlus} message GraphSyncDataPlus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncDataPlus.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.data != null && Object.hasOwnProperty.call(message, "data"))
        $root.GraphSync.GraphSyncData.encode(
          message.data,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
        writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.timestamp);
      if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
        $root.GraphSync.GraphSyncActor.encode(
          message.actor,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GraphSyncDataPlus message, length delimited. Does not implicitly {@link GraphSync.GraphSyncDataPlus.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {GraphSync.IGraphSyncDataPlus} message GraphSyncDataPlus message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncDataPlus.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncDataPlus message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncDataPlus} GraphSyncDataPlus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncDataPlus.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncDataPlus();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.data = $root.GraphSync.GraphSyncData.decode(reader, reader.uint32());
            break;
          }
          case 2: {
            message.timestamp = reader.int64();
            break;
          }
          case 3: {
            message.actor = $root.GraphSync.GraphSyncActor.decode(reader, reader.uint32());
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
     * Decodes a GraphSyncDataPlus message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncDataPlus} GraphSyncDataPlus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncDataPlus.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncDataPlus message.
     * @function verify
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncDataPlus.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.data != null && message.hasOwnProperty("data")) {
        let error = $root.GraphSync.GraphSyncData.verify(message.data);
        if (error) return "data." + error;
      }
      if (message.timestamp != null && message.hasOwnProperty("timestamp"))
        if (
          !$util.isInteger(message.timestamp) &&
          !(
            message.timestamp &&
            $util.isInteger(message.timestamp.low) &&
            $util.isInteger(message.timestamp.high)
          )
        )
          return "timestamp: integer|Long expected";
      if (message.actor != null && message.hasOwnProperty("actor")) {
        let error = $root.GraphSync.GraphSyncActor.verify(message.actor);
        if (error) return "actor." + error;
      }
      return null;
    };

    /**
     * Creates a GraphSyncDataPlus message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncDataPlus} GraphSyncDataPlus
     */
    GraphSyncDataPlus.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncDataPlus) return object;
      let message = new $root.GraphSync.GraphSyncDataPlus();
      if (object.data != null) {
        if (typeof object.data !== "object")
          throw TypeError(".GraphSync.GraphSyncDataPlus.data: object expected");
        message.data = $root.GraphSync.GraphSyncData.fromObject(object.data);
      }
      if (object.timestamp != null)
        if ($util.Long)
          (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = false;
        else if (typeof object.timestamp === "string")
          message.timestamp = parseInt(object.timestamp, 10);
        else if (typeof object.timestamp === "number") message.timestamp = object.timestamp;
        else if (typeof object.timestamp === "object")
          message.timestamp = new $util.LongBits(
            object.timestamp.low >>> 0,
            object.timestamp.high >>> 0,
          ).toNumber();
      if (object.actor != null) {
        if (typeof object.actor !== "object")
          throw TypeError(".GraphSync.GraphSyncDataPlus.actor: object expected");
        message.actor = $root.GraphSync.GraphSyncActor.fromObject(object.actor);
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncDataPlus message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {GraphSync.GraphSyncDataPlus} message GraphSyncDataPlus
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncDataPlus.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.data = null;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.timestamp =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.timestamp = options.longs === String ? "0" : 0;
        object.actor = null;
      }
      if (message.data != null && message.hasOwnProperty("data"))
        object.data = $root.GraphSync.GraphSyncData.toObject(message.data, options);
      if (message.timestamp != null && message.hasOwnProperty("timestamp"))
        if (typeof message.timestamp === "number")
          object.timestamp =
            options.longs === String ? String(message.timestamp) : message.timestamp;
        else
          object.timestamp =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.timestamp)
              : options.longs === Number
                ? new $util.LongBits(
                    message.timestamp.low >>> 0,
                    message.timestamp.high >>> 0,
                  ).toNumber()
                : message.timestamp;
      if (message.actor != null && message.hasOwnProperty("actor"))
        object.actor = $root.GraphSync.GraphSyncActor.toObject(message.actor, options);
      return object;
    };

    /**
     * Converts this GraphSyncDataPlus to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncDataPlus
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncDataPlus.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncDataPlus
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncDataPlus
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncDataPlus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncDataPlus";
    };

    return GraphSyncDataPlus;
  })();

  GraphSync.GraphSyncQuery = (function () {
    /**
     * Properties of a GraphSyncQuery.
     * @memberof GraphSync
     * @interface IGraphSyncQuery
     * @property {Uint8Array|null} [streamId] GraphSyncQuery streamId
     * @property {Uint8Array|null} [origin] GraphSyncQuery origin
     * @property {number|Long|null} [syncPoint] GraphSyncQuery syncPoint
     * @property {number|null} [maxCount] GraphSyncQuery maxCount
     */

    /**
     * Constructs a new GraphSyncQuery.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncQuery.
     * @implements IGraphSyncQuery
     * @constructor
     * @param {GraphSync.IGraphSyncQuery=} [properties] Properties to set
     */
    function GraphSyncQuery(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncQuery streamId.
     * @member {Uint8Array} streamId
     * @memberof GraphSync.GraphSyncQuery
     * @instance
     */
    GraphSyncQuery.prototype.streamId = $util.newBuffer([]);

    /**
     * GraphSyncQuery origin.
     * @member {Uint8Array} origin
     * @memberof GraphSync.GraphSyncQuery
     * @instance
     */
    GraphSyncQuery.prototype.origin = $util.newBuffer([]);

    /**
     * GraphSyncQuery syncPoint.
     * @member {number|Long} syncPoint
     * @memberof GraphSync.GraphSyncQuery
     * @instance
     */
    GraphSyncQuery.prototype.syncPoint = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * GraphSyncQuery maxCount.
     * @member {number} maxCount
     * @memberof GraphSync.GraphSyncQuery
     * @instance
     */
    GraphSyncQuery.prototype.maxCount = 0;

    /**
     * Creates a new GraphSyncQuery instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {GraphSync.IGraphSyncQuery=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncQuery} GraphSyncQuery instance
     */
    GraphSyncQuery.create = function create(properties) {
      return new GraphSyncQuery(properties);
    };

    /**
     * Encodes the specified GraphSyncQuery message. Does not implicitly {@link GraphSync.GraphSyncQuery.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {GraphSync.IGraphSyncQuery} message GraphSyncQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncQuery.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.streamId != null && Object.hasOwnProperty.call(message, "streamId"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.streamId);
      if (message.origin != null && Object.hasOwnProperty.call(message, "origin"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.origin);
      if (message.syncPoint != null && Object.hasOwnProperty.call(message, "syncPoint"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.syncPoint);
      if (message.maxCount != null && Object.hasOwnProperty.call(message, "maxCount"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.maxCount);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncQuery.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {GraphSync.IGraphSyncQuery} message GraphSyncQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncQuery.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncQuery message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncQuery} GraphSyncQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncQuery.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncQuery();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.streamId = reader.bytes();
            break;
          }
          case 2: {
            message.origin = reader.bytes();
            break;
          }
          case 3: {
            message.syncPoint = reader.int64();
            break;
          }
          case 4: {
            message.maxCount = reader.int32();
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
     * Decodes a GraphSyncQuery message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncQuery} GraphSyncQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncQuery.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncQuery message.
     * @function verify
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncQuery.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.streamId != null && message.hasOwnProperty("streamId"))
        if (
          !(
            (message.streamId && typeof message.streamId.length === "number") ||
            $util.isString(message.streamId)
          )
        )
          return "streamId: buffer expected";
      if (message.origin != null && message.hasOwnProperty("origin"))
        if (
          !(
            (message.origin && typeof message.origin.length === "number") ||
            $util.isString(message.origin)
          )
        )
          return "origin: buffer expected";
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (
          !$util.isInteger(message.syncPoint) &&
          !(
            message.syncPoint &&
            $util.isInteger(message.syncPoint.low) &&
            $util.isInteger(message.syncPoint.high)
          )
        )
          return "syncPoint: integer|Long expected";
      if (message.maxCount != null && message.hasOwnProperty("maxCount"))
        if (!$util.isInteger(message.maxCount)) return "maxCount: integer expected";
      return null;
    };

    /**
     * Creates a GraphSyncQuery message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncQuery} GraphSyncQuery
     */
    GraphSyncQuery.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncQuery) return object;
      let message = new $root.GraphSync.GraphSyncQuery();
      if (object.streamId != null)
        if (typeof object.streamId === "string")
          $util.base64.decode(
            object.streamId,
            (message.streamId = $util.newBuffer($util.base64.length(object.streamId))),
            0,
          );
        else if (object.streamId.length >= 0) message.streamId = object.streamId;
      if (object.origin != null)
        if (typeof object.origin === "string")
          $util.base64.decode(
            object.origin,
            (message.origin = $util.newBuffer($util.base64.length(object.origin))),
            0,
          );
        else if (object.origin.length >= 0) message.origin = object.origin;
      if (object.syncPoint != null)
        if ($util.Long)
          (message.syncPoint = $util.Long.fromValue(object.syncPoint)).unsigned = false;
        else if (typeof object.syncPoint === "string")
          message.syncPoint = parseInt(object.syncPoint, 10);
        else if (typeof object.syncPoint === "number") message.syncPoint = object.syncPoint;
        else if (typeof object.syncPoint === "object")
          message.syncPoint = new $util.LongBits(
            object.syncPoint.low >>> 0,
            object.syncPoint.high >>> 0,
          ).toNumber();
      if (object.maxCount != null) message.maxCount = object.maxCount | 0;
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncQuery message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {GraphSync.GraphSyncQuery} message GraphSyncQuery
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncQuery.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        if (options.bytes === String) object.streamId = "";
        else {
          object.streamId = [];
          if (options.bytes !== Array) object.streamId = $util.newBuffer(object.streamId);
        }
        if (options.bytes === String) object.origin = "";
        else {
          object.origin = [];
          if (options.bytes !== Array) object.origin = $util.newBuffer(object.origin);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.syncPoint =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.syncPoint = options.longs === String ? "0" : 0;
        object.maxCount = 0;
      }
      if (message.streamId != null && message.hasOwnProperty("streamId"))
        object.streamId =
          options.bytes === String
            ? $util.base64.encode(message.streamId, 0, message.streamId.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.streamId)
              : message.streamId;
      if (message.origin != null && message.hasOwnProperty("origin"))
        object.origin =
          options.bytes === String
            ? $util.base64.encode(message.origin, 0, message.origin.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.origin)
              : message.origin;
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (typeof message.syncPoint === "number")
          object.syncPoint =
            options.longs === String ? String(message.syncPoint) : message.syncPoint;
        else
          object.syncPoint =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.syncPoint)
              : options.longs === Number
                ? new $util.LongBits(
                    message.syncPoint.low >>> 0,
                    message.syncPoint.high >>> 0,
                  ).toNumber()
                : message.syncPoint;
      if (message.maxCount != null && message.hasOwnProperty("maxCount"))
        object.maxCount = message.maxCount;
      return object;
    };

    /**
     * Converts this GraphSyncQuery to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncQuery
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncQuery.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncQuery
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncQuery
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncQuery.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncQuery";
    };

    return GraphSyncQuery;
  })();

  GraphSync.GraphSyncResult = (function () {
    /**
     * Properties of a GraphSyncResult.
     * @memberof GraphSync
     * @interface IGraphSyncResult
     * @property {Uint8Array|null} [streamId] GraphSyncResult streamId
     * @property {number|Long|null} [syncPoint] GraphSyncResult syncPoint
     * @property {Array.<GraphSync.IGraphSyncDataPlus>|null} [data] GraphSyncResult data
     * @property {boolean|null} [hasMore] GraphSyncResult hasMore
     */

    /**
     * Constructs a new GraphSyncResult.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncResult.
     * @implements IGraphSyncResult
     * @constructor
     * @param {GraphSync.IGraphSyncResult=} [properties] Properties to set
     */
    function GraphSyncResult(properties) {
      this.data = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncResult streamId.
     * @member {Uint8Array} streamId
     * @memberof GraphSync.GraphSyncResult
     * @instance
     */
    GraphSyncResult.prototype.streamId = $util.newBuffer([]);

    /**
     * GraphSyncResult syncPoint.
     * @member {number|Long} syncPoint
     * @memberof GraphSync.GraphSyncResult
     * @instance
     */
    GraphSyncResult.prototype.syncPoint = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * GraphSyncResult data.
     * @member {Array.<GraphSync.IGraphSyncDataPlus>} data
     * @memberof GraphSync.GraphSyncResult
     * @instance
     */
    GraphSyncResult.prototype.data = $util.emptyArray;

    /**
     * GraphSyncResult hasMore.
     * @member {boolean} hasMore
     * @memberof GraphSync.GraphSyncResult
     * @instance
     */
    GraphSyncResult.prototype.hasMore = false;

    /**
     * Creates a new GraphSyncResult instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {GraphSync.IGraphSyncResult=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncResult} GraphSyncResult instance
     */
    GraphSyncResult.create = function create(properties) {
      return new GraphSyncResult(properties);
    };

    /**
     * Encodes the specified GraphSyncResult message. Does not implicitly {@link GraphSync.GraphSyncResult.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {GraphSync.IGraphSyncResult} message GraphSyncResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncResult.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.streamId != null && Object.hasOwnProperty.call(message, "streamId"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.streamId);
      if (message.syncPoint != null && Object.hasOwnProperty.call(message, "syncPoint"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.syncPoint);
      if (message.data != null && message.data.length)
        for (let i = 0; i < message.data.length; ++i)
          $root.GraphSync.GraphSyncDataPlus.encode(
            message.data[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      if (message.hasMore != null && Object.hasOwnProperty.call(message, "hasMore"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).bool(message.hasMore);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncResult.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {GraphSync.IGraphSyncResult} message GraphSyncResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncResult.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncResult message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncResult} GraphSyncResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncResult.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncResult();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 2: {
            message.streamId = reader.bytes();
            break;
          }
          case 3: {
            message.syncPoint = reader.int64();
            break;
          }
          case 4: {
            if (!(message.data && message.data.length)) message.data = [];
            message.data.push($root.GraphSync.GraphSyncDataPlus.decode(reader, reader.uint32()));
            break;
          }
          case 5: {
            message.hasMore = reader.bool();
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
     * Decodes a GraphSyncResult message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncResult} GraphSyncResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncResult.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncResult message.
     * @function verify
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncResult.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.streamId != null && message.hasOwnProperty("streamId"))
        if (
          !(
            (message.streamId && typeof message.streamId.length === "number") ||
            $util.isString(message.streamId)
          )
        )
          return "streamId: buffer expected";
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (
          !$util.isInteger(message.syncPoint) &&
          !(
            message.syncPoint &&
            $util.isInteger(message.syncPoint.low) &&
            $util.isInteger(message.syncPoint.high)
          )
        )
          return "syncPoint: integer|Long expected";
      if (message.data != null && message.hasOwnProperty("data")) {
        if (!Array.isArray(message.data)) return "data: array expected";
        for (let i = 0; i < message.data.length; ++i) {
          let error = $root.GraphSync.GraphSyncDataPlus.verify(message.data[i]);
          if (error) return "data." + error;
        }
      }
      if (message.hasMore != null && message.hasOwnProperty("hasMore"))
        if (typeof message.hasMore !== "boolean") return "hasMore: boolean expected";
      return null;
    };

    /**
     * Creates a GraphSyncResult message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncResult} GraphSyncResult
     */
    GraphSyncResult.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncResult) return object;
      let message = new $root.GraphSync.GraphSyncResult();
      if (object.streamId != null)
        if (typeof object.streamId === "string")
          $util.base64.decode(
            object.streamId,
            (message.streamId = $util.newBuffer($util.base64.length(object.streamId))),
            0,
          );
        else if (object.streamId.length >= 0) message.streamId = object.streamId;
      if (object.syncPoint != null)
        if ($util.Long)
          (message.syncPoint = $util.Long.fromValue(object.syncPoint)).unsigned = false;
        else if (typeof object.syncPoint === "string")
          message.syncPoint = parseInt(object.syncPoint, 10);
        else if (typeof object.syncPoint === "number") message.syncPoint = object.syncPoint;
        else if (typeof object.syncPoint === "object")
          message.syncPoint = new $util.LongBits(
            object.syncPoint.low >>> 0,
            object.syncPoint.high >>> 0,
          ).toNumber();
      if (object.data) {
        if (!Array.isArray(object.data))
          throw TypeError(".GraphSync.GraphSyncResult.data: array expected");
        message.data = [];
        for (let i = 0; i < object.data.length; ++i) {
          if (typeof object.data[i] !== "object")
            throw TypeError(".GraphSync.GraphSyncResult.data: object expected");
          message.data[i] = $root.GraphSync.GraphSyncDataPlus.fromObject(object.data[i]);
        }
      }
      if (object.hasMore != null) message.hasMore = Boolean(object.hasMore);
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncResult message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {GraphSync.GraphSyncResult} message GraphSyncResult
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncResult.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.data = [];
      if (options.defaults) {
        if (options.bytes === String) object.streamId = "";
        else {
          object.streamId = [];
          if (options.bytes !== Array) object.streamId = $util.newBuffer(object.streamId);
        }
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.syncPoint =
            options.longs === String
              ? long.toString()
              : options.longs === Number
                ? long.toNumber()
                : long;
        } else object.syncPoint = options.longs === String ? "0" : 0;
        object.hasMore = false;
      }
      if (message.streamId != null && message.hasOwnProperty("streamId"))
        object.streamId =
          options.bytes === String
            ? $util.base64.encode(message.streamId, 0, message.streamId.length)
            : options.bytes === Array
              ? Array.prototype.slice.call(message.streamId)
              : message.streamId;
      if (message.syncPoint != null && message.hasOwnProperty("syncPoint"))
        if (typeof message.syncPoint === "number")
          object.syncPoint =
            options.longs === String ? String(message.syncPoint) : message.syncPoint;
        else
          object.syncPoint =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.syncPoint)
              : options.longs === Number
                ? new $util.LongBits(
                    message.syncPoint.low >>> 0,
                    message.syncPoint.high >>> 0,
                  ).toNumber()
                : message.syncPoint;
      if (message.data && message.data.length) {
        object.data = [];
        for (let j = 0; j < message.data.length; ++j)
          object.data[j] = $root.GraphSync.GraphSyncDataPlus.toObject(message.data[j], options);
      }
      if (message.hasMore != null && message.hasOwnProperty("hasMore"))
        object.hasMore = message.hasMore;
      return object;
    };

    /**
     * Converts this GraphSyncResult to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncResult
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncResult.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncResult
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncResult
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncResult.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncResult";
    };

    return GraphSyncResult;
  })();

  GraphSync.GraphSyncMultiQuery = (function () {
    /**
     * Properties of a GraphSyncMultiQuery.
     * @memberof GraphSync
     * @interface IGraphSyncMultiQuery
     * @property {Array.<GraphSync.IGraphSyncQuery>|null} [queries] GraphSyncMultiQuery queries
     */

    /**
     * Constructs a new GraphSyncMultiQuery.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncMultiQuery.
     * @implements IGraphSyncMultiQuery
     * @constructor
     * @param {GraphSync.IGraphSyncMultiQuery=} [properties] Properties to set
     */
    function GraphSyncMultiQuery(properties) {
      this.queries = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncMultiQuery queries.
     * @member {Array.<GraphSync.IGraphSyncQuery>} queries
     * @memberof GraphSync.GraphSyncMultiQuery
     * @instance
     */
    GraphSyncMultiQuery.prototype.queries = $util.emptyArray;

    /**
     * Creates a new GraphSyncMultiQuery instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {GraphSync.IGraphSyncMultiQuery=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncMultiQuery} GraphSyncMultiQuery instance
     */
    GraphSyncMultiQuery.create = function create(properties) {
      return new GraphSyncMultiQuery(properties);
    };

    /**
     * Encodes the specified GraphSyncMultiQuery message. Does not implicitly {@link GraphSync.GraphSyncMultiQuery.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {GraphSync.IGraphSyncMultiQuery} message GraphSyncMultiQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncMultiQuery.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.queries != null && message.queries.length)
        for (let i = 0; i < message.queries.length; ++i)
          $root.GraphSync.GraphSyncQuery.encode(
            message.queries[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GraphSyncMultiQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncMultiQuery.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {GraphSync.IGraphSyncMultiQuery} message GraphSyncMultiQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncMultiQuery.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncMultiQuery message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncMultiQuery} GraphSyncMultiQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncMultiQuery.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncMultiQuery();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.queries && message.queries.length)) message.queries = [];
            message.queries.push($root.GraphSync.GraphSyncQuery.decode(reader, reader.uint32()));
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
     * Decodes a GraphSyncMultiQuery message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncMultiQuery} GraphSyncMultiQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncMultiQuery.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncMultiQuery message.
     * @function verify
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncMultiQuery.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.queries != null && message.hasOwnProperty("queries")) {
        if (!Array.isArray(message.queries)) return "queries: array expected";
        for (let i = 0; i < message.queries.length; ++i) {
          let error = $root.GraphSync.GraphSyncQuery.verify(message.queries[i]);
          if (error) return "queries." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GraphSyncMultiQuery message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncMultiQuery} GraphSyncMultiQuery
     */
    GraphSyncMultiQuery.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncMultiQuery) return object;
      let message = new $root.GraphSync.GraphSyncMultiQuery();
      if (object.queries) {
        if (!Array.isArray(object.queries))
          throw TypeError(".GraphSync.GraphSyncMultiQuery.queries: array expected");
        message.queries = [];
        for (let i = 0; i < object.queries.length; ++i) {
          if (typeof object.queries[i] !== "object")
            throw TypeError(".GraphSync.GraphSyncMultiQuery.queries: object expected");
          message.queries[i] = $root.GraphSync.GraphSyncQuery.fromObject(object.queries[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncMultiQuery message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {GraphSync.GraphSyncMultiQuery} message GraphSyncMultiQuery
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncMultiQuery.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.queries = [];
      if (message.queries && message.queries.length) {
        object.queries = [];
        for (let j = 0; j < message.queries.length; ++j)
          object.queries[j] = $root.GraphSync.GraphSyncQuery.toObject(message.queries[j], options);
      }
      return object;
    };

    /**
     * Converts this GraphSyncMultiQuery to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncMultiQuery
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncMultiQuery.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncMultiQuery
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncMultiQuery
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncMultiQuery.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncMultiQuery";
    };

    return GraphSyncMultiQuery;
  })();

  GraphSync.GraphSyncMultiResult = (function () {
    /**
     * Properties of a GraphSyncMultiResult.
     * @memberof GraphSync
     * @interface IGraphSyncMultiResult
     * @property {Array.<GraphSync.IGraphSyncResult>|null} [results] GraphSyncMultiResult results
     */

    /**
     * Constructs a new GraphSyncMultiResult.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncMultiResult.
     * @implements IGraphSyncMultiResult
     * @constructor
     * @param {GraphSync.IGraphSyncMultiResult=} [properties] Properties to set
     */
    function GraphSyncMultiResult(properties) {
      this.results = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncMultiResult results.
     * @member {Array.<GraphSync.IGraphSyncResult>} results
     * @memberof GraphSync.GraphSyncMultiResult
     * @instance
     */
    GraphSyncMultiResult.prototype.results = $util.emptyArray;

    /**
     * Creates a new GraphSyncMultiResult instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {GraphSync.IGraphSyncMultiResult=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncMultiResult} GraphSyncMultiResult instance
     */
    GraphSyncMultiResult.create = function create(properties) {
      return new GraphSyncMultiResult(properties);
    };

    /**
     * Encodes the specified GraphSyncMultiResult message. Does not implicitly {@link GraphSync.GraphSyncMultiResult.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {GraphSync.IGraphSyncMultiResult} message GraphSyncMultiResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncMultiResult.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.results != null && message.results.length)
        for (let i = 0; i < message.results.length; ++i)
          $root.GraphSync.GraphSyncResult.encode(
            message.results[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GraphSyncMultiResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncMultiResult.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {GraphSync.IGraphSyncMultiResult} message GraphSyncMultiResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncMultiResult.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncMultiResult message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncMultiResult} GraphSyncMultiResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncMultiResult.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncMultiResult();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.results && message.results.length)) message.results = [];
            message.results.push($root.GraphSync.GraphSyncResult.decode(reader, reader.uint32()));
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
     * Decodes a GraphSyncMultiResult message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncMultiResult} GraphSyncMultiResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncMultiResult.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncMultiResult message.
     * @function verify
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncMultiResult.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.results != null && message.hasOwnProperty("results")) {
        if (!Array.isArray(message.results)) return "results: array expected";
        for (let i = 0; i < message.results.length; ++i) {
          let error = $root.GraphSync.GraphSyncResult.verify(message.results[i]);
          if (error) return "results." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GraphSyncMultiResult message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncMultiResult} GraphSyncMultiResult
     */
    GraphSyncMultiResult.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncMultiResult) return object;
      let message = new $root.GraphSync.GraphSyncMultiResult();
      if (object.results) {
        if (!Array.isArray(object.results))
          throw TypeError(".GraphSync.GraphSyncMultiResult.results: array expected");
        message.results = [];
        for (let i = 0; i < object.results.length; ++i) {
          if (typeof object.results[i] !== "object")
            throw TypeError(".GraphSync.GraphSyncMultiResult.results: object expected");
          message.results[i] = $root.GraphSync.GraphSyncResult.fromObject(object.results[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncMultiResult message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {GraphSync.GraphSyncMultiResult} message GraphSyncMultiResult
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncMultiResult.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.results = [];
      if (message.results && message.results.length) {
        object.results = [];
        for (let j = 0; j < message.results.length; ++j)
          object.results[j] = $root.GraphSync.GraphSyncResult.toObject(message.results[j], options);
      }
      return object;
    };

    /**
     * Converts this GraphSyncMultiResult to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncMultiResult
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncMultiResult.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncMultiResult
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncMultiResult
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncMultiResult.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncMultiResult";
    };

    return GraphSyncMultiResult;
  })();

  GraphSync.GraphSyncAddDataRequest = (function () {
    /**
     * Properties of a GraphSyncAddDataRequest.
     * @memberof GraphSync
     * @interface IGraphSyncAddDataRequest
     * @property {GraphSync.IGraphSyncRef|null} [origin] GraphSyncAddDataRequest origin
     * @property {Array.<GraphSync.IGraphSyncData>|null} [data] GraphSyncAddDataRequest data
     */

    /**
     * Constructs a new GraphSyncAddDataRequest.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncAddDataRequest.
     * @implements IGraphSyncAddDataRequest
     * @constructor
     * @param {GraphSync.IGraphSyncAddDataRequest=} [properties] Properties to set
     */
    function GraphSyncAddDataRequest(properties) {
      this.data = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncAddDataRequest origin.
     * @member {GraphSync.IGraphSyncRef|null|undefined} origin
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @instance
     */
    GraphSyncAddDataRequest.prototype.origin = null;

    /**
     * GraphSyncAddDataRequest data.
     * @member {Array.<GraphSync.IGraphSyncData>} data
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @instance
     */
    GraphSyncAddDataRequest.prototype.data = $util.emptyArray;

    /**
     * Creates a new GraphSyncAddDataRequest instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {GraphSync.IGraphSyncAddDataRequest=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncAddDataRequest} GraphSyncAddDataRequest instance
     */
    GraphSyncAddDataRequest.create = function create(properties) {
      return new GraphSyncAddDataRequest(properties);
    };

    /**
     * Encodes the specified GraphSyncAddDataRequest message. Does not implicitly {@link GraphSync.GraphSyncAddDataRequest.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {GraphSync.IGraphSyncAddDataRequest} message GraphSyncAddDataRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncAddDataRequest.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.origin != null && Object.hasOwnProperty.call(message, "origin"))
        $root.GraphSync.GraphSyncRef.encode(
          message.origin,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (message.data != null && message.data.length)
        for (let i = 0; i < message.data.length; ++i)
          $root.GraphSync.GraphSyncData.encode(
            message.data[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GraphSyncAddDataRequest message, length delimited. Does not implicitly {@link GraphSync.GraphSyncAddDataRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {GraphSync.IGraphSyncAddDataRequest} message GraphSyncAddDataRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncAddDataRequest.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncAddDataRequest message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncAddDataRequest} GraphSyncAddDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncAddDataRequest.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncAddDataRequest();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.origin = $root.GraphSync.GraphSyncRef.decode(reader, reader.uint32());
            break;
          }
          case 2: {
            if (!(message.data && message.data.length)) message.data = [];
            message.data.push($root.GraphSync.GraphSyncData.decode(reader, reader.uint32()));
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
     * Decodes a GraphSyncAddDataRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncAddDataRequest} GraphSyncAddDataRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncAddDataRequest.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncAddDataRequest message.
     * @function verify
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncAddDataRequest.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.origin != null && message.hasOwnProperty("origin")) {
        let error = $root.GraphSync.GraphSyncRef.verify(message.origin);
        if (error) return "origin." + error;
      }
      if (message.data != null && message.hasOwnProperty("data")) {
        if (!Array.isArray(message.data)) return "data: array expected";
        for (let i = 0; i < message.data.length; ++i) {
          let error = $root.GraphSync.GraphSyncData.verify(message.data[i]);
          if (error) return "data." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GraphSyncAddDataRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncAddDataRequest} GraphSyncAddDataRequest
     */
    GraphSyncAddDataRequest.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncAddDataRequest) return object;
      let message = new $root.GraphSync.GraphSyncAddDataRequest();
      if (object.origin != null) {
        if (typeof object.origin !== "object")
          throw TypeError(".GraphSync.GraphSyncAddDataRequest.origin: object expected");
        message.origin = $root.GraphSync.GraphSyncRef.fromObject(object.origin);
      }
      if (object.data) {
        if (!Array.isArray(object.data))
          throw TypeError(".GraphSync.GraphSyncAddDataRequest.data: array expected");
        message.data = [];
        for (let i = 0; i < object.data.length; ++i) {
          if (typeof object.data[i] !== "object")
            throw TypeError(".GraphSync.GraphSyncAddDataRequest.data: object expected");
          message.data[i] = $root.GraphSync.GraphSyncData.fromObject(object.data[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncAddDataRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {GraphSync.GraphSyncAddDataRequest} message GraphSyncAddDataRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncAddDataRequest.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.data = [];
      if (options.defaults) object.origin = null;
      if (message.origin != null && message.hasOwnProperty("origin"))
        object.origin = $root.GraphSync.GraphSyncRef.toObject(message.origin, options);
      if (message.data && message.data.length) {
        object.data = [];
        for (let j = 0; j < message.data.length; ++j)
          object.data[j] = $root.GraphSync.GraphSyncData.toObject(message.data[j], options);
      }
      return object;
    };

    /**
     * Converts this GraphSyncAddDataRequest to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncAddDataRequest.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncAddDataRequest
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncAddDataRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncAddDataRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncAddDataRequest";
    };

    return GraphSyncAddDataRequest;
  })();

  GraphSync.GraphSyncLeafsQuery = (function () {
    /**
     * Properties of a GraphSyncLeafsQuery.
     * @memberof GraphSync
     * @interface IGraphSyncLeafsQuery
     * @property {Array.<Uint8Array>|null} [vertices] GraphSyncLeafsQuery vertices
     */

    /**
     * Constructs a new GraphSyncLeafsQuery.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncLeafsQuery.
     * @implements IGraphSyncLeafsQuery
     * @constructor
     * @param {GraphSync.IGraphSyncLeafsQuery=} [properties] Properties to set
     */
    function GraphSyncLeafsQuery(properties) {
      this.vertices = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncLeafsQuery vertices.
     * @member {Array.<Uint8Array>} vertices
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @instance
     */
    GraphSyncLeafsQuery.prototype.vertices = $util.emptyArray;

    /**
     * Creates a new GraphSyncLeafsQuery instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {GraphSync.IGraphSyncLeafsQuery=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncLeafsQuery} GraphSyncLeafsQuery instance
     */
    GraphSyncLeafsQuery.create = function create(properties) {
      return new GraphSyncLeafsQuery(properties);
    };

    /**
     * Encodes the specified GraphSyncLeafsQuery message. Does not implicitly {@link GraphSync.GraphSyncLeafsQuery.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {GraphSync.IGraphSyncLeafsQuery} message GraphSyncLeafsQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncLeafsQuery.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.vertices != null && message.vertices.length)
        for (let i = 0; i < message.vertices.length; ++i)
          writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.vertices[i]);
      return writer;
    };

    /**
     * Encodes the specified GraphSyncLeafsQuery message, length delimited. Does not implicitly {@link GraphSync.GraphSyncLeafsQuery.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {GraphSync.IGraphSyncLeafsQuery} message GraphSyncLeafsQuery message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncLeafsQuery.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncLeafsQuery message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncLeafsQuery} GraphSyncLeafsQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncLeafsQuery.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncLeafsQuery();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 2: {
            if (!(message.vertices && message.vertices.length)) message.vertices = [];
            message.vertices.push(reader.bytes());
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
     * Decodes a GraphSyncLeafsQuery message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncLeafsQuery} GraphSyncLeafsQuery
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncLeafsQuery.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncLeafsQuery message.
     * @function verify
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncLeafsQuery.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.vertices != null && message.hasOwnProperty("vertices")) {
        if (!Array.isArray(message.vertices)) return "vertices: array expected";
        for (let i = 0; i < message.vertices.length; ++i)
          if (
            !(
              (message.vertices[i] && typeof message.vertices[i].length === "number") ||
              $util.isString(message.vertices[i])
            )
          )
            return "vertices: buffer[] expected";
      }
      return null;
    };

    /**
     * Creates a GraphSyncLeafsQuery message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncLeafsQuery} GraphSyncLeafsQuery
     */
    GraphSyncLeafsQuery.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncLeafsQuery) return object;
      let message = new $root.GraphSync.GraphSyncLeafsQuery();
      if (object.vertices) {
        if (!Array.isArray(object.vertices))
          throw TypeError(".GraphSync.GraphSyncLeafsQuery.vertices: array expected");
        message.vertices = [];
        for (let i = 0; i < object.vertices.length; ++i)
          if (typeof object.vertices[i] === "string")
            $util.base64.decode(
              object.vertices[i],
              (message.vertices[i] = $util.newBuffer($util.base64.length(object.vertices[i]))),
              0,
            );
          else if (object.vertices[i].length >= 0) message.vertices[i] = object.vertices[i];
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncLeafsQuery message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {GraphSync.GraphSyncLeafsQuery} message GraphSyncLeafsQuery
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncLeafsQuery.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.vertices = [];
      if (message.vertices && message.vertices.length) {
        object.vertices = [];
        for (let j = 0; j < message.vertices.length; ++j)
          object.vertices[j] =
            options.bytes === String
              ? $util.base64.encode(message.vertices[j], 0, message.vertices[j].length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.vertices[j])
                : message.vertices[j];
      }
      return object;
    };

    /**
     * Converts this GraphSyncLeafsQuery to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncLeafsQuery.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncLeafsQuery
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncLeafsQuery
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncLeafsQuery.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncLeafsQuery";
    };

    return GraphSyncLeafsQuery;
  })();

  GraphSync.GraphSyncRefsResult = (function () {
    /**
     * Properties of a GraphSyncRefsResult.
     * @memberof GraphSync
     * @interface IGraphSyncRefsResult
     * @property {Array.<GraphSync.IGraphSyncRef>|null} [refs] GraphSyncRefsResult refs
     */

    /**
     * Constructs a new GraphSyncRefsResult.
     * @memberof GraphSync
     * @classdesc Represents a GraphSyncRefsResult.
     * @implements IGraphSyncRefsResult
     * @constructor
     * @param {GraphSync.IGraphSyncRefsResult=} [properties] Properties to set
     */
    function GraphSyncRefsResult(properties) {
      this.refs = [];
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphSyncRefsResult refs.
     * @member {Array.<GraphSync.IGraphSyncRef>} refs
     * @memberof GraphSync.GraphSyncRefsResult
     * @instance
     */
    GraphSyncRefsResult.prototype.refs = $util.emptyArray;

    /**
     * Creates a new GraphSyncRefsResult instance using the specified properties.
     * @function create
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {GraphSync.IGraphSyncRefsResult=} [properties] Properties to set
     * @returns {GraphSync.GraphSyncRefsResult} GraphSyncRefsResult instance
     */
    GraphSyncRefsResult.create = function create(properties) {
      return new GraphSyncRefsResult(properties);
    };

    /**
     * Encodes the specified GraphSyncRefsResult message. Does not implicitly {@link GraphSync.GraphSyncRefsResult.verify|verify} messages.
     * @function encode
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {GraphSync.IGraphSyncRefsResult} message GraphSyncRefsResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncRefsResult.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.refs != null && message.refs.length)
        for (let i = 0; i < message.refs.length; ++i)
          $root.GraphSync.GraphSyncRef.encode(
            message.refs[i],
            writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GraphSyncRefsResult message, length delimited. Does not implicitly {@link GraphSync.GraphSyncRefsResult.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {GraphSync.IGraphSyncRefsResult} message GraphSyncRefsResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphSyncRefsResult.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphSyncRefsResult message from the specified reader or buffer.
     * @function decode
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphSync.GraphSyncRefsResult} GraphSyncRefsResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncRefsResult.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.GraphSync.GraphSyncRefsResult();
      while (reader.pos < end) {
        let tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.refs && message.refs.length)) message.refs = [];
            message.refs.push($root.GraphSync.GraphSyncRef.decode(reader, reader.uint32()));
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
     * Decodes a GraphSyncRefsResult message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphSync.GraphSyncRefsResult} GraphSyncRefsResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphSyncRefsResult.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphSyncRefsResult message.
     * @function verify
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphSyncRefsResult.verify = function verify(message) {
      if (typeof message !== "object" || message === null) return "object expected";
      if (message.refs != null && message.hasOwnProperty("refs")) {
        if (!Array.isArray(message.refs)) return "refs: array expected";
        for (let i = 0; i < message.refs.length; ++i) {
          let error = $root.GraphSync.GraphSyncRef.verify(message.refs[i]);
          if (error) return "refs." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GraphSyncRefsResult message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphSync.GraphSyncRefsResult} GraphSyncRefsResult
     */
    GraphSyncRefsResult.fromObject = function fromObject(object) {
      if (object instanceof $root.GraphSync.GraphSyncRefsResult) return object;
      let message = new $root.GraphSync.GraphSyncRefsResult();
      if (object.refs) {
        if (!Array.isArray(object.refs))
          throw TypeError(".GraphSync.GraphSyncRefsResult.refs: array expected");
        message.refs = [];
        for (let i = 0; i < object.refs.length; ++i) {
          if (typeof object.refs[i] !== "object")
            throw TypeError(".GraphSync.GraphSyncRefsResult.refs: object expected");
          message.refs[i] = $root.GraphSync.GraphSyncRef.fromObject(object.refs[i]);
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a GraphSyncRefsResult message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {GraphSync.GraphSyncRefsResult} message GraphSyncRefsResult
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphSyncRefsResult.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.arrays || options.defaults) object.refs = [];
      if (message.refs && message.refs.length) {
        object.refs = [];
        for (let j = 0; j < message.refs.length; ++j)
          object.refs[j] = $root.GraphSync.GraphSyncRef.toObject(message.refs[j], options);
      }
      return object;
    };

    /**
     * Converts this GraphSyncRefsResult to JSON.
     * @function toJSON
     * @memberof GraphSync.GraphSyncRefsResult
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphSyncRefsResult.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GraphSyncRefsResult
     * @function getTypeUrl
     * @memberof GraphSync.GraphSyncRefsResult
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GraphSyncRefsResult.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/GraphSync.GraphSyncRefsResult";
    };

    return GraphSyncRefsResult;
  })();

  return GraphSync;
})());

export { $root as default };
