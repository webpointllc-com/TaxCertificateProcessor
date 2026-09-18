"""I Just Farted — public HTTP API.

Endpoints:
  GET    /                       — service info
  GET    /health                  — health check
  POST   /users                   — create/get a user by handle
  GET    /users/{handle}          — fetch a user
  POST   /farts                   — record a fart
  GET    /farts                   — list farts (optional handle, limit, since)
  GET    /farts/{fart_id}         — fetch one fart
  DELETE /farts/{fart_id}         — delete a fart
  POST   /friends                 — add a friend
  GET    /friends/{owner_handle}  — list friends for owner
  DELETE /friends                 — remove a friend
  GET    /stats                   — aggregate stats
  POST   /trigger/ios             — friendly single-shot endpoint for iOS Shortcut
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import Fart, Friendship, User, get_session, init_db
from .schemas import (
    FartCreate,
    FartOut,
    FriendAdd,
    FriendOut,
    StatsOut,
    UserCreate,
    UserOut,
)

app = FastAPI(
    title="I Just Farted API",
    version="1.0.0",
    description="Public API for the I Just Farted app. Backs the web frontend, "
    "iOS Shortcuts, Pythonista, and the companion MCP server.",
)

_allowed_origins = os.environ.get("CORS_ALLOW_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",")] or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


def _get_or_create_user(db: Session, handle: str, display_name: Optional[str] = None) -> User:
    handle = handle.strip().lower()
    if not handle:
        raise HTTPException(status_code=400, detail="handle is required")
    user = db.scalar(select(User).where(User.handle == handle))
    if user is None:
        user = User(handle=handle, display_name=display_name)
        db.add(user)
        db.flush()
    elif display_name and user.display_name != display_name:
        user.display_name = display_name
    return user


def _fart_to_out(fart: Fart) -> FartOut:
    return FartOut(
        id=fart.id,
        user_id=fart.user_id,
        handle=fart.user.handle,
        note=fart.note,
        lat=fart.lat,
        lng=fart.lng,
        intensity=fart.intensity,
        source=fart.source,
        created_at=fart.created_at,
    )


@app.get("/")
def root() -> dict:
    return {
        "service": "i-just-farted-api",
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


# ---------- users ----------

@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: Session = Depends(get_session)) -> UserOut:
    user = _get_or_create_user(db, body.handle, body.display_name)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@app.get("/users/{handle}", response_model=UserOut)
def get_user(handle: str, db: Session = Depends(get_session)) -> UserOut:
    user = db.scalar(select(User).where(User.handle == handle.strip().lower()))
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    return UserOut.model_validate(user)


# ---------- farts ----------

@app.post("/farts", response_model=FartOut, status_code=status.HTTP_201_CREATED)
def create_fart(body: FartCreate, db: Session = Depends(get_session)) -> FartOut:
    user = _get_or_create_user(db, body.handle)
    fart = Fart(
        user_id=user.id,
        note=body.note,
        lat=body.lat,
        lng=body.lng,
        intensity=body.intensity,
        source=body.source,
    )
    db.add(fart)
    db.commit()
    db.refresh(fart)
    return _fart_to_out(fart)


@app.get("/farts", response_model=list[FartOut])
def list_farts(
    handle: Optional[str] = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=500),
    since_minutes: Optional[int] = Query(default=None, ge=1, le=60 * 24 * 30),
    db: Session = Depends(get_session),
) -> list[FartOut]:
    stmt = select(Fart).order_by(Fart.created_at.desc()).limit(limit)
    if handle:
        stmt = stmt.join(User).where(User.handle == handle.strip().lower())
    if since_minutes:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
        stmt = stmt.where(Fart.created_at >= cutoff)
    farts = db.scalars(stmt).all()
    return [_fart_to_out(f) for f in farts]


@app.get("/farts/{fart_id}", response_model=FartOut)
def get_fart(fart_id: int, db: Session = Depends(get_session)) -> FartOut:
    fart = db.get(Fart, fart_id)
    if fart is None:
        raise HTTPException(status_code=404, detail="fart not found")
    return _fart_to_out(fart)


@app.delete("/farts/{fart_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fart(fart_id: int, db: Session = Depends(get_session)):
    fart = db.get(Fart, fart_id)
    if fart is None:
        raise HTTPException(status_code=404, detail="fart not found")
    db.delete(fart)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- friends ----------

@app.post("/friends", response_model=FriendOut, status_code=status.HTTP_201_CREATED)
def add_friend(body: FriendAdd, db: Session = Depends(get_session)) -> FriendOut:
    if body.owner_handle.strip().lower() == body.friend_handle.strip().lower():
        raise HTTPException(status_code=400, detail="cannot friend yourself")
    owner = _get_or_create_user(db, body.owner_handle)
    friend = _get_or_create_user(db, body.friend_handle)
    existing = db.scalar(
        select(Friendship).where(
            Friendship.owner_id == owner.id, Friendship.friend_id == friend.id
        )
    )
    if existing is None:
        existing = Friendship(owner_id=owner.id, friend_id=friend.id)
        db.add(existing)
        db.commit()
        db.refresh(existing)
    return FriendOut(
        owner_handle=owner.handle,
        friend_handle=friend.handle,
        since=existing.created_at,
    )


@app.get("/friends/{owner_handle}", response_model=list[FriendOut])
def list_friends(owner_handle: str, db: Session = Depends(get_session)) -> list[FriendOut]:
    owner = db.scalar(select(User).where(User.handle == owner_handle.strip().lower()))
    if owner is None:
        return []
    rows = db.execute(
        select(Friendship, User)
        .join(User, User.id == Friendship.friend_id)
        .where(Friendship.owner_id == owner.id)
        .order_by(Friendship.created_at.desc())
    ).all()
    return [
        FriendOut(
            owner_handle=owner.handle,
            friend_handle=user.handle,
            since=friendship.created_at,
        )
        for friendship, user in rows
    ]


@app.delete("/friends", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(body: FriendAdd, db: Session = Depends(get_session)):
    owner = db.scalar(select(User).where(User.handle == body.owner_handle.strip().lower()))
    friend = db.scalar(select(User).where(User.handle == body.friend_handle.strip().lower()))
    if owner is not None and friend is not None:
        friendship = db.scalar(
            select(Friendship).where(
                Friendship.owner_id == owner.id, Friendship.friend_id == friend.id
            )
        )
        if friendship is not None:
            db.delete(friendship)
            db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- stats ----------

@app.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_session)) -> StatsOut:
    total_farts = db.scalar(select(func.count(Fart.id))) or 0
    total_users = db.scalar(select(func.count(User.id))) or 0
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    farts_last_24h = db.scalar(
        select(func.count(Fart.id)).where(Fart.created_at >= cutoff)
    ) or 0

    top_rows = db.execute(
        select(User.handle, func.count(Fart.id).label("n"))
        .join(Fart, Fart.user_id == User.id)
        .group_by(User.handle)
        .order_by(func.count(Fart.id).desc())
        .limit(5)
    ).all()
    top_farters = [{"handle": h, "count": int(n)} for h, n in top_rows]

    return StatsOut(
        total_farts=int(total_farts),
        total_users=int(total_users),
        farts_last_24h=int(farts_last_24h),
        top_farters=top_farters,
    )


# ---------- iOS shortcut convenience endpoint ----------

@app.post("/trigger/ios")
def trigger_ios(
    handle: str = Query(..., description="Your user handle"),
    note: Optional[str] = Query(default=None),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
    intensity: Optional[int] = Query(default=None, ge=1, le=10),
    db: Session = Depends(get_session),
) -> dict:
    """Query-string friendly endpoint so an iOS Shortcut can just call a URL.

    Example (in Shortcuts → Get Contents of URL, method POST):
      https://<host>/trigger/ios?handle=bill&note=stealth&lat=40.7&lng=-74.0
    """
    user = _get_or_create_user(db, handle)
    fart = Fart(
        user_id=user.id,
        note=note,
        lat=lat,
        lng=lng,
        intensity=intensity,
        source="ios-shortcut",
    )
    db.add(fart)
    db.commit()
    db.refresh(fart)
    return {
        "ok": True,
        "message": f"Recorded fart #{fart.id} for @{user.handle}",
        "fart": _fart_to_out(fart).model_dump(mode="json"),
    }
