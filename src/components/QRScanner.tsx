import { useEffect, useRef, useState } from 'react';
import { Camera, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

interface Props {
  onResult: (url: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef  = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoading(false);
        scan();
      } catch {
        setError('Câmera indisponível. Use o campo abaixo para colar a URL do QR code.');
        setLoading(false);
      }
    }

    async function scan() {
      if (!active || !videoRef.current) return;

      // Prefer native BarcodeDetector (Chrome/Android)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) { handleResult(codes[0].rawValue); return; }
          } catch { /* ignore */ }
          animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
      } else {
        // Fallback: @zxing/browser (dynamic import)
        try {
          const { BrowserQRCodeReader } = await import('@zxing/browser');
          const reader = new BrowserQRCodeReader();
          if (videoRef.current) {
            reader.decodeFromVideoElement(videoRef.current, (result) => {
              if (result && active) handleResult(result.getText());
            });
          }
        } catch {
          setError('Câmera não suportada neste navegador. Cole a URL do QR code abaixo.');
        }
      }
    }

    function handleResult(raw: string) {
      active = false;
      stopStream();
      onResult(raw);
    }

    function stopStream() {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    }

    startScanner();
    return () => { active = false; cancelAnimationFrame(animRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [onResult]);

  const handleManualSubmit = () => {
    if (manualUrl.trim()) onResult(manualUrl.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-square w-full max-w-xs mx-auto">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {/* Scanning reticle */}
        {!error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/70 rounded-xl" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 p-4">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Ou cole a URL do QR code</Label>
        <div className="flex gap-2">
          <Input
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="https://app.../reports/new?asset_id=..."
            className="h-10 rounded-xl bg-muted"
            onKeyDown={e => { if (e.key === 'Enter') handleManualSubmit(); }}
          />
          <Button size="sm" onClick={handleManualSubmit} className="rounded-xl shrink-0">
            Ir
          </Button>
        </div>
      </div>

      <Button variant="outline" onClick={onClose} className="rounded-xl gap-2">
        <XCircle className="h-4 w-4" /> Cancelar
      </Button>
    </div>
  );
}
