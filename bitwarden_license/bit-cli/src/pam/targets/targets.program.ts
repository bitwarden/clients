import { Command } from "commander";

import {
  describeTargetSystemError,
  TargetSystemPendingSealError,
  TargetSystemService,
  targetSystemTemplate,
  validateTargetSystemRequest,
} from "@bitwarden/bit-common/pam/targets";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  addOrganizationIdOption,
  addPamHelp,
  addYesOption,
  createPamSdkService,
  PamBaseProgram,
  PamErrorResponse,
  PamOrganizationRequirement,
  PamYesOptions,
  parseIdOption,
  requireYes,
  PamOrganizationOptions,
} from "../shared";

import {
  readTargetSystemInput,
  parseTemplateMethod,
  TargetSystemInputOptions,
} from "./target-system-input";
import {
  TargetSystemPendingSealResponse,
  TargetSystemResponse,
  TargetSystemTemplateResponse,
} from "./target-system.response";

const TARGET_FLAGS = [FeatureFlag.PamAccessConnector];

type WriteOptions = PamOrganizationOptions & Omit<TargetSystemInputOptions, "json">;

/**
 * `bw privileged-controls target`: the target systems an organization rotates credentials against. Needs the
 * `PamAccessConnector` flag, and for every verb but `template` a caller who may manage rotation.
 */
export class TargetsProgram extends PamBaseProgram {
  constructor(serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  command(): Command {
    return new Command("target")
      .description("Manage the target systems an organization rotates credentials against")
      .addCommand(this.listCommand())
      .addCommand(this.templateCommand())
      .addCommand(this.createCommand())
      .addCommand(this.updateCommand())
      .addCommand(this.enableCommand())
      .addCommand(this.disableCommand())
      .addCommand(this.deleteCommand());
  }

  private service(): TargetSystemService {
    return new TargetSystemService(createPamSdkService(this.serviceContainer));
  }

  private listCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("list").description("List an organization's target systems"),
    ).action(async (options: PamOrganizationOptions) => {
      await this.runPam(
        {
          flags: TARGET_FLAGS,
          requirement: PamOrganizationRequirement.ManageRotation,
          organizationId: options.organizationid,
        },
        async (ctx) => {
          const targets = await this.service().list(ctx.userId, ctx.organizationId!);
          return Response.success(
            new ListResponse(targets.map((t) => new TargetSystemResponse(t))),
          );
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "Prints id, name, method, status and whether the sealed data unsealed. The kind, password policy and session termination setting are sealed and are never printed.",
      ],
      examples: [
        "bw privileged-controls target list --organizationid 00000000-0000-0000-0000-000000000000",
      ],
    });
  }

  private templateCommand(): Command {
    const command = new Command("template")
      .description("Print a request template for create or update")
      .option("--method <method>", "automatic (default) or manual")
      .action(async (options: { method?: string }) => {
        await this.runPam({ flags: TARGET_FLAGS }, () =>
          Promise.resolve(
            Response.success(
              new TargetSystemTemplateResponse(
                targetSystemTemplate(parseTemplateMethod(options.method)),
              ),
            ),
          ),
        );
      });
    return addPamHelp(command, {
      notes: [
        'An automatic request is {name, kind: "entra" | "custom_script", passwordPolicy, supportsSessionTermination}. A manual request is {name, passwordPolicy}. The method cannot be changed after creation.',
      ],
      examples: [
        "bw privileged-controls target template > target.json",
        "bw privileged-controls target template --method manual > target.json",
      ],
    });
  }

