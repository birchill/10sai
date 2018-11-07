export function getAncestorWithClass(
  elem: HTMLElement | null,
  className: string
): HTMLElement | null {
  let current: HTMLElement | null = elem;
  while (current && !current.classList.contains(className)) {
    current = current.parentElement;
  }
  return current;
}
