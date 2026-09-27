(() => {
  const FROM = 'regtechnexusai@gmail.com';
  const GREETING = 'Greetings from RegTech Nexus AI.';
  const DEFAULT_SUBJECT = 'Greetings from RegTech Nexus AI';
  const DEFAULT_BODY = [
    GREETING,
    '',
    'Thank you for your interest in RegTech Nexus AI. Please share your message below.',
    '',
    'Regards,',
    'RegTech Nexus AI',
    FROM,
    'https://regtechnexusai.com'
  ].join('\n');

  const prepareEmail = (subject = '', body = '') => {
    const resolvedSubject = String(subject || '').trim() || DEFAULT_SUBJECT;
    const resolvedBody = String(body || '').trim();
    if (!resolvedBody) return { subject: resolvedSubject, body: DEFAULT_BODY };
    const bodyWithGreeting = /^Greetings from RegTech Nexus AI[.!]?/i.test(resolvedBody)
      ? resolvedBody
      : GREETING + '\n\n' + resolvedBody;
    return { subject: resolvedSubject, body: bodyWithGreeting };
  };

  const fallbackMailto = (subject = '', body = '') =>
    'mailto:?from=' + encodeURIComponent(FROM)
    + '&subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);

  const open = (subject = '', body = '') => {
    const prepared = prepareEmail(subject, body);
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      tf: '1',
      authuser: FROM,
      to: '',
      su: prepared.subject,
      body: prepared.body
    });
    const gmailUrl = 'https://mail.google.com/mail/?' + params.toString();
    const popup = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.href = fallbackMailto(prepared.subject, prepared.body);
  };

  window.RegTechEmail = Object.freeze({ from: FROM, open });

  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const rawHref = link.getAttribute('href') || '';
      let subject = link.dataset.subject || '';
      let body = link.dataset.body || '';
      try {
        const parsed = new URL(rawHref, window.location.href);
        subject = parsed.searchParams.get('subject') || subject;
        body = parsed.searchParams.get('body') || body;
      } catch {
        // Keep explicit data attributes when a legacy mailto value cannot be parsed.
      }
      open(subject, body);
    });
  });
})();
