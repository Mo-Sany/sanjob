/**
 * Green list highlight drawn in a closed shadow root (pointer-events: none, no layout shift):
 * a box around the whole list, a dashed outline per item and a label next to the cursor.
 * Shared by the list picker and the hover preview.
 */
const MAX_ITEM_BOXES = 300;

const STYLE = `
  :host { all: initial; }
  .root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .list { position: fixed; border: 2px solid #22c55e; background: rgba(34,197,94,0.10);
    border-radius: 10px; box-shadow: 0 0 0 4px rgba(34,197,94,0.15); opacity: 0;
    transition: left .12s ease, top .12s ease, width .12s ease, height .12s ease, opacity .12s ease; }
  .list.on { opacity: 1; }
  .item { position: fixed; border: 1px dashed #16a34a; border-radius: 6px;
    background: rgba(34,197,94,0.04); }
  .label { position: fixed; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    max-width: min(480px, calc(100vw - 16px)); padding: 6px 10px; border-radius: 8px;
    background: #14532d; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.25);
    transition: left .08s ease, top .08s ease, opacity .12s ease; }
  .label.off { opacity: 0; }
  .label .smart { padding: 1px 6px; border-radius: 999px; background: #22c55e; color: #052e16;
    font-size: 11px; font-weight: 600; }
  .banner { position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    padding: 8px 14px; border-radius: 10px; background: #0f172a; color: #fff;
    box-shadow: 0 4px 14px rgba(0,0,0,.25); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export class ListOverlay {
  private readonly host: HTMLElement;
  private readonly listBox: HTMLDivElement;
  private readonly itemsLayer: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private items: Element[] = [];
  private mouse = { x: 0, y: 0 };
  private frame = 0;

  constructor(tag: string) {
    this.host = document.createElement(tag);
    this.host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const shadow = this.host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${STYLE}</style><div class="root"><div class="items"></div><div class="list"></div><div class="label off"></div><div class="banner" hidden></div></div>`;
    this.listBox = shadow.querySelector('.list') as HTMLDivElement;
    this.itemsLayer = shadow.querySelector('.items') as HTMLDivElement;
    this.label = shadow.querySelector('.label') as HTMLDivElement;
    this.banner = shadow.querySelector('.banner') as HTMLDivElement;
    document.documentElement.append(this.host);
  }

  get element(): HTMLElement {
    return this.host;
  }

  setBanner(text: string | null): void {
    this.banner.hidden = !text;
    this.banner.textContent = text ?? '';
  }

  /** Shows a list (or hides it with `null`) and the label text. */
  show(items: Element[] | null, text: string | null, badge: string | null = null): void {
    this.items = items ?? [];
    this.label.replaceChildren();
    if (text) {
      this.label.append(document.createTextNode(text));
      if (badge) {
        const b = document.createElement('span');
        b.className = 'smart';
        b.textContent = badge;
        this.label.append(b);
      }
    }
    this.label.classList.toggle('off', !text);
    this.schedule();
  }

  moveTo(x: number, y: number): void {
    this.mouse = { x, y };
    this.schedule();
  }

  schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private place(
    el: HTMLElement,
    r: { left: number; top: number; width: number; height: number },
    pad = 0,
  ): void {
    el.style.left = `${r.left - pad}px`;
    el.style.top = `${r.top - pad}px`;
    el.style.width = `${r.width + pad * 2}px`;
    el.style.height = `${r.height + pad * 2}px`;
  }

  private render(): void {
    const shown = this.items.slice(0, MAX_ITEM_BOXES);
    const rects = shown
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    if (rects.length) {
      // The big box is the union of all items: it covers the whole list, also across blocks.
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      this.listBox.classList.add('on');
      this.place(this.listBox, { left, top, width: right - left, height: bottom - top }, 6);
    } else {
      this.listBox.classList.remove('on');
    }
    while (this.itemsLayer.childElementCount < rects.length) {
      const d = document.createElement('div');
      d.className = 'item';
      this.itemsLayer.append(d);
    }
    while (this.itemsLayer.childElementCount > rects.length)
      this.itemsLayer.lastElementChild?.remove();
    rects.forEach((r, i) => this.place(this.itemsLayer.children[i] as HTMLElement, r));

    // The label follows the cursor but stays inside the viewport.
    const lw = this.label.offsetWidth || 260;
    const lh = this.label.offsetHeight || 30;
    const x = Math.min(this.mouse.x + 16, window.innerWidth - lw - 8);
    const y =
      this.mouse.y + 18 + lh > window.innerHeight ? this.mouse.y - lh - 12 : this.mouse.y + 18;
    this.label.style.left = `${Math.max(8, x)}px`;
    this.label.style.top = `${Math.max(8, y)}px`;
  }

  destroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.host.remove();
  }
}
