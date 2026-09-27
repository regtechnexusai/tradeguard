(() => {
  const FROM = 'regtechnexusai@gmail.com';

  const fallbackMailto = (subject = '', body = '') =>
    'mailto:?from=' + encodeURIComponent(FROM)
    + '&subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);

  const open = (subject = '', body = '') => {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      tf: '1',
      authuser: FROM,
      to: '',
      su: subject,
      body
    });
    const gmailUrl = 'https://mail.google.com/mail/?' + params.toString();
    const popup = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.href = fallbackMailto(subject, body);
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