  private createCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("create")
        .description("Create a target system from a JSON request")
        .argument("[json]", "The request as JSON")
        .option("--file <path>", "Read the request from a file")
        .option("--stdin", "Read the request from standard input"),
    ).action(async (json: string | undefined, options: WriteOptions) => {
      await this.runPam(
        {
          flags: TARGET_FLAGS,
          requirement: PamOrganizationRequirement.ManageRotation,
          organizationId: options.organizationid,
        },
        async (ctx) => {
          try {
            const input = await readTargetSystemInput({ ...options, json });
            const request = validateTargetSystemRequest(input);
            const created = await this.service().create(ctx.userId, ctx.organizationId!, request);
            return Response.success(new TargetSystemResponse(created));
          } catch (e) {
            return this.failure(e, ctx.organizationId);
          }
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "Creation is two steps. If sealing fails, the target system stays pending_seal and the error gives its id: retry with `bw privileged-controls target update <id>` and the same request, or run `bw privileged-controls target delete <id> --yes`.",
        "Prefer --file or --stdin, so the password policy stays out of shell history.",
        "Only the entra and custom_script kinds are supported.",
      ],
      examples: [
        "bw privileged-controls target create --file target.json --organizationid <orgId>",
        "bw privileged-controls target template | bw privileged-controls target create --stdin --organizationid <orgId>",
      ],
    });
  }

  private updateCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("update")
        .description("Replace a target system's settings from a JSON request")
        .argument("<id>", "The target system id")
        .argument("[json]", "The request as JSON")
        .option("--file <path>", "Read the request from a file")
        .option("--stdin", "Read the request from standard input"),
    ).action(async (id: string, json: string | undefined, options: WriteOptions) => {
      await this.runPam(
        {
          flags: TARGET_FLAGS,
          requirement: PamOrganizationRequirement.ManageRotation,
          organizationId: options.organizationid,
        },
        async (ctx) => {
          try {
            const targetId = parseIdOption(id, "target system id");
            const input = await readTargetSystemInput({ ...options, json });
            await this.service().update(ctx.userId, ctx.organizationId!, targetId, input);
            return Response.success(new MessageResponse("The target system was updated.", null));
          } catch (e) {
            return this.failure(e, ctx.organizationId);
          }
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "Update re-seals the whole blob, so send every sealed field (kind, passwordPolicy and supportsSessionTermination for an automatic target, passwordPolicy for a manual one). Only name and method may be left out: they are read from the existing target system.",
        "The method cannot be changed, and the kind cannot be changed once the target system has been sealed and verified.",
        "This is also how a pending_seal target system left by a failed create is finished.",
      ],
      examples: [
        "bw privileged-controls target update <id> --file target.json --organizationid <orgId>",
      ],
    });
  }

  private enableCommand(): Command {
    return this.stateCommand(
      "enable",
      "Put a disabled target system back into service",
      (service, ctx, id) => service.enable(ctx.userId, ctx.organizationId, id),
      "The target system was enabled. New rotation jobs dispatch for it again.",
    );
  }

  private disableCommand(): Command {
    return this.stateCommand(
      "disable",
      "Stop new rotation jobs being dispatched for a target system",
      (service, ctx, id) => service.disable(ctx.userId, ctx.organizationId, id),
      "The target system was disabled. Rotation jobs already in flight run to completion.",
    );
  }

  private stateCommand(
    name: string,
    description: string,
    act: (
      service: TargetSystemService,
      ctx: { userId: string; organizationId: string },
      id: string,
    ) => Promise<void>,
    done: string,
  ): Command {
    const command = addOrganizationIdOption(
      new Command(name).description(description).argument("<id>", "The target system id"),
    ).action(async (id: string, options: PamOrganizationOptions) => {
      await this.runPam(
        {
          flags: TARGET_FLAGS,
          requirement: PamOrganizationRequirement.ManageRotation,
          organizationId: options.organizationid,
        },
        async (ctx) => {
          try {
            const targetId = parseIdOption(id, "target system id");
            await act(
              this.service(),
              { userId: ctx.userId, organizationId: ctx.organizationId! },
              targetId,
            );
            return Response.success(new MessageResponse(done, null));
          } catch (e) {
            return this.failure(e, ctx.organizationId);
          }
        },
      );
    });
    return addPamHelp(command, {
      examples: [`bw privileged-controls target ${name} <id> --organizationid <orgId>`],
    });
  }

  private deleteCommand(): Command {
    const command = addYesOption(
      addOrganizationIdOption(
        new Command("delete")
          .description("Permanently delete a target system")
          .argument("<id>", "The target system id"),
      ),
    ).action(async (id: string, options: PamOrganizationOptions & PamYesOptions) => {
      await this.runPam(
        {
          flags: TARGET_FLAGS,
          requirement: PamOrganizationRequirement.ManageRotation,
          organizationId: options.organizationid,
        },
        async (ctx) => {
          try {
            const targetId = parseIdOption(id, "target system id");
            const refusal = requireYes(options, "permanently delete this target system");
            if (refusal != null) {
              return refusal;
            }
            await this.service().delete(ctx.userId, ctx.organizationId!, targetId);
            return Response.success(new MessageResponse("The target system was deleted.", null));
          } catch (e) {
            return this.failure(e, ctx.organizationId);
          }
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "The server refuses while a rotation config still names the target system. Delete those first, or use `disable` for a target system that is only unavailable.",
      ],
      examples: ["bw privileged-controls target delete <id> --organizationid <orgId> --yes"],
    });
  }

  /**
   * A failed response for any error a target verb throws. A create whose seal step failed
   * names the pending id and what to do next.
   */
  private failure(e: unknown, organizationId: string | undefined): Response {
    return targetSystemFailure(e, organizationId);
  }
}

/** Shared by the commander verbs and the serve routes. */
export function targetSystemFailure(e: unknown, organizationId: string | undefined): Response {
  if (e instanceof TargetSystemPendingSealError) {
    const info = describeTargetSystemError(e.cause);
    const org = organizationId ?? "<orgId>";
    return Response.error(
      `The target system was created but sealing failed (${info.message}) so it is left as pending_seal with id ${e.id}. Retry with \`bw privileged-controls target update ${e.id} --file <request.json> --organizationid ${org}\` and the same request, or run \`bw privileged-controls target delete ${e.id} --organizationid ${org} --yes\`.`,
      new TargetSystemPendingSealResponse(info, e.id),
    );
  }
  const info = describeTargetSystemError(e);
  return Response.error(info.message, new PamErrorResponse(info));
}
