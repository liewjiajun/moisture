// Game types and interfaces

export type GameState = 'menu' | 'lounge' | 'countdown' | 'game' | 'card_select' | 'death';

export interface WalletState {
  connected: boolean;
  address: string | null;
  characterSeed: number;
}

export interface CardDefinition {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: 'defense' | 'movement' | 'bullet' | 'utility';
  color: number;
  maxLevel: number;
  effect: string;
}

export interface CardLevels {
  heart: number;
  tiny: number;
  ghost: number;
  shield: number;
  swift: number;
  blink: number;
  focus: number;
  reflect: number;
  repel: number;
  freeze: number;
  shrink: number;
  calm: number;
  chaos: number;
}

export interface EnemyStats {
  speed: number;
  health: number;
  damage: number;
  shootRate: number;
  points: number;
  splits?: boolean;
  phasing?: boolean;
  multishot?: boolean;
  homing?: boolean;
}

export type EnemyType = 'fairy' | 'slime' | 'bunny' | 'neko' | 'witch' | 'miko' | 'ghost' | 'demon' | 'kitsune' | 'angel';

export type BulletPattern = 'single' | 'spread3' | 'spread5' | 'ring' | 'spiral' | 'burst' | 'wave' | 'random_spread' | 'aimed_double';

export interface CharacterColors {
  skinBase: number;
  skinShadow: number;
  skinHighlight: number;
  hairBase: number;
  hairShadow: number;
  shirtBase: number;
  shirtShadow: number;
  pantsBase: number;
  pantsShadow: number;
  eyeColor: number;
}

export interface GameEvents {
  walletStateChanged: (state: WalletState) => void;
  gameStateChanged: (state: GameState) => void;
  scoreSubmit: (score: number) => void;
  requestWalletConnect: () => void;
  requestEnterGame: () => void;
}
