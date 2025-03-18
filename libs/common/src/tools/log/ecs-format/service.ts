import { EcsFormat } from "./core";

export type ServiceFormat = EcsFormat & {
  /** documents the program providing the log */
  service: {
    /** Which kind of client is it?
     *  @remarks this contains the output of `BrowserPlatformUtilsService.getDeviceString()` in practice.
     */
    name: string;

    /** identifies the service as a type of client device  */
    type: "client";

    /** Information about the instance of the service providing the log */
    node: {
      /** a unique identifier(s) for this client installation  */
      name: string;
    };
    /** The environment to which the client was connected */
    environment: "production" | "testing" | "development" | "local";

    /** the unique identifier(s) for this client installation  */
    version: string;
  };
};
