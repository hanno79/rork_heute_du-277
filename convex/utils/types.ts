/**
 * Shared types for Convex functions
 */

/**
 * Result of session validation operations
 *
 * Used by validateSessionInternal, validateSession, and validateSessionByToken
 * to return a consistent structure for session validation results.
 */
export type SessionValidationResult = {
  /** Whether the session is valid */
  valid: boolean;
  /** The user ID from the validated session (only present if valid) */
  userId?: string;
  /** Whether the user has premium status (only present if valid) */
  isPremium?: boolean;
  /** Error message if validation failed */
  error?: string;
};
