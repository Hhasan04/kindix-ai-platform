-- Runs automatically the FIRST time the postgres container creates its data volume.
-- If you ever wipe the volume and recreate it, this runs again.
CREATE EXTENSION IF NOT EXISTS vector;
