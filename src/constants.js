// Centralized constants for timeouts, intervals, polling etc.
// Adjust here instead of hunting magic numbers across the codebase.

export const STREAK_CLAIM_DELAY_MS = 1500; // Header daily streak claim delay
export const NOTIFICATION_PROMPT_DELAY_MS = 10000; // NotificationPermissionPrompt delay
export const QUIZ_ENGAGEMENT_POLL_INTERVAL_MS = 15000; // Quiz engagement refresh
export const QUIZ_IDLE_PREFETCH_DELAY_MS = 1500; // Idle route prefetch fallback delay
export const SESSION_VALIDATION_INTERVAL_MS = 60000; // Auth session periodic validation

// Grace period for auto redirect after quiz completion
export const QUIZ_COMPLETION_REDIRECT_DELAY_MS = 3000;
