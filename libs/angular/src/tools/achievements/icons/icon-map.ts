import { Icon } from "@bitwarden/components";

import { CardItemCreatedIcon, ThreeItemsCreatedIcon, TenItemsCreatedIcon } from "./card";
import { OneIdentityItemCreatedIcon } from "./identity";
import {
  OneLoginItemCreatedIcon,
  TenLoginItemsCreatedIcon,
  FiftyLoginItemsCreatedIcon,
  OneHundredLoginItemsCreatedIcon,
} from "./login";
import { OneSecureNoteCreatedIcon } from "./notes";

export const iconMap: { [key: string]: Icon } = {
  // Login items
  "login-item-created": OneLoginItemCreatedIcon,
  "10-login-items-added": TenLoginItemsCreatedIcon,
  "50-login-items-added": FiftyLoginItemsCreatedIcon,
  "login-item-created-one-hundred": OneHundredLoginItemsCreatedIcon,
  // Card items
  "card-item-created": CardItemCreatedIcon,
  "card-item-created-3": ThreeItemsCreatedIcon,
  "card-item-created-10": TenItemsCreatedIcon,
  // Identity items
  "identity-item-created": OneIdentityItemCreatedIcon,
  // Note items
  "note-item-created": OneSecureNoteCreatedIcon,
};
