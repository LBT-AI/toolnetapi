<div align="center">
  <img src="./images/ToolnetAPI.png?1" alt="ToolNet API" width="800"/>
  
  # ToolNet API
  
  **The ultimate AI proxy router & token saver for modern developers.**

  [![npm version](https://img.shields.io/npm/v/toolnetapi.svg?color=blue&style=flat-square)](https://www.npmjs.com/package/toolnetapi)
  [![Docker Pulls](https://img.shields.io/docker/pulls/toolnet/toolnetapi.svg?logo=docker&style=flat-square)](https://hub.docker.com/r/toolnet/toolnetapi)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://github.com/LBT-AI/toolnetapi/blob/main/LICENSE)
</div>

---

## ⚡ Introduction

**ToolNet API** is a high-performance middleware designed to sit between your AI coding assistants (such as Claude Code, Cursor, OpenCode, Cline) and various AI providers. It helps you save money, bypass rate limits, and streamline your workflow with advanced token compression.

### Why use ToolNet API?
- **Cost Efficiency:** Saves 20-40% of context tokens by automatically compressing verbose tool outputs (e.g., `git diff`, `ls`).
- **Zero Downtime:** Features intelligent routing with automatic fallback (Subscription → Cheap → Free).
- **Load Balancing:** Add multiple API keys for the same provider to bypass rate limits using round-robin rotation.
- **Universal API:** Fully compatible with the standard OpenAI `/v1` endpoint.

---

## 🚀 Quick Start

### 1. Installation

Install ToolNet API globally via NPM:

```bash
npm install -g toolnetapi
toolnetapi
```
*The management dashboard will automatically open at `http://localhost:20127`.*

<details>
<summary><b>Alternative: Docker Deployment</b></summary>

```bash
docker run -d \
  --name toolnetapi \
  -p 20127:20127 \
  -v "$HOME/.toolnetapi:/app/data" \
  -e DATA_DIR=/app/data \
  toolnet/toolnetapi:latest
```
</details>

### 2. Connect Your AI Assistant

Configure your favorite IDE or CLI tool to point to your local ToolNet API proxy:

| Setting | Value |
|---------|-------|
| **Endpoint / Base URL** | `http://localhost:20127/v1` |
| **API Key** | *Copy from your ToolNet API Dashboard* |
| **Model** | *Select any model configured in your dashboard* |

---

## 🛠 Supported Providers & IDEs

ToolNet API acts as a universal bridge. You can connect it to:

- **IDEs & CLIs:** Cursor, Claude Code, Cline, OpenClaw, Windsurf, Trae, Zed, Devin.
- **AI Providers:** OpenAI, Anthropic, Google Gemini, GitHub Copilot, Kilo Gateway, DeepSeek, and many more.

<details>
<summary><b>View full list of integrations</b></summary>

- **Free Tier:** Kiro, OpenCode Free, Vertex AI
- **China Providers:** GLM, MiniMax, Baidu, Tencent, DeepSeek
- **Premium:** OpenAI, Anthropic, GitHub Copilot
</details>

---

## ⚙️ Configuration

ToolNet API works out-of-the-box, but you can customize its behavior using environment variables. 

```env
PORT=20127
HOSTNAME=0.0.0.0
DATA_DIR=~/.toolnetapi
NEXT_PUBLIC_BASE_URL=http://localhost:20127
```

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
