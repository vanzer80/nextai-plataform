import { Trash2 } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import type { Control, UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import type { OrcamentoFormValues } from '../NovoOrcamento';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  index: number;
  control: Control<OrcamentoFormValues>;
  register: UseFormRegister<OrcamentoFormValues>;
  errors: FieldErrors<OrcamentoFormValues>;
  watch: UseFormWatch<OrcamentoFormValues>;
  onRemove: () => void;
  isOnly: boolean;
  showOSHint?: boolean;
}

export function ItemRow({ index, register, errors, watch, onRemove, isOnly, showOSHint }: Props) {
  const qtd = Number(watch(`itens.${index}.quantidade`)) || 0;
  const valor = Number(watch(`itens.${index}.valor_unitario`)) || 0;
  const subtotal = qtd * valor;

  const itensErrors = errors.itens as Record<number, Record<string, { message?: string }>> | undefined;
  const rowErrors = itensErrors?.[index];

  return (
    <div className="grid grid-cols-[1fr_80px_60px_110px_auto] gap-2 items-start">
      <div>
        <Input
          placeholder="Descrição do item"
          {...register(`itens.${index}.descricao`)}
          className={rowErrors?.descricao ? 'border-rose-400' : ''}
        />
        {rowErrors?.descricao && (
          <p className="text-[11px] text-rose-500 mt-0.5">{rowErrors.descricao.message}</p>
        )}
      </div>

      <Input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Qtd"
        {...register(`itens.${index}.quantidade`, { valueAsNumber: true })}
      />

      <Input
        placeholder="Un."
        {...register(`itens.${index}.unidade`)}
      />

      <div>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor unit."
          {...register(`itens.${index}.valor_unitario`, { valueAsNumber: true })}
        />
        {showOSHint && valor === 0 ? (
          <p className="text-[10px] text-amber-600 mt-0.5 font-medium">⚠ Preencha o preço</p>
        ) : subtotal > 0 ? (
          <p className="text-[11px] text-slate-500 mt-0.5 text-right">{BRL.format(subtotal)}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={isOnly}
        className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
