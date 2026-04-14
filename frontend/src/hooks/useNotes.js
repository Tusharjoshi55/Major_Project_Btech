import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '../api/index.js';

export const useNotes = (notebookId) => {
  return useQuery({
    queryKey: ['notes', notebookId],
    queryFn:  () => notesApi.getAll(notebookId),
    enabled:  !!notebookId,
  });
};

export const useCreateNote = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notesApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notes', notebookId] }),
  });
};

export const useUpdateNote = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }) => notesApi.update(noteId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notes', notebookId] }),
  });
};

export const useDeleteNote = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notesApi.remove,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notes', notebookId] }),
  });
};
