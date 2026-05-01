// Mock wallet wrapper. Uses real EIP-1193 if available, otherwise generates a fake address.
import { connectWallet as connectReal, getEthProvider, isValidAddress } from '@/lib/wallet';

const KEY = 'arena_mock_wallet';

export interface ArenaWallet {
  address: string;
  isMock: boolean;
}

function randomAddress(): string {
  const hex = '0123456789abcdef';
  let a = '0x';
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

export function loadStoredWallet(): ArenaWallet | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as ArenaWallet;
    if (!isValidAddress(w.address)) return null;
    return w;
  } catch { return null; }
}

export function saveWallet(w: ArenaWallet) {
  localStorage.setItem(KEY, JSON.stringify(w));
}

export function clearWallet() {
  localStorage.removeItem(KEY);
}

export async function connectArenaWallet(opts: { allowMock?: boolean } = {}): Promise<ArenaWallet> {
  const provider = getEthProvider();
  if (provider) {
    try {
      const address = await connectReal();
      const w: ArenaWallet = { address, isMock: false };
      saveWallet(w);
      return w;
    } catch (e) {
      if (!opts.allowMock) throw e;
    }
  }
  if (opts.allowMock !== false) {
    const w: ArenaWallet = { address: randomAddress(), isMock: true };
    saveWallet(w);
    return w;
  }
  throw new Error('No wallet detected. Install Core or MetaMask.');
}

export function shortAddr(a: string): string {
  return a.slice(0, 6) + '…' + a.slice(-4);
}