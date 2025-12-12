import { CommonModule } from "@angular/common";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NavigationModule } from "@bitwarden/components";

/**
 * Common imports shared across all vault filter components.
 */
export const VAULT_FILTER_IMPORTS = [CommonModule, JslibModule, NavigationModule] as const;
