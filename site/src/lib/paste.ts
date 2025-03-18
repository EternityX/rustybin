import { decryptData, encryptData, generateEncryptionKey } from "./enc";
import { z } from "zod";

const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.rustybin.net/v1"
    : "http://127.0.0.1:3001/v1";

// Zod schemas for validation
const PasteSchema = z.object({
  id: z.string().min(1),
  data: z.string(),
  language: z.string().default("plaintext"),
  createdAt: z.number().default(() => Date.now()),
});

// More flexible API response schema
const ApiPasteResponseSchema = z.object({
  // id must be a string
  id: z.string().min(1),

  // data must be a string
  data: z.string(),

  // language can be a string or null/undefined (defaults to plaintext)
  language: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => val || "plaintext"),

  // created_at can be a number, ISO date string, or missing (defaults to current time)
  created_at: z
    .union([
      z.number(),
      z.string().transform((val) => {
        // Try parsing as ISO date string first
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }

        // Fall back to parseInt if it's not a valid date
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? Date.now() : parsed;
      }),
      z.null(),
      z.undefined(),
    ])
    .default(() => Date.now()),

  // encryption_version can be anything or missing
  encryption_version: z.any().optional(),
});

// TypeScript types derived from Zod schemas
type Paste = z.infer<typeof PasteSchema>;
type ApiPasteResponse = z.infer<typeof ApiPasteResponseSchema>;

// Partial paste type for creating/updating
type PartialPaste = Omit<Paste, "id" | "createdAt">;

