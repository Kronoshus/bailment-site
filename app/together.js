// all-together.html: the four widgets, unchanged, opened one after another. Each widget
// announces the step it finished (Bailee.ui.emit); this page only listens, explains the
// next step in a pop-up, closes the finished part and opens the next one.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var UI = window.Bailee.ui;
  var part = function (n) { return document.getElementById('part-' + n); };
  var fold = function (n) { return document.getElementById('part-' + n + '-fold'); };
  var state = { commitment: '', digest: '', url: '', docs: [], done: false };

  function say(n, text) { part(n).querySelector('.together-status').textContent = text; }
  function openPart(n) {
    var f = fold(n);
    f.hidden = false;
    f.open = true;
    part(n).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closePart(n) { fold(n).open = false; }
  function put(scope, sel, value) {
    var box = scope.querySelector(sel);
    if (box && value) box.value = value;
  }

  // One pop-up, reused for every step. `next` runs on the button or on Escape. The dialog's
  // own `close` event is not used: headless Chromium did not fire it reliably.
  var pop = document.createElement('dialog');
  pop.className = 'wp-dialog together-pop';
  pop.setAttribute('aria-labelledby', 'together-pop-title');
  document.body.appendChild(pop);
  UI.wireCopy(pop);
  var next = null;
  function go() { var f = next; next = null; if (pop.open) pop.close(); if (f) f(); }
  pop.addEventListener('cancel', function (e) { e.preventDefault(); go(); });   // Escape
  function popup(title, bodyHtml, label, then, extraButtons) {
    next = then;
    pop.innerHTML = '<h2 id="together-pop-title">' + UI.esc(title) + '</h2>' + bodyHtml
      + '<div class="actions">' + (extraButtons || '')
      + '<button type="button" class="btn btn-primary" value="go">' + UI.esc(label) + '</button></div>';
    pop.querySelector('[value="go"]').addEventListener('click', go);
    if (pop.showModal) pop.showModal(); else go();
  }

  // Part 1 keeps every notarized document, by name, so the hash is always one click away.
  var list = document.getElementById('together-docs');
  UI.wireCopy(list);
  function remember(d) {
    for (var i = 0; i < state.docs.length; i++) if (state.docs[i].digest === d.digest) return null;
    var doc = { name: (d.title || 'Matter') + ' Doc ' + (state.docs.length + 1), digest: d.digest };
    state.docs.push(doc);
    var li = document.createElement('li');
    li.innerHTML = '<strong>' + UI.esc(doc.name) + '</strong> <code class="mono">' + UI.esc(doc.digest)
      + '</code> <button type="button" class="btn btn-ghost" data-copy="' + UI.esc(doc.digest) + '">Copy</button>';
    list.appendChild(li);
    list.hidden = false;
    return doc;
  }

  // The digest box in part 2 always holds the notarized hash: whatever is pasted or typed
  // over it is put back, so the certificate cannot be signed over the wrong document.
  var digestBox = function () { return part(2).querySelector('#ct-digest'); };
  document.addEventListener('input', function (e) {
    if (e.target === digestBox() && state.digest && e.target.value.trim() !== state.digest) {
      e.target.value = state.digest;
    }
  });

  // ---- Part 1 -> 2: any notarization, or any "Certify this ..." button in the thread.
  function goCertify() {
    closePart(1);
    say(1, 'Done. Your notarized documents are listed here.');
    say(2, 'Paste the hash into Document digest, check the citations, then press Issue & sign certificate.');
    openPart(2);
    var box = digestBox();
    if (!box) return;
    box.value = state.digest;
    box.classList.add('together-glow');
    setTimeout(function () { box.focus(); box.select(); }, 400);
  }
  function toCertify(e) {
    var d = e.detail || {};
    if (!d.digest) return;
    state.digest = d.digest;
    if (d.commitment) state.commitment = d.commitment;
    var doc = remember(d);
    if (!doc) { goCertify(); return; }   // an already-listed hash skips the pop-up
    popup('Congrats, you have created a timestamp for the document!',
      '<p>Next step is to certify. You now have a SHA-256 hash for <strong>' + UI.esc(doc.name)
        + '</strong>. Paste it into Step 1, <em>Document digest</em>.</p>'
        + '<p><code class="mono together-hash">' + UI.esc(doc.digest) + '</code></p>',
      'Go to Certify', goCertify,
      '<button type="button" class="btn btn-ghost" data-copy="' + UI.esc(doc.digest) + '">Copy the hash</button>');
  }
  document.addEventListener('bailee:notarized', toCertify);
  document.addEventListener('bailee:certify', toCertify);

  // ---- Part 2 -> 3: the certificate is signed. Your record goes into the next batch.
  document.addEventListener('bailee:certified', function (e) {
    state.url = (e.detail || {}).url || '';
    var proto = document.getElementById('widget-protocol');
    proto.dataset.seed = state.commitment || state.digest;
    var out = proto.querySelector('#pk-out');
    if (out) out.innerHTML = '';   // the demo batch from page load is not yours
    say(2, 'Certified and signed.');
    popup('Your certificate is signed!',
      '<p>Next is part 3, <strong>Publish</strong>. Your notarized record joins this period’s batch, '
        + 'alongside every other firm’s records. The whole batch folds into one 32-byte root, and only '
        + 'that root goes on the blockchain.</p>'
        + '<p>No names, no documents, no count of how many there were. Press '
        + '<em>Build the period root</em> to publish.</p>',
      'Go to Publish', function () {
        closePart(2);
        say(3, 'Press Build the period root to batch your record and publish one root.');
        openPart(3);
      });
  });

  // ---- Part 3 -> 4: a root with your record in it was published.
  document.addEventListener('bailee:published', function (e) {
    if (fold(3).hidden || !(e.detail || {}).seeded) return;
    say(3, 'Published. Your record is communication #1, and the chain holds only the root.');
    var v = document.getElementById('widget-verifier');
    put(v, '#ct-payload', state.url);
    put(v, '#ct-mydigest', state.digest);
    popup('Published to the chain!',
      '<p>Next is part 4, <strong>Verify</strong>. This is what a court does with your filing. The '
        + 'certificate and your document’s hash are already filled in.</p>'
        + '<p>Press <em>Verify</em>. The court’s own browser checks the signature, the registry and all '
        + 'four claims. Nothing is uploaded.</p>',
      'Go to Verify', function () {
        closePart(3);
        say(4, 'Check it the way a court would: press Verify.');
        openPart(4);
      });
  });

  // ---- Part 4: it verified. Everything closes, and the reader is told what they did.
  document.addEventListener('bailee:verified', function (e) {
    if (fold(4).hidden || state.done || !(e.detail || {}).ok) return;
    state.done = true;
    say(4, 'Verified.');
    popup('Congratulations! You certified your work to the court!',
      '<p>Your work was timestamped, certified, published, and checked the way a court checks it. '
        + 'The certificate proves how the filing was made without revealing what is in it.</p>',
      'Done', function () {
        [1, 2, 3, 4].forEach(closePart);
        var lead = document.querySelector('.hero .lead');
        if (lead) lead.textContent = 'Congratulations! You certified your work to the court.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  });
})();
