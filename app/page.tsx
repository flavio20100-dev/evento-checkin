import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to hostess page (primary use case)
  redirect('/hostess');
}
