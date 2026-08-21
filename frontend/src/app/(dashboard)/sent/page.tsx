"use client";

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Search, Filter, RefreshCw, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface EmailRecipient {
  id: string;
  email: string;
  campaign: { name: string, subject?: string };
  status: string;
  error?: string;
  sentTime?: string | null;
}

export default function SentPage() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sent-emails'],
    queryFn: async () => {
      const res = await api.get('/campaigns/sent');
      return res.data.data;
    },
    refetchInterval: 10000 
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search and Controls */}
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="relative flex-1 max-w-[500px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="w-full pl-9 pr-4 py-2 bg-[#F5F7F6] border-none rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#00A83B] transition-colors placeholder:text-gray-400"
          />
        </div>
        <button className="p-2 text-gray-400 hover:text-black rounded-full transition-colors">
          <Filter className="h-[18px] w-[18px]" />
        </button>
        <button 
          onClick={() => refetch()}
          className="p-2 text-gray-400 hover:text-black rounded-full transition-colors"
        >
          <RefreshCw className={`h-[18px] w-[18px] ${isRefetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center py-4 gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : data?.length === 0 ? (
          <div className="h-full flex items-center justify-center pt-20">
            <EmptyState 
              icon={Send}
              title="No sent emails yet"
              description="Emails successfully processed will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.map((email: EmailRecipient) => (
              <div 
                key={email.id} 
                className="group flex flex-col sm:flex-row sm:items-center py-4 hover:bg-gray-50/50 transition-colors cursor-default gap-3 sm:gap-6 border-b border-gray-100 last:border-0"
              >
                {/* Recipient */}
                <div className="w-full sm:w-[250px] shrink-0 pr-4">
                  <span className="text-[13px] font-semibold text-gray-900 block break-all">
                    {email.email}
                  </span>
                </div>
                
                {/* Subject and Error */}
                <div className="flex-1 truncate">
                  <span className="text-[13px] text-gray-500 block truncate">
                    <span className="text-gray-900 font-medium mr-1.5">{email.campaign.name}</span>
                    {email.campaign.subject ? `- ${email.campaign.subject}` : '- No Subject'}
                  </span>
                  {email.error && (
                    <span className="text-[11px] font-medium text-red-500 truncate block mt-0.5" title={email.error}>
                      Error: {email.error}
                    </span>
                  )}
                </div>

                {/* Sent Time */}
                <div className="shrink-0 flex items-center">
                  <div className="inline-flex items-center text-gray-500">
                    <Send className="h-4 w-4 mr-1.5 opacity-50" />
                    <span className="text-[12px] font-medium">
                      {email.sentTime ? new Date(email.sentTime).toLocaleString() : '--'}
                    </span>
                  </div>
                </div>
                
                {/* Status */}
                <div className="shrink-0 w-[100px] flex sm:justify-end">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    email.status === 'SENT' ? 'bg-green-50 text-green-700' :
                    email.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {email.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
