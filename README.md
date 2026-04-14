#  AI Knowledge Workspace for Students

> Full-stack AI-powered notebook with multimodal uploads, RAG chat with citations, transcription pipeline, and audio overviews.

---

## ✅ Project Status

### Completed ✅
- [x] Full folder structure — frontend & backend
- [x] PostgreSQL schema with pgvector (users, notebooks, sources, chunks, notes, chat)
- [x] Firebase Auth — frontend context + backend JWT middleware
- [x] ES Modules (`import/export`) throughout — backend & frontend
- [x] Express app with CORS, helmet, rate-limiting, validation
- [x] All 5 route groups: notebooks, sources, chat, notes, audio
- [x] All controllers with ownership checks and error handling
- [x] Upload pipeline: Firebase Storage + async background processing
- [x] PDF extraction service (pdf-parse, page-by-page, overlapping chunks)
- [x] Audio/Video transcription (FFmpeg + OpenAI Whisper)
- [x] Embedding service (OpenAI text-embedding-3-small, batched)
- [x] RAG retrieval (pgvector cosine similarity + grounded prompt builder)
- [x] Grounded chat with citations (page numbers + timestamps)
- [x] Audio Overview — 2-person podcast script generator
- [x] React frontend: Auth pages, Dashboard, Notebook view
- [x] React Query hooks for all API calls
- [x] Chat UI with citation badges + markdown rendering
- [x] Notes CRUD with inline editor
- [x] Jest tests: notebooks routes, services, chat routes
- [x] Express-validator input validation on all routes
- [x] Auto-upsert user in PostgreSQL on every auth'd request


## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│           React Frontend (Vite + shadcn/ui)              │
│  AuthContext │ React Query hooks │ Axios (auto-token)     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS + Bearer <Firebase JWT>
┌────────────────────▼────────────────────────────────────┐
│                Express.js Backend                        │
│                                                          │
│  authMiddleware (Firebase verify + PG upsert)            │
│                                                          │
│  /api/notebooks  →  notebookController                   │
│  /api/sources    →  sourceController → uploadService     │
│  /api/chat       →  chatController   → ragService        │
│  /api/notes      →  noteController                       │
│  /api/audio      →  audioController                      │
└──────┬──────────────┬───────────────────┬───────────────┘
       │              │                   │
  ┌────▼────┐   ┌─────▼──────┐   ┌───────▼──────┐
  │Firebase │   │ PostgreSQL  │   │  OpenAI API  │
  │Storage  │   │ + pgvector  │   │  Whisper     │
  │(files)  │   │ (all data)  │   │  Embeddings  │
  └─────────┘   └────────────┘   │  Chat GPT    │
                                  └──────────────┘
```

---

## 📁 Folder Structure

```
notebooklm-clone/
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── axiosInstance.js     ← auto-injects Firebase token
│       │   └── index.js             ← all API functions
│       ├── context/
│       │   └── AuthContext.jsx      ← login, signup, Google, logout
│       ├── hooks/
│       │   ├── useNotebooks.js
│       │   ├── useSources.js        ← upload + status polling
│       │   ├── useChat.js           ← optimistic messages
│       │   └── useNotes.js
│       ├── lib/
│       │   ├── firebase.js
│       │   └── utils.js
│       └── pages/
│           ├── LoginPage.jsx
│           ├── SignupPage.jsx
│           ├── DashboardPage.jsx
│           ├── NotebookPage.jsx     ← sources + chat + notes
│           └── NotFoundPage.jsx
│
└── backend/
    ├── server.js
    ├── schema.sql
    └── src/
        ├── app.js
        ├── config/
        │   ├── db.js                ← pg Pool
        │   ├── firebase.js          ← Admin SDK
        │   |── openai.js
        |   └─── supabase.js          ← Supabase client
        ├── middleware/
        │   ├── authMiddleware.js    ← verify JWT + upsert user
        │   ├── validate.js
        │   ├── errorHandler.js
        │   └── notFound.js
        ├── routes/
        │   ├── notebooks.js
        │   ├── sources.js
        │   ├── chat.js
        │   ├── notes.js
        │   └── audio.js
        ├── controllers/
        │   ├── notebookController.js
        │   ├── sourceController.js
        │   ├── chatController.js
        │   ├── noteController.js
        │   └── audioController.js
        ├── services/
        │   ├── uploadService.js     ← orchestrates the pipeline
        │   ├── pdfService.js        ← pdf-parse + chunking
        │   ├── transcriptionService.js ← FFmpeg + Whisper
        │   ├── embeddingService.js  ← OpenAI → pgvector
        │   └── ragService.js        ← cosine search + prompt
        └── __tests__/
            ├── setup.js             ← mocks Firebase, DB, OpenAI
            ├── notebooks.test.js
            ├── chat.test.js
            └── services.test.js
