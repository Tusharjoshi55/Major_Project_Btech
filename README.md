# 🧠 AI Knowledge Workspace (StudyBuddy AI)

> A full-stack, enterprise-grade AI-powered Notebook workspace engineered with multi-format ingestion (PDFs, MP3s, MP4s), sub-second semantic retrieval via `pgvector`, query expansion mechanisms, timeline transcription pipelines, and double-speaker interactive audio podcast synthesis.

---

## 🏗️ System Architecture & Data Flow

```mermaid
graph TD
    %% Users & Client Application
    Client[React 18 SPA Client] -->|1. Authenticate with Supabase Auth| SupabaseAuth[Supabase Authentication]
    Client -->|2. Send Requests with Bearer JWT| ExpressGateway[Express.js Gateway Server]
    
    %% Middleware Layer
    ExpressGateway -->|3. Validate JWT signature| AuthMiddleware[authMiddleware.js]
    AuthMiddleware -->|If Valid: Sync metadata| DB_Users[(Postgres: users table)]
    
    %% Core Services Router
    ExpressGateway -->|/api/notebooks| NotebooksController[notebookController.js]
    ExpressGateway -->|/api/sources| SourcesController[sourceController.js]
    ExpressGateway -->|/api/chat| ChatController[chatController.js]
    ExpressGateway -->|/api/notes| NotesController[noteController.js]
    ExpressGateway -->|/api/audio| AudioController[audioController.js]
    
    %% Asynchronous File Pipeline
    SourcesController -->|Disk buffer upload| Multer[Multer Temporary Storage]
    SourcesController -->|4. Push raw file| SupaStorage[(Supabase Storage Bucket)]
    SourcesController -->|5. Insert status = 'pending'| DB_Sources[(Postgres: sources table)]
    SourcesController -->|6. Trigger async worker| UploadService[uploadService.js]
    
    %% Worker Ingestion Services
    UploadService -->|If PDF| PDFService[pdfService.js]
    UploadService -->|If Audio/Video| TranscribeService[transcriptionService.js]
    
    PDFService -->|Split with sliding window overlap| DocChunks[Text Chunks]
    TranscribeService -->|OpenAI Whisper transcription| AudioChunks[Sentence Timeline Chunks]
    
    DocChunks & AudioChunks -->|7. Send text batches| OpenAIEmbeddings[OpenAI Embeddings API]
    OpenAIEmbeddings -->|Get 1536-dim vectors| EmbedService[embeddingService.js]
    EmbedService -->|8. Batch bulk insert| DB_Chunks[(Postgres: chunks table)]
    
    %% Semantic RAG Engine
    ChatController -->|9. Query expansion & embedding| RAGService[ragService.js]
    RAGService -->|10. Coarse KNN match + cosine distance| DB_Chunks
    RAGService -->|11. Apply metadata relevance boosting| RAGService
    RAGService -->|12. Grounded system prompt context| OpenRouter[OpenRouter LLM Gateway]
    OpenRouter -->|Gemini 2.0 / GPT-4o-mini| ChatController
    ChatController -->|13. Stream reply with verified citations| Client
```

---

## 💻 Tech Stack Portfolio

| Layer | Technologies | Key Functional Responsibility |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Shadcn UI | Responsive SPA, modular components, theme engines, unified notebooks. |
| **State / Data** | React Query v5, Axios | Global server-state caching, optimistic updates, interceptor token auth. |
| **Auth & Storage**| Supabase Authentication & Storage | Multi-tenant auth UI, JWT session control, encrypted bucket uploads. |
| **Backend API** | Node.js, Express.js (ES Modules) | High-performance API server, rate limits, request validators, Helmet headers. |
| **Database** | PostgreSQL (Supabase) + `pgvector` | Structured metadata schemas, relational models, 1536d cosine vector scans. |
| **Cognitive AI** | OpenAI API, OpenRouter | Semantic chunk embeddings (`text-embedding-3-small`), Gemini 2.0 chat, Whisper. |
| **File Processing**| `pdf-parse`, `fluent-ffmpeg`, `multer`| File stream parsing, video-to-audio extraction, chunk overlap pipelines. |
| **Testing Engine**| Jest, Supertest | Unit & integration tests, mock services, route auditing. |

