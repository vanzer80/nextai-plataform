# ADR-004 — QR Code Library Choice

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** B

## Context

Two QR code capabilities are needed: (1) generation of printable QR code labels for equipment, and (2) scanning QR codes via camera in the field (mobile browser).

## Decision

**Generation:** `qr-code-styling` (client-side, ~43 kB gzip). Supports styled QR with logo, downloads as PNG/SVG. Used in EquipmentManagement to generate labels.

**Scanning:** Use the native `BarcodeDetector` Web API as primary (zero bundle cost, supported on Android Chrome 83+ and iOS Safari 17.4+). Fall back to dynamically imported `@zxing/browser` for unsupported browsers. The fallback is loaded only when `BarcodeDetector` is unavailable.

```typescript
const scanner = 'BarcodeDetector' in window
  ? new BarcodeDetector({ formats: ['qr_code'] })
  : (await import('@zxing/browser')).BrowserQRCodeReader;
```

## Alternatives Considered

1. **jsQR** — Pure JS, 28 kB gzip. Good fallback but lacks the ergonomics of @zxing for camera stream management.
2. **react-qr-reader** — Abandoned, uses outdated jsQR. Rejected.
3. **Server-side QR generation** — Edge Function generating QR PNG. Unnecessary complexity for what is a pure client operation.

## Consequences

- `qr-code-styling` adds ~43 kB to the EquipmentManagement chunk (lazy loaded — does not affect initial bundle).
- `@zxing/browser` (~120 kB gzip) is only downloaded by users on browsers without BarcodeDetector — primarily older iOS Safari.
