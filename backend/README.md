# ⚙️ Backend – AI Knowledge Workspace

> Node.js + Express backend for AI-powered student knowledge platform (College Major Project)

---

## 📌 Overview

This backend powers the **AI Knowledge Workspace for Students**, a full-stack system that helps students manage and understand study materials using AI.

It provides:
- Authentication using Firebase
- File upload & processing (PDF, Audio, Video)
- AI-powered chat (RAG)
- Notes & notebook management
- Audio transcription and podcast generation

---

## 🚀 Features

- 🔐 Firebase JWT Authentication
- 📁 Upload PDF, MP3, MP4 files
- 🧠 RAG-based Chat System (pgvector + OpenAI)
- 📄 PDF Parsing & Smart Chunking
- 🎙️ Audio/Video Transcription (Whisper + FFmpeg)
- 🧩 Embedding Generation (OpenAI)
- 🗂️ Notes & Notebook CRUD APIs
- 🎧 Audio Overview Generator (Podcast style)
- ⚡ Rate Limiting & Validation
- 🧪 Testing with Jest & Supertest

---

## 🏗️ Architecture

Client (React)
      ↓
Express Backend (Node.js)
      ↓
PostgreSQL + pgvector
      ↓
OpenAI APIs (Chat, Embeddings, Whisper)
      ↓
Firebase (Auth + Storage)

---

## 📁 Folder Structure

backend/
├── server.js
├── schema.sql
└── src/
    ├── app.js
    ├── config/
    │   ├── db.js
    │   ├── firebase.js
    │   └── openai.js
    ├── middleware/
    │   ├── authMiddleware.js
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
    ├── services/
    └── __tests__/

---

## 🗄️ Database

Uses **PostgreSQL + pgvector** for vector similarity search.

### Tables
- users  
- notebooks  
- sources  
- chunks (vector embeddings)  
- notes  
- chat_sessions  
- chat_messages  

### Setup

```bash
createdb notebooklm_db
psql notebooklm_db -f schema.sql