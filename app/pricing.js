// Pricing calculator. Every number comes from docs/financial_model.py, nothing is invented.
//   $0.10 per certification, $0.01 per notarization, whoever pays and however.
//   Team $40 per lawyer per month, 25 certifications + 400 notarizations included per seat, pooled.
//   Enterprise $30 per seat per month (50-seat minimum) plus usage at list.
//   USDM is debited as it happens; Stripe (USD) is metered and invoiced at month end.
(function (root) {
  'use strict';
  root.Bailee = root.Bailee || {};
  const { mount, $, esc, money, row, wireCopy } = root.Bailee.ui;

  const PLAN = {
    cert: 0.10,
    notary: 0.01,
    notariesPerCert: 10,          // drafting checkpoints per certified document (assumption)
    otherNotariesPerLawyer: 900,  // notarized drafts that never become a certified document
    team: { seat: 40, certs: 25, notaries: 400 },
    enterprise: { seat: 30, minSeats: 50 },
    infraMonthly: [1500, 4000],   // flat, whatever the customer count
  };

  function computePricing(input) {
    const lawyers = Math.max(1, Math.round(Number(input.lawyers) || 1));
    const perLawyer = Math.max(0, Number(input.certsPerLawyer) || 0);
    const certs = lawyers * perLawyer;
    const notaries = certs * PLAN.notariesPerCert + lawyers * PLAN.otherNotariesPerLawyer;
    const usage = certs * PLAN.cert + notaries * PLAN.notary;
    const t = PLAN.team, e = PLAN.enterprise;
    const overage = Math.max(0, certs - lawyers * t.certs * 12) * PLAN.cert
      + Math.max(0, notaries - lawyers * t.notaries * 12) * PLAN.notary;
    const seats = Math.max(lawyers, e.minSeats);
    const tiers = [
      { id: 'payg', label: 'Pay as you go', fits: 'Solo and small firms', annual: usage },
      { id: 'team', label: 'Team', fits: 'Mid-size firms', annual: lawyers * t.seat * 12 + overage },
      { id: 'enterprise', label: 'Enterprise', fits: 'Large firms, ' + e.minSeats + '-seat minimum',
        annual: seats * e.seat * 12 + usage },
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
          <div class="field"><label>Certifications per lawyer per year</label>
            <input id="pr-certs" type="number" min="0" max="2000" value="150"></div>
        </div>
        <div class="inline">
          <div class="field"><input id="pr-lawyers-r" type="range" min="1" max="500" value="30"></div>
          <div class="field"><input id="pr-certs-r" type="range" min="0" max="600" step="10" value="150"></div>
        </div>
      </div>
      <div id="pr-out"></div>`;

    const out = $(el, '#pr-out');
    wireCopy(el);

    function draw() {
      const r = computePricing({ lawyers: $(el, '#pr-lawyers').value, certsPerLawyer: $(el, '#pr-certs').value });
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
            <h3>What Team includes</h3>
            ${row('Per lawyer, per month', PLAN.team.certs + ' certifications, ' + PLAN.team.notaries + ' notarizations')}
            ${row('Pooled', 'across the whole firm')}
            ${row('Beyond that', 'list price, ' + money(r.overage) + ' a year here')}
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
