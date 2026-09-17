import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";

function Hero({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 8, md: 5 }} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <Chip
                icon={<AutoAwesomeRoundedIcon />}
                label="THE SOCIAL KARAOKE APP"
                sx={{
                  width: "fit-content",
                  bgcolor: "rgba(255,202,95,.12)",
                  color: "primary.main",
                  "& .MuiChip-icon": { color: "primary.main" },
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "3.5rem", md: "5.6rem" },
                  lineHeight: 0.98,
                  letterSpacing: "-.065em",
                }}
              >
                Your night.
                <br />
                <Box component="span" sx={{ color: "primary.main" }}>
                  Your stage.
                </Box>
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                fontWeight={400}
                sx={{ maxWidth: 450, lineHeight: 1.6 }}
              >
                Turn any get-together into a singalong. Build the queue, grab
                the mic, and make memories worth replaying.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  onClick={onOpenAuth}
                  size="large"
                  variant="contained"
                  endIcon={<PlayArrowRoundedIcon />}
                  sx={{ px: 3 }}
                >
                  Start a session
                </Button>
                <Button
                  href="#how-it-works"
                  size="large"
                  variant="text"
                  color="inherit"
                  sx={{ px: 2 }}
                >
                  See how it works
                </Button>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <QueuePreview />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function QueuePreview() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 4 },
        maxWidth: 480,
        ml: "auto",
        bgcolor: "background.paper",
        border: "1px solid rgba(255,255,255,.1)",
        transform: { md: "rotate(2deg)" },
        boxShadow: "0 30px 80px rgba(0,0,0,.25)",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <QueueMusicRoundedIcon color="secondary" />
          <Typography variant="h6" fontWeight={700}>
            Tonight's queue
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          04 songs
        </Typography>
      </Stack>
      <Box
        sx={{
          p: 2,
          mb: 1.5,
          borderRadius: 2,
          bgcolor: "rgba(236,113,151,.13)",
          borderLeft: "3px solid",
          borderColor: "secondary.main",
        }}
      >
        <Typography variant="overline" color="secondary.main">
          NOW SINGING
        </Typography>
        <Typography fontWeight={700}>Don't Stop Believin'</Typography>
        <Typography variant="body2" color="text.secondary">
          Journey · Alex
        </Typography>
      </Box>
      {[
        ["01", "Dancing Queen", "ABBA", "Maya"],
        ["02", "Mr. Brightside", "The Killers", "Jordan"],
        ["03", "I Wanna Dance with Somebody", "Whitney Houston", "Open"],
      ].map(([number, title, artist, singer]) => (
        <Stack
          key={title}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ py: 2, borderBottom: "1px solid rgba(255,255,255,.08)" }}
        >
          <Typography variant="caption" color="text.disabled">
            {number}
          </Typography>
          <Box flex={1}>
            <Typography variant="body2" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {artist}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {singer}
          </Typography>
        </Stack>
      ))}
      <Button fullWidth sx={{ mt: 2 }} color="secondary">
        + Add a song
      </Button>
    </Paper>
  );
}

export default Hero;
