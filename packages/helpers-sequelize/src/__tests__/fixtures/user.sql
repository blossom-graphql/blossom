CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL
              PRIMARY KEY,

  uuid        UUID
              NOT NULL
              DEFAULT uuid_generate_v4(),

  first_name  VARCHAR(255)
              NOT NULL,

  last_name   VARCHAR(255)
              NOT NULL,

  email       CITEXT
              NOT NULL,

  gender      VARCHAR(20)
              NOT NULL,

  ip_address  VARCHAR(255)
              NOT NULL,

  created_at  TIMESTAMPTZ
              NOT NULL
              DEFAULT NOW(),

  updated_at  TIMESTAMPTZ
              NOT NULL
              DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_users_uuid ON users USING HASH(uuid);
CREATE INDEX IF NOT EXISTS idx_on_users_created_at ON users USING BTREE(created_at);
