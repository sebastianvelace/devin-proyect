// Generic object pool class

/**
 * Pool de objetos reutilizables para evitar crear/destruir cada frame
 * (balas, partículas). Mantiene una lista de objetos activos y otra de libres.
 */
export class Pool<T> {
  private readonly free: T[] = [];
  readonly active: T[] = [];
  private readonly create: () => T;

  constructor(create: () => T, prealloc = 0) {
    this.create = create;
    for (let i = 0; i < prealloc; i++) {
      this.free.push(create());
    }
  }

  /** Obtiene un objeto (reusado o nuevo) y lo marca como activo. */
  obtain(): T {
    const item = this.free.pop() ?? this.create();
    this.active.push(item);
    return item;
  }

  /** Devuelve un objeto activo al pool. */
  release(item: T): void {
    const idx = this.active.indexOf(item);
    if (idx !== -1) {
      // swap-remove: O(1) en vez de splice O(n)
      const last = this.active.length - 1;
      this.active[idx] = this.active[last];
      this.active.pop();
      this.free.push(item);
    }
  }

  /**
   * Recorre los activos y libera los que cumplan `isDead`, compactando el
   * array de activos en una sola pasada (sin asignaciones intermedias).
   */
  sweep(isDead: (item: T) => boolean): void {
    let write = 0;
    for (let read = 0; read < this.active.length; read++) {
      const item = this.active[read];
      if (isDead(item)) {
        this.free.push(item);
      } else {
        this.active[write++] = item;
      }
    }
    this.active.length = write;
  }

  /** Libera todos los activos. */
  releaseAll(): void {
    for (const item of this.active) this.free.push(item);
    this.active.length = 0;
  }

  get activeCount(): number {
    return this.active.length;
  }
}
