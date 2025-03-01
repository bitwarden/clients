import { PushTechnology } from "../../../enums/push-technology.enum";
import { Region } from "../../abstractions/environment.service";

import {
  EnvironmentServerConfigData,
  ServerConfigData,
  ThirdPartyServerConfigData,
} from "./server-config.data";

describe("ServerConfigData", () => {
  describe("fromJSON", () => {
    it("should create a ServerConfigData from a JSON object", () => {
      const json = {
        version: "1.0.0",
        gitHash: "1234567890",
        server: {
          name: "test",
          url: "https://test.com",
        },
        settings: {
          disableUserRegistration: false,
        },
        environment: {
          cloudRegion: Region.EU,
          vault: "https://vault.com",
          api: "https://api.com",
          identity: "https://identity.com",
          notifications: "https://notifications.com",
          sso: "https://sso.com",
        },
        utcDate: "2020-01-01T00:00:00.000Z",
        featureStates: { feature: "state" },
        push: {
          pushTechnology: PushTechnology.SignalR,
        },
      };
      const serverConfigData = ServerConfigData.fromJSON(json);

      expect(serverConfigData).toEqual(json);
    });

    it("should be an instance of ServerConfigData", () => {
      const serverConfigData = ServerConfigData.fromJSON({} as any);

      expect(serverConfigData).toBeInstanceOf(ServerConfigData);
    });

    it("should deserialize sub objects", () => {
      const serverConfigData = ServerConfigData.fromJSON({
        server: {},
        environment: {},
      } as any);

      expect(serverConfigData.server).toBeInstanceOf(ThirdPartyServerConfigData);
      expect(serverConfigData.environment).toBeInstanceOf(EnvironmentServerConfigData);
    });
  });
});
