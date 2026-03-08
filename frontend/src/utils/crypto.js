// Utility to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Utility to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
    return keyPair;
}

export async function exportKey(key) {
    const exported = await window.crypto.subtle.exportKey(
        key.type === "public" ? "spki" : "pkcs8",
        key
    );
    return arrayBufferToBase64(exported);
}

export async function importKey(keyData, type) {
    return await window.crypto.subtle.importKey(
        type === "public" ? "spki" : "pkcs8",
        base64ToArrayBuffer(keyData),
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        [type === "public" ? "encrypt" : "decrypt"]
    );
}

// Encrypts message: AES-GCM for content, RSA-OAEP for AES key
export async function encryptMessage(message, recipientPublicKey, senderPublicKey = null) {
    // 1. Generate AES Key
    const aesKey = await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );

    // 2. Encrypt Message with AES
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedMessage = new TextEncoder().encode(message);

    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        aesKey,
        encodedMessage
    );

    // 3. Export AES Key (raw format) to encrypt it with RSA
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 4. Encrypt AES Key with Recipient's Public Key
    const encryptedAesKey = await window.crypto.subtle.encrypt(
        {
            name: "RSA-OAEP",
        },
        recipientPublicKey,
        rawAesKey
    );

    // 5. Encrypt AES Key with Sender's Public Key (so they can read their own history)
    let encryptedKeyForSender = null;
    if (senderPublicKey) {
        const encryptedAesKeySender = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            senderPublicKey,
            rawAesKey
        );
        encryptedKeyForSender = arrayBufferToBase64(encryptedAesKeySender);
    }

    return {
        iv: arrayBufferToBase64(iv),
        encryptedContent: arrayBufferToBase64(encryptedContent),
        encryptedKey: arrayBufferToBase64(encryptedAesKey),
        encryptedKeyForSender: encryptedKeyForSender
    };
}

export async function decryptMessage(packageData, privateKey, isSender = false) {
    try {
        const { iv, encryptedContent, encryptedKey, encryptedKeyForSender } = packageData;

        // Determine which encrypted AES key to decrypt based on who is reading
        const targetEncryptedKey = (isSender && encryptedKeyForSender) ? encryptedKeyForSender : encryptedKey;

        // 1. Decrypt AES Key with Private Key
        const rawAesKey = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP",
            },
            privateKey,
            base64ToArrayBuffer(targetEncryptedKey)
        );

        // 2. Import AES Key
        const aesKey = await window.crypto.subtle.importKey(
            "raw",
            rawAesKey,
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );

        // 3. Decrypt Content
        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64ToArrayBuffer(iv),
            },
            aesKey,
            base64ToArrayBuffer(encryptedContent)
        );

        return new TextDecoder().decode(decryptedContent);
    } catch (error) {
        console.error("Decryption failed:", error);
        return "[Decryption Failed]";
    }
}
