import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";

const features = [
  {
    icon: <LinkRoundedIcon />,
    title: "One simple link",
    text: "Share your room with friends. No downloads, no accounts, no friction.",
  },
  {
    icon: <GroupsRoundedIcon />,
    title: "Everyone gets a turn",
    text: "Let the group add songs and vote on what should play next.",
  },
  {
    icon: <CelebrationRoundedIcon />,
    title: "All the good vibes",
    text: "Keep the energy up with a queue made for your crew.",
  },
];

function Features() {
  return (
    <Box
      id="features"
      component="section"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: "rgba(255,255,255,.025)" }}
    >
      <Container maxWidth="lg">
        <Typography
          variant="overline"
          color="primary.main"
          letterSpacing=".15em"
        >
          MADE FOR THE MOMENT
        </Typography>
        <Typography
          variant="h2"
          sx={{ mt: 1, mb: 5, fontSize: { xs: "2.4rem", md: "3.4rem" } }}
        >
          Everything you need
          <br />
          to own the mic.
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, md: 4 }}>
              <Stack
                spacing={2}
                sx={{
                  p: 3,
                  height: "100%",
                  border: "1px solid rgba(255,255,255,.09)",
                  borderRadius: 3,
                }}
              >
                <Box sx={{ color: "secondary.main" }}>{feature.icon}</Box>
                <Typography variant="h6" fontWeight={700}>
                  {feature.title}
                </Typography>
                <Typography color="text.secondary" lineHeight={1.7}>
                  {feature.text}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

export default Features;
