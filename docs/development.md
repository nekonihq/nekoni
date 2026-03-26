# Development

## Local Development

The agent runs on the host rather than in Docker so WebRTC behaves correctly on all supported platforms.

Start the core services:

```bash
make up
```

## Dashboard Hot Reload

Run the dashboard dev server in a second terminal:

```bash
pnpm install
pnpm dev:dashboard
```

## Adding a Tool

Create a new file in `apps/agent/src/nekoni_agent/tools/builtin/`:

```python
from ..base import Tool

class MyTool(Tool):
    @property
    def name(self) -> str:
        return "my_tool"

    @property
    def description(self) -> str:
        return "Does something useful."

    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "input": {"type": "string", "description": "The input"},
            },
            "required": ["input"],
        }

    async def execute(self, input: str) -> str:
        return f"result: {input}"
```

Register it in `main.py`:

```python
from .tools.builtin.my_tool import MyTool
tool_registry.register(MyTool())
```
