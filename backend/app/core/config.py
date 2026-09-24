import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.model_api_key: str = os.getenv("MODEL_API_KEY", "")
        self.model_api_base: str = os.getenv("MODEL_API_BASE", "https://api.deepseek.com/v1")
        self.model_name: str = os.getenv("MODEL_NAME", "deepseek-chat")
        self.model_timeout_seconds: float = float(os.getenv("MODEL_TIMEOUT_SECONDS", "4"))
        self.access_code: str = os.getenv("ACCESS_CODE", "")
        self.rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))


settings = Settings()
