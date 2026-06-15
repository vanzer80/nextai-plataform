import { useRef, useState } from 'react';
import { generateUUID } from '@/src/lib/uuid';
import { compressImageFile } from '@/src/lib/imageCompression';
import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Camera, X, Plus, ImageIcon, Loader2 } from 'lucide-react';
import type { EvidenceFile } from '@/src/types/reports';

interface Step6Props {
  attachments: EvidenceFile[];
  onChange: (files: EvidenceFile[]) => void;
}

export default function Step6Evidence({ attachments, onChange }: Step6Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    const remaining = 4 - attachments.length;
    const toAdd = files.slice(0, remaining);
    e.target.value = '';
    if (toAdd.length === 0) return;

    setIsCompressing(true);
    try {
      // Comprime antes de virar EvidenceFile → pendingBlobs (IndexedDB) e upload ficam leves.
      const compressed = await Promise.all(toAdd.map(file => compressImageFile(file)));
      const newItems: EvidenceFile[] = compressed.map(file => ({
        id: generateUUID(),
        file,
        preview: URL.createObjectURL(file),
        caption: '',
      }));
      onChange([...attachments, ...newItems]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter(a => a.id !== id));
  };

  const handleCaption = (id: string, caption: string) => {
    onChange(attachments.map(a => a.id === id ? { ...a, caption } : a));
  };

  return (
    <Card className="shadow-sm border-border" data-onboarding="wizard-step6-fotos">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          Evidências Fotográficas
          <span className="ml-auto text-xs font-normal text-muted-foreground">{attachments.length}/4</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">

        {/* Grid de fotos */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {attachments.map(att => (
              <div key={att.id} className="space-y-1.5">
                <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                  <img
                    src={att.preview}
                    alt="evidência"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(att.id)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  type="text"
                  value={att.caption}
                  onChange={e => handleCaption(att.id, e.target.value)}
                  placeholder="Legenda (opcional)"
                  className="h-8 text-xs rounded-lg border-border bg-muted"
                />
              </div>
            ))}
          </div>
        )}

        {/* Botão de adicionar foto */}
        {attachments.length < 4 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isCompressing}
            className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCompressing ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-xs font-medium">Otimizando fotos...</p>
              </>
            ) : attachments.length === 0 ? (
              <>
                <ImageIcon className="h-9 w-9" />
                <p className="text-sm font-medium">Adicionar fotos de evidência</p>
                <p className="text-xs">Até 4 fotos · JPG, PNG</p>
              </>
            ) : (
              <>
                <Plus className="h-7 w-7" />
                <p className="text-xs font-medium">Adicionar mais fotos</p>
              </>
            )}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {attachments.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            As evidências são opcionais, mas ajudam na análise do gestor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
