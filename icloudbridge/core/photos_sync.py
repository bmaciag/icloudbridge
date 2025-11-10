"""Photo synchronization engine (local folder → Apple Photos)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from icloudbridge.core.config import PhotoSourceConfig, PhotosConfig
from icloudbridge.sources.photos import (
    PhotoCandidate,
    PhotoSourceScanner,
    PhotosAppleScriptAdapter,
)
from icloudbridge.utils.photos_db import PhotosDB

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PhotoImportRecord:
    candidate: PhotoCandidate
    content_hash: str
    captured_at: datetime | None


class PhotoSyncEngine:
    """High-level coordinator for folder → Apple Photos imports."""

    def __init__(self, config: PhotosConfig, data_dir: Path):
        self.config = config
        self.data_dir = data_dir
        self.db = PhotosDB(data_dir / "photos.db")
        self.scanner = PhotoSourceScanner(config.sources)
        self.apple = PhotosAppleScriptAdapter()
        self.temp_dir = data_dir / "photos" / "tmp"
        self.meta_dir = data_dir / "photos" / "meta"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.meta_dir.mkdir(parents=True, exist_ok=True)

    async def initialize(self) -> None:
        await self.db.initialize()

    async def sync(
        self,
        *,
        sources: Iterable[str] | None = None,
        dry_run: bool = False,
    ) -> dict:
        if not self.config.sources:
            raise RuntimeError("No photo sources configured")

        await self.initialize()

        candidates = list(self.scanner.iter_candidates(sources))
        logger.info("Scanned %s candidate files", len(candidates))

        new_records: list[PhotoImportRecord] = []
        for candidate in candidates:
            file_hash = await self._hash_file(candidate.path)
            existing = await self.db.get_by_hash(file_hash)
            if existing:
                continue

            captured_at = candidate.mtime
            await self.db.record_discovery(
                content_hash=file_hash,
                path=candidate.path,
                size=candidate.size,
                media_type=candidate.media_type,
                source_name=candidate.source_name,
                album=candidate.album,
                captured_at=captured_at,
            )

            new_records.append(
                PhotoImportRecord(candidate=candidate, content_hash=file_hash, captured_at=captured_at)
            )

        if not new_records:
            return {
                "discovered": len(candidates),
                "new_assets": 0,
                "imported": 0,
                "dry_run": dry_run,
                "sources": list(self.scanner.available_sources()),
            }

        if dry_run:
            return {
                "discovered": len(candidates),
                "new_assets": len(new_records),
                "imported": 0,
                "dry_run": True,
                "pending": [str(record.candidate.path) for record in new_records[:50]],
            }

        grouped: dict[str, list[PhotoImportRecord]] = defaultdict(list)
        for record in new_records:
            album = record.candidate.album or self.config.default_album
            grouped[album].append(record)

        total_imported = 0
        for album, records in grouped.items():
            await self.apple.ensure_album(album)
            manifest_path = await self._write_manifest(records)
            try:
                await self.apple.import_files(manifest_path, album)
            finally:
                manifest_path.unlink(missing_ok=True)

            for record in records:
                await self.db.mark_imported(content_hash=record.content_hash, album=album)
                self._write_sidecar(record, album)
            total_imported += len(records)

        return {
            "discovered": len(candidates),
            "new_assets": len(new_records),
            "imported": total_imported,
            "dry_run": False,
            "albums": {album: len(records) for album, records in grouped.items()},
        }

    async def _hash_file(self, path: Path) -> str:
        algorithm = self.config.hash_algorithm

        def _reader() -> str:
            h = hashlib.new(algorithm)
            with path.open("rb") as handle:
                while chunk := handle.read(1024 * 1024):
                    h.update(chunk)
            return h.hexdigest()

        return await asyncio.to_thread(_reader)

    async def _write_manifest(self, records: list[PhotoImportRecord]) -> Path:
        manifest = self.temp_dir / f"import_{uuid4().hex}.txt"
        contents = "\n".join(str(record.candidate.path) for record in records)
        await asyncio.to_thread(manifest.write_text, contents)
        return manifest

    def _write_sidecar(self, record: PhotoImportRecord, album: str) -> None:
        if not self._source_config(record.candidate.source_name).metadata_sidecars:
            return

        payload = {
            "hash": record.content_hash,
            "source_path": str(record.candidate.path),
            "source_name": record.candidate.source_name,
            "media_type": record.candidate.media_type,
            "album": album,
            "captured_at": record.captured_at.isoformat() if record.captured_at else None,
            "imported_at": datetime.utcnow().isoformat(),
        }
        sidecar = self.meta_dir / f"{record.content_hash}.json"
        sidecar.write_text(json.dumps(payload, indent=2))

    def _source_config(self, name: str) -> PhotoSourceConfig:
        cfg = self.config.sources.get(name)
        if not cfg:
            raise KeyError(f"Unknown photo source '{name}'")
        return cfg
