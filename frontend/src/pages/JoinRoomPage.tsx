import { useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LibraryMusicRoundedIcon from "@mui/icons-material/LibraryMusicRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useSwipeable } from "react-swipeable";
import { useAuth } from "../context/AuthContext";
import {
  addSong,
  deleteSong,
  findSessionByCode,
  joinSession,
  setParticipantVisibility,
  type SessionParticipant,
  type SessionSong,
} from "../lib/sessions";
import { useParticipantSongs } from "../hooks/useParticipantSongs";
import { useSessionParticipants } from "../hooks/useSessionParticipants";
import { useSessionState } from "../hooks/useSessionState";

function JoinRoomPage({ code, onBack }: { code: string; onBack: () => void }) {
  const { signInAnonymously } = useAuth();
  const [nickname, setNickname] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) return;
    setLoading(true);
    setError("");
    try {
      const anonymousUser = await signInAnonymously();
      const session = await findSessionByCode(code);
      if (!session) {
        setError(
          "That room could not be found. Check the invite link and try again.",
        );
        return;
      }
      await joinSession(session.id, anonymousUser.uid, nickname);
      setParticipantId(anonymousUser.uid);
      setSessionId(session.id);
      setRoomTitle(session.title);
      setJoined(true);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join this room.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (joined)
    return (
      <ParticipantRoom
        title={roomTitle}
        code={code}
        nickname={nickname}
        sessionId={sessionId}
        participantId={participantId}
      />
    );
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        py: 4,
        bgcolor: "#17101f",
        color: "white",
        background:
          "radial-gradient(circle at 80% 20%, #452350 0, transparent 32%), #17101f",
      }}
    >
      <Container maxWidth="sm">
        <Button
          onClick={onBack}
          startIcon={<ArrowBackRoundedIcon />}
          color="inherit"
          sx={{ mb: 3 }}
        >
          Back to home
        </Button>
        <Paper
          component="form"
          onSubmit={joinRoom}
          elevation={0}
          sx={{
            p: { xs: 3, sm: 5 },
            bgcolor: "background.paper",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 3,
          }}
        >
          <Stack spacing={3} alignItems="center">
            <GraphicEqRoundedIcon
              sx={{ color: "primary.main", fontSize: 42 }}
            />
            <Typography variant="h4" fontWeight={700} textAlign="center">
              Join the singalong
            </Typography>
            <Typography color="text.secondary" textAlign="center">
              You’re joining room <strong>{code.toUpperCase()}</strong>. No
              account needed.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              required
              fullWidth
              label="Choose a nickname"
              placeholder="e.g. Karaoke Queen"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              inputProps={{ maxLength: 24 }}
              helperText="This is how other guests will see you."
            />
            <Button
              type="submit"
              fullWidth
              size="large"
              variant="contained"
              disabled={loading || !nickname.trim()}
            >
              {loading ? "Joining room…" : "Join room"}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

const queue = [
  {
    title: "Don’t Stop Believin’",
    artist: "Journey",
    singer: "Alex",
    color: "#ec7197",
  },
  { title: "Dancing Queen", artist: "ABBA", singer: "Maya", color: "#ffca5f" },
  {
    title: "Mr. Brightside",
    artist: "The Killers",
    singer: "Jordan",
    color: "#8f7bff",
  },
];

