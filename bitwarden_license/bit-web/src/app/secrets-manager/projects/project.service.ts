// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import { ProjectListView } from "../models/view/project-list.view";
import { ProjectView } from "../models/view/project.view";
import { BulkOperationStatus } from "../shared/dialogs/bulk-status-dialog.component";

import { ProjectRequest } from "./models/requests/project.request";
import { ProjectListItemResponse } from "./models/responses/project-list-item.response";
import { ProjectResponse } from "./models/responses/project.response";

@Injectable({
  providedIn: "root",
})
export class ProjectService {
  protected _project = new Subject<ProjectView>();
  project$ = this._project.asObservable();

  constructor(
    private keyService: KeyService,
    private apiService: ApiService,
    private encryptService: EncryptService,
  ) {}

  async getByProjectId(projectId: string): Promise<ProjectView> {
    const r = await this.apiService.send("GET", "/projects/" + projectId, null, true, true);
    const projectResponse = new ProjectResponse(r);
    return await this.createProjectView(projectResponse);
  }

  async getProjects(organizationId: string): Promise<ProjectListView[]> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/projects",
      null,
      true,
      true,
    );
    const results = new ListResponse(r, ProjectListItemResponse);
    return await this.createProjectsListView(organizationId, results.data);
  }

  async create(organizationId: string, projectView: ProjectView): Promise<ProjectView> {
    const request = await this.getProjectRequest(organizationId, projectView);
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/projects",
      request,
      true,
      true,
    );

    const project = await this.createProjectView(new ProjectResponse(r));
    this._project.next(project);
    return project;
  }

  async update(organizationId: string, projectView: ProjectView) {
    const request = await this.getProjectRequest(organizationId, projectView);
    const r = await this.apiService.send("PUT", "/projects/" + projectView.id, request, true, true);
    this._project.next(await this.createProjectView(new ProjectResponse(r)));
  }

  async delete(projects: ProjectListView[]): Promise<BulkOperationStatus[]> {
    const projectIds = projects.map((project) => project.id);
    const r = await this.apiService.send("POST", "/projects/delete", projectIds, true, true);
    this._project.next(null);
    return r.data.map((element: { id: string; error: string }) => {
      const bulkOperationStatus = new BulkOperationStatus();
      bulkOperationStatus.id = element.id;
      bulkOperationStatus.name = projects.find((project) => project.id == element.id).name;
      bulkOperationStatus.errorMessage = element.error;
      return bulkOperationStatus;
    });
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await this.keyService.getOrgKey(organizationId);
  }

  private async getProjectRequest(
    organizationId: string,
    projectView: ProjectView,
  ): Promise<ProjectRequest> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const request = new ProjectRequest();
    request.name = await this.encryptService.encrypt(projectView.name, orgKey);

    return request;
  }

  private async createProjectView(projectResponse: ProjectResponse) {
    const orgKey = await this.getOrganizationKey(projectResponse.organizationId);

    const projectView = new ProjectView();
    projectView.id = projectResponse.id;
    projectView.organizationId = projectResponse.organizationId;
    projectView.creationDate = projectResponse.creationDate;
    projectView.revisionDate = projectResponse.revisionDate;
    projectView.read = projectResponse.read;
    projectView.write = projectResponse.write;
    projectView.name = await this.encryptService.decryptToUtf8(
      new EncString(projectResponse.name),
      orgKey,
    );
    return projectView;
  }

  private async createProjectsListView(
    organizationId: string,
    projects: ProjectListItemResponse[],
  ): Promise<ProjectListView[]> {
    const orgKey = await this.getOrganizationKey(organizationId);
    return await Promise.all(
      projects.map(async (s: ProjectListItemResponse) => {
        const projectListView = new ProjectListView();
        projectListView.id = s.id;
        projectListView.organizationId = s.organizationId;
        projectListView.read = s.read;
        projectListView.write = s.write;
        projectListView.name = await this.encryptService.decryptToUtf8(
          new EncString(s.name),
          orgKey,
        );
        projectListView.creationDate = s.creationDate;
        projectListView.revisionDate = s.revisionDate;
        projectListView.linkable = true;
        return projectListView;
      }),
    );
  }
}
