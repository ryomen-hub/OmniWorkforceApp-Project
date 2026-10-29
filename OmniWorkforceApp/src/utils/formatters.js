export function roleToEmailHandle(role) {
  return role.toLowerCase().replace(/[^a-z]/g, "");
}
