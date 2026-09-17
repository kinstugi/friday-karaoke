import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandRoundedIcon from "@mui/icons-material/ExpandRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { QRCodeSVG } from "qrcode.react";
import { useSessionParticipants } from "../hooks/useSessionParticipants";
import { useSessionSongs } from "../hooks/useSessionSongs";
import {
  addHostParticipant,
  getQueueSongs,
  setParticipantVisibility,
  type SessionParticipant,
  type SessionSong,
} from "../lib/sessions";
import { copyText } from "../lib/clipboard";

type Panel = "queue" | "guests" | "share" | null;

function RoomPage({
  title,
  code,
  sessionId,
  onExit,
}: {
  title: string;
  code: string;
  sessionId: string;
  onExit: () => void;
}) {
  const { participants } = useSessionParticipants(sessionId);
  const { songs } = useSessionSongs(sessionId);
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const inviteUrl = `${window.location.origin}/join/${code}`;
  const openPanel = (nextPanel: Panel) =>
    setPanel(panel === nextPanel ? null : nextPanel);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0d0a12",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="header"
        sx={{
          height: 72,
          px: { xs: 2, md: 4 },
          borderBottom: "1px solid rgba(255,255,255,.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <GraphicEqRoundedIcon sx={{ color: "primary.main" }} />
          <Box>
            <Typography fontWeight={700}>{title}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "#6fe3a0",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Live room · {code}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Guests">
            <IconButton onClick={() => openPanel("guests")} color="inherit">
              <GroupRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Queue">
            <IconButton onClick={() => openPanel("queue")} color="inherit">
              <QueueMusicRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share room">
            <IconButton onClick={() => openPanel("share")} color="inherit">
              <ShareRoundedIcon />
            </IconButton>
          </Tooltip>
          <Button
            onClick={() => setEndOpen(true)}
            color="secondary"
            variant="outlined"
            size="small"
            startIcon={<StopCircleRoundedIcon />}
            sx={{ ml: 1, display: { xs: "none", sm: "inline-flex" } }}
          >
            End session
          </Button>
          <IconButton
            onClick={() => setEndOpen(true)}
            color="secondary"
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
          >
            <StopCircleRoundedIcon />
          </IconButton>
        </Stack>
      </Box>
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          p: 3,
          background:
            "radial-gradient(circle at 50% 40%, #281933 0, transparent 42%)",
        }}
      >
        <Stack alignItems="center" spacing={3} sx={{ maxWidth: 700 }}>
          <Chip
            label="UP NEXT"
            sx={{
              color: "secondary.main",
              bgcolor: "rgba(236,113,151,.12)",
              letterSpacing: ".12em",
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.7rem", md: "5rem" },
              letterSpacing: "-.06em",
            }}
          >
            The stage is
            <br />
            <Box component="span" sx={{ color: "primary.main" }}>
              yours.
            </Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400}>
            Lyrics will appear here when the first song starts.
          </Typography>
          <Paper
            elevation={0}
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: "rgba(255,255,255,.06)",
              color: "text.secondary",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <Typography variant="body2">
              Add a song to get the room moving
            </Typography>
          </Paper>
        </Stack>
      </Box>
      <Box
        component="footer"
        sx={{
          px: { xs: 2, md: 4 },
          py: 2,
          borderTop: "1px solid rgba(255,255,255,.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Host controls · Lyrics mode
        </Typography>
        <Stack direction="row" spacing={1}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: "secondary.main",
              fontSize: 12,
            }}
          >
            H
          </Avatar>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ alignSelf: "center" }}
          >
            You’re hosting
          </Typography>
        </Stack>
      </Box>
      <Drawer
        anchor="right"
        open={panel !== null}
        onClose={() => setPanel(null)}
        PaperProps={{
          sx: {
            width: expanded ? "100vw" : { xs: "100vw", sm: 400 },
            bgcolor: "#20152a",
            color: "white",
            p: 3,
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h5" fontWeight={700}>
            {panel === "queue"
              ? "Song queue"
              : panel === "guests"
                ? "In the room"
                : "Share your room"}
          </Typography>
          <Stack direction="row">
            <IconButton onClick={() => setExpanded(!expanded)} color="inherit">
              <ExpandRoundedIcon />
            </IconButton>
            <IconButton onClick={() => setPanel(null)} color="inherit">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </Stack>
        <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,.1)" }} />
        {panel === "queue" ? (
          <QueuePanel songs={songs} />
        ) : panel === "guests" ? (
          <GuestsPanel participants={participants} sessionId={sessionId} />
        ) : (
          <SharePanel code={code} inviteUrl={inviteUrl} />
        )}
      </Drawer>
      {endOpen && (
        <Drawer
          anchor="bottom"
          open
          onClose={() => setEndOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: "#24152f",
              color: "white",
              p: 3,
              borderRadius: "20px 20px 0 0",
            },
          }}
        >
          <Stack spacing={2} alignItems="center">
            <StopCircleRoundedIcon color="secondary" fontSize="large" />
            <Typography variant="h5" fontWeight={700}>
              End this session?
            </Typography>
            <Typography color="text.secondary">
              Your room will close for everyone currently in it.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setEndOpen(false)} color="inherit">
                Keep singing
              </Button>
              <Button onClick={onExit} color="secondary" variant="contained">
                End session
              </Button>
            </Stack>
          </Stack>
        </Drawer>
      )}
    </Box>
  );
}

