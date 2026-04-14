import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notebooksApi } from '../api/index.js';

export const useNotebooks = () => {
  return useQuery({
    queryKey: ['notebooks'],
    queryFn:  notebooksApi.getAll,
  });
};

export const useNotebook = (id) => {
  return useQuery({
    queryKey: ['notebooks', id],
    queryFn:  () => notebooksApi.getOne(id),
    enabled:  !!id,
  });
};

export const useCreateNotebook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notebooksApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  });
};

export const useUpdateNotebook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => notebooksApi.update(id, data),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['notebooks'] });
      qc.invalidateQueries({ queryKey: ['notebooks', id] });
    },
  });
};

export const useDeleteNotebook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notebooksApi.remove,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  });
};
