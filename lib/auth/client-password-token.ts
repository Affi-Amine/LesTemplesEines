import jwt from "jsonwebtoken"

const CLIENT_PASSWORD_TOKEN_SECRET = process.env.CLIENT_PASSWORD_TOKEN_SECRET || process.env.JWT_SECRET || "client-password-token-secret"
const CLIENT_PASSWORD_TOKEN_EXPIRY = "2h"

type ClientPasswordTokenPayload = {
  email: string
  type: "setup_password" | "reset_password"
}

export function generateClientPasswordToken(payload: ClientPasswordTokenPayload) {
  return jwt.sign(payload, CLIENT_PASSWORD_TOKEN_SECRET, {
    expiresIn: CLIENT_PASSWORD_TOKEN_EXPIRY,
  })
}

export function verifyClientPasswordToken(token: string) {
  return jwt.verify(token, CLIENT_PASSWORD_TOKEN_SECRET) as ClientPasswordTokenPayload
}
