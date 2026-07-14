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
  }
}
