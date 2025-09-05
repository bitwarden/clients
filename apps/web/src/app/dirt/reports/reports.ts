import {
  MemberAccess,
  ReportBreach,
  ReportExposedPasswords,
  ReportInactiveTwoFactor,
  ReportReusedPasswords,
  ReportUnsecuredWebsites,
  ReportWeakPasswords,
} from "@bitwarden/assets/svg";

import { ReportEntry } from "./shared";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ReportType {
  ExposedPasswords = "exposedPasswords",
  ReusedPasswords = "reusedPasswords",
  WeakPasswords = "weakPasswords",
  UnsecuredWebsites = "unsecuredWebsites",
  Inactive2fa = "inactive2fa",
  DataBreach = "dataBreach",
  MemberAccessReport = "memberAccessReport",
}

type ReportWithoutVariant = Omit<ReportEntry, "variant">;

export const reports: Record<ReportType, ReportWithoutVariant> = {
  [ReportType.ExposedPasswords]: {
    title: "exposedPasswordsReport",
    description: "exposedPasswordsReportDesc",
    route: "exposed-passwords-report",
    icon: ReportExposedPasswords,
  },
  [ReportType.ReusedPasswords]: {
    title: "reusedPasswordsReport",
    description: "reusedPasswordsReportDesc",
    route: "reused-passwords-report",
    icon: ReportReusedPasswords,
  },
  [ReportType.WeakPasswords]: {
    title: "weakPasswordsReport",
    description: "weakPasswordsReportDesc",
    route: "weak-passwords-report",
    icon: ReportWeakPasswords,
  },
  [ReportType.UnsecuredWebsites]: {
    title: "unsecuredWebsitesReport",
    description: "unsecuredWebsitesReportDesc",
    route: "unsecured-websites-report",
    icon: ReportUnsecuredWebsites,
  },
  [ReportType.Inactive2fa]: {
    title: "inactive2faReport",
    description: "inactive2faReportDesc",
    route: "inactive-two-factor-report",
    icon: ReportInactiveTwoFactor,
  },
  [ReportType.DataBreach]: {
    title: "dataBreachReport",
    description: "breachDesc",
    route: "breach-report",
    icon: ReportBreach,
  },
  [ReportType.MemberAccessReport]: {
    title: "memberAccessReport",
    description: "memberAccessReportDesc",
    route: "member-access-report",
    icon: MemberAccess,
  },
};
