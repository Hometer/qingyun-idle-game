from typing import List, Literal

from pydantic import BaseModel, Field


class OptionIn(BaseModel):
    option_id: str
    label: str
    meaning: str


class CharacterIn(BaseModel):
    name: str
    realm: str
    spirit_root: str


class GenerateRequest(BaseModel):
    event_id: str
    character: CharacterIn
    map_id: str
    options: List[OptionIn] = Field(min_length=1)
    recent_logs: List[str] = []


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
