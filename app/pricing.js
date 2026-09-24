// Pricing calculator. Every number comes from docs/financial_model.py, nothing is invented.
//   $0.10 per certification, $0.01 per notarization, whoever pays and however.
//   A lawyer certifies every document made with AI (about 100 a month), with about five
//   notarizations behind each: $0.15 a document, about $15 a lawyer a month. A Team or Enterprise
//   seat is that usage at list: $15 for 100 certifications and 500 notarizations, pooled across the
//   firm, usage beyond the pool at list. Enterprise has a 50-seat minimum.
//   USDM is debited as it happens; Stripe (USD) is metered and invoiced at month end.
(function (root) {
  'use strict';
  root.Bailee = root.Bailee || {};
  const { mount, $, esc, money, row, wireCopy } = root.Bailee.ui;

  const PLAN = {
    cert: 0.10,
    notary: 0.01,
    notariesPerCert: 5,           // timestamps taken while drafting, per certified document
    team: { seat: 15, certs: 100, notaries: 500 },
    enterprise: { seat: 15, certs: 100, notaries: 500, minSeats: 50 },
    infraMonthly: [1500, 4000],   // flat, whatever the customer count
  };

  function computePricing(input) {
    const lawyers = Math.max(1, Math.round(Number(input.lawyers) || 1));
    const perLawyer = Math.max(0, Number(input.docsPerMonth) || 0);   // AI documents a month
    const certs = Math.round(lawyers * perLawyer * 12);
    const notaries = certs * PLAN.notariesPerCert;
    const usage = certs * PLAN.cert + notaries * PLAN.notary;
    const t = PLAN.team, e = PLAN.enterprise;
    // what a seat plan pays beyond its pooled allowance, at list
    const beyond = (p, seats) => Math.max(0, certs - seats * p.certs * 12) * PLAN.cert
      + Math.max(0, notaries - seats * p.notaries * 12) * PLAN.notary;
    const seatPlan = (p, seats) => seats * p.seat * 12 + beyond(p, seats);
    const seats = Math.max(lawyers, e.minSeats);
    const overage = beyond(t, lawyers);
    const tiers = [
      { id: 'payg', label: 'Pay as you go', fits: 'Solo and small firms', annual: usage },
      { id: 'team', label: 'Team', fits: 'Mid-size firms', annual: seatPlan(t, lawyers) },
      { id: 'enterprise', label: 'Enterprise', fits: 'Large firms, ' + e.minSeats + '-seat minimum',
        annual: seatPlan(e, seats) },
    ];
    const suggested = lawyers < e.minSeats ? 'payg' : 'enterprise';
    return { lawyers, perLawyer, certs, notaries, usage, overage, seats, tiers, suggested };
  }

  const cents = (n) => '$' + n.toFixed(2);

  function prRender(el) {
    el.innerHTML = `
      <h2>What a firm pays</h2>
      <p class="lede">Usage for anyone, seats for teams, a contract for the enterprise.</p>
      <div class="panel builder">
        <div class="inline">
          <div class="field"><label>Lawyers in the firm</label>
            <input id="pr-lawyers" type="number" min="1" max="2000" value="30"></div>
          <div class="field"><label>AI documents per lawyer per month</label>
            <input id="pr-certs" type="number" min="0" max="500" value="100"></div>
        </div>
        <div class="inline">
          <div class="field"><input id="pr-lawyers-r" type="range" min="1" max="500" value="30"></div>
          <div class="field"><input id="pr-certs-r" type="range" min="0" max="300" step="5" value="100"></div>
        </div>
      </div>
      <div id="pr-out"></div>`;

    const out = $(el, '#pr-out');
    wireCopy(el);

    function draw() {
      const r = computePricing({ lawyers: $(el, '#pr-lawyers').value, docsPerMonth: $(el, '#pr-certs').value });
      out.innerHTML = `
        <div class="cols3">
          <div class="panel"><div class="bignum">${r.certs.toLocaleString('en-US')}<small>Certifications a year at ${cents(PLAN.cert)}</small></div></div>
          <div class="panel"><div class="bignum">${r.notaries.toLocaleString('en-US')}<small>Notarizations a year at ${cents(PLAN.notary)}</small></div></div>
          <div class="panel"><div class="bignum">${money(r.usage)}<small>Usage at list, per year</small></div></div>
        </div>
        <table>
          <thead><tr><th>Plan</th><th class="num">Per year</th></tr></thead>
          <tbody>
            ${r.tiers.filter((t) => t.id !== 'team').map((t) => `<tr>
              <td>${esc(t.label)}${t.id === r.suggested ? ' <strong>&larr; This Plan</strong>' : ''}
                <br><span class="muted">${esc(t.fits)}</span></td>
              <td class="num">${money(t.annual)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="cols" style="margin-top:16px">
          <div class="panel">
            <h3>Two ways to pay, one price</h3>
            ${row('USDM on Cardano', 'Debited live via blockchain tech')}
            ${row('USD through Stripe', 'Metered monthly billing')}
            ${row('Chain fees', 'Chain fees paid by Bailment')}
          </div>
          <div class="panel">
            <h3>What a seat includes</h3>
            ${row('Team or Enterprise', '$' + PLAN.team.seat + '/lawyer a month, the same at every firm size')}
            ${row('Pooled', 'across the whole firm')}
            ${row('Enterprise adds', PLAN.enterprise.minSeats + '-seat minimum, annual prepay, single sign-on, audit export')}
          </div>
        </div>
        <p class="note">Running Bailment costs about ${money(PLAN.infraMonthly[0])} to ${money(PLAN.infraMonthly[1])}
        a month. That cost stays the same whether we have a few customers or thousands.</p>`;
      wireCopy(out);
    }

    const sync = (a, b) => {
      $(el, a).addEventListener('input', () => { $(el, b).value = $(el, a).value; draw(); });
      $(el, b).addEventListener('input', () => { $(el, a).value = $(el, b).value; draw(); });
    };
    sync('#pr-lawyers', '#pr-lawyers-r');
    sync('#pr-certs', '#pr-certs-r');
    draw();
  }

  mount('pricing', prRender);

  root.Bailee.pricing = { PLAN, computePricing, prRender };
})(typeof globalThis !== 'undefined' ? globalThis : this);
