import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotebook } from '../hooks/useNotebooks.js';
import { useSources, useUploadSource, useDeleteSource } from '../hooks/useSources.js';
import { useChat } from '../hooks/useChat.js';
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
  Loader2, Radio,
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

  const { messages, isSending, sendMessage, sessionId } = useChat(notebookId);

  const [chatInput, setChatInput] = useState('');
  const [editingNote, setEditingNote] = useState(null); // { id, title, content }
  const [noteMode, setNoteMode] = useState('edit'); // 'edit' or 'preview'
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card text-card-foreground shadow-sm z-10 relative">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg truncate tracking-tight">{notebook.title}</h1>
            {notebook.description && (
              <p className="text-xs text-muted-foreground truncate">{notebook.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left panel — Sources */}
        <aside
          className={`w-64 border-r bg-muted/10 flex flex-col shrink-0 relative transition-colors duration-200 ${isDragging ? 'bg-primary/5 border-primary/50 border-dashed' : ''}`}
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
          <div className="px-4 h-12 border-b flex items-center justify-between shrink-0 bg-background/50 backdrop-blur">
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

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1.5">
              {sourcesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : sources.length === 0 ? (
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-card border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group text-sm relative overflow-hidden"
                    >
                      <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                         <Icon className={`h-4 w-4 ${src.file_type==='pdf'?'text-rose-500':src.file_type==='mp3'?'text-blue-500':'text-emerald-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="truncate text-xs font-medium text-foreground/90">{src.title}</p>
                         <Badge variant={STATUS_COLORS[src.status]} className="text-[9px] px-1.5 py-0 bg-opacity-10 mt-0.5">
                           {src.status === 'processing' ? 'Processing...' : src.status}
                         </Badge>
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
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Center Panel — Chat */}
        <main className="flex-1 flex flex-col bg-background relative border-r shadow-sm z-10">
            <div className="px-6 h-12 border-b flex items-center shrink-0 bg-card z-10 shadow-sm">
                <span className="font-semibold text-sm">Notebook Chat</span>
            </div>
            <ScrollArea className="flex-1 px-4 md:px-8 pt-4 pb-0 bg-muted/5">
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
                       <Button variant="outline" className="justify-start text-xs font-normal h-auto py-2.5" onClick={() => sendMessage("Give me a comprehensive summary of these documents.")}>
                           Summary format
                       </Button>
                       <Button variant="outline" className="justify-start text-xs font-normal h-auto py-2.5" onClick={() => sendMessage("Explain the most complex topic in simple terms.")}>
                           Explain simply
                       </Button>
                   </div>
                </div>
            ) : (
                <div className="space-y-6 pb-6">
                {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                {isSending && (
                    <div className="flex w-full justify-start mb-6">
                    <div className="flex max-w-[75%] gap-4 flex-row">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary border border-primary/20">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                        <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground/70 animate-pulse border">
                            Reading sources and thinking...
                        </div>
                    </div>
                    </div>
                )}
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

        {/* Right Panel — Studio & Notes side bar */}
        <aside className="w-[340px] bg-card flex flex-col shrink-0 relative transition-all duration-300">
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
                             <div className="flex gap-2 mb-2">
                                 <Badge variant="secondary" className="text-[10px]">Podcast Ready</Badge>
                                 <Button variant="ghost" size="sm" className="h-5 px-2 ml-auto text-xs" onClick={() => setOverview(null)}>Clear</Button>
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
                        <Button variant="outline" size="sm" className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center border-muted hover:border-primary/30 hover:bg-primary/5" onClick={() => sendMessage("Create a detailed study guide summarizing all key topics from the sources.")}>
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
                                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-normal">{editingNote.content || '*Empty note*'}</ReactMarkdown>
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
function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold select-none ${hasError ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-primary/10 text-primary border border-primary/20'}`}>
            {hasError ? '⚠' : 'AI'}
          </div>
        )}

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2 min-w-0`}>
          {isUser ? (
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm">
              {message.content}
            </div>
          ) : (
            <div className="text-[15px] leading-relaxed text-foreground mt-1 w-full">
              <ReactMarkdown
                className="prose prose-sm dark:prose-invert max-w-none break-words"
                components={{
                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
                  code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline ? (
                      <div className="mt-2 mb-4 rounded-md overflow-hidden bg-muted/50 border">
                        <div className="px-3 py-1.5 bg-muted text-xs text-muted-foreground font-mono flex items-center">{match?.[1] || 'code'}</div>
                        <div className="p-3 overflow-x-auto">
                          <code className="text-sm font-mono" {...props}>
                            {children}
                          </code>
                        </div>
                      </div>
                    ) : (
                      <code className="bg-muted/50 text-foreground rounded px-1.5 py-0.5 text-[0.9em] font-mono border" {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Citations */}
          {!isUser && message.citations?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {message.citations.map((c, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors rounded-full px-2.5 py-1 cursor-default border border-border/50"
                  title={c.title}
                >
                  <span className="opacity-70">{i + 1}.</span>
                  {c.file_type === 'pdf'
                    ? `${c.title} (pg ${c.page_number})`
                    : `${c.title} (${fmtTime(c.timestamp_start)})`
                  }
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const fmtTime = (s) => {
  if (s == null) return '??:??';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
