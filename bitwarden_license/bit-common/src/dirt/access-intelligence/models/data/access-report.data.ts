import { AccessReportApi } from "../api/access-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReport } from "../domain/access-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportView } from "../view/access-report.view";

/**
 * Serializable data model for the access report
 *
 * - See {@link AccessReport} for domain model
 * - See {@link AccessReportApi} for API model
 * - See {@link AccessReportView} from View Model
 */
export class AccessReportData {
  id: string = "";
  organizationId: string = "";
  reports: string = "";
  applications: string = "";
  summary: string = "";
  //  [TODO] Update types when individual values are encrypted instead of the entire object
  //  reports: ApplicationHealthData[]; // Previously ApplicationHealthReportDetail Data type
  //  applications: AccessReportSettingsData[]; // Previously OrganizationReportApplication Data type
  //  summary: AccessReportSummaryData; // Previously OrganizationReportSummary Data type
  creationDate: string = "";
  contentEncryptionKey: string = "";

  constructor(response?: AccessReportApi) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.organizationId = response.organizationId;
    this.reports = response.reports;
    this.applications = response.applications;
    this.summary = response.summary;
    this.creationDate = response.creationDate;
    this.contentEncryptionKey = response.contentEncryptionKey;

    //  [TODO] Update types when individual values are encrypted instead of the entire object
    //  this.summary = new AccessReportSummaryData(response.summaryData);
    //  if (response.reports != null) {
    //    this.reports = response.reports.map((r) => new ApplicationHealthData(r));
    //  }
    //  if (response.applications != null) {
    //    this.applications = response.applications.map((a) => new AccessReportSettingsData(a));
    //  }
  }
}
