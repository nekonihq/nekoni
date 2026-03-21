"""Tool: get_time"""

from datetime import datetime

from ..base import Tool


class GetTimeTool(Tool):
    @property
    def name(self) -> str:
        return "get_time"

    @property
    def description(self) -> str:
        return "Get the current date and time."

    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "Timezone name (e.g. 'UTC', 'America/New_York')."
                    " Defaults to UTC.",
                }
            },
            "required": [],
        }

    async def execute(self, timezone: str = "UTC") -> str:
        now = datetime.now(
            tz=__import__("zoneinfo", fromlist=["ZoneInfo"]).ZoneInfo(timezone)
        )
        return now.strftime("%Y-%m-%d %H:%M:%S %Z")
