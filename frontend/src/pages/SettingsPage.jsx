import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, User, Settings, LayoutDashboard, LogOut } from 'lucide-react';
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
                        <Button variant="ghost" className="w-full justify-start hover:bg-muted" onClick={() => navigate('/profile')}>
                            <User className="mr-2 h-4 w-4" />
                            Profile
                        </Button>
                        <Button variant="secondary" className="w-full justify-start shadow-sm" onClick={() => navigate('/settings')}>
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
                    <h1 className="text-3xl font-bold">Preferences & Settings</h1>
                    <p className="text-muted-foreground mt-1">Configure your study environment and AI behaviors.</p>
                </div>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="ai">AI & Generation</TabsTrigger>
                        <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="general">
                        <Card>
                            <CardHeader>
                                <CardTitle>Workspace Settings</CardTitle>
                                <CardDescription>Manage how your notebooks are organized.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Default View</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>Grid View</option>
                                        <option>List View</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Language</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>English</option>
                                        <option>Spanish</option>
                                        <option>French</option>
                                    </select>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSave}>Save Changes</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="ai">
                        <Card>
                            <CardHeader>
                                <CardTitle>AI Preferences</CardTitle>
                                <CardDescription>Tune the AI chat response behavior.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Citation Style</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>Inline [1]</option>
                                        <option>Verbose [Source: Title]</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Response Length Focus</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>Concise</option>
                                        <option>Detailed</option>
                                        <option>Extensive (Academic)</option>
                                    </select>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSave}>Save Changes</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="appearance">
                        <Card>
                            <CardHeader>
                                <CardTitle>Theme</CardTitle>
                                <CardDescription>Select between Light and Dark mode using the button in the bottom left.</CardDescription>
                            </CardHeader>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
