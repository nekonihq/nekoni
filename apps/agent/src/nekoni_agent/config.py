from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Agent
    agent_host: str = "0.0.0.0"
    agent_port: int = 8000
    agent_name: str = "nekoni"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ollama_timeout: int = 120

    # Signal server (for WebRTC)
    signal_url: str = "ws://localhost:3000"

    # Storage paths (defaults are relative for local dev; Docker overrides via env)
    agent_keys_dir: str = "./data/keys"
    chroma_path: str = "./data/chroma"
    sqlite_path: str = "./data/sqlite/memory.db"

    # Dashboard auth
    dashboard_username: str = "admin"
    dashboard_password: str = "nekoni"

    # LLM settings
    max_react_iterations: int = 8
    rag_top_k: int = 5
    rag_min_score: float = 0.3
    chunk_size: int = 512
    chunk_overlap: int = 50

    @property
    def keys_dir(self) -> str:
        return self.agent_keys_dir


settings = Settings()
