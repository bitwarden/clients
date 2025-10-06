// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/* eslint-disable no-useless-escape */
import * as path from "path";

import { Buffer as BufferLib } from "buffer/";
import { Observable, of, switchMap } from "rxjs";
import { getHostname, parse } from "tldts";
import { Merge } from "type-fest";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "../abstractions/i18n.service";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeURL = typeof self === "undefined" ? require("url") : null;

declare global {
  /* eslint-disable-next-line no-var */
  var bitwardenContainerService: BitwardenContainerService;
}

interface BitwardenContainerService {
  getKeyService: () => KeyService;
  getEncryptService: () => EncryptService;
}

export class Utils {
  static inited = false;
  static isNode = false;
  static isBrowser = true;
  static isMobileBrowser = false;
  static isAppleMobileBrowser = false;
  static global: typeof global = null;
  // Transpiled version of /\p{Emoji_Presentation}/gu using https://mothereff.in/regexpu. Used for compatability in older browsers.
  static regexpEmojiPresentation =
    /(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])/g;
  static readonly validHosts: string[] = ["localhost"];
  static readonly originalMinimumPasswordLength = 8;
  static readonly minimumPasswordLength = 12;
  static readonly DomainMatchBlacklist = new Map<string, Set<string>>([
    ["google.com", new Set(["script.google.com"])],
  ]);

  static init() {
    if (Utils.inited) {
      return;
    }

    Utils.inited = true;
    Utils.isNode =
      typeof process !== "undefined" &&
      (process as any).release != null &&
      (process as any).release.name === "node";
    Utils.isBrowser = typeof window !== "undefined";

    Utils.isMobileBrowser = Utils.isBrowser && this.isMobile(window);
    Utils.isAppleMobileBrowser = Utils.isBrowser && this.isAppleMobile(window);

    if (Utils.isNode) {
      Utils.global = global;
    } else if (Utils.isBrowser) {
      Utils.global = window;
    } else {
      // If it's not browser or node then it must be a service worker
      Utils.global = self;
    }
  }

  static fromB64ToArray(str: string): Uint8Array {
    if (str == null) {
      return null;
    }

    if (Utils.isNode) {
      return new Uint8Array(Buffer.from(str, "base64"));
    } else {
      const binaryString = Utils.global.atob(str);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }

  static fromUrlB64ToArray(str: string): Uint8Array {
    return Utils.fromB64ToArray(Utils.fromUrlB64ToB64(str));
  }

  static fromHexToArray(str: string): Uint8Array {
    if (Utils.isNode) {
      return new Uint8Array(Buffer.from(str, "hex"));
    } else {
      const bytes = new Uint8Array(str.length / 2);
      for (let i = 0; i < str.length; i += 2) {
        bytes[i / 2] = parseInt(str.substr(i, 2), 16);
      }
      return bytes;
    }
  }

  static fromUtf8ToArray(str: string): Uint8Array {
    if (Utils.isNode) {
      return new Uint8Array(Buffer.from(str, "utf8"));
    } else {
      const strUtf8 = unescape(encodeURIComponent(str));
      const arr = new Uint8Array(strUtf8.length);
      for (let i = 0; i < strUtf8.length; i++) {
        arr[i] = strUtf8.charCodeAt(i);
      }
      return arr;
    }
  }

  static fromByteStringToArray(str: string): Uint8Array {
    if (str == null) {
      return null;
    }
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }

  /**
   * Convert binary data into a Base64 string.
   *
   * Overloads are provided for two categories of input:
   *
   * 1. ArrayBuffer
   *    - A raw, fixed-length chunk of memory (no element semantics).
   *    - Example: `const buf = new ArrayBuffer(16);`
   *
   * 2. ArrayBufferView
   *    - A *view* onto an existing buffer that gives the bytes meaning.
   *    - Examples: Uint8Array, Int32Array, DataView, etc.
   *    - Views can expose only a *window* of the underlying buffer via
   *      `byteOffset` and `byteLength`.
   *      Example:
   *      ```ts
   *      const buf = new ArrayBuffer(8);
   *      const full = new Uint8Array(buf);       // sees all 8 bytes
   *      const half = new Uint8Array(buf, 4, 4); // sees only last 4 bytes
   *      ```
   *
   * Returns:
   * - Base64 string for non-empty inputs,
   * - null if `buffer` is `null` or `undefined`
   * - empty string if `buffer` is empty (0 bytes)
   */
  static fromBufferToB64(buffer: null | undefined): null;
  static fromBufferToB64(buffer: ArrayBuffer): string;
  static fromBufferToB64(buffer: ArrayBufferView): string;
  static fromBufferToB64(buffer: ArrayBuffer | ArrayBufferView | null | undefined): string | null {
    // Handle null / undefined input
    if (buffer == null) {
      return null;
    }

    const bytes: Uint8Array = Utils.normalizeToUint8Array(buffer);

    // Handle empty input
    if (bytes.length === 0) {
      return "";
    }

    if (Utils.isNode) {
      return Buffer.from(bytes).toString("base64");
    } else {
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return Utils.global.btoa(binary);
    }
  }

  /**
   * Normalizes input into a Uint8Array so we always have a uniform,
   * byte-level view of the data. This avoids dealing with differences
   * between ArrayBuffer (raw memory with no indexing) and other typed
   * views (which may have element sizes, offsets, and lengths).
   * @param buffer ArrayBuffer or ArrayBufferView (e.g. Uint8Array, DataView, etc.)
   */
  private static normalizeToUint8Array(buffer: ArrayBuffer | ArrayBufferView): Uint8Array {
    /**
     * 1) Uint8Array: already bytes → use directly.
     * 2) ArrayBuffer: wrap whole buffer.
     * 3) Other ArrayBufferView (e.g., DataView, Int32Array):
     *    wrap the view’s window (byteOffset..byteOffset+byteLength).
     */
    if (buffer instanceof Uint8Array) {
      return buffer;
    } else if (buffer instanceof ArrayBuffer) {
      return new Uint8Array(buffer);
    } else {
      const view = buffer as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
  }

  static fromBufferToUrlB64(buffer: ArrayBuffer): string {
    return Utils.fromB64toUrlB64(Utils.fromBufferToB64(buffer));
  }

  static fromB64toUrlB64(b64Str: string) {
    return b64Str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  static fromBufferToUtf8(buffer: ArrayBuffer): string {
    return BufferLib.from(buffer).toString("utf8");
  }

  static fromBufferToByteString(buffer: ArrayBuffer): string {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
  }

  // ref: https://stackoverflow.com/a/40031979/1090359
  static fromBufferToHex(buffer: ArrayBuffer): string {
    if (Utils.isNode) {
      return Buffer.from(buffer).toString("hex");
    } else {
      const bytes = new Uint8Array(buffer);
      return Array.prototype.map
        .call(bytes, (x: number) => ("00" + x.toString(16)).slice(-2))
        .join("");
    }
  }

  /**
   * Converts a hex string to an ArrayBuffer.
   * Note: this doesn't need any Node specific code as parseInt() / ArrayBuffer / Uint8Array
   * work the same in Node and the browser.
   * @param {string} hexString - A string of hexadecimal characters.
   * @returns {ArrayBuffer} The ArrayBuffer representation of the hex string.
   */
  static hexStringToArrayBuffer(hexString: string): ArrayBuffer {
    // Check if the hexString has an even length, as each hex digit represents half a byte (4 bits),
    // and it takes two hex digits to represent a full byte (8 bits).
    if (hexString.length % 2 !== 0) {
      throw "HexString has to be an even length";
    }

    // Create an ArrayBuffer with a length that is half the length of the hex string,
    // because each pair of hex digits will become a single byte.
    const arrayBuffer = new ArrayBuffer(hexString.length / 2);

    // Create a Uint8Array view on top of the ArrayBuffer (each position represents a byte)
    // as ArrayBuffers cannot be edited directly.
    const uint8Array = new Uint8Array(arrayBuffer);

    // Loop through the bytes
    for (let i = 0; i < uint8Array.length; i++) {
      // Extract two hex characters (1 byte)
      const hexByte = hexString.substr(i * 2, 2);

      // Convert hexByte into a decimal value from base 16. (ex: ff --> 255)
      const byteValue = parseInt(hexByte, 16);

      // Place the byte value into the uint8Array
      uint8Array[i] = byteValue;
    }

    return arrayBuffer;
  }

  static fromUrlB64ToB64(urlB64Str: string): string {
    let output = urlB64Str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw new Error("Illegal base64url string!");
    }

    return output;
  }

  static fromUrlB64ToUtf8(urlB64Str: string): string {
    return Utils.fromB64ToUtf8(Utils.fromUrlB64ToB64(urlB64Str));
  }

  static fromUtf8ToB64(utfStr: string): string {
    if (Utils.isNode) {
      return Buffer.from(utfStr, "utf8").toString("base64");
    } else {
      return BufferLib.from(utfStr, "utf8").toString("base64");
    }
  }

  static fromUtf8ToUrlB64(utfStr: string): string {
    return Utils.fromBufferToUrlB64(Utils.fromUtf8ToArray(utfStr));
  }

  static fromB64ToUtf8(b64Str: string): string {
    if (Utils.isNode) {
      return Buffer.from(b64Str, "base64").toString("utf8");
    } else {
      return BufferLib.from(b64Str, "base64").toString("utf8");
    }
  }

  // ref: http://stackoverflow.com/a/2117523/1090359
  /** @deprecated Use newGuid from @bitwarden/guid instead */
  static newGuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** @deprecated Use guidRegex from @bitwarden/guid instead */
  static guidRegex = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;

  /** @deprecated Use isGuid from @bitwarden/guid instead */
  static isGuid(id: string) {
    return RegExp(Utils.guidRegex, "i").test(id);
  }

  static getHostname(uriString: string): string {
    if (Utils.isNullOrWhitespace(uriString)) {
      return null;
    }

    uriString = uriString.trim();

    if (uriString.startsWith("data:")) {
      return null;
    }

    if (uriString.startsWith("about:")) {
      return null;
    }

    if (uriString.startsWith("file:")) {
      return null;
    }

    // Does uriString contain invalid characters
    // TODO Needs to possibly be extended, although '!' is a reserved character
    if (uriString.indexOf("!") > 0) {
      return null;
    }

    try {
      const hostname = getHostname(uriString, { validHosts: this.validHosts });
      if (hostname != null) {
        return hostname;
      }
    } catch {
      return null;
    }
    return null;
  }

  static getHost(uriString: string): string {
    const url = Utils.getUrl(uriString);
    try {
      return url != null && url.host !== "" ? url.host : null;
    } catch {
      return null;
    }
  }

  static getDomain(uriString: string): string {
    if (Utils.isNullOrWhitespace(uriString)) {
      return null;
    }

    uriString = uriString.trim();

    if (uriString.startsWith("data:")) {
      return null;
    }

    if (uriString.startsWith("about:")) {
      return null;
    }

    try {
      const parseResult = parse(uriString, {
        validHosts: this.validHosts,
        allowPrivateDomains: true,
      });
      if (parseResult != null && parseResult.hostname != null) {
        if (parseResult.hostname === "localhost" || parseResult.isIp) {
          return parseResult.hostname;
        }

        if (parseResult.domain != null) {
          return parseResult.domain;
        }
        return null;
      }
    } catch {
      return null;
    }
    return null;
  }

  static getQueryParams(uriString: string): Map<string, string> {
    const url = Utils.getUrl(uriString);
    if (url == null || url.search == null || url.search === "") {
      return null;
    }
    const map = new Map<string, string>();
    const pairs = (url.search[0] === "?" ? url.search.substr(1) : url.search).split("&");
    pairs.forEach((pair) => {
      const parts = pair.split("=");
      if (parts.length < 1) {
        return;
      }
      map.set(
        decodeURIComponent(parts[0]).toLowerCase(),
        parts[1] == null ? "" : decodeURIComponent(parts[1]),
      );
    });
    return map;
  }

  static getSortFunction<T>(
    i18nService: I18nService,
    prop: { [K in keyof T]: T[K] extends string ? K : never }[keyof T],
  ): (a: T, b: T) => number {
    return (a, b) => {
      if (a[prop] == null && b[prop] != null) {
        return -1;
      }
      if (a[prop] != null && b[prop] == null) {
        return 1;
      }
      if (a[prop] == null && b[prop] == null) {
        return 0;
      }

      // The `as unknown as string` here is unfortunate because typescript doesn't property understand that the return of T[prop] will be a string
      return i18nService.collator
        ? i18nService.collator.compare(a[prop] as unknown as string, b[prop] as unknown as string)
        : (a[prop] as unknown as string).localeCompare(b[prop] as unknown as string);
    };
  }

  static isNullOrWhitespace(str: string | null | undefined): boolean {
    return str == null || typeof str !== "string" || str.trim() === "";
  }

  static isNullOrEmpty(str: string | null): boolean {
    return str == null || typeof str !== "string" || str == "";
  }

  static isPromise(obj: any): obj is Promise<unknown> {
    return (
      obj != undefined && typeof obj["then"] === "function" && typeof obj["catch"] === "function"
    );
  }

  static nameOf<T>(name: string & keyof T) {
    return name;
  }

  static assign<T>(target: T, source: Partial<T>): T {
    return Object.assign(target, source);
  }

  static iterateEnum<O extends object, K extends keyof O = keyof O>(obj: O) {
    return (Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[]).map((k) => obj[k]);
  }

  static getUrl(uriString: string): URL {
    if (this.isNullOrWhitespace(uriString)) {
      return null;
    }

    uriString = uriString.trim();

    return Utils.getUrlObject(uriString);
  }

  static camelToPascalCase(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * There are a few ways to calculate text color for contrast, this one seems to fit accessibility guidelines best.
   * https://stackoverflow.com/a/3943023/6869691
   *
   * @param {string} bgColor
   * @param {number} [threshold] see stackoverflow link above
   * @param {boolean} [svgTextFill]
   * Indicates if this method is performed on an SVG <text> 'fill' attribute (e.g. <text fill="black"></text>).
   * This check is necessary because the '!important' tag cannot be used in a 'fill' attribute.
   */
  static pickTextColorBasedOnBgColor(bgColor: string, threshold = 186, svgTextFill = false) {
    const bgColorHexNums = bgColor.charAt(0) === "#" ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(bgColorHexNums.substring(0, 2), 16); // hexToR
    const g = parseInt(bgColorHexNums.substring(2, 4), 16); // hexToG
    const b = parseInt(bgColorHexNums.substring(4, 6), 16); // hexToB
    const blackColor = svgTextFill ? "black" : "black !important";
    const whiteColor = svgTextFill ? "white" : "white !important";
    return r * 0.299 + g * 0.587 + b * 0.114 > threshold ? blackColor : whiteColor;
  }

  static stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
  }

  /**
   * @throws Will throw an error if the ContainerService has not been attached to the window object
   */
  static getContainerService(): BitwardenContainerService {
    if (this.global.bitwardenContainerService == null) {
      throw new Error("global bitwardenContainerService not initialized.");
    }
    return this.global.bitwardenContainerService;
  }

  static validateHexColor(color: string) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * Converts map to a Record<string, V> with the same data. Inverse of recordToMap
   * Useful in toJSON methods, since Maps are not serializable
   * @param map
   * @returns
   */
  static mapToRecord<K extends string | number, V>(map: Map<K, V>): Record<string, V> {
    if (map == null) {
      return null;
    }
    if (!(map instanceof Map)) {
      return map;
    }
    return Object.fromEntries(map);
  }

  /**
   * Converts record to a Map<string, V> with the same data. Inverse of mapToRecord
   * Useful in fromJSON methods, since Maps are not serializable
   *
   * Warning: If the record has string keys that are numbers, they will be converted to numbers in the map
   * @param record
   * @returns
   */
  static recordToMap<K extends string | number, V>(record: Record<K, V>): Map<K, V> {
    if (record == null) {
      return null;
    } else if (record instanceof Map) {
      return record;
    }

    const entries = Object.entries(record);
    if (entries.length === 0) {
      return new Map();
    }

    if (isNaN(Number(entries[0][0]))) {
      return new Map(entries) as Map<K, V>;
    } else {
      return new Map(entries.map((e) => [Number(e[0]), e[1]])) as Map<K, V>;
    }
  }

  /** Applies Object.assign, but converts the type nicely using Type-Fest Merge<Destination, Source> */
  static merge<Destination, Source>(
    destination: Destination,
    source: Source,
  ): Merge<Destination, Source> {
    return Object.assign(destination, source) as unknown as Merge<Destination, Source>;
  }

  /**
   * encodeURIComponent escapes all characters except the following:
   * alphabetic, decimal digits, - _ . ! ~ * ' ( )
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#encoding_for_rfc3986
   */
  static encodeRFC3986URIComponent(str: string): string {
    return encodeURIComponent(str).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  /**
   * Normalizes a path for defense against attacks like traversals
   * @param denormalizedPath
   * @returns
   */
  static normalizePath(denormalizedPath: string): string {
    return path.normalize(decodeURIComponent(denormalizedPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  }

  private static isMobile(win: Window) {
    let mobile = false;
    ((a) => {
      if (
        /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
          a,
        ) ||
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
          a.substr(0, 4),
        )
      ) {
        mobile = true;
      }
    })(win.navigator.userAgent || win.navigator.vendor || (win as any).opera);
    return mobile || win.navigator.userAgent.match(/iPad/i) != null;
  }

  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate an observable from a function that returns a promise.
   * Similar to the rxjs function {@link from} with one big exception:
   * {@link from} will not re-execute the function when observers resubscribe.
   * {@link Util.asyncToObservable} will execute `generator` for every
   * subscribe, making it ideal if the value ever needs to be refreshed.
   * */
  static asyncToObservable<T>(generator: () => Promise<T>): Observable<T> {
    return of(undefined).pipe(switchMap(() => generator()));
  }

  /**
   * Return the number of days remaining before a target date arrives.
   * Returns 0 if the day has already passed.
   */
  static daysRemaining(targetDate: Date): number {
    const diffTime = targetDate.getTime() - Date.now();
    const msPerDay = 86400000;
    return Math.max(0, Math.floor(diffTime / msPerDay));
  }

  private static isAppleMobile(win: Window) {
    return (
      win.navigator.userAgent.match(/iPhone/i) != null ||
      win.navigator.userAgent.match(/iPad/i) != null
    );
  }

  private static getUrlObject(uriString: string): URL {
    // All the methods below require a protocol to properly parse a URL string
    // Assume http if no other protocol is present
    const hasProtocol = uriString.indexOf("://") > -1;
    if (!hasProtocol && uriString.indexOf(".") > -1) {
      uriString = "http://" + uriString;
    } else if (!hasProtocol) {
      return null;
    }

    try {
      if (nodeURL != null) {
        return new nodeURL.URL(uriString);
      }

      return new URL(uriString);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Ignore error
    }

    return null;
  }
}

Utils.init();
