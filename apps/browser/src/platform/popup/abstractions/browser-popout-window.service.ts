interface BrowserPopoutWindowService {
  openLoginPrompt(senderWindowId: number): Promise<void>;
  closeLoginPrompt(): Promise<void>;
}

export { BrowserPopoutWindowService };
