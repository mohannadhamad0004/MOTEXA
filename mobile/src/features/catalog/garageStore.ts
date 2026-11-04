import type { GarageCar, GarageCarScalar, GarageInput, GenerationRow } from "./catalogService";

export const MAX_GARAGE_CARS = 10;
export type Car = { id?: string; make: string; model: string; year: string; trim: string; color?: string | null; bodyType?: string | null; generation?: GenerationRow | null };
export type GarageState = { userId: string | null; garageCars: GarageCar[]; activeCar: Car | null; selectionRevision: number; loaded: boolean; loading: boolean; busy: boolean; error: string | null };
type Api = {
  getGarage(): Promise<GarageCar[]>;
  addGarageCar(input: GarageInput): Promise<GarageCarScalar>;
  updateGarageCar(id: string, input: Partial<GarageInput>): Promise<GarageCarScalar>;
  deleteGarageCar(id: string): Promise<void>;
  activateGarageCar(id: string): Promise<GarageCarScalar>;
};
const empty = (): GarageState => ({ userId: null, garageCars: [], activeCar: null, selectionRevision: 0, loaded: false, loading: false, busy: false, error: null });
export const toActiveCar = (cars: GarageCar[]): Car | null => {
  const c = cars.find(c => c.isActive);
  return c ? { id: c.id, make: c.make, model: c.model, year: String(c.year), trim: "", color: c.color, generation: c.generation } : null;
};
export const canAddGarageCar = (cars: GarageCar[]) => cars.length < MAX_GARAGE_CARS;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const matchingGarageCars = (cars: GarageCar[], input: { make: string; model: string; year: number | string; generationId?: string | null }) => cars.filter(c =>
  norm(c.make) === norm(input.make) && norm(c.model) === norm(input.model) && c.year === Number(input.year) &&
  (input.generationId === undefined || c.generationId === input.generationId));

/** Framework-free store: one owner, one in-flight read, and one write at a time. */
export function createGarageStore(api: Api) {
  let state = empty();
  let epoch = 0;
  let revision = 0;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const put = (patch: Partial<GarageState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
  const apply = (cars: GarageCar[]) => put({ garageCars: cars, activeCar: toActiveCar(cars) });
  const reset = (userId: string | null) => { epoch++; revision++; pending = null; state = { ...empty(), userId }; listeners.forEach(l => l()); };
  const refresh = (): Promise<void> => {
    if (!state.userId) return Promise.resolve();
    if (pending) return pending;
    const token = epoch, version = revision;
    put({ loading: true, error: null });
    const request = api.getGarage().then(cars => {
      if (epoch === token && revision === version) apply(cars);
    }).catch(error => {
      if (epoch === token && revision === version) put({ error: error.message ?? "Garage could not be loaded." });
    }).finally(() => {
      if (epoch === token && revision === version) put({ loaded: true, loading: false });
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  };
  const mutate = async <T>(work: () => Promise<T>, optimistic?: (result: T) => void, refreshFailed?: () => void) => {
    if (!state.userId || !state.loaded) throw new Error("GARAGE_NOT_READY");
    if (state.busy) throw new Error("GARAGE_BUSY");
    const token = epoch;
    revision++; pending = null;
    put({ busy: true, loading: false, error: null });
    try {
      const result = await work();
      if (token !== epoch) return result;
      revision++; pending = null; // discard any read started while the write was pending
      optimistic?.(result);
      await refresh();
      if (token === epoch && state.error) refreshFailed?.();
      return result;
    } catch (error) {
      // A lost response can follow a committed write. Reconcile before allowing a retry,
      // especially POST, so the same car is not submitted a second time accidentally.
      if (token === epoch) { revision++; pending = null; await refresh(); }
      throw error;
    } finally { if (epoch === token) put({ busy: false }); }
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset,
    hydrate: (userId: string) => { if (state.userId !== userId) reset(userId); return state.loaded ? Promise.resolve() : refresh(); },
    refresh,
    add: (input: GarageInput) => mutate(async () => {
      if (!canAddGarageCar(state.garageCars)) throw new Error("GARAGE_LIMIT_REACHED");
      if (matchingGarageCars(state.garageCars, input).length) throw new Error("GARAGE_ALREADY_SAVED");
      return api.addGarageCar(input);
    }, saved => apply([...state.garageCars, { ...saved, generation: null }])),
    update: (id: string, input: Partial<GarageInput>) => mutate(() => api.updateGarageCar(id, input), saved => {
      apply(state.garageCars.map(c => c.id === id ? { ...c, ...saved, generation: saved.generationId === c.generationId ? c.generation : null } : c));
    }),
    remove: (id: string) => mutate(() => api.deleteGarageCar(id), undefined, () => {
      // Keep the active car until GET supplies its replacement; if GET fails, don't retain a deleted identity.
      apply(state.garageCars.filter(c => c.id !== id));
    }),
    activate: (id: string) => mutate(() => api.activateGarageCar(id), saved => {
      apply(state.garageCars.map(c => ({ ...c, ...(c.id === id ? saved : {}), isActive: c.id === id })));
      put({ selectionRevision: state.selectionRevision + 1 });
    }),
  };
}
