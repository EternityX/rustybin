export async function generateEncryptionKey(): Promise<string> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedKey = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
}

async function importKey(key: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));

  return window.crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(
  data: string,
  keyString: string
): Promise<string> {
  const key = await importKey(keyString);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate a random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encryptedBuffer), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

export async function decryptData(
  encryptedData: string,
  keyString: string
): Promise<string> {
  try {
    // Validate inputs
    if (!encryptedData || !keyString) {
      throw new Error("Missing encrypted data or key");
    }

    // Check if the encrypted data is long enough to contain an IV (12 bytes) plus some data
    // Base64 encoding increases size by ~33%, so we need at least ~16 chars for IV plus some data
    if (encryptedData.length < 20) {
      throw new Error("Encrypted data is too short to be valid");
    }

    // Validate base64 format with a regex check
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptedData)) {
      throw new Error("Invalid base64 format in encrypted data");
    }

    const key = await importKey(keyString);

    // Convert from base64 to array buffer
    let encryptedBytes;
    try {
      encryptedBytes = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );
    } catch (error) {
      throw new Error("Invalid base64 data format");
    }

    // Check if we have enough data for IV and ciphertext
    if (encryptedBytes.length <= 12) {
      throw new Error(
        "Encrypted data is too small to contain both IV and ciphertext"
      );
    }

    // Extract IV (first 12 bytes)
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);

    // Attempt to decrypt
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
        },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      if (error instanceof DOMException && error.name === "OperationError") {
        throw new Error("Decryption failed: Invalid key or corrupted data");
      }
      throw error;
    }
  } catch (error) {
    console.error("Decryption error:", error);
    throw error;
  }
}
