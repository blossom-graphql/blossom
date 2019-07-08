import { promises as fs } from 'fs';
import path from 'path';

import { fn, Model, DataTypes } from 'sequelize';

import sequelize from './sequelize';
import { cleanup as cleanupMovies, setup as setupMovies } from './movie';

class User extends Model {
  id!: number;
  uuid!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  gender!: string;
  ipAddress!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      field: 'id',
    },
    uuid: {
      type: DataTypes.UUIDV4,
      allowNull: false,
      field: 'uuid',
      defaultValue: fn('uuid_generate_v4'),
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name',
    },
    email: {
      type: DataTypes.CITEXT,
      allowNull: false,
      field: 'email',
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Female',
      field: 'gender',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'ip_address',
    },
    createdAt: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'created_at',
      defaultValue: fn('NOW'),
    },
    updatedAt: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'updated_at',
      defaultValue: fn('NOW'),
    },
  },
  { sequelize, timestamps: true, tableName: 'users' },
);

export async function setup() {
  // Create users table
  const query = await fs.readFile(path.join(__dirname, 'user.sql'));
  await sequelize.query(query.toString());

  // Add users to the database
  await User.truncate({ cascade: true });
  const data = JSON.parse(
    (await fs.readFile(path.join(__dirname, 'users.json'))).toString(),
  );
  await User.bulkCreate(data);

  // Add movies to the database
  await setupMovies();
}

export async function cleanup() {
  await User.drop({ cascade: true });
  await cleanupMovies();
  await sequelize.close();
}

export default User;
