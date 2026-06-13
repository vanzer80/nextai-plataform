import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import { getCsatByToken, submitCsat } from '@/src/services/csatService';
import type { CsatTokenData } from '@/src/types/csat';

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function CsatPage() {
  const { token } = useParams<{ token: string }>();
  const [csat, setCsat] = useState<CsatTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    getCsatByToken(token)
      .then(data => {
        if (!data) { setNotFound(true); return; }
        setCsat(data);
        if (data.already_submitted) setSubmitted(true);
        if (data.rating) setRating(data.rating);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!token || rating === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitCsat(token, rating, comment || undefined);
      if (!result.success) { setSubmitError(result.error ?? 'Erro ao enviar.'); return; }
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const STAR_LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
  const activeRating = hoveredStar || rating;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
        <p className="text-sm text-muted-foreground text-center">Este link de avaliação não existe ou expirou.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg overflow-hidden animate-in fade-in duration-300">

        {/* Header */}
        <div className="bg-primary p-6 flex flex-col items-center gap-3">
          {csat?.tenant_logo_url ? (
            <img src={csat.tenant_logo_url} alt={csat.tenant_name} className="h-10 object-contain brightness-0 invert" />
          ) : (
            <p className="text-lg font-bold text-primary-foreground">{csat?.tenant_name}</p>
          )}
          <p className="text-primary-foreground/80 text-sm">Avaliação de Serviço</p>
        </div>

        <div className="p-6 space-y-6">
          {/* OS info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-1">
            {csat?.os_number && (
              <p className="text-sm font-semibold text-foreground">OS #{csat.os_number}</p>
            )}
            {csat?.client_name && (
              <p className="text-sm text-muted-foreground">{csat.client_name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {csat?.service_type && <span>{csat.service_type} · </span>}
              {fmt(csat?.service_date)}
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-bold text-foreground">Obrigado pela avaliação!</p>
              <p className="text-sm text-muted-foreground text-center">Seu feedback é muito importante para continuarmos melhorando.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-foreground">Como foi o nosso atendimento?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110 active:scale-95 outline-none"
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          activeRating >= star ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {activeRating > 0 && (
                  <p className="text-sm font-medium text-amber-600">{STAR_LABELS[activeRating]}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Comentário (opcional)</p>
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Conte-nos mais sobre sua experiência..."
                  className="rounded-xl bg-muted resize-none min-h-[80px]"
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive text-center">{submitError}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="w-full h-12 rounded-xl font-semibold"
              >
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar Avaliação'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
