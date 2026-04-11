import { useState }          from 'react';
import { useParams, Link }   from 'react-router-dom';
import { useNotebook }       from '../hooks/useNotebooks.js';
import { useSources, useUploadSource, useDeleteSource } from '../hooks/useSources.js';
import { useChat }           from '../hooks/useChat.js';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../hooks/useNotes.js';
import { audioApi }          from '../api/index.js';

import { Button }            from '@/components/ui/button';
import { Input }             from '@/components/ui/input';
import { Textarea }          from '@/components/ui/textarea';
import { Badge }             from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea }        from '@/components/ui/scroll-area';
import {
  FileText, Music, Video, Trash2,
  Upload, Send, Plus, ChevronLeft,
  Loader2, Radio,
} from 'lucide-react';
import ReactMarkdown         from 'react-markdown';

const FILE_ICONS = { pdf: FileText, mp3: Music, mp4: Video };
const STATUS_COLORS = {
  pending:    'secondary',
  processing: 'outline',
  ready:      'default',
  error:      'destructive',
};

export default function NotebookPage() {
  const { id: notebookId }  = useParams();
  const { data: notebook }  = useNotebook(notebookId);
  const { data: sources = [], isLoading: sourcesLoading } = useSources(notebookId);
  const { data: notes   = [] } = useNotes(notebookId);

  const uploadMutation = useUploadSource(notebookId);
  const deleteSrc      = useDeleteSource(notebookId);
  const createNote     = useCreateNote(notebookId);
  const updateNote     = useUpdateNote(notebookId);
  const deleteNote     = useDeleteNote(notebookId);

  const { messages, isSending, sendMessage, sessionId } = useChat(notebookId);

  const [chatInput, setChatInput]     = useState('');
  const [editingNote, setEditingNote] = useState(null); // { id, title, content }
  const [overview, setOverview]       = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // ── Upload handler ─────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  // ── Chat send ──────────────────────────────────────────────────────
  const handleSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  // ── Audio overview ─────────────────────────────────────────────────
  const handleOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await audioApi.generateOverview(notebookId);
      setOverview(data);
    } catch (err) {
      alert('Failed to generate overview: ' + err.message);
    } finally {
      setOverviewLoading(false);
    }
  };

  // ── Note helpers ───────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!editingNote) return;
    if (editingNote.id === 'new') {
      await createNote.mutateAsync({
        notebookId,
        title:   editingNote.title,
        content: editingNote.content,
      });
    } else {
      await updateNote.mutateAsync({
        noteId: editingNote.id,
        data:   { title: editingNote.title, content: editingNote.content },
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
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{notebook.title}</h1>
          {notebook.description && (
            <p className="text-xs text-muted-foreground truncate">{notebook.description}</p>
          )}
        </div>
        <Button
          variant="outline" size="sm"
          onClick={handleOverview}
          disabled={overviewLoading || sources.filter(s => s.status === 'ready').length === 0}
        >
          {overviewLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            : <Radio className="h-3.5 w-3.5 mr-1.5" />
          }
          Audio Overview
        </Button>
      </header>

      {/* Audio overview banner */}
      {overview && (
        <div className="border-b bg-muted/50 px-6 py-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Radio className="h-4 w-4" /> Podcast Script
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOverview(null)}>✕</Button>
          </div>
          <div className="space-y-1.5">
            {overview.turns.map((turn, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className={`font-semibold shrink-0 ${turn.speaker === 'ALEX' ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {turn.speaker}:
                </span>
                <span className="text-muted-foreground">{turn.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Sources */}
        <aside className="w-64 border-r flex flex-col shrink-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Sources</span>
            <label className="cursor-pointer">
              <input
                type="file" accept=".pdf,.mp3,.mp4" className="hidden"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <span>
                  {uploadMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />
                  }
                </span>
              </Button>
            </label>
          </div>

          {/* Upload progress bar */}
          {uploadMutation.isPending && uploadMutation.progress > 0 && (
            <div className="px-4 pt-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadMutation.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{uploadMutation.progress}% uploaded</p>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sourcesLoading ? (
                <div className="space-y-2 p-2">
                  {[1,2,3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
                </div>
              ) : sources.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">
                  Upload a PDF, MP3, or MP4 to get started.
                </p>
              ) : (
                sources.map(src => {
                  const Icon = FILE_ICONS[src.file_type] || FileText;
                  return (
                    <div
                      key={src.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted group text-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-xs">{src.title}</span>
                      <Badge variant={STATUS_COLORS[src.status]} className="text-[10px] px-1 py-0 h-4 shrink-0">
                        {src.status === 'processing' ? '…' : src.status}
                      </Badge>
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => deleteSrc.mutate(src.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Right panel — Chat / Notes */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="chat" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3 w-fit">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* ── Chat tab ── */}
            <TabsContent value="chat" className="flex flex-col flex-1 overflow-hidden m-0 mt-3">
              <ScrollArea className="flex-1 px-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Ask a question about your uploaded sources. Answers will include citations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map(msg => (
                      <ChatMessage key={msg.id} message={msg} />
                    ))}
                    {isSending && (
                      <div className="flex gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                          Searching sources…
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
                <Input
                  placeholder="Ask about your sources…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isSending || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            {/* ── Notes tab ── */}
            <TabsContent value="notes" className="flex flex-1 overflow-hidden m-0 mt-3">
              {/* Note list */}
              <div className="w-48 border-r flex flex-col shrink-0">
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className="text-xs font-semibold">Notes</span>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => setEditingNote({ id: 'new', title: '', content: '' })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {notes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No notes yet</p>
                    ) : notes.map(note => (
                      <button
                        key={note.id}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-muted truncate ${editingNote?.id === note.id ? 'bg-muted' : ''}`}
                        onClick={() => setEditingNote({ id: note.id, title: note.title, content: note.content })}
                      >
                        {note.title || 'Untitled Note'}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Note editor */}
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {editingNote ? (
                  <>
                    <Input
                      className="mb-2 font-semibold"
                      placeholder="Note title"
                      value={editingNote.title}
                      onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))}
                    />
                    <Textarea
                      className="flex-1 resize-none font-mono text-sm"
                      placeholder="Write in Markdown…"
                      value={editingNote.content}
                      onChange={e => setEditingNote(n => ({ ...n, content: e.target.value }))}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleSaveNote}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNote(null)}>Cancel</Button>
                      {editingNote.id !== 'new' && (
                        <Button
                          size="sm" variant="ghost"
                          className="ml-auto text-destructive"
                          onClick={async () => {
                            await deleteNote.mutateAsync(editingNote.id);
                            setEditingNote(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Select a note or create a new one.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Chat Message component ─────────────────────────────────────────────
function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-lg px-3 py-2 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              className="prose prose-sm dark:prose-invert max-w-none"
              components={{ p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p> }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {/* Citations */}
        {!isUser && message.citations?.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 cursor-default"
                title={c.title}
              >
                {c.file_type === 'pdf'
                  ? `${c.title} p.${c.page_number}`
                  : `${c.title} @ ${fmtTime(c.timestamp_start)}`
                }
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const fmtTime = (s) => {
  if (s == null) return '??:??';
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(Math.floor(s % 60)).padStart(2,'0')}`;
};
