import { Sequelize } from 'sequelize';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'You must setup the $DATABASE_URL environment variable before proceeding.',
  );
}
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: process.env.DATABASE_LOGGING === 'true',
});

export default sequelize;