---

## 📁 Repository Map

```
major_project/
├── frontend/                 # React Single Page Application (SPA)
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.js  # Axios client with auto-inject JWT interceptors
│   │   │   └── index.js          # Unified API routes mapping
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Global Supabase authentication session provider
│   │   │   └── ThemeContext.jsx  # Dark/Light/System theme engine
│   │   ├── hooks/                # Caching server-state React hooks
│   │   │   ├── useNotebooks.js
│   │   │   ├── useSources.js     # Upload & background poll management
│   │   │   ├── useChat.js        # Chat sessions, history, and active message streams
│   │   │   └── useNotes.js       # Notes CRUD integration
│   │   ├── lib/
│   │   │   ├── supabase.js       # Supabase Client SDK configurations
│   │   │   └── utils.js          # Tailwind Merge utilities (cn)
│   │   ├── pages/                # Modular Page Components
│   │   │   ├── DashboardPage.jsx # Notebook collection overview
│   │   │   ├── LoginPage.jsx     # Sleek dark-mode authentication UI
│   │   │   ├── SignupPage.jsx
│   │   │   ├── NotebookPage.jsx  # Right-hand Split workspace (Sources, Chat, Notes)
│   │   │   ├── SettingsPage.jsx  # Custom theme selection and configurations
│   │   │   ├── ProfilePage.jsx   # Account metadata administration
│   │   │   └── NotFoundPage.jsx
│   │   └── components/
│   │       ├── ThemeToggle.jsx
│   │       └── ui/               # Radix-powered, Tailwind-styled primitives
│   └── index.html
│
├── backend/                  # Node.js + Express.js API Platform
│   ├── server.js             # Process entrypoint & graceful teardowns
│   ├── schema.sql            # Core PostgreSQL relational tables with pgvector indexes
│   ├── src/
│   │   ├── app.js            # Helmet, CORS, and Express routers binding
│   │   ├── config/
│   │   │   ├── db.js             # pg connection pool setup
│   │   │   ├── supabase.js       # Admin client setup for Storage management
│   │   │   └── openai.js         # OpenAI SDK linked to OpenRouter and custom endpoints
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js # Session token validator & Postgres dynamic sync
│   │   │   ├── validate.js       # express-validator constraints processor
│   │   │   ├── errorHandler.js   # Central error boundary
│   │   │   └── notFound.js       # 404 Handler
│   │   ├── routes/               # Modular Express API path configurations
│   │   │   ├── notebooks.js | sources.js | chat.js | notes.js | audio.js
│   │   ├── controllers/          # Endpoint controllers (Data-access checks & limits)
│   │   ├── services/             # Core backend logic & AI orchestrators
│   │   │   ├── uploadService.js  # Orchestrates async file-splitting & vectorizing workers
│   │   │   ├── pdfService.js     # Overlapping text chunk slider parsing
│   │   │   ├── transcriptionService.js # FFmpeg extraction & Whisper transcripts
│   │   │   ├── embeddingService.js  # OpenAI embedding generator and DB storer
│   │   │   └── ragService.js     # Multi-stage retrieval, Query expansion, Reranking
│   │   └── __tests__/            # Supertest suites mapping
```

---

## 🗄️ Relational Database Schema

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

### Table Schema Highlights

1. **`users`**: Synced dynamically upon API access. Maps the frontend authentication session context straight to our relational DB structure.
2. **`chunks.embedding vector(1536)`**: The core vector field, housing uniform 1536-dimensional matrices created using `text-embedding-3-small`.
3. **`sources.metadata` (JSONB)**: Dynamic schema storing parsed pages for PDF files, and timeline speech blocks for MP3/MP4 media files.
4. **`chat_messages.citations` (JSONB)**: Anchors claims straight to source entities using dynamic arrays: `[{ "source_id", "title", "page_number", "timestamp_start" }]`.

---

## 🌊 In-Depth Core Subsystems

### 1. Advanced RAG & Vector Pipeline

