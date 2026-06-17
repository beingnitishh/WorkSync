import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force new PrismaClient if the cached one is missing models (schema changes)
if (globalForPrisma.prisma && typeof (globalForPrisma.prisma as unknown as Record<string, unknown>).holiday === 'undefined') {
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db