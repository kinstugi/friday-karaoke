import { Box, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function RoomActionCard({ icon, title, subtitle, onClick, danger = false }: { icon: ReactNode; title: string; subtitle: string; onClick: () => void; danger?: boolean }) {
  return <Paper component="button" onClick={onClick} elevation={0} sx={{ width: "100%", p: 2.5, textAlign: "left", color: "white", cursor: "pointer", bgcolor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}><Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ color: danger ? "secondary.main" : "primary.main", display: "flex" }}>{icon}</Box><Box><Typography fontWeight={700}>{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box></Stack></Paper>;
}
