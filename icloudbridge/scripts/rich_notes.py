"""Thin wrapper to run the Ruby notes ripper via Poetry."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _build_ripper_command(extra_args: list[str]) -> tuple[list[str], dict[str, str], Path]:
    repo_root = Path(__file__).resolve().parents[2]
    ripper_dir = repo_root / "tools" / "notes_cloud_ripper"
    gemfile = ripper_dir / "Gemfile"
    script = ripper_dir / "notes_cloud_ripper.rb"

    if not gemfile.exists() or not script.exists():
        raise FileNotFoundError(
            "Expected notes_cloud_ripper assets under tools/notes_cloud_ripper (Gemfile + script)."
        )

    env = os.environ.copy()
    env["BUNDLE_GEMFILE"] = str(gemfile)

    # Always force single output folder (-g) and UUID identifiers for stability.
    forced_flags = ["-g", "--uuid"]

    cmd = [
        "bundle",
        "exec",
        "ruby",
        str(script),
        *forced_flags,
        *extra_args,
    ]

    return cmd, env, repo_root


def run_rich_ripper(extra_args: list[str]) -> None:
    cmd, env, repo_root = _build_ripper_command(extra_args)
    subprocess.run(cmd, cwd=repo_root, env=env, check=True)


def main() -> None:
    run_rich_ripper(sys.argv[1:])


if __name__ == "__main__":
    main()
