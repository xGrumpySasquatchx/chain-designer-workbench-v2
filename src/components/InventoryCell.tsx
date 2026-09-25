import { stockStatus, stockLine, locationLine } from '../model/inventory';
import type { InventoryRecord } from '../model/types';

const PILL: Record<string, string> = {
  'In stock': 'imp',
  Low: 'on',
  'Used up': 'blk',
  'Not made': '',
};

export function InventoryCell({ record }: { record: InventoryRecord | undefined }) {
  const status = stockStatus(record);
  return (
    <>
      <span className={`pill ${PILL[status]}`.trim()}>{status}</span>
      <span className="sm">{stockLine(record)}</span>
      {status !== 'Not made' ? <span className="sm">{locationLine(record)}</span> : null}
    </>
  );
}
