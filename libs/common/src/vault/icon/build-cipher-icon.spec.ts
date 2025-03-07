import { CipherType } from "../enums";
import { CipherView } from "../models/view/cipher.view";

import { buildCipherIcon } from "./build-cipher-icon";

describe("buildCipherIcon", () => {
  const iconServerUrl = "https://icons.example";
  describe("Login cipher", () => {
    const cipher = {
      type: CipherType.Login,
      login: {
        uri: "https://test.example",
      },
    } as any as CipherView;

    it.each([true, false])("handles android app URIs for showFavicon setting %s", (showFavicon) => {
      setUri("androidapp://test.example");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, showFavicon);

      expect(iconDetails).toEqual({
        icon: "bwi-android",
        image: null,
        fallbackImage: "",
        imageEnabled: showFavicon,
      });
    });

    it("does not mark as an android app if the protocol is not androidapp", () => {
      // This weird URI points to test.androidapp with a default port and path of /.example
      setUri("https://test.androidapp://.example");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: "https://icons.example/test.androidapp/icon.png",
        fallbackImage: "images/bwi-globe.png",
        imageEnabled: true,
      });
    });

    it.each([true, false])("handles ios app URIs for showFavicon setting %s", (showFavicon) => {
      setUri("iosapp://test.example");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, showFavicon);

      expect(iconDetails).toEqual({
        icon: "bwi-apple",
        image: null,
        fallbackImage: "",
        imageEnabled: showFavicon,
      });
    });

    it("does not mark as an ios app if the protocol is not iosapp", () => {
      // This weird URI points to test.iosapp with a default port and path of /.example
      setUri("https://test.iosapp://.example");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: "https://icons.example/test.iosapp/icon.png",
        fallbackImage: "images/bwi-globe.png",
        imageEnabled: true,
      });
    });

    const testUris = ["test.example", "https://test.example"];

    it.each(testUris)("resolves favicon for %s", (uri) => {
      setUri(uri);

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: "https://icons.example/test.example/icon.png",
        fallbackImage: "images/bwi-globe.png",
        imageEnabled: true,
      });
    });

    it.each(testUris)("does not resolve favicon for %s if showFavicon is false", () => {
      setUri("https://test.example");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, false);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: null,
        fallbackImage: "",
        imageEnabled: false,
      });
    });

    it("does not resolve a favicon if the URI is missing a `.`", () => {
      setUri("test");

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: null,
        fallbackImage: "",
        imageEnabled: true,
      });
    });

    it.each(["test.onion", "test.i2p"])("does not resolve a favicon for %s", (uri) => {
      setUri(`https://${uri}`);

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: null,
        fallbackImage: "images/bwi-globe.png",
        imageEnabled: true,
      });
    });

    it.each([null, undefined])("does not resolve a favicon if there is no uri", (nullish) => {
      setUri(nullish as any as string);

      const iconDetails = buildCipherIcon(iconServerUrl, cipher, true);

      expect(iconDetails).toEqual({
        icon: "bwi-globe",
        image: null,
        fallbackImage: "",
        imageEnabled: true,
      });
    });

    function setUri(uri: string) {
      (cipher.login as { uri: string }).uri = uri;
    }
  });
});
