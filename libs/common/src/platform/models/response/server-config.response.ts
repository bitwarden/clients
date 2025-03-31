// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AllowedFeatureFlagTypes } from "../../../enums/feature-flag.enum";
import { BaseResponse } from "../../../models/response/base.response";
import { Region } from "../../abstractions/environment.service";
import { ServerSettings } from "../domain/server-settings";

export class ServerConfigResponse extends BaseResponse {
  version: string;
  gitHash: string;
  server: ThirdPartyServerConfigResponse;
  environment: EnvironmentServerConfigResponse;
  featureStates: { [key: string]: AllowedFeatureFlagTypes } = {};
  push: PushSettingsConfigResponse;
  settings: ServerSettings;

  constructor(response: any) {
    super(response);

    if (response == null) {
      return;
    }

    this.version = this.getResponseProperty("Version");
    this.gitHash = this.getResponseProperty("GitHash");
    this.server = new ThirdPartyServerConfigResponse(this.getResponseProperty("Server"));
    this.environment = new EnvironmentServerConfigResponse(this.getResponseProperty("Environment"));
    this.featureStates = this.getResponseProperty("FeatureStates");
    this.push = new PushSettingsConfigResponse(this.getResponseProperty("Push"));
    this.settings = new ServerSettings(this.getResponseProperty("Settings"));
  }
}

export class PushSettingsConfigResponse extends BaseResponse {
  pushTechnology: number;
  vapidPublicKey: string;

  constructor(data: any = null) {
    super(data);

    if (data == null) {
      return;
    }

    this.pushTechnology = this.getResponseProperty("PushTechnology");
    this.vapidPublicKey = this.getResponseProperty("VapidPublicKey");
  }
}

export class EnvironmentServerConfigResponse extends BaseResponse {
  cloudRegion: Region;
  vault: string;
  api: string;
  identity: string;
  notifications: string;
  sso: string;

  constructor(data: any = null) {
    super(data);

    if (data == null) {
      return;
    }

    this.cloudRegion = this.getResponseProperty("CloudRegion");
    this.vault = this.getResponseProperty("Vault");
    this.api = this.getResponseProperty("Api");
    this.identity = this.getResponseProperty("Identity");
    this.notifications = this.getResponseProperty("Notifications");
    this.sso = this.getResponseProperty("Sso");
  }
}

export class ThirdPartyServerConfigResponse extends BaseResponse {
  name: string;
  url: string;

  constructor(data: any = null) {
    super(data);

    if (data == null) {
      return;
    }

    this.name = this.getResponseProperty("Name");
    this.url = this.getResponseProperty("Url");
  }
}
