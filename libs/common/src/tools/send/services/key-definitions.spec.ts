import { SEND_USER_ENCRYPTED, SEND_USER_DECRYPTED } from "./key-definitions";
import { testSendData, testSendViewData } from "./test-data/send-tests.data";

describe("Key definitions", () => {
  describe("SEND_USER_ENCRYPTED", () => {
    it("should pass through deserialization", () => {
      const result = SEND_USER_ENCRYPTED.deserializer(
        JSON.parse(JSON.stringify(testSendData("1", "Test Send Data"))),
      );
      expect(result).toEqual(testSendData("1", "Test Send Data"));
    });
  });

  describe("SEND_USER_DECRYPTED", () => {
    it("should pass through deserialization", () => {
      const sendViews = [testSendViewData("1", "Test Send View")];
      const result = SEND_USER_DECRYPTED.deserializer(JSON.parse(JSON.stringify(sendViews)));
      expect(result).toEqual(sendViews);
    });
  });
});
