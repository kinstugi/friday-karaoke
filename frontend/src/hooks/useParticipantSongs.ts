import { useEffect, useState } from "react";
import { subscribeToParticipantSongs, type SessionSong } from "../lib/sessions";

export function useParticipantSongs(
  sessionId: string,
  participantId: string | undefined,
) {
  const [songs, setSongs] = useState<SessionSong[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!participantId) {
      setSongs([]);
      return;
    }
    return subscribeToParticipantSongs(
      sessionId,
      participantId,
      setSongs,
      (snapshotError) => {
        console.error(
          "Firestore participant songs listener failed:",
          snapshotError,
        );
        setError(`${snapshotError.name}: ${snapshotError.message}`);
      },
    );
  }, [sessionId, participantId]);
  return { songs, error };
}
