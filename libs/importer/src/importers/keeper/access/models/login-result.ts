import { KeeperKey } from "./crypto-types";
import { SessionToken } from "./token-types";

export interface LoginResult {
  sessionToken: SessionToken;
  dataKey: KeeperKey;
}
