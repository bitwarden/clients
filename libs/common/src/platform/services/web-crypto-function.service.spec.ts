import { mock } from "jest-mock-extended";

import { Utils } from "../../platform/misc/utils";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { EcbDecryptParameters } from "../models/domain/decrypt-parameters";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

import { WebCryptoFunctionService } from "./web-crypto-function.service";

const RsaPublicKey =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAl0Vawl/toXzkEvB82FEtqHP" +
  "4xlU2ab/v0crqIfXfIoWF/XXdHGIdrZeilnRXPPJT1B9dTsasttEZNnua/0Rek/cjNDHtzT52irfoZYS7X6HNIfOi54Q+egP" +
  "RQ1H7iNHVZz3K8Db9GCSKPeC8MbW6gVCzb15esCe1gGzg6wkMuWYDFYPoh/oBqcIqrGah7firqB1nDedzEjw32heP2DAffVN" +
  "084iTDjiWrJNUxBJ2pDD5Z9dT3MzQ2s09ew1yMWK2z37rT3YerC7OgEDmo3WYo3xL3qYJznu3EO2nmrYjiRa40wKSjxsTlUc" +
  "xDF+F0uMW8oR9EMUHgepdepfAtLsSAQIDAQAB";
const RsaPrivateKey =
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCXRVrCX+2hfOQS8Hz" +
  "YUS2oc/jGVTZpv+/Ryuoh9d8ihYX9dd0cYh2tl6KWdFc88lPUH11Oxqy20Rk2e5r/RF6T9yM0Me3NPnaKt+hlhLtfoc0h86L" +
  "nhD56A9FDUfuI0dVnPcrwNv0YJIo94LwxtbqBULNvXl6wJ7WAbODrCQy5ZgMVg+iH+gGpwiqsZqHt+KuoHWcN53MSPDfaF4/" +
  "YMB99U3TziJMOOJask1TEEnakMPln11PczNDazT17DXIxYrbPfutPdh6sLs6AQOajdZijfEvepgnOe7cQ7aeatiOJFrjTApK" +
  "PGxOVRzEMX4XS4xbyhH0QxQeB6l16l8C0uxIBAgMBAAECggEASaWfeVDA3cVzOPFSpvJm20OTE+R6uGOU+7vh36TX/POq92q" +
  "Buwbd0h0oMD32FxsXywd2IxtBDUSiFM9699qufTVuM0Q3tZw6lHDTOVG08+tPdr8qSbMtw7PGFxN79fHLBxejjO4IrM9lapj" +
  "WpxEF+11x7r+wM+0xRZQ8sNFYG46aPfIaty4BGbL0I2DQ2y8I57iBCAy69eht59NLMm27fRWGJIWCuBIjlpfzET1j2HLXUIh" +
  "5bTBNzqaN039WH49HczGE3mQKVEJZc/efk3HaVd0a1Sjzyn0QY+N1jtZN3jTRbuDWA1AknkX1LX/0tUhuS3/7C3ejHxjw4Dk" +
  "1ZLo5/QKBgQDIWvqFn0+IKRSu6Ua2hDsufIHHUNLelbfLUMmFthxabcUn4zlvIscJO00Tq/ezopSRRvbGiqnxjv/mYxucvOU" +
  "BeZtlus0Q9RTACBtw9TGoNTmQbEunJ2FOSlqbQxkBBAjgGEppRPt30iGj/VjAhCATq2MYOa/X4dVR51BqQAFIEwKBgQDBSIf" +
  "TFKC/hDk6FKZlgwvupWYJyU9RkyfstPErZFmzoKhPkQ3YORo2oeAYmVUbS9I2iIYpYpYQJHX8jMuCbCz4ONxTCuSIXYQYUcU" +
  "q4PglCKp31xBAE6TN8SvhfME9/MvuDssnQinAHuF0GDAhF646T3LLS1not6Vszv7brwSoGwKBgQC88v/8cGfi80ssQZeMnVv" +
  "q1UTXIeQcQnoY5lGHJl3K8mbS3TnXE6c9j417Fdz+rj8KWzBzwWXQB5pSPflWcdZO886Xu/mVGmy9RWgLuVFhXwCwsVEPjNX" +
  "5ramRb0/vY0yzenUCninBsIxFSbIfrPtLUYCc4hpxr+sr2Mg/y6jpvQKBgBezMRRs3xkcuXepuI2R+BCXL1/b02IJTUf1F+1" +
  "eLLGd7YV0H+J3fgNc7gGWK51hOrF9JBZHBGeOUPlaukmPwiPdtQZpu4QNE3l37VlIpKTF30E6mb+BqR+nht3rUjarnMXgAoE" +
  "Z18y6/KIjpSMpqC92Nnk/EBM9EYe6Cf4eA9ApAoGAeqEUg46UTlJySkBKURGpIs3v1kkf5I0X8DnOhwb+HPxNaiEdmO7ckm8" +
  "+tPVgppLcG0+tMdLjigFQiDUQk2y3WjyxP5ZvXu7U96jaJRI8PFMoE06WeVYcdIzrID2HvqH+w0UQJFrLJ/0Mn4stFAEzXKZ" +
  "BokBGnjFnTnKcs7nv/O8=";

