// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { filter, map } from "rxjs";
import { Jsonify } from "type-fest";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { UserKeyEncryptor } from "@bitwarden/common/tools/cryptography/user-key-encryptor";
import {
  ApiSettings,
  IntegrationRequest,
  RestClient,
} from "@bitwarden/common/tools/integration/rpc";
import { BufferedState } from "@bitwarden/common/tools/state/buffered-state";
import { PaddedDataPacker } from "@bitwarden/common/tools/state/padded-data-packer";
import { SecretKeyDefinition } from "@bitwarden/common/tools/state/secret-key-definition";
import { SecretState } from "@bitwarden/common/tools/state/secret-state";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { GeneratorStrategy } from "../abstractions";
import { ForwarderConfiguration, AccountRequest, ForwarderContext } from "../engine";
import { CreateForwardingAddressRpc } from "../engine/rpc/create-forwarding-address";
import { GetAccountIdRpc } from "../engine/rpc/get-account-id";
import { newDefaultEvaluator } from "../rx";
import { NoPolicy } from "../types";
import { observe$PerUserId, sharedByUserId } from "../util";

import { OptionsClassifier } from "./options-classifier";

const OPTIONS_FRAME_SIZE = 512;

/** An email forwarding service configurable through an API. */
export class ForwarderGeneratorStrategy<
  Settings extends ApiSettings,
  Options extends Settings & IntegrationRequest = Settings & IntegrationRequest,
> extends GeneratorStrategy<Options, NoPolicy> {
  /** Initializes the generator strategy
   *  @param encryptService protects sensitive forwarder options
   *  @param keyService looks up the user key when protecting data.
   *  @param stateProvider creates the durable state for options storage
   */
  constructor(
    private readonly configuration: ForwarderConfiguration<Settings>,
    private client: RestClient,
    private i18nService: I18nService,
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
    private stateProvider: StateProvider,
  ) {
    super();
  }

  // configuration
  readonly policy = PolicyType.PasswordGenerator;
  defaults$ = observe$PerUserId<Options>(
    () => this.configuration.forwarder.defaultSettings as Options,
  );
  toEvaluator = newDefaultEvaluator<Options>();
  durableState = sharedByUserId((userId) => this.getUserSecrets(userId));

  private get key() {
    return this.configuration.forwarder.settings;
  }

  private get rolloverKey() {
    return this.configuration.forwarder.importBuffer;
  }

  generate = async (options: Options) => {
    const requestOptions: IntegrationRequest & AccountRequest = { website: options.website };

    const getAccount = await this.getAccountId(this.configuration, options);
    if (getAccount) {
      requestOptions.accountId = await this.client.fetchJson(getAccount, requestOptions);
    }

    const create = this.createForwardingAddress(this.configuration, options);
    const result = await this.client.fetchJson(create, requestOptions);
    return result;
  };

  // per-user encrypted state
  private getUserSecrets(userId: UserId): SingleUserState<Options> {
    // construct the encryptor
    const packer = new PaddedDataPacker(OPTIONS_FRAME_SIZE);
    const encryptor$ = this.keyService.userKey$(userId).pipe(
      map((key) => (key ? new UserKeyEncryptor(userId, this.encryptService, key, packer) : null)),
      filter((encryptor) => !!encryptor),
    );

    // always exclude request properties
    const classifier = new OptionsClassifier<Settings, Options>();

    // Derive the secret key definition
    const key = SecretKeyDefinition.value<Options, Record<string, never>, Settings>(
      this.key.stateDefinition,
      this.key.key,
      classifier,
      {
        deserializer: (d: Jsonify<Options>) => this.key.deserializer(d as any) as any,
        cleanupDelayMs: this.key.cleanupDelayMs,
        clearOn: this.key.clearOn,
      },
    );

    // the type parameter is explicit because type inference fails for `Omit<Options, "website">`
    const secretState = SecretState.from<Options, void, Options, Record<string, never>, Settings>(
      userId,
      key,
      this.stateProvider,
      encryptor$,
    );

    // rollover should occur once the user key is available for decryption
    const canDecrypt$ = this.keyService.userKey$(userId).pipe(map((key) => key !== null));
    const rolloverState = new BufferedState(
      this.stateProvider,
      this.rolloverKey,
      secretState,
      canDecrypt$,
    );

    // cast through unknown required because there's no way to prove to
    // the compiler that `OptionsClassifier` runs within the buffer wrapping
    // the secret state.
    return rolloverState as unknown as SingleUserState<Options>;
  }

  private createContext<Settings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    return new ForwarderContext(configuration, settings, this.i18nService);
  }

  private createForwardingAddress<Settings extends ApiSettings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    const context = this.createContext(configuration, settings);
    const rpc = new CreateForwardingAddressRpc<Settings>(configuration, context);
    return rpc;
  }

  private getAccountId<Settings extends ApiSettings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    if (!configuration.forwarder.getAccountId) {
      return null;
    }

    const context = this.createContext(configuration, settings);
    const rpc = new GetAccountIdRpc<Settings>(configuration, context);

    return rpc;
  }
}
