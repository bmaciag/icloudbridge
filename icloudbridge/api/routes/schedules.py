"""Schedule management endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep
from icloudbridge.api.models import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from icloudbridge.utils.db import SchedulesDB

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    config: ConfigDep,
    service: str | None = None,
    enabled: bool | None = None,
):
    """List all schedules with optional filtering.

    Args:
        service: Filter by service name (notes, reminders, passwords)
        enabled: Filter by enabled status

    Returns:
        List of schedules
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        schedules = await schedules_db.get_schedules(service=service, enabled=enabled)

        return [ScheduleResponse(**schedule) for schedule in schedules]

    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list schedules: {str(e)}"
        )


@router.post("", response_model=ScheduleResponse)
async def create_schedule(schedule: ScheduleCreate, config: ConfigDep):
    """Create a new schedule.

    Args:
        schedule: Schedule configuration

    Returns:
        Created schedule with ID
    """
    try:
        # Validate schedule type
        if schedule.schedule_type not in ["interval", "datetime"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="schedule_type must be 'interval' or 'datetime'"
            )

        # Validate interval or cron expression
        if schedule.schedule_type == "interval" and not schedule.interval_minutes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="interval_minutes required for interval type"
            )
        if schedule.schedule_type == "datetime" and not schedule.cron_expression:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cron_expression required for datetime type"
            )

        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        schedule_id = await schedules_db.create_schedule(
            service=schedule.service,
            name=schedule.name,
            schedule_type=schedule.schedule_type,
            interval_minutes=schedule.interval_minutes,
            cron_expression=schedule.cron_expression,
            config_json=schedule.config_json,
            enabled=schedule.enabled,
        )

        # Get the created schedule
        created = await schedules_db.get_schedule(schedule_id)

        logger.info(f"Schedule created: {schedule.name} (ID: {schedule_id})")

        # Register schedule with APScheduler
        from icloudbridge.api.app import scheduler
        if scheduler:
            await scheduler.add_schedule(schedule_id)

        return ScheduleResponse(**created)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create schedule: {str(e)}"
        )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: int, config: ConfigDep):
    """Get a schedule by ID.

    Args:
        schedule_id: Schedule ID

    Returns:
        Schedule details
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        schedule = await schedules_db.get_schedule(schedule_id)

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        return ScheduleResponse(**schedule)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule: {str(e)}"
        )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    update: ScheduleUpdate,
    config: ConfigDep,
):
    """Update a schedule.

    Args:
        schedule_id: Schedule ID
        update: Schedule updates

    Returns:
        Updated schedule
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        # Check if schedule exists
        schedule = await schedules_db.get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Update schedule
        await schedules_db.update_schedule(
            schedule_id=schedule_id,
            name=update.name,
            enabled=update.enabled,
            schedule_type=update.schedule_type,
            interval_minutes=update.interval_minutes,
            cron_expression=update.cron_expression,
            config_json=update.config_json,
        )

        # Get updated schedule
        updated = await schedules_db.get_schedule(schedule_id)

        logger.info(f"Schedule updated: {schedule_id}")

        # Update schedule in APScheduler
        from icloudbridge.api.app import scheduler
        if scheduler:
            await scheduler.update_schedule(schedule_id)

        return ScheduleResponse(**updated)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update schedule: {str(e)}"
        )


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int, config: ConfigDep):
    """Delete a schedule.

    Args:
        schedule_id: Schedule ID

    Returns:
        Success message
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        # Check if schedule exists
        schedule = await schedules_db.get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        await schedules_db.delete_schedule(schedule_id)

        logger.info(f"Schedule deleted: {schedule_id}")

        # Remove schedule from APScheduler
        from icloudbridge.api.app import scheduler
        if scheduler:
            await scheduler.remove_schedule(schedule_id)

        return {
            "status": "success",
            "message": f"Schedule {schedule_id} deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schedule: {str(e)}"
        )


@router.post("/{schedule_id}/run")
async def run_schedule(schedule_id: int, config: ConfigDep):
    """Manually trigger a schedule to run immediately.

    Args:
        schedule_id: Schedule ID

    Returns:
        Success message
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        # Check if schedule exists
        schedule = await schedules_db.get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        logger.info(f"Manual run requested for schedule: {schedule_id}")

        # Trigger schedule execution in APScheduler
        from icloudbridge.api.app import scheduler
        if scheduler:
            await scheduler.trigger_schedule(schedule_id)

        return {
            "status": "success",
            "message": f"Schedule {schedule_id} triggered",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run schedule: {str(e)}"
        )


@router.put("/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: int, config: ConfigDep):
    """Toggle a schedule's enabled status.

    Args:
        schedule_id: Schedule ID

    Returns:
        Updated schedule
    """
    try:
        schedules_db = SchedulesDB(config.general.data_dir / "schedules.db")
        await schedules_db.initialize()

        # Get current schedule
        schedule = await schedules_db.get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Toggle enabled status
        new_enabled = not schedule["enabled"]
        await schedules_db.update_schedule(
            schedule_id=schedule_id,
            enabled=new_enabled,
        )

        # Get updated schedule
        updated = await schedules_db.get_schedule(schedule_id)

        logger.info(f"Schedule {schedule_id} {'enabled' if new_enabled else 'disabled'}")

        # Enable/disable schedule in APScheduler
        from icloudbridge.api.app import scheduler
        if scheduler:
            if new_enabled:
                await scheduler.add_schedule(schedule_id)
            else:
                await scheduler.remove_schedule(schedule_id)

        return ScheduleResponse(**updated)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle schedule: {str(e)}"
        )