```

---

## 🗄️ Database Schema

6 tables: `users` → `notebooks` → `sources` → `chunks` (vector store) + `notes` + `chat_sessions` → `chat_messages`

Run once:
```bash
createdb notebooklm_db
psql notebooklm_db -f backend/schema.sql
```

Key design decisions:
- `chunks.embedding vector(1536)` — pgvector column for cosine similarity search
- `sources.metadata JSONB` — stores raw page text (PDF) or transcript segments (audio)
- `chat_messages.citations JSONB` — stores citation array with source, page, timestamp
- Auto `updated_at` triggers on users, notebooks, sources, notes

---

## ⚙️ Setup

###  PostgreSQL + pgvector

createdb major_project


### Backend
```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, FIREBASE_*, OPENAI_API_KEY
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env
# Fill in VITE_FIREBASE_* values
npm install
npm run dev
```

---

## 🔌 API Endpoints (Full Reference)

All routes except `/health` require: `Authorization: Bearer <Firebase ID Token>`

### Health
| Method | Endpoint  | Auth | Description       |
|--------|-----------|------|-------------------|
| GET    | `/health` | ❌   | Server health check |

---

### Notebooks `/api/notebooks`
| Method | Endpoint              | Body                        | Description                     |
|--------|-----------------------|-----------------------------|---------------------------------|
| GET    | `/api/notebooks`      | —                           | List all notebooks (with counts)|
| GET    | `/api/notebooks/:id`  | —                           | Get single notebook             |
| POST   | `/api/notebooks`      | `{title, description}`      | Create notebook                 |
| PATCH  | `/api/notebooks/:id`  | `{title, description}`      | Update notebook                 |
| DELETE | `/api/notebooks/:id`  | —                           | Delete notebook + all contents  |

---

### Sources `/api/sources`
| Method | Endpoint                          | Body / Form              | Description                        |
|--------|-----------------------------------|--------------------------|------------------------------------|
| POST   | `/api/sources/upload`             | `file` (multipart), `notebookId` | Upload PDF/MP3/MP4 — async processing |
| GET    | `/api/sources/:notebookId`        | —                        | List sources (auto-polls if processing) |
| GET    | `/api/sources/status/:sourceId`   | —                        | Poll processing status             |
| GET    | `/api/sources/:notebookId/:sourceId` | —                     | Get source with metadata + chunk count |
| DELETE | `/api/sources/:sourceId`          | —                        | Delete source + chunks + storage file |

**Source status flow:** `pending` → `processing` → `ready` (or `error`)

---

### Chat `/api/chat`
| Method | Endpoint                          | Body                          | Description                  |
|--------|-----------------------------------|-------------------------------|------------------------------|
| POST   | `/api/chat`                       | `{notebookId, message, sessionId?}` | Send message, get RAG reply with citations |
| GET    | `/api/chat/sessions/:notebookId`  | —                             | List chat sessions           |
| GET    | `/api/chat/history/:sessionId`    | —                             | Full message history         |
| DELETE | `/api/chat/sessions/:sessionId`   | —                             | Delete session + messages    |

**Chat response shape:**
```json
{
  "sessionId": "uuid",
  "reply": "Based on your sources... [Source 1: \"file.pdf\", Page 3]",
  "citations": [
    { "source_id": "uuid", "title": "file.pdf", "file_type": "pdf", "page_number": 3, "timestamp_start": null },
    { "source_id": "uuid", "title": "lecture.mp4", "file_type": "mp4", "page_number": null, "timestamp_start": 125.4 }
  ],
  "tokensUsed": 842
}
```

---

### Notes `/api/notes`
| Method | Endpoint                    | Body                       | Description      |
|--------|-----------------------------|----------------------------|------------------|
| GET    | `/api/notes/:notebookId`    | —                          | List notes       |
| GET    | `/api/notes/single/:noteId` | —                          | Get single note  |
| POST   | `/api/notes`                | `{notebookId, title, content}` | Create note  |
| PATCH  | `/api/notes/:noteId`        | `{title, content}`         | Update note      |
| DELETE | `/api/notes/:noteId`        | —                          | Delete note      |

---

### Audio `/api/audio`
| Method | Endpoint              | Body                          | Description                     |
|--------|-----------------------|-------------------------------|---------------------------------|
| POST   | `/api/audio/overview` | `{notebookId, sourceIds?[]}`  | Generate 2-person podcast script |

**Audio Overview response shape:**
```json
{
  "script": "ALEX: Welcome...\nSAM: Thanks for having me...",
  "turns": [
    { "speaker": "ALEX", "text": "Welcome to the show..." },
    { "speaker": "SAM",  "text": "Thanks Alex, today we're covering..." }
  ],
  "sourceCount": 3,
  "tokensUsed": 1120
}
```

---

## 🧪 Testing Guide

### Run Tests
```bash
cd backend
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

