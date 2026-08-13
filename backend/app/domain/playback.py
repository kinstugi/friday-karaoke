"""Playback domain model: state enum (M11).

``PlaybackState`` is the playback lifecycle of the session's single playback
device (the host browser). It mirrors ``docs/DOMAIN_MODEL.md`` §3. The full
documented lifecycle is encoded here; M11 (host-driven control) reaches only
``IDLE`` and ``PLAYING`` — the state is *derived* from queue state (``PLAYING``
iff an entry is ``SINGING``), never stored. The timer-driven transient states
(``PREPARING``/``COUNTDOWN``/``COOLDOWN``) become reachable when automatic
transitions land in M13.
"""

from enum import Enum


class PlaybackState(str, Enum):
    """Lifecycle state of the host-device playback (derived, not stored)."""

    IDLE = "IDLE"
    PREPARING = "PREPARING"
    COUNTDOWN = "COUNTDOWN"
    PLAYING = "PLAYING"
    COOLDOWN = "COOLDOWN"
    FINISHED = "FINISHED"
    SKIPPED = "SKIPPED"
