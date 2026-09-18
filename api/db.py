"""Database layer for the I Just Farted API.

Uses SQLAlchemy with either Postgres (production) or SQLite (local dev).
Set DATABASE_URL to a Postgres connection string in production. On Render,
this is wired automatically via `fromDatabase` in render.yaml.

Note: on Render's ephemeral filesystem, the SQLite fallback is lost on every
deploy/restart. Always use Postgres for durable storage.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


def _resolve_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        return "sqlite:///./ijf.db"
    # SQLAlchemy 2.x wants postgresql+psycopg://, but Render/Heroku hand out
    # postgres:// or postgresql:// URIs. Normalize them.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _resolve_database_url()

_engine_kwargs: dict = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    handle = Column(String(64), unique=True, nullable=False, index=True)
    display_name = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    farts = relationship("Fart", back_populates="user", cascade="all, delete-orphan")


class Fart(Base):
    __tablename__ = "farts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    note = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    intensity = Column(Integer, nullable=True)  # 1-10 scale, optional
    source = Column(String(32), nullable=True)  # web, ios-shortcut, pythonista, mcp
    created_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    user = relationship("User", back_populates="farts")


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("owner_id", "friend_id", name="uq_friendship"),)

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
