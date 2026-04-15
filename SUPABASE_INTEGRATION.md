# Supabase Integration Setup

This document outlines how Supabase is integrated into the notebooklm-clone project for authentication, database, and storage.

## Overview

The project uses Supabase for:
1. **Authentication** - User management and session handling
2. **Database** - PostgreSQL with pgvector for vector similarity search
3. **Storage** - Supabase Storage for file uploads (PDFs, audio, video)

## Architecture

```
Frontend (React)
    │
    │ (Firebase ID Token)
    ▼
Backend (Express.js)
    ├── Auth Middleware → Supabase Auth (verify JWT)
    ├── Database → PostgreSQL + pgvector
    └── Storage → Supabase Storage
```

## Components

### 1. Supabase Authentication

**File**: `src/config/supabase.js`

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

**Usage in Auth Middleware** (`src/middleware/authMiddleware.js`):
- Verifies Firebase ID tokens using Supabase Auth
- Extracts user information from token
- Performs upsert of user record in PostgreSQL
- Attaches user data to request object

### 2. PostgreSQL Database with pgvector

**Schema** (`backend/schema.sql`):
- `users` - User accounts (supabase_uid, email, profile data)
- `notebooks` - User-created notebooks
- `sources` - Uploaded files (PDF, MP3, MP4) with status tracking
- `chunks` - Text chunks with pgvector embeddings for RAG
- `notes` - User notes
- `chat_sessions` - Chat conversation sessions
- `chat_messages` - Individual chat messages with citations

**Vector Search**:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector index for fast similarity search
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Query with cosine similarity
SELECT * FROM chunks 
WHERE embedding <=> query_embedding::vector 
ORDER BY embedding <=> query_embedding::vector
LIMIT 10;
```

### 3. Supabase Storage

**Configuration** (`backend/.env`):
```env
SUPABASE_URL=https://hylymtutavofjzxzvgey.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_BUCKET=major_project
```

**Upload Flow** (`src/services/uploadService.js`):
1. File uploaded to Firebase Storage (frontend)
2. Signed URL generated for secure access
3. Backend receives upload notification
4. File processed (PDF/text extraction, transcription)
5. Chunks created and embedded
6. Chunks stored in Supabase Storage
7. Metadata stored in PostgreSQL

## Environment Variables

### Required Variables

```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-or-service-key
SUPABASE_BUCKET=your-bucket-name

# OpenAI
OPENAI_API_KEY=sk-...

# Optional
LOG_LEVEL=info
```

### Security Notes

1. **Never commit** `.env` file to git
2. **Service Role Key** should only be used in backend
3. **Anonym Key** can be used in frontend for public access
4. Use **Row Level Security (RLS)** policies in Supabase

## Database Connection

### Connection Pooling
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});
```

### Query Patterns

**User Verification**:
```javascript
const { rows } = await pool.query(
  `SELECT id FROM users WHERE supabase_uid = $1`,
  [userId]
);
```

**Upsert User**:
```javascript
await pool.query(
  `INSERT INTO users (supabase_uid, email)
   VALUES ($1, $2)
   ON CONFLICT (supabase_uid) DO UPDATE SET
     email = EXCLUDED.email`,
  [userId, email]
);
```

**Vector Search**:
```javascript
const { rows } = await pool.query(
  `SELECT c.*, s.title, 
          1 - (c.embedding <=> $1::vector) AS similarity
   FROM chunks c
   JOIN sources s ON c.source_id = s.id
   WHERE c.notebook_id = $2
     AND s.status = 'ready'
   ORDER BY c.embedding <=> $1::vector
   LIMIT $3`,
  [queryEmbedding, notebookId, topK]
);
```

## Error Handling

### Connection Errors
```javascript
pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));
```

### Supabase Errors
```javascript
try {
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .eq('id', id);
    
  if (error) throw error;
  return data;
} catch (err) {
  console.error('Supabase error:', err.message);
  // Handle gracefully
}
```

## Testing

### Test Database Setup
```bash
# Create test database
createdb notebooklm_test_db

# Run migrations
psql notebooklm_test_db -f backend/schema.sql

# Set test environment
export DATABASE_URL=postgresql://localhost/notebooklm_test_db
```

### Integration Tests
The project includes integration tests that verify:
- Authentication middleware with Supabase
- Database queries and vector search
- File upload and processing pipeline
- RAG retrieval and response generation

## Migration Guide

### From Firebase to Supabase

**Before (Firebase)**:
```javascript
import firebaseAdmin from 'firebase-admin';
const auth = firebaseAdmin.auth();
const db = firebaseAdmin.firestore();
```

**After (Supabase)**:
```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);
// Auth via getUser(), Database via pool.query()
```

## Monitoring

### Key Metrics to Track

1. **Auth Performance**
   - Token verification latency
   - User upsert time

2. **Database Performance**
   - Query execution time (P95, P99)
   - Vector search latency
   - Connection pool utilization

3. **Storage Performance**
   - Upload/download speed
   - File processing time

4. **RAG Performance**
   - Retrieval latency
   - Re-ranking effectiveness
   - Citation accuracy

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   ```bash
   # Check database connectivity
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

2. **Supabase Key Invalid**
   - Verify key in Supabase dashboard
   - Check if anon key vs service role key is needed

3. **Vector Index Not Found**
   ```sql
   -- Recreate vector index
   DROP INDEX IF EXISTS chunks_embedding_idx;
   CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);
   ```

## Security Best Practices

1. **Row Level Security**: Enable RLS on all tables
2. **JWT Verification**: Always verify tokens server-side
3. **CORS Configuration**: Restrict frontend origins
4. **Rate Limiting**: Prevent abuse of public endpoints
5. **Audit Logs**: Track user actions

## Next Steps

1. Set up Supabase project in production
2. Configure database with pgvector extension
3. Set up storage buckets
4. Configure environment variables
5. Test authentication flow
6. Run integration tests