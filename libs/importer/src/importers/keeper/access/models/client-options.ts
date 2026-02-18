import { KeeperRegion } from "../enums";
import { Ui } from "../ui";

export interface ClientOptions {
  region: KeeperRegion;
  ui: Ui;

  // Cache for testing. Not needed in production use.
  deviceToken?: string; // Base64
  devicePrivateKey?: string; // Base64
  publicKeyId?: number;
}
