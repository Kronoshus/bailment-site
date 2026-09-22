// Pricing calculator. Every number comes from the business plan, nothing is invented.
//   certification $25/certified filing (~92%) | attestation $1,400/firm/mo (~95%)
//   shared corpus $600/firm/mo (~86%)         | managed appliance $500/mo amortized (~30%)
//   vendor infrastructure $1,500-$4,000/mo, flat, regardless of customer count.
(function (root) {
  'use strict';
  root.Bailee = root.Bailee || {};
  const { mount, $, esc, money, row, wireCopy } = root.Bailee.ui;

  const PLAN = {
    lines: [
      { id: 'certification', label: 'Certification', unit: 'per certified filing', price: 25, margin: 0.92, perFiling: true },
      { id: 'attestation', label: 'Attestation subscription', unit: 'per firm, monthly', price: 1400, margin: 0.95 },
      { id: 'corpus', label: 'Shared public corpus', unit: 'per firm, monthly', price: 600, margin: 0.86 },
      { id: 'appliance', label: 'Managed appliance', unit: 'hardware, amortized monthly', price: 500, margin: 0.30 },
    ],
    // Vendor cost lines. [low, high] monthly. The embedding job is one-time, amortized over 12 months.
    infra: {
      embeddingOneTime: [2000, 6000],
      storageServing: [1000, 3000],
      incrementalUpdates: [100, 100],
      attestationService: [200, 500],
      chainFees: [0, 0],
    },
  };

  function computePricing(input) {
    const firms = Math.max(1, Number(input.firms) || 1);
    const filings = Math.max(0, Number(input.filings) || 0);

    const lines = PLAN.lines.map((l) => {
      const annual = l.perFiling ? l.price * filings : l.price * 12;
      return { ...l, annual, gross: annual * l.margin };
    });
    const revenuePerFirm = lines.reduce((s, l) => s + l.annual, 0);
    const grossPerFirm = lines.reduce((s, l) => s + l.gross, 0);
    const blendedMargin = revenuePerFirm ? grossPerFirm / revenuePerFirm : 0;

    const i = PLAN.infra;
    const band = (k) => [i[k][0], i[k][1]];
    const amortized = [i.embeddingOneTime[0] / 12, i.embeddingOneTime[1] / 12];
    const corpusMonthly = [
      amortized[0] + i.storageServing[0] + i.incrementalUpdates[0],
      amortized[1] + i.storageServing[1] + i.incrementalUpdates[1],
    ];
    const vendorMonthly = [
      corpusMonthly[0] + i.attestationService[0] + i.chainFees[0],
      corpusMonthly[1] + i.attestationService[1] + i.chainFees[1],
    ];
    const perFirmCorpusCost = [corpusMonthly[0] / firms, corpusMonthly[1] / firms];
    const midCorpusCost = (perFirmCorpusCost[0] + perFirmCorpusCost[1]) / 2;

    return {
      firms, filings, lines, revenuePerFirm, grossPerFirm, blendedMargin,
      arr: revenuePerFirm * firms,
      vendorMonthly, vendorAnnual: [vendorMonthly[0] * 12, vendorMonthly[1] * 12],
      corpusMonthly, perFirmCorpusCost, midCorpusCost,
      corpusInfraMarginAtScale: (600 - midCorpusCost) / 600,
      vendorShareOfRevenue: revenuePerFirm * firms
        ? ((vendorMonthly[0] + vendorMonthly[1]) / 2 * 12) / (revenuePerFirm * firms) : 0,
      band,
    };
  }

  const pct = (x) => (x * 100).toFixed(1) + '%';

  function prRender(el) {
    el.innerHTML = `
      <h2>What it costs, what it earns</h2>
      <p class="lede">Four revenue lines and none of them is access to a client's documents.
      Move the inputs; every rate below is the plan's, not a guess.</p>
      <div class="panel builder">
        <div class="inline">
          <div class="field"><label>Paying firms</label>
            <input id="pr-firms" type="number" min="1" max="5000" value="88"></div>
          <div class="field"><label>Certified filings per firm per year</label>
            <input id="pr-filings" type="number" min="0" max="10000" value="250"></div>
        </div>
        <div class="inline">
          <div class="field"><input id="pr-firms-r" type="range" min="1" max="300" value="88"></div>
          <div class="field"><input id="pr-filings-r" type="range" min="0" max="1000" step="10" value="250"></div>
        </div>
      </div>
      <div id="pr-out"></div>`;

    const out = $(el, '#pr-out');
    wireCopy(el);

    function draw() {
      const r = computePricing({ firms: $(el, '#pr-firms').value, filings: $(el, '#pr-filings').value });
      out.innerHTML = `
        <div class="cols3">
          <div class="panel"><div class="bignum">${money(r.revenuePerFirm)}<small>Revenue per firm per year</small></div></div>
          <div class="panel"><div class="bignum">${pct(r.blendedMargin)}<small>Blended gross margin</small></div></div>
          <div class="panel"><div class="bignum">${money(r.arr)}<small>Run rate at ${r.firms} firm(s)</small></div></div>
        </div>
        <table>
          <thead><tr><th>Revenue line</th><th>Unit</th><th class="num">Price</th>
            <th class="num">Per firm / yr</th><th class="num">Margin</th></tr></thead>
          <tbody>
            ${r.lines.map((l) => `<tr>
              <td>${esc(l.label)}</td><td class="muted">${esc(l.unit)}</td>
              <td class="num">${money(l.price)}</td>
              <td class="num">${money(l.annual)}</td>
              <td class="num">${pct(l.margin)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Total</td><td class="muted">${r.filings} filings / yr</td><td class="num"></td>
            <td class="num">${money(r.revenuePerFirm)}</td><td class="num">${pct(r.blendedMargin)}</td></tr></tfoot>
        </table>

        <div class="cols" style="margin-top:16px">
          <div class="panel">
            <h3>What it costs Bailment to run</h3>
            ${row('Corpus initial embedding', '$2,000\u2013$6,000 one-time \u2192 ' + money(r.corpusMonthly[0] - 1100) + '\u2013' + money(r.corpusMonthly[1] - 3100) + ' /mo')}
            ${row('Corpus vector storage and serving', '$1,000\u2013$3,000 /mo')}
            ${row('Corpus incremental updates', '~$100 /mo')}
            ${row('Attestation: signing, registry, licensing', '$200\u2013$500 /mo')}
            ${row('Chain fees', '$0 \u2014 DUST regenerates from held NIGHT')}
            ${row('Vendor total', '<strong>' + money(r.vendorMonthly[0]) + '\u2013' + money(r.vendorMonthly[1]) + ' /mo</strong>')}
            <p class="note">Flat. It does not move when firm count does, because the corpus is
            built once and served to everyone. At ${r.firms} firms it is
            ${pct(r.vendorShareOfRevenue)} of revenue.</p>
          </div>
          <div class="panel">
            <h3>Corpus cost per firm at this scale</h3>
            <div class="bignum">${money(r.perFirmCorpusCost[1])}<small>per firm per month, worst case</small></div>
            ${row('Best case', money(r.perFirmCorpusCost[0]) + ' / firm / mo')}
            ${row('Midpoint', money(r.midCorpusCost) + ' / firm / mo')}
            ${row('Corpus revenue', '$600 / firm / mo')}
            ${row('Infrastructure-only margin', pct(r.corpusInfraMarginAtScale))}
            <p class="note">The plan books this line at 86%, not the infrastructure-only number:
            the difference is the people who keep the corpus current. Fifty firms building the same
            statutory index fifty times is the waste this line removes.</p>
          </div>
        </div>
        <p class="note">Plan checkpoints, reproduced exactly: 88 firms and 250 filings gives
        <strong>${money(computePricing({ firms: 88, filings: 250 }).revenuePerFirm)}</strong> per firm per year at
        <strong>${pct(computePricing({ firms: 88, filings: 250 }).blendedMargin)}</strong> blended margin
        (the plan says about $36,000 and about 82%), and a corpus cost near
        <strong>${money(computePricing({ firms: 88, filings: 250 }).midCorpusCost)}</strong> per firm per month
        against $600 of corpus revenue (the plan says near $30).</p>`;
      wireCopy(out);
    }

    const sync = (a, b) => {
      $(el, a).addEventListener('input', () => { $(el, b).value = $(el, a).value; draw(); });
      $(el, b).addEventListener('input', () => { $(el, a).value = $(el, b).value; draw(); });
    };
    sync('#pr-firms', '#pr-firms-r');
    sync('#pr-filings', '#pr-filings-r');
    draw();
  }

  mount('pricing', prRender);

  root.Bailee.pricing = { PLAN, computePricing, prRender };
})(typeof globalThis !== 'undefined' ? globalThis : this);
