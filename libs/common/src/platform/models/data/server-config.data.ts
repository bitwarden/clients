// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { AllowedFeatureFlagTypes } from "../../../enums/feature-flag.enum";
import { Region } from "../../abstractions/environment.service";
import { ServerSettings } from "../domain/server-settings";
import {
  ServerConfigResponse,
  ThirdPartyServerConfigResponse,
  EnvironmentServerConfigResponse,
  PushSettingsConfigResponse,
} from "../response/server-config.response";

export class ServerConfigData {
  version: string;
  gitHash: string;
  server?: ThirdPartyServerConfigData;
  environment?: EnvironmentServerConfigData;
  utcDate: string;
  featureStates: { [key: string]: AllowedFeatureFlagTypes } = {};
  push: PushSettingsConfigData;
  settings: ServerSettings;

  constructor(serverConfigResponse: Partial<ServerConfigResponse>) {
    this.version = serverConfigResponse?.version;
    this.gitHash = serverConfigResponse?.gitHash;
    this.server = serverConfigResponse?.server
      ? new ThirdPartyServerConfigData(serverConfigResponse.server)
      : null;
    this.utcDate = new Date().toISOString();
    this.environment = serverConfigResponse?.environment
      ? new EnvironmentServerConfigData(serverConfigResponse.environment)
      : null;
    this.featureStates = serverConfigResponse?.featureStates;
    this.settings = new ServerSettings(serverConfigResponse.settings);
    this.push = serverConfigResponse?.push
      ? new PushSettingsConfigData(serverConfigResponse.push)
      : null;
  }

  static fromJSON(obj: Jsonify<ServerConfigData>): ServerConfigData {
    return Object.assign(new ServerConfigData({}), obj, {
      server: obj?.server ? ThirdPartyServerConfigData.fromJSON(obj.server) : null,
      environment: obj?.environment ? EnvironmentServerConfigData.fromJSON(obj.environment) : null,
    });
  }
}

export class PushSettingsConfigData {
  pushTechnology: number;
  vapidPublicKey?: string;

  constructor(response: Partial<PushSettingsConfigResponse>) {
    this.pushTechnology = response.pushTechnology;
    this.vapidPublicKey = response.vapidPublicKey;
  }

  static fromJSON(obj: Jsonify<PushSettingsConfigData>): PushSettingsConfigData {
    return Object.assign(new PushSettingsConfigData({}), obj);
  }
}

export class ThirdPartyServerConfigData {
  name: string;
  url: string;

  constructor(response: Partial<ThirdPartyServerConfigResponse>) {
    this.name = response.name;
    this.url = response.url;
  }

  static fromJSON(obj: Jsonify<ThirdPartyServerConfigData>): ThirdPartyServerConfigData {
    return Object.assign(new ThirdPartyServerConfigData({}), obj);
  }
}

export class EnvironmentServerConfigData {
  cloudRegion: Region;
  vault: string;
  api: string;
  identity: string;
  notifications: string;
  sso: string;

  constructor(response: Partial<EnvironmentServerConfigResponse>) {
    this.cloudRegion = response.cloudRegion;
    this.vault = response.vault;
    this.api = response.api;
    this.identity = response.identity;
    this.notifications = response.notifications;
    this.sso = response.sso;
  }

  static fromJSON(obj: Jsonify<EnvironmentServerConfigData>): EnvironmentServerConfigData {
    return Object.assign(new EnvironmentServerConfigData({}), obj);
  }
}
