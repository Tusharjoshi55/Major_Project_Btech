-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (mirrors Firebase Auth)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid TEXT UNIQUE NOT NULL, -- Original ID from Supabase Auth
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notebooks table
CREATE TABLE notebooks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled Notebook',
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sources table (PDF, MP3, MP4)
CREATE TABLE sources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id     UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  file_type       TEXT NOT NULL CHECK (file_type IN ('pdf', 'mp3', 'mp4')),
  file_url        TEXT NOT NULL,              -- Firebase Storage signed URL
  storage_path    TEXT,                       -- Firebase Storage object path (for deletion)
  file_size       BIGINT,                     -- bytes
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  -- JSONB stores raw transcript, page text, or metadata
  metadata        JSONB DEFAULT '{}',
  -- Example metadata shape:
  -- For PDF:   { "pages": [{"page": 1, "text": "..."}], "total_pages": 10 }
  -- For audio: { "transcript": [{"start": 0.0, "end": 3.2, "text": "Hello"}], "duration": 180 }
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks table (for RAG — one row per text chunk)
CREATE TABLE chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  -- Citation metadata
  page_number INT,                  -- for PDF
  timestamp_start FLOAT,           -- for audio/video (seconds)
  timestamp_end   FLOAT,
  -- pgvector embedding (openai/text-embedding-3-small = 1536 dims)
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: pgvector 0.8.x caps ANN indexes (IVFFlat, HNSW) at 2000 dims.
-- The nvidia/llama-nemotron model uses 2048 dims, so the index is omitted.
-- Exact KNN (sequential scan) is used instead — correct but slower at large scale.
-- To re-enable: upgrade pgvector >0.8.x or switch to a <=2000-dim model.

-- Notes table
CREATE TABLE notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled Note',
  content     TEXT,                  -- Markdown or plain text
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  -- Citations stored as JSON array: [{ source_id, title, page, timestamp }]
  citations       JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX idx_notebooks_user_id   ON notebooks(user_id);
CREATE INDEX idx_sources_notebook_id ON sources(notebook_id);
CREATE INDEX idx_chunks_source_id    ON chunks(source_id);
CREATE INDEX idx_chunks_notebook_id  ON chunks(notebook_id);
CREATE INDEX idx_notes_notebook_id   ON notes(notebook_id);
CREATE INDEX idx_messages_session_id ON chat_messages(session_id);