// Shared entry on extension pages. The background owns navigation and session context.
(() => {
  const source = location.pathname.split('/').pop();
  const query = new URLSearchParams(location.search);
  if (!query.get('url') && !['break.html', 'reflect.html'].includes(source)) return;

  function mount(container, skyIcon = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Try a small experiment — step away briefly and see how it feels';
    if (skyIcon) {
      button.className = 'experiment-box';
      button.setAttribute('aria-label', 'Open Pandora’s box: try a small experiment');
      const image = document.createElement('img');
      image.src = chrome.runtime.getURL('images/pandoras-box-closed.png');
      image.className = 'box-closed';
      const opened = document.createElement('img');
      opened.src = chrome.runtime.getURL('images/pandoras-box.png');
      opened.className = 'box-open';
      opened.alt = '';
      opened.draggable = false;
      image.alt = '';
      image.draggable = false;
      const hint = document.createElement('span');
      hint.className = 'experiment-box-hint';
      hint.textContent = 'A little experiment awaits';
      hint.setAttribute('aria-hidden', 'true');
      button.append(image, opened, hint);
      // Match the sky's other controls: use a native pointer instead of two cursors.
      if (typeof nativeCursorZone === 'function') nativeCursorZone(button);
    } else {
      button.textContent = 'Try a small experiment';
      button.style.cssText = 'display:block;margin:14px auto;max-width:90vw;pointer-events:auto;padding:12px 20px;border-radius:24px;border:1px solid #83977c;background:#18241f;color:#e6efdf;font:15px system-ui;cursor:pointer;';
    }
    button.addEventListener('pointerdown', e => e.stopPropagation());
    button.addEventListener('mousedown', e => e.stopPropagation());
    button.addEventListener('touchstart', e => e.stopPropagation(), {passive:true});
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({type:'experimentLaunch'});
        if (!result?.ok) throw new Error('Could not open');
      } catch {
        button.disabled = false;
        if (skyIcon) {
          button.querySelector('.experiment-box-hint').textContent = 'Could not open — try again';
          button.classList.add('has-error');
          button.setAttribute('aria-label', 'Could not open experiment. Try again');
        } else {
          button.textContent = 'Could not open — try again';
        }
      }
    });
    container.append(button);
  }

  if (source === 'reflect.html') {
    mount(document.getElementById('bottom'), true);
    mount(document.getElementById('compose'));
  } else {
    mount(document.querySelector('main') || document.body);
  }
})();
