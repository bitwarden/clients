import { DDGDecryptError, DDGSessionKey, decrypt, encrypt, Padding, toWire } from "./crypto";

// keys.ts reaches the SDK only to generate a key, which these vectors never do.
jest.mock("@bitwarden/sdk-internal", () => ({ SdkRandomNumberClient: jest.fn() }));

const KEY_A = DDGSessionKey.fromBytes(new Uint8Array(64).map((_, i) => i));
const KEY_B = DDGSessionKey.fromBytes(new Uint8Array(64).map((_, i) => 255 - i));

/**
 * Encstrings recorded from this implementation, pinning the wire format. DuckDuckGo reads these
 * bytes, so a change to the padding, the MAC input or the envelope must not pass unnoticed.
 */
const VECTORS = [
  {
    name: "asciiPkcs7",
    plaintext: "Hello world",
    padding: Padding.Pkcs7,
    key: KEY_A,
    encstring:
      "2.HtjlR8byIM/FwEBBFY187w==|pqYEZq6RO+QP6i9Dc8DTcw==|iEuQhmUc1zzxK+1+DH7NQsdgJ4cB2eb6lS57AW4Zy7M=",
  },
  {
    name: "asciiZero",
    plaintext: "Hello world",
    padding: Padding.Zero,
    key: KEY_A,
    encstring:
      "2.9TOAiVlpf5ORkdgZLitbjw==|RbtfN+IsEp0h/KWFdEZOMA==|NGlsMXBj6UX0y419+N5jxdeV23pag9e7OPf2F9bx7hk=",
  },
  {
    name: "blockMultiplePkcs7",
    plaintext: "0123456789abcdef",
    padding: Padding.Pkcs7,
    key: KEY_A,
    encstring:
      "2./WVXfo6dpUzu0sbQ1P5vMA==|pM0M0XaKehN/w3tHhXq2tbFIAxtW12LFjKWCA+NPnZQ=|zFiuXzNQgJqdHQiOAfEb2+eL4zv98UafPdYVpJsLF8U=",
  },
  {
    name: "blockMultipleZero",
    plaintext: "0123456789abcdef",
    padding: Padding.Zero,
    key: KEY_A,
    encstring:
      "2.HbrE21VsYDbJfZsWxjoZ7A==|nJ0XX11y3WJywZK1lZ88ww==|UFuEZv3MCaN0NJBFSeAJuHEZmRpuTAlBZPkHWoaFM/A=",
  },
  {
    name: "endsInDigitZero",
    plaintext: "abcdefghijklmno0",
    padding: Padding.Zero,
    key: KEY_A,
    encstring:
      "2.MsSj3ACDemctvTQ43dJbmw==|0CGh1Xhnh8I6qAXRfO3Q/g==|wYjci9zu5e9XWSDYrsWi40wCGqQk8qfrsuqZueR8Uk0=",
  },
  {
    name: "utf8Pkcs7",
    plaintext: "héllo — 🦆 duck",
    padding: Padding.Pkcs7,
    key: KEY_A,
    encstring:
      "2.n/Ky1bYcwzhIeUbU0FQu+A==|0WX5xcTheGBX17Z3m2oMhOoheLR+zJAZRbjyWDFsbtw=|drs7ILhP3DEdFgi6kml+5HkzJ6+4zvHNasEEHKUTxMQ=",
  },
  {
    name: "utf8Zero",
    plaintext: "héllo — 🦆 duck",
    padding: Padding.Zero,
    key: KEY_A,
    encstring:
      "2.l7ZetIHN6NSJQhVPGbnJDQ==|aqeEfF9einCijUYlvq6wtxqyNO+WRlDqq3olKhMEfV0=|jsjVuxftlx+9xa5X7IN+MvBU5zL8RprZyEarH293J78=",
  },
  {
    name: "emptyPkcs7",
    plaintext: "",
    padding: Padding.Pkcs7,
    key: KEY_A,
    encstring:
      "2.IGRiv1KdFKjZqluaS37ZHg==|xAp0F0JUtXqo68C1QElgUA==|yc844cCRTFJ0gMHg3J/OUyrE1wmq/2mhGVz6rs9aegk=",
  },
  {
    name: "jsonCommandZero",
    plaintext: '{"command":"bw-status"}',
    padding: Padding.Zero,
    key: KEY_A,
    encstring:
      "2.10tdgOvpw19yWm5kFcHGIg==|9jSzsyrdTEvaMt2GXBqU/J48gSG6BfgbYuTXkg6zjs0=|3Jhc/zC1LBDEO1DjMvw8Mx644lJt6iEty5uCaZHYsyQ=",
  },
  {
    name: "jsonCommandPkcs7",
    plaintext: '{"command":"bw-status"}',
    padding: Padding.Pkcs7,
    key: KEY_A,
    encstring:
      "2.Hr5WeydEUjOTUMgv5ECA1g==|M+zs1ANStNEhiA+7ngTLvuFKTgDF6uBegNc6rLc+DqU=|T/MLB9srwBJbDYzXeyS5MaczVR+SRM9/+1vwlAa9pV4=",
  },
  {
    name: "otherKeyPkcs7",
    plaintext: "Hello world",
    padding: Padding.Pkcs7,
    key: KEY_B,
    encstring:
      "2.nEr7+4rMCbLU3jT/IpEyCg==|FQ4Ax0IMaG4eiO5PC+98Yw==|8g3Hucbs2YfOSMOPfWXNqIP3kcwJ+bWdVEb8/51OhB0=",
  },
];

