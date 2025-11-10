"""Photo synchronization endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep, PhotosSyncEngineDep
from icloudbridge.api.models import PhotoSyncRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sync")
async def sync_photos(
    request: PhotoSyncRequest,
    config: ConfigDep,
    engine: PhotosSyncEngineDep,
):
    """Trigger a photo synchronization run."""

    if not config.photos.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo sync disabled in configuration",
        )

    try:
        stats = await engine.sync(sources=request.sources, dry_run=request.dry_run)
    except Exception as exc:
        logger.exception("Photo sync failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Photo sync failed: {exc}",
        ) from exc

    return {"message": "photo sync complete", "stats": stats}
