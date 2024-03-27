import * as koaMulter from "@koa/multer";
import * as koaRouter from "@koa/router";
import { OptionValues } from "commander";
import * as koa from "koa";
import * as koaBodyParser from "koa-bodyparser";
import * as koaJson from "koa-json";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ConfirmCommand } from "../admin-console/commands/confirm.command";
import { ShareCommand } from "../admin-console/commands/share.command";
import { LockCommand } from "../auth/commands/lock.command";
import { UnlockCommand } from "../auth/commands/unlock.command";
import { Main } from "../bw";
import { Response } from "../models/response";
import { FileResponse } from "../models/response/file.response";
import { GenerateCommand } from "../tools/generate.command";
import {
  SendEditCommand,
  SendCreateCommand,
  SendDeleteCommand,
  SendGetCommand,
  SendListCommand,
  SendRemovePasswordCommand,
} from "../tools/send";
import { CreateCommand } from "../vault/create.command";
import { DeleteCommand } from "../vault/delete.command";
import { SyncCommand } from "../vault/sync.command";

import { EditCommand } from "./edit.command";
import { GetCommand } from "./get.command";
import { ListCommand } from "./list.command";
import { RestoreCommand } from "./restore.command";
import { StatusCommand } from "./status.command";

export class ServeCommand {
  private listCommand: ListCommand;
  private getCommand: GetCommand;
  private createCommand: CreateCommand;
  private editCommand: EditCommand;
  private generateCommand: GenerateCommand;
  private shareCommand: ShareCommand;
  private statusCommand: StatusCommand;
  private syncCommand: SyncCommand;
  private deleteCommand: DeleteCommand;
  private confirmCommand: ConfirmCommand;
  private restoreCommand: RestoreCommand;
  private lockCommand: LockCommand;
  private unlockCommand: UnlockCommand;

  private sendCreateCommand: SendCreateCommand;
  private sendDeleteCommand: SendDeleteCommand;
  private sendEditCommand: SendEditCommand;
  private sendGetCommand: SendGetCommand;
  private sendListCommand: SendListCommand;
  private sendRemovePasswordCommand: SendRemovePasswordCommand;

  constructor(protected main: Main) {
    this.getCommand = new GetCommand(
      this.main.cipherService,
      this.main.folderService,
      this.main.collectionService,
      this.main.totpService,
      this.main.auditService,
      this.main.cryptoService,
      this.main.stateService,
      this.main.searchService,
      this.main.apiService,
      this.main.organizationService,
      this.main.eventCollectionService,
      this.main.billingAccountProfileStateService,
    );
    this.listCommand = new ListCommand(
      this.main.cipherService,
      this.main.folderService,
      this.main.collectionService,
      this.main.organizationService,
      this.main.searchService,
      this.main.organizationUserService,
      this.main.apiService,
      this.main.eventCollectionService,
    );
    this.createCommand = new CreateCommand(
      this.main.cipherService,
      this.main.folderService,
      this.main.cryptoService,
      this.main.apiService,
      this.main.folderApiService,
      this.main.billingAccountProfileStateService,
    );
    this.editCommand = new EditCommand(
      this.main.cipherService,
      this.main.folderService,
      this.main.cryptoService,
      this.main.apiService,
      this.main.folderApiService,
    );
    this.generateCommand = new GenerateCommand(
      this.main.passwordGenerationService,
      this.main.stateService,
    );
    this.syncCommand = new SyncCommand(this.main.syncService);
    this.statusCommand = new StatusCommand(
      this.main.environmentService,
      this.main.syncService,
      this.main.stateService,
      this.main.authService,
    );
    this.deleteCommand = new DeleteCommand(
      this.main.cipherService,
      this.main.folderService,
      this.main.apiService,
      this.main.folderApiService,
      this.main.billingAccountProfileStateService,
    );
    this.confirmCommand = new ConfirmCommand(
      this.main.apiService,
      this.main.cryptoService,
      this.main.organizationUserService,
    );
    this.restoreCommand = new RestoreCommand(this.main.cipherService);
    this.shareCommand = new ShareCommand(this.main.cipherService);
    this.lockCommand = new LockCommand(this.main.vaultTimeoutService);
    this.unlockCommand = new UnlockCommand(
      this.main.accountService,
      this.main.masterPasswordService,
      this.main.cryptoService,
      this.main.stateService,
      this.main.cryptoFunctionService,
      this.main.apiService,
      this.main.logService,
      this.main.keyConnectorService,
      this.main.environmentService,
      this.main.syncService,
      this.main.organizationApiService,
      async () => await this.main.logout(),
    );

    this.sendCreateCommand = new SendCreateCommand(
      this.main.sendService,
      this.main.environmentService,
      this.main.sendApiService,
      this.main.billingAccountProfileStateService,
    );
    this.sendDeleteCommand = new SendDeleteCommand(this.main.sendService, this.main.sendApiService);
    this.sendGetCommand = new SendGetCommand(
      this.main.sendService,
      this.main.environmentService,
      this.main.searchService,
      this.main.cryptoService,
    );
    this.sendEditCommand = new SendEditCommand(
      this.main.sendService,
      this.sendGetCommand,
      this.main.sendApiService,
      this.main.billingAccountProfileStateService,
    );
    this.sendListCommand = new SendListCommand(
      this.main.sendService,
      this.main.environmentService,
      this.main.searchService,
    );
    this.sendRemovePasswordCommand = new SendRemovePasswordCommand(
      this.main.sendService,
      this.main.sendApiService,
      this.main.environmentService,
    );
  }

