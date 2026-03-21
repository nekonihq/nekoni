"""Tool: web_search using DuckDuckGo HTML scraping (no API key required)."""

import httpx

from ..base import Tool


class WebSearchTool(Tool):
    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "Search the web for information."
            " Returns a list of results with titles and snippets."
        )

    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {
                    "type": "integer",
                    "description": "Max results (default 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        }

    async def execute(self, query: str, max_results: int = 5) -> list[dict]:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; Nekoni/1.0)",
            "Accept": "text/html",
        }
        params = {"q": query, "format": "json"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={**params, "no_html": "1", "skip_disambig": "1"},
                    headers=headers,
                )
                data = resp.json()
                results = []
                # Instant answers
                if data.get("AbstractText"):
                    results.append(
                        {
                            "title": data.get("Heading", ""),
                            "snippet": data["AbstractText"],
                            "url": data.get("AbstractURL", ""),
                        }
                    )
                # Related topics
                for topic in data.get("RelatedTopics", [])[:max_results]:
                    if "Text" in topic:
                        results.append(
                            {
                                "title": topic.get("Text", "")[:80],
                                "snippet": topic.get("Text", ""),
                                "url": topic.get("FirstURL", ""),
                            }
                        )
                return (
                    results[:max_results]
                    if results
                    else [
                        {
                            "title": "No results",
                            "snippet": f"No results for: {query}",
                            "url": "",
                        }
                    ]
                )
        except Exception as e:
            return [{"title": "Search error", "snippet": str(e), "url": ""}]
