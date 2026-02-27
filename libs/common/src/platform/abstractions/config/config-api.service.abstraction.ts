import { UserId } from "../../../types/guid";
import { ServerConfigResponse } from "../../models/response/server-config.response";

export abstract class ConfigApiServiceAbstraction {
  /**
   * Fetches the server configuration for the given user. If no user is provided, the configuration will not contain user-specific context.
   */
  abstract get(userId: UserId | null): Promise<ServerConfigResponse>;
}