The Retrieval-Augmented Generation (RAG) pipeline is the core of the system's AI capability. When a user uploads a PDF, the backend extracts text page-by-page using pdf-parse, splits it into overlapping 500-token chunks with a 50-token stride, and generates 1,536-dimensional vector embeddings using OpenAI's text-embedding-3-small model. These embeddings are stored in a pgvector column (vector(1536)) and indexed for cosine similarity search.

At query time, the user's message is embedded using the same model. The five most semantically similar chunks are retrieved from the database using an approximate nearest-neighbour search (<=> cosine operator). These chunks, together with their source metadata (file name, page number, timestamp), are injected into a grounded prompt template sent to GPT-4o-mini. The model is explicitly instructed to answer only from the retrieved context and to cite specific pages and timestamps.

Rather than performing naive vector matches, the platform executes an advanced, multi-stage retrieval strategy:

* **Overlapping Text Windows**: PDFs are divided page-by-page. Content is then split into overlapping chunks (~1000 characters per chunk with a 200-character backward overlap) to maintain paragraph context across margins.
* **Query Expansion**: User queries are analyzed and expanded on the fly using synonym injection:
  * *"Definition of X"* expands to: `(definition OR meaning OR what is) X`.
  * *"Example of Y"* expands to: `(example OR sample OR illustration) Y`.
* **Multi-Stage Cosine Similarity Retrieval**:
  * An initial coarse KNN match searches the `chunks` index using `pgvector` distance operators:
    ```sql
    SELECT *, (embedding <=> $1) as distance
    FROM chunks
    WHERE notebook_id = $2 AND status = 'ready'
    ORDER BY embedding <=> $1 ASC
    LIMIT 10;
    ```
* **Contextual Re-Ranking & Boosting**:
  * A second-stage heuristics re-ranker boosts similarity scores based on query intent:
    * **Factual queries** ("fact", "explain") boost PDF chunks by **+10%**.
    * **Temporal queries** ("time", "during", "mention") boost Audio/Video chunks by **+15%**.
* **Citation & Fact Validation**:
  * The selected chunks are structured as system prompts to anchor LLM responses. Once the answer is generated, a strict verification scan guarantees all citations match the returned document snippets perfectly, preventing hallucinations.

---

### 2. Dual-Speaker Conversational Audio Synthesis (Podcast)
Allows students to convert their textbooks or lectures into a natural, high-energy conversational debate.

* **Alex & Sam Dialogue Generation**:
  * The backend structures the source content into a transcript with two distinct persona prompts:
    * **ALEX**: Curious host who drives engagement, asks probing questions, and requests real-world examples.
    * **SAM**: Tech-enthusiast expert who explains complex ideas using simple, catchy analogies.
  * Our customized prompts block generic introductions (like *"Welcome to our podcast"*), starting immediately with a fascinating query or a mind-bending fact to capture attention.
  * A robust regex parser validates and formats the raw script:
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
  * The structured turns are parsed on the frontend and played back with seamless, real-time Text-to-Speech (TTS).

---

### 3. Frontend Split-Screen & Server Caching System
* **Modular Dashboard & Workspaces**:
  * The main workspace interface features a split-pane layout: a document manager and notes panel on the left, and a multi-session grounded chat panel on the right.
* **React Query Server-State Synchronization**:
  * The UI utilizes React Query (`@tanstack/react-query`) to handle server synchronization, caching, and state transitions:
    * Multi-second polling checks the file status during background parsing pipelines.
    * Optimistic updates apply immediately when chat sessions are deleted, making the UI feel fast and responsive.

---

## 🔌 API Route Catalog

All routes require a valid header configuration:
`Authorization: Bearer <Supabase_JWT>`

