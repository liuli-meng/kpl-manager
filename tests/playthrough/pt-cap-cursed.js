// Playthrough: 工资帽紧缩 + 无冠魔咒（同浏览器两连开）
// 运行：node tests/playthrough/pt-cap-cursed.js
const { launch, clearAndStart, shot } = require('./pw');

function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

async function main() {
  const { browser, page } = await launch();

  // ================= A) 工资帽紧缩 =================
  console.log('=== A) 工资帽紧缩 ===');
  await clearAndStart(page);
  await page.waitForTimeout(400);

  const a = await page.evaluate(() => {
    pickScenario('cap');
    document.querySelector('#new-team-name').value = '帽紧队';
    createTeam();
    goPage('lineup');
    const ww = weeklyWage(S);
    return {
      scenario: S.scenario,
      teamName: S.teamName,
      wageCap: S.wageCap,
      fund: S.fund,
      weeklyWage: ww,
      overCap: ww > S.wageCap,
      overBy: Math.max(0, ww - S.wageCap),
      playerCount: S.players.length,
      seedPower: S.seedPower,
      players: S.players.map(p => ({
        name: p.name,
        pos: p.pos,
        wage: p.wage,
        ovr: overall(p),
        morale: p.morale,
        attrs: { lane: p.attrs.lane, farm: p.attrs.farm, team: p.attrs.team, mind: p.attrs.mind },
      })),
      headerWageText: (document.querySelector('#header') || {}).innerText || '',
      lineupWageText: (document.querySelector('#page-lineup') || {}).innerText || '',
      eventLog: (S.eventLog || []).slice(0, 10).map(e => e.txt || String(e)),
    };
  });

  console.log('[A] scenario=%s team=%s wageCap=%s fund=%s weeklyWage=%s overCap=%s seedPower=%s',
    a.scenario, a.teamName, a.wageCap, a.fund, a.weeklyWage, a.overCap, a.seedPower);
  console.log('[A] players:', JSON.stringify(a.players));
  console.log('[A] eventLog:', JSON.stringify(a.eventLog, null, 2));

  await page.waitForTimeout(500);
  const shotA = await shot(page, 'pt_cap_lineup_wage');

  // Header wage strip is above the fold; also capture a tighter full view
  await page.screenshot({ path: require('path').join('E:\\sex\\gui-test-screenshots', 'pt_cap_header_wage.png'), fullPage: false });

  const aChecks = {
    scenarioCap: a.scenario === 'cap',
    teamName: a.teamName === '帽紧队',
    wageCap90: a.wageCap === 90,
    fundDefault1300: a.fund === 1300,
    roster5: a.playerCount === 5,
    lineupShowsWage: /周薪/.test(a.lineupWageText) && /帽|工资帽|周薪合计/.test(a.lineupWageText),
  };

  // ================= B) 无冠魔咒 =================
  console.log('=== B) 无冠魔咒 ===');
  await clearAndStart(page);
  await page.waitForTimeout(400);

  const b = await page.evaluate(() => {
    // 先开常规档做对照（同一链路 createTeam），再清档开 cursed
    pickScenario('normal');
    document.querySelector('#new-team-name').value = '对照队';
    createTeam();
    const baseline = {
      scenario: S.scenario,
      teamName: S.teamName,
      wageCap: S.wageCap,
      fund: S.fund,
      seedPower: S.seedPower,
      avgOvr: Math.round(S.players.reduce((t, p) => t + overall(p), 0) / S.players.length),
      avgPower: Math.round(S.players.reduce((t, p) => t + playerPower(p), 0) / S.players.length),
      avgMorale: Math.round(S.players.reduce((t, p) => t + p.morale, 0) / S.players.length),
      minMorale: Math.min.apply(null, S.players.map(p => p.morale)),
      avgAttr: Math.round(S.players.reduce((t, p) => t + p.attrs.lane + p.attrs.farm + p.attrs.team + p.attrs.mind, 0) / (S.players.length * 4)),
      players: S.players.map(p => ({
        name: p.name,
        pos: p.pos,
        ovr: overall(p),
        power: playerPower(p),
        morale: p.morale,
        attrs: { lane: p.attrs.lane, farm: p.attrs.farm, team: p.attrs.team, mind: p.attrs.mind },
      })),
    };

    // 真正的 B 档：清掉再开 cursed
    try { localStorage.clear(); } catch (e) {}
    return { baseline };
  });

  // 对照档只是评估用；立刻清存档并 reload，再开 cursed
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const cursed = await page.evaluate(() => {
    pickScenario('cursed');
    document.querySelector('#new-team-name').value = '破咒队';
    createTeam();
    goPage('lineup');
    const ww = weeklyWage(S);
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
      weeklyWage: ww,
      playerCount: S.players.length,
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
        name: p.name,
        pos: p.pos,
        wage: p.wage,
        ovr: overall(p),
        power: playerPower(p),
        morale: p.morale,
        attrs: { lane: p.attrs.lane, farm: p.attrs.farm, team: p.attrs.team, mind: p.attrs.mind },
      })),
      lineupText: (document.querySelector('#page-lineup') || {}).innerText || '',
      eventLog: (S.eventLog || []).slice(0, 10).map(e => e.txt || String(e)),
    };
  });

  const baseline = b.baseline;
  console.log('[B] baseline normal: seedPower=%s avgOvr=%s avgPower=%s avgMorale=%s avgAttr=%s',
    baseline.seedPower, baseline.avgOvr, baseline.avgPower, baseline.avgMorale, baseline.avgAttr);
  console.log('[B] cursed: scenario=%s team=%s seedPower=%s avgOvr=%s avgPower=%s avgMorale=%s allMorale50=%s',
    cursed.scenario, cursed.teamName, cursed.seedPower, cursed.avgOvr, cursed.avgPower, cursed.avgMorale, cursed.allMorale50);
  console.log('[B] cursed players:', JSON.stringify(cursed.players));
  console.log('[B] eventLog:', JSON.stringify(cursed.eventLog, null, 2));

  await page.waitForTimeout(500);
  const shotB = await shot(page, 'pt_cursed_lineup');

  const statsLower = {
    seedPowerLower: cursed.seedPower < baseline.seedPower,
    avgOvrLower: cursed.avgOvr < baseline.avgOvr,
    avgPowerLower: cursed.avgPower < baseline.avgPower,
    avgAttrLower: cursed.avgAttr < baseline.avgAttr,
    avgMoraleLower: cursed.avgMorale < baseline.avgMorale,
  };

  const bChecks = {
    scenarioCursed: cursed.scenario === 'cursed',
    teamName: cursed.teamName === '破咒队',
    allMorale50: cursed.allMorale50 === true,
    attrsFloor: cursed.attrsFloor === true,
    statsLowerSeed: statsLower.seedPowerLower,
    statsLowerOvr: statsLower.avgOvrLower,
    statsLowerPower: statsLower.avgPowerLower,
    roster5: cursed.playerCount === 5,
  };

  // ================= 汇总 =================
  const report = {
    A: {
      checks: aChecks,
      pass: Object.values(aChecks).every(Boolean),
      data: {
        scenario: a.scenario,
        teamName: a.teamName,
        wageCap: a.wageCap,
        fund: a.fund,
        weeklyWage: a.weeklyWage,
        overCap: a.overCap,
        overBy: a.overBy,
        seedPower: a.seedPower,
        players: a.players,
        eventLog: a.eventLog,
        shot: shotA,
      },
    },
    B: {
      checks: bChecks,
      pass: Object.values(bChecks).every(Boolean),
      statsLower,
      data: {
        baseline,
        cursed: {
          scenario: cursed.scenario,
          teamName: cursed.teamName,
          wageCap: cursed.wageCap,
          fund: cursed.fund,
          seedPower: cursed.seedPower,
          avgOvr: cursed.avgOvr,
          avgPower: cursed.avgPower,
          avgMorale: cursed.avgMorale,
          allMorale50: cursed.allMorale50,
          attrsFloor: cursed.attrsFloor,
          players: cursed.players,
          eventLog: cursed.eventLog,
          shot: shotB,
        },
      },
    },
  };

  console.log('=== REPORT ===');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();

  const allPass = report.A.pass && report.B.pass;
  console.log(allPass ? 'ALL PASS' : 'SOME CHECKS FAILED');
  if (!allPass) process.exitCode = 1;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
