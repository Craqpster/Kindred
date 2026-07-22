import { useCallback, useEffect, useState } from "react";
import type { Channel } from "stream-chat";

/// Keeps a game's state in sync between two players. Postgres (loaded on mount, via
/// GET /api/games/[sessionId]) is the source of truth a refreshed or rejoining tab
/// trusts; the "game_state" Stream event is only a low-latency nudge so an open tab
/// updates right away instead of waiting for its next load. A missed event just means
/// "stale until the next mount," never corrupted state.
///
/// No server-side move validation - sendMove trusts whatever state the caller computed
/// (see each game's playMove in tic-tac-toe.ts / connect-four.ts). Fine for two people
/// casually playing together, not anti-cheat-hardened - same accepted tradeoff as
/// lib/moderation-rate-limit.ts's in-memory-only note.
///
/// status is tracked separately from state.winner because a game can also end without
/// one - lib/games.ts lazily marks a session "abandoned" after a day of no moves, and
/// that only ever surfaces here (the initial load, or a rejected move below), never as
/// its own push event.
export function useGameSync<TState>(sessionId: string, channel: Channel) {
    const [state, setState] = useState<TState | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetch(`/api/games/${sessionId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data?.session) {
                    setState(data.session.state as TState);
                    setStatus(data.session.status);
                }
            })
            .catch(() => {});

        const handleGameState = (event: { sessionId?: string; gameState?: unknown }) => {
            if (event.sessionId === sessionId) {
                setState(event.gameState as TState);
            }
        };
        channel.on("game_state", handleGameState);

        return () => {
            cancelled = true;
            channel.off("game_state", handleGameState);
        };
    }, [sessionId, channel]);

    const sendMove = useCallback(
        async (newState: TState) => {
 
            setState(newState);
            const res = await fetch(`/api/games/${sessionId}/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: newState }),
            });

            const data = await res.json().catch(() => null);
            if (data?.session) {
                setState(data.session.state as TState);
                setStatus(data.session.status);
            }

            if (!res.ok) {
                // Rejected - most likely the game already ended (a win, or the
                // inactivity timeout) between this tab loading and this click. Revert
                // the optimistic update above to whatever the server actually has.
                if (data?.session) setState(data.session.state as TState);
                return;
            }

            await channel.sendEvent({
                type: "game_state",
                sessionId,
                gameState: newState,
            });
        },
        [sessionId, channel],
    );

    return { state, status, sendMove };
}
