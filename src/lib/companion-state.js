/**
 * Privacy takes precedence over feedback and animation; never pass field values.
 * @param {{passwordVisible?: boolean, confirmationVisible?: boolean, passwordTyping?: boolean, confirmationTyping?: boolean, pending?: boolean, error?: boolean, success?: boolean}} state
 * @returns {"shy" | "checking" | "error" | "happy" | "curious"}
 */
export function companionMood(state) {
  if (state.passwordVisible || state.confirmationVisible || state.passwordTyping || state.confirmationTyping) return "shy";
  if (state.pending) return "checking";
  if (state.error) return "error";
  if (state.success) return "happy";
  return "curious";
}
