const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

type ThinkChunk =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'text'; text: string };

export class ThinkTagParser {
  private buf = '';

  feed(token: string): ThinkChunk[] {
    this.buf += token;
    const chunks: ThinkChunk[] = [];

    while (this.buf.length > 0) {
      const openIdx = this.buf.indexOf(OPEN_TAG);
      const closeIdx = this.buf.indexOf(CLOSE_TAG);

      if (openIdx === -1 && closeIdx === -1) {
        if (this.couldBePartialTag(this.buf)) {
          break;
        }
        chunks.push({ type: 'text', text: this.buf });
        this.buf = '';
        break;
      }

      let nextIdx: number;
      let isOpen: boolean;

      if (openIdx !== -1 && closeIdx !== -1) {
        isOpen = openIdx <= closeIdx;
        nextIdx = isOpen ? openIdx : closeIdx;
      } else if (openIdx !== -1) {
        isOpen = true;
        nextIdx = openIdx;
      } else {
        isOpen = false;
        nextIdx = closeIdx;
      }

      if (nextIdx > 0) {
        chunks.push({ type: 'text', text: this.buf.slice(0, nextIdx) });
      }

      const tag = isOpen ? OPEN_TAG : CLOSE_TAG;
      chunks.push({ type: isOpen ? 'open' : 'close' });
      this.buf = this.buf.slice(nextIdx + tag.length);
    }

    return chunks;
  }

  flush(): ThinkChunk[] {
    if (this.buf.length === 0) return [];
    const text = this.buf;
    this.buf = '';
    return [{ type: 'text', text }];
  }

  private couldBePartialTag(s: string): boolean {
    const tail = s.slice(Math.max(0, s.length - CLOSE_TAG.length + 1));
    for (let i = 1; i <= tail.length; i++) {
      const suffix = tail.slice(tail.length - i);
      if (OPEN_TAG.startsWith(suffix) || CLOSE_TAG.startsWith(suffix)) {
        return true;
      }
    }
    return false;
  }
}
