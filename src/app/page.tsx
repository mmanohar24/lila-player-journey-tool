import { redirect } from "next/navigation";
import { getDefaultMatchId } from "@/lib/data";

/**
 * The tool opens straight onto a match rather than an empty shell. PRD.md §8: default to
 * one of the richer matches, since 743 of 796 have a single participant and landing on
 * one of those would make the tool look broken on first load.
 */
export default function Home() {
  const matchId = getDefaultMatchId();
  if (!matchId) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-ui text-textSecondary">
          No match data found. Run <code className="text-data">scripts/build_data.py</code> to
          generate it.
        </p>
      </main>
    );
  }
  redirect(`/match/${matchId}`);
}
