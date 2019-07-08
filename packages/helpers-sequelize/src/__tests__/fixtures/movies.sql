CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS movies (
  id          SERIAL
              PRIMARY KEY,

  uuid        UUID
              NOT NULL
              DEFAULT uuid_generate_v4(),

  title       VARCHAR(255)
              NOT NULL,

  user_id     BIGINT
              NOT NULL
              REFERENCES users(id)
              ON DELETE CASCADE,

  rating      SMALLINT
              NOT NULL,

  created_at  TIMESTAMPTZ
              NOT NULL
              DEFAULT NOW(),

  updated_at  TIMESTAMPTZ
              NOT NULL
              DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
  idx_on_movies_uuid
ON    movies
USING HASH(uuid);

CREATE INDEX IF NOT EXISTS
      idx_on_movies_user_id
ON    movies
USING BTREE(user_id);

CREATE INDEX IF NOT EXISTS
      idx_on_movies_created_at
ON    movies
USING BTREE(created_at);