const Sha1Mac = "4d4c223f95dc577b665ec4ccbcb680b80a397038";
const Sha256Mac = "6be3caa84922e12aaaaa2f16c40d44433bb081ef323db584eb616333ab4e874f";
const Sha512Mac =
  "21910e341fa12106ca35758a2285374509326c9fbe0bd64e7b99c898f841dc948c58ce66d3504d8883c" +
  "5ea7817a0b7c5d4d9b00364ccd214669131fc17fe4aca";

describe("WebCrypto Function Service", () => {
  describe("pbkdf2", () => {
    const regular256Key = "pj9prw/OHPleXI6bRdmlaD+saJS4awrMiQsQiDjeu2I=";
    const utf8256Key = "yqvoFXgMRmHR3QPYr5pyR4uVuoHkltv9aHUP63p8n7I=";
    const unicode256Key = "ZdeOata6xoRpB4DLp8zHhXz5kLmkWtX5pd+TdRH8w8w=";

    const regular512Key =
      "liTi/Ke8LPU1Qv+Vl7NGEVt/XMbsBVJ2kQxtVG/Z1/JFHFKQW3ZkI81qVlwTiCpb+cFXzs+57" +
      "eyhhx5wfKo5Cg==";
    const utf8512Key =
      "df0KdvIBeCzD/kyXptwQohaqUa4e7IyFUyhFQjXCANu5T+scq55hCcE4dG4T/MhAk2exw8j7ixRN" +
      "zXANiVZpnw==";
    const unicode512Key =
      "FE+AnUJaxv8jh+zUDtZz4mjjcYk0/PZDZm+SLJe3XtxtnpdqqpblX6JjuMZt/dYYNMOrb2+mD" +
      "L3FiQDTROh1lg==";

    testPbkdf2("sha256", regular256Key, utf8256Key, unicode256Key);
    testPbkdf2("sha512", regular512Key, utf8512Key, unicode512Key);
  });

  describe("hkdf", () => {
    const regular256Key = "qBUmEYtwTwwGPuw/z6bs/qYXXYNUlocFlyAuuANI8Pw=";
    const utf8256Key = "6DfJwW1R3txgiZKkIFTvVAb7qVlG7lKcmJGJoxR2GBU=";
    const unicode256Key = "gejGI82xthA+nKtKmIh82kjw+ttHr+ODsUoGdu5sf0A=";

    const regular512Key = "xe5cIG6ZfwGmb1FvsOedM0XKOm21myZkjL/eDeKIqqM=";
    const utf8512Key = "XQMVBnxVEhlvjSFDQc77j5GDE9aorvbS0vKnjhRg0LY=";
    const unicode512Key = "148GImrTbrjaGAe/iWEpclINM8Ehhko+9lB14+52lqc=";

    testHkdf("sha256", regular256Key, utf8256Key, unicode256Key);
    testHkdf("sha512", regular512Key, utf8512Key, unicode512Key);
  });

  describe("hkdfExpand", () => {
    const prk16Byte = "criAmKtfzxanbgea5/kelQ==";
    const prk32Byte = "F5h4KdYQnIVH4rKH0P9CZb1GrR4n16/sJrS0PsQEn0Y=";
    const prk64Byte =
      "ssBK0mRG17VHdtsgt8yo4v25CRNpauH+0r2fwY/E9rLyaFBAOMbIeTry+" +
      "gUJ28p8y+hFh3EI9pcrEWaNvFYonQ==";

    testHkdfExpand("sha256", prk32Byte, 32, "BnIqJlfnHm0e/2iB/15cbHyR19ARPIcWRp4oNS22CD8=");
    testHkdfExpand(
      "sha256",
      prk32Byte,
      64,
      "BnIqJlfnHm0e/2iB/15cbHyR19ARPIcWRp4oNS22CD9BV+" +
        "/queOZenPNkDhmlVyL2WZ3OSU5+7ISNF5NhNfvZA==",
    );
    testHkdfExpand("sha512", prk64Byte, 32, "uLWbMWodSBms5uGJ5WTRTesyW+MD7nlpCZvagvIRXlk=");
    testHkdfExpand(
      "sha512",
      prk64Byte,
      64,
      "uLWbMWodSBms5uGJ5WTRTesyW+MD7nlpCZvagvIRXlkY5Pv0sB+" +
        "MqvaopmkC6sD/j89zDwTV9Ib2fpucUydO8w==",
    );

    it("should fail with prk too small", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const f = cryptoFunctionService.hkdfExpand(
        Utils.fromB64ToArray(prk16Byte),
        "info",
        32,
        "sha256",
      );
      await expect(f).rejects.toEqual(new Error("prk is too small."));
    });

    it("should fail with outputByteSize is too large", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const f = cryptoFunctionService.hkdfExpand(
        Utils.fromB64ToArray(prk32Byte),
        "info",
        8161,
        "sha256",
      );
      await expect(f).rejects.toEqual(new Error("outputByteSize is too large."));
    });
  });

  describe("hash", () => {
    const regular1Hash = "2a241604fb921fad12bf877282457268e1dccb70";
    const utf81Hash = "85672798dc5831e96d6c48655d3d39365a9c88b6";
    const unicode1Hash = "39c975935054a3efc805a9709b60763a823a6ad4";

    const regular256Hash = "2b8e96031d352a8655d733d7a930b5ffbea69dc25cf65c7bca7dd946278908b2";
    const utf8256Hash = "25fe8440f5b01ed113b0a0e38e721b126d2f3f77a67518c4a04fcde4e33eeb9d";
    const unicode256Hash = "adc1c0c2afd6e92cefdf703f9b6eb2c38e0d6d1a040c83f8505c561fea58852e";

    const regular512Hash =
      "c15cf11d43bde333647e3f559ec4193bb2edeaa0e8b902772f514cdf3f785a3f49a6e02a4b87b3" +
      "b47523271ad45b7e0aebb5cdcc1bc54815d256eb5dcb80da9d";
    const utf8512Hash =
      "035c31a877a291af09ed2d3a1a293e69c3e079ea2cecc00211f35e6bce10474ca3ad6e30b59e26118" +
      "37463f20969c5bc95282965a051a88f8cdf2e166549fcdd";
    const unicode512Hash =
      "2b16a5561af8ad6fe414cc103fc8036492e1fc6d9aabe1b655497054f760fe0e34c5d100ac773d" +
      "9f3030438284f22dbfa20cb2e9b019f2c98dfe38ce1ef41bae";

    const regularMd5 = "5eceffa53a5fd58c44134211e2c5f522";
    const utf8Md5 = "3abc9433c09551b939c80aa0aa3174e1";
    const unicodeMd5 = "85ae134072c8d81257933f7045ba17ca";

    testHash("sha1", regular1Hash, utf81Hash, unicode1Hash);
    testHash("sha256", regular256Hash, utf8256Hash, unicode256Hash);
    testHash("sha512", regular512Hash, utf8512Hash, unicode512Hash);
    testHash("md5", regularMd5, utf8Md5, unicodeMd5);
  });

  describe("hmac", () => {
    testHmac("sha1", Sha1Mac);
    testHmac("sha256", Sha256Mac);
    testHmac("sha512", Sha512Mac);
  });

  describe("compare", () => {
    it("should successfully compare two of the same values", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const equal = await cryptoFunctionService.compare(a, a);
      expect(equal).toBe(true);
    });

    it("should successfully compare two different values of the same length", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const b = new Uint8Array(2);
      b[0] = 3;
      b[1] = 4;
      const equal = await cryptoFunctionService.compare(a, b);
      expect(equal).toBe(false);
    });

    it("should successfully compare two different values of different lengths", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const b = new Uint8Array(2);
      b[0] = 3;
      const equal = await cryptoFunctionService.compare(a, b);
      expect(equal).toBe(false);
    });
  });

  describe("hmacFast", () => {
    testHmacFast("sha1", Sha1Mac);
    testHmacFast("sha256", Sha256Mac);
    testHmacFast("sha512", Sha512Mac);
  });

  describe("compareFast", () => {
    it("should successfully compare two of the same values", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const aByteString = Utils.fromBufferToByteString(a);
      const equal = await cryptoFunctionService.compareFast(aByteString, aByteString);
      expect(equal).toBe(true);
    });

    it("should successfully compare two different values of the same length", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const aByteString = Utils.fromBufferToByteString(a);
      const b = new Uint8Array(2);
      b[0] = 3;
      b[1] = 4;
      const bByteString = Utils.fromBufferToByteString(b);
      const equal = await cryptoFunctionService.compareFast(aByteString, bByteString);
      expect(equal).toBe(false);
    });

    it("should successfully compare two different values of different lengths", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const a = new Uint8Array(2);
      a[0] = 1;
      a[1] = 2;
      const aByteString = Utils.fromBufferToByteString(a);
      const b = new Uint8Array(2);
      b[0] = 3;
      const bByteString = Utils.fromBufferToByteString(b);
      const equal = await cryptoFunctionService.compareFast(aByteString, bByteString);
      expect(equal).toBe(false);
    });
  });

  describe("aesEncrypt CBC mode", () => {
    it("should successfully encrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const iv = makeStaticByteArray(16);
      const key = makeStaticByteArray(32);
      const data = Utils.fromUtf8ToArray("EncryptMe!");
      const encValue = await cryptoFunctionService.aesEncrypt(data, iv, key);
      expect(Utils.fromBufferToB64(encValue)).toBe("ByUF8vhyX4ddU9gcooznwA==");
    });

    it("should successfully encrypt and then decrypt data fast", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const iv = makeStaticByteArray(16);
      const key = makeStaticByteArray(32);
      const value = "EncryptMe!";
      const data = Utils.fromUtf8ToArray(value);
      const encValue = await cryptoFunctionService.aesEncrypt(data, iv, key);
      const encData = Utils.fromBufferToB64(encValue);
      const b64Iv = Utils.fromBufferToB64(iv);
      const symKey = new SymmetricCryptoKey(key);
      const parameters = cryptoFunctionService.aesDecryptFastParameters(
        encData,
        b64Iv,
        null,
        symKey,
      );
      const decValue = await cryptoFunctionService.aesDecryptFast({ mode: "cbc", parameters });
      expect(decValue).toBe(value);
    });

    it("should successfully encrypt and then decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const iv = makeStaticByteArray(16);
      const key = makeStaticByteArray(32);
      const value = "EncryptMe!";
      const data = Utils.fromUtf8ToArray(value);
      const encValue = new Uint8Array(await cryptoFunctionService.aesEncrypt(data, iv, key));
      const decValue = await cryptoFunctionService.aesDecrypt(encValue, iv, key, "cbc");
      expect(Utils.fromBufferToUtf8(decValue)).toBe(value);
    });
  });

  describe("aesDecryptFast CBC mode", () => {
    it("should successfully decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const iv = Utils.fromBufferToB64(makeStaticByteArray(16));
      const symKey = new SymmetricCryptoKey(makeStaticByteArray(32));
      const data = "ByUF8vhyX4ddU9gcooznwA==";
      const parameters = cryptoFunctionService.aesDecryptFastParameters(data, iv, null, symKey);
      const decValue = await cryptoFunctionService.aesDecryptFast({ mode: "cbc", parameters });
      expect(decValue).toBe("EncryptMe!");
    });
  });

  describe("aesDecryptFast ECB mode", () => {
    it("should successfully decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const key = makeStaticByteArray(32);
      const data = Utils.fromB64ToArray("z5q2XSxYCdQFdI+qK2yLlw==");
      const parameters: EcbDecryptParameters<string> = {
        encKey: Utils.fromBufferToByteString(key),
        data: Utils.fromBufferToByteString(data),
      };
      const decValue = await cryptoFunctionService.aesDecryptFast({ mode: "ecb", parameters });
      expect(decValue).toBe("EncryptMe!");
    });
  });

  describe("aesDecrypt CBC mode", () => {
    it("should successfully decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const iv = makeStaticByteArray(16);
      const key = makeStaticByteArray(32);
      const data = Utils.fromB64ToArray("ByUF8vhyX4ddU9gcooznwA==");
      const decValue = await cryptoFunctionService.aesDecrypt(data, iv, key, "cbc");
      expect(Utils.fromBufferToUtf8(decValue)).toBe("EncryptMe!");
    });

    it("throws if iv is not provided", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const key = makeStaticByteArray(32);
      const data = Utils.fromB64ToArray("ByUF8vhyX4ddU9gcooznwA==");
      await expect(() => cryptoFunctionService.aesDecrypt(data, null, key, "cbc")).rejects.toThrow(
        "IV is required for CBC mode",
      );
    });
  });

  describe("aesDecrypt ECB mode", () => {
    it("should successfully decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const key = makeStaticByteArray(32);
      const data = Utils.fromB64ToArray("z5q2XSxYCdQFdI+qK2yLlw==");
      const decValue = await cryptoFunctionService.aesDecrypt(data, null, key, "ecb");
      expect(Utils.fromBufferToUtf8(decValue)).toBe("EncryptMe!");
    });
  });

  describe("rsaEncrypt", () => {
    it("should successfully encrypt and then decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const pubKey = Utils.fromB64ToArray(RsaPublicKey);
      const privKey = Utils.fromB64ToArray(RsaPrivateKey);
      const value = "EncryptMe!";
      const data = Utils.fromUtf8ToArray(value);
      const encValue = new Uint8Array(await cryptoFunctionService.rsaEncrypt(data, pubKey, "sha1"));
      const decValue = await cryptoFunctionService.rsaDecrypt(encValue, privKey, "sha1");
      expect(Utils.fromBufferToUtf8(decValue)).toBe(value);
    });
  });

  describe("rsaDecrypt", () => {
    it("should successfully decrypt data", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const privKey = Utils.fromB64ToArray(RsaPrivateKey);
      const data = Utils.fromB64ToArray(
        "A1/p8BQzN9UrbdYxUY2Va5+kPLyfZXF9JsZrjeEXcaclsnHurdxVAJcnbEqYMP3UXV" +
          "4YAS/mpf+Rxe6/X0WS1boQdA0MAHSgx95hIlAraZYpiMLLiJRKeo2u8YivCdTM9V5vuAEJwf9Tof/qFsFci3sApdbATkorCT" +
          "zFOIEPF2S1zgperEP23M01mr4dWVdYN18B32YF67xdJHMbFhp5dkQwv9CmscoWq7OE5HIfOb+JAh7BEZb+CmKhM3yWJvoR/D" +
          "/5jcercUtK2o+XrzNrL4UQ7yLZcFz6Bfwb/j6ICYvqd/YJwXNE6dwlL57OfwJyCdw2rRYf0/qI00t9u8Iitw==",
      );
      const decValue = await cryptoFunctionService.rsaDecrypt(data, privKey, "sha1");
      expect(Utils.fromBufferToUtf8(decValue)).toBe("EncryptMe!");
    });
  });

  describe("rsaExtractPublicKey", () => {
    it("should successfully extract key", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const privKey = Utils.fromB64ToArray(RsaPrivateKey);
      const publicKey = await cryptoFunctionService.rsaExtractPublicKey(privKey);
      expect(Utils.fromBufferToB64(publicKey)).toBe(RsaPublicKey);
    });
  });

  describe("rsaGenerateKeyPair", () => {
    testRsaGenerateKeyPair(1024);
    testRsaGenerateKeyPair(2048);

    // Generating 4096 bit keys can be slow. Commenting it out to save CI.
    // testRsaGenerateKeyPair(4096);
  });

  describe("randomBytes", () => {
    it("should make a value of the correct length", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const randomData = await cryptoFunctionService.randomBytes(16);
      expect(randomData.byteLength).toBe(16);
    });

    it("should not make the same value twice", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const randomData = await cryptoFunctionService.randomBytes(16);
      const randomData2 = await cryptoFunctionService.randomBytes(16);
      expect(
        randomData.byteLength === randomData2.byteLength && randomData !== randomData2,
      ).toBeTruthy();
    });
  });

  describe("aesGenerateKey", () => {
    it.each([128, 192, 256, 512])("Should make a key of %s bits long", async (length) => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const key = await cryptoFunctionService.aesGenerateKey(length);
      expect(key.byteLength * 8).toBe(length);
    });

    it("should not repeat itself for 512 length special case", async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const key = await cryptoFunctionService.aesGenerateKey(512);
      expect(key.slice(0, 32)).not.toEqual(key.slice(32, 64));
    });
  });
});

