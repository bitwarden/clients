import { Directive, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfType } from "@bitwarden/key-management";

@Directive()
export class ConfirmKeyConnectorDomainComponent implements OnInit {
  loading = true;
  keyConnectorUrl!: string;
  userId!: UserId;
  organizationId!: string;
  kdf!: KdfType;
  kdfIterations!: number;
  kdfMemory?: number;
  kdfParallelism?: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private logService: LogService,
    private keyConnectorService: KeyConnectorService,
    private messagingService: MessagingService,
    private syncService: SyncService,
  ) {}

  async ngOnInit() {
    const userId = this.route.snapshot.queryParamMap.get("userId") as UserId | null;
    const organizationId = this.route.snapshot.queryParamMap.get("organizationId");
    const keyConnectorUrl = this.route.snapshot.queryParamMap.get("keyConnectorUrl");
    const kdf = Number.parseInt(this.route.snapshot.queryParamMap.get("kdf") ?? "");
    const kdfIterations = Number.parseInt(
      this.route.snapshot.queryParamMap.get("kdfIterations") ?? "",
    );
    const kdfMemory = Number.parseInt(this.route.snapshot.queryParamMap.get("kdfMemory") ?? "");
    const kdfParallelism = Number.parseInt(
      this.route.snapshot.queryParamMap.get("kdfParallelism") ?? "",
    );

    this.logService.info(
      "[confirm-key-connector-domain] userId %s, organizationId %s, keyConnectorUrl %s, kdf %s, kdfIterations %s, kdfMemory %s, kdfParallelism %s",
      userId,
      organizationId,
      keyConnectorUrl,
      KdfType[kdf],
      kdfIterations,
      kdfMemory,
      kdfParallelism,
    );

    if (
      userId == null ||
      organizationId == null ||
      keyConnectorUrl == null ||
      Number.isNaN(kdf) ||
      !kdfIterations
    ) {
      this.logService.info("[confirm-key-connector-domain] missing required parameters");
      this.messagingService.send("logout");
      return;
    }

    this.keyConnectorUrl = keyConnectorUrl;
    this.userId = userId;
    this.organizationId = organizationId;
    this.kdf = kdf;
    this.kdfIterations = kdfIterations;
    this.kdfMemory = kdfMemory ? kdfMemory : undefined;
    this.kdfParallelism = kdfParallelism ? kdfParallelism : undefined;

    this.loading = false;
  }

  confirm = async () => {
    await this.keyConnectorService.convertNewSsoUserToKeyConnector(
      this.organizationId,
      this.userId,
      this.keyConnectorUrl,
      this.kdf,
      this.kdfIterations,
      this.kdfMemory,
      this.kdfParallelism,
    );

    await this.syncService.fullSync(true);

    this.messagingService.send("loggedIn");

    await this.beforeNavigationConfirmCallback();

    await this.router.navigate(["/"]);
  };

  cancel = async () => {
    this.messagingService.send("logout");
  };

  async beforeNavigationConfirmCallback() {}
}
