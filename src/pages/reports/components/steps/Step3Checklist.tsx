import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Loader2, ListTodo } from 'lucide-react';
import ChecklistRenderer from '../ChecklistRenderer';
import type { ChecklistTemplate, ReportChecklistItem, ServiceType } from '@/src/types/reports';

interface Step3ChecklistProps {
  serviceType: ServiceType | null | undefined;
  template: ChecklistTemplate | null;
  templateLoading: boolean;
  answers: Record<string, Partial<ReportChecklistItem>>;
  onAnswerChange: (itemId: string, patch: Partial<ReportChecklistItem>) => void;
}

export default function Step3Checklist({
  serviceType,
  template,
  templateLoading,
  answers,
  onAnswerChange,
}: Step3ChecklistProps) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Checklist de Verificação
          {template && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {template.name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">

        {/* Sem tipo de serviço selecionado */}
        {!serviceType && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ListTodo className="h-9 w-9 mb-3" />
            <p className="text-sm font-medium">Selecione o tipo de serviço</p>
            <p className="text-xs mt-1">O checklist será carregado automaticamente.</p>
          </div>
        )}

        {/* Carregando template */}
        {serviceType && templateLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando checklist...</span>
          </div>
        )}

        {/* Sem template cadastrado */}
        {serviceType && !templateLoading && !template && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ListTodo className="h-9 w-9 mb-3" />
            <p className="text-sm font-medium">Nenhum checklist cadastrado</p>
            <p className="text-xs mt-1 text-center">
              Para {serviceType}. Um Admin pode criar templates em<br />
              Configurações → Checklists.
            </p>
          </div>
        )}

        {/* Checklist com itens */}
        {serviceType && !templateLoading && template?.items && template.items.length > 0 && (
          <ChecklistRenderer
            items={template.items}
            answers={answers}
            onChange={onAnswerChange}
          />
        )}

      </CardContent>
    </Card>
  );
}