function testPbkdf2(
  algorithm: "sha256" | "sha512",
  regularKey: string,
  utf8Key: string,
  unicodeKey: string,
) {
  const regularEmail = "user@example.com";
  const utf8Email = "üser@example.com";

  const regularPassword = "password";
  const utf8Password = "pǻssword";
  const unicodePassword = "😀password🙏";

  it("should create valid " + algorithm + " key from regular input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.pbkdf2(regularPassword, regularEmail, algorithm, 5000);
    expect(Utils.fromBufferToB64(key)).toBe(regularKey);
  });

  it("should create valid " + algorithm + " key from utf8 input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.pbkdf2(utf8Password, utf8Email, algorithm, 5000);
    expect(Utils.fromBufferToB64(key)).toBe(utf8Key);
  });

  it("should create valid " + algorithm + " key from unicode input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.pbkdf2(unicodePassword, regularEmail, algorithm, 5000);
    expect(Utils.fromBufferToB64(key)).toBe(unicodeKey);
  });

  it("should create valid " + algorithm + " key from array buffer input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.pbkdf2(
      Utils.fromUtf8ToArray(regularPassword),
      Utils.fromUtf8ToArray(regularEmail),
      algorithm,
      5000,
    );
    expect(Utils.fromBufferToB64(key)).toBe(regularKey);
  });
}

