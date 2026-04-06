// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

export class PermissionsApi extends BaseResponse {
  accessEventLogs: boolean;
  accessImportExport: boolean;
  accessReports: boolean;
  createNewCollections: boolean;
  editAnyCollection: boolean;
  deleteAnyCollection: boolean;
  manageCiphers: boolean;
  manageGroups: boolean;
  manageSso: boolean;
  managePolicies: boolean;
  manageUsers: boolean;
  manageResetPassword: boolean;
  manageScim: boolean;

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

    this.manageCiphers = this.getResponseProperty("ManageCiphers");
    this.manageGroups = this.getResponseProperty("ManageGroups");
    this.manageSso = this.getResponseProperty("ManageSso");
    this.managePolicies = this.getResponseProperty("ManagePolicies");
    this.manageUsers = this.getResponseProperty("ManageUsers");
    this.manageResetPassword = this.getResponseProperty("ManageResetPassword");
    this.manageScim = this.getResponseProperty("ManageScim");
  }
}
