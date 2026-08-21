const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://root:wrongpass@localhost:33333/mydb'
    }
  }
});

async function main() {
  console.log('Connecting...');
  const start = Date.now();
  try {
    await prisma.user.findUnique({ where: { id: 'test' } });
  } catch (e) {
    console.log('Error after', Date.now() - start, 'ms:', e.message);
  }
}
main();
