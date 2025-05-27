import { RawBadgeState } from "./badge-browser-api";
import { BadgeIcon } from "./icon";
import { BadgeState } from "./state";

export const DefaultBadgeState: RawBadgeState & BadgeState = {
  text: "",
  backgroundColor: "#294e5f",
  icon: BadgeIcon.LoggedOut,
};
