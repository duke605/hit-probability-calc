export const Classes = [
  'ranged',
  'hybrid',
  'melee',
  'magic',
  'necromancy',
] as const;

export const Slots = [
  'main-hand',
  'head',
  'cape',
  '2h',
  'ring',
  'body',
  'legs',
  'off-hand',
  'pocket',
  'hands',
  'feet',
  'ammo',
  'sigil',
  'neck'
] as const;

export type Class = (typeof Classes)[number];
export type Slot = (typeof Slots)[number];

class Equipment {
  constructor(
    public readonly name: string,
    public readonly image: string,
    public readonly id: number,
    stats: {
      class: Class,
      slot: Slot,
      tier: number,
      damage?: number,
      style: 'Bolt'
    }
  ) {}
}

export default class Inventory {
  private slotHead
}