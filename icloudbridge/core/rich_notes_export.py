"""Rich Notes export pipeline using the Ruby ripper."""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from icloudbridge.scripts.rich_notes import run_rich_ripper
from icloudbridge.utils.converters import html_to_markdown
from icloudbridge.utils.db import NotesDB

logger = logging.getLogger(__name__)


class RichNotesExporter:
    """Exports rich Apple Notes markup into a read-only RichNotes folder."""

    def __init__(self, notes_db_path: Path, remote_folder: Path) -> None:
        self.notes_db_path = notes_db_path
        self.remote_folder = remote_folder
        self.repo_root = Path(__file__).resolve().parents[2]

    async def _load_mappings(self) -> list[dict[str, Any]]:
        db = NotesDB(self.notes_db_path)
        await db.initialize()
        return await db.get_all_mappings()

    def _gather_mappings(self) -> list[dict[str, Any]]:
        return asyncio.run(self._load_mappings())

    def _copy_note_store(self, destination: Path) -> None:
        script = self.repo_root / "tools" / "note_db_copy" / "copy_note_db.py"
        cmd = [
            "/usr/bin/python3",
            str(script),
            "--dest",
            str(destination),
        ]
        logger.info("Copying Apple Notes database -> %s", destination)
        subprocess.run(cmd, check=True)

    def _run_ripper(self, db_path: Path, output_dir: Path) -> None:
        args = ["--file", str(db_path), "--output-dir", str(output_dir)]
        logger.info("Running rich notes ripper (output=%s)", output_dir)
        run_rich_ripper(args)

    def _find_json(self, output_dir: Path) -> Path:
        candidates = list(output_dir.rglob("json/all_notes_*.json"))
        if not candidates:
            raise FileNotFoundError(
                f"Could not find all_notes_*.json under ripper output {output_dir}"
            )
        return candidates[0]

    def _extract_note_content(self, note_entry: dict[str, Any]) -> str:
        html = note_entry.get("html") or ""
        marker = '<div class="note-content">'
        if marker in html:
            body = html.split(marker, 1)[1]
            # Remove closing </div> that wraps the content block
            if body.endswith("</div>"):
                body = body.rsplit("</div>", 1)[0]
        else:
            body = html
        return body

    def _convert_to_markdown(self, html: str) -> str:
        return html_to_markdown(html)

    def export(self, *, dry_run: bool = False) -> None:
        if not self.remote_folder:
            raise ValueError("Remote notes folder is not configured")

        mappings = self._gather_mappings()
        if not mappings:
            logger.warning("No note mappings exist; skipping rich notes export")
            return

        with tempfile.TemporaryDirectory() as tmp_str:
            tmp_dir = Path(tmp_str)
            local_store = tmp_dir / "NoteStore.sqlite"
            ripper_output = tmp_dir / "ripper_output"
            ripper_output.mkdir(parents=True, exist_ok=True)

            self._copy_note_store(local_store)
            self._run_ripper(local_store, ripper_output)

            json_file = self._find_json(ripper_output)
            data = json.loads(json_file.read_text(encoding="utf-8"))
            indexes = self._build_note_indexes(data.get("notes", {}))

        rich_root = self.remote_folder / "RichNotes"
        selected_notes: list[tuple[Path, dict[str, Any]]] = []

        for mapping in mappings:
            uuid = mapping["local_uuid"]
            note_entry = self._lookup_note_entry(uuid, indexes)
            if not note_entry:
                continue
            remote_path = Path(mapping["remote_path"])
            try:
                relative = remote_path.relative_to(self.remote_folder)
            except ValueError:
                continue
            selected_notes.append((relative, note_entry))

        if not selected_notes:
            logger.warning("No overlapping notes found between mappings and ripper output")
            return

        logger.info("Preparing RichNotes export (%d notes)", len(selected_notes))

        if dry_run:
            logger.info("Dry run: skipping filesystem changes for RichNotes export")
            return

        if rich_root.exists():
            shutil.rmtree(rich_root)
        rich_root.mkdir(parents=True, exist_ok=True)

        self._write_readme(rich_root)

        for relative_path, note_entry in selected_notes:
            folder = rich_root / relative_path.parent
            folder.mkdir(parents=True, exist_ok=True)
            target = folder / f"{relative_path.stem}_rich.md"
            html = self._extract_note_content(note_entry)
            markdown = self._convert_to_markdown(html)
            target.write_text(markdown, encoding="utf-8")

        logger.info("RichNotes export complete: %s", rich_root)

    def _write_readme(self, rich_root: Path) -> None:
        content = """# Rich Notes Export\n\n"""
        content += (
            "This directory contains a read-only snapshot of your Apple Notes, exported using "
            "iCloudBridge's rich-notes mode. Every time you run `icloudbridge notes sync --rich-notes`, "
            "this folder is regenerated from scratch.\n\n"
            "- ✔️ Feel free to read or copy these Markdown files.\n"
            "- ⚠️ Changes made here will **NOT** sync back to Apple Notes.\n"
            "- ♻️ Any edits inside `RichNotes/` will be overwritten on the next export.\n"
        )
        (rich_root / "README.md").write_text(content, encoding="utf-8")

    def _build_note_indexes(self, notes_section: Any) -> dict[str, Any]:
        by_uuid: dict[str, dict[str, Any]] = {}
        by_primary: dict[int, dict[str, Any]] = {}
        by_note_id: dict[int, dict[str, Any]] = {}

        if isinstance(notes_section, dict):
            for key, entry in notes_section.items():
                if not isinstance(entry, dict):
                    continue
                uuid = entry.get("uuid") or key
                if uuid:
                    by_uuid[str(uuid)] = entry

                pk = entry.get("primary_key")
                if isinstance(pk, int):
                    by_primary[pk] = entry

                note_id = entry.get("note_id")
                if isinstance(note_id, int):
                    by_note_id[note_id] = entry

        return {
            "by_uuid": by_uuid,
            "by_primary": by_primary,
            "by_note_id": by_note_id,
        }

    def _lookup_note_entry(self, local_uuid: str, indexes: dict[str, Any]) -> dict[str, Any] | None:
        entry = indexes["by_uuid"].get(local_uuid)
        if entry:
            return entry

        pk = self._extract_primary_key(local_uuid)
        if pk is not None:
            entry = indexes["by_primary"].get(pk)
            if entry:
                return entry

        note_id = self._extract_note_id(local_uuid)
        if note_id is not None:
            entry = indexes["by_note_id"].get(note_id)
            if entry:
                return entry

        return None

    @staticmethod
    def _extract_primary_key(coredata_id: str) -> int | None:
        if "/p" not in coredata_id:
            return None
        suffix = coredata_id.rsplit("/p", 1)[-1]
        try:
            return int(suffix)
        except ValueError:
            return None

    @staticmethod
    def _extract_note_id(coredata_id: str) -> int | None:
        # Some IDs have the format .../ICNote/<number>
        suffix = coredata_id.rsplit("/", 1)[-1]
        if suffix.startswith("p"):
            suffix = suffix[1:]
        try:
            return int(suffix)
        except ValueError:
            return None
