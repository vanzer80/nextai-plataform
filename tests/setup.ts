import '@testing-library/jest-dom';

// jsdom's Blob may not expose .text() — provide a FileReader-based polyfill
Object.defineProperty(globalThis.Blob.prototype, 'text', {
  configurable: true,
  writable: true,
  value(this: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsText(this);
    });
  },
});
