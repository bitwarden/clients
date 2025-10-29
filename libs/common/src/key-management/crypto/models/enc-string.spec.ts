import { EncryptionType } from "../../../platform/enums";

import { EncString } from "./enc-string";

describe("EncString", () => {
  afterEach(() => {
    (window as any).bitwardenContainerService = undefined;
  });

  describe("Rsa2048_OaepSha256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.Rsa2048_OaepSha256_B64, "data");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "3.data",
        encryptionType: 3,
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("3.data")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("3.data|test")).toBe(false);
      });
    });

    describe("parse existing", () => {
      it("valid", () => {
        const encString = new EncString("3.data");

        expect(encString).toEqual({
          data: "data",
          encryptedString: "3.data",
          encryptionType: 3,
        });
      });

      it("invalid", () => {
        const encString = new EncString("3.data|test");

        expect(encString).toEqual({
          encryptedString: "3.data|test",
          encryptionType: 3,
        });
      });

      const cases = [
        "aXY=|Y3Q=", // AesCbc256_B64 w/out header
        "0.QmFzZTY0UGFydA==|QmFzZTY0UGFydA==", // AesCbc256_B64 with header
        "2.QmFzZTY0UGFydA==|QmFzZTY0UGFydA==|QmFzZTY0UGFydA==", // AesCbc256_HmacSha256_B64
        "3.QmFzZTY0UGFydA==", // Rsa2048_OaepSha256_B64
        "4.QmFzZTY0UGFydA==", // Rsa2048_OaepSha1_B64
        "5.QmFzZTY0UGFydA==|QmFzZTY0UGFydA==", // Rsa2048_OaepSha256_HmacSha256_B64
        "6.QmFzZTY0UGFydA==|QmFzZTY0UGFydA==", // Rsa2048_OaepSha1_HmacSha256_B64
      ];

      it.each(cases)("can retrieve data bytes for %s", (encryptedString) => {
        const encString = new EncString(encryptedString);

        const dataBytes = encString.dataBytes;
        expect(dataBytes).not.toBeNull();
        expect(dataBytes.length).toBeGreaterThan(0);
      });
    });
  });

  describe("AesCbc256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data", "iv");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "0.iv|data",
        encryptionType: 0,
        iv: "iv",
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("0.iv|data")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("0.iv|data|mac")).toBe(false);
      });
    });

    describe("parse existing", () => {
      it("valid", () => {
        const encString = new EncString("0.iv|data");

        expect(encString).toEqual({
          data: "data",
          encryptedString: "0.iv|data",
          encryptionType: 0,
          iv: "iv",
        });
      });

      it("invalid", () => {
        const encString = new EncString("0.iv|data|mac");

        expect(encString).toEqual({
          encryptedString: "0.iv|data|mac",
          encryptionType: 0,
        });
      });
    });
  });

  describe("AesCbc256_HmacSha256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "2.iv|data|mac",
        encryptionType: 2,
        iv: "iv",
        mac: "mac",
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("2.iv|data|mac")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("2.iv|data")).toBe(false);
      });

      it("should return false if a null string is passed in", () => {
        // Act
        const result = EncString.isSerializedEncString(null);
        // Assert
        expect(result).toBe(false);
      });

      it("should return false if an error is thrown while parsing the string", () => {
        // Arrange
        const value = "invalid.value";
        // Act
        const result = EncString.isSerializedEncString(value);
        // Assert
        expect(result).toBe(false);
      });

      describe("Access Token Parsing Tests", () => {
        const encryptedAccessToken =
          "2.rFNYSTJoljn8h6GOSNVYdQ==|4dIp7ONJzC+Kx1ClA+1aIAb7EqCQ4OjnADCYdCPg7BKkdheG+yM62ZiONFk+S6at84M+RnGWWO04aIjinTdJhlhyUmszePNATxIfX60Y+bFKQhlMuCtZpYdEmQDzXVgT43YRbf/6NnN9WzhefLqeMiocwoIJTEpLptb+Zcm7T3MJpkX4dR9w5LUOxUTNFEGd5PlWaI8FBavOkNsrzY5skRK70pvFABET5IDeRlKhi8NwbzvTzkO3SisLRzih+djiz5nEZf0+ujeGAp6P+o7l0mB0sXVsNJzcuE4S9QtHLnx31N6z3mQm5pOgP4EmEOdRIcQGc1p7dL1vXcXtaTJLtfKXoJjJbYT3wplnY9Pf8+2FVxdbM3bRB2yVsnEzgLcf9UchKThQSdOy8+5TO/prDbUt5mDpO4GmRltom5ncda8yJaD3Hw1DO7fa0Xh+kfeByxb1AwBC+GTPfqmo5uqr0J4dZsf9cGlPMTElwR3GYmD60OcQ6iDX36CZZjqqJqBwKSpepDXV39p9G347e6YAAvJenLDKtdjgfWXCMXbkwETbMgYooFDRd60KYsGIXV16UwzJSvczgTY2d+hYb2Cl0lClequaiwcRxLVtW2xau6qoEPjTqJjJi9I0Cs2WNL4LRH96Ir14a3bEtnTvkO1NjN+bQNon+KksaP2BqTbuiAfZbBP/cL4S1Oew4G00PSLZUGV5S1BI0ooJy6e2NLQJlYqfCeKM6RgpvgfOiXlZddVgkkB6lohLjyVvcSZNuKPjs1wZMZ9C76bKb6o39NFK8G3/YScELFf9gkueWjmhcjrs22+xNDn5rxXeedwIkVW9UJVNLc//eGxLfp70y8fNDcyTPRN1UUpqT8+wSz+9ZHl4DLUK0DE2jIveEDke8vi4MK/XLMC/c50rr1NCEuVy6iA3nwiOzVo/GNfeKTpzMcR/D9A0gxkC9GyZ3riSsMQsGNXhZCZLdsFYp0gLiiJxVilMUfyTWaygsNm87GPY3ep3GEHcq/pCuxrpLQQYT3V1j95WJvFxb8dSLiPHb8STR0GOZhe7SquI5LIRmYCFTo+3VBnItYeuin9i2xCIqWz886xIyllHN2BIPILbA1lCOsCsz1BRRGNqtLvmTeVRO8iujsHWBJicVgSI7/dgSJwcdOv2t4TIVtnN1hJkQnz+HZcJ2FYK/VWlo4UQYYoML52sBd1sSz/n8/8hrO2N4X9frHHNCrcxeoyChTKo2cm4rAxHylLbCZYvGt/KIW9x3AFkPBMr7tAc3yq98J0Crna8ukXc3F3uGb5QXLnBi//3zBDN6RCv7ByaFW5G0I+pglBegzeFBqKH8xwfy76B2e2VLFF8rz/r/wQzlumGFypsRhAoGxrkZyzjec/k+RNR0arf7TTX7ymC1cueTnItRDx89veW6WLlF53NpAGqC8GJSp4T2FGIIk01y29j6Ji7GOlQ8BUbyLWYjMfHf3khRzAfr6UC2QgVvKWQTKET4Y/b1nZCnwxeW8wC80GHtYGuarsU+KlsEw4242cjyIN1GobrWaA2GTOedQDEMWUA64McAw5fAvMEEao5DM7i57tMzJHeKfruyMuXYQkBca094vmATjJ/T+kIrWGIcmxCT/Fp2SW1hcxr6Ciwuog84LVfbVlUl2MAj3eC/xqL/5HP6Q3ObD0ld444GV+HSrQUqfIvEIn9gFmalW6TGugyhfROACCogoXbeIr1AyMUNDnl4EWlPl6u7SQvPX+itKyq4qhaK2J0W6f7ElLVQ5GbC2uwARuhXOi7mqEZ5FP0V675C5NPZOl2ZEd6BhmuyhGkmQEtEvw0DCKnbKM7bKMk90Y599DSnuEna4BNFBVjJ7k+BuNhXUKO+iNcDZT0pCQhOKRVLWsaqVff3BsuQ4zMEOVnccJwwAVipwSRyxZi8bF+Wyun6BVI8pz1CBvRMy+6ifmIq2awEL8NnV65hF2jyZDEVwsnrvCyT7MlM8l5C3MhqH/MgMcKqOsUz+P6Jv5sBi4WvojsaHzqxQ6miBHpHhGDpYH5K53LVs36henB/tOUTcg5ZnO4ZM67jjB7Oz7to+QnJsldp5Bdwvi1XD/4jeh/Llezu5/KwwytSHnZG1z6dZA7B8rKwnI+yN2Qnfi70h68jzGZ1xCOFPz9KMorNKP3XLw8x2g9H6lEBXdV95uc/TNw+WTJbvKRawns/DZhM1u/g13lU6JG19cht3dh/DlKRcJpj1AdOAxPiUubTSkhBmdwRj2BTTHrVlF3/9ladTP4s4f6Zj9TtQvR9CREVe7CboGflxDYC+Jww3PU50XLmxQjkuV5MkDAmBVcyFCFOcHhDRoxet4FX9ec0wjNeDpYtkI8B/qUS1Rp+is1jOxr4/ni|pabwMkF/SdYKdDlow4uKxaObrAP0urmv7N7fA9bedec=";
        const standardAccessToken =
          "eyJhbGciOiJSUzI1NiIsImtpZCI6IkY5NjBFQzY4RThEMTBDMUEzNEE0OUYwODkwQkExQkExMDk4QUIzMjFSUzI1NiIsIng1dCI6Ii1XRHNhT2pSREJvMHBKOElrTG9ib1FtS3N5RSIsInR5cCI6ImF0K2p3dCJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0IiwibmJmIjoxNzE0NjAwNzI3LCJpYXQiOjE3MTQ2MDA3MjcsImV4cCI6MTcxNDYwNDMyNywic2NvcGUiOlsiYXBpIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbIkFwcGxpY2F0aW9uIl0sImNsaWVudF9pZCI6ImRlc2t0b3AiLCJzdWIiOiJlY2U3MGExMy03MjE2LTQzYzQtOTk3Ny1iMTAzMDE0NmUxZTciLCJhdXRoX3RpbWUiOjE3MTQ2MDA3MjcsImlkcCI6ImJpdHdhcmRlbiIsInByZW1pdW0iOmZhbHNlLCJlbWFpbCI6ImpzbmlkZXJcdTAwMkJsb2NhbEBiaXR3YXJkZW4uY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJzc3RhbXAiOiJHWTdKQU82NENLS1RLQkI2WkVBVVlMMldPUVU3QVNUMiIsIm5hbWUiOiJKYXJlZCBTbmlkZXIgMSIsIm9yZ293bmVyIjpbIjkyYjQ5OTA4LWI1MTQtNDVhOC1iYWRiLWIxMDMwMTQ4ZmU1MyIsIjM4ZWRlMzIyLWI0YjQtNGJkOC05ZTA5LWIxMDcwMTEyZGMxMSIsImIyZDA3MDI4LWE1ODMtNGMzZS04ZDYwLWIxMDcwMTE5OGMyOSIsImJmOTM0YmEyLTBmZDQtNDlmMi1hOTVlLWIxMDcwMTFmYzllNiIsImMwYjdmNzVkLTAxNWYtNDJjOS1iM2E2LWIxMDgwMTc2MDdjYSJdLCJkZXZpY2UiOiIwYmQzZWFmZC0yYjE3LTRiNGItYmUzNS1kMjIxNTE5MTA1ZmUiLCJqdGkiOiI0MEVGNjlEQ0QyNkI4MERDMkJFQ0UwODZDOTIxNDg5OSJ9.pRaZphZ8pygx3gHMdsKnCHWSBFAvm6gJ5aCLKbXIfx6Zc-LtQ_CkjO17rQaXlE4MwDt_n_wMzA38SDG2WzwjJrF3rWziPJrOMEdMGXLvVHyqxh0gcIiAQXZMYq0PdCYPBSDmsRZUZqg5BXFb9ylZjC0-m-EqDgl-i6OfxaHTPBCosX4_fr4bcyZtAaoaSeY4ZWf_1T8HrEzTlEyYKepHFzWdG3e4pJKHfs4sNGfs0uiW1awMqtRIPYI1n1F--oF5Hkm6jUJOdtrCKU0mKntyF4v7YRxgXdxUDqKw08nkk11vdPFVG87kWhR6ARYBWDp4AASy66YewqGhX7BNaekSTqK7DKxzQ9Adiv4XvmNEz3JO8tQrEFfE_mz9-WZiS6PlUipCxW-UtFp093_gHZh9_xgbuTdaO1u5_8Y42v0V_69v9WgzCGQGEWZ3PPaJsARGDO7FVKdPxP2S2lWIu22gydNHhfDZrOpBGHD1FpByfd5DbhKk0JdhHEPObs8RwNEweK-jlKmQpc_8bnhXFRUeMFrDL2Q2pNrYcDOpF1crIePPcWBk2_YdcWTqYVnGewT0toJ8sGlaAuAe6uOUZkBG3sxkOttkLYQtkxJYqt54gjazJ0N0GxAc0UBUDt0JnuLqk-cuxXiQO2_vHomTf7dilPq8fvqffrtrISxDVZenceg";

        it("should return false if a non-encrypted string is passed in", () => {
          // Act
          const result = EncString.isSerializedEncString(standardAccessToken);
          // Assert
          expect(result).toBe(false);
        });

        it("should return true if an encrypted string is passed in", () => {
          // Act
          const result = EncString.isSerializedEncString(encryptedAccessToken);
          // Assert
          expect(result).toBe(true);
        });
      });
    });

    it("valid", () => {
      const encString = new EncString("2.iv|data|mac");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "2.iv|data|mac",
        encryptionType: 2,
        iv: "iv",
        mac: "mac",
      });
    });

    it("invalid", () => {
      const encString = new EncString("2.iv|data");

      expect(encString).toEqual({
        encryptedString: "2.iv|data",
        encryptionType: 2,
      });
    });
  });

  it("Exit early if null", () => {
    const encString = new EncString(null);

    expect(encString).toEqual({
      encryptedString: null,
    });
  });

  describe("toJSON", () => {
    it("Should be represented by the encrypted string", () => {
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data", "iv");

      expect(encString.toJSON()).toBe(encString.encryptedString);
    });

    it("returns null if object is null", () => {
      expect(EncString.fromJSON(null)).toBeNull();
    });
  });
});
