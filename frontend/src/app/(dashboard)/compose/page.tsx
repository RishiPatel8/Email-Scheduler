"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, ArrowLeft, Paperclip, Clock, 
  ChevronDown, AlignLeft, AlignCenter, List, 
  ListOrdered, Quote, Link as LinkIcon, Strikethrough,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

const composeSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  startTime: z.string().min(1, 'Start time is required'),
  minimumDelay: z.string().optional(),
  hourlyLimit: z.string().optional(),
});

type ComposeFormValues = z.infer<typeof composeSchema>;

interface LeadPreview {
  total: number;
  valid: string[];
  invalid: string[];
  duplicates: number;
}

export default function ComposePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [preview, setPreview] = useState<LeadPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [showSchedule, setShowSchedule] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const execAndSync = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setValue('body', editorRef.current.innerHTML);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<ComposeFormValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      minimumDelay: '00',
      hourlyLimit: '00',
      startTime: '',
      name: 'Default Campaign' 
    }
  });


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scheduleRef.current && !scheduleRef.current.contains(event.target as Node)) {
        setShowSchedule(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileProcess = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a valid CSV or TXT file.');
      return;
    }
    
    setFileName(file.name);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/campaigns/preview', formData);
      setPreview(res.data.data);
      toast.success(`Detected ${res.data.data.valid.length} valid recipients`);
    } catch {
      toast.error('Failed to parse file');
      setPreview(null);
      setFileName(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const onSubmit = async (data: ComposeFormValues) => {
    if (!preview || preview.valid.length === 0) {
      toast.error('Please upload a file with valid emails (or CSV) in the To field');
      return;
    }
    
    setIsSubmitting(true);
    const toastId = toast.loading('Scheduling campaign...');
    
    try {
      await api.post('/campaigns', {
        ...data,
        leads: preview.valid
      });
      toast.success('Campaign scheduled successfully!', { id: toastId });
      router.push('/scheduled');
    } catch {
      toast.error('Failed to schedule campaign', { id: toastId });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div className="flex items-center text-[#1C2C39]">
            <button 
              type="button"
              onClick={() => router.back()}
              className="mr-3 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
            >
              <ArrowLeft className="h-[22px] w-[22px] stroke-[1.5]" />
            </button>
            <h1 className="text-[22px] font-medium tracking-tight">Compose New Email</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative flex items-end">
              <Paperclip className="h-[20px] w-[20px] text-[#00A83B] stroke-[2]" />
              {fileName && (
                <span className="absolute -bottom-1 -right-1.5 text-[10px] font-bold text-black bg-white rounded-full leading-none">1</span>
              )}
            </div>
            
            <div className="relative" ref={scheduleRef}>
              <button
                type="button"
                onClick={() => setShowSchedule(!showSchedule)}
                className="flex items-center transition-colors text-[#00A83B]"
              >
                <Clock className="h-[20px] w-[20px] stroke-[2]" />
              </button>

              {/* Schedule Popover */}
              {showSchedule && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-5 z-50">
                  <h3 className="font-semibold text-[15px] text-gray-900 mb-4">Send Later</h3>
                  
                  <div className="relative mb-4 border-b border-gray-200">
                    <input 
                      type="datetime-local" 
                      {...register('startTime')}
                      className="w-full text-sm text-gray-900 pb-2 focus:outline-none focus:ring-1 focus:ring-[#00A83B] rounded px-2"
                    />
                  </div>

                  <div className="space-y-4 mb-6">
                    {[
                      { label: 'Tomorrow', offset: 24 * 60 * 60 * 1000 },
                      { label: 'Tomorrow, 10:00 AM', offset: 24 * 60 * 60 * 1000, setHour: 10 },
                      { label: 'Tomorrow, 11:00 AM', offset: 24 * 60 * 60 * 1000, setHour: 11 },
                      { label: 'Tomorrow, 3:00 PM', offset: 24 * 60 * 60 * 1000, setHour: 15 }
                    ].map((t) => (
                      <div 
                        key={t.label} 
                        onClick={() => {
                          const date = new Date(Date.now() + t.offset);
                          if (t.setHour) {
                            date.setHours(t.setHour, 0, 0, 0);
                          }
                          // format as YYYY-MM-DDThh:mm
                          const iso = date.toISOString();
                          setValue('startTime', iso.substring(0, 16));
                        }}
                        className="text-sm text-gray-600 hover:text-black cursor-pointer"
                      >
                        {t.label}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end space-x-4">
                    <button type="button" onClick={() => { setValue('startTime', ''); setShowSchedule(false); }} className="text-sm font-semibold text-gray-900 hover:text-gray-600">Cancel</button>
                    <button type="button" onClick={() => setShowSchedule(false)} className="text-sm font-semibold text-[#00A83B] border border-[#00A83B] rounded-full px-5 py-1.5 hover:bg-[#EBF7EE]">Done</button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-1.5 border border-[#00A83B] text-[#00A83B] font-semibold text-sm rounded-full hover:bg-[#EBF7EE] transition-colors disabled:opacity-50 ml-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send Later'}
            </button>
          </div>
        </div>

        {/* Fields Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 pt-4 pb-12">
            
            {/* From */}
            <div className="flex items-center border-b border-gray-100 pb-4 mb-4">
              <span className="w-24 text-[13px] font-medium text-gray-900">From</span>
              <div className="flex items-center px-3 py-1.5 bg-[#F5F5F5] rounded-md text-[13px] font-medium text-gray-800">
                {user?.email || 'oliver.brown@domain.io'}
                <ChevronDown className="ml-2 h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>

            {/* To */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4 min-h-[44px]">
              <div className="flex items-center flex-1">
                <span className="w-24 text-[13px] font-medium text-gray-900">To</span>
                <div className="flex items-center flex-wrap gap-2 flex-1">
                  {preview && preview.valid.length > 0 ? (
                    <>
                      {preview.valid.slice(0, 3).map((email, idx) => (
                        <div key={idx} className="px-2.5 py-1 bg-white border border-[#00A83B] text-[#00A83B] text-[12px] font-medium rounded-full">
                          {email}
                        </div>
                      ))}
                      {preview.valid.length > 3 && (
                        <div className="px-2 py-1 bg-white border border-[#00A83B] text-[#00A83B] text-[12px] font-medium rounded-full">
                          +{preview.valid.length - 3}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[14px] text-gray-400">recipient@example.com</span>
                  )}
                </div>
              </div>
              <label className="cursor-pointer flex items-center text-[#00A83B] text-[14px] font-medium hover:text-[#009030] transition-colors ml-4 shrink-0">
                <Upload className="h-[18px] w-[18px] mr-1.5 stroke-[2]" />
                {isUploading ? 'Uploading...' : 'Upload List'}
                <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleChange} className="hidden" />
              </label>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-gray-100 pb-4 mb-4">
              <span className="w-24 text-[13px] font-medium text-gray-900">Subject</span>
              <div className="flex-1">
                <input
                  {...register('subject')}
                  placeholder="Subject"
                  className="w-full bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A83B]/50 rounded px-2 py-1 disabled:opacity-75 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Delay & Hourly Limit */}
            <div className="flex items-center border-b border-gray-100 pb-4 mb-6">
              <span className="text-[13px] font-medium text-gray-900 mr-4">Delay between 2 emails</span>
              <input
                {...register('minimumDelay')}
                type="text"
                className="w-14 px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none text-center focus:outline-none focus:ring-2 focus:ring-[#00A83B]/50 focus:border-transparent disabled:opacity-75 disabled:bg-gray-100"
              />
              
              <span className="text-[13px] font-medium text-gray-900 ml-8 mr-4">Hourly Limit</span>
              <input
                {...register('hourlyLimit')}
                type="text"
                className="w-14 px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none text-center focus:outline-none focus:ring-2 focus:ring-[#00A83B]/50 focus:border-transparent disabled:opacity-75 disabled:bg-gray-100"
              />
            </div>

            {/* Editor Area */}
            <div className="bg-[#F9FAFB] rounded-[16px] p-6 h-[400px] flex flex-col relative">
              <div
                ref={editorRef}
                contentEditable
                onInput={(e) => {
                  setValue('body', e.currentTarget.innerHTML);
                }}
                onBlur={(e) => {
                  setValue('body', e.currentTarget.innerHTML);
                }}
                className="w-full bg-transparent outline-none text-[15px] text-gray-900 mb-6 h-full overflow-y-auto min-h-[300px] pb-10 focus:ring-2 focus:ring-[#00A83B]/20 rounded-lg p-2"
                style={{ cursor: 'text' }}
                // eslint-disable-next-line react-hooks/incompatible-library
                dangerouslySetInnerHTML={{ __html: watch('body') || '' }}
              />
              {!watch('body') && (
                <div className="absolute top-6 left-6 text-[15px] text-gray-400 pointer-events-none">
                  Type Your Reply...
                </div>
              )}
              
              {/* Floating Toolbar */}
              <div className="absolute top-16 left-6 right-6">
                <div className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-full px-4 py-2 flex items-center space-x-1.5 w-fit border border-gray-100">
                  <button type="button" onClick={() => execAndSync('undo')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full transition-colors"><ArrowLeft className="h-[18px] w-[18px]" /></button>
                  <button type="button" onClick={() => execAndSync('redo')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full transition-colors"><ArrowLeft className="h-[18px] w-[18px] rotate-180" /></button>
                  <div className="w-[1px] h-5 bg-gray-200 mx-2"></div>
                  
                  <div className="flex items-center space-x-1 text-gray-400 hover:text-gray-700 cursor-pointer p-1.5 transition-colors">
                    <span className="text-[15px] font-serif font-medium leading-none">TT</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  <div className="w-[1px] h-5 bg-gray-200 mx-2"></div>

                  <button type="button" onClick={() => execAndSync('bold')} className="p-1.5 text-gray-500 font-bold hover:bg-gray-100 rounded text-[15px] leading-none w-8 h-8 flex items-center justify-center transition-colors">B</button>
                  <button type="button" onClick={() => execAndSync('italic')} className="p-1.5 text-gray-500 italic font-serif hover:bg-gray-100 rounded text-[15px] leading-none w-8 h-8 flex items-center justify-center transition-colors">I</button>
                  <button type="button" onClick={() => execAndSync('underline')} className="p-1.5 text-gray-500 underline hover:bg-gray-100 rounded text-[15px] leading-none w-8 h-8 flex items-center justify-center transition-colors">U</button>
                  <div className="w-[1px] h-5 bg-gray-200 mx-2"></div>
                  
                  <button type="button" onClick={() => execAndSync('justifyLeft')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><AlignLeft className="h-[18px] w-[18px]" /></button>
                  <button type="button" onClick={() => execAndSync('justifyCenter')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><AlignCenter className="h-[18px] w-[18px]" /></button>
                  <div className="w-[1px] h-5 bg-gray-200 mx-2"></div>
                  
                  <button type="button" onClick={() => execAndSync('insertOrderedList')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><ListOrdered className="h-[18px] w-[18px]" /></button>
                  <button type="button" onClick={() => execAndSync('insertUnorderedList')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><List className="h-[18px] w-[18px]" /></button>
                  
                  <button type="button" onClick={() => execAndSync('outdent')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><ArrowLeft className="h-[18px] w-[18px] rotate-180" /></button>
                  <button type="button" onClick={() => execAndSync('indent')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><ArrowLeft className="h-[18px] w-[18px]" /></button>
                  
                  <button type="button" onClick={() => execAndSync('formatBlock', 'BLOCKQUOTE')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><Quote className="h-[18px] w-[18px]" /></button>
                  <button type="button" onClick={() => {
                    const url = prompt('Enter link URL:');
                    if (url) execAndSync('createLink', url);
                  }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><LinkIcon className="h-[18px] w-[18px]" /></button>
                  <button type="button" onClick={() => execAndSync('strikeThrough')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"><Strikethrough className="h-[18px] w-[18px]" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
