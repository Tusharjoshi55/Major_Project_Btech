# 🧠 StudyBuddy AI Backend Services

Welcome to the backend engineering documentation of the **StudyBuddy AI Platform**. This repository hosts a high-performance, modular, Retrieval-Augmented Generation (RAG) backend engineered with Node.js, Express, and PostgreSQL (via Supabase).

This service functions as the central intelligence engine—orchestrating multi-format ingestion (PDFs, MP3s, MP4s), sub-second vector search indexing via `pgvector`, dual-speaker conversational audio script synthesis, and robust secure session auditing.

---

## 🏗 Stack & System Architecture

```mermaid
graph TD
    %% User & Auth
    User[Client Application / Frontend] -->|1. Authenticate & Obtain JWT| SupaAuth[Supabase Auth Service]
    User -->|2. Request with Bearer JWT| AuthMW[authMiddleware.js]
    
    %% Middleware verification
    AuthMW -->|3. Verify JWT| SupaAuth
    AuthMW -->|4. Sync / Upsert User| PG_Users[(Postgres: users table)]
    
    %% File Upload Pipeline
    User -->|5. Upload PDF/MP3/MP4| SrcRoute[routes/sources.js]
    SrcRoute -->|Local Temp Disk Write| Multer[Multer Storage]
    SrcRoute -->|6. Push Media Asset| SupaStore[(Supabase Storage Bucket)]
    SrcRoute -->|7. Create Pending Source| PG_Sources[(Postgres: sources table)]
    SrcRoute -->|8. Dispatch Async Worker| UploadService[services/uploadService.js]
    
    %% Background Ingestion Worker
    UploadService -->|If Document| PDFService[services/pdfService.js]
    UploadService -->|If Audio/Video| TranscribeService[services/transcriptionService.js]
    
    PDFService -->|Extract & Overlap Chunking| TextChunks[Document Text Chunks]
    TranscribeService -->|OpenAI Whisper Transcription| AudioChunks[Timeline Transcript Chunks]
    
    TextChunks & AudioChunks -->|9. Generate 1536-dim Vector| EmbedService[services/embeddingService.js]
    EmbedService -->|OpenAI text-embedding-3-small| OpenAIApi[OpenAI API]
    
    EmbedService -->|10. Store Vectors & Index| PG_Chunks[(Postgres: chunks table)]
    
    %% RAG Chat Engine
    User -->|11. Submit Query| ChatRoute[routes/chat.js]
    ChatRoute -->|12. Semantic Match| RAGService[services/ragService.js]
    RAGService -->|Cosine Distance search <->| PG_Chunks
    RAGService -->|13. Feed Retrieved Context| OpenRouter[OpenRouter AI Gateway]
    OpenRouter -->|Gemini 2.0 Flash Lite| User
```

### Key Architectural Pillars

* **Express & Node.js Engine**: Built with ESM modules (`"type": "module"`), implementing structured controllers, services, and route boundaries.
* **Vectorized Data Storage**: Fully relational **PostgreSQL** running on **Supabase** with the `pgvector` extension enabled, managing a multi-tenant relational system.
* **Secured Media Pipelines**: Zero-persistence local disk writes; media files processed asynchronously via `multer` are stored in secure **Supabase Storage Buckets**, generating time-limited signed access URLs.
* **Dual-Engine AI Orchestration**:
  * **OpenAI API**: Generates uniform 1536-dimensional semantic representations using the `text-embedding-3-small` model.
  * **OpenRouter**: Acts as an API gateway for flexible LLM integrations, serving free/high-efficiency models (e.g., `google/gemini-2.0-flash-lite`) to power grounding chat sessions and dynamic synthesis tasks.

---

## 🗄 Database Schema Reference

The backend relational schema is defined inside `schema.sql` and operates under strict constraints, primary keys, and index keys to optimize relational querying and KNN/ANN matching.

### Database ER Model Details

```mermaid
erDiagram
    users {
        uuid id PK
        string supabase_uid UK
        string email UK
        string display_name
        string avatar_url
        timestamp created_at
    }
    notebooks {
        uuid id PK
        uuid user_id FK
        string title
        string description
        timestamp created_at
    }
    sources {
        uuid id PK
        uuid notebook_id FK
        uuid user_id FK
        string title
        string file_type
        string file_url
        string storage_path
        bigint file_size
        string status
        jsonb metadata
        timestamp created_at
    }
    chunks {
        uuid id PK
        uuid source_id FK
        uuid notebook_id FK
        int chunk_index
        string content
        int page_number
        float timestamp_start
        float timestamp_end
        vector embedding
    }
    notes {
        uuid id PK
        uuid notebook_id FK
        uuid user_id FK
        string title
        string content
        timestamp created_at
    }
    chat_sessions {
        uuid id PK
        uuid notebook_id FK
        uuid user_id FK
        timestamp created_at
    }
    chat_messages {
        uuid id PK
        uuid session_id FK
        string role
        string content
        jsonb citations
        timestamp created_at
    }

    users ||--o{ notebooks : "owns"
    users ||--o{ sources : "uploads"
    users ||--o{ notes : "creates"
    users ||--o{ chat_sessions : "starts"
    notebooks ||--o{ sources : "contains"
    notebooks ||--o{ chunks : "indexes"
    notebooks ||--o{ notes : "holds"
    notebooks ||--o{ chat_sessions : "associates"
    sources ||--o{ chunks : "splits_into"
    chat_sessions ||--o{ chat_messages : "records"
```

