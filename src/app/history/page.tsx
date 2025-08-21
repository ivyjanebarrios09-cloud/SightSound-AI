'use client';
import { Navbar } from '@/components/layout/Navbar';
import { AuthWrapper } from '@/components/auth/AuthWrapper';
import HistoryList from '@/components/history/HistoryList';

export default function HistoryPage() {
  return (
    <AuthWrapper>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <div className="container mx-auto p-4 md:p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">History</h1>
              <p className="text-muted-foreground">
                Review your past generated image descriptions.
              </p>
            </div>
            <HistoryList />
          </div>
        </main>
      </div>
    </AuthWrapper>
  );
}
