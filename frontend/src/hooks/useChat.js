import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { chatApi } from '../api/index.js';
import { toast } from 'sonner';

export const useChatSessions = (notebookId) => {
  return useQuery({
    queryKey: ['chat-sessions', notebookId],
    queryFn: () => chatApi.getSessions(notebookId),
    enabled: !!notebookId,
  });
};

export const useChatHistory = (sessionId) => {
  return useQuery({
    queryKey: ['chat-history', sessionId],
    queryFn: () => chatApi.getHistory(sessionId),
    enabled: !!sessionId,
  });
};

export const useChat = (notebookId) => {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  // Ref keeps the pending user message text available in onSuccess
  const pendingMessageRef = useRef(null);

  const sendMutation = useMutation({
    mutationFn: (message) => {
      let finalMessage = message;
      const lower = message.toLowerCase();
      // If user asks for summary, prepend a clear instruction to the final message
      if (lower.includes('summarize') || lower.includes('summary') || lower.includes('overview') || lower.includes('synopsis')) {
        finalMessage = "REQUEST: Generate a comprehensive, professionally structured summary of the documents. Please organize the response strictly as follows:\n\n1. **Executive Overview**: A detailed introductory paragraph.\n2. **Core Concepts & Key Topics**: Bold headings dividing different subjects.\n3. **Crucial Bullet Points**: Point-by-point breakdown detailing key facts.\n4. **Main Takeaway**: A distinct blockquote highlight (using `>`).\n5. **Conclusion**: A formal closing summary paragraph.\n\n" + finalMessage;
      }
      return chatApi.send(notebookId, finalMessage, sessionId);
    },
    onMutate: async (message) => {
      pendingMessageRef.current = message;
      // Optimistically add user message with a temp ID
      setMessages(prev => [...prev, {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        citations: [],
        created_at: new Date().toISOString(),
      }]);
    },
    onSuccess: (data) => {
      if (!sessionId) setSessionId(data.sessionId);

      // Build a stable user message (replacing the temp one)
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: pendingMessageRef.current ?? '',
        citations: [],
        created_at: new Date().toISOString(),
      };

      // The backend returns { sessionId, reply, citations, tokensUsed, message }
      // data.message is the saved assistant DB row
      const assistantMessage = data.message ?? {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        citations: data.citations ?? [],
        created_at: new Date().toISOString(),
      };

      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.id?.startsWith('temp-'));
        return [...withoutTemp, userMessage, assistantMessage];
      });

      pendingMessageRef.current = null;
      qc.invalidateQueries({ queryKey: ['chat-sessions', notebookId] });
    },
    onError: () => {
      setMessages(prev => prev.filter(m => !m.id?.startsWith('temp-')));
      pendingMessageRef.current = null;
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
    setMessages,
  };
};

export const useDeleteSession = (notebookId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-sessions', notebookId] }),
  });
};

export const useDeleteMessage = () => {
  return useMutation({
    mutationFn: chatApi.deleteMessage,
    onError: () => toast.error('Failed to delete message.'),
  });
};
