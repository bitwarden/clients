import { Observable } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";

import { ServerConfig } from "./server-config";

export abstract class ConfigServiceAbstraction {
  serverConfig$: Observable<ServerConfig | null>;
  fetchServerConfig: () => Promise<ServerConfig>;
  getFeatureFlagBool: (key: FeatureFlag, defaultValue?: boolean) => Promise<boolean>;
  getFeatureFlagString: (key: FeatureFlag, defaultValue?: string) => Promise<string>;
  getFeatureFlagNumber: (key: FeatureFlag, defaultValue?: number) => Promise<number>;
  getCloudRegion: (defaultValue?: string) => Promise<string>;
}
