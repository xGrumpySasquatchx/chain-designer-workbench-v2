import type { InventoryRecord, StockStatus } from './types';

export function stockStatus(inventory: InventoryRecord | undefined): StockStatus {
  if (!inventory) return 'Not made';
  if (!inventory.volumeUl) return 'Used up';
  if (inventory.volumeUl < 80) return 'Low';
  return 'In stock';
}

export function stockLine(inventory: InventoryRecord | undefined): string {
  const status = stockStatus(inventory);
  if (status === 'Not made') return 'Not made yet';
  if (status === 'Used up') return 'Used up — make more';
  const parts = [
    `${inventory!.volumeUl} µL at ${inventory!.concentrationNgUl} ng/µL`,
    `${inventory!.plasmidUg} µg`,
  ];
  if (inventory!.glycerolStock) parts.push('glycerol stock');
  if (status === 'Low') parts.unshift('Low');
  return parts.join(' · ');
}

export function locationLine(inventory: InventoryRecord | undefined): string {
  if (!inventory) return '—';
  return inventory.position && inventory.position !== 'unassigned'
    ? `${inventory.location} / ${inventory.position}`
    : inventory.location;
}
