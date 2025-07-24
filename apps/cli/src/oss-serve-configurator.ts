// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as koaMulter from "@koa/multer";
import * as koaRouter from "@koa/router";
import * as koa from "koa";
import { firstValueFrom, map } from "rxjs";

import { ConfirmCommand } from "./admin-console/commands/confirm.command";
import { ShareCommand } from "./admin-console/commands/share.command";
import { LockCommand } from "./auth/commands/lock.command";
import { UnlockCommand } from "./auth/commands/unlock.command";
import { EditCommand } from "./commands/edit.command";
import { GetCommand } from "./commands/get.command";
import { ListCommand } from "./commands/list.command";
import { RestoreCommand } from "./commands/restore.command";
import { StatusCommand } from "./commands/status.command";
import { Response } from "./models/response";
import { FileResponse } from "./models/response/file.response";
import { ServiceContainer } from "./service-container/service-container";
import { GenerateCommand } from "./tools/generate.command";
import {
  SendEditCommand,
  SendCreateCommand,
  SendDeleteCommand,
  SendGetCommand,
  SendListCommand,
  SendRemovePasswordCommand,
} from "./tools/send";
import { CreateCommand } from "./vault/create.command";
import { DeleteCommand } from "./vault/delete.command";
import { SyncCommand } from "./vault/sync.command";

export class OssServeConfigurator {
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

  constructor(protected serviceContainer: ServiceContainer) {
    this.getCommand = new GetCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.collectionService,
      this.serviceContainer.totpService,
      this.serviceContainer.auditService,
      this.serviceContainer.keyService,
      this.serviceContainer.encryptService,
      this.serviceContainer.searchService,
      this.serviceContainer.apiService,
      this.serviceContainer.organizationService,
      this.serviceContainer.eventCollectionService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.accountService,
      this.serviceContainer.cliRestrictedItemTypesService,
    );
    this.listCommand = new ListCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.collectionService,
      this.serviceContainer.organizationService,
      this.serviceContainer.searchService,
      this.serviceContainer.organizationUserApiService,
      this.serviceContainer.apiService,
      this.serviceContainer.eventCollectionService,
      this.serviceContainer.accountService,
      this.serviceContainer.keyService,
      this.serviceContainer.cliRestrictedItemTypesService,
    );
    this.createCommand = new CreateCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.keyService,
      this.serviceContainer.encryptService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.organizationService,
      this.serviceContainer.accountService,
      this.serviceContainer.cliRestrictedItemTypesService,
    );
    this.editCommand = new EditCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.keyService,
      this.serviceContainer.encryptService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
      this.serviceContainer.accountService,
      this.serviceContainer.cliRestrictedItemTypesService,
    );
    this.generateCommand = new GenerateCommand(
      this.serviceContainer.passwordGenerationService,
      this.serviceContainer.stateService,
    );
    this.syncCommand = new SyncCommand(this.serviceContainer.syncService);
    this.statusCommand = new StatusCommand(
      this.serviceContainer.environmentService,
      this.serviceContainer.syncService,
      this.serviceContainer.accountService,
      this.serviceContainer.authService,
    );
    this.deleteCommand = new DeleteCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.cipherAuthorizationService,
      this.serviceContainer.accountService,
      this.serviceContainer.cliRestrictedItemTypesService,
    );
    this.confirmCommand = new ConfirmCommand(
      this.serviceContainer.apiService,
      this.serviceContainer.keyService,
      this.serviceContainer.encryptService,
      this.serviceContainer.organizationUserApiService,
    );
    this.restoreCommand = new RestoreCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.accountService,
      this.serviceContainer.cipherAuthorizationService,
    );
    this.shareCommand = new ShareCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.accountService,
    );
    this.lockCommand = new LockCommand(this.serviceContainer.vaultTimeoutService);
    this.unlockCommand = new UnlockCommand(
      this.serviceContainer.accountService,
      this.serviceContainer.masterPasswordService,
      this.serviceContainer.keyService,
      this.serviceContainer.userVerificationService,
      this.serviceContainer.cryptoFunctionService,
      this.serviceContainer.logService,
      this.serviceContainer.keyConnectorService,
      this.serviceContainer.environmentService,
      this.serviceContainer.organizationApiService,
      async () => await this.serviceContainer.logout(),
      this.serviceContainer.i18nService,
    );

    this.sendCreateCommand = new SendCreateCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.sendApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.accountService,
    );
    this.sendDeleteCommand = new SendDeleteCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.sendApiService,
    );
    this.sendGetCommand = new SendGetCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.searchService,
      this.serviceContainer.encryptService,
      this.serviceContainer.apiService,
      this.serviceContainer.accountService,
    );
    this.sendEditCommand = new SendEditCommand(
      this.serviceContainer.sendService,
      this.sendGetCommand,
      this.serviceContainer.sendApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.accountService,
    );
    this.sendListCommand = new SendListCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.searchService,
      this.serviceContainer.accountService,
    );
    this.sendRemovePasswordCommand = new SendRemovePasswordCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.sendApiService,
      this.serviceContainer.environmentService,
    );
  }

  configureRouter(router: koaRouter) {
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
  }

  protected processResponse(res: koa.Response, commandResponse: Response) {
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

  protected async errorIfLocked(res: koa.Response) {
    const authed = await this.serviceContainer.stateService.getIsAuthenticated();
    if (!authed) {
      this.processResponse(res, Response.error("You are not logged in."));
      return true;
    }
    const userId = await firstValueFrom(
      this.serviceContainer.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );
    if (await this.serviceContainer.keyService.hasUserKey(userId)) {
      return false;
    }
    this.processResponse(res, Response.error("Vault is locked."));
    return true;
  }
}
