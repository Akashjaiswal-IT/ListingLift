import { create } from "zustand";

interface CreditStore {
  balance: number;
  isLoading: boolean;
  setBalance: (balance: number) => void;
  deductLocal: (amount: number) => void;
  addLocal: (amount: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useCreditStore = create<CreditStore>((set) => ({
  balance: 10, // Default trial credits
  isLoading: false,
  setBalance: (balance) => set({ balance }),
  deductLocal: (amount) =>
    set((state) => ({ balance: Math.max(0, state.balance - amount) })),
  addLocal: (amount) => set((state) => ({ balance: state.balance + amount })),
  setLoading: (isLoading) => set({ isLoading }),
}));
