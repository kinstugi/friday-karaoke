import { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  Fab,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandRoundedIcon from "@mui/icons-material/ExpandRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import { useSessionParticipants } from "../hooks/useSessionParticipants";
import {
  deleteParticipant,
  setParticipantVisibility,
  setSessionNowSinging,
  type SessionParticipant,
} from "../lib/sessions";
import ParticipantList, { moveItem } from "../components/room/ParticipantList";
import RoomActionCard from "../components/room/RoomActionCard";
import {
  GuestsPanel,
  QueuePanel,
  SharePanel,
} from "../components/room/RoomPanels";

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
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<
    string | null
  >(null);
  const inviteUrl = `${window.location.origin}/join/${code}`;
  const openPanel = (nextPanel: Panel) =>
    setPanel(panel === nextPanel ? null : nextPanel);

  useEffect(() => {
    setOrderedIds((currentIds) => [
      ...currentIds.filter((id) =>
        participants.some((participant) => participant.id === id),
      ),
      ...participants
        .filter((participant) => !currentIds.includes(participant.id))
        .map((participant) => participant.id),
    ]);
  }, [participants]);

  const orderedParticipants = orderedIds
    .map((id) => participants.find((participant) => participant.id === id))
    .filter((participant): participant is SessionParticipant =>
      Boolean(participant),
    );
  const startSession = () => {
    const firstAvailable = orderedParticipants.find(
      (participant) => participant.visibility,
    );
    if (firstAvailable) {
      setCurrentParticipantId(firstAvailable.id);
      void setSessionNowSinging(sessionId, firstAvailable.id);
    }
  };
  const nextParticipant = () => {
    const availableParticipants = orderedParticipants.filter(
      (participant) => participant.visibility,
    );
    if (!availableParticipants.length) return;
    const currentIndex = availableParticipants.findIndex(
      (participant) => participant.id === currentParticipantId,
    );
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + 1) % availableParticipants.length;
    setCurrentParticipantId(availableParticipants[nextIndex].id);
    void setSessionNowSinging(sessionId, availableParticipants[nextIndex].id);
  };

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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
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
          p: { xs: 2, md: 6 },
          background:
            "radial-gradient(circle at 50% 15%, #281933 0, transparent 42%)",
        }}
      >
        <Stack spacing={3} sx={{ maxWidth: 900, mx: "auto" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "flex-end" }}
            spacing={2}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary.main"
                letterSpacing=".15em"
              >
                HOST CONTROL ROOM
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  mt: 1,
                  fontSize: { xs: "2.35rem", md: "3.7rem" },
                  letterSpacing: "-.06em",
                }}
              >
                Singing order
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Drag guests into the order you want them to sing.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<GroupRoundedIcon />}
                label={`${orderedParticipants.length} joined`}
                sx={{ color: "white", bgcolor: "rgba(255,255,255,.08)" }}
              />
              <Button
                onClick={startSession}
                disabled={orderedParticipants.length === 0}
                variant={currentParticipantId ? "outlined" : "contained"}
                color="primary"
              >
                {currentParticipantId ? "Session started" : "Start session"}
              </Button>
              <Button
                onClick={nextParticipant}
                disabled={
                  !currentParticipantId ||
                  !orderedParticipants.some(
                    (participant) => participant.visibility,
                  )
                }
                variant="contained"
                color="secondary"
                endIcon={<SkipNextRoundedIcon />}
              >
                Next singer
              </Button>
            </Stack>
          </Stack>
          {orderedParticipants.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 7,
                textAlign: "center",
                bgcolor: "rgba(255,255,255,.04)",
                border: "1px dashed rgba(255,255,255,.18)",
              }}
            >
              <GroupRoundedIcon
                sx={{ fontSize: 44, color: "text.secondary" }}
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Waiting for your first guest
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Share the room link to get your singers in here.
              </Typography>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                bgcolor: "rgba(255,255,255,.045)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <Stack
                direction="row"
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: "1px solid rgba(255,255,255,.1)",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 5 }}
                >
                  PARTICIPANT
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: "auto", mr: 2 }}
                >
                  STATUS
                </Typography>
              </Stack>
              <ParticipantList
                participants={orderedParticipants}
                currentParticipantId={currentParticipantId}
                onMove={(index, direction) =>
                  setOrderedIds((ids) => moveItem(ids, index, direction))
                }
                onToggle={(participant) =>
                  setParticipantVisibility(
                    sessionId,
                    participant.id,
                    !participant.visibility,
                  )
                }
                onDelete={(participant) =>
                  deleteParticipant(sessionId, participant.id)
                }
              />
            </Paper>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <RoomActionCard
                icon={<QueueMusicRoundedIcon />}
                title="Manage queue"
                subtitle={`${orderedParticipants.filter((participant) => participant.visibility).length} active singers`}
                onClick={() => openPanel("queue")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <RoomActionCard
                icon={<ShareRoundedIcon />}
                title="Invite guests"
                subtitle="Share room link & QR"
                onClick={() => openPanel("share")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <RoomActionCard
                icon={<StopCircleRoundedIcon />}
                title="End session"
                subtitle="Close this room"
                danger
                onClick={() => setEndOpen(true)}
              />
            </Grid>
          </Grid>
        </Stack>
      </Box>
      <Fab
        color="secondary"
        aria-label="add guest"
        onClick={() => openPanel("guests")}
        sx={{
          position: "fixed",
          right: { xs: 20, md: 36 },
          bottom: 86,
          zIndex: 2,
        }}
      >
        <AddRoundedIcon />
      </Fab>
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
          Host controls · Guest management
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
          <QueuePanel participants={participants} />
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

export default RoomPage;
