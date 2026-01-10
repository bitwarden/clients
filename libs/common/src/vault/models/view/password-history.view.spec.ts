import { PasswordHistoryView as SdkPasswordHistoryView } from "@bitwarden/sdk-internal";

import { PasswordHistoryView } from "./password-history.view";

describe("PasswordHistoryView", () => {
  it("fromJSON initializes nested objects", () => {
    const lastUsedDate = new Date();

    const actual = PasswordHistoryView.fromJSON({
      lastUsedDate: lastUsedDate.toISOString(),
    });

    expect(actual.lastUsedDate).toEqual(lastUsedDate);
  });

  describe("fromSdkPasswordHistoryView", () => {
    it("should return undefined when the input is null", () => {
      const result = PasswordHistoryView.fromSdkPasswordHistoryView(null as unknown as any);
      expect(result).toBeUndefined();
    });

    it("should return a PasswordHistoryView from an SdkPasswordHistoryView", () => {
      const sdkPasswordHistoryView = {
        password: "password",
        lastUsedDate: "2023-10-01T00:00:00Z",
      } as SdkPasswordHistoryView;

      const result = PasswordHistoryView.fromSdkPasswordHistoryView(sdkPasswordHistoryView);

      expect(result).toMatchObject({
        password: "password",
        lastUsedDate: new Date("2023-10-01T00:00:00Z"),
      });
    });
  });

  describe("toSdkPasswordHistoryView", () => {
    it("should return a SdkPasswordHistoryView", () => {
      const passwordHistoryView = new PasswordHistoryView();
      passwordHistoryView.password = "password";
      passwordHistoryView.lastUsedDate = new Date("2023-10-01T00:00:00.000Z");

      expect(passwordHistoryView.toSdkPasswordHistoryView()).toMatchObject({
        password: "password",
        lastUsedDate: "2023-10-01T00:00:00.000Z",
      });
    });
  });
});
