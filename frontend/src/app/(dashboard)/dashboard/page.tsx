"use client";

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Activity, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/campaigns/stats');
      return res.data.data;
    },
  });

  const statItems = [
    { name: 'Total Campaigns', value: stats?.totalCampaigns || 0 },
    { name: 'Scheduled Emails', value: stats?.scheduledCount || 0 },
    { name: 'Sent Emails', value: stats?.sentCount || 0 },
    { name: 'Failed Emails', value: stats?.failedCount || 0 },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-8 py-10">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy tracking-tight">Dashboard</h1>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <div key={item.name} className="border border-brand-border bg-white rounded-lg p-4">
            <p className="text-xs font-medium text-brand-secondary mb-1 uppercase tracking-wider">{item.name}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-12 mt-1" />
            ) : (
              <p className="text-2xl font-semibold text-brand-navy">{item.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold text-brand-navy mb-4 border-b border-brand-border pb-2">Recent Activity</h2>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="border border-brand-border rounded-lg bg-white overflow-hidden">
            <table className="w-full text-left text-sm text-brand-secondary">
              <thead className="bg-brand-gray-50 border-b border-brand-border text-xs uppercase text-brand-navy">
                <tr>
                  <th className="px-6 py-4 font-medium">Campaign Name</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Recipients</th>
                  <th className="px-6 py-4 font-medium">Date Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {stats.recentActivity.map((campaign: { id: string, name: string, subject: string, _count: { emailRecipients: number }, createdAt: string }) => (
                  <tr key={campaign.id} className="hover:bg-brand-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-brand-navy">{campaign.name}</td>
                    <td className="px-6 py-4 truncate max-w-[200px]">{campaign.subject}</td>
                    <td className="px-6 py-4">
                      <span className="bg-brand-blue-50 text-brand-blue-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                        {campaign._count.emailRecipients} emails
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Calendar className="w-4 h-4 opacity-50" />
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState 
            icon={Activity}
            title="No recent activity"
            description="Your email activity will appear here once campaigns begin processing."
            actionLabel="Create Campaign"
            actionHref="/compose"
            className="border border-brand-border rounded-lg bg-white"
          />
        )}
      </div>
    </div>
  );
}
