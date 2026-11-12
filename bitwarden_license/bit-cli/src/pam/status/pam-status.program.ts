import { Command } from "commander";

import { PamCollectionsService, PamStatusService } from "@bitwarden/bit-common/pam/status";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  addOrganizationIdOption,
  addPamHelp,
  PamBaseProgram,
  pamErrorResponse,
  PamOrganizationRequirement,
  parseOrganizationIdOption,
} from "../shared";

import { pamCollectionList, PamStatusResponse } from "./pam-status.response";

export class PamStatusProgram extends PamBaseProgram {
  constructor(serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  register(pam: Command): void {
    const status = new Command("status")
      .description("Show whether Privileged Controls is available to you, and why not.")
      .option("--organizationid <organizationid>", "Only report this organization")
      .action(async (options: { organizationid?: string }) => {
        await this.runStatus(options.organizationid);
      });
    addPamHelp(status, {
      notes: [
        "Reports the Privileged Controls feature flags and, per organization, whether it uses Privileged Controls, whether you hold a seat, and your provider status. The can* values are client-side hints; the server decides.",
        "Works when the Privileged Controls feature flag is off and when the vault is locked. Calls no Privileged Controls service.",
      ],
      examples: ["bw pam status", "bw pam status --organizationid <organizationid>"],
    });

    const collections = addOrganizationIdOption(
      new Command("collections").description(
        "List an organization's collections and which are governed by an access rule.",
      ),
    ).action(async (options: { organizationid: string }) => {
      await this.runCollections(options.organizationid);
    });
    addPamHelp(collections, {
      notes: ["Reads the synced vault. Run `bw sync` first if collections look out of date."],
      examples: ["bw pam collections --organizationid <organizationid>"],
    });

    pam.addCommand(status);
    pam.addCommand(collections);
  }

  /** Deliberately bypasses the PAM guard: this is the command that explains the guard. */
  private async runStatus(organizationId: string | undefined): Promise<void> {
    let response: Response;
    try {
      const id = organizationId == null ? undefined : parseOrganizationIdOption(organizationId);
      const service = new PamStatusService(
        this.serviceContainer.configService,
        this.serviceContainer.organizationService,
        this.serviceContainer.accountService,
      );
      response = Response.success(new PamStatusResponse(await service.getStatus(id)));
    } catch (e) {
      response = pamErrorResponse(e);
    }
    this.processResponse(response);
  }

  private async runCollections(organizationId: string): Promise<void> {
    await this.runPam(
      { requirement: PamOrganizationRequirement.UsePam, organizationId },
      async (ctx) => {
        const service = new PamCollectionsService(
          this.serviceContainer.collectionService,
          this.serviceContainer.accountService,
        );
        const list = await service.list(ctx.organizationId as string);
        return Response.success(pamCollectionList(list));
      },
    );
  }
}