function testHkdf(
  algorithm: "sha256" | "sha512",
  regularKey: string,
  utf8Key: string,
  unicodeKey: string,
) {
  const ikm = Utils.fromB64ToArray("criAmKtfzxanbgea5/kelQ==");

  const regularSalt = "salt";
  const utf8Salt = "üser_salt";
  const unicodeSalt = "😀salt🙏";

  const regularInfo = "info";
  const utf8Info = "üser_info";
  const unicodeInfo = "😀info🙏";

  it("should create valid " + algorithm + " key from regular input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.hkdf(ikm, regularSalt, regularInfo, 32, algorithm);
    expect(Utils.fromBufferToB64(key)).toBe(regularKey);
  });

  it("should create valid " + algorithm + " key from utf8 input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.hkdf(ikm, utf8Salt, utf8Info, 32, algorithm);
    expect(Utils.fromBufferToB64(key)).toBe(utf8Key);
  });

  it("should create valid " + algorithm + " key from unicode input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.hkdf(ikm, unicodeSalt, unicodeInfo, 32, algorithm);
    expect(Utils.fromBufferToB64(key)).toBe(unicodeKey);
  });

  it("should create valid " + algorithm + " key from array buffer input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const key = await cryptoFunctionService.hkdf(
      ikm,
      Utils.fromUtf8ToArray(regularSalt),
      Utils.fromUtf8ToArray(regularInfo),
      32,
      algorithm,
    );
    expect(Utils.fromBufferToB64(key)).toBe(regularKey);
  });
}

