export interface PasskyJsonExport {
  encrypted: boolean;
  passwords: LoginEntry[];
}

export interface LoginEntry {
  website: string;
  username: string;
  password: string;
  message: string;
}