### What's Tested
| Test File            | Covers                                                           |
|----------------------|------------------------------------------------------------------|
| `notebooks.test.js`  | GET list, GET single, POST create, PATCH update, DELETE          |
| `chat.test.js`       | POST send (RAG flow), GET sessions, GET history                  |
| `services.test.js`   | pdfService.buildChunks, transcriptionService.buildChunks, ragService.buildGroundedPrompt, /health, 404 handler |

### Mocking Strategy
All external dependencies are mocked in `__tests__/setup.js`:
- **Firebase Admin** → `verifyIdToken` returns a hardcoded decoded token
- **PostgreSQL pool** → `jest.fn()` — each test controls what `pool.query` returns via `mockResolvedValueOnce`
- **OpenAI** → embeddings, chat completions, and audio transcriptions all return predictable mock data

### Manual Testing with curl

**1. Get a real Firebase token** (paste into browser console on frontend):
```js
const token = await firebase.auth().currentUser.getIdToken()
console.log(token)
```

**2. Health check**
```bash
curl http://localhost:5000/health
```

**3. Create a notebook**
```bash
curl -X POST http://localhost:5000/api/notebooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Research", "description": "Test notebook"}'
```

**4. Upload a PDF**
```bash
curl -X POST http://localhost:5000/api/sources/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "notebookId=YOUR_NOTEBOOK_UUID"
```

**5. Poll source status**
```bash
curl http://localhost:5000/api/sources/status/SOURCE_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
# Repeat until "status": "ready"
```

**6. Chat with sources**
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notebookId": "NOTEBOOK_UUID", "message": "What are the main topics?"}'
```

**7. Generate Audio Overview**
```bash
curl -X POST http://localhost:5000/api/audio/overview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notebookId": "NOTEBOOK_UUID"}'
```

**8. Create a note**
```bash
curl -X POST http://localhost:5000/api/notes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notebookId": "NOTEBOOK_UUID", "title": "Key Findings", "content": "## Summary\n..."}'
```

### Using Postman / Thunder Client
1. Create an environment variable `TOKEN` = your Firebase ID token
2. Set header `Authorization: Bearer {{TOKEN}}` on all requests
3. Import the endpoint table above as a collection

### Common Errors & Fixes

| Error                                      | Cause                              | Fix                                               |
|--------------------------------------------|------------------------------------|---------------------------------------------------|
| `401 Missing or invalid Authorization`     | No/wrong token                     | Get fresh token from Firebase console             |
| `400 Unsupported file type`                | Wrong MIME type                    | Only PDF, MP3, MP4 accepted                       |
| `source.status = "error"`                  | Processing failed                  | Check `error_message` field; check server logs    |
| `No relevant source content found`         | Source still processing            | Wait for status = "ready" before chatting         |
| `pgvector operator does not exist`         | Extension not installed            | Run `CREATE EXTENSION vector;` in your DB         |
| `FFmpeg not found`                         | FFmpeg not installed                | `brew install ffmpeg` or `apt install ffmpeg`     |

---

## 📦 Install Commands

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### Backend packages
`express cors helmet morgan express-rate-limit express-validator dotenv pg firebase-admin openai pdf-parse fluent-ffmpeg multer uuid`

### Frontend packages
`react react-dom react-router-dom @tanstack/react-query axios firebase react-markdown lucide-react clsx tailwind-merge`

---

## 🛠️ Tech Stack

| Layer          | Technology                            |
|----------------|---------------------------------------|
| Frontend       | React 18 (Vite), shadcn/ui, Tailwind  |
| State / Data   | React Query v5, Axios                 |
| Auth           | Firebase Authentication               |
| File Storage   | Firebase Storage                      |
| Backend        | Node.js, Express.js (ES Modules)      |
| Database       | PostgreSQL 14+ + pgvector             |
| Embeddings     | OpenAI text-embedding-3-small (1536d) |
| LLM            | OpenAI GPT-4o-mini                    |
| Transcription  | OpenAI Whisper API + FFmpeg           |
| PDF Parsing    | pdf-parse                             |
| Testing        | Jest + Supertest                      |

---

*Last updated: Days 1–18 complete — Architecture, Auth, Upload, RAG, Chat, Notes, Audio Overview, Tests*