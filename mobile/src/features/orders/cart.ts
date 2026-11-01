// The cart: ONE shop at a time (an order goes to one shop), kept in memory for the app session. Prices shown here are only a
// preview; the server prices the order again when it is placed.
import { useSyncExternalStore } from "react";

export type CartLine = { productId: string; name: string; partNumber: string; price: number; imageUri: string | null; quantity: number; /** units free to order */ max: number };
export type Cart = { shopId: string; shopName: string; lines: CartLine[] } | null;

let cart: Cart = null;
const listeners = new Set<() => void>();
const set = (c: Cart) => {
  cart = c && c.lines.length ? c : null;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useCart = () => useSyncExternalStore(subscribe, () => cart, () => cart);
export const cartCount = (c: Cart) => (c ? c.lines.reduce((n, l) => n + l.quantity, 0) : 0);
export const cartSubtotal = (c: Cart) => (c ? Math.round(c.lines.reduce((n, l) => n + l.price * l.quantity, 0) * 100) / 100 : 0);

/** "other-shop" = the cart holds another shop's parts: ask before starting a new cart (addToCart(..., true)). */
export function addToCart(shop: { id: string; name: string }, line: Omit<CartLine, "quantity">, quantity: number, replace = false): "added" | "other-shop" {
  if (cart && cart.shopId !== shop.id && !replace) return "other-shop";
  const base = cart && cart.shopId === shop.id ? cart : { shopId: shop.id, shopName: shop.name, lines: [] };
  const had = base.lines.find((l) => l.productId === line.productId);
  const lines = had
    ? base.lines.map((l) => (l.productId === line.productId ? { ...l, ...line, quantity: Math.min(line.max, l.quantity + quantity) } : l))
    : [...base.lines, { ...line, quantity: Math.min(line.max, quantity) }];
  set({ ...base, lines });
  return "added";
}
export const setQuantity = (productId: string, quantity: number) =>
  cart && set({ ...cart, lines: cart.lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(l.max, quantity)) } : l)) });
export const removeLine = (productId: string) => cart && set({ ...cart, lines: cart.lines.filter((l) => l.productId !== productId) });
export const clearCart = () => set(null);
