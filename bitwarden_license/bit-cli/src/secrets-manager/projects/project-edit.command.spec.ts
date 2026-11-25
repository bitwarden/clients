import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { ProjectEditCommand } from "./project-edit.command";

describe("ProjectEditCommand", () => {
  const projectService = mock<ProjectService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  let command: ProjectEditCommand;

  const makeProject = (overrides: Partial<ProjectView> = {}) =>
    Object.assign(new ProjectView(), {
      id: projectId,
      organizationId: smOrgId,
      name: "Backend",
      write: true,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ProjectEditCommand(projectService);
  });

  it("renames the project", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject());
    projectService.update.mockResolvedValue(makeProject({ name: "Frontend" }));

    const response = await command.run(
      smOrg,
      projectId.toUpperCase(),
      encodeSmRequest({ name: "Frontend" }),
    );

    expect(response.success).toBe(true);
    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(projectService.update).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ id: projectId, organizationId: smOrgId, name: "Frontend" }),
    );
    expect(response.data).toMatchObject({ object: "sm-project", name: "Frontend" });
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, "abc", { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("treats a project from another organization as not found", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject({ organizationId: smOtherOrgId }));

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
    expect(projectService.update).not.toHaveBeenCalled();
  });

  it("rejects a project the user cannot write", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject({ write: false }));

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(projectService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, projectId, { name: "Frontend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });

  describe("read-only properties", () => {
    const getBody = () => ({
      object: "sm-project",
      id: projectId,
      organizationId: smOrgId,
      name: "Backend",
      creationDate: "2024-01-01T00:00:00Z",
      revisionDate: "2024-01-02T00:00:00Z",
      read: true,
      write: true,
      decryptionError: false,
    });

    beforeEach(() => {
      projectService.getByProjectId.mockResolvedValue(
        makeProject({
          creationDate: "2024-01-01T00:00:00Z",
          revisionDate: "2024-01-02T00:00:00Z",
          read: true,
          write: true,
          decryptionError: false,
        }),
      );
      projectService.update.mockResolvedValue(makeProject({ name: "Frontend" }));
    });

    it("renames from a template-shaped body", async () => {
      const response = await command.run(smOrg, projectId, {
        organizationId: null,
        name: "Frontend",
      });

      expect(response.success).toBe(true);
    });

    it("rejects a creationDate added to the template and saves nothing", async () => {
      const response = await command.run(
        smOrg,
        projectId,
        encodeSmRequest({
          organizationId: null,
          name: "Project name",
          creationDate: "2026-11-17T04:22:34.0716668Z",
        }),
      );

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`creationDate` cannot be edited on a project. Remove this property from the request.",
      );
      expect(projectService.update).not.toHaveBeenCalled();
    });

    it("renames from a full get-shaped body", async () => {
      const response = await command.run(
        smOrg,
        projectId,
        encodeSmRequest({ ...getBody(), name: "Frontend" }),
      );

      expect(response.success).toBe(true);
      expect(projectService.update).toHaveBeenCalledWith(
        smOrgId,
        expect.objectContaining({ id: projectId, name: "Frontend" }),
      );
    });

    it.each([
      ["object", { object: "sm-secret" }],
      ["id", { id: "33333333-3333-3333-3333-333333333333" }],
      ["creationDate", { creationDate: "2026-11-17T04:22:34.0716668Z" }],
      ["revisionDate", { revisionDate: "2026-11-17T04:22:34.0716668Z" }],
      ["read", { read: false }],
      ["write", { write: false }],
      ["decryptionError", { decryptionError: true }],
      ["accessToSecrets", { accessToSecrets: 1 }],
    ])("rejects a changed %s and saves nothing", async (property, change) => {
      const response = await command.run(smOrg, projectId, {
        ...getBody(),
        name: "Renamed",
        ...change,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`" + property + "` cannot be edited on a project. Remove this property from the request.",
      );
      expect(projectService.update).not.toHaveBeenCalled();
    });

    it("rejects a read-only value of a different type", async () => {
      const response = await command.run(smOrg, projectId, {
        name: "Renamed",
        write: "true",
        read: true,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`write` cannot be edited on a project. Remove this property from the request.",
      );
      expect(projectService.update).not.toHaveBeenCalled();
    });

    it("reports missing edit permission before read-only properties", async () => {
      projectService.getByProjectId.mockResolvedValue(makeProject({ read: true, write: false }));

      for (const write of [false, true]) {
        const response = await command.run(smOrg, projectId, {
          ...getBody(),
          read: true,
          write,
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe(Response.noEditPermission().message);
      }
      expect(projectService.update).not.toHaveBeenCalled();
    });

    it("accepts a body without read or write", async () => {
      const response = await command.run(smOrg, projectId, { name: "Frontend" });

      expect(response.success).toBe(true);
    });

    it.each([true, false])(
      "rejects decryptionError %p when it differs from the project's and saves nothing",
      async (decryptionError) => {
        projectService.getByProjectId.mockResolvedValue(
          makeProject({ read: true, write: true, decryptionError: !decryptionError }),
        );

        const response = await command.run(
          smOrg,
          projectId,
          encodeSmRequest({ organizationId: null, name: "Project name", decryptionError }),
        );

        expect(response.success).toBe(false);
        expect(response.message).toBe(
          "`decryptionError` cannot be edited on a project. Remove this property from the request.",
        );
        expect(projectService.update).not.toHaveBeenCalled();
      },
    );
  });

  describe("unknown properties", () => {
    beforeEach(() => {
      projectService.getByProjectId.mockResolvedValue(makeProject());
      projectService.update.mockResolvedValue(makeProject({ name: "Project name" }));
    });

    // QA repro: bw sm template sm-project | jq '.decryptError=true' | bw encode | bw sm project edit
    it.each([true, false])(
      "rejects decryptError %p added to the template and saves nothing",
      async (decryptError) => {
        const response = await command.run(
          smOrg,
          projectId,
          encodeSmRequest({ organizationId: null, name: "Project name", decryptError }),
        );

        expect(response.success).toBe(false);
        expect(response.message).toBe(
          "`decryptError` is not a project property. Remove this property from the request. Properties that can be edited on a project: `name`.",
        );
        expect(projectService.getByProjectId).not.toHaveBeenCalled();
        expect(projectService.update).not.toHaveBeenCalled();
      },
    );

    it("names every unknown property", async () => {
      const response = await command.run(smOrg, projectId, {
        name: "Frontend",
        Name: "Frontend",
        description: "x",
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`Name`, `description` are not project properties. Remove these properties from the request. Properties that can be edited on a project: `name`.",
      );
      expect(projectService.update).not.toHaveBeenCalled();
    });

    it("ignores unknown properties that are null", async () => {
      const response = await command.run(smOrg, projectId, { name: "Frontend", description: null });

      expect(response.success).toBe(true);
    });
  });
});