describe("the recorded vectors", () => {
  it.each(VECTORS)("decrypts $name", ({ plaintext, padding, key, encstring }) => {
    expect(decrypt(encstring, key, padding)).toBe(plaintext);
  });

  it.each(VECTORS)("rejects $name under a different key", ({ key, encstring, padding }) => {
    const other = key === KEY_A ? KEY_B : KEY_A;

    expect(() => decrypt(encstring, other, padding)).toThrow(DDGDecryptError);
  });
});

describe("decrypting a damaged envelope", () => {
  const { encstring } = VECTORS[0];
  const [envelope, data, mac] = encstring.split("|");

  const flip = (b64: string) => {
    const bytes = Buffer.from(b64, "base64");
    bytes[0] ^= 0xff;
    return bytes.toString("base64");
  };

  it.each([
    ["a flipped MAC", [envelope, data, flip(mac)].join("|")],
    ["flipped ciphertext", [envelope, flip(data), mac].join("|")],
    ["a flipped IV", ["2." + flip(envelope.slice(2)), data, mac].join("|")],
    ["a missing part", [envelope, data].join("|")],
    ["an extra part", [envelope, data, mac, mac].join("|")],
    ["the wrong encstring type", "9." + encstring.slice(2)],
    ["no type prefix", encstring.slice(2)],
    ["a truncated IV", ["2." + Buffer.from([1, 2, 3]).toString("base64"), data, mac].join("|")],
    ["nothing at all", ""],
  ])("throws on %s", (_name, damaged) => {
    expect(() => decrypt(damaged, KEY_A, Padding.Pkcs7)).toThrow(DDGDecryptError);
  });
});

describe("encrypting", () => {
  // The IV is random, so the output is pinned by round trip rather than by value.
  it.each(VECTORS)("round-trips $name", ({ plaintext, padding, key }) => {
    expect(decrypt(encrypt(plaintext, key, padding), key, padding)).toBe(plaintext);
  });

  it("adds nothing to a zero-padded plaintext already on a block boundary", () => {
    const oneBlock = "0123456789abcdef";

    const zero = Buffer.from(encrypt(oneBlock, KEY_A, Padding.Zero).split("|")[1], "base64");
    const pkcs7 = Buffer.from(encrypt(oneBlock, KEY_A, Padding.Pkcs7).split("|")[1], "base64");

    expect(zero).toHaveLength(16);
    expect(pkcs7).toHaveLength(32);
  });

  it("uses a fresh IV for every message", () => {
    const first = encrypt("Hello world", KEY_A, Padding.Pkcs7).split("|")[0];
    const second = encrypt("Hello world", KEY_A, Padding.Pkcs7).split("|")[0];

    expect(first).not.toBe(second);
  });
});

describe("the wire form", () => {
  it("repeats the encstring and its three parts", () => {
    const { encstring } = VECTORS[0];
    const [envelope, data, mac] = encstring.split("|");

    expect(toWire(encstring)).toEqual({
      encryptedString: encstring,
      encryptionType: 2,
      iv: envelope.slice(2),
      data,
      mac,
    });
  });
});
