"""Utility for issuing temporary download tokens for generated files."""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from pathlib import Path
from typing import Dict, Tuple


class DownloadTokenManager:
    """Manage short-lived download tokens mapped to local files."""

    def __init__(self) -> None:
        self._tokens: Dict[str, Tuple[str, float, str]] = {}
        self._expiry_handles: Dict[str, asyncio.TimerHandle] = {}
        self._lock = asyncio.Lock()

    async def register(self, path: Path, filename: str | None = None, ttl_seconds: int = 300) -> Tuple[str, float]:
        """Register a file for download and return (token, expires_at)."""

        if not path.exists():
            raise FileNotFoundError(path)

        await self._cleanup()
        async with self._lock:
            token = uuid.uuid4().hex
            expires_at = time.time() + ttl_seconds
            safe_name = filename or path.name
            self._tokens[token] = (str(path), expires_at, safe_name)
            self._schedule_expiration(token, ttl_seconds)
            return token, expires_at

    async def consume(self, token: str) -> Tuple[Path, str]:
        """Retrieve file path for download and remove the token."""

        await self._cleanup()
        async with self._lock:
            info = self._tokens.pop(token, None)
            handle = self._expiry_handles.pop(token, None)
            if handle:
                handle.cancel()
            if not info:
                raise KeyError("token not found")

        file_path, expires_at, filename = info
        if time.time() > expires_at:
            self._safe_delete(Path(file_path))
            raise KeyError("token expired")

        return Path(file_path), filename

    async def invalidate(self, token: str, delete_file: bool = True) -> None:
        """Invalidate a token and optionally delete its file."""

        async with self._lock:
            info = self._tokens.pop(token, None)
            handle = self._expiry_handles.pop(token, None)
            if handle:
                handle.cancel()

        if info and delete_file:
            self._safe_delete(Path(info[0]))

    async def _cleanup(self) -> None:
        async with self._lock:
            expired = [tok for tok, (_, expires_at, _) in self._tokens.items() if time.time() > expires_at]
            for token in expired:
                path_str, _, _ = self._tokens.pop(token)
                handle = self._expiry_handles.pop(token, None)
                if handle:
                    handle.cancel()
                self._safe_delete(Path(path_str))

    def _schedule_expiration(self, token: str, ttl_seconds: int) -> None:
        loop = asyncio.get_running_loop()

        async def expire() -> None:
            async with self._lock:
                info = self._tokens.pop(token, None)
                handle = self._expiry_handles.pop(token, None)
                if handle:
                    handle.cancel()
            if info:
                self._safe_delete(Path(info[0]))

        handle = loop.call_later(ttl_seconds, lambda: asyncio.create_task(expire()))
        self._expiry_handles[token] = handle

    @staticmethod
    def _safe_delete(path: Path) -> None:
        try:
            if path.exists():
                os.remove(path)
        except OSError:
            pass


download_manager = DownloadTokenManager()