function apiResponseToPaste(response: unknown): Paste {
  try {
    // Log the raw response for debugging
    console.log("Processing API response:", JSON.stringify(response, null, 2));

    if (!response || typeof response !== "object") {
      console.error("API response is not an object:", response);
      throw new Error("Invalid API response: not an object");
    }

    // Parse and validate the API response
    try {
      const validatedResponse = ApiPasteResponseSchema.parse(response);

      // Convert to Paste format
      return {
        id: validatedResponse.id,
        data: validatedResponse.data,
        language: validatedResponse.language,
        createdAt: validatedResponse.created_at,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("API response validation failed:", error.format());

        // Log detailed information about each field
        const resp = response as Record<string, unknown>;
        console.error("Field details:", {
          id: { value: resp.id, type: typeof resp.id },
          data: { value: resp.data, type: typeof resp.data },
          language: { value: resp.language, type: typeof resp.language },
          created_at: { value: resp.created_at, type: typeof resp.created_at },
          encryption_version: {
            value: resp.encryption_version,
            type: typeof resp.encryption_version,
          },
        });

        throw new Error(
          `Invalid API response: ${error.errors
            .map((e) => e.message)
            .join(", ")}`
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error processing API response:", error);
    throw error;
  }
}

// Helper function to parse various date formats
function parseDate(dateValue: unknown): number {
  console.log("Parsing date value:", dateValue, "of type:", typeof dateValue);

  if (typeof dateValue === "number") {
    console.log("Date is already a number:", dateValue);
    return dateValue;
  }

  if (typeof dateValue === "string") {
    // Try parsing as ISO date string first
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const timestamp = date.getTime();
      console.log(
        "Successfully parsed ISO date string:",
        dateValue,
        "to timestamp:",
        timestamp
      );
      return timestamp;
    }

    // Fall back to parseInt
    const parsed = parseInt(dateValue, 10);
    if (!isNaN(parsed)) {
      console.log("Parsed string as integer:", parsed);
      return parsed;
    }

    console.log("Failed to parse date string, using current time");
    return Date.now();
  }

  console.log("Unknown date format, using current time");
  return Date.now();
}

export async function createPaste(paste: PartialPaste) {
  try {
    // Validate the paste data
    const validatedPaste = z
      .object({
        data: z.string().min(1, "Paste content cannot be empty"),
        language: z.string().default("plaintext"),
      })
      .parse(paste);

    const key = await generateEncryptionKey();

    const encryptedPaste = await encryptPaste(validatedPaste, key);

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/pastes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(encryptedPaste),
      });
    } catch (networkError) {
      console.error("Network error during paste creation:", networkError);
      throw new Error(
        "Network error: Could not connect to the server. Please check your internet connection."
      );
    }

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.message ||
          errorData.error ||
          `Failed to create paste: ${response.status}`;
      } catch (jsonError) {
        errorMessage = `Failed to create paste: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("Error parsing API response:", jsonError);
      throw new Error("Invalid JSON response from server");
    }

    // Log the raw API response for debugging
    console.log("Create Paste API Response:", JSON.stringify(data, null, 2));
    console.log("Response data types:", {
      id: typeof data.id,
      data: typeof data.data,
      language: typeof data.language,
      created_at: typeof data.created_at,
      encryption_version: typeof data.encryption_version,
    });

    // Validate the minimum required fields manually before trying Zod
    if (!data || typeof data !== "object") {
      throw new Error("Invalid API response: not an object");
    }

    if (!data.id || typeof data.id !== "string") {
      throw new Error("Invalid API response: missing or invalid id");
    }

    let convertedPaste: Paste;
    try {
      convertedPaste = apiResponseToPaste(data);
    } catch (error) {
      console.error("Failed to validate API response, using fallback:", error);

      convertedPaste = {
        id: data.id,
        data: typeof data.data === "string" ? data.data : "",
        language:
          typeof data.language === "string" ? data.language : "plaintext",
        createdAt: parseDate(data.created_at),
      };
    }

    return generateUrlWithKey(convertedPaste.id, key);
  } catch (error) {
    console.error("Error creating paste:", error);
    throw error;
  }
}

export async function getPaste(id: string, key: string): Promise<Paste | null> {
  // Validate inputs with Zod
  try {
    const validatedInputs = z
      .object({
        id: z.string().min(1, "Paste ID is required"),
        key: z.string().min(10, "Decryption key is too short"),
      })
      .parse({ id, key });

    id = validatedInputs.id;
    key = validatedInputs.key;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Input validation failed:", error.format());
      return null;
    }
    return null;
  }

  try {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/pastes/${id}`);
    } catch (networkError) {
      console.error("Network error during paste retrieval:", networkError);
      throw new Error(
        "Network error: Could not connect to the server. Please check your internet connection."
      );
    }

    if (response.status === 404) {
      console.log(`Paste with ID ${id} not found`);
      return null;
    }

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.message ||
          `Failed to get paste: ${response.status}`;
      } catch (jsonError) {
        errorMessage = `Failed to get paste: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("Error parsing API response:", jsonError);
      return null;
    }

    if (!data || typeof data !== "object") {
      console.error("Invalid API response: not an object");
      return null;
    }

    // Log the raw API response for debugging
    console.log("Get Paste API Response:", JSON.stringify(data, null, 2));
    console.log("Response data types:", {
      id: typeof data.id,
      data: typeof data.data,
      language: typeof data.language,
      created_at: typeof data.created_at,
      encryption_version: typeof data.encryption_version,
    });

    // Validate the minimum required fields manually
    if (!data.id || typeof data.id !== "string") {
      console.error("Invalid API response: missing or invalid id");
      return null;
    }

    if (
      data.data === undefined ||
      data.data === null ||
      typeof data.data !== "string"
    ) {
      console.error("Invalid API response: missing or invalid data");
      return null;
    }

    // Validate the API response with Zod
    let paste: Paste;
    try {
      paste = apiResponseToPaste(data);
    } catch (error) {
      console.error("Failed to validate API response, using fallback:", error);

      paste = {
        id: data.id,
        data: data.data,
        language:
          typeof data.language === "string" ? data.language : "plaintext",
        createdAt: parseDate(data.created_at),
      };
    }

    try {
      const decryptedPaste = await decryptPaste(paste, key);
      return {
        ...decryptedPaste,
        id: paste.id,
        createdAt: paste.createdAt,
      };
    } catch (error) {
      console.error("Error decrypting paste:", error);
      return null;
    }
  } catch (error) {
    console.error("Error fetching paste:", error);
    return null;
  }
}

export async function encryptPaste(
  paste: PartialPaste,
  keyString: string
): Promise<PartialPaste> {
  try {
    // Validate the paste and key with Zod
    const validatedData = z
      .object({
        paste: z.object({
          data: z.string().min(1, "Paste data cannot be empty"),
          language: z.string().default("plaintext"),
        }),
        key: z.string().min(10, "Encryption key is too short"),
      })
      .parse({ paste, key: keyString });

    const encryptedData = await encryptData(
      validatedData.paste.data,
      validatedData.key
    );

    return {
      data: encryptedData,
      language: validatedData.paste.language,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error during encryption:", error.format());
      throw new Error(
        `Invalid data for encryption: ${error.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }
    throw error;
  }
}

