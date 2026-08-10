"""SQLAlchemy ORM models.

M2 note: no domain models exist yet. The first models arrive with M4
(sessions) and M5 (participants); they must subclass ``Base`` and be imported
here so Alembic autogenerate can discover them.
"""

from app.models.base import Base

__all__ = ["Base"]
