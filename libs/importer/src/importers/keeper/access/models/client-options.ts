import { KeeperRegion } from "../enums";
import { Ui } from "../ui";

export interface ClientOptions {
  region: KeeperRegion;
  ui: Ui;
  /** Offers only the two-factor approval choices the account has, and Keeper DNA when configured.
   *  Off by default, which keeps the fixed list the legacy dialog shows. */
  accountDeviceApproval?: boolean;
}
