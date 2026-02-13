import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/nextauth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{session.user?.email}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