### Table Dictionary

#### `users`
Syncs the Supabase authentication profiles dynamically upon API routing.
* **`id`** (`UUID`): Primary key, defaults to `gen_random_uuid()`.
* **`supabase_uid`** (`TEXT`): Unique reference token mapped directly to Supabase internal metadata.
* **`email`** (`TEXT`): Direct contact email.

#### `sources`
Holds binary document records and operational pipeline states (`pending`, `processing`, `ready`, `error`).
* **`metadata`** (`JSONB`): Schema-less payload containing structured document metadata:
  * *PDF Example*: `{ "pages": [{"page": 1, "text": "..."}], "total_pages": 10 }`
  * *Audio Example*: `{ "transcript": [{"start": 0.0, "end": 3.2, "text": "Hello"}], "duration": 180 }`

#### `chunks`
Contains the core vector data used by the RAG pipelines.
* **`embedding`** (`vector(1536)`): Stores OpenAI's standard vector matrices.
* **`page_number`** / **`timestamp_start` / `timestamp_end`**: Used to build robust UI citation models (allowing the client to link responses directly to page numbers or timeline segments).

---

## 🌊 Deep-Dive: Core Subsystems

### 1. The pgvector RAG Pipeline
Our RAG (Retrieval-Augmented Generation) pipeline ensures that conversations are fully grounded in user documents.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client
    participant API as Chat Controller
    participant DB as Postgres (pgvector)
    participant OpenRouter as LLM (Gemini 2.0)

    User->>API: Send Chat Message ("Explain Page 3 concept")
    API->>API: Embed message using text-embedding-3-small
    API->>DB: Query top chunks (Cosine Similarity: <->)
    DB-->>API: Return top 5 relevant text chunks + page numbers
    API->>API: Inject chunks into system prompt (Grounding)
    API->>OpenRouter: Send combined prompt + Chat History
    OpenRouter-->>API: Stream formatted response with sources
    API-->>User: Return answer + citations [{page_number, source_id}]
```

#### Grounded Context Ingestion & Embedding Generation
* **Overlapping Sliding Window**:
  * PDF files are parsed page-by-page. To prevent context cutting at arbitrary page margins, text is split into highly coherent overlapping chunks (e.g., ~1000 characters per chunk, with a 200-character slide back).
  * Audio/Video files are transcribed using OpenAI's high-fidelity Whisper models. Timeline-anchored sentences are clustered together, allowing the user to search speech records by timestamp.
* **Vector Vector Space Search**:
  * On every user message, a cosine similarity scan is conducted on the `chunks` index using the `<->` distance operator:
    ```sql
    SELECT content, page_number, timestamp_start, timestamp_end, 
           (embedding <=> $1) as distance
    FROM chunks
    WHERE notebook_id = $2
    ORDER BY embedding <=> $1 ASC
    LIMIT 5;
    ```
  * These segments are injected directly into the LLM system prompt as verified citations, ensuring the AI model does not hallucinate facts.

---

### 2. Audio Synthesis Engine (Double-Speaker Podcast)
This service enables a beautiful, modular "Podcast" feature where students can convert their study notebooks into high-energy, dual-speaker conversational audio.

* **Dynamic Conversational Scripting**:
  * The backend fetches the raw text from all ready sources within a given notebook.
  * We prompt our model (`google/gemini-2.0-flash-lite`) to digest the materials and structure a natural debate/dialogue between two synthetic speakers: **ALEX** (the host who drives curiosity with smart questions) and **SAM** (the expert who answers with analogies and deep excitement).
  * Strict regex parsers validate the structured script output:
    ```js
    const turns = script
      .split('\n')
      .map(line => {
        const match = line.match(/^(ALEX|SAM):\s*(.+)$/);
        if (match) return { speaker: match[1], text: match[2] };
        return null;
      })
      .filter(Boolean);
    ```
  * The structured turns array can be directly consumed by frontend TTS (Text-to-Speech) engines to produce speech dynamically in real-time.

---

### 3. Security, Middleware, and Auditing Layer
* **Rate-Limiting Protection**: Prevent API abuse using `express-rate-limit`:
  ```js
  const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 Minute window
      max: 100 // limit each IP to 100 requests per window
  });
  ```
* **Dynamic SQL User Sync (`authMiddleware.js`)**:
  * Intercepts standard headers: `Authorization: Bearer <JWT>`.
  * Verifies the token signatures dynamically against the Supabase Project authentication endpoints.
  * If valid, it checks if a corresponding local record exists inside `users`. If missing, it immediately upserts the user's details (`id`, `email`, `display_name`, `avatar_url`) before allowing the router to trigger downstream database operations.

---

## 🔌 API Endpoint Catalog

All routes require a valid header configuration:
`Authorization: Bearer <Supabase_JWT>`

### 1. Notebook Management (`/api/notebooks`)
| Method | Endpoint | Description | Request Body Example |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notebooks` | List all user notebooks | None |
| **GET** | `/api/notebooks/:id` | Fetch specific notebook metadata | None |
| **POST** | `/api/notebooks` | Create a new notebook | `{ "title": "Math 101" }` |
| **PATCH** | `/api/notebooks/:id` | Edit details | `{ "title": "Revised Math", "description": "Notes" }` |
| **DELETE** | `/api/notebooks/:id` | Cascade delete notebook and associated files | None |

