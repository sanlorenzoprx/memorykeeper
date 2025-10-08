'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/nextjs';

type Job = {
  id: number;
  kind: string;
  status: string;
  attempts: number;
  created_at: string;
  last_error?: string | null;
  next_run_at?: string | null;
};

type Stat = {
  status: string;
  kind: string;
  count: number;
};

export default function AdminJobsPage() {
  const { user } = useUser();
  const isAdmin = useMemo(() => {
    const roles = (user?.organizationMemberships?.map(m => m.role) || []).concat(
      (user?.publicMetadata?.role ? [String(user.publicMetadata.role)] : [])
    );
    return roles.includes('admin');
  }, [user]);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const jobsQuery = useQuery<{ jobs: Job[] }>({
    queryKey: ['admin-jobs', statusFilter],
    queryFn: () => apiGet(`/api/jobs${statusFilter ? `?status=${statusFilter}` : ''}`),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const statsQuery = useQuery<{ stats: Stat[] }>({
    queryKey: ['admin-jobs-stats'],
    queryFn: () => apiGet('/api/jobs/stats'),
    refetchInterval: 15000,
  });

  const handleStatusChange = (next?: string) => setStatusFilter(next);

  return (
    <div className="space-y-6">
      <SignedOut>
        <div className="flex flex-col items-center">
          <p className="mb-2">You must be signed in to view admin jobs.</p>
          <SignInButton />
        </div>
      </SignedOut>

      <SignedIn>
        {!isAdmin ? (
          <div className="text-red-600">Access denied. Admins only.</div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Jobs Dashboard</h1>

            <div className="flex gap-2">
              <Button variant={statusFilter === undefined ? 'default' : 'outline'} onClick={() => handleStatusChange(undefined)}>All</Button>
              <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => handleStatusChange('pending')}>Pending</Button>
              <Button variant={statusFilter === 'done' ? 'default' : 'outline'} onClick={() => handleStatusChange('done')}>Done</Button>
              <Button variant={statusFilter === 'failed' ? 'default' : 'outline'} onClick={() => handleStatusChange('failed')}>Failed</Button>
            </div>

            <section>
              <h2 className="text-xl font-medium mt-4 mb-2">Stats</h2>
              {statsQuery.isLoading && <p>Loading stats...</p>}
              {statsQuery.error && <p className="text-red-600">Failed to load stats</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {statsQuery.data?.stats.map((s) => (
                  <div key={`${s.status}-${s.kind}`} className="border rounded p-3">
                    <div className="text-sm text-gray-500">{s.kind}</div>
                    <div className="font-semibold">{s.status}: {s.count}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-medium mt-4 mb-2">Jobs</h2>
              {jobsQuery.isLoading && <p>Loading jobs...</p>}
              {jobsQuery.error && <p className="text-red-600">Failed to load jobs</p>}
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Kind</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Attempts</th>
                      <th className="p-2 text-left">Created</th>
                      <th className="p-2 text-left">Next Run</th>
                      <th className="p-2 text-left">Last Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobsQuery.data?.jobs.map((j) => (
                      <tr key={j.id} className="border-t">
                        <td className="p-2">{j.id}</td>
                        <td className="p-2">{j.kind}</td>
                        <td className="p-2">{j.status}</td>
                        <td className="p-2">{j.attempts}</td>
                        <td className="p-2">{new Date(j.created_at).toLocaleString()}</td>
                        <td className="p-2">{j.next_run_at ? new Date(j.next_run_at).toLocaleString() : '-'}</td>
                        <td className="p-2 max-w-xs truncate">{j.last_error || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </SignedIn>
    </div>
  );
}