import { Command } from "commander";

import { RotationService } from "@bitwarden/bit-common/pam/rotation";
import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  addNamesOption,
  addOrganizationIdOption,
  addPamHelp,
  addYesOption,
  createPamNameResolver,
  createPamSdkService,
  PamBaseProgram,
  PamContext,
  PamNamesOptions,
  PamOrganizationOptions,
  PamOrganizationRequirement,
  parseIdOption,
  PamYesOptions,
  requireYes,
} from "../shared";

import { readRotationJson, RotationInputOptions } from "./rotation-input";
import {
  RotationActionResponse,
  RotationConfigResponse,
  RotationScheduleResponse,
} from "./rotation.response";

type Options = PamOrganizationOptions;
type WriteOptions = Options & RotationInputOptions & { schedule?: string };

const DEFAULT_JOBS = 5;
const MAX_JOBS = 100;

const SCHEDULE_NOTE =
  "--schedule takes a preset (none, hourly, every6_hours, daily, weekly, monthly) or a raw Quartz cron expression. The server decides whether a cron is valid.";
const REQUEST_NOTE =
  'The request is {"cipherId", "targetSystemId", "accountIdentity", "terminateSessions", "scheduleCron", "rotateOnAccessEnd"}. The account identity is sensitive: prefer --file or --stdin, which keep it out of shell history.';

/**
 * `bw pam rotation`: the managed credentials of an organization, each a link between a cipher and
 * a target system. Needs the Pam and PamAccessConnector flags and ManageRotation rights.
 * `rotation schedule` is pure and needs no organization.
 */
