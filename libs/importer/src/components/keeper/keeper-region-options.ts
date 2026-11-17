import { KeeperRegion } from "../../importers/keeper/access";

/** Display labels for the `KeeperRegion` dropdown in the picker-driven import flow
 *  (`ImportControlsKeeperCredentialsComponent`). */
export const KEEPER_REGION_OPTIONS: readonly { value: KeeperRegion; label: string }[] = [
  { value: KeeperRegion.Us, label: "US" },
  { value: KeeperRegion.Eu, label: "EU" },
  { value: KeeperRegion.Au, label: "AU" },
  { value: KeeperRegion.Ca, label: "CA" },
  { value: KeeperRegion.Jp, label: "JP" },
  { value: KeeperRegion.UsGov, label: "US (GOV)" },
];
