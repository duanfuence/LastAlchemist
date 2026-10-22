/**
 * Поведение браузера, мешающее игре во фрейме площадки:
 * контекстное меню, перетаскивание картинок, масштабирование жестом в iOS Safari.
 */
export function blockBrowserGestures(doc: Document = document): void {
  doc.addEventListener('contextmenu', (event) => event.preventDefault());
  doc.addEventListener('dragstart', (event) => event.preventDefault());
  for (const type of ['gesturestart', 'gesturechange'] as const) {
    doc.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
}
