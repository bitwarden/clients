/*
  License for: guidToRawFormat, guidToStandardFormat
  Source: https://github.com/uuidjs/uuid/
  The MIT License (MIT)
  Copyright (c) 2010-2020 Robert Kieffer and other contributors
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*/

/** Private array used for optimization */
const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).substring(1));

/** Convert standard format (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) UUID to raw 16 byte array. */
export function guidToRawFormat(guid: string) {
  if (!isValidGuid(guid)) {
    throw TypeError("GUID parameter is invalid");
  }

  let v;
  const arr = new Uint8Array(16);

  // Parse ########-....-....-....-............
  arr[0] = (v = parseInt(guid.slice(0, 8), 16)) >>> 24;
  arr[1] = (v >>> 16) & 0xff;
  arr[2] = (v >>> 8) & 0xff;
  arr[3] = v & 0xff;

  // Parse ........-####-....-....-............
  arr[4] = (v = parseInt(guid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff;

  // Parse ........-....-####-....-............
  arr[6] = (v = parseInt(guid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff;

  // Parse ........-....-....-####-............
  arr[8] = (v = parseInt(guid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff;

  // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)
  arr[10] = ((v = parseInt(guid.slice(24, 36), 16)) / 0x10000000000) & 0xff;
  arr[11] = (v / 0x100000000) & 0xff;
  arr[12] = (v >>> 24) & 0xff;
  arr[13] = (v >>> 16) & 0xff;
  arr[14] = (v >>> 8) & 0xff;
  arr[15] = v & 0xff;

  return arr;
}

/** Convert raw 16 byte array to standard format (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) UUID. */
export function guidToStandardFormat(bufferSource: BufferSource) {
  const arr =
    bufferSource instanceof ArrayBuffer
      ? new Uint8Array(bufferSource)
      : new Uint8Array(bufferSource.buffer);
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  const guid = (
    byteToHex[arr[0]] +
    byteToHex[arr[1]] +
    byteToHex[arr[2]] +
    byteToHex[arr[3]] +
    "-" +
    byteToHex[arr[4]] +
    byteToHex[arr[5]] +
    "-" +
    byteToHex[arr[6]] +
    byteToHex[arr[7]] +
    "-" +
    byteToHex[arr[8]] +
    byteToHex[arr[9]] +
    "-" +
    byteToHex[arr[10]] +
    byteToHex[arr[11]] +
    byteToHex[arr[12]] +
    byteToHex[arr[13]] +
    byteToHex[arr[14]] +
    byteToHex[arr[15]]
  ).toLowerCase();

  // Consistency check for valid UUID.  If this throws, it's likely due to one
  // or more input array values not mapping to a hex octet (leading to "undefined" in the uuid)
  if (!isValidGuid(guid)) {
    throw TypeError("Converted GUID is invalid");
  }

  return guid;
}

// Perform format validation, without enforcing any variant restrictions as Utils.isGuid does
function isValidGuid(guid: string): boolean {
  return RegExp(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/, "i").test(guid);
}
