import { redirect } from 'next/navigation';

// TODO(routing): decide the real landing page — leaderboard is the most
// natural "app opens to this" default, matching how the club currently
// lands on the spreadsheet's Leaderboard tab.
export default function HomePage() {
  redirect('/leaderboard');
}
