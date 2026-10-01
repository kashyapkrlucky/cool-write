import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { getEnv } from "../env";

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
    return new PrismaClient({ adapter });
}

// Reuse one client across dev hot reloads; otherwise every reload opens a new
// connection pool and Postgres eventually runs out of connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export { prisma };
