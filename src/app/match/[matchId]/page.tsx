import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMapConfig, getMatch } from "@/lib/data";
import { MatchView } from "@/components/MatchView";

interface PageProps {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ map?: string; date?: string }>;
}

/**
 * Deep links are `noindex`, per PRD.md §7/§10. These pages expose granular internal
 * telemetry -- pseudonymous player ids, kill and death coordinates, per-event timings --
 * and restricting is the reversible choice where over-exposing is not. They remain fully
 * shareable; they simply aren't offered to search engines. Crawling is deliberately NOT
 * blocked in robots.txt: a disallowed URL can never be read, so the noindex directive
 * itself would never be seen.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params;
  const match = getMatch(matchId);
  if (!match) return { title: "Match not found", robots: { index: false, follow: false } };

  const map = getMapConfig(match.map_id);
  return {
    title: `${map.displayName} · ${match.date} · ${match.participant_count} participants`,
    description: `Player journeys for one LILA BLACK match on ${map.displayName} (${match.date}): ${match.events.length} recorded events across ${match.participant_count} participants.`,
    robots: { index: false, follow: true },
  };
}

export default async function MatchPage({ params, searchParams }: PageProps) {
  const { matchId } = await params;
  const { map: mapFilter, date: dateFilter } = await searchParams;

  const match = getMatch(matchId);
  if (!match) notFound();

  return <MatchView match={match} mapFilter={mapFilter} dateFilter={dateFilter} />;
}
