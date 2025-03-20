import { Achievement, AchievementId } from "../../types";
import { VaultItemCreatedProgress } from "../metrics/metrics";

const VaultItems_1_Added_Achievement: Achievement = {
  achievement: "vault-item-added" as AchievementId,
  name: "The chosen one",
  description: "Saved your fist item to Bitwarden",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 1 },
  hidden: false,
};

const VaultItems_10_Added_Achievement: Achievement = {
  achievement: "10-vault-items-added" as AchievementId,
  name: "A decade of security",
  description: "Saved your 10th item to Bitwarden",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 10 },
  hidden: false,
};

const VaultItems_50_Added_Achievement: Achievement = {
  achievement: "50-vault-items-added" as AchievementId,
  name: "It's 50/50 Vault Items Added",
  description: "Saved your 50th item to Bitwarden",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 50 },
  hidden: false,
};

const VaultItems_100_Added_Achievement: Achievement = {
  achievement: "100-vault-items-added" as AchievementId,
  name: "Century mark, Now you are thinking with ciphers",
  description: "Saved your 100th item to Bitwarden",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 100 },
  hidden: false,
};

export {
  VaultItems_1_Added_Achievement,
  VaultItems_10_Added_Achievement,
  VaultItems_50_Added_Achievement,
  VaultItems_100_Added_Achievement,
};