function ParticipantRoom({
  title,
  code,
  nickname,
  sessionId,
  participantId,
}: {
  title: string;
  code: string;
  nickname: string;
  sessionId: string;
  participantId: string;
}) {
  const { participants, error: participantsError } =
    useSessionParticipants(sessionId);
  const { activeParticipantId } = useSessionState(sessionId);
  const { songs: personalSongs, error: personalSongsError } =
    useParticipantSongs(sessionId, participantId);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [songError, setSongError] = useState("");
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleFetchFailed, setTitleFetchFailed] = useState(false);
  const [added, setAdded] = useState(false);
  const visibleSongs = tab === 0 ? [] : personalSongs;
  const activeParticipant = participants.find(
    (participant) =>
      participant.id === activeParticipantId && participant.visibility,
  );
  const activeParticipants = participants.filter(
    (participant) => participant.visibility,
  );
  const participantPosition = activeParticipants.findIndex(
    (participant) => participant.id === participantId,
  );
  const peopleAhead = participantPosition < 0 ? 0 : participantPosition;
  const isYourTurn = activeParticipant?.id === participantId;

  async function toggleAvailability() {
    if (!participantId || saving) return;
    const nextValue = !available;
    setSaving(true);
    try {
      await setParticipantVisibility(sessionId, participantId, nextValue);
      setAvailable(nextValue);
    } finally {
      setSaving(false);
    }
  }
  async function fetchSongTitle() {
    if (!songUrl.trim() || titleLoading) return;
    setTitleLoading(true);
    setTitleFetchFailed(false);
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(songUrl.trim())}&format=json`,
      );
      if (!response.ok) throw new Error("Could not find video");
      const data = (await response.json()) as { title?: string };
      if (!data.title) throw new Error("Video title was not returned");
      setSongTitle(data.title);
    } catch {
      setTitleFetchFailed(true);
    } finally {
      setTitleLoading(false);
    }
  }

  async function submitSong() {
    if (!participantId || !songTitle.trim() || !songUrl.trim()) return;
    setSaving(true);
    setSongError("");
    try {
      await addSong(sessionId, participantId, nickname, songTitle, songUrl);
      setSongTitle("");
      setSongUrl("");
      setTitleFetchFailed(false);
      setAddOpen(false);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    } catch {
      setSongError("Could not add this song. Check the link and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      sx={{ minHeight: "100vh", bgcolor: "#0d0a12", color: "white", pb: 10 }}
    >
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          bgcolor: "rgba(13,10,18,.94)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ minHeight: 64, gap: 2 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
              <GraphicEqRoundedIcon sx={{ color: "primary.main" }} />
              <Typography fontWeight={700} noWrap>
                {title}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                onClick={() => void toggleAvailability()}
                disabled={saving}
                size="small"
                variant="outlined"
                color={available ? "success" : "warning"}
              >
                {available ? "Available" : "On break"}
              </Button>
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  bgcolor: "secondary.main",
                  fontSize: 13,
                }}
              >
                {nickname[0].toUpperCase()}
              </Avatar>
            </Stack>
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ pt: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 3,
            bgcolor: "#21152a",
            border: "1px solid rgba(255,255,255,.1)",
            background: "linear-gradient(110deg, #30203d, #1e1427)",
          }}
        >
          <Stack spacing={1}>
            <Typography
              variant="overline"
              color="secondary.main"
              letterSpacing=".14em"
            >
              ROOM STATUS
            </Typography>
            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ fontSize: { xs: "1.8rem", md: "2.5rem" } }}
            >
              {isYourTurn
                ? "You’re singing now!"
                : activeParticipant
                  ? `${activeParticipant.nickname} is singing`
                  : peopleAhead === 0
                    ? "You’re next"
                    : `${peopleAhead} ${peopleAhead === 1 ? "person" : "people"} ahead of you`}
            </Typography>
            <Typography color="text.secondary">
              {isYourTurn
                ? "This is your moment — give it everything."
                : activeParticipant
                  ? "Keep the good vibes going — you’re coming up soon."
                  : "Your place is based on the order you joined the room."}
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 0.7,
                alignItems: "end",
                pt: 2,
                height: 48,
                "@keyframes roomPulse": {
                  "0%, 100%": { transform: "scaleY(.55)", opacity: 0.55 },
                  "50%": { transform: "scaleY(1)", opacity: 1 },
                },
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                <Box
                  key={bar}
                  sx={{
                    width: 5,
                    height: 22 + ((bar * 11) % 22),
                    borderRadius: 2,
                    bgcolor:
                      bar < 4 ? "secondary.main" : "rgba(255,255,255,.16)",
                    transformOrigin: "bottom",
                    animation: "roomPulse 1.1s ease-in-out infinite",
                    animationDelay: `${bar * 0.08}s`,
                  }}
                />
              ))}
            </Box>
          </Stack>
        </Paper>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="end"
          sx={{ mt: 5, mb: 2 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {tab === 0 ? "Room queue" : "My playlist"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tab === 0
                ? "Your place in the singing order"
                : "Songs you added to this room"}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {tab === 0
              ? `${participants.length} singers`
              : `${visibleSongs.length} songs`}
          </Typography>
        </Stack>
        {(participantsError || personalSongsError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Could not load room data: {participantsError || personalSongsError}
          </Alert>
        )}
        <List disablePadding>
          {tab === 0 ? (
            participants.length === 0 ? (
              <Typography
                color="text.secondary"
                sx={{ py: 6, textAlign: "center" }}
              >
                No participants have joined yet.
              </Typography>
            ) : (
              participants.map((participant, index) => (
                <ParticipantQueueItem
                  key={participant.id}
                  participant={participant}
                  index={index}
                  isSelf={participant.id === participantId}
                />
              ))
            )
          ) : visibleSongs.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ py: 6, textAlign: "center" }}
            >
              No songs here yet. Be the first to add one.
            </Typography>
          ) : (
            visibleSongs.map((song, index) => (
              <ParticipantSongItem
                key={song.id}
                song={song}
                index={index}
                sessionId={sessionId}
                participantId={participantId}
                canDelete={tab === 1}
                onDeleted={() => setAdded(false)}
              />
            ))
          )}
        </List>
        {added && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Song added to the queue.
          </Alert>
        )}
      </Container>
      <Fab
        color="secondary"
        aria-label="add a song"
        onClick={() => setAddOpen(true)}
        sx={{
          position: "fixed",
          right: { xs: 20, md: 36 },
          bottom: 78,
          zIndex: 3,
          color: "white",
        }}
      >
        <AddRoundedIcon />
      </Fab>
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          bgcolor: "#1a111f",
          borderTop: "1px solid rgba(255,255,255,.1)",
          borderRadius: 0,
        }}
      >
        <Container maxWidth="sm">
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="fullWidth"
            textColor="secondary"
            indicatorColor="secondary"
          >
            <Tab icon={<QueueMusicRoundedIcon />} label="Queue" />
            <Tab icon={<LibraryMusicRoundedIcon />} label="My playlist" />
          </Tabs>
        </Container>
      </Paper>
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add a song</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add a YouTube song for everyone in the room.
          </Typography>
          {songError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {songError}
            </Alert>
          )}
          <Stack spacing={2}>
            {titleFetchFailed && (
              <TextField
                autoFocus
                fullWidth
                required
                label="Song title"
                placeholder="Enter the song title manually"
                value={songTitle}
                onChange={(event) => setSongTitle(event.target.value)}
                helperText="We could not fetch the title. Add it manually."
              />
            )}
            <TextField
              fullWidth
              required
              label="YouTube URL"
              placeholder="https://youtube.com/watch?v=..."
              value={songUrl}
              onChange={(event) => {
                setSongUrl(event.target.value);
                setSongTitle("");
                setTitleFetchFailed(false);
              }}
              onBlur={() => void fetchSongTitle()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
                endAdornment: titleLoading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} />
                  </InputAdornment>
                ) : undefined,
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => void submitSong()}
            disabled={saving || !songTitle.trim() || !songUrl.trim()}
            variant="contained"
            startIcon={<SendRoundedIcon />}
          >
            {saving ? "Adding…" : "Add to queue"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ParticipantQueueItem({
  participant,
  index,
  isSelf,
}: {
  participant: SessionParticipant;
  index: number;
  isSelf: boolean;
}) {
  const active = participant.visibility;
  return (
    <ListItem
      disableGutters
      sx={{
        py: 1.7,
        opacity: active ? 1 : 0.45,
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <ListItemAvatar>
        <Avatar
          sx={{
            bgcolor: active
              ? ["#ec7197", "#ffca5f", "#8f7bff"][index % 3]
              : "rgba(255,255,255,.15)",
            color: active ? "#17101f" : "text.secondary",
            fontWeight: 700,
          }}
        >
          {index + 1}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={participant.nickname}
        secondary={active ? "In the singing order" : "Currently unavailable"}
        primaryTypographyProps={{
          fontWeight: 700,
          sx: { textDecoration: active ? "none" : "line-through" },
        }}
        secondaryTypographyProps={{
          color: active ? "text.secondary" : "warning.main",
        }}
      />
      {isSelf && <Chip label="You" size="small" color="secondary" />}
    </ListItem>
  );
}

function ParticipantSongItem({
  song,
  index,
  sessionId,
  participantId,
  canDelete,
  onDeleted,
}: {
  song: SessionSong;
  index: number;
  sessionId: string;
  participantId: string;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const handlers = useSwipeable({
    onSwiping: ({ deltaX }) => setOffset(Math.min(0, Math.max(-90, deltaX))),
    onSwipedLeft: () => {
      if (canDelete) void removeSong();
    },
    onSwiped: () => setOffset(0),
    trackTouch: true,
    trackMouse: false,
  });

  async function removeSong() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteSong(sessionId, participantId, song.id);
      onDeleted();
    } finally {
      setDeleting(false);
      setOffset(0);
    }
  }

  return (
    <Box {...handlers} sx={{ position: "relative", overflow: "hidden" }}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          pr: 2,
          bgcolor: "rgba(236,113,151,.16)",
          color: "secondary.main",
        }}
      >
        <DeleteOutlineRoundedIcon />
      </Box>
      <ListItem
        disableGutters
        sx={{
          position: "relative",
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? "transform .2s" : "none",
          py: 1.7,
          px: 1,
          bgcolor: "#0d0a12",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <ListItemAvatar>
          <Avatar
            sx={{
              bgcolor: ["#ec7197", "#ffca5f", "#8f7bff"][index % 3],
              color: "#17101f",
              fontWeight: 700,
            }}
          >
            {index + 1}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={song.title}
          secondary={`${song.requesterName} · ${song.status}`}
          primaryTypographyProps={{ fontWeight: 700 }}
          secondaryTypographyProps={{
            color: "text.secondary",
            sx: { textTransform: "capitalize" },
          }}
        />
        {canDelete && (
          <IconButton
            onClick={() => void removeSong()}
            disabled={deleting}
            aria-label={`delete ${song.title}`}
            color="secondary"
          >
            <DeleteOutlineRoundedIcon />
          </IconButton>
        )}
      </ListItem>
    </Box>
  );
}

export default JoinRoomPage;
