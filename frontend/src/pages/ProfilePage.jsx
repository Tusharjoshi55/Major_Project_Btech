import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { BookOpen, User, Settings, LayoutDashboard, LogOut, CheckCircle2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { toast } from 'sonner';

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState(user?.displayName || '');
    
    const handleUpdate = (e) => {
        e.preventDefault();
        toast.success("Profile updated successfully!");
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
                        <Button variant="ghost" className="w-full justify-start hover:bg-muted" onClick={() => navigate('/')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            My Notebooks
                        </Button>
                        <Button variant="secondary" className="w-full justify-start shadow-sm" onClick={() => navigate('/profile')}>
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
            <main className="flex-1 px-6 py-10 md:px-12 md:py-12 max-w-4xl w-full mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">User Profile</h1>
                    <p className="text-muted-foreground mt-1">Manage your personal information and account details.</p>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your display name here.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form id="profile-form" onSubmit={handleUpdate} className="space-y-4">
                                <div className="space-y-2 max-w-md">
                                    <Label htmlFor="name">Display Name</Label>
                                    <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="space-y-2 max-w-md">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" form="profile-form">Save Changes</Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription & Billing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border p-4 flex items-center gap-4 bg-muted/10">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                <div>
                                    <h4 className="font-semibold">Free Tier</h4>
                                    <p className="text-sm text-muted-foreground">You are currently using the free OpenRouter AI integration plan.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                     <Card className="border-destructive/30">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            <CardDescription>Permanently delete your account and all associated data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="destructive">Delete Account</Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
