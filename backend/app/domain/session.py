"""Session domain model: state enum and legal transitions (M4).

``SessionStatus`` is the single source of truth for session states and the
transitions allowed between them (see ``docs/DOMAIN_MODEL.md`` §3 and
``docs/PRODUCT_SPEC.md`` §3). The service layer applies these rules; the API
layer translates violations into HTTP errors.

M4 exposes only two transitions (create/start/end); PAUSED and ROUND_COMPLETE
become reachable in later milestones (M14 pause/resume, M16 rounds). The full
documented lifecycle is encoded here so the enum is complete from the start.
"""

from enum import Enum


class SessionStatus(str, Enum):
    """Lifecycle state of a karaoke session."""

    CREATED = "CREATED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ROUND_COMPLETE = "ROUND_COMPLETE"
    ENDED = "ENDED"

    def can_transition_to(self, target: "SessionStatus") -> bool:
        """Return True if a session in this state may move to ``target``.

        Mirrors the lifecycle from PRODUCT_SPEC §3:
        ``CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED``.
        ``ENDED`` is terminal and reachable from any other state.
        """
        return target in _ALLOWED_TRANSITIONS[self]


_ALLOWED_TRANSITIONS: dict[SessionStatus, frozenset[SessionStatus]] = {
    SessionStatus.CREATED: frozenset({SessionStatus.ACTIVE, SessionStatus.ENDED}),
    SessionStatus.ACTIVE: frozenset(
        {SessionStatus.PAUSED, SessionStatus.ROUND_COMPLETE, SessionStatus.ENDED}
    ),
    SessionStatus.PAUSED: frozenset(
        {SessionStatus.ACTIVE, SessionStatus.ROUND_COMPLETE, SessionStatus.ENDED}
    ),
    SessionStatus.ROUND_COMPLETE: frozenset(
        {SessionStatus.ACTIVE, SessionStatus.ENDED}
    ),
    SessionStatus.ENDED: frozenset(),
}
