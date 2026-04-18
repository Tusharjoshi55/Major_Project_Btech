-- Execute this script in your Supabase SQL Editor to enable pgvector 
-- and create the necessary tables for the StudyBuddy AI backend RAG pipeline.

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create chunks table
CREATE TABLE IF NOT EXISTS public.chunks (
  id uuid NOT NULL,
  source_id uuid NULL,
  notebook_id uuid NULL,
  chunk_index integer NULL,
  content text NULL,
  page_number integer NULL,
  timestamp_start double precision NULL,
  timestamp_end double precision NULL,
  embedding vector(1536) NULL, -- Assuming OpenAI embeddings (1536 dims)
  CONSTRAINT chunks_pkey PRIMARY KEY (id)
);

-- (If using Google Gemini Embeddings (768), please change vector(1536) to vector(768))

-- 3. Optionally add an index for faster similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON public.chunks USING hnsw (embedding vector_cosine_ops);
