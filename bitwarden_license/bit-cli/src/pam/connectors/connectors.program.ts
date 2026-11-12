import { Command } from "commander";

import { ConnectorService } from "@bitwarden/bit-common/pam/connectors";
import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { StringResponse } from "@bitwarden/cli/models/response/string.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  addOrganizationIdOption,
  addPamHelp,
  addYesOption,
  createPamSdkService,
  PamBaseProgram,
  PamGuard,
  PamOrganizationRequirement,
  parseIdOption,
  PamOrganizationOptions,
  PamYesOptions,
  requireYes,
} from "../shared";

import {
  ConnectorActionResponse,
  ConnectorDetailResponse,
  ConnectorRegistrationResponse,
  ConnectorResponse,
} from "./connector.response";
import { TokenFileReservation, warnTokenIsOneTime } from "./register-token";

/** Every connector verb needs the PamAccessConnector flag and may be refused by the server. */
const CONNECTOR_FLAGS = [FeatureFlag.PamAccessConnector] as const;

/**
 * `bw privileged-controls connector`: admin commands for access connectors, the unattended agents that rotate
 * credentials. Reads need the organization to use PAM; writes also need the caller to be able to
 * manage rotation, which is separate from rule authority and excludes provider users. The server
 * stays the authority.
 */
export class ConnectorsProgram extends PamBaseProgram {
  private readonly service: ConnectorService;

  constructor(serviceContainer: ServiceContainer, service?: ConnectorService) {
    super(serviceContainer);
    this.service = service ?? new ConnectorService(createPamSdkService(serviceContainer));
  }

  command(): Command {
    return new Command("connector")
      .description("Manage access connectors, the agents that rotate credentials.")
      .addCommand(this.listCommand())
      .addCommand(this.getCommand())
      .addCommand(this.registerCommand())
      .addCommand(this.enableCommand())
      .addCommand(this.disableCommand())
      .addCommand(this.deleteCommand())
      .addCommand(this.assignCommand())
      .addCommand(this.unassignCommand());
  }

  private guard(
    options: PamOrganizationOptions,
    requirement: PamOrganizationRequirement,
  ): PamGuard {
    return { flags: CONNECTOR_FLAGS, requirement, organizationId: options.organizationid };
  }

