// all-together.html: the four widgets, unchanged, opened one after another. Each widget
// announces the step it finished (Bailee.ui.emit); this page only listens and moves on.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var UI = window.Bailee.ui;
  var part = function (n) { return document.getElementById('part-' + n); };
  var state = { commitment: '', digest: '', url: '', docs: [] };

  function say(n, text) { part(n).querySelector('.together-status').textContent = text; }
  function open(n) {
    var body = part(n).querySelector('.together-body');
    if (!body || !body.hidden) return false;
    body.hidden = false;
    return true;
  }
  function put(scope, sel, value) {
    var box = scope.querySelector(sel);
    if (box && value) box.value = value;
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

  function goCertify() {
    document.getElementById('part-1-fold').open = false;   // part 1 closes; the list stays
    say(1, 'Done. Your notarized documents are listed here.');
    say(2, 'Paste the hash into Document digest, check the citations, then press Issue & sign certificate.');
    open(2);
    var box = digestBox();
    if (!box) return;
    box.value = state.digest;
    box.classList.add('together-glow');
    part(2).scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { box.focus(); box.select(); }, 400);
  }

  // The pop-up: built here, not in the page, so it is one element reused for every document.
  var pop = document.createElement('dialog');
  pop.className = 'wp-dialog together-pop';
  pop.setAttribute('aria-labelledby', 'together-pop-title');
  document.body.appendChild(pop);
  UI.wireCopy(pop);
  pop.addEventListener('cancel', function () { setTimeout(goCertify, 0); });   // Escape
  function congratulate(doc) {
    pop.innerHTML = '<h2 id="together-pop-title">Congrats, you have created a timestamp for the document!</h2>'
      + '<p>Next step is to certify. You now have a SHA-256 hash for <strong>' + UI.esc(doc.name)
      + '</strong>. Paste it into Step 1, <em>Document digest</em>.</p>'
      + '<p><code class="mono together-hash">' + UI.esc(doc.digest) + '</code></p>'
      + '<div class="actions">'
      + '<button type="button" class="btn btn-ghost" data-copy="' + UI.esc(doc.digest) + '">Copy the hash</button>'
      + '<button type="button" class="btn btn-primary" value="go">Go to Certify</button></div>';
    pop.querySelector('[value="go"]').addEventListener('click', function () { pop.close(); goCertify(); });
    if (pop.showModal) pop.showModal(); else goCertify();
  }

  // Part 1 -> 2: any notarization, or any "Certify this ..." button in the thread.
  function toCertify(e) {
    var d = e.detail || {};
    if (!d.digest) return;
    state.digest = d.digest;
    if (d.commitment) state.commitment = d.commitment;
    var doc = remember(d);
    if (doc) congratulate(doc); else goCertify();   // an already-listed hash skips the pop-up
  }
  document.addEventListener('bailee:notarized', toCertify);
  document.addEventListener('bailee:certify', toCertify);

  // Part 2 -> 3: the certificate is signed. Your record goes into the next batch.
  document.addEventListener('bailee:certified', function (e) {
    state.url = (e.detail || {}).url || '';
    var proto = document.getElementById('widget-protocol');
    proto.dataset.seed = state.commitment || state.digest;
    say(2, 'Certified and signed.');
    say(3, 'Press Build the period root to batch your record and publish one root.');
    if (open(3)) {
      var out = proto.querySelector('#pk-out');
      if (out) out.innerHTML = '';   // the demo batch from page load is not yours
    }
    part(3).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Part 3 -> 4: a root with your record in it was published.
  document.addEventListener('bailee:published', function (e) {
    if (part(3).querySelector('.together-body').hidden || !(e.detail || {}).seeded) return;
    say(3, 'Published. Your record is communication #1, and the chain holds only the root.');
    var v = document.getElementById('widget-verifier');
    put(v, '#ct-payload', state.url);
    put(v, '#ct-mydigest', state.digest);
    say(4, 'Check it the way a court would: press Verify.');
    open(4);
    part(4).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
