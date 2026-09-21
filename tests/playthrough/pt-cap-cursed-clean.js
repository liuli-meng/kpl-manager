// Retake clean screenshots without tour overlay
const path = require('path');
const { launch, clearAndStart, shot } = require('./pw');

async function dismissTour(page) {
  await page.evaluate(() => {
    try { if (typeof tourSkip === 'function') tourSkip(); } catch (e) {}
    try {
      document.querySelectorAll('#app-modal, #tour-modal').forEach(el => el.classList.remove('on'));
    } catch (e) {}
  });
  await page.waitForTimeout(250);
}

async function main() {
  const { browser, page } = await launch();

  // ===== A) cap =====
  await clearAndStart(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
  const a = await page.evaluate(() => {
    try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    pickScenario('cap');
    document.querySelector('#new-team-name').value = '帽紧队';
    createTeam();
    goPage('lineup');
    return {
      scenario: S.scenario,
      teamName: S.teamName,
      wageCap: S.wageCap,
      fund: S.fund,
      weeklyWage: weeklyWage(S),
      seedPower: S.seedPower,
      players: S.players.map(p => ({
        name: p.name, pos: p.pos, wage: p.wage, ovr: overall(p), morale: p.morale,
        attrs: { lane: p.attrs.lane, farm: p.attrs.farm, team: p.attrs.team, mind: p.attrs.mind },
      })),
      eventLog: (S.eventLog || []).map(e => e.txt || String(e)),
    };
  });
  await page.waitForTimeout(400);
  await dismissTour(page);
  await page.waitForTimeout(300);
  const shotA = await shot(page, 'pt_cap_lineup_wage_clean');
  // Also crop focus: lineup summary already includes 周薪合计
  console.log('[A]', JSON.stringify({
    scenario: a.scenario, team: a.teamName, wageCap: a.wageCap,
    fund: a.fund, weeklyWage: a.weeklyWage, seedPower: a.seedPower,
    scenarioLog: a.eventLog.find(t => t.includes('工资帽紧缩')),
  }));

  // ===== B) cursed =====
  await clearAndStart(page);
  await page.waitForTimeout(400);

  // Baseline normal for comparison
  await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
  const baseline = await page.evaluate(() => {
    try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    pickScenario('normal');
    document.querySelector('#new-team-name').value = '对照队';
    createTeam();
    return {
      seedPower: S.seedPower,
      avgOvr: Math.round(S.players.reduce((t, p) => t + overall(p), 0) / S.players.length),
      avgPower: Math.round(S.players.reduce((t, p) => t + playerPower(p), 0) / S.players.length),
      avgMorale: Math.round(S.players.reduce((t, p) => t + p.morale, 0) / S.players.length),
      avgAttr: Math.round(S.players.reduce((t, p) => t + p.attrs.lane + p.attrs.farm + p.attrs.team + p.attrs.mind, 0) / (S.players.length * 4)),
    };
  });

  // Clear and start cursed for real
  await clearAndStart(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
  const cursed = await page.evaluate(() => {
    try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    pickScenario('cursed');
    document.querySelector('#new-team-name').value = '破咒队';
    createTeam();
    goPage('lineup');
    const morales = S.players.map(p => p.morale);
    const attrs = S.players.reduce((acc, p) => {
      acc.push(p.attrs.lane, p.attrs.farm, p.attrs.team, p.attrs.mind);
      return acc;
    }, []);
    return {
      scenario: S.scenario,
      teamName: S.teamName,
      wageCap: S.wageCap,
      fund: S.fund,
      weeklyWage: weeklyWage(S),
      seedPower: S.seedPower,
      avgOvr: Math.round(S.players.reduce((t, p) => t + overall(p), 0) / S.players.length),
      avgPower: Math.round(S.players.reduce((t, p) => t + playerPower(p), 0) / S.players.length),
      avgMorale: Math.round(morales.reduce((t, x) => t + x, 0) / morales.length),
      minMorale: Math.min.apply(null, morales),
      maxMorale: Math.max.apply(null, morales),
      allMorale50: S.players.every(p => p.morale === 50),
      attrsFloor: S.players.every(p => ['lane', 'farm', 'team', 'mind'].every(k => p.attrs[k] >= 40)),
      avgAttr: Math.round(attrs.reduce((t, x) => t + x, 0) / attrs.length),
      players: S.players.map(p => ({
        name: p.name, pos: p.pos, wage: p.wage, ovr: overall(p),
        power: playerPower(p), morale: p.morale,
        attrs: { lane: p.attrs.lane, farm: p.attrs.farm, team: p.attrs.team, mind: p.attrs.mind },
      })),
      eventLog: (S.eventLog || []).map(e => e.txt || String(e)),
    };
  });
  await page.waitForTimeout(400);
  await dismissTour(page);
  await page.waitForTimeout(300);
  const shotB = await shot(page, 'pt_cursed_lineup_clean');

  const statsLower = {
    seedPowerLower: cursed.seedPower < baseline.seedPower,
    avgOvrLower: cursed.avgOvr < baseline.avgOvr,
    avgPowerLower: cursed.avgPower < baseline.avgPower,
    avgAttrLower: cursed.avgAttr < baseline.avgAttr,
    avgMoraleLower: cursed.avgMorale < baseline.avgMorale,
  };

  console.log('[B] baseline', JSON.stringify(baseline));
  console.log('[B] cursed', JSON.stringify({
    scenario: cursed.scenario, team: cursed.teamName,
    seedPower: cursed.seedPower, avgOvr: cursed.avgOvr, avgPower: cursed.avgPower,
    avgMorale: cursed.avgMorale, allMorale50: cursed.allMorale50,
    attrsFloor: cursed.attrsFloor,
    scenarioLog: cursed.eventLog.find(t => t.includes('无冠魔咒')),
  }));
  console.log('[B] statsLower', JSON.stringify(statsLower));

  // Verdicts
  const aPass = a.scenario === 'cap' && a.teamName === '帽紧队' && a.wageCap === 90 && a.fund === 1300
    && a.players.length === 5 && a.weeklyWage > 90; // expected over-cap on default roster
  const bPass = cursed.scenario === 'cursed' && cursed.teamName === '破咒队'
    && cursed.allMorale50 && cursed.attrsFloor
    && statsLower.seedPowerLower && statsLower.avgOvrLower && statsLower.avgPowerLower;

  const report = {
    A: {
      pass: aPass,
      scenario: a.scenario,
      teamName: a.teamName,
      wageCap: a.wageCap,
      fund: a.fund,
      weeklyWage: a.weeklyWage,
      overCap: a.weeklyWage > a.wageCap,
      overBy: a.weeklyWage - a.wageCap,
      seedPower: a.seedPower,
      players: a.players,
      eventLog: a.eventLog,
      shot: shotA,
    },
    B: {
      pass: bPass,
      baseline,
      scenario: cursed.scenario,
      teamName: cursed.teamName,
      wageCap: cursed.wageCap,
      fund: cursed.fund,
      weeklyWage: cursed.weeklyWage,
      seedPower: cursed.seedPower,
      avgOvr: cursed.avgOvr,
      avgPower: cursed.avgPower,
      avgMorale: cursed.avgMorale,
      allMorale50: cursed.allMorale50,
      attrsFloor: cursed.attrsFloor,
      statsLower,
      players: cursed.players,
      eventLog: cursed.eventLog,
      shot: shotB,
    },
  };

  console.log('=== REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  console.log(aPass && bPass ? 'ALL PASS' : 'FAIL');
  await browser.close();
  if (!(aPass && bPass)) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
