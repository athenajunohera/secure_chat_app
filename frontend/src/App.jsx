import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Chat from './components/Chat';

function App() {
    const { user, loading } = useAuth();
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    if (loading || showSplash) {
        return (
            <div className="h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden canvas-grain">
                {/* Dark Forest Background image */}
                <div className="absolute inset-0 z-0">
                    <img src="/splash_bg.jpg" alt="Enchanted Forest" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>

                {/* Antigravity Floating Elements - SLOW Realistic Sakura Petals */}
                <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="sunbeam-streak" style={{ top: '20%', left: '-20%', opacity: 0.5 }}></div>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className="sakura-petal-container"
                            style={{
                                left: `${Math.random() * 80 + 10}%`,
                                animationDuration: `${Math.random() * 10 + 40}s`, // 40-50s fall time
                                animationDelay: `${i * 10}s`, // Every 10 seconds a new petal appears
                                width: `${Math.random() * 15 + 15}px`,
                                height: `${Math.random() * 15 + 15}px`
                            }}
                        >
                            <div className="sakura-petal-body" style={{
                                animationDuration: `${Math.random() * 8 + 6}s`
                            }}></div>
                        </div>
                    ))}
                </div>

                <div className="relative z-10 flex flex-col items-center antigravity-float">
                    <div className="relative group">
                        <div className="absolute -inset-10 bg-[#e2b170] opacity-20 rounded-full blur-[70px] animate-pulse"></div>
                        <div className="relative w-52 h-52 p-2 bg-white rounded-full shadow-[0_25px_70px_rgba(61,43,31,0.2)] overflow-hidden border-4 border-white/90 large-icon-container">
                            <img src="/login_bg.jpg" alt="Enchanted Spirit" className="w-full h-full object-cover rounded-full" />
                        </div>
                    </div>

                    <div className="mt-16 flex flex-col items-center gap-4 animate-fade-in text-center">
                        <h1 className="font-spiritual text-5xl font-black text-white tracking-[0.6em] uppercase drop-shadow-2xl">ENCHANTED</h1>
                        <p className="font-mystic text-4xl text-[#e2b170] -mt-2 italic drop-shadow-md">The Gilded Sanctum</p>
                        <div className="flex gap-8 mt-10">
                            <span className="text-4xl animate-bounce [animation-delay:0s] drop-shadow-xl">✨</span>
                            <span className="text-4xl animate-bounce [animation-delay:0.2s] drop-shadow-xl">🌸</span>
                            <span className="text-4xl animate-bounce [animation-delay:0.4s] drop-shadow-xl">✨</span>
                        </div>
                        <p className="mt-16 text-[11px] font-black uppercase tracking-[0.7em] text-white/80 drop-shadow-md">Defying Gravity & Mixing Dreams...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in h-screen overflow-hidden">
            {user ? <Chat /> : <Login />}
        </div>
    );
}

export default App;
