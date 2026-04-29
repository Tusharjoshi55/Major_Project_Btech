import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { BookOpen, BrainCircuit, Zap, Shield, ChevronRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
            {/* Navigation */}
            <header className="px-6 lg:px-12 py-4 flex items-center justify-between z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b">
                <div className="flex items-center gap-2">
                    <div className="bg-primary text-primary-foreground p-1.5 rounded-xl shadow-lg shadow-primary/20">
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        StudyBuddy AI
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {user ? (
                        <Button className="rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-105 px-6" onClick={() => navigate('/dashboard')}>
                            Dashboard
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate('/login')}>
                                Log In
                            </Button>
                            <Button className="rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-105" onClick={() => navigate('/signup')}>
                                Get Started
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 lg:py-32 relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
                <div className="absolute top-20 right-20 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>
                
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-muted/50 border text-sm font-medium mb-4">
                        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                        Introducing StudyBuddy AI 2.0
                    </div>
                    
                    <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                        Transform Your Notes into <br className="hidden lg:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            Active Knowledge.
                        </span>
                    </h1>
                    
                    <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Upload your PDFs, slides, and audio. Our advanced AI creates interactive study guides, quizzes, and even dual-host podcast overviews in seconds.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        {user ? (
                            <Button size="lg" className="rounded-xl h-14 px-8 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform" onClick={() => navigate('/dashboard')}>
                                Back to Dashboard <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        ) : (
                            <>
                                <Button size="lg" className="rounded-xl h-14 px-8 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform" onClick={() => navigate('/signup')}>
                                    Start for Free <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                                <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-lg hover:bg-muted" onClick={() => navigate('/login')}>
                                    Sign In
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Dashboard Preview / Mockup */}
                <div className="mt-20 w-full max-w-5xl mx-auto relative group animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden aspect-video flex items-center justify-center bg-muted/20">
                        {/* Placeholder for actual dashboard image */}
                        <div className="text-center space-y-4">
                            <BrainCircuit className="h-16 w-16 mx-auto text-primary opacity-50" />
                            <p className="text-muted-foreground font-medium">Your personalized AI workspace awaits</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Section */}
            <section className="py-24 px-6 lg:px-12 bg-muted/30 border-t">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">Supercharge your learning</h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Everything you need to master complex subjects, built into one seamless platform.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={<Zap className="h-6 w-6 text-yellow-500" />}
                            title="Instant Summaries"
                            desc="Get the gist of 100-page documents in seconds with AI-generated executive summaries and key takeaways."
                        />
                        <FeatureCard 
                            icon={<BrainCircuit className="h-6 w-6 text-purple-500" />}
                            title="Interactive Quizzes"
                            desc="Test your knowledge on the fly. The AI generates practice questions directly from your source material."
                        />
                        <FeatureCard 
                            icon={<Shield className="h-6 w-6 text-emerald-500" />}
                            title="Grounded Answers"
                            desc="Every answer comes with precise citations to your original documents. No hallucinations, just facts."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 px-6 lg:px-12 bg-background text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} StudyBuddy AI. All rights reserved.</p>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="p-6 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                {icon}
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    );
}
