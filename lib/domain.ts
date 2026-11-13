/** The IIT Delhi gate, in one place.
 *
 *  Anchored on the host. A substring test such as
 *      email.includes('iitd.ac.in')
 *  accepts someone@iitd.ac.in.attacker.com, which is a different domain
 *  entirely. This does not.
 *
 *  The same rule is enforced three times over: here for the form, again in the
 *  server action, and a third time by a trigger on auth.users in the database,
 *  so a hand-written API call cannot create an account either.
 */
const IITD_HOST = /^(?:[a-z0-9-]+\.)*iitd\.ac\.in$/;

export const ALLOWED_DOMAIN = 'iitd.ac.in';

export function isInstituteEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return false;
  if (value.indexOf('@') !== at) return false; // a second @ is not an address
  return IITD_HOST.test(value.slice(at + 1));
}

export function emailProblem(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your institute email address.';
  if (!value.includes('@')) return 'That does not look like an email address.';
  if (!isInstituteEmail(value)) {
    return `ReLoop is open to IIT Delhi addresses. Use your @${ALLOWED_DOMAIN} email.`;
  }
  return null;
}
