# Phase 4: Core/Engine/UI Architecture Refactoring

**Status**: Ready to Start  
**Estimated Duration**: 16 weeks (Weeks 1-16)  
**Goal**: Clean separation of concerns with TypeScript migration

---

## 📋 Current State Analysis

```
Current structure:
├── src/js/
│   ├── data.js       (Contains both constants AND state logic)
│   ├── state.js      (Mixed: defaults + migrations + helpers)
│   ├── ui.js         (Large monolithic file ~106KB)
│   ├── main.js       (Application entry + SFX/BGM)
│   └── ... (20+ more files, many mixed responsibilities)
```

**Pain Points:**
1. Large monolithic files (ui.js > 100KB)
2. Mixed responsibilities in single files
3. No clear boundaries between layers
4. Hard to understand module dependencies
5. Testing coverage gaps in some areas

---

## 🎯 Target Architecture

```
src/
├── core/              # Pure data & state (NO DOM operations)
│   ├── constants.js   # KPL.CARD, SPONSORS, PLAYER_POOL...
│   ├── state.js       # DEFAULT_STATE, SAVE_DEFAULTS, migrateSave()
│   ├── players.js     # genPlayer(), playerPower() (pure functions)
│   └── data.js        # Era data, team templates (read-only)
│
├── engine/            # Game logic (NO DOM, pure functions preferred)
│   ├── match.js       # Match simulation, win rate calculation
│   ├── transfer.js    # Transfer market, AI pricing logic
│   ├── draft.js       # Draft lottery, bidding algorithms
│   ├── cups.js        # Cup bracket management
│   ├── season.js      # Season progression, daily结算
│   ├── rules.js       # League rules enforcement
│   └── index.js       # Centralized hook system for plugins
│
├── ui/                # Rendering only (calls engine for logic)
│   ├── render-club.js      # Club page rendering
│   ├── render-league.js    # League table rendering
│   ├── render-market.js    # Transfer market rendering
│   ├── render-lineup.js    # Lineup page rendering
│   ├── render-train.js     # Training page rendering
│   ├── render-match.js     # Pre-match UI
│   ├── render-cups.js      # Cup tournament UI
│   ├── header.js           # Header component
│   ├── modal.js            # Modal dialog system
│   ├── nav.js              # Navigation system
│   └── components/
│       ├── charts.js       # Chart rendering utilities
│       └── tables.js       # Table rendering utilities
│
└── app/               # Application orchestration
    ├── main.js         # Entry point, event binding
    ├── router.js       # Page routing logic
    ├── persistence.js  # Save/load management
    └── plugin-system.js # Plugin integration
```

---

## 🔍 Migration Strategy

### **Phase A: Foundation (Weeks 1-2)**

1. **Extract Constants**
   ```javascript
   // Move to: src/core/constants.js
   
   // From data.js and elsewhere:
   const KPL = { CARD_BO: 5, ROULETTE_ROUNDS: 6 };
   const SPONSORS = [ /* ... */ ];
   const PLAYER_POOL = [ /* ... */ ];
   ```

2. **Create Layer Boundaries**
   ```javascript
   // src/core/index.js
   export { KPL, SPONSORS, PLAYER_POOL } from './constants';
   
   // src/engine/index.js
   export { playMatch, calculateWinRate } from './match';
   export { buildTransferMarket, buyPlayer } from './transfer';
   
   // src/ui/index.js
   export { renderClub, renderLeague } from './render-club.js';
   ```

3. **Add Dependencies Documentation**
   ```markdown
   # Dependencies
   ├── core          : Zero dependencies (pure data)
   ├── engine        : depends on core
   ├── ui            : depends on engine + core
   └── app           : depends on everything
   ```

### **Phase B: Pure Function Extraction (Weeks 3-4)**

Identify and extract pure functions from mixed files:

**Examples to extract:**
- `playerPower(player)` → `core/players.js`
- `teamPower(S)` → `engine/team.ts`
- `calculateWinRate(a, b)` → `engine/match.ts`
- `fmt(number)` → `core/utils.js`

