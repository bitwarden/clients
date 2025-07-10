import { Icon } from "@bitwarden/components";

import { ReportVariant } from "./report-variant";

export type ReportEntry = {
  title: string;
  description: string;
  route: string;
  icon: Icon;
  variant: ReportVariant;
};
