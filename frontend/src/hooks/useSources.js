import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { sourcesApi } from '../api/index.js';

export const useSources = (notebookId) => {
  return useQuery({
    queryKey: ['sources', notebookId],
    queryFn:  () => sourcesApi.getAll(notebookId),
    enabled:  !!notebookId,
    // In React Query v5, refetchInterval callback receives the full query object
    refetchInterval: (query) => {
      const sources = query.state.data;
      const processing = Array.isArray(sources) && sources.some(s =>
        s.status === 'pending' || s.status === 'processing'
      );
      return processing ? 5000 : false;
    },
  });
};

export const useUploadSource = (notebookId) => {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: (file) =>
      sourcesApi.upload(notebookId, file, setProgress),
    onSuccess: (data) => {
      setProgress(0);
      qc.invalidateQueries({ queryKey: ['sources', notebookId] });
      toast.success(`"${data.source?.title ?? 'File'}" uploaded — processing started.`);
    },
    onError: (err) => {
      setProgress(0);
      toast.error('Upload failed: ' + (err.response?.data?.error ?? err.message));
    },
  });

  return { ...mutation, progress };
};

export const useDeleteSource = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sourcesApi.remove,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sources', notebookId] }),
    onError:    (err) => toast.error('Delete failed: ' + (err.response?.data?.error ?? err.message)),
  });
};
