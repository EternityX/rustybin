# <img src="https://raw.githubusercontent.com/EternityX/rustybin/3ffa9b32aa8d5e5d5178ff7ee82ba288b440e9dc/site/public/favicon.svg" width="40" height="30"> [](https://rustyb.in)

A modern, secure pastebin service built with Rust and React. Rustybin allows you to create, view, and share text snippets with automatic syntax highlighting.

## Features

### Core
- **End-to-End Encryption**: Client-side AES-GCM encryption - the server never sees your paste contents
- **Zero-Knowledge Architecture**: Decryption keys stay in the URL fragment (#) and are never sent to the server
- **Syntax Highlighting**: Support for 30+ programming languages using Prism
- **Auto Language Detection**: Automatically detects the programming language as you type
- **RESTful API**: Full API for creating, retrieving, updating, and deleting pastes
- **SQLite Database**: Lightweight, file-based database for storing encrypted pastes
- **Modern Design**: Clean, dark-themed UI built with React, TypeScript, and Tailwind CSS
- **Workspaces**: Create workspaces that allow you to store multiple pastes in a single URL

### Advanced Mode
Enable advanced options when creating a paste:
- **Burn After Read**: Paste is automatically deleted after being viewed once
- **Expiration**: Set pastes to auto-delete after a specified time (5 min to 1 week)
- **Edit Keys**: Get a separate editable URL to make changes while sharing a read-only link
- **Quantum-resistant**: Protect your pastes from potential future quantum computing attacks

## Getting Started

### Prerequisites

- Rust (latest stable)
- Node.js (v18+)
- pnpm

### Backend Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/EternityX/rustybin.git
   cd rustybin
   ```

2. (Optional) Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build and run the Rust backend:
   ```bash
   cargo run
   ```

The backend server will start on http://localhost:3000 (or the port specified in your .env file).

#### Backend Environment Variables

The backend can be configured using the following environment variables:

| Variable               | Description                                     | Default                                                               |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `PORT`                 | Server port                                     | `3000`                                                                |
| `RUST_ENV`             | Environment mode                                | `development`                                                         |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins    | `https://rustybin.net,http://localhost:8080,https://api.rustybin.net` |
| `READ_RATE_LIMIT`      | Read operations per minute per IP               | `45`                                                                  |
| `CREATE_RATE_LIMIT`    | Create operations per minute per IP             | `15`                                                                  |
| `UPDATE_RATE_LIMIT`    | Update operations per minute per IP             | `15`                                                                  |
| `DELETE_RATE_LIMIT`    | Delete operations per minute per IP             | `15`                                                                  |
| `RUST_LOG`             | Logging level (error, warn, info, debug, trace) | `info`                                                                |

**Example .env file:**

```env
PORT=3000
RUST_ENV=development
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
READ_RATE_LIMIT=45
CREATE_RATE_LIMIT=15
UPDATE_RATE_LIMIT=15
DELETE_RATE_LIMIT=15
RUST_LOG=info
ADMIN_SECRET=your_secret
```

**CORS Configuration:**
To allow your frontend to connect to the backend, make sure to include your frontend's URL in the `CORS_ALLOWED_ORIGINS` environment variable. For local development, this typically includes `http://localhost:5173` (Vite's default port) or whichever port your frontend runs on.

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd site
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   The `.env` file should contain:

   ```env
   # For development - update the port to match your backend configuration
   VITE_API_URL=http://localhost:3000/v1

   # For production
   # VITE_API_URL=https://yourdomain.com/v1
   ```

   **Note**: Make sure the port in `VITE_API_URL` matches the port your Rust backend is running on (configured in the backend's `.env` file) and the port has been changed in `vite.config.ts`.

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

The frontend development server will start on http://localhost:3000.

## API Endpoints

All endpoints are prefixed with `/v1`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/health` | Health check |
| `POST` | `/v1/pastes` | Create a new paste |
| `GET` | `/v1/pastes/:id` | Get a specific paste |
| `PUT` | `/v1/pastes/:id` | Update a paste (requires edit key) |
| `DELETE` | `/v1/pastes/:id` | Delete a paste (requires edit key) |

### Request/Response Details

**Create Paste (`POST /v1/pastes`)**
```json
{
  "data": "encrypted_content",
  "language": "javascript",
  "burn_after_read": false,
  "expires_in_minutes": null
}
```

> **Note**: The `data` field must contain **AES-256-GCM encrypted content**, not plaintext. 
> The encryption happens client-side, and the server never sees your unencrypted data.
> 
> **See [API_ENCRYPTION.md](API_ENCRYPTION.md)** for detailed encryption instructions and working examples in Python and JavaScript.

**Update/Delete** requires an `edit_key` in the request body for authorization.

### Rate Limiting

All endpoints include rate limit headers:
- `x-ratelimit-remaining`: Requests remaining in the current window
- `x-ratelimit-reset`: Seconds until the rate limit resets

## Deployment

### Backend

Build the Rust application for production:

```bash
cargo build --release
```

### Frontend

Build the React application for production:

```bash
cd site
pnpm build
```

The built files will be in the `site/dist` directory, which can be served by the Rust backend.

## Cloudflare

Please see the `site/DEPLOYMENT.md` to deploy on Cloudflare pages.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
