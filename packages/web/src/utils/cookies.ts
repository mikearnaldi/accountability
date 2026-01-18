/**
 * Cookie parsing utilities for SSR
 */

/**
 * Parse cookies from a cookie header string and retrieve a specific cookie value
 * @param cookieString - The cookie header value (e.g., from request.headers.get('cookie'))
 * @param cookieName - The name of the cookie to retrieve
 * @returns The cookie value or null if not found
 */
export function parseCookie(cookieString: string | null | undefined, cookieName: string): string | null {
  if (cookieString === null || cookieString === undefined || cookieString === "") {
    return null
  }

  const cookies = cookieString.split(";")
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=")
    if (name === cookieName) {
      // Decode URI component in case the value is encoded
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }

  return null
}
