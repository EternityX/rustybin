# [RustyBin](https://rustybin.net)

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

2. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build and run the Rust backend:
   ```bash
   cargo run
   ```

The backend server will start on http://localhost:3000 (or the port specified in your .env file).

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd site
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:
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
