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
  BookOpen, Plus, Trash2, FileText, LogOut, LayoutDashboard, Settings, User
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-muted/30 flex flex-col justify-between shrink-0 h-auto md:h-screen md:sticky md:top-0">
        <div>
          <div className="px-6 py-6 flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">StudyBuddy AI</span>
          </div>

          <nav className="px-4 space-y-1">
            <Button variant="secondary" className="w-full justify-start shadow-sm" onClick={() => navigate('/Notebooks')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              My Notebooks
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-muted" onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-muted" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </nav>
        </div>

        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={logout} className="shrink-0 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-6 py-10 md:px-12 md:py-12 max-w-6xl w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Notebooks</h1>
            <p className="text-muted-foreground mt-1">
              Upload sources, chat with your content, generate overviews.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Notebook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Notebook</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <Input
                  placeholder="Notebook title"
                  value={title} onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
                <Input
                  placeholder="Description (optional)"
                  value={desc} onChange={e => setDesc(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No notebooks yet</p>
            <p className="text-sm mt-1">Create your first notebook to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notebooks.map(nb => (
              <Card
                key={nb.id}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(`/notebook/${nb.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{nb.title}</CardTitle>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                      onClick={e => handleDelete(e, nb.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {nb.description && (
                    <CardDescription className="line-clamp-2">{nb.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {nb.source_count} source{nb.source_count !== 1 ? 's' : ''}
                    </span>
                    <span>{new Date(nb.updated_at).toLocaleDateString()}</span>
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
