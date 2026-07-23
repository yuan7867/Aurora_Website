"""Shared Aurora product update client."""

from .update_service import UpdateService
from .version_compare import compare_versions, is_update_required

__all__ = ["UpdateService", "compare_versions", "is_update_required"]