function testHkdfExpand(
  algorithm: "sha256" | "sha512",
  b64prk: string,
  outputByteSize: number,
  b64ExpectedOkm: string,
) {
  const info = "info";

  it("should create valid " + algorithm + " " + outputByteSize + " byte okm", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const okm = await cryptoFunctionService.hkdfExpand(
      Utils.fromB64ToArray(b64prk),
      info,
      outputByteSize,
      algorithm,
    );
    expect(Utils.fromBufferToB64(okm)).toBe(b64ExpectedOkm);
  });
}

function testHash(
  algorithm: "sha1" | "sha256" | "sha512" | "md5",
  regularHash: string,
  utf8Hash: string,
  unicodeHash: string,
) {
  const regularValue = "HashMe!!";
  const utf8Value = "HǻshMe!!";
  const unicodeValue = "😀HashMe!!!🙏";

  it("should create valid " + algorithm + " hash from regular input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const hash = await cryptoFunctionService.hash(regularValue, algorithm);
    expect(Utils.fromBufferToHex(hash)).toBe(regularHash);
  });

  it("should create valid " + algorithm + " hash from utf8 input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const hash = await cryptoFunctionService.hash(utf8Value, algorithm);
    expect(Utils.fromBufferToHex(hash)).toBe(utf8Hash);
  });

  it("should create valid " + algorithm + " hash from unicode input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const hash = await cryptoFunctionService.hash(unicodeValue, algorithm);
    expect(Utils.fromBufferToHex(hash)).toBe(unicodeHash);
  });

  it("should create valid " + algorithm + " hash from array buffer input", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const hash = await cryptoFunctionService.hash(Utils.fromUtf8ToArray(regularValue), algorithm);
    expect(Utils.fromBufferToHex(hash)).toBe(regularHash);
  });
}

