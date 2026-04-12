import api from '../api/axiosInstance';

// ─── Notebooks ───────────────────────────────────────────────────────
export const notebooksApi = {
  getAll: () => api.get('/notebooks').then(r => r.data),
  getOne: (id) => api.get(`/notebooks/${id}`).then(r => r.data),
  create: (data) => api.post('/notebooks', data).then(r => r.data),
  update: (id, data) => api.patch(`/notebooks/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/notebooks/${id}`).then(r => r.data),
};

// ─── Sources ─────────────────────────────────────────────────────────
export const sourcesApi = {
  getAll: (notebookId) =>
    api.get(`/sources/${notebookId}`).then(r => r.data),

  getOne: (notebookId, sourceId) =>
    api.get(`/sources/${notebookId}/${sourceId}`).then(r => r.data),

  pollStatus: (sourceId) =>
    api.get(`/sources/status/${sourceId}`).then(r => r.data),

  upload: (notebookId, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('notebookId', notebookId);
    return api.post('/sources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }).then(r => r.data);
  },

  remove: (sourceId) =>
    api.delete(`/sources/${sourceId}`).then(r => r.data),
};

// ─── Chat ─────────────────────────────────────────────────────────────
export const chatApi = {
  send: (notebookId, message, sessionId = null) =>
    api.post('/chat', { notebookId, message, sessionId }).then(r => r.data),

  getSessions: (notebookId) =>
    api.get(`/chat/sessions/${notebookId}`).then(r => r.data),

  getHistory: (sessionId) =>
    api.get(`/chat/history/${sessionId}`).then(r => r.data),

  deleteSession: (sessionId) =>
    api.delete(`/chat/sessions/${sessionId}`).then(r => r.data),
};

// ─── Notes ───────────────────────────────────────────────────────────
export const notesApi = {
  getAll: (notebookId) => api.get(`/notes/${notebookId}`).then(r => r.data),
  getOne: (noteId) => api.get(`/notes/single/${noteId}`).then(r => r.data),
  create: (data) => api.post('/notes', data).then(r => r.data),
  update: (noteId, data) => api.patch(`/notes/${noteId}`, data).then(r => r.data),
  remove: (noteId) => api.delete(`/notes/${noteId}`).then(r => r.data),
};

// ─── Audio Overview ───────────────────────────────────────────────────
export const audioApi = {
  generateOverview: (notebookId, sourceIds = []) =>
    api.post('/audio/overview', { notebookId, sourceIds }).then(r => r.data),
};
