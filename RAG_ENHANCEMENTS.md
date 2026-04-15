# Advanced RAG (Retrieval-Augmented Generation) Features

## Overview
This document describes the advanced RAG implementation enhancements added to the notebooklm-clone project, providing sophisticated document retrieval and question-answering capabilities.

## Key Enhancements

### 1. Multi-Stage Retrieval Pipeline

**Coarse Retrieval Stage**
- Uses pgvector cosine similarity for fast approximate nearest neighbor search
- Retrieves top-K (default 10) most similar chunks from PostgreSQL with pgvector extension
- Filters by `status = 'ready'` to exclude processing or errored sources

**Fine-Grained Re-Ranking Stage**
- Applies metadata-based boosting to improve relevance
- File type awareness (PDF, MP3, MP4) for context-aware boosting
- Fallback to coarse results if re-ranking fails

### 2. Query Expansion

**Synonym-Based Expansion**
```javascript
// Example: "definition" expands to:
// (definition OR meaning OR what is)
```

**Supported Query Terms**
- `definition` → definition, meaning, what is
- `example` → example, sample, illustration
- `cause` → cause, reason, why
- `effect` → effect, result, consequence
- `process` → process, procedure, method
- `benefit` → benefit, advantage, pros

**Usage**
```javascript
const expandedQuery = expandQuery('definition');
// Returns: (definition OR meaning OR what is)
```

### 3. Intelligent Re-Ranking

**Metadata-Based Boosting**
- PDF chunks get +10% boost for factual queries ("definition", "fact")
- Audio chunks (MP3/MP4) get +15% boost for temporal queries ("time", "during")
- Video chunks get +10% boost for demonstration queries ("show", "demonstrate")
- Source type awareness for context relevance

**Re-Ranking Logic**
```javascript
rerank_score = vector_similarity * boost_factor
```

### 4. Document Summarization

**Long Document Handling**
- Automatically detects documents with >20 chunks
- Creates semantic summaries using GPT-4o-mini
- Groups chunks into sections (10 chunks per section)
- Generates 3-5 key points per section

**Timeline Summarization**
- Automatically detects long transcripts (>30 chunks)
- Extracts key moments at regular intervals
- Provides timestamp-based summaries
- Useful for audio/video content

**Storage**
- Summaries stored in PostgreSQL `metadata` column (JSONB)
- Key-value structure: `{ summaries: [{section_start, section_end, summary}] }`
- Timeline stored as: `{ timeline: [{timestamp, summary, chunk_index}] }`

### 5. Enhanced Citation System

**Citation Format**
```
[Source 1: "document.pdf", Page 3]
[Source 2: "video.mp4" @ 2:30]
[Source 3: "presentation.mp4" @ 1:25:30]
```

**Features**
- Automatic source labeling with numbers
- Page numbers for PDFs
- Timestamps for audio/video
- Multiple source support per claim
- Validation to prevent hallucination

**Answer Validation**
```javascript
const validation = validateAnswerGrounding(answer, citations);
// Returns { isGrounded: boolean, reason: string }
```

### 6. Robust Error Handling

**Retry Logic**
- Maximum 3 retries for API calls
- Exponential backoff (1s, 2s, 3s)
- Graceful degradation on failure

**Logging**
- Detailed console logging at each stage
- Warning messages for non-critical failures
- Error tracking with context

### 7. Database Schema Enhancements

**Chunks Table Improvements**
```sql
-- Added id column for tracking
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
-- Allows individual chunk management and debugging

-- Enhanced metadata support
metadata JSONB DEFAULT '{}'
-- Can store summary data, timeline info, etc.
```

### 8. Performance Optimizations

**Vector Index**
```sql
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
```

**Batch Processing**
- Embedding API called in batches of 20
- Reduces API overhead
- Improves throughput

## API Usage Examples

### Basic Retrieval
```javascript
import { retrieve, buildGroundedPrompt } from './src/services/ragService.js';

const chunks = await retrieve('query text', 'notebook-id', 10, 6);
const prompt = buildGroundedPrompt(chunks);
```

### With Query Expansion
```javascript
import { expandQuery, retrieve, buildGroundedPrompt } from './src/services/ragService.js';

const query = 'how does this work';
const expanded = expandQuery(query);
const chunks = await retrieve(expanded, 'notebook-id', 10, 6);
const prompt = buildGroundedPrompt(chunks);
```

### Validation
```javascript
import { validateAnswerGrounding, formatCitations } from './src/services/ragService.js';

const citations = [
  { title: 'doc.pdf', page_number: 5 },
  { title: 'video.mp4', timestamp_start: 120 }
];

const formatted = formatCitations(citations);
// "[1: doc.pdf, Page 5][2: video.mp4 @ 2:00]"

const validation = validateAnswerGrounding('My answer', citations);
// { isGrounded: true, reason: 'Answer has citations' }
```

## Configuration

### Environment Variables
```env
# OpenAI
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Supabase
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=your-key
SUPABASE_BUCKET=project-bucket
```

### Tunable Parameters
```javascript
// In ragService.js
const EMBEDDING_MODEL = 'text-embedding-3-small';
const RERANKING_MODEL = 'text-ranking-001'; // Future use
const BATCH_SIZE = 20; // Embedding batch size
const MAX_RETRIES = 3; // API retry attempts
const RETRY_DELAY = 1000; // Base retry delay (ms)

// In uploadService.js
const CHUNK_SIZE = 500; // Words per chunk
const CHUNK_OVERLAP = 50; // Word overlap
const SUMMARY_SECTION_SIZE = 10; // Chunks per summary section
const TIMELINE_INTERVAL_RATIO = 0.2; // For key moment extraction
```

## Testing

Run the test suite:
```bash
# Using vitest
npm test

# Or with specific test file
node --test test_rag_enhanced.js
```

## Future Enhancements

1. **Hybrid Search**: Combine vector + keyword search
2. **Semantic Chunking**: Better chunk boundaries using NLP
3. **Multi-Modal Embeddings**: Unified text/image embeddings
4. **Personalization**: User-specific ranking and preferences
5. **Caching**: Redis cache for frequent queries
6. **A/B Testing**: Compare different retrieval strategies
7. **User Feedback Loop**: Improve relevance based on user corrections
8. **Cross-Modal Retrieval**: Search across PDF, audio, and video simultaneously

## Monitoring & Observability

Key metrics to track:
- Retrieval latency (P95, P99)
- Re-ranking effectiveness
- Summary generation time
- Citation accuracy
- User satisfaction scores
- Hallucination rate (via validation)