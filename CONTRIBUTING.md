# Contributing to nekoni

Thanks for your interest in contributing! nekoni is a small, focused project and contributions of all sizes are welcome — from fixing a typo to building a new tool.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Good first issues](#good-first-issues)
- [How to add a new tool](#how-to-add-a-new-tool)
- [Submitting a pull request](#submitting-a-pull-request)
- [Development setup](#development-setup)

---

## Code of conduct

Be respectful and constructive. Issues and PRs that are abusive or off-topic will be closed.

---

## Getting started

1. Fork the repo and clone your fork
2. Follow the [quick start](README.md#quick-start) to get the agent running locally
3. Pick an issue or create one describing what you want to work on
4. Open a PR when you're ready — it doesn't have to be perfect

If you're unsure whether something is worth building, open an issue first and we'll discuss it.

---

## Good first issues

These are well-scoped tasks that don't require deep knowledge of the codebase. Great starting points:

| Label | What to expect |
|---|---|
| `good first issue` | Self-contained, clearly defined, ~1–2 hours of work |
| `documentation` | README improvements, clearer setup instructions, fixing typos |
| `new tool` | Adding a new tool to the agent (see guide below) |

**Suggested good first issues to open:**

- Add a `web_fetch` tool that fetches the text content of a URL via httpx
- Add a `calculator` tool for evaluating simple math expressions
- Add a `remind_me` tool that schedules a one-off message via APScheduler
- Improve error messages when Ollama is not running on startup
- Add a `--model` flag to `make pull` so users can pull a specific model
- Write a troubleshooting section in the README for common setup issues

If you want to work on one of these, open an issue first so we don't duplicate effort.

---

## How to add a new tool

Tools are the most accessible way to extend nekoni. A tool is a Python class that the agent can call during inference — like fetching a URL, reading a file, or querying an API.

### 1. Create the tool file

Add a new file in `apps/agent/src/nekoni_agent/tools/builtin/`:

```python
# apps/agent/src/nekoni_agent/tools/builtin/my_tool.py

from ..base import Tool


class MyTool(Tool):

    @property
    def name(self) -> str:
        return "my_tool"  # snake_case, unique across all tools

    @property
    def description(self) -> str:
        # Write this as if explaining to the LLM what this tool does.
        # Clear, specific descriptions lead to better tool selection.
        return "Does something useful. Call this when the user asks about X."

    @property
    def parameters_schema(self) -> dict:
        # JSON Schema for the tool's input parameters.
        return {
            "type": "object",
            "properties": {
                "input": {
                    "type": "string",
                    "description": "The input to process",
                },
            },
            "required": ["input"],
        }

    async def execute(self, input: str) -> str:
        # Your tool logic goes here.
        # Return a plain string — the agent passes this back to the LLM.
        return f"result: {input}"
```

### 2. Register the tool

Open `apps/agent/src/nekoni_agent/main.py` and add two lines:

```python
# At the top with the other imports
from .tools.builtin.my_tool import MyTool

# Inside the lifespan() function, where the other tools are registered
tool_registry.register(MyTool())
```

### 3. Test it

Start the agent and ask it to use your tool:

```bash
make up
# In the mobile app or web app, send a message that should trigger your tool.
# Watch the dashboard Traces page to see if it gets invoked.
```

You can also hit the tools endpoint directly to confirm your tool is registered:

```bash
curl http://localhost:8000/api/tools | jq '.[] | select(.name == "my_tool")'
```

### Tips for writing good tools

- **Keep `execute` focused** — one tool, one job. If you find yourself branching heavily, consider splitting into two tools.
- **Return useful strings** — the return value goes back to the LLM as context. Be descriptive: `"File not found: notes.txt"` is more useful than `"error"`.
- **Handle exceptions gracefully** — catch expected errors and return a helpful message rather than letting the agent crash.
- **Write a clear `description`** — the LLM uses this to decide when to call your tool. Vague descriptions lead to missed or incorrect invocations.
- **Keep dependencies minimal** — if your tool needs a new package, add it to `apps/agent/pyproject.toml` and note it in your PR.

---

## Submitting a pull request

1. Keep PRs focused — one feature or fix per PR
2. Test your changes locally with `make up` before submitting
3. Include a short description of what the PR does and why
4. If your PR fixes an open issue, reference it: `Fixes #42`

There's no strict PR template, but a sentence or two of context goes a long way.

---

## Development setup

```bash
git clone https://github.com/nekonihq/nekoni && cd nekoni
cp .env.example .env       # set DASHBOARD_PASSWORD at minimum
make install               # installs Ollama, uv, pnpm
make pull                  # pulls the default Ollama model
make up                    # starts everything
```

For dashboard hot-reload during frontend development:

```bash
# Terminal 1
make up

# Terminal 2
pnpm install
pnpm dev:dashboard         # hot-reload at http://localhost:5173
```

The agent runs on the host (not in Docker) so WebRTC works correctly on all platforms.

---

## Questions?

Open an issue or join the [Discord](https://discord.gg/dQzEWpx2).
