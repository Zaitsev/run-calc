import { describe, expect, it } from 'vitest';
import { parseClipboardPreviewEnabled } from './DisplaySettingsContext';

describe('parseClipboardPreviewEnabled', () => {
    it('defaults to disabled when storage is empty or false', () => {
        expect(parseClipboardPreviewEnabled(null)).toBe(false);
        expect(parseClipboardPreviewEnabled('false')).toBe(false);
    });

    it('enables clipboard preview only for true', () => {
        expect(parseClipboardPreviewEnabled('true')).toBe(true);
    });
});
