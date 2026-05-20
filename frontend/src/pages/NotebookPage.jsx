import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotebook } from '../hooks/useNotebooks.js';
import { useSources, useUploadSource, useDeleteSource } from '../hooks/useSources.js';
import { useChat, useChatSessions, useDeleteSession, useDeleteMessage } from '../hooks/useChat.js';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../hooks/useNotes.js';
import { audioApi } from '../api/index.js';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Music, Video, Trash2,
  Upload, Send, Plus, ChevronLeft,
  Loader2, Radio, MessageSquare,
  Maximize2, Minimize2, X, BookOpen, Eye, Sparkles,
  Play, Square, Pause,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ThemeToggle from '../components/ThemeToggle.jsx';

const FILE_ICONS = { pdf: FileText, mp3: Music, mp4: Video };
const STATUS_COLORS = {
  pending: 'secondary',
  processing: 'outline',
  ready: 'default',
  error: 'destructive',
};

export default function NotebookPage() {
  const { id: notebookId } = useParams();
  const { data: notebook } = useNotebook(notebookId);
  const { data: sources = [], isLoading: sourcesLoading } = useSources(notebookId);
  const { data: notes = [] } = useNotes(notebookId);

  const uploadMutation = useUploadSource(notebookId);
  const deleteSrc = useDeleteSource(notebookId);
  const createNote = useCreateNote(notebookId);
  const updateNote = useUpdateNote(notebookId);
  const deleteNote = useDeleteNote(notebookId);

  const { messages, isSending, sendMessage, sessionId, loadSession, clearSession, setMessages } = useChat(notebookId);
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions(notebookId);
  const deleteSession = useDeleteSession(notebookId);
  const deleteMessageMutation = useDeleteMessage();

  const [chatInput, setChatInput] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [noteMode, setNoteMode] = useState('edit');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [podcastPlaybackState, setPodcastPlaybackState] = useState('idle'); // 'idle' | 'playing' | 'paused'
  const [isDragging, setIsDragging] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Document overview modal: { source, summaryNote }
  const [docOverviewModal, setDocOverviewModal] = useState(null);
  const prevSourcesRef = useRef([]);

  const chatBottomRef = useRef(null);

  // ── Auto scroll ───────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ── Detect newly-ready sources → show doc overview modal ──────────
  useEffect(() => {
    const prev = prevSourcesRef.current;
    if (prev.length > 0 && sources.length > 0) {
      sources.forEach((src) => {
        const wasProcessing = prev.find(
          p => p.id === src.id && (p.status === 'pending' || p.status === 'processing')
        );
        if (wasProcessing && src.status === 'ready') {
          // Show modal with source info; metadata may contain auto_summary if backend provided it
          setDocOverviewModal({ source: src, metadata: src.metadata ?? null });
          toast.success(`"${src.title}" is ready!`);
        }
      });
    }
    prevSourcesRef.current = sources;
  }, [sources]);

  // ── Delete individual message ──────────────────────────────────────
  const handleDeleteMessage = useCallback((msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    // Fire-and-forget — if it fails we don't re-add the message (UX preference)
    deleteMessageMutation.mutate(msgId);
  }, [setMessages, deleteMessageMutation]);

  // ── Upload handler ─────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  // ── Chat send ──────────────────────────────────────────────────────
  const handleSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;
    try {
      sendMessage(chatInput.trim());
      setChatInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message. Please check your session.');
    }
  };

  // ── Audio overview ─────────────────────────────────────────────────
  const handleOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await audioApi.generateOverview(notebookId);
      setOverview(data);
      toast.success('Audio overview generated!');
    } catch (err) {
      toast.error('Failed to generate overview: ' + (err.response?.data?.error ?? err.message));
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleTogglePodcast = () => {
    if (!overview || !overview.turns) return;

    if (podcastPlaybackState === 'playing') {
      window.speechSynthesis.pause();
      setPodcastPlaybackState('paused');
      return;
    }

    if (podcastPlaybackState === 'paused') {
      window.speechSynthesis.resume();
      setPodcastPlaybackState('playing');
      return;
    }

    // Start fresh
    window.speechSynthesis.cancel();
    setPodcastPlaybackState('playing');

    const voices = window.speechSynthesis.getVoices();
    // Try to find distinct voices (often browser-dependent)
    const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Google UK English Female')) || voices[0];
    const maleVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('Mark') || v.name.includes('Google UK English Male')) || voices[1] || voices[0];

    overview.turns.forEach((turn, index) => {
      const utterance = new SpeechSynthesisUtterance(turn.text);
      utterance.voice = turn.speaker === 'ALEX' ? maleVoice : femaleVoice;
      utterance.rate = 1.05; 
      
      // Auto-stop when the final utterance completes
      if (index === overview.turns.length - 1) {
        utterance.onend = () => setPodcastPlaybackState('idle');
        utterance.onerror = () => setPodcastPlaybackState('idle');
      }
      
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleStopPodcast = () => {
    window.speechSynthesis.cancel();
    setPodcastPlaybackState('idle');
  };

  useEffect(() => {
    // Cleanup speech synthesis on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Note helpers ───────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!editingNote) return;
    if (editingNote.id === 'new') {
      await createNote.mutateAsync({
        notebookId,
        title: editingNote.title,
        content: editingNote.content,
      });
    } else {
      await updateNote.mutateAsync({
        noteId: editingNote.id,
        data: { title: editingNote.title, content: editingNote.content },
      });
    }
    setEditingNote(null);
  };

  if (!notebook) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── Document Overview Modal ─────────────────────────────── */}
      {docOverviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/20">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">Document Ready</p>
                <p className="text-xs text-muted-foreground truncate">{docOverviewModal.source?.title}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDocOverviewModal(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Auto-generated Overview</p>
              <div className="rounded-lg bg-muted/30 border p-4 text-sm text-foreground/80 leading-relaxed max-h-72 overflow-y-auto">
                {docOverviewModal.metadata?.auto_summary
                  ? <ReactMarkdown>{docOverviewModal.metadata.auto_summary}</ReactMarkdown>
                  : <span className="text-muted-foreground italic">Your document has been processed and embedded. You can now ask questions about it in the chat.</span>
                }
              </div>
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <Button className="flex-1" onClick={() => { setDocOverviewModal(null); sendMessage(`Give me a comprehensive summary of ${docOverviewModal.source?.title}.`); }}>
                <MessageSquare className="h-4 w-4 mr-2" /> Chat About It
              </Button>
              <Button variant="outline" onClick={() => setDocOverviewModal(null)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card/80 backdrop-blur-md text-card-foreground shadow-sm z-10 relative shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base truncate tracking-tight">{notebook.title}</h1>
              {notebook.description && (
                <p className="text-xs text-muted-foreground truncate">{notebook.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={isFullScreen ? 'Exit full screen' : 'Full screen chat'}
            onClick={() => setIsFullScreen(v => !v)}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left panel — Sources (hidden in full screen) */}
        <aside
          className={`border-r bg-muted/10 flex flex-col shrink-0 relative transition-all duration-300 ease-in-out overflow-hidden
            ${isFullScreen ? 'w-0 opacity-0 pointer-events-none' : 'w-64 opacity-100'}
            ${isDragging ? 'bg-primary/5 border-primary/50 border-dashed' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center text-primary gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 animate-bounce" />
                </div>
                <span className="font-medium text-lg">Drop here to upload</span>
              </div>
            </div>
          )}
          <div className="px-4 h-12 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur pb-2 pt-2 border-b">
            <span className="text-sm font-semibold tracking-wide">Knowledge Base</span>
            <label className="cursor-pointer">
              <input
                type="file" accept=".pdf,.mp3,.mp4" className="hidden"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" asChild>
                <span>
                  {uploadMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Plus className="h-4 w-4" />
                  }
                </span>
              </Button>
            </label>
          </div>

          {/* Upload progress bar */}
          {uploadMutation.isPending && uploadMutation.progress > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex justify-between text-xs mb-1.5 font-medium text-muted-foreground">
                <span>Uploading...</span>
                <span>{uploadMutation.progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-primary transition-all duration-300 relative"
                  style={{ width: `${uploadMutation.progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="w-full flex-1 min-h-0">
            <div className="p-3 space-y-1.5 w-full max-w-full min-w-0 flex flex-col">

              {sourcesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : (
                sources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10 px-4 opacity-50">
                    <FileText className="h-10 w-10 mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium">No sources yet</p>
                    <p className="text-xs mt-1">Upload a PDF or Audio file to begin training your AI.</p>
                  </div>
                ) : (
                  sources.map(src => {
                    const Icon = FILE_ICONS[src.file_type] || FileText;

                    return (
                      <div
                        key={src.id}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 bg-card border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group text-sm relative overflow-hidden"
                      >
                        <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                          <Icon className={`h-4 w-4 ${src.file_type === "pdf" ? "text-rose-500" : src.file_type === "mp3" ? "text-blue-500" : "text-emerald-500"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-foreground/90">{src.title}</p>
                          <Badge variant={STATUS_COLORS[src.status]} className="text-[9px] px-1.5 py-0 bg-opacity-10 mt-0.5">
                            {src.status === "processing" ? "Processing..." : src.status}
                          </Badge>

                          {/* Show Summary Link (NEW) */}
                          {src.metadata?.summaries?.length > 0 && (
                            <span
                              className="block text-[9px] font-medium text-blue-600 dark:text-blue-300 mt-1 cursor-pointer hover:underline"
                              onClick={() => {
                                // TODO: Open summary modal later
                                console.log("Summary click", src);
                              }}
                            >
                              📊 View Summary
                            </span>
                          )}

                          {/* Show Timeline Link (NEW) */}
                          {src.metadata?.timeline?.length > 0 && (
                            <span
                              className="block text-[9px] font-medium text-purple-600 dark:text-purple-300 mt-1 cursor-pointer hover:underline"
                              onClick={() => {
                                // TODO: Open timeline modal later
                                console.log("Timeline click", src);
                              }}
                            >
                              ⏱️ View Timeline
                            </span>
                          )}
                        </div>

                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-destructive hover:bg-destructive/10 transition-opacity absolute right-2"
                          onClick={() => deleteSrc.mutate(src.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </ScrollArea>


          {/* Chat Sessions (Bottom half of left sidebar) */}

          <div className="px-4 h-12 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur pb-2 pt-2 border-t border-b scroll-m-2">
            <span className="text-sm font-semibold tracking-wide">Chats</span>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
              onClick={() => { clearSession(); }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="w-full flex-1 min-h-0 border-t-0">
            <div className="p-3 space-y-1.5 w-full max-w-full min-w-0 flex flex-col">
              {sessionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : (
                sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10 px-4 opacity-50">
                    <MessageSquare className="h-10 w-10 mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium">No chats yet</p>
                    <p className="text-xs mt-1">Click the + button to start a new chat session.</p>
                  </div>
                ) : (
                  sessions.map(s => (
                    <div
                      key={s.id}
                      className={`w-full max-w-60 flex items-center gap-3 rounded-lg px-1 py-2 bg-card border shadow-sm hover:shadow-md transition-all group text-sm relative overflow-hidden cursor-pointer ${sessionId === s.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:border-primary/30'}`}
                      onClick={() => { loadSession(s.id); }}
                    >
                      <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-foreground/90">{s.first_message || "Untitled Chat"}</p>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-opacity-10 mt-0.5">
                          {new Date(s.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-destructive hover:bg-destructive/10 transition-opacity absolute right-2"
                        onClick={(e) => { e.stopPropagation(); deleteSession.mutate(s.id); if (sessionId === s.id) clearSession(); }}
                        title="Delete chat session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Center Panel — Chat */}
        <main className="flex-1 flex flex-col bg-background relative border-r shadow-sm z-10 min-w-0 min-h-0 overflow-hidden">
          <div className="px-5 h-12 border-b flex items-center justify-between shrink-0 bg-card/80 backdrop-blur-sm z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notebook Chat</span>
              {sessionId && <Badge variant="secondary" className="text-[10px] px-2 py-0">Session active</Badge>}
            </div>
            <div className="flex items-center gap-1.5">
              {sources.filter(s => s.status === 'ready').length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sources.filter(s => s.status === 'ready').length} source{sources.filter(s => s.status === 'ready').length !== 1 ? 's' : ''} ready</span>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-4 md:px-8 pt-4 pb-0 bg-muted/5 relative">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-24 text-center">
                <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Music className="h-8 w-8 opacity-50 absolute" />
                  <FileText className="h-8 w-8 ml-4 mb-4" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Hello! I'm your AI Notebook Assistant.</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
                  I've read all the sources you uploaded. Ask me any question, ask for summaries, or let's brainstorm together.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md w-full text-left">
                  <Button variant="outline" className="justify-start text-xs font-normal h-auto py-2.5" onClick={() => sendMessage("Generate a comprehensive, professionally structured summary of these documents. Please organize the response exactly as follows:\n\n1. **Executive Overview**: A detailed introductory paragraph.\n2. **Core Concepts & Key Topics**: Bold headings dividing different subjects.\n3. **Crucial Bullet Points**: Point-by-point breakdown detailing key facts.\n4. **Main Takeaway**: A distinct blockquote highlight (using `>`).\n5. **Conclusion**: A formal closing summary paragraph.")}>
                    Summary format
                  </Button>
                  <Button variant="outline" className="justify-start text-xs font-normal h-auto py-2.5" onClick={() => sendMessage("Explain the most complex topic in simple terms with examples and analogies.")}>
                    Explain simply
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-12">
                {messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} onDelete={handleDeleteMessage} />
                ))}
                {isSending && (
                  <div className="flex w-full justify-start mb-6">
                    <div className="flex max-w-[75%] gap-4 flex-row">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary border border-primary/20 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                      <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground/80 border shadow-sm animate-pulse flex items-center gap-2">
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} className="h-4" />
              </div>
            )}
          </ScrollArea>
          <div className="p-4 bg-background">
            <form onSubmit={handleSend} className="relative flex items-end gap-2 max-w-3xl mx-auto border rounded-xl bg-card shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
              <Textarea
                placeholder="Ask anything about your sources..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                disabled={isSending}
                className="flex-1 min-h-[52px] max-h-[200px] border-0 focus-visible:ring-0 resize-none py-3.5 px-4 bg-transparent text-sm leading-relaxed"
                rows={1}
                autoFocus
              />
              <div className="p-2 shrink-0">
                <Button type="submit" size="icon" disabled={isSending || !chatInput.trim()} className="h-9 w-9 rounded-lg">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-muted-foreground opacity-70">AI can make mistakes. Always verify with citations.</span>
            </div>
          </div>
        </main>

        {/* Right Panel — Studio & Notes side bar (hidden in full screen) */}
        <aside
          className={`bg-card flex flex-col shrink-0 relative transition-all duration-300 ease-in-out overflow-hidden border-l
            ${isFullScreen ? 'w-0 opacity-0 pointer-events-none' : 'w-[340px] opacity-100'}
          `}
        >
          <Tabs defaultValue="studio" className="flex flex-col flex-1 h-full">
            <TabsList className="w-full justify-start rounded-none border-b px-4 h-12 bg-transparent shadow-sm shrink-0">
              <TabsTrigger value="studio" className="text-xs tracking-wide">Studio</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs tracking-wide">Notes</TabsTrigger>
            </TabsList>

            {/* ── Studio Tab ── */}
            <TabsContent value="studio" className="flex-1 overflow-y-auto m-0 p-4 space-y-6 custom-scrollbar bg-muted/5">

              {/* Audio Overview Card */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/20">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                    <Radio className="h-4 w-4" /> Audio Overview
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Turn your documents into an engaging 2-person podcast conversation.</p>
                </div>
                <div className="p-4">
                  {overview ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-[10px]">Podcast Ready</Badge>
                        <Button 
                          variant="default"
                          size="sm" 
                          className={`h-6 px-3 ml-auto text-[10px] font-bold tracking-wide shadow-sm transition-all ${podcastPlaybackState === 'playing' ? 'bg-indigo-600 hover:bg-indigo-700 animate-pulse' : ''}`}
                          onClick={handleTogglePodcast}
                        >
                          {podcastPlaybackState === 'playing' ? <Pause className="h-3 w-3 mr-1.5 fill-current" /> : <Play className="h-3 w-3 mr-1.5 fill-current" />}
                          {podcastPlaybackState === 'playing' ? "PAUSE AUDIO" : podcastPlaybackState === 'paused' ? "RESUME AUDIO" : "PLAY AUDIO"}
                        </Button>
                        {podcastPlaybackState !== 'idle' && (
                          <Button variant="destructive" size="sm" className="h-6 px-2" onClick={handleStopPodcast}>
                            <Square className="h-3 w-3 fill-current" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                          window.speechSynthesis.cancel();
                          setPodcastPlaybackState('idle');
                          setOverview(null);
                        }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="max-h-[250px] overflow-y-auto text-[13px] space-y-2 pr-1 custom-scrollbar">
                        {(overview.turns ?? []).map((turn, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            <span className={`font-semibold text-[11px] uppercase tracking-wider ${turn.speaker === 'ALEX' ? 'text-blue-500' : 'text-emerald-500'}`}>
                              {turn.speaker}
                            </span>
                            <span className="text-muted-foreground leading-relaxed">{turn.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 border-0 shadow-md"
                      onClick={handleOverview}
                      disabled={overviewLoading || sources.filter(s => s.status === 'ready').length === 0}
                    >
                      {overviewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Music className="h-4 w-4 mr-2" />}
                      {overviewLoading ? "Generating..." : "Generate Podcast"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/20">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-orange-500" /> Study Guides
                  </h3>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center border-muted hover:border-primary/30 hover:bg-primary/5" onClick={() => sendMessage("Generate a comprehensive, professionally structured study guide summary. Please organize it strictly with:\n\n- **Executive Overview**: A detailed introductory paragraph.\n- **Core Concepts & Key Topics**: Bold headings dividing different subjects.\n- **Crucial Bullet Points**: Point-by-point breakdown detailing key facts.\n- **Main Takeaway**: A distinct blockquote highlight (using `>`).\n- **Conclusion**: A formal closing summary paragraph.")}>
                    <span className="font-medium text-[11px]">Summary</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center border-muted hover:border-primary/30 hover:bg-primary/5" onClick={() => sendMessage("Generate a 5-question multiple choice quiz to test my knowledge on these materials.")}>
                    <span className="font-medium text-[11px]">Quiz Me</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center border-muted hover:border-primary/30 hover:bg-primary/5" onClick={() => sendMessage("What are the most frequently asked questions about these topics? Provide the questions and answers.")}>
                    <span className="font-medium text-[11px]">FAQ / Q&A</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center border-muted hover:border-primary/30 hover:bg-primary/5" onClick={() => sendMessage("Generate a timeline or step-by-step breakdown of the processes mentioned in the sources.")}>
                    <span className="font-medium text-[11px]">Timeline</span>
                  </Button>
                </div>
              </div>

            </TabsContent>

            {/* ── Notes Tab ── */}
            <TabsContent value="notes" className="flex-1 flex flex-col m-0 bg-background h-full">
              {/* Note Selection / Top Bar */}
              <div className="p-3 border-b flex items-center justify-between shrink-0 bg-muted/10">
                {!editingNote ? (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Select a note to edit</span>
                    <Button size="sm" onClick={() => setEditingNote({ id: 'new', title: '', content: '' })} className="h-7 px-3 text-xs rounded-full">
                      <Plus className="h-3 w-3 mr-1" /> New
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditingNote(null)}>
                      <ChevronLeft className="h-3 w-3 mr-1" /> Back
                    </Button>
                    <Tabs value={noteMode} onValueChange={setNoteMode} className="h-7">
                      <TabsList className="h-7 bg-muted/50 p-0.5">
                        <TabsTrigger value="edit" className="text-[10px] px-2.5 h-6">Edit</TabsTrigger>
                        <TabsTrigger value="preview" className="text-[10px] px-2.5 h-6">Preview</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}
              </div>

              {/* Note Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col relative custom-scrollbar">
                {!editingNote ? (
                  <div className="p-2 space-y-1 overflow-y-auto">
                    {notes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                        <FileText className="h-8 w-8 mb-2" />
                        <span className="text-xs">No saved notes</span>
                      </div>
                    ) : notes.map(note => (
                      <div key={note.id} className="group flex items-center bg-card border rounded-lg p-1 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" onClick={() => setEditingNote({ id: note.id, title: note.title, content: note.content })}>
                        <div className="flex-1 px-3 py-2 min-w-0">
                          <p className="text-[13px] font-medium truncate mb-0.5">{note.title || 'Untitled Note'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{note.content ? note.content.slice(0, 40) + '...' : 'Empty content'}</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity mr-1 shrink-0 bg-destructive/10 hover:bg-destructive hover:text-white"
                          onClick={(e) => { e.stopPropagation(); deleteNote.mutate(note.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col p-3">
                    <Input
                      className="text-base font-semibold border-b border-transparent focus-visible:border-primary rounded-none focus-visible:ring-0 px-1 py-4 mb-2 shadow-none bg-transparent"
                      placeholder="Note Title"
                      value={editingNote.title}
                      onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))}
                    />
                    {noteMode === 'edit' ? (
                      <Textarea
                        className="flex-1 resize-none font-mono text-[13px] leading-relaxed p-2 bg-transparent border-0 focus-visible:ring-0 w-full rounded-none tracking-tight custom-scrollbar"
                        placeholder="Start writing in Markdown (or tell AI to 'save this to my note')..."
                        value={editingNote.content}
                        autoFocus
                        onChange={e => setEditingNote(n => ({ ...n, content: e.target.value }))}
                      />
                    ) : (
                      <ScrollArea className="flex-1 p-2 bg-muted/5 rounded-md custom-scrollbar">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-normal">
                          <ReactMarkdown>{editingNote.content || '*Empty note*'}</ReactMarkdown>
                        </div>
                      </ScrollArea>
                    )}
                    <div className="pt-3 mt-auto flex gap-2">
                      <Button size="sm" className="flex-1" onClick={handleSaveNote}>Save</Button>
                      {editingNote.id !== 'new' && (
                        <Button size="sm" variant="destructive" className="shrink-0" onClick={async () => { await deleteNote.mutateAsync(editingNote.id); setEditingNote(null); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

// ── Chat Message component ─────────────────────────────────────────────
function ChatMessage({ message, onDelete }) {
  const isUser = message.role === 'user';
  const [hasError, setHasError] = useState(false);

  // Clean user message to hide prompt-engineering instructions
  let displayContent = message.content;
  if (isUser && displayContent) {
    displayContent = displayContent.split("\n\nFormat your summary response")[0];
    displayContent = displayContent.split("Please organize")[0].trim();
    if (displayContent.endsWith("with:") || displayContent.endsWith("as follows:")) {
      displayContent = displayContent.replace(/(with:|as follows:)$/, "").trim();
    }
  }

  return (
    <div className={`group flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
        {/* AI Avatar */}
        {!isUser && (
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 select-none mt-0.5 shadow-sm ${hasError
            ? 'bg-destructive/20 text-destructive border border-destructive/30'
            : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white'
            }`}>
            {hasError ? '⚠' : <Sparkles className="h-4 w-4" />}
          </div>
        )}

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1.5 min-w-0 flex-1`}>
          {isUser ? (
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-md max-w-max">
              {displayContent}
            </div>
          ) : (
            <div className="bg-card/75 border border-border/50 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm w-full text-foreground max-w-none break-words">
              <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-[21px] font-bold mt-7 mb-4 text-foreground/90 leading-tight border-b border-border/60 pb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[18.5px] font-bold mt-6 mb-3 text-foreground/90 leading-tight">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[16px] font-semibold mt-5 mb-2.5 text-foreground/90 leading-tight">{children}</h3>,
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed text-[14.5px] text-foreground/80">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4.5 space-y-2 text-[14.5px] text-foreground/80">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4.5 space-y-2 text-[14.5px] text-foreground/80">{children}</ol>,
                    li: ({ children }) => <li className="pl-1 marker:text-primary/70 leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary/50 pl-4 py-2 my-3.5 bg-primary/5 rounded-r-lg italic text-[14.5px] text-foreground/95">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium transition-colors">
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4.5 rounded-xl border border-border/80 shadow-sm">
                        <table className="w-full text-left border-collapse text-[13.5px]">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-muted/80 border-b font-semibold text-muted-foreground">{children}</thead>,
                    tbody: ({ children }) => <tbody className="divide-y divide-border/40">{children}</tbody>,
                    tr: ({ children }) => <tr className="hover:bg-muted/10 transition-colors odd:bg-muted/5">{children}</tr>,
                    th: ({ children }) => <th className="px-4 py-2.5 font-medium">{children}</th>,
                    td: ({ children }) => <td className="px-4 py-2 text-foreground/80">{children}</td>,
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeContent = String(children).replace(/\n$/, '')
                      return !inline ? (
                        <div className="mt-3 mb-4 rounded-xl overflow-hidden bg-muted/30 border border-border/80 shadow-sm">
                          <div className="px-4 py-2 bg-muted/60 text-xs text-muted-foreground font-mono flex items-center justify-between border-b">
                            <span>{match?.[1] || 'code'}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(codeContent);
                                toast.success("Copied to clipboard!");
                              }}
                              className="px-2.5 py-1 rounded bg-background border hover:bg-muted text-[10px] font-medium transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <div className="p-4 overflow-x-auto text-[13.5px]">
                            <code className="font-mono text-foreground" {...props}>{children}</code>
                          </div>
                        </div>
                      ) : (
                        <code className="bg-muted/80 text-foreground font-mono rounded px-1.5 py-0.5 text-[0.88em] border border-border/40 font-semibold" {...props}>{children}</code>
                      )
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Citations */}
          {!isUser && message.citations?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {message.citations.map((c, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[10px] font-medium bg-muted border border-border/60 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors rounded-full px-2.5 py-1 cursor-default"
                  title={c.title}
                >
                  <span className="opacity-60">{i + 1}.</span>
                  {c.file_type === 'pdf'
                    ? `${c.title} (pg ${c.page_number})`
                    : `${c.title} (${fmtTime(c.timestamp_start)})`
                  }
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Delete button — appears on hover */}
        {onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 mt-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ${isUser ? 'order-first' : ''}`}
            title="Delete message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const fmtTime = (s) => {
  if (s == null) return '??:??';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

