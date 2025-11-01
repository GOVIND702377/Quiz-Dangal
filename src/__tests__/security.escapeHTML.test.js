import { describe, it, expect } from 'vitest';
import { escapeHTML } from '@/lib/security';

describe('security.escapeHTML', () => {
  it('escapes special characters', () => {
    expect(escapeHTML('<script>alert("x")</script> & "\'\''))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;&#39;&#39;');
  });

  it('is idempotent for already-escaped input', () => {
    const once = escapeHTML('&lt;div&gt;Tom &amp; Jerry&lt;/div&gt;');
    expect(once).toBe('&amp;lt;div&amp;gt;Tom &amp;amp; Jerry&amp;lt;/div&amp;gt;');
  });

  it('handles null/undefined gracefully', () => {
    expect(escapeHTML(null)).toBe('null');
    // default param makes undefined -> ''
    expect(escapeHTML(undefined)).toBe('');
    expect(escapeHTML('')).toBe('');
  });
});
