import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chatApi } from '../api/index.js';

export const useChatSessions = (notebookId) => {
  return useQuery({
    queryKey: ['chat-sessions', notebookId],
    queryFn:  () => chatApi.getSessions(notebookId),
    enabled:  !!notebookId,
  });
};

export const useChatHistory = (sessionId) => {
  return useQuery({
    queryKey: ['chat-history', sessionId],
    queryFn:  () => chatApi.getHistory(sessionId),
    enabled:  !!sessionId,
  });
};

export const useChat = (notebookId) => {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages]   = useState([]);

  const sendMutation = useMutation({
    mutationFn: (message) => chatApi.send(notebookId, message, sessionId),
    onMutate: async (message) => {
      // Optimistically add user message
      setMessages(prev => [...prev, {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        citations: [],
        created_at: new Date().toISOString(),
      }]);
    },
    onSuccess: (data) => {
      // Update session ID if new session was created
      if (!sessionId) setSessionId(data.sessionId);

      // Replace temp message + add assistant reply
      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.id.startsWith('temp-'));
        return [
          ...withoutTemp,
          data.message,
        ];
      });

      qc.invalidateQueries({ queryKey: ['chat-sessions', notebookId] });
    },
    onError: () => {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
    },
  });

  const loadSession = async (sid) => {
    setSessionId(sid);
    const history = await chatApi.getHistory(sid);
    setMessages(history);
  };

  const clearSession = () => {
    setSessionId(null);
    setMessages([]);
  };

  return {
    messages,
    sessionId,
    isSending: sendMutation.isPending,
    sendMessage: sendMutation.mutate,
    loadSession,
    clearSession,
  };
};

export const useDeleteSession = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['chat-sessions', notebookId] }),
  });
};
