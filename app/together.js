// all-together.html: the four widgets, unchanged, opened one after another. Each widget
// announces the step it finished (Bailee.ui.emit); this page only listens and moves on.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var part = function (n) { return document.getElementById('part-' + n); };
  var state = { commitment: '', digest: '', url: '' };

  function say(n, text) { part(n).querySelector('.together-status').textContent = text; }
  function open(n) {
    var body = part(n).querySelector('.together-body');
    if (!body.hidden) return false;
    body.hidden = false;
    part(n).scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  function put(scope, sel, value) {
    var box = scope.querySelector(sel);
    if (box && value) box.value = value;
  }

  // Part 1 -> 2: Notarize Chat, or any "Certify this ..." button in the thread.
  function toCertify(e) {
    var d = e.detail || {};
    if (!d.digest) return;
    state.digest = d.digest;
    if (d.commitment) state.commitment = d.commitment;
    put(part(2), '#ct-digest', d.digest);
    say(1, 'Congrats! You now have a SHA-256 hash, and you can certify your document.');
    say(2, 'Check the citations, then press Issue & sign certificate.');
    open(2);
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
  });
})();
