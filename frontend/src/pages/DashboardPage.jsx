import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  useNotebooks,
  useCreateNotebook,
  useDeleteNotebook,
} from '../hooks/useNotebooks.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import ThemeToggle from '../components/ThemeToggle.jsx';
import {
  BookOpen, Plus, Trash2, FileText, LogOut, LayoutDashboard, Settings, User, Clock
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: notebooks = [], isLoading } = useNotebooks();
  const createMutation = useCreateNotebook();
  const deleteMutation = useDeleteNotebook();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    await createMutation.mutateAsync({ title: title || 'Untitled Notebook', description: desc });
    setTitle('');
    setDesc('');
    setOpen(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this notebook and all its sources?')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-muted/20 flex flex-col justify-between shrink-0 h-auto md:h-screen md:sticky md:top-0">
        <div>
          <div className="px-6 py-6 flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">StudyBuddy</span>
          </div>

          <nav className="px-4 space-y-2 mt-4">
            <Button variant="secondary" className="w-full justify-start shadow-sm rounded-xl" onClick={() => navigate('/dashboard')}>
              <LayoutDashboard className="mr-3 h-4 w-4 text-primary" />
              My Notebooks
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-muted/50 rounded-xl" onClick={() => navigate('/profile')}>
              <User className="mr-3 h-4 w-4 text-muted-foreground" />
              Profile
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-muted/50 rounded-xl" onClick={() => navigate('/settings')}>
              <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
              Settings
            </Button>
          </nav>
        </div>

        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-muted/30 border">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 shadow-inner">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.displayName || 'User'}</p>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={logout} className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-6 py-10 md:px-12 md:py-12 max-w-6xl w-full mx-auto">
        <div className="flex items-center justify-between mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">My Notebooks</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Organize your research and master complex topics.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-lg shadow-primary/25 h-11 px-6"><Plus className="h-5 w-5 mr-2" />New Notebook</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-muted/50">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create Notebook</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Input
                    placeholder="e.g. Psychology 101, Marketing Strategy"
                    value={title} onChange={e => setTitle(e.target.value)}
                    autoFocus
                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow"
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Description (optional)"
                    value={desc} onChange={e => setDesc(e.target.value)}
                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="rounded-xl px-8 shadow-md">
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-700">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground bg-muted/5 rounded-3xl border-2 border-dashed border-muted flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000">
            <div className="bg-muted p-6 rounded-full mb-6">
                <BookOpen className="h-16 w-16 opacity-20" />
            </div>
            <p className="text-2xl font-bold text-foreground">No notebooks yet</p>
            <p className="text-lg mt-2 max-w-sm mx-auto">Create your first notebook to begin uploading sources and chatting with AI.</p>
            <Button variant="outline" className="mt-8 rounded-full h-12 px-8" onClick={() => setOpen(true)}>
                <Plus className="h-5 w-5 mr-2" /> Start Creating
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {notebooks.map(nb => (
              <Card
                key={nb.id}
                className="cursor-pointer hover:shadow-xl transition-all group rounded-2xl border-muted/50 overflow-hidden relative"
                onClick={() => navigate(`/notebook/${nb.id}`)}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-bold line-clamp-2 leading-tight pr-4">{nb.title}</CardTitle>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                      onClick={e => handleDelete(e, nb.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {nb.description && (
                    <CardDescription className="line-clamp-2 mt-1 text-sm">{nb.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex items-center gap-5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full">
                      <FileText className="h-3 w-3" />
                      {nb.source_count} {nb.source_count !== 1 ? 'sources' : 'source'}
                    </span>
                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />
                        {new Date(nb.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
