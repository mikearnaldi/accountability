/**
 * AuthService - Service tag re-export for persistence package
 *
 * Re-exports the AuthService from core for use with the AuthServiceLive implementation.
 *
 * @module AuthService
 */

export {
  AuthService,
  type AuthServiceShape,
  type LoginSuccess,
  type ValidatedSession,
  type SessionError,
  type LoginError,
  type RegistrationError,
  type IdentityLinkError
} from "@accountability/core/authentication/AuthService"
