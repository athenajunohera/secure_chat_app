import { useState, useEffect, useRef, useMemo, memo } from 'react';
import io from 'socket.io-client';
import { useAuth, FOREST_AVATARS, api } from '../context/AuthContext';
import { encryptMessage, decryptMessage, importKey } from '../utils/crypto';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';

const isProd = import.meta.env.PROD;
const RENDER_URL = "https://enchanted-chat-api.onrender.com";
const socket = io(isProd ? (import.meta.env.VITE_API_URL?.replace('/api', '') || RENDER_URL) : `http://${window.location.hostname}:5050`);

function Chat() {
    const { user, privateKey, logout, updateAvatar } = useAuth();
    const [showProfile, setShowProfile] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentRoom, setCurrentRoom] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [privateKeyObj, setPrivateKeyObj] = useState(null);
    const [typingStatus, setTypingStatus] = useState({});
    const typingTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const getAvatarEmoji = (id) => FOREST_AVATARS.find(a => a.id === id)?.emoji || '🌱';

    // Generate a consistent pseudo-random avatar for other users based on their username string
    const getChatMateAvatar = (username) => {
        if (!username) return '🌱';
        const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return FOREST_AVATARS[hash % FOREST_AVATARS.length]?.emoji || '👩‍🎨';
    };

    useEffect(() => {
        if (user?.username) {
            socket.emit('join_app', user.username);
            socket.emit('register_public_key', { username: user.username, publicKey: user.publicKey });
        }
    }, [user]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                if (!currentRoom) return;

                const res = await api.get('/messages/dm', {
                    params: { user1: user.username, user2: currentRoom }
                });

                const historyItems = await Promise.all(res.data.map(async (msg) => {
                    let displayContent = msg.content;
                    let chatMate = msg.sender === user.username ? msg.room : msg.sender;

                    if (msg.isEncrypted) {
                        if (privateKeyObj) {
                            try {
                                let isSender = (msg.sender === user.username);
                                let parsedContent = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                                displayContent = await decryptMessage(parsedContent, privateKeyObj, isSender);
                            } catch (e) {
                                displayContent = "📜 [Old Message - Cannot decrypt sender copy]";
                            }
                        } else {
                            displayContent = "🔒 [Encrypted] Missing Private Key (Incognito/New Device?)";
                        }
                    }

                    return {
                        room: msg.room,
                        author: msg.sender,
                        encryptedData: msg.content,
                        isEncrypted: msg.isEncrypted,
                        time: new Date(msg.timestamp).toLocaleTimeString(),
                        content: displayContent,
                        chatMate: chatMate,
                        status: msg.status,
                        _id: msg._id
                    };
                }));

                setMessages(historyItems);
            } catch (e) {
                console.error("Failed to fetch history", e);
            }
        };

        // Wait until we either have the imported key, OR we know there is no key at all
        if (user && currentRoom) {
            if (privateKey && !privateKeyObj) return; // Still loading the key, skip fetch for now!
            fetchHistory();
        }
    }, [currentRoom, user, privateKey, privateKeyObj]);

    useEffect(() => {
        if (currentRoom) {
            setUnreadCounts(prev => {
                const updated = { ...prev };
                delete updated[currentRoom];
                return updated;
            });
        }
    }, [currentRoom]);

    useEffect(() => {
        socket.on('receive_message', async (data) => {
            // Ignore messages from ourselves to prevent duplicates 
            // since we optimistically rendered them on send
            if (data.author === user.username) return;

            let decryptedContent = data.content;
            if (data.isEncrypted) {
                if (privateKeyObj) {
                    try {
                        let isSender = (data.author === user.username);
                        decryptedContent = await decryptMessage(data.encryptedData, privateKeyObj, isSender);
                    } catch (e) {
                        decryptedContent = "📜 [Old Message - Cannot decrypt sender copy]";
                    }
                } else {
                    decryptedContent = "🔒 [Encrypted] Missing Private Key (Incognito/New Device?)";
                }
            }

            const incomingMsg = {
                ...data,
                content: decryptedContent,
                chatMate: data.author === user.username ? data.room : data.author
            };

            setMessages((prev) => [...prev, incomingMsg]);

            if (incomingMsg.chatMate !== currentRoom) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [incomingMsg.chatMate]: (prev[incomingMsg.chatMate] || 0) + 1
                }));
            }
        });

        socket.on('online_users', (users) => {
            setOnlineUsers(users);
        });

        socket.on('user_typing', (data) => {
            if (data.room === user.username) {
                setTypingStatus(prev => ({ ...prev, [data.username]: true }));
            }
        });

        socket.on('user_stop_typing', (data) => {
            setTypingStatus(prev => {
                const updated = { ...prev };
                delete updated[data.username];
                return updated;
            });
        });

        socket.on('messages_read', (data) => {
            setMessages(prev => prev.map(msg =>
                (msg.author === user.username && msg.room === data.reader) ? { ...msg, status: 'read' } : msg
            ));
        });

        // loadKey has been extracted to another useEffect

        return () => {
            socket.off('receive_message');
            socket.off('online_users');
            socket.off('user_typing');
            socket.off('user_stop_typing');
            socket.off('messages_read');
        };
    }, [user.username, currentRoom, privateKeyObj]);

    // Isolated key loader to prevent infinite render loops
    useEffect(() => {
        if (privateKey && !privateKeyObj) {
            importKey(privateKey, 'private')
                .then(key => setPrivateKeyObj(key))
                .catch(e => console.error("Failed to import private key", e));
        }
    }, [privateKey, privateKeyObj]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (overrideContent = null) => {
        const messageToSend = typeof overrideContent === 'string' ? overrideContent : newMessage;
        if (messageToSend.trim() === '' || !currentRoom) return;

        const recipientUsername = currentRoom;
        let recipientPublicKey = null;

        try {
            const res = await api.get(`/auth/key/${recipientUsername}`);
            if (res.data.publicKey) {
                recipientPublicKey = await importKey(res.data.publicKey, 'public');
            } else {
                alert("Cannot find public key for this user.");
                return;
            }
        } catch (e) {
            console.error("Failed to get recipient key", e);
            alert("Network error fetching user key.");
            return;
        }

        try {
            let senderPublicKeyImp = null;
            if (user.publicKey) {
                senderPublicKeyImp = await importKey(user.publicKey, 'public');
            }
            const encryptedData = await encryptMessage(messageToSend, recipientPublicKey, senderPublicKeyImp);

            const messageData = {
                room: currentRoom,
                author: user.username,
                encryptedData: encryptedData,
                isEncrypted: true,
                time: new Date().toLocaleTimeString(),
            };

            socket.emit('send_message', messageData);

            // Optimistic UI update: show local sent message immediately
            setMessages(prev => [...prev, {
                ...messageData,
                content: messageToSend,
                chatMate: currentRoom,
                status: 'sent'
            }]);

            if (!overrideContent || typeof overrideContent !== 'string') {
                setNewMessage('');
            }
            setShowEmojiPicker(false);

            socket.emit('stop_typing', { room: currentRoom, username: user.username });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        } catch (e) {
            console.error("Encryption failed:", e);
            alert("Encryption spell failed! Cannot send message.");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Limit to 2MB to prevent socket crash
        if (file.size > 2 * 1024 * 1024) {
            alert("File is too large! The magical winds can only carry up to 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            // Check if it's an image
            if (!file.type.startsWith('image/')) {
                alert("Only magical images are supported currently.");
                return;
            }
            handleSendMessage(reader.result); // send the base64 payload immediately
        };
        reader.readAsDataURL(file);
    };

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
    };

    const appendToMessage = (text) => {
        setNewMessage(prev => prev + text);
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!currentRoom) return;
        socket.emit('typing', { room: currentRoom, username: user.username });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', { room: currentRoom, username: user.username });
        }, 2000);
    };

    const displayedMessages = useMemo(() => messages.filter(m => m.chatMate === currentRoom), [messages, currentRoom]);

    useEffect(() => {
        if (currentRoom && displayedMessages.length > 0) {
            const unreadIds = displayedMessages
                .filter(m => m.author !== user.username && m.status !== 'read')
                .map(m => m._id);

            if (unreadIds.length > 0) {
                socket.emit('mark_read', { messageIds: unreadIds, room: currentRoom, reader: user.username });
                setMessages(prev => prev.map(msg =>
                    unreadIds.includes(msg._id) ? { ...msg, status: 'read' } : msg
                ));
            }
        }
    }, [currentRoom, displayedMessages.length]);

    // Painted petals falling slowly, extremely staggered to fall one by one
    const petalOrbs = useMemo(() => Array.from({ length: 5 }).map((_, i) => ({
        left: `${Math.random() * 80 + 10}%`,
        duration: `${Math.random() * 10 + 40}s`, // 40-50s fall time
        delay: `${i * 10 + Math.random() * 3}s`, // Every 10 seconds a new petal appears
        size: `${Math.random() * 15 + 15}px`,
        rotDuration: `${Math.random() * 8 + 6}s`
    })), []);

    return (
        <div className="flex h-screen bg-[#fbfaf5] text-[#2c1d11] overflow-hidden relative canvas-grain chat-screen">
            {/* ===== SIDEBAR (Solid background) ===== */}
            <div className={`bg-[#fbfaf5] border-r-2 border-[#e2d6c3]/40 flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.15)] transition-all duration-700 ${currentRoom ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80'}`}>
                <div className="h-32 px-8 border-b border-[#e2d6c3]/50 flex items-center justify-center relative shadow-inner overflow-hidden text-center z-10">
                    <img src="/login_bg.jpg" alt="Logo background" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none"></div>
                    <div className="relative z-10 pt-2">
                        <h1 className="font-spiritual font-black text-3xl tracking-[0.3em] text-white drop-shadow-md">
                            ENCHANTED
                        </h1>
                        <p className="font-mystic text-xl text-[#fce4da] -mt-1 italic drop-shadow-sm">The Gilded Sanctum</p>
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                    <div className="text-[11px] font-black text-white/80 uppercase tracking-[0.3em] mb-4 px-4 flex justify-between items-center bg-white/10 py-2 rounded-full border border-white/20 shadow-sm">
                        <span>Kindred Souls</span>
                        <span className="bg-[#e2b170] text-white py-1 px-4 rounded-full text-[10px] font-black shadow-lg animate-pulse">
                            {onlineUsers.filter(u => u !== user.username).length} Online
                        </span>
                    </div>
                    <div className="space-y-4">
                        {onlineUsers.filter(u => u !== user.username).length === 0 && (
                            <div className="text-center px-4 py-8 bg-white/60 rounded-[2rem] border border-[#e2d6c3]/60 shadow-sm mt-2 relative overflow-hidden">
                                <span className="text-3xl mb-3 block">🕊️</span>
                                <p className="text-[11px] font-black text-[#8d6e63] uppercase tracking-widest leading-loose">The realm is quiet...</p>
                                <p className="text-sm text-[#4a3728] mt-3 italic font-forest px-2 border-t border-[#e2d6c3]/50 pt-3">
                                    Open this URL in another window to summon a kin online and converse.
                                </p>
                            </div>
                        )}
                        {onlineUsers.filter(u => u !== user.username).map(u => (
                            <div
                                key={u}
                                onClick={() => setCurrentRoom(u)}
                                className={`group flex items-center px-6 py-5 rounded-[2.5rem] cursor-pointer transition-all duration-700 border-2 ${currentRoom === u ? 'bg-white border-[#e2b170] shadow-[0_20px_50px_rgba(226,177,112,0.3)] scale-[1.05]' : 'bg-white/30 border-transparent hover:bg-white/50 hover:scale-[1.02]'}`}
                            >
                                <div className="relative mr-5">
                                    <div className="w-14 h-14 rounded-full bg-[#fce4da] flex items-center justify-center text-3xl shadow-inner border-2 border-white group-hover:rotate-12 transition-all">
                                        {getChatMateAvatar(u)}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
                                </div>
                                <div className="flex-1">
                                    <div className={`font-forest font-black text-md ${currentRoom === u ? 'text-[#4a3728]' : 'text-[#8d6e63]'}`}>{u}</div>
                                    <div className="text-[11px] text-[#c4b5a2] font-bold italic tracking-wider opacity-80">Mixing colors...</div>
                                </div>
                                {unreadCounts[u] && (
                                    <span className="bg-[#f4abb4] text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-[0_10px_20px_rgba(244,171,180,0.5)] animate-bounce">
                                        {unreadCounts[u]}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-white/30 bg-white/30 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5 cursor-pointer group" onClick={() => setShowProfile(true)}>
                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl shadow-[0_15px_30px_rgba(0,0,0,0.05)] border-2 border-white group-hover:-rotate-6 transition-all border-b-8">
                                {getAvatarEmoji(user.avatar)}
                            </div>
                            <div>
                                <div className="text-md font-spiritual font-black text-[#4a3728] tracking-widest uppercase">{user.username}</div>
                                <div className="text-[11px] text-green-600 font-black flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg"></span>
                                    Enlightened
                                </div>
                            </div>
                        </div>
                        <button onClick={logout} className="p-4 rounded-2xl hover:bg-white text-[#c4b5a2] hover:text-[#f4abb4] transition-all border-2 border-transparent hover:border-white/50 shadow-sm hover:shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chat Area and Painting Realm (Right Side) */}
            <div className={`flex-1 flex-col relative z-10 overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${currentRoom ? 'flex' : 'hidden md:flex'}`}>

                {/* Full Painting Background - Only on the right side */}
                <div className="painting-realm-bg"></div>
                <div className="painting-realm-overlay"></div>

                {/* Floating Particles - SLOW Realistic Sakura Petals */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    {petalOrbs.map((p, i) => (
                        <div key={`petal-${i}`} className="sakura-petal-container" style={{
                            left: p.left,
                            animationDuration: p.duration,
                            animationDelay: p.delay,
                            width: `${parseFloat(p.size) * 0.8}px`,
                            height: `${parseFloat(p.size) * 0.8}px`,
                        }}>
                            <div className="sakura-petal-body" style={{
                                animationDuration: p.rotDuration,
                            }}></div>
                        </div>
                    ))}
                </div>

                {/* Active Chat UI */}
                <div className={`flex-1 flex flex-col relative z-20 overflow-hidden transition-all duration-700 ${currentRoom ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    {currentRoom && (
                        <>
                            <div className="h-20 md:h-24 px-4 md:px-10 clear-glass flex justify-between items-center z-20 border-b border-white/20">
                                <div className="flex items-center gap-3 md:gap-6">
                                    <button onClick={() => setCurrentRoom(null)} className="md:hidden text-white drop-shadow-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                        </svg>
                                    </button>
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#fce4da] flex items-center justify-center text-2xl md:text-3xl border-4 border-white shadow-[0_10px_25px_rgba(0,0,0,0.05)]">
                                        {getChatMateAvatar(currentRoom)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="font-forest font-black text-2xl text-white tracking-wider drop-shadow-md">{currentRoom}</div>
                                        <div className="text-[11px] text-green-600 font-black uppercase tracking-[0.3em] italic flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                            Sacred Resonance
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar-hidden relative">
                                {displayedMessages.map((msg, idx) => (
                                    <MessageItem 
                                        key={msg._id || idx} 
                                        msg={msg} 
                                        isMe={msg.author === user.username} 
                                    />
                                ))}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>

                            <div className="p-4 md:p-12 pt-0 z-20">

                                {showEmojiPicker && (
                                    <div className="absolute bottom-20 md:bottom-28 right-4 md:right-12 z-50">
                                        <EmojiPicker onEmojiClick={onEmojiClick} theme="auto" />
                                    </div>
                                )}

                                <div className="bg-white/20 border-2 border-white/40 rounded-[2rem] md:rounded-[4rem] flex items-center p-2 md:p-3 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md group relative transition-all duration-700 hover:shadow-[0_30px_80px_rgba(0,0,0,0.4)] md:hover:-translate-y-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button onClick={() => fileInputRef.current?.click()} className="hidden md:block text-2xl md:text-3xl opacity-70 hover:opacity-100 hover:scale-110 transition-all px-2 md:px-3 drop-shadow-md" title="Attach File">📎</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="text-2xl md:text-3xl opacity-70 hover:opacity-100 hover:scale-110 transition-all px-2 md:px-3 drop-shadow-md" title="Media">📷</button>
                                    <input
                                        className="flex-1 bg-transparent px-2 md:px-4 py-3 md:py-6 text-white placeholder-white/70 outline-none font-forest text-lg md:text-xl italic font-bold drop-shadow-sm min-w-0"
                                        placeholder="Brush your soul..."
                                        value={newMessage}
                                        onChange={handleTyping}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button onClick={() => appendToMessage('[📑 Sticker] ')} className="hidden md:block text-2xl md:text-3xl opacity-70 hover:opacity-100 hover:scale-110 transition-all px-2 md:px-4 drop-shadow-md" title="Stickers">📑</button>
                                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-2xl md:text-3xl opacity-70 hover:opacity-100 hover:scale-110 transition-all pr-2 md:pr-5 drop-shadow-md" title="Emojis">😊</button>
                                    <button
                                        className={`w-10 h-10 md:w-20 md:h-20 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${newMessage.trim() ? 'bg-gradient-to-r from-[#e2b170] to-[#e88d9a] text-white hover:rotate-12 hover:scale-110 active:scale-90 border-2 border-white/50' : 'bg-white/30 text-white/50 cursor-not-allowed border border-white/20'}`}
                                        onClick={() => handleSendMessage()}
                                        disabled={!newMessage.trim()}
                                    >
                                        <span className="text-xl md:text-3xl filter drop-shadow-lg leading-none">🖋️</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-[#3d2b1f]/40 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-sm bg-white/95 linen-card p-10 animate-scale-in antigravity-float border-4 border-white shadow-[0_50px_150px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col items-center mb-8">
                            <div className="relative mb-6">
                                <div className="absolute -inset-10 bg-[#e2b170] opacity-30 rounded-full blur-[60px] animate-pulse"></div>
                                <div className="relative w-28 h-28 bg-[#fce4da] rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner border-4 border-white rotate-3 group border-b-8 group-hover:rotate-0 transition-all">
                                    {getAvatarEmoji(user.avatar)}
                                </div>
                            </div>
                            <h2 className="font-spiritual text-2xl font-black text-[#4a3728] uppercase tracking-[0.4em] drop-shadow-sm">{user.username}</h2>
                            <p className="font-mystic text-xl text-[#e2b170] mt-1 italic">Eternal Kindred</p>
                        </div>
                        <div className="mb-10">
                            <h3 className="text-center font-black text-[10px] uppercase tracking-[0.5em] text-[#8d6e63] mb-6 opacity-60">Aspect Selection</h3>
                            <div className="grid grid-cols-4 gap-4 avatar-grid">
                                {FOREST_AVATARS.map(av => (
                                    <button
                                        key={av.id}
                                        onClick={() => updateAvatar(av.id)}
                                        className={`p-3 rounded-[1.5rem] border-[3px] transition-all duration-500 ${user.avatar === av.id ? 'bg-white border-[#e2b170] shadow-[0_15px_30px_rgba(226,177,112,0.4)] scale-110 z-10' : 'bg-white/40 border-transparent hover:border-white/80 hover:scale-105'}`}
                                    >
                                        <span className="text-2xl">{av.emoji}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowProfile(false)}
                            className="w-full py-4 rounded-full bg-[#4a3728] text-white font-spiritual font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all text-sm"
                        >
                            Seal Reflection
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const MessageItem = memo(({ msg, isMe }) => {
    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                <div className={`px-10 py-7 rounded-[3.5rem] text-[18px] leading-relaxed transition-all shadow-[0_15px_40px_rgba(0,0,0,0.15)] border border-white/20 ${isMe
                    ? 'bg-gradient-to-br from-[#e2b170] to-[#f4abb4] text-white rounded-br-none shadow-[0_20px_50px_rgba(226,177,112,0.5)]'
                    : 'bg-white/20 backdrop-blur-md border-white/40 text-white rounded-bl-none italic parchment-bubble drop-shadow-md'
                    }`}
                >
                    {msg.content?.startsWith('data:image/') ? (
                        <img src={msg.content} alt="Magical Artwork" className="max-w-[250px] rounded-xl shadow-lg border-2 border-white/30" />
                    ) : (
                        msg.content
                    )}
                </div>
                <div className={`mt-3 px-6 text-[11px] font-black text-white/70 tracking-[0.3em] uppercase drop-shadow-sm ${isMe ? 'text-right' : ''}`}>
                    {msg.time} {isMe && (msg.status === 'read' ? '✨✨' : '✨')}
                </div>
            </div>
        </div>
    );
});

export default Chat;
