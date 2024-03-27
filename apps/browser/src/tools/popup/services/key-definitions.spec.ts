import { Jsonify } from "type-fest";

import { SendType } from "@bitwarden/common/tools/send/enums/send-type";

import { BrowserSendComponentState } from "../../../models/browserSendComponentState";

import { BROWSER_SEND_COMPONENT, BROWSER_SEND_TYPE_COMPONENT } from "./key-definitions";

describe("Key definitions", () => {
  describe("BROWSER_SEND_COMPONENT", () => {
    it("should deserialize BrowserSendComponentState", () => {
      const keyDef = BROWSER_SEND_COMPONENT;

      const expectedState = {
        typeCounts: new Map<SendType, number>(),
      };

      const result = keyDef.deserializer(
        JSON.parse(JSON.stringify(expectedState)) as Jsonify<BrowserSendComponentState>,
      );

      expect(result).toEqual(expectedState);
    });
  });

  describe("BROWSER_SEND_TYPE_COMPONENT", () => {
    it("should deserialize BrowserComponentState", () => {
      const keyDef = BROWSER_SEND_TYPE_COMPONENT;

      const expectedState = {
        scrollY: 0,
        searchText: "test",
      };

      const result = keyDef.deserializer(JSON.parse(JSON.stringify(expectedState)));

      expect(result).toEqual(expectedState);
    });
  });
});
