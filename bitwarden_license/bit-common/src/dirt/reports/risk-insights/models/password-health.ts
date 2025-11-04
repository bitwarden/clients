// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BadgeVariant } from "@bitwarden/components";

/**
 * Weak password details containing the score
 * and the score type for the label and badge
 */
export type WeakPasswordDetail = {
  score: number;
  detailValue: WeakPasswordScore;
} | null;

/**
 * Weak password details containing the badge and
 * the label for the password score
 */
export type WeakPasswordScore = {
  label: string;
  badgeVariant: BadgeVariant;
} | null;

/**
 * How many times a password has been exposed
 */
export type ExposedPasswordDetail = {
  cipherId: string;
  exposedXTimes: number;
} | null;
