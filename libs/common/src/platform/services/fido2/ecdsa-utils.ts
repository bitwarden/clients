/*
   Copyright 2015 D2L Corporation

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License. */

// Changes:
// - Cherry-pick the methods that we have a need for.
// - Add typings.
// - Original code is made for running in node, this version is adapted to work in the browser.

// https://github.com/Brightspace/node-ecdsa-sig-formatter/blob/master/src/param-bytes-for-alg.js

function getParamSize(keySize: number) {
  const result = ((keySize / 8) | 0) + (keySize % 8 === 0 ? 0 : 1);
  return result;
}

const paramBytesForAlg = {
  ES256: getParamSize(256),
  ES384: getParamSize(384),
  ES512: getParamSize(521),
};

type Alg = keyof typeof paramBytesForAlg;

function getParamBytesForAlg(alg: Alg) {
  const paramBytes = paramBytesForAlg[alg];
  if (paramBytes) {
    return paramBytes;
  }

  throw new Error('Unknown algorithm "' + alg + '"');
}

// https://github.com/Brightspace/node-ecdsa-sig-formatter/blob/master/src/ecdsa-sig-formatter.js

const MAX_OCTET = 0x80,
  CLASS_UNIVERSAL = 0,
  PRIMITIVE_BIT = 0x20,
  TAG_SEQ = 0x10,
  TAG_INT = 0x02,
  ENCODED_TAG_SEQ = TAG_SEQ | PRIMITIVE_BIT | (CLASS_UNIVERSAL << 6),
  ENCODED_TAG_INT = TAG_INT | (CLASS_UNIVERSAL << 6);

// Counts leading zeros and determines if there's a need for 0x00 padding
function countPadding(
  buf: Uint8Array,
  start: number,
  end: number,
): { padding: number; needs0x00: boolean } {
  let padding = 0;
  while (start + padding < end && buf[start + padding] === 0) {
    padding++;
  }

  const needs0x00 = (buf[start + padding] & MAX_OCTET) === MAX_OCTET;
  return { padding, needs0x00 };
}

export function p1363ToDer(signature: Uint8Array) {
  const alg = "ES256";
  const paramBytes = getParamBytesForAlg(alg);

  const signatureBytes = signature.length;
  if (signatureBytes !== paramBytes * 2) {
    throw new TypeError(
      '"' +
        alg +
        '" signatures must be "' +
        paramBytes * 2 +
        '" bytes, saw "' +
        signatureBytes +
        '"',
    );
  }

  const { padding: rPadding, needs0x00: rNeeds0x00 } = countPadding(signature, 0, paramBytes);
  const { padding: sPadding, needs0x00: sNeeds0x00 } = countPadding(
    signature,
    paramBytes,
    signature.length,
  );

  const rActualLength = paramBytes - rPadding;
  const sActualLength = paramBytes - sPadding;

  const rLength = rActualLength + (rNeeds0x00 ? 1 : 0);
  const sLength = sActualLength + (sNeeds0x00 ? 1 : 0);

  const rsBytes = 2 + rLength + 2 + sLength;

  const shortLength = rsBytes < MAX_OCTET;

  const dst = new Uint8Array((shortLength ? 2 : 3) + rsBytes);

  let offset = 0;
  dst[offset++] = ENCODED_TAG_SEQ;
  if (shortLength) {
    dst[offset++] = rsBytes;
  } else {
    dst[offset++] = MAX_OCTET | 1;
    dst[offset++] = rsBytes & 0xff;
  }

  // Encoding 'R' component
  dst[offset++] = ENCODED_TAG_INT;
  dst[offset++] = rLength;
  if (rNeeds0x00) {
    dst[offset++] = 0;
  }
  dst.set(signature.subarray(rPadding, rPadding + rActualLength), offset);
  offset += rActualLength;

  // Encoding 'S' component
  dst[offset++] = ENCODED_TAG_INT;
  dst[offset++] = sLength;
  if (sNeeds0x00) {
    dst[offset++] = 0;
  }
  dst.set(signature.subarray(paramBytes + sPadding, paramBytes + sPadding + sActualLength), offset);

  return dst;
}
