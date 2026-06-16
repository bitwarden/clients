export const MAX_STORAGE_GB = 100;

export type Storage = {
  available: number;
  readableUsed: string;
  used: number;
};
