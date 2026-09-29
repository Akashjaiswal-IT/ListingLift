import { create } from "zustand";

interface CreditStore {
  balance: number;
  isInitialized: boolean;
  isLoading: boolean;
  setBalance: (balance: number) => void;
  deductLocal: (amount: number) => void;
  addLocal: (amount: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useCreditStore = create<CreditStore>((set) => ({
  balance: 0,
  isInitialized: false,
  isLoading: false,
  setBalance: (balance) => set({ balance, isInitialized: true, isLoading: false }),
  deductLocal: (amount) =>
    set((state) => ({ balance: Math.max(0, state.balance - amount) })),
  addLocal: (amount) => set((state) => ({ balance: state.balance + amount })),
  setLoading: (isLoading) => set({ isLoading }),
}));
