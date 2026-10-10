/** Client-side checks only; the backend applies no password policy that the docs describe. */
export function passwordProblem(pw: string, confirm: string, old?: string): string | undefined {
  if (pw.length < 8) {
    return 'Use at least 8 characters.';
  }
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Use both letters and numbers.';
  }
  if (pw !== confirm) {
    return 'The passwords do not match.';
  }
  if (old !== undefined && pw === old) {
    return 'The new password must be different from the current one.';
  }
  return undefined;
}
