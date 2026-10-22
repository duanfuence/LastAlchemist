/** Ключ сохранения в localStorage. Не зависит от версии формата: версия хранится внутри. */
export const SAVE_KEY = 'last-alchemist:save';
/** Резервная копия повреждённого сохранения — чтобы его можно было восстановить вручную. */
export const BACKUP_KEY = 'last-alchemist:save:corrupted-backup';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Локальное хранилище прогресса. Ошибки браузера (приватный режим, переполнение, запрет)
 * не прерывают игру: хранилище переходит в режим «без сохранения» и сообщает об этом.
 */
export class LocalSaveStore {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failed = false;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly delayMs = 400,
    private readonly onFailure: (error: unknown) => void = () => undefined,
  ) {
    if (!storage) this.failed = true;
  }

  /** Сохранение недоступно (нет хранилища или запись отклонена браузером). */
  get unavailable(): boolean {
    return this.failed;
  }

  read(): string | null {
    try {
      return this.storage?.getItem(SAVE_KEY) ?? null;
    } catch (error) {
      this.fail(error);
      return null;
    }
  }

  backup(raw: string): void {
    try {
      this.storage?.setItem(BACKUP_KEY, raw);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Отложенная запись: частые изменения объединяются в одну запись. */
  schedule(serialized: string): void {
    this.pending = serialized;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.pending === null || !this.storage) return;
    const data = this.pending;
    this.pending = null;
    try {
      this.storage.setItem(SAVE_KEY, data);
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.onFailure(error);
  }
}

/** localStorage может бросить исключение уже при обращении к свойству (запрещённые cookie). */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = '__last-alchemist-probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
