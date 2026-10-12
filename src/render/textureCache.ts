/** One immutable display source and appearance key; metadata edits need no raster repaint. */
export class TextureCache {
  private source: object | null = null;
  private key = '';
  private canvas: HTMLCanvasElement | null = null;
  clear(): void { this.source = null; this.key = ''; this.canvas = null; }
  prime(source: object, key: string, canvas: HTMLCanvasElement): void {
    this.source = source; this.key = key; this.canvas = canvas;
  }
  get(source: object, key: string, render: () => HTMLCanvasElement): HTMLCanvasElement {
    if (this.source !== source || this.key !== key || !this.canvas) {
      const canvas = render();
      this.source = source; this.key = key; this.canvas = canvas;
    }
    return this.canvas;
  }
}
