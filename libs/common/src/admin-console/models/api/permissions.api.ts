import { BaseResponse } from "../../../models/response/base.response";

export class PermissionsApi extends BaseResponse {
  accessEventLogs = false;
  accessImportExport = false;
  accessReports = false;
  createNewCollections = false;
  editAnyCollection = false;
  deleteAnyCollection = false;
  manageGroups = false;
  manageSso = false;
  managePolicies = false;
  manageUsers = false;
  manageResetPassword = false;
  manageScim = false;
  manageAccessRules = false;
  manageRotation = false;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return this;
    }
    this.accessEventLogs = this.getResponseProperty("AccessEventLogs");
    this.accessImportExport = this.getResponseProperty("AccessImportExport");
    this.accessReports = this.getResponseProperty("AccessReports");

    this.createNewCollections = this.getResponseProperty("CreateNewCollections");
    this.editAnyCollection = this.getResponseProperty("EditAnyCollection");
    this.deleteAnyCollection = this.getResponseProperty("DeleteAnyCollection");

    this.manageGroups = this.getResponseProperty("ManageGroups");
    this.manageSso = this.getResponseProperty("ManageSso");
    this.managePolicies = this.getResponseProperty("ManagePolicies");
    this.manageUsers = this.getResponseProperty("ManageUsers");
    this.manageResetPassword = this.getResponseProperty("ManageResetPassword");
    this.manageScim = this.getResponseProperty("ManageScim");
    this.manageAccessRules = this.getResponseProperty("ManageAccessRules");
    this.manageRotation = this.getResponseProperty("ManageRotation");
  }
}
