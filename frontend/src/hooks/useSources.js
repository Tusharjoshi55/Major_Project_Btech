import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { sourcesApi } from '../api/index.js';

export const useSources = (notebookId) => {
  return useQuery({
    queryKey: ['sources', notebookId],
    queryFn:  () => sourcesApi.getAll(notebookId),
    enabled:  !!notebookId,
    // Refresh every 5s if any source is still processing
    refetchInterval: (data) => {
      const processing = data?.some(s =>
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
    onSuccess: () => {
      setProgress(0);
      qc.invalidateQueries({ queryKey: ['sources', notebookId] });
    },
    onError: () => setProgress(0),
  });

  return { ...mutation, progress };
};

export const useDeleteSource = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sourcesApi.remove,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sources', notebookId] }),
  });
};
