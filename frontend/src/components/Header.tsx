import { Box, Button, Container, Link, Stack, Typography } from "@mui/material";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";

function Header({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <Box component="header" sx={{ py: 2.5 }}>
      <Container maxWidth="lg">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <GraphicEqRoundedIcon
              sx={{ color: "primary.main", fontSize: 28 }}
            />
            <Typography variant="h6" fontWeight={700}>
              Singalong
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={4}
            alignItems="center"
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            <Link href="#features" color="text.secondary" underline="none">
              Features
            </Link>
            <Link href="#how-it-works" color="text.secondary" underline="none">
              How it works
            </Link>
            <Button
              onClick={onOpenAuth}
              variant="outlined"
              color="inherit"
              size="small"
              sx={{ borderColor: "rgba(255,255,255,.25)" }}
            >
              Sign in
            </Button>
          </Stack>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            sx={{
              display: { xs: "block", md: "none" },
              borderColor: "rgba(255,255,255,.25)",
            }}
          >
            Menu
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

export default Header;
