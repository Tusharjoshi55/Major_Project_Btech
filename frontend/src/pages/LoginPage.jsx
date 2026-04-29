import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card, CardContent, CardDescription,
    CardHeader, CardTitle,
} from '@/components/ui/card';
import { BookOpen, Sparkles } from 'lucide-react';

export default function LoginPage() {
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError('');
        try {
            await loginWithGoogle();
        } catch (err) {
            setError(err.message || 'Google sign-in failed.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10" />
            <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full -z-10" />

            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-primary text-primary-foreground p-3 rounded-2xl shadow-xl shadow-primary/20 mb-4">
                        <BookOpen className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight">StudyBuddy AI</h1>
                    <p className="text-muted-foreground mt-2">Sign in to your learning workspace</p>
                </div>

                <Card className="rounded-3xl border-muted/50 shadow-2xl shadow-primary/5 overflow-hidden">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                             Welcome Back
                        </CardTitle>
                        <CardDescription>Enter your credentials to access your notebooks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="text-sm font-medium text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20 animate-in shake duration-500">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider ml-1">Email Address</Label>
                                <Input
                                    id="email" type="email" placeholder="you@example.com"
                                    value={email} onChange={e => setEmail(e.target.value)} required
                                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">Password</Label>
                                    <Link to="#" className="text-xs text-primary hover:underline font-medium">Forgot password?</Link>
                                </div>
                                <Input
                                    id="password" type="password" placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)} required
                                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow"
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]" disabled={loading}>
                                {loading ? 'Signing in…' : 'Sign In'}
                            </Button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                                <span className="bg-card px-3 text-muted-foreground">or continue with</span>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full h-12 rounded-xl font-semibold border-muted-foreground/20 hover:bg-muted/50 transition-colors" onClick={handleGoogle}>
                            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </Button>

                        <p className="text-sm text-center mt-8 text-muted-foreground">
                            New here?{' '}
                            <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4">
                                Create an account
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
