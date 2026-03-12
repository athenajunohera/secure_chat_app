import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { generateKeyPair, exportKey, encryptPrivateKey, decryptPrivateKey } from '../utils/crypto';

// Setup axios defaults
const isProd = import.meta.env.PROD;
const RENDER_API = "https://enchanted-chat-api.onrender.com/api";
export const api = axios.create({
    baseURL: isProd ? (import.meta.env.VITE_API_URL || RENDER_API) : `http://${window.location.hostname}:5050/api`,
});

const AuthContext = createContext();

export const FOREST_AVATARS = [
    { id: 'spirit', emoji: '👻', name: 'Forest Spirit' },
    { id: 'druid', emoji: '🌿', name: 'Elder Druid' },
    { id: 'owl', emoji: '🦉', name: 'Mystic Owl' },
    { id: 'lotus', emoji: '🪷', name: 'Golden Lotus' },
    { id: 'moon', emoji: '🌙', name: 'Moon Weaver' },
    { id: 'deer', emoji: '🦌', name: 'Spirit Deer' },
    { id: 'firefly', emoji: '🎇', name: 'Ethereal Firefly' },
    { id: 'wolf', emoji: '🐺', name: 'Deep Wolf' }
];

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [privateKey, setPrivateKey] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            // Self-Healing Mechanism: If version mismatch, purge local state
            const currentVersion = "1.1";
            const savedVersion = localStorage.getItem('app_version');
            if (savedVersion !== currentVersion) {
                sessionStorage.clear();
                localStorage.setItem('app_version', currentVersion);
                console.log("Purification Ritual: Old version cleared.");
            }

            const storedUser = sessionStorage.getItem('user');
            const storedKey = sessionStorage.getItem('privateKey');
            const token = sessionStorage.getItem('token');

            if (storedUser && token && storedUser !== "undefined") {
                setUser(JSON.parse(storedUser));
                setPrivateKey(storedKey !== "null" ? storedKey : null);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
        } catch (err) {
            console.error("Auth init failed:", err);
            sessionStorage.clear(); // Clear potentially corrupted data
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (rawUsername, password) => {
        try {
            const username = rawUsername.toLowerCase().trim();
            const res = await api.post('/auth/login', { username, password });
            // Check if we have the private key for this user locally
            let storedKey = localStorage.getItem(`privateKey_${username}`);
            if (!storedKey) {
                // Fallback for older keys saved with original casing
                storedKey = localStorage.getItem(`privateKey_${rawUsername.trim()}`);
            }

            if (!storedKey) {
                // TRY SYNC: If no key locally, attempt to recovery it using the password
                const { encryptedPrivateKey } = res.data;
                if (encryptedPrivateKey) {
                    try {
                        // Use user's current password as the recovery key for the private key
                        storedKey = await decryptPrivateKey(encryptedPrivateKey, password, username);
                        localStorage.setItem(`privateKey_${username}`, storedKey);
                        console.log("Magical Sync: Key recovered from the Realm!");
                    } catch (err) {
                        console.warn("Key Recovery Failed. Password may have changed or backup is old.");
                    }
                }
            }

            if (!storedKey) {
                alert("CRITICAL WARNING: No private key found for this user on this browser! Due to End-to-End Encryption, you strictly won't be able to decrypt your incoming messages. If this is a test, please register a brand new user on this specific tab.");
            }

            const { token, publicKey, avatar: serverAvatar } = res.data;

            const userData = { username, publicKey, avatar: serverAvatar || 'spirit' };
            setUser(userData);
            setPrivateKey(storedKey);

            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(userData));
            if (storedKey) {
                sessionStorage.setItem('privateKey', storedKey); // Active key
            } else {
                sessionStorage.removeItem('privateKey');
            }

            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return { success: true };
        } catch (error) {
            console.error("Full Login Error:", error);
            let message = 'Login failed';

            if (!error.response) {
                message = "The Realm's gates are closed (Backend not reachable). Make sure your backend server is running in the terminal!";
            } else if (error.response.status === 503) {
                message = error.response.data.error || "The Realm is busy (Database is connecting). Please wait 10 seconds and try again.";
            } else {
                message = error.response.data.error || error.response.data.message || error.message;
            }

            alert(`Realm Access Error: ${message}`);
            return { success: false, message: message };
        }
    };

    const register = async (rawUsername, password, avatar = 'spirit') => {
        try {
            const username = rawUsername.toLowerCase().trim();
            // 1. Generate Keys
            const keyPair = await generateKeyPair();
            const publicKeyExported = await exportKey(keyPair.publicKey);
            const privateKeyExported = await exportKey(keyPair.privateKey);

            // 1b. Encrypt Private Key for Cloud Backup (Real App magic)
            const encryptedPrivateKey = await encryptPrivateKey(privateKeyExported, password, username);

            // 2. Send to Server
            await api.post('/auth/register', { 
                username, 
                password, 
                publicKey: publicKeyExported, 
                avatar,
                encryptedPrivateKey 
            });

            // 3. Store Private Key Locally (Associated with username)
            localStorage.setItem(`privateKey_${username}`, privateKeyExported);

            // 4. Auto-login after successful registration
            const loginRes = await api.post('/auth/login', { username, password });
            const { token, publicKey, avatar: finalAvatar } = loginRes.data;

            const userData = { username, publicKey, avatar: finalAvatar || avatar };
            setUser(userData);
            setPrivateKey(privateKeyExported);

            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(userData));
            sessionStorage.setItem('privateKey', privateKeyExported);

            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            return { success: true, autoLoggedIn: true };
        } catch (error) {
            console.error("Full Registration Error:", error);
            let message = 'Registration failed';

            if (!error.response) {
                message = "The Spell failed to reach the Realm (Backend not reachable). Check if your backend server crashed!";
            } else if (error.response.status === 503) {
                message = error.response.data.error || "The Realm is not yet ready (Database connection in progress). Try again in a few seconds.";
            } else {
                message = error.response.data.error || error.response.data.message || error.message;
            }

            alert(`Magical Binding Error: ${message}`);
            return { success: false, message: message };
        }
    };

    const logout = () => {
        setUser(null);
        setPrivateKey(null);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('privateKey');
        delete api.defaults.headers.common['Authorization'];
    };

    const updateAvatar = async (newAvatar) => {
        try {
            await api.post('/auth/update-avatar', { avatar: newAvatar });
            const updatedUser = { ...user, avatar: newAvatar };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            return { success: true };
        } catch (error) {
            console.error("Avatar update failed:", error);
            return { success: false };
        }
    };

    return (
        <AuthContext.Provider value={{ user, privateKey, login, register, logout, updateAvatar, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
