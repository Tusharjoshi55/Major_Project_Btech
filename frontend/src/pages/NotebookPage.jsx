import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotebook } from '../hooks/useNotebooks.js';
import { useSources, useUploadSource, useDeleteSource } from '../hooks/useSources.js';
import { useChat, useChatSessions, useDeleteSession } from '../hooks/useChat.js';
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
  PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen,
  Sparkles, Zap, BrainCircuit, Clock, BookOpen
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

  const { messages, isSending, sendMessage, sessionId, loadSession, clearSession } = useChat(notebookId);
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions(notebookId);
  const deleteSession = useDeleteSession(notebookId);

  const [chatInput, setChatInput] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [noteMode, setNoteMode] = useState('edit');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Sidebar states
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

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
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b px-4 py-2.5 flex items-center justify-between bg-card text-card-foreground shadow-sm z-20 relative">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}>
            {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5 text-primary" />}
          </Button>
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0 flex items-center gap-2 border-l pl-3 ml-1">
            <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex flex-col">
               <h1 className="font-semibold text-sm truncate tracking-tight leading-none">{notebook.title}</h1>
               <span className="text-[10px] text-muted-foreground mt-0.5">Workspace</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}>
            {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5 text-primary" />}
          </Button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Panel — Chats & Sources */}
        <aside
          className={`flex flex-col shrink-0 bg-muted/10 border-r transition-all duration-300 ease-in-out relative ${
            isLeftSidebarOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-r-0'
          }`}
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
                <span className="font-medium text-lg">Drop here</span>
              </div>
            </div>
          )}

          <Tabs defaultValue="chats" className="flex flex-col h-full w-full">
             <TabsList className="w-full justify-start rounded-none border-b px-4 h-12 bg-transparent shadow-sm shrink-0">
                <TabsTrigger value="chats" className="text-xs tracking-wide">Sessions</TabsTrigger>
                <TabsTrigger value="sources" className="text-xs tracking-wide">Sources</TabsTrigger>
             </TabsList>
             
             {/* Chats Tab */}
             <TabsContent value="chats" className="flex-1 overflow-hidden m-0 flex flex-col">
                <div className="px-4 py-3 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur border-b">
                   <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat History</span>
                   <Button 
                       variant="default" size="sm" 
                       className="h-7 px-3 rounded-full text-[11px] shadow-sm"
                       onClick={() => clearSession()}
                   >
                       <Plus className="h-3 w-3 mr-1" /> New
                   </Button>
                </div>
                <ScrollArea className="flex-1">
                   <div className="p-3 space-y-1.5">
                      {sessions.length === 0 ? (
                         <div className="flex flex-col items-center justify-center text-center py-10 px-4 opacity-50">
                            <MessageSquare className="h-8 w-8 mb-2 text-muted-foreground" />
                            <p className="text-xs font-medium">No previous chats</p>
                         </div>
                      ) : (
                         sessions.map(s => (
                            <div 
                               key={s.id}
                               className={`group relative flex items-center p-2.5 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${sessionId === s.id ? 'border-primary bg-primary/10 ring-1 ring-primary/50' : 'bg-card hover:border-primary/30'}`}
                               onClick={() => loadSession(s.id)}
                            >
                               <MessageSquare className={`h-4 w-4 mr-3 shrink-0 ${sessionId === s.id ? 'text-primary' : 'text-muted-foreground'}`} />
                               <div className="flex-1 min-w-0 pr-6">
                                  <p className="text-[12px] font-medium truncate text-foreground/90">{s.first_message || "New Conversation"}</p>
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                               </div>
                               <Button 
                                  variant="ghost" size="icon" 
                                  className="h-6 w-6 absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); deleteSession.mutate(s.id); if (sessionId === s.id) clearSession(); }}
                               >
                                  <Trash2 className="h-3.5 w-3.5" />
                               </Button>
                            </div>
                         ))
                      )}
                   </div>
                </ScrollArea>
             </TabsContent>
             
             {/* Sources Tab */}
             <TabsContent value="sources" className="flex-1 overflow-hidden m-0 flex flex-col">
                <div className="px-4 py-3 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur border-b">
                   <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Knowledge Base</span>
                   <label className="cursor-pointer">
                      <input
                        type="file" accept=".pdf,.mp3,.mp4" className="hidden"
                        onChange={handleFileChange}
                        disabled={uploadMutation.isPending}
                      />
                      <Button variant="outline" size="sm" className="h-7 px-3 rounded-full text-[11px] shadow-sm hover:bg-primary hover:text-primary-foreground" asChild>
                         <span>
                            {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                            Upload
                         </span>
                      </Button>
                   </label>
                </div>
                {uploadMutation.isPending && uploadMutation.progress > 0 && (
                   <div className="px-4 pt-3 pb-2 border-b bg-muted/20">
                      <div className="flex justify-between text-[10px] mb-1 font-medium text-muted-foreground">
                         <span>Uploading...</span>
                         <span>{uploadMutation.progress}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden shadow-inner">
                         <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadMutation.progress}%` }}></div>
                      </div>
                   </div>
                )}
                <ScrollArea className="flex-1">
                   <div className="p-3 space-y-2">
                      {sourcesLoading ? (
                         [1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)
                      ) : sources.length === 0 ? (
                         <div className="flex flex-col items-center justify-center text-center py-10 px-4 opacity-50">
                            <FileText className="h-10 w-10 mb-3 text-muted-foreground" />
                            <p className="text-xs font-medium">No sources yet</p>
                            <p className="text-[10px] mt-1">Upload a PDF or Audio to start.</p>
                         </div>
                      ) : (
                         sources.map(src => {
                            const Icon = FILE_ICONS[src.file_type] || FileText;
                            return (
                               <div key={src.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-card border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group text-sm relative overflow-hidden">
                                  <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                                     <Icon className={`h-4 w-4 ${src.file_type==='pdf'?'text-rose-500':src.file_type==='mp3'?'text-blue-500':'text-emerald-500'}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <p className="truncate text-[11px] font-semibold text-foreground/90">{src.title}</p>
                                     <Badge variant={STATUS_COLORS[src.status]} className="text-[9px] px-1.5 py-0 bg-opacity-10 mt-1 uppercase tracking-wider">
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
             </TabsContent>
          </Tabs>
        </aside>

        {/* Center Panel — Chat */}
        <main className="flex-1 flex flex-col bg-background/50 relative shadow-inner z-10 min-w-[300px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-8 pb-0 relative scroll-smooth">
               <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none h-32" />
               
               {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-full py-32 text-center relative z-10 animate-in fade-in zoom-in duration-500">
                     <div className="h-20 w-20 bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary/10 border border-primary/20">
                        <Sparkles className="h-10 w-10 text-primary" />
                     </div>
                     <h3 className="font-bold text-2xl mb-2 tracking-tight">AI Assistant Ready</h3>
                     <p className="text-muted-foreground text-sm max-w-sm mb-10 leading-relaxed">
                         Ask questions, generate summaries, or request study guides based on your uploaded sources.
                     </p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full text-left">
                         <Button variant="outline" className="justify-start text-xs font-normal h-auto py-3 px-4 shadow-sm hover:border-primary/50 rounded-xl" onClick={() => sendMessage("Give me a comprehensive summary of these documents.")}>
                             Summarize documents
                         </Button>
                         <Button variant="outline" className="justify-start text-xs font-normal h-auto py-3 px-4 shadow-sm hover:border-primary/50 rounded-xl" onClick={() => sendMessage("Generate a 5-question quiz.")}>
                             Create a quiz
                         </Button>
                     </div>
                  </div>
               ) : (
                  <div className="space-y-8 pb-12 relative z-10 max-w-4xl mx-auto">
                     {messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} />
                     ))}
                     {isSending && (
                        <div className="flex w-full justify-start mb-6 animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex max-w-[75%] gap-4 flex-row items-end">
                               <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary border border-primary/20 shadow-sm mb-1">
                                   <Loader2 className="h-4 w-4 animate-spin" />
                               </div>
                               <div className="bg-card rounded-2xl rounded-bl-sm px-5 py-3.5 text-sm text-foreground/80 border shadow-sm flex items-center gap-2">
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce"></span>
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-75"></span>
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce delay-150"></span>
                               </div>
                           </div>
                        </div>
                     )}
                     <div ref={chatBottomRef} className="h-4" />
                  </div>
               )}
            </div>
            
            <div className="p-4 bg-background border-t backdrop-blur-xl bg-background/80">
                <div className="max-w-4xl mx-auto flex items-end gap-2">
                    <div className="flex flex-col gap-2 flex-1">
                        {uploadMutation.isPending && (
                            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border animate-in slide-in-from-bottom-2">
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Uploading source... {uploadMutation.progress}%</span>
                            </div>
                        )}
                        <form onSubmit={handleSend} className="relative flex items-end gap-2 border rounded-2xl bg-card shadow-lg shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/30 transition-all overflow-hidden">
                            <div className="p-2 shrink-0">
                                <label className="cursor-pointer">
                                    <input type="file" className="hidden" accept=".pdf,.mp3,.mp4" onChange={handleFileChange} disabled={uploadMutation.isPending} />
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-colors">
                                        <Upload className="h-5 w-5" />
                                    </div>
                                </label>
                            </div>
                            <Textarea
                                placeholder="Message your AI assistant..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                                disabled={isSending}
                                className="flex-1 min-h-[56px] max-h-[250px] border-0 focus-visible:ring-0 resize-none py-4 px-0 bg-transparent text-[14px] leading-relaxed"
                                rows={1}
                                autoFocus
                            />
                            <div className="p-2 shrink-0">
                                <Button type="submit" size="icon" disabled={isSending || !chatInput.trim()} className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95">
                                <Send className="h-4 w-4 ml-0.5" />
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
                <div className="text-center mt-3">
                     <span className="text-[10px] text-muted-foreground opacity-70">AI may produce inaccurate information about people, places, or facts.</span>
                </div>
            </div>
        </main>

        {/* Right Panel — Generation Path (Studio & Notes) */}
        <aside className={`flex flex-col shrink-0 bg-card border-l transition-all duration-300 ease-in-out relative ${
            isRightSidebarOpen ? 'w-[340px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
          }`}>
          <Tabs defaultValue="studio" className="flex flex-col flex-1 h-full w-[340px]">
            <TabsList className="w-full justify-start rounded-none border-b px-4 h-12 bg-transparent shadow-sm shrink-0">
              <TabsTrigger value="studio" className="text-xs tracking-wide">Generation Path</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs tracking-wide">Notes</TabsTrigger>
            </TabsList>
            
            {/* ── Studio Tab ── */}
            <TabsContent value="studio" className="flex-1 overflow-y-auto m-0 p-4 space-y-6 custom-scrollbar bg-muted/5">
                
                {/* Audio Overview / Podcast Card */}
                <div className="rounded-2xl border bg-card text-card-foreground shadow-lg shadow-purple-500/5 overflow-hidden">
                   <div className="p-4 border-b bg-gradient-to-r from-purple-500/10 to-transparent">
                      <h3 className="font-bold text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400">
                         <Radio className="h-4 w-4" /> AI Podcast Generator
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Transform documents into a vibrant 2-person podcast episode.</p>
                   </div>
                   <div className="p-4 bg-card">
                      {overview ? (
                         <div className="space-y-4 animate-in fade-in duration-500">
                             <div className="flex gap-2 items-center">
                                 <Badge className="bg-purple-500 hover:bg-purple-600 text-[10px] px-2 py-0.5 rounded-full shadow-sm"><Music className="h-3 w-3 mr-1 inline"/> Episode Ready</Badge>
                                 <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs text-muted-foreground" onClick={() => setOverview(null)}>Clear</Button>
                             </div>
                             <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar bg-muted/20 p-3 rounded-xl border border-muted/50">
                                {(overview.turns ?? []).map((turn, i) => (
                                 <div key={i} className="flex flex-col gap-1">
                                     <span className={`font-bold text-[10px] uppercase tracking-wider ${turn.speaker === 'ALEX' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                     {turn.speaker}
                                     </span>
                                     <span className="text-[13px] text-foreground/90 leading-relaxed bg-background p-2 rounded-lg border shadow-sm">{turn.text}</span>
                                 </div>
                                 ))}
                              </div>
                              {overview.audioUrl && (
                                <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-700">
                                   <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                      <Music className="h-3 w-3" /> Listen to Episode
                                   </div>
                                   <audio controls className="w-full h-10 rounded-xl shadow-sm bg-muted/5 border">
                                      <source src={overview.audioUrl} type="audio/mpeg" />
                                   </audio>
                                </div>
                              )}
                         </div>
                      ) : (
                          <Button 
                             className="w-full text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-purple-500/25 h-12 rounded-xl transition-all hover:scale-[1.02]"
                             onClick={handleOverview}
                             disabled={overviewLoading || sources.filter(s => s.status === 'ready').length === 0}
                          >
                             {overviewLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Music className="h-5 w-5 mr-2" />}
                             {overviewLoading ? "Generating Episode..." : "Generate Podcast"}
                          </Button>
                      )}
                   </div>
                </div>

                {/* Quick Actions Card */}
                <div className="rounded-2xl border bg-card text-card-foreground shadow-md overflow-hidden">
                    <div className="p-4 border-b bg-muted/20">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                         <Zap className="h-4 w-4 text-amber-500" /> Study Generators
                      </h3>
                   </div>
                   <div className="p-3 grid grid-cols-2 gap-3">
                        <Button variant="outline" size="sm" className="h-auto py-4 px-2 flex flex-col gap-2 items-center justify-center border-muted hover:border-primary hover:bg-primary/5 rounded-xl transition-all shadow-sm" onClick={() => sendMessage("Create a detailed study guide summarizing all key topics from the sources.")}>
                            <FileText className="h-4 w-4 text-blue-500"/>
                            <span className="font-semibold text-[11px]">Summary</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto py-4 px-2 flex flex-col gap-2 items-center justify-center border-muted hover:border-primary hover:bg-primary/5 rounded-xl transition-all shadow-sm" onClick={() => sendMessage("Generate a 5-question multiple choice quiz to test my knowledge on these materials.")}>
                            <BrainCircuit className="h-4 w-4 text-purple-500"/>
                            <span className="font-semibold text-[11px]">Quiz Me</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto py-4 px-2 flex flex-col gap-2 items-center justify-center border-muted hover:border-primary hover:bg-primary/5 rounded-xl transition-all shadow-sm" onClick={() => sendMessage("What are the most frequently asked questions about these topics? Provide exactly 5 questions and answers.")}>
                            <MessageSquare className="h-4 w-4 text-emerald-500"/>
                            <span className="font-semibold text-[11px]">Q&A</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto py-4 px-2 flex flex-col gap-2 items-center justify-center border-muted hover:border-primary hover:bg-primary/5 rounded-xl transition-all shadow-sm" onClick={() => sendMessage("Generate a timeline or step-by-step breakdown of the processes mentioned in the sources.")}>
                            <Clock className="h-4 w-4 text-orange-500"/>
                            <span className="font-semibold text-[11px]">Timeline</span>
                        </Button>
                   </div>
                </div>

            </TabsContent>

            {/* ── Notes Tab ── */}
            <TabsContent value="notes" className="flex-1 flex flex-col m-0 bg-background h-full w-[340px]">
              <div className="p-3 border-b flex items-center justify-between shrink-0 bg-muted/10">
                 {!editingNote ? (
                     <div className="flex-1 flex items-center justify-between">
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Notes</span>
                         <Button size="sm" onClick={() => setEditingNote({ id: 'new', title: '', content: '' })} className="h-7 px-3 text-xs rounded-full shadow-sm">
                            <Plus className="h-3 w-3 mr-1" /> New
                         </Button>
                     </div>
                 ) : (
                     <div className="flex-1 flex items-center justify-between">
                         <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-full" onClick={() => setEditingNote(null)}>
                            <ChevronLeft className="h-3 w-3 mr-1" /> Back
                         </Button>
                         <Tabs value={noteMode} onValueChange={setNoteMode} className="h-7">
                            <TabsList className="h-7 bg-muted/50 p-0.5 rounded-full">
                                <TabsTrigger value="edit" className="text-[10px] px-3 h-6 rounded-full">Edit</TabsTrigger>
                                <TabsTrigger value="preview" className="text-[10px] px-3 h-6 rounded-full">Preview</TabsTrigger>
                            </TabsList>
                         </Tabs>
                     </div>
                 )}
              </div>

              <div className="flex-1 overflow-hidden flex flex-col relative custom-scrollbar">
                {!editingNote ? (
                    <div className="p-3 space-y-2 overflow-y-auto">
                        {notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-60">
                                <FileText className="h-10 w-10 mb-3" />
                                <span className="text-xs font-medium">No saved notes</span>
                                <span className="text-[10px] mt-1">Create one to start writing.</span>
                            </div>
                        ) : notes.map(note => (
                            <div key={note.id} className="group flex items-center bg-card border rounded-xl p-2 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer" onClick={() => setEditingNote({ id: note.id, title: note.title, content: note.content })}>
                                <div className="flex-1 px-2 py-1 min-w-0">
                                    <p className="text-[13px] font-semibold truncate mb-1">{note.title || 'Untitled Note'}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{note.content ? note.content.slice(0, 40) + '...' : 'Empty content'}</p>
                                </div>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-destructive/10 hover:bg-destructive hover:text-white rounded-lg"
                                    onClick={(e) => { e.stopPropagation(); deleteNote.mutate(note.id); }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col p-4">
                        <Input
                            className="text-lg font-bold border-b-2 border-transparent focus-visible:border-primary rounded-none focus-visible:ring-0 px-1 py-5 mb-3 shadow-none bg-transparent transition-colors"
                            placeholder="Note Title"
                            value={editingNote.title}
                            onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))}
                        />
                        {noteMode === 'edit' ? (
                            <Textarea
                                className="flex-1 resize-none font-mono text-[13px] leading-relaxed p-2 bg-transparent border-0 focus-visible:ring-0 w-full rounded-none tracking-tight custom-scrollbar"
                                placeholder="Start writing in Markdown..."
                                value={editingNote.content}
                                autoFocus
                                onChange={e => setEditingNote(n => ({ ...n, content: e.target.value }))}
                            />
                        ) : (
                            <ScrollArea className="flex-1 p-3 bg-muted/5 rounded-xl border border-muted/50 custom-scrollbar">
                                <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-normal">
                                    <ReactMarkdown>{editingNote.content || '*Empty note*'}</ReactMarkdown>
                                </div>
                            </ScrollArea>
                        )}
                        <div className="pt-4 mt-auto flex gap-2">
                             <Button size="sm" className="flex-1 h-9 rounded-lg font-medium" onClick={handleSaveNote}>Save Note</Button>
                             {editingNote.id !== 'new' && (
                                <Button size="sm" variant="destructive" className="shrink-0 h-9 w-9 rounded-lg p-0" onClick={async () => { await deleteNote.mutateAsync(editingNote.id); setEditingNote(null); }}>
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
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold select-none shadow-sm mt-1 ${hasError ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-primary/10 text-primary border border-primary/20 bg-gradient-to-br from-primary/20 to-purple-500/20'}`}>
            {hasError ? '⚠' : <Sparkles className="h-4 w-4" />}
          </div>
        )}

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2 min-w-0`}>
          {isUser ? (
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap shadow-md">
              {message.content}
            </div>
          ) : (
            <div className="text-[15px] leading-relaxed text-foreground mt-1 w-full bg-card border rounded-2xl rounded-tl-sm p-5 shadow-sm">
              <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline ? (
                        <div className="mt-3 mb-5 rounded-xl overflow-hidden bg-muted/40 border">
                          <div className="px-4 py-2 bg-muted/80 text-xs text-muted-foreground font-mono flex items-center border-b">{match?.[1] || 'code'}</div>
                          <div className="p-4 overflow-x-auto">
                            <code className="text-sm font-mono" {...props}>
                              {children}
                            </code>
                          </div>
                        </div>
                      ) : (
                        <code className="bg-muted/60 text-foreground rounded px-1.5 py-0.5 text-[0.9em] font-mono border" {...props}>
                          {children}
                        </code>
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
            <div className="flex flex-wrap gap-2 mt-2">
              {message.citations.map((c, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 text-[11px] font-medium bg-secondary/60 text-secondary-foreground hover:bg-secondary transition-colors rounded-full px-3 py-1 cursor-default border border-border/50 shadow-sm"
                  title={c.title}
                >
                  <span className="opacity-60 font-bold">{i + 1}.</span>
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
