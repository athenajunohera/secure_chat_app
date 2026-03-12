import { useState } from 'react';
import { useAuth, FOREST_AVATARS } from '../context/AuthContext';

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(FOREST_AVATARS[0].id);
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isLogin) {
                await login(username, password);
            } else {
                await register(username, password, selectedAvatar);
            }
        } catch (err) {
            console.error(err);
            alert("Magical interruption: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden canvas-grain bg-[#2c1d11]">
            {/* Castle Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/ethereal_castle_background_1772908668696.png"
                    alt="Castle"
                    className="w-full h-full object-cover"
                />
                {/* Sunbeams */}
                <div className="sunbeam-streak" style={{ top: '10%', left: '-10%' }}></div>
                <div className="sunbeam-streak" style={{ top: '40%', left: '10%', animationDelay: '5s' }}></div>
            </div>

            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar clear-glass p-8 z-20 animate-fade-in relative border-2 border-white/30 antigravity-float">
                <div className="flex flex-col items-center mb-6 relative">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-inner border border-white/30">
                        <span className="text-4xl">🏰</span>
                    </div>
                    <h1 className="font-spiritual text-3xl font-bold text-white tracking-[0.3em] uppercase drop-shadow-2xl">
                        {isLogin ? 'Ascend' : 'Manifest'}
                    </h1>
                    <p className="font-mystic text-xl text-[#e2b170] mt-1 italic shadow-sm">Welcome to the Ethereal Sanctuary</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 relative">
                    <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-[0.2em] text-[#e2b170] ml-2 font-bold focus-within:text-white transition-colors">Divine Essence Name</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-white outline-none focus:border-[#e2b170] transition-all font-forest border-b-2 placeholder:text-white/40"
                            placeholder="Thy name..."
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-[0.2em] text-[#e2b170] ml-2 font-bold focus-within:text-white transition-colors">Secret Sigil</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-white outline-none focus:border-[#e2b170] transition-all font-forest border-b-2 placeholder:text-white/40"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="animate-fade-in space-y-2">
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8d6e63] ml-2 font-bold text-center">Thy Spirit Avatar</label>
                            <div className="grid grid-cols-4 gap-3 avatar-grid">
                                {FOREST_AVATARS.map((av) => (
                                    <button
                                        key={av.id}
                                        type="button"
                                        onClick={() => setSelectedAvatar(av.id)}
                                        className={`w-full aspect-square text-2xl rounded-xl flex items-center justify-center transition-all border-2 ${selectedAvatar === av.id
                                            ? 'bg-white border-[#e2b170] shadow-[0_5px_15px_rgba(226,177,112,0.4)] scale-110'
                                            : 'bg-white/30 border-transparent hover:border-white/60 hover:bg-white/50'
                                            }`}
                                        title={av.name}
                                    >
                                        {av.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-3 mt-4">
                        {isLogin ? (
                            <>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 rounded-full bg-gradient-to-r from-[#e2b170] to-[#f4abb4] text-white font-spiritual font-bold uppercase tracking-[0.25em] hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[#3d2b1f]/10 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Manifesting...' : 'Enter The Realm'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsLogin(false)}
                                    className="w-full py-3 rounded-full bg-black/40 text-[#e2d6c3] font-bold uppercase tracking-[0.2em] text-xs hover:bg-black/80 hover:text-white transition-all border border-white/20"
                                >
                                    No vessel yet? Register Here
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 rounded-full bg-gradient-to-r from-[#e2b170] to-[#f4abb4] text-white font-spiritual font-bold uppercase tracking-[0.25em] hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[#3d2b1f]/10 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Binding...' : 'Claim Thy Seat'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsLogin(true)}
                                    className="w-full py-3 rounded-full bg-black/40 text-[#e2d6c3] font-bold uppercase tracking-[0.2em] text-xs hover:bg-black/80 hover:text-white transition-all border border-white/20"
                                >
                                    ⬅️ Go Back to Login
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;
