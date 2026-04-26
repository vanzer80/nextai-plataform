import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Sparkles, Loader2, X, Plus, Mic, MicOff, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface CapturedImage {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
}

interface CaptureStepProps {
  mode: 'reimbursement' | 'material';
  isProcessing: boolean;
  onAnalyzeImages: (images: CapturedImage[]) => void;
  onAnalyzeVoice: (transcript: string) => void;
  onSkip: () => void;
}

const MAX_IMAGES = 4;

const LABELS = {
  reimbursement: {
    title: 'Novo Reembolso',
    subtitle: 'Registre sua despesa de campo',
    hint: 'Foto do cupom fiscal, recibo ou nota fiscal',
    analyzeBtn: 'Extrair dados com IA',
    voiceHint: 'Ex: "Paguei 87 reais de almoço no Restaurante Central dia 20 de abril"',
  },
  material: {
    title: 'Nova Solicitação de Compra',
    subtitle: 'Preencha os dados do material necessário',
    hint: 'Foto do produto, etiqueta ou ficha técnica',
    analyzeBtn: 'Identificar material com IA',
    voiceHint: 'Ex: "Preciso de 2 unidades do capacitor 40μF 220V para manutenção corretiva"',
  },
};

async function compressImage(file: File): Promise<CapturedImage> {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({
          file,
          preview: '/pdf-placeholder.png',
          base64: dataUrl.split(',')[1],
          mimeType: 'application/pdf',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve({
        file,
        preview: dataUrl,
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg',
      });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function CaptureStep({ mode, isProcessing, onAnalyzeImages, onAnalyzeVoice, onSkip }: CaptureStepProps) {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hasSpeech, setHasSpeech] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  const labels = LABELS[mode];
  const canAddMore = images.length < MAX_IMAGES;
  const hasImages = images.length > 0;
  const hasTranscript = transcript.trim().length > 0;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasSpeech(!!SR);
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    const slots = MAX_IMAGES - images.length;
    const toProcess = Array.from(files).slice(0, slots);
    if (toProcess.length === 0) return;

    setIsCompressing(true);
    try {
      const compressed = await Promise.all(toProcess.map(compressImage));
      setImages(prev => [...prev, ...compressed]);
    } catch {
      toast.error('Erro ao processar imagem. Tente novamente.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [images.length]);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    transcriptRef.current = '';
    setTranscript('');

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (final) {
        transcriptRef.current += ' ' + final;
      }
      setTranscript((transcriptRef.current + ' ' + interim).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        toast.error('Erro no reconhecimento de voz.');
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleVoiceAnalyze = () => {
    const text = transcriptRef.current.trim() || transcript.trim();
    if (!text) {
      toast.error('Nenhum áudio capturado. Tente falar novamente.');
      return;
    }
    onAnalyzeVoice(text);
  };

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Recording screen
  if (isRecording || (hasTranscript && !hasImages)) {
    return (
      <div className="flex flex-col gap-4 h-full w-full max-w-2xl mx-auto pb-10">
        <div className="flex items-center gap-3 mb-2">
          <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{labels.title}</h1>
              <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
          </div>
        </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center gap-5">
          {isRecording ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600">Ouvindo...</span>
              </div>
              <div className="w-full min-h-[80px] bg-muted rounded-xl border border-border p-4 text-foreground text-sm leading-relaxed">
                {transcript || <span className="text-muted-foreground italic">Fale agora...</span>}
              </div>
              <Button
                onClick={stopRecording}
                className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-base"
              >
                <MicOff className="h-5 w-5 mr-2" /> Parar gravação
              </Button>
            </>
          ) : (
            <>
              <div className="w-full min-h-[80px] bg-primary/10 rounded-xl border border-primary/30 p-4 text-foreground text-sm leading-relaxed">
                {transcript}
              </div>
              <p className="text-xs text-muted-foreground text-center">Revise o que foi reconhecido. Se precisar, grave novamente.</p>
              <div className="flex flex-col w-full gap-3">
                <Button
                  onClick={handleVoiceAnalyze}
                  disabled={isProcessing}
                  className="w-full h-14 rounded-xl font-semibold text-base"
                >
                  {isProcessing
                    ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analisando...</>
                    : <><Sparkles className="h-5 w-5 mr-2 text-amber-400" /> {labels.analyzeBtn}</>
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setTranscript(''); transcriptRef.current = ''; }}
                  className="w-full h-11 rounded-xl"
                >
                  <Mic className="h-4 w-4 mr-2" /> Gravar novamente
                </Button>
                <button
                  onClick={onSkip}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-center"
                >
                  Preencher manualmente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full w-full max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{labels.title}</h1>
          <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'reimbursement' ? 'image/*,.pdf' : 'image/*'}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Empty state */}
      {!hasImages && (
        <div
          className="bg-card rounded-2xl border-2 border-dashed border-border shadow-sm p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center">
            <Camera className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-base">Tirar foto ou selecionar arquivo</p>
            <p className="text-xs text-muted-foreground mt-1">{labels.hint}</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Você pode selecionar até {MAX_IMAGES} imagens</p>
          </div>
          {isCompressing && (
            <div className="flex items-center gap-2 text-primary text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando imagem...
            </div>
          )}
        </div>
      )}

      {/* Image grid */}
      {hasImages && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
          <div className="grid grid-cols-2 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                <img
                  src={img.preview}
                  alt={`Imagem ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                <div className="absolute bottom-1.5 left-1.5 bg-black/50 rounded-full px-2 py-0.5">
                  <span className="text-white text-xs font-medium">{i + 1}</span>
                </div>
              </div>
            ))}

            {canAddMore && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/60 hover:text-primary hover:bg-accent/30 transition-colors"
              >
                {isCompressing
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Plus className="h-6 w-6" />
                }
                <span className="text-xs font-medium">
                  {isCompressing ? 'Processando...' : 'Adicionar'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {hasImages && (
          <Button
            onClick={() => onAnalyzeImages(images)}
            disabled={isProcessing || isCompressing}
            className="w-full h-14 rounded-xl font-semibold text-base shadow-sm"
          >
            {isProcessing
              ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analisando imagens...</>
              : <><Sparkles className="h-5 w-5 mr-2 text-amber-400" /> {labels.analyzeBtn}</>
            }
          </Button>
        )}

        {hasSpeech && (
          <Button
            variant="outline"
            onClick={startRecording}
            disabled={isProcessing || isCompressing}
            className="w-full h-12 rounded-xl border-border text-foreground hover:bg-muted font-medium"
          >
            <Mic className="h-4 w-4 mr-2 text-primary" /> Descrever por voz
          </Button>
        )}

        {!hasImages && hasSpeech && (
          <p className="text-xs text-muted-foreground/80 text-center px-4">{labels.voiceHint}</p>
        )}

        <button
          onClick={onSkip}
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline py-2"
        >
          Preencher manualmente <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
