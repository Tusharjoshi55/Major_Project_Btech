import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, User, Settings, LayoutDashboard, LogOut, Palette, Sparkles, Bell } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleSave = (e) => {
        e.preventDefault();
        toast.success("Settings saved successfully!");
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
                        <Button variant="ghost" className="w-full justify-start hover:bg-muted/50 rounded-xl" onClick={() => navigate('/profile')}>
                            <User className="mr-3 h-4 w-4 text-muted-foreground" />
                            Profile
                        </Button>
                        <Button variant="secondary" className="w-full justify-start shadow-sm rounded-xl" onClick={() => navigate('/settings')}>
                            <Settings className="mr-3 h-4 w-4 text-primary" />
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
            <main className="flex-1 px-6 py-10 md:px-16 md:py-16 max-w-5xl w-full mx-auto">
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-bold tracking-tight">Preferences</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Customize your learning environment.</p>
                </div>

                <Tabs defaultValue="general" className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <TabsList className="mb-8 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="general" className="rounded-xl px-6 h-full data-[state=active]:shadow-sm">General</TabsTrigger>
                        <TabsTrigger value="ai" className="rounded-xl px-6 h-full data-[state=active]:shadow-sm">AI Options</TabsTrigger>
                        <TabsTrigger value="appearance" className="rounded-xl px-6 h-full data-[state=active]:shadow-sm">Appearance</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="general" className="space-y-6 m-0">
                        <Card className="rounded-2xl shadow-sm overflow-hidden border-muted/50">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-blue-500" /> Workspace Settings</CardTitle>
                                <CardDescription>Manage how your notebooks and dashboard behave.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Default Dashboard View</Label>
                                    <select className="flex h-11 w-full md:w-1/2 items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-shadow">
                                        <option>Grid View</option>
                                        <option>List View</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Primary Language</Label>
                                    <select className="flex h-11 w-full md:w-1/2 items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-shadow">
                                        <option>English</option>
                                        <option>Spanish</option>
                                        <option>French</option>
                                        <option>German</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-orange-500"/> Email Notifications</Label>
                                        <p className="text-xs text-muted-foreground">Receive updates when your large sources finish processing.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" value="" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/5 border-t pt-4">
                                <Button onClick={handleSave} className="rounded-xl px-8 shadow-md">Save Changes</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="ai" className="space-y-6 m-0">
                        <Card className="rounded-2xl shadow-sm overflow-hidden border-muted/50 relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
                            <CardHeader className="bg-muted/10 border-b relative z-10">
                                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> AI Behavior</CardTitle>
                                <CardDescription>Tune how the AI models interact with you.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6 relative z-10">
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Citation Style</Label>
                                    <select className="flex h-11 w-full md:w-1/2 items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500/50 transition-shadow">
                                        <option>Inline [1]</option>
                                        <option>Verbose [Source: Title]</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Response Length Focus</Label>
                                    <select className="flex h-11 w-full md:w-1/2 items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500/50 transition-shadow">
                                        <option>Balanced</option>
                                        <option>Concise</option>
                                        <option>Extensive & Detailed</option>
                                    </select>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/5 border-t pt-4 relative z-10">
                                <Button onClick={handleSave} className="rounded-xl px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20">Save AI Preferences</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="appearance" className="space-y-6 m-0">
                        <Card className="rounded-2xl shadow-sm overflow-hidden border-muted/50">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-pink-500" /> Interface Theme</CardTitle>
                                <CardDescription>Personalize the look and feel of StudyBuddy.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold">Dark Mode Toggle</Label>
                                        <p className="text-xs text-muted-foreground">Switch between light and dark themes instantly.</p>
                                    </div>
                                    <ThemeToggle />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
