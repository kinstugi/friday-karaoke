import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import { useAuth } from "../context/AuthContext";
import { createSession } from "../lib/sessions";

function CreateSessionPage({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createSession(user.uid, title);
      onCreated();
    } catch {
      setError(
        "We could not create the room. Make sure Firestore is enabled for this project.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        py: 4,
        bgcolor: "#17101f",
        color: "white",
      }}
    >
      <Container maxWidth="sm">
        <Button
          onClick={onBack}
          startIcon={<ArrowBackRoundedIcon />}
          color="inherit"
          sx={{ mb: 3 }}
        >
          Back to dashboard
        </Button>
        <Paper
          component="form"
          onSubmit={submit}
          elevation={0}
          sx={{
            p: { xs: 3, sm: 5 },
            bgcolor: "background.paper",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 3,
          }}
        >
          <Stack spacing={3}>
            <Stack spacing={1} alignItems="center" textAlign="center">
              <CelebrationRoundedIcon
                sx={{ color: "primary.main", fontSize: 42 }}
              />
              <Typography variant="h4" fontWeight={700}>
                Create a new room
              </Typography>
              <Typography color="text.secondary">
                Give your karaoke night a name. You can invite guests once it’s
                created.
              </Typography>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              autoFocus
              required
              fullWidth
              label="Session name"
              placeholder="Friday Night Singalong"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving || !title.trim()}
            >
              {saving ? "Creating room…" : "Create room"}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default CreateSessionPage;
