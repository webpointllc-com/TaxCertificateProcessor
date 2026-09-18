"""Pydantic schemas for request/response bodies."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    handle: str = Field(min_length=1, max_length=64)
    display_name: Optional[str] = Field(default=None, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    handle: str
    display_name: Optional[str]
    created_at: datetime


class FartCreate(BaseModel):
    handle: str = Field(min_length=1, max_length=64)
    note: Optional[str] = Field(default=None, max_length=2000)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    intensity: Optional[int] = Field(default=None, ge=1, le=10)
    source: Optional[str] = Field(default=None, max_length=32)


class FartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    handle: str
    note: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    intensity: Optional[int]
    source: Optional[str]
    created_at: datetime


class FriendAdd(BaseModel):
    owner_handle: str = Field(min_length=1, max_length=64)
    friend_handle: str = Field(min_length=1, max_length=64)


class FriendOut(BaseModel):
    owner_handle: str
    friend_handle: str
    since: datetime


class StatsOut(BaseModel):
    total_farts: int
    total_users: int
    farts_last_24h: int
    top_farters: list[dict]
