"""
REUNITE-X Structured Logging
Provides standardized JSON and human-readable logging with contextual tracing.
"""
import logging
import sys
from typing import Any, Dict
from datetime import datetime, timezone


class StructuredFormatter(logging.Formatter):
    """Formats log records as structured text with timestamps and level details."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now(timezone.utc).isoformat()
        base_message = f"[{timestamp}] [{record.levelname:<8}] [{record.name}] {record.getMessage()}"
        if record.exc_info:
            base_message += f"\n{self.formatException(record.exc_info)}"
        return base_message


def setup_logging(debug: bool = False) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO
    logger = logging.getLogger("reunite_x")
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        handler.setFormatter(StructuredFormatter())
        logger.addHandler(handler)

    # Silence overly verbose external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    return logger


logger = setup_logging()
