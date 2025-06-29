# <img src="https://raw.githubusercontent.com/EternityX/rustybin/3ffa9b32aa8d5e5d5178ff7ee82ba288b440e9dc/site/public/favicon.svg" width="40" height="30"> [RustyBin](https://rustybin.net)

A modern, secure pastebin service built with Rust and React. RustyBin allows you to create, view, and share text snippets with optional syntax highlighting and encryption.

## Features

- **Secure Text Sharing**: Create and share encrypted text snippets
- **Syntax Highlighting**: Support for multiple programming languages using Prism
- **Modern UI**: Built with React and TypeScript
- **RESTful API**: API for creating, retrieving, and deleting pastes
- **SQLite Database**: Lightweight, file-based database for storing pastes
- **End-to-End Encryption**: Client-side encryption for sensitive data, server has no knowledge of the paste contents

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
| `DELETE_RATE_LIMIT`    | Delete operations per minute per IP             | `15`                                                                  |
| `RUST_LOG`             | Logging level (error, warn, info, debug, trace) | `info`                                                                |

**Example .env file:**

```env
PORT=3000
RUST_ENV=development
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:5173,http://localhost:8080
READ_RATE_LIMIT=45
CREATE_RATE_LIMIT=15
DELETE_RATE_LIMIT=15
RUST_LOG=info
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
   VITE_API_URL=http://127.0.0.1:3000/v1

   # For production
   # VITE_API_URL=https://yourdomain.com/v1
   ```

   **Note**: Make sure the port in `VITE_API_URL` matches the port your Rust backend is running on (configured in the backend's `.env` file).

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

The frontend development server will start on http://localhost:5173.

## API Endpoints

- `POST /api/pastes` - Create a new paste
- `GET /api/pastes/:id` - Get a specific paste
- `DELETE /api/pastes/:id` - Delete a paste

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

## CloudFlare

Please see the `site/DEPLOYMENT.md` to deploy on CloudFlare pages.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
