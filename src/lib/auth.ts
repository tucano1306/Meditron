import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"
import { PASSWORD_MAX } from "./input"
import { clearHits, clientIp, countHits, recordHit } from "./rate-limit"

/** Ventana y topes de intentos fallidos de inicio de sesión */
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS_PER_EMAIL = 10
const MAX_FAILS_PER_IP = 30

/** Hash de relleno: si el correo no existe se compara igual, para no delatar
 * por el tiempo de respuesta qué correos tienen cuenta */
const DUMMY_HASH = "$2b$12$pBuyxc3QGds3CLD4HW5sgOcg9NAopMhFm8zlWZ13sg9TeDJBk36oS"

class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts"
}

async function findUserByEmail(email: string) {
  // Primero exacto; si no, sin importar mayúsculas ("Leo@x.com" = "leo@x.com")
  return (await prisma.user.findUnique({ where: { email } }))
    ?? prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : ""
        const password = typeof credentials?.password === "string" ? credentials.password : ""
        if (!email || !password || email.length > 254 || password.length > PASSWORD_MAX) {
          return null
        }

        // Freno a la fuerza bruta: por cuenta y por conexión
        const emailKey = `login:${email.toLowerCase()}`
        const ipKey = `login-ip:${clientIp(request?.headers)}`
        const [emailFails, ipFails] = await Promise.all([
          countHits(emailKey, LOGIN_WINDOW_MS),
          countHits(ipKey, LOGIN_WINDOW_MS),
        ])
        if (emailFails >= MAX_FAILS_PER_EMAIL || ipFails >= MAX_FAILS_PER_IP) {
          throw new TooManyAttempts()
        }

        const user = await findUserByEmail(email)
        const isPasswordValid = await compare(password, user?.password ?? DUMMY_HASH)

        if (!user || !isPasswordValid) {
          await Promise.all([recordHit(emailKey), recordHit(ipKey)])
          return null
        }

        await clearHits(emailKey)
        return {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id
      }
      return session
    }
  },
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
})
