import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../buttons/badge-button";
import { EditButton } from "../buttons/edit-button";

export function CipherAction({
  handleAction = () => {
    /* no-op */
  },
  notificationType,
  theme,
}: {
  handleAction?: (e: Event) => void;
  notificationType: string;
  theme: Theme;
}) {
  return notificationType === "update"
    ? BadgeButton({
        buttonAction: handleAction,
        // @TODO localize
        buttonText: "Update item",
        theme,
      })
    : notificationType === "add"
      ? EditButton({
          buttonAction: handleAction,
          // @TODO localize
          buttonText: "Edit item",
          theme,
        }) // @TODO add handleAction
      : null; // @TODO null case should be handled by parent
}
