import { Sequelize } from 'sequelize';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'You must setup the $DATABASE_URL environment variable before proceeding.',
  );
}
const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });

export default sequelize;