### 1. Notebook Services (`/api/notebooks`)
| Method | Route | Body | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notebooks` | None | Lists all user notebooks with active count trackers. |
| **GET** | `/api/notebooks/:id` | None | Retrieves a single notebook's details. |
| **POST** | `/api/notebooks` | `{ "title": "...", "description": "..." }` | Creates a new notebook. |
| **PATCH** | `/api/notebooks/:id` | `{ "title": "...", "description": "..." }` | Updates notebook title or description. |
| **DELETE** | `/api/notebooks/:id` | None | Cascade-deletes a notebook and all associated files. |

### 2. Sources Ingestion (`/api/sources`)
| Method | Route | Body / Params | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/sources/upload` | Multipart: `file`, `notebookId` | Uploads file, moves it to Supabase Storage, and fires up the async vector pipeline. |
| **GET** | `/api/sources/status/:sourceId` | None | Returns the parsing status (`pending`, `processing`, `ready`, or `error`). |
| **GET** | `/api/sources/:notebookId` | None | Retrieves all active files within a notebook. |
| **DELETE** | `/api/sources/:sourceId` | None | Removes a file from storage and purges its vector chunks. |

### 3. RAG Conversational Engine (`/api/chat`)
| Method | Route | Body | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/chat` | `{ "notebookId": "...", "message": "...", "sessionId": "..." }` | Sends a message, triggers vector similarity scans, and generates a grounded response with citations. |
| **GET** | `/api/chat/sessions/:notebookId` | None | Lists all active chat sessions. |
| **GET** | `/api/chat/history/:sessionId` | None | Retrieves the full conversation history. |
| **DELETE** | `/api/chat/sessions/:sessionId` | None | Deletes a chat session. |
| **DELETE** | `/api/chat/message/:messageId` | None | Deletes a single message. |

### 4. Interactive Note-Taking (`/api/notes`)
| Method | Route | Body | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notes/:notebookId` | None | Lists all notes within a notebook. |
| **POST** | `/api/notes` | `{ "notebookId": "...", "title": "...", "content": "..." }` | Creates a new note. |
| **PATCH** | `/api/notes/:noteId` | `{ "title": "...", "content": "..." }` | Updates note content. |
| **DELETE** | `/api/notes/:noteId` | None | Deletes a note. |

### 5. Audio Overview Engine (`/api/audio`)
| Method | Route | Body | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/audio/overview` | `{ "notebookId": "...", "sourceIds": [] }` | Synthesizes an interactive, double-speaker podcast script based on notebook source materials. |

---

## 🛠️ Installation & Setup

### Prerequisites
* **Node.js** (v18.x or above)
* **PostgreSQL Database** with `pgvector` enabled (e.g. Supabase DB)
* **API Keys** for OpenRouter & OpenAI

### 1. Database Initialization
Execute the SQL statements inside `backend/schema.sql` within your Supabase SQL Editor. This will enable `pgvector`, build the tables, and set up helper indexes.

### 2. Environment Configurations
Create `.env` files in both the `backend/` and `frontend/` directories:

#### Backend Environment (`backend/.env`):
```env
PORT=5000
NODE_ENV=development

# Database Pool URL
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Supabase Auth & Storage API Keys
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cognitive AI Engines
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...
```

#### Frontend Environment (`frontend/.env`):
```env
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Server URL
VITE_API_BASE_URL=http://localhost:5000/api
```

### 3. Launching Services
Run the following commands in separate terminals to start the development servers:

```bash
# Terminal 1: Launch Backend
cd backend
npm install
npm run dev

# Terminal 2: Launch Frontend
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing Reference

### Running Test Suites
Verify all routes and services using Jest:
```bash
cd backend
npm test                  # runs all tests
npm run test:watch        # runs tests in watch mode
npm run test:coverage     # generates test coverage reports
```

### Mocking Strategy (`backend/src/__tests__/setup.js`)
* **Authentication**: Intercepts tokens and returns a mocked Supabase user payload.
* **Database Pool**: Intercepts `pool.query` and returns mock query results to avoid side effects during test runs.
* **Cognitive AI APIs**: Mocks embedding, transcription, and chat APIs to return predictable mock responses.

---

## 🛡️ Security Policies

1. **Helmet Protections**: Enforces secure HTTP headers to prevent MIME-sniffing, clickjacking, and script injection.
2. **CORS Protocol**: Configured to restrict backend access only to authorized frontend clients.
3. **Payload Limits**: Max request body size capped at **10MB** to protect server memory resources.
4. **JWT Verification**: Validates session tokens on the server for all protected routes, syncing user data on the fly.