require('tsx/cjs');

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('../../node_modules/.prisma/client/client.ts');

const globalForPrisma = globalThis;

const connectionString = process.env.DATABASE_URL;
const normalizedConnectionString = connectionString
  ? (() => {
      const url = new URL(connectionString);
      url.searchParams.delete('sslmode');
      url.searchParams.delete('connect_timeout');
      url.searchParams.delete('pgbouncer');
      return url.toString();
    })()
  : '';

const prisma =
  globalForPrisma.__prismaClient ||
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: normalizedConnectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prismaClient = prisma;
}

module.exports = {
  prisma,
  Prisma,
};
