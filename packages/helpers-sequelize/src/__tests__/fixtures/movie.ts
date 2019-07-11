import { promises as fs } from 'fs';
import path from 'path';

import { fn, DataTypes, Model } from 'sequelize';

import sequelize from './sequelize';

class Movie extends Model {
  id!: number;
  uuid!: string;
  title!: string;
  user_id!: number;
  created_at!: Date;
  updated_at!: Date;
}
Movie.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'title',
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'user_id',
    },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
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
  { sequelize, timestamps: true, tableName: 'movies' },
);

export async function setup() {
  // Create users table
  const query = await fs.readFile(path.join(__dirname, 'movies.sql'));
  await sequelize.query(query.toString());

  // Add users to the database
  await Movie.truncate({ cascade: true });
  const data = JSON.parse((await fs.readFile(path.join(__dirname, 'movies.json'))).toString());
  await Movie.bulkCreate(data);
}

export async function cleanup() {
  await Movie.drop();
  // await sequelize.close();
}

export default Movie;
