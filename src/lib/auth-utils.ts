import { auth } from './auth'
import { prisma } from './prisma'
import { NextResponse } from 'next/server'

export interface ValidatedUser {
  id: string
  email: string
  name: string | null
  hourlyRate: number
}

export type AuthResult = 
  | { success: true; user: ValidatedUser }
  | { success: false; response: NextResponse }

/**
 * Validates the current session and ensures the user exists in the database.
 * Returns the user data if valid, or an error response if not.
 */
export async function validateSession(): Promise<AuthResult> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
  }

  // Verify the user still exists in the database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      hourlyRate: true
    }
  })

  if (!user) {
    // User in session doesn't exist in database anymore
    return {
      success: false,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Sesión inválida. Por favor, cierra sesión e inicia de nuevo.',
          code: 'INVALID_SESSION'
        },
        { status: 401 }
      )
    }
  }

  return {
    success: true,
    user
  }
}
