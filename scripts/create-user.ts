import { getAuth, requireArg, setupAdmin } from "./admin.js";
async function main() {
  setupAdmin();
  const email = requireArg("email");
  const password = requireArg("password");
  const displayName = requireArg("name");
  if (password.length < 14)
    throw new Error("Use a password with at least 14 characters");
  const user = await getAuth().createUser({
    email,
    password,
    displayName,
    emailVerified: false,
  });
  console.log(
    `Created ${user.uid}. An admin must now create the user profile and assign a role in the app.`,
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Create user failed");
  process.exitCode = 1;
});
