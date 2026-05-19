import { REPORT_STATUS_LABEL, REPORT_STATUS_COLOR } from '@/src/types/reports';
import type { ReportStatus } from '@/src/types/reports';

interface ReportStatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

export default function ReportStatusBadge({ status, className = '' }: ReportStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${REPORT_STATUS_COLOR[status]} ${status === 'pending_review' ? 'motion-safe:animate-pulse' : ''} ${className}`}>
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}
