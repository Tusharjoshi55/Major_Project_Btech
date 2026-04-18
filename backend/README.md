# Full-Stack Application Map

This README explains the overall architecture, data flow, and file mapping of the AI Notebook platform.

## 🏗 Stack Architecture

* **Database & Authentication:** Supabase (PostgreSQL + pgvector). 
   - `users` (Supabase Auth reference)
   - `notebooks` (Collections of files)
   - `sources` (Uploaded files: PDFs, MP3s, MP4s)
   - `chunks` (Segmented text from sources with embeddings)
   - `chat_sessions` & `chat_messages` (Chat logs)
* **File Storage:** Supabase Storage (Replacing Firebase).
* **AI Provider:** [OpenRouter](https://openrouter.ai/) for Chat (e.g. `google/gemini-2.0-flash-lite-preview-02-05:free`) & OpenAI (Embeddings).
* **Backend:** Node.js (Express), `multer` (Uploads), `pdf-parse` / `fluent-ffmpeg` (File processing).
* **Frontend:** React (Next.js/Vite) & Tailwind CSS + Shadcn UI.

---

## 📂 File Map & Connections

### `src/config/`
- **`supabase.js`**: Handles initialization of the Supabase client used for Storage and DB operations.
- **`db.js`**: PostgreSQL connection pool using `pg`. Sets up raw query capabilities for pgvector.
- **`openai.js`**: Sets up the OpenAI client hooked to **OpenRouter's** API for free AI chatting.

### `src/middleware/`
- **`authMiddleware.js`**: Intercepts requests, validates the Supabase session token (`Bearer X`), and registers/updates the user in the PostgreSQL DB (`users` table). Attaches `req.user` to routes.

### `src/routes/` & `src/controllers/`
1. **`auth.js` / `authController.js`**: Handling session verification frontend-to-backend.
2. **`sources.js` / `sourceController.js`**: Handles file uploads to Supabase Storage, creates `sources` rows in DB.
3. **`chat.js` / `chatController.js`**: Manages queries with the AI against the sources in a Notebook. Uses Context from `ragService`.
4. **`audio.js` / `audioController.js`**: Triggers a unique "Podcast" conversion with AI.

### `src/services/`
The core logic for handling RAG (Retrieval-Augmented Generation):
- **`uploadService.js`**: Runs a background pipeline when a file is uploaded $\rightarrow$ Detects File $\rightarrow$ `pdfService/transcriptionService` $\rightarrow$ `embeddingService`. Generates summaries.
- **`ragService.js`**: Performs semantic search across `chunks` using `pgvector` inside PostgreSQL.
- **`embeddingService.js`**: Reaches out to OpenAI/OpenRouter to generate embeddings for extracted text chunks.

---

## 🌊 Data Flow

### 1. Authentication Flow
- **User logs in** on the frontend using Supabase Auth UI / Supabase client.
- The **Frontend** retrieves the JWT.
- For protected backend calls, the JWT is sent in the `Authorization: Bearer <tkn>`.
- **`authMiddleware.js`** extracts the token and uses Supabase admin SDK to verify it. It upserts the user in the local `users` Postgres table.

### 2. Storage & Upload Flow
- User uploads a file (PDF/audio) in a specific Notebook.
- Frontend hits `/api/sources/upload`.
- `sourceController.js`:
  - Uploads the file via `multer` to a temporary dir.
  - Pushes it to **Supabase Storage bucket** (`major_project`).
  - Stores a record in the `sources` table showing `status: pending`.
  - Initiates the **background processing pipeline** via `uploadService.processSource()`.

### 3. File Processing & Embedding Flow (RAG Pipeline)
Inside `uploadService.js`:
- If **PDF**: Reads text via `pdfService`. Breaks pages into overlapping chunks.
- If **Audio/Video**: Transcribes audio using Whisper / assemblyai $\rightarrow$ `transcriptionService`. Breaks transcript into timeline segments.
- **`embeddingService.js`** sends each chunk to the Embedding model, getting a vector back.
- Vectors are stored into the `chunks` DB table with a reference to the `source_id` and `notebook_id`.

### 4. Chat & Generation Flow
- User types: *"What does the document say about climate change?"* into a notebook chat.
- Hits `/api/chat`.
- **`ragService.js`** embeds the user's message using the same Embedding model.
- Postgres (`pgvector`) executes an `ORDER BY embedding <-> user_vector` to fetch the top 5 most relevant `chunks`.
- Appends the chunks text to the **System Prompt**.
- Passes the Prompt to the **OpenRouter (Free AI Model)**.
- Returns the reply to the user along with `citations` that point to original chunks and pages.

---

## 🎨 UI & Frontend
Your planned application UI adds a "Right-Hand Sidebar" to Notebook views, splitting the notebook workspace into modular tools:
1. **Chat Session** (Main view).
2. **Audio/Podcast Summaries** (Sidebar module).
3. **Automated Notes & Quizzes** (Generated dynamically by reading the `sources` metadata).

Enjoy exploring this fully migrated Supabase stack!