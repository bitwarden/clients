import { ReportBreach } from "./icons/report-breach.icon";
import { ReportExposedPasswords } from "./icons/report-exposed-passwords.icon";
import { ReportInactiveTwoFactor } from "./icons/report-inactive-two-factor.icon";
import { MemberAccess } from "./icons/report-member-access.icon";
import { ReportReusedPasswords } from "./icons/report-reused-passwords.icon";
import { ReportUnsecuredWebsites } from "./icons/report-unsecured-websites.icon";
import { ReportWeakPasswords } from "./icons/report-weak-passwords.icon";
import { ReportEntry } from "./shared";

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
