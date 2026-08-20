import type { Metadata } from "next";
import { getDefaultMatchId, getMatch } from "@/lib/data";
import { MatchView } from "@/components/MatchView";

/**
 * The indexable entry point. It renders the tool directly rather than redirecting to a
 * deep link: per-match routes are noindex (PRD.md §10), so redirecting would have left
 * the site with no indexable page at all.
 */
export const metadata: Metadata = {
  title: "LILA BLACK Player Journey Visualization Tool",
  description:
    "Explore player movement, combat and death patterns from LILA BLACK gameplay telemetry: per-match journeys on the real minimaps, timeline playback, and aggregate density heatmaps.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LILA BLACK Player Journey Visualization Tool",
    description:
      "Per-match player journeys, timeline playback and density heatmaps over LILA BLACK's minimaps.",
    url: "/",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Player journeys plotted on a LILA BLACK minimap" }],
  },
};

export default function Home() {
  const matchId = getDefaultMatchId();
  const match = matchId ? getMatch(matchId) : null;

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-ui text-textSecondary">
          No match data found. Run <code className="text-data">scripts/build_data.py</code> to
          generate it.
        </p>
      </main>
    );
  }

  // PRD.md §8: open on one of the richer matches -- 743 of 796 have a single
  // participant, so landing on one of those would make the tool look broken.
  return <MatchView match={match} />;
}
