import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { QRCodeSVG } from "qrcode.react";
import { copyText } from "../../lib/clipboard";
import {
  addHostParticipant,
  setParticipantVisibility,
  type SessionParticipant,
} from "../../lib/sessions";

export function QueuePanel({
  participants,
}: {
  participants: SessionParticipant[];
}) {
  return (
    <Stack spacing={2}>
      {participants.length ? (
        participants.map((participant, index) => (
          <Stack
            key={participant.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              py: 1.3,
              opacity: participant.visibility ? 1 : 0.45,
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <Typography variant="caption" color="text.disabled">
              #{index + 1}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap fontWeight={700}>
                {participant.nickname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {participant.visibility
                  ? "Ready to sing"
                  : "Skipped / unavailable"}
              </Typography>
            </Box>
          </Stack>
        ))
      ) : (
        <Typography color="text.secondary">
          No participants have joined yet.
        </Typography>
      )}
      <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,.05)", borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={700}>
          Queue note
        </Typography>
        <Typography variant="caption" color="text.secondary">
          The queue is ordered by participant join time.
        </Typography>
      </Box>
    </Stack>
  );
}

export function GuestsPanel({
  participants,
  sessionId,
}: {
  participants: SessionParticipant[];
  sessionId: string;
}) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  async function addGuest() {
    if (!nickname.trim()) return;
    try {
      await addHostParticipant(sessionId, nickname);
      setNickname("");
    } catch {
      setError("Could not add this guest.");
    }
  }
  async function toggleGuest(participant: SessionParticipant) {
    try {
      await setParticipantVisibility(
        sessionId,
        participant.id,
        !participant.visibility,
      );
    } catch {
      setError("Could not update this guest.");
    }
  }
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ bgcolor: "secondary.main" }}>H</Avatar>
        <Box>
          <Typography fontWeight={700}>Host</Typography>
          <Typography variant="caption" color="text.secondary">
            Running the room
          </Typography>
        </Box>
        <Chip label="You" size="small" sx={{ ml: "auto" }} />
      </Stack>
      {participants.map((participant, index) => (
        <Stack
          key={participant.id}
          direction="row"
          spacing={1.2}
          alignItems="center"
          sx={{ opacity: participant.visibility ? 1 : 0.5, py: 1 }}
        >
          <Typography variant="caption" color="text.disabled">
            #{index + 1}
          </Typography>
          <Avatar sx={{ width: 34, height: 34 }}>
            {participant.nickname[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              sx={{
                textDecoration: participant.visibility
                  ? "none"
                  : "line-through",
              }}
            >
              {participant.nickname}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {participant.visibility ? "Available" : "Skipped / unavailable"}
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => void toggleGuest(participant)}
            color={participant.visibility ? "warning" : "success"}
          >
            {participant.visibility ? "Skip" : "Restore"}
          </Button>
          <IconButton size="small" color="inherit">
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Divider sx={{ borderColor: "rgba(255,255,255,.1)" }} />
      <Typography variant="subtitle2">Add someone without a phone</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          placeholder="Guest nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <Button
          onClick={() => void addGuest()}
          variant="contained"
          disabled={!nickname.trim()}
        >
          Add
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

export function SharePanel({
  code,
  inviteUrl,
}: {
  code: string;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copyInvite() {
    await copyText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }
  return (
    <Stack spacing={3} alignItems="center" textAlign="center">
      <Typography color="text.secondary">
        Scan the code or send this link to your guests.
      </Typography>
      <Box sx={{ p: 2, bgcolor: "white", borderRadius: 2 }}>
        <QRCodeSVG value={inviteUrl} size={190} />
      </Box>
      <Typography variant="h5" fontWeight={700} letterSpacing=".12em">
        {code}
      </Typography>
      <Button
        onClick={() => void copyInvite()}
        fullWidth
        variant="outlined"
        color={copied ? "success" : "inherit"}
        startIcon={<ContentCopyRoundedIcon />}
      >
        {copied ? "Copied to clipboard" : "Copy invite link"}
      </Button>
    </Stack>
  );
}
