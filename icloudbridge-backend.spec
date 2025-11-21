# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for iCloudBridge backend.

This builds a standalone macOS binary for the backend service.
"""

import sys
from pathlib import Path

# Get the project root directory
ROOT = Path(SPECPATH)

block_cipher = None

a = Analysis(
    ['backend/__main__.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        # Core dependencies
        'icloudbridge',
        'icloudbridge.scripts.menubar_backend',
        'icloudbridge.api.app',
        'fastapi',
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # PyObjC frameworks
        'EventKit',
        'Cocoa',
        'Foundation',
        'AppKit',
        # Other dependencies that might need explicit imports
        'caldav',
        'keyring',
        'keyring.backends',
        'keyring.backends.macOS',
        'argon2',
        'cryptography',
        'websockets',
        'aiofiles',
        'aiosqlite',
        'apscheduler',
        'apscheduler.schedulers.asyncio',
        'markdown_it',
        'html_to_markdown',
        'email_validator',
        'multipart',
        # Pillow and image support
        'PIL',
        'PIL.Image',
        'pillow_heif',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude test modules
        'pytest',
        'test',
        'tests',
        # Exclude development tools
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Build a single-file executable (--onefile mode)
# This bundles everything into one binary that extracts to temp at runtime
# This avoids macOS codesigning issues with complex directory structures
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='icloudbridge-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64',  # Apple Silicon
    codesign_identity=None,  # We'll sign manually later
    entitlements_file=None,
)