function QueuePanel({ songs }: { songs: SessionSong[] }) {
  const queueSongs = getQueueSongs(songs);
  return (
    <Stack spacing={2}>
      {queueSongs.length === 0 ? (
        <Typography color="text.secondary">
          No songs have been added yet.
        </Typography>
      ) : (
        queueSongs.map((song, index) => (
          <Stack
            key={song.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ py: 1.3, borderBottom: "1px solid rgba(255,255,255,.08)" }}
          >
            <Typography variant="caption" color="text.disabled">
              #{index + 1}
            </Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap fontWeight={700}>
                {song.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {song.requesterName}
              </Typography>
            </Box>
          </Stack>
        ))
      )}
      <Button variant="contained" startIcon={<QueueMusicRoundedIcon />}>
        Add the first song
      </Button>
      <Box
        sx={{ mt: 2, p: 2, bgcolor: "rgba(255,255,255,.05)", borderRadius: 2 }}
      >
        <Typography variant="body2" fontWeight={700}>
          Tip
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Guests can add songs from their phones using the room link.
        </Typography>
      </Box>
    </Stack>
  );
}
function GuestsPanel({
  participants,
  sessionId,
}: {
  participants: SessionParticipant[];
  sessionId: string;
}) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function addGuest() {
    if (!nickname.trim()) return;
    setSaving(true);
    setError("");
    try {
      await addHostParticipant(sessionId, nickname);
      setNickname("");
    } catch {
      setError("Could not add this guest.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSkip(participant: SessionParticipant) {
    setError("");
    const nextVisibility = participant.visibility === false;
    try {
      await setParticipantVisibility(sessionId, participant.id, nextVisibility);
      setFeedback(
        nextVisibility
          ? `${participant.nickname} was restored.`
          : `${participant.nickname} was skipped.`,
      );
    } catch (skipError) {
      console.error("Could not update participant visibility:", skipError);
      setError(
        skipError instanceof Error
          ? skipError.message
          : "Could not update this guest.",
      );
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
      {participants.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Waiting for guests to join…
        </Typography>
      ) : (
        <Stack spacing={1}>
          {participants.map((participant, index) => (
            <Stack
              key={participant.id}
              direction="row"
              spacing={1.2}
              alignItems="center"
              sx={{
                py: 1,
                px: 1,
                borderRadius: 2,
                opacity: participant.visibility ? 1 : 0.5,
                bgcolor: participant.visibility
                  ? "transparent"
                  : "rgba(255,255,255,.05)",
              }}
            >
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ width: 18 }}
              >
                #{index + 1}
              </Typography>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor:
                    participant.visibility === false
                      ? "rgba(255,255,255,.15)"
                      : "primary.main",
                  color:
                    participant.visibility === false
                      ? "text.secondary"
                      : "#17101f",
                  fontSize: 14,
                }}
              >
                {participant.nickname[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    textDecoration:
                      participant.visibility === false
                        ? "line-through"
                        : "none",
                  }}
                >
                  {participant.nickname}
                </Typography>
                <Typography
                  variant="caption"
                  color={
                    participant.visibility === false
                      ? "warning.main"
                      : "text.secondary"
                  }
                >
                  {participant.visibility === false
                    ? "Skipped / unavailable"
                    : participant.addedByHost
                      ? "Added by host"
                      : "In the singing order"}
                </Typography>
              </Box>
              <Button
                onClick={() => void toggleSkip(participant)}
                size="small"
                color={participant.visibility === false ? "success" : "warning"}
              >
                {participant.visibility === false ? "Restore" : "Skip"}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
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
          disabled={saving || !nickname.trim()}
        >
          Add
        </Button>
      </Stack>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={2200}
        onClose={() => setFeedback("")}
      >
        <Alert
          onClose={() => setFeedback("")}
          severity="success"
          variant="filled"
        >
          {feedback}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function SharePanel({ code, inviteUrl }: { code: string; inviteUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copyInvite() {
    try {
      await copyText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
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
      <Box sx={{ width: "100%" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1, wordBreak: "break-all" }}
        >
          {inviteUrl}
        </Typography>
        <Button
          onClick={() => void copyInvite()}
          fullWidth
          variant="outlined"
          color={copied ? "success" : "inherit"}
          startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
        >
          {copied ? "Copied to clipboard" : "Copy invite link"}
        </Button>
      </Box>
    </Stack>
  );
}

export default RoomPage;
