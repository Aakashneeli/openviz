# OpenViz Project Setup Guide

This guide details how to set up, install, and run the OpenViz project from scratch.

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: Version 20.0.0 or higher (Run `node -v` to check)
- **npm**: Included with Node.js
- **Git**: For version control

## 2. Installation

1.  **Clone the Repository** (if not already cloned):
    ```bash
    git clone <repository-url>
    cd openviz
    ```

2.  **Install Dependencies**:
    We have a convenience script in the root directory to install frontend dependencies.
    ```bash
    npm run install:all
    ```
    *Alternatively, you can manually install:*
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## 3. Environment Configuration

The application requires a Groq API Key for its AI features.

1.  Create a `.env` file in the **root** folder (or inside `frontend/` if preferred, but root is typical for shared config).
    *Note: The project configuration expects the env file where Vite runs. Since we run Vite from `frontend/`, create the `.env` file in `frontend/.env`.*

    **Create file: `frontend/.env`**

2.  Add your API Key:
    ```env
    VITE_GROQ_API_KEY=your_actual_api_key_here
    VITE_AI_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
    ```

    > **Note**: You can get an API key from [Groq Cloud Console](https://console.groq.com/).

## 4. Running the Project

Start the development server from the root directory:

```bash
npm run dev
```

This will:
- Start the Vite dev server
- Open the app at `http://localhost:5173` (typically)

## 5. Building for Production

To create a production build:

```bash
npm run build
```

The output will be in `frontend/dist/`.

## 6. Project Structure Overview

- **`frontend/`**: The main React application.
- **`backend/`**: Contains shared logic/services (bundled into the frontend, NOT a separate server).
- **`package.json`**: Root scripts to manage the workspace.

## 7. Troubleshooting

- **"Vite not found"**: Ensure you ran `npm run install:all` or `npm install` inside the `frontend` directory.
- **AI features not working**: Check your browser console. If you see 401/403 errors, verify your `VITE_GROQ_API_KEY` in `frontend/.env`.
- **Port Conflict**: If port 5173 is busy, Vite will automatically try the next available port (e.g., 5174). Check the terminal output for the correct URL.
