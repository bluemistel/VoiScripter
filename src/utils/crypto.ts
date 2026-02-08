/**
 * Cryptographic utilities for E2EE data synchronization
 * Uses Web Crypto API (PBKDF2 + AES-GCM)
 */

/**
 * Derive an AES-GCM key from a password using PBKDF2
 * @param password User-provided password
 * @param salt Random salt (16 bytes)
 * @returns CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveKey(
    password: string,
    salt: Uint8Array
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 600000, // OWASP recommendation (2023)
            hash: 'SHA-256',
        } as Pbkdf2Params,
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Hybrid Base64 conversion for optimal performance and security
 * Uses Chunking for < 512KB (pure memory, no disk swap risk)
 * Uses Blob for >= 512KB (native speed, avoid UI freeze)
 */
async function uint8ArrayToBase64(arr: Uint8Array): Promise<string> {
    const THRESHOLD = 512 * 1024; // 512KB

    if (arr.byteLength < THRESHOLD) {
        // Method 3: Chunking (Synchronous logic)
        const CHUNK_SIZE = 0x8000; // 32KB chunks
        let binary = '';
        for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
            binary += String.fromCharCode(...arr.subarray(i, i + CHUNK_SIZE));
        }
        return btoa(binary);
    } else {
        // Method 4: Blob/FileReader (Native Asynchronous)
        return new Promise((resolve, reject) => {
            const blob = new Blob([arr]);
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result as string;
                // Extract Base64 part from "data:...;base64,XXXX"
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('Base64 変換に失敗しました'));
            reader.readAsDataURL(blob);
        });
    }
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encrypt plaintext using AES-GCM
 * @param plaintext Text to encrypt
 * @param password User password
 * @returns Base64-encoded encrypted data (salt + nonce + ciphertext)
 */
export async function encrypt(
    plaintext: string,
    password: string
): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nonce = crypto.getRandomValues(new Uint8Array(12)); // GCM nonce (96 bits)
    const key = await deriveKey(password, salt);

    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        encoder.encode(plaintext)
    );

    // Combine: Salt (16) + Nonce (12) + Ciphertext
    const combined = new Uint8Array(
        salt.length + nonce.length + encrypted.byteLength
    );
    combined.set(salt, 0);
    combined.set(nonce, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + nonce.length);

    return await uint8ArrayToBase64(combined);
}

/**
 * Decrypt AES-GCM ciphertext
 * @param base64Ciphertext Base64-encoded encrypted data
 * @param password User password
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export async function decrypt(
    base64Ciphertext: string,
    password: string
): Promise<string> {
    try {
        const bytes = base64ToUint8Array(base64Ciphertext);

        const salt = bytes.slice(0, 16);
        const nonce = bytes.slice(16, 28);
        const ciphertext = bytes.slice(28);

        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce } as AesGcmParams,
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        throw new Error(
            '復号に失敗しました。パスワードが間違っているか、データが破損しています。'
        );
    }
}
