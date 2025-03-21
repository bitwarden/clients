import { CipherType } from "../../../vault/enums";
import { earnedEvent, progressEvent } from "../achievement-events";
import {
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "../types";

import { ItemCreatedCountConfig } from "./config/item-created-count-config";

/**
 * Creates a validator that will be customized to a custom count achievement
 * @param config contains the information to create the validator and achievement info.
 * The defined config should be input as example: ItemCreatedCountConfig.ItemCreated
 *
 * Will track the count achievements for all vault items and individual vault items.
 */
export class VaultItemCreatedCountValidator implements AchievementValidator {
  private itemCreatedProgress: MetricId;
  constructor(private config: ItemCreatedCountConfig) {
    // All of the configs for created items must have a metric.
    // This checks the types to allow us to assign the metric.
    if (config.active === "until-earned") {
      throw new Error(
        `${config.achievement}: invalid configuration; 'active' must contain a metric`,
      );
    }

    this.itemCreatedProgress = config.active.metric;
  }

  static createValidators(configs: ItemCreatedCountConfig[]): AchievementValidator[] {
    return configs.map((config) => new VaultItemCreatedCountValidator(config));
  }

  get achievement() {
    return this.config.achievement;
  }
  get name() {
    return this.config.name;
  }

  get description() {
    return this.config.description;
  }

  get validator() {
    return this.config.validator;
  }
  get active() {
    return this.config.active;
  }
  get hidden() {
    return this.config.hidden;
  }

  trigger(item: UserActionEvent) {
    return item.action === "vault-item-added" && this.validateItemType(item);
  }

  measure(_item: UserActionEvent, progress: Map<MetricId, number>) {
    const value = 1 + (progress.get(this.itemCreatedProgress) ?? 0);
    return [progressEvent(this.itemCreatedProgress, value)];
  }

  award(_measured: AchievementProgressEvent[], progress: Map<MetricId, number>) {
    const value = progress.get(this.itemCreatedProgress) ?? 0;
    return value >= this.config.high ? [earnedEvent(this.achievement)] : [];
  }

  /**
   * Will check the vault item types. The UserAction is lower case and the
   * cipher type is capitalized/camel case. Making it all lowercase will make
   * an even comparison. We are coupled to the CipherType enum unless any better
   * suggestions.
   * @param item The event data checking the trigger
   * @returns true or false if the cipherType matches
   */
  private validateItemType(item: UserActionEvent): boolean {
    // If the config's cipher type is not present no need to check
    // for the type.
    if (!this.config.cipherType) {
      return true;
    }

    const lowerConfigType = CipherType[this.config.cipherType].toLowerCase();
    const lowerItemType = item.labels?.["vault-item-type"]?.toString()?.toLowerCase();
    return lowerItemType === lowerConfigType;
  }
}
