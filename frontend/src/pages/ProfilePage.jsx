import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { BookOpen, User, Settings, LayoutDashboard, LogOut, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { toast } from 'sonner';

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [name, setName] = useState(user?.displayName || '');
    const [avatarPreview, setAvatarPreview] = useState(null);
    
    const handleUpdate = (e) => {
        e.preventDefault();
        toast.success("Profile updated successfully!");
        // Simulate update
        if (avatarPreview) {
             toast.info("Avatar update is simulated in this demo.");
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
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
                        <Button variant="ghost" className="w-full justify-start hover:bg-muted/50 rounded-xl" onClick={() => navigate('/dashboard')}>
                            <LayoutDashboard className="mr-3 h-4 w-4 text-muted-foreground" />
                            My Notebooks
                        </Button>
                        <Button variant="secondary" className="w-full justify-start shadow-sm rounded-xl" onClick={() => navigate('/profile')}>
                            <User className="mr-3 h-4 w-4 text-primary" />
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
            <main className="flex-1 px-6 py-10 md:px-16 md:py-16 max-w-4xl w-full mx-auto">
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-bold tracking-tight">Your Profile</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Manage your identity and account details.</p>
                </div>

                <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <Card className="rounded-2xl shadow-sm overflow-hidden border-muted/50">
                        <CardHeader className="bg-muted/10 border-b">
                            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-blue-500" /> Personal Information</CardTitle>
                            <CardDescription>Update your photo and personal details.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <form id="profile-form" onSubmit={handleUpdate} className="flex flex-col md:flex-row gap-8">
                                {/* Avatar Section */}
                                <div className="flex flex-col items-center space-y-4 shrink-0">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted/50 flex items-center justify-center">
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-4xl text-muted-foreground font-bold">{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                                            )}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute bottom-1 right-1 bg-primary text-primary-foreground p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                                        >
                                            <Camera className="h-4 w-4" />
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleAvatarChange} 
                                            accept="image/*" 
                                            className="hidden" 
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground">JPG, GIF or PNG. Max size 2MB.</span>
                                </div>

                                {/* Details Section */}
                                <div className="flex-1 space-y-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="name" className="text-sm font-semibold">Display Name</Label>
                                        <Input 
                                            id="name" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow"
                                            placeholder="What should we call you?"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                                        <Input 
                                            id="email" 
                                            value={user?.email || ''} 
                                            disabled 
                                            className="h-11 rounded-xl bg-muted/50 border-muted text-muted-foreground" 
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">To change your email, please contact support.</p>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter className="bg-muted/5 border-t pt-4 flex justify-end">
                            <Button type="submit" form="profile-form" className="rounded-xl px-8 shadow-md">Save Profile</Button>
                        </CardFooter>
                    </Card>

                    <Card className="rounded-2xl shadow-sm border-muted/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Subscription Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-emerald-500/20 p-5 flex items-center justify-between bg-emerald-500/5">
                                <div>
                                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400">Pro Plan (Demo)</h4>
                                    <p className="text-sm text-muted-foreground mt-1">You have full access to all AI models and unlimited storage.</p>
                                </div>
                                <Button variant="outline" className="rounded-xl border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Manage Plan</Button>
                            </div>
                        </CardContent>
                    </Card>

                     <Card className="rounded-2xl border-destructive/20 shadow-sm overflow-hidden">
                        <CardHeader className="bg-destructive/5 border-b border-destructive/10">
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" /> Danger Zone
                            </CardTitle>
                            <CardDescription>Irreversible actions related to your account.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm">Delete Account</h4>
                                    <p className="text-sm text-muted-foreground mt-1">Permanently remove your account and all associated data.</p>
                                </div>
                                <Button variant="destructive" className="rounded-lg shrink-0">Delete My Account</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