### 2. Sources Ingestion (`/api/sources`)
| Method | Endpoint | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/sources/upload` | Upload source file (PDF/MP3/MP4) | Multi-part form-data: `file`, `notebookId` |
| **GET** | `/api/sources/status/:sourceId` | Check parsing pipeline processing progress | None (Returns: `pending`, `processing`, `ready`, `error`) |
| **GET** | `/api/sources/:notebookId` | List all ready source files inside a notebook | None |
| **DELETE** | `/api/sources/:sourceId` | Remove source record + vector chunks from db | None |

### 3. RAG Chat Services (`/api/chat`)
| Method | Endpoint | Description | Request Body Example |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/chat` | Send a grounded chat question | `{ "notebookId": "<UUID>", "message": "What is chapter 1?" }` |
| **GET** | `/api/chat/sessions/:notebookId` | Retrieve chat sessions for a notebook | None |
| **GET** | `/api/chat/history/:sessionId` | Retrieve full message history logs | None |
| **DELETE** | `/api/chat/sessions/:sessionId` | Delete chat session | None |
| **DELETE** | `/api/chat/message/:messageId` | Delete singular message in a session | None |

### 4. Interactive Notes (`/api/notes`)
| Method | Endpoint | Description | Request Body Example |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notes/:notebookId` | List all notes in a notebook | None |
| **POST** | `/api/notes` | Create a new note | `{ "notebookId": "<UUID>", "title": "My Note", "content": "..." }` |
| **PATCH** | `/api/notes/:noteId` | Update note content | `{ "title": "Updated Title", "content": "Markdown content" }` |
| **DELETE** | `/api/notes/:noteId` | Delete note | None |

### 5. Audio Summarization Engine (`/api/audio`)
| Method | Endpoint | Description | Request Body Example |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/audio/overview` | Generate a 2-speaker debate podcast | `{ "notebookId": "<UUID>", "sourceIds": ["<UUID_1>"] }` |

---

## 🛠 Local Setup & Installation

### Prerequisites
* **Node.js** (v18.x or above recommended)
* **PostgreSQL DB** with `pgvector` enabled (e.g. Supabase DB)
* **API Keys** for OpenRouter & OpenAI

### 1. Environment Variable Template
Create a `.env` file in the root backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Pool Configuration (Supabase PostgreSQL URL)
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Supabase Storage & Client API Configs
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider Gateway Keys
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...
```

### 2. Startup Commands
Install development and production packages, and launch the dev environment:

```bash
# Install local node modules
npm install

# Start database migration (if pgvector isn't initialized yet)
# run schema.sql queries in your Supabase SQL Editor

# Run server with live hot-reloads (via nodemon)
npm run dev
```

### 3. Server Sanity Verification
To ensure everything started and connected to Supabase and Postgres successfully:
```bash
curl http://localhost:5000/health
```

Expected response payload:
```json
{
  "status": "ok",
  "timestamp": "2026-05-23T04:19:54.000Z",
  "env": "development"
}
```

---

## 🛡 System Security Policies

1. **Helmet Protections**: Automatically injects strict HTTP headers to restrict MIME-sniffing, block clickjacking attempts, and manage frame security.
2. **CORS Protocol**: Pre-configured to allow flexible cross-origin communication from localized frontend channels while restricting unsupported external agents.
3. **Payload Limits**: Max body limits strictly enforced at **10MB** to safeguard processing streams against potential memory starvation.

Enjoy building on the **StudyBuddy AI Core Service Engine**!