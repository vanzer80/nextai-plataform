import { useState } from 'react';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { ImageIcon, ZoomIn } from 'lucide-react';
import type { ReportAttachment } from '@/src/types/reports';

interface AttachmentGridProps {
  attachments: ReportAttachment[];
}

export default function AttachmentGrid({ attachments }: AttachmentGridProps) {
  const [lightbox, setLightbox] = useState<ReportAttachment | null>(null);

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
        <ImageIcon className="h-8 w-8" />
        <p className="text-sm">Nenhuma foto anexada</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {attachments.map(att => (
          <button
            key={att.id}
            type="button"
            onClick={() => setLightbox(att)}
            className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <img
              src={att.url}
              alt={att.caption ?? att.filename ?? 'evidência'}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
            {att.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                <p className="text-white text-[11px] line-clamp-1">{att.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!lightbox} onOpenChange={open => !open && setLightbox(null)}>
        <DialogContent className="max-w-screen-sm p-2 bg-black border-0">
          {lightbox && (
            <div className="space-y-2">
              <img
                src={lightbox.url}
                alt={lightbox.caption ?? lightbox.filename ?? 'evidência'}
                className="w-full rounded-lg object-contain max-h-[80vh]"
              />
              {lightbox.caption && (
                <p className="text-center text-sm text-slate-300 px-2">{lightbox.caption}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