  private listCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("list").description("List the access connectors of an organization."),
    ).action(async (options: PamOrganizationOptions) => {
      await this.runPam(this.guard(options, PamOrganizationRequirement.UsePam), async (ctx) => {
        const views = await this.service.list(ctx.userId, ctx.organizationId);
        return Response.success(new ListResponse(views.map((v) => new ConnectorResponse(v))));
      });
    });
    return addPamHelp(command, {
      examples: [
        "bw privileged-controls connector list --organizationid 7ad3e1f5-2b1c-4e5a-9a58-1a2b3c4d5e6f",
      ],
    });
  }

  private getCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("get")
        .description("Show a connector with its recent rotation jobs.")
        .argument("<id>", "The connector id"),
    ).action(async (id: string, options: PamOrganizationOptions) => {
      await this.runPam(this.guard(options, PamOrganizationRequirement.UsePam), async (ctx) => {
        const connectorId = parseIdOption(id, "connector id");
        const view = await this.service.get(ctx.userId, ctx.organizationId, connectorId);
        return Response.success(new ConnectorDetailResponse(view));
      });
    });
    return addPamHelp(command, {
      notes: [
        "A job's failure reason is text the connector reported. It is cleaned of control characters and shortened before it is printed, and is never logged.",
      ],
      examples: ["bw privileged-controls connector get <id> --organizationid <organizationid>"],
    });
  }

  private registerCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("register")
        .description("Register a connector and print its one-time token.")
        .argument("<name>", "A display name. It is stored unencrypted and shown in audit rows.")
        .option(
          "--token-file <path>",
          "Write the token to a new file with mode 0600 instead of printing it. An existing file is never overwritten.",
        ),
    ).action(async (name: string, options: PamOrganizationOptions & { tokenFile?: string }) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const trimmed = name?.trim();
          if (trimmed == null || trimmed === "") {
            throw new PamInputError("A connector name is required.");
          }
          return await this.registerAndDeliver(
            ctx.userId,
            ctx.organizationId,
            trimmed,
            options.tokenFile,
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "The token is returned once and the server keeps only a hash of it, so it cannot be recovered. Copy it now into the connector's configuration. If it is lost, delete the connector and register a new one.",
        "The token is printed to stdout once, also with BW_RESPONSE and --raw, or written to a 0600 file with --token-file. It is never stored or logged by the CLI.",
        "This command is not available through `bw serve`.",
      ],
      examples: [
        "bw privileged-controls connector register edge-1 --organizationid <organizationid>",
        "bw privileged-controls connector register edge-1 --organizationid <organizationid> --token-file ./edge-1.token",
      ],
    });
  }

  /** Registers, then hands the token to stdout or a file exactly once. */
  private async registerAndDeliver(
    userId: Parameters<ConnectorService["register"]>[0],
    organizationId: string,
    name: string,
    tokenFile: string | undefined,
  ): Promise<Response> {
    if (tokenFile == null && process.env.BW_QUIET === "true") {
      // processResponse prints nothing under BW_QUIET, so the one-time token would be lost.
      throw new PamInputError(
        "A registration token cannot be shown with --quiet. Use --token-file, or drop --quiet.",
      );
    }
    const reservation = tokenFile == null ? undefined : TokenFileReservation.reserve(tokenFile);
    let registration;
    try {
      registration = await this.service.register(userId, organizationId, name);
    } catch (e) {
      reservation?.discard();
      throw e;
    }

    warnTokenIsOneTime();
    if (reservation != null && reservation.write(registration.token)) {
      return Response.success(
        new ConnectorRegistrationResponse(registration, { tokenFile: reservation.filePath }),
      );
    }
    if (reservation != null) {
      process.stderr.write(
        "The token file could not be written, so the token is printed here instead.\n",
      );
    }
    if (process.env.BW_RAW === "true") {
      return Response.success(new StringResponse(registration.token));
    }
    return Response.success(new ConnectorRegistrationResponse(registration, {}));
  }

  private enableCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("enable")
        .description("Re-enable a disabled connector.")
        .argument("<id>", "The connector id"),
    ).action(async (id: string, options: PamOrganizationOptions) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const connectorId = parseIdOption(id, "connector id");
          await this.service.enable(ctx.userId, ctx.organizationId, connectorId);
          return Response.success(
            new ConnectorActionResponse("enabled", connectorId, ctx.organizationId),
          );
        },
      );
    });
    return addPamHelp(command, {
      examples: ["bw privileged-controls connector enable <id> --organizationid <organizationid>"],
    });
  }

  private disableCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("disable")
        .description("Disable a connector so it cannot authenticate or claim jobs.")
        .argument("<id>", "The connector id"),
    ).action(async (id: string, options: PamOrganizationOptions) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const connectorId = parseIdOption(id, "connector id");
          await this.service.disable(ctx.userId, ctx.organizationId, connectorId);
          return Response.success(
            new ConnectorActionResponse("disabled", connectorId, ctx.organizationId),
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "Disabling is reversible with `bw privileged-controls connector enable`. It releases the jobs the connector was running.",
      ],
      examples: ["bw privileged-controls connector disable <id> --organizationid <organizationid>"],
    });
  }

  private deleteCommand(): Command {
    const command = addYesOption(
      addOrganizationIdOption(
        new Command("delete")
          .description("Permanently delete a connector and invalidate its token.")
          .argument("<id>", "The connector id"),
      ),
    ).action(async (id: string, options: PamOrganizationOptions & PamYesOptions) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const connectorId = parseIdOption(id, "connector id");
          const refusal = requireYes(options, "permanently delete this connector");
          if (refusal != null) {
            return refusal;
          }
          await this.service.delete(ctx.userId, ctx.organizationId, connectorId);
          return Response.success(
            new ConnectorActionResponse("deleted", connectorId, ctx.organizationId),
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "Deleting is permanent and needs --yes. Use `bw privileged-controls connector disable` for a reversible stop.",
        "The connector held the plaintext organization key. If you suspect it was compromised, deleting it is not enough: the organization key still needs to be rotated.",
      ],
      examples: [
        "bw privileged-controls connector delete <id> --organizationid <organizationid> --yes",
      ],
    });
  }

  private assignCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("assign")
        .description("Let a connector rotate credentials on a target system.")
        .argument("<id>", "The connector id")
        .argument("<targetSystemId>", "The target system id"),
    ).action(async (id: string, targetSystemId: string, options: PamOrganizationOptions) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const connectorId = parseIdOption(id, "connector id");
          const targetId = parseIdOption(targetSystemId, "target system id");
          await this.service.assign(ctx.userId, ctx.organizationId, connectorId, targetId);
          return Response.success(
            new ConnectorActionResponse("assigned", connectorId, ctx.organizationId, targetId),
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "The target system id is only checked to be a GUID. It is not looked up, so the server rejects an id that does not exist.",
      ],
      examples: [
        "bw privileged-controls connector assign <id> <targetSystemId> --organizationid <organizationid>",
      ],
    });
  }

  private unassignCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("unassign")
        .description("Stop a connector from rotating credentials on a target system.")
        .argument("<id>", "The connector id")
        .argument("<targetSystemId>", "The target system id"),
    ).action(async (id: string, targetSystemId: string, options: PamOrganizationOptions) => {
      await this.runPam(
        this.guard(options, PamOrganizationRequirement.ManageRotation),
        async (ctx) => {
          const connectorId = parseIdOption(id, "connector id");
          const targetId = parseIdOption(targetSystemId, "target system id");
          await this.service.unassign(ctx.userId, ctx.organizationId, connectorId, targetId);
          return Response.success(
            new ConnectorActionResponse("unassigned", connectorId, ctx.organizationId, targetId),
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: ["The target system id is only checked to be a GUID. It is not looked up."],
      examples: [
        "bw privileged-controls connector unassign <id> <targetSystemId> --organizationid <organizationid>",
      ],
    });
  }
}