  async run(options: OptionValues) {
    const protectOrigin = !options.disableOriginProtection;
    const port = options.port || 8087;
    const hostname = options.hostname || "localhost";
    this.main.logService.info(
      `Starting server on ${hostname}:${port} with ${
        protectOrigin ? "origin protection" : "no origin protection"
      }`,
    );

    const server = new koa();
    const router = new koaRouter();
    process.env.BW_SERVE = "true";
    process.env.BW_NOINTERACTION = "true";

    server
      .use(async (ctx, next) => {
        if (protectOrigin && ctx.headers.origin != undefined) {
          ctx.status = 403;
          this.main.logService.warning(
            `Blocking request from "${
              Utils.isNullOrEmpty(ctx.headers.origin)
                ? "(Origin header value missing)"
                : ctx.headers.origin
            }"`,
          );
          return;
        }
        await next();
      })
      .use(koaBodyParser())
      .use(koaJson({ pretty: false, param: "pretty" }));

    router.get("/generate", async (ctx, next) => {
      const response = await this.generateCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/status", async (ctx, next) => {
      const response = await this.statusCommand.run();
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/list/object/:object", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendListCommand.run(ctx.request.query);
      } else {
        response = await this.listCommand.run(ctx.params.object, ctx.request.query);
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/send/list", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.sendListCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/sync", async (ctx, next) => {
      const response = await this.syncCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/lock", async (ctx, next) => {
      const response = await this.lockCommand.run();
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/unlock", async (ctx, next) => {
      // Do not allow guessing password location through serve command
      delete ctx.request.query.passwordFile;
      delete ctx.request.query.passwordEnv;

      const response = await this.unlockCommand.run(
        ctx.request.body.password == null ? null : (ctx.request.body.password as string),
        ctx.request.query,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/confirm/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.confirmCommand.run(
        ctx.params.object,
        ctx.params.id,
        ctx.request.query,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/restore/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.restoreCommand.run(ctx.params.object, ctx.params.id);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/move/:id/:organizationId", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.shareCommand.run(
        ctx.params.id,
        ctx.params.organizationId,
        ctx.request.body, // TODO: Check the format of this body for an array of collection ids
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/attachment", koaMulter().single("file"), async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.createCommand.run(
        "attachment",
        ctx.request.body,
        ctx.request.query,
        {
          fileBuffer: ctx.request.file.buffer,
          fileName: ctx.request.file.originalname,
        },
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/send/:id/remove-password", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.sendRemovePasswordCommand.run(ctx.params.id);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/object/:object", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendCreateCommand.run(ctx.request.body, ctx.request.query);
      } else {
        response = await this.createCommand.run(
          ctx.params.object,
          ctx.request.body,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.put("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        ctx.request.body.id = ctx.params.id;
        response = await this.sendEditCommand.run(ctx.request.body, ctx.request.query);
      } else {
        response = await this.editCommand.run(
          ctx.params.object,
          ctx.params.id,
          ctx.request.body,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendGetCommand.run(ctx.params.id, null);
      } else {
        response = await this.getCommand.run(ctx.params.object, ctx.params.id, ctx.request.query);
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.delete("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendDeleteCommand.run(ctx.params.id);
      } else {
        response = await this.deleteCommand.run(
          ctx.params.object,
          ctx.params.id,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    server
      .use(router.routes())
      .use(router.allowedMethods())
      .listen(port, hostname === "all" ? null : hostname, () => {
        this.main.logService.info("Listening on " + hostname + ":" + port);
      });
  }

  private processResponse(res: koa.Response, commandResponse: Response) {
    if (!commandResponse.success) {
      res.status = 400;
    }
    if (commandResponse.data instanceof FileResponse) {
      res.body = commandResponse.data.data;
      res.attachment(commandResponse.data.fileName);
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Length", commandResponse.data.data.length.toString());
    } else {
      res.body = commandResponse;
    }
  }

  private async errorIfLocked(res: koa.Response) {
    const authed = await this.main.stateService.getIsAuthenticated();
    if (!authed) {
      this.processResponse(res, Response.error("You are not logged in."));
      return true;
    }
    if (await this.main.cryptoService.hasUserKey()) {
      return false;
    }
    this.processResponse(res, Response.error("Vault is locked."));
    return true;
  }
}
