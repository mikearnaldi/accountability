/**
 * Error formatting utilities for user-friendly error messages
 */

/**
 * Extract a readable error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  // Handle string errors
  if (typeof error === "string") {
    return error
  }

  // Handle Error instances
  if (error instanceof Error) {
    return error.message
  }

  // Handle error-like objects with message property
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message
    }
    if ("error" in error && typeof error.error === "string") {
      return error.error
    }
  }

  return "An unexpected error occurred. Please try again."
}

/**
 * Format an API error into a user-friendly message
 * Strips technical details and JSON artifacts
 */
export function formatApiError(error: unknown): string {
  const message = getErrorMessage(error)

  // If the message looks like raw JSON, return a generic message
  if (message.startsWith("{") || message.startsWith("[")) {
    return "An unexpected error occurred. Please try again."
  }

  // If the message contains JSON-like patterns, return a generic message
  if (message.includes('"status":') || message.includes('"unhandled":')) {
    return "An unexpected error occurred. Please try again."
  }

  // If the message is too technical, return a generic message
  if (
    message.includes("HTTPError") ||
    message.includes("NetworkError") ||
    message.includes("TypeError:")
  ) {
    return "A network error occurred. Please check your connection and try again."
  }

  return message
}

/**
 * Type guard for error objects with status
 */
function hasNumericStatus(
  error: unknown
): error is { status: number } {
  if (typeof error !== "object" || error === null) return false
  if (!("status" in error)) return false
  // After "status" in error check, TypeScript knows error has a status property
  const errorWithStatus = error
  return typeof errorWithStatus.status === "number"
}

/**
 * Get error title and description based on error type
 */
export function getErrorInfo(error: unknown): {
  title: string
  description: string
} {
  // Check for specific error status codes
  if (hasNumericStatus(error)) {
    const status = error.status
    switch (status) {
      case 400:
        return {
          title: "Invalid Request",
          description: formatApiError(error)
        }
      case 401:
        return {
          title: "Session Expired",
          description: "Please log in again to continue."
        }
      case 403:
        return {
          title: "Access Denied",
          description: "You don't have permission to access this resource."
        }
      case 404:
        return {
          title: "Not Found",
          description: "The requested resource could not be found."
        }
      case 500:
        return {
          title: "Server Error",
          description:
            "An unexpected server error occurred. Please try again later."
        }
      case 502:
      case 503:
      case 504:
        return {
          title: "Service Unavailable",
          description: "The service is temporarily unavailable. Please try again later."
        }
    }
  }

  // Default error info
  return {
    title: "Something went wrong",
    description: formatApiError(error)
  }
}