export class RotationProgram extends PamBaseProgram {
  constructor(serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  command(): Command {
    return new Command("rotation")
      .description("Manage rotation configs, the managed credentials of an organization")
      .addCommand(this.listCommand())
      .addCommand(this.getCommand())
      .addCommand(this.createCommand())
      .addCommand(this.updateCommand())
      .addCommand(this.deleteCommand())
      .addCommand(this.stateCommand("pause", "Pause a rotation config", "pause"))
      .addCommand(this.stateCommand("resume", "Resume a paused rotation config", "resume"))
      .addCommand(this.rotateCommand())
      .addCommand(this.recordManualCommand())
      .addCommand(this.actionsCommand())
      .addCommand(this.scheduleCommand());
  }

  private service(): RotationService {
    return new RotationService(createPamSdkService(this.serviceContainer));
  }

  private guard(options: Options) {
    return {
      flags: [FeatureFlag.PamAccessConnector],
      requirement: PamOrganizationRequirement.ManageRotation,
      organizationId: options.organizationid,
    };
  }

  private async names(options: PamNamesOptions) {
    return options.names === true
      ? await createPamNameResolver(this.serviceContainer).load()
      : undefined;
  }

  private listCommand(): Command {
    const command = addNamesOption(addOrganizationIdOption(new Command("list")))
      .description("List the rotation configs of an organization")
      .action(async (options: Options & PamNamesOptions) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const items = await this.service().list(ctx.userId, ctx.organizationId);
          const names = await this.names(options);
          return Response.success(
            new ListResponse(items.map((item) => new RotationConfigResponse(item, names))),
          );
        });
      });
    return addPamHelp(command, {
      notes: ["Each item shows whether an account identity is set, never the identity itself."],
      examples: ["bw pam rotation list --organizationid <id>"],
    });
  }

  private getCommand(): Command {
    const command = addNamesOption(addOrganizationIdOption(new Command("get")))
      .argument("<configId>", "The rotation config id")
      .option(
        "--jobs <n>",
        `How many recent jobs to show (0 to ${MAX_JOBS}, default ${DEFAULT_JOBS})`,
      )
      .description("Show a rotation config with its actions and recent jobs")
      .action(async (configId: string, options: Options & PamNamesOptions & { jobs?: string }) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          const jobs = parseJobs(options.jobs);
          const detail = await this.service().get(ctx.userId, orgOf(ctx), id, jobs);
          return Response.success(RotationConfigResponse.detail(detail, await this.names(options)));
        });
      });
    return addPamHelp(command, {
      notes: [
        "A job failure shows its failure code. The connector's failure text is untrusted, so it is shown only when there is no usable code, cleaned and cut short.",
      ],
      examples: ["bw pam rotation get <configId> --organizationid <id> --jobs 10"],
    });
  }

  private writeCommand(name: "create" | "update"): Command {
    const command = addOrganizationIdOption(new Command(name))
      .option("--file <path>", "Read the request JSON from a file")
      .option("--stdin", "Read the request JSON from standard input")
      .option(
        "--schedule <preset|cron>",
        "Set the schedule, overriding scheduleCron in the request",
      );
    return command;
  }

  private createCommand(): Command {
    const command = this.writeCommand("create")
      .argument("[json]", "The request as JSON")
      .description("Create a rotation config")
      .action(async (json: string | undefined, options: WriteOptions) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const text = await readRotationJson(json, options);
          const { result } = await this.service().create(
            ctx.userId,
            orgOf(ctx),
            text,
            options.schedule,
          );
          return Response.success(new RotationConfigResponse(result));
        });
      });
    return addPamHelp(command, {
      notes: [REQUEST_NOTE, SCHEDULE_NOTE],
      examples: [
        "bw pam rotation create --file request.json --organizationid <id> --schedule weekly",
        "cat request.json | bw pam rotation create --stdin --organizationid <id>",
      ],
    });
  }

  private updateCommand(): Command {
    const command = this.writeCommand("update")
      .argument("<configId>", "The rotation config id")
      .argument("[json]", "The request as JSON")
      .description("Update a rotation config")
      .action(async (configId: string, json: string | undefined, options: WriteOptions) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          const text = await readRotationJson(json, options);
          const { result } = await this.service().update(
            ctx.userId,
            orgOf(ctx),
            id,
            text,
            options.schedule,
          );
          return Response.success(new RotationConfigResponse(result));
        });
      });
    return addPamHelp(command, {
      notes: [
        "An update re-seals the whole config. A field left out of the JSON keeps its current value.",
        "cipherId and targetSystemId must match the existing config. While a rotation is active the account identity and session settings are locked, but the schedule can change.",
        REQUEST_NOTE,
        SCHEDULE_NOTE,
      ],
      examples: [
        "bw pam rotation update <configId> --file request.json --organizationid <id>",
        'bw pam rotation update <configId> \'{"cipherId":"<id>","targetSystemId":"<id>"}\' --organizationid <id> --schedule daily',
      ],
    });
  }

  private deleteCommand(): Command {
    const command = addYesOption(addOrganizationIdOption(new Command("delete")))
      .argument("<configId>", "The rotation config id")
      .description("Delete a rotation config")
      .action(async (configId: string, options: Options & PamYesOptions) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          const refusal = requireYes(
            options,
            "delete this rotation config and its history. The cipher and the target system stay",
          );
          if (refusal != null) {
            return refusal;
          }
          await this.service().delete(ctx.userId, orgOf(ctx), id);
          return Response.success(new RotationActionResponse("delete", id));
        });
      });
    return addPamHelp(command, {
      notes: [
        "Only the link between the cipher and the target system, and its history, are removed.",
      ],
      examples: ["bw pam rotation delete <configId> --organizationid <id> --yes"],
    });
  }

  private stateCommand(name: "pause" | "resume", description: string, action: "pause" | "resume") {
    const command = addOrganizationIdOption(new Command(name))
      .argument("<configId>", "The rotation config id")
      .description(description)
      .action(async (configId: string, options: Options) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          await this.service().perform(ctx.userId, orgOf(ctx), id, action);
          return Response.success(new RotationActionResponse(action, id));
        });
      });
    return addPamHelp(command, {
      notes: ["The command first checks the config's actions and says why when it is refused."],
      examples: [`bw pam rotation ${name} <configId> --organizationid <id>`],
    });
  }

  private rotateCommand(): Command {
    const command = addYesOption(addOrganizationIdOption(new Command("rotate")))
      .argument("<configId>", "The rotation config id")
      .description("Rotate the credential now")
      .action(async (configId: string, options: Options & PamYesOptions) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          const refusal = requireYes(options, "rotate the credential now");
          if (refusal != null) {
            return refusal;
          }
          await this.service().perform(ctx.userId, orgOf(ctx), id, "rotate");
          return Response.success(new RotationActionResponse("rotate", id));
        });
      });
    return addPamHelp(command, {
      notes: [
        "The server limits how often a config can be rotated. A request inside the cooldown is refused.",
        "A manual-method target cannot be rotated here: use record-manual.",
      ],
      examples: ["bw pam rotation rotate <configId> --organizationid <id> --yes"],
    });
  }

  private recordManualCommand(): Command {
    const command = addOrganizationIdOption(new Command("record-manual"))
      .argument("<configId>", "The rotation config id")
      .description("Record that you rotated a manual target's credential yourself")
      .action(async (configId: string, options: Options) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          await this.service().perform(ctx.userId, orgOf(ctx), id, "record-manual");
          return Response.success(new RotationActionResponse("record-manual", id));
        });
      });
    return addPamHelp(command, {
      notes: ["This applies to manual-method targets that are waiting for a rotation."],
      examples: ["bw pam rotation record-manual <configId> --organizationid <id>"],
    });
  }

  private actionsCommand(): Command {
    const command = addOrganizationIdOption(new Command("actions"))
      .argument("<configId>", "The rotation config id")
      .description("Show which actions a rotation config offers right now")
      .action(async (configId: string, options: Options) => {
        await this.runPam(this.guard(options), async (ctx) => {
          const id = parseIdOption(configId, "config id");
          const detail = await this.service().get(ctx.userId, orgOf(ctx), id, 0);
          return Response.success(new RotationConfigResponse(detail));
        });
      });
    return addPamHelp(command, {
      notes: [
        "The actions are the canRotateNow, canRecordManual, mutationsLocked, canPause and canResume fields.",
      ],
      examples: ["bw pam rotation actions <configId> --organizationid <id>"],
    });
  }

  private scheduleCommand(): Command {
    const command = new Command("schedule")
      .argument("<preset|cron>", "A preset name or a Quartz cron expression")
      .description("Resolve a schedule to its cron expression and preset")
      .action(async (value: string) => {
        await this.runPam({ flags: [FeatureFlag.PamAccessConnector] }, async (ctx) => {
          const resolved = await this.service().resolveSchedule(ctx.userId, value);
          return Response.success(new RotationScheduleResponse(resolved));
        });
      });
    return addPamHelp(command, {
      notes: [
        "This makes no request and needs no organization. A cron that does not look like Quartz gets a warning only.",
      ],
      examples: ["bw pam rotation schedule weekly", 'bw pam rotation schedule "0 0 3 * * ?"'],
    });
  }
}

/** The organization id the guard validated; it is always set because the guard was given one. */
function orgOf(ctx: PamContext): string {
  if (ctx.organizationId == null) {
    throw new PamInputError("An organization id is required.");
  }
  return ctx.organizationId;
}

/** Parses `--jobs`. */
function parseJobs(value: string | undefined): number {
  if (value == null) {
    return DEFAULT_JOBS;
  }
  const n = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(n) || n > MAX_JOBS) {
    throw new PamInputError(`--jobs must be a whole number from 0 to ${MAX_JOBS}.`);
  }
  return n;
}
