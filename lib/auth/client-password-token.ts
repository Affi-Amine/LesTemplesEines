import jwt from "jsonwebtoken"

const CLIENT_PASSWORD_TOKEN_SECRET = process.env.CLIENT_PASSWORD_TOKEN_SECRET || process.env.JWT_SECRET || "client-password-token-secret"
const CLIENT_PASSWORD_TOKEN_EXPIRY = "2h"
const CLIENT_PASSWORD_SESSION_TOKEN_EXPIRY = "12h"

type ClientPasswordTokenPayload = {
  email: string
  type: "setup_password" | "reset_password" | "password_session"
}

export function generateClientPasswordToken(payload: ClientPasswordTokenPayload) {
  return jwt.sign(payload, CLIENT_PASSWORD_TOKEN_SECRET, {
    expiresIn: CLIENT_PASSWORD_TOKEN_EXPIRY,
  })
}

export function verifyClientPasswordToken(token: string) {
  return jwt.verify(token, CLIENT_PASSWORD_TOKEN_SECRET) as ClientPasswordTokenPayload
}

export function generateClientPasswordSessionToken(email: string) {
  return jwt.sign(
    {
      email,
      type: "password_session" as const,
    },
    CLIENT_PASSWORD_TOKEN_SECRET,
    {
      expiresIn: CLIENT_PASSWORD_SESSION_TOKEN_EXPIRY,
    }
  )
}
