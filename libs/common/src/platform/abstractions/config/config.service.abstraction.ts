import { Observable } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { Region } from "../environment.service";

import { ServerConfig } from "./server-config";

export abstract class ConfigServiceAbstraction {
  serverConfig$: Observable<ServerConfig | null>;
  cloudRegion$: Observable<Region>;
  getFeatureFlag$: <T extends boolean | number | string>(
    key: FeatureFlag,
    defaultValue?: T
  ) => Observable<T>;
  getFeatureFlag: <T extends boolean | number | string>(
    key: FeatureFlag,
    defaultValue?: T
  ) => Promise<T>;

  /**
   * Force ConfigService to fetch an updated config from the server and emit it from serverConfig$
   * @deprecated The service implementation should subscribe to an observable and use that to trigger a new fetch from
   * server instead
   */
  triggerServerConfigFetch: () => void;
}
