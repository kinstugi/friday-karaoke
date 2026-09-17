import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import type { SessionParticipant } from "../../lib/sessions";

export function moveItem(ids: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;
  const nextIds = [...ids];
  [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
  return nextIds;
}

export default function ParticipantList({
  participants,
  currentParticipantId,
  onMove,
  onToggle,
  onDelete,
}: {
  participants: SessionParticipant[];
  currentParticipantId: string | null;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggle: (participant: SessionParticipant) => Promise<void>;
  onDelete: (participant: SessionParticipant) => Promise<void>;
}) {
  return (
    <Stack>
      {participants.map((participant, index) => (
        <ParticipantRow
          key={participant.id}
          participant={participant}
          position={index}
          total={participants.length}
          isCurrent={participant.id === currentParticipantId}
          onMove={(direction) => onMove(index, direction)}
          onToggle={() => onToggle(participant)}
          onDelete={() => onDelete(participant)}
        />
      ))}
    </Stack>
  );
}

function ParticipantRow({
  participant,
  position,
  total,
  isCurrent,
  onMove,
  onToggle,
  onDelete,
}: {
  participant: SessionParticipant;
  position: number;
  total: number;
  isCurrent: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const active = participant.visibility;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        px: { xs: 1, sm: 2 },
        py: 1.5,
        gap: { xs: 1, sm: 2 },
        opacity: active ? 1 : 0.5,
        bgcolor: isCurrent
          ? "rgba(255,202,95,.14)"
          : active
            ? "transparent"
            : "rgba(255,255,255,.04)",
        borderLeft: "3px solid",
        borderLeftColor: isCurrent ? "primary.main" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <DragIndicatorRoundedIcon
        sx={{ color: "text.disabled", cursor: "grab" }}
      />
      <Typography variant="body2" color="text.disabled" sx={{ width: 22 }}>
        #{position + 1}
      </Typography>
      <Avatar
        sx={{
          width: 38,
          height: 38,
          bgcolor: active ? "primary.main" : "rgba(255,255,255,.15)",
          color: active ? "#17101f" : "text.secondary",
        }}
      >
        {participant.nickname[0]?.toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          fontWeight={700}
          noWrap
          sx={{ textDecoration: active ? "none" : "line-through" }}
        >
          {participant.nickname}
        </Typography>
        <Typography
          variant="caption"
          color={
            isCurrent
              ? "primary.main"
              : active
                ? "success.main"
                : "warning.main"
          }
        >
          {isCurrent
            ? "Now singing"
            : active
              ? "Ready to sing"
              : "Skipped / unavailable"}
        </Typography>
        {error && (
          <Typography variant="caption" color="error.main" display="block">
            Action failed
          </Typography>
        )}
      </Box>
      <Button
        onClick={() => void run(onToggle)}
        disabled={busy}
        size="small"
        color={active ? "warning" : "success"}
      >
        {active ? "Skip" : "Restore"}
      </Button>
      <IconButton
        onClick={() => void run(onDelete)}
        disabled={busy}
        size="small"
        color="inherit"
        aria-label={`delete ${participant.nickname}`}
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
      <Stack>
        <IconButton
          size="small"
          disabled={position === 0 || busy}
          onClick={() => onMove(-1)}
          color="inherit"
          aria-label="move participant up"
        >
          <KeyboardArrowUpRoundedIcon />
        </IconButton>
        <IconButton
          size="small"
          disabled={position === total - 1 || busy}
          onClick={() => onMove(1)}
          color="inherit"
          aria-label="move participant down"
        >
          <KeyboardArrowDownRoundedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}
