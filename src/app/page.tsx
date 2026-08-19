import Link from "next/link";
import { getMatchesIndex } from "@/lib/data";

export default function Home() {
  const matches = getMatchesIndex();
  const richestMatch = matches[0];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-heading">LILA Player Journey Visualization Tool</h1>
      <p className="text-ui text-textSecondary w-full max-w-md">
        Filters and a proper match picker land in a later build stage. For now,
        here&apos;s the richest match in the dataset (
        {richestMatch.participant_count} participants).
      </p>
      <Link
        href={`/match/${richestMatch.match_id}`}
        className="text-ui-emphasis text-human underline"
      >
        View {richestMatch.map_id} match &rarr;
      </Link>
    </main>
  );
}
