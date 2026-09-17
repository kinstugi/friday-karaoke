import { useEffect, useState } from "react";
import { subscribeToSessionState } from "../lib/sessions";

export function useSessionState(sessionId: string) {
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(
    () =>
      subscribeToSessionState(
        sessionId,
        setActiveParticipantId,
        (snapshotError) => {
          setError(snapshotError.message);
          console.error("Firestore session listener failed:", snapshotError);
        },
      ),
    [sessionId],
  );
  return { activeParticipantId, error };
}
