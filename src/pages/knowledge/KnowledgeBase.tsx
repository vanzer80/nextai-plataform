import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Search, Tag, Eye, Loader2, Pencil, Trash2,
  ChevronDown, X, Globe, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  listKbArticles, createKbArticle, updateKbArticle, deleteKbArticle, incrementView,
} from '@/src/services/kbService';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';
import type { KbArticle } from '@/src/types/kb';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ── Viewer ────────────────────────────────────────────────────────────────────
function ArticleViewDialog({ article, onClose }: { article: KbArticle | null; onClose: () => void }) {
  useEffect(() => {
    if (article) incrementView(article.id);
  }, [article?.id]);

  if (!article) return null;
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            {article.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {article.service_type && (
              <Badge variant="secondary">{article.service_type}</Badge>
            )}
            {article.tags.map(t => (
              <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
            ))}
            {article.is_public
              ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs"><Globe className="h-3 w-3 mr-1" />Público</Badge>
              : <Badge variant="outline" className="text-xs"><Lock className="h-3 w-3 mr-1" />Interno</Badge>
            }
          </div>
          <p className="text-xs text-muted-foreground">
            Atualizado em {formatDate(article.updated_at)} · {article.view_count} visualizações
          </p>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed bg-muted/30 rounded-lg p-4">
              {article.content}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────
interface EditorProps {
  article: KbArticle | null;
  onClose: () => void;
  onSaved: () => void;
}

function ArticleEditorDialog({ article, onClose, onSaved }: EditorProps) {
  const { user } = useAuth();
  const { types: serviceTypes } = useServiceTypes();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(article?.title ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [serviceType, setServiceType] = useState(article?.service_type ?? '');
  const [tagsInput, setTagsInput] = useState((article?.tags ?? []).join(', '));
  const [isPublic, setIsPublic] = useState(article?.is_public ?? false);

  const parseTags = (raw: string) =>
    raw.split(',').map(t => t.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!title.trim()) { toast.warning('Informe o título.'); return; }
    if (!content.trim()) { toast.warning('Informe o conteúdo.'); return; }
    if (!user?.id) return;

    setSaving(true);
    try {
      const dto = {
        title:        title.trim(),
        content:      content.trim(),
        service_type: serviceType || null,
        tags:         parseTags(tagsInput),
        is_public:    isPublic,
      };
      if (article) {
        await updateKbArticle(article.id, dto, user.id);
        toast.success('Artigo atualizado.');
      } else {
        await createKbArticle(dto, user.id);
        toast.success('Artigo criado.');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar artigo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{article ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do artigo" />
          </div>
          <div className="space-y-1.5">
            <Label>Conteúdo * <span className="text-xs text-muted-foreground">(suporta Markdown)</span></Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              placeholder="Descreva o procedimento, solução ou conhecimento técnico..."
              className="font-mono text-sm resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Serviço</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer tipo</SelectItem>
                  {serviceTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-xs text-muted-foreground">(separadas por vírgula)</span></Label>
              <Input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="motor, elétrica, preventiva"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="is-public" className="cursor-pointer">
              {isPublic ? (
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <Globe className="h-3.5 w-3.5" /> Visível no portal do cliente
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Interno — apenas equipe
                </span>
              )}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {article ? 'Salvar alterações' : 'Publicar artigo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const { user } = useAuth();
  const { types: serviceTypes } = useServiceTypes();

  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const [viewing, setViewing] = useState<KbArticle | null>(null);
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const isEditor = user?.role && ['Gestor', 'Admin', 'Master'].includes(user.role);

  const canManage = isEditor;

  const load = useCallback(() => {
    setLoading(true);
    listKbArticles({
      search: search.trim() || undefined,
      serviceType: filterType || undefined,
      tag: filterTag || undefined,
    })
      .then(setArticles)
      .catch(() => toast.error('Erro ao carregar artigos.'))
      .finally(() => setLoading(false));
  }, [search, filterType, filterTag]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const handleDelete = async (a: KbArticle) => {
    if (!confirm(`Desativar "${a.title}"?`)) return;
    try {
      await deleteKbArticle(a.id);
      setArticles(prev => prev.filter(x => x.id !== a.id));
      toast.success('Artigo desativado.');
    } catch {
      toast.error('Erro ao desativar artigo.');
    }
  };

  const openNew = () => {
    setEditing(null);
    setShowEditor(true);
  };

  const openEdit = (a: KbArticle) => {
    setEditing(a);
    setShowEditor(true);
  };

  const allTags = Array.from(new Set(articles.flatMap(a => a.tags))).sort();

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Artigos técnicos e procedimentos da equipe</p>
        </div>
        {canManage && (
          <Button data-onboarding="kb-novo" onClick={openNew} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Novo artigo
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div data-onboarding="kb-busca" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar artigos..."
            className="pl-9"
          />
          {search && (
            <button
              aria-label="Limpar pesquisa"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            {serviceTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as tags</SelectItem>
              {allTags.map(t => (
                <SelectItem key={t} value={t}>#{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(filterType || filterTag) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterType(''); setFilterTag(''); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              {search || filterType || filterTag
                ? 'Nenhum artigo encontrado para os filtros aplicados.'
                : 'Nenhum artigo publicado ainda.'}
            </p>
            {canManage && !search && !filterType && !filterTag && (
              <Button variant="outline" onClick={openNew} className="gap-2 mt-1">
                <Plus className="h-4 w-4" /> Criar primeiro artigo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div data-onboarding="kb-grid" className="flex flex-col gap-3">
          {articles.map(a => (
            <Card
              key={a.id}
              className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              onClick={() => setViewing(a)}
            >
              <CardContent className="pt-4 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground hover:text-primary transition-colors">
                      {a.title}
                    </span>
                    {a.is_public && (
                      <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.service_type && (
                      <Badge variant="secondary" className="text-xs">{a.service_type}</Badge>
                    )}
                    {a.tags.slice(0, 3).map(t => (
                      <Badge key={t} variant="outline" className="text-xs">
                        <Tag className="h-2.5 w-2.5 mr-1" />#{t}
                      </Badge>
                    ))}
                    {a.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{a.tags.length - 3}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" />{a.view_count}
                    <span>· {formatDate(a.updated_at)}</span>
                    {a.users_created?.full_name && (
                      <span>· {a.users_created.full_name}</span>
                    )}
                  </p>
                </div>
                {canManage && (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewing && (
        <ArticleViewDialog article={viewing} onClose={() => setViewing(null)} />
      )}

      {showEditor && (
        <ArticleEditorDialog
          article={editing}
          onClose={() => setShowEditor(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
