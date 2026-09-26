from typing import List, Literal

from pydantic import BaseModel, Field, field_validator


class OptionIn(BaseModel):
    option_id: str = Field(min_length=1, max_length=32)
    label: str = Field(min_length=1, max_length=64)
    meaning: str = Field(max_length=128)


class CharacterIn(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    realm: str = Field(min_length=1, max_length=32)
    spirit_root: str = Field(max_length=32)


class GenerateRequest(BaseModel):
    event_id: str = Field(min_length=1, max_length=64)
    character: CharacterIn
    map_id: str = Field(min_length=1, max_length=64)
    options: List[OptionIn] = Field(min_length=1, max_length=4)
    recent_logs: List[str] = Field(default_factory=list, max_length=20)

    @field_validator("recent_logs")
    @classmethod
    def _logs_bounded(cls, v: List[str]) -> List[str]:
        for x in v:
            if len(x) > 300:
                raise ValueError("日志过长")
        return v


class OptionOut(BaseModel):
    option_id: str
    option_text: str


class GenerateResponse(BaseModel):
    source: Literal["model", "template"]
    event_id: str
    title: str
    body: str
    options: List[OptionOut]


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
