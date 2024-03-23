import { BaseResponse } from "../../../models/response/base.response";
import { Region } from "../../abstractions/environment.service";

export class ServerConfigResponse extends BaseResponse {
  version: string;
  gitHash: string;
  server: ThirdPartyServerConfigResponse;
  environment: EnvironmentServerConfigResponse;
  featureStates: { [key: string]: string } = {};

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
  }
}

export class EnvironmentServerConfigResponse extends BaseResponse {
  cloudRegion: Region;
  vault: string;
  api: string;
  identity: string;
  notifications: string;
  sso: string;
  disableUserRegistration: boolean;

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
    this.disableUserRegistration = this.getResponseProperty("DisableUserRegistration");
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