**Verification:**
- All extracted functions must have 100% test coverage
- No hidden dependencies on window/S/global state
- Pure input/output relationship

### **Phase C: UI Layer Splitting (Weeks 5-8)**

Break down large UI files into component modules:

**Priority targets:**
1. `ui.js` → split into 10+ component files
2. Each component manages ONE page
3. Shared utilities in `components/`

**Example split:**
```javascript
// Before (ui.js):
function renderClub() { /* 500 lines of club page code */ }
function renderLeague() { /* 400 lines of league page code */ }

// After:
// ui/render-club.js
export function renderClub() { /* 200 lines */ }

// ui/render-league.js
export function renderLeague() { /* 150 lines */ }

// ui/components/buttons.js
export function createPrimaryButton(text) { /* shared utility */ }
```

### **Phase D: TypeScript Integration (Weeks 9-12)**

Gradual TypeScript migration:

**Strategy:**
1. Keep .js files, use JSDoc type hints
2. Add `.ts` files alongside existing ones
3. Use TypeScript compiler for type checking only
4. Full ES compilation via `tsc --noEmit`
5. Final migration after all refactoring complete

**Type definitions example:**
```typescript
/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {Array<number>} base [ovr, fp, tp, atk]
 */

/**
 * @param {Player} p
 * @returns {number}
 */
export function playerPower(p: Player): number {
  return Math.round((p.base[0] + p.base[1] + p.base[2] + p.base[3]) / 4);
}
```

### **Phase E: Build Toolchain (Weeks 13-16)**

Set up proper build pipeline:

**Tools to integrate:**
1. Vite for faster builds (optional)
2. ESLint with new strict rules
3. Type checking with TypeScript
4. Bundle size monitoring
5. Automated documentation generation

**Build script:**
```bash
npm run build:tsc  # Type check
npm run build:vite # Bundling (optional)
npm run build:final # Assemble single game.html
```

---

## 📊 Success Criteria

**Technical Metrics:**
- ✅ Module boundaries clear (zero circular dependencies)
- ✅ Unit test coverage ≥80% for new modules
- ✅ Build time <30s for full build
- ✅ Bundle size increase <5%

**Developer Experience:**
- ✅ Clear module import paths
- ✅ IntelliSense works in VS Code
- ✅ IDE navigation jumps instantly between files
- ✅ New developers can find code within 2 minutes

**Quality Indicators:**
- ✅ All 61 tests passing (maintained throughout)
- ✅ Performance unchanged or improved
- ✅ No breaking changes in public API
- ✅ Backward compatible with existing plugins

---

## 🚨 Risk Management

**Risks & Mitigations:**

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing plugins | High | Medium | Maintain backward compatibility hooks |
| Test coverage drops | High | Medium | Require 100% coverage for each refactor step |
| Build time increases | Medium | Low | Monitor and optimize bundle |
| Developer confusion | Medium | High | Extensive inline documentation |
| Scope creep | High | High | Strict milestone tracking |

---

## 📝 Next Steps (Immediate)

**This Session (Week 1 Day 1):**
1. ✅ Create Phase 4 planning document (THIS)
2. ⏳ Audit current dependency graph
3. ⏳ Identify first constants to extract
4. ⏳ Create skeleton layer structure

**Preparation Checklist:**
- [ ] Backup current working tree
- [ ] Document all cross-file dependencies
- [ ] Create migration scripts if needed
- [ ] Set up linting rules for new structure
- [ ] Prepare test strategy for layered testing

---

## 🎯 Long-term Vision

**Ultimate Goal:**
A clean, maintainable, extensible codebase where:
- Any developer can understand the structure in <5 minutes
- New features require minimal context switching
- Plugins can safely extend without side effects
- Future version upgrades are painless

**Legacy Benefits:**
- Reduced technical debt accumulation
- Faster feature development cycles
- Safer refactoring capabilities
- Better developer onboarding experience

---

*Document created: Round 15*  
*Last updated: 2026-09-20*  
*Status: Ready for implementation*
