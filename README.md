# ToolNet API

**ToolNet API** is a powerful AI router and token saver designed to sit between your favorite AI coding tools (Claude Code, Cursor, OpenCode, Cline, etc.) and AI providers (OpenAI, Anthropic, Gemini, etc.).

By automatically compressing tool results and intelligently routing requests, ToolNet API saves tokens and ensures high availability via fallback mechanisms.

[![npm version](https://img.shields.io/npm/v/toolnetapi.svg)](https://www.npmjs.com/package/toolnetapi)
[![Docker Pulls](https://img.shields.io/docker/pulls/toolnet/toolnetapi.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/toolnet/toolnetapi)
[![License](https://img.shields.io/npm/l/toolnetapi.svg)](https://github.com/LBT-AI/toolnetapi/blob/main/LICENSE)

## ⚡ Quick Start

### 1. Install & Run

Install globally via npm:
```bash
npm install -g toolnetapi
toolnetapi
```
*The Dashboard will open at `http://localhost:20127`.*

Alternatively, run from source:
```bash
git clone https://github.com/LBT-AI/toolnetapi.git
cd toolnetapi
npm install
./start-all.sh
```

### 2. Configure Your AI Tool

Point your AI assistant (e.g. Claude Code, Cursor, OpenClaw) to the local proxy:

- **Endpoint:** `http://localhost:20127/v1`
- **API Key:** *(Copy from your ToolNet API Dashboard)*

## 💡 Key Features

- **RTK Token Saver:** Automatically minifies tool outputs (like `git diff`, `ls`, `grep`) to save 20-40% of context tokens.
- **Smart Routing & Fallback:** Automatically switches to alternative models (Subscription → Cheap → Free) if your primary provider is rate-limited or exhausted.
- **Multi-account Load Balancing:** Add multiple API keys for the same provider and ToolNet API will round-robin between them to prevent rate limits.
- **Universal Compatibility:** Exposes an OpenAI-compatible `/v1` API, making it plug-and-play with almost any AI CLI or IDE.
- **Interactive TUI:** Comes with a beautiful, Termius-friendly Terminal User Interface (TUI) for quick model switching and request monitoring.

## 🐳 Docker Deployment

```bash
docker run -d \
  --name toolnetapi \
  -p 20127:20127 \
  -v "$HOME/.toolnetapi:/app/data" \
  -e DATA_DIR=/app/data \
  toolnet/toolnetapi:latest
```

## 🛠 Configuration

Default environment variables (can be set in `.env`):

- `PORT`: `20127`
- `HOSTNAME`: `0.0.0.0`
- `DATA_DIR`: `~/.toolnetapi`

## 📄 License

This project is licensed under the MIT License.
