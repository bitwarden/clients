import { KeeperRegion } from "../../importers/keeper/access";

/** Display labels for the `KeeperRegion` dropdown — shared by `ImportKeeperComponent` (the
 *  legacy dropdown's Keeper sub-form) and `ImportControlsComponent` (the new picker-driven flow) */
export const KEEPER_REGION_OPTIONS: readonly { value: KeeperRegion; label: string }[] = [
  { value: KeeperRegion.Us, label: "US" },
  { value: KeeperRegion.Eu, label: "EU" },
  { value: KeeperRegion.Au, label: "AU" },
  { value: KeeperRegion.Ca, label: "CA" },
  { value: KeeperRegion.Jp, label: "JP" },
  { value: KeeperRegion.UsGov, label: "US (GOV)" },
];
