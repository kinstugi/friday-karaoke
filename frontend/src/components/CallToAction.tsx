import { Box, Button, Container, Stack, Typography } from "@mui/material";
function CallToAction({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <Container maxWidth="lg" sx={{ pb: 12 }}>
      <Box
        sx={{
          p: { xs: 4, md: 7 },
          borderRadius: 4,
          textAlign: "center",
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: "2.3rem", md: "3.5rem" } }}
          >
            Ready to make some noise?
          </Typography>
          <Typography sx={{ opacity: 0.75 }}>
            Your next karaoke night is one click away.
          </Typography>
          <Button
            onClick={onOpenAuth}
            variant="contained"
            color="secondary"
            size="large"
            sx={{ mt: 1, color: "white" }}
          >
            Create a free session
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
export default CallToAction;
