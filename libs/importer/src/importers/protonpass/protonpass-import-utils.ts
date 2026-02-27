export function processNames(
  fullname: string | null,
  firstname: string | null,
  middlename: string | null,
  lastname: string | null,
) {
  let mappedFirstName = firstname;
  let mappedMiddleName = middlename;
  let mappedLastName = lastname;

  if (fullname) {
    const parts = fullname.trim().split(/\s+/);

    // Assign parts to first, middle, and last name based on the number of parts
    mappedFirstName = parts[0] || firstname;
    mappedLastName = parts.length > 1 ? parts[parts.length - 1] : lastname;
    mappedMiddleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : middlename;
  }

  return { mappedFirstName, mappedMiddleName, mappedLastName };
}
