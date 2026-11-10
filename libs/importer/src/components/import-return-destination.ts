import { Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

/** A button on the import's result dialog that leads back to where the import was started from. */
export interface ImportReturnDestination {
  returnUrl: string;
  returnLabel: string;
}

/** The result dialog's return button for an organization import started from a page that passed
 *  `returnTo`. Anything else, including an unknown `returnTo`, gets no button. */
export function resolveImportReturnDestination(
  returnTo: string | undefined,
  organizationId: OrganizationId | undefined,
  router: Router,
  i18nService: I18nService,
): ImportReturnDestination | undefined {
  if (returnTo == null || organizationId == null) {
    return undefined;
  }
  // A Map, not an object: `returnTo` comes from the URL, and an object would also answer to
  // inherited names such as `__proto__`.
  const destinations = new Map<string, () => ImportReturnDestination>([
    [
      "access-intelligence",
      () => ({
        returnUrl: router.serializeUrl(
          router.createUrlTree(["/organizations", organizationId, "access-intelligence"], {
            queryParams: { source: "import", status: "success" },
          }),
        ),
        returnLabel: i18nService.t("goToAccessIntelligence"),
      }),
    ],
  ]);
  return destinations.get(returnTo)?.();
}
