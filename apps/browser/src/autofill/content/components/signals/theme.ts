import {signal} from '@lit-labs/signals';

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

export const theme = signal<Theme>(ThemeTypes.Light);
