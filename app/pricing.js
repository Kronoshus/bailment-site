// Pricing calculator. Every number comes from docs/financial_model.py, nothing is invented.
//   $0.10 per certification, $0.01 per notarization, whoever pays and however.
//   A seat is its expected certifications at list: Team $5 per lawyer per month (50 a month,
//   mid-size firm), Enterprise $10 per seat per month (100 a month, large firm, 50-seat minimum).
//   Pooled across the firm, drafting notarizations included, certifications beyond the pool $0.10.
//   USDM is debited as it happens; Stripe (USD) is metered and invoiced at month end.
(function (root) {
  'use strict';
  root.Bailee = root.Bailee || {};
  const { mount, $, esc, money, row, wireCopy } = root.Bailee.ui;

  const PLAN = {
    cert: 0.10,
    notary: 0.01,
    notariesPerCert: 10,          // drafting checkpoints per certified document (assumption)
    otherNotariesPerLawyer: 75,   // a month: notarized drafts that never become a certified document
    team: { seat: 5, certs: 50 },
    enterprise: { seat: 10, certs: 100, minSeats: 50 },
    infraMonthly: [1500, 4000],   // flat, whatever the customer count
  };

  function computePricing(input) {
    const lawyers = Math.max(1, Math.round(Number(input.lawyers) || 1));
    const perLawyer = Math.max(0, Number(input.certsPerMonth) || 0);   // a month
    const certs = Math.round(lawyers * perLawyer * 12);
    const notaries = certs * PLAN.notariesPerCert + lawyers * PLAN.otherNotariesPerLawyer * 12;
    const usage = certs * PLAN.cert + notaries * PLAN.notary;
    const t = PLAN.team, e = PLAN.enterprise;
    // a seat plan pays its seats plus any certifications beyond the pooled allowance
    const seatPlan = (p, seats) => seats * p.seat * 12 + Math.max(0, certs - seats * p.certs * 12) * PLAN.cert;
    const seats = Math.max(lawyers, e.minSeats);
    const overage = Math.max(0, certs - lawyers * t.certs * 12) * PLAN.cert;
    const tiers = [
      { id: 'payg', label: 'Pay as you go', fits: 'Solo and small firms', annual: usage },
      { id: 'team', label: 'Team', fits: 'Mid-size firms', annual: seatPlan(t, lawyers) },
      { id: 'enterprise', label: 'Enterprise', fits: 'Large firms, ' + e.minSeats + '-seat minimum',
        annual: seatPlan(e, seats) },
    ];
    const suggested = lawyers < 10 ? 'payg' : lawyers < 100 ? 'team' : 'enterprise';
    return { lawyers, perLawyer, certs, notaries, usage, overage, seats, tiers, suggested };
  }

  const cents = (n) => '$' + n.toFixed(2);

  function prRender(el) {
    el.innerHTML = `
      <h2>What a firm pays</h2>
      <p class="lede">Usage for anyone, seats for teams, a contract for the enterprise.
      None of it is access to a client's documents.</p>
      <div class="panel builder">
        <div class="inline">
          <div class="field"><label>Lawyers in the firm</label>
            <input id="pr-lawyers" type="number" min="1" max="2000" value="30"></div>
          <div class="field"><label>Certifications per lawyer per month</label>
            <input id="pr-certs" type="number" min="0" max="500" value="50"></div>
        </div>
        <div class="inline">
          <div class="field"><input id="pr-lawyers-r" type="range" min="1" max="500" value="30"></div>
          <div class="field"><input id="pr-certs-r" type="range" min="0" max="200" step="5" value="50"></div>
        </div>
      </div>
      <div id="pr-out"></div>`;

    const out = $(el, '#pr-out');
    wireCopy(el);

    function draw() {
      const r = computePricing({ lawyers: $(el, '#pr-lawyers').value, certsPerMonth: $(el, '#pr-certs').value });
      out.innerHTML = `
        <div class="cols3">
          <div class="panel"><div class="bignum">${r.certs.toLocaleString('en-US')}<small>Certifications a year at ${cents(PLAN.cert)}</small></div></div>
          <div class="panel"><div class="bignum">${r.notaries.toLocaleString('en-US')}<small>Notarizations a year at ${cents(PLAN.notary)}</small></div></div>
          <div class="panel"><div class="bignum">${money(r.usage)}<small>Usage at list, per year</small></div></div>
        </div>
        <table>
          <thead><tr><th>Plan</th><th class="num">Per year</th></tr></thead>
          <tbody>
            ${r.tiers.map((t) => `<tr>
              <td>${esc(t.label)}${t.id === r.suggested ? ' <strong>&larr; this firm</strong>' : ''}
                <br><span class="muted">${esc(t.fits)}</span></td>
              <td class="num">${money(t.annual)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="cols" style="margin-top:16px">
          <div class="panel">
            <h3>Two ways to pay, one price</h3>
            ${row('USDM on Cardano', 'debited from a prepaid balance as it happens')}
            ${row('USD through Stripe', 'metered, invoiced at month end')}
            ${row('Chain fees', '$0 to the firm; DUST comes from held NIGHT')}
          </div>
          <div class="panel">
            <h3>What a seat includes</h3>
            ${row('Team, $' + PLAN.team.seat + ' a lawyer a month', PLAN.team.certs + ' certifications')}
            ${row('Enterprise, $' + PLAN.enterprise.seat + ' a seat a month', PLAN.enterprise.certs + ' certifications')}
            ${row('Notarizations while drafting', 'included, pooled across the firm')}
            ${row('Beyond the pool', '$0.10 a certification, ' + money(r.overage) + ' a year on Team here')}
          </div>
        </div>
        <p class="note">Bailment's running cost is ${money(PLAN.infraMonthly[0])}&ndash;${money(PLAN.infraMonthly[1])}
        a month whatever the customer count. The model behind these numbers is docs/financial_model.py.</p>`;
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
