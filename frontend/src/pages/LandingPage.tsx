import { Box } from "@mui/material";
import Header from "../components/Header";
import Hero from "../components/Hero";
import Features from "../components/Features";
import HowItWorks from "../components/HowItWorks";
import CallToAction from "../components/CallToAction";
import Footer from "../components/Footer";

function LandingPage({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <Box
      sx={{
        overflow: "hidden",
        background:
          "radial-gradient(circle at 84% 8%, #452350 0, transparent 28%), #17101f",
      }}
    >
      <Header onOpenAuth={onOpenAuth} />
      <main>
        <Hero onOpenAuth={onOpenAuth} />
        <Features />
        <HowItWorks />
        <CallToAction onOpenAuth={onOpenAuth} />
      </main>
      <Footer />
    </Box>
  );
}

export default LandingPage;
