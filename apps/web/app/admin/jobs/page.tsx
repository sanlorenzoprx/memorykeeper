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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function AdminJobsPage() {
  const { user } = useUser();
  const isAdmin = useMemo(() => {
    const roles = (user?.organizationMemberships?.map(m => m.role) || []).concat(
      (user?.publicMetadata?.role ? [String(user.publicMetadata.role)] : [])
    );
    return roles.includes('admin');
  }, [user]);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [kindFilter, setKindFilter] = useState<string | undefined>(undefined);
  const [limit, setLimit] = useState<number>(25);
  const [page, setPage] = useState<number>(0);

  const offset = page * limit;

  const statsQuery = useQuery<{ stats: Stat[] }>({
    queryKey: ['admin-jobs-stats'],
    queryFn: () => apiGet('/api/jobs/stats'),
    refetchInterval: 15000,
  });

  const kinds = useMemo(() => {
    const uniques = new Set<string>();
    statsQuery.data?.stats.forEach((s) => uniques.add(s.kind));
    return Array.from(uniques);
  }, [statsQuery.data]);

  const jobsQuery = useQuery<{ jobs: Job[] }>({
    queryKey: ['admin-jobs', statusFilter, kindFilter, limit, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (statusFilter) params.set('status', statusFilter);
      if (kindFilter) params.set('kind', kindFilter);
      return apiGet(`/api/jobs?${params.toString()}`);
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const handleStatusChange = (next?: string) => { setPage(0); setStatusFilter(next); };
  const handleKindChange = (next?: string) => { setPage(0); setKindFilter(next); };
  const handleLimitChange = (n: number) => { setPage(0); setLimit(n); };

  const canPrev = page > 0;
  const canNext = (jobsQuery.data?.jobs.length || 0) >= limit;

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

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-2">
                <Button variant={statusFilter === undefined ? 'default' : 'outline'} onClick={() => handleStatusChange(undefined)}>All</Button>
                <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => handleStatusChange('pending')}>Pending</Button>
                <Button variant={statusFilter === 'done' ? 'default' : 'outline'} onClick={() => handleStatusChange('done')}>Done</Button>
                <Button variant={statusFilter === 'failed' ? 'default' : 'outline'} onClick={() => handleStatusChange('failed')}>Failed</Button>
              </div>

              <div className="flex gap-2 items-center">
                <label className="text-sm text-gray-600">Kind:</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={kindFilter ?? ''}
                  onChange={(e) => handleKindChange(e.target.value || undefined)}
                >
                  <option value="">All</option>
                  {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div className="flex gap-2 items-center">
                <label className="text-sm text-gray-600">Page size:</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium mt-4 mb-2">Jobs</h2>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" disabled={!canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                  <span className="text-sm">Page {page + 1}</span>
                  <Button variant="outline" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
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