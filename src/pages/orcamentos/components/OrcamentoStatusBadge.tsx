import { Badge } from '@/components/ui/badge';
import { ORCAMENTO_STATUS_COLOR, ORCAMENTO_STATUS_LABEL } from '@/src/types/orcamento';
import type { OrcamentoStatus } from '@/src/types/orcamento';

export function OrcamentoStatusBadge({ status }: { status: OrcamentoStatus }) {
  return (
    <Badge className={`${ORCAMENTO_STATUS_COLOR[status]} text-xs font-semibold border-0`}>
      {ORCAMENTO_STATUS_LABEL[status]}
    </Badge>
  );
}