function testHmac(algorithm: "sha1" | "sha256" | "sha512", mac: string) {
  it("should create valid " + algorithm + " hmac", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const computedMac = await cryptoFunctionService.hmac(
      Utils.fromUtf8ToArray("SignMe!!"),
      Utils.fromUtf8ToArray("secretkey"),
      algorithm,
    );
    expect(Utils.fromBufferToHex(computedMac)).toBe(mac);
  });
}

function testHmacFast(algorithm: "sha1" | "sha256" | "sha512", mac: string) {
  it("should create valid " + algorithm + " hmac", async () => {
    const cryptoFunctionService = getWebCryptoFunctionService();
    const keyByteString = Utils.fromBufferToByteString(Utils.fromUtf8ToArray("secretkey"));
    const dataByteString = Utils.fromBufferToByteString(Utils.fromUtf8ToArray("SignMe!!"));
    const computedMac = await cryptoFunctionService.hmacFast(
      dataByteString,
      keyByteString,
      algorithm,
    );
    expect(Utils.fromBufferToHex(Utils.fromByteStringToArray(computedMac))).toBe(mac);
  });
}

function testRsaGenerateKeyPair(length: 1024 | 2048 | 4096) {
  it(
    "should successfully generate a " + length + " bit key pair",
    async () => {
      const cryptoFunctionService = getWebCryptoFunctionService();
      const keyPair = (await cryptoFunctionService.rsaGenerateKeyPair(length)).map(
        (k) => new Uint8Array(k),
      );
      expect(keyPair[0] == null || keyPair[1] == null).toBe(false);
      const publicKey = await cryptoFunctionService.rsaExtractPublicKey(keyPair[1]);
      expect(Utils.fromBufferToB64(keyPair[0])).toBe(Utils.fromBufferToB64(publicKey));
    },
    30000,
  );
}

function getWebCryptoFunctionService() {
  const platformUtilsMock = mock<PlatformUtilsService>();
  platformUtilsMock.isEdge.mockImplementation(() => navigator.userAgent.indexOf(" Edg/") !== -1);

  return new WebCryptoFunctionService(window);
}

function makeStaticByteArray(length: number) {
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = i;
  }
  return arr;
}
