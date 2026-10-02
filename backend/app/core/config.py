import os

from dotenv import load_dotenv

load_dotenv()


def _number(name: str, default: str) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        # 异常费用/超时配置让模型通道关闭，健康检查和模板仍可用。
        return float("nan")


class Settings:
    def __init__(self) -> None:
        self.model_api_key: str = os.getenv("MODEL_API_KEY", "")
        self.model_api_base: str = os.getenv("MODEL_API_BASE", "https://api.deepseek.com/v1")
        self.model_name: str = os.getenv("MODEL_NAME", "deepseek-chat")
        self.model_timeout_seconds: float = _number("MODEL_TIMEOUT_SECONDS", "1.8")
        self.model_total_budget_seconds: float = _number("MODEL_TOTAL_BUDGET_SECONDS", "3.5")
        self.access_code: str = os.getenv("ACCESS_CODE", "")
        self.rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))
        # development：本地验收，空访问码放行；production：公网，空访问码一律拒绝（fail-closed）
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        # 月度费用熔断（元）。0 = 明确不启用额度上限；负数或非有限数拒绝调用
        self.monthly_budget_rmb: float = _number("MONTHLY_BUDGET_RMB", "100")
        # 模型标价（元/百万 token），用于估算与记账；上线前按厂商实际标价核对
        self.model_input_price_per_mtok: float = _number("MODEL_INPUT_PRICE_PER_MTOK", "2")
        self.model_output_price_per_mtok: float = _number("MODEL_OUTPUT_PRICE_PER_MTOK", "8")


settings = Settings()
