/** ways you can generate usernames
 *  "word" generates a username from the eff word list
 * "subaddress" creates a subaddress of an email.
 * "catchall" uses a domain's catchall address
 * "forwarded" uses an email forwarding service
 */
export type UsernameGeneratorType = "word" | "subaddress" | "catchall" | "forwarded";

/** Several username generators support two generation modes
 *  "random" selects one or more random words from the EFF word list
 *  "website-name" includes the domain in the generated username
 */
export type UsernameGenerationMode = "random" | "website-name";