export function generateUrlWithKey(url: string, key: string): string {
  console.log("Generating URL with key");

  try {
    // Validate inputs with Zod
    const validatedInputs = z
      .object({
        url: z.string().min(1, "URL cannot be empty"),
        key: z.string().min(10, "Key is too short"),
      })
      .parse({ url, key });

    url = validatedInputs.url;
    key = validatedInputs.key;

    console.log("Base URL:", url);
    console.log("Key length:", key.length);
    console.log(
      "Original key (first few chars):",
      key.substring(0, 10) + "..."
    );

    // Convert from standard base64 to base64url
    // (replace '+' with '-', '/' with '_', and remove '=')
    const base64urlKey = key
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    console.log("Base64url key length:", base64urlKey.length);
    console.log(
      "Base64url key (first few chars):",
      base64urlKey.substring(0, 10) + "..."
    );

    // Encode the key to make it URL-safe
    const encodedKey = encodeURIComponent(base64urlKey);
    console.log("Encoded key length:", encodedKey.length);

    const fullUrl = `${url}#${encodedKey}`;
    console.log("Generated URL length:", fullUrl.length);
    console.log("Full URL:", fullUrl);

    return fullUrl;
  } catch (error) {
    console.error("Error generating URL with key:", error);
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid URL or key: ${error.errors.map((e) => e.message).join(", ")}`
      );
    }
    // Fallback to simple concatenation if encoding fails
    return `${url}#${key}`;
  }
}

export async function decryptPaste(
  encryptedPaste: PartialPaste,
  keyString: string
): Promise<PartialPaste> {
  try {
    // Validate inputs with Zod
    const validatedData = z
      .object({
        paste: z.object({
          data: z.string().min(1, "Encrypted data cannot be empty"),
          language: z.string().default("plaintext"),
        }),
        key: z
          .string()
          .min(10, "Decryption key is too short")
          .regex(/^[A-Za-z0-9+/=]+$/, "Invalid key format - not valid base64"),
      })
      .parse({
        paste: {
          data: encryptedPaste.data,
          language: encryptedPaste.language,
        },
        key: keyString,
      });

    const validatedPaste = validatedData.paste;
    const validatedKey = validatedData.key;

    console.log("Starting paste decryption");
    console.log("Key length:", validatedKey.length);
    console.log("Data length:", validatedPaste.data.length);

    let data: string;

    try {
      console.log("Decrypting data...");
      data = await decryptData(validatedPaste.data, validatedKey);
      console.log("Data decrypted successfully, length:", data.length);
    } catch (error) {
      console.error("Data decryption error:", error);
      throw new Error(
        `Failed to decrypt data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    console.log("Paste decryption completed successfully");
    return {
      data,
      language: validatedPaste.language,
    };
  } catch (error) {
    console.error("Paste decryption error:", error);
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid paste or key: ${error.errors.map((e) => e.message).join(", ")}`
      );
    }
    throw error;
  }
}

export function extractKeyFromUrl(): string | null {
  // Log the raw URL before any processing
  console.log("Raw URL for extraction:", window.location.href);

  try {
    const url = new URL(window.location.href);
    console.log("URL for key extraction:", url.toString());
    console.log("URL hash:", url.hash);

    // If hash is empty, return null
    if (!url.hash || url.hash === "#") {
      console.log("No hash found in URL or hash is empty");
      return null;
    }

    // Remove the # character and decode the key
    const encodedKey = url.hash.substring(1);

    if (!encodedKey || encodedKey.trim() === "") {
      console.log("Empty key after hash");
      return null;
    }

    try {
      // First decode the URI component, then convert from base64url to base64
      const decodedKey = decodeURIComponent(encodedKey);
      console.log("Decoded URI component length:", decodedKey.length);

      // Validate the decoded key with Zod
      try {
        z.string().min(10, "Key is too short").parse(decodedKey);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Key validation failed:", error.format());
          return null;
        }
      }

      // Convert from base64url to standard base64 if needed
      // (replace '-' with '+' and '_' with '/')
      let standardBase64 = decodedKey.replace(/-/g, "+").replace(/_/g, "/");

      // Add padding if needed
      // Base64 strings should have a length that is a multiple of 4
      const paddingNeeded = standardBase64.length % 4;
      if (paddingNeeded > 0) {
        standardBase64 += "=".repeat(4 - paddingNeeded);
        console.log("Added padding to base64 string");
      }

      console.log("Encoded key length:", encodedKey.length);
      console.log("Decoded key length:", standardBase64.length);

      if (standardBase64.length < 10) {
        console.log("Key is too short to be valid");
        return null;
      }

      console.log(
        "First few chars of key:",
        standardBase64.substring(0, 10) + "..."
      );

      // Validate the final key format
      try {
        z.string()
          .min(10, "Key is too short")
          .regex(/^[A-Za-z0-9+/=]+$/, "Invalid key format - not valid base64")
          .parse(standardBase64);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Final key validation failed:", error.format());
          return null;
        }
      }

      // Remove the key from the URL to keep it out of browser history
      // window.history.replaceState(null, "", url.pathname + url.search);
      console.log("Key extracted successfully");

      return standardBase64;
    } catch (error) {
      console.error("Error decoding key from URL:", error);
      return null;
    }
  } catch (error) {
    console.error("Error parsing URL:", error);
    return null;
  }
}
