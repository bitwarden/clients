import { Achievement, AchievementId } from "../../types";
import { VaultItemCreatedProgress } from "../metrics/metrics";

const LoginItems_1_Added_Achievement: Achievement = {
  achievement: "login-item-added" as AchievementId,
  name: "Access granted",
  description: "Saved your first login item with Bitwarden",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 1 },
  hidden: false,
};

const LoginItems_10_Added_Achievement: Achievement = {
  achievement: "10-login-items-added" as AchievementId,
  name: "10 Login Items Added",
  description: "Add 10 item of type login to your vault",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 10 },
  hidden: false,
};

const LoginItems_50_Added_Achievement: Achievement = {
  achievement: "50-login-items-added" as AchievementId,
  name: "50 Login Items Added",
  description: "Add 50 item of type login to your vault",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 50 },
  hidden: false,
};

const LoginItems_100_Added_Achievement: Achievement = {
  achievement: "100-login-items-added" as AchievementId,
  name: "100 Login Items Added",
  description: "Add 100 item of type login to your vault",
  validator: "Threshold",
  active: { metric: VaultItemCreatedProgress, high: 100 },
  hidden: false,
};

export {
  LoginItems_1_Added_Achievement,
  LoginItems_10_Added_Achievement,
  LoginItems_50_Added_Achievement,
  LoginItems_100_Added_Achievement,
};
