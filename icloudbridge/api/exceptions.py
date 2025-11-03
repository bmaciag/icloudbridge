"""Custom exceptions and exception handlers for the iCloudBridge API.

This module provides:
- Custom exception classes for different error scenarios
- FastAPI exception handlers for consistent error responses
- User-friendly error messages
"""

import logging
from typing import Any, Dict

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class ICBException(Exception):
    """Base exception for iCloudBridge API errors.

    Attributes:
        message: Human-readable error message
        status_code: HTTP status code
        details: Additional error details (optional)
    """

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ConfigurationError(ICBException):
    """Raised when there's a configuration error."""

    def __init__(self, message: str, details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class SyncError(ICBException):
    """Raised when a sync operation fails."""

    def __init__(self, message: str, details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class DatabaseError(ICBException):
    """Raised when a database operation fails."""

    def __init__(self, message: str, details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class NotFoundError(ICBException):
    """Raised when a resource is not found."""

    def __init__(self, message: str, details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class AuthenticationError(ICBException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication required", details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class AuthorizationError(ICBException):
    """Raised when authorization fails."""

    def __init__(self, message: str = "Insufficient permissions", details: Dict[str, Any] | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


async def icb_exception_handler(request: Request, exc: ICBException) -> JSONResponse:
    """Handle ICBException and its subclasses.

    Args:
        request: FastAPI request object
        exc: ICBException instance

    Returns:
        JSONResponse with error details
    """
    logger.error(
        f"ICBException: {exc.message} (status={exc.status_code}, "
        f"path={request.url.path}, details={exc.details})"
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "status_code": exc.status_code,
            "details": exc.details,
            "path": str(request.url.path),
        },
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle validation errors and unexpected exceptions.

    Args:
        request: FastAPI request object
        exc: Exception instance

    Returns:
        JSONResponse with error details
    """
    if isinstance(exc, ValidationError):
        # Handle Pydantic validation errors
        logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation error",
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "details": {"validation_errors": exc.errors()},
                "path": str(request.url.path),
            },
        )

    # Handle unexpected exceptions
    logger.exception(f"Unexpected exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "details": {"message": str(exc)} if logger.level == logging.DEBUG else {},
            "path": str(request.url.path),
        },
    )
