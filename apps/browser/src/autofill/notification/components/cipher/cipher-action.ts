import { Theme } from "@bitwarden/common/platform/enums";

import { BadgeButton } from "../buttons/badge-button";
import { PencilSquare } from "../icons";

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
  return notificationType === "add"
    ? BadgeButton({
        buttonAction: handleAction,
        // @TODO localize
        buttonText: "Update",
        theme,
      })
    : notificationType === "update"
      ? PencilSquare({ theme }) // @TODO add handleAction
      : null; // @TODO null case should be handled by parent
}
