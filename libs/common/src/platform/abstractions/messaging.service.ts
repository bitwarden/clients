// Export the new message sender as the legacy MessagingService to minimize changes in the initial PR,
// team specific PR's will come after.
export { MessageSender as MessagingService } from "@bitwarden/messaging";
