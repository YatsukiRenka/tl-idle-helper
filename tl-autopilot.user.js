// ==UserScript==
// @name         TL挂机助手
// @namespace    https://github.com/YatsukiRenka/tl-idle-helper
// @version      1.3.3
// @author       YatsukiRenka（基于 doai 的原作与 JimChan 的衍生版）
// @description  日常、挂机、成长、装备回收、宝石与工艺；串行动作、资源预算、原页面战斗及每日版本检查。
// @match        https://tl.jayczee.top/*
// @match        https://tl2.jayczee.top/*
// @match        https://tl3.jayczee.top/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// @homepageURL  https://github.com/YatsukiRenka/tl-idle-helper
// @downloadURL  https://raw.githubusercontent.com/YatsukiRenka/tl-idle-helper/main/tl-autopilot.user.js
// @updateURL    https://raw.githubusercontent.com/YatsukiRenka/tl-idle-helper/main/tl-autopilot.user.js
// ==/UserScript==
// 基于 doai 的 Greasy Fork 604931「天龙八部挂机版 · 完整托管助手」0.1.5。
// 含 JimChan 的 Greasy Fork 605228「完整托管助手（衍生版）」0.2.0（MIT）的功能：按缺口用药、额度填 0 不限、技能升级受阻原因、装备评分显示。

(() => {
  'use strict';
  const TLPolicy = (() => {
    function conflictNotice(win) {
      if (!win.__TL_AUTOPILOT_INSTALLED__) return '';
      let detected = '可能是原版或衍生版';
      try {
        const version = win.TLAutopilot?.status?.()?.version;
        if (typeof version === 'string') detected = '版本 ' + version;
      } catch (_) {}
      return 'TL挂机助手未启动：页面上已有另一个托管脚本在运行（' + detected +
        '）。两个托管脚本同时运行会重复操作，请在油猴管理器中只保留一个，然后刷新页面。';
    }
    const WEIGHTS = {
      hp: 0.3,
      mp: 0.2,
      extAtk: 4,
      intAtk: 4,
      extDef: 3,
      intDef: 3,
      critRate: 5,
      precision: 5,
      critDef: 3,
      avoidance: 3,
      iceAtk: 2,
      fireAtk: 2,
      poisonAtk: 2,
      holyAtk: 2,
      iceDef: 1.5,
      fireDef: 1.5,
      poisonDef: 1.5,
      holyDef: 1.5,
    };
    const GEM_ATTR = {
      1: 'hp',
      2: 'mp',
      3: 'extAtk',
      4: 'intAtk',
      5: 'extDef',
      6: 'intDef',
      7: 'precision',
      8: 'avoidance',
      9: 'critRate',
      10: 'critDef',
      11: 'iceAtk',
      12: 'fireAtk',
      13: 'poisonAtk',
      14: 'holyAtk',
      15: 'iceDef',
      16: 'fireDef',
      17: 'poisonDef',
      18: 'holyDef',
    };
    const STAT_KEYS = Object.keys(WEIGHTS);
    const ENHANCE = [0, 10, 20, 30, 45, 65, 90, 120, 155, 195],
      ENHANCE_RATE = [0, 100, 90, 90, 80, 65, 50, 35, 25, 15];
    const GEM_TYPES = {
      attack: ['希望宝石', '智慧宝石', '玄微宝石', '幻冥宝石'],
      defense: ['生命宝石', '魅力宝石', '命运宝石', '天机宝石'],
    };
    const ATTACK_SLOTS = [1, 6, 8, 7, 11],
      DEFENSE_SLOTS = [3, 10, 2, 9, 4, 5];
    const NPC = {
      petKeeper: 'npc_pet_keeper',
      arena: 'npc_biwu',
      trial: 'npc_xuefei',
      gem: 'npc_gem_merchant',
      smithy: 'npc_smithy',
      tailor: 'npc_tailor',
      exchange: 'npc_yuci_exchange',
      zl: 'npc_zenlong',
      camp: 'npc_xiaowei',
      wushuang: 'npc_wushuang',
      lottery: 'npc_kuaihuosan',
    };
    // Native TailorShop/YuciExchangeDialog recipes, verified in the post-migration frontend.
    const TAILOR_DEFENSE = [
      10115005, 10210011, 10210012, 10210031, 10210032, 10210051, 10210052, 10211011, 10211012,
      10211031, 10211032, 10211051, 10211052, 10212011, 10212012, 10212031, 10212032, 10212051,
      10212052, 10214011, 10214012, 10221006, 10221016, 10413071,
    ];
    const TAILOR_JEWELRY = [10222006, 10222016, 10223006, 10223016, 10420069];
    const EXCHANGE_SETS = ['御赐精纺套', '御赐熟铜套', '御赐精钢套', '御赐黄金套', '御赐混沌套'];
    const DEFAULTS = {
      version: 2,
      roleConfig: 'shared',
      fill: { enabled: true, refill: true },
      resumeAfterReload: false,
      keepAwake: true,
      disguise: { enabled: false, hotkey: 'Alt+Z', style: 'baidu', mute: true },
      tickMs: 1000,
      requestTimeoutMs: 10000,
      logs: { level: 'all', keepDays: 7, showCount: 100 },
      storage: { indexedDB: true },
      budget: {
        moneyReserve: 10000,
        expReserve: 0,
        moneyPerDay: 100000,
        skillExpPerDay: 1000000,
        smeltExpPerDay: 1000000,
      },
      battle: { enabled: true, mapId: 0, levelOffset: 5, smart: false, smartGoal: 'exp', smartMaps: 4,
        smartMinutes: 10, smartHours: 6, recoverDeath: true, deathDowngrade: true, maxDeathsPerHour: 3 },
      activities: {
        enabled: true,
        zl: true,
        zlRuns: 1,
        camp: true,
        campRuns: 5,
        bear: true,
        bearRuns: 1,
        tianlingClaim: true,
        lotteryDraw: true,
        lotteryBatch: 12,
        tianlingUse: false,
      },
      welfare: { enabled: false, currency: 'GOLD', multiplier: 1, betsPerDraw: 1,
        dailyCost: 1000000, pick: 'random', numbers: '' },
      pets: { enabled: true, summon: true, claim: true, hatch: false, hatchMutant: false,
        breedClaim: true, breed: false, breedMinAverage: 118, breedPublish: true,
        keepMinAverage: 118, feed: false, feedKeepExp: 0, refreshMinutes: 10 },
      arena: { enabled: true, like: true, claim: true, challenge: true, maxPerDay: 10,
        maxPowerRatio: 1.1, refreshMinutes: 30, rushMinutes: 10 },
      rings: { enabled: false, roundsPerDay: 2, maxRetries: 2, claimInbox: true, exchange: 'off', refreshMinutes: 10 },
      invasion: { enabled: false, claim: true, intervalMinutes: 10, waitSeconds: 60, maxRunsPerDay: 0 },
      hidden: { enabled: true, claim: false, claimElement: 'auto', wash: true, washQuality: true, inbox: true, feed: false,
        maxLevel: 100, keepExp: 0, refreshMinutes: 30 },
      potions: {
        enabled: true,
        hpThreshold: 50,
        mpThreshold: 50,
        autoChoose: true,
        autoThreshold: false,
        order: 'fit',
        hpPriority: [],
        mpPriority: [],
      },
      growth: {
        level: true,
        maxLevel: 99,
        skills: true,
        maxSkillLevel: 99,
        skillPriority: [],
        skillBeforeLevel: false,
      },
      gear: {
        profile: 'auto', assault: { enabled: true, autoDefense: true, defenseWeight: 1 },
        scoring: 'combat', targets: 'pool', autoDefense: true, defenseWeight: 0.5, enabled: true,
        minGainPercent: 1, allowBinding: true, fromWarehouse: true, weights: WEIGHTS,
        fieldCheck: true, fieldMinutes: 20, fieldDropPercent: 5,
      },
      market: { sort: 'off', showScore: true, bagScore: true, tipScore: true, tipBound: true,
        bagFilter: true, setTag: true, tipSet: true, scoreType: 'combat', bagScoreType: 'combat' },
      convenience: { sortDeposit: true, ctrlDeposit: true, depositKeys: 'ctrl', sellWarehouse: false, sellKeys: 'alt' },
      sell: {
        enabled: true,
        maxQuality: 1,
        keepSets: true,
        keepFuture: true,
        keepBestBackup: true,
        keepCrafted: true,
        keepAppraised: true,
        batchMin: 5,
        keepTemplateIds: [],
        materialIds: [],
        maxPerDay: 100,
      },
      warehouse: { enabled: false, minQuality: 3, sets: true, perfect: false },
      shop: { enabled: true, minimumStock: 8, targetStock: 30, maxBatch: 20 },
      gems: {
        enabled: true,
        drill: true,
        maxHoles: 1,
        inlay: true,
        synth: true,
        maxLevel: 3,
        minSynthSuccess: 80,
        polish: true,
        replace: false,
        maxPerDay: 20,
      },
      smithy: {
        enabled: true,
        appraisal: true,
        enhance: true,
        targetEnhance: 3,
        minEnhanceSuccess: 90,
        smelt: true,
        allowSmeltEquipped: false,
        investChunk: 5000000,
        repair: true,
        forge: true,
        artifactIds: [],
        maxPerDay: 12,
      },
      craft: {
        enabled: true,
        tailor: true,
        exchange: true,
        targetIds: [],
        minGainPercent: 3,
        maxPerDay: 3,
      },
      reconnect: {
        enabled: true,
        autoReload: false,
        reloadAfterSeconds: 120,
        maxReloadsPerHour: 2,
      },
      updates: { checkDaily: true, remind: true, autoApply: true },
    };
    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };
    const integer = (v, d = 0) => Math.floor(num(v, d));
    const parse = (v, d) => {
      if (v == null || v === '') return d;
      if (typeof v !== 'string') return v;
      try {
        return JSON.parse(v);
      } catch {
        return d;
      }
    };
    const array = (v) => (Array.isArray(v) ? v : []);
    const clone = (v) => JSON.parse(JSON.stringify(v));
    function merge(base, value) {
      const out = clone(base);
      if (!value || typeof value !== 'object') return out;
      for (const k of Object.keys(base)) {
        if (!(k in value)) continue;
        if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
          out[k] = merge(base[k], value[k]);
        else if (Array.isArray(base[k])) out[k] = Array.isArray(value[k]) ? value[k] : out[k];
        else if (typeof base[k] === 'boolean')
          out[k] = typeof value[k] === 'boolean' ? value[k] : out[k];
        else if (typeof base[k] === 'number')
          out[k] = Number.isFinite(Number(value[k])) ? Number(value[k]) : out[k];
        else out[k] = value[k];
      }
      return out;
    }
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
    const punctuation = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
      Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
    function canonicalHotkey(value) {
      if (typeof value !== 'string') return '';
      const parts = value.split('+'), key = parts.pop().toUpperCase();
      if (!parts.every(part => modifiers.includes(part)) || new Set(parts).size !== parts.length) return '';
      if (!/^F(?:[1-9]|1[0-2])$/.test(key) && !(
        parts.some(part => part !== 'Shift') && (/^[A-Z0-9]$/.test(key) || Object.values(punctuation).includes(key))
      )) return '';
      return [...modifiers.filter(part => parts.includes(part)), key].join('+');
    }
    function eventHotkey(event) {
      const key = /^F(?:[1-9]|1[0-2])$/.test(event.key) ? event.key :
        /^(?:Key[A-Z]|Digit[0-9])$/.test(event.code) ? event.code.slice(-1) : punctuation[event.code];
      return canonicalHotkey([...modifiers.filter(mod => event[mod.toLowerCase() + 'Key']), key].join('+'));
    }
    const warehouseKeys = ['ctrl', 'shift', 'alt', 'ctrl+shift', 'ctrl+alt', 'shift+alt', 'ctrl+shift+alt'];
    function keysMatch(event, keys) {
      return warehouseKeys.includes(keys) && ['ctrl', 'shift', 'alt'].every(key =>
        !!event[key + 'Key'] === keys.includes(key));
    }
    function shortcutConflicts({ ctrlDeposit, depositKeys, sellWarehouse, sellKeys }) {
      const same = ctrlDeposit && sellWarehouse && depositKeys === sellKeys;
      const notes = [];
      if (same) notes.push('与“出售快捷键”相同，出售快捷键暂不生效');
      if (ctrlDeposit && depositKeys.includes('shift')) notes.push('游戏自带 Shift + 右键使用 / 穿戴物品，这个组合会改为整组存入');
      return { depositKeys: notes.join('；'), sellKeys: same ? '与“整组存取快捷键”相同，暂不生效，请换一个组合' : '' };
    }
    const transferObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    function transferFile(text) {
      let file;
      try { file = JSON.parse(text); }
      catch (error) { throw new Error('读取配置文件失败：' + error.message, { cause: error }); }
      if (!transferObject(file)) throw new Error('配置文件格式不对');
      if (file.format !== 'tl-autopilot-full') return { kind: 'config', config: file, data: {}, logs: [], meta: {} };
      if (file.formatVersion > 1) throw new Error('不支持的全量配置版本');
      const { config, data = {}, logs = [], script, exportedAt, host, roleId } = file;
      if (!transferObject(config) || !transferObject(data) || !Array.isArray(logs)) throw new Error('配置文件格式不对');
      return { kind: 'full', config, data, logs, meta: { script, exportedAt, host, roleId } };
    }
    function configChanges(before, after) {
      const changes = [];
      function visit(path, a, b) {
        if (path === 'roleConfig' || a === b) return;
        if (transferObject(a) || transferObject(b)) {
          for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})]))
            visit(path ? path + '.' + key : key, a?.[key], b?.[key]);
        } else if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, before: a, after: b });
      }
      visit('', before, after);
      return changes;
    }
    // Storage keys a full export carries (key without the prefix). The settings of every role travel too: `config`
    // (shared settings and the role scope) and `config:<role>`.
    const transferKey = key => !/^(?:(?:running|lastPause|reloads)(?::|$)|lease:|(?:updates|panel|role)$|keep-awake)/.test(key);
    const transferRoleKey = key => /^config:\d+$/.test(key);
    // The settings the current role gets from a file. A full export brings its own role scope; a settings file keeps
    // the scope of this browser.
    function transferSettings(file, role, roleConfig) {
      const global = file.kind === 'full' && transferObject(file.data.config) ? file.data.config : null;
      if (!global) return config({ ...file.config, roleConfig });
      const own = global.roleConfig === 'per-role' && role ? file.data['config:' + role] : null;
      return config(transferObject(own) ? { ...own, roleConfig: 'per-role' } : global);
    }
    function transferRoles(data) {
      const roles = Object.keys(data).filter(transferRoleKey).map(key => key.slice(7));
      const scope = !transferObject(data.config) ? '' : data.config.roleConfig === 'per-role' ? '每个角色各存一份' : '所有角色共用一份';
      return scope || roles.length ? ['角色设置：' + [scope, roles.length ? '角色 ' + roles.join('、') : ''].filter(Boolean).join('，')] : [];
    }
    const TRANSFER_KINDS = [
      [/^stats:/, '统计', '个角色'], [/^mapRates:/, '智能选图测算', '个角色'],
      [/^(?:targets(?:$|:)|alive:|monsters$)/, '评分数据', '项'],
      [/^gear(?:Profile|Rejected|Check):/, '换装方案', '项'], [/^ledger:/, '每日额度记录', '项'],
      [/^towerFloors:/, '爬塔记录', '项'], [/^potions$/, '药品数据', '项'],
    ];
    const transferKind = key => TRANSFER_KINDS.find(([pattern]) => pattern.test(key)) || [null, '其他数据', '项'];
    const settingsKey = key => /^config(?::|$)/.test(key), logCacheKey = key => /^log(?::|$)/.test(key);
    function transferSummary(data, logs) {
      const counts = new Map(), cached = [];
      for (const [key, value] of Object.entries(data)) {
        if (!transferKey(key) || key === 'config' || transferRoleKey(key)) continue;
        if (logCacheKey(key) && Array.isArray(value)) {
          for (const entry of value) if (transferObject(entry)) cached.push(entry);
          continue;
        }
        const [, label, unit] = transferKind(key);
        counts.set(label, [(counts.get(label)?.[0] || 0) + 1, unit]);
      }
      if (logs.length || cached.length || Object.keys(data).some(key => /^log(?:$|:)/.test(key)))
        counts.set('日志', [logs.length + logMissing(cached, logs.filter(transferObject)).length, '条']);
      return [...transferRoles(data), ...Array.from(counts, ([label, [count, unit]]) => label + '：' + count + ' ' + unit)];
    }
    // Role a stored key belongs to, 0 for none: `<name>:<role>[:…]`, except `alive:<map>:<role>`.
    function transferKeyRole(key) {
      const match = /^alive:[^:]+:(\d+)$/.exec(key) || /^(?!alive:)[A-Za-z]+:(\d+)(?::|$)/.exec(key);
      return match ? Number(match[1]) : 0;
    }
    // The settings a role uses in a storage snapshot, or null when the snapshot holds none.
    function storedSettings(data, role) {
      const global = transferObject(data.config) ? data.config : null;
      const own = global?.roleConfig === 'per-role' && role ? data['config:' + role] : null;
      return transferObject(own) ? config({ ...own, roleConfig: 'per-role' }) : global && config(global);
    }
    const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // A full import merges into this browser's storage (`local`, keys without the prefix): nothing local is removed and
    // what only the file holds comes in. Per role on both sides, differing settings and differing records are listed;
    // each replaces the local copy only when chosen. Data of no role that differs stays local.
    function transferMerge(local, file, current) {
      const data = file.data, exporter = num(file.meta?.roleId);
      const rolesOf = (source, extra) => new Set([...Object.keys(source).filter(transferKey).map(transferKeyRole), extra]
        .filter(role => Number.isSafeInteger(role) && role > 0));
      // The current role counts as local once this browser has saved settings.
      const mine = rolesOf(local, transferObject(local.config) ? num(current) : 0), theirs = rolesOf(data, exporter);
      // A file without stored settings still carries the exporting role's.
      const fileSettings = role => storedSettings(data, role) || (role === exporter && transferObject(file.config) ? config(file.config) : null);
      const differs = key => transferKey(key) && !settingsKey(key) && !logCacheKey(key) &&
        local[key] !== undefined && !sameJSON(local[key], data[key]);
      const roles = [...new Set([...mine, ...theirs])].sort((a, b) => a - b).map(role => {
        const before = mine.has(role) ? storedSettings(local, role) : null, after = theirs.has(role) ? fileSettings(role) : null;
        const settings = before && after ? configChanges(before, after) : [];
        const records = Object.keys(data).filter(key => differs(key) && transferKeyRole(key) === role);
        const status = !mine.has(role) ? 'new' : !theirs.has(role) ? 'local' : settings.length || records.length ? 'conflict' : 'same';
        return { role, current: role === num(current), status, before, after, settings, records };
      });
      return { roles, kept: Object.keys(data).filter(key => differs(key) && !transferKeyRole(key)).length };
    }
    // The storage writes of a merge and the resulting role scope. Roles whose settings end up different need one copy
    // each, so a browser with shared settings switches to per-role copies; its shared settings stay the default.
    function transferMergeData(local, file, current, choices = {}) {
      const { roles } = transferMerge(local, file, current);
      const pick = new Set(array(choices.settings).map(Number)), take = new Set(array(choices.records).map(Number));
      const out = Object.create(null);
      for (const [key, value] of Object.entries(file.data)) {
        if (!transferKey(key) || settingsKey(key)) continue;
        const mine = local[key], role = transferKeyRole(key);
        if (logCacheKey(key) && Array.isArray(value) && Array.isArray(mine)) {
          const missing = logMissing(value.filter(transferObject), mine.filter(transferObject));
          if (missing.length) out[key] = [...missing, ...mine].sort((a, b) => num(b?.at) - num(a?.at)).slice(0, 60);
        } else if (mine === undefined || role && take.has(role) && !sameJSON(mine, value)) out[key] = value;
      }
      const finals = new Map();
      for (const { role, status, before, after } of roles) {
        const chosen = status === 'new' || status !== 'local' && pick.has(role) ? after || before : before || after;
        if (chosen) finals.set(role, chosen);
      }
      const localGlobal = transferObject(local.config) ? local.config : null;
      const base = config(localGlobal || (transferObject(file.data.config) ? file.data.config : file.config));
      const list = [...finals.values()];
      const perRole = base.roleConfig === 'per-role' || list.some(prefs => configChanges(list[0], prefs).length);
      if (!perRole) out.config = { ...(list[0] || base), roleConfig: 'shared' };
      else {
        out.config = { ...base, roleConfig: 'per-role' };
        for (const [role, prefs] of finals) {
          const { roleConfig, ...values } = prefs;
          out['config:' + role] = values;
        }
      }
      const scope = { before: localGlobal?.roleConfig === 'per-role' ? 'per-role' : 'shared', after: perRole ? 'per-role' : 'shared' };
      return { data: out, scope };
    }
    function config(value) {
      if (value?.budget && Object.hasOwn(value.budget, 'expPerDay')) {
        const budget = { ...value.budget };
        for (const key of ['skillExpPerDay', 'smeltExpPerDay'])
          if (!Object.hasOwn(budget, key)) budget[key] = budget.expPerDay;
        value = { ...value, budget };
      }
      const p = merge(DEFAULTS, value);
      for (const key of ['depositKeys', 'sellKeys'])
        if (!warehouseKeys.includes(p.convenience[key])) p.convenience[key] = DEFAULTS.convenience[key];
      p.version = 2;
      if (p.battle.smartGoal !== 'gold') p.battle.smartGoal = 'exp';
      p.battle.smartMaps = Math.max(2, Math.min(8, integer(p.battle.smartMaps)));
      p.battle.smartMinutes = Math.max(5, Math.min(60, integer(p.battle.smartMinutes)));
      p.battle.smartHours = Math.max(1, Math.min(48, integer(p.battle.smartHours)));
      if (p.roleConfig !== 'per-role') p.roleConfig = 'shared';
      p.disguise.hotkey = canonicalHotkey(p.disguise.hotkey) || DEFAULTS.disguise.hotkey;
      if (!['baidu', 'google', 'blank'].includes(p.disguise.style)) p.disguise.style = DEFAULTS.disguise.style;
      if (!['all', 'notice', 'warning'].includes(p.logs.level)) p.logs.level = 'all';
      p.logs.keepDays = Math.max(1, Math.min(90, integer(p.logs.keepDays, 7)));
      p.logs.showCount = Math.max(20, Math.min(500, integer(p.logs.showCount, 100)));
      p.sell.batchMin = Math.max(1, Math.min(20, integer(p.sell.batchMin, 5)));
      p.pets.keepMinAverage = Math.max(0, Math.min(200, num(p.pets.keepMinAverage)));
      p.pets.breedMinAverage = Math.max(80, Math.min(120, p.pets.breedMinAverage));
      p.pets.feedKeepExp = Math.max(0, num(p.pets.feedKeepExp));
      p.pets.refreshMinutes = Math.max(2, Math.min(240, num(p.pets.refreshMinutes)));
      if (!['combat', 'linear'].includes(p.gear.scoring)) p.gear.scoring = 'combat';
      p.gear.fieldMinutes = Math.max(10, Math.min(180, integer(p.gear.fieldMinutes, 20)));
      p.gear.fieldDropPercent = Math.max(1, Math.min(50, num(p.gear.fieldDropPercent, 5)));
      if (!['off', 'power', 'combat', 'gain'].includes(p.market.sort)) p.market.sort = 'off';
      for (const key of ['scoreType', 'bagScoreType'])
        if (!['combat', 'power'].includes(p.market[key])) p.market[key] = 'combat';
      const defense = Number(p.gear.defenseWeight);
      if (p.gear.profile !== 'auto' && !PROFILE_IDS.includes(p.gear.profile)) p.gear.profile = 'auto';
      p.gear.assault.defenseWeight = Math.max(0, Math.min(1, p.gear.assault.defenseWeight));
      p.gear.targets = p.gear.targets === 'map' ? 'map' : 'pool';
      p.gear.autoDefense = typeof p.gear.autoDefense === 'boolean' ? p.gear.autoDefense : true;
      p.gear.defenseWeight = Number.isFinite(defense) ? Math.max(0, Math.min(1, defense)) : 0.5;
      for (const section of Object.values(p))
        if (section && typeof section === 'object' && !Array.isArray(section))
          for (const [k, v] of Object.entries(section))
            if (typeof v === 'number') section[k] = Math.max(0, num(v));
      p.activities.lotteryBatch = Math.max(1, Math.min(100, integer(p.activities.lotteryBatch)));
      p.welfare.currency = p.welfare.currency === 'YUANBAO' ? 'YUANBAO' : 'GOLD';
      p.welfare.multiplier = Math.max(1, Math.min(5, integer(p.welfare.multiplier)));
      p.welfare.betsPerDraw = Math.max(1, Math.min(10, integer(p.welfare.betsPerDraw)));
      p.welfare.dailyCost = Math.max(0, integer(p.welfare.dailyCost));
      p.welfare.pick = p.welfare.pick === 'fixed' ? 'fixed' : 'random';
      p.welfare.numbers = welfareNumbers(p.welfare.numbers)?.join(',') || '';
      p.arena.maxPerDay = integer(p.arena.maxPerDay);
      p.rings.roundsPerDay = Math.max(1, Math.min(10, integer(p.rings.roundsPerDay)));
      p.rings.maxRetries = Math.max(0, Math.min(20, integer(p.rings.maxRetries)));
      p.rings.refreshMinutes = Math.max(1, Math.min(120, integer(p.rings.refreshMinutes)));
      p.invasion.intervalMinutes = Math.max(1, Math.min(120, integer(p.invasion.intervalMinutes)));
      p.invasion.waitSeconds = Math.max(0, Math.min(1800, integer(p.invasion.waitSeconds)));
      p.invasion.maxRunsPerDay = Math.max(0, Math.min(200, integer(p.invasion.maxRunsPerDay)));
      if (!['off', 'ring', 'jade', 'ringFirst', 'jadeFirst'].includes(p.rings.exchange)) p.rings.exchange = 'off';
      p.arena.rushMinutes = Math.max(0, Math.min(120, integer(p.arena.rushMinutes)));
      p.arena.maxPowerRatio = Math.max(0.5, Math.min(3, p.arena.maxPowerRatio));
      for (const section of [p.arena, p.hidden])
        section.refreshMinutes = Math.max(5, Math.min(240, section.refreshMinutes));
      p.hidden.maxLevel = Math.max(1, Math.min(100, integer(p.hidden.maxLevel)));
      if (!['auto', 'ice', 'fire', 'poison', 'holy'].includes(p.hidden.claimElement))
        p.hidden.claimElement = 'auto';
      p.tickMs = Math.max(700, integer(p.tickMs, 1000));
      p.requestTimeoutMs = Math.max(6000, integer(p.requestTimeoutMs, 10000));
      p.warehouse.minQuality = Math.min(5, Math.max(1, integer(p.warehouse.minQuality, 3)));
      p.gems.maxHoles = Math.min(3, integer(p.gems.maxHoles, 1));
      p.gems.maxLevel = Math.min(6, Math.max(1, integer(p.gems.maxLevel, 3)));
      p.smithy.investChunk = Math.max(1000000, integer(p.smithy.investChunk));
      p.smithy.targetEnhance = Math.min(9, integer(p.smithy.targetEnhance, 3));
      p.potions.hpThreshold = Math.max(10, Math.min(80, integer(p.potions.hpThreshold, 50)));
      p.potions.mpThreshold = Math.max(10, Math.min(80, integer(p.potions.mpThreshold, 50)));
      if (!['fit', 'weak', 'strong', 'smart'].includes(p.potions.order)) p.potions.order = 'fit';
      return p;
    }
    function logFilter(entries, level) {
      return entries.filter((entry) => level === 'warning' ? entry.level === 'warning'
        : level === 'notice' ? ['success', 'warning'].includes(entry.level) : true);
    }
    function logCutoff(keepDays, now) {
      return now - Math.max(1, Math.min(90, integer(keepDays, 7))) * 86400000;
    }
    function logPrune(entries, keepDays, now = Date.now()) {
      return entries.map((entry) => Number.isFinite(entry.at) ? entry : { ...entry, at: now })
        .filter((entry) => entry.at >= logCutoff(keepDays, now));
    }
    function logSize(entries) {
      let bytes = 0;
      for (const char of JSON.stringify(entries)) {
        const code = char.codePointAt(0);
        bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      }
      return bytes;
    }
    function logSummary(entries) {
      return { count: entries.length, bytes: logSize(entries) };
    }
    function logCombine(...summaries) {
      const count = summaries.reduce((sum, item) => sum + item.count, 0);
      return { count, bytes: count ? 1 + summaries.reduce((sum, item) =>
        sum + (item.count ? item.bytes - 1 : 0), 0) : 2 };
    }
    function logMissing(entries, saved) {
      const key = (entry) => JSON.stringify([entry.role, entry.at, entry.time, entry.level, entry.text]), counts = new Map();
      for (const entry of saved) counts.set(key(entry), (counts.get(key(entry)) || 0) + 1);
      return entries.filter((entry) => {
        const id = key(entry), count = counts.get(id) || 0;
        if (!count) return true;
        counts.set(id, count - 1);
        return false;
      });
    }
    function logTime(at) {
      const date = new Date(at), pad = (value) => String(value).padStart(2, '0');
      return [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':');
    }
    function logText(entries, now = Date.now()) {
      const pad = (value) => String(value).padStart(2, '0');
      return entries.toReversed().map((entry) => Number.isFinite(entry.at) ? entry : { ...entry, at: now })
        .sort((a, b) => a.at - b.at).map((entry) => {
          const date = new Date(entry.at), day = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
          return day + ' ' + logTime(entry.at) + ' [' + ({ info: '信息', success: '成功', warning: '警告' }[entry.level] || '信息') +
            '] ' + String(entry.text).replace(/[\r\n]+/g, ' ');
        }).join('\n');
    }
    const camel = (k) => {
      const s = String(k);
      if (Object.hasOwn(WEIGHTS, s)) return s;
      return (s === s.toUpperCase() ? s.toLowerCase() : s.replace(/([A-Z])/g, '_$1').toLowerCase())
        .replace(/^_/, '')
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    };
    function stats(v) {
      const out = {};
      for (const [k, n] of Object.entries(parse(v, {}) || {}))
        if (Number.isFinite(Number(n))) out[camel(k)] = num(n);
      return out;
    }
    function addStats(target, source, factor = 1) {
      for (const [k, n] of Object.entries(source)) {
        if (k === 'allAtk')
          for (const a of ['iceAtk', 'fireAtk', 'poisonAtk', 'holyAtk'])
            target[a] = (target[a] || 0) + n * factor;
        else if (k === 'allDef')
          for (const a of ['iceDef', 'fireDef', 'poisonDef', 'holyDef'])
            target[a] = (target[a] || 0) + n * factor;
        else target[k] = (target[k] || 0) + n * factor;
      }
    }
    const WAREHOUSE_CAPACITY = 200;
    function equipQuality(e) {
      return num(e?.quality ?? template(e).qualityBase ?? 1, 1);
    }
    function setTemplateIds(s) {
      return new Set(
        array(s.equipSets).flatMap((set) => array(parse(set.equipTmplIds, []))).map(num),
      );
    }
    function doublePerfect(e) {
      const quality = stats(e?.appraisalStats);
      return num(quality.extScore) > 1500 && num(quality.intScore) > 1500;
    }
    // Never offered for smelting: an artifact weapon (listed in the game's artifact skills, or red quality),
    // a set weapon, and a crafted weapon (made by a player, or by the autopilot itself).
    function smeltProtected(e, s, ledger) {
      const id = num(e?.tmplId || template(e).id);
      if (array(s?.artifactSkills).some((a) => num(a.weaponId) === id) || equipQuality(e) >= 5) return '神器';
      if (setTemplateIds(s || {}).has(id)) return '套装武器';
      if (e?.crafterName || num(e?.creatorId) > 0 || array(ledger?.keptEquipIds).includes(num(e?.id))) return '打造武器';
      return '';
    }
    function warehouseEligible(e, p, setIds) {
      return (
        !e.isEquipped && !e.hiddenWeapon && num(e.equipTmpl?.slotType) !== 12 && e.equipTmpl &&
        ((p.warehouse.sets && setIds.has(num(e.tmplId || e.equipTmpl.id))) ||
          equipQuality(e) >= p.warehouse.minQuality ||
          (p.warehouse.perfect && e.isAppraisal && doublePerfect(e)))
      );
    }
    function sellPlan(s, prefs, ledger, now = Date.now()) {
      return withScoringPass(s, () => sellPlanFrom(s, prefs, ledger, now));
    }
    function loadoutProtection(s) {
      const reasons = new Map(), profile = s.gearProfile;
      for (const name of PROFILE_IDS)
        for (const id of array(profile?.loadouts?.[name])) reasons.set(num(id), longLabel(name) + '的装备');
      for (const id of array(profile?.pending)) reasons.set(num(id), longLabel(profile.worn) + '的装备');
      return reasons;
    }
    function sellPlanFrom(s, prefs, ledger, now) {
      const p = config(prefs), sell = [], keep = [],
        scores = new Map(),
        provisional = p.gear.scoring === 'combat' && combatWeights(s, p) === null,
        setIds = setTemplateIds(s), backups = new Set(),
        protectedGear = new Set([...gearRejected(s.gearRejected, now).map((e) => e.id), s.gearCheck?.oldItemId]);
      const protection = loadoutProtection(s), reserve = new Map();
      const available = ASSAULT_IDS.filter((id) => assaultAvailable(s, p, id));
      if (available.length) {
        const owned = [...array(s.equipments), ...array(s.warehouseEquips)];
        for (const name of ['farm', ...available]) {
          const view = profileView(s, p, name), best = new Map();
          withScoringPass(view.state, () => {
            const score = (e) => equipmentScore(e, view.state, view.prefs);
            // Only bag items can be sold, so only they compete for a backup place.
            for (const e of array(s.equipments)) {
              const slot = num(template(e).slotType);
              if (e.isEquipped) continue;
              const value = score(e);
              scores.set(e, Math.max(scores.get(e) ?? -Infinity, value));
              if (slot < 1 || slot > 11) continue;
              if (!best.has(slot) || value > best.get(slot).value) best.set(slot, { e, value });
            }
            for (const [slot, { e, value }] of best) {
              if (p.sell.keepBestBackup && !reserve.has(num(e.id)))
                reserve.set(num(e.id), '该部位' + (name === 'farm' ? '' : profileLabel(name)) + '最佳备用');
              if (name === (s.gearProfile?.worn || 'farm') || reserve.has(num(e.id))) continue;
              const baseline = owned.find((v) => num(template(v).slotType) === slot &&
                array(s.gearProfile?.loadouts?.[name]).includes(num(v.id))) ||
                owned.find((v) => v.isEquipped && num(template(v).slotType) === slot);
              if (value > (baseline ? score(baseline) : 0)) reserve.set(num(e.id), longLabel(name) + '更优');
            }
          });
        }
      } else if (p.sell.keepBestBackup)
        for (let slot = 1; slot <= 11; slot++) {
          const best = array(s.equipments)
            .filter((e) => !e.isEquipped && num(template(e).slotType) === slot)
            .map((e) => { scores.set(e, equipmentScore(e, s, p)); return e; })
            .sort((a, b) => scores.get(b) - scores.get(a))[0];
          if (best) backups.add(num(best.id));
        }
      for (const eq of array(s.equipments)) {
        if (eq.isEquipped) continue;
        const t = eq.equipTmpl, id = num(eq.id), tid = num(eq.tmplId || t?.id);
        // The first matching protection explains why this bag item cannot be sold.
        const reason = protection.get(id) || reserve.get(id) || (provisional ? '实战评分还没有数据，暂不出售'
          : protectedGear.has(id) ? '换装核对中或在换回名单'
          : eq.hiddenWeapon || num(t?.slotType) === 12 ? '暗器'
          : p.warehouse.enabled && warehouseEligible(eq, p, setIds) ? '符合存仓条件'
          : num(eq.quality, 1) > p.sell.maxQuality ? '品质高于上限'
          : num(eq.enhanceLevel) !== 0 ? '已强化'
          : num(eq.starLevel) !== 0 ? '有星级'
          : eq.isAppraisal && p.sell.keepAppraised ? '已鉴定'
          : eq.isAppraisal && doublePerfect(eq) ? '双完美武器'
          : slots(eq).some((id) => id > 0) ? '镶了宝石'
          : !t || num(t.price) <= 0 ? '商店不收'
          : p.sell.keepFuture && num(t.reqLevel) > num(s.role?.level) ? '还没到穿戴等级'
          : p.sell.keepSets && setIds.has(tid) ? '套装'
          : p.sell.keepTemplateIds.map(num).includes(tid) ? '在永不出售名单'
          : backups.has(id) ? '该部位最佳备用'
          : p.sell.keepCrafted && array(ledger?.keptEquipIds).includes(id) ? '托管新打造'
          : '');
        if (reason) keep.push({ eq, reason });
        else sell.push(eq);
      }
      for (const e of sell) if (!scores.has(e)) scores.set(e, equipmentScore(e, s, p));
      sell.sort((a, b) => scores.get(a) - scores.get(b));
      return { sell, keep, provisional };
    }
    function slots(eq) {
      const s = parse(eq?.gemSlots, [-1, -1, -1]);
      return Array.isArray(s) && s.length ? s.map((v) => integer(v, -1)) : [-1, -1, -1];
    }
    function template(eq) {
      return eq?.equipTmpl || eq?.tmpl || eq || {};
    }
    function lookup(collection, id) {
      if (collection instanceof Map) return collection.get(num(id)) || collection.get(id);
      return array(collection).find((v) => num(v.id) === num(id));
    }
    function equipmentStats(eq, gemInfos) {
      const t = template(eq),
        base = stats(t.baseStats),
        out = {};
      addStats(out, base, 1 + (ENHANCE[integer(eq?.enhanceLevel)] || 0) / 100);
      addStats(out, stats(eq?.extraStats || t.extraStats));
      const qual = stats(eq?.appraisalStats);
      if (eq?.isAppraisal && [1, 12].includes(num(t.slotType)) && num(t.reqLevel) >= 50) {
        out.extAtk = (out.extAtk || 0) + ((base.extAtk || 0) * (qual.extScore || 0)) / 10000;
        out.intAtk = (out.intAtk || 0) + ((base.intAtk || 0) * (qual.intScore || 0)) / 10000;
      }
      for (const id of slots(eq)) {
        if (id <= 0) continue;
        const gem = lookup(gemInfos, id),
          attr = GEM_ATTR[num(gem?.subType)];
        if (attr) out[attr] = (out[attr] || 0) + num(gem.value);
      }
      return out;
    }
    function scoreStats(values, weights = WEIGHTS) {
      return Object.entries(values).reduce((sum, [k, n]) => sum + num(n) * num(weights[k]), 0);
    }
    const SCORE_UNIT = 10000;
    let scoringPass = null;
    // These signatures live only for a synchronous, read-only policy call.
    function withScoringPass(state, run) {
      if (scoringPass?.state === state) return run();
      const previous = scoringPass;
      scoringPass = { state, contexts: new Map(), worn: null };
      try { return run(); } finally { scoringPass = previous; }
    }
    // Special numeric values and undefined have distinct keys, including inside stat objects.
    const scoringKey = (value) => JSON.stringify(value, (_, v) =>
      v === undefined ? '\u0000undefined' : typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))
        ? '\u0000number:' + (Object.is(v, -0) ? '-0' : String(v))
        : typeof v === 'string' && v.startsWith('\u0000') ? '\u0000string:' + v : v);
    function copyScoringInput(value) {
      if (Array.isArray(value)) return value.map(copyScoringInput);
      if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyScoringInput(entry)]));
      return value;
    }
    function equipmentInputs(eq, state) {
      const t = template(eq);
      return [eq?.id, eq?.tmplId, t.id, t.slotType, t.reqLevel, t.baseStats, t.extraStats,
        eq?.enhanceLevel, eq?.gemSlots, eq?.isAppraisal, eq?.appraisalStats, eq?.extraStats,
        eq?.quality, t.qualityBase, slots(eq).filter((id) => id > 0).map((id) => {
          const gem = lookup(state.gemInfos, id);
          return [id, gem?.id, gem?.subType, gem?.value];
        })];
    }
    function wornSignature(state) {
      if (scoringPass?.state === state && scoringPass.worn !== null) return scoringPass.worn;
      const items = array(state.equipments).filter((e) => !!e.isEquipped);
      // Set grouping also depends on template slots and the first matching bag-item fallback.
      const key = scoringKey([items.map((e) => equipmentInputs(e, state)), array(state.equipSets).map((set) =>
        [set.equipTmplIds, set.memberGroups, set.bonusTiers, set.effects,
          array(parse(set.equipTmplIds, [])).map((id) => {
            const known = lookup(state.allEquipTemplates, id);
            if (known) return [id, true, known.slotType];
            const item = array(state.equipments).find((e) => num(e.tmplId || template(e).id) === num(id));
            return [id, !!item, template(item).slotType];
          })])]);
      if (scoringPass?.state === state) scoringPass.worn = key;
      return key;
    }
    function scoreMemo(ctx, name, key, calculate) {
      const memo = ctx.memos[name];
      if (memo.has(key)) return memo.get(key);
      const value = calculate();
      if (memo.size >= 2000) memo.clear();
      memo.set(key, value);
      return value;
    }
    function characterScore(stats, state, prefs) {
      return withScoringPass(state, () => characterScoreFrom(stats, state, prefs));
    }
    function characterScoreFrom(stats, state, prefs) {
      if (!array(state?.monsters).length) return null;
      const weights = gearWeights(state, prefs), ctx = combatContext(state, prefs);
      const values = Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, num(stats?.[k])]));
      if (!ctx) return scoreStats(values, weights);
      const key = wornSignature(state) + ':' + scoringKey([values, weights]);
      return scoreMemo(ctx, 'character', key, () => {
        if (!ctx.weights) return scoreStats(values, weights);
        values.weaponId = ctx.me.weaponId;
        const value = combatValue(values, ctx), bare = combatValue(equipmentValues([], state, ctx), ctx);
        return positiveValue(value) && positiveValue(bare) ?
          SCORE_UNIT * Math.log(value / bare) : scoreStats(values, weights) * SCORE_UNIT / ctx.scale;
      });
    }
    function equipmentScore(eq, state, prefs) {
      return withScoringPass(state, () => equipmentScoreFrom(eq, state, prefs));
    }
    function equipmentScoreFrom(eq, state, prefs) {
      const weights = gearWeights(state, prefs), ctx = combatContext(state, prefs);
      const fallback = () => scoreStats(equipmentStats(eq, state?.gemInfos), weights);
      if (!ctx) return fallback();
      const key = wornSignature(state) + ':' + scoringKey([equipmentInputs(eq, state), weights]);
      return scoreMemo(ctx, 'equipment', key, () => {
        if (!ctx.weights) return fallback();
        const worn = wornBaseline(state, ctx), slot = num(template(eq).slotType);
        const rest = worn.items.filter((e) => num(template(e).slotType) !== slot);
        if (!worn.slots.has(slot)) {
          worn.slots.set(slot, { value: combatValue(equipmentValues(rest, state, ctx), ctx) });
        }
        const base = worn.slots.get(slot);
        const after = combatValue(equipmentValues(rest.concat(eq), state, ctx), ctx);
        return positiveValue(base.value) && positiveValue(after) ?
          SCORE_UNIT * Math.log(after / base.value) : fallback() * SCORE_UNIT / ctx.scale;
      });
    }
    const positiveValue = (value) => Number.isFinite(value) && value > 0;
    function gemScoreOrder(state, prefs, tie = () => 0, gems = array(state.bagItems).filter((b) => b.itemTmpl)) {
      const scores = new Map();
      for (const gem of gems)
        scores.set(gem, statScore({
          [GEM_ATTR[gem.itemTmpl.subType]]: num(gem.itemTmpl.value),
        }, state, prefs));
      return (a, b) => scores.get(b) - scores.get(a) || tie(a, b);
    }
    function statScore(values, state, prefs) {
      return withScoringPass(state, () => statScoreFrom(values, state, prefs));
    }
    function statScoreFrom(values, state, prefs) {
      const weights = gearWeights(state, prefs), ctx = combatContext(state, prefs);
      if (!ctx) return scoreStats(values, weights);
      const key = wornSignature(state) + ':' + scoringKey([values, weights]);
      return scoreMemo(ctx, 'stat', key, () => {
        if (!ctx.weights) return scoreStats(values, weights);
        const next = { ...ctx.me };
        for (const k of STAT_KEYS)
          next[k] = Math.max(0, next[k] + num(values[k]) * (ctx.statMult[k] ?? 1));
        const after = combatValue(next, ctx);
        return positiveValue(ctx.value) && positiveValue(after) ?
          SCORE_UNIT * Math.log(after / ctx.value) : scoreStats(values, weights) * SCORE_UNIT / ctx.scale;
      });
    }
    function sumEquipment(items, state) {
      const out = {};
      for (const item of items) addStats(out, equipmentStats(item, state.gemInfos));
      return out;
    }
    function wornBaseline(state, ctx) {
      const key = wornSignature(state), items = array(state.equipments).filter((e) => !!e.isEquipped);
      if (ctx.worn?.key === key) {
        ctx.worn.items = items;
        return ctx.worn;
      }
      ctx.worn = { key, items, stats: sumEquipment(items, state),
        sets: setEffects(items, state), slots: new Map() };
      return ctx.worn;
    }
    function equipmentValues(items, state, ctx) {
      const old = wornBaseline(state, ctx), next = sumEquipment(items, state);
      const sets = setEffects(items, state), values = { ...ctx.me };
      for (const k of Object.keys(WEIGHTS))
        values[k] = Math.max(0, values[k] + (num(next[k]) - num(old.stats[k])) *
          (ctx.statMult[k] ?? 1) + num(sets[k]) - num(old.sets[k]));
      values.weaponId = weaponId(items);
      return values;
    }
    function weaponId(items) {
      const weapon = items.find((e) => num(template(e).slotType) === 1);
      return num(weapon?.tmplId || template(weapon).id);
    }
    // Slot 13 is fashion (时装, client of 2026-11-19); the bag's equipment tab lists unworn fashion too.
    const SLOT_NAMES = ['', '武器', '衣服', '帽子', '护腕', '鞋子', '项链', '戒指', '护符', '腰带', '护肩', '手套', '暗器', '时装'];
    const SLOT_SHORT = ['', ...'武衣帽腕鞋链戒符带肩手暗时'];
    const equipmentTemplateId = eq => num(eq.tmplId || template(eq).id);
    const knownTemplate = (state, id) => state.allEquipTemplates?.get?.(num(id)) || lookup(state.allEquipTemplates, id);
    function setRules(set, state, candidates = []) {
      let groups = array(parse(set.memberGroups, []));
      if (!set.memberGroups) {
        const weapons = [];
        groups = [];
        for (const id of array(parse(set.equipTmplIds, []))) {
          const t = knownTemplate(state, id) || template(array(state.equipments).concat(candidates)
            .find(eq => equipmentTemplateId(eq) === num(id)));
          if (num(t.slotType) === 1) weapons.push(id);
          else groups.push([id]);
        }
        if (weapons.length) groups.push(weapons);
      }
      return { groups, tiers: set.bonusTiers ? array(parse(set.bonusTiers, [])) :
        [{ pieces: groups.length, effects: set.effects }] };
    }
    function setEffects(eqs, state) {
      const out = {}, worn = new Set(eqs.map(equipmentTemplateId));
      for (const set of array(state.equipSets)) {
        const { groups, tiers } = setRules(set, state, eqs);
        const count = groups.filter(g => g.some(id => worn.has(num(id)))).length;
        for (const tier of tiers)
          if (num(tier.pieces) > 0 && count >= num(tier.pieces))
            addStats(out, stats(tier.effects));
      }
      return out;
    }
    const setIndexes = new WeakMap();
    function setIndex(state) {
      let index = setIndexes.get(state);
      if (index && index.source === state.equipSets && index.sets.length === array(state.equipSets).length) return index;
      index = { source: state.equipSets, sets: [], templates: new Map() };
      for (const set of array(state.equipSets)) {
        const rules = setRules(set, state, array(state.warehouseEquips)), info = { id: set.id, name: set.name };
        index.sets.push({ ...info, ...rules });
        for (const group of rules.groups)
          for (const id of group) index.templates.set(num(id), info);
      }
      setIndexes.set(state, index);
      return index;
    }
    function setOfTemplate(state, tmplId) {
      return setIndex(state).templates.get(num(tmplId)) || null;
    }
    function setCollection(state) {
      const inventory = new Map();
      const record = (eq, location) => {
        const id = equipmentTemplateId(eq);
        if (!inventory.has(id)) inventory.set(id, []);
        inventory.get(id).push({ eq, location });
      };
      for (const eq of array(state.equipments)) record(eq, eq.isEquipped ? 'worn' : 'bag');
      for (const eq of array(state.warehouseEquips)) record(eq, 'warehouse');
      const result = [];
      for (const set of setIndex(state).sets) {
        let spare = 0, worn = 0, owned = 0;
        const members = set.groups.map(group => {
          const ids = group.map(num), pieces = ids.flatMap(id => inventory.get(id) || []);
          const first = ['worn', 'bag', 'warehouse'].map(loc => pieces.find(p => p.location === loc)).find(Boolean);
          const id = first ? equipmentTemplateId(first.eq) : ids[0];
          const t = first && template(first.eq), catalog = knownTemplate(state, id);
          if (first) { owned++; spare += pieces.length - 1; }
          if (first?.location === 'worn') worn++;
          return { ids, name: t?.name || catalog?.name || String(id), slot: num(t?.slotType ?? catalog?.slotType), worn: first?.location === 'worn',
            bag: pieces.filter(p => p.location === 'bag').length, warehouse: pieces.filter(p => p.location === 'warehouse').length };
        });
        if (!owned) continue;
        const tiers = set.tiers.filter(t => num(t.pieces) > 0).map(t => ({
          pieces: num(t.pieces), active: worn >= t.pieces, reachable: owned >= t.pieces,
          effects: Object.entries(parse(t.effects, {}) || {}).filter(([, v]) => Number.isFinite(Number(v)))
            .map(([key, v]) => ({ key, name: SET_EFFECT_NAMES.get(camel(key)) || key, value: num(v) })),
        }));
        result.push({ id: set.id, name: set.name, total: members.length, owned, worn, spare, members, tiers });
      }
      return result.sort((a, b) => b.owned / b.total - a.owned / a.total || b.owned - a.owned || a.id - b.id);
    }
    function bagFilterMatch(eq, filter, info) {
      return (!filter.slot || num(template(eq).slotType) === filter.slot) &&
        (!filter.setId || info.setId === filter.setId) && (!filter.upgrade || !!info.upgrade);
    }
    const MAIN_SOFTCAP = 1.15, ELEMENT_RATE = 2.5;
    function hitDamage(a, d, la, ld, mult = EMPTY_MULT, result = {}) {
      let main = 0, elem = 0;
      for (const [attack, defense] of MAIN_STATS) {
        const atk = num(a[attack]), denominator = MAIN_SOFTCAP * atk + num(d[defense]);
        main += denominator ? atk * atk / denominator : 0;
      }
      main *= 1 + 0.005 * (la - ld);
      for (const [element, attack, defense] of ELEMENT_STATS)
        elem += Math.max(0, num(a[attack]) - num(d[defense])) * ELEMENT_RATE * (mult[element] ?? 1);
      result.main = main;
      result.elem = elem;
      return result;
    }
    const combatCache = new WeakMap(), combatContexts = new Map();
    function combatSignature(state, prefs) {
      const gear = scoringKey([prefs.gear.scoring, prefs.gear.autoDefense, prefs.gear.defenseWeight]);
      if (scoringPass?.state === state && scoringPass.contexts.has(gear)) return scoringPass.contexts.get(gear);
      // Filler and artifact records retain metadata as well as the fields used in damage formulas.
      const key = scoringKey([state.scoringProfile, STAT_KEYS.map((k) => num(state.finalAttributes[k])), num(state.role?.level),
        weaponId(array(state.equipments).filter((e) => !!e.isEquipped)),
        array(state.skills).map((s) => [s.currentLevel, s.skillDetail]),
        state.monsters.map((m) => [m.category, m.level, m.base, m.weight]), array(state.artifactSkills),
        state.aoeTargets, state.survival?.weight, prefs.gear.scoring, prefs.gear.autoDefense, prefs.gear.defenseWeight]);
      if (scoringPass?.state === state) scoringPass.contexts.set(gear, key);
      return key;
    }
    const elements = ['ice', 'fire', 'poison', 'holy'];
    const MAIN_STATS = [['extAtk', 'extDef'], ['intAtk', 'intDef']],
      ELEMENT_STATS = elements.map((e) => [e, e + 'Atk', e + 'Def']), EMPTY_MULT = {};
    const calcType = (effect) => String(effect.calc || '').toUpperCase();
    const effectValue = (effect, level) => num(effect.base) + num(effect.grow) * (level - 1);
    function skillTargets(s, state) {
      const rules = parse(s.combatRules, {}) || {};
      return Math.max(1, Math.min(state.aoeTargets ?? 1, rules.maxTargets ?? 6));
    }
    function castMultiplier(s, state) {
      if (!s) return 1;
      const rules = parse(s.combatRules, {}) || {};
      const area = s.effects.some((e) => e.target === 'ALL_ENEMY');
      return Math.max(1, num(s.hitCount)) * (rules.hitDamageRate ?? 1) *
        (area ? 1 + (skillTargets(s, state) - 1) * (rules.secondaryDamageRate ?? 1) : 1);
    }
    function enemyEffects(skills, state) {
      const defenseMult = {};
      let stun = 1;
      for (const s of skills) for (const e of s.effects) {
        if (e.type !== 'DEBUFF' || !['ENEMY', 'ALL_ENEMY'].includes(e.target) || !(num(s.cd) > 0)) continue;
        const uptime = Math.min(1, num(e.duration) / num(s.cd));
        const k = camel(e.attr);
        if (calcType(e) === 'MULTIPLY' && Object.hasOwn(WEIGHTS, k))
          defenseMult[k] = (defenseMult[k] ?? 1) * (1 - (1 - effectValue(e, s.level)) * uptime);
        if (e.attr === 'DIZZY') stun *= 1 - uptime / (e.target === 'ALL_ENEMY' ? 1 : skillTargets(s, state));
      }
      return { defenseMult, stun };
    }
    function combatContext(state, prefs) {
      if (!state || !prefs) return null;
      let cache = combatCache.get(state);
      if (!cache) combatCache.set(state, cache = new WeakMap());
      if (prefs.gear?.scoring !== 'combat' || !state.finalAttributes ||
          num(state.finalAttributes.hp) <= 0 || !array(state.monsters).length) {
        return null;
      }
      const key = combatSignature(state, prefs), prior = cache.get(prefs);
      const shared = prior?.key === key && combatContexts.get(key) === prior.ctx ? prior.ctx : combatContexts.get(key);
      if (shared) {
        combatContexts.delete(key);
        combatContexts.set(key, shared);
        cache.set(prefs, { key, ctx: shared });
        return shared;
      }
      const me = Object.fromEntries(Object.keys(WEIGHTS).map((k) =>
        [k, num(state.finalAttributes[k])]));
      me.level = num(state.role?.level);
      me.weaponId = weaponId(array(state.equipments).filter((e) => !!e.isEquipped));
      const skills = array(state.skills).filter((s) => num(s.currentLevel) > 0 &&
        s.skillDetail && num(s.skillDetail.unlockLevel) <= me.level).map((s) => ({
          ...copyScoringInput(s.skillDetail), level: num(s.currentLevel),
          effects: copyScoringInput(array(parse(s.skillDetail.effectConfig, []))),
        }));
      const attacks = skills.filter((s) => num(s.type) === 1 && num(s.cd) > 0 &&
        !(s.effects.length && s.effects.every((e) => e.target === 'SELF')));
      const tau = attacks.length ? Math.min(...attacks.map((s) => num(s.cd))) : 0;
      const filler = attacks.find((s) => num(s.cd) === tau);
      const casts = [], buffCasts = [], buffs = {}, buffMult = {}, statMult = {};
      const elementMult = Object.fromEntries(elements.map((e) => [e, 1]));
      let used = 0;
      const bonus = (s) => {
        const out = {};
        for (const e of s.effects)
          if (e.type === 'INSTANT' && e.target !== 'SELF' && calcType(e) === 'PLUS')
            addStats(out, { [camel(e.attr)]: effectValue(e, s.level) });
        return out;
      };
      const cast = (s, share) => ({ id: s?.id, name: s?.name, share,
        bonus: s ? bonus(s) : {}, multiplier: castMultiplier(s, state),
        hits: s ? Math.max(1, num(s.hitCount)) *
          (s.effects.some((e) => e.target === 'ALL_ENEMY') ? skillTargets(s, state) : 1) : 1 });
      for (const s of skills) {
        if (num(s.type) === 3) for (const e of s.effects) {
          if (calcType(e) !== 'MULTIPLY') continue;
          const k = camel(e.attr), el = String(e.attr).replace(/_DMG$/, '').toLowerCase();
          if (e.type === 'PASSIVE_DMG' && elements.includes(el)) elementMult[el] += num(e.base);
          if (e.type === 'PASSIVE_STAT') statMult[k] = (statMult[k] ?? 1) * (1 + num(e.base));
        }
        if (num(s.type) === 2 && num(s.cd) > 0) {
          const share = Math.min(1, tau / num(s.cd));
          used += share;
          buffCasts.push({ id: s.id, name: s.name, share, bonus: {}, multiplier: 0, hits: 0 });
          for (const e of s.effects) {
            if (e.type !== 'BUFF' || e.target !== 'SELF') continue;
            const k = camel(e.attr), value = effectValue(e, s.level),
              uptime = Math.min(1, num(e.duration) / num(s.cd));
            if (calcType(e) === 'PLUS') addStats(buffs, { [k]: value * uptime });
            if (calcType(e) === 'MULTIPLY')
              buffMult[k] = (buffMult[k] ?? 1) * (1 + (value - 1) * uptime);
          }
        }
        if (attacks.includes(s) && s !== filler) {
          const share = Math.min(1, tau / num(s.cd));
          used += share;
          casts.push(cast(s, share));
        }
      }
      casts.push(cast(filler, filler ? Math.max(0, 1 - used) : 1));
      const normal = state.scoringProfile ? [] : state.monsters.filter((m) => m.category === 'MONSTER');
      const ctx = { me, ...enemyEffects(skills, state), targets: (normal.length ? normal : state.monsters).map((m) =>
        ({ level: num(m.level), base: copyScoringInput(m.base), weight: m.weight })), casts, buffs, buffMult, elementMult, statMult,
        tau, filler, rotation: casts.concat(buffCasts), artifactSkills: copyScoringInput(array(state.artifactSkills)),
        ...(state.scoringProfile ? { profile: state.scoringProfile } : {}),
        memos: { equipment: new Map(), gain: new Map(), stat: new Map(), character: new Map() },
        defenseWeight: prefs.gear.autoDefense && Number.isFinite(state.survival?.weight)
          ? state.survival.weight : prefs.gear.defenseWeight };
      cache.set(prefs, { key, ctx });
      combatContexts.set(key, ctx);
      if (combatContexts.size > 8) combatContexts.delete(combatContexts.keys().next().value);
      return ctx;
    }
    const CRIT_CHANCE_OFFSET = 10, CRIT_CHANCE_CAP = 0.70, CRIT_MULT_CAP = 2.0;
    const CRIT_BASE = 1.5, CRIT_RATE = 0.005, CRIT_FLOOR = 60;
    const CRIT_DEF_OFFSET = 70, CRIT_DEF_RATE = 7, CRIT_DEF_DIVISOR = 3;
    function critChance(critRate, critDef) {
      if (!Number.isFinite(critRate) || !Number.isFinite(critDef) || critRate < 0 || critDef < 0) return 0;
      const denominator = critRate + critDef + CRIT_CHANCE_OFFSET;
      return denominator > 0 ? Math.min(CRIT_CHANCE_CAP, critRate / denominator) : 0;
    }
    function critMultiplier(critRate, critDef) {
      return Math.min(CRIT_MULT_CAP, CRIT_BASE + CRIT_RATE * Math.max(0, critRate - Math.max(CRIT_FLOOR,
        (CRIT_DEF_OFFSET + CRIT_DEF_RATE * critDef) / CRIT_DEF_DIVISOR)));
    }
    function artifactUptime(triggerChance, ratePerSecond, duration) {
      if (!(ratePerSecond > 0) || !(duration > 0)) return 0;
      return 1 - (1 - Math.max(0, Math.min(1, num(triggerChance)))) ** (ratePerSecond * duration);
    }
    function artifactEffects(me, enemy, ctx, id) {
      const skill = array(ctx.artifactSkills).find((s) => num(s.weaponId) === id);
      if (!skill) return null;
      const hits = ctx.casts.reduce((sum, cast) => sum + cast.share * (cast.hits ?? 1), 0);
      const hitChance = me.precision + num(enemy.avoidance) > 0 ? me.precision / (me.precision + num(enemy.avoidance)) : 0;
      const uptime = artifactUptime(skill.triggerChance, ctx.tau > 0 ? hits * hitChance / ctx.tau : 0, skill.buffDuration);
      const selfMult = {}, targetMult = {};
      for (const [effect, calc, mult, sign] of [[skill.selfBuff, 'PLUS_PERCENT', selfMult, 1],
        [skill.targetDebuff, 'MINUS_PERCENT', targetMult, -1]]) {
        if (effect && calcType(effect) === calc && Object.hasOwn(WEIGHTS, camel(effect.attr)))
          mult[camel(effect.attr)] = 1 + sign * num(effect.value) * uptime;
      }
      return { skillName: skill.skillName, weaponId: id, uptime, selfMult, targetMult,
        damageMult: 1 + num(skill.triggerChance) * num(skill.extraDamagePct) };
    }
    function combatPlus(a, b, out) {
      for (const k of STAT_KEYS) out[k] = Math.max(0, num(a[k]) + num(b[k]));
      return out;
    }
    function combatMultiply(a, factors) {
      for (const k in factors) if (Object.hasOwn(factors, k)) a[k] = num(a[k]) * factors[k];
      return a;
    }
    function combatDamage(a, d, la, ld, mult, parts) {
      const { main, elem } = hitDamage(a, d, la, ld, mult, parts),
        precision = num(a.precision), avoidance = num(d.avoidance),
        ratio = precision + avoidance === 0 ? 0 : precision / (precision + avoidance);
      return ratio * (main * (1 + (critMultiplier(num(a.critRate), num(d.critDef)) - 1) *
        critChance(num(a.critRate), num(d.critDef))) + elem);
    }
    function combatParts(values, ctx) {
      const me = combatPlus(values, ctx.buffs, {}), castValues = {}, enemy = {}, activeMe = {}, parts = {};
      combatMultiply(me, ctx.buffMult);
      let out = 0, taken = 0, hp = 0, weight = 0, artifact = null, uptime = 0;
      for (const target of ctx.targets) {
        for (const k of STAT_KEYS) {
          enemy[k] = Object.hasOwn(target.base || EMPTY_MULT, k) ? target.base[k] : undefined;
          activeMe[k] = me[k];
        }
        combatMultiply(enemy, ctx.defenseMult);
        const effect = artifactEffects(me, enemy, ctx, values.weaponId);
        combatMultiply(activeMe, effect?.selfMult);
        combatMultiply(enemy, effect?.targetMult);
        const w = target.weight ?? 1;
        weight += w;
        hp += w * activeMe.hp;
        if (effect) { artifact = effect; uptime += w * effect.uptime; }
        for (const cast of ctx.casts)
          out += w * cast.share * (cast.multiplier ?? 1) * (effect?.damageMult ?? 1) *
            combatDamage(combatPlus(activeMe, cast.bonus, castValues), enemy, ctx.me.level, target.level, ctx.elementMult, parts);
        taken += w * combatDamage(enemy, activeMe, target.level, ctx.me.level, EMPTY_MULT, parts);
      }
      return { out: out / weight, taken: taken / weight * (ctx.stun ?? 1), hp: hp / weight,
        ...(artifact ? { artifact: { skillName: artifact.skillName, uptime: uptime / weight } } : {}) };
    }
    function combatValue(values, ctx) {
      return combatPartsValue(combatParts(values, ctx), ctx);
    }
    function combatPartsValue(p, ctx) {
      return p.out * (p.taken > 0 && p.hp > 0 ? (p.hp / p.taken) ** ctx.defenseWeight : 1);
    }
    const SCORE_ATTRIBUTES = Object.entries({ hp: '气血', extAtk: '外攻', intAtk: '内攻', extDef: '外防', intDef: '内防', critRate: '会心', critDef: '会防', avoidance: '闪避', precision: '命中', iceAtk: '冰攻', fireAtk: '火攻', poisonAtk: '毒攻', holyAtk: '玄攻', iceDef: '冰抗', fireDef: '火抗', poisonDef: '毒抗', holyDef: '玄抗' });
    const SET_EFFECT_NAMES = new Map([...SCORE_ATTRIBUTES, ['allAtk', '全属性攻击'], ['allDef', '全属性抗性']]);
    function scoringDetail(state, prefs) {
      return withScoringPass(state, () => scoringDetailFrom(state, prefs));
    }
    function scoringDetailFrom(state, prefs) {
      const ctx = combatContext(state, prefs);
      if (!ctx) return null;
      return { value: combatValue(ctx.me, ctx), parts: combatParts(ctx.me, ctx), weight: ctx.defenseWeight,
        buffMult: ctx.buffMult,
        character: characterScore(state.finalAttributes, state, prefs),
        rows: SCORE_ATTRIBUTES.map(([key, name]) => ({ key, name, current: ctx.me[key],
          one: statScore({ [key]: 1 }, state, prefs), hundred: statScore({ [key]: 100 }, state, prefs) })) };
    }
    function combatWeights(state, prefs) {
      const ctx = combatContext(state, prefs);
      if (!ctx) return null;
      if (ctx.weights !== undefined) return ctx.weights;
      const base = combatValue(ctx.me, ctx);
      const delta = (k) => Math.log(combatValue({ ...ctx.me, [k]: ctx.me[k] + 1 }, ctx) / base);
      const ext = delta('extAtk');
      ctx.value = base;
      ctx.scale = 4 / ext;
      ctx.weights = ext > 0 && Number.isFinite(ext) ? Object.fromEntries(
        Object.keys(WEIGHTS).map((k) => [k, k === 'mp' ? 0 : 4 * delta(k) / ext])) : null;
      return ctx.weights;
    }
    function gearWeights(state, prefs) {
      return combatWeights(state, prefs) || prefs?.gear?.weights || WEIGHTS;
    }
    function hiddenClaimElement(state, prefs) {
      const p = config(prefs);
      if (p.hidden.claimElement !== 'auto') return p.hidden.claimElement;
      const attacks = state?.finalAttributes || {}, weights = gearWeights(state, p);
      return elements.toSorted((a, b) =>
        num(attacks[b + 'Atk']) - num(attacks[a + 'Atk']) ||
        num(weights[b + 'Atk']) - num(weights[a + 'Atk']) ||
        elements.indexOf(a) - elements.indexOf(b))[0];
    }
    function setScore(eqs, state, prefs) {
      return eqs.reduce((sum, e) => sum + equipmentScore(e, state, prefs), 0) +
        scoreStats(setEffects(eqs, state), prefs.gear.weights);
    }

    function projectedGain(candidate, state, prefs) {
      return withScoringPass(state, () => projectedGainFrom(candidate, state, prefs));
    }
    function projectedGainFrom(candidate, state, prefs) {
      const equipped = array(state.equipments).filter((e) => !!e.isEquipped),
        slot = num(template(candidate).slotType);
      const next = equipped.filter((e) => num(template(e).slotType) !== slot).concat(candidate);
      if (prefs.gear.scoring === 'combat') {
        const ctx = combatContext(state, prefs);
        if (!ctx) return { current: 0, after: 0, gain: 0, percent: 0, pending: true };
        const key = wornSignature(state) + ':' + scoringKey(equipmentInputs(candidate, state));
        return { ...scoreMemo(ctx, 'gain', key, () => {
          const values = equipmentValues(next, state, ctx);
          if (!ctx.gainBaseline) {
            const parts = combatParts(ctx.me, ctx);
            ctx.gainBaseline = { parts, value: combatPartsValue(parts, ctx) };
          }
          const beforeParts = ctx.gainBaseline.parts, afterParts = combatParts(values, ctx);
          const current = ctx.gainBaseline.value, after = combatPartsValue(afterParts, ctx);
          const percent = (a, b) => a > 0 ? (b - a) / a * 100 : b > 0 ? 100 : 0;
          const survival = (p) => p.taken > 0 ? p.hp / p.taken : 0;
          return { current, after, gain: after - current, percent: percent(current, after),
            outputPercent: percent(beforeParts.out, afterParts.out),
            survivalPercent: percent(survival(beforeParts), survival(afterParts)),
          };
        }) };
      }
      const current = setScore(equipped, state, prefs),
        after = setScore(next, state, prefs);
      return {
        current,
        after,
        gain: after - current,
        percent: current > 0 ? ((after - current) / current) * 100 : after > 0 ? 100 : 0,
      };
    }
    const countItem = (s, id) =>
      array(s.bagItems)
        .filter((i) => num(i.itemId) === num(id))
        .reduce((n, i) => n + Math.max(0, integer(i.count)), 0);
    const bagItem = (s, id) =>
      array(s.bagItems).find((i) => num(i.itemId) === num(id) && num(i.count) > 0);
    const byFunction = (s, type) =>
      array(s.bagItems).find((i) => num(i.itemTmpl?.functionType) === type && num(i.count) > 0);
    function itemRange(item, kind) {
      const text = String(item?.descTpl || '').replace(/<[^>]+>/g, ' ');
      const range = text.match(
        new RegExp(
          '适用(?:于)?\\s*(\\d+)\\s*级?\\s*(?:至|到|[-~～])\\s*(\\d+)\\s*级\\s*(?:的)?' + kind,
        ),
      );
      if (!range) return null;
      const min = num(range[1]),
        max = num(range[2]);
      return min > 0 && max >= min ? { min, max } : null;
    }
    const drillRange = (item) => itemRange(item, '装备');
    const materialId = (bag) => num(bag?.itemId ?? bag?.itemTmpl?.id);
    function bagUsable(s, bag, quantity = 1, checkLevel = true) {
      const t = bag?.itemTmpl,
        id = materialId(bag);
      return (
        !!t &&
        Number.isSafeInteger(num(bag.id)) &&
        num(bag.id) > 0 &&
        id > 0 &&
        Number.isSafeInteger(id) &&
        (!t.id || num(t.id) === id) &&
        Number.isSafeInteger(num(bag.count)) &&
        num(bag.count) >= quantity &&
        (!checkLevel || num(t.reqLevel) <= num(s.role?.level))
      );
    }
    // The game files workshop items under template type 2 (道具: enhancement essence, repair talisman, bear token)
    // or 3 / 4 (材料); every caller also filters by item id or by what the item supports.
    const MATERIAL_TYPES = [2, 3, 4];
    const materialUsable = (s, bag, quantity = 1) =>
      bagUsable(s, bag, quantity) && MATERIAL_TYPES.includes(num(bag.itemTmpl.type, 3));
    const charmUsable = (s, bag) => bagUsable(s, bag) && [2, 3].includes(num(bag.itemTmpl.type, 3));
    const materialBag = (s, id) =>
      array(s.bagItems).find((b) => materialId(b) === num(id) && materialUsable(s, b));
    const materialCount = (s, id) =>
      array(s.bagItems)
        .filter((b) => materialId(b) === num(id) && materialUsable(s, b))
        .reduce((n, b) => n + integer(b.count), 0);
    function gemUsable(s, bag) {
      const t = bag?.itemTmpl;
      return (
        bagUsable(s, bag) &&
        num(t.gemLevel) >= 1 &&
        num(t.gemLevel) <= 6 &&
        Number.isInteger(num(t.gemLevel)) &&
        !!GEM_ATTR[num(t.subType)] &&
        GEM_TYPES.attack.concat(GEM_TYPES.defense).includes(t.gemType)
      );
    }
    const gemTemplate = (s, id) => lookup(s.gemInfos, id) || bagItem(s, id)?.itemTmpl || null;
    function materialSupports(bag, kind, level) {
      const range = itemRange(bag?.itemTmpl, kind);
      if (range) return level >= range.min && level <= range.max;
      // Numeric suitability text that cannot be read reliably is not assumed unrestricted.
      return !new RegExp('适用[^。；;\\n]*\\d+[^。；;\\n]*级[^。；;\\n]*' + kind).test(
        String(bag?.itemTmpl?.descTpl || ''),
      );
    }
    function charmCompatible(s, bag, kind, gem) {
      const embedded =
        kind === 'remove' &&
        gem?.itemTmpl &&
        num(gem.itemTmpl.gemLevel) >= 1 &&
        num(gem.itemTmpl.gemLevel) <= 6 &&
        !!GEM_ATTR[num(gem.itemTmpl.subType)];
      if (
        !charmUsable(s, bag) ||
        !(embedded || gemUsable(s, gem)) ||
        !materialSupports(bag, '宝石', num(gem.itemTmpl.gemLevel))
      )
        return false;
      const id = materialId(bag),
        fn = num(bag.itemTmpl.functionType);
      const nativeKinds = {
        5052: 'inlay',
        5053: 'inlay',
        5058: 'synth',
        5059: 'synth',
        5069: 'remove',
        5060: 'polish',
      };
      if (nativeKinds[id] && nativeKinds[id] !== kind) return false;
      if (kind === 'inlay') return id === 5053 && fn === 1;
      if (kind === 'synth') return id === (num(gem.itemTmpl.gemLevel) <= 4 ? 5058 : 5059);
      const expected = kind === 'remove' ? 4 : kind === 'polish' ? 5 : 0,
        known = kind === 'remove' ? 5069 : 5060;
      return !!expected && (id === known || (fn === expected && !!itemRange(bag.itemTmpl, '宝石')));
    }
    function gemCharm(s, kind, gem) {
      return (
        array(s.bagItems)
          .filter((b) => charmCompatible(s, b, kind, gem))
          .sort(
            (a, b) =>
              (itemRange(a.itemTmpl, '宝石')?.max || 6) -
                (itemRange(b.itemTmpl, '宝石')?.max || 6) ||
              num(a.itemTmpl.price) - num(b.itemTmpl.price) ||
              num(a.id) - num(b.id),
          )[0] || null
      );
    }
    function actionSlots(eq) {
      const raw = parse(eq?.gemSlots, eq?.gemSlots == null || eq.gemSlots === '' ? [] : null);
      if (
        !Array.isArray(raw) ||
        (raw.length && raw.length !== 3) ||
        raw.some(
          (v) =>
            !['number', 'string'].includes(typeof v) ||
            !Number.isSafeInteger(num(v, NaN)) ||
            num(v) < -1,
        )
      )
        return null;
      return raw.length ? raw.map(Number) : [-1, -1, -1];
    }
    function tailorMaterialIds(targetId) {
      const min = TAILOR_DEFENSE.includes(num(targetId))
        ? 5008
        : TAILOR_JEWELRY.includes(num(targetId))
          ? 5017
          : 0;
      return min ? Array.from({ length: 8 }, (_, i) => min + i) : [];
    }
    function drillMaterial(s, eq) {
      const level = num(template(eq).reqLevel);
      return (
        array(s.bagItems)
          .map((b) => ({ bag: b, range: drillRange(b.itemTmpl) }))
          .filter(
            ({ bag, range }) =>
              bagUsable(s, bag) &&
              num(bag.itemTmpl?.functionType) === 2 &&
              MATERIAL_TYPES.includes(num(bag.itemTmpl.type, 3)) &&
              range &&
              level >= range.min &&
              level <= range.max,
          )
          .sort(
            (a, b) =>
              a.range.max - b.range.max ||
              num(a.bag.itemTmpl.price) - num(b.bag.itemTmpl.price) ||
              num(a.bag.id) - num(b.bag.id),
          )[0]?.bag || null
      );
    }
    function materialCheck(a, s, prefs = DEFAULTS) {
      const fail = (reason) => ({ ok: false, reason }),
        ok = { ok: true, reason: '' },
        payload = a.payload || {},
        byId = (id) => array(s.bagItems).find((b) => num(b.id) === num(id));
      const equipment = (id) => array(s.equipments).find((e) => num(e.id) === num(id));
      if (a.type.startsWith('GEM_')) {
        if (a.type === 'GEM_SYNTH') {
          const ids = payload.gemBagItemIds;
          if (!Array.isArray(ids) || ids.length < 2 || ids.length > 5)
            return fail('合成需2至5颗相同宝石');
          const amounts = new Map();
          for (const id of ids) amounts.set(num(id), (amounts.get(num(id)) || 0) + 1);
          const bags = [...amounts].map(([id, count]) => ({ bag: byId(id), count }));
          if (bags.some(({ bag, count }) => !gemUsable(s, bag) || !bagUsable(s, bag, count)))
            return fail('合成宝石不存在、等级不可用或数量不足');
          const first = bags[0].bag,
            t = first.itemTmpl;
          if (
            num(t.gemLevel) >= 6 ||
            bags.some(
              ({ bag }) =>
                materialId(bag) !== materialId(first) ||
                num(bag.itemTmpl.gemLevel) !== num(t.gemLevel) ||
                bag.itemTmpl.gemType !== t.gemType ||
                num(bag.itemTmpl.subType) !== num(t.subType),
            )
          )
            return fail('合成宝石必须同模板、同等级，且未达到6级');
          const family = String(t.name || '')
            .replace(/\(\d+级\)$/, '')
            .trim();
          const targets = s.gemInfos instanceof Map ? [...s.gemInfos.values()] : array(s.gemInfos);
          if (
            !targets
              .concat(
                array(s.bagItems)
                  .map((b) => b.itemTmpl)
                  .filter(Boolean),
              )
              .some(
                (v) =>
                  num(v.gemLevel) === num(t.gemLevel) + 1 &&
                  v.gemType === t.gemType &&
                  num(v.subType) === num(t.subType) &&
                  String(v.name || '')
                    .replace(/\(\d+级\)$/, '')
                    .trim() === family,
              )
          )
            return fail('缺少下一等级宝石的模板数据');
          if (
            payload.charmBagItemId != null &&
            !charmCompatible(s, byId(payload.charmBagItemId), 'synth', first)
          )
            return fail('合成符数量、使用等级或宝石等级不匹配');
          return ok;
        }
        if (a.type === 'GEM_POLISH') {
          const gem = byId(payload.gemBagItemId);
          if (
            !gemUsable(s, gem) ||
            !['智慧宝石', '魅力宝石'].includes(gem.itemTmpl.gemType) ||
            String(gem.itemTmpl.name || '').startsWith('纯净')
          )
            return fail('只能雕琢可用的未纯净智慧或魅力宝石');
          return charmCompatible(s, byId(payload.charmBagItemId), 'polish', gem)
            ? ok
            : fail('雕琢符数量、用途或适用等级不匹配');
        }
        const eq = equipment(payload.roleEquipId),
          holes = actionSlots(eq),
          level = num(template(eq).reqLevel);
        if (
          !eq ||
          !Number.isSafeInteger(num(eq.id)) ||
          !holes ||
          level <= 0 ||
          !Number.isInteger(level)
        )
          return fail('装备或孔位数据无法确认');
        if (a.type === 'GEM_DRILL') {
          const bag = byId(payload.materialBagItemId),
            range = drillRange(bag?.itemTmpl);
          if (!holes.includes(-1)) return fail('装备已经没有可打孔的位置');
          return bagUsable(s, bag) &&
            num(bag.itemTmpl.functionType) === 2 &&
            MATERIAL_TYPES.includes(num(bag.itemTmpl.type, 3)) &&
            range &&
            level >= range.min &&
            level <= range.max
            ? ok
            : fail('打孔材料数量、使用等级或装备适用范围不匹配');
        }
        const types = ATTACK_SLOTS.includes(num(template(eq).slotType))
          ? GEM_TYPES.attack
          : DEFENSE_SLOTS.includes(num(template(eq).slotType))
            ? GEM_TYPES.defense
            : [];
        if (a.type === 'GEM_INLAY') {
          const gem = byId(payload.gemBagItemId);
          if (
            !holes.includes(0) ||
            !gemUsable(s, gem) ||
            !types.includes(gem.itemTmpl.gemType) ||
            !materialSupports(gem, '装备', level)
          )
            return fail('镶嵌需要开放孔位、足够宝石及适用部位/等级');
          const current = holes.filter((id) => id > 0).map((id) => gemTemplate(s, id));
          if (current.some((g) => !g) || current.some((g) => g.gemType === gem.itemTmpl.gemType))
            return fail('已镶宝石数据不完整或与新宝石类型重复');
          const charm = byId(payload.charmBagItemId);
          return charmCompatible(s, charm, 'inlay', gem) && materialSupports(charm, '装备', level)
            ? ok
            : fail('镶嵌符数量、用途或适用等级不匹配');
        }
        if (a.type === 'GEM_REMOVE') {
          const index = num(payload.gemSlotIndex, -1),
            old =
              Number.isInteger(index) && index >= 0 && index < 3
                ? gemTemplate(s, holes[index])
                : null;
          if (!old || holes[index] <= 0) return fail('摘除孔位中没有可确认的宝石');
          const oldBag = { id: 1, itemId: old.id, count: 1, itemTmpl: old },
            remove = byId(payload.charmBagItemId);
          if (
            !charmCompatible(s, remove, 'remove', oldBag) ||
            !materialSupports(remove, '装备', level)
          )
            return fail('摘除符数量、用途或宝石/装备适用等级不匹配');
          if (a.replacement) {
            if (!prefs.gems.inlay) return fail('自动镶嵌已关闭，保留原宝石');
            const gem = byId(a.replacement.bagId),
              inlay = gemCharm(s, 'inlay', gem),
              remaining = holes
                .filter((_, i) => i !== index && holes[i] > 0)
                .map((id) => gemTemplate(s, id));
            if (
              !gemUsable(s, gem) ||
              !types.includes(gem.itemTmpl.gemType) ||
              gem.itemTmpl.gemType !== old.gemType ||
              num(gem.itemTmpl.subType) !== num(old.subType) ||
              num(gem.itemTmpl.value) <= num(old.value) ||
              !inlay ||
              !materialSupports(inlay, '装备', level) ||
              !materialSupports(gem, '装备', level) ||
              remaining.some((g) => !g || g.gemType === gem.itemTmpl.gemType)
            )
              return fail('替换宝石、镶嵌符或后续镶嵌条件不足，保留原宝石');
          }
          return ok;
        }
      }
      if (a.type === 'SMITHY_ENHANCE') {
        const eq = equipment(payload.roleEquipId),
          level = num(template(eq).reqLevel),
          next = num(eq?.enhanceLevel) + 1;
        if (!eq || level <= 0 || !Number.isInteger(next) || next < 1 || next > 9)
          return fail('装备等级或强化目标无效');
        const id = level >= 40 ? 5051 : 5050;
        return array(s.bagItems).some(
          (b) => b.id === payload.materialBagId && materialId(b) === id && materialUsable(s, b) && materialSupports(b, '装备', level),
        )
          ? ok
          : fail('缺少该装备等级所需的可用强化精华');
      }
      if (a.type === 'WAREHOUSE_DEPOSIT' || a.type === 'SMITHY_SMELT_START' || a.type === 'SHOP_SELL_BATCH' ||
          (a.type === 'SHOP_SELL' && payload.bagItemId == null)) {
        const protectedIds = loadoutProtection(s);
        if ([payload.roleEquipId, ...array(payload.roleEquipIds)].some((id) => protectedIds.has(num(id))))
          return fail('方案装备已保留');
      }
      if (a.type === 'SMITHY_SMELT_START') {
        const eq = equipment(payload.roleEquipId);
        return eq &&
          num(template(eq).slotType) === 1 &&
          num(template(eq).reqLevel) >= 50 &&
          eq.isAppraisal &&
          doublePerfect(eq) &&
          !smeltProtected(eq, s) &&
          (!eq.isEquipped || prefs.smithy.allowSmeltEquipped) &&
          !num(s.role.smeltingItemId)
          ? ok
          : fail(eq && smeltProtected(eq, s) ? smeltProtected(eq, s) + '不用于冶炼'
            : '冶炼武器资质、等级、穿戴保护或冶炼状态不符合条件');
      }
      if (a.type === 'SMITHY_SMELT_INVEST' || a.type === 'SMITHY_SMELT_COMPLETE') {
        const remaining = num(s.role.smeltingTargetExp) - num(s.role.smeltingExp),
          amount = num(payload.expAmount);
        if (!num(s.role.smeltingItemId) || num(s.role.smeltingTargetExp) <= 0)
          return fail('当前没有已确认的神器冶炼项目');
        if (a.type === 'SMITHY_SMELT_COMPLETE')
          return remaining <= 0 ? ok : fail('当前冶炼经验尚未完成');
        return Number.isInteger(amount) && amount > 0 && amount <= remaining
          ? ok
          : fail('冶炼经验投入超出当前剩余需求');
      }
      if (a.type === 'SMITHY_REPAIR_ARTIFACT') {
        const section = byId(payload.sectionBagId),
          talisman = byId(payload.talismanBagId),
          id = materialId(section);
        return materialUsable(s, section) &&
          materialUsable(s, talisman) &&
          id >= 5032 &&
          id <= 5037 &&
          materialId(talisman) === id + 6
          ? ok
          : fail('神节与神符数量、使用等级或等级配对不符合条件');
      }
      if (a.type === 'SMITHY_FORGE' || a.type === 'SMITHY_FORGE_PREVIEW') {
        const section = byId(payload.sectionBagId),
          id = materialId(section);
        if (!materialUsable(s, section) || id < 5044 || id > 5049)
          return fail('没有可用的完整连戎神节');
        if (a.type === 'SMITHY_FORGE') {
          const entry = array(s.forgePreviews?.[num(section.id)]).find(
              (e) => num(e.id) === num(payload.targetArtifactId),
            ),
            t =
              entry?.tmpl ||
              entry?.equipTmpl ||
              lookup(s.allEquipTemplates, payload.targetArtifactId);
          if (
            !entry ||
            !t ||
            num(t.id) !== num(payload.targetArtifactId) ||
            num(t.reqLevel) <= 0 ||
            num(t.slotType) < 1 ||
            num(t.slotType) > 11
          )
            return fail('该神节当前打造预览中没有完整的目标神器数据');
        }
        return ok;
      }
      if (a.type === 'CRAFT_EQUIP') {
        const t = lookup(s.allEquipTemplates, payload.targetEquipTmplId),
          ids = tailorMaterialIds(payload.targetEquipTmplId);
        if (
          !t ||
          num(t.reqLevel) <= 0 ||
          num(t.reqLevel) > num(s.role.level) ||
          !ids.includes(num(payload.materialItemTmplId))
        )
          return fail('打造目标等级、材料类别或配方不匹配');
        const bag = materialBag(s, payload.materialItemTmplId);
        return bag && materialSupports(bag, '装备', num(t.reqLevel))
          ? ok
          : fail('打造材料数量、使用等级或装备适用范围不足');
      }
      if (a.type === 'YUCI_EXCHANGE') {
        const t = lookup(s.allEquipTemplates, payload.equipTmplId),
          index = EXCHANGE_SETS.findIndex((name) =>
            array(s.equipSets).some(
              (set) =>
                set.name === name &&
                array(parse(set.equipTmplIds, [])).map(num).includes(num(payload.equipTmplId)),
            ),
          );
        return t &&
          num(s.role.level) >= 10 &&
          num(t.reqLevel) > 0 &&
          num(t.reqLevel) <= num(s.role.level) &&
          index >= 0 &&
          materialCount(s, 5273 + index) >= 5 + index
          ? ok
          : fail('兑换目标、角色等级或对应万灵石数量不足');
      }
      if (a.type === 'BEAR_ENTER')
        return num(s.role.level) >= 30 && materialCount(s, 51002) > 0
          ? ok
          : fail('角色等级或除熊害令牌不足');
      if (a.type === 'SHOP_SELL_BATCH' || (a.type === 'SHOP_SELL' && payload.bagItemId == null)) {
        const ids = a.type === 'SHOP_SELL_BATCH' ? payload.roleEquipIds : [payload.roleEquipId];
        return Array.isArray(ids) && ids.length > 0 && ids.length <= 20 &&
          new Set(ids.map(num)).size === ids.length && ids.every(id => array(s.equipments).some(e =>
            num(e.id) === num(id) && !e.isEquipped && e.equipTmpl &&
            (!e.isAppraisal || (prefs.sell.keepAppraised === false && !doublePerfect(e)))))
          ? ok : fail('装备状态已变化，不再符合出售条件');
      }
      if (a.type === 'SHOP_SELL' && payload.bagItemId != null) {
        const bag = byId(payload.bagItemId),
          count = num(payload.count);
        return Number.isInteger(count) &&
          count > 0 &&
          bagUsable(s, bag, count, false) &&
          prefs.sell.materialIds.map(num).includes(materialId(bag)) &&
          num(bag.itemTmpl.price) > 0
          ? ok
          : fail('出售材料需明确允许，且当前数量和价格可确认');
      }
      if (a.type === 'USE_ITEM')
        return bagUsable(s, byId(payload.bagItemId), num(payload.count, 1)) &&
          num(payload.count, 1) > 0 &&
          Number.isInteger(num(payload.count, 1))
          ? ok
          : fail('物品数量或使用等级不符合条件');
      return ok;
    }
    const roleMap = (s) => array(s.maps).find((m) => num(m.id) === num(s.role?.mapId));
    const costs = (m) => array(m.costs || parse(m.costConfig, []));
    const monsters = (m) => array(m.monsters || parse(m.monsterConfig, []));
    const npcs = (m) => array(parse(m?.npcs, []));
    function townFor(s, npc) {
      if ([NPC.arena, NPC.trial].includes(npc))
        return array(s.maps).find((m) => num(m.id) === 4 &&
          num(m.reqLevel) <= num(s.role.level)) || null;
      const all = array(s.maps).filter(
        (m) =>
          num(m.mapType) === 1 &&
          m.show !== false &&
          num(m.reqLevel) <= num(s.role.level) &&
          (!npc ||
            npcs(m).some(
              (n) => n.id === npc || (npc === NPC.tailor && String(n.name).includes('裁缝')),
            )),
      );
      return (
        all.find((m) => num(m.id) === num(s.role.mapId)) ||
        all.sort((a, b) => num(a.id) - num(b.id))[0] ||
        null
      );
    }
    const RINGS_MAP_IDS = [20100, 20101, 20102];
    const ASSAULT_PROFILES = {
      rings: { label: '三环', longLabel: '攻坚方案·新三环', maps: RINGS_MAP_IDS, reference: ringsTargets,
        survival: (s) => s.profileStats?.rings?.survival, waiting: '三环：等待怪物数据（56 级开放）' },
      tower: { label: '浮屠', longLabel: '攻坚方案·无相浮屠', maps: [20070], reference: towerTargets,
        survival: () => ({ weight: 1 }), waiting: '浮屠：等待试炼数据' },
    };
    const ASSAULT_IDS = Object.keys(ASSAULT_PROFILES), PROFILE_IDS = ['farm', ...ASSAULT_IDS];
    const profileLabel = (name) => ASSAULT_PROFILES[name]?.label || '挂机';
    const longLabel = (name) => ASSAULT_PROFILES[name]?.longLabel || '挂机方案';
    const mapProfile = (id) => ASSAULT_IDS.find((name) => ASSAULT_PROFILES[name].maps.includes(num(id)));
    const profileLocked = (s) => !!(s.rings?.run || s.trial?.run || mapProfile(s.role?.mapId));
    const profileWearable = (eq, s, p) => !!eq && num(template(eq).slotType) !== 12 &&
      num(template(eq).reqLevel) <= num(s.role?.level) && (eq.isBound || !num(template(eq).bindOnEquip) || p.gear.allowBinding);
    const ringsMaps = (s) => array(s?.maps).filter((m) =>
      RINGS_MAP_IDS.includes(num(m.id)) && num(m.reqLevel) <= num(s.role?.level));
    function keptFloors(records, now = Date.now()) {
      const ordered = array(records).filter((f) => f?.number > 0 && array(f.enemies).length)
        .sort((a, b) => b.at - a.at);
      if (!ordered.length) return [];
      const highest = ordered.filter((f) => now - f.at <= 7 * 86400000).sort((a, b) => b.number - a.number).slice(0, 5);
      return highest.includes(ordered[0]) ? highest : [...highest, ordered[0]];
    }
    function towerTargets(s) {
      const floors = keptFloors(s?.towerFloors);
      const list = floors.flatMap((floor) => {
        const hp = floor.enemies.reduce((sum, e) => sum + num(e.base.hp), 0);
        return floor.enemies.map((e) => ({ ...e, category: 'TOWER', weight: hp ? num(e.base.hp) / hp / floors.length : 0 }));
      });
      return { source: list.length ? 'tower' : 'none', floors: floors.map((f) => f.number), mapIds: [], list };
    }
    function ringRefs(map) {
      return [['monsters', 'monsterId', 'MONSTER'], ['leaders', 'leaderId', 'LEADER'], ['bosses', 'bossId', 'BOSS']]
        .flatMap(([list, key, category]) => array(map[list]).map((v) => ({ id: num(v[key]), category, count: num(v.count) })));
    }
    function ringsTargets(s) {
      const groups = [], mapIds = [];
      for (const map of ringsMaps(s)) {
        const refs = ringRefs(map), entries = refs.map((r) => s.monsterTemplates?.get?.(r.category + ':' + r.id));
        if (!entries.length || entries.some((e) => !e)) continue;
        const hp = refs.map((r, i) => r.count * num(entries[i].base.hp)), total = hp.reduce((a, b) => a + b, 0);
        if (!total) continue;
        mapIds.push(map.id);
        groups.push(entries.map((e, i) => ({ ...e, weight: hp[i] / total })));
      }
      const list = groups.flat();
      for (const entry of list) entry.weight /= groups.length;
      return { source: list.length ? 'rings' : 'none', mapIds, list };
    }
    function assaultTargets(s, name) {
      return ASSAULT_PROFILES[name].reference(s);
    }
    function assaultAvailable(s, p, name) {
      return !!s && !!p.gear?.assault?.enabled && p.gear.scoring === 'combat' && assaultTargets(s, name).source !== 'none';
    }
    // Snapshots copy inventory and role records on every tick. Equal records can reuse a view;
    // store-backed collections with methods keep their own identity.
    function equalSnapshot(a, b) {
      if (a === b) return true;
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object' ||
          Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) || typeof a.get === 'function' ||
          typeof a.has === 'function') return false;
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && equalSnapshot(a[k], b[k]));
    }
    const profileViews = new Map();
    function profileView(s, p, profile) {
      if (!ASSAULT_IDS.includes(profile) || !s) return { state: s, prefs: p };
      const { list, ...scoreTargets } = assaultTargets(s, profile), previous = profileViews.get(profile);
      const view = { state: { ...s, scoringProfile: profile, monsters: list, scoreTargets,
        aoeTargets: s.profileStats?.[profile]?.alive ?? 1, survival: ASSAULT_PROFILES[profile].survival(s) ?? null },
        prefs: { ...p, gear: { ...p.gear, scoring: 'combat', autoDefense: p.gear.assault.autoDefense,
          defenseWeight: p.gear.assault.defenseWeight } } };
      if (previous && equalSnapshot(view, previous)) return previous;
      profileViews.set(profile, view);
      return view;
    }
    const RING_NAMES = ['黄金之链', '玄佛珠', '熔岩之地'];
    const ringStage = (stage) => '第' + (stage + 1) + '环「' + RING_NAMES[stage] + '」';
    const expMemo = { text: '', until: 0 };
    function doubleExpUntil(role) {
      const text = role?.settings;
      if (typeof text !== 'string') return num(text?.doubleExp?.buffExpireTime);
      // The settings text also holds the warehouse, so it is parsed once per change.
      if (text !== expMemo.text)
        Object.assign(expMemo, { text, until: num(parse(text, null)?.doubleExp?.buffExpireTime) });
      return expMemo.until;
    }
    function ringsStatus(s, prefs, daily, now = Date.now()) {
      if (!s?.role?.id) return null;
      const status = ringsCounts(s, prefs, daily);
      status.open = !status.done && !status.stopped && (!status.roundOpen || status.retries < status.maxRetries);
      // The rings give no experience: no round starts while the double experience buff runs.
      status.doubleExp = status.open && !status.run && doubleExpUntil(s.role) > now;
      return status;
    }
    function ringsCounts(s, prefs, daily) {
      const r = s.rings, counts = array(r?.counts), failures = num(daily?.failures);
      return { enabled: prefs.rings.enabled, level56: num(s.role.level) >= 56, counts,
        run: r?.run ? { stage: r.run.stage } : null, bound: num(r?.bound), unbound: num(r?.unbound),
        pending: num(r?.pendingBound) + num(r?.pendingUnbound), lastSettlement: r?.lastSettlement ?? null,
        rounds: num(daily?.rounds), roundsPerDay: prefs.rings.roundsPerDay, roundOpen: !!daily?.roundOpen,
        retries: num(daily?.retries), maxRetries: prefs.rings.maxRetries, cleared: num(daily?.cleared),
        runs: num(daily?.runs), failures,
        done: counts.length === 3 && counts.every((n) => n >= 2),
        stopped: (!daily?.roundOpen && num(daily?.rounds) >= prefs.rings.roundsPerDay) ||
          num(daily?.refusals) >= 3, at: r?.at ?? null };
    }
    function gearProfileTarget(s, p, ledger, now) {
      if (profileLocked(s)) return s.gearProfile?.worn || 'farm';
      if (!p.gear.enabled || p.gear.profile === 'farm') return 'farm';
      if (p.gear.profile !== 'auto') return assaultAvailable(s, p, p.gear.profile) ? p.gear.profile : 'farm';
      if (!assaultAvailable(s, p, 'rings')) return 'farm';
      const daily = ledger?.rings?.day === s.rings?.day ? ledger?.rings : null;
      return ringsPlan(s, p, daily, now, { ignoreRefresh: true })?.payload.action === 'enter' ? 'rings' : 'farm';
    }
    const gearChange = (a) => a.family === 'gear' && ['EQUIP_ITEM', 'WAREHOUSE_WITHDRAW'].includes(a.type);
    function ringsPlan(s, p, daily, now, { ignoreRefresh = false, hasGearAction } = {}) {
      if (!p.rings?.enabled || !num(s.role?.id) || num(s.role.level) < 56 || s.activity || s.arenaMatch?.active ||
          s.trial?.run || [20050, 20051, 20052, 20070].includes(num(s.role.mapId))) return null;
      const r = s.rings, status = ringsStatus(s, p, daily, now);
      const request = (name, label, itemId = 0) => ({
        ...action('RINGS_COMMAND', { action: name, itemId, ...(r ? { revision: r.revision } : {}) },
          '新三环：' + label, 'rings', { readOnly: name === 'status', requiresTown: name !== 'status',
            townId: r?.townId, responseType: 'RINGS_RESPONSE' }),
        key: 'rings:' + name + ':' + itemId,
      });
      const query = () => request('status', '查询状态');
      if (!r || !Number.isFinite(r.at)) return query();
      // With a known run on a ring map the fight starts even when the status stays unconfirmed for 15 s:
      // the character must never stand idle there.
      const unconfirmedRun = r.run && RINGS_MAP_IDS.includes(num(s.role?.mapId)) &&
        Number.isFinite(s.ringsDirtyAt) && now - s.ringsDirtyAt > 15000;
      if (!ignoreRefresh && s.ringsDirty && !unconfirmedRun) return query();
      if (r.run) {
        if (s.ringsFighting || !RING_NAMES[r.run.stage] || now - (s.ringsStartAt ?? -Infinity) < 5000) return null;
        return action('COMBAT_START', {}, '新三环：挑战' + ringStage(r.run.stage), 'rings', { noResponse: true });
      }
      if (!ignoreRefresh && now - r.at > p.rings.refreshMinutes * 60000) return query();
      if (s.gearCheck || arenaRush(p, now) || num(daily?.refusals) >= 3 || !num(r.townId)) return null;
      let next;
      if (p.rings.claimInbox && status.pending > 0) next = request('inbox', '领取暂存奖励');
      else {
        const order = { ring: [98011], jade: [98012], ringFirst: [98011, 98012], jadeFirst: [98012, 98011] };
        if (status.bound + status.unbound >= 300 && order[p.rings.exchange]) {
          const owned = new Set([...array(s.equipments), ...array(s.warehouseEquips), ...array(s.bagItems)]
            .map((e) => num(e.equipTmpl?.id ?? e.tmpl?.id ?? e.tmplId ?? e.itemId)));
          const id = order[p.rings.exchange].find((id) => !owned.has(id));
          if (id) next = request('exchange', id === 98011 ? '兑换重楼戒' : '兑换重楼玉', id);
        }
        if (!next && status.open && !status.doubleExp) next = request('enter', '从第一环开始');
      }
      if (!ignoreRefresh && next && now - r.at > 60000) return query();
      if (!ignoreRefresh && next?.payload.action === 'enter' && gearProfileTarget(s, p, { rings: daily }, now) === 'rings' &&
          (s.gearProfile?.worn !== 'rings' || array(s.gearProfile?.pending).length || hasGearAction?.())) return null;
      return next;
    }
    const FARM_MAP_EXCLUDED_IDS = [20050, 20051, 20052, 20060, 20061, 20070, ...RINGS_MAP_IDS];
    // The next round starts when the board's round ends; a visit goes a moment after that.
    const INVASION_ROUND_DELAY = 3000;
    function invasionDaily(day) {
      return { day, visitAt: 0, visits: 0, joined: 0, created: 0, fights: 0, claimed: 0,
        won: 0, lost: 0, refused: { teams: [], rounds: [], runs: [] }, reports: [] };
    }
    function invasionStatus(s, prefs, daily, now) {
      const board = s?.invasion?.board, role = s?.role, runs = array(board?.runs);
      const team = array(board?.teams).find(t => array(t.members).some(m => m.roleId === role?.id));
      const fighting = runs.some(r => r.status === 'FIGHTING');
      const unclaimed = runs.filter(r => r.status === 'FINISHED' && !r.claimed).length;
      // With no run left a recruiting team cannot start either: the next visit waits for the round change.
      const exhausted = board?.remaining === 0 && !fighting && !(prefs.invasion.claim && unclaimed) &&
        now >= board.roundId && num(daily?.visitAt) < board.endsAt + INVASION_ROUND_DELAY;
      const sect = board?.sect ?? null;
      const capped = !!prefs.invasion.maxRunsPerDay && num(daily?.fights) >= prefs.invasion.maxRunsPerDay;
      const regular = daily?.visitAt ? daily.visitAt + prefs.invasion.intervalMinutes * 60000 : now;
      // A round start comes before the regular interval: teams form in its first minutes.
      const roundStart = board && !capped && num(daily?.visitAt) < board.endsAt ? board.endsAt + INVASION_ROUND_DELAY : Infinity;
      return { enabled: prefs.invasion.enabled, level20: num(role?.level) >= 20, sect,
        sectName: ['','少林','明教','丐帮','武当','峨眉','星宿','天龙','天山','逍遥'][sect] || null,
        ownSect: sect != null && String(sect) === String(role?.sect), remaining: board?.remaining ?? null,
        endsAt: board?.endsAt ?? null, team: team ? { status: team.status, members: team.members.length,
          expiresAt: team.expiresAt, leader: team.leaderId === role.id } : null,
        fighting: board ? fighting : null, unclaimed: board ? unclaimed : null,
        fragments: board ? array(board.fragments).filter(f => f.count > 0).map(({ name, count }) => ({ name, count })) : null,
        today: Object.fromEntries(['visits','joined','created','fights','claimed','won','lost'].map(k => [k, num(daily?.[k])])),
        nextVisitAt: exhausted ? board.endsAt + INVASION_ROUND_DELAY : Math.min(regular, roundStart),
        boardAt: s?.invasion?.at ?? null };
    }
    function invasionPlan(s, p, ledger, now) {
      const options = p.invasion;
      if (!options?.enabled || !s.role?.id || num(s.role.level) < 20 || !array(s.maps).some(m => num(m.id) === 6) ||
          s.activity || s.arenaMatch?.active || arenaRush(p, now) || s.trial?.run || s.rings?.run ||
          FARM_MAP_EXCLUDED_IDS.includes(num(s.role.mapId)) || array(s.gearProfile?.pending).length) return null;
      const daily = !ledger.day || ledger.invasion?.day === ledger.day ? ledger.invasion : null;
      const status = invasionStatus(s, p, daily, now), board = s.invasion?.board;
      if (!s.invasionVisit && now < status.nextVisitAt) return null;
      const request = (name, extra, label, more = {}) => action('XIAOXIAO_COMMAND', { action: name, ...extra }, '宵小入侵：' + label,
        'invasion', { requiresTown: true, townId: 6, readOnly: ['open', 'report'].includes(name), responseType: 'XIAOXIAO_RESPONSE', ...more });
      if (!board || num(s.role.mapId) !== 6 || num(s.invasion.mapId ?? s.role.mapId) !== 6 || !Number.isFinite(status.boardAt) ||
          now - status.boardAt > 30000 || (status.boardAt < board.endsAt && now >= board.endsAt) || s.invasionVisit?.travel)
        return request('open', { page: 0 }, '查看面板');
      const refused = daily?.refused;
      const run = options.claim && array(board.runs).find(r => r.status === 'FINISHED' && !r.claimed && !refused?.runs.includes(r.id));
      if (run) return daily?.reports.includes(run.id) ? request('claim', { runId: run.id }, '领取奖励') :
        request('report', { runId: run.id }, '读取战报');
      const finished = { kind: 'visitFinished', family: 'invasion', label: '宵小入侵：查看完毕' };
      if (status.team || status.fighting || (options.maxRunsPerDay && status.today.fights >= options.maxRunsPerDay)) return finished;
      // The board still shows a round the server has ended: the next one has not started yet.
      const roundOver = now >= board.endsAt;
      if (!roundOver && board.remaining > 0 && now < board.endsAt - 10000) {
        // Leading comes first; a disciple of another sect, or one refused leading this round, joins a team.
        if (status.ownSect && !refused?.rounds.includes(board.roundId) && !s.invasionPriorRefused?.rounds.includes(board.roundId))
          return request('create', {}, '带队（本门派受袭）');
        const team = array(board.teams).find(t => t.status === 'RECRUITING' && !refused?.teams.includes(t.id) &&
          !s.invasionPriorRefused?.teams.includes(t.id) &&
          t.members.length < 4 && t.members.every(m => Math.abs(m.level - s.role.level) <= 20));
        if (team) return request('join', { teamId: team.id }, '加入「' +
          (team.members.find(m => m.roleId === team.leaderId)?.name || '队长') + '」的队伍（' + team.members.length + '/4）');
      }
      // Nothing to lead or join yet: stay in 大理 and look again every 5 s, as the game window does.
      const waitUntil = num(s.invasionVisit?.at) + options.waitSeconds * 1000;
      if (!s.invasionVisit || now >= waitUntil || (!roundOver && !(board.remaining > 0))) return finished;
      if (now - status.boardAt >= 5000) return request('open', { page: 0 }, '等待队伍', { quiet: true });
      return { kind: 'invasionWait', family: 'invasion', key: 'invasion:wait',
        label: '宵小入侵：等待队伍（还剩 ' + Math.ceil((waitUntil - now) / 1000) + ' 秒）' };
    }
    function farmMap(map) {
      return !!map && num(map.mapType) !== 1 && map.show !== false &&
        costs(map).length === 0 && monsters(map).length > 0 &&
        !FARM_MAP_EXCLUDED_IDS.includes(num(map.id));
    }
    function fieldMap(map) {
      return farmMap(map) && num(map.id) >= 10000 && num(map.id) < 20000;
    }
    const gearCheckCounts = (bucket) => Object.fromEntries(['battle', 'kills', 'deaths']
      .map((key) => [key, Math.max(0, num(bucket?.[key]))]));
    const gearCheckWorn = (s, slot) => array(s.equipments)
      .filter((e) => e.isEquipped && num(template(e).slotType) !== slot)
      .map((e) => num(e.id)).sort((a, b) => a - b);
    function gearCheckTotals(buckets, mapId, firstHour, lastHour, base = {}) {
      const total = gearCheckCounts();
      for (const [key, bucket] of Object.entries(buckets || {})) {
        const [hour, map] = key.split(':').map(Number);
        if (map !== mapId || hour < firstHour || hour > lastHour) continue;
        for (const field of Object.keys(total))
          total[field] += Math.max(0, num(bucket[field]) - num(base[key]?.[field]));
      }
      return total;
    }
    function gearCheckStart(a, before, s, buckets, prefs, now) {
      if (a.type !== 'EQUIP_ITEM' || a.family !== 'gear' || a.gearSwapBack || a.profileSwitch ||
          ASSAULT_IDS.includes((s.gearProfile || before.gearProfile)?.worn) || s.gearCheck ||
          !config(prefs).gear.fieldCheck || !farmMap(roleMap(s)) || num(before.role.id) !== num(s.role.id)) return null;
      const item = array(before.equipments).find((e) => num(e.id) === num(a.payload.roleEquipId));
      if (!item || item.isEquipped || !array(s.equipments).some((e) => num(e.id) === num(item.id) && e.isEquipped)) return null;
      const slot = num(template(item).slotType), mapId = num(s.role.mapId), hour = Math.floor(now / 3600000),
        old = array(before.equipments).find((e) => e.isEquipped && num(template(e).slotType) === slot),
        key = hour + ':' + mapId;
      return { itemId: num(item.id), itemName: template(item).name || String(item.id),
        oldItemId: old ? num(old.id) : null, oldName: old ? template(old).name || String(old.id) : '',
        slot, mapId, startedAt: now, level: num(s.role.level), worn: gearCheckWorn(s, slot),
        before: gearCheckTotals(buckets, mapId, hour - 2, hour),
        base: { [key]: gearCheckCounts(buckets?.[key]) } };
    }
    function gearCheckAfter(check, buckets, s) {
      return { ...gearCheckTotals(buckets, check.mapId, Math.floor(check.startedAt / 3600000), Infinity, check.base),
        ...(s ? { level: num(s.role.level), worn: gearCheckWorn(s, check.slot),
          itemId: num(array(s.equipments).find((e) => e.isEquipped && num(template(e).slotType) === check.slot)?.id) } : {}) };
    }
    function gearCheckVerdict(check, after, prefs, now) {
      const gear = config(prefs).gear, before = check.before,
        tb = num(before.battle) / 3600000, ta = num(after.battle) / 3600000,
        kb = num(before.kills), ka = num(after.kills),
        beforeRate = tb > 0 ? kb / tb : null, afterRate = ta > 0 ? ka / ta : null,
        change = beforeRate > 0 && afterRate !== null ? (afterRate - beforeRate) / beforeRate * 100 : null,
        spread = tb > 0 && ta > 0 ? Math.sqrt(ka / (ta * ta) + kb / (tb * tb)) : 0,
        z = spread > 0 ? (afterRate - beforeRate) / spread : 0,
        afterMinutes = num(after.battle) / 60000, needMinutes = gear.fieldMinutes,
        deathWorse = num(after.deaths) > 0 && num(before.deaths) === 0 && tb >= 1;
      const result = { beforeRate, afterRate, change, z, afterMinutes, needMinutes, deathWorse };
      if (!gear.fieldCheck || (after.level != null && num(after.level) !== check.level) ||
          (after.worn && JSON.stringify(array(after.worn).map(num).sort((a, b) => a - b)) !== JSON.stringify(check.worn)) ||
          (after.itemId != null && num(after.itemId) !== check.itemId)) return { ...result, state: 'stale' };
      // A failed rollback retains the measured verdict until it can be confirmed.
      if (check.verdict?.state === 'worse') return { ...check.verdict };
      if (num(before.battle) < needMinutes * 60000) return { ...result, state: 'nobefore' };
      if (afterMinutes < needMinutes)
        return { ...result, state: now - check.startedAt >= 10800000 ? 'stale' : 'collecting' };
      return { ...result, state: (change !== null && change <= -gear.fieldDropPercent && z <= -2) || deathWorse ? 'worse' : 'ok' };
    }
    function gearCheckRestored(check, s) {
      const worn = array(s.equipments).find((e) => e.isEquipped && num(template(e).slotType) === check.slot);
      return check.oldItemId !== null ? num(worn?.id) === check.oldItemId :
        !worn && array(s.equipments).some((e) => num(e.id) === check.itemId && !e.isEquipped);
    }
    function gearCheckRollback(check, s) {
      if (!array(s.equipments).some((e) => e.isEquipped && num(e.id) === check.itemId)) return null;
      if (check.oldItemId !== null && !array(s.equipments).some((e) => !e.isEquipped && num(e.id) === check.oldItemId)) return null;
      return action('EQUIP_ITEM', { roleEquipId: check.oldItemId ?? check.itemId },
        check.oldItemId !== null ? '实测变差，换回「' + check.oldName + '」' : '实测变差，脱下「' + check.itemName + '」',
        'gear', { inBattle: true, gearSwapBack: true });
    }
    function gearRejected(entries, now) {
      const seen = new Set();
      return array(entries).filter((e) => e && Number.isSafeInteger(e.id) && e.id > 0 &&
        typeof e.name === 'string' && Number.isFinite(e.at) && now - e.at <= 30 * 86400000)
        .sort((a, b) => b.at - a.at).filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        }).slice(0, 200);
    }
    function gearCheckText(check, verdict, s, restored = false) {
      const fmt = (value, digits = 0) => value == null ? '—' : value.toFixed(digits),
        map = array(s.maps).find((m) => num(m.id) === check.mapId)?.name || check.mapId,
        ending = { ok: '核对通过，保留装备', nobefore: '换装前战斗数据不足，不作比较',
          stale: '核对失效（超时、等级或装备变化、核对关闭）' }[verdict.state] ||
          (restored ? check.oldItemId !== null ? '已换回「' + check.oldName + '」' : '已脱下「' + check.itemName + '」' :
            '原装备「' + check.oldName + '」不在背包，保留「' + check.itemName + '」');
      return '实测核对「' + check.itemName + '」· ' + map + '：每小时击杀 ' + fmt(verdict.beforeRate) + ' → ' +
        fmt(verdict.afterRate) + '（' + fmt(verdict.change, 1) + '%），战斗 ' + fmt(check.before.battle / 60000, 1) +
        ' → ' + fmt(verdict.afterMinutes, 1) + ' 分钟 / 至少 ' + verdict.needMinutes + ' 分钟，' + ending;
    }
    function poolMaps(s, limit = 6) {
      return array(s.maps).filter((m) => fieldMap(m) && num(m.reqLevel) <= num(s.role?.level))
        .sort((a, b) => num(b.reqLevel) - num(a.reqLevel) || num(a.id) - num(b.id)).slice(0, limit);
    }
    function scoreTargets(s, p, lastMap) {
      const templates = s.monsterTemplates || new Map();
      const maps = p.gear.targets === 'map' ? [] : poolMaps(s).filter((m) =>
        array(m.monsters).length && m.monsters.every((v) => templates.has('MONSTER:' + v.monsterId)));
      if (!maps.length) return { source: lastMap.length ? 'map' : 'none',
        mapIds: lastMap.length ? [s.lastMapId] : [], list: lastMap };
      return { source: 'pool', mapIds: maps.map((m) => m.id), list: maps.flatMap((m) => {
        const total = m.monsters.reduce((n, v) => n + num(v.count), 0);
        return m.monsters.map((v) => ({ ...templates.get('MONSTER:' + v.monsterId),
          weight: num(v.count) / total / maps.length }));
      }) };
    }
    const collectionValues = (value) => Array.isArray(value) ? value : Array.from(value?.values?.() || []);
    function viewedState(source, own) {
      if (!source || !own) return null;
      const data = Array.isArray(source.roleOverride?.skills) ? source.roleOverride : source;
      if (!Array.isArray(data.skills)) return null;
      const role = data.role || data, equipments = source.equipmentsOverride ?? data.equipments ?? [];
      const artifactSkills = new Map(collectionValues(own.artifactSkills).map((s) => [num(s.weaponId), s]));
      if (data.artifact) artifactSkills.set(num(data.artifact.weaponId), data.artifact);
      const state = {
        role: { id: num(role.roleId ?? role.id), level: num(role.level), sect: num(role.sect), nickname: role.nickname },
        finalAttributes: source.statsOverride ?? data.stats,
        skills: data.skills.map((s) => s.skillDetail ? s : ({ skillId: s.id, currentLevel: s.level,
          skillDetail: { id: s.id, name: s.name, type: s.skillType, cd: s.cd, hitCount: s.hitCount,
            combatRules: s.combatRules, effectConfig: JSON.stringify(s.effects || []), unlockLevel: 0 } })),
        equipments,
        gemInfos: collectionValues(source.gemInfosOverride ?? data.gemInfo ?? data.gemInfos ??
          equipments.flatMap((e) => array(e.gemInfos))),
        equipSets: data.equipSets ?? own.equipSets,
        allEquipTemplates: own.allEquipTemplates,
        artifactSkills: [...artifactSkills.values()],
        maps: own.maps, monsterTemplates: own.monsterTemplates,
        aoeTargets: own.aoeTargets, survival: own.survival,
      };
      const selected = scoreTargets(state, { gear: { targets: 'pool' } }, []);
      state.monsters = selected.list;
      state.scoreTargets = { source: selected.source, mapIds: selected.mapIds };
      return state;
    }
    function isViewedProfile(props) {
      // The own profile also receives live combat stats without a role override.
      return !!(props?.readonly || props?.statsOverride != null && props?.roleOverride);
    }
    function profileState(props, own, entries) {
      if (!isViewedProfile(props)) return own;
      const entry = collectionValues(entries).find((v) => num(v.role.id) === num(props.roleOverride?.id));
      return viewedState({ ...entry, ...props }, own);
    }
    // Since the client of 2026-11-19 the server answers GET_PLAYER_INFO without skills: a cached answer without them.
    function viewedSkillsMissing(props, entries) {
      if (!isViewedProfile(props) || Array.isArray(props.roleOverride?.skills)) return false;
      const entry = collectionValues(entries).find((v) => num(v.role.id) === num(props.roleOverride?.id));
      return !!entry && !Array.isArray(entry.skills);
    }
    function profileScoreValue(info, missing = false) {
      return info === null ? (missing ? '服务器未提供对方技能' : '未读到对方技能') : info.pending ? '待战斗数据' : info.score.toLocaleString();
    }
    function profileScoreText(info, missing = false) {
      return '实战评分 ' + profileScoreValue(info, missing);
    }
    function tooltipContext(item, profiles, own, entries) {
      const profile = array(profiles).find((p) => p.modelValue && isViewedProfile(p) && item?.id != null &&
        array(p.equipmentsOverride).some((e) => String(e.id) === String(item.id)));
      return profile ? { state: profileState(profile, own, entries), compare: false,
        title: '按 ' + (profile.roleOverride?.nickname || '对方') + ' 的门派与属性计算' } :
        { state: own, compare: true, title: null };
    }
    const SUSTAIN_LINE = 0.5, LOW_HP_SHARE = 0.05, HP_LINE = 0.35;
    // The HP loss that potions had to make up. Skills that heal the character (峨眉) and pets make up part of the
    // loss, and that part does not bring the potions closer to their limit. Totals without the figure (older
    // statistics) count the whole loss.
    const potionLoad = (totals) => Number.isFinite(totals?.hpCovered)
      ? Math.min(num(totals.hpLost), Math.max(0, totals.hpCovered)) : num(totals?.hpLost);
    function survivalWeight(totals, healPerSecond) {
      if (!totals || totals.battle < 1800000 || !Number.isFinite(healPerSecond) || healPerSecond <= 0) return null;
      const clamp = (v) => Math.max(0, Math.min(1, v));
      const hours = totals.battle / 3600000, deaths = num(totals.deaths);
      const count = num(totals.hpPotions) + num(totals.mpPotions);
      const income = num(totals.gold) + num(totals.sell);
      const share = count && income ? clamp(num(totals.potion) * num(totals.hpPotions) / count / income) : 0;
      const load = potionLoad(totals), healed = num(totals.hpLost) > 0 ? 1 - load / num(totals.hpLost) : 0;
      const ratio = clamp(load / (totals.battle / 1000) / healPerSecond);
      const low = num(totals.low) / totals.battle;
      const sustain = clamp((ratio - SUSTAIN_LINE) / (1 - SUSTAIN_LINE)), burst = clamp(low / LOW_HP_SHARE), death = deaths > 0 ? 0.5 : 0;
      const danger = Math.max(sustain, burst, death);
      return { weight: Math.round(clamp(share + danger) * 100) / 100,
        share, ratio, healed, low, deaths, hours, sustain, burst, death, danger, safe: danger === 0 };
    }
    function assaultWeight(totals, healPerSecond, failed = false) {
      failed = !!failed || num(totals?.deaths) > 0;
      const battle = num(totals?.battle);
      if (!failed && (battle < 300000 || !(healPerSecond > 0))) return null;
      const ratio = battle && healPerSecond > 0 ? Math.min(1, potionLoad(totals) / (battle / 1000) / healPerSecond) : 0;
      const low = battle ? num(totals.low) / battle : 0;
      const sustain = Math.max(0, (ratio - SUSTAIN_LINE) / (1 - SUSTAIN_LINE)), burst = Math.min(1, low / LOW_HP_SHARE);
      const danger = Math.max(sustain, burst);
      return { weight: failed ? 1 : Math.round(Math.max(0.5, danger) * 100) / 100,
        ratio, low, sustain, burst, danger, failed, hours: battle / 3600000, safe: !failed && !danger };
    }
    function healPerSecond(s) {
      return potionEffect(potionChoices(s, 'HP')[0], 'HP') / 3;
    }
    function scoringStatus(s, p) {
      const survival = s?.survival || null;
      const auto = !!p.gear.autoDefense && Number.isFinite(survival?.weight);
      const source = s?.scoreTargets?.source || 'none', mapIds = s?.scoreTargets?.mapIds || [];
      return { source, mapIds, mapNames: mapIds.map((id) => array(s.maps).find((m) => num(m.id) === num(id))?.name || String(id)),
        weight: auto ? survival.weight : p.gear.defenseWeight, auto, survival, survivalReason: s?.survivalReason, autoDefense: p.gear.autoDefense };
    }
    function scoringText(s) {
      const target = s.source === 'pool' ? s.mapNames.join('、') :
        s.source === 'map' ? '最近挂机地图 ' + s.mapNames.join('、') : '等待怪物数据';
      const percent = (v) => (v * 100).toFixed(v * 100 < 10 ? 1 : 0);
      const v = s.survival;
      const detail = s.auto ? '自动·' + (v.safe ? '安全' : '吃紧') + '：药费占收入 ' + percent(v.share) + '%，掉血占回血能力 ' +
        percent(v.ratio) + '%，低血量时间 ' + percent(v.low || 0) + '%，近 ' + v.hours.toFixed(1) + ' 战斗小时' + (v.deaths > 0 ? '，有阵亡' : '') :
        s.autoDefense ? (s.survivalReason === 'potions' ? '未读到生命药数据，用手动值；开始托管后自动读取' : '数据不足，用手动值') : '手动';
      return '评分参照：' + target + ' · 生存权重 ' + s.weight + '（' + detail + '）';
    }
    function normalMap(s, prefs, penalty = 0) {
      const eligible = array(s.maps).filter(
        (m) =>
          (prefs.battle.mapId ? farmMap(m) : fieldMap(m)) && num(m.reqLevel) <= num(s.role.level),
      );
      if (prefs.battle.mapId)
        return eligible.find((m) => num(m.id) === num(prefs.battle.mapId)) || null;
      const level = Math.max(1, num(s.role.level) - prefs.battle.levelOffset - penalty);
      return (
        eligible
          .filter((m) => num(m.reqLevel) <= level)
          .sort((a, b) => num(b.reqLevel) - num(a.reqLevel) || num(a.id) - num(b.id))[0] ||
        eligible.sort((a, b) => num(a.reqLevel) - num(b.reqLevel))[0] ||
        null
      );
    }
    function statsNumber(value) {
      const n = Number(value) || 0, a = Math.abs(n);
      if (a >= 100000000) return (n / 100000000).toFixed(2) + '亿';
      if (a >= 10000) return (n / 10000).toFixed(a >= 1000000 ? 1 : 2) + '万';
      return Math.round(n).toLocaleString('zh-CN');
    }
    function mapRate(hours, mapId, field, fromHour, toHour) {
      const index = field === 'net' ? 6 : 3;
      let n = 0, ms = 0, ms2 = 0, v = 0, v2 = 0, vMs = 0;
      const suffix = ':' + mapId;
      for (const [key, sample] of Object.entries(hours || {})) {
        if (!key.endsWith(suffix)) continue;
        const hour = Number(key.slice(0, -suffix.length));
        if (hour < fromHour || hour > toHour) continue;
        n += sample[0]; ms += sample[1]; ms2 += sample[2];
        v += sample[index]; v2 += sample[index + 1]; vMs += sample[index + 2];
      }
      const r = ms ? v / ms : 0;
      // Cancellation can leave a rounding error when every sample has the same rate.
      const error = v2 - 2 * r * vMs + r * r * ms2;
      const residual = error > Number.EPSILON * (v2 + 2 * Math.abs(r * vMs) + r * r * ms2) ? error : 0;
      return { n, minutes: ms / 60000, rate: ms ? r * 3600000 : null,
        se: n < 2 || !ms ? Infinity : Math.sqrt(residual / (n * (n - 1))) / (ms / n) * 3600000 };
    }
    function smartCandidate(map, battle, rates, now, hour) {
      const id = num(map.id), from = hour - battle.smartHours + 1;
      const exp = mapRate(rates.hours, id, 'exp', from, hour), net = mapRate(rates.hours, id, 'net', from, hour);
      const objective = battle.smartGoal === 'gold' ? net : exp;
      let state = objective.minutes >= battle.smartMinutes ? 'measured' : 'trial';
      if (rates.blocked?.[id] > now) state = 'blocked';
      else if (battle.smartGoal === 'exp' && state === 'measured' && net.rate < 0) state = 'loss';
      return { id, name: map.name, reqLevel: num(map.reqLevel), minutes: objective.minutes,
        rate: objective.rate, se: objective.se, exp: exp.rate, expSe: exp.se, net: net.rate, netSe: net.se, state };
    }
    function weakCandidate(row, battle, hours, hour, best) {
      const field = battle.smartGoal === 'gold' ? 'net' : 'exp';
      const stored = mapRate(hours, row.id, field, hour - 47, hour);
      return stored.minutes >= battle.smartMinutes && stored.rate < 0.7 * best.rate &&
        mapRate(hours, row.id, field, hour - Math.min(48, 4 * battle.smartHours) + 1, hour).n > 0;
    }
    function refineCandidate(best, second, current, cap) {
      if (!second || best.rate - second.rate >= 2 * Math.hypot(best.se, second.se)) return null;
      if ((current === best || current === second) && best.minutes < cap && second.minutes < cap) return current;
      const shorter = best.minutes <= second.minutes ? best : second;
      return shorter.minutes < cap ? shorter : null;
    }
    function smartMap(s, prefs, rates = {}, ctx) {
      const battle = prefs.battle, hour = Math.floor(ctx.now / 3600000);
      const maps = poolMaps(s, battle.smartMaps);
      const candidates = maps.map(map => smartCandidate(map, battle, rates, ctx.now, hour));
      const eligible = candidates.filter(row => row.state !== 'blocked' && row.state !== 'loss');
      if (!eligible.length) return { map: normalMap(s, prefs, ctx.penalty), phase: 'fallback', candidates,
        reason: '智能选图：没有可用候选，按等级选图' };
      const measured = eligible.filter(row => row.state === 'measured').sort((a, b) => b.rate - a.rate);
      const [best, second] = measured, current = eligible.find(row => row.id === num(ctx.mapId));
      if (best) best.state = 'best';
      for (const row of eligible)
        if (best && row.state === 'trial' && weakCandidate(row, battle, rates.hours, hour, best)) row.state = 'weak';
      const result = (row, phase, reason) => ({ map: maps.find(map => num(map.id) === row.id), phase, candidates, reason });
      if (ctx.gearCheck && current) return result(current, 'hold', '智能选图：换装实测中，暂不换图');
      const prefix = '智能选图·' + (battle.smartGoal === 'gold' ? '金币' : '经验') + '：';
      if (!(best && battle.smartGoal === 'exp' && ctx.doubleExp)) {
        const trial = current?.state === 'trial' ? current : eligible.find(row => row.state === 'trial');
        if (trial) return result(trial, 'trial', prefix + '试打「' + trial.name + '」' +
          Math.floor(trial.minutes) + '/' + battle.smartMinutes + ' 分钟');
        const refine = refineCandidate(best, second, current, 3 * battle.smartMinutes);
        if (refine) {
          refine.state = 'trial';
          return result(refine, 'refine', prefix + '两图接近，加测「' + refine.name + '」');
        }
      }
      const stay = measured.includes(current) && best.rate <= current.rate * 1.03;
      const chosen = stay ? current : best;
      return result(chosen, 'best', prefix + '「' + chosen.name + '」' +
        (chosen === best ? '实测最高 ' : '收益接近，继续挂机 ') + statsNumber(chosen.rate) + '/时');
    }
    function potionEffect(item, attr) {
      return array(parse(item?.useEffect || item?.use_effect, []))
        .filter((e) => e.type === 'HEAL' && e.attr === attr)
        .reduce((n, e) => n + num(e.value), 0);
    }
    function sortDepositPlan(bagItems, warehouseItems) {
      const known = new Set(array(warehouseItems).filter(item => item?.count >= 1 && item.itemId != null)
        .map(item => item.itemId));
      return array(bagItems).filter(item => item?.id != null && item.count >= 1 && known.has(item.itemId) &&
        [2, 3, 4].includes(item.itemTmpl?.type) && !['HP', 'MP', 'hp', 'mp'].some(attr => potionEffect(item.itemTmpl, attr) > 0))
        .map(({ id, itemId, count, itemTmpl }) => ({ bagItemId: id, itemId, count, name: itemTmpl.name }));
    }
    // Bag and warehouse tabs file stacks alike: 道具 is template type 2, 材料 types 3 and 4.
    function tabItems(tabText, items) {
      const types = tabText === '道具' ? [2] : tabText === '材料' ? [3, 4] : [];
      return array(items).filter(item => types.includes(item?.itemTmpl?.type));
    }
    function bagTabItems(tabText, character) {
      return tabItems(tabText, character?.bagItems);
    }
    function warehouseTabItems(tabText, character) {
      return tabItems(tabText, character?.warehouseItems);
    }
    function bagCellItem(tabText, index, character) {
      if (!Number.isInteger(index) || index < 0 || index >= 72) return null;
      return bagTabItems(tabText, character)[index] || null;
    }
    function potionChoices(s, attr) {
      const templates = new Map(array(s.potionTemplates).map((t) => [num(t.id), t]));
      for (const b of array(s.bagItems)) if (b.itemTmpl) templates.set(num(b.itemId), b.itemTmpl);
      return [...templates.values()]
        .filter((t) => num(t.reqLevel) <= num(s.role.level))
        .map((t) => ({ template: t, heal: potionEffect(t, attr) }))
        .filter((entry) => entry.heal > 0)
        .sort((a, b) => b.heal - a.heal).map((entry) => entry.template);
    }
    function potionOrder(list, attr, s, p) {
      const scores = new Map(list.map((t) => [t, potionEffect(t, attr)])), heal = (t) => scores.get(t),
        strong = list.toSorted((a, b) => heal(b) - heal(a));
      if (p.potions.order === 'strong') return strong;
      if (p.potions.order === 'weak') return strong.reverse();
      // fit: smallest potion that refills the gap at the trigger threshold first,
      // then the weaker ones strongest-first as fallback when stock runs out.
      const max = num(s.maxAttrs?.[attr === 'HP' ? 'hp' : 'mp']),
        threshold = attr === 'HP' ? p.potions.hpThreshold : p.potions.mpThreshold,
        gap = (max * (100 - threshold)) / 100;
      if (!(gap > 0)) return strong;
      const enough = strong.filter((t) => heal(t) >= gap).reverse(),
        short = strong.filter((t) => heal(t) < gap);
      return enough.concat(short);
    }
    function potionPick(s, p, attr, now = Date.now()) {
      const key = attr === 'HP' ? 'hp' : 'mp';
      if (p.potions.order !== 'smart' || !p.potions.autoChoose || p.potions[key + 'Priority'].length) return null;
      const candidates = potionChoices(s, attr).flatMap((template) => {
        const offer = array(s.shopItems).find((i) => num(i.itemId) === num(template.id) &&
          (i.currencyType == null || num(i.currencyType) === 1) && num(i.price) > 0);
        const heal = potionEffect(template, attr);
        return offer ? [{ template, perSecond: heal / 3, efficiency: heal / num(offer.price) }] : [];
      });
      if (!candidates.length) return null;
      const rates = s.combat, strongest = candidates[0], need = num(rates?.[attr === 'HP' ? 'hpLossPerSec' : 'mpUsePerSec']);
      const result = (c, reason) => ({ template: c.template, need, perSecond: c.perSecond, reason });
      if (!rates || rates.mapId !== s.role.mapId || rates.seconds < 120) return result(strongest, '数据不足');
      if (attr === 'HP' && ((rates.lastLowHpAt > 0 && now - rates.lastLowHpAt < 600000) ||
        (rates.lastDeathAt > 0 && now - rates.lastDeathAt < 1800000))) return result(strongest, '血量过低或刚阵亡，改用最强药');
      const best = candidates.filter((c) => c.perSecond >= 1.25 * need)
        .sort((a, b) => b.efficiency - a.efficiency || b.perSecond - a.perSecond)[0] || strongest;
      const current = candidates.find((c) => num(c.template.id) === num(parse(s.role.settings, {})[key]?.priority?.[0]));
      return result(current && current.perSecond >= 1.05 * need && current.efficiency >= best.efficiency ? current : best, '按实测消耗选择');
    }
    function potionThreshold(s, p, now = Date.now()) {
      const rates = s.combat, configured = p.potions.hpThreshold;
      if (!p.potions.autoThreshold || !rates || rates.mapId !== s.role.mapId || rates.seconds < 120) return configured;
      const hp = parse(s.role.settings, {}).hp || {}, pick = potionPick(s, p, 'HP', now);
      const template = pick?.template || array(hp.priority).map((id) => potionChoices(s, 'HP').find((t) => num(t.id) === num(id) && countItem(s, id) > 0)).find(Boolean);
      const healPct = rates.maxHp > 0 ? potionEffect(template, 'HP') / rates.maxHp * 100 : 0;
      const needed = rates.lastDeathAt > 0 && now - rates.lastDeathAt < 1800000 ? 80 : Math.ceil((2 * rates.worstLoss10Pct - 3 * healPct + 10) / 5) * 5;
      const target = Math.min(80, Math.max(10, configured, needed));
      return hp.threshold >= target && hp.threshold <= target + 10 && hp.threshold >= configured ? hp.threshold : target;
    }
    function potionSettings(s, p, now = Date.now()) {
      const make = (attr) => {
        const explicit = attr === 'HP' ? p.potions.hpPriority : p.potions.mpPriority,
          eligible = new Set(potionChoices(s, attr).map((t) => num(t.id)));
        const pick = potionPick(s, p, attr, now);
        const selected = pick ? [pick.template, ...potionChoices(s, attr)].filter((t) => countItem(s, t.id) > 0).map((t) => num(t.id)) : explicit.length
          ? explicit
          : p.potions.autoChoose
            ? potionOrder(
                potionChoices(s, attr).filter((t) => countItem(s, t.id) > 0),
                attr,
                s,
                p,
              ).map((t) => num(t.id))
            : parse(s.role.settings, {})[attr === 'HP' ? 'hp' : 'mp']?.priority || [];
        return [...new Set(selected.map((v) => num(v)).filter((v) => v > 0 && eligible.has(v)))]
          .slice(0, 6)
          .concat(Array(6).fill(0))
          .slice(0, 6);
      };
      return {
        hp: { enabled: p.potions.enabled, threshold: potionThreshold(s, p, now), priority: make('HP') },
        mp: { enabled: p.potions.enabled, threshold: p.potions.mpThreshold, priority: make('MP') },
      };
    }
    function skillCost(skill) {
      const t = skill.skillDetail || {},
        level = num(skill.currentLevel),
        grow = Math.max(0, level - 1);
      let exp = num(t.baseUpgradeExpCost) + grow * num(t.growExpCost);
      const entry = array(parse(t.expCost, [])).find((e) => num(e.skill_level) === level);
      if (entry && entry.exp != null) exp = num(entry.exp);
      return {
        exp: Math.max(0, exp),
        money: Math.max(0, num(t.baseUpgradeMoneyCost) + grow * num(t.growMoneyCost)),
      };
    }
    function freshLedger(day) {
      return {
        day,
        money: 0,
        exp: 0,
        expAccountingVersion: 2,
        levelExp: 0,
        skillExp: 0,
        smeltExp: 0,
        unclassifiedExp: 0,
        ops: {},
        arena: { attempts: 0, lost: [] },
        activities: { zl: 0, camp: 0, bear: 0 },
        welfare: { gold: 0, yuanbao: 0, bets: 0, periods: {} },
        invasion: invasionDaily(day),
        tianlingUsedAt: 0,
        petHatched: [],
        keptEquipIds: [],
      };
    }
    function normalizeLedger(value, day) {
      const source = value && typeof value === 'object' ? clone(value) : freshLedger(day),
        out = { ...freshLedger(day), ...source };
      if (source.expAccountingVersion !== 2) {
        out.levelExp = 0;
        out.skillExp = 0;
        out.smeltExp = 0;
        out.unclassifiedExp = Math.max(0, num(source.exp));
      }
      out.expAccountingVersion = 2;
      for (const key of ['money', 'exp', 'levelExp', 'skillExp', 'smeltExp', 'unclassifiedExp'])
        out[key] = Math.max(0, num(out[key]));
      out.exp = Math.max(out.exp, out.levelExp + out.skillExp + out.smeltExp + out.unclassifiedExp);
      out.ops = out.ops || {};
      out.activities = { zl: 0, camp: 0, bear: 0, ...out.activities };
      out.welfare = { gold: 0, yuanbao: 0, bets: 0, periods: {}, ...out.welfare };
      for (const key of ['gold', 'yuanbao', 'bets']) out.welfare[key] = Math.max(0, integer(out.welfare[key]));
      out.welfare.periods = Object.fromEntries(Object.entries(out.welfare.periods || {})
        .map(([key, value]) => [key, Math.max(0, integer(value))]));
      out.arena = { attempts: 0, lost: [], ...out.arena };
      out.petHatched = array(out.petHatched);
      out.keptEquipIds = array(out.keptEquipIds);
      return out;
    }
    function experienceCategory(type) {
      return (
        { LEVEL_UP: 'levelExp', UPGRADE_SKILL: 'skillExp', SMITHY_SMELT_INVEST: 'smeltExp' }[
          type
        ] || 'unclassifiedExp'
      );
    }
    function recordExperience(ledger, type, amount) {
      if (ledger.expAccountingVersion !== 2)
        Object.assign(ledger, normalizeLedger(ledger, ledger.day));
      const exp = Math.max(0, num(amount)),
        key = experienceCategory(type);
      ledger.exp = num(ledger.exp) + exp;
      ledger[key] = num(ledger[key]) + exp;
    }
    function experienceBudget(p, ledger, kind) {
      const current = ledger?.expAccountingVersion === 2,
        old = Math.max(0, num(current ? ledger.unclassifiedExp : ledger?.exp));
      const used =
        old + Math.max(0, num(current ? ledger[kind === 'smelt' ? 'smeltExp' : 'skillExp'] : 0));
      const limit = num(p.budget[kind === 'smelt' ? 'smeltExpPerDay' : 'skillExpPerDay']);
      // 0 means unlimited.
      if (limit <= 0) return { used, limit: 0, unlimited: true, remaining: Infinity };
      return { used, limit, remaining: Math.max(0, limit - used) };
    }
    function levelProgress(s, prefs, ledger) {
      if (!s?.role || !num(s.role.id)) return null;
      const p = config(prefs),
        role = s.role,
        level = num(role.level),
        currentExp = num(role.currentExp);
      const levelTmpls = s.levelTmpls instanceof Map
          ? [...s.levelTmpls.values()] : Object.values(s.levelTmpls || {}),
        tmpl = lookup(s.levelTmpls, level) || levelTmpls.find((t) => num(t.level) === level),
        requiredExp = num(tmpl?.upgradeExp);
      const availableExp = Math.max(0, currentExp - p.budget.expReserve);
      const result = {
        currentLevel: level,
        nextLevel: level + 1,
        currentExp,
        requiredExp,
        availableExp,
        dailyLimit: false,
      };
      const done = (code, reason, ready = false) => ({ ...result, code, reason, ready }),
        fmt = (n) => num(n).toLocaleString('zh-CN');
      if (!p.growth.level) return done('disabled', '自动升级人物已关闭');
      if (level >= p.growth.maxLevel)
        return done('target', '人物已达到目标 ' + fmt(p.growth.maxLevel) + ' 级');
      if (tmpl && !levelTmpls.some((t) => num(t.level) > level))
        return done('cap', '人物已达服务器当前最高等级 ' + fmt(level) + ' 级');
      if (requiredExp <= 0) return done('template', '等待当前等级的升级经验数据');
      if (availableExp < requiredExp)
        return currentExp >= requiredExp
          ? done(
              'exp-reserve',
              '升级需 ' + fmt(requiredExp) + ' 经验；扣除保留经验后可用 ' + fmt(availableExp),
            )
          : done('exp', '升级需 ' + fmt(requiredExp) + ' 经验；当前持有 ' + fmt(currentExp));
      return done(
        'ready',
        '升 ' + fmt(level + 1) + ' 级需 ' + fmt(requiredExp) + ' 经验，升级条件已满足',
        true,
      );
    }
    function budgetBlock(a, s, p, ledger) {
      const money = Math.max(0, num(a.moneyCost)),
        exp = Math.max(0, num(a.expCost)),
        fmt = (n) => Math.floor(num(n)).toLocaleString('zh-CN');
      if (money > 0) {
        const spare = Math.max(0, num(s.role.money) - p.budget.moneyReserve);
        if (money > spare)
          return {
            code: 'money-reserve',
            reason: '需 ' + fmt(money) + ' 金币；扣除保留金币后可用 ' + fmt(spare),
          };
        const left =
          p.budget.moneyPerDay > 0 ? Math.max(0, p.budget.moneyPerDay - num(ledger.money)) : Infinity;
        if (money > left)
          return {
            code: 'money-daily',
            reason: '需 ' + fmt(money) + ' 金币；今日金币预算仅剩 ' + fmt(left),
          };
      }
      if (a.type === 'PET_COMMAND' && a.payload.action === 'feed')
        return num(s.role.currentExp) - exp >= p.pets.feedKeepExp ? null :
          { code: 'exp', reason: '喂养后经验不足保留额度' };
      if (a.type === 'TRIAL_COMMAND' && a.payload.action === 'feed')
        return num(s.role.currentExp) - exp >= p.hidden.keepExp ? null :
          { code: 'exp', reason: '喂养后经验不足保留额度' };
      if (exp > 0) {
        const spare = Math.max(0, num(s.role.currentExp) - p.budget.expReserve);
        if (exp > spare)
          return {
            code: 'exp',
            reason: '需 ' + fmt(exp) + ' 经验；当前可用 ' + fmt(spare),
          };
        if (a.type !== 'LEVEL_UP') {
          const key = experienceCategory(a.type),
            kinds =
              key === 'skillExp' ? ['skill'] : key === 'smeltExp' ? ['smelt'] : ['skill', 'smelt'];
          for (const kind of kinds) {
            const left = experienceBudget(p, ledger, kind).remaining;
            if (exp > left)
              return {
                code: kind + '-daily',
                reason:
                  '需 ' +
                  fmt(exp) +
                  ' 经验；今日' +
                  (kind === 'smelt' ? '冶炼' : '技能') +
                  '经验额度仅剩 ' +
                  fmt(left),
              };
          }
        }
      }
      return null;
    }
    function allowed(a, s, p, ledger) {
      if (a.readOnly) return true;
      if (budgetBlock(a, s, p, ledger)) return false;
      const cap = {
        sell: p.sell.maxPerDay,
        gem: p.gems.maxPerDay,
        smithy: p.smithy.maxPerDay,
        craft: p.craft.maxPerDay,
      }[a.family];
      // 0 means unlimited.
      return cap == null || cap <= 0 || num(ledger.ops[a.family]) < cap;
    }
    function skillCandidates(s, p) {
      const level = num(s.role?.level);
      return array(s.skills)
        .filter(
          (sk) =>
            sk.skillDetail &&
            level >= num(sk.skillDetail.unlockLevel) &&
            num(sk.currentLevel) < Math.min(num(sk.skillDetail.maxLevel), p.growth.maxSkillLevel),
        )
        .sort((a, b) => {
          const ai = p.growth.skillPriority.indexOf(num(a.skillDetail.id)),
            bi = p.growth.skillPriority.indexOf(num(b.skillDetail.id));
          return (
            (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) ||
            num(a.currentLevel) - num(b.currentLevel) ||
            skillCost(a).exp - skillCost(b).exp
          );
        });
    }
    function skillAction(sk) {
      const cost = skillCost(sk);
      return action(
        'UPGRADE_SKILL',
        { roleSkillId: num(sk.id) },
        '升级技能「' + sk.skillDetail.name + '」',
        'growth',
        { moneyCost: cost.money, expCost: cost.expCost || cost.exp, inBattle: true },
      );
    }
    function skillProgress(s, prefs, ledger) {
      if (!s?.role || !num(s.role.id) || !ledger) return null;
      const p = config(prefs);
      const done = (code, reason, ready = false, skill = null) => ({ code, reason, ready, skill });
      if (!p.growth.skills) return done('disabled', '自动升级技能已关闭');
      if (!array(s.skills).length) return done('data', '等待技能数据');
      const list = skillCandidates(s, p);
      if (!list.length)
        return done(
          'target',
          '已解锁技能均达上限（目标 ' + p.growth.maxSkillLevel + ' 级），或尚未到解锁等级',
        );
      for (const sk of list)
        if (!budgetBlock(skillAction(sk), s, p, ledger)) {
          const c = skillCost(sk);
          return done(
            'ready',
            '技能「' +
              sk.skillDetail.name +
              '」Lv.' +
              num(sk.currentLevel) +
              ' 可升级（' +
              num(c.exp).toLocaleString('zh-CN') +
              ' 经验 · ' +
              num(c.money).toLocaleString('zh-CN') +
              ' 金币）',
            true,
            num(sk.id),
          );
        }
      const top = list[0],
        block = budgetBlock(skillAction(top), s, p, ledger);
      return done(
        block.code,
        '技能「' + top.skillDetail.name + '」Lv.' + num(top.currentLevel) + ' 暂不能升级：' + block.reason,
      );
    }
    function action(type, payload, label, family, options = {}) {
      return {
        kind: 'request',
        type,
        payload,
        label,
        family,
        moneyCost: 0,
        expCost: 0,
        readOnly: false,
        requiresTown: false,
        ...options,
        key: type + ':' + JSON.stringify(payload),
      };
    }
    function petScreenable(entry, state) {
      const pet = entry?.pet;
      return !!pet && pet.status === 'OWNED' && pet.form === 'BABY' &&
        pet.level === 1 && pet.rootRank === 0 && pet.learned === 0 &&
        !pet.locked && pet.id !== state.activePetId && Number.isFinite(entry.average);
    }
    function breedable(entry, state) {
      const pet = entry?.pet;
      return !!pet?.id && !!state && pet.id !== state.activePetId && pet.form === 'BABY' &&
        pet.level >= 30 && !pet.breedingUsed && !!pet.appraised && (pet.status === 'WAITING' ||
          (pet.status === 'OWNED' && array(state.pets).length + num(state.reserved) < state.capacity));
    }
    function petServerNow(state, now) {
      return state?.serverTime + (now - state?.at);
    }
    function breedingReady(entry, state, now) {
      return entry?.pet?.status === 'BREEDING' && Number.isFinite(entry.pair?.readyAt) &&
        entry.pair.readyAt <= petServerNow(state, now);
    }
    function breedingPick(listings, minAverage) {
      if (!Number.isFinite(minAverage)) return null;
      return array(listings).filter((l) => l?.compatible === true && Array.isArray(l.failures) &&
        !l.failures.length && Number.isFinite(l.pet?.average) && l.pet.average >= minAverage)
        .sort((a, b) => b.pet.average - a.pet.average || a.createdAt - b.createdAt)[0] || null;
    }
    function breedingStatus(state, now) {
      const entries = array(state?.pets);
      return { breedable: entries.filter((e) => breedable(e, state)).length, serverNow: petServerNow(state, now),
        breeding: entries.filter((e) => ['WAITING', 'BREEDING'].includes(e.pet.status)).map((e) => {
          const pair = e.pair, snapshots = [pair?.petSnapshotA, pair?.petSnapshotB];
          const partner = snapshots.find((pet) => pet?.id && pet.id !== e.pet.id);
          return { name: e.pet.name, status: breedingReady(e, state, now) ? 'READY' : e.pet.status,
            readyAt: pair?.readyAt ?? null, partner: partner?.name || null };
        }) };
    }
    function hallPage(hall, now, minutes) {
      if (!Number.isFinite(hall?.at) || now - hall.at > minutes * 60000) return 1;
      return hall.hasMore && hall.pages < 5 ? hall.pages + 1 : 0;
    }
    function breedingWrite(name, pet, extra, label, success) {
      const a = action('PET_COMMAND', { action: name, petId: pet.id, ...extra }, '珍兽：' + label, 'pet',
        { requiresTown: true, npc: NPC.petKeeper, responseType: 'PET_RESPONSE', breedSuccess: '珍兽繁殖：' + success });
      a.key = 'PET_COMMAND:' + name + ':' + pet.id;
      return a;
    }
    function breedingMatch(pet, listing) {
      const pair = '「' + pet.name + '」与 ' + listing.ownerName + ' 的「' + listing.pet.name + '」';
      return breedingWrite('startBreeding', pet, { listingId: listing.id, revision: listing.revision },
        pair + '繁殖（平均资质 ' + listing.pet.average.toFixed(2) + '%）', pair + '开始繁殖，1 小时后领取');
    }
    function breedingPublish(pet, minAverage) {
      return breedingWrite('publishBreeding', pet, { conditions: { minQuality: '不限', minAverage,
        minRoot: 0, minPercent: {} }, revision: null }, '发布「' + pet.name + '」繁殖（要求平均资质 ≥ ' +
        minAverage + '%）', '已发布「' + pet.name + '」');
    }
    function breedingRead(pet, page) {
      return action('PET_COMMAND', { action: 'breedingList', petId: pet.id, page, species: pet.species,
        sex: pet.sex === 'MALE' ? 'FEMALE' : 'MALE', minQuality: '不限', onlyCompatible: true },
      '珍兽：查询「' + pet.name + '」的繁殖对象', 'pet', { readOnly: true, inBattle: true, responseType: 'PET_RESPONSE' });
    }
    function breedingPlans(s, prefs, now) {
      const p = prefs.pets, state = s.pets, reads = [];
      if ((!p.breedClaim && !p.breed) || arenaRush(prefs, now) || s.rings?.run ||
          FARM_MAP_EXCLUDED_IDS.includes(num(s.role.mapId))) return reads;
      const entries = array(state.pets), ready = p.breedClaim && entries.find((e) => breedingReady(e, state, now));
      const claim = ready && breedingWrite('claim', ready.pet, {}, '领取「' + ready.pet.name + '」和二代宝宝',
        '已领取「' + ready.pet.name + '」和二代宝宝');
      if (!p.breed) return claim ? [claim] : [];
      let start, publish;
      for (const entry of entries.filter((e) => breedable(e, state))) {
        const pet = entry.pet, hall = s.petHall?.[pet.id], page = hallPage(hall, now, p.refreshMinutes);
        if (page) {
          reads.push(breedingRead(pet, page));
          continue;
        }
        const pick = breedingPick(hall.listings, p.breedMinAverage);
        if (pick?.id && pick.revision != null) start ||= breedingMatch(pet, pick);
        if (!pick && p.breedPublish && pet.status === 'OWNED')
          publish ||= breedingPublish(pet, p.breedMinAverage);
      }
      const write = claim || start || publish;
      return write ? [...reads, write] : reads;
    }
    function petEggs(s) {
      return array(s.bagItems).filter((item) => num(item.count) > 0 &&
        String(item.itemTmpl?.useEffect || '').includes('HATCH_PET'));
    }
    // The game day ends at 00:00 UTC+8: ranks settle and the daily counts restart.
    const dayLeft = (now) => 86400000 - (now + 28800000) % 86400000;
    function arenaRush(prefs, now = Date.now()) {
      const left = dayLeft(now);
      const arena = prefs?.arena;
      return !!(arena && arena.enabled && arena.challenge && arena.rushMinutes > 0 &&
        left <= arena.rushMinutes * 60000);
    }
    function welfareNumbers(text) {
      const values = (String(text ?? '').normalize('NFKC').match(/[+-]?\d+/g) || []).map(Number);
      return values.length === 3 && new Set(values).size === 3 &&
        values.every((n) => Number.isInteger(n) && n >= 1 && n <= 25)
        ? values.sort((a, b) => a - b) : null;
    }
    function randomNumbers(rand) {
      const pick = (size) => {
        if (rand) return Math.floor(rand() * size);
        if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * size);
        // Rejection sampling gives each remaining number the same probability.
        const limit = 4294967296 - 4294967296 % size, value = new Uint32Array(1);
        do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
        return value[0] % size;
      };
      const pool = Array.from({ length: 25 }, (_, i) => i + 1), numbers = [];
      for (let i = 0; i < 3; i++) numbers.push(pool.splice(pick(pool.length), 1)[0]);
      return numbers.sort((a, b) => a - b);
    }
    function welfareStatus(s, p, ledger, now = Date.now()) {
      const w = p.welfare, state = s?.welfare,
        cost = (w.currency === 'GOLD' ? 100000 : 100) * w.multiplier,
        serverNow = state ? num(state.serverTime) + now - num(state.at) : 0;
      const result = { cost, serverNow, read: false, ready: false, reason: '' };
      const blocked = (reason) => ({ ...result, reason });
      if (!w.enabled) return blocked('自动投注已关闭');
      if (!townFor(s || {}, NPC.lottery)) return blocked('没有可前往的苏州快活叁');
      if (arenaRush(p, now)) return blocked('比武冲榜期间暂停投注');
      if (!state || now - state.at > 600000 || serverNow >= state.drawAt)
        return { ...result, read: true, reason: '等待读取期次' };
      if (typeof state.rulesVersion !== 'string' || !state.rulesVersion.trim())
        return blocked('未读到福彩规则版本');
      if (!state.accepting) return blocked('本期停止接受投注');
      if (!(serverNow < state.closeAt - 30000)) return blocked('距封盘不足 30 秒，等待下期');
      if (num(ledger?.welfare?.periods?.[state.period]) >= w.betsPerDraw) return blocked('本期投注注数已达上限');
      if (w.dailyCost > 0 && num(ledger?.welfare?.[w.currency === 'GOLD' ? 'gold' : 'yuanbao']) + cost > w.dailyCost)
        return blocked('今日' + (w.currency === 'GOLD' ? '金币' : '元宝') + '投注额度不足');
      if (w.currency === 'GOLD' && num(s.role?.money) - cost < p.budget.moneyReserve)
        return blocked('金币不足（需保留 ' + p.budget.moneyReserve.toLocaleString('zh-CN') + '）');
      if (w.currency === 'YUANBAO' && num(s.role?.yuanbao) < cost) return blocked('元宝不足');
      return { ...result, ready: true };
    }
    function plans(s, prefs, ledger, now = Date.now()) {
      const p = config(prefs), name = s?.gearProfile?.worn;
      const view = profileView(s, p, ASSAULT_IDS.includes(name) && assaultAvailable(s, p, name) ? name : 'farm');
      return withScoringPass(view.state, () => plansFrom(view.state, view.prefs, ledger, now, s, p));
    }
    function plansFrom(s, p, ledger, now, farmState, farmPrefs) {
      const out = [], materials = !ASSAULT_IDS.includes(s?.gearProfile?.worn);
      if (!s?.role || !num(s.role.id)) return out;
      const add = (a) => {
        if (allowed(a, s, p, ledger) && materialCheck(a, s, p).ok) {
          out.push(a);
          return true;
        }
        return false;
      };
      const role = s.role,
        equipped = array(s.equipments).filter((e) => !!e.isEquipped);
      const ringsDaily = ledger.rings?.day === s.rings?.day ? ledger.rings : null;
      const ring = ringsPlan(s, p, ringsDaily, now);
      if (p.rings?.enabled && num(role.level) >= 56 && s.rings?.run) return ring ? [ring] : [];
      const protection = loadoutProtection(s), pending = array(s.gearProfile?.pending);
      const rejected = new Set(materials ? gearRejected(s.gearRejected, now).map((e) => e.id) : []),
        protectedGear = new Set([...rejected, s.gearCheck?.oldItemId, ...protection.keys()]);
      if (!profileLocked(s) && !pending.length && s.gearCheck?.verdict?.state === 'worse') {
        const rollback = gearCheckRollback(s.gearCheck, s);
        if (rollback) add(rollback);
      }
      const fields = array(s.maps).filter(fieldMap);
      const missing = p.gear.assault.enabled && p.gear.scoring === 'combat' ? ringsMaps(s).flatMap(ringRefs)
        .filter((r) => !s.monsterTemplates?.has?.(r.category + ':' + r.id)) : [];
      if (p.gear.scoring === 'combat' && (fields.length || missing.length) &&
          // A monster the server does not return must not cause a request on every tick.
          (now - num(s.monsterTemplatesAt) > 86400000 || (now - num(s.monsterTemplatesAt) > 1800000 && (missing.length || fields.some((m) =>
            monsters(m).some((v) => !s.monsterTemplates?.has('MONSTER:' + v.monsterId))))))) {
        const ids = [...new Set(fields.flatMap((m) => monsters(m).map((v) => v.monsterId)))];
        const refs = ids.map((id) => ({ id, category: 'MONSTER' }));
        for (const { id, category } of missing)
          if (!refs.some((r) => r.id === id && r.category === category)) refs.push({ id, category });
        add(action('GET_MONSTER_TMPL', { refs },
          '读取怪物属性', 'read', { readOnly: true }));
      }
      if ((p.potions.enabled || p.gear.scoring === 'combat' && p.gear.autoDefense) && !array(s.potionTemplates).length)
        add(action('GET_POTION_LIST', {}, '获取药品目录', 'read', { readOnly: true }));
      if (p.potions.enabled) {
        const setting = potionSettings(s, p, now);
        const current = parse(role.settings, null);
        if (
          !current || typeof current !== 'object' || Array.isArray(current) ||
          !['hp', 'mp'].every((k) => {
            const a = current[k], b = setting[k];
            return a && typeof a === 'object' && !Array.isArray(a) &&
              a.enabled === b.enabled && a.threshold === b.threshold &&
              Array.isArray(a.priority) && a.priority.length === b.priority.length &&
              b.priority.every((v, i) => a.priority[i] === v);
          })
        )
          add(
            action(
              'UPDATE_SETTINGS',
              { settings: JSON.stringify(setting) },
              '配置内置自动回复',
              'settings',
              { noResponse: true, setting },
            ),
          );
      }
      const welfare = welfareStatus(s, p, ledger, now);
      if (welfare.read)
        add(action('WELFARE_LOTTERY_COMMAND', { action: 'open', page: 0 }, '查询快活叁福彩期次', 'read', {
          readOnly: true, responseType: 'WELFARE_LOTTERY_RESPONSE',
        }));
      else if (welfare.ready) {
        const numbers = (p.welfare.pick === 'fixed' && welfareNumbers(p.welfare.numbers)) || randomNumbers();
        const bet = action('WELFARE_LOTTERY_COMMAND', { action: 'bet', rulesVersion: s.welfare.rulesVersion, drawAt: s.welfare.drawAt,
          numbers, currency: p.welfare.currency, multiplier: p.welfare.multiplier },
          '快活叁福彩投注（第 ' + s.welfare.period + ' 期 · ' + numbers.join('、') + ' · ' + p.welfare.multiplier + '倍）',
          'activity', { requiresTown: true, npc: NPC.lottery, responseType: 'WELFARE_LOTTERY_RESPONSE',
            welfarePeriod: s.welfare.period });
        bet.key = 'WELFARE_LOTTERY_COMMAND:bet';
        add(bet);
      }
      if (p.activities.enabled) {
        const state = s.activityStatus || {},
          doubleExp = parse(role.settings, null)?.doubleExp;
        // An unread rings status counts as open: the query is on its way.
        const ringsFirst = p.rings?.enabled && num(role.level) >= 56 && (!Number.isFinite(s.rings?.at) ||
          (num(s.rings.townId) > 0 && ringsStatus(s, p, ringsDaily, now).open));
        let holdDungeons = false;
        // doubleExp.lastClaim is the date of the last claim; once it is today nothing is asked.
        if (p.activities.tianlingClaim && doubleExp?.lastClaim !== ledger.day) {
          if (!state.wushuang)
            add(action('WUSHUANG_STATUS', {}, '查询天灵丹领取状态', 'read', { readOnly: true }));
          else if (!state.wushuang.claimedToday)
            add(action('WUSHUANG_CLAIM', {}, '领取今日天灵丹', 'activity', {
              requiresTown: true,
              npc: NPC.wushuang,
            }));
        }
        if (p.activities.tianlingUse && p.battle.enabled &&
            num(doubleExp?.buffExpireTime) <= now &&
            now - num(ledger.tianlingUsedAt) >= 7200000) {
          const stacks = array(s.bagItems).filter((item) => materialId(item) === 51003 && bagUsable(s, item));
          const pill = stacks.find((item) => !!item.isBound) || stacks[0];
          // Order of a day: the rings (no experience), then the pill, then the dungeons under the buff.
          // Near the end of the day the dungeons no longer wait, so that none of them is lost.
          if (pill && ringsFirst) holdDungeons = dayLeft(now) > 10800000;
          else if (pill)
            add(action('USE_ITEM', { bagItemId: pill.id, count: 1 },
              '使用天灵丹（双倍经验 2 小时）', 'activity', { doubleExp: true }));
        }
        if (p.activities.lotteryDraw && townFor(s, NPC.lottery)) {
          if (!s.lottery || now - s.lottery.at > 600000)
            add(action('ONLINE_LOTTERY_COMMAND', { action: 'open', page: 0 }, '查询在线抽奖次数', 'read', {
              readOnly: true, responseType: 'ONLINE_LOTTERY_RESPONSE',
            }));
          // One chance arrives per 30 minutes online and a draw needs a town trip, so chances
          // are drawn in batches. The game rules keep an unused balance across days.
          else if (s.lottery.enabled && num(s.lottery.balance) > 0 && !arenaRush(p, now) &&
              (num(s.lottery.balance) >= p.activities.lotteryBatch ||
                (num(s.lottery.dailyLimit) > 0 &&
                  num(s.lottery.grantedToday) >= num(s.lottery.dailyLimit)) ||
                num(role.mapId) === num(townFor(s, NPC.lottery).id)))
            add(action('ONLINE_LOTTERY_COMMAND', { action: 'draw' },
              '快活叁在线抽奖（剩余 ' + s.lottery.balance + ' 次）', 'activity', {
                requiresTown: true, npc: NPC.lottery, responseType: 'ONLINE_LOTTERY_RESPONSE',
              }));
        }
        if (
          p.activities.zl &&
          num(role.level) >= 15 &&
          num(ledger.activities.zl) < p.activities.zlRuns
        ) {
          if (!state.zl)
            add(action('ZL_STATUS', {}, '查询珍珑棋局资格', 'read', { readOnly: true }));
          else {
            if (!state.zl.claimedToday)
              add(
                action('ZL_CLAIM_TOKEN', {}, '领取珍珑棋局令牌', 'activity', {
                  requiresTown: true,
                  npc: NPC.zl,
                }),
              );
            if (num(state.zl.tokenCount) > 0 && !holdDungeons)
              add(
                action('ZL_ENTER', {}, '进入珍珑棋局', 'activity', {
                  requiresTown: true,
                  npc: NPC.zl,
                  activity: 'zl',
                }),
              );
          }
        }
        if (
          p.activities.camp &&
          num(role.level) >= 30 &&
          num(ledger.activities.camp) < p.activities.campRuns
        ) {
          if (!state.camp)
            add(action('CAMP_STATUS', {}, '查询伪宋军挑战次数', 'read', { readOnly: true }));
          else if (num(state.camp.remainingToday) > 0 && !holdDungeons)
            add(
              action('CAMP_ENTER', {}, '进入伪宋军领地', 'activity', {
                requiresTown: true,
                npc: NPC.camp,
                activity: 'camp',
              }),
            );
        }
        if (
          p.activities.bear &&
          num(role.level) >= 30 &&
          num(ledger.activities.bear) < p.activities.bearRuns &&
          countItem(s, 51002) > 0 && !holdDungeons
        )
          add(
            action('BEAR_ENTER', {}, '消耗除熊害令牌进入熊林', 'activity', {
              requiresTown: true,
              npc: NPC.camp,
              activity: 'bear',
            }),
          );
      }
      if (ring) add(ring);
      const invasion = invasionPlan(s, p, ledger, now);
      if (invasion) out.push(invasion);
      const growth = [],
        progress = levelProgress(s, p, ledger);
      if (progress?.ready)
        growth.push(
          action('LEVEL_UP', {}, '人物升级到 ' + progress.nextLevel + ' 级', 'growth', {
            expCost: progress.requiredExp,
            inBattle: true,
          }),
        );
      if (p.growth.skills) {
        for (const sk of skillCandidates(s, p)) {
          const a = skillAction(sk);
          if (allowed(a, s, p, ledger)) {
            p.growth.skillBeforeLevel ? growth.unshift(a) : growth.push(a);
            break;
          }
        }
      }
      growth.forEach(add);
      if (p.pets.enabled) {
        const state = s.pets, entries = array(state?.pets);
        const request = (name, payload = {}, options = {}) =>
          action('PET_COMMAND', { action: name, petId: '', ...payload },
            '珍兽：' + name, 'pet', { responseType: 'PET_RESPONSE', ...options });
        // Hatching diffs the pet list before and after, so it needs a list read moments ago.
        const hatchWanted = !!state && p.pets.hatch && !array(ledger.petHatched).length &&
          entries.length + num(state.reserved) < state.capacity &&
          petEggs(s).some((item) => p.pets.hatchMutant ||
            !String(item.itemTmpl.name).includes('变异'));
        if (!state || now - state.at >= p.pets.refreshMinutes * 60000 ||
            (hatchWanted && now - state.at >= 30000))
          add(request('list', {}, { readOnly: true, inBattle: true }));
        else if (![20050, 20051, 20052, 20070].includes(num(role.mapId)) &&
            !s.trial?.run && !s.arenaMatch?.active) {
          const pending = entries.find((entry) => array(ledger.petHatched).includes(entry.pet.id) &&
            petScreenable(entry, state));
          const active = entries.find((entry) => entry.pet.id === state.activePetId);
          const best = entries.filter((entry) => entry.pet.status === 'OWNED')
            .sort((a, b) => num(b.combatPower) - num(a.combatPower))[0];
          const egg = petEggs(s).find((item) => p.pets.hatchMutant ||
            !String(item.itemTmpl.name).includes('变异'));
          const cost = num(active?.nextExp) - num(active?.pet.exp);
          if (pending) {
            const keep = pending.average >= p.pets.keepMinAverage;
            add(request(keep ? 'lock' : 'release', { petId: pending.pet.id,
              ...(keep ? { locked: true } : { confirm: true }) }, {
              label: (keep ? '锁定' : '放生') + '珍兽「' + pending.pet.name +
                '」（资质均值 ' + pending.average + '）' }));
          } else if (p.pets.claim && state.pendingRewards > 0) add(request('claimRewards'));
          else if (p.pets.summon && !state.activePetId && best)
            add(request('summon', { petId: best.pet.id, active: true }));
          else if (p.pets.hatch && !array(ledger.petHatched).length && egg &&
              entries.length + num(state.reserved) < state.capacity)
            add(action('USE_ITEM', { bagItemId: egg.id, count: 1 },
              '孵化「' + egg.itemTmpl.name + '」', 'pet', { petHatch: true }));
          else {
            const breeding = breedingPlans(s, p, now);
            breeding.forEach(add);
            if (!breeding.length && p.pets.feed && active && active.pet.level < role.level && cost > 0 &&
                num(role.currentExp) - cost >= p.pets.feedKeepExp)
              add(request('feed', { petId: active.pet.id, mode: 'one' }, { expCost: cost }));
          }
        }
      }
      if (num(role.level) >= 30) {
        const arena = s.arena, board = arena?.board, trial = s.trial;
        const townSafe = ![20050, 20051, 20052, 20070].includes(num(role.mapId)) && !trial?.run;
        const arenaAction = (name, payload = {}, options = {}) =>
          action('ARENA_COMMAND', { action: name, nearby: false, page: 0, token: '',
            ...payload }, '比武：' + name, 'arena', {
            responseType: 'ARENA_RESPONSE', ...options,
          });
        if (p.arena.enabled) {
          const rush = arenaRush(p, now);
          if (!board || now - arena.at >= (rush ? 30000 : p.arena.refreshMinutes * 60000) ||
              board.date !== ledger.day) {
            // Rank-based paging is unverified in the live game.
            const page = num(board?.ownRank) > 21 ? Math.floor((board.ownRank - 2) / 20) : 0;
            add(arenaAction('list', { page }, { readOnly: true, inBattle: true }));
          } else {
            const row = array(board.rows).find((r) => r.canLike);
            if (p.arena.like && !board.liked && row)
              add(arenaAction('like', { targetId: row.roleId, date: board.date }, { inBattle: true }));
            const daily = ledger.arena || { attempts: 0, lost: [] };
            // The server accepts a claim only from the NPC dialog, with the token of `open`.
            if (townSafe && board.eligible !== false && !daily.claimFailed && p.arena.claim &&
                num(board.reward?.count) > 0 && !board.reward.claimed) {
              const ready = arena.token && now - arena.tokenAt < 60000;
              add(arenaAction(ready ? 'claim' : 'open', {
                nearby: true, ...(ready ? { token: arena.token, date: board.date } : {}),
              }, { requiresTown: true, npc: NPC.arena }));
            }
            const target = array(board.rows).filter((r) => r.canChallenge && !r.busy &&
              num(r.combatPower) <= num(s.combatPower) * p.arena.maxPowerRatio &&
              !daily.lost.includes(r.snapshotId)).sort((a, b) => a.rank - b.rank)[0];
            if (townSafe && board.eligible !== false && p.arena.challenge &&
                !s.arenaMatch?.active && target &&
                (rush || !p.arena.maxPerDay || daily.attempts < p.arena.maxPerDay)) {
              const ready = arena.token && now - arena.tokenAt < 60000;
              add(arenaAction(ready ? 'challenge' : 'open', {
                nearby: true, ...(ready ? { token: arena.token, targetId: target.roleId,
                  snapshotId: target.snapshotId } : {}),
              }, { requiresTown: true, npc: NPC.arena, arenaTarget: target }));
            }
          }
        }
        if (num(role.level) >= 50 && p.hidden.enabled) {
          const request = (name, payload = {}, options = {}) =>
            action('TRIAL_COMMAND', { action: name,
              ...(trial ? { revision: trial.revision } : {}), ...payload },
            '暗器：' + name, 'trial', { responseType: 'TRIAL_RESPONSE', ...options });
          const hiddenEquip = townSafe && !equipped.some((e) => num(template(e).slotType) === 12) &&
            array(s.equipments).find((e) => !e.isEquipped && num(template(e).slotType) === 12);
          if (hiddenEquip && !profileLocked(s) && !pending.length)
            add(action('EQUIP_ITEM', { roleEquipId: num(hiddenEquip.id) },
              '穿戴暗器「' + template(hiddenEquip).name + '」', 'trial', { inBattle: true }));
          if (!trial || !Number.isFinite(trial.at) ||
              now - trial.at >= (trial.run ? 60000 : p.hidden.refreshMinutes * 60000))
            add(request('status', {}, { readOnly: true, inBattle: true }));
          else if (townSafe && p.hidden.claim && trial.claimed === false) {
            const element = hiddenClaimElement(s, p),
              label = { ice: '冰攻', fire: '火攻', poison: '毒攻', holy: '玄攻' }[element];
            // Claim suppression survives revision and element changes.
            add({ ...request('claim', { element }, { requiresTown: true, npc: NPC.trial,
              label: '暗器：领取飞蝗石（' + label + '）' }), key: 'trial-claim' });
          } else if (townSafe && trial.weapon && !trial.run) {
            const w = trial.weapon, balances = trial.balances || {};
            const opts = { requiresTown: true, npc: NPC.trial };
            if (p.hidden.inbox && Object.keys(trial.inbox || {}).length)
              add(request('inbox', {}, opts));
            else if (p.hidden.washQuality && num(balances.jade) >= 1 && w.quality < 100)
              add(request('washQuality', {}, opts));
            else {
              const weights = gearWeights(s, p), caps = [10000, 1500, 1500, 750, 15, 100]; // game client of 2026-11-14
              const names = ['hp', 'extAtk', 'intAtk', 'precision', 'critRate', w.element + 'Atk'];
              const indices = array(w.rolls).map((roll, index) => ({ roll, index }))
                .filter((v) => v.roll < 100).sort((a, b) =>
                  num(weights[names[b.index]]) * caps[b.index] -
                  num(weights[names[a.index]]) * caps[a.index]);
              if (p.hidden.wash && num(balances.sand) >= 5 && indices.length)
                add(request('washAttribute', { index: indices[0].index }, opts));
              else {
                const cost = num(trial.nextLevelExp) - num(w.experience);
                if (p.hidden.feed && trial.level < p.hidden.maxLevel && cost > 0 &&
                    num(role.currentExp) - cost >= p.hidden.keepExp)
                  add(request('feed', { targetLevel: trial.level + 1 }, { ...opts, expCost: cost }));
              }
            }
          }
        }
      }

      // The tower profile takes its enemies from the trial status, which the hidden-weapon upkeep reads only when it is on.
      if (num(role.level) >= 50 && !p.hidden.enabled && p.gear.assault.enabled && p.gear.scoring === 'combat' &&
          !s.trial?.run && (!Number.isFinite(s.trial?.at) || now - s.trial.at >= 3600000))
        add(action('TRIAL_COMMAND', { action: 'status', ...(s.trial ? { revision: s.trial.revision } : {}) },
          '读取无相浮屠层数据', 'trial', { responseType: 'TRIAL_RESPONSE', readOnly: true, inBattle: true }));
      let gearChosenId = null;
      const warehouseSetIds = setTemplateIds(s);
      if (pending.length && !profileLocked(s)) {
        const id = num(pending[0]), bag = array(s.equipments).find((e) => num(e.id) === id),
          warehouse = p.gear.fromWarehouse && array(s.warehouseEquips).find((e) => num(e.id) === id), eq = bag || warehouse;
        if (profileWearable(eq, s, p) && !eq.isEquipped) {
          gearChosenId = id;
          add(action(bag ? 'EQUIP_ITEM' : 'WAREHOUSE_WITHDRAW', { roleEquipId: id },
            longLabel(s.gearProfile.worn) + '：' + (bag ? '穿戴' : '取出') + '「' + template(eq).name + '」',
            'gear', { inBattle: true, profileSwitch: s.gearProfile.worn }));
        }
      } else if (p.gear.enabled && !s.gearCheck && !profileLocked(s)) {
        const candidatesFrom = (items) => array(items)
          .filter(
            (e) =>
              !e.isEquipped &&
              !rejected.has(num(e.id)) &&
              e.equipTmpl &&
              num(e.equipTmpl.reqLevel) <= num(role.level) &&
              num(e.equipTmpl.slotType) > 0 &&
              (!(!e.isBound && num(e.equipTmpl.bindOnEquip) === 1) || p.gear.allowBinding),
          )
          .map((e) => ({ eq: e, gain: projectedGain(e, s, p) }))
          .filter((v) => v.gain.gain > 0 && v.gain.percent >= p.gear.minGainPercent)
          .sort((a, b) => b.gain.gain - a.gain.gain);
        const candidates = candidatesFrom(array(s.equipments)
          .filter((e) => num(template(e).slotType) !== 12));
        const warehouseCandidates = p.gear.fromWarehouse ? candidatesFrom(s.warehouseEquips) : [];
        const warehouseBest = warehouseCandidates[0];
        if (warehouseBest && (!candidates[0] || warehouseBest.gain.gain > candidates[0].gain.gain)) {
          add(
            action(
              'WAREHOUSE_WITHDRAW',
              { roleEquipId: num(warehouseBest.eq.id) },
              '从仓库取出「' + template(warehouseBest.eq).name + '」准备穿戴',
              'gear',
              { gain: warehouseBest.gain.gain, inBattle: true },
            ),
          );
        } else if (candidates[0]) {
          gearChosenId = num(candidates[0].eq.id);
          add(
            action(
              'EQUIP_ITEM',
              { roleEquipId: num(candidates[0].eq.id) },
              '穿戴「' + template(candidates[0].eq).name + '」',
              'gear',
              { gain: candidates[0].gain.gain, inBattle: true },
            ),
          );
        }
      }
      if (p.warehouse.enabled && num(s.warehouseEquipCount) < WAREHOUSE_CAPACITY) {
        const e = array(s.equipments).find(
          (e) => num(e.id) !== gearChosenId && !protectedGear.has(num(e.id)) && warehouseEligible(e, p, warehouseSetIds),
        );
        if (e)
          add(
            action(
              'WAREHOUSE_DEPOSIT',
              { roleEquipId: num(e.id) },
              '存入仓库「' + template(e).name + '」',
              'warehouse',
              { inBattle: true },
            ),
          );
      }
      if (p.sell.enabled) {
        const sellable = sellPlan(farmState, farmPrefs, ledger, now).sell;
        const batch = s.batchSell !== false, items = sellable.slice(0, 20);
        if (sellable.length >= (batch ? p.sell.batchMin : 1))
          add(
            action(
              batch ? 'SHOP_SELL_BATCH' : 'SHOP_SELL',
              batch ? { roleEquipIds: items.map(e => num(e.id)) } : { roleEquipId: num(sellable[0].id), count: 1 },
              '出售普通装备「' + sellable[0].equipTmpl.name + '」' + (batch && items.length > 1 ? '等 ' + items.length + ' 件' : ''),
              'sell',
              { inBattle: true, responseType: 'SHOP_SELL_RESPONSE' },
            ),
          );
        else {
          const material = array(s.bagItems).find(
            (i) =>
              !i.hiddenWeapon && num(i.equipTmpl?.slotType) !== 12 &&
              p.sell.materialIds.map(num).includes(num(i.itemId)) &&
              num(i.count) > 0 &&
              num(i.itemTmpl?.price) > 0,
          );
          if (material)
            add(
              action(
                'SHOP_SELL',
                { bagItemId: num(material.id), count: Math.min(integer(material.count), 99) },
                '出售指定材料「' + material.itemTmpl.name + '」',
                'sell',
                { inBattle: true },
              ),
            );
        }
      }
      if (p.shop.enabled) {
        for (const attr of ['HP', 'MP']) {
          const t = potionPick(s, p, attr, now)?.template || potionChoices(s, attr).find((t) =>
            array(s.shopItems).some(
              (i) =>
                num(i.itemId) === num(t.id) &&
                (!i.currencyType || num(i.currencyType) === 1) &&
                num(i.price) > 0,
            ),
          );
          if (!t) continue;
          const owned = countItem(s, t.id),
            restocking = ledger.restock?.[num(t.id)];
          if (owned >= p.shop.targetStock || (owned >= p.shop.minimumStock && !restocking))
            continue;
          const offer = array(s.shopItems).find(
            (i) =>
              num(i.itemId) === num(t.id) &&
              (!i.currencyType || num(i.currencyType) === 1) &&
              num(i.price) > 0,
          );
          const quantity = Math.min(
            p.shop.targetStock - countItem(s, t.id),
            p.shop.maxBatch,
            Math.floor(Math.max(0, num(role.money) - p.budget.moneyReserve) / num(offer.price)),
          );
          if (quantity > 0)
            add(
              action(
                'SHOP_BUY',
                { shopItemId: num(offer.id), count: quantity },
                '补充「' + offer.name + '」×' + quantity,
                'shop',
                {
                  moneyCost: num(offer.price) * quantity,
                  inBattle: true,
                  stockItemId: num(t.id),
                },
              ),
            );
        }
      }
      if (materials && p.gems.enabled) {
        if (p.gems.synth) {
          const grouped = new Map();
          for (const b of array(s.bagItems))
            if (gemUsable(s, b) && num(b.itemTmpl.gemLevel) < p.gems.maxLevel) {
              const group = grouped.get(materialId(b)) || [];
              group.push(b);
              grouped.set(materialId(b), group);
            }
          for (const bags of grouped.values()) {
            const t = bags[0].itemTmpl,
              level = num(t.gemLevel),
              units = bags.reduce((n, b) => n + integer(b.count), 0);
            if (units < 5) continue;
            const charm = gemCharm(s, 'synth', bags[0]);
            const rate = synthRate(level, 5, !!charm);
            if (rate < p.gems.minSynthSuccess) continue;
            const ids = [];
            for (const b of bags) {
              const use = Math.min(integer(b.count), 5 - ids.length);
              for (let n = 0; n < use; n++) ids.push(num(b.id));
            }
            if (ids.length !== 5) continue;
            const payload = { gemBagItemIds: ids };
            if (charm) payload.charmBagItemId = num(charm.id);
            if (
              add(
                action(
                  'GEM_SYNTH',
                  payload,
                  '合成「' + t.name + '」→' + (level + 1) + '级（' + rate + '%）',
                  'gem',
                  { requiresTown: true, npc: NPC.gem, gemUnits: 5 },
                ),
              )
            )
              break;
          }
        }
        if (p.gems.polish) {
          const gems = array(s.bagItems)
            .filter(
              (b) =>
                gemUsable(s, b) &&
                num(b.itemTmpl.gemLevel) <= p.gems.maxLevel &&
                ['智慧宝石', '魅力宝石'].includes(b.itemTmpl.gemType) &&
                !String(b.itemTmpl.name).startsWith('纯净'),
            )
            .sort((a, b) => num(b.itemTmpl.gemLevel) - num(a.itemTmpl.gemLevel));
          for (const gem of gems) {
            const charm = gemCharm(s, 'polish', gem);
            if (
              charm &&
              add(
                action(
                  'GEM_POLISH',
                  { gemBagItemId: num(gem.id), charmBagItemId: num(charm.id) },
                  '雕琢「' + gem.itemTmpl.name + '」',
                  'gem',
                  { requiresTown: true, npc: NPC.gem },
                ),
              )
            )
              break;
          }
        }
        for (const eq of equipped) {
          const all = slots(eq),
            types = ATTACK_SLOTS.includes(num(eq.equipTmpl?.slotType))
              ? GEM_TYPES.attack
              : DEFENSE_SLOTS.includes(num(eq.equipTmpl?.slotType))
                ? GEM_TYPES.defense
                : [];
          if (p.gems.drill && all.filter((v) => v >= 0).length < p.gems.maxHoles) {
            const material = drillMaterial(s, eq);
            if (material)
              add(
                action(
                  'GEM_DRILL',
                  { roleEquipId: num(eq.id), materialBagItemId: num(material.id) },
                  '给「' + template(eq).name + '」打孔',
                  'gem',
                  { requiresTown: true, npc: NPC.gem },
                ),
              );
          }
          const occupied = all
            .filter((v) => v > 0)
            .map((id) => gemTemplate(s, id))
            .filter(Boolean);
          const candidates = array(s.bagItems)
            .filter(
              (b) =>
                gemUsable(s, b) &&
                num(b.itemTmpl.gemLevel) <= p.gems.maxLevel &&
                types.includes(b.itemTmpl.gemType),
            );
          candidates.sort(gemScoreOrder(s, p, undefined, candidates));
          if (p.gems.inlay && all.includes(0))
            for (const gem of candidates) {
              if (occupied.some((g) => g.gemType === gem.itemTmpl.gemType)) continue;
              const inlay = gemCharm(s, 'inlay', gem);
              if (
                inlay &&
                add(
                  action(
                    'GEM_INLAY',
                    {
                      roleEquipId: num(eq.id),
                      gemBagItemId: num(gem.id),
                      charmBagItemId: num(inlay.id),
                    },
                    '为「' + template(eq).name + '」镶嵌「' + gem.itemTmpl.name + '」',
                    'gem',
                    { requiresTown: true, npc: NPC.gem },
                  ),
                )
              )
                break;
            }
          if (p.gems.replace && p.gems.inlay)
            for (let index = 0; index < all.length; index++) {
              const old = gemTemplate(s, all[index]);
              if (!old) continue;
              const oldBag = { id: 1, itemId: old.id, count: 1, itemTmpl: old },
                remove = gemCharm(s, 'remove', oldBag),
                better = candidates.find(
                  (b) =>
                    b.itemTmpl.gemType === old.gemType &&
                    num(b.itemTmpl.subType) === num(old.subType) &&
                    num(b.itemTmpl.value) > num(old.value) &&
                    gemCharm(s, 'inlay', b),
                );
              if (remove && better)
                add(
                  action(
                    'GEM_REMOVE',
                    {
                      roleEquipId: num(eq.id),
                      gemSlotIndex: index,
                      charmBagItemId: num(remove.id),
                    },
                    '摘除旧宝石，准备替换为「' + better.itemTmpl.name + '」',
                    'gem',
                    {
                      requiresTown: true,
                      npc: NPC.gem,
                      replacement: { equipId: num(eq.id), bagId: num(better.id) },
                    },
                  ),
                );
            }
        }
      }
      if (p.smithy.enabled) {
        if (materials && p.smithy.appraisal) {
          const eq = equipped
            .concat(array(s.equipments).filter((e) => !e.isEquipped))
            .find(
              (e) =>
                num(template(e).slotType) === 1 &&
                num(template(e).reqLevel) >= 50 &&
                !e.isAppraisal,
            );
          if (eq)
            add(
              action(
                'SMITHY_APPRAISAL',
                { roleEquipId: num(eq.id) },
                '鉴定武器「' + template(eq).name + '」',
                'smithy',
                { moneyCost: 10000, requiresTown: true, npc: NPC.smithy },
              ),
            );
        }
        if (materials && p.smithy.enhance)
          for (const eq of equipped) {
            const next = num(eq.enhanceLevel) + 1;
            if (next > p.smithy.targetEnhance || ENHANCE_RATE[next] < p.smithy.minEnhanceSuccess)
              continue;
            const level = num(template(eq).reqLevel),
              essence = level >= 40 ? 5051 : 5050,
              stacks = array(s.bagItems).filter(
                (b) => materialId(b) === essence && materialUsable(s, b) && materialSupports(b, '装备', level),
              ),
              material = stacks.find((b) => b.isBound) || stacks[0];
            if (material)
              add(
                action(
                  'SMITHY_ENHANCE',
                  { roleEquipId: num(eq.id), materialBagId: material.id },
                  '强化「' + template(eq).name + '」至 +' + next,
                  'smithy',
                  { requiresTown: true, npc: NPC.smithy },
                ),
              );
          }
        if (materials && p.smithy.smelt) {
          if (num(role.smeltingItemId) > 0 && num(role.smeltingTargetExp) > 0) {
            const remaining = num(role.smeltingTargetExp) - num(role.smeltingExp);
            if (remaining <= 0)
              add(
                action('SMITHY_SMELT_COMPLETE', {}, '完成神器冶炼', 'smithy', {
                  requiresTown: true,
                  npc: NPC.smithy,
                }),
              );
            else {
              const amount = Math.min(
                remaining,
                Math.max(0, num(role.currentExp) - p.budget.expReserve),
                experienceBudget(p, ledger, 'smelt').remaining,
              );
              // The server accepts the investment during battle. Each answer is a full character
              // snapshot, so exp is invested only once investChunk has accumulated.
              if (amount >= Math.min(remaining, p.smithy.investChunk))
                add(
                  action(
                    'SMITHY_SMELT_INVEST',
                    { expAmount: Math.floor(amount) },
                    '投入冶炼经验 ' + Math.floor(amount),
                    'smithy',
                    { expCost: Math.floor(amount), inBattle: true },
                  ),
                );
            }
          } else {
            const eq = array(s.equipments)
              .filter((e) => !e.hiddenWeapon && num(template(e).slotType) !== 12 &&
                (!p.warehouse.enabled || !warehouseEligible(e, p, warehouseSetIds)) &&
                !protection.has(num(e.id)) && (p.smithy.allowSmeltEquipped || !e.isEquipped))
              .find(
                (e) =>
                  num(template(e).slotType) === 1 &&
                  num(template(e).reqLevel) >= 50 &&
                  e.isAppraisal &&
                  doublePerfect(e) &&
                  !smeltProtected(e, s, ledger),
              );
            if (eq)
              add(
                action(
                  'SMITHY_SMELT_START',
                  { roleEquipId: num(eq.id) },
                  '用完美资质备用武器开始冶炼',
                  'smithy',
                  { requiresTown: true, npc: NPC.smithy },
                ),
              );
          }
        }
        if (p.smithy.repair)
          for (const section of array(s.bagItems)) {
            const id = materialId(section);
            if (!bagUsable(s, section) || id < 5032 || id > 5037) continue;
            const talisman = materialBag(s, id + 6);
            if (talisman)
              add(
                action(
                  'SMITHY_REPAIR_ARTIFACT',
                  { sectionBagId: num(section.id), talismanBagId: num(talisman.id) },
                  '修复「' + section.itemTmpl?.name + '」',
                  'smithy',
                  { requiresTown: true, npc: NPC.smithy },
                ),
              );
          }
        if (materials && p.smithy.forge)
          for (const section of array(s.bagItems)) {
            if (num(section.count) <= 0 || num(section.itemId) < 5044 || num(section.itemId) > 5049)
              continue;
            const preview = s.forgePreviews?.[num(section.id)];
            if (!preview)
              add(
                action(
                  'SMITHY_FORGE_PREVIEW',
                  { sectionBagId: num(section.id) },
                  '查询可打造神器',
                  'read',
                  { readOnly: true, requiresTown: true, npc: NPC.smithy },
                ),
              );
            else {
              const choices = array(preview)
                .map((entry) => ({
                  entry,
                  t:
                    entry.tmpl || entry.equipTmpl || lookup(s.allEquipTemplates, entry.id) || entry,
                }))
                .filter(
                  (v) =>
                    !p.smithy.artifactIds.length ||
                    p.smithy.artifactIds.map(num).includes(num(v.entry.id)),
                )
                .sort(
                  (a, b) =>
                    scoreStats(stats(b.entry.extraStats || b.t.baseStats), gearWeights(s, p)) -
                    scoreStats(stats(a.entry.extraStats || a.t.baseStats), gearWeights(s, p)),
                );
              const choice = choices[0];
              if (choice && num(choice.entry.id) > 0)
                add(
                  action(
                    'SMITHY_FORGE',
                    { sectionBagId: num(section.id), targetArtifactId: num(choice.entry.id) },
                    '打造神器「' + (choice.t.name || choice.entry.name || choice.entry.id) + '」',
                    'smithy',
                    { requiresTown: true, npc: NPC.smithy },
                  ),
                );
            }
          }
      }
      if (materials && p.craft.enabled) {
        if (p.craft.exchange) {
          const names = ['御赐精纺套', '御赐熟铜套', '御赐精钢套', '御赐黄金套', '御赐混沌套'];
          for (let index = 4; index >= 0; index--) {
            const stone = 5273 + index,
              needed = 5 + index;
            if (num(role.level) < 10 || countItem(s, stone) < needed) continue;
            const set = array(s.equipSets).find((set) => set.name === names[index]);
            if (!set) continue;
            const candidates = array(parse(set.equipTmplIds, []))
              .map((id) => lookup(s.allEquipTemplates, id))
              .filter(
                (t) =>
                  t &&
                  num(t.reqLevel) <= num(role.level) &&
                  (!p.craft.targetIds.length || p.craft.targetIds.map(num).includes(num(t.id))),
              )
              .map((t) => ({ t, gain: projectedGain({ equipTmpl: t, tmplId: num(t.id) }, s, p) }))
              .filter((v) => v.gain.gain > 0 && v.gain.percent >= p.craft.minGainPercent)
              .sort((a, b) => b.gain.gain - a.gain.gain);
            if (candidates[0])
              add(
                action(
                  'YUCI_EXCHANGE',
                  { equipTmplId: num(candidates[0].t.id) },
                  '兑换「' + candidates[0].t.name + '」',
                  'craft',
                  { requiresTown: true, npc: NPC.exchange },
                ),
              );
          }
        }
        if (p.craft.tailor) {
          const candidates = TAILOR_DEFENSE.concat(TAILOR_JEWELRY)
            .filter((id) => !p.craft.targetIds.length || p.craft.targetIds.map(num).includes(id))
            .map((id) => lookup(s.allEquipTemplates, id))
            .filter((t) => t && num(t.reqLevel) <= num(role.level))
            .map((t) => ({ t, gain: projectedGain({ equipTmpl: t, tmplId: num(t.id) }, s, p) }))
            .filter((v) => v.gain.gain > 0 && v.gain.percent >= p.craft.minGainPercent)
            .sort((a, b) => b.gain.gain - a.gain.gain);
          tailorTargets: for (const { t } of candidates) {
            const ids = tailorMaterialIds(t.id),
              materials = array(s.bagItems)
                .filter(
                  (b) =>
                    materialUsable(s, b) &&
                    ids.includes(materialId(b)) &&
                    materialSupports(b, '装备', num(t.reqLevel)),
                )
                .sort((a, b) => materialId(b) - materialId(a));
            for (const material of materials)
              if (
                add(
                  action(
                    'CRAFT_EQUIP',
                    { targetEquipTmplId: num(t.id), materialItemTmplId: materialId(material) },
                    '用材料打造「' + t.name + '」',
                    'craft',
                    { moneyCost: 50000, requiresTown: true, npc: NPC.tailor },
                  ),
                )
              )
                break tailorTargets;
          }
        }
      }
      if (ring?.payload.action === 'enter' && out.includes(ring) && out.some(gearChange) &&
          gearProfileTarget(farmState, farmPrefs, ledger, now) === 'rings')
        out.splice(out.indexOf(ring), 1);
      for (const a of out) {
        if (a.type === 'LEVEL_UP') a.key += ':level=' + num(role.level);
        else if (a.type === 'UPGRADE_SKILL')
          a.key +=
            ':level=' +
            num(s.skills.find((sk) => num(sk.id) === num(a.payload.roleSkillId))?.currentLevel);
      }
      return out;
    }
    function synthRate(level, units, charm) {
      const r = {
        1: [20, 30, 100, 100],
        2: [20, 18, 74, 99],
        3: [15, 15, 60, 85],
        4: [12.5, 12.5, 50, 75],
        5: [10, 10, 40, 65],
      }[level];
      if (!r || units < 2 || units > 5) return 0;
      const base = Math.min(r[2], r[0] + r[1] * (units - 2));
      return charm ? Math.min(r[3], base + 25) : base;
    }
    function signature(s) {
      return JSON.stringify({
        role: [
          s.role?.id,
          s.role?.level,
          s.role?.currentExp,
          s.role?.money,
          s.role?.mapId,
          s.role?.smeltingExp,
          s.role?.smeltingItemId,
          s.role?.settings,
        ],
        eq: array(s.equipments).map((e) => [
          e.id,
          e.tmplId,
          e.quality,
          e.starLevel,
          !!e.isEquipped,
          e.enhanceLevel,
          e.gemSlots,
          e.extraStats,
          e.isAppraisal,
          e.appraisalStats,
        ]),
        bag: array(s.bagItems).map((b) => [
          b.id,
          b.itemId,
          b.count,
          b.extraData,
          b.itemTmpl?.value,
        ]),
        skills: array(s.skills).map((sk) => [sk.id, sk.currentLevel]),
      });
    }
    function mapChoices(maps) {
      const regions = new Map(), hidden = [];
      for (const m of Array.isArray(maps) ? maps : []) {
        if (m.show === false) {
          hidden.push(m);
          continue;
        }
        const region = m.region || '未知区域';
        if (!regions.has(region)) regions.set(region, { level: m.reqLevel, maps: [] });
        const group = regions.get(region);
        group.level = Math.min(group.level, m.reqLevel);
        group.maps.push(m);
      }
      const ordered = [...regions.values()]
        .sort((a, b) => a.level - b.level)
        .flatMap((group) => group.maps)
        .concat(hidden);
      return [
        ['0', '按等级选择免费地图'],
        ...ordered
          .filter((m) =>
            m.mapType !== 1 &&
            array(m.costs).length === 0 &&
            array(m.monsters).length &&
            !FARM_MAP_EXCLUDED_IDS.includes(num(m.id)),
          )
          .map((m) => [m.id, `${m.region || '未知区域'} · ${m.name}（Lv.${m.reqLevel}）`]),
      ];
    }
    function fillPicks(mode, s, p, current = {}) {
      const bound = (a, b) => Number(!!b.isBound) - Number(!!a.isBound);
      const bags = array(s.bagItems).filter((b) => materialUsable(s, b)).sort(bound);
      const charms = array(s.bagItems).filter((b) => charmUsable(s, b)).sort(bound);
      const gems = array(s.bagItems).filter((b) => gemUsable(s, b)).sort(bound);
      const eqs = array(s.equipments), equipped = eqs.filter((e) => e.isEquipped)
        .sort((a, b) => num(template(a).slotType) - num(template(b).slotType));
      const id = materialId, level = (b) => num(b?.itemTmpl?.gemLevel);
      const find = (...ids) => ids.map((n) => charms.find((b) => id(b) === n)).find(Boolean);
      const result = (items, message = '没有合适的装备或材料') => {
        items = items.filter(Boolean);
        return { items, message: items.length ? '已放入 ' + items.map((b) => b.itemTmpl?.name || template(b).name || String(b.id)).join('、') : message };
      };
      if (mode === 'GEM_DRILL') {
        const eq = current.selectedEquip || equipped.filter((e) => slots(e).filter((n) => n >= 0).length < 3)
          .sort((a, b) => slots(a).filter((n) => n >= 0).length - slots(b).filter((n) => n >= 0).length)[0];
        const chosen = eq && drillMaterial({ ...s, bagItems: bags }, eq);
        const material = chosen && bags.find((b) => drillMaterial({ ...s, bagItems: [b] }, eq) && drillRange(b.itemTmpl).max === drillRange(chosen.itemTmpl).max && num(b.itemTmpl.price) === num(chosen.itemTmpl.price));
        return material ? result([eq, material]) : result([], '没有可用的打孔材料或装备');
      }
      if (mode === 'GEM_INLAY') {
        const fitting = (e) => {
          const list = gems.filter((b) => (ATTACK_SLOTS.concat(12).includes(num(template(e).slotType)) ? GEM_TYPES.attack : DEFENSE_SLOTS.includes(num(template(e).slotType)) ? GEM_TYPES.defense : []).includes(b.itemTmpl.gemType))
            .filter((b) => !slots(e).some((n) => gemTemplate(s, n)?.gemType === b.itemTmpl.gemType));
          return list.sort(gemScoreOrder(s, p, bound, list));
        };
        const eq = current.selectedEquip && slots(current.selectedEquip).includes(0) ? current.selectedEquip : equipped.find((e) => slots(e).includes(0) && fitting(e).length);
        const gem = eq && fitting(eq)[0];
        return gem ? result([eq !== current.selectedEquip && eq, gem, find(5053, 5052)]) : result([], '没有可镶嵌的宝石或空孔');
      }
      if (mode === 'GEM_SYNTH') {
        const selected = array(current.selectedSynthGems), groups = new Map();
        for (const b of gems.filter((b) => level(b) < 6)) groups.set(id(b), (groups.get(id(b)) || []).concat(b));
        const total = (group) => group.reduce((n, b) => n + num(b.count), 0);
        const group = selected.length ? groups.get(id(selected[0])) : [...groups.values()].filter((g) => total(g) >= 2)
          .sort((a, b) => Math.min(5, total(b)) - Math.min(5, total(a)) || level(a[0]) - level(b[0]) || id(a[0]) - id(b[0]))[0];
        const units = (group || []).flatMap((b) => Array(Math.max(0, Math.min(5, num(b.count) - selected.filter((v) => v.id === b.id).length))).fill(b)).slice(0, Math.max(0, 5 - selected.length));
        const gem = selected[0] || group?.[0];
        return result(units.concat(gem && !current.selectedSynthCharm ? find(level(gem) <= 4 ? 5058 : 5059) : null));
      }
      if (mode === 'GEM_REMOVE') {
        if (!current.selectedEquip) return result([], '请先放入装备并点选要摘除的宝石');
        const low = gemTemplate(s, slots(current.selectedEquip)[current.selectedRemoveGemIndex])?.gemLevel === 1;
        const remove = charms.filter((b) => b.itemTmpl.functionType === 4 || id(b) === 5069 || id(b) === 5055);
        return result([low ? remove.find((b) => id(b) !== 5055) : remove.find((b) => id(b) === 5055) || remove[0]]);
      }
      if (mode === 'GEM_POLISH') {
        const gem = gems.filter((b) => ['智慧宝石', '魅力宝石'].includes(b.itemTmpl.gemType) && !String(b.itemTmpl.name).startsWith('纯净')).sort((a, b) => level(b) - level(a))[0];
        return result(gem ? [gem, charms.find((b) => id(b) === 5060 || b.itemTmpl.functionType === 5)] : []);
      }
      if (mode === 'SMITHY_APPRAISAL') return result([eqs.filter((e) => [1, 12].includes(num(template(e).slotType)) && num(template(e).reqLevel) >= 50 && !e.isAppraisal).sort((a, b) => Number(!!b.isEquipped) - Number(!!a.isEquipped))[0]], '没有未鉴定的50级以上武器');
      if (mode === 'SMITHY_REINFORCE') return result([equipped.filter((e) => num(e.enhanceLevel) < 9 && (num(template(e).reqLevel) < 40 ? find(5050) : find(5051, 5079))).sort((a, b) => num(a.enhanceLevel) - num(b.enhanceLevel))[0]]);
      if (mode === 'SMITHY_SMELT') return result([eqs.filter((e) => !e.isEquipped && num(template(e).slotType) === 1 && num(template(e).reqLevel) >= 50 && doublePerfect(e) && !smeltProtected(e, s)).sort((a, b) => num(template(a).reqLevel) - num(template(b).reqLevel))[0]], '没有可冶炼的完美资质武器（已穿戴的不会自动放入）');
      if (mode === 'SMITHY_REPAIR') {
        const complete = (b) => num(stats(b.extraData).repairs) >= 5;
        const section = bags.filter((b) => id(b) >= 5032 && id(b) <= 5037 && (complete(b) || find(id(b) + 6))).sort((a, b) => id(b) - id(a))[0];
        return result([section, section && !complete(section) && find(id(section) + 6)]);
      }
      if (mode === 'SMITHY_FORGE') return result([bags.find((b) => id(b) >= 5044 && id(b) <= 5049)]);
      if (mode === 'TAILOR_ADD_MATERIAL') {
        const min = current.family === 'mithril' ? 5017 : 5008;
        return result([bags.filter((b) => id(b) >= min && id(b) <= min + 7).sort((a, b) => id(b) - id(a))[0]]);
      }
      return result([], '请先在窗口里选择功能页');
    }
    function slotChoices(mode, kind, s, p, current = {}) {
      const bound = (a, b) => Number(!!b.isBound) - Number(!!a.isBound);
      const worn = (a, b) => Number(!!b.isEquipped) - Number(!!a.isEquipped);
      const level = (b) => num(b.itemTmpl?.gemLevel), id = materialId;
      const bags = array(s.bagItems).filter((b) => materialUsable(s, b)).sort(bound);
      const gems = array(s.bagItems).filter((b) => gemUsable(s, b)).sort(bound);
      const eqs = array(s.equipments).toSorted((a, b) => worn(a, b) || num(template(a).slotType) - num(template(b).slotType));
      const eq = current.selectedEquip;
      if (mode === 'SMITHY_REPAIR') {
        if (kind === 'section') return bags.filter((b) => id(b) >= 5032 && id(b) <= 5037).sort((a, b) => id(b) - id(a));
        if (kind === 'charm') {
          const preferred = id(current.selectedSection) + 6;
          return array(s.bagItems).filter((b) => charmUsable(s, b) && id(b) >= 5038 && id(b) <= 5043)
            .sort((a, b) => Number(id(b) === preferred) - Number(id(a) === preferred) || id(b) - id(a) || bound(a, b));
        }
      }
      if (kind === 'equip') {
        if (mode === 'GEM_DRILL') return eqs.filter((e) => slots(e).filter((n) => n >= 0).length < 3);
        if (mode === 'GEM_INLAY') return eqs.filter((e) => slots(e).includes(0));
        if (mode === 'GEM_REMOVE') return eqs.filter((e) => slots(e).some((n) => n > 0));
      }
      if (kind === 'material' && mode === 'GEM_DRILL') return bags.filter((b) => num(b.itemTmpl.functionType) === 2 && (!eq || materialSupports(b, '装备', num(template(eq).reqLevel))));
      if (kind === 'gem' && mode === 'GEM_INLAY') {
        const list = gems.filter((b) => !eq || ((ATTACK_SLOTS.concat(12).includes(num(template(eq).slotType)) ? GEM_TYPES.attack : GEM_TYPES.defense).includes(b.itemTmpl.gemType) && !slots(eq).some((n) => gemTemplate(s, n)?.gemType === b.itemTmpl.gemType)));
        return list.sort(gemScoreOrder(s, p, bound, list));
      }
      if (kind === 'gem' && mode === 'GEM_SYNTH') {
        const total = (b) => gems.filter((v) => id(v) === id(b)).reduce((n, v) => n + num(v.count), 0);
        return gems.filter((b) => level(b) < 6).sort((a, b) => Number(total(b) >= 2) - Number(total(a) >= 2) || Math.min(5, total(b)) - Math.min(5, total(a)) || level(a) - level(b) || id(a) - id(b) || bound(a, b));
      }
      if (kind === 'gem' && mode === 'GEM_POLISH') return gems.filter((b) => ['智慧宝石', '魅力宝石'].includes(b.itemTmpl.gemType) && !String(b.itemTmpl.name).startsWith('纯净')).sort((a, b) => level(b) - level(a) || bound(a, b));
      if (kind === 'charm') {
        const fn = { GEM_INLAY: 1, GEM_SYNTH: 3, GEM_REMOVE: 4, GEM_POLISH: 5 }[mode];
        const known = { GEM_INLAY: [5053, 5052], GEM_SYNTH: [5058, 5059], GEM_REMOVE: [5055, 5069], GEM_POLISH: [5060] }[mode] || [];
        const low = eq && gemTemplate(s, slots(eq)[current.selectedRemoveGemIndex])?.gemLevel === 1;
        const preferred = mode === 'GEM_SYNTH' && level(current.selectedSynthGems?.[0] || {}) === 5 ? 5059 : known[0];
        return array(s.bagItems).filter((b) => charmUsable(s, b) && (known.includes(id(b)) || fn && num(b.itemTmpl.functionType) === fn) && !(mode === 'GEM_REMOVE' && low && id(b) === 5055))
          .sort((a, b) => Number(id(b) === preferred) - Number(id(a) === preferred) || bound(a, b));
      }
      if (kind !== 'any') return [];
      if (mode === 'SMITHY_APPRAISAL') return eqs.filter((e) => [1, 12].includes(num(template(e).slotType)) && num(template(e).reqLevel) >= 50).sort((a, b) => Number(!!a.isAppraisal) - Number(!!b.isAppraisal) || worn(a, b));
      if (mode === 'SMITHY_REINFORCE') return eqs.filter((e) => num(e.enhanceLevel) < 9).sort((a, b) => worn(a, b) || num(a.enhanceLevel) - num(b.enhanceLevel));
      if (mode === 'SMITHY_SMELT') return eqs.filter((e) => num(template(e).slotType) === 1 && num(template(e).reqLevel) >= 50 && doublePerfect(e)).sort((a, b) => -worn(a, b) || num(template(a).reqLevel) - num(template(b).reqLevel));
      if (mode === 'SMITHY_REPAIR') return bags.filter((b) => id(b) >= 5032 && id(b) <= 5043).sort((a, b) => id(b) - id(a));
      if (mode === 'SMITHY_FORGE') return bags.filter((b) => id(b) >= 5044 && id(b) <= 5049);
      if (mode === 'TAILOR_ADD_MATERIAL') return bags.filter((b) => id(b) >= 5008 && id(b) <= 5015 || id(b) >= 5017 && id(b) <= 5024).sort((a, b) => (id(b) >= 5017 ? id(b) - 5017 : id(b) - 5008) - (id(a) >= 5017 ? id(a) - 5017 : id(a) - 5008) || bound(a, b));
      return [];
    }
    return {
      logFilter, logPrune, logSize, logText, logCutoff, logSummary, logCombine, logMissing, logTime,
      fillPicks, slotChoices, charmUsable, charmCompatible,
      WAREHOUSE_CAPACITY,
      mapChoices,
      DEFAULTS,
      eventHotkey,
      WEIGHTS,
      GEM_ATTR,
      NPC,
      config,
      parse,
      num,
      integer,
      array,
      clone,
      stats,
      slots,
      lookup,
      template, equipQuality, setTemplateIds, sellPlan, gemScoreOrder, smeltProtected, MATERIAL_TYPES,
      SLOT_NAMES, SLOT_SHORT, setCollection, setOfTemplate, bagFilterMatch, equipmentTemplateId, setIndex,
      poolMaps, scoreTargets, survivalWeight, healPerSecond, scoringStatus, scoringText, SUSTAIN_LINE, LOW_HP_SHARE, HP_LINE,
      viewedState, isViewedProfile, viewedSkillsMissing, profileState, profileScoreText, profileScoreValue, tooltipContext,
      transferFile, configChanges, transferKey, transferRoleKey, transferSettings, transferSummary,
      transferKind, transferKeyRole, transferMerge, transferMergeData,
      CRIT_BASE, CRIT_RATE, CRIT_FLOOR, CRIT_DEF_OFFSET, CRIT_DEF_RATE, CRIT_DEF_DIVISOR, critMultiplier,
      CRIT_CHANCE_CAP, CRIT_MULT_CAP, critChance,
      MAIN_SOFTCAP, ELEMENT_RATE, hitDamage, setEffects, combatContext, combatParts, combatValue, combatWeights, gearWeights, statScore,
      hiddenClaimElement,
      equipmentStats,
      scoreStats,
      equipmentScore, equipmentValues, characterScore, SCORE_UNIT, CRIT_CHANCE_OFFSET, scoringDetail, SCORE_ATTRIBUTES,
      artifactUptime, artifactEffects,
      projectedGain,
      countItem,
      bagItem,
      byFunction,
      itemRange,
      drillRange,
      drillMaterial,
      bagUsable,
      materialCount,
      materialCheck,
      gemCharm,
      roleMap,
      townFor,
      RINGS_MAP_IDS, ASSAULT_PROFILES, ASSAULT_IDS, PROFILE_IDS, longLabel, mapProfile, keptFloors,
      assaultTargets, assaultWeight, assaultAvailable, profileView, gearProfileTarget,
      combatSignature, profileLabel, profileLocked, profileWearable, gearChange, RING_NAMES, ringStage, ringsStatus, ringsPlan,
      invasionPlan, invasionDaily, invasionStatus,
      farmMap,
      fieldMap,
      gearCheckStart, gearCheckAfter, gearCheckVerdict, gearCheckRestored, gearCheckRollback, gearRejected, gearCheckText,
      normalMap,
      mapRate,
      smartMap,
      statsNumber,
      doubleExpUntil,
      potionEffect,
      sortDepositPlan, bagCellItem, bagTabItems, warehouseTabItems, warehouseKeys, keysMatch, shortcutConflicts, loadoutProtection,
      potionChoices,
      potionSettings,
      potionPick,
      potionThreshold,
      potionOrder,
      skillCost,
      synthRate,
      petScreenable,
      breedable, breedingReady, breedingPick, breedingStatus,
      petEggs,
      freshLedger,
      normalizeLedger,
      recordExperience,
      experienceBudget,
      levelProgress,
      skillProgress,
      allowed,
      plans,
      arenaRush,
      welfareNumbers, randomNumbers, welfareStatus,
      signature,
      conflictNotice,
    };
  })();
  if (typeof module !== 'undefined' && module.exports) module.exports = TLPolicy;

  ('use strict');
  const TLRuntime = (() => {
    const P = TLPolicy,
      PREFIX = 'tl-autopilot-v1',
      CONFIG = PREFIX + ':config',
      RUNNING = PREFIX + ':running';
    const conflictDocuments = new WeakSet();
    function showConflictNotice(win, doc) {
      const id = 'tl-idle-helper-conflict';
      if (conflictDocuments.has(doc) || doc.getElementById(id)) return;
      const text = P.conflictNotice(win);
      if (!text) return;
      conflictDocuments.add(doc);
      win.console.warn(text);
      const show = () => {
        if (doc.getElementById(id)) return;
        const banner = doc.createElement('div');
        banner.id = id;
        banner.setAttribute('role', 'alert');
        banner.textContent = text;
        banner.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;background:#7f1d1d;color:#fff;padding:8px 14px;border-radius:6px;font:13px/1.5 sans-serif;max-width:calc(100vw - 32px);box-sizing:border-box;overflow-wrap:anywhere;cursor:pointer;';
        banner.title = '点击关闭';
        banner.onclick = () => banner.remove();
        doc.body.appendChild(banner);
      };
      if (doc.body) show();
      else doc.addEventListener('DOMContentLoaded', show, { once: true });
    }
    const ALLOWED = new Set([
      'ARENA_COMMAND', 'PET_COMMAND', 'TRIAL_COMMAND', 'RINGS_COMMAND', 'XIAOXIAO_COMMAND', 'COMBAT_START',
      'ENTER_GAME',
      'ENTER_MAP',
      'EQUIP_ITEM',
      'LEVEL_UP',
      'UPGRADE_SKILL',
      'GET_POTION_LIST',
      'GET_MONSTER_TMPL',
      'UPDATE_SETTINGS',
      'SHOP_BUY',
      'SHOP_SELL',
      'SHOP_SELL_BATCH',
      'WAREHOUSE_DEPOSIT',
      'WAREHOUSE_WITHDRAW',
      'GEM_DRILL',
      'GEM_INLAY',
      'GEM_SYNTH',
      'GEM_REMOVE',
      'GEM_POLISH',
      'SMITHY_APPRAISAL',
      'SMITHY_ENHANCE',
      'SMITHY_SMELT_START',
      'SMITHY_SMELT_INVEST',
      'SMITHY_SMELT_COMPLETE',
      'SMITHY_REPAIR_ARTIFACT',
      'SMITHY_FORGE_PREVIEW',
      'SMITHY_FORGE',
      'CRAFT_EQUIP',
      'YUCI_EXCHANGE',
      'WUSHUANG_STATUS',
      'WUSHUANG_CLAIM',
      'ZL_STATUS',
      'ZL_CLAIM_TOKEN',
      'ZL_ENTER',
      'CAMP_STATUS',
      'CAMP_ENTER',
      'BEAR_ENTER',
      'ONLINE_LOTTERY_COMMAND',
      'WELFARE_LOTTERY_COMMAND',
    ]);
    const readStorage = (key, fallback) => {
      try {
        return P.parse(localStorage.getItem(key), fallback);
      } catch {
        return fallback;
      }
    };
    let storageBlocked = false, restoringData = false;
    const writeStorage = (key, value) => {
      // While a full import runs, in-memory data and settings must not overwrite the merged keys.
      if (storageBlocked || restoringData && P.transferKey(key.slice(PREFIX.length + 1))) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    };
    function tabRoleHint() {
      try {
        const id = Number(sessionStorage.getItem(PREFIX + ':role'));
        return Number.isSafeInteger(id) && id > 0 ? id : 0;
      } catch { return 0; }
    }
    const roleTag = (controller) => controller.roleId || controller.roleHint || 0;
    const taggedKey = (name, role) => PREFIX + ':' + name + (role ? ':' + role : '');
    function readTagged(name, role, fallback) {
      const own = role ? readStorage(taggedKey(name, role), undefined) : undefined;
      return own === undefined ? readStorage(taggedKey(name, 0), fallback) : own;
    }
    // A record without a role (older versions) or with role 0 (written before the role was known) belongs to nobody:
    // every tab shows it.
    const visibleLog = (entry, role) => !role || !entry.role || entry.role === role;
    function quickLogs(role, days, loaded) {
      const logs = loaded === undefined ? readTagged('log', role, []) : readStorage(taggedKey('log', role), loaded);
      if (!Array.isArray(logs) || !logs.every((v) => v && ['time', 'level', 'text'].every((k) => typeof v[k] === 'string'))) return [];
      return P.logPrune(logs.filter((entry) => visibleLog(entry, role)).slice(0, 60), days);
    }
    function mergedLogs(lines, saved) {
      return [...P.logMissing(lines, saved), ...saved].sort((a, b) => b.at - a.at).slice(0, 500);
    }
    function roleConfig(id) {
      const value = id && readStorage(CONFIG + ':' + id, null);
      return value && typeof value === 'object' && !Array.isArray(value)
        ? P.config({ ...value, roleConfig: 'per-role' }) : null;
    }
    function saveConfig(prefs, id) {
      if (prefs.roleConfig !== 'per-role' || !id) return writeStorage(CONFIG, prefs);
      const { roleConfig, ...values } = prefs;
      writeStorage(CONFIG + ':' + id, values);
    }
    function saveConfigField(controller, group, field, value) {
      const id = controller.roleId || controller.roleHint;
      controller.prefs[group][field] = value;
      const global = P.config(readStorage(CONFIG, controller.prefs));
      const target = global.roleConfig === 'per-role' && id ? roleConfig(id) || global : global;
      target[group][field] = value;
      saveConfig(target, id);
    }
    function clearRoleConfigs() {
      if (storageBlocked) return;
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith(CONFIG + ':') && /^\d+$/.test(key.slice(CONFIG.length + 1)))
          localStorage.removeItem(key);
      }
    }
    function shouldResume(prefs, id) {
      if (!prefs.resumeAfterReload && !prefs.reconnect.autoReload) return false;
      const own = id ? readStorage(RUNNING + ':' + id, null) : null;
      return typeof own === 'boolean' ? own : readStorage(RUNNING, false) === true;
    }
    function saveRunning(controller, flag) {
      const id = controller.roleId || controller.roleHint;
      if (id) writeStorage(RUNNING + ':' + id, flag);
      writeStorage(RUNNING, flag);
    }
    const day = (d = new Date()) => {
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
    };
    const copy = (v) => {
      try {
        return JSON.parse(JSON.stringify(raw(v)));
      } catch {
        return null;
      }
    };
    const safeMessage = (value) =>
      String(value || '')
        .replace(
          /((?:password|passwd|digest|ticket|token|authorization|密码|票据|令牌|摘要)\s*[:=：])\s*[^\s,;；]+/gi,
          '$1[redacted]',
        )
        .replace(/\bBearer\s+[A-Za-z0-9_.\/+\-=]+/gi, 'Bearer [redacted]')
        .slice(0, 260);
    function createLogStore(factory = typeof indexedDB === 'undefined' ? null : indexedDB) {
      let database = null, opening = null;
      const transaction = (mode, run) => new Promise((resolve, reject) => {
        if (storageBlocked && mode === 'readwrite') return resolve();
        try {
          const tx = database.transaction('logs', mode);
          let result;
          tx.oncomplete = () => resolve(result);
          tx.onabort = tx.onerror = () => reject(tx.error || new Error('日志数据库事务失败'));
          run(tx.objectStore('logs'), (value) => { result = value; });
        } catch (error) { reject(error); }
      });
      return {
        supported: !!factory,
        open() {
          if (database) return Promise.resolve();
          if (opening) return opening;
          opening = new Promise((resolve, reject) => {
            const request = factory.open(PREFIX, 1);
            request.onupgradeneeded = () => {
              const store = request.result.createObjectStore('logs', { autoIncrement: true });
              store.createIndex('at', 'at');
            };
            request.onerror = () => reject(request.error || new Error('无法打开日志数据库'));
            request.onblocked = () => reject(new Error('数据库被其他页面占用'));
            request.onsuccess = () => {
              database = request.result;
              database.onversionchange = () => { database.close(); database = null; opening = null; };
              resolve();
            };
          }).catch((error) => { opening = null; throw error; });
          return opening;
        },
        append(entries) {
          return transaction('readwrite', (store) => { for (const entry of entries) store.add(entry); });
        },
        read(limit = Infinity, role = 0) {
          return transaction('readonly', (store, done) => {
            const entries = [], request = store.index('at').openCursor(null, 'prev');
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor || entries.length >= limit) return done(entries);
              if (visibleLog(cursor.value, role)) entries.push(cursor.value);
              cursor.continue();
            };
          });
        },
        summary() {
          return transaction('readonly', (store, done) => {
            let summary = P.logSummary([]);
            const request = store.openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return done(summary);
              summary = P.logCombine(summary, P.logSummary([cursor.value]));
              cursor.continue();
            };
          });
        },
        prune(cutoff) {
          return transaction('readwrite', (store) => {
            const request = store.index('at').openCursor(IDBKeyRange.upperBound(cutoff, true));
            request.onsuccess = () => {
              const cursor = request.result;
              if (cursor) { cursor.delete(); cursor.continue(); }
            };
          });
        },
        clear(role = 0) {
          return transaction('readwrite', (store) => {
            if (!role) return store.clear();
            const request = store.openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              if (visibleLog(cursor.value, role)) cursor.delete();
              cursor.continue();
            };
          });
        },
      };
    }
    function createKeepAwake(name) {
      let held = false, release = null;
      return {
        set(on) {
          if (on && !held && this.supported) {
            try {
              // Released as soon as it is granted if it was turned off before that.
              const { promise, resolve } = Promise.withResolvers();
              release = resolve;
              navigator.locks.request(name, { mode: 'shared' }, () => promise).catch(() => {
                held = false;
              });
              held = true;
            } catch {
              held = false;
            }
          } else if (!on && held) {
            release?.();
            held = false;
          }
          return held;
        },
        get held() {
          return held;
        },
        get supported() {
          return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
        },
      };
    }
    function createTicker(fn, onFallback) {
      let worker = null, t = 0, ms = 0, mode = 'main';
      if (typeof Worker === 'function')
        try {
          worker = new Worker(URL.createObjectURL(new Blob([
            'let t=0;onmessage=e=>{clearInterval(t);t=e.data>0?setInterval(()=>postMessage(0),e.data):0;};',
          ], { type: 'application/javascript' })));
          mode = 'worker';
          worker.onmessage = () => fn();
          worker.onerror = (e) => {
            if (mode !== 'worker') return;
            e?.preventDefault?.();
            worker.terminate();
            mode = 'main';
            if (ms > 0) t = setInterval(fn, ms);
            onFallback?.(String(e?.message || e));
          };
        } catch {}
      return {
        set(value) {
          ms = value;
          if (mode === 'worker') worker.postMessage(ms);
          else {
            clearInterval(t);
            t = setInterval(fn, ms);
          }
        },
        stop() {
          ms = 0;
          if (mode === 'worker') worker.postMessage(0);
          else clearInterval(t);
        },
        get mode() {
          return mode;
        },
      };
    }
    const raw = (v) => v?.__v_raw ?? v;
    const monotonicNow = () => typeof performance === 'undefined' ? Date.now() : performance.now();
    function createPaintScheduler(paint, { now = monotonicNow, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
      let last = -Infinity, timer = null;
      const request = (immediate = false) => {
        const time = now();
        if (immediate || time - last >= 250) {
          if (timer !== null) clearTimer(timer);
          timer = null;
          last = time;
          paint();
        } else if (timer === null) {
          timer = setTimer(() => { timer = null; request(); }, 250 - (time - last));
        }
      };
      return request;
    }
    // The raw target of a pinia setup store holds refs; `_rawValue` is the ref's raw value and reading it is not tracked.
    const storeField = (store, key) => {
      const v = raw(raw(store)?.[key]);
      return v?.__v_isRef ? raw('_rawValue' in v ? v._rawValue : store[key]) : v;
    };
    function scoringState(c, bridge, prefs = P.DEFAULTS, untracked = false, now = bridge.scoringNow?.() ?? Date.now()) {
      const field = (k) => untracked ? storeField(c, k) : c[k];
      const role = field('role');
      bridge.syncTargetRole?.(P.num(role?.id));
      const s = { role, maps: field('maps'), bagItems: field('bagItems'),
        potionTemplates: bridge.cache.potions, monsterTemplates: bridge.cache.monsterTemplates,
        lastMapId: bridge.cache.targets.mapId, aoeTargets: bridge.cache.targets.alive };
      const selected = P.scoreTargets(s, prefs, farmTargets(bridge.cache.targets, s.maps));
      const pressure = bridge.pressure?.(s.maps), heal = P.healPerSecond(s),
        survival = P.survivalWeight(pressure, heal), held = bridge.scoringHold;
      if (!held || now - held.at >= 60000 || held.mapId !== s.lastMapId ||
          (held.survival === null) !== (survival === null))
        bridge.scoringHold = { at: now, mapId: s.lastMapId, survival, aoeTargets: s.aoeTargets };
      const profileStats = {};
      if (!untracked && prefs.gear.assault?.enabled && prefs.gear.scoring === 'combat') {
        for (const id of P.ASSAULT_IDS) profileStats[id] = { alive: bridge.cache.profileTargets?.[id]?.alive ?? 1 };
      }
      if (profileStats.rings && P.assaultAvailable(s, prefs, 'rings')) {
        const result = bridge.cache.rings?.rings?.lastSettlement, failed = !!result && result.reason !== '通关';
        const pressure = bridge.profilePressure?.('rings'), lost = failed || P.num(pressure?.deaths) > 0;
        const hold = bridge.ringsHold;
        if (!hold || hold.role !== s.role?.id || now - hold.at >= 60000 || hold.lost !== lost)
          bridge.ringsHold = { at: now, role: s.role?.id, lost, survival: P.assaultWeight(pressure, heal, failed),
            alive: bridge.cache.profileTargets?.rings?.alive ?? 1 };
        profileStats.rings = bridge.ringsHold;
      }
      return { ...(untracked ? {} : { profileStats }), aoeTargets: bridge.scoringHold.aoeTargets, monsters: selected.list, scoreTargets: { source: selected.source, mapIds: selected.mapIds },
        monsterTemplates: s.monsterTemplates, monsterTemplatesAt: bridge.cache.monsterTemplatesAt,
        survivalReason: !heal ? 'potions' : pressure?.battle < 1800000 ? 'data' : undefined,
        survival: bridge.scoringHold.survival };
    }
    function farmTargets(targets, maps) {
      return P.farmMap(P.array(maps).find((map) => P.num(map.id) === P.num(targets?.mapId)))
        ? Array.from(targets?.list?.values() || []) : [];
    }
    function mergeTargets(targets, mapId, slots, allowed = true) {
      if (!allowed) return false;
      // A packet without monsters (town, idle) must not wipe the last fought map's data.
      const found = slots.filter((slot) => slot && ['MONSTER', 'LEADER', 'BOSS'].includes(slot.category) &&
        slot.base && typeof slot.base === 'object');
      if (!found.length) return false;
      let changed = targets.mapId !== mapId;
      if (changed) { targets.list.clear(); targets.mapId = mapId; }
      for (const slot of found) {
        const key = slot.category + ':' + (slot.templateId ?? slot.name) + ':' + slot.level;
        if (targets.list.has(key)) continue;
        const base = Object.fromEntries(Object.keys(P.WEIGHTS).map((k) => [k, P.num(slot.base[k])]));
        targets.list.set(key, { category: slot.category, level: P.num(slot.level), base });
        if (targets.list.size > 30) targets.list.delete(targets.list.keys().next().value);
        changed = true;
      }
      return changed;
    }
    // USE_ITEM is allowed only for pet hatching or double experience; other uses stay with the player.
    function requestAllowed(action) {
      if (action?.type === 'XIAOXIAO_COMMAND') return ['open', 'join', 'create', 'claim', 'report'].includes(action.payload?.action);
      return ALLOWED.has(action?.type) || (action?.type === 'USE_ITEM' && (action.petHatch === true || action.doubleExp === true));
    }
    const responseHasId = (action) => ['ARENA_COMMAND', 'PET_COMMAND', 'RINGS_COMMAND', 'XIAOXIAO_COMMAND', 'ONLINE_LOTTERY_COMMAND', 'WELFARE_LOTTERY_COMMAND'].includes(action.type) || action.petHatch;
    const responseType = (action) => action.responseType || action.type + '_RESPONSE';
    const responseKey = (action) => JSON.stringify([responseType(action),
      responseHasId(action) ? action.requestId ?? action.payload?.requestId ?? null : null]);
    const parallelQuery = (action) => action.readOnly && !action.requiresTown && action.family !== 'rings';
    function ensureRequestId(action) {
      if ((responseHasId(action) || action.type === 'TRIAL_COMMAND') && action.payload?.requestId == null)
        action.payload = { ...action.payload, requestId:
          globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
            .replace(/[xy]/g, (c) => {
              const r = Math.floor(Math.random() * 16);
              return (c === 'x' ? r : (r & 3) | 8).toString(16);
            }) };
    }
    function matchesResponse(waiter, packet) {
      if (waiter.doubleExp && (packet.success ?? packet.code === 200) &&
          !packet.data?.effects?.some((effect) => effect.type === 'DOUBLE_EXP_BUFF')) return false;
      return packet.type === waiter.responseType && (!responseHasId(waiter) ||
        packet.data?.requestId === waiter.requestId || (waiter.type === 'RINGS_COMMAND' &&
          (packet.requestId ?? packet.ringsRequestId) === waiter.requestId));
    }
    const statsFields = 'wall battle exp expBase gold sell potion hpPotions mpPotions kills deaths hpLost mpUsed low'.split(' ');
    const statsTotals = () => Object.fromEntries(statsFields.map((k) => [k, 0]));
    const statsNumber = P.statsNumber;
    const statsDuration = (ms) => {
      const m = Math.floor(ms / 60000);
      return (m >= 60 ? Math.floor(m / 60) + '小时' : '') + m % 60 + '分';
    };
    function validMapRates(saved) {
      const dictionary = v => v !== null && typeof v === 'object' && !Array.isArray(v);
      return saved?.version === 1 && dictionary(saved.hours) && dictionary(saved.blocked) &&
        Object.entries(saved.hours).every(([key, sums]) => /^\d+:[1-9]\d*$/.test(key) &&
          Array.isArray(sums) && sums.length === 9 && sums.every(Number.isFinite)) &&
        Object.entries(saved.blocked).every(([id, until]) => /^[1-9]\d*$/.test(id) && Number.isFinite(until)) &&
        (saved.death === null || Number.isSafeInteger(saved.death?.mapId) && saved.death.mapId > 0 &&
          Number.isFinite(saved.death.at));
    }
    function mapIncome(stats, hour, mapId) {
      const b = stats?.buckets?.[hour + ':' + mapId];
      return { exp: P.num(b?.expBase), net: P.num(b?.gold) + P.num(b?.sell) - P.num(b?.potion) };
    }
    class MapRates {
      constructor({ now, read, write }) {
        this.now = now;
        this.write = write;
        this.lastWrite = now();
        const saved = read();
        this.data = validMapRates(saved) ? saved : { version: 1, hours: {}, blocked: {}, death: null };
        this.prune(now());
        this.reset();
      }
      reset() {
        this.mapId = 0;
        this.previous = null;
        this.inactiveAt = null;
        this.warmup = 60000;
        this.sample = { ms: 0, exp: 0, net: 0 };
      }
      prune(now) {
        const oldest = Math.floor(now / 3600000) - 47;
        for (const key of Object.keys(this.data.hours))
          if (Number(key.split(':')[0]) < oldest) delete this.data.hours[key];
        for (const [id, until] of Object.entries(this.data.blocked))
          if (until <= now) delete this.data.blocked[id];
      }
      flush() {
        this.lastWrite = this.now();
        this.prune(this.lastWrite);
        this.write(this.data);
      }
      clear() {
        this.data = { version: 1, hours: {}, blocked: {}, death: null };
        this.reset();
        this.flush();
      }
      add(now, id, { ms, exp, net }) {
        const key = Math.floor(now / 3600000) + ':' + id;
        const sums = this.data.hours[key] ||= Array(9).fill(0);
        [1, ms, ms * ms, exp, exp * exp, exp * ms, net, net * net, net * ms]
          .forEach((value, i) => sums[i] += value);
      }
      finish(now) {
        if (this.sample.ms >= 30000) this.add(now, this.mapId, this.sample);
        this.reset();
      }
      died(now, mapId, battle) {
        this.reset();
        this.settleDeath(now);
        this.data.death = { mapId, at: now };
        // A death is a strong signal: the map rests as long as a weak map before it is tried again.
        if (battle.deathDowngrade) this.data.blocked[mapId] = now + 4 * battle.smartHours * 3600000;
      }
      settleDeath(now) {
        const death = this.data.death;
        if (!death) return;
        this.add(now, death.mapId, { ms: Math.max(0, Math.min(600000, now - death.at)), exp: 0, net: 0 });
        this.data.death = null;
      }
      collect(now, ms, exp, net) {
        const skip = Math.min(ms, this.warmup);
        this.warmup -= skip;
        if (!this.warmup) this.settleDeath(now - (ms - skip));
        let remaining = ms - skip;
        while (remaining > 0) {
          const part = Math.min(remaining, 60000 - this.sample.ms);
          this.sample.ms += part;
          this.sample.exp += exp * (part / ms);
          this.sample.net += net * (part / ms);
          remaining -= part;
          if (this.sample.ms !== 60000) continue;
          this.add(now - remaining, this.mapId, this.sample);
          this.sample = { ms: 0, exp: 0, net: 0 };
        }
      }
      active(now, ctx) {
        const hour = Math.floor(now / 3600000), income = mapIncome(ctx.stats, hour, ctx.mapId);
        const prev = this.previous;
        this.mapId = ctx.mapId;
        this.previous = { now, hour, ...income };
        this.inactiveAt = null;
        if (!prev) return;
        let exp = income.exp - prev.exp, net = income.net - prev.net;
        for (let h = Math.max(prev.hour, hour - 71); h < hour; h++) {
          const older = mapIncome(ctx.stats, h, ctx.mapId);
          exp += older.exp;
          net += older.net;
        }
        this.collect(now, Math.max(0, Math.min(now - prev.now, 5000)), exp, net);
      }
      tick(now, ctx) {
        if (this.data.death && now - this.data.death.at >= 600000) this.settleDeath(this.data.death.at + 600000);
        if (ctx.dead && this.mapId === ctx.mapId) this.reset();
        if (this.mapId !== ctx.mapId || this.inactiveAt !== null && now - this.inactiveAt > 10000)
          this.finish(now);
        if (ctx.enabled && ctx.field && ctx.stage !== 'idle' && !ctx.dead) this.active(now, ctx);
        else {
          this.inactiveAt ??= now;
          this.previous = null;
        }
        if (now - this.lastWrite < 60000) return false;
        this.flush();
        return true;
      }
    }
    class Stats {
      constructor({ now, read, write }) {
        this.now = now;
        this.write = write;
        this.buckets = {};
        this.window = [];
        this.lastTick = now();
        this.lastWrite = now();
        const saved = read();
        if ([1, 2].includes(saved?.version) && saved.buckets && typeof saved.buckets === 'object' && !Array.isArray(saved.buckets) &&
          Object.entries(saved.buckets).every(([key, b]) => key.split(':').length === 2 &&
            key.split(':').every((v) => v !== '' && Number.isInteger(Number(v))) && b && statsFields.every((k) => k === 'low' && b[k] === undefined || Number.isFinite(b[k]) && b[k] >= 0)))
          this.buckets = Object.fromEntries(Object.entries(saved.buckets).map(([k, b]) => [k, { ...b,
            battle: saved.version === 1 && b.battle > 0 && b.hpLost === 0 && b.kills === 0 ? 0 : b.battle,
            low: saved.version === 1 ? 0 : b.low ?? 0,
            potionHp: Number.isFinite(b.potionHp) && b.potionHp >= 0 ? b.potionHp : undefined }]));
        const p = saved?.pressureFrom;
        if (p && Number.isFinite(p.at) && p.at >= 0 && p.hour === Math.floor(p.at / 3600000) &&
          p.base && typeof p.base === 'object' && !Array.isArray(p.base) &&
          Object.entries(p.base).every(([key, b]) => new RegExp('^' + p.hour + ':-?\\d+$').test(key) && b &&
            'battle hpLost gold sell potion hpPotions mpPotions deaths low'.split(' ').every(k => Number.isFinite(b[k]) && b[k] >= 0))) this.pressureFrom = p;
        this.prune();
      }
      resetPressure() {
        const at = this.now(), hour = Math.floor(at / 3600000);
        const fields = 'battle hpLost gold sell potion hpPotions mpPotions deaths low potionHp'.split(' ');
        const base = Object.fromEntries(Object.entries(this.buckets).filter(([k]) => Number(k.split(':')[0]) === hour)
          .map(([k, b]) => [k, Object.fromEntries(fields.map(f => [f, b[f]]))]));
        this.pressureFrom = { at, hour, base };
        this.previous = null;
        this.flush();
      }
      prune() {
        const hour = Math.floor(this.now() / 3600000);
        for (const key of Object.keys(this.buckets))
          if (Number(key.split(':')[0]) < hour - 71) delete this.buckets[key];
      }
      pressure(isFarmMap) {
        const totals = Object.fromEntries('battle hpLost gold sell potion hpPotions mpPotions deaths low'.split(' ').map((k) => [k, 0]));
        // One pass groups the buckets by hour; the newest hours count first.
        const byHour = Map.groupBy(Object.entries(this.buckets), ([key]) => Number(key.split(':')[0]));
        let covered = 0;
        for (const hour of Array.from(byHour.keys()).sort((a, b) => b - a)) {
          if (this.pressureFrom && hour < this.pressureFrom.hour) continue;
          for (const [key, bucket] of byHour.get(hour)) {
            if (!isFarmMap(Number(key.split(':')[1]))) continue;
            const base = this.pressureFrom?.base[key];
            for (const k of Object.keys(totals)) totals[k] += Math.max(0, bucket[k] - (base?.[k] || 0));
            const lost = Math.max(0, bucket.hpLost - (base?.hpLost || 0));
            covered += bucket.potionHp === undefined ? lost
              : Math.min(lost, Math.max(0, bucket.potionHp - (base?.potionHp || 0)));
          }
          if (totals.battle >= 21600000) break;
        }
        // The part of the HP loss that potions made up (see potionLoad).
        totals.hpCovered = covered;
        return totals;
      }
      bucket(mapId) {
        this.prune();
        const key = Math.floor(this.now() / 3600000) + ':' + (mapId || 0);
        return this.buckets[key] ||= { ...statsTotals(), potionHp: 0 };
      }
      save() {
        if (this.now() - this.lastWrite >= 60000) this.flush();
      }
      flush() {
        this.prune();
        this.write(JSON.parse(JSON.stringify({ version: 2, buckets: this.buckets,
          ...(this.pressureFrom ? { pressureFrom: this.pressureFrom } : {}) })));
        this.lastWrite = this.now();
      }
      clear() {
        delete this.pressureFrom;
        this.lastLowHpAt = this.lastDeathAt = 0;
        this.buckets = {};
        this.window = [];
        this.previous = null;
        this.exp = this.money = undefined;
        this.lastTick = this.now();
        this.flush();
      }
      tick(mapId) {
        this.bucket(mapId).wall += Math.max(0, Math.min(5000, this.now() - this.lastTick));
        this.lastTick = this.now();
        this.save();
      }
      death(mapId) {
        if (mapId === this.mapId) this.lastDeathAt = this.now();
        this.bucket(mapId).deaths++;
        this.save();
      }
      record(packet, context) {
        // Some packets carry the role of another player (player info, arena snapshots).
        const d = packet.data || {}, sent = d.roleInfo?.role || d.role,
          role = sent && (sent.id == null || sent.id === context.roleId) ? sent : null;
        const b = this.bucket(context.mapId), ok = packet.success !== false && d.success !== false;
        if (packet.type === 'COMBAT_REWARD' && ok) {
          const exp = typeof role?.currentExp === 'number' && this.exp !== undefined ? Math.max(0, role.currentExp - this.exp) : 0;
          b.kills++;
          b.exp += exp;
          b.expBase += exp / (context.doubleExp ? 2 : 1);
          b.gold += (d.drops || []).filter((v) => v.name === '金币').reduce((sum, v) => sum + Number(v.count || 0), 0);
        }
        if (packet.type === 'USE_ITEM_RESPONSE' && ok) this.potions(d, context, b);
        if (packet.type === 'SHOP_SELL_RESPONSE' && ok && this.money !== undefined)
          b.sell += Math.max(0, Number(role?.money ?? this.money) - this.money);
        if (this.mapId !== context.mapId) {
          this.lastLowHpAt = this.lastDeathAt = 0;
          this.mapId = context.mapId;
          this.previous = null;
          this.window = [];
        }
        if (packet.type === 'COMBAT_STATE') this.combat(d, b);
        if (typeof role?.currentExp === 'number') {
          this.exp = role.currentExp;
          this.money = Number(role.money) || 0;
        }
        this.save();
      }
      potions(d, context, b) {
        const effects = (d.effects || []).filter((v) => v.type === 'HEAL');
        for (const effect of effects) {
          if (effect.attr === 'HP') {
            b.hpPotions++;
            // Buckets from before this figure existed stay without it: their potion heal is unknown.
            if (b.potionHp !== undefined) b.potionHp += Math.max(0, Number(effect.value) || 0);
          }
          if (effect.attr === 'MP') b.mpPotions++;
        }
        if (effects.length) b.potion += context.potionPrice((d.message || '').replace(/^使用了 /, ''));
      }
      combat(d, b) {
        const dead = d.player && (d.player.isDead || !(d.player.currentHp > 0));
        if (d.player) {
          if (dead && this.deathState?.sessionId === d.sessionId && !this.deathState.dead) this.death(this.mapId);
          this.deathState = { sessionId: d.sessionId, dead: !!dead };
        }
        if (dead) { this.previous = null; return; }
        const low = d.player?.base.hp > 0 && d.player.currentHp / d.player.base.hp < P.HP_LINE;
        if (d.stage === 'running' && low) this.lastLowHpAt = d.serverTime;
        const p = this.previous;
        this.previous = d.stage === 'running' && d.player ? d : null;
        if (!this.previous || !p || p.sessionId !== d.sessionId) return;
        const dt = Math.min(5000, d.serverTime - p.serverTime);
        if (!(dt > 0)) return;
        const hpLost = Math.max(0, p.player.currentHp - d.player.currentHp);
        const mpUsed = Math.max(0, p.player.currentMp - d.player.currentMp);
        b.battle += dt;
        if (low) b.low += dt;
        b.hpLost += hpLost;
        b.mpUsed += mpUsed;
        this.window.push({ time: d.serverTime, dt, hpLost, mpUsed, currentHp: d.player.currentHp,
          maxHp: d.player.base.hp, maxMp: d.player.base.mp });
        this.trim();
      }
      trim() {
        const end = Math.max(this.now(), this.window.at(-1)?.time || 0);
        this.window = this.window.filter((v) => v.time > end - 600000);
        return end;
      }
      rates() {
        const end = this.trim(), w = this.window, last = w.at(-1);
        const result = { mapId: 0, seconds: 0, hpLossPerSec: 0, mpUsePerSec: 0, worstLoss10Pct: 0, minHpPct: 0, maxHp: 0, maxMp: 0,
          lastLowHpAt: this.lastLowHpAt || 0, lastDeathAt: this.lastDeathAt || 0 };
        if (!last) return result;
        result.mapId = this.mapId;
        result.maxHp = last.maxHp;
        result.maxMp = last.maxMp;
        result.seconds = w.reduce((sum, v) => sum + v.dt, 0) / 1000;
        result.hpLossPerSec = w.reduce((sum, v) => sum + v.hpLost, 0) / result.seconds;
        result.mpUsePerSec = w.reduce((sum, v) => sum + v.mpUsed, 0) / result.seconds;
        let start = 0, loss = 0, worst = 0;
        for (let i = 0; i < w.length; i++) {
          loss += w[i].hpLost;
          while (w[start].time <= w[i].time - 10000) loss -= w[start++].hpLost;
          worst = Math.max(worst, loss);
        }
        result.worstLoss10Pct = last.maxHp ? worst / last.maxHp * 100 : 0;
        const recent = w.filter((v) => v.time > end - 60000 && v.maxHp > 0);
        result.minHpPct = recent.length ? Math.min(...recent.map((v) => v.currentHp / v.maxHp * 100)) : 0;
        return result;
      }
      series(hours = 24, now = this.now()) {
        const end = Math.floor(now / 3600000), count = Math.max(0, Math.floor(hours)),
          fields = 'wall battle exp expBase gold sell potion kills deaths low hpPotions mpPotions'.split(' '),
          points = Array.from({ length: count + 1 }, (_, i) => ({
            hour: end - count + i, ...Object.fromEntries(fields.map((key) => [key, 0])),
          }));
        for (const [key, bucket] of Object.entries(this.buckets)) {
          const index = Number(key.split(':')[0]) - (end - count);
          if (index >= 0 && index < points.length)
            for (const field of fields) points[index][field] += bucket[field] || 0;
        }
        return points;
      }
      summary() {
        this.prune();
        const hour = statsTotals(), previous = statsTotals(), today = statsTotals(), day24 = statsTotals(), maps = {};
        const h = Math.floor(this.now() / 3600000), date = new Date(this.now()).toDateString();
        const add = (target, b) => statsFields.forEach((k) => target[k] += b[k]);
        for (const [key, b] of Object.entries(this.buckets)) {
          const [time, mapId] = key.split(':');
          if (+time >= h - 24 && +time <= h) add(day24, b);
          if (+time === h) add(hour, b);
          if (+time === h - 1) add(previous, b);
          if (new Date(+time * 3600000).toDateString() === date) add(today, b);
          add(maps[mapId] ||= { ...statsTotals(), mapId: Number(mapId) }, b);
        }
        const recent = { ...hour };
        if (hour.wall < 600000) add(recent, previous);
        return { hour, previous, today, recent, day24, maps: Object.values(maps).filter((b) => b.battle > 0).sort((a, b) => b.battle - a.battle) };
      }
    }
    class Bridge {
      constructor(log, roleHint = 0) {
        this.noBatchSell = false;
        this.log = log;
        this.socket = null;
        this.adopted = false;
        this.sessionReady = false;
        this.waiter = null;
        this.queryWaiters = new Map();
        this.sending = false;
        this.lastMessage = 0;
        this.lastClose = 0;
        this.authFailed = false;
        this.manualUntil = 0;
        this.packetTypes = [];
        this.cache = { potions: [], activityStatus: {}, forgePreviews: {}, consignment: new Map(), consignmentVersion: 0, viewedPlayers: new Map() };
        const potions = readStorage(PREFIX + ':potions', null);
        if (Number.isFinite(potions?.at) && Array.isArray(potions.list) && potions.list.every((p) => p && typeof p === 'object' && !Array.isArray(p)))
          this.cache.potions = potions.list;
        this.cache.monsterTemplates = new Map();
        this.cache.monsterTemplatesAt = 0;
        const monsters = readStorage(PREFIX + ':monsters', null);
        if (Number.isFinite(monsters?.at) && Array.isArray(monsters.list) && monsters.list.every((e) =>
          Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' &&
          typeof e[1]?.category === 'string' && Number.isFinite(e[1]?.level) &&
          Object.keys(P.WEIGHTS).every((k) => Number.isFinite(e[1]?.base?.[k])))) {
          this.cache.monsterTemplates = new Map(monsters.list);
          this.cache.monsterTemplatesAt = monsters.at;
        }
        this.loadTargets(roleHint);
        this.onMessage = () => {};
        this.onDisconnect = () => {};
        this.installSocketHook();
      }
      syncTargetRole(role) {
        if (role && this.targetRole !== role) this.loadTargets(role, !this.targetRole);
      }
      loadTargets(role, keepUnknown = false) {
        // On first identification, the live cache already contains the legacy fallback.
        const read = (name) => keepUnknown ? readStorage(taggedKey(name, role), undefined) : readTagged(name, role, null);
        this.targetRole = role;
        this.scoringHold = this.ringsHold = null;
        this.cache.profileTargets = Object.fromEntries(P.ASSAULT_IDS.map((id) => {
          const stored = read('alive:' + id);
          if (stored === undefined && this.cache.profileTargets?.[id]) return [id, this.cache.profileTargets[id]];
          const alive = stored ?? undefined;
          return [id, { alive, aliveSaved: alive }];
        }));
        const saved = read('targets');
        if (saved === undefined && this.cache.targets) return;
        this.cache.targets = { mapId: null, list: new Map() };
        if (saved && Number.isFinite(saved.mapId) && Array.isArray(saved.list) &&
            saved.list.every((e) => Array.isArray(e) && e.length === 2 &&
              typeof e[0] === 'string' && typeof e[1]?.category === 'string' &&
              Number.isFinite(e[1]?.level) && e[1]?.base &&
              typeof e[1].base === 'object' && !Array.isArray(e[1].base)))
          this.cache.targets = { mapId: saved.mapId, list: new Map(saved.list.slice(-30)), alive: saved.alive };
      }
      requestError(waiter, code, message, receivedType = null) {
        const error = new Error(safeMessage(message));
        Object.assign(error, {
          code,
          requestType: waiter.type,
          expectedResponseType: waiter.responseType,
          receivedType,
          elapsedMs: Math.max(0, Date.now() - waiter.started),
          packetTypes: this.packetTypes.filter((p) => p.time >= waiter.started).map((p) => p.type),
          waiter,
        });
        return error;
      }
      pendingWaiters() {
        return [...(this.waiter ? [this.waiter] : []), ...(this.queryWaiters?.values() || [])];
      }
      responsePending(action) {
        if (this.manualResponse?.type === responseType(action)) return true;
        return this.pendingWaiters().some((waiter) => responseType(waiter) === responseType(action) &&
          (!responseHasId(waiter) || !responseHasId(action) || responseKey(waiter) === responseKey(action)));
      }
      hasWaiter(waiter) {
        return this.waiter === waiter || this.queryWaiters?.get(waiter.key) === waiter;
      }
      removeWaiter(waiter) {
        if (this.waiter === waiter) this.waiter = null;
        else this.queryWaiters?.delete(waiter.key);
        clearTimeout(waiter.timer);
      }
      rejectWaiter(waiter, error) {
        if (!this.hasWaiter(waiter)) return;
        this.removeWaiter(waiter);
        if (waiter.type === 'RINGS_COMMAND') this.ringsRequests?.delete(waiter.requestId);
        if (error.code === 'RESPONSE_TIMEOUT') {
          this.lateWaiters ||= new Set();
          waiter.lateUntil = Date.now() + 120000;
          this.lateWaiters.add(waiter);
          waiter.lateTimer = setTimeout(() => this.lateWaiters.delete(waiter), 120000);
        }
        waiter.reject(error);
      }
      installSocketHook() {
        if (this.socketHookInstalled) return;
        const Native = window.WebSocket;
        if (typeof Native !== 'function') throw new Error('浏览器没有 WebSocket');
        const bridge = this;
        const send = Native.prototype.send;
        Native.prototype.send = function (...args) {
          if (bridge.tryAdopt(this)) bridge.observeSend(args[0]);
          return Reflect.apply(send, this, args);
        };
        window.WebSocket = new Proxy(Native, {
          construct(target, args, newTarget) {
            const socket = Reflect.construct(target, args, newTarget);
            if (bridge.gameSocketUrl(args[0])) bridge.attach(socket);
            return socket;
          },
        });
        this.socketHookInstalled = true;
      }
      gameSocketUrl(value) {
        try {
          const url = new URL(String(value), location.href);
          return url.pathname === '/ws' && url.hostname === location.hostname && url.port === location.port;
        } catch {
          return false;
        }
      }
      tryAdopt(socket) {
        if (socket === this.socket || this.connected || socket?.readyState !== 1 || !this.gameSocketUrl(socket.url))
          return false;
        this.attach(socket, true);
        if (this.character()?.role?.id) this.enterSession();
        this.log('已接管游戏连接（脚本启动晚于游戏）');
        return true;
      }
      enterSession() {
        this.sessionReady = true;
        this.authFailed = false;
        this.cache.activityStatus = {};
        this.cache.forgePreviews = {};
        this.resetPets(this.character()?.role?.id);
        this.cache.lottery = null;
        this.cache.welfare = null;
        this.cache.welfareHistory = null;
        this.welfareRequests.clear();
        this.cache.arena = null;
        this.cache.arenaMatch = null;
        this.cache.trial = null;
        this.cache.rings = null;
        this.clearInvasion();
        this.ringsRequests.clear();
        this.ringsRequestAt.clear();
        this.ringsCombat = false;
        this.invalidateRings();
        this.cache.viewedPlayers = new Map();
      }
      resetPets(roleId) {
        this.petRole = roleId;
        this.cache.pets = null;
        this.cache.petHall = Object.create(null);
        this.petListRequired = false;
      }
      syncPetRole(roleId) {
        if (this.petRole != null && this.petRole !== roleId) this.resetPets(roleId);
        this.petRole = roleId;
        this.cache.petHall ||= Object.create(null);
      }
      recordPetResponse(packet, waiter) {
        const data = packet.data;
        this.syncPetRole(this.character()?.role?.id);
        if (waiter?.petSession && waiter.petSession !== this.cache.petHall) return;
        if (data?.state) this.cache.pets = { state: copy(data.state), at: Date.now() };
        if (!packet.success || waiter?.petSession !== this.cache.petHall) return;
        if (data.action === 'list' && data.state && waiter.petAction === 'list') this.petListRequired = false;
        if (data.action !== 'breedingList' || waiter.petAction !== data.action || waiter.page !== data.page ||
            !Array.isArray(data.listings) || typeof data.hasMore !== 'boolean') return;
        const hall = this.cache.petHall[waiter.petId], first = data.page === 1;
        if (!first && (!hall?.hasMore || data.page !== hall.pages + 1)) return;
        this.cache.petHall[waiter.petId] = { at: first ? Date.now() : hall.at, pages: data.page,
          hasMore: data.hasMore, listings: (first ? [] : hall.listings).concat(copy(data.listings)) };
      }
      clearInvasion(roleId = null) {
        this.cache.invasion = null;
        this.cache.invasionStartAt = null;
        this.cache.invasionMapId = null;
        this.invasionRoleId = roleId;
      }
      syncInvasionRole(roleId) {
        if (this.invasionRoleId !== roleId) this.clearInvasion(roleId);
      }
      observeSend(data) {
        if (typeof data === 'string') {
          try {
            const packet = JSON.parse(data);
            if (packet.type === 'RINGS_COMMAND') {
              this.ringsRequests.set(packet.payload?.requestId, packet.payload?.action);
              this.ringsRequestAt.set(packet.payload?.requestId, Date.now());
              if (packet.payload?.action !== 'status') this.invalidateRings();
            }
            if (packet.type === 'WELFARE_LOTTERY_COMMAND' && packet.payload?.requestId) {
              this.welfareRequests.set(packet.payload.requestId, { action: packet.payload.action, page: packet.payload.page });
              if (this.welfareRequests.size > 100)
                this.welfareRequests.delete(this.welfareRequests.keys().next().value);
            }
            if (
              packet.type === 'CONSIGNMENT_LIST' &&
              P.num(packet.payload?.page) === 1 &&
              !packet.payload?.myList && this.cache.consignment.size
            ) {
              this.cache.consignment.clear();
              this.cache.consignmentVersion = P.num(this.cache.consignmentVersion) + 1;
            }
            if (!this.sending && this.waiter && !this.waiter.petHatch && packet.type === this.waiter.type && !['ARENA_COMMAND', 'PET_COMMAND', 'RINGS_COMMAND', 'XIAOXIAO_COMMAND', 'WELFARE_LOTTERY_COMMAND'].includes(packet.type))
              this.waiter.interference = true;
          } catch {}
        }
      }
      attach(socket, adopted = false) {
        this.socket = socket;
        this.adopted = adopted;
        this.sessionReady = false;
        this.authFailed = false;
        this.welfareRequests = new Map();
        this.ringsRequests = new Map();
        this.ringsRequestAt = new Map();
        this.hookedSockets ||= new WeakSet();
        if (this.hookedSockets.has(socket)) return;
        this.hookedSockets.add(socket);
        const send = socket.send;
        const bridge = this;
        socket.send = function (data) {
          if (this === socket && socket !== bridge.socket) bridge.tryAdopt(socket);
          bridge.observeSend(data);
          return Reflect.apply(send, this, arguments);
        };
        socket.addEventListener('open', () => {
          if (this.socket === socket) {
            this.authFailed = false;
            this.log('连接已打开，等待游戏进入角色');
          }
        });
        socket.addEventListener('close', () => {
          if (this.socket !== socket) return;
          this.sessionReady = false;
          this.lastClose = Date.now();
          for (const waiter of this.pendingWaiters())
            this.rejectWaiter(waiter, new Error('连接中断，已发动作等待新角色快照核对'));
          this.onDisconnect();
        });
        socket.addEventListener('message', (ev) => {
          if (this.socket !== socket || typeof ev.data !== 'string') return;
          let packet;
          try {
            packet = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (typeof packet.type !== 'string') return;
          this.lastMessage = Date.now();
          const type = packet.type;
          if (type === 'COMBAT_STATE') this.syncTargetRole(P.num(this.character()?.role?.id));
          if (type === 'COMBAT_STATE' && (this.cache.rings?.rings?.run ||
              P.RINGS_MAP_IDS.includes(P.num(this.character()?.role?.mapId)))) {
            if (this.ringsCombat && packet.data?.stage !== 'running') this.invalidateRings();
            this.ringsCombat = packet.data?.stage === 'running';
          }
          const assaultMap = type === 'COMBAT_STATE' && P.mapProfile(this.character()?.role?.mapId);
          if (type === 'COMBAT_STATE' && packet.data?.stage === 'running' &&
              Array.isArray(packet.data.monsterSlots) && (assaultMap || !this.holdTargets && P.farmMap(P.array(this.character()?.maps).find(
                (map) => P.num(map.id) === P.num(this.character()?.role?.mapId))))) {
            const alive = packet.data.monsterSlots.filter((m) => m && !m.isDead && m.currentHp > 0).length;
            const targets = assaultMap ? ((this.cache.profileTargets ||= {})[assaultMap] ||= {}) : this.cache.targets;
            targets.alive = targets.alive === undefined ? alive : targets.alive + 0.02 * (alive - targets.alive);
            // Packets arrive about three times a second; store the mean only after a visible change.
            if (targets.aliveSaved === undefined || Math.abs(targets.alive - targets.aliveSaved) >= 0.25) {
              targets.aliveSaved = targets.alive;
              if (assaultMap) writeStorage(taggedKey('alive:' + assaultMap, this.targetRole), targets.alive);
              else writeStorage(taggedKey('targets', this.targetRole), { mapId: targets.mapId, list: Array.from(targets.list), alive: targets.alive });
            }
          }
          if (type === 'COMBAT_STATE' && !this.holdTargets && Array.isArray(packet.data?.monsterSlots) &&
              mergeTargets(this.cache.targets, P.num(this.character()?.role?.mapId),
                packet.data.monsterSlots, P.farmMap(P.array(this.character()?.maps).find(
                  (map) => P.num(map.id) === P.num(this.character()?.role?.mapId)))))
            writeStorage(taggedKey('targets', this.targetRole), { mapId: this.cache.targets.mapId,
              list: Array.from(this.cache.targets.list), alive: this.cache.targets.alive });
          if (
            type === 'LOGIN_FAILED' ||
            (type === 'LOGIN_RESPONSE' && packet.success === false) ||
            (type === 'RECONNECT_RESPONSE' && packet.success === false)
          ) {
            this.authFailed = true;
            this.sessionReady = false;
          }
          if (type === 'ENTER_GAME_RESPONSE' && packet.success && packet.data?.role?.id) this.enterSession();
          if (type === 'GET_PLAYER_INFO_RESPONSE' && packet.success && packet.data?.role?.id) {
            const data = packet.data, role = data.role,
              entries = this.cache.viewedPlayers || (this.cache.viewedPlayers = new Map()), id = P.num(role.id);
            entries.delete(id);
            entries.set(id, { role: { id, level: role.level, sect: role.sect, nickname: role.nickname },
              skills: copy(data.skills), equipments: copy(data.equipments), gemInfo: copy(data.gemInfo),
              equipSets: copy(data.equipSets), at: Date.now() });
            while (entries.size > 5) entries.delete(entries.keys().next().value);
          }
          if (
            type === 'CONSIGNMENT_LIST_RESPONSE' &&
            packet.success &&
            Array.isArray(packet.data?.items)
          ) {
            const market = this.cache.consignment;
            let changed = false;
            for (const item of packet.data.items)
              if (item && item.id != null) { market.set(item.id, item); changed = true; }
            while (market.size > 4000) market.delete(market.keys().next().value);
            if (changed) this.cache.consignmentVersion = P.num(this.cache.consignmentVersion) + 1;
          }
          if (type === 'GET_MONSTER_TMPL_RESPONSE' && packet.success && Array.isArray(packet.data)) {
            for (const entry of packet.data.filter((e) => e.template))
              this.cache.monsterTemplates.set(entry.category + ':' + entry.id, {
                category: entry.category, level: P.num(entry.template.level),
                base: Object.fromEntries(Object.keys(P.WEIGHTS).map((k) => [k, P.num(entry.template[k])])) });
            this.cache.monsterTemplatesAt = Date.now();
            writeStorage(PREFIX + ':monsters', { at: this.cache.monsterTemplatesAt, list: [...this.cache.monsterTemplates] });
          }
          if (type === 'GET_POTION_LIST_RESPONSE' && packet.success && Array.isArray(packet.data)) {
            this.cache.potions = copy(packet.data);
            writeStorage(PREFIX + ':potions', { at: Date.now(), list: this.cache.potions });
          }
          if (
            type === 'ZL_STATUS_RESPONSE' &&
            packet.data &&
            typeof packet.data.claimedToday !== 'undefined' &&
            typeof packet.data.tokenCount !== 'undefined'
          ) {
            this.cache.activityStatus.zl = copy(packet.data);
            (this.cache.activityStamp || (this.cache.activityStamp = {})).zl = Date.now();
          }
          if (
            type === 'CAMP_STATUS_RESPONSE' &&
            packet.data &&
            typeof packet.data.remainingToday !== 'undefined'
          ) {
            this.cache.activityStatus.camp = copy(packet.data);
            (this.cache.activityStamp || (this.cache.activityStamp = {})).camp = Date.now();
          }
          if (type === 'WUSHUANG_STATUS_RESPONSE' && packet.data &&
              typeof packet.data.claimedToday !== 'undefined') {
            this.cache.activityStatus.wushuang = copy(packet.data);
            (this.cache.activityStamp || (this.cache.activityStamp = {})).wushuang = Date.now();
          }
          const data = packet.data;
          if (type === 'XIAOXIAO_RESPONSE' && packet.success && data?.board?.page === 0) {
            this.syncInvasionRole(this.character()?.role?.id);
            this.cache.invasion = { board: copy(data.board), at: Date.now() };
            this.cache.invasionMapId = P.num(this.character()?.role?.mapId);
          }
          if (type === 'XIAOXIAO_STATE') {
            this.syncInvasionRole(this.character()?.role?.id);
            this.cache.invasionStartAt = Date.now();
          }
          if (type === 'RINGS_RESPONSE') {
            // The server does not echo the request id (seen live on 2026-11-18) and the game client sends its
            // own status commands on a map change, so answers are matched to commands in the order sent.
            const cutoff = Date.now() - 20000;
            for (const [key, at] of this.ringsRequestAt)
              if (at < cutoff) {
                this.ringsRequestAt.delete(key);
                this.ringsRequests.delete(key);
              }
            const id = data?.requestId ?? packet.requestId ?? this.ringsRequests.keys().next().value ?? null;
            this.ringsRequestAt.delete(id);
            packet.ringsRequestId = id;
            if (this.ringsRequests.has(id) && this.ringsRequests.get(id) !== 'status') this.invalidateRings();
            this.ringsRequests.delete(id);
            if (packet.success && data?.rings) {
              this.cache.rings = { rings: copy(data.rings), at: Date.now() };
              if (!data.rings.run) this.ringsCombat = false;
            }
          }
          const lottery = type === 'ONLINE_LOTTERY_STATE' ? data :
            type === 'ONLINE_LOTTERY_RESPONSE' ? data?.state : null;
          if (lottery && typeof lottery.balance !== 'undefined')
            this.cache.lottery = { ...copy(lottery), at: Date.now() };
          if (type === 'WELFARE_LOTTERY_RESPONSE') {
            const request = this.welfareRequests.get(data?.requestId);
            this.welfareRequests.delete(data?.requestId);
            if (packet.success) {
              const at = Date.now();
              if (Number.isFinite(data?.state?.drawAt)) this.cache.welfare = { ...copy(data.state), at };
              if (Array.isArray(data?.history) && (data.action === 'open' && (!request || request.page === 0) || data.action === 'bet' ||
                  data.action === 'history' && request?.action === 'history' && request.page === 0))
                this.cache.welfareHistory = { list: copy(data.history), at };
            }
          }
          if (type === 'ARENA_RESPONSE' && data) {
            const arena = this.cache.arena || (this.cache.arena = {});
            if (data.board) Object.assign(arena, { board: copy(data.board), at: Date.now() });
            if (data.action === 'open' && data.token)
              Object.assign(arena, { token: data.token, tokenAt: Date.now() });
          }
          const match = type === 'ARENA_STATE' ? data :
            type === 'ARENA_RESPONSE' && data?.action === 'challenge' ? data.battle : null;
          if (match) this.cache.arenaMatch = { ...copy(match), at: Date.now() };
          if (type === 'TRIAL_RESPONSE' && data?.trial) {
            const trial = data.trial, at = Date.now(), role = this.character()?.role?.id;
            const ended = this.cache.trial?.trial?.run && trial.run === null;
            this.cache.trial = { trial: copy(trial), at };
            if (role && trial.floor?.number > 0 && P.array(trial.floor.enemies).length) {
              const { number, kind, enemies } = trial.floor;
              const record = { number, kind, at, enemies: enemies.map((e) => ({ level: P.num(e.level),
                base: Object.fromEntries(Object.keys(P.WEIGHTS).map((key) => [key, P.num(e.base?.[key])])) })) };
              const floors = this.towerFloors(role).filter((f) => f.number !== number);
              this.cache.towerFloors = P.keptFloors([record, ...floors], at);
              writeStorage(PREFIX + ':towerFloors:' + role, this.cache.towerFloors);
            }
            if (ended) this.onTowerEnd?.();
          }
          this.packetTypes.push({ type, time: this.lastMessage });
          this.packetTypes = this.packetTypes.slice(-40);
          const pending = this.pendingWaiters(), waiter = pending.find((w) => matchesResponse(w, packet));
          if (type === 'PET_RESPONSE') this.recordPetResponse(packet, waiter);
          const answered = !!waiter;
          if (answered) waiter.answered = true;
          for (const late of this.lateWaiters || []) {
            if (Date.now() >= late.lateUntil) {
              this.lateWaiters.delete(late);
              clearTimeout(late.lateTimer);
            } else if (!answered && late.socket === socket && matchesResponse(late, packet)) {
              this.lateWaiters.delete(late);
              clearTimeout(late.lateTimer);
              late.answered = true;
              this.onLateResponse?.(late, packet, Math.max(0, Date.now() - late.started));
              break;
            }
          }
          if (type === 'ERROR')
            for (const current of pending) {
              const unattributed = pending.length > 1 && current !== this.waiter,
                message = safeMessage(packet.message || '操作错误');
              this.rejectWaiter(current, Object.assign(this.requestError(current,
                unattributed ? 'SERVER_ERROR_UNATTRIBUTED' : 'SERVER_ERROR',
                unattributed ? '服务器返回错误“' + message + '”，无法确定对应哪个查询' :
                  current.label + '：等待响应时服务器提示“' + message + '”', type), { serverMessage: message }));
            }
          this.recordStats?.(packet);
          this.filler?.response(packet);
          const manual = this.manualResponse;
          if (manual && manual.type === type) {
            this.manualResponse = null;
            manual.resolve(packet);
          }
          setTimeout(() => {
            try {
              this.syncState(packet);
              this.onMessage(type, packet);
            } catch (error) {
              if (waiter && this.hasWaiter(waiter) && matchesResponse(waiter, packet))
                this.rejectWaiter(
                  waiter,
                  this.requestError(
                    waiter,
                    'STATE_SYNC_FAILED',
                    waiter.label +
                      '：已收到响应，但角色状态更新失败（' +
                      safeMessage(error.message) +
                      '）',
                    type,
                  ),
                );
              else this.log('页面状态更新异常：' + safeMessage(error.message), 'warning');
              return;
            }
            if (waiter && this.hasWaiter(waiter) && matchesResponse(waiter, packet)) {
              if (waiter.interference)
                this.rejectWaiter(
                  waiter,
                  this.requestError(
                    waiter,
                    'INTERFERENCE',
                    '该动作同时被页面操作触发，暂停以核对结果',
                    type,
                  ),
                );
              else {
                this.removeWaiter(waiter);
                waiter.resolve(packet);
              }
            }
          }, 0);
        });
      }
      get connected() {
        return this.socket?.readyState === 1;
      }
      sendManual(type, payload) {
        if (!this.connected || !this.sessionReady || this.waiter) return false;
        this.socket.send(JSON.stringify({ type, payload }));
        return true;
      }
      invalidateRings() {
        if (this.ringsEpoch === this.ringsConfirmed || this.ringsDirtyAt == null) this.ringsDirtyAt = Date.now();
        this.ringsEpoch = (this.ringsEpoch || 0) + 1;
      }
      pinia() {
        const app = window.document?.querySelector?.('#app')?.__vue_app__;
        if (!app?._context?.provides) return null;
        for (const key of Reflect.ownKeys(app._context.provides)) {
          const value = app._context.provides[key];
          if (value?._s instanceof Map && value._s.has('character')) return value;
        }
        return null;
      }
      character() {
        return this.pinia()?._s.get('character') || null;
      }
      stores() {
        return this.pinia()?._s || new Map();
      }
      root() {
        return document.querySelector('#app')?._vnode || this.pinia()?._a?._instance?.vnode || null;
      }
      // Whether the component rendered the element or something inside it. The character profile of the client of
      // 2026-11-19 renders a fragment (its root el is a text anchor) with the panel in a teleported dialog. After a
      // re-render only the block's dynamic vnodes keep their el, so they are searched too.
      static renders(vm, el, limit = 4000) {
        const root = vm.subTree;
        if (root?.el === el || root?.el?.contains?.(el)) return true;
        const nodes = [root], seen = new Set();
        const add = list => { if (Array.isArray(list)) for (const child of list.slice(0, Math.max(0, limit - nodes.length))) nodes.push(child); };
        for (let i = 0; i < nodes.length && i < limit; i++) {
          const node = nodes[i];
          if (!node || typeof node !== 'object' || seen.has(node)) continue;
          if (node.el === el || node.el?.nodeType === 1 && el.contains?.(node.el)) return true;
          seen.add(node);
          if (node.component?.subTree) nodes.push(node.component.subTree);
          if (node.suspense?.activeBranch) nodes.push(node.suspense.activeBranch);
          add(node.children);
          add(node.dynamicChildren);
        }
        return false;
      }
      components() {
        const out = [],
          seen = new Set();
        const walk = (node) => {
          if (!node || typeof node !== 'object' || seen.has(node) || seen.size > 12000) return;
          seen.add(node);
          if (node.component) {
            out.push(node.component);
            walk(node.component.subTree);
          }
          if (Array.isArray(node.children)) node.children.forEach(walk);
          if (node.suspense) {
            walk(node.suspense.activeBranch);
            walk(node.suspense.pendingBranch);
          }
        };
        walk(this.root());
        return out;
      }
      battle() {
        const vm = this.components().find(
          (vm) =>
            vm.props?.player &&
            Array.isArray(vm.props.monsterSlots) &&
            typeof vm.props.stage === 'string',
        );
        return vm
          ? { stage: vm.props.stage, player: vm.props.player, vm }
          : { stage: 'idle', player: null, vm: null };
      }
      setBattle(start) {
        const battle = this.battle();
        if (!start && battle.stage !== 'idle') {
          const stop = battle.vm?.vnode?.props?.onStop;
          if (typeof stop === 'function') {
            stop();
            return true;
          }
        }
        if (start && battle.stage !== 'idle') return true;
        if (!start) return true;
        for (const vm of this.components()) {
          const items = vm.props?.items;
          if (!Array.isArray(items)) continue;
          const item = items.find((i) => i?.label === '战斗'),
            click = vm.vnode?.props?.onClick;
          if (item && typeof click === 'function') {
            click(item);
            return true;
          }
        }
        return false;
      }
      nativeNpc(id) {
        for (const vm of this.components()) {
          const candidates = vm.props?.npcs;
          if (!Array.isArray(candidates)) continue;
          const npc = candidates.find(
            (n) => n.id === id || (id === P.NPC.tailor && String(n.name).includes('裁缝')),
          );
          if (!npc) continue;
          const props = vm.vnode?.props || {};
          const fn = props.onNpcClick || props.onClickNpc || props.onClick;
          if (typeof fn === 'function') {
            fn(npc);
            return true;
          }
        }
        return false;
      }
      closeOwnedWindows() {
        for (const vm of this.components())
          if (
            [
              'GemShop',
              'SmithyShop',
              'TailorShop',
              'YuciExchangeDialog',
              'ShopWindow',
              'Inventory',
            ].includes(vm.type?.__name || vm.type?.name) &&
            vm.props?.modelValue === true &&
            typeof vm.emit === 'function'
          )
            vm.emit('update:modelValue', false);
      }
      closeArenaResult(doc = document) {
        for (const arena of doc.querySelectorAll('.arena-battle'))
          for (const button of arena.querySelectorAll('button'))
            if (button.textContent.trim() === '返回排行榜') {
              button.click();
              return true;
            }
        return false;
      }
      towerFloors(role) {
        if (this.cache.floorRole !== role) {
          this.cache.floorRole = role;
          this.cache.towerFloors = P.keptFloors(readStorage(PREFIX + ':towerFloors:' + role, []));
        }
        return this.cache.towerFloors;
      }
      state() {
        const c = this.character();
        this.syncPetRole(c?.role?.id);
        this.syncInvasionRole(c?.role?.id);
        if (!c?.role?.id) return null;
        const r = c.role,
          role = {};
        for (const k of [
          'id',
          'nickname',
          'level',
          'sect',
          'mapId',
          'money',
          'yuanbao',
          'currentExp',
          'settings',
          'smeltingItemId',
          'smeltingExp',
          'smeltingTargetExp',
        ])
          role[k] = r[k];
        const shop = this.stores().get('shop');
        return {
          role,
          ...(this.noBatchSell ? { batchSell: false } : {}),
          pets: this.cache.pets && !this.petListRequired ? { ...copy(this.cache.pets.state), at: this.cache.pets.at } : null,
          petHall: copy(this.cache.petHall),
          arena: this.cache.arena || null,
          lottery: this.cache.lottery || null,
          welfare: this.cache.welfare || null,
          welfareHistory: this.cache.welfareHistory || null,
          combat: this.statsRates?.() || null,
          arenaMatch: this.cache.arenaMatch || null,
          towerFloors: this.towerFloors(r.id),
          trial: this.cache.trial ? { ...this.cache.trial.trial, at: this.cache.trial.at } : null,
          rings: this.cache.rings ? { ...this.cache.rings.rings, at: this.cache.rings.at } : null,
          invasion: this.cache.invasion && { ...this.cache.invasion, mapId: this.cache.invasionMapId },
          ringsDirty: this.ringsEpoch !== this.ringsConfirmed,
          ringsDirtyAt: this.ringsDirtyAt ?? null,
          combatPower: c.combatPower,
          warehouseEquipCount: Array.isArray(c.warehouseEquips) ? c.warehouseEquips.length : 0,
          warehouseEquips: copy(c.warehouseEquips) || [],
          warehouseItems: copy(c.warehouseItems) || [],
          equipments: copy(c.equipments) || [],
          bagItems: copy(c.bagItems) || [],
          skills: copy(c.skills) || [],
          artifactSkills: copy(Array.from(c.artifactSkillConfigs?.values() || [])),
          maps: copy(c.maps) || [],
          equipSets: copy(c.equipSets) || [],
          levelTmpls: c.levelTmpls,
          gemInfos: c.gemInfos,
          allEquipTemplates: c.allEquipTemplates,
          shopItems: copy(shop?.items) || [],
          potionTemplates: this.cache.potions,
          finalAttributes: copy(c.finalAttributes),
          ...scoringState(c, this, this.scoringPrefs?.() || P.DEFAULTS),
          maxAttrs: { hp: P.num(c.finalAttributes?.hp), mp: P.num(c.finalAttributes?.mp) },
          activityStatus: this.cache.activityStatus,
          forgePreviews: this.cache.forgePreviews,
        };
      }
      reconnectVisible() {
        for (const s of this.stores().values())
          if (s.reconnectModal) return !!s.reconnectModal.show;
        return false;
      }
      expireActivityStatus() {
        for (const key of ['zl', 'camp', 'wushuang'])
          if (
            this.cache.activityStatus[key] &&
            Date.now() - P.num(this.cache.activityStamp?.[key]) > 300000
          )
            delete this.cache.activityStatus[key];
      }
      syncState(packet) {
        const c = this.character();
        if (!c) return;
        const t = packet.type,
          d = packet.data;
        if (t === 'WELFARE_LOTTERY_RESPONSE' &&
            (!packet.success || d?.action !== 'bet' || this.waiter?.type !== 'WELFARE_LOTTERY_COMMAND' ||
              !matchesResponse(this.waiter, packet))) return;
        const direct = [
          'ENTER_GAME',
          'LEVEL_UP',
          'UPGRADE_SKILL',
          'WAREHOUSE_DEPOSIT',
          'WAREHOUSE_WITHDRAW',
          'SHOP_BUY',
          'SHOP_SELL',
          'GEM_DRILL',
          'GEM_INLAY',
          'GEM_SYNTH',
          'GEM_REMOVE',
          'GEM_POLISH',
          'SMITHY_APPRAISAL',
          'SMITHY_ENHANCE',
          'SMITHY_SMELT_START',
          'SMITHY_SMELT_INVEST',
          'SMITHY_SMELT_COMPLETE',
          'SMITHY_REPAIR_ARTIFACT',
          'SMITHY_FORGE',
          'CRAFT_EQUIP',
          'YUCI_EXCHANGE',
          'WUSHUANG_CLAIM',
          'ZL_CLAIM_TOKEN',
          'ZL_ENTER',
          'CAMP_ENTER',
          'BEAR_ENTER',
        ];
        const nested = [
          'ARENA_RESPONSE', 'PET_RESPONSE', 'TRIAL_RESPONSE', 'RINGS_RESPONSE', 'XIAOXIAO_RESPONSE', 'XIAOXIAO_STATE', 'ONLINE_LOTTERY_RESPONSE', 'WELFARE_LOTTERY_RESPONSE',
          'USE_ITEM_RESPONSE',
          'CALC_MONSTER_DROP_RESPONSE',
          'CALC_MAP_DROP_RESPONSE',
        ];
        const snapshot =
          direct.some((v) => t === v + '_RESPONSE') && d?.role
            ? d
            : nested.includes(t) && d?.roleInfo?.role
              ? d.roleInfo
              : null;
        if (
          snapshot &&
          typeof c.setCharacterData === 'function' &&
          (t === 'ENTER_GAME_RESPONSE' ||
            !c.role?.id ||
            P.num(c.role.id) === P.num(snapshot.role.id))
        ) {
          const current = this.state(),
            incoming = {
              role: snapshot.role,
              equipments: snapshot.equipments || [],
              bagItems: snapshot.bagItems || [],
              skills: snapshot.skills || [],
            };
          if (P.signature(current || {}) !== P.signature(incoming)) c.setCharacterData(snapshot);
        } else if (
          t === 'EQUIP_ITEM_RESPONSE' &&
          packet.success &&
          Array.isArray(d) &&
          typeof c.updateEquipments === 'function'
        )
          c.updateEquipments(d);
      }
      request(action, timeout) {
        if (!requestAllowed(action)) return Promise.reject(new Error('动作不在托管接口列表：' + action.type));
        if (!this.connected || !this.sessionReady)
          return Promise.reject(new Error('角色连接尚未恢复'));
        const query = parallelQuery(action);
        ensureRequestId(action);
        if ((!query && this.waiter) || this.responsePending(action))
          return Promise.reject(new Error('上一个动作尚未完成'));
        if (action.type === 'COMBAT_START') {
          this.socket.send(JSON.stringify({ type: action.type, payload: {} }));
          return Promise.resolve({ success: true });
        }
        if (action.type === 'UPDATE_SETTINGS') {
          const c = this.character();
          if (c && action.setting) c.autoPotionSettings = copy(action.setting);
          this.sending = true;
          try {
            this.socket.send(JSON.stringify({ type: action.type, payload: action.payload }));
            if (c?.role && action.setting) {
              const current = P.parse(c.role.settings, {});
              const merged = current && typeof current === 'object' && !Array.isArray(current)
                ? current : {};
              merged.hp = action.setting.hp;
              merged.mp = action.setting.mp;
              c.role.settings = JSON.stringify(merged);
            }
            return Promise.resolve({
              type: 'UPDATE_SETTINGS_SENT',
              success: true,
              optimistic: true,
            });
          } finally {
            this.sending = false;
          }
        }
        return new Promise((resolve, reject) => {
          const waiter = {
            type: action.type,
            label: action.label || action.type,
            responseType: responseType(action),
            requestId: action.payload?.requestId,
            ...(action.type === 'PET_COMMAND' && { petAction: action.payload.action, petId: action.payload.petId,
              page: action.payload.page, petSession: this.cache.petHall }),
            ...(action.type === 'RINGS_COMMAND' && { ringsAction: action.payload.action, roleId: this.character()?.role?.id }),
            key: responseKey(action),
            petHatch: action.petHatch,
            doubleExp: action.doubleExp,
            resolve,
            reject,
            answered: false,
            interference: false,
            socket: this.socket,
            started: Date.now(),
          };
          const onTimeout = () => {
            if (!this.hasWaiter(waiter) || waiter.answered) return;
            if (!waiter.graceUsed && Date.now() - waiter.started > timeout + 5000) {
              waiter.graceUsed = true;
              waiter.timer = setTimeout(onTimeout, 3000);
              return;
            }
            this.rejectWaiter(
              waiter,
              this.requestError(
                waiter,
                'RESPONSE_TIMEOUT',
                waiter.label + '：响应超时，结果未确认',
              ),
            );
          };
          waiter.timer = setTimeout(onTimeout, timeout);
          if (query) (this.queryWaiters ||= new Map()).set(waiter.key, waiter);
          else this.waiter = waiter;
          this.sending = true;
          try {
            this.socket.send(JSON.stringify({ type: action.type, payload: action.payload }));
          } catch (error) {
            this.rejectWaiter(
              waiter,
              this.requestError(
                waiter,
                'SEND_FAILED',
                waiter.label + '：请求发送失败（' + safeMessage(error.message) + '）',
              ),
            );
          } finally {
            this.sending = false;
          }
        });
      }
    }
    class MarketScore {
      static scoreCache = new WeakMap();
      static scorePrefs(prefs, type) {
        let cached = MarketScore.scoreCache.get(prefs);
        if (!cached) {
          cached = {};
          MarketScore.scoreCache.set(prefs, cached);
        }
        const scoring = type === 'power' ? 'linear' : 'combat';
        const weights = type === 'power' ? P.WEIGHTS : prefs.gear.weights;
        if (!cached[type] || cached[type].gear.scoring !== scoring || cached[type].gear.weights !== weights ||
            cached[type].gear.defenseWeight !== prefs.gear.defenseWeight || cached[type].gear.autoDefense !== prefs.gear.autoDefense) {
          cached[type] = prefs.gear.scoring === scoring && prefs.gear.weights === weights
            ? prefs : { ...prefs, gear: { ...prefs.gear, scoring, weights } };
        }
        return cached[type];
      }
      static equipment(it, state) {
        it = raw(it);
        if (!it) return null;
        if (!(P.num(it.itemType) === 1 || it.equipTmpl)) return null;
        const tmpl = raw(
          it.equipTmpl ||
          state.allEquipTemplates?.get?.(P.num(it.itemId)) ||
          P.lookup(state.allEquipTemplates, it.itemId));
        if (!tmpl) return null;
        return { ...it, equipTmpl: tmpl, tmplId: it.tmplId ?? tmpl.id, isEquipped: 0 };
      }
      static equipmentSignature(eq) {
        eq = raw(eq);
        const t = raw(eq.equipTmpl || eq.tmpl || eq);
        return JSON.stringify([eq.id, eq.tmplId, eq.itemId, eq.enhanceLevel, raw(eq.gemSlots),
          eq.isAppraisal, raw(eq.appraisalStats), raw(eq.extraStats), eq.quality,
          t.id, t.slotType, t.reqLevel, raw(t.baseStats), raw(t.extraStats), t.qualityBase]);
      }
      static prepare(owner, state, prefs, mode = prefs.market.sort) {
        // The listing cache tracks display preferences separately from policy scoring.
        state = Object.fromEntries(Object.entries(raw(state)).map(([k, v]) => [k, raw(v)]));
        state.equipments = P.array(state.equipments).map(raw);
        const combat = MarketScore.scorePrefs(prefs, 'combat'),
          weights = P.combatWeights(state, combat), ctx = P.combatContext(state, combat),
          structural = JSON.stringify([mode, prefs.gear.scoring, prefs.gear.weights, state.role?.id, state.role?.level,
            state.equipments.filter((e) => e.isEquipped).map(MarketScore.equipmentSignature), !!ctx, weights !== null]),
          numeric = JSON.stringify([weights, ctx?.defenseWeight]), now = Date.now();
        let cache = Object.hasOwn(owner, 'listingScores') ? owner.listingScores : null;
        if (!cache || cache.weights !== prefs.gear.weights || cache.structural !== structural ||
            (cache.numeric !== numeric && now - cache.at >= 60000))
          owner.listingScores = cache = { structural, numeric, weights: prefs.gear.weights,
            at: now, listings: new Map(), bags: new Map() };
        return { cache, state, prefs, combat, power: MarketScore.scorePrefs(prefs, 'power'), ready: weights !== null };
      }
      static entry(view, item, bag = false) {
        item = raw(item);
        if (!item) return null;
        const eq = bag ? item : MarketScore.equipment(item, view.state),
          signature = eq ? MarketScore.equipmentSignature(eq) : '',
          entries = bag ? view.cache.bags : view.cache.listings, id = item.id ?? item;
        let entry = entries.get(id);
        if (!entry || entry.signature !== signature) {
          entry = { signature, eq, scores: {}, gains: {}, labels: {} };
          entries.set(id, entry);
        }
        return entry;
      }
      static score(entry, type, view) {
        if (!Object.hasOwn(entry.scores, type))
          entry.scores[type] = type === 'power'
            ? P.scoreStats(P.equipmentStats(entry.eq, view.state.gemInfos), P.WEIGHTS)
            : P.equipmentScore(entry.eq, view.state, view.combat);
        return entry.scores[type];
      }
      static gain(entry, type, view) {
        if (!Object.hasOwn(entry.gains, type))
          entry.gains[type] = P.projectedGain(entry.eq, view.state, view[type]);
        return entry.gains[type];
      }
      sortListings(list, mode, state, prefs) {
        if (mode === 'off' || !state) return null;
        const view = MarketScore.prepare(this, state, prefs, mode);
        if (mode !== 'power' && !view.ready) return null;
        const keys = new Map();
        for (const value of raw(list)) {
          const it = raw(value);
          if (keys.has(it)) continue;
          const entry = MarketScore.entry(view, it);
          keys.set(it, entry?.eq ? { equipment: true, value: mode === 'gain'
            ? MarketScore.gain(entry, 'combat', view).percent : MarketScore.score(entry, mode, view) }
            : { equipment: false, value: 0 });
        }
        return (a, b) => {
          a = raw(a); b = raw(b);
          if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
          const x = keys.get(a), y = keys.get(b);
          return Number(y.equipment) - Number(x.equipment) || y.value - x.value || (b.id || 0) - (a.id || 0);
        };
      }
      static sortHook(original, isOpen, market) {
        return function (compare) {
          let selected = compare;
          try {
            const prefs = market.controller.prefs;
            if (prefs.market.showScore !== false && prefs.market.sort !== 'off' && isOpen() && this.length) {
              const first = raw(raw(this).find((it) => it != null));
              if (first && typeof first === 'object' && 'sellerName' in first && 'price' in first)
                selected = market.sortListings(this, prefs.market.sort, market.state(), prefs) || compare;
            }
          } catch { selected = compare; }
          return original.call(this, selected);
        };
      }
      constructor(controller) {
        this.controller = controller;
        if (typeof document === 'undefined') return;
        if (!MarketScore.sortInstalled) {
          Array.prototype.sort = MarketScore.sortHook(Array.prototype.sort,
            () => !!document.querySelector('.consignment-window'), this);
          MarketScore.sortInstalled = true;
        }
        if (typeof MutationObserver === 'undefined') return;
        this.timer = 0;
        this.observer = null;
        const boot = () => {
          if (this.observer || !document.documentElement) return;
          this.observer = new MutationObserver(() => this.schedule());
          this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          this.schedule();
        };
        if (document.documentElement) boot();
        else document.addEventListener('DOMContentLoaded', boot, { once: true });
      }
      schedule() {
        if (this.timer) return;
        this.timer = setTimeout(() => {
          this.timer = 0;
          try {
            this.scan();
          } catch {}
        }, 250);
      }
      read(card) {
        const price = card.querySelector('.price-number');
        let seller = '';
        for (const span of card.querySelectorAll('span')) {
          const m = span.textContent.match(/^\s*卖家:\s*(.*)$/);
          if (m) {
            seller = m[1].trim();
            break;
          }
        }
        return {
          name: (card.querySelector('.item-title')?.textContent || '').trim(),
          seller,
          price: P.num(String(price?.textContent || '').replace(/[^\d.]/g, ''), -1),
          currency: price?.classList.contains('yuanbao-price') ? 2 : 1,
        };
      }
      static cardKey(it) {
        it = raw(it);
        return JSON.stringify([String(it.itemName || '').trim(), String(it.sellerName || '').trim(),
          P.num(it.price), P.num(it.currency, 1)]);
      }
      static index(owner) {
        const cache = owner.controller.bridge.cache, source = cache.consignment, version = cache.consignmentVersion;
        let index = owner.marketIndex;
        if (!index || index.source !== source || index.version !== version) {
          index = { source, version, items: new Map() };
          for (const item of source.values()) {
            if (!item) continue;
            const key = MarketScore.cardKey(item), matches = index.items.get(key) || [];
            matches.push(raw(item));
            index.items.set(key, matches);
          }
          owner.marketIndex = index;
        }
        return index.items;
      }
      label(card, state, prefs, view) {
        const scoringPrefs = MarketScore.scorePrefs(prefs, prefs.market.scoreType);
        const info = this.read(card);
        if (!info.name || info.price < 0) return null;
        const key = JSON.stringify([info.name, info.seller, info.price, info.currency]),
          matches = MarketScore.index(this).get(key) || [];
        if (!matches.length) return null;
        view ||= MarketScore.prepare(this, state, prefs);
        const scored = [];
        for (const it of matches) {
          if (MarketScore.cardKey(it) !== key) continue;
          const entry = MarketScore.entry(view, it);
          if (!entry.eq) continue;
          scored.push({
            score: MarketScore.score(entry, prefs.market.scoreType, view),
            gain: MarketScore.gain(entry, prefs.market.scoreType, view),
          });
        }
        if (!scored.length) return null;
        const scores = scored.map((v) => Math.round(v.score)),
          min = Math.min(...scores),
          max = Math.max(...scores);
        if (min !== max)
          return {
            text: (prefs.market.scoreType === 'power' ? '战力 ' : '评分 ') + min + '~' + max + (scored[0].gain.pending ? ' · 待数据' : ''),
            color: scored[0].gain.pending ? '#9e9e9e' : '#ffd54f',
            title: (prefs.market.scoreType === 'power' ? '战力 ' : '') + '同名同价有多件不同属性的商品，评分范围 ' + min + '~' + max +
              (scored[0].gain.pending ? '\n实战评分等待战斗数据' : ''),
          };
        const gain = scored[0].gain;
        if (gain.pending || scoringPrefs.gear.scoring === 'combat') {
          const signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
          return { text: '评分 ' + min + (gain.pending ? ' · 待数据' :
            ' · ' + signed(gain.percent) + '%'),
            color: gain.pending ? '#9e9e9e' :
              gain.percent >= P.num(prefs.gear?.minGainPercent, 1) ? '#69f0ae' :
              gain.percent > 0 ? '#c5e1a5' : '#9e9e9e',
            title: '装备评分 ' + min + '\n' + (gain.pending ? '实战评分等待战斗数据' :
              '换上后实战评分 ' + signed(gain.percent) + '%（输出 ' +
              signed(gain.outputPercent) + '%，生存 ' + signed(gain.survivalPercent) + '%）'),
          };
        }
        const g = scored[0].gain,
          pct = g.percent,
          sign = pct > 0 ? '+' : '';
        const color =
          pct >= P.num(prefs.gear?.minGainPercent, 1) ? '#69f0ae' : pct > 0 ? '#c5e1a5' : '#9e9e9e';
        return {
          text: '战力 ' + min + ' · ' + sign + pct.toFixed(1) + '%',
          color,
          title:
            '战力 ' +
            min +
            '\n替换同部位后整套评分 ' +
            Math.round(g.current) +
            ' → ' +
            Math.round(g.after) +
            '（' +
            sign +
            pct.toFixed(1) +
            '%）\n含基础/附加属性、强化、鉴定、宝石与套装；按游戏战力权重',
        };
      }
      tipInfo(item, state, prefs, context) {
        if (!item?.equipTmpl) return null;
        const combatPrefs = MarketScore.scorePrefs(prefs, 'combat'),
          pending = P.combatWeights(state, combatPrefs) === null,
          compare = context?.compare !== false && !item.isEquipped,
          gain = compare && !pending ? P.projectedGain(item, state, combatPrefs) : null,
          signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
        return {
          power: Math.round(P.equipmentScore(item, state, MarketScore.scorePrefs(prefs, 'power'))),
          score: Math.round(P.equipmentScore(item, state, combatPrefs)),
          pending,
          compare,
          powerUp: compare && P.projectedGain(item, state, MarketScore.scorePrefs(prefs, 'power')).gain > 0,
          combatUp: !!gain && gain.gain > 0,
          title: context?.title ?? (pending ? '实战评分等待战斗数据' : gain ?
            '换上后实战评分 ' + signed(gain.percent) + '%（输出 ' +
            signed(gain.outputPercent) + '%，生存 ' + signed(gain.survivalPercent) + '%）' : ''),
        };
      }
      drawBound(el, item) {
        let line = el.querySelector('.tl-tip-bound');
        const on = (value) => [1, '1', true, 'true'].includes(value);
        const bound = on(item?.isBound);
        const anchor = el.querySelector('.tooltip-row') || el.querySelector('.tooltip-name, .item-name') || el.firstElementChild;
        if (!anchor || anchor === line || (!bound && ![0, '0', false, 'false'].includes(item?.isBound)) ||
            [...el.querySelectorAll('.binding-line')].some((node) => node !== line)) {
          line?.remove();
          return;
        }
        if (!line) {
          line = document.createElement('div');
          line.className = 'binding-line tl-tip-bound';
          for (const attr of anchor.attributes)
            if (attr.name.startsWith('data-v-')) line.setAttribute(attr.name, attr.value);
        }
        const label = bound ? '已绑定' : on(item.equipTmpl?.bindOnEquip) || on(item.bindOnEquip)
          ? '未绑定 · 装备后绑定' : '未绑定';
        if (line.textContent !== label) {
          line.textContent = label;
          line.style.color = bound ? '' : '#b9f6ca';
        }
        if (anchor.nextElementSibling !== line) anchor.parentNode.insertBefore(line, anchor.nextSibling);
      }
      drawTip(el, info, item) {
        const row = el.querySelector('.tooltip-row');
        if (!info || !row) return;
        const gamePower = [...el.querySelectorAll('.tooltip-power')]
          .find((node) => !node.className.split(/\s+/).includes('tl-tip-score'));
        if (gamePower) return this.drawGameTip(el, gamePower, info, item);
        const first = el.querySelector('.tl-tip-bound') || row,
          sibling = first.nextElementSibling,
          anchor = sibling?.textContent.trim().startsWith('收益') ? sibling : first,
          key = JSON.stringify([item, info]),
          oldPower = el.querySelector('.tl-tip-power'),
          oldLines = el.querySelectorAll('.tl-tip-score');
        if (oldPower && oldPower._tipKey === key && oldLines.length === 2 &&
            anchor.nextElementSibling === oldPower && oldPower.nextElementSibling === oldLines[1]) return;
        for (const node of el.querySelectorAll('.tl-tip-score, .tl-tip-arrow')) node.remove();
        const power = document.createElement('div'),
          line = document.createElement('div');
        power.className = 'tl-tip-score tl-tip-power';
        line.className = 'tl-tip-score';
        for (const node of [power, line]) {
          node.style.cssText = 'color:#ddd0b6;font-size:12px';
          for (const attr of row.attributes)
            if (attr.name.startsWith('data-v-')) node.setAttribute(attr.name, attr.value);
        }
        power.textContent = '战斗力: ' + info.power.toLocaleString();
        power._tipKey = key;
        line.textContent = '实战评分: ' + (info.pending ? '待战斗数据' : info.score.toLocaleString());
        line.title = info.title;
        anchor.parentNode.insertBefore(power, anchor.nextSibling);
        power.parentNode.insertBefore(line, power.nextSibling);
        const arrow = (parent, up) => {
          const span = document.createElement('span');
          span.className = 'tl-tip-arrow';
          span.textContent = up ? ' △' : ' ▽';
          span.style.color = up ? '#69f0ae' : '#ef5350';
          parent.appendChild(span);
        };
        if (info.compare) {
          arrow(power, info.powerUp);
          if (!info.pending) arrow(line, info.combatUp);
        }
      }
      drawGameTip(el, power, info, item) {
        const key = JSON.stringify([item, info]),
          bound = el.querySelector('.tl-tip-bound'),
          anchor = bound && el.querySelector('.tooltip-power, .tl-tip-bound') === power ? bound : power,
          lines = el.querySelectorAll('.tl-tip-score'),
          line = lines[0],
          powerArrows = power.querySelectorAll('.tl-tip-arrow');
        if (lines.length === 1 && line._tipKey === key && anchor.nextElementSibling === line &&
            powerArrows.length === (info.compare ? 1 : 0) &&
            line.querySelectorAll('.tl-tip-arrow').length === (info.compare && !info.pending ? 1 : 0)) return;
        for (const node of el.querySelectorAll('.tl-tip-score, .tl-tip-arrow')) node.remove();
        const score = document.createElement('div');
        score.className = power.className + ' tl-tip-score';
        for (const attr of power.attributes)
          if (attr.name.startsWith('data-v-')) score.setAttribute(attr.name, attr.value);
        score.textContent = '实战评分: ' + (info.pending ? '待战斗数据' : info.score.toLocaleString());
        score.title = info.title;
        score._tipKey = key;
        anchor.parentNode.insertBefore(score, anchor.nextSibling);
        if (!info.compare) return;
        this.tipArrow(power, info.powerUp);
        if (!info.pending) this.tipArrow(score, info.combatUp);
      }
      tipArrow(parent, up) {
        const span = document.createElement('span');
        span.className = 'tl-tip-arrow';
        span.textContent = up ? ' △' : ' ▽';
        span.style.color = up ? '#69f0ae' : '#ef5350';
        parent.appendChild(span);
      }
      profileScore(stats, state, prefs) {
        const value = P.characterScore(stats, state, MarketScore.scorePrefs(prefs, 'combat'));
        return {
          score: Math.round(value),
          pending: value === null,
        };
      }
      state() {
        const c = this.controller.bridge.character(), field = (k) => c ? storeField(c, k) : undefined,
          role = field('role');
        return role?.id
          ? {
              role,
              ...(this.controller.bridge.noBatchSell ? { batchSell: false } : {}),
              skills: copy(field('skills')),
              artifactSkills: copy(Array.from(field('artifactSkillConfigs')?.values() || [])),
              maps: field('maps'),
              finalAttributes: copy(field('finalAttributes')),
              ...scoringState(c, this.controller.bridge, this.controller.prefs, true),
              equipments: field('equipments'),
              warehouseEquips: field('warehouseEquips'),
              equipSets: field('equipSets'),
              gemInfos: field('gemInfos'),
              allEquipTemplates: field('allEquipTemplates'),
            }
          : null;
      }
      scanSort() {
        const game = document.querySelectorAll('.consignment-window .sort-select')[0], prefs = this.controller.prefs;
        if (prefs.market.showScore === false) {
          for (const node of document.querySelectorAll('.tl-market-sort')) node.remove();
          return;
        }
        if (!game) return;
        let select = game.parentNode.querySelector('.tl-market-sort');
        if (!select) {
          select = document.createElement('select');
          select.className = 'filter-select tl-market-sort';
          for (const attr of game.attributes)
            if (attr.name.startsWith('data-v-')) select.setAttribute(attr.name, attr.value);
          for (const [value, text] of [['off', '脚本排序：关'], ['power', '⚔️ 战斗力从高到低'],
            ['combat', '🎯 实战评分从高到低'], ['gain', '📈 实战提升从高到低']]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
          }
          game.after(select);
          select.addEventListener('change', () => {
            const current = this.controller.prefs;
            this.controller.updateConfig({ ...current, market: { ...current.market, sort: select.value } });
            const value = game.value;
            game.value = Array.from(game.options).find((option) => option.value !== value).value;
            game.dispatchEvent(new Event('change', { bubbles: true }));
            game.value = value;
            game.dispatchEvent(new Event('change', { bubbles: true }));
            this.scanSort();
          });
        }
        select.value = prefs.market.sort;
        select.title = ['combat', 'gain'].includes(prefs.market.sort) &&
          !this.sortListings([], prefs.market.sort, this.state(), prefs)
          ? '实战评分等待战斗数据，暂按游戏排序' : '';
      }
      scan() {
        this.scanSort();
        const cards = document.querySelectorAll('.consignment-window .market-item-card'),
          grids = document.querySelectorAll('.inventory-grid, .warehouse-grid'),
          profiles = document.querySelectorAll('.stats-area'),
          tips = document.querySelectorAll('.tlbb-tooltip');
        const prefs = this.controller.prefs, tipScore = prefs.market.tipScore !== false, tipBound = prefs.market.tipBound !== false;
        if (!tipScore)
          for (const node of document.querySelectorAll('.tl-tip-score, .tl-tip-arrow, .tl-profile-score')) node.remove();
        if (!tipBound)
          for (const node of document.querySelectorAll('.tl-tip-bound')) node.remove();
        const toolsOn = prefs.market.bagFilter || prefs.market.setTag || prefs.market.tipSet;
        if (this.bagStyle || ((grids.length || tips.length) && toolsOn))
          this.ensureBagStyle(toolsOn && (grids.length || tips.length));
        if (this.bagFrames) this.clearClosedBags(grids);
        if (!cards.length && !grids.length && !tips.length && !profiles.length) return;
        const state = cards.length || grids.length || tipScore || (tips.length && prefs.market.tipSet) ? this.state() : null;
        let collection;
        const getCollection = () => collection ||= this.inventoryCollection(state);
        const tipSet = prefs.market.tipSet && state?.equipSets?.length;
        const scanTips = tips.length && (tipScore || tipBound || tipSet),
          scoreProfiles = profiles.length && state && tipScore,
          instances = scanTips || scoreProfiles ? Array.from(this.controller.bridge.components()) : [],
          profileInstances = instances.filter((vm) => vm.type?.__name === 'CharacterProfile' && vm.props?.modelValue),
          entries = this.controller.bridge.cache?.viewedPlayers;
        if (tips.length && !tipSet)
          for (const node of document.querySelectorAll('.tl-tip-set, .tl-tip-set-where')) node.remove();
        if (scanTips) {
          const items = new Map();
          for (const vm of instances)
            if (vm.type?.__name === 'ItemTooltip') items.set(vm.subTree?.el, vm.props.item);
          for (const tip of tips) {
            if (!items.has(tip)) {
              if (tipSet) this.drawTipSet(tip, null);
              continue;
            }
            const item = items.get(tip);
            if (tipBound) this.drawBound(tip, item);
            if ((!tipScore && !tipSet) || !state) continue;
            const context = P.tooltipContext(item, profileInstances.map((vm) => vm.props), state, entries);
            // A viewed player without skills has no score: no line rather than one that waits for battle data.
            if (tipScore && context.state) this.drawTip(tip, this.tipInfo(item, context.state, prefs, context), item);
            else if (tipScore) for (const node of tip.querySelectorAll('.tl-tip-score, .tl-tip-arrow')) node.remove();
            if (tipSet) {
              const data = context.compare && item?.equipTmpl ? getCollection() : null;
              this.drawTipSet(tip, data, item);
            }
          }
        }
        if (scoreProfiles) for (const el of profiles) this.drawProfile(el, profileInstances, state, entries, prefs);
        if (cards.length) this.scanMarket(cards, prefs.market?.showScore !== false ? state : null, prefs);
        if (grids.length) this.scanBag(grids, state, prefs, getCollection);
      }
      drawProfile(el, profileInstances, state, entries, prefs) {
        const vm = profileInstances.find(v => Bridge.renders(v, el));
        if (!vm && profileInstances.some(v => P.isViewedProfile(v.props))) return;
        const header = el.firstElementChild;
        if (!header) return;
        const selected = P.profileState(vm?.props, state, entries);
        const info = selected ? this.profileScore(vm?.props.statsOverride ?? selected.finalAttributes, selected, prefs) : null;
        const list = el.querySelector('dl.identity-stats');
        let line = el.querySelector('.tl-profile-score');
        if (line && (list ? line.parentNode !== list : line.querySelector('dt'))) {
          line.remove();
          line = null;
        }
        if (!line) {
          line = document.createElement('div');
          line.className = 'tl-profile-score';
          if (list) {
            const term = document.createElement('dt'), value = document.createElement('dd');
            term.textContent = '实战评分';
            value.style.color = '#69f0ae';
            line.appendChild(term);
            line.appendChild(value);
            list.appendChild(line);
          } else {
            const style = getComputedStyle(header);
            line.style.cssText = 'text-align:right;color:#69f0ae;font-size:' + style.fontSize + ';font-weight:' + style.fontWeight + ';';
            el.insertBefore(line, header.nextSibling);
          }
        }
        if (list && list.lastElementChild !== line) list.appendChild(line);
        const missing = !selected && P.viewedSkillsMissing(vm?.props, entries);
        const target = list ? line.lastElementChild : line,
          text = list ? P.profileScoreValue(info, missing) : P.profileScoreText(info, missing);
        if (target.textContent !== text) target.textContent = text;
      }
      inventoryCollection(state) {
        const signature = eq => [eq.id, P.equipmentTemplateId(eq), !!eq.isEquipped];
        const key = JSON.stringify([state.role?.id, state.equipSets?.length, state.allEquipTemplates?.size, P.array(state.equipments).map(signature),
          P.array(state.warehouseEquips).map(signature)]);
        const old = this.bagCollection;
        if (old?.key === key && old.state.equipSets === state.equipSets &&
            old.state.allEquipTemplates === state.allEquipTemplates) return old;
        const sets = P.setCollection(state);
        return this.bagCollection = { key, state, sets, byId: new Map(sets.map(set => [set.id, set])) };
      }
      drawTipSet(tip, data, item) {
        const info = data && P.setOfTemplate(data.state, P.equipmentTemplateId(item));
        let line = tip.querySelector?.('.tl-tip-set');
        if (!info) {
          line?.remove();
          for (const node of tip.querySelectorAll?.('.tl-tip-set-where') || []) node.remove();
          return;
        }
        const set = data.byId.get(info.id), members = set?.members || [];
        const rows = Array.from(tip.querySelectorAll('.set-member'));
        const aliases = new Map();
        for (const m of members) {
          aliases.set(m.name, m);
          for (const id of m.ids) {
            const t = data.state.allEquipTemplates?.get?.(id) || P.lookup(data.state.allEquipTemplates, id);
            if (t?.name) aliases.set(t.name, m);
          }
        }
        const names = [...aliases.keys()].sort((a, b) => b.length - a.length);
        for (const row of rows) {
          let where = row.querySelector('.tl-tip-set-where');
          const label = row.textContent.replace(/ · (背包|仓库)$/, '').trim();
          const m = aliases.get(names.find(name => label.includes(name)));
          const text = m && !m.worn && (m.bag ? ' · 背包' : m.warehouse ? ' · 仓库' : '');
          if (!text) { where?.remove(); continue; }
          if (!where) where = this.bagNode(row, 'span', 'tl-tip-set-where');
          if (where.textContent !== text) where.textContent = text;
        }
        const last = rows.at(-1), group = last?.parentElement;
        let anchor = last?.closest?.('.set-block, .set-info, .tooltip-set') ||
          (group?.classList.contains('set-members') && group.parentElement !== tip ? group.parentElement : group);
        if (!anchor || anchor === tip) anchor = last || tip.querySelector('.tl-tip-bound') || tip.querySelector('.tooltip-row');
        if (!anchor) { line?.remove(); return; }
        if (anchor.nextElementSibling?.textContent.trim().startsWith('收益')) anchor = anchor.nextElementSibling;
        while (anchor.nextElementSibling?.classList.contains('tl-tip-score')) anchor = anchor.nextElementSibling;
        const total = set?.total ?? P.setIndex(data.state).sets.find(s => s.id === info.id).groups.length;
        const text = '已收集 ' + (set?.owned || 0) + '/' + total + '（穿戴 ' + (set?.worn || 0) +
          ' · 背包 ' + members.filter(m => m.bag).length + ' · 仓库 ' + members.filter(m => m.warehouse).length + '）';
        if (!line) { line = document.createElement('div'); line.className = 'tl-tip-set'; }
        if (line.textContent !== text) line.textContent = text;
        if (anchor.nextElementSibling !== line) anchor.parentNode.insertBefore(line, anchor.nextSibling);
      }
      ensureBagStyle(on) {
        if (!on) { this.bagStyle?.remove(); this.bagStyle = null; return; }
        if (!document.head || this.bagStyle?.parentNode === document.head) return;
        const existing = document.getElementById('tl-bag-style');
        if (existing) { this.bagStyle = existing; return; }
        const style = document.createElement('style');
        style.id = 'tl-bag-style';
        style.textContent = `
.tl-bag-set{position:absolute;top:0;left:0;padding:0 2px;font:bold 9px/12px sans-serif;pointer-events:none;background:#121821dc;color:#ddd;z-index:1}
.tl-bag-set.tl-bag-complete{color:#f0d684}
.tl-bag-bar,.tl-bag-sets{position:absolute;top:40px;background:#121821f5;color:#f0d684;border:1px solid #5a4d38;border-radius:4px;box-sizing:border-box;z-index:5;font:12px/1.5 sans-serif}
.tl-bag-bar{right:100%;margin-right:4px;display:flex;flex-direction:column;gap:2px;padding:2px}
.tl-bag-bar.tl-bag-right{left:100%;right:auto;margin:0 0 0 4px}
.tl-bag-sets{right:calc(100% + 36px);width:250px;max-height:420px;overflow:auto;padding:6px}
.tl-bag-sets.tl-bag-right{right:auto;left:calc(100% + 36px)}
.tl-bag-bar button,.tl-bag-sets button{color:inherit;background:#202733;border:1px solid #5a4d38;border-radius:3px;cursor:pointer}
.tl-bag-bar button{width:22px;height:22px;padding:0;font-size:12px}
.tl-bag-bar button[aria-pressed=true],.tl-bag-sets button[aria-pressed=true]{background:#4b4029;border-color:#f0d684}
.tl-bag-separator{border-top:1px solid #5a4d38}
.tl-bag-title,.tl-bag-row{display:flex;align-items:center;gap:4px}
.tl-bag-title{justify-content:space-between}.tl-bag-row{width:100%;margin-top:4px;text-align:left}
.tl-bag-dot{width:6px;height:6px;border-radius:50%;border:1px solid #9e9e9e;flex:none}
.tl-bag-worn{background:#69f0ae;border-color:#69f0ae}.tl-bag-owned{background:#f0d684;border-color:#f0d684}
.tl-bag-detail{padding:3px;color:#ddd}.tl-bag-missing{color:#9e9e9e}.tl-bag-chip{color:#f0d684;margin-left:4px}
.tl-tip-set,.tl-tip-set-where{color:#f0d684}.tl-tip-set{font-size:12px}`;
        document.head.appendChild(style);
        this.bagStyle = style;
      }
      bagNode(parent, tag, cls, text) {
        const node = document.createElement(tag);
        node.className = cls;
        if (text != null) node.textContent = text;
        parent.appendChild(node);
        return node;
      }
      bagButton(parent, cls, text, label, click) {
        const button = this.bagNode(parent, 'button', cls, text);
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', label);
        button.title = label;
        button.addEventListener('click', click);
        return button;
      }
      closeSetList() {
        if (!this.openBagFrame) return;
        this.openBagFrame.querySelector('.tl-bag-sets')?.remove();
        this.openBagFrame = null;
        document.removeEventListener('click', this.outsideBagClick, true);
      }
      toggleSetList(frame) {
        const open = this.openBagFrame === frame;
        this.closeSetList();
        if (!open) {
          this.openBagFrame = frame;
          this.outsideBagClick = event => {
            if (!frame.querySelector('.tl-bag-sets')?.contains(event.target) &&
                !frame.querySelector('.tl-bag-bar')?.contains(event.target)) this.closeSetList();
          };
          document.addEventListener('click', this.outsideBagClick, true);
        }
        this.scan();
        frame.querySelector('.tl-bag-sets')?.focus();
      }
      drawSetList(frame, data, side) {
        let dialog = frame.querySelector('.tl-bag-sets');
        if (!dialog) {
          dialog = this.bagNode(frame, 'div', 'tl-bag-sets');
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-label', '套装收集');
          dialog.tabIndex = -1;
          dialog.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            this.closeSetList();
            frame.querySelector('.tl-bag-toggle')?.focus();
          });
        }
        const cls = 'tl-bag-sets' + side;
        if (dialog.className !== cls) dialog.className = cls;
        const selected = this.bagFilter.setId;
        if (dialog._sets === data && dialog._selected === selected &&
            dialog._elements.every(([node, parent]) => node.parentNode === parent)) return;
        dialog._sets = data;
        dialog._selected = selected;
        dialog.textContent = '';
        const title = this.bagNode(dialog, 'div', 'tl-bag-title', '套装收集（' + data.sets.length + '）');
        const select = id => {
          this.bagFilter.setId = id === selected ? 0 : id;
          this.scan();
          dialog.focus();
        };
        if (selected) this.bagButton(title, 'tl-bag-clear', '清除筛选', '清除筛选', () => select(0));
        if (!data.sets.length) this.bagNode(dialog, 'div', 'tl-bag-missing', '还没有套装装备');
        for (const set of data.sets) {
          const label = set.name + ' ' + set.owned + '/' + set.total;
          const row = this.bagButton(dialog, 'tl-bag-row', label, label, () => select(set.id));
          row.setAttribute('aria-pressed', String(selected === set.id));
          for (const m of set.members) this.bagNode(row, 'span', 'tl-bag-dot ' +
            (m.worn ? 'tl-bag-worn' : m.bag || m.warehouse ? 'tl-bag-owned' : 'tl-bag-missing'));
          if (selected !== set.id) continue;
          const detail = this.bagNode(dialog, 'div', 'tl-bag-detail');
          for (const m of set.members) {
            const count = (place, n) => n && place + (n > 1 ? '×' + n : '');
            const places = [m.worn && '已穿戴', count('背包', m.bag), count('仓库', m.warehouse)].filter(Boolean);
            this.bagNode(detail, 'div', places.length ? '' : 'tl-bag-missing',
              [P.SLOT_NAMES[m.slot], m.name, places.join(' · ') || '缺'].join(' '));
          }
          for (const tier of set.tiers) {
            const line = this.bagNode(detail, 'div', '', tier.pieces + ' 件：' +
              tier.effects.map(e => e.name + (e.value >= 0 ? ' +' : ' ') + e.value).join('、'));
            this.bagNode(line, 'span', 'tl-bag-chip', tier.active ? '已激活' : tier.reachable ? '可激活' :
              '还差 ' + (tier.pieces - set.owned) + ' 件');
          }
          if (set.spare) this.bagNode(detail, 'div', '', '重复 ' + set.spare + ' 件');
        }
        dialog._elements = Array.from(dialog.querySelectorAll('*'), node => [node, node.parentNode]);
      }
      drawBagBar(frame, data, scoring) {
        const filter = this.bagFilter;
        let bar = frame.querySelector('.tl-bag-bar');
        if (!bar) {
          bar = this.bagNode(frame, 'div', 'tl-bag-bar');
          bar.setAttribute('role', 'toolbar');
          bar.setAttribute('aria-label', '装备筛选');
        }
        // The game stage clips what leaves it. With little room at the left the strip moves over the window border
        // (the grid starts 18 px inside); with none it goes to the right side.
        const room = frame.getBoundingClientRect().left - (frame.closest?.('.web-game-stage')?.getBoundingClientRect?.().left ?? 0);
        const side = room < 14 ? ' tl-bag-right' : '', shift = side || room >= 32 ? 0 : Math.ceil(32 - room);
        if (bar.className !== 'tl-bag-bar' + side) bar.className = 'tl-bag-bar' + side;
        const margin = shift ? 4 - shift + 'px' : '';
        if (bar.style.marginRight !== margin) bar.style.marginRight = margin;
        bar._listInside = !side && room < 290 ? shift : null;
        const slots = P.SLOT_NAMES.length;
        if (bar.children.length !== slots + 2 + Number(scoring) || bar._scoring !== scoring) {
          bar.textContent = '';
          bar._scoring = scoring;
          for (let slot = 0; slot < slots; slot++)
            this.bagButton(bar, 'tl-bag-slot', P.SLOT_SHORT[slot] || '全', slot ? '部位：' + P.SLOT_NAMES[slot] : '全部部位', () => {
              filter.slot = filter.slot === slot ? 0 : slot;
              this.scan();
            });
          this.bagNode(bar, 'div', 'tl-bag-separator');
          this.bagButton(bar, 'tl-bag-toggle', '套', '套装收集', () => this.toggleSetList(frame));
          if (scoring) this.bagButton(bar, 'tl-bag-upgrade', '▲', '只看可提升', () => {
            filter.upgrade = !filter.upgrade;
            this.scan();
          });
        }
        Array.from(bar.children).forEach((button, i) => {
          if (i === slots) return;
          const pressed = String(i < slots ? filter.slot === i : i === slots + 1 ? !!filter.setId : filter.upgrade);
          if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
        });
        if (this.openBagFrame === frame) {
          const dialog = this.drawSetList(frame, data, side) || frame.querySelector('.tl-bag-sets');
          // Without room for the list outside, it opens over the window, right of the strip.
          const inside = bar._listInside;
          if (dialog?.style) {
            const left = inside == null ? '' : inside + 'px', right = inside == null ? '' : 'auto';
            if (dialog.style.left !== left) dialog.style.left = left;
            if (dialog.style.right !== right) dialog.style.right = right;
          }
        }
      }
      clearClosedBags(grids) {
        for (const [grid, frame] of this.bagFrames) {
          if (Array.prototype.includes.call(grids, grid)) continue;
          grid._tlBagObserver?.disconnect();
          grid._tlBagObserver = null;
          this.clearBagFrame(frame);
          for (const cell of grid.children) {
            if (cell.style.opacity === '0.22') cell.style.opacity = '';
            cell.querySelector('.tl-bag-set')?.remove();
          }
          this.bagFrames.delete(grid);
        }
      }
      clearBagFrame(frame) {
        frame?.querySelector('.tl-bag-bar')?.remove();
        if (frame && frame === this.openBagFrame) this.closeSetList();
      }
      // Inventory equip tab: slot i renders the i-th unequipped equipment in store order.
      bagList(grid, state, frame) {
        if (!state) return null;
        const slots = Array.from(grid.children).filter((n) => n.classList?.contains('grid-slot'));
        if (!slots.length) return null;
        let root = grid,
          tab = frame?.querySelector('.game-tab-button.is-active');
        for (let i = 0; root && !tab; i++) {
          root = root.parentElement;
          tab = root?.querySelector('.game-tab-button.is-active');
        }
        if (!tab || tab.textContent.trim() !== '装备') return null;
        const warehouse = grid.classList.contains('warehouse-grid'),
          items = P.array(warehouse ? state.warehouseEquips : state.equipments)
            .filter((e) => e.equipTmpl && (warehouse || !e.isEquipped));
        const filled = slots.filter((n) => !n.classList.contains('empty-slot')).length;
        if (filled !== Math.min(items.length, slots.length)) return null;
        return { slots, items };
      }
      bagLabel(eq, state, prefs, view) {
        view ||= MarketScore.prepare(this, state, prefs);
        const entry = MarketScore.entry(view, eq, true),
          key = JSON.stringify([prefs.market.bagScoreType, prefs.gear?.minGainPercent]);
        if (Object.hasOwn(entry.labels, key)) return entry.labels[key];
        const scoringPrefs = MarketScore.scorePrefs(prefs, prefs.market.bagScoreType);
        const score = Math.round(MarketScore.score(entry, prefs.market.bagScoreType, view)),
          gain = MarketScore.gain(entry, prefs.market.bagScoreType, view),
          pct = gain.percent,
          sign = pct > 0 ? '+' : '',
          up = pct >= P.num(prefs.gear?.minGainPercent, 1),
          short = score >= 10000 ? (score / 10000).toFixed(score >= 100000 ? 0 : 1) + '万' : String(score);
        if (gain.pending || scoringPrefs.gear.scoring === 'combat') {
          const signed = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
          return entry.labels[key] = { text: (!gain.pending && pct > 0 ? '▲' : '') + short,
            color: gain.pending ? '#e0e0e0' : up ? '#69f0ae' : pct > 0 ? '#c5e1a5' : '#e0e0e0',
            title: '战力 ' + score + '\n' + (gain.pending ? '实战评分等待战斗数据' :
              '换上后实战评分 ' + signed(pct) + '%（输出 ' + signed(gain.outputPercent) +
              '%，生存 ' + signed(gain.survivalPercent) + '%）'),
          };
        }
        return entry.labels[key] = {
          text: (pct > 0 ? '▲' : '') + short,
          color: up ? '#69f0ae' : pct > 0 ? '#c5e1a5' : '#e0e0e0',
          title:
            '战力 ' +
            score +
            '\n替换同部位后整套 ' +
            Math.round(gain.current) +
            ' → ' +
            Math.round(gain.after) +
            '（' +
            sign +
            pct.toFixed(1) +
            '%）',
        };
      }
      scanBag(grids, state, prefs, getCollection = () => this.inventoryCollection(state)) {
        const { bagFilter, setTag, bagScore } = prefs.market, scoring = bagScore !== false;
        const filter = this.bagFilter ||= { slot: 0, setId: 0, upgrade: false };
        if (!scoring) filter.upgrade = false;
        const view = state && scoring ? MarketScore.prepare(this, state, prefs) : null;
        for (const grid of grids) {
          const frame = grid.closest?.('.game-window-shell__frame');
          // The frame clips its children (overflow: hidden); the strip and the list hang outside it, on the shell.
          const host = frame?.closest?.('.game-window-shell') || frame;
          const list = this.bagList(grid, state, frame),
            slots = list?.slots || Array.from(grid.querySelectorAll('.grid-slot'));
          const equipmentTab = list || (bagFilter && frame?.querySelector('.game-tab-button.is-active')?.textContent.trim() === '装备');
          const data = state && equipmentTab && (bagFilter || setTag) ? getCollection() : null;
          if (frame && (bagFilter || setTag)) {
            (this.bagFrames ||= new Map()).set(grid, host);
            if (!grid._tlBagObserver && typeof MutationObserver !== 'undefined') {
              grid._tlBagObserver = new MutationObserver(() => this.schedule());
              grid._tlBagObserver.observe(frame.closest('.inventory-window, .warehouse-window') || frame,
                { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            }
          } else if (this.bagFrames?.delete(grid)) {
            grid._tlBagObserver?.disconnect();
            grid._tlBagObserver = null;
          }
          if (bagFilter && host && data) this.drawBagBar(host, data, scoring);
          else this.clearBagFrame(host);
          slots.forEach((slot, i) => {
            const old = slot.querySelector(':scope > .tl-bag-score'),
              eq = list && !slot.classList.contains('empty-slot') ? list.items[i] : null,
              want = eq && scoring ? this.bagLabel(eq, state, prefs, view) : null;
            const set = eq && data && P.setOfTemplate(data.state, P.equipmentTemplateId(eq));
            let tag = slot.querySelector(':scope > .tl-bag-set');
            if (setTag && set) {
              if (!tag) tag = this.bagNode(slot, 'span', 'tl-bag-set');
              const entry = data.byId.get(set.id), cls = 'tl-bag-set' + (entry && entry.owned === entry.total ? ' tl-bag-complete' : '');
              if (tag.className !== cls) tag.className = cls;
              const letter = Array.from(set.name)[0];
              if (tag.textContent !== letter) tag.textContent = letter;
            } else tag?.remove();
            const dim = bagFilter && eq && !P.bagFilterMatch(eq, filter, { setId: set?.id, upgrade: want?.text.startsWith('▲') });
            if (dim && slot.style.opacity !== '0.22') slot.style.opacity = '0.22';
            else if (!dim && slot.style.opacity === '0.22') slot.style.opacity = '';
            if (!want) {
              old?.remove();
              return;
            }
            const el = old || document.createElement('span');
            if (!old) {
              el.className = 'tl-bag-score';
              el.style.cssText =
                'position:absolute;left:1px;bottom:0;font-size:9px;line-height:1;font-weight:700;text-shadow:1px 1px 1px #000,-1px -1px 1px #000;pointer-events:none;z-index:1;white-space:nowrap;';
              slot.appendChild(el);
            }
            if (el.textContent !== want.text) el.textContent = want.text;
            if (el.dataset.color !== want.color) {
              el.dataset.color = want.color;
              el.style.color = want.color;
            }
          });
        }
      }
      scanMarket(cards, state, prefs) {
        const view = state ? MarketScore.prepare(this, state, prefs) : null;
        for (const card of cards) {
          const row = card.querySelector('.item-title')?.parentElement,
            old = Array.from(card.querySelectorAll('.tl-market-score'));
          const want = state && row ? this.label(card, state, prefs, view) : null;
          const keep = want && old.find((n) => n.parentElement === row);
          for (const n of old) if (n !== keep) n.remove();
          if (!want) continue;
          const el = keep || document.createElement('span');
          if (!keep) {
            el.className = 'tl-market-score';
            el.style.cssText =
              'font-size:11px;line-height:16px;padding:0 6px;border:1px solid currentColor;border-radius:4px;white-space:nowrap;font-weight:600;';
            row.appendChild(el);
          }
          if (el.textContent !== want.text) el.textContent = want.text;
          if (el.title !== want.title) el.title = want.title;
          if (el.dataset.color !== want.color) {
            el.dataset.color = want.color;
            el.style.color = want.color;
          }
        }
      }
    }
    function applyConfig(controller, next, preserveData = false) {
      const previous = controller.prefs;
      controller.prefs = next;
      if (!next.battle.smart || next.battle.mapId || !next.battle.enabled) {
        controller.smartDecision = null;
        controller.bridge.holdTargets = false;
      }
      if (!next.disguise.enabled && controller.panel?.cover) controller.panel.toggleDisguise();
      if (previous.storage.indexedDB !== next.storage.indexedDB) controller.logReady = controller.syncLogStorage(controller.logs, preserveData);
      if (!preserveData && previous.logs.keepDays !== next.logs.keepDays) controller.pruneLogs();
      controller.filler?.schedule();
      controller.timer.set(next.tickMs);
      controller.lastSettings = 0;
      controller.suppressed.clear();
      const s = controller.bridge.state();
      if (!preserveData && s && controller.gearRoleId === P.num(s.role.id)) controller.updateGearCheck(s);
      if (!controller.updates) return;
      if (next.updates.checkDaily) {
        controller.updates.start();
        controller.updates.check(!previous.updates.checkDaily).catch(() => {});
      } else controller.updates.stop();
    }
    function loadRoleConfig(controller, id) {
      const panel = controller.panel, previous = controller.prefs;
      const dirty = panel?.pending && JSON.stringify(panel.pending) !== JSON.stringify(previous);
      const own = roleConfig(id);
      controller.configRole = id;
      if (panel?.pending) panel.dirty = dirty;
      if (!own && readStorage(CONFIG, {})?.roleConfig === 'per-role') saveConfig(previous, id);
      applyConfig(controller, own || previous);
      if (!panel?.pending || dirty) return;
      panel.pending = P.clone(controller.prefs);
      panel.bodyDirty = true;
    }
    function observeRole(controller, id) {
      if (!Number.isSafeInteger(id) || id <= 0) return;
      const previous = controller.roleHint;
      controller.roleHint = id;
      if (previous !== id) controller.loadRoleData?.(id, previous);
      try { sessionStorage.setItem(PREFIX + ':role', String(id)); } catch {}
      if (controller.prefs?.roleConfig === 'per-role' && controller.configRole !== id) loadRoleConfig(controller, id);
      if (!controller.provisionalResume) return;
      controller.provisionalResume = false;
      const enabled = shouldResume(controller.prefs, id);
      if (enabled && !controller.enabled) controller.log('已恢复上次托管状态');
      controller.enabled = enabled;
    }
    class Controller {
      loadPauseAndReloads(role) {
        const pause = readTagged('lastPause', role, null);
        this.lastPause = Number.isFinite(pause?.at) && typeof pause.reason === 'string' &&
          typeof pause.byUser === 'boolean' ? pause : null;
        this.reloads = readTagged('reloads', role, []);
      }
      loadRoleData(role, previous) {
        this.bridge?.syncTargetRole?.(role);
        if (!this.logStore) return;
        if (previous || this.provisionalResume) this.loadPauseAndReloads(role);
        else writeStorage(taggedKey('lastPause', role), this.lastPause);
        const visible = this.logs.filter((line) => visibleLog(line, role));
        const cached = quickLogs(role, this.prefs.logs.keepDays, previous ? undefined : visible);
        this.logs = mergedLogs(visible, cached);
        if (this.prefs.storage.indexedDB && this.logStore.supported) this.logReady = this.syncLogStorage(cached);
      }
      resetScoring() {
        this.stats?.resetPressure();
        const tag = P.num(this.bridge.character?.()?.role?.id) || roleTag(this);
        this.bridge.syncTargetRole?.(tag);
        this.bridge.scoringHold = null;
        this.bridge.ringsHold = null;
        this.bridge.cache.profileTargets = {};
        for (const id of P.ASSAULT_IDS) writeStorage(taggedKey('alive:' + id, tag), null);
        const role = this.bridge.character?.()?.role?.id || this.bridge.cache.floorRole;
        if (role) {
          this.bridge.cache.towerFloors = [];
          writeStorage(PREFIX + ':towerFloors:' + role, []);
        }
        this.bridge.cache.monsterTemplates.clear();
        this.bridge.cache.monsterTemplatesAt = 0;
        writeStorage(PREFIX + ':monsters', null);
        this.log('已重置评分数据：生存权重从现在起重新统计，怪物属性将重新读取');
      }
      constructor({ logStore = createLogStore(), now = () => Date.now(), planNow = monotonicNow } = {}) {
        this.now = now;
        this.planNow = planNow;
        this.perf = { lastMs: 0, maxMs: 0, avgMs: 0 };
        this.perfSamples = [];
        this.perfRecent = [];
        this.roleHint = tabRoleHint();
        const global = P.config(readStorage(CONFIG, {}));
        const own = global.roleConfig === 'per-role' && roleConfig(this.roleHint);
        this.configRole = own ? this.roleHint : 0;
        this.prefs = own || global;
        saveConfig(this.prefs, this.configRole);
        this.provisionalResume = !this.roleHint;
        this.enabled = shouldResume(this.prefs, this.roleHint);
        this.reason = '等待游戏角色';
        this.logs = quickLogs(this.roleHint, this.prefs.logs.keepDays);
        this.logStore = logStore;
        this.logQueue = [];
        this.logBatches = new Set();
        this.logDatabaseUsage = P.logSummary([]);
        this.logWriteAt = Date.now();
        this.logEpoch = 0;
        this.loadPauseAndReloads(this.roleHint);
        this.busy = false;
        this.action = null;
        this.arenaCloseUntil = 0;
        this.suppressed = new Map();
        this.id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        this.ledger = null;
        this.roleId = 0;
        this.activity = null;
        this.deaths = [];
        this.penalty = 0;
        this.lastDeathKey = '';
        this.lastLocal = 0;
        this.idleSince = 0;
        this.lastSettings = 0;
        this.manualUntil = 0;
        this.bridge = new Bridge((text, level) => this.log(text, level), this.roleHint);
        this.bridge.scoringNow = now;
        this.bridge.onMessage = (type, packet) => this.received(type, packet);
        this.bridge.onTowerEnd = () => this.towerEnded();
        this.bridge.onLateResponse = (waiter, packet, elapsedMs) => this.lateResponse(waiter, packet, elapsedMs);
        this.bridge.recordStats = (packet) => {
          const own = this.bridge.character()?.role,
            sent = packet.data?.roleInfo?.role || packet.data?.role,
            role = sent && (!own || sent.id === own.id) ? sent : own;
          this.ensureStats(role?.id);
          if (!role || !this.stats) return;
          let settings = packet.type === 'COMBAT_REWARD' ? role.settings || {} : {};
          try { if (typeof settings === 'string') settings = JSON.parse(settings); } catch { settings = {}; }
          this.stats.record(packet, { roleId: role.id, mapId: role.mapId,
            doubleExp: settings.doubleExp?.buffExpireTime > Date.now(),
            potionPrice: (name) => Number(arraySafe(this.bridge.cache.potions).find((p) => p.name === name)?.price) || 0 });
        };
        this.bridge.statsRates = () => this.stats?.rates() || null;
        this.bridge.scoringPrefs = () => this.prefs;
        this.bridge.profilePressure = (name) => this.stats?.pressure((id) => P.mapProfile(id) === name);
        this.bridge.pressure = (maps) => this.stats?.pressure((id) => P.farmMap(P.array(maps).find((m) => P.num(m.id) === id)));
        window.addEventListener('pagehide', () => {
          if (storageBlocked) return;
          this.stats?.flush();
          this.mapRates?.flush();
          this.pendingMapRates?.forEach(rates => rates.flush());
          this.flushLogs();
        });
        this.bridge.onDisconnect = () => {
          this.reason = '等待游戏重连';
          if (!this.prefs.reconnect.enabled) this.pause('连接中断，自动恢复已关闭');
        };
        this.paint = createPaintScheduler(() => this.panel?.paint());
        this.logReady = this.syncLogStorage();
        this.logPruneTimer = setInterval(() => this.pruneLogs(), 3600000);
        if (this.logs.length) this.log('—— 页面重新加载 ——');
        this.keepAwake = createKeepAwake(PREFIX + ':keep-awake');
        this.keepAwakeLogged = null;
        this.timer = createTicker(
          () => this.tick().catch((e) => this.pause(e.message)),
          (e) => this.log('Worker 计时失效，改用主线程计时（后台会降频）：' + e, 'warning'),
        );
        this.timer.set(this.prefs.tickMs);
        this.log(
          this.timer.mode === 'worker'
            ? '计时器：Worker（后台不降频）'
            : '计时器：主线程（Worker 不可用，后台会降频）',
        );
        this.installInteractionPause();
        this.market = new MarketScore(this);
      }
      ensureStats(id) {
        this.ensureGearState(id);
        if (!id || this.statsRoleId === id) return;
        this.stats?.flush();
        this.pendingMapRates ||= new Map();
        if (this.mapRates) {
          this.mapRates.finish(Date.now());
          this.pendingMapRates.set(this.statsRoleId, this.mapRates);
        }
        this.smartDecision = null;
        this.bridge.holdTargets = false;
        this.statsRoleId = id;
        const key = PREFIX + ':stats:' + id;
        this.stats = new Stats({ now: () => Date.now(), read: () => readStorage(key, null),
          write: (value) => writeStorage(key, value) });
        const ratesKey = PREFIX + ':mapRates:' + id;
        this.mapRates = this.pendingMapRates.get(id) ?? new MapRates({ now: () => Date.now(), read: () => readStorage(ratesKey, null),
          write: value => writeStorage(ratesKey, value) });
        this.pendingMapRates.delete(id);
      }
      sampleMaps(character, now) {
        for (const [id, rates] of this.pendingMapRates || []) {
          if (rates.tick(now, { enabled: false, mapId: 0 }) && !rates.data.death) this.pendingMapRates.delete(id);
        }
        const role = character?.role, field = !!role && P.fieldMap(P.roleMap(character));
        const battle = this.mapRates && this.enabled && field ? this.bridge.battle?.() : null;
        this.mapRates?.tick(now, { enabled: this.enabled, mapId: P.num(role?.mapId), field,
          stage: battle?.stage ?? 'idle', dead: !!battle?.player?.isDead || battle?.player?.currentHp <= 0, stats: this.stats });
        if (!this.enabled || !this.prefs.battle?.smart || this.prefs.battle.mapId || !this.prefs.battle.enabled ||
            role && (!field || this.activity?.mapId === P.num(role.mapId))) {
          this.smartDecision = null;
          if (this.bridge) this.bridge.holdTargets = false;
        }
        return battle;
      }
      farmTarget(s, now) {
        const battle = this.prefs.battle, penalty = battle.deathDowngrade ? this.penalty : 0;
        if (!battle.smart || battle.mapId) return P.normalMap(s, this.prefs, penalty);
        const { map, phase, reason, candidates } = P.smartMap(s, this.prefs, this.mapRates?.data, {
          now, mapId: s.role.mapId, doubleExp: P.doubleExpUntil(s.role) > now, gearCheck: !!this.gearCheck, penalty });
        this.smartDecision = { on: true, goal: battle.smartGoal, phase, mapId: map?.id ?? null, reason, candidates };
        this.bridge.holdTargets = this.enabled && battle.enabled && (phase === 'trial' || phase === 'refine');
        return map;
      }
      ensureGearState(id, now = Date.now()) {
        if (!id || this.gearRoleId === id) return;
        this.gearRoleId = id;
        const profile = readStorage(PREFIX + ':gearProfile:' + id, {}) || {};
        this.gearProfile = { worn: P.PROFILE_IDS.includes(profile.worn) ? profile.worn : 'farm',
          loadouts: Object.fromEntries(P.PROFILE_IDS.map((name) => [name, P.array(profile.loadouts?.[name])])),
          pending: P.array(profile.pending), changedAt: P.num(profile.changedAt), mode: profile.mode,
          failures: profile.failures || {}, changed: P.num(profile.changed), names: profile.names || {} };
        const saved = readStorage(PREFIX + ':gearCheck:' + id, null), check = saved?.check;
        this.gearCheck = check && Number.isFinite(check.startedAt) && check.before && check.base &&
          Array.isArray(check.worn) ? check : null;
        this.gearResults = P.array(saved?.results).filter((r) => r && typeof r.text === 'string').slice(0, 10);
        this.gearRejected = P.gearRejected(readStorage(PREFIX + ':gearRejected:' + id, []), now);
        this.saveGearState();
      }
      saveGearState() {
        if (!this.gearRoleId) return;
        writeStorage(PREFIX + ':gearCheck:' + this.gearRoleId, { check: this.gearCheck, results: this.gearResults });
        writeStorage(PREFIX + ':gearRejected:' + this.gearRoleId, this.gearRejected);
      }
      clearGearRejected() {
        this.gearRejected = [];
        this.saveGearState();
        this.log('已清空换回名单');
      }
      gearState(s, now = Date.now()) {
        const rejected = P.gearRejected(this.gearRejected, now);
        if (rejected.length !== P.array(this.gearRejected).length) {
          this.gearRejected = rejected;
          this.saveGearState();
        }
        return { ...s, gearCheck: this.gearCheck, gearRejected: rejected, gearProfile: this.gearProfile };
      }
      saveProfile() {
        writeStorage(PREFIX + ':gearProfile:' + this.gearRoleId, this.gearProfile);
      }
      towerEnded() {
        if (this.prefs.gear.profile !== 'tower') return;
        saveConfigField(this, 'gear', 'profile', 'auto');
        if (this.panel?.pending) this.panel.pending.gear.profile = 'auto';
        this.log('无相浮屠结束，装备方案回到自动');
      }
      updateProfile(s, now) {
        const g = this.gearProfile;
        if (!g || P.profileLocked(s)) return;
        const mode = this.prefs.gear.profile, target = P.gearProfileTarget({ ...s, gearProfile: g,
          gearCheck: this.gearCheck, activity: this.activity || this.arenaPending }, this.prefs, { rings: this.ringsDaily(s.rings) }, now);
        const bag = P.array(s.equipments), warehouse = P.array(s.warehouseEquips);
        let switched = false, dirty = false;
        if (target !== g.worn && (!g.changedAt || now - g.changedAt >= 60000 || mode !== g.mode)) {
          const equipped = bag.filter((e) => e.isEquipped && P.num(P.template(e).slotType) !== 12);
          for (const e of equipped) g.names[e.id] = P.template(e).name;
          g.loadouts[g.worn] = equipped.map((e) => P.num(e.id));
          this.log('装备方案：' + P.profileLabel(g.worn) + ' → ' + P.profileLabel(target) + '（' +
            (mode !== 'auto' ? '手动' : target === 'rings' ? '新三环' : '自动') + '）');
          g.pending = g.loadouts[target].filter((id) => !g.loadouts[g.worn].includes(id));
          // The destination is restored once, including when coming back to farm.
          Object.assign(g, { worn: target, changedAt: now, failures: {}, changed: 0 });
          switched = dirty = true;
        }
        if (g.worn === 'farm' && !this.prefs.gear.assault.enabled)
          for (const name of P.ASSAULT_IDS) if (g.loadouts[name].length) { g.loadouts[name] = []; dirty = true; }
        if (mode !== g.mode) { g.mode = mode; dirty = true; }
        const hadPending = g.pending.length;
        g.pending = g.pending.filter((id) => {
          const eq = bag.find((e) => P.num(e.id) === id), stored = warehouse.find((e) => P.num(e.id) === id);
          if (eq?.isEquipped) g.changed++;
          else {
            const owned = eq || (this.prefs.gear.fromWarehouse && stored);
            if (owned && P.profileWearable(owned, s, this.prefs) && !(g.failures[id] >= 2)) return true;
            this.log('方案装备「' + (P.template(eq || stored).name || g.names[id] || id) + '」不在背包或仓库，已跳过');
          }
          dirty = true;
          return false;
        });
        if ((switched || hadPending) && !g.pending.length)
          // Without a stored loadout the choice by score starts only now; nothing is ready yet.
          this.log(P.longLabel(g.worn) + (switched && !g.loadouts[g.worn].length ? '：首次使用，按评分选装' :
            '已就绪（换装 ' + g.changed + ' 件）'));
        if (dirty) this.saveProfile();
      }
      profileFailure(a) {
        const g = this.gearProfile, id = a.payload.roleEquipId;
        if (!a.profileSwitch || !g?.pending.includes(id)) return;
        g.failures[id] = P.num(g.failures[id]) + 1;
        this.saveProfile();
      }
      gearStatus(s, now = Date.now()) {
        this.ensureGearState(P.num(s?.role?.id), now);
        const check = this.gearCheck;
        return { check: check ? { ...check,
          mapName: P.array(s?.maps).find((m) => P.num(m.id) === check.mapId)?.name || String(check.mapId),
          ...P.gearCheckVerdict(check, P.gearCheckAfter(check, this.stats?.buckets, s), this.prefs, now) } : null,
          results: this.gearResults || [] };
      }
      finishGearCheck(verdict, s, now, restored = false) {
        const check = this.gearCheck, text = P.gearCheckText(check, verdict, s, restored);
        this.gearResults = [{ itemId: check.itemId, itemName: check.itemName, mapId: check.mapId,
          at: now, ...verdict, text }, ...P.array(this.gearResults)].slice(0, 10);
        this.gearCheck = null;
        this.saveGearState();
        this.log(text, verdict.state === 'worse' ? 'warning' : 'info');
      }
      updateGearCheck(s, now = Date.now()) {
        const check = this.gearCheck;
        if (!check) return;
        if (check.verdict?.state === 'worse' && P.gearCheckRestored(check, s)) {
          this.finishGearCheck(check.verdict, s, now, true);
          return;
        }
        const verdict = P.gearCheckVerdict(check, P.gearCheckAfter(check, this.stats?.buckets, s), this.prefs, now);
        if (verdict.state === 'collecting') return;
        if (verdict.state === 'worse') {
          if (!check.verdict) {
            this.gearCheck = { ...check, verdict };
            this.gearRejected = P.gearRejected([{ id: check.itemId, name: check.itemName, at: now, change: verdict.change },
              ...P.array(this.gearRejected)], now);
            this.saveGearState();
          }
          if (P.gearCheckRollback(check, s)) return;
        }
        this.finishGearCheck(verdict, s, now);
      }
      gearEquipped(a, before, after, now = Date.now()) {
        this.ensureStats(P.num(after.role.id));
        if (a.gearSwapBack) {
          this.updateGearCheck(after, now);
          return;
        }
        if (this.gearCheck) return;
        this.gearCheck = P.gearCheckStart(a, before, { ...after, gearProfile: this.gearProfile }, this.stats?.buckets, this.prefs, now);
        if (!this.gearCheck) return;
        this.stats?.flush();
        this.saveGearState();
        this.updateGearCheck(after, now);
      }
      installInteractionPause() {
        this.warehouseShortcuts ||= new WarehouseShortcuts(this);
        this.warehouseShortcuts.start();
        for (const type of ['pointerdown', 'keydown'])
          document.addEventListener(
            type,
            (e) => {
              if (e.isTrusted && !e.composedPath().some((el) => el?.id === 'tl-autopilot-host' || el?.id === 'tl-disguise-host'))
                this.manualUntil = Math.max(this.manualUntil, Date.now() + 5000);
            },
            true,
          );
        document.addEventListener('visibilitychange', () => {
          if (this.enabled) this.tick().catch(() => {});
        });
      }
      log(text, level = 'info') {
        const at = Date.now(), entry = {
          at,
          role: roleTag(this),
          time: P.logTime(at),
          level,
          text: String(text).slice(0, 260),
        };
        this.logs.unshift(entry);
        this.logs = this.logs.slice(0, 500);
        if (this.prefs?.storage.indexedDB && this.logStore?.supported && !this.logError) this.logQueue.push(entry);
        if (Date.now() - (this.logWriteAt || 0) >= 5000) this.flushLogs();
        else if (!this.logTimer) this.logTimer = setTimeout(() => { this.logTimer = null; this.flushLogs(); }, 5000 - (Date.now() - this.logWriteAt));
        this.paint();
      }
      flushLogs() {
        if (storageBlocked) return Promise.resolve();
        clearTimeout(this.logTimer);
        this.logTimer = null;
        this.logs = P.logPrune(this.logs, this.prefs.logs.keepDays);
        writeStorage(taggedKey('log', roleTag(this)), this.logs.slice(0, 60));
        this.logWriteAt = Date.now();
        if (!this.logDatabaseOn || !this.prefs.storage.indexedDB || this.logClearing || !this.logQueue.length) return Promise.resolve();
        const batch = P.logPrune(this.logQueue, this.prefs.logs.keepDays);
        this.logQueue = [];
        const write = this.logStore.append(batch).then(() => {
          this.logDatabaseUsage = P.logCombine(this.logDatabaseUsage, P.logSummary(batch));
        }).catch((error) => this.failLogStorage(error)).finally(() => {
          this.logBatches.delete(record);
          this.paint();
        }), record = { entries: batch, write };
        this.logBatches.add(record);
        return write;
      }
      failLogStorage(error) {
        this.logError = String(error.message || error);
        this.logDatabaseOn = false;
        this.logQueue = [];
        this.paint();
      }
      async syncLogStorage(cached = this.logs, preserveData = false) {
        const epoch = ++this.logEpoch, role = roleTag(this);
        this.logDatabaseOn = false;
        this.logError = '';
        if (!this.prefs.storage.indexedDB || !this.logStore.supported) {
          this.logQueue = [];
          return;
        }
        try {
          if (this.logClearing) {
            await this.logClearing;
            cached = this.logs;
          }
          await this.logStore.open();
          if (epoch !== this.logEpoch || !this.prefs.storage.indexedDB) return;
          if (!preserveData) await this.logStore.prune(P.logCutoff(this.prefs.logs.keepDays, Date.now()));
          await Promise.all(Array.from(this.logBatches, (batch) => batch.write));
          const saved = await this.logStore.read(500, role), usage = await this.logStore.summary();
          if (epoch !== this.logEpoch || !this.prefs.storage.indexedDB) return;
          const imported = cached.filter((entry) => !entry.databaseCleared).reverse();
          this.logQueue = P.logMissing([...P.logMissing(imported, this.logQueue), ...this.logQueue], saved);
          this.logs = mergedLogs(this.logs, saved);
          this.logDatabaseUsage = usage;
          this.logDatabaseOn = true;
          if (this.logQueue.length && !this.logTimer) this.logTimer = setTimeout(() => { this.logTimer = null; this.flushLogs(); }, Math.max(0, 5000 - (Date.now() - this.logWriteAt)));
          this.paint();
        } catch (error) {
          if (epoch === this.logEpoch) this.failLogStorage(error);
        }
      }
      logStorageStatus() {
        return !this.prefs.storage.indexedDB ? '未启用' : !this.logStore.supported ? '浏览器不支持'
          : this.logError ? '打开失败：' + this.logError : this.logDatabaseOn ? '可用' : '未启用';
      }
      logUsage() {
        const key = [this.logs, this.logQueue, this.logDatabaseUsage, this.logBatches.size, this.logDatabaseOn];
        if (!this.logUsageKey || key.some((value, index) => value !== this.logUsageKey[index])) {
          this.logUsageKey = key;
          this.logUsageCache = this.logDatabaseOn
            ? P.logCombine(this.logDatabaseUsage, P.logSummary(this.logQueue), ...Array.from(this.logBatches, (batch) => P.logSummary(batch.entries)))
            : P.logSummary(this.logs);
        }
        return this.logUsageCache;
      }
      async queryLogUsage() {
        await this.logReady;
        if (!this.logDatabaseOn) return P.logSummary([]);
        try {
          const usage = await this.logStore.summary();
          this.logDatabaseUsage = usage;
          return usage;
        } catch (error) { this.failLogStorage(error); return P.logSummary([]); }
      }
      async pruneLogs() {
        if (storageBlocked) return;
        this.logs = P.logPrune(this.logs, this.prefs.logs.keepDays);
        this.logQueue = P.logPrune(this.logQueue, this.prefs.logs.keepDays);
        writeStorage(taggedKey('log', roleTag(this)), this.logs.slice(0, 60));
        if (this.logDatabaseOn && this.prefs.storage.indexedDB && !this.logClearing) {
          try {
            await this.logStore.prune(P.logCutoff(this.prefs.logs.keepDays, Date.now()));
            await this.queryLogUsage();
          } catch (error) { this.failLogStorage(error); }
        }
        this.paint();
      }
      async clearLogDatabase(role = 0) {
        if (storageBlocked) return;
        while (this.logClearing) await this.logClearing;
        ++this.logEpoch;
        this.logQueue = this.logQueue.filter((entry) => !visibleLog(entry, role));
        this.logClearing = (async () => {
          await this.logReady;
          await Promise.all(Array.from(this.logBatches, (batch) => batch.write));
          if (this.logStore.supported) {
            await this.logStore.open();
            await this.logStore.clear(role);
            this.logError = '';
            this.logDatabaseOn = this.prefs.storage.indexedDB;
          }
          // Cleared cache entries remain visible but are not imported into the database again.
          this.logs = this.logs.map((entry) => !visibleLog(entry, role) || this.logQueue.includes(entry) ? entry : { ...entry, databaseCleared: true });
          writeStorage(taggedKey('log', roleTag(this)), this.logs.slice(0, 60));
          this.logDatabaseUsage = role && this.logStore.supported ? await this.logStore.summary() : P.logSummary([]);
          return this.logDatabaseUsage;
        })();
        try { return await this.logClearing; }
        catch (error) { this.failLogStorage(error); throw error; }
        finally {
          this.logClearing = null;
          if (this.logQueue.length && !this.logTimer) this.logTimer = setTimeout(() => { this.logTimer = null; this.flushLogs(); }, Math.max(0, 5000 - (Date.now() - this.logWriteAt)));
          this.paint();
        }
      }
      async clearLogs() {
        this.logs = [];
        writeStorage(taggedKey('log', roleTag(this)), []);
        this.paint();
        return this.clearLogDatabase(roleTag(this));
      }
      async exportData(config) {
        await this.logReady;
        await Promise.all(Array.from(this.logBatches, batch => batch.write));
        const queued = this.logQueue.toReversed();
        const logs = this.logDatabaseOn ? P.logPrune([...queued, ...await this.logStore.read()], this.prefs.logs.keepDays) : [];
        return { format: 'tl-autopilot-full', formatVersion: 1, script: this.status().version,
          exportedAt: Date.now(), host: location.host, roleId: roleTag(this), config, data: this.storageSnapshot(), logs };
      }
      // The stored keys a full export carries, without the prefix.
      storageSnapshot() {
        const data = Object.create(null), prefix = PREFIX + ':';
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key?.startsWith(prefix) || !P.transferKey(key.slice(prefix.length))) continue;
          const value = readStorage(key, undefined);
          if (value !== undefined) data[key.slice(prefix.length)] = value;
        }
        return data;
      }
      async mergeTransferLogs(logs) {
        await this.logReady;
        if (this.logClearing) await this.logClearing;
        if (this.logDatabaseOn) {
          await this.flushLogs();
          await Promise.all(Array.from(this.logBatches, batch => batch.write));
          const missing = P.logMissing(logs, await this.logStore.read());
          if (missing.length) await this.logStore.append(missing);
        }
      }
      // Writes the keys of a merged full import (P.transferMergeData), adds missing logs and reloads.
      async importData(data, logs) {
        if (storageBlocked || restoringData) throw new Error('全量配置已在导入');
        restoringData = true;
        try {
          for (const [key, value] of Object.entries(data)) {
            if (P.transferKey(key)) localStorage.setItem(PREFIX + ':' + key, JSON.stringify(value));
          }
          await this.mergeTransferLogs(logs);
          this.log('已导入全量配置');
          await this.flushLogs();
          saveRunning(this, this.enabled);
          storageBlocked = true;
          this.reloadPage();
        } finally { restoringData = false; }
      }
      reloadPage() {
        location.reload();
      }
      async exportLogs() {
        await this.logReady;
        if (!this.logDatabaseOn) return P.logText(this.logs);
        await Promise.all(Array.from(this.logBatches, (batch) => batch.write));
        const role = roleTag(this), pending = this.logQueue.filter((entry) => visibleLog(entry, role)).reverse();
        const entries = await this.logStore.read(Infinity, role);
        if (role !== roleTag(this)) return this.exportLogs();
        return P.logText(P.logPrune([...pending, ...entries], this.prefs.logs.keepDays));
      }
      ledgerKey(date = day()) {
        return PREFIX + ':ledger:' + this.roleId + ':' + date;
      }
      ringsDaily(r, roleId = this.roleId) {
        if (!r?.day) return null;
        const ledger = this.ledger?.day === r.day && this.roleId === roleId ? this.ledger :
          readStorage(PREFIX + ':ledger:' + roleId + ':' + r.day, null);
        return { day: r.day, rounds: 0, retries: 0, roundOpen: false, cleared: 0, runs: 0, failures: 0,
          refusals: 0, lastRunId: null, lastResult: null, ...ledger?.rings };
      }
      invasionDaily() {
        if (this.ledger.invasion?.day !== this.ledger.day)
          this.ledger.invasion = P.invasionDaily(this.ledger.day);
        return this.ledger.invasion;
      }
      finishInvasion() {
        const daily = this.invasionDaily();
        daily.visitAt = Date.now();
        daily.visits++;
        this.invasionVisit = null;
        this.saveLedger();
      }
      invasionResult(a, before, result) {
        if (this.ledger.day !== day()) this.setRole(this.roleId);
        const { action, runId, teamId } = a.payload, daily = this.invasionDaily();
        const visit = this.invasionVisit, data = result.data || {};
        if (!result.success) {
          const message = safeMessage(result.message || '操作未成功');
          this.log(a.label + ' 被拒绝：' + message, 'warning');
          if (result.message === '请前往大理与崔逢九交谈') {
            this.bridge.cache.invasionMapId = 0;
            visit.travel = true;
            if (visit.travelAttempts >= 3) this.finishInvasion();
          } else {
            if (action === 'join') daily.refused.teams.push(teamId);
            if (action === 'create') daily.refused.rounds.push(before.invasion.board.roundId);
            if (runId) daily.refused.runs.push(runId);
            if (++visit.refusals >= 3) this.finishInvasion();
          }
        } else {
          if (!a.quiet) this.log(a.label + '：完成', 'success');
          if (action === 'join') {
            daily.joined++;
            const team = data.board?.teams?.find(t => t.id === teamId);
            if (!visit.joinPush && (team?.members?.length === 4 || team?.status === 'PREPARING')) {
              daily.fights++;
              this.invasionAwaitPush = true;
            }
          }
          if (action === 'create') daily.created++;
          if (action === 'claim') {
            daily.claimed++;
            const run = before.invasion.board.runs.find(r => r.id === runId);
            if (typeof run?.won === 'boolean') daily[run.won ? 'won' : 'lost']++;
          }
          if (action === 'report' && data.report) {
            daily.reports.push(runId);
            const r = data.report, seconds = Math.floor(P.num(r.duration) / 1000);
            const me = r.players.find(p => p.roleId === before.role.id);
            const loot = r.loot.filter(i => i.recipient === before.role.id).map(i => i.name + ' × ' + i.count);
            this.log('宵小入侵战报：' + r.reason + '，用时 ' + Math.floor(seconds / 60) + ' 分 ' + seconds % 60 +
              ' 秒，我的伤害占 ' + Number(P.num(me?.damagePercent).toFixed(2)) + '%，获得 ' + (loot.join('、') || '无'));
          }
        }
        this.saveLedger();
      }
      saveRingsDaily(daily) {
        if (this.ledger.day === daily.day) {
          this.ledger.rings = daily;
          writeStorage(this.ledgerKey(daily.day), this.ledger);
        } else {
          const key = this.ledgerKey(daily.day), ledger = readStorage(key, null) || P.freshLedger(daily.day);
          writeStorage(key, { ...ledger, rings: daily });
        }
      }
      observeRings(r, entered = false) {
        const d = this.ringsDaily(r);
        if (!d) return;
        let changed = false;
        if (entered && d.refusals) {
          d.refusals = 0;
          changed = true;
        }
        if (entered && r.run && !d.owned) {
          if (d.roundOpen) {
            d.retries++;
            this.log('新三环第 ' + d.rounds + ' 轮：失败后第 ' + d.retries + ' 次重试', 'warning');
          } else {
            d.rounds++;
            d.retries = 0;
            d.roundOpen = true;
          }
          d.previousClearId = r.lastSettlement?.stage === 2 && r.lastSettlement.reason === '通关'
            ? r.lastSettlement.runId : null;
          d.owned = true;
          d.runs++;
          changed = true;
        }
        const last = r.lastSettlement;
        const settlementKey = last && JSON.stringify([last.runId, last.stage]);
        if (last?.day === r.day && !d.settlements?.includes(settlementKey)) {
          // The settlement found at the first look of the day happened before the script watched: no log line.
          const seenBefore = !!d.settlements;
          (d.settlements ||= []).push(settlementKey);
          d.lastRunId = last.runId;
          d.lastResult = copy(last);
          const cleared = last.reason === '通关', result = cleared ? last.rewarded ?
            '通关，神兵符 绑定 ' + P.num(last.bound) + ' / 不绑定 ' + P.num(last.unbound) :
            '通关，今日该环奖励已满' : last.reason === '挑战失败' ? '挑战失败' : '挑战失败（' + last.reason + '）';
          if (seenBefore || d.owned)
            this.log('新三环 ' + P.ringStage(last.stage) + '：' + result, cleared ? 'success' : 'warning');
          changed = true;
        }
        if (d.owned && !r.run) {
          if (last?.stage === 2 && last.day === r.day && last.reason === '通关' &&
              last.runId !== d.previousClearId) {
            d.cleared++;
            d.roundOpen = false;
          } else d.failures++;
          d.owned = false;
          changed = true;
        }
        if (d.roundOpen && !r.run && d.retries >= this.prefs.rings.maxRetries) {
          d.roundOpen = false;
          this.log('新三环第 ' + d.rounds + ' 轮失败，重试 ' + d.retries + ' 次后结束本轮', 'warning');
          changed = true;
        }
        if (!r.run && !d.doneLogged && r.counts?.length === 3 && r.counts.every((n) => n >= 2)) {
          this.log('新三环今日已完成', 'success');
          d.doneLogged = changed = true;
        } else if (!d.doneLogged && !d.stopLogged && !d.roundOpen && d.rounds >= this.prefs.rings.roundsPerDay) {
          this.log('新三环今日 ' + d.rounds + ' 轮已打完', 'warning');
          d.stopLogged = changed = true;
        }
        if (changed) this.saveRingsDaily(d);
      }
      ringsRefused(a, r, message) {
        this.log(a.label + '：' + message, 'warning');
        this.suppress(a, 300000);
        if (a.payload.action !== 'enter' || !r?.day) return;
        const d = this.ringsDaily(r);
        if (++d.refusals === 3) this.log('新三环进入被拒绝：' + message, 'warning');
        this.saveRingsDaily(d);
      }
      saveLedger() {
        if (this.ledger) writeStorage(this.ledgerKey(), this.ledger);
      }
      setRole(id) {
        this.ensureGearState(id);
        if (this.roleId !== id || this.ledger?.day !== day()) {
          if (this.roleId !== id) {
            this.invasionAwaitPush = false;
            this.invasionVisit = null;
          }
          this.roleId = id;
          // Recruiting teams and two-hour rounds can span local midnight.
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          this.invasionPriorRefused = readStorage(this.ledgerKey(day(yesterday)), null)?.invasion?.refused;
          this.ledger = P.normalizeLedger(readStorage(this.ledgerKey(), null), day());
          this.saveLedger();
          this.activity = null;
          this.suppressed.clear();
          this.bridge.cache.activityStatus = {};
        }
        observeRole(this, id);
      }
      leaseKey() {
        return PREFIX + ':lease:' + this.roleId;
      }
      acquireLease() {
        const now = Date.now(),
          lease = readStorage(this.leaseKey(), null);
        if (lease?.id !== this.id && lease?.until > now) return false;
        writeStorage(this.leaseKey(), { id: this.id, until: now + 15000 });
        return readStorage(this.leaseKey(), {}).id === this.id;
      }
      releaseLease() {
        if (storageBlocked) return;
        const lease = readStorage(this.leaseKey(), null);
        if (lease?.id === this.id)
          try {
            localStorage.removeItem(this.leaseKey());
          } catch {}
      }
      async start() {
        if (this.busy) {
          this.log('当前动作尚未完成，等待响应后再开始', 'warning');
          return;
        }
        const wasUncertain = !!this.uncertain,
          fromLateResponse = this.timeoutResume && this.timeoutResume === this.lastPause;
        if (wasUncertain && this.bridge.connected && this.bridge.sessionReady) {
          const s = this.bridge.state();
          if (!s) return;
          this.setRole(P.num(s.role.id));
          this.cleanPetLedger(s.pets);
        }
        this.provisionalResume = false;
        this.enabled = true;
        this.timeoutPause = null;
        this.timeoutResume = null;
        this.lastPause = null;
        writeStorage(taggedKey('lastPause', roleTag(this)), null);
        saveRunning(this, true);
        this.reason = '正在检查角色与策略';
        // Automatic recovery retains cooldowns so retries do not consume unkeyed late replies.
        if (!wasUncertain && !fromLateResponse) this.suppressed.clear();
        this.log('完整托管已开始');
        if (wasUncertain && this.bridge.connected && this.bridge.sessionReady) {
          await this.reconcileRole();
          if (this.uncertain || !this.enabled) return;
        }
        this.tick().catch((e) => this.pause(e.message));
      }
      async reconcileRole(now = Date.now()) {
        if (this.busy || now - (this.lastReconcileAt ?? -Infinity) < 30000) return;
        this.lastReconcileAt = now;
        await this.execute({
          kind: 'request',
          type: 'ENTER_GAME',
          payload: {},
          label: '重新读取角色，核对上个动作结果',
          family: 'read',
          moneyCost: 0,
          expCost: 0,
          readOnly: true,
          key: 'reconcile-role',
        });
      }
      pause(reason = '已暂停托管', byUser = false) {
        this.timeoutPause = null;
        this.timeoutResume = null;
        this.lastPause = { at: Date.now(), reason, byUser };
        writeStorage(taggedKey('lastPause', roleTag(this)), this.lastPause);
        this.enabled = false;
        // Any pause is final for this page load: a later role discovery must not switch the autopilot on again.
        this.provisionalResume = false;
        saveRunning(this, false);
        this.reason = reason;
        this.releaseLease();
        this.log(reason, 'warning');
      }
      pauseForTimeout(reason) {
        if (!this.enabled) return;
        this.pause(reason);
        this.timeoutPause = this.lastPause;
      }
      responseTimeout(now = Date.now()) {
        if (this.adaptiveUntil && now >= this.adaptiveUntil) {
          const changed = this.adaptiveTimeoutMs > this.prefs.requestTimeoutMs;
          this.adaptiveTimeoutMs = 0;
          this.adaptiveUntil = 0;
          if (changed) this.log('服务器回应恢复正常，等待时间恢复为 ' + this.prefs.requestTimeoutMs / 1000 + ' 秒');
        }
        return Math.max(this.prefs.requestTimeoutMs, this.adaptiveTimeoutMs || 0);
      }
      lateResponse(waiter, packet, elapsedMs) {
        const now = Date.now(), previous = this.responseTimeout(now);
        if (waiter.ringsAction === 'enter' && waiter.roleId === this.roleId &&
            packet.success && packet.data?.rings?.run) {
          this.observeRings(packet.data.rings, true);
          this.bridge.invalidateRings();
        }
        this.responseTimeouts = (this.responseTimeouts || []).filter((entry) =>
          entry.waiter !== waiter && now - entry.at < 600000);
        this.lateAnswers = [...(this.lateAnswers || []).filter((at) => now - at < 600000), now];
        this.adaptiveTimeoutMs = Math.max(this.prefs.requestTimeoutMs, Math.min(60000, 2 * elapsedMs));
        this.adaptiveUntil = now + 600000;
        if (this.adaptiveTimeoutMs !== previous)
          this.log('服务器回应变慢，等待时间暂时放宽到 ' + this.adaptiveTimeoutMs / 1000 + ' 秒', 'info');
        this.log(waiter.label + '：服务器迟到的回应已收到（' + Math.round(elapsedMs / 1000) + ' 秒）', 'info');
        if (this.timeoutPause && this.lastPause === this.timeoutPause && !this.enabled &&
            !this.lastPause.byUser && now - this.lastPause.at <= 15000 && this.responseTimeouts.length < 3) {
          this.timeoutResume = this.timeoutPause;
          this.resumeAfterLateResponse();
        }
      }
      resumeAfterLateResponse() {
        if (!this.timeoutResume || this.timeoutResume !== this.lastPause || this.enabled || this.busy ||
            this.lastPause.byUser || this.responseTimeouts.length >= 3) return;
        this.log('迟到的回应已收到，继续托管');
        this.start().catch((e) => this.pause(e.message));
      }
      stopBattle() {
        const stopped = this.bridge.setBattle(false);
        this.reason = stopped ? '战斗已停止' : '未找到战斗停止入口';
        this.paint();
        return stopped;
      }
      updateConfig(value, { preserveData = false } = {}) {
        const next = P.config(value), changed = next.roleConfig !== this.prefs.roleConfig;
        if (!changed) next.roleConfig = readStorage(CONFIG, {})?.roleConfig === 'per-role' ? 'per-role' : 'shared';
        this.configRole = next.roleConfig === 'per-role' ? this.roleId || this.roleHint || 0 : 0;
        if (changed && this.configRole) saveConfig(next, 0);
        saveConfig(next, this.configRole);
        if (changed && next.roleConfig === 'shared') clearRoleConfigs();
        applyConfig(this, next, preserveData);
        this.log('策略配置已保存');
        return copy(this.prefs);
      }
      preview() {
        const s = this.bridge.state();
        if (!s) return [];
        this.setRole(P.num(s.role.id));
        this.cleanPetLedger(s.pets);
        return this.planningPass(s, this.prefs)
          .map((a) => ({
            type: a.type,
            label: a.label,
            coinCost: a.moneyCost,
            expCost: a.expCost,
            requiresTown: a.requiresTown,
          }))
          .slice(0, 12);
      }
      hudStatus() {
        const role = this.bridge.character()?.role, now = Date.now();
        if (!this.hudIncome || this.hudIncome.roleId !== role?.id || now - this.hudIncome.at >= 5000) {
          const recent = role?.id && this.statsRoleId === role.id ? this.stats?.summary().recent : null;
          this.hudIncome = { roleId: role?.id, at: now, value: recent?.wall >= 60000 ? recent.exp * 3600000 / recent.wall : null };
        }
        const pausedBySelf = !this.enabled && this.lastPause?.byUser === false && !!this.lastPause.reason;
        const release = this.updates?.status();
        return { enabled: this.enabled, connected: this.bridge.connected, ready: this.bridge.sessionReady,
          reason: pausedBySelf ? '托管已自行暂停（' + new Date(this.lastPause.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) + '）：' + this.lastPause.reason : this.reason,
          pausedBySelf, role: role?.id ? { nickname: role.nickname, level: role.level } : null,
          expPerHour: this.hudIncome.value, update: release ? { newer: release.newer, latestVersion: release.latestVersion, dismissed: release.dismissed } : null };
      }
      status() {
        const s = this.bridge.state(),
          battle = this.bridge.battle(),
          today = day(),
          roleId = P.num(s?.role?.id);
        const sourceLedger = roleId
          ? this.roleId === roleId && this.ledger?.day === today
            ? this.ledger
            : readStorage(PREFIX + ':ledger:' + roleId + ':' + today, null)
          : null;
        const ledger = roleId ? P.normalizeLedger(sourceLedger, today) : null;
        const experienceBudgets = ledger
          ? {
              skill: P.experienceBudget(this.prefs, ledger, 'skill'),
              smelt: P.experienceBudget(this.prefs, ledger, 'smelt'),
            }
          : null;
        const skillUp = P.skillProgress(s, this.prefs, ledger);
        if (skillUp?.ready) {
          const sk = P.array(s.skills).find((v) => P.num(v.id) === skillUp.skill);
          const key = 'UPGRADE_SKILL:' + JSON.stringify({ roleSkillId: skillUp.skill }) + ':level=' + P.num(sk?.currentLevel);
          if (!this.enabled) skillUp.reason += '；点击“开始托管”后继续';
          else if ((this.suppressed.get(key) || 0) > Date.now())
            skillUp.reason += '；上次升级未确认，暂缓重试';
          else if (P.levelProgress(s, this.prefs, ledger)?.ready && !this.prefs.growth.skillBeforeLevel)
            skillUp.reason += '；排在人物升级之后';
        }
        const levelUp = P.levelProgress(s, this.prefs, ledger);
        if (levelUp?.ready) {
          const key = 'LEVEL_UP:{}:level=' + levelUp.currentLevel;
          if (!this.enabled)
            Object.assign(levelUp, {
              ready: false,
              code: 'paused',
              reason: '人物升级条件已满足；点击“开始托管”后继续',
            });
          else if (this.uncertain)
            Object.assign(levelUp, {
              ready: false,
              code: 'uncertain',
              reason: '上个动作结果待核对，人物升级暂缓',
            });
          else if ((this.suppressed.get(key) || 0) > Date.now())
            Object.assign(levelUp, {
              ready: false,
              code: 'deferred',
              reason: '上次人物升级尚待复查，暂缓重试',
            });
          else if (
            [20050, 20051, 20052].includes(P.num(s.role.mapId)) ||
            (this.activity && this.activity.mapId === P.num(s.role.mapId))
          )
            Object.assign(levelUp, {
              ready: false,
              code: 'activity',
              reason: '活动结束后继续人物升级',
            });
        }
        const gear = this.gearStatus(s), mode = this.prefs.gear.profile,
          worn = (s && this.gearProfile?.worn) || 'farm', rings = this.ringsDaily(s?.rings, roleId);
        const scoring = (state, prefs) => ({ since: this.stats?.pressureFrom?.at ?? null, ...P.scoringStatus(state, prefs),
          pending: prefs.gear.scoring === 'combat' && !P.combatWeights(state, prefs), weights: P.combatWeights(state, prefs) });
        const status = { scoring: { mode: this.prefs.gear.scoring, aoeTargets: s?.aoeTargets, ...scoring(s, this.prefs) } };
        const scores = { farm: { ...status.scoring } };
        status.scoring.profiles = scores;
        const profiles = P.PROFILE_IDS.map((id) => {
          const available = id === 'farm' || P.assaultAvailable(s, this.prefs, id);
          const why = available ? '' : !this.prefs.gear.assault.enabled ? '攻坚方案未启用' :
            this.prefs.gear.scoring !== 'combat' ? '固定权重评分下没有攻坚方案' : P.ASSAULT_PROFILES[id].waiting;
          if (id !== 'farm') {
            scores[id] = null;
            if (available) {
              const view = P.profileView(s, this.prefs, id);
              scores[id] = { mode: view.prefs.gear.scoring, aoeTargets: view.state.aoeTargets, ...scoring(view.state, view.prefs) };
              if (id === 'tower') {
                const floors = view.state.scoreTargets.floors;
                Object.assign(scores[id], { floors, mapNames: floors.map((n) => '第 ' + n + ' 层'),
                  highestFloor: s.trial?.highestFloor, lastDeathFloor: s.trial?.lastDeathFloor });
              }
            }
          }
          return { id, label: P.profileLabel(id), available, why };
        });
        return {
          network: { timeoutMs: this.responseTimeout(),
            lateAnswers: (this.lateAnswers || []).filter((at) => Date.now() - at < 600000).length,
            pendingQueries: this.bridge.queryWaiters?.size ?? this.pendingQueries?.size ?? 0 },
          perf: this.perfStatus(),
          gear,
          gearProfile: { enabled: this.prefs.gear.enabled, profiles, mode, worn, pending: s ? P.array(this.gearProfile?.pending).length : 0,
            target: s ? P.gearProfileTarget({ ...s, gearProfile: this.gearProfile, gearCheck: this.gearCheck,
              activity: this.activity || this.arenaPending }, this.prefs, { rings }, Date.now()) : 'farm',
            reason: mode === 'auto' ? '自动' : '手动' },
          stats: this.stats ? { summary: this.stats.summary(), rates: this.stats.rates(), series: this.stats.series() } : null,
          smartMap: this.prefs.battle.smart && !this.prefs.battle.mapId ? this.smartDecision ?? null : null,
          potions: Object.fromEntries(['HP', 'MP'].map((attr) => {
            const pick = s?.role ? P.potionPick(s, this.prefs, attr, Date.now()) : null;
            return [attr.toLowerCase(), pick ? { name: pick.template.name, need: pick.need, perSecond: pick.perSecond, reason: pick.reason } : null];
          })),
          threshold: s?.role ? P.potionThreshold(s, this.prefs, Date.now()) : this.prefs.potions.hpThreshold,
          enabled: this.enabled,
          connected: this.bridge.connected,
          ready: this.bridge.sessionReady,
          connection: {
            socket: !this.bridge.socket ? 'none' : this.bridge.connected ? 'open' :
              this.bridge.socket.readyState === 0 ? 'connecting' : 'closed',
            adopted: !!this.bridge.adopted,
            sessionReady: !!this.bridge.sessionReady,
            reconnectModal: !!this.bridge.reconnectVisible?.(),
            storeRole: !!this.bridge.character?.()?.role?.id,
          },
          reason: !this.enabled && this.lastPause?.byUser === false ? '托管已自行暂停（' + new Date(this.lastPause.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) + '）：' + this.lastPause.reason : this.reason,
          busy: this.busy,
          action: this.action?.label || '',
          role: s?.role
            ? {
                id: s.role.id,
                nickname: s.role.nickname,
                level: s.role.level,
                money: s.role.money,
                currentExp: s.role.currentExp,
                mapId: s.role.mapId,
              }
            : null,
          map: s ? P.roleMap(s)?.name || String(s.role.mapId) : '',
          stage: battle.stage,
          activity: this.activity?.name || '',
          budget: copy(this.prefs.budget),
          experienceBudgets,
          levelUp,
          skillUp,
          arena: s?.arena?.board ? { rank: s.arena.board.ownRank,
            attempts: ledger?.arena.attempts ?? 0, liked: s.arena.board.liked,
            reward: s.arena.board.reward } : null,
          rings: P.ringsStatus(s, this.prefs, this.ringsDaily(s?.rings, roleId)),
          invasion: P.invasionStatus(s, this.prefs, ledger?.invasion, Date.now()),
          hidden: s?.trial?.weapon ? { level: s.trial.level, quality: s.trial.weapon.quality,
            sand: s.trial.balances?.sand, jade: s.trial.balances?.jade,
            seals: s.trial.balances?.seals } : null,
          ledger: ledger ? copy(ledger) : null,
          lastFailure: this.lastFailure ? copy(this.lastFailure) : null,
          updates: this.updates ? this.updates.status() : null,
          logs: this.logs.slice(0, this.prefs.logs.showCount),
          ...status,
          pets: { count: s?.pets?.pets.length ?? null, capacity: s?.pets?.capacity ?? null,
            ...P.breedingStatus(s?.pets, Date.now()),
            active: s?.pets?.pets.find((entry) => entry.pet.id === s.pets.activePetId) || null,
            eggs: s ? P.petEggs(s).reduce((sum, item) => sum + P.num(item.count), 0) : null,
            list: s?.pets?.pets || null },
          version: '1.3.3',
        };
      }
      received(type, packet) {
        if (type === 'XIAOXIAO_STATE') {
          const roleId = P.num(this.bridge.character()?.role?.id);
          if (roleId && (!packet.data?.roleInfo?.role || roleId === packet.data.roleInfo.role.id)) {
            this.setRole(roleId);
            if (!this.invasionAwaitPush) this.invasionDaily().fights++;
            this.invasionAwaitPush = false;
            if (this.action?.family === 'invasion' && this.action.payload.action === 'join' && this.invasionVisit)
              this.invasionVisit.joinPush = true;
            this.saveLedger();
            this.log('宵小入侵：已开战，药品已扣除');
          }
        }
        if (type === 'ENTER_GAME_RESPONSE' && packet.success) {
          this.invasionVisit = null;
          this.invasionAwaitPush = false;
          this.uncertain = false;
          if (this.lastFailure && !this.lastFailure.reconciledAt)
            this.lastFailure.reconciledAt = new Date().toISOString();
          this.reason = this.enabled ? '连接恢复，重新读取角色与计划' : '角色已就绪';
          if (this.enabled) this.log('角色快照已恢复，继续核对托管计划');
        }
        if (type === 'WUSHUANG_CLAIM_RESPONSE' && packet.success)
          this.bridge.cache.activityStatus.wushuang = {
            ...this.bridge.cache.activityStatus.wushuang, claimedToday: true,
          };
        if (type === 'ZL_CLAIM_TOKEN_RESPONSE' && packet.success)
          delete this.bridge.cache.activityStatus.zl;
        if (type === 'ZL_ENTER_RESPONSE' && packet.success)
          delete this.bridge.cache.activityStatus.zl;
        if (type === 'CAMP_ENTER_RESPONSE' && packet.success)
          delete this.bridge.cache.activityStatus.camp;
        this.paint();
      }
      perfStatus() {
        const now = this.now?.() ?? Date.now();
        this.perfSamples = (this.perfSamples || []).filter((sample) => now - sample.at <= 600000);
        this.perf ||= { lastMs: 0, maxMs: 0, avgMs: 0 };
        this.perf.maxMs = this.perfSamples.reduce((max, sample) => Math.max(max, sample.ms), 0);
        return { ...this.perf };
      }
      planningPass(state, prefs, now = Date.now()) {
        const clock = this.planNow || monotonicNow, started = clock();
        try {
          const s = this.gearState(state, now);
          if (!prefs.rings?.enabled && !prefs.invasion?.enabled) return P.plans(s, prefs, this.ledger, now);
          return P.plans({ ...s, invasionVisit: this.invasionVisit, invasionPriorRefused: this.invasionPriorRefused,
            activity: this.activity || this.arenaPending || s.activity,
            ringsFighting: !!s.rings?.run && (this.bridge.ringsCombat || this.bridge.battle().stage === 'running'),
            ringsStartAt: this.ringsStartAt }, prefs,
          { ...this.ledger, rings: this.ringsDaily(s.rings) }, now);
        } finally {
          const ended = clock(), ms = Math.max(0, ended - started), at = this.now?.() ?? Date.now();
          this.nextPlanAt = ended + 4 * ms;
          (this.perfSamples ||= []).push({ at, ms });
          (this.perfRecent ||= []).push(ms);
          if (this.perfRecent.length > 20) this.perfRecent.shift();
          this.perf = { lastMs: ms, maxMs: 0,
            avgMs: this.perfRecent.reduce((sum, value) => sum + value, 0) / this.perfRecent.length };
          this.perfStatus();
          if (ms > 200 && (this.perfWarningAt == null || at - this.perfWarningAt >= 3600000)) {
            this.perfWarningAt = at;
            this.log('策略计算耗时 ' + Math.round(ms) + ' 毫秒，已自动放慢检查频率；请把这条日志反馈给作者', 'warning');
          }
        }
      }
      suppress(a, ms = 300000) {
        this.suppressed.set(a.key, Date.now() + ms);
      }
      charge(a) {
        if (a.readOnly || a.noResponse) return;
        this.ledger.money += a.moneyCost || 0;
        P.recordExperience(this.ledger, a.type, a.expCost);
        this.ledger.ops[a.family] = P.num(this.ledger.ops[a.family]) + 1;
        if (a.stockItemId) {
          this.ledger.restock = this.ledger.restock || {};
          this.ledger.restock[a.stockItemId] = true;
        }
        this.saveLedger();
      }
      cleanPetLedger(state) {
        if (!state) return;
        const ids = (this.ledger.petHatched || []).filter((id) =>
          state.pets.some((entry) => entry.pet.id === id && P.petScreenable(entry, state)));
        if (JSON.stringify(ids) !== JSON.stringify(this.ledger.petHatched)) {
          this.ledger.petHatched = ids;
          this.saveLedger();
        }
      }
      batchFallback() {
        this.bridge.noBatchSell = true;
        this.log('批量出售没有得到确认，本次运行改为逐件出售', 'warning');
        this.saveLedger();
      }
      welfareResult(a, before, result, error) {
        const success = !!(result && (result.success ?? result.code === 200)),
          unknown = !result || !success && !!result.data?.retryable,
          receipt = result?.data?.receipt,
          period = receipt?.period ?? a.welfarePeriod ?? before.welfare?.period ?? String(a.payload.drawAt),
          cost = (a.payload.currency === 'GOLD' ? 100000 : 100) * a.payload.multiplier;
        if (success || unknown) {
          const ledger = this.ledger.welfare || (this.ledger.welfare = P.freshLedger(this.ledger.day).welfare),
            currency = a.payload.currency === 'GOLD' ? 'gold' : 'yuanbao';
          ledger[currency] += cost;
          ledger.bets++;
          ledger.periods[period] = P.num(ledger.periods[period]) + 1;
        }
        if (success)
          this.log('福彩投注成功：第 ' + period + ' 期 · ' +
            (receipt?.numbers || a.payload.numbers).join('、') + ' · ' +
            (receipt?.multiplier ?? a.payload.multiplier) + '倍', 'success');
        else {
          this.log('福彩投注' + (unknown ? '结果未确认，已按投注计入额度，本期不再尝试' : '失败') +
            '：' + safeMessage(error?.message || result?.message || '未收到确认'), 'warning');
          const state = before.welfare,
            serverNow = state ? P.num(state.serverTime) + Date.now() - P.num(state.at) : Date.now();
          this.suppress(a, Math.max(60000, Math.min(1800000, P.num(a.payload.drawAt) - serverNow)));
          delete this.bridge.cache.welfare;
        }
        this.saveLedger();
      }
      queryPending(a) {
        return this.pendingQueries?.has(responseKey(a)) ||
          [...(this.pendingQueries?.values() || [])].some((pending) => a.key && pending.key === a.key) ||
          this.bridge.responsePending?.(a);
      }
      async executeQueries(list) {
        const keys = new Set(), actionKeys = new Set(), queries = list.filter((a) => {
          if (!parallelQuery(a) || keys.size >= 6 || (a.key && actionKeys.has(a.key)) || this.queryPending(a) ||
              (this.suppressed.get(a.key) || 0) >= Date.now()) return false;
          ensureRequestId(a);
          const key = responseKey(a);
          if (keys.has(key)) return false;
          keys.add(key);
          if (a.key) actionKeys.add(a.key);
          return true;
        });
        if (!queries.length) return;
        const batch = { multiple: queries.length > 1, completed: new Set(), unattributed: 0 };
        if (batch.multiple) this.log('查询：' + queries.map((a) => a.label).join('、'));
        await Promise.all(queries.map(async (a) => {
          const key = responseKey(a);
          (this.pendingQueries ||= new Map()).set(key, a);
          try { await this.execute(a, batch); }
          finally { this.pendingQueries.delete(key); }
        }));
        if (batch.unattributed)
          this.log('服务器返回错误，' + batch.unattributed + ' 个查询稍后重试', 'warning');
        const completed = queries.filter((a) => batch.completed.has(a));
        if (batch.multiple && completed.length)
          this.log('查询完成：' + completed.map((a) => a.label).join('、'), 'success');
      }
      async execute(a, queryBatch = null) {
        if (!this.acquireLease()) {
          this.reason = '此角色已在另一标签页托管';
          return;
        }
        const arenaClaim = a.type === 'ARENA_COMMAND' && a.payload.action === 'claim';
        const trialClaim = a.type === 'TRIAL_COMMAND' && a.payload.action === 'claim';
        const lotteryDraw = a.type === 'ONLINE_LOTTERY_COMMAND' && a.payload.action === 'draw';
        const welfareBet = a.type === 'WELFARE_LOTTERY_COMMAND' && a.payload.action === 'bet';
        const trialAction = a.type === 'TRIAL_COMMAND' && a.payload.action !== 'status',
          trialSignature = () => JSON.stringify(['revision', 'balances', 'inbox', 'weapon', 'level']
            .map((key) => this.bridge.cache.trial?.trial?.[key])),
          trialBefore = trialAction ? trialSignature() : null;
        const petSignature = () => JSON.stringify(['pets', 'activePetId', 'pendingRewards']
          .map((key) => this.bridge.cache.pets?.state?.[key]));
        const petBefore = petSignature();
        const snapshot = this.bridge.state(), before = snapshot && { ...snapshot, gearProfile: this.gearProfile };
        const petSession = this.bridge.cache.petHall;
        if (!before) return;
        if (a.breedSuccess) {
          const town = P.townFor(before, P.NPC.petKeeper);
          if (!this.enabled || !town || P.num(town.id) !== P.num(before.role.mapId)) return;
          const current = P.plans(before, this.prefs, this.ledger, Date.now()).find((v) => v.key === a.key);
          if (!current || current.payload.listingId !== a.payload.listingId || current.payload.revision !== a.payload.revision) return;
          a = current;
        }
        if (a.family === 'invasion') {
          const current = P.invasionPlan({ ...before, activity: this.activity || this.arenaPending || before.activity,
            invasionVisit: this.invasionVisit, invasionPriorRefused: this.invasionPriorRefused }, this.prefs, this.ledger, Date.now());
          if (!this.enabled || current?.key !== a.key || P.num(before.role.mapId) !== 6 || this.invasionVisit?.travel) return;
        }
        if (P.profileLocked(before) && (a.type === 'EQUIP_ITEM' || a.family === 'gear')) return;
        const ringsCommand = a.type === 'RINGS_COMMAND', ringsEpoch = this.bridge.ringsEpoch;
        if (a.family === 'rings') {
          const current = P.ringsPlan({ ...before, activity: this.activity || this.arenaPending,
            gearCheck: this.gearCheck, ringsStartAt: this.ringsStartAt,
            ringsFighting: !!before.rings?.run && (this.bridge.ringsCombat || this.bridge.battle().stage === 'running') },
          this.prefs, this.ringsDaily(before.rings), Date.now(), {
            hasGearAction: () => this.planningPass(before, this.prefs).some(P.gearChange) });
          if (!this.enabled || !current || current.key !== a.key ||
              (a.requiresTown && P.num(before.role.mapId) !== P.num(before.rings?.townId))) return;
          if (ringsCommand && !a.readOnly) a.payload.revision = before.rings.revision;
          if (a.type === 'COMBAT_START') this.ringsStartAt = Date.now();
        }
        const check = P.materialCheck(a, before, this.prefs);
        if (!check.ok || !P.allowed(a, before, this.prefs, this.ledger)) {
          this.reason = a.label + '：' + (check.ok ? '当前资源或预算不足' : check.reason);
          this.log(this.reason, 'warning');
          this.suppress(a, 60000);
          if (!queryBatch) this.lastLocal = Date.now();
          this.paint();
          return;
        }
        if (!queryBatch) {
          this.busy = true;
          this.action = a;
          this.reason = a.label;
        }
        if (a.family === 'invasion') {
          this.invasionVisit ||= { refusals: 0, travelAttempts: 0, at: Date.now() };
          if (a.payload.action === 'join' || a.payload.action === 'create') {
            this.invasionAwaitPush = false;
            this.invasionVisit.joinPush = false;
          }
        } else if (!welfareBet) this.charge(a);
        // Stamped before sending: an unanswered request must not lead to a second pill.
        if (a.doubleExp) {
          this.ledger.tianlingUsedAt = Date.now();
          this.saveLedger();
        }
        if (!queryBatch?.multiple && !a.quiet) this.log(a.label);
        this.paint();
        try {
          const result = await this.bridge.request(a, this.responseTimeout());
          if (a.breedSuccess) {
            if (result.success) this.log(a.breedSuccess, 'success');
            else {
              this.log(result.data?.message || result.message || '繁殖操作未成功', 'warning');
              this.suppress(a, 300000);
            }
            return;
          }
          if (a.family === 'invasion') {
            if (this.invasionVisit && this.bridge.state()?.role.id === before.role.id) this.invasionResult(a, before, result);
            return;
          }
          if (a.invasionTravel && this.invasionVisit?.travel) {
            if (result.success) this.invasionVisit.travel = false;
            else if (this.invasionVisit.travelAttempts >= 3) this.finishInvasion();
          }
          if (a.family === 'rings') {
            if (this.bridge.state()?.role.id !== before.role.id) return;
            if (result.success) {
              if (a.readOnly && result.data?.rings) this.bridge.ringsConfirmed = ringsEpoch;
              if (result.data?.rings) this.observeRings(result.data.rings, a.payload.action === 'enter');
            } else this.ringsRefused(a, before.rings, result.message || '操作未成功');
            return;
          }
          if (welfareBet) { this.welfareResult(a, before, result); return; }
          if (a.petHatch && (result.success ?? result.code === 200)) {
            await this.bridge.request({ type: 'PET_COMMAND', payload: { action: 'list', petId: '' },
              responseType: 'PET_RESPONSE', readOnly: true }, this.responseTimeout());
            const oldIds = new Set((before.pets?.pets || []).map((entry) => entry.pet.id));
            const added = (this.bridge.state()?.pets?.pets || []).filter((entry) => !oldIds.has(entry.pet.id));
            // Only an unambiguous result is screened: exactly one new pet. Anything else stays untouched.
            if (added.length === 1) {
              this.ledger.petHatched = [...new Set([...(this.ledger.petHatched || []), added[0].pet.id])];
              this.log('孵化成功：' + added[0].speciesName + '，资质均值 ' + added[0].average);
            } else this.log('孵化后新增珍兽数量为 ' + added.length + '，无法确认是哪一只，不做筛选', 'warning');
            this.saveLedger();
          }
          const after = this.bridge.state() || before;
          if (!a.readOnly && !a.noResponse) {
            const extraMoney = Math.max(
                0,
                P.num(before.role.money) - P.num(after.role.money) - (a.moneyCost || 0),
              ),
              extraExp = Math.max(
                0,
                P.num(before.role.currentExp) - P.num(after.role.currentExp) - (a.expCost || 0),
              );
            this.ledger.money += extraMoney;
            P.recordExperience(this.ledger, a.type, extraExp);
          }
          const success = result.success ?? result.code === 200;
          if (!success && a.profileSwitch) { this.profileFailure(a); return; }
          if (!success && trialClaim) {
            this.log(a.label + '：' + (result.message || '操作未成功'), 'warning');
            this.suppress(a, 1800000);
            this.saveLedger();
            return;
          }
          if (success && a.type === 'EQUIP_ITEM') this.gearEquipped(a, before, after);
          if (!success && a.type === 'SHOP_SELL_BATCH') { this.batchFallback(); return; }
          if (!success && a.doubleExp) {
            this.ledger.tianlingUsedAt = 0;
            this.saveLedger();
          }
          if (success && a.type === 'PET_COMMAND' && ['lock', 'release'].includes(a.payload.action))
            this.ledger.petHatched = (this.ledger.petHatched || []).filter((id) => id !== a.payload.petId);
          this.cleanPetLedger(after.pets);
          if (arenaClaim) {
            if (this.bridge.cache.arena) this.bridge.cache.arena.token = '';
            // The action key holds the token, so a refusal is remembered in the ledger:
            // a refused claim costs one town trip a day at most.
            if (!success) this.ledger.arena.claimFailed = true;
          }
          if (a.type === 'ARENA_COMMAND' && a.payload.action === 'challenge') {
            if (this.bridge.cache.arena) this.bridge.cache.arena.token = '';
            if (success && result.data?.battle) {
              this.ledger.arena.attempts++;
              this.arenaPending = { matchId: result.data.battle.matchId,
                target: a.arenaTarget, started: Date.now() };
            }
          }
          if (success && a.stockItemId) {
            if (P.countItem(after, a.stockItemId) <= P.countItem(before, a.stockItemId))
              throw new Error('购药后库存变化未确认');
            if (P.countItem(after, a.stockItemId) >= this.prefs.shop.targetStock)
              delete this.ledger.restock[a.stockItemId];
          }
          if (a.type === 'SMITHY_FORGE_PREVIEW' && Array.isArray(result.data))
            this.bridge.cache.forgePreviews[a.payload.sectionBagId] = copy(result.data);
          if (success && a.activity) {
            this.ledger.activities[a.activity] = P.num(this.ledger.activities[a.activity]) + 1;
            this.activity = {
              name: a.activity,
              mapId: P.num(after.role.mapId),
              started: Date.now(),
            };
          }
          if (success && ['CRAFT_EQUIP', 'SMITHY_FORGE', 'YUCI_EXCHANGE'].includes(a.type)) {
            const oldIds = new Set(before.equipments.map((e) => P.num(e.id)));
            for (const e of after.equipments)
              if (!oldIds.has(P.num(e.id))) this.ledger.keptEquipIds.push(P.num(e.id));
            this.ledger.keptEquipIds = [...new Set(this.ledger.keptEquipIds)].slice(-500);
          }
          if (a.type === 'SMITHY_FORGE')
            delete this.bridge.cache.forgePreviews[a.payload.sectionBagId];
          if (a.noResponse) {
            this.lastSettings = Date.now();
            this.log('自动回复策略已应用');
          } else if (!success) {
            this.log(a.label + '：' + (result.message || '操作未成功'), 'warning');
            // A full bag must not cause a town trip every five minutes.
            this.suppress(a, lotteryDraw || a.type === 'GET_MONSTER_TMPL' ? 1800000 : 300000);
          } else {
            if (queryBatch?.multiple) queryBatch.completed.add(a);
            else this.log(a.label + '：完成', 'success');
            const reward = lotteryDraw && result.data?.receipt?.reward;
            if (reward) this.log('抽奖获得：' + (['GOLD', 'GIFT'].includes(reward.kind)
              ? P.num(reward.amount).toLocaleString() + ' ' + reward.name
              : reward.name + ' ×' + reward.count + (reward.bound ? '（绑定）' : '（不绑定）')), 'success');
            if (!lotteryDraw && !a.readOnly && !a.activity &&
                !(a.family === 'arena' && ['open', 'list', 'challenge'].includes(a.payload.action)) &&
                (a.type === 'PET_COMMAND' ? petBefore === petSignature() :
                  trialAction ? trialBefore === trialSignature() : P.signature(before) === P.signature(after))) {
              this.suppress(a, 300000);
              this.log('状态没有可确认变化，该动作暂缓复查', 'warning');
            }
          }
          if (
            !a.readOnly && P.num(after.role.money) < this.prefs.budget.moneyReserve &&
            P.num(before.role.money) >= this.prefs.budget.moneyReserve
          )
            this.pause('金币已低于保留额度，请核对当前资源');
          this.saveLedger();
        } catch (e) {
          if (a.breedSuccess || a.payload?.action === 'breedingList') {
            this.log(safeMessage(e.serverMessage || e.message), 'warning');
            this.suppress(a, 300000);
            return;
          }
          if (a.family === 'rings') {
            if (this.bridge.state()?.role.id !== before.role.id) return;
            if (e.code === 'SERVER_ERROR') this.ringsRefused(a, before.rings, safeMessage(e.serverMessage || e.message));
            else {
              this.log(safeMessage(e.message), 'warning');
              this.suppress(a, 300000);
            }
            return;
          }
          if (a.readOnly && e.code === 'SERVER_ERROR_UNATTRIBUTED') {
            this.suppress(a, 60000);
            if (queryBatch) queryBatch.unattributed++;
            else this.log('服务器返回错误，1 个查询稍后重试', 'warning');
            return;
          }
          const timedOut = e.code === 'RESPONSE_TIMEOUT', now = Date.now();
          if (timedOut)
            this.responseTimeouts = [...(this.responseTimeouts || []).filter((entry) => now - entry.at < 600000),
              ...(!e.waiter?.answered ? [{ at: now, waiter: e.waiter || e }] : [])];
          const timeoutPause = timedOut && this.responseTimeouts.length >= 3
            ? '服务器 10 分钟内 3 次没有回应（最近一次：' + a.label + '）；请检查网络或游戏服务器后重新开始'
            : null;
          if (timedOut && a.readOnly && a.key !== 'reconcile-role') {
            this.log(a.label + '：服务器没有及时回应，稍后重试', 'warning');
            this.suppress(a, 300000);
            this.saveLedger();
            if (timeoutPause) this.pauseForTimeout(timeoutPause);
            return;
          }
          if (trialClaim && e.code === 'SERVER_ERROR') {
            this.log(safeMessage(e.message), 'warning');
            this.suppress(a, 1800000);
            this.saveLedger();
            return;
          }
          // Action-specific recoveries below cover timeouts too and never pause.
          if (welfareBet) { this.welfareResult(a, before, null, e); return; }
          if (a.type === 'WELFARE_LOTTERY_COMMAND') {
            this.log(safeMessage(e.message), 'warning');
            this.suppress(a, 60000);
            return;
          }
          if (a.profileSwitch && e.code === 'SERVER_ERROR') { this.profileFailure(a); return; }
          if (a.type === 'SHOP_SELL_BATCH') { this.batchFallback(); return; }
          if (a.family === 'pet' && String(e.message).includes('请先结束战斗')) {
            this.log(safeMessage(e.message), 'warning');
            this.suppress(a, 300000);
            this.saveLedger();
            return;
          }
          // A lottery request costs at most one chance; an unanswered arena claim costs nothing and must not stop the autopilot.
          if (a.type === 'ONLINE_LOTTERY_COMMAND' || a.type === 'GET_MONSTER_TMPL' || arenaClaim) {
            this.log(safeMessage(e.message), 'warning');
            if (arenaClaim) this.ledger.arena.claimFailed = true;
            else this.suppress(a, 1800000);
            this.saveLedger();
            return;
          }
          if (['LEVEL_UP', 'UPGRADE_SKILL'].includes(a.type) && e.code === 'SERVER_ERROR') {
            this.log(safeMessage(e.message), 'warning');
            this.suppress(a, 3600000);
            this.saveLedger();
            return;
          }
          this.uncertain = true;
          this.lastFailure = {
            occurredAt: new Date().toISOString(),
            actionType: a.type,
            actionLabel: a.label,
            reason: safeMessage(e.message),
            code: e.code || 'ACTION_ERROR',
            expectedResponseType: e.expectedResponseType || a.type + '_RESPONSE',
            receivedType: e.receivedType || null,
            elapsedMs: e.elapsedMs ?? null,
            packetTypes: e.packetTypes || [],
            resultConfirmed: false,
          };
          if (a.type === 'SHOP_BUY' && a.stockItemId) {
            this.uncertain = false;
            this.log(safeMessage(e.message), 'warning');
            this.suppress(a, 300000);
            this.saveLedger();
            return;
          }
          this.suppress(a, 3600000);
          this.saveLedger();
          if (timeoutPause) this.pauseForTimeout(timeoutPause);
          else if (timedOut && this.prefs.reconnect.enabled)
            this.log(a.label + '：响应超时，结果未确认；先重新读取角色核对结果，再继续托管', 'warning');
          else if (!this.bridge.connected && this.prefs.reconnect.enabled)
            this.log(safeMessage(e.message), 'warning');
          else this.pause(safeMessage(e.message) + '；请核对角色后重新开始');
        } finally {
          if (a.breedSuccess && this.bridge.cache.petHall === petSession) {
            delete this.bridge.cache.petHall[a.payload.petId];
            this.bridge.cache.pets = null;
            this.bridge.petListRequired = true;
          }
          if (!queryBatch) {
            this.action = null;
            this.busy = false;
            this.lastLocal = Date.now();
          }
          this.resumeAfterLateResponse();
          this.paint();
        }
      }
      syncKeepAwake() {
        const want = this.enabled && this.prefs.keepAwake;
        const held = this.keepAwake.set(want);
        const state = held ? 'held' : want && !this.keepAwake.supported ? 'unsupported' : 'off';
        if (state !== this.keepAwakeLogged) {
          const previous = this.keepAwakeLogged;
          this.keepAwakeLogged = state;
          if (state === 'held') this.log('已持有 Web Lock，降低标签页被浏览器睡眠的概率');
          else if (state === 'off' && previous === 'held') this.log('已释放 Web Lock');
          else if (state === 'unsupported') this.log('浏览器不支持 Web Lock，无法防止标签页睡眠', 'warning');
        }
      }
      tryCloseArenaResult(now = Date.now()) {
        if (!this.enabled || !this.arenaCloseUntil) return;
        if (now >= this.arenaCloseUntil) {
          this.arenaCloseUntil = 0;
          return;
        }
        if (this.bridge.closeArenaResult()) {
          this.arenaCloseUntil = 0;
          this.log('已关闭比武结果窗口', 'info');
        }
      }
      handleArenaMatch(now = Date.now()) {
        const pending = this.arenaPending, match = this.bridge.cache.arenaMatch;
        if (!pending) {
          if (match?.active && now - match.at >= 130000) {
            this.log('比武等待结果超时，继续托管', 'warning');
            this.bridge.cache.arenaMatch = null;
            return false;
          }
          return !!match?.active;
        }
        if (match?.matchId === pending.matchId && match.active === false) {
          if (match.result?.win)
            this.log('比武胜利：第 ' + match.result.oldRank + ' 名 → 第 ' +
              match.result.newRank + ' 名', 'success');
          else {
            this.log('比武失败：对手 ' + pending.target.nickname, 'warning');
            this.ledger.arena.lost.push(pending.target.snapshotId);
          }
          this.saveLedger();
        } else if (now - pending.started < 130000) return true;
        else this.log('比武等待结果超时，继续托管', 'warning');
        this.arenaPending = null;
        this.bridge.cache.arenaMatch = null;
        if (this.bridge.cache.arena) this.bridge.cache.arena.board = null;
        this.arenaCloseUntil = now + 15000;
        this.tryCloseArenaResult(now);
        return false;
      }
      async tick() {
        if (this.adaptiveUntil) this.responseTimeout();
        const character = this.bridge?.character?.(), statsRole = character?.role;
        const id = P.num(statsRole?.id);
        if (id && this.roleId && id !== this.roleId) this.setRole(id);
        else observeRole(this, id);
        this.syncKeepAwake();
        this.ensureStats(statsRole?.id);
        if (statsRole) this.stats?.tick(statsRole.mapId);
        const now = Date.now();
        const sampleBattle = this.mapRates || this.smartDecision ? this.sampleMaps(character, now) : null;
        const needsSocket = statsRole?.id && !this.bridge.connected;
        const reconnectModal = (this.enabled || needsSocket) && this.bridge.reconnectVisible?.();
        if (needsSocket && !reconnectModal && now >= (this.nextSocketProbe ?? 0)) {
          this.nextSocketProbe = now + 30000;
          try { this.bridge.stores().get('online-lottery')?.query?.('open', 0); } catch {}
        }
        if (!this.enabled) {
          if (this.gearCheck && !this.busy && this.bridge.connected && this.bridge.sessionReady) {
            const s = this.bridge.state();
            if (s) {
              this.setRole(P.num(s.role.id));
              if (this.acquireLease()) {
                this.updateGearCheck(s);
                this.releaseLease();
              }
            }
          }
          if (statsRole && this.prefs.battle?.smart && !this.prefs.battle.mapId) this.farmTarget(character, now);
          this.paint();
          return;
        }
        this.tryCloseArenaResult(now);
        if (this.bridge.authFailed || reconnectModal || !this.bridge.connected || !this.bridge.sessionReady) {
          this.reason = this.bridge.authFailed
            ? '游戏认证失效，请在原页面重新登录'
            : reconnectModal ? '游戏正在重连，等待恢复'
            : this.bridge.connected ? '连接已建立，等待游戏进入角色'
            : statsRole?.id ? '未接管到游戏连接（脚本启动晚于游戏，或其他脚本占用了连接），正在尝试接管；不行请刷新页面'
            : '等待游戏连接';
          this.maybeReload(now);
          this.paint();
          return;
        }
        if (now < this.manualUntil) {
          this.reason = '检测到手动操作，稍后继续';
          this.paint();
          return;
        }
        const s = this.bridge.state();
        if (!s) {
          this.reason = '等待角色数据';
          this.paint();
          return;
        }
        this.setRole(P.num(s.role.id));
        this.cleanPetLedger(s.pets);
        this.bridge.expireActivityStatus();
        if (!this.acquireLease()) {
          this.reason = '此角色已在另一标签页托管';
          this.paint();
          return;
        }
        const actionBlocked = this.busy || now - this.lastLocal < 1200;
        if (this.uncertain) {
          if (actionBlocked) return;
          this.reason = '等待重新读取角色，核对上个动作结果';
          await this.reconcileRole(now);
          this.paint();
          return;
        }
        const rings = P.RINGS_MAP_IDS.includes(P.num(s.role.mapId));
        if (!actionBlocked) this.updateProfile(s, now);
        const autoRings = this.prefs.rings?.enabled && P.num(s.role.level) >= 56;
        if (autoRings) {
          const mapId = P.num(s.role.mapId), prior = this.ringsMap, town = P.num(s.rings?.townId);
          const active = this.bridge.battle().stage === 'running';
          const mapChanged = prior !== mapId && (rings || P.RINGS_MAP_IDS.includes(prior) ||
            mapId === town || prior === town);
          if (mapChanged || this.ringsUiCombat && !active) {
            this.bridge.invalidateRings();
            if (this.ringsUiCombat && !active) this.bridge.ringsCombat = false;
            s.ringsDirty = true;
            s.ringsDirtyAt = this.bridge.ringsDirtyAt;
          }
          this.ringsMap = mapId;
          this.ringsUiCombat = (rings || !!s.rings?.run) && active;
          const fighting = active || this.bridge.ringsCombat;
          if (!this.busy && s.rings) this.observeRings(s.rings);
          const otherActivity = s.trial?.run || s.arenaMatch?.active || this.arenaPending ||
            [20050, 20051, 20052, 20070].includes(mapId) || this.activity?.mapId === mapId;
          if (!otherActivity && (s.rings?.run || !s.rings || s.ringsDirty)) {
            const a = P.ringsPlan({ ...s, gearProfile: this.gearProfile, gearCheck: this.gearCheck,
              ringsFighting: fighting, ringsStartAt: this.ringsStartAt },
              this.prefs, this.ringsDaily(s.rings), now, {
                hasGearAction: () => this.planningPass(s, this.prefs, now).some(P.gearChange) });
            if (s.rings?.run && fighting)
              this.reason = '新三环：' + P.ringStage(s.rings.run.stage) + '战斗中';
            if (this.activity) {
              this.activity = null;
              this.bridge.cache.activityStatus = {};
            }
            const available = a && (this.suppressed.get(a.key) || 0) <= now;
            if (available && !actionBlocked) await this.execute(a);
            if (s.rings?.run || rings || available) {
              this.paint();
              return;
            }
          }
        } else this.ringsMap = null;
        if (!actionBlocked) {
          this.updateGearCheck(s, now);
          if (!rings && this.maybeApplyUpdate(now)) return;
        }
        if ((rings && !autoRings) || P.num(s.role.mapId) === 20070 || s.trial?.run) {
          if (actionBlocked) return;
          if ((this.planNow || monotonicNow)() < (this.nextPlanAt ?? -Infinity)) {
            this.paint();
            return;
          }
          const prefs = s.trial?.run ? { ...this.prefs,
            hidden: { ...this.prefs.hidden, enabled: true } } : this.prefs;
          const a = this.planningPass(s, prefs, now)
            .sort((a, b) => Number(b.type === 'TRIAL_COMMAND') -
              Number(a.type === 'TRIAL_COMMAND')).find((a) =>
            (a.readOnly || a.type === 'UPDATE_SETTINGS') &&
            (this.suppressed.get(a.key) || 0) < now &&
            (a.type !== 'UPDATE_SETTINGS' || now - this.lastSettings > 15000));
          if (a) await this.execute(a);
          this.reason = rings ? '新三环挑战中，托管不干预' : '无相浮屠试炼中，托管不干预';
          this.paint();
          return;
        }
        if (this.handleArenaMatch(now)) return;
        const runtime = sampleBattle ?? this.bridge.battle(),
          map = P.roleMap(s),
          special =
            [20050, 20051, 20052].includes(P.num(s.role.mapId)) ||
            (this.activity && P.num(s.role.mapId) === this.activity.mapId);
        if (
          runtime.player?.isDead ||
          (runtime.player && P.num(runtime.player.currentHp) <= 0 && runtime.stage !== 'idle')
        ) {
          if (actionBlocked) return;
          const key =
            this.roleId +
            ':' +
            (runtime.player.id || 'player') +
            ':' +
            (this.activity?.started || s.role.mapId);
          if (key !== this.lastDeathKey) {
            this.lastDeathKey = key;
            this.deaths = this.deaths.filter((t) => now - t < 3600000);
            this.deaths.push(now);
            if (P.fieldMap(map)) this.mapRates?.died(now, P.num(map.id), this.prefs.battle);
            if (this.prefs.battle.deathDowngrade) this.penalty += 5;
            this.log('检测到阵亡，准备按游戏入口返城', 'warning');
          }
          // A limit of 0 means no limit.
          if (
            !this.prefs.battle.recoverDeath ||
            (this.prefs.battle.maxDeathsPerHour > 0 && this.deaths.length >= this.prefs.battle.maxDeathsPerHour)
          ) {
            this.pause('阵亡次数达到策略限制');
            return;
          }
          this.bridge.setBattle(false);
          const town = P.townFor(s);
          if (town && P.num(town.id) !== P.num(s.role.mapId))
            await this.execute({
              kind: 'request',
              type: 'ENTER_MAP',
              payload: { mapId: P.num(town.id) },
              label: '阵亡后返回城镇',
              family: 'travel',
              moneyCost: 0,
              expCost: 0,
              key: 'return-town',
            });
          this.lastLocal = now;
          return;
        }
        if (!runtime.player || (!runtime.player.isDead && P.num(runtime.player.currentHp) > 0))
          this.lastDeathKey = '';
        if (this.activity && !special) {
          this.log('活动已离场，继续核对日常次数');
          this.activity = null;
          this.lastDeathKey = '';
          this.bridge.cache.activityStatus = {};
        }
        const rushTown = P.arenaRush(this.prefs, now) && P.num(s.role.level) >= 30
          ? P.townFor(s, P.NPC.arena) : null;
        if ((this.planNow || monotonicNow)() < (this.nextPlanAt ?? -Infinity)) {
          this.paint();
          return;
        }
        let plans = this.planningPass(s, this.prefs, now).filter(
          (a) =>
            (!rushTown || !a.activity) &&
            (this.suppressed.get(a.key) || 0) < now &&
            (!(a.type === 'UPDATE_SETTINGS') || now - this.lastSettings > 15000),
        );
        if (special)
          plans = plans.filter((a) => ['GET_POTION_LIST', 'UPDATE_SETTINGS'].includes(a.type));
        const queries = plans.filter(parallelQuery);
        if (queries.length) this.executeQueries(queries).catch((e) => this.pause(e.message));
        if (actionBlocked) return;
        const errandTown = (a) => a.townId ? { id: a.townId } : P.townFor(s, a.npc);
        const candidate = plans.find((a) => !parallelQuery(a) && !this.bridge.responsePending?.(a) &&
          (!a.requiresTown || !!errandTown(a)));
        if (candidate) {
          if (candidate.kind === 'visitFinished') {
            this.finishInvasion();
            return;
          }
          if (candidate.kind === 'invasionWait') {
            this.reason = candidate.label;
            this.paint();
            return;
          }
          if (candidate.family === 'rings' && candidate.requiresTown &&
              queries.some((q) => q.type === 'ZL_STATUS' || q.type === 'CAMP_STATUS')) return;
          if (
            candidate.readOnly && candidate.family === 'rings' || candidate.type === 'UPDATE_SETTINGS' ||
            (candidate.inBattle && !candidate.requiresTown)
          ) {
            await this.execute(candidate);
            return;
          }
          if (runtime.stage !== 'idle') {
            this.reason = '暂停一轮战斗，准备 ' + candidate.label;
            this.bridge.setBattle(false);
            this.idleSince = 0;
            this.lastLocal = now;
            this.paint();
            return;
          }
          if (!this.idleSince) {
            this.idleSince = now;
            return;
          }
          if (now - this.idleSince < 1500) return;
          if (candidate.requiresTown) {
            const town = errandTown(candidate);
            if (!town) return;
            const invasionTravel = candidate.family === 'invasion';
            if (P.num(town.id) !== P.num(s.role.mapId) || invasionTravel && this.invasionVisit?.travel) {
              if (invasionTravel && this.invasionVisit?.travel) this.invasionVisit.travelAttempts++;
              await this.execute({
                kind: 'request',
                type: 'ENTER_MAP',
                payload: { mapId: P.num(town.id) },
                invasionTravel,
                label: candidate.family === 'rings' ? '新三环：前往楼兰' : invasionTravel ? '宵小入侵：前往大理' : '前往「' + town.name + '」办理 ' + candidate.label,
                family: 'travel',
                moneyCost: 0,
                expCost: 0,
                key: 'town:' + town.id,
              });
              return;
            }
            if (candidate.npc && !candidate.readOnly && !['activity', 'arena', 'trial'].includes(candidate.family))
              this.bridge.nativeNpc(candidate.npc);
          }
          await this.execute(candidate);
          return;
        }
        this.idleSince = 0;
        if (rushTown && !special) {
          this.reason = '比武结算前驻守「' + rushTown.name + '」，等待可挑战对手';
          if (runtime.stage !== 'idle') {
            this.bridge.setBattle(false);
            this.lastLocal = now;
          } else if (P.num(rushTown.id) !== P.num(s.role.mapId)) {
            await this.execute({
              kind: 'request',
              type: 'ENTER_MAP',
              payload: { mapId: P.num(rushTown.id) },
              label: '比武结算前返回「' + rushTown.name + '」',
              family: 'travel',
              moneyCost: 0,
              expCost: 0,
              key: 'town:' + rushTown.id,
            });
          }
          this.paint();
          return;
        }
        if (!this.prefs.battle.enabled) {
          this.reason = '当前没有可执行的成长/经济动作';
          this.paint();
          return;
        }
        const target = special ? map : this.farmTarget(s, now);
        if (!target) {
          this.reason = '没有符合等级与地图策略的免费挂机地图';
          this.paint();
          return;
        }
        if (P.num(target.id) !== P.num(s.role.mapId)) {
          if (runtime.stage !== 'idle') {
            this.bridge.setBattle(false);
            this.lastLocal = now;
            return;
          }
          await this.execute({
            kind: 'request',
            type: 'ENTER_MAP',
            payload: { mapId: P.num(target.id) },
            label: '进入挂机地图「' + target.name + '」',
            family: 'travel',
            moneyCost: 0,
            expCost: 0,
            key: 'map:' + target.id,
          });
          return;
        }
        if (runtime.stage === 'idle') {
          this.bridge.closeOwnedWindows();
          const started = this.bridge.setBattle(true);
          this.reason = started ? '已通过原页面开始战斗' : '未找到原页面战斗入口，托管等待';
          this.lastLocal = now;
          this.log(this.reason, started ? 'info' : 'warning');
        } else this.reason = '战斗中：' + (map?.name || s.role.mapId) +
          (!special && this.smartDecision ? ' · ' + this.smartDecision.reason : '');
        this.paint();
      }
      maybeApplyUpdate(now) {
        // The state snapshot is costly, so the tower check comes last: only when an update is due.
        if (P.arenaRush(this.prefs, now) || !this.prefs.updates.autoApply || !this.enabled || !this.prefs.resumeAfterReload ||
          this.activity || this.arenaPending || !this.updates || !TLUpdates.shouldApply(
            readStorage(TLUpdates.KEY, {}), this.updates.currentVersion, now) ||
          P.num(this.bridge.state()?.role.mapId) === 20070) return false;
        // Whether Tampermonkey has installed the new version is not visible from here, so a reload is
        // tried once at once, then every 6 hours, 5 times per version.
        this.updates.markApply(now);
        saveRunning(this, true);
        this.log('发现新版本 v' + this.updates.status().latestVersion + '，刷新页面以启用');
        location.reload();
        return true;
      }
      maybeReload(now) {
        if (
          !this.prefs.reconnect.autoReload ||
          this.bridge.authFailed ||
          !this.bridge.lastClose ||
          now - this.bridge.lastClose < this.prefs.reconnect.reloadAfterSeconds * 1000
        )
          return;
        this.reloads = arraySafe(this.reloads).filter((t) => now - t < 3600000);
        if (this.reloads.length >= this.prefs.reconnect.maxReloadsPerHour) {
          this.reason = '刷新次数已达上限，等待游戏恢复';
          return;
        }
        this.reloads.push(now);
        writeStorage(taggedKey('reloads', roleTag(this)), this.reloads);
        saveRunning(this, true);
        location.reload();
      }
    }
    class WarehouseShortcuts {
      constructor(controller, doc = document) {
        this.controller = controller;
        this.bridge = controller.bridge;
        this.doc = doc;
        this.queue = [];
      }
      start() {
        if (this.started) return;
        this.started = true;
        for (const [type, handler] of [['click', 'sort'], ['contextmenu', 'shortcut']])
          this.doc.addEventListener(type, event => this[handler](event).catch(error =>
            this.controller.log('仓库操作异常：' + safeMessage(error.message), 'warning')), true);
      }
      open() {
        return !!this.doc.querySelector('.warehouse-window');
      }
      bagWindow(target) {
        const win = target?.closest?.('.inventory-window, .warehouse-window');
        return win?.matches('.inventory-window') ? win : null;
      }
      toast(message, level) {
        this.bridge.stores().get('ui')?.showMessage(message, level);
      }
      pause(ms) {
        this.controller.manualUntil = Math.max(this.controller.manualUntil, Date.now() + ms + 5000);
      }
      async sort(event) {
        // Only a deposit run is waited for: sorting during a sale or withdrawal could put items straight back.
        if (this.sorting || (this.runKind && this.runKind !== 'deposit') || !this.controller.prefs.convenience.sortDeposit) return;
        const button = event.target?.closest?.('.btn-sort-bag, .btn-sort-bag-small');
        if (!this.bagWindow(button) || !this.open()) return;
        this.sorting = true;
        try {
          // The game's click handler sorts the character store before the plan is built.
          await this.delay(0);
          if (this.run) await this.run;
          const character = this.bridge.character();
          const plan = P.sortDepositPlan(character?.bagItems, character?.warehouseItems);
          let count = 0;
          for (const entry of plan) {
            const result = await this.deposit(entry.bagItemId);
            if (result === null) return;
            if (result) count++;
          }
          if (!count || !this.open()) return;
          this.bridge.character()?.sortBagNow?.();
          this.toast('已存入仓库 ' + count + ' 种物品', 'success');
        } finally { this.sorting = false; }
      }
      cellItem(target) {
        const win = this.bagWindow(target), cell = target?.closest?.('.grid-slot');
        const grid = cell?.parentElement;
        // The game marks every cell without a quality as empty-slot, which includes all items and materials:
        // a filled cell is one that holds an icon.
        const filled = (node) => !!node.querySelector('.v-img, img');
        if (!win || !grid?.matches('.inventory-grid') || !filled(cell)) return null;
        const tab = win.querySelector('.game-tab-button.is-active')?.textContent.trim();
        const cells = Array.from(grid.children).filter(node => node.matches('.grid-slot'));
        const character = this.bridge.character();
        if (cells.filter(filled).length !== Math.min(72, P.bagTabItems(tab, character).length)) return null;
        return P.bagCellItem(tab, cells.indexOf(cell), character);
      }
      warehouseTab(target) {
        return target?.closest?.('.warehouse-window')?.querySelector('.game-tab-button.is-active')?.textContent.trim();
      }
      warehouseCell(target) {
        const cell = target?.closest?.('div.grid-slot'), grid = cell?.parentElement;
        if (!grid?.matches('.warehouse-grid') || !cell.querySelector('.v-img')) return;
        const tab = this.warehouseTab(grid), character = this.bridge.character();
        const list = tab === '装备' ? P.array(character?.warehouseEquips).filter(e => e?.equipTmpl) :
          P.warehouseTabItems(tab, character);
        const cells = Array.from(grid.children).filter(node => node.matches('div.grid-slot'));
        if (cells.filter(node => node.querySelector('.v-img')).length !== Math.min(P.WAREHOUSE_CAPACITY, list.length)) return;
        const index = cells.indexOf(cell);
        if (index < P.WAREHOUSE_CAPACITY) return list[index];
      }
      shortcutKind(target) {
        if (this.bagWindow(target)) return 'deposit';
        return this.warehouseTab(target) === '装备' ? 'sell' : 'withdraw';
      }
      async shortcut(event) {
        if (this.sorting || !this.open()) return;
        const prefs = this.controller.prefs.convenience;
        const kind = this.shortcutKind(event.target);
        if (this.runKind && this.runKind !== kind) return;
        // Deposit and withdrawal move whole stacks of 道具 and 材料 and share one switch and one shortcut.
        const stack = kind !== 'sell';
        const mode = this.bridge.stores().get('interaction')?.mode;
        if (mode != null && mode !== 'NORMAL') return;
        if (stack ? !prefs.ctrlDeposit : !prefs.sellWarehouse || P.shortcutConflicts(prefs).sellKeys) return;
        if (!P.keysMatch(event, stack ? prefs.depositKeys : prefs.sellKeys)) return;
        const item = kind === 'deposit' ? this.cellItem(event.target) : this.warehouseCell(event.target);
        if (item?.id == null || (stack && !(item.count >= 1))) return;
        event.preventDefault();
        event.stopPropagation();
        this.queue.push(item.id);
        if (!this.run) this.run = this.drain(kind);
        await this.run;
      }
      async drain(kind) {
        this.runKind = kind;
        let sold = 0;
        try {
          while (this.queue.length) {
            const result = await this[kind](this.queue.shift());
            if (result === null) return;
            if (kind === 'sell' && result) sold++;
          }
          if (sold >= 2) this.toast('已出售 ' + sold + ' 件仓库装备', 'success');
        } finally {
          this.queue.length = 0;
          this.run = this.runKind = null;
        }
      }
      delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      busy(type) {
        return this.bridge.waiter || Array.from(this.bridge.lateWaiters || []).some(waiter =>
          waiter.type === type && waiter.socket === this.bridge.socket && waiter.lateUntil > Date.now());
      }
      async waitReady(type, message) {
        const until = Date.now() + 5000;
        while (this.busy(type)) {
          if (!this.open() || !this.bridge.connected) return null;
          if (Date.now() >= until) return this.stop(message);
          const ms = Math.min(300, until - Date.now());
          this.pause(ms);
          await this.delay(ms);
        }
        return true;
      }
      deposit(id) {
        return this.moveStack('WAREHOUSE_DEPOSIT', 'bagItems', 'bagItemId', id, '存入仓库没有回应，已停止');
      }
      withdraw(id) {
        return this.moveStack('WAREHOUSE_WITHDRAW', 'warehouseItems', 'warehouseItemId', id, '取出到背包没有回应，已停止');
      }
      async moveStack(type, list, field, id, timeout) {
        if (this.busy(type) && !await this.waitReady(type, timeout)) return null;
        if (!this.open() || !this.bridge.connected) return null;
        const stack = this.bridge.character()?.[list]?.find(item => item?.id === id);
        if (!(stack?.count >= 1)) return false;
        const packet = await this.send(type, { [field]: id, count: stack.count });
        if (!this.open() || packet === false) return null;
        if (!packet) return this.stop(timeout);
        if (packet.success) return true;
        return this.stop(packet.message);
      }
      stop(message) {
        this.toast(message, 'warning');
        return null;
      }
      bagEquipment() {
        return P.array(this.bridge.character()?.equipments).filter(e => e?.id != null && !e.isEquipped);
      }
      withdrawnItem(equip, oldIds) {
        const templateId = e => e.tmplId || e.equipTmpl?.id;
        if (!templateId(equip)) return;
        const candidates = this.bagEquipment().filter(e => !oldIds.has(e.id) && templateId(e) === templateId(equip));
        if (candidates.length === 1) return candidates[0];
        const matches = candidates.filter(e => e.enhanceLevel === equip.enhanceLevel && e.quality === equip.quality &&
          JSON.stringify(e.extraStats) === JSON.stringify(equip.extraStats));
        if (matches.length === 1) return matches[0];
      }
      confirmSale(equip) {
        const character = this.bridge.character(), reasons = [];
        this.controller.ensureGearState?.(P.num(character.role?.id));
        const state = { artifactSkills: Array.from(character.artifactSkillConfigs?.values() || []),
          gearProfile: this.controller.gearProfile };
        if (equip.gemSlots && equip.gemSlots !== '[]' && equip.gemSlots.length > 2) reasons.push('带宝石');
        if (equip.enhanceLevel > 0) reasons.push('强化 +' + equip.enhanceLevel);
        if (P.smeltProtected(equip, state) === '神器') reasons.push('神器');
        const profile = P.loadoutProtection(state).get(Number(equip.id));
        if (profile) reasons.push(profile);
        if (!reasons.length) return true;
        const ui = this.bridge.stores().get('ui');
        if (!ui?.showConfirm) {
          this.toast('需要确认的装备请手动出售', 'warning');
          return false;
        }
        const { name, price } = equip.equipTmpl;
        return this.askSale(ui, reasons.join('、') + '。确认出售 ' + name + '，获得 ' + price + ' 金币？');
      }
      async askSale(ui, message) {
        let timer;
        const renew = cancel => {
          if (!this.saleActive()) return cancel();
          this.pause(1000);
          timer = setTimeout(() => renew(cancel), 1000);
        };
        try {
          return await new Promise(resolve => {
            const cancel = () => resolve(false);
            renew(cancel);
            ui.showConfirm(message, () => resolve(true), cancel, '出售确认');
          });
        } finally { clearTimeout(timer); }
      }
      saleActive() {
        const prefs = this.controller.prefs.convenience;
        return this.open() && this.bridge.connected && prefs.sellWarehouse && !P.shortcutConflicts(prefs).sellKeys;
      }
      async sell(id) {
        const timeout = '仓库操作没有回应，已停止', withdraw = 'WAREHOUSE_WITHDRAW';
        this.pause(5000);
        if (!this.saleActive()) return null;
        const lookup = () => this.bridge.character()?.warehouseEquips?.find(e => e?.id === id);
        const equip = lookup();
        if (!equip?.equipTmpl) return false;
        if (!(equip.equipTmpl.price > 0)) {
          this.toast('该装备无法出售', 'warning');
          return false;
        }
        if (!await this.confirmSale(equip)) return this.saleActive() ? false : null;
        if (this.busy(withdraw) && !await this.waitReady(withdraw, timeout)) return null;
        if (!this.saleActive()) return null;
        if (!lookup()) return false;
        const oldIds = new Set(this.bagEquipment().map(e => e.id));
        const packet = await this.send(withdraw, { roleEquipId: id });
        if (!this.saleActive() || packet === false) return null;
        if (!packet?.success) return this.stop(packet?.message || timeout);
        const item = this.withdrawnItem(equip, oldIds);
        if (!item) return this.stop('已取出到背包，但没找到这件装备，未出售');
        return this.sellFromBag(item.id, equip.equipTmpl.name);
      }
      async sellFromBag(id, name) {
        if (this.busy('SHOP_SELL') && !await this.waitReady('SHOP_SELL', '仓库操作没有回应，已停止')) return null;
        if (!this.saleActive()) return null;
        if (!this.bagEquipment().some(e => e.id === id)) return false;
        const money = () => P.num(this.bridge.character()?.role?.money), before = money();
        const sale = await this.send('SHOP_SELL', { roleEquipId: id, count: 1 });
        if (!this.open() || sale === false) return null;
        if (!sale) return this.stop('出售没有回应，装备可能已在背包');
        if (!sale.success) return this.stop('出售失败：' + sale.message + '，装备已在背包');
        // A successful sale leaves a trace: the game itself only writes it to the chat's system channel.
        this.controller.log('快捷出售仓库装备「' + name + '」：+' + Math.max(0, money() - before) + ' 金币', 'success');
        return true;
      }
      async send(type, payload) {
        let timer;
        this.pause(5000);
        try {
          const packet = await new Promise(resolve => {
            this.bridge.manualResponse = { type: type + '_RESPONSE', resolve };
            timer = setTimeout(() => resolve(null), 5000);
            if (!this.bridge.sendManual(type, payload)) resolve(false);
          });
          // The client applies its character snapshot before the next timer turn.
          if (packet) await this.delay(0);
          return packet;
        } finally {
          clearTimeout(timer);
          this.bridge.manualResponse = null;
        }
      }
    }
    class Filler {
      constructor(controller, doc = document) {
        this.controller = controller;
        this.doc = doc;
        this.memory = {};
        if (this.controller.bridge) this.controller.bridge.filler = this;
      }
      start() {
        this.doc.addEventListener('click', (e) => this.slotClick(e), true);
        this.doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closePicker(); });
        this.watch = setInterval(() => { this.subscribe(); this.checkPicker(); }, 300);
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(this.doc.documentElement, { subtree: true, childList: true });
        this.scan();
      }
      schedule() {
        if (this.timer) return;
        this.timer = setTimeout(() => { this.timer = null; this.scan(); }, 300);
      }
      scan() {
        this.subscribe();
        this.checkPicker();
        if (!this.controller.prefs.fill.enabled) {
          this.doc.querySelectorAll('[data-tl-fill]').forEach((b) => b.remove());
          return;
        }
        this.doc.querySelectorAll('div.gem-shop-window, div.smithy-shop-window, div.tailor-shop-window, section.pet-panel').forEach((root) => this.insert(root));
      }
      insert(root) {
        const header = root.querySelector('div.game-header > div.d-flex.align-center') || root.closest('[class*="window"]')?.querySelector('div.game-header > div.d-flex.align-center');
        if (!header || header.querySelector('[data-tl-fill]')) return;
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.className = 'tl-fill-btn';
        button.setAttribute('data-tl-fill', '');
        button.textContent = '一键放入';
        button.style.cssText = 'font-size:12px;padding:2px 8px;margin-left:8px;border-radius:4px;cursor:pointer';
        for (const event of ['mousedown', 'pointerdown']) button.addEventListener(event, (e) => e.stopPropagation());
        button.addEventListener('click', () => root.matches('section.pet-panel') ? this.pet(root) : this.click());
        header.appendChild(button);
      }
      closePicker() {
        this.picker?.remove();
        this.picker = null;
      }
      checkPicker() {
        if (this.picker && (!this.controller.prefs.fill.enabled || !this.pickerRoot.isConnected || this.controller.bridge.stores().get('interaction')?.mode !== this.pickerMode)) this.closePicker();
      }
      slotClick(e) {
        if (this.picker?.contains(e.target)) return;
        this.closePicker();
        if (e.button !== 0 || !this.controller.prefs.fill.enabled) return;
        const slot = e.target.closest?.('.item-slot');
        const root = slot?.closest('div.gem-shop-window, div.smithy-shop-window, div.tailor-shop-window');
        if (!root || slot.matches('.remove-slot, .highlight-slot')) return;
        if (root.matches('div.tailor-shop-window') && !slot.matches('.cursor-pointer')) return;
        if (!root.matches('div.gem-shop-window')) return setTimeout(() => {
          const repair = root.matches('div.smithy-shop-window') && this.controller.bridge.stores().get('interaction')?.mode === 'SMITHY_REPAIR';
          this.openPicker(slot, root, repair ? this.repairSlotKind(slot, root) : 'any');
        }, 0);
        const mode = this.controller.bridge.stores().get('interaction')?.mode;
        const kind = slot.matches('.border-purple') ? 'equip' : slot.matches('.border-green') ? 'charm' : slot.matches('.small-slot') ? 'gem' : slot.matches('.border-blue') ? mode === 'GEM_DRILL' ? 'material' : 'gem' : null;
        if (kind) this.openPicker(slot, root, kind);
      }
      repairSlotKind(slot, root) {
        const caption = slot.nextElementSibling;
        if (caption?.matches('.text-caption')) return caption.textContent.includes('神符') ? 'charm' : 'section';
        return slot === root.querySelector('.item-slot') ? 'section' : 'charm';
      }
      repairSection(root, state) {
        const first = root.querySelector('.item-slot');
        const slot = first && (this.repairSlotKind(first, root) === 'section' ? first : root.querySelectorAll('.item-slot')[1]);
        const sections = P.array(state.bagItems).filter((b) => P.num(b.itemId ?? b.itemTmpl?.id) >= 5032 && P.num(b.itemId ?? b.itemTmpl?.id) <= 5037);
        const named = sections.find((b) => b.itemTmpl?.name && slot?.textContent.includes(b.itemTmpl.name));
        const src = slot?.querySelector('img')?.getAttribute('src');
        if (named || !src) return named;
        // The smithy's component-local selection renders its item icon inside the slot.
        const base = this.doc.baseURI || location.href, icon = new URL(src, base).href;
        const matches = sections.filter((b) => b.itemTmpl?.icon && new URL(b.itemTmpl.icon, base).href === icon);
        return matches.every((b) => (b.itemId ?? b.itemTmpl.id) === (matches[0].itemId ?? matches[0].itemTmpl.id)) ? matches[0] : undefined;
      }
      openPicker(slot, root, kind) {
        const c = this.controller, stores = c.bridge.stores(), mode = stores.get('interaction')?.mode;
        const repair = mode === 'SMITHY_REPAIR' && ['section', 'charm'].includes(kind);
        if (!c.prefs.fill.enabled || !root.isConnected || !(repair || (kind === 'any' ? mode?.startsWith('SMITHY_') || mode === 'TAILOR_ADD_MATERIAL' : mode?.startsWith('GEM_')))) return;
        this.closePicker();
        const picker = this.doc.createElement('div'), rect = slot.getBoundingClientRect();
        picker.style.cssText = 'position:absolute;z-index:2147482000;max-height:320px;overflow:auto;width:240px;background:rgba(20,20,24,0.96);border:1px solid #a88a4a;border-radius:4px;font-size:12px;color:#eee';
        const view = this.doc.defaultView || globalThis;
        picker.style.left = Math.max(0, Math.min(rect.left, view.innerWidth - 242)) + (view.scrollX || 0) + 'px';
        picker.style.top = Math.max(0, Math.min(rect.bottom, view.innerHeight - 322)) + (view.scrollY || 0) + 'px';
        const state = c.bridge.state(), current = repair ? { selectedSection: this.repairSection(root, state) } : stores.get('gemInlay') || {};
        const choices = P.slotChoices(mode, kind, state, c.prefs, current);
        const preferred = repair && kind === 'charm' && current.selectedSection ? P.num(current.selectedSection.itemId ?? current.selectedSection.itemTmpl?.id) + 6 : 0;
        for (const item of choices) picker.appendChild(this.choiceRow(item, mode, !!preferred && P.num(item.itemId ?? item.itemTmpl?.id) !== preferred));
        if (!choices.length) picker.textContent = repair ? kind === 'charm' ? '背包里没有新莽神符' : '背包里没有残缺的神节' : '背包里没有可放入的物品';
        this.doc.body.appendChild(picker);
        this.picker = picker; this.pickerRoot = root; this.pickerMode = mode;
      }
      choiceRow(item, mode, mismatch = false) {
        const row = this.doc.createElement('div'), t = item.itemTmpl || item.equipTmpl;
        row.style.cssText = 'padding:6px;cursor:pointer;display:flex;align-items:center;gap:6px';
        if (t.icon) {
          const icon = this.doc.createElement('img');
          icon.src = t.icon; icon.width = 24; icon.height = 24; row.appendChild(icon);
        }
        const label = this.doc.createElement('span');
        label.textContent = t.name + (item.itemTmpl ? ' ×' + item.count + (item.isBound ? ' 绑定' : '') : (item.isEquipped ? ' 已穿戴' : '') + ' 孔 ' + P.slots(item).filter((n) => n >= 0).length + '/3 +' + P.num(item.enhanceLevel));
        if (mismatch) label.textContent += ' · 等级不匹配';
        row.appendChild(label);
        row.addEventListener('click', () => { this.choose(item, mode); this.closePicker(); });
        return row;
      }
      choose(item, mode) {
        const stores = this.controller.bridge.stores(), interaction = stores.get('interaction'), g = stores.get('gemInlay');
        if (interaction?.mode !== mode) return;
        if (mode !== 'GEM_SYNTH' || !item.itemTmpl?.gemLevel) return interaction.handleItemClick(this.live(item));
        if (g.selectedSynthGems?.length && g.selectedSynthGems[0].itemId !== item.itemId) { g.clearSynthGems(); g.clearSynthCharm(); }
        const selected = g.selectedSynthGems || [];
        const count = Math.min(5 - selected.length, item.count - selected.filter((b) => b.id === item.id).length);
        for (let n = 0; n < count; n++) if (interaction.handleItemClick(this.live(item)) === false) break;
      }
      subscribe() {
        const g = this.controller.bridge?.stores().get('gemInlay');
        if (!g || this.subscribed === g || !g.$subscribe) return;
        this.subscribed = g;
        g.$subscribe(() => this.remember(g), { flush: 'sync', detached: true });
        this.remember(g);
      }
      remember(g) {
        const fields = ['selectedDrillMaterial', 'selectedCharm', 'selectedSynthCharm', 'selectedRemoveCharm', 'selectedPolishGem', 'selectedPolishCharm', 'selectedSynthGems'];
        for (const field of fields) this.rememberField(g, field);
      }
      rememberField(g, field) {
        const value = field === 'selectedSynthGems' ? g[field]?.[0] : g[field];
        if (value) { this.memory[field] = { itemId: value.itemId, name: value.itemTmpl?.name, count: field === 'selectedSynthGems' ? g[field].length : 1 }; return; }
        const memory = this.memory[field];
        if (!memory) return;
        setTimeout(() => {
          if (this.memory[field] === memory && Date.now() - (this.responseAt || 0) > 1500) delete this.memory[field];
        }, 200);
      }
      response(packet) {
        if (!/^GEM_.*_RESPONSE$/.test(packet.type)) return;
        this.responseAt = Date.now();
        if (packet.success === true) {
          const memory = { ...this.memory };
          setTimeout(() => this.refill(packet.type.replace('_RESPONSE', ''), memory), 100);
        }
      }
      refill(mode, memory) {
        const c = this.controller, stores = c.bridge.stores(), g = stores.get('gemInlay'), interaction = stores.get('interaction');
        if (!c.prefs.fill.enabled || !c.prefs.fill.refill || interaction?.mode !== mode || !g || !this.doc.querySelector('div.gem-shop-window')) return;
        const fields = { GEM_DRILL: ['selectedDrillMaterial'], GEM_INLAY: ['selectedCharm'], GEM_SYNTH: ['selectedSynthGems', 'selectedSynthCharm'], GEM_REMOVE: ['selectedRemoveCharm'], GEM_POLISH: ['selectedPolishGem', 'selectedPolishCharm'] }[mode] || [];
        if (mode === 'GEM_DRILL' && (!g.selectedEquip || P.slots(g.selectedEquip).filter((n) => n >= 0).length >= 3)) return;
        for (const field of fields) this.refillField(mode, field, memory[field], g, interaction);
      }
      refillField(mode, field, memory, g, interaction) {
        if (!memory || (field === 'selectedSynthGems' ? g[field]?.length : g[field])) return;
        const s = this.controller.bridge.state(), kind = field === 'selectedSynthGems' || field === 'selectedPolishGem' ? 'gem' : field === 'selectedDrillMaterial' ? 'material' : 'charm';
        const all = P.slotChoices(mode, kind, s, this.controller.prefs, g).filter((b) => b.itemId === memory.itemId).sort((a, b) => Number(!!b.isBound) - Number(!!a.isBound));
        if (!all.length) {
          if (!memory.exhausted) this.controller.bridge.stores().get('ui')?.showMessage('「' + memory.name + '」已用完', 'info');
          memory.exhausted = true; return;
        }
        if (field === 'selectedSynthCharm' && (!g.selectedSynthGems?.length || !P.charmCompatible(s, all[0], 'synth', g.selectedSynthGems[0]))) return;
        const total = all.reduce((n, b) => n + b.count, 0);
        if (field === 'selectedSynthGems' && total < 2) return;
        let remaining = field === 'selectedSynthGems' ? Math.min(5, memory.count, total) : 1;
        for (const item of all) {
          const count = Math.min(remaining, item.count);
          for (let n = 0; n < count; n++) if (interaction.handleItemClick(this.live(item)) === false) return;
          remaining -= count;
          if (!remaining) break;
        }
      }
      click() {
        const c = this.controller, stores = c.bridge.stores(), interaction = stores.get('interaction');
        if (!interaction) return;
        const current = stores.get('gemInlay') || {}, mode = interaction.mode, state = c.bridge.state();
        if (mode === 'GEM_SYNTH' && !current.selectedSynthGems?.length) {
          current.clearSynthGems?.();
          current.clearSynthCharm?.();
        }
        let picks = P.fillPicks(mode, state, c.prefs, mode === 'TAILOR_ADD_MATERIAL' ? { family: null } : current);
        if (mode === 'TAILOR_ADD_MATERIAL') {
          if (picks.items.length && interaction.handleItemClick(this.live(picks.items[0])) !== false) return stores.get('ui')?.showMessage(picks.message, 'success');
          picks = P.fillPicks(mode, state, c.prefs, { family: 'mithril' });
        }
        for (const item of picks.items) if (interaction.handleItemClick(this.live(item)) === false) return;
        stores.get('ui')?.showMessage(picks.message, picks.items.length ? 'success' : 'warning');
      }
      // bridge.state() holds copies; the game windows keep the store's own objects.
      live(item) {
        const c = this.controller.bridge.character?.();
        const list = item?.equipTmpl ? c?.equipments : c?.bagItems;
        return (Array.isArray(list) && list.find((v) => v.id === item.id)) || item;
      }
      async pet(root) {
        // This route is not exercised live.
        const slot = root.querySelector('button.material-slot');
        if (!slot) return this.controller.bridge.stores().get('ui')?.showMessage('请先选择珍兽并进入提升悟性或打书', 'warning');
        const before = new Set(root.querySelectorAll('button'));
        slot.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const options = [...root.querySelectorAll('button')].filter((b) => !before.has(b));
        if (slot.getAttribute('aria-label') !== '放入根骨丹') return options[0]?.click();
        const bags = this.controller.bridge.state().bagItems || [];
        const family = [5025, 5026, 5027].find((id) => options.some((b) => bags.some((item) => item.itemId === id && item.itemTmpl?.name && b.textContent.includes(item.itemTmpl.name))));
        const candidates = bags.filter((b) => b.count > 0 && b.itemId === family);
        const rank = petRootRank(root.textContent);
        const needed = rank % 3 + 1;
        const best = candidates.toSorted((a, b) => Number(b.count >= needed) - Number(a.count >= needed) || (a.count >= needed && b.count >= needed ? Number(!!b.isBound) - Number(!!a.isBound) : b.count - a.count))[0];
        options[candidates.indexOf(best)]?.click();
      }
    }
    // The game shows the pet's root rank as "悟性 +N" since the client of 2026-11-19 ("根骨+N" before).
    const petRootRank = (text) => Number(String(text ?? '').match(/(?:悟性|根骨)\s*\+\s*(\d+)/)?.[1] || 0);
    const arraySafe = (v) => (Array.isArray(v) ? v : []);
    return {
      petRootRank, WarehouseShortcuts, Filler, Stats, MapRates, statsNumber, statsDuration, requestAllowed, matchesResponse, mergeTargets, Controller, Bridge, MarketScore, ALLOWED, PREFIX, readStorage, writeStorage, taggedKey, readTagged, saveConfigField, day, safeMessage, createTicker, createKeepAwake, createLogStore, showConflictNotice, createPaintScheduler, scoringState, copy,
    };
  })();
  if (typeof module !== 'undefined' && module.exports) module.exports.TLRuntime = TLRuntime;

  ('use strict');
  const TLUpdates = (() => {
    const HOUR = 60 * 60 * 1000,
      IMPORTANT = '【重要】',
      KEY = TLRuntime.PREFIX + ':updates',
      PAGE = 'https://github.com/YatsukiRenka/tl-idle-helper/releases',
      API = 'https://api.github.com/repos/YatsukiRenka/tl-idle-helper/releases/latest',
      INSTALL = 'https://raw.githubusercontent.com/YatsukiRenka/tl-idle-helper/main/tl-autopilot.user.js';
    // The script's number on Greasy Fork; 0 until it is listed there.
    const GREASYFORK_ID = 606230;
    const greasyForkPage = (id) => id ? 'https://greasyfork.org/zh-CN/scripts/' + id : '';
    // Where this copy was installed from, as the userscript manager reports it. A copy from Greasy Fork carries
    // Greasy Fork's own update address; any other copy counts as installed from GitHub.
    function installSource(info = typeof GM_info === 'undefined' ? null : GM_info) {
      const script = info?.script || {};
      const urls = [script.downloadURL, script.updateURL].filter((u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u))
        .map((u) => u.replace(/\.meta\.js(?=$|\?)/, '.user.js'));
      const url = urls.find((u) => /\.user\.js(?:$|\?)/.test(u)) || '';
      const id = Number((url.match(/^https:\/\/(?:update\.)?greasyfork\.org\/(?:[\w-]+\/)?scripts\/(\d+)/) || [])[1]) || 0;
      return { url, greasyFork: id > 0, greasyForkId: id };
    }
    const valid = (v) => typeof v === 'string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v);
    function compare(left, right) {
      if (!valid(left) || !valid(right)) throw new Error('版本格式无法识别');
      const a = left.split('.').map(Number),
        b = right.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
      return 0;
    }
    function parseNotes(body) {
      if (typeof body !== 'string') return null;
      const sections = [];
      let section;
      for (const line of body.split(/\r?\n/)) {
        if (line.startsWith('## ')) {
          section = { title: line.slice(3).slice(0, 20), items: [] };
          sections.push(section);
        } else if (line.startsWith('- ') && section && section.items.length < 12)
          section.items.push(line.slice(2).slice(0, 200));
      }
      const kept = sections.filter((s) => s.items.length).slice(0, 3);
      return kept.length ? { sections: kept } : null;
    }
    function noteItem(text) {
      if (typeof text !== 'string') return { text: '', important: false };
      const important = text.startsWith(IMPORTANT);
      return { text: important ? text.slice(IMPORTANT.length).trim() : text, important };
    }
    function importantItems(notes) {
      if (!Array.isArray(notes?.sections) || !notes.sections.every(section =>
        Array.isArray(section?.items) && section.items.every(text => typeof text === 'string'))) return [];
      return notes.sections.flatMap(section => section.items.map(noteItem)
        .filter(item => item.important).map(item => item.text));
    }
    function shouldApply(cache, currentVersion, now) {
      return valid(cache.version) && compare(cache.version, currentVersion) > 0 &&
        (cache.applyVersion !== cache.version ||
          (cache.applyTries < 5 && now - cache.applyAt >= 6 * 60 * 60 * 1000));
    }
    class Checker {
      constructor(controller, source = installSource()) {
        this.controller = controller;
        this.source = source;
        // Greasy Fork allows a script one update check a day; a copy from GitHub checks hourly.
        this.interval = source.greasyFork ? 24 * HOUR : HOUR;
        this.currentVersion = '1.3.3';
        this.busy = false;
        this.onChange = () => {};
        this.timer = null;
        this.localError = '';
      }
      status() {
        const cache = TLRuntime.readStorage(KEY, {}),
          order = valid(cache.version) ? compare(cache.version, this.currentVersion) : -1,
          important = importantItems(cache.notes).length > 0;
        return {
          busy: this.busy,
          currentVersion: this.currentVersion,
          latestVersion: cache.version || null,
          checkedAt: cache.checkedAt || null,
          nextCheckAt: cache.checkedAt ? cache.checkedAt + this.interval : null,
          daily: this.source.greasyFork,
          newer: order > 0,
          important,
          dialog: order >= 0 && important && cache.dialogVersion !== cache.version && cache.dismissedVersion !== cache.version,
          notes: cache.notes || null,
          error: cache.error || this.localError,
          dismissed: cache.dismissedVersion === cache.version,
          page: PAGE,
          greasyForkPage: greasyForkPage(this.source.greasyForkId || GREASYFORK_ID),
          installUrl: this.source.url || INSTALL,
          apply: {
            tries: cache.applyVersion === cache.version ? cache.applyTries || 0 : 0,
            lastAt: cache.applyVersion === cache.version ? cache.applyAt || null : null,
            exhausted: cache.applyVersion === cache.version && cache.applyTries >= 5,
          },
        };
      }
      start() {
        if (this.timer) return;
        // The five-minute timer checks the shared cache for the hourly deadline.
        this.timer = setInterval(() => {
          if (this.controller.prefs.updates.checkDaily) this.check().catch(() => {});
        }, 5 * 60 * 1000);
        // The check at page load is skipped for a copy from Greasy Fork: it would exceed one check a day.
        if (this.controller.prefs.updates.checkDaily) this.check(!this.source.greasyFork).catch(() => {});
      }
      stop() {
        clearInterval(this.timer);
        this.timer = null;
      }
      dismiss() {
        const cache = TLRuntime.readStorage(KEY, {});
        cache.dismissedVersion = cache.version || null;
        TLRuntime.writeStorage(KEY, cache);
        this.onChange();
      }
      closeDialog(version) {
        const cache = TLRuntime.readStorage(KEY, {});
        if (valid(cache.version) && (version === undefined || version === cache.version))
          TLRuntime.writeStorage(KEY, { ...cache, dialogVersion: cache.version });
        this.onChange();
      }
      markApply(now) {
        const cache = TLRuntime.readStorage(KEY, {});
        cache.applyTries = cache.applyVersion === cache.version ? cache.applyTries + 1 : 1;
        cache.applyVersion = cache.version;
        cache.applyAt = now;
        TLRuntime.writeStorage(KEY, cache);
        this.onChange();
      }
      async check(force) {
        const prior = TLRuntime.readStorage(KEY, {});
        if (prior.checkedAt && Date.now() - prior.checkedAt < (force === true ? 60000 : this.interval)) return this.status();
        if (this.busy) return this.status();
        if (!navigator.locks?.request) {
          TLRuntime.writeStorage(KEY, {
            ...prior,
            checkedAt: Date.now(),
            error: '请使用油猴管理器检查更新，此浏览器无法协调定时检查',
          });
          this.onChange();
          return this.status();
        }
        await navigator.locks.request(KEY, { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          const cache = TLRuntime.readStorage(KEY, {});
          if (cache.checkedAt && Date.now() - cache.checkedAt < (force === true ? 60000 : this.interval)) return;
          this.busy = true;
          const next = { checkedAt: Date.now(), error: '' };
          TLRuntime.writeStorage(KEY, { ...cache, ...next });
          if (TLRuntime.readStorage(KEY, {}).checkedAt !== next.checkedAt) {
            this.localError = '浏览器无法保存定时检查记录，请使用油猴管理器检查更新';
            this.busy = false;
            this.onChange();
            return;
          }
          this.localError = '';
          this.onChange();
          try {
            const response = await fetch(API, {
              credentials: 'omit',
              cache: 'no-store',
              signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) throw new Error('GitHub 暂无法访问');
            let data;
            try { data = await response.json(); }
            catch { throw new Error('GitHub 版本信息格式异常'); }
            if (!data || typeof data.tag_name !== 'string' ||
              !/^v\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(data.tag_name) ||
              data.draft === true || data.prerelease === true ||
              typeof data.html_url !== 'string' || !data.html_url.startsWith(PAGE + '/'))
              throw new Error('GitHub 版本信息格式异常');
            next.version = data.tag_name.slice(1);
            if (cache.checkedAt == null && compare(next.version, this.currentVersion) === 0) next.dialogVersion = next.version;
            const notes = parseNotes(data.body);
            next.notes = notes ? { title: 'v' + next.version + ' 更新内容', sections: notes.sections } : null;
          } catch (error) {
            next.error = error.message === 'GitHub 版本信息格式异常'
              ? error.message : 'GitHub 暂无法访问';
          } finally {
            TLRuntime.writeStorage(KEY, { ...TLRuntime.readStorage(KEY, {}), ...next });
            this.busy = false;
            this.onChange();
          }
        });
        return this.status();
      }
    }
    return { Checker, compare, parseNotes, importantItems, noteItem, shouldApply, installSource, greasyForkPage, IMPORTANT, HOUR, KEY, PAGE, INSTALL, GREASYFORK_ID };
  })();

  ('use strict');
  const TLPanel = (() => {
    const esc = (v) =>
      String(v ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
    const groups = [
      ['overview', '概览', [['status', '状态'], ['stats', '统计'], ['logs', '日志']]],
      ['strategy', '策略', [['battle', '挂机日常'], ['growth', '成长装备'], ['pets', '珍兽'], ['craft', '宝石工艺'], ['economy', '出售补药'], ['budget', '预算']]],
      ['score', '评分', [['score', '评分设置'], ['scoreStatus', '当前状态'], ['scoreStats', '属性分数'], ['scoreFormula', '计算公式']]],
      ['convenience', '便利性', [['bagTools', '背包仓库'], ['gameTools', '详情与窗口']]],
      ['system', '系统', [['settings', '设置'], ['updates', '更新']]],
    ];
    const PANEL_KEY = 'tl-autopilot-v1:panel';
    const warehouseKeyChoices = TLPolicy.warehouseKeys.map(keys => [keys, keys.split('+')
      .map(key => key[0].toUpperCase() + key.slice(1)).concat('右键').join(' + ')]);
    const qualityChoices = [
      [1, '白色（1）'],
      [2, '蓝色（2）'],
      [3, '紫色（3）'],
      [4, '橙色（4）'],
      [5, '红色（5）'],
    ];
    const pathGet = (o, path) => path.split('.').reduce((v, k) => v?.[k], o);
    const pathSet = (o, path, value) => {
      const ks = path.split('.');
      let cur = o;
      for (const k of ks.slice(0, -1)) cur = cur[k];
      cur[ks.at(-1)] = value;
    };
    const HELP = {
      budgetStatus: "默认保留强化、镶宝、星级、鉴定装备和套装部件；自动回收品质1的普通装备。宝石默认目标3级，强化默认目标+3。",
      activities: "珍珑需15级，伪宋军与熊林需30级。令牌、每日次数会结合游戏返回的资格数据核对。",
      arena: "比武 30 级开放。挑战和领奖需要回洛阳找比武校尉，会中断挂机。点赞不中断。每天 0 点（东八区）结算前的这段时间，托管回洛阳驻守并连续挑战：榜单每 30 秒刷新一次，不受每日挑战次数上限限制，期间不进副本。",
      gear: "比较同一张图上换装前后的每小时击杀；只有下降超过设定值且统计上可信（约 2 个标准差）才换回，换装后出现阵亡也会换回。核对期间不换其他装备。被换下的装备留在背包，不会自动出售。",
      hiddenClaim: "领取前请确认属攻；领错后转换要 5 砂。",
      hidden: "洗炼和喂养需要回洛阳找薛飞，会中断挂机。无相浮屠（300 万金币/轮）不会自动进入；手动进塔时托管不干预。",
      pets: "孵蛋、出战、喂养、领取都要先停止战斗（不用回城）。放生不可恢复：只放生脚本自己刚孵出的、1 级、未锁定、未出战、资质均值低于设定值的普通宝宝；达标的自动锁定。变异和二代珍兽不会被放生。",
      fill: "宝石、铁匠、裁缝窗口和云飘飘珍兽面板的标题栏出现“一键放入”：按当前功能页把最合适的装备、宝石、符和材料放进槽位，执行仍需自己点。镶嵌、打孔、合成、摘除、雕琢成功后，自动从背包补回刚用掉的同种符、打孔材料和宝石（合成、雕琢），直到用完。",
      tailor: "打造按角色已持有材料处理，目标以当前下发的模板与神器预览为准。",
      sellAppraised: "不勾选时，资质不是外攻、内攻双完美（都高于 1500）的已鉴定武器按其余规则出售；品质上限、强化、套装等保护照常生效。",
      sell: "穿戴、强化、镶宝和星级装备始终保留。材料仅按填写的模板ID处理。",
      warehouse: "只处理背包中未穿戴的装备；可穿戴的更优装备会先穿戴。仓库装备格满 200 时暂停存仓。符合存仓条件的装备不会被自动出售。",
      potions: "回血量长期等于掉血量，阈值高低不改变吃药数量，只决定安全余量。智能顺序按实测的每秒掉血和耗蓝，选回复速度够用、每金币回复最多的药，并改买这种药；血量低于 35% 或阵亡后一段时间内改用最强的药。",
      potionOrder: "游戏自动回复每次只用一颗药且有冷却。智能选择会按“最大值×(100%−阈值)”算出触发时的缺口，优先用刚好补满缺口的最小药，补不满的低级药排在后面兜底。填写指定模板ID时按填写顺序。",
      budget: "按本机日期统计。人物升级按目标等级和保留经验执行。技能升级、冶炼各有每日额度。",
      limits: "三项每日额度及各功能的每日操作上限填 0 均表示不限（仍受保留金币、保留经验约束）。保存不会清零已用额度。托管暂停时，保存后需点击“开始托管”。",
      json: "精简配置只含当前角色的设置；全量配置含本站所有角色的设置、数据和日志。导入或重置时会先列出改动，确认后立即生效。",
      scoreLink: "评分方式、权重和计算公式在“评分”页。",
      reset: "清除攻坚群攻记录、怪物属性缓存和浮屠楼层，从现在起统计各方案的生存权重。统计页的收益数据不变。挂机需要 30 分钟战斗数据，三环需要 5 分钟或一次挑战失败。",
      points: "点数指装备上的点数，已计入被动技能的加成。详细说明见“计算公式”。",
      linear: "固定权重与游戏战力相同，可编辑导出的配置文件后导入。",
      reference: "评分参照的怪物越多，换地图时分数越稳定；怪物属性每天向服务器读取一次。战斗数据不足 30 分钟时生存权重用手动值。",
      defense: "自动生存权重按门槛计算：安全时只等于生命药费占金币收入的比例（接近 0，防御和抗性几乎不加分）。实战评分每 100 分约等于整体实战能力的 1%；人物面板的实战评分是全身装备的合计贡献，换一件装备后它的变化等于两件装备的分数差。",
      attributes: "分数按当前属性和参照怪物实时计算，每 100 分约等于整体实战能力的 1%。点数指装备上的点数，已计入被动技能的加成。抗性只在低于怪物对应元素攻击时有用，超出的部分不加分，所以抗性的“+100 点”远小于“+1 点”的 100 倍。",
      stats: "经验按击杀前后的差值统计；“单倍经验”把天灵丹双倍时段折半，方便比较地图。每小时数值按在线时间折算，地图表按战斗时间折算。",
      install: "在油猴管理面板打开本脚本的设置，启用“检查更新”。新版本由 Tampermonkey 自动安装；本页的开关控制版本检查和提醒。新版安装后需刷新游戏。",
      intro: "人物升级按目标等级与保留经验执行；技能升级和冶炼各自使用每日额度。",
      updates: "自动检查：打开或刷新页面时一次，之后每小时一次；手动检查间隔至少 60 秒。",
      updatesDaily: "自动检查：每天一次；手动检查间隔至少 60 秒。",
    };
    const CSS = `:host([data-theme="dark"]){--bg:#202020;--surface:#2b2b2b;--surface-alt:#1c1c1c;--control:#2f2f2f;--stroke:#3d3d3d;--stroke-strong:#9d9d9d;--divider:#353535;--text:#ffffff;--text-strong:#ffffff;--text-2:#c8c8c8;--text-3:#9a9a9a;--accent:#e2bd6b;--accent-hover:#edcd85;--on-accent:#2b2100;--accent-text:#e9c97e;--accent-soft:rgba(226,189,107,.14);--ok:#6ccb5f;--warn:#ffb454;--err:#ff99a4;--hover:rgba(255,255,255,.06);--pressed:rgba(255,255,255,.035);--shadow:0 16px 40px rgba(0,0,0,.42);color-scheme:dark}
.hud.compact,:host([data-theme="light"]){--bg:#f3f3f3;--surface:#ffffff;--surface-alt:#ebebeb;--control:#ffffff;--stroke:#d6d6d6;--stroke-strong:#868686;--divider:#e6e6e6;--text:#1a1a1a;--text-strong:#000000;--text-2:#5a5a5a;--text-3:#767676;--accent:#c99a1c;--accent-hover:#b98a12;--on-accent:#1f1700;--accent-text:#7d5800;--accent-soft:rgba(201,154,28,.16);--ok:#0f7b0f;--warn:#9a5b00;--err:#c42b1c;--hover:rgba(0,0,0,.045);--pressed:rgba(0,0,0,.025);--shadow:0 16px 40px rgba(0,0,0,.16);color-scheme:light}
:host{all:initial;font-family:"Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif;color:var(--text);font-size:13px;line-height:1.5;font-variant-numeric:tabular-nums}
*{box-sizing:border-box}[hidden]{display:none!important}
.update-dialog{pointer-events:auto;box-sizing:border-box;width:min(522px,calc(100% - 32px));max-width:none;max-height:calc(100% - 32px);margin:auto;color:inherit;font:inherit;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;padding:20px;border:1px solid var(--stroke);border-radius:8px;background:var(--surface);box-shadow:var(--shadow)}
.update-dialog::backdrop{background:color-mix(in srgb,var(--on-accent) 55%,transparent)}
.update-dialog h2{margin:0 0 12px;color:var(--text-strong)}
.transfer-changes{max-height:38vh;overflow:auto;overscroll-behavior:contain}
.transfer-role{margin-top:8px;padding:8px;border:1px solid var(--stroke-strong);border-radius:8px}.transfer-role h4{margin:0 0 4px}
.transfer-choice{display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer}.transfer-scope{margin-top:8px}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:var(--stroke);border-radius:4px}::-webkit-scrollbar-track{background:transparent}
@supports not selector(::-webkit-scrollbar){*{scrollbar-width:thin;scrollbar-color:var(--stroke) transparent}}
button,input,select,textarea{font:inherit;color:inherit}button,summary{cursor:pointer}
button,input,select,textarea,summary,input[role=switch]::before{transition:color 120ms ease,background-color 120ms ease,border-color 120ms ease,transform 120ms ease}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
button:hover,summary:hover{background-color:var(--hover)}button:active,summary:active{background-color:var(--pressed)}
button:disabled,input:disabled,select:disabled,textarea:disabled{opacity:.4;cursor:default}
.shell{display:flex;flex-direction:column;position:fixed;left:max(12px,calc((100vw - 760px)/2));top:max(12px,calc((100vh - 716px)/2));width:760px;height:min(716px,calc(100vh - 24px));max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);background:var(--bg);border:1px solid var(--stroke);border-radius:8px;box-shadow:var(--shadow);pointer-events:auto;overflow:hidden}
.shell:focus{outline:none}
.head,.footer{flex-shrink:0}.head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--divider)}.head strong{font-size:14px;font-weight:600}
.head-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex:1;min-width:0}.head .version{height:28px;padding:0 8px;border:1px solid transparent;border-radius:4px;background:transparent;font-size:12px;color:var(--text-2);white-space:nowrap}.head .version:disabled{cursor:default;background:transparent}.head .version.has-update{color:var(--accent-text);background:var(--accent-soft)}.head .version.has-update:hover{background:var(--hover)}.head .version.has-update:active{background:var(--pressed)}
.btn{height:32px;padding:0 12px;border-radius:4px;border:1px solid var(--stroke);background:var(--control)}.btn:hover{background:var(--hover)}.btn:active{background:var(--pressed)}
.btn.primary{background:var(--accent);color:var(--on-accent);border-color:transparent;font-weight:600}.btn.primary:hover{background:var(--accent-hover)}.btn.primary:active{background:var(--accent);transform:translateY(1px)}.btn.warn{color:var(--warn);border-color:var(--warn)}
.btn.subtle,.text-button,.icon-button{background:transparent;color:var(--accent-text);border:1px solid transparent;border-radius:4px}.btn.subtle:hover,.text-button:hover,.icon-button:hover{background:var(--hover)}.btn.subtle:active,.text-button:active,.icon-button:active{background:var(--pressed)}
.icon-button{width:28px;height:28px;padding:0;flex:none}.text-button{height:28px;padding:0 4px;margin-left:auto;white-space:nowrap}
.hud{position:fixed;right:12px;top:12px;display:flex;align-items:center;gap:6px;height:40px;max-width:calc(100vw - 24px);padding:0 6px 0 12px;border:1px solid var(--stroke);border-radius:999px;background:var(--surface);box-shadow:var(--shadow);pointer-events:auto;z-index:1}
.hud,.head{touch-action:none;user-select:none;cursor:move}.hud-reason{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.hud-income,.hud-update{white-space:nowrap}.sep{height:16px;border-left:1px solid var(--divider)}.dot.warn{background:var(--warn)}.dot.err{background:var(--err)}
.summary{margin:0;padding:12px;background:var(--surface);border:1px solid var(--stroke);border-radius:6px}.status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.status-label{display:flex;align-items:center;gap:8px}.role-name{color:var(--text-2);min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dot{width:8px;height:8px;background:var(--text-3);border-radius:50%;flex-shrink:0}.dot.on{background:var(--ok)}.reason{padding-top:4px;font-size:15px;font-weight:600;overflow-wrap:anywhere}
.figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--divider)}.figure span{display:block;font-size:11px;color:var(--text-2)}.figure strong{font-weight:600;overflow-wrap:anywhere}
.facts{display:grid;row-gap:4px;margin:8px 0 0;padding-top:8px;border-top:1px solid var(--divider)}.facts>div{display:grid;grid-template-columns:2em minmax(0,1fr);column-gap:12px}.facts dt{color:var(--text-2);white-space:nowrap}.facts dd{margin:0;min-width:0;text-align:left;overflow-wrap:anywhere}.summary-login{margin-top:4px;font-size:12px;color:var(--text-2)}
.tabs{display:flex}.tabs button{position:relative;flex:none;height:28px;border:0;background:transparent;color:var(--text-2);padding:0 12px;border-radius:4px;white-space:nowrap}.tabs button:hover,.tabs button:active{background:transparent}.tabs button.active{color:var(--text);font-weight:600}
.tabs .has-update::after{content:'';display:inline-block;width:6px;height:6px;margin-left:4px;vertical-align:middle;border-radius:50%;background:var(--accent)}
.main{display:grid;grid-template-columns:190px minmax(0,1fr);min-height:0;flex:1;overflow:hidden;border-top:1px solid var(--divider)}.page-tabs{flex-direction:column;min-height:0;padding:8px;background:var(--surface-alt);border-right:1px solid var(--stroke);overflow:auto}.page-tabs button{transition:none;text-align:left;padding:0 8px;overflow:hidden;text-overflow:ellipsis}.page-tabs button.active{background:var(--surface)}.page-tabs button.active::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:4px;background:var(--accent)}
.body{padding:12px;flex:1;overflow:auto;min-height:0;min-width:0}.group{background:var(--surface);border:1px solid var(--stroke);border-radius:6px;margin-top:8px}.group:first-child{margin-top:0}.group>summary{display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 12px;list-style:none;border-radius:4px;font-weight:600}.group>summary::-webkit-details-marker{display:none}.group>summary::after{content:'›';flex:none;color:var(--text-2);transform:rotate(0deg);transition:transform 120ms ease}.group[open]>summary::after{transform:rotate(90deg)}.section-title{min-width:0;flex:1}.section-state{font-size:12px;font-weight:400;color:var(--text-2);white-space:nowrap}.master{display:flex;align-items:center;flex:none}.section-content{padding:0 12px 8px;border-top:1px solid var(--divider)}
.field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px;min-height:40px;padding:4px 0;border-bottom:1px solid var(--divider)}.field:last-child:not(.search-field){border-bottom:0}.field-label{display:flex;align-items:center;gap:4px;min-width:0;white-space:nowrap}.field-label>span{overflow:hidden;text-overflow:ellipsis}.field-control{display:flex;align-items:center;gap:4px}.field.dependent{padding-left:12px}.field.disabled{opacity:.45}.instant,.field-error{grid-column:1/-1}.unit{font-size:11px;color:var(--text-2);white-space:nowrap}.instant{font-size:12px;color:var(--accent-text);margin-left:4px;white-space:nowrap}
.control-input,.control-select{height:28px;border:1px solid var(--stroke);border-bottom-color:var(--stroke-strong);background:var(--control);border-radius:4px;padding:0 8px}.control-input{width:96px}.control-select{width:auto;max-width:100%;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.control-input:hover,.control-select:hover,textarea:hover{background:var(--hover)}.control-input:active,.control-select:active,textarea:active{background:var(--pressed)}.control-input:focus,.control-select:focus,textarea:focus{border-bottom:2px solid var(--accent)}input::placeholder,textarea::placeholder{color:var(--text-3)}
input[role=switch]{appearance:none;position:relative;width:40px;height:20px;margin:0;border:1px solid var(--stroke-strong);border-radius:12px;background:transparent;cursor:pointer;flex:none}input[role=switch]::before{content:'';position:absolute;top:50%;left:3px;width:12px;height:12px;border-radius:50%;background:var(--stroke-strong);transform:translateY(-50%)}input[role=switch]:checked{background:var(--accent);border-color:var(--accent)}input[role=switch]:checked::before{background:var(--on-accent);transform:translate(20px,-50%)}input[role=switch]:hover{background:var(--hover)}input[role=switch]:checked:hover{background:var(--accent-hover);border-color:var(--accent-hover)}input[role=switch]:hover::before{left:2px;width:14px;height:14px}input[role=switch]:active{background:var(--pressed)}input[role=switch]:checked:active{background:var(--accent)}
.footer{display:flex;align-items:center;gap:8px;padding:8px 16px;border-top:1px solid var(--divider);background:var(--surface-alt)}.dirty{font-size:12px;color:var(--text-2);flex:1}.dirty.unsaved{color:var(--warn)}.footer .btn{height:28px;white-space:nowrap}
.plan{padding:12px;border:1px solid var(--stroke);background:var(--surface);border-radius:6px;margin:8px 0}.plan small{display:block;color:var(--text-2);font-size:12px;margin-top:4px}.log{border-bottom:1px solid var(--divider);padding:8px 0;overflow-wrap:anywhere}.log time{font-size:11px;color:var(--text-3);margin-right:8px}.log.success{color:var(--ok)}.log.warning{color:var(--warn)}.log.error{color:var(--err)}
textarea{width:100%;background:var(--control);border:1px solid var(--stroke);border-bottom-color:var(--stroke-strong);border-radius:4px;padding:8px;min-height:232px;resize:vertical}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.error{color:var(--err);font-size:12px;min-height:20px}.field-error{color:var(--err);font-size:12px}[aria-invalid=true],[aria-invalid=true]:focus{border-color:var(--err)}
.income-table{color:var(--text);width:100%;border-collapse:collapse;font-size:12px}.income-table th{color:var(--text-2)}.income-table th,.income-table td{white-space:nowrap;padding:4px;text-align:right;border-bottom:1px solid var(--divider)}.income-table th:first-child,.income-table td:first-child{text-align:left}.income-table td[title]:first-child{max-width:12em;overflow:hidden;text-overflow:ellipsis}.table-scroll{max-width:100%;overflow-x:auto}.update-summary ul{padding-left:16px;margin:8px 0}.update-summary li{margin:4px 0}
.help{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;margin-left:4px;flex:none;border:1px solid var(--stroke-strong);border-radius:50%;background:transparent;color:var(--text-3);font-size:11px;line-height:1;vertical-align:middle}
.tooltip{position:fixed;z-index:1;max-width:280px;overflow:auto;padding:8px 12px;border:1px solid var(--stroke);border-radius:6px;background:var(--surface);box-shadow:var(--shadow);color:var(--text);font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none}
.stat-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--divider);font-size:12px}.stat-row:last-child{border-bottom:0}.stat-label{color:var(--text-2);flex:none}.stat-value{display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:4px;text-align:right;min-width:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}.stat-tile{min-width:0;padding:8px;border:1px solid var(--stroke);border-radius:6px;background:var(--surface)}.stat-tile>span,.stat-tile>small{display:block;font-size:11px;color:var(--text-2)}.stat-tile>strong{display:block;font-size:18px;font-weight:600;overflow-wrap:anywhere}
.chip{display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border:1px solid var(--stroke);border-radius:4px;background:var(--surface-alt);font-size:11px;white-space:nowrap}.chips{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:8px 0}.tone-neutral{color:var(--text-2)}.tone-ok{color:var(--ok)}.tone-warn{color:var(--warn)}.tone-err{color:var(--err)}.tone-accent{color:var(--accent-text)}
.info-bar{display:flex;align-items:center;gap:8px;padding:8px;margin:8px 0;border:1px solid var(--stroke);border-radius:6px;background:var(--surface-alt);font-size:12px}.info-bar>span:first-child{font-weight:600;flex:none}.empty-state{padding:8px 0;color:var(--text-2);font-size:12px}.block-title{display:flex;align-items:center;gap:4px;margin:12px 0 4px;font-size:12px;font-weight:600}
.reason .info-bar>span:only-child{flex:1;min-width:0;font-weight:inherit}.info-bar:has(>.error:empty){display:none}
.progress{padding:8px 0;font-size:12px}.progress [role=progressbar]{height:4px;margin-top:4px;border-radius:4px;background:var(--divider);overflow:hidden}.progress [role=progressbar]>span{display:block;height:100%;background:var(--accent)}
.segmented{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.segmented button{flex:1;padding:4px;border:1px solid var(--stroke);border-radius:4px;background:var(--control);font-size:12px;white-space:nowrap}.segmented button[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent)}.segmented button:hover{background:var(--hover)}
.trend{display:block;width:100%;height:140px;overflow:visible}.chart-line{fill:none;stroke:var(--accent);stroke-width:2;vector-effect:non-scaling-stroke}.chart-area{fill:var(--accent-soft)}.chart-dot{fill:var(--surface);stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke}.chart-grid{stroke:var(--divider);vector-effect:non-scaling-stroke}.chart-label{fill:var(--text-3);font-size:11px}.chart-range{fill:var(--hover)}.chart-hit{fill:transparent}.chart-guide{stroke:var(--stroke-strong);visibility:hidden;vector-effect:non-scaling-stroke}.chart-hour.tip-active .chart-guide{visibility:visible}.chart-hour:focus-visible{outline:none}.chart-hour:focus-visible .chart-dot{stroke-width:3}
.formula-table td:last-child{font-family:Consolas,monospace;text-align:left;overflow-wrap:anywhere}.formula-table th:last-child{text-align:left}.quality-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--text-3);margin-right:4px}.quality-1{background:var(--text-2)}.quality-2{background:oklch(from var(--accent) l c 250)}.quality-3{background:oklch(from var(--accent) l c 305)}.quality-4{background:var(--warn)}.quality-5{background:var(--err)}
.side,.content{display:flex;flex-direction:column;min-height:0;min-width:0}.side{background:var(--surface-alt)}.search-box{display:flex;padding:8px;gap:4px}.search-box input{min-width:0;width:100%}.page-tabs{flex:1}.group-heading{flex:none;height:24px;font-size:14px;line-height:20px;font-weight:700;color:var(--text-strong);padding:2px 8px}.page-header{display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid var(--divider)}.dirty{text-align:right}.footer{justify-content:flex-end}.searching .active{opacity:.5}label.field:has(select){display:flex;flex-wrap:wrap}label.field:has(select) .field-label{flex:1}label.field:has(select) .field-control{max-width:60%}label.field:has(select) .field-error{width:100%}.search-field>div{min-width:0}.search-field .breadcrumb{display:block;margin:0;height:auto;padding:0;font-size:12px;color:var(--text-2)}.current-status{padding:12px}.current-status .summary{padding:0;border:0}.current-status>.block-title{margin-top:0}.flash{animation:field-flash 600ms ease-out}@keyframes field-flash{from{background:var(--accent-soft)}}.hud-update,mark{background:var(--accent-soft);color:var(--accent-text)}
@media(max-width:819px){.main{display:flex;flex-direction:column}.side{flex:none}.content{flex:1}.page-tabs{flex-direction:row;overflow-x:auto}.group-heading{white-space:nowrap;align-self:center}.page-tabs button{max-width:none}}
.hud.compact{left:auto!important;right:12px!important;top:12px!important;height:32px;gap:1px;padding:0 3px;cursor:default;box-shadow:0 1px 4px var(--divider)}
.hud.compact>:not(.icon-button){display:none!important}.hud.compact .icon-button{color:var(--text-2)}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;
    const disguiseSession = 'tl-autopilot-v1:disguise';
    const disguiseTitles = { baidu: '百度一下，你就知道', google: 'Google', blank: '新标签页' };
    const disguiseImages = {
      baidu: ['https://www.baidu.com/img/PCtm_d9c8750bed0b3c7d089fa7d55720d6cf.png', 'https://www.baidu.com/favicon.ico'],
      google: ['https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png', 'https://www.google.com/favicon.ico'],
    };
    const coverCSS = `
:host{all:initial;color-scheme:light}
*{box-sizing:border-box}
.page{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;background:#fff;color:#222;font:14px Arial,sans-serif}
.canvas{position:relative;height:100%;min-height:500px}.blank .canvas{min-height:0}
button,input,textarea{font:inherit;color:inherit}button{border:0;background:none;cursor:pointer}
nav,aside,footer,.tools,.row,.guide,.ai{display:flex;align-items:center}
nav,aside{position:absolute;white-space:nowrap;font-size:13px}
.baidu nav{top:19px;left:24px;right:170px;overflow:hidden;gap:21px;line-height:23px}
.baidu aside{right:24px;top:18px;gap:32px}.login{border-radius:999px;color:#fff;visibility:hidden}
.baidu .login{width:58px;height:29px;background:#4e6ef2}
.google nav{right:10px;top:8.5px;gap:15px;color:#1f1f1f}
.google nav svg{margin-left:8px;fill:#444746}.google .login{width:85px;height:40px;background:#0b57d0;font-size:14px;font-weight:500}
main{position:absolute;left:50%;transform:translateX(-50%);text-align:center;width:min(var(--width),calc(100% - 32px))}
.baidu main{--width:800px;top:max(64px,calc(37.5% - 144px))}
.google main{--width:688px;top:max(64px,calc(37.5% - 117px))}
.blank main{--width:560px;top:50%;transform:translate(-50%,-50%)}
img,.wordmark{display:block;margin:auto}.wordmark{align-content:center;font-weight:700;font-size:50px;color:#e10600}
.baidu .wordmark{height:129px;padding-top:44px}.wordmark b{color:#2932e1}
.google .wordmark{height:92px;font:500 78px/92px Arial,sans-serif;letter-spacing:-5px}
.google .wordmark span{color:#4285f4}.google .wordmark span:nth-child(2),.google .wordmark span:nth-child(6){color:#ea4335}.google .wordmark span:nth-child(3){color:#fbbc05}.google .wordmark span:nth-child(5){color:#34a853}
[hidden]{display:none!important}textarea,input{min-width:0;outline:none;border:0;background:white;resize:none;font:16px Arial,sans-serif}
.baidu form{position:relative;height:99px;margin-top:15px;border:1px solid transparent;border-radius:19px;background:linear-gradient(white,white) padding-box,linear-gradient(160deg,#3377fe,#4c6fff,#8370ff,#ba59ff) border-box;box-shadow:0 10px 40px -8px #4d80ff0d,0 13px 18px -15px #4d80ff1a}
.baidu textarea{display:block;margin:9px 11px 0 16px;width:calc(100% - 27px);height:28px;padding:0 6px 0 0;color:#000}
textarea::placeholder{color:#9195a3}.tools{position:absolute;bottom:9px;right:9px;gap:15px}
.tools button{margin-left:3px;width:108px;height:44px;border-radius:15px;background:linear-gradient(136deg,#286aff,#4e6ef2,#7274f9,#9f66ff);color:white;font-size:17px;font-weight:500}
.guide{margin:37px auto 0;width:442px;max-width:100%;height:38px;padding:0 11px;justify-content:space-between;background:#f5f6fa;border-radius:22px;font-size:16px}
.guide b{font-size:15px;width:90px}.guide i{color:#535ef8;font-style:normal}
footer{position:absolute;bottom:0;width:100%;flex-wrap:wrap;justify-content:center}
.baidu footer{min-height:40px;gap:0 9px;font-size:12px;color:#bbb}
.side-tools{position:absolute;right:24px;bottom:44px;width:44px;height:138px;border:1px solid #dbdce0;border-radius:9px;display:grid;align-content:space-evenly;text-align:center;font-size:12px}.side-tools svg{display:block;margin:0 auto 2px}
.google{color:#16171a}.google svg{width:24px;height:24px;flex:none}
.google form{margin-top:26px}.row,.blank input{height:52px;width:100%;border:1px solid #dadce0;border-radius:26px;box-shadow:0 3px 10px #1f1f1f14}
.row{padding:0 8px 0 12px}.row textarea{flex:1;margin-left:12px;height:50px;padding:14px 0 0;line-height:22px}
.row textarea~svg{margin:0 8px}.row .ai{height:36px;margin-left:8px;padding:0 8px;border-radius:18px;background:#f3f5f6}.ai svg{width:20px;height:20px}
.actions{margin-top:29px}.actions button{height:36px;margin:0 6px;padding:0 16px;border:1px solid #f8f9fa;border-radius:8px;background:#f8f9fa;color:#3c4043}
.language{margin-top:43px;font-size:13px;line-height:28px;color:#4e5059}.language span{margin-left:6px;color:#1a0dab}
.google footer{min-height:50px;justify-content:space-between;padding:0 20px}.google footer span{display:inline-block;padding:0 15px}
.blank input{padding:0 18px}.blank button{position:absolute;right:6px;top:6px;height:40px;width:40px;color:#666}
`;
    function disguisePage(style) {
      const spans = values => values.map(value => '<span>' + value + '</span>').join('');
      const google = style === 'google';
      const input = google ? '<textarea rows="1" aria-label="搜索" autocomplete="off"></textarea>' :
        '<input type="search" aria-label="搜索" autocomplete="off">';
      let page;
      if (style === 'blank') {
        page = '<main><form>' + input + '<button type="submit" aria-label="搜索">⌕</button></form></main>';
      } else {
        const wordmark = google ? spans([...'Google']) : 'Bai<b>du</b>百度';
        const logo = `<img src="${disguiseImages[style][0]}" width="${google ? 272 : 270}" height="${google ? 92 : 129}" alt="${google ? 'Google' : '百度'}"><strong class="wordmark" hidden>${wordmark}</strong>`;
        if (google) {
          page = `<nav>Gmail<span>图片</span><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z"></path></svg><button class="login">登录</button></nav>
<main>${logo}<form><div class="row"><svg focusable="false" aria-hidden="true" viewBox="0 -960 960 960"><path d="M440-440H200v-80H440V-760h80v240H760v80H520v240H440V-440Z"></path></svg>${input}<svg aria-hidden="true" focusable="false" viewBox="0 -960 960 960"><path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm-40 280v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Z" fill="currentColor"></path></svg><svg aria-hidden="true" focusable="false" viewBox="0 -960 960 960"><path d="M480-320q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 160q-33 0-56.5-23.5T640-240q0-33 23.5-56.5T720-320q33 0 56.5 23.5T800-240q0 33-23.5 56.5T720-160Zm-440 40q-66 0-113-47t-47-113v-80h80v80q0 33 23.5 56.5T280-200h200v80H280Zm480-320v-160q0-33-23.5-56.5T680-680H280q-33 0-56.5 23.5T200-600v120h-80v-120q0-66 47-113t113-47h80l40-80h160l40 80h80q66 0 113 47t47 113v160h-80Z" fill="currentColor"></path></svg><button class="ai" type="button"><svg focusable="false" aria-hidden="true" viewBox="0 -960 960 960"><path d="M740-560q-6,0-8-6q-16-61-60.5-105.5T566-732q-6-2-6-8q0-7 6-8q61-16 105.5-60.5T732-914q2-6 8-6q7,0 8,6q17,61 61,105.5T914-748q6,1 6,8q0,6-6,8q-61,16-105.5,60.5T748-566q-1,6-8,6Zm44,440L534-370q-34,25-73,37.5T380-320q-109,0-184.5-75.5T120-580t75.5-184.5T380-840q29,0 57,6.5T491-815l-40,70q-17-8-35-11.5T380-760q-75,0-127.5,52.5T200-580t52.5,127.5T380-400q69,0 120-45.5T559-560h80q-3,36-15,70.5T590-426L840-176l-56,56Z"></path></svg>AI 模式</button></div>
<div class="actions"><button type="submit">Google 搜索</button><button type="button">手气不错</button></div></form>
<div class="language">Google 提供：<span>English</span></div></main>
<footer><div>${spans(['关于 Google','广告','商务','Google 搜索的运作方式'])}</div><div>${spans(['隐私权','条款','设置'])}</div></footer>`;
        } else {
          page = `<nav>${spans('新闻 hao123 地图 贴吧 视频 图片 网盘 库库AI 文心 百度搭子 更多'.split(' '))}</nav><aside>设置<button class="login">登录</button></aside>
<main>${logo}<form><textarea rows="1" aria-label="搜索" placeholder=""></textarea>
<div class="tools"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5.91621" y="1.63398" width="8.16801" height="11.6845" rx="4.084" stroke="currentColor" stroke-width="1.6"></rect><path d="M3.48096 12.5547C4.64674 14.9817 7.12786 16.6572 10.0003 16.6572C12.8728 16.6572 15.3539 14.9817 16.5197 12.5547" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"></path><path d="M10 16.6582V18.6118" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"></path></svg><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.99994 18.5C14.6944 18.5 18.4999 14.6944 18.4999 10C18.4999 5.30558 14.6944 1.5 9.99994 1.5C5.30552 1.5 1.49994 5.30558 1.49994 10C1.49994 14.6944 5.30552 18.5 9.99994 18.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"></path><path d="M10 6.33301V13.6663" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="round"></path><path d="M6.33325 10H13.6666" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="round"></path></svg><button type="submit">百度一下</button></div></form>
<div class="guide"><b><i>◩</i> 百度搭子</b>深度调研、搞创作、搭应用，帮你一键搞定<span>〉</span></div></main>
<div class="side-tools"><span><svg id="qrcode-home" width="16" height="20" fill="none" viewBox="0 0 16 20"><path stroke="currentColor" stroke-width="1.5" d="M.75 5.55c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C3.03.75 3.87.75 5.55.75h4.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311c.327.642.327 1.482.327 3.162v8.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327h-4.4c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C.75 16.47.75 15.63.75 13.95z" clip-rule="evenodd"></path><path fill="currentColor" d="M8.898 15.9a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0"></path><path stroke="currentColor" stroke-width="1.5" d="M.75 12.75h14"></path></svg>下载</span><span><svg width="17" height="18" fill="none" viewBox="0 0 17 18"><path fill="currentColor" fill-rule="evenodd" d="M6.637.397a2.96 2.96 0 0 1 2.962 0l5.156 2.976a2.96 2.96 0 0 1 1.481 2.566v5.953a2.96 2.96 0 0 1-1.482 2.566L9.6 17.434c-.916.53-2.046.53-2.962 0L1.48 14.458A2.96 2.96 0 0 1 0 11.892V5.939c0-1.058.565-2.037 1.481-2.566zM8.859 1.68a1.48 1.48 0 0 0-1.482 0L2.222 4.656c-.458.265-.74.754-.74 1.283v5.953c0 .529.282 1.018.74 1.283l5.155 2.976a1.48 1.48 0 0 0 1.482 0l5.155-2.976c.458-.265.74-.754.74-1.283V5.939c0-.53-.282-1.018-.74-1.283z" clip-rule="evenodd"></path><path fill="currentColor" fill-rule="evenodd" d="M8.118 7.064a1.852 1.852 0 1 0 0 3.703 1.852 1.852 0 0 0 0-3.703M4.785 8.915a3.333 3.333 0 1 1 6.666 0 3.333 3.333 0 0 1-6.666 0" clip-rule="evenodd"></path></svg>辅助</span></div>
<footer>${spans(['关于百度','About Baidu','使用百度前必读','帮助中心','企业推广','京公网安备11010802050023号','京ICP证030173号','互联网新闻信息服务许可证11220180008','网络文化经营许可证： 京网文〔2026〕0171-042号','♧','⌃'])}</footer>`;
        }
      }
      return `<style>${coverCSS}</style><section class="page ${style}" aria-label="${disguiseTitles[style]}"><div class="canvas">${page}</div></section>`;
    }
    class DisguiseCover {
      constructor(options) {
        this.hotkey = options.hotkey;
        this.title = disguiseTitles[options.style];
        this.originalTitle = document.title;
        this.focus = document.activeElement;
        while (this.focus?.shadowRoot?.activeElement) this.focus = this.focus.shadowRoot.activeElement;
        this.icons = new Map();
        this.media = new Map();
        this.icon = document.createElement('link');
        this.icon.rel = 'icon';
        const mark = options.style === 'blank' ? '<path d="M7 2h13l5 5v23H7z" fill="white" stroke="#999"/>' :
          '<text x="3" y="27" font-family="Arial" font-weight="bold" font-size="30" fill="#425fea">' + (options.style === 'google' ? 'G' : 'B') + '</text>';
        const fallback = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' + mark + '</svg>');
        this.icon.addEventListener('error', () => { if (this.icon.href !== fallback) this.icon.href = fallback; });
        this.icon.href = disguiseImages[options.style]?.[1] || fallback;
        this.host = document.createElement('div');
        this.host.id = 'tl-disguise-host';
        Object.assign(this.host.style, { position: 'fixed', inset: '0', zIndex: '2147482999' });
        const root = this.host.attachShadow({ mode: 'closed' });
        root.innerHTML = disguisePage(options.style);
        const input = root.querySelector('input,textarea'), logo = root.querySelector('img');
        logo?.addEventListener('error', () => {
          logo.hidden = true;
          root.querySelector('.wordmark').hidden = false;
        });
        const search = event => {
          event.preventDefault();
          const query = input.value.trim();
          if (query) window.open((options.style === 'google' ? 'https://www.google.com/search?q=' :
            'https://www.baidu.com/s?wd=') + encodeURIComponent(query), '_blank', 'noopener');
        };
        root.querySelector('form').addEventListener('submit', search);
        root.addEventListener('click', event => {
          if (event.target.closest('button[type="button"],nav,aside,footer,.guide,.side-tools')) event.preventDefault();
        });
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) search(event);
          event.stopPropagation();
        });
        document.documentElement.appendChild(this.host);
        input.focus();
        this.scrollLock = document.createElement('style');
        this.scrollLock.textContent = 'html,body{overflow:hidden!important;overscroll-behavior:none!important}';
        document.documentElement.appendChild(this.scrollLock);
        this.syncHead();
        if (options.mute) document.querySelectorAll('audio,video').forEach(el => this.mute(el));
        this.observer = new MutationObserver(records => {
          if (records.some(record => document.head?.contains(record.target) ||
            [...record.addedNodes].some(node => node === document.head))) this.syncHead();
          if (options.mute) for (const record of records) for (const node of record.addedNodes) {
            if (node.matches?.('audio,video')) this.mute(node);
            node.querySelectorAll?.('audio,video').forEach(el => this.mute(el));
          }
        });
        this.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      }
      mute(el) {
        if (!this.media.has(el)) this.media.set(el, el.muted);
        el.muted = true;
      }
      syncHead() {
        const head = document.head;
        if (!head) return;
        if (document.title !== this.title) {
          this.originalTitle = document.title;
          if (!head.querySelector('title')) {
            this.createdTitle = document.createElement('title');
            head.appendChild(this.createdTitle);
          }
          document.title = this.title;
        }
        for (const icon of head.querySelectorAll('link[rel~="icon"]')) {
          if (icon === this.icon) continue;
          const marker = document.createComment('');
          icon.replaceWith(marker);
          this.icons.set(icon, marker);
        }
        if (this.icon.parentNode !== head) head.appendChild(this.icon);
      }
      remove() {
        this.observer.disconnect();
        if (document.title === this.title) document.title = this.originalTitle;
        if (this.createdTitle && !this.createdTitle.textContent) this.createdTitle.remove();
        this.icon.remove();
        for (const [icon, marker] of this.icons) marker.replaceWith(icon);
        for (const [el, muted] of this.media) el.muted = muted;
        this.scrollLock.remove();
        this.host.remove();
        if (this.focus?.isConnected) this.focus.focus?.({ preventScroll: true });
      }
    }
    class Panel {
      constructor(controller) {
        this.controller = controller;
        this.windowOpen = false;
        this.query = '';
        this.bodyDirty = true;
        this.loadPanelState();
        this.section = this.panelState.page;
        this.pending = TLPolicy.clone(controller.prefs);
        this.dirty = false;
        this.previewPlans = [];
        this.roleKey = '';
        this.summaryHTML = null;
        window.addEventListener('keydown', event => this.disguiseKeydown(event), true);
        window.addEventListener('storage', event => {
          if (event.key === TLUpdates.KEY || event.key === null) this.controller.paint(true);
        });
        this.mount();
      }
      disguiseKeydown(event) {
        if (event.repeat) return;
        const button = this.captureButton;
        if (button && event.composedPath().includes(button)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const key = TLPolicy.eventHotkey(event);
          const error = button.closest('.field').querySelector('.field-error');
          if (!key && event.key !== 'Escape') {
            error.textContent = '需要包含 Ctrl、Alt 或使用功能键';
            error.hidden = false;
            button.setAttribute('aria-invalid', 'true');
            return;
          }
          if (key) {
            this.pending.disguise.hotkey = key;
            this.dirty = true;
            this.paintDirty();
          }
          this.endCapture();
          return;
        }
        const saved = this.controller.prefs.disguise;
        if ((this.cover || saved.enabled) && TLPolicy.eventHotkey(event) === (this.cover?.hotkey || saved.hotkey)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.toggleDisguise();
        }
      }
      endCapture() {
        const button = this.captureButton;
        if (!button) return;
        this.captureButton = null;
        button.textContent = this.pending.disguise.hotkey;
        this.validateInput(button);
      }
      toggleDisguise(options = this.controller.prefs.disguise) {
        if (this.cover) {
          if (this.reopenWindow && !this.windowOpen) this.setWindow(true);
          this.cover.remove();
          this.cover = null;
          this.hud.classList.remove('compact');
          this.place('hud', this.hud);
          try { sessionStorage.removeItem(disguiseSession); } catch {}
          this.hudAt = -Infinity;
          this.controller.paint(true);
        } else if (options.enabled) {
          this.hideUpdateDialog();
          this.reopenWindow = this.windowOpen;
          this.cover = new DisguiseCover(options);
          if (this.windowOpen) {
            this.windowOpen = false;
            this.shell.hidden = true;
            this.hideTooltip();
          }
          this.hud?.classList.toggle('compact', true);
          try { sessionStorage.setItem(disguiseSession, '1'); } catch {}
        }
      }
      mount() {
        if (!document.documentElement) {
          const observer = new MutationObserver(() => {
            if (!document.documentElement) return;
            observer.disconnect();
            this.mount();
          });
          observer.observe(document, { childList: true });
          return;
        }
        let restore = false;
        try {
          restore = sessionStorage.getItem(disguiseSession) === '1';
          if (restore && !this.controller.prefs.disguise.enabled) sessionStorage.removeItem(disguiseSession);
        } catch {}
        if (restore && this.controller.prefs.disguise.enabled) this.toggleDisguise();
        this.host = document.createElement('div');
        this.host.id = 'tl-autopilot-host';
        this.host.setAttribute?.('data-theme', this.uiState().theme);
        Object.assign(this.host.style, {
          position: 'fixed',
          right: '12px',
          top: '12px',
          zIndex: '2147483000',
          pointerEvents: 'none',
        });
        document.documentElement.appendChild(this.host);
        this.root = this.host.attachShadow({ mode: 'open' });
        const light = this.uiState().theme === 'light';
        const icon = (action, glyph, label) => `<button type="button" class="icon-button" data-action="${action}" aria-label="${label}" title="${label}">${glyph}</button>`;
        this.root.innerHTML = `<style>${CSS}</style><div class="hud"><span class="dot"></span><span class="hud-reason" role="button" tabindex="0"></span><button type="button" class="chip hud-update" data-action="showUpdates" hidden></button><span class="sep income-sep" hidden></span><span class="hud-income" hidden></span><span class="sep"></span>${icon('toggleRun','▶','开始托管')}${icon('stopBattle','■','停止战斗')}${icon('settingsWindow','⚙','打开设置')}</div>
          <section class="shell" role="dialog" tabindex="-1" aria-label="TL挂机助手设置" hidden><header class="head"><div class="head-title"><strong>TL挂机助手</strong><button type="button" class="version" data-action="showUpdates" disabled>v1.3.3</button></div><button type="button" class="icon-button" data-action="theme" aria-label="切换浅色 / 深色主题" title="${light ? '切换深色主题' : '切换浅色主题'}">${light ? '☀' : '☾'}</button>${icon('close','✕','关闭设置')}</header>
          <div class="main"><aside class="side"><div class="search-box"><input class="search control-input" aria-label="搜索设置" placeholder="搜索设置…">${icon('clearSearch','✕','清除搜索')}</div>${this.navigationHTML()}</aside><div class="content"><header class="page-header"><strong class="page-title"></strong><span class="dirty"></span></header><div class="body"></div><footer class="footer"><button type="button" class="btn subtle" data-action="revert" hidden>撤销</button><button type="button" class="btn" data-action="save">保存策略</button></footer></div></div></section>`;
        this.hud = this.root.querySelector('.hud');
        if (this.cover) this.hud.classList.toggle('compact', true);
        this.shell = this.root.querySelector('.shell');
        this.root.addEventListener('pointerdown', (event) => {
          if (event.target.closest('.shell') !== this.shell) return;
          const control = event.target.closest('button,input,textarea,select,summary,a[href],[tabindex],[contenteditable]');
          if (control === this.shell || control?.disabled) this.shell.focus({ preventScroll: true });
        });
        this.search = this.root.querySelector('.search');
        this.clearSearch = this.root.querySelector('[data-action="clearSearch"]');
        this.clearSearch.hidden = true;
        this.bindDrag('hud', this.hud, this.hud);
        this.bindDrag('window', this.shell, this.root.querySelector('.head'));
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'tl-panel-tooltip';
        this.tooltip.className = 'tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.hidden = true;
        this.root.querySelector('.shell').appendChild(this.tooltip);
        this.versionChip = this.root.querySelector('.version');
        const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 819px)'),
          orientRail = () => {
            const rail = this.root.querySelector('.page-tabs'), orientation = narrow?.matches ? 'horizontal' : 'vertical';
            if (rail && rail.getAttribute('aria-orientation') !== orientation) rail.setAttribute('aria-orientation', orientation);
          };
        orientRail();
        narrow?.addEventListener?.('change', orientRail);
        this.root.addEventListener('click', async (e) => {
          if (e.target.closest('[data-tip]')?.dataset.tip != null) return;
          if (e.target.closest('.master')?.classList.contains('master')) {
            e.stopPropagation();
            return;
          }
          if (e.target.classList?.contains('hud-reason')) { this.openPage('status'); return; }
          const b = e.target.closest('button');
          if (!b) return;
          const action = b.dataset.action;
          if (action === 'captureHotkey') {
            this.captureButton = b;
            b.textContent = '请按下新的快捷键…';
            b.focus();
            return;
          }
          if (action === 'tryDisguise') { this.toggleDisguise(this.pending.disguise); return; }
          if (action === 'theme') {
            const state = this.uiState(), light = state.theme !== 'light';
            state.theme = light ? 'light' : 'dark';
            this.host.setAttribute('data-theme', state.theme);
            b.textContent = light ? '☀' : '☾';
            b.title = light ? '切换深色主题' : '切换浅色主题';
            this.savePanelState();
            return;
          }
          if (action === 'showUpdates') { if (!b.disabled) this.openPage('updates'); return; }
          if (action === 'settingsWindow' || action === 'close') { this.setWindow(!this.windowOpen); return; }
          if (action === 'clearSearch') { this.setQuery(''); this.search.focus(); return; }
          if (action === 'toggleRun' || action === 'start' || action === 'pause') {
            this.hudAt = -Infinity;
            if (action === 'pause' || (action === 'toggleRun' && (this.controller.enabled ?? this.hudRunning))) this.controller.pause(undefined, true);
            else this.controller.start();
            this.controller.paint(true);
            return;
          }
          if (b.dataset.result != null) { this.openResult(Number(b.dataset.result)); return; }
          if (b.dataset.gearProfile && !b.disabled) {
            const current = this.controller.prefs, profile = b.dataset.gearProfile;
            this.pending.gear.profile = profile;
            this.controller.updateConfig({ ...current, gear: { ...current.gear, profile } });
            this.requestBody();
            return;
          }
          if (b.dataset.scoreProfile) { this.scoreProfile = b.dataset.scoreProfile; this.requestBody(); return; }
          if (b.dataset.range || b.dataset.metric) {
            const state = this.uiState(), key = b.dataset.range ? 'range' : 'metric', value = b.dataset[key];
            if (state[key] !== value) {
              state[key] = value;
              this.savePanelState();
              this.requestBody();
            }
            return;
          }
          if (action === 'showScore') {
            this.selectPage('score');
            return;
          }
          if (b.dataset.tab) {
            this.openPage(b.dataset.tab);
            if (this.section === 'settings') await this.queryDatabaseUsage();
            return;
          }
          if (['clearLogs', 'clearDatabase', 'clearStats', 'clearGearRejected', 'resetScoring'].includes(action) && !this.confirmAction(b)) return;
          if (action === 'clearGearRejected') {
            this.controller.clearGearRejected();
            this.requestBody();
          }
          else if (action === 'resetScoring') {
            this.controller.resetScoring();
            this.requestBody();
          }
          else if (action === 'clearStats') {
            this.controller.stats?.clear();
            this.controller.mapRates?.clear();
            this.controller.smartDecision = null;
            this.requestBody();
          }
          else if (action === 'stopBattle') this.controller.stopBattle();
          else if (action === 'save') {
            this.pending = TLPolicy.clone(this.controller.updateConfig(this.pending));
            this.dirty = false;
            this.requestBody();
          } else if (action === 'revert') {
            this.pending = TLPolicy.clone(this.controller.prefs);
            this.dirty = false;
            this.requestBody();
          } else if (action === 'preview') {
            this.previewPlans = this.controller.preview();
            this.section = 'status';
            this.uiState().sections['status:计划预览'] = true;
            this.rememberPage();
            this.requestBody();
          } else if (action === 'reset') this.previewTransfer({ kind: 'reset', config: TLPolicy.DEFAULTS });
          else if (action === 'export') this.download('天龙托管配置.json', this.pending);
          else if (action === 'exportFull') {
            try {
              const file = await this.controller.exportData(TLPolicy.clone(this.controller.prefs));
              const stamp = TLRuntime.day(new Date(file.exportedAt)).replaceAll('-', '');
              this.download('天龙托管全量配置-' + file.host.replaceAll(':', '_') + '-' + stamp + '.json', file);
            } catch (error) { this.transferError('导出失败：' + error.message); }
          }
          else if (action === 'diagnostics')
            this.download('天龙托管诊断.json', this.controller.status());

          else if (action === 'importConfig') this.root.querySelector('.config-file').click();
          else if (['exportLogs', 'clearLogs', 'clearDatabase'].includes(action)) {
            try {
              if (action === 'exportLogs') {
                const date = new Date(), stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
                this.download('TL挂机助手日志-' + location.host + '-' + stamp + '.txt', await this.controller.exportLogs(), 'text/plain');
              } else if (action === 'clearLogs') {
                await this.controller.clearLogs();
                await this.queryDatabaseUsage();
              } else if (action === 'clearDatabase') {
                await this.controller.clearLogDatabase();
                await this.queryDatabaseUsage();
              }
            } catch (error) {
              const line = this.root.querySelector('.error');
              if (line) line.textContent = '日志操作失败：' + error.message;
            }
          }
          this.controller.paint();
        });
        this.root.addEventListener('focusout', e => {
          if (this.captureButton === e.target) this.endCapture();
        });
        this.root.addEventListener('input', (e) => {
          if (e.target === this.search) { this.setQuery(this.search.value); return; }
          const path = e.target.dataset.path;
          if (!path) return;
          const base = pathGet(TLPolicy.DEFAULTS, path);
          let value =
            e.target.type === 'checkbox'
              ? e.target.checked
              : typeof base === 'number'
                ? Number(e.target.value)
                : Array.isArray(base)
                  ? e.target.value
                      .split(/[,，\s]+/)
                      .map(Number)
                      .filter((n) => Number.isFinite(n) && n > 0)
                  : e.target.value;
          pathSet(this.pending, path, value);
          this.syncFields();
          this.validateInput(e.target);
          if (path === 'logs.level') {
            TLRuntime.saveConfigField(this.controller, 'logs', 'level', TLPolicy.config(this.pending).logs.level);
            this.paintLogs();
            this.paintDirty();
            return;
          }
          if (path === 'market.sort') {
            const current = this.controller.prefs;
            this.controller.updateConfig({ ...current, market: { ...current.market, sort: value } });
            this.paintDirty();
            return;
          }
          this.dirty = true;
          this.paintDirty();
        });
        this.root.addEventListener('keydown', (e) => {
          if (this.windowOpen && e.target.closest('.shell') &&
            !e.target.matches('textarea') && !(e.target.matches('input') && e.target.type !== 'checkbox') &&
            !e.altKey && !e.metaKey &&
            (e.ctrlKey ? !e.shiftKey && e.key.toLowerCase() === 'f' : e.key === '/')) {
            e.preventDefault();
            this.search.focus();
            return;
          }
          if (e.target.matches('.hud-reason') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); this.openPage('status'); return; }
          if (e.target === this.versionChip && ['Enter', ' '].includes(e.key)) {
            e.preventDefault();
            if (!e.repeat) this.versionChip.click();
            return;
          }
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          const button = e.target.closest('[role="tab"]'), row = button?.closest('[role="tablist"]');
          if (!row) return;
          if (['ArrowUp', 'ArrowDown'].includes(e.key) && !row.classList.contains('page-tabs')) return;
          const buttons = [...row.querySelectorAll('[role="tab"]')].filter((tab) => !tab.hidden),
            index = buttons.indexOf(button), next = buttons[(index + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + buttons.length) % buttons.length];
          e.preventDefault();
          next.focus();
          next.click();
          next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
        this.root.addEventListener('toggle', (e) => {
          const section = e.target;
          if (!section.matches('details.group')) return;
          const state = this.uiState(), key = section.dataset.section;
          if ((state.sections[key] ?? (section.dataset.defaultOpen === 'true')) === section.open) return;
          state.sections[key] = section.open;
          this.savePanelState();
        }, true);
        this.root.addEventListener('change', async (e) => {
          if (!e.target.matches('.config-file') || !e.target.files?.[0]) return;
          try {
            const file = e.target.files[0];
            const text = await file.text().catch(error => { throw new Error('读取配置文件失败：' + error.message, { cause: error }); });
            this.previewTransfer(TLPolicy.transferFile(text), file.lastModified);
          } catch (error) {
            this.transferError(error.message);
          }
          e.target.value = '';
        });
        this.root.addEventListener('click', (e) => {
          const action = e.target.closest('button')?.dataset.action;
          if (action === 'checkUpdate')
            this.controller.updates
              ?.check(true)
              .then(() => this.requestBody())
              .catch(() => {});
          else if (action === 'openUpdate')
            window.open(this.controller.updates.status().page, '_blank', 'noopener,noreferrer');
          else if (action === 'openGreasyFork')
            window.open(this.controller.updates.status().greasyForkPage, '_blank', 'noopener,noreferrer');
          else if (action === 'installUpdate')
            window.open(this.controller.updates.status().installUrl, '_blank', 'noopener,noreferrer');
          else if (action === 'dismissUpdate') {
            this.controller.updates?.dismiss();
            this.requestBody();
          }
        });
        this.bindTooltips();
        this.controller.panel = this;
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.controller.paint(true);
        });
        this.controller.paint(true);
      }
      setWindow(open) {
        this.windowOpen = open;
        this.shell.hidden = !open;
        if (open) {
          this.place('window', this.shell);
          this.controller.paint(true);
          this.root.querySelector('[data-tab="' + this.section + '"]')?.focus();
        } else {
          this.hideTooltip();
          if (this.query) this.bodyDirty = true;
          this.setQuery('');
          this.root.querySelector('[data-action="settingsWindow"]').focus();
        }
      }
      openPage(page) {
        this.setQuery('');
        this.selectPage(page);
        if (!this.windowOpen) this.setWindow(true);
      }
      place(key, element, requested) {
        if (this.cover && key === 'hud') return;
        const position = requested || this.uiState()[key];
        if (!position || element.hidden || typeof window === 'undefined') return;
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, Math.min(position.x, window.innerWidth - rect.width));
        const y = Math.max(0, Math.min(position.y, window.innerHeight - rect.height));
        Object.assign(element.style, { left: x + 'px', top: y + 'px', right: 'auto' });
        this.uiState()[key] = { x, y };
        if (!requested && (x !== position.x || y !== position.y)) this.savePanelState();
      }
      bindDrag(key, element, handle) {
        let drag, suppressClick = false;
        this.place(key, element);
        globalThis.window?.addEventListener('resize', () => this.place(key, element));
        handle.addEventListener('pointerdown', (event) => {
          suppressClick = false;
          if ((this.cover && key === 'hud') || event.button !== 0 || event.target.closest('button')) return;
          const rect = element.getBoundingClientRect();
          event.target.setPointerCapture?.(event.pointerId);
          drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        });
        handle.addEventListener('pointermove', (event) => {
          if (!drag || event.pointerId !== drag.id) return;
          const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) < 4) return;
          drag.moved = true;
          this.place(key, element, { x: drag.left + dx, y: drag.top + dy });
        });
        const end = (event) => {
          if (!drag || event.pointerId !== drag.id) return;
          if (drag.moved) {
            suppressClick = event.type !== 'pointercancel';
            this.savePanelState();
          }
          drag = null;
        };
        handle.addEventListener('click', (event) => {
          if (!suppressClick || event.detail === 0) return;
          suppressClick = false;
          event.preventDefault();
          event.stopPropagation();
        });
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        handle.addEventListener('dblclick', (event) => {
          if ((this.cover && key === 'hud') || event.target.closest('button')) return;
          delete this.uiState()[key];
          Object.assign(element.style, { left: '', top: '', right: '' });
          this.savePanelState();
        });
      }
      statusTone(s) {
        return s.pausedBySelf ? 'err' : s.enabled && s.connected && s.ready && s.role && s.reason !== '检测到手动操作，稍后继续' ? 'on' : 'warn';
      }
      paintHud() {
        const now = Date.now();
        const enabled = this.controller.enabled ?? this.hudRunning;
        if (!this.hud || (enabled === this.hudRunning && now - (this.hudAt ?? -Infinity) < 1000)) return;
        this.hudAt = now;
        const s = this.controller.hudStatus();
        this.hudRunning = s.enabled;
        const reason = this.hud.querySelector('.hud-reason'), rate = this.hud.querySelector('.hud-income');
        if (reason.textContent !== s.reason) { reason.textContent = s.reason; reason.title = s.reason; }
        this.hud.querySelector('.dot').className = 'dot ' + this.statusTone(s);
        rate.hidden = this.hud.querySelector('.income-sep').hidden = s.expPerHour == null;
        if (!rate.hidden) rate.textContent = '经验 ' + TLRuntime.statsNumber(s.expPerHour) + '/时';
        const run = this.hud.querySelector('[data-action="toggleRun"]');
        run.title = s.enabled ? '暂停托管' : '开始托管';
        run.setAttribute('aria-label', run.title);
        run.textContent = s.enabled ? '⏸' : '▶';
        const chip = this.hud.querySelector('.hud-update');
        chip.hidden = !(this.controller.prefs.updates.remind && s.update?.newer && !s.update.dismissed);
        if (!chip.hidden) chip.textContent = '可更新 v' + s.update.latestVersion;
        this.place('hud', this.hud);
      }
      requestBody() {
        this.bodyDirty = true;
        this.controller.paint();
      }
      loadPanelState() {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(PANEL_KEY)); } catch {}
        const pages = groups.flatMap(([, , items]) => items.map(([id]) => id));
        this.panelState = { page: pages.includes(saved?.page) ? saved.page : 'status', last: {}, sections: {},
          theme: saved?.theme === 'dark' ? 'dark' : 'light',
          range: ['recent', 'previous', 'today', 'day24'].includes(saved?.range) ? saved.range : 'recent',
          metric: ['exp', 'net', 'kills'].includes(saved?.metric) ? saved.metric : 'exp' };
        for (const [id, , items] of groups)
          this.panelState.last[id] = items.some(([page]) => page === saved?.last?.[id]) ? saved.last[id] : items[0][0];
        for (const [key, value] of Object.entries(saved?.sections && typeof saved.sections === 'object' ? saved.sections : {}))
          if (pages.includes(key.split(':')[0]) && typeof value === 'boolean') this.panelState.sections[key] = value;
        for (const key of ['hud', 'window']) {
          const pos = saved?.[key];
          if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) this.panelState[key] = { x: pos.x, y: pos.y };
        }
        this.panelStateJSON = JSON.stringify(this.panelState);
      }
      uiState() {
        if (!this.panelState) this.loadPanelState();
        return this.panelState;
      }
      savePanelState() {
        const value = JSON.stringify(this.uiState());
        if (value === this.panelStateJSON) return;
        this.panelStateJSON = value;
        TLRuntime.writeStorage(PANEL_KEY, this.uiState());
      }
      rememberPage() {
        const group = groups.find(([, , items]) => items.some(([id]) => id === this.section));
        if (!group) return;
        const state = this.uiState();
        state.page = this.section;
        state.last[group[0]] = this.section;
        this.savePanelState();
      }
      selectPage(page) {
        if (page === this.section || !groups.some(([, , items]) => items.some(([id]) => id === page))) return;
        this.section = page;
        this.rememberPage();
        this.requestBody();
      }
      navigationHTML() {
        return '<nav class="tabs page-tabs" role="tablist" aria-label="设置页面" aria-orientation="vertical">' + groups.map(([group, name, items]) =>
          `<strong class="group-heading" data-group="${group}">${name}</strong>` + items.map(([id, title]) =>
            `<button type="button" role="tab" data-tab="${id}" aria-selected="false" tabindex="-1">${title}</button>`).join('')).join('') + '</nav>';
      }
      paintNavigation() {
        this.root.querySelectorAll('[data-tab]').forEach((button) => {
          const active = button.dataset.tab === this.section;
          if (button.classList.contains('active') !== active) button.classList.toggle('active', active);
          if (button.getAttribute('aria-selected') !== String(active)) button.setAttribute('aria-selected', String(active));
          if (button.tabIndex !== (active ? 0 : -1)) button.tabIndex = active ? 0 : -1;
        });
        const header = this.root.querySelector('.page-title');
        if (header) header.textContent = this.query ? '搜索结果' : groups.flatMap(([, , items]) => items).find(([id]) => id === this.section)?.[1] || '';
      }
      confirmAction(button) {
        this.confirmations ||= new Map();
        const previous = this.confirmations.get(button), now = Date.now();
        if (previous) {
          this.resetConfirmation(button);
          if (now < previous.until) return true;
        }
        const pending = { label: button.textContent, warn: button.classList.contains('warn'), until: now + 3000 };
        button.textContent = '再点一次确认';
        button.classList.toggle('warn', true);
        pending.timer = setTimeout(() => this.resetConfirmation(button), 3000);
        this.confirmations.set(button, pending);
        return false;
      }
      resetConfirmation(button) {
        const pending = this.confirmations?.get(button);
        if (!pending) return;
        clearTimeout(pending.timer);
        button.textContent = pending.label;
        button.classList.toggle('warn', pending.warn);
        this.confirmations.delete(button);
      }
      changedPaths(pending, saved) {
        if (Object.is(pending, saved)) return 0;
        if (Array.isArray(pending) || Array.isArray(saved)) return JSON.stringify(pending) === JSON.stringify(saved) ? 0 : 1;
        if (pending && saved && typeof pending === 'object' && typeof saved === 'object')
          return [...new Set([...Object.keys(pending), ...Object.keys(saved)])]
            .reduce((count, key) => count + this.changedPaths(pending[key], saved[key]), 0);
        return 1;
      }
      paintDirty() {
        const count = this.changedPaths(this.pending, this.controller?.prefs || this.pending), dirty = count > 0;
        const line = this.root.querySelector('.dirty'), button = this.root.querySelector('[data-action="save"]'),
          revert = this.root.querySelector('[data-action="revert"]'), text = dirty ? '有 ' + count + ' 项未保存的改动' : '';
        if (line && line.textContent !== text) line.textContent = text;
        if (line?.classList && line.classList.contains('unsaved') !== dirty) line.classList.toggle('unsaved', dirty);
        if (revert && revert.hidden !== !dirty) revert.hidden = !dirty;
        if (button && button.classList.contains('primary') !== dirty) button.classList.toggle('primary', dirty);
      }
      help(text) {
        return text ? '<button type="button" class="help" aria-label="说明" data-tip="' + esc(Array.isArray(text) ? text.join('\n\n') : text) + '">?</button>' : '';
      }
      chip(text, tone = 'neutral') {
        return '<span class="chip tone-' + tone + '">' + esc(text) + '</span>';
      }
      statRow(label, value, options = {}) {
        return '<div class="stat-row"><span class="stat-label">' + esc(label) + this.help(options.help) +
          '</span><span class="stat-value' + (options.tone ? ' tone-' + options.tone : '') + '">' +
          (options.html ?? esc(value)) + (options.chip || '') + '</span></div>';
      }
      statTile(label, value, sub = '') {
        return '<div class="stat-tile"><span>' + esc(label) + '</span><strong>' + esc(value) +
          '</strong>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
      }
      infoBar(text, tone = 'neutral') {
        return '<div class="info-bar tone-' + tone + '"><span aria-hidden="true">!</span><span>' + esc(text) + '</span></div>';
      }
      progress(value, max, text) {
        const percent = Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
        return '<div class="progress"><span>' + esc(text) + '</span><div role="progressbar" aria-label="战斗数据" aria-valuemin="0" aria-valuemax="' +
          esc(max) + '" aria-valuenow="' + esc(Math.max(0, Math.min(value, max))) +
          '"><span style="width:' + percent + '%"></span></div></div>';
      }
      bindTooltips() {
        const anchor = (event) => {
          const node = event.target.closest?.('[data-tip]');
          return node?.dataset.tip != null ? node : null;
        };
        this.root.addEventListener('mouseover', (event) => {
          const icon = anchor(event);
          if (icon && icon !== this.tipAnchor) this.showTooltip(icon);
        });
        this.root.addEventListener('mouseout', (event) => {
          if (this.tipAnchor && !this.tipPinned && anchor(event) === this.tipAnchor &&
            event.relatedTarget?.closest?.('[data-tip]') !== this.tipAnchor) this.hideTooltip();
        });
        this.root.addEventListener('focus', (event) => {
          const icon = anchor(event);
          if (icon) this.showTooltip(icon);
        }, true);
        this.root.addEventListener('blur', (event) => {
          if (event.target === this.tipAnchor) this.hideTooltip();
        }, true);
        this.root.addEventListener('click', (event) => {
          const icon = anchor(event);
          if (!icon) return;
          event.preventDefault();
          event.stopPropagation();
          if (this.tipAnchor === icon && this.tipPinned) this.hideTooltip();
          else { this.showTooltip(icon); this.tipPinned = true; }
        });
        const escape = (event) => {
          if (event.key !== 'Escape' || !this.windowOpen) return;
          event.stopPropagation();
          if (this.tipAnchor) this.hideTooltip();
          else if (this.query) { this.setQuery(''); this.search.focus(); }
          else this.setWindow(false);
        };
        this.root.addEventListener('keydown', escape);
        document.addEventListener('keydown', escape);
        this.root.addEventListener('scroll', (event) => {
          if (event.target.closest?.('.body')) this.hideTooltip();
        }, true);
      }
      showTooltip(icon) {
        if (!this.tooltip) return;
        this.hideTooltip();
        const tip = this.tooltip, panel = this.root.querySelector('.shell').getBoundingClientRect(),
          rect = icon.getBoundingClientRect(), gap = 8;
        this.tipAnchor = icon;
        tip.textContent = icon.dataset.tip;
        tip.hidden = false;
        tip.style.maxWidth = Math.max(0, Math.min(280, panel.width - gap * 2)) + 'px';
        tip.style.maxHeight = Math.max(0, panel.height - gap * 2) + 'px';
        const size = tip.getBoundingClientRect(),
          left = Math.max(panel.left + gap, Math.min(rect.left, panel.right - size.width - gap)),
          below = rect.bottom + gap, above = rect.top - size.height - gap,
          top = Math.max(panel.top + gap, Math.min(below + size.height <= panel.bottom - gap ? below : above, panel.bottom - size.height - gap));
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        icon.setAttribute('aria-describedby', tip.id);
        icon.classList.toggle('tip-active', true);
      }
      hideTooltip() {
        if (this.tipAnchor) {
          this.tipAnchor.removeAttribute('aria-describedby');
          this.tipAnchor.classList.toggle('tip-active', false);
          this.tipAnchor = null;
        }
        this.tipPinned = false;
        if (this.tooltip && !this.tooltip.hidden) this.tooltip.hidden = true;
      }
      field(label, path, options = {}, result = null) {
        const value = pathGet(this.pending, path), id = 'tl-field-' + path.replaceAll('.', '-'),
          dependency = typeof options.dependsOn === 'string' ? { path: options.dependsOn, value: true } : options.dependsOn,
          disabled = dependency && pathGet(this.pending, dependency.path) !== dependency.value,
          message = disabled ? '' : this.validationMessage(path, value, options),
          described = id + '-error',
          attrs = `data-path="${path}" id="${id}"${disabled ? ' disabled' : ''}${dependency ? ` data-depends-on="${dependency.path}" data-depends-value="${esc(JSON.stringify(dependency.value))}"` : ''}`;
        let control;
        if (typeof value === 'boolean')
          control = `<input type="checkbox" role="switch" ${attrs} ${value ? 'checked' : ''}${path.endsWith('.enabled') || label.includes('总开关') ? ' data-master="true"' : ''} aria-label="${esc(label)}" aria-describedby="${described}">`;
        else if (path === 'disguise.hotkey')
          control = `<button type="button" class="btn" data-action="captureHotkey" ${attrs} aria-label="${esc(label)}" aria-describedby="${described}">${esc(value)}</button>`;
        else if (options.choices)
          control = `<select class="control-select" ${attrs} aria-label="${esc(label)}" aria-describedby="${described}" title="${esc(options.choices.find(([v]) => String(v) === String(value))?.[1] || '')}">${options.choices.map(([v, t]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''} title="${esc(t)}">${esc(t)}</option>`).join('')}</select>`;
        else
          control = `<input type="${options.type === 'text' || Array.isArray(value) ? 'text' : 'number'}" class="control-input" ${attrs} value="${esc(Array.isArray(value) ? value.join(',') : value)}" min="${options.min ?? 0}" ${options.max != null ? 'max="' + options.max + '"' : ''} ${options.step != null ? 'step="' + options.step + '"' : ''} aria-label="${esc(label)}" aria-describedby="${described}" aria-invalid="${!!message}">`;
        const tag = result ? 'div' : 'label';
        const title = result ? `<div><label class="field-label" for="${id}"><span>${result.marked}</span>${this.help(options.help)}</label>${result.breadcrumb}</div>` :
          `<span class="field-label"><span>${esc(label)}</span>${this.help(options.help)}</span>`;
        return `<${tag} class="field${result ? ' search-field' : ''}${dependency && !result ? ' dependent' : ''}${disabled ? ' disabled' : ''}" ${result ? `data-parent="${esc(result.parent)}"` : `for="${id}"`}>${title}<span class="field-control">${control}${options.unit ? `<span class="unit">${esc(options.unit)}</span>` : ''}</span>${options.immediate ? '<span class="instant">即时生效</span>' : ''}<span class="field-error" id="${id}-error" aria-live="polite"${message ? '' : ' hidden'}>${esc(message)}</span></${tag}>`;
      }
      buildIndex(status, state) {
        const entries = [], builder = Object.create(this);
        builder.indexing = true;
        for (const name of ['sellPreview', 'logUsageHTML', 'databaseHTML']) builder[name] = () => '';
        for (const [, group, pages] of groups) for (const [page, pageName] of pages) {
          builder.section = page;
          const pageFields = [];
          const add = (kind, section, key, field = {}, extra = []) => {
            const own = (kind === 'page' ? [group, pageName] : kind === 'section' ? [section, ...extra] : extra)
              .flat().filter(Boolean).join(' ').toLowerCase();
            const context = [group, pageName, section].join(' ').toLowerCase();
            (kind === 'field' ? pageFields : entries).push({ kind, group, page, pageName, section, key, ...field, own, context });
          };
          add('page', '', '');
          if (page === 'status') add('section', '当前状态', '');
          let fields = [];
          builder.field = (label, path, options = {}) => {
            fields.push({ label, path, options });
            return '';
          };
          builder.sectionHTML = (title, content, first, options = {}) => {
            const key = page + ':' + (options.id || title);
            const master = fields[0];
            const masterPath = master && (master.path.endsWith('.enabled') || master.label.includes('总开关')) ? master.path : null;
            add('section', title, key, {}, [options.help || '', masterPath ? master.options.help : '']);
            for (const field of fields) add('field', title, key, { ...field, masterPath }, [
              field.label, field.options.help, field.options.unit, options.fieldKeywords, ...(field.options.choices || []).map(([, label]) => label),
            ]);
            fields = [];
            return '';
          };
          builder.buildPage(status, state);
          entries.push(...pageFields);
        }
        this.indexPending = this.pending;
        this.indexRole = status.role?.id;
        this.index = entries;
      }
      setQuery(query) {
        if (this.query === query) return;
        this.query = query;
        this.search.value = query;
        this.clearSearch.hidden = !query;
        this.shell.classList.toggle('searching', !!query);
        if (this.windowOpen) {
          if (query && this.index && this.indexPending === this.pending) this.replaceBody(this.searchHTML());
          else this.renderBody();
        }
      }
      searchHTML() {
        const terms = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matches = this.index.filter(({ own, context }) => terms.some(term => own.includes(term)) &&
          terms.every(term => own.includes(term) || context.includes(term)));
        let html = '<div class="block-title">共 ' + matches.length + ' 项</div>', previous, fields = 0;
        for (const entry of matches) {
          if (entry.kind === 'field' && ++fields > 60) continue;
          if (entry.page !== previous) {
            html += '<h3 class="block-title">' + esc(entry.group + ' › ' + entry.pageName) + '</h3>';
            previous = entry.page;
          }
          const action = ' type="button" class="breadcrumb text-button" data-result="' + this.index.indexOf(entry) + '"';
          if (entry.kind !== 'field') {
            html += this.statRow(entry.section || entry.pageName, '', { html: '<button' + action + '>打开</button>' });
            continue;
          }
          const label = entry.label, folded = label.toLowerCase(), hit = Array(label.length).fill(false);
          for (const term of terms) for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + 1)) hit.fill(true, i, i + term.length);
          const marked = label.split('').map((c, i) => (hit[i] && !hit[i-1] ? '<mark>' : '') + esc(c) + (hit[i] && !hit[i+1] ? '</mark>' : '')).join('');
          html += this.field(label, entry.path, entry.options, {
            marked, breadcrumb: '<button' + action + '>' + esc(entry.section) + '</button>',
            parent: entry.masterPath === entry.path ? '' : entry.masterPath || '',
          });
        }
        return html + (!matches.length ? '<div class="empty-state">没有匹配的设置</div>' : fields > 60 ?
          '<div class="empty-state">还有 ' + (fields - 60) + ' 项，请输入更多关键字</div>' : '');
      }
      openResult(index) {
        const entry = this.index[index];
        const key = entry.key || (entry.kind === 'page' && this.index.find((item) => item.page === entry.page && item.kind === 'section')?.key);
        if (key) this.uiState().sections[key] = true;
        this.section = entry.page;
        this.rememberPage();
        this.setQuery('');
        if (entry.page === 'settings') this.queryDatabaseUsage();
        const section = [...this.root.querySelectorAll('[data-section]')].find((node) => node.dataset.section === key);
        const control = entry.path && this.root.querySelector('[data-path="' + entry.path + '"]');
        const target = control ? control.closest('.field') || control.closest('summary') :
          section || this.root.querySelector('.body').children[0];
        if (target) {
          target.scrollIntoView({ block: 'nearest' });
          target.classList.toggle('flash', true);
          setTimeout(() => target.classList.remove('flash'), 600);
        }
      }
      validationMessage(path, value, options = {}) {
        if (path === 'convenience.depositKeys' || path === 'convenience.sellKeys')
          return TLPolicy.shortcutConflicts(this.pending.convenience)[path.split('.')[1]];
        if (path === 'welfare.numbers') return TLPolicy.welfareNumbers(value) ? '' : '需要 3 个 1～25 的不同数字';
        if (typeof pathGet(TLPolicy.DEFAULTS, path) !== 'number' || options.choices) return '';
        const min = options.min ?? 0, max = options.max ?? Infinity, number = Number(value);
        return !Number.isFinite(number) || number < min || number > max ? '范围 ' + min + '–' + (max === Infinity ? '∞' : max) : '';
      }
      validateInput(control) {
        const field = control.closest?.('.field');
        if (!field) return;
        const error = field.querySelector('.field-error');
        if (!error) return;
        const message = control.disabled ? '' : this.validationMessage(control.dataset.path, control.value, {
          choices: control.tagName === 'SELECT',
          min: control.min === '' ? 0 : Number(control.min), max: control.max === '' ? undefined : Number(control.max),
        });
        if (control.getAttribute('aria-invalid') !== String(!!message)) control.setAttribute('aria-invalid', String(!!message));
        if (error.textContent !== message) error.textContent = message;
        if (error.hidden !== !message) error.hidden = !message;
      }
      syncFields() {
        const preview = this.root.querySelector('[data-action="tryDisguise"]');
        if (preview) preview.disabled = !this.pending.disguise.enabled;
        this.root.querySelectorAll('.group,.search-field').forEach((section) => {
          const parent = section.dataset?.parent, master = section.querySelector('.master input'), state = section.querySelector('.section-state');
          if (state) {
            const text = master.checked ? '已开启' : '已关闭';
            if (state.textContent !== text) state.textContent = text;
          }
          section.querySelectorAll('[data-path]').forEach((control) => {
            const dependency = control.dataset.dependsOn,
              disabled = !!((parent && !pathGet(this.pending, parent)) || (master && control !== master && !master.checked) ||
                (dependency && pathGet(this.pending, dependency) !== JSON.parse(control.dataset.dependsValue)));
            if (control.disabled !== disabled) control.disabled = disabled;
            const field = control.closest('.field');
            if (field && field.classList.contains('disabled') !== disabled) field.classList.toggle('disabled', disabled);
            if (control.tagName === 'SELECT') {
              const title = control.selectedOptions[0]?.textContent || '';
              if (control.title !== title) control.title = title;
            }
            this.validateInput(control);
          });
        });
      }
      sectionHTML(title, content, first = false, options = {}) {
        if (typeof options === 'string') options = { id: options };
        const key = this.section + ':' + (options.id || title), open = this.uiState().sections[key] ?? first,
          firstField = content.match(/^<label class="field[^>]*>[\s\S]*?<\/label>/)?.[0],
          master = firstField?.match(/<input\b[^>]*data-master="true"[^>]*>/)?.[0];
        const masterHelp = master && firstField.match(/data-tip="([^"]*)"/)?.[1];
        const tips = [options.help && esc([options.help].flat().join('\n\n')), masterHelp].filter(Boolean);
        const help = tips.length ? '<button type="button" class="help" aria-label="说明" data-tip="' + tips.join('\n\n') + '">?</button>' : '';
        let summary = '<span class="section-title">' + esc(title) + help + '</span>' + (options.extra || '');
        if (master) {
          const enabled = /\schecked(?:\s|>)/.test(master);
          summary += '<span class="section-state">' + (enabled ? '已开启' : '已关闭') +
            '</span><label class="master">' + master.replace(/ aria-describedby="[^"]*"/, '') + '</label>';
          content = content.slice(firstField.length);
          if (!enabled) content = content.replace(/<label class="field([^"]*)"([\s\S]*?)<\/label>/g, (_, classes, rest) =>
            '<label class="field' + (classes.includes(' disabled') ? classes : classes + ' disabled') + '"' +
            rest.replace(/<(input|select)\b([^>]*)>/g, (tag, name, attrs) => /\sdisabled(?:\s|$)/.test(attrs) ? tag : '<' + name + attrs + ' disabled>') + '</label>');
        }
        return '<details class="group" data-section="' + esc(key) + '" data-default-open="' + first + '"' + (open ? ' open' : '') +
          '><summary class="group-summary">' + summary + '</summary><div class="section-content">' + content + '</div></details>';
      }
      liveContentKey(html) {
        return html.replace(/(<details class="group"[^>]*?) open(?=>)/g, '$1');
      }
      paintFragment(selector, html) {
        const element = this.root.querySelector(selector), key = this.liveContentKey(html);
        this.fragmentKeys ||= {};
        if (element && this.fragmentKeys[selector] !== key) {
          if (this.liveContentKey(element.innerHTML || '') !== key) {
            if (this.tipAnchor?.closest(selector) === element) this.hideTooltip();
            element.innerHTML = html;
          }
          this.fragmentKeys[selector] = key;
        }
      }
      transferError(message) {
        const line = this.root.querySelector('.error');
        if (line) line.textContent = message;
      }
      previewTransfer(file, modified) {
        const status = this.controller.status(), prefs = this.controller.prefs;
        if (!this.index || this.indexPending !== this.pending || this.indexRole !== status.role?.id)
          this.buildIndex(status, this.controller.bridge.state());
        const role = status.role?.id ?? this.controller.roleId ?? this.controller.roleHint ?? 0;
        this.transferError('');
        this.hideUpdateDialog();
        this.transfer = file;
        file.role = role;
        let changes;
        if (file.kind === 'full') file.local = this.controller.storageSnapshot();
        else {
          file.config = TLPolicy.transferSettings(file, role, prefs.roleConfig);
          changes = TLPolicy.configChanges(prefs, file.config).map(change => this.transferRow(change));
        }
        const title = file.kind === 'reset' ? '重置配置' : file.kind === 'full' ? '导入全量配置' : '导入配置文件';
        const body = this.transferDetails(file, modified, status.role?.id) + (changes ?
          '<h3>设置改动 ' + changes.length + ' 项</h3><div class="transfer-changes">' + (changes.join('') || '设置没有变化') + '</div>' :
          this.mergeHTML(TLPolicy.transferMerge(file.local, file, role))) +
          (this.dirty ? this.infoBar('面板上未保存的修改会被丢弃', 'warn') : '');
        const html = this.dialogHTML(title, body, ['取消', file.kind === 'reset' ? '重置' : '保存'], 1);
        const close = () => { if (!this.transferSaving) this.hideUpdateDialog(); };
        this.showDialog(html, close, index => index ? this.saveTransfer(file) : close());
        if (file.kind !== 'full') return;
        this.paintScope(file);
        this.modal.addEventListener('input', () => this.paintScope(file));
      }
      mergeHTML(plan) {
        const name = entry => '角色 ' + entry.role + (entry.current ? '（当前角色）' : '');
        const group = (status, text) => {
          const list = plan.roles.filter(entry => entry.status === status).map(name);
          return list.length ? '<div>' + esc(text + list.join('、')) + '</div>' : '';
        };
        const kinds = keys => [...new Set(keys.map(key => TLPolicy.transferKind(key)[1]))].join('、');
        const choice = (kind, role, text) => '<label class="transfer-choice"><input type="checkbox" data-overwrite="' + kind +
          '" value="' + role + '"> ' + esc(text) + '</label>';
        const conflicts = plan.roles.filter(entry => entry.status === 'conflict').map(entry =>
          '<div class="transfer-role"><h4>' + esc(name(entry)) + '</h4>' +
          (entry.settings.length ? choice('settings', entry.role, '设置用文件里的（' + entry.settings.length + ' 项不同，本机 → 文件）') +
            '<div class="transfer-changes">' + entry.settings.map(change => this.transferRow(change)).join('') + '</div>' : '') +
          (entry.records.length ? choice('records', entry.role, '记录用文件里的（' + kinds(entry.records) + '，' + entry.records.length + ' 项不同）') : '') +
          '</div>').join('');
        return '<h3>合并到本机</h3>' + group('new', '文件新增，直接加入：') + group('local', '只在本机，保留：') + group('same', '两边都有，没有冲突：') +
          (plan.kept ? '<div>' + esc('其他数据 ' + plan.kept + ' 项两边不同，保留本机') + '</div>' : '') +
          (conflicts ? '<h3>两边不同：勾选的用文件里的，其余保留本机</h3>' + conflicts : '') +
          '<div class="transfer-scope" hidden></div>';
      }
      transferChoices() {
        const picked = kind => [...(this.modal?.querySelectorAll('input[data-overwrite="' + kind + '"]') || [])]
          .filter(input => input.checked).map(input => Number(input.value));
        return { settings: picked('settings'), records: picked('records') };
      }
      paintScope(file) {
        const line = this.modal?.querySelector('.transfer-scope');
        if (!line) return;
        const { scope } = TLPolicy.transferMergeData(file.local, file, file.role, this.transferChoices());
        const changed = scope.before !== scope.after;
        line.hidden = !changed;
        line.textContent = changed ? '配置保存方式：所有角色共用一份 → 每个角色各存一份（合并后各角色的设置不同，原来共用的设置作为默认）' : '';
      }
      transferDetails(file, modified, role) {
        if (file.kind === 'reset') return '';
        const date = value => value ? new Date(value).toLocaleString() : '—';
        const lines = ['文件修改时间：' + date(modified)];
        if (file.kind === 'full') {
          const { exportedAt, script, host, roleId } = file.meta;
          const other = String(roleId) !== String(role ?? this.controller.roleId ?? this.controller.roleHint ?? 0);
          lines.push('导出时间：' + date(exportedAt), '导出版本 v' + (script ?? '—'), '站点：' + (host ?? '—'),
            '角色 ' + (roleId ?? '—') + (roleId != null && other ? '（不是当前角色）' : ''),
            ...TLPolicy.transferSummary(file.data, file.logs),
            '合并导入：本机已有的角色设置和记录都保留，文件里多出的直接加入，日志只补缺的；导入后页面会刷新');
        }
        return lines.map(line => '<div>' + esc(line) + '</div>').join('');
      }
      transferRow({ path, before, after }) {
        const field = this.index.find(entry => entry.path === path);
        const label = field ? field.pageName + ' › ' + field.section + ' · ' + field.label : path;
        const format = value => {
          if (value == null) return '—';
          if (Array.isArray(value)) return value.map(format).join('、');
          const choice = field?.options.choices?.find(([key]) => String(key) === String(value));
          if (choice) return choice[1];
          if (typeof value === 'boolean') return value ? '开' : '关';
          return String(value) + (typeof value === 'number' ? field?.options.unit || '' : '');
        };
        return '<div>' + esc(label + '：' + format(before) + ' → ' + format(after)) + '</div>';
      }
      async saveTransfer(file) {
        if (this.transferSaving || this.transfer !== file) return;
        this.transferSaving = true;
        try {
          if (file.kind === 'full') {
            // Merged against storage as it is now; the choices made in the dialog apply.
            const { data } = TLPolicy.transferMergeData(this.controller.storageSnapshot(), file, file.role, this.transferChoices());
            this.dirty = false;
            await this.controller.importData(data, file.logs);
          } else {
            const config = { ...file.config, roleConfig: this.controller.prefs.roleConfig };
            this.pending = TLPolicy.clone(this.controller.updateConfig(config, { preserveData: file.kind !== 'config' }));
            this.dirty = false;
            this.controller.log(file.kind === 'reset' ? '配置已重置为默认' : '已导入配置文件');
          }
          this.hideUpdateDialog();
          this.requestBody();
        } catch (error) {
          this.hideUpdateDialog();
          this.renderBody();
          this.transferError('导入失败：' + error.message);
        } finally { this.transferSaving = false; }
      }
      async queryDatabaseUsage() {
        this.databaseUsage = await this.controller.queryLogUsage();
        this.paintDatabase();
        this.paintLogs();
      }
      databaseHTML() {
        const usage = this.databaseUsage || { count: 0, bytes: 0 }, text = this.controller.logStorageStatus(),
          failed = text.startsWith('打开失败'), state = failed ? '打开失败' : text,
          tone = { '可用': 'ok', '未启用': 'neutral', '浏览器不支持': 'warn', '打开失败': 'err' }[state] || 'neutral';
        return this.statRow('状态', '', { html: this.chip(state, tone), help: failed ? text : '' }) +
          this.statRow('已用空间', (usage.bytes / 1024).toFixed(1) + ' KB') + this.statRow('日志条数', usage.count + ' 条');
      }
      paintDatabase() {
        if (this.root.querySelector('.database-data')) this.paintFragment('.database-data', this.databaseHTML());
      }
      logUsageHTML() {
        const usage = this.controller.logUsage();
        return this.chip(usage.count + ' 条') + ' ' + this.chip((usage.bytes / 1024).toFixed(1) + ' KB');
      }
      paintLogs() {
        const list = this.root.querySelector('.live-logs');
        if (!list) return;
        const level = this.pending.logs.level, count = this.controller.prefs.logs.showCount;
        if (this.logKey == null || this.logSource !== this.controller.logs || this.logLevel !== level || this.logCount !== count) {
          this.logSource = this.controller.logs;
          this.logLevel = level;
          this.logCount = count;
          const entries = TLPolicy.logFilter(this.controller.logs, level).slice(0, count), key = JSON.stringify([level, count, entries]);
          if (this.logKey !== key) {
            this.logKey = key;
            list.innerHTML = this.logsHTML(entries);
          }
        }
        this.paintFragment('.log-usage', this.logUsageHTML());
      }
      runtimeHTML(status) {
        const perf = status.perf || { lastMs: 0, avgMs: 0, maxMs: 0 };
        return this.statRow('服务器等待上限', (status.network?.timeoutMs ?? this.controller.prefs.requestTimeoutMs) / 1000 + ' 秒') +
          this.statRow('10 分钟内迟到回应', (status.network?.lateAnswers ?? 0) + ' 次') +
          this.statRow('策略计算耗时', '', { html: '<span>最近 ' + Math.round(perf.lastMs) +
            '</span><span>· 平均 ' + Math.round(perf.avgMs) + '</span><span>· 最长 ' + Math.round(perf.maxMs) +
            ' 毫秒</span>', chip: perf.lastMs > 200 ? this.chip('偏慢', 'warn') : '' });
      }
      buildPage(status, s) {
        const f = (l, p, o) => this.field(l, p, o);
        const g = (title, content, first = false, options = {}) => this.sectionHTML(title, content, first, options);
        let html = '';
        if (this.section === 'stats') {
          html = this.statsHTML(status.stats, s?.maps, status);
          this.statsKey = this.liveContentKey(html);
          this.statsPaintAt = Date.now();
        }
        if (['score', 'scoreStatus', 'scoreStats', 'scoreFormula'].includes(this.section)) {
          html = this.profileScoreHTML(status, s);
          this.scoreKey = this.liveContentKey(html);
          this.scorePaintAt = Date.now();
        }
        if (this.section === 'status') {
          this.statusBudgetsKey = this.statusBudgetsHTML(status);
          html = '<section class="group current-status"><div class="block-title">当前状态</div><div class="summary"></div><div class="actions"><button type="button" class="btn primary run-toggle" data-action="' + (status.enabled ? 'pause' : 'start') + '">' + (status.enabled ? '暂停托管' : '开始托管') + '</button><button type="button" class="btn" data-action="stopBattle">停止战斗</button><button type="button" class="btn" data-action="preview">预览计划</button></div></section><div class="login-status">' + (!s?.role?.id ? this.infoBar('请先在游戏里登录角色') : '') + '</div>' +
            g('今日预算', '<div class="status-budgets">' + this.statusBudgetsKey + '</div>', true, { help: [HELP.intro, HELP.budgetStatus] }) +
            g('运行状况', '<div class="runtime-status">' + this.runtimeHTML(status) + '</div>') +
            g('计划预览', '<div class="actions"><button class="btn" type="button" data-action="preview">预览下一步计划</button><button class="btn" type="button" data-action="diagnostics">导出当前诊断</button></div><div class="plan-list">' +
              (this.previewPlans.length ? this.previewPlans.map((action) => '<div class="plan"><strong>' + esc(action.label) + '</strong>' +
                this.statRow('预计金币', action.coinCost) + this.statRow('经验', action.expCost) +
                (action.requiresTown ? this.chip('在对应城镇处理') : '') + '</div>').join('') :
                '<div class="empty-state">点击预览可查看当前角色满足条件的动作。</div>') + '</div>');

        }
        if (this.section === 'battle') {
          html =
            g('挂机与恢复',
            f('自动开始战斗', 'battle.enabled') +
            f('挂机地图', 'battle.mapId', { choices: TLPolicy.mapChoices(s?.maps) }) +
            f('选图等级差', 'battle.levelOffset', { unit: '级', help: '比角色低多少级选图', dependsOn: { path: 'battle.mapId', value: 0 } }) +
            f('智能选图', 'battle.smart', { dependsOn: { path: 'battle.mapId', value: 0 }, help: '在能进入的最高几张野外挂机地图中各试打一段时间，按实测收益选图，并定时复查。只在“挂机地图”为自动时生效；没有可用候选时按选图等级差选图' }) +
            f('智能选图目标', 'battle.smartGoal', { dependsOn: 'battle.smart', choices: [['exp', '经验最高（按单倍经验比较）'], ['gold', '净金币最高（击杀金币 + 出售 − 药费）']] }) +
            f('候选地图数', 'battle.smartMaps', { unit: '张', dependsOn: 'battle.smart', min: 2, max: 8 }) +
            f('每图试打', 'battle.smartMinutes', { unit: '分钟', dependsOn: 'battle.smart', min: 5, max: 60 }) +
            f('复查间隔', 'battle.smartHours', { unit: '小时', dependsOn: 'battle.smart', min: 1, max: 48, help: '实测数据超过这个时间就重新试打；明显较差的地图按 4 倍间隔复查' }) +
            f('阵亡后返城重新选择', 'battle.recoverDeath') +
            f('阵亡后降低选图等级', 'battle.deathDowngrade', { help: '每次阵亡把自动选图的等级再降 5 级，刷新页面后恢复；关闭后按原选图等级差挂机。智能选图时改为阵亡的地图暂停 4 个复查间隔（默认 24 小时）', dependsOn: 'battle.recoverDeath' }) +
            f('每小时阵亡上限', 'battle.maxDeathsPerHour', { unit: '次', help: '达到后暂停托管，0 不限', dependsOn: 'battle.recoverDeath' }) +
            '<div class="smart-map-status">' + this.smartMapHTML(status.smartMap, s?.role?.mapId) + '</div>', true) +
            g('日常活动',
            f('自动完成日常', 'activities.enabled') +
            f('珍珑棋局', 'activities.zl') +
            f('珍珑每日最多进入', 'activities.zlRuns', { unit: '次', dependsOn: 'activities.zl' }) +
            f('伪宋军领地', 'activities.camp') +
            f('伪宋军每日最多进入', 'activities.campRuns', { max: 5, unit: '次', dependsOn: 'activities.camp' }) +
            f('熊林', 'activities.bear') +
            f('熊林每日最多进入', 'activities.bearRuns', { unit: '次', dependsOn: 'activities.bear' }) +
            f('每日领取天灵丹', 'activities.tianlingClaim', { help: '需回洛阳' }) +
            f('自动使用天灵丹', 'activities.tianlingUse', { help: '没有双倍经验时使用' }) +
            f('自动在线抽奖', 'activities.lotteryDraw', { help: '需回苏州' }) +
            f('攒够多少次抽一次', 'activities.lotteryBatch', { unit: '次', help: '当天次数发完时也会抽', dependsOn: 'activities.lotteryDraw' }) +
            '', false, { help: HELP.activities }) +
            g('快活叁福彩',
            f('自动投注', 'welfare.enabled', { help: '需回苏州' }) +
            f('币种', 'welfare.currency', { dependsOn: 'welfare.enabled', choices: [['GOLD', '金币 · 10万/倍'], ['YUANBAO', '元宝 · 100/倍（奖金为赠送元宝）']] }) +
            f('倍数', 'welfare.multiplier', { min: 1, max: 5, step: 1, help: '1～5', dependsOn: 'welfare.enabled' }) +
            f('每期投注', 'welfare.betsPerDraw', { min: 1, max: 10, step: 1, unit: '注', dependsOn: 'welfare.enabled' }) +
            f('每日投注上限', 'welfare.dailyCost', { step: 1, help: '所选币种，0 为不限', dependsOn: 'welfare.enabled' }) +
            f('选号', 'welfare.pick', { dependsOn: 'welfare.enabled', choices: [['random', '每注随机'], ['fixed', '固定号码']] }) +
            f('固定号码', 'welfare.numbers', { type: 'text', help: '3 个 1～25 的不同数字，如 3,8,15', dependsOn: { path: 'welfare.pick', value: 'fixed' } }) +
            '<div class="welfare-status">' + this.welfareHTML(s, status.ledger) + '</div>') +
            g('比武天梯',
            f('自动比武', 'arena.enabled', { help: '总开关' }) +
            f('每日点赞', 'arena.like', { dependsOn: 'arena.enabled' }) +
            f('领取名次奖励', 'arena.claim', { help: '需回洛阳', dependsOn: 'arena.enabled' }) +
            f('自动挑战', 'arena.challenge', { help: '需回洛阳', dependsOn: 'arena.enabled' }) +
            f('每日挑战上限', 'arena.maxPerDay', { unit: '次', help: '0 不限', dependsOn: 'arena.challenge' }) +
            f('对手战力上限', 'arena.maxPowerRatio', { unit: '倍', help: '只挑战战力不超过自己 × 此倍数的对手', dependsOn: 'arena.challenge' }) +
            f('比武榜刷新间隔', 'arena.refreshMinutes', { unit: '分钟', dependsOn: 'arena.enabled' }) +
            f('结算前冲榜时长', 'arena.rushMinutes', { unit: '分钟', help: '0 关闭', dependsOn: 'arena.challenge' }) +
            '<div class="arena-status">' + this.arenaHTML(status.arena) + '</div>', false, { help: HELP.arena }) +
            g('新三环',
            f('自动挑战新三环', 'rings.enabled') +
            f('每日挑战轮数', 'rings.roundsPerDay', { unit: '轮', min: 1, max: 10, dependsOn: 'rings.enabled',
              help: '每天最多打几轮。每环每天只发 2 次奖励，打满 2 轮即可拿全' }) +
            f('每轮失败后重试次数', 'rings.maxRetries', { unit: '次', min: 0, max: 20, dependsOn: 'rings.enabled',
              help: '一轮里失败后最多再进几次，每轮重新计数；0 表示失败后本轮直接结束' }) +
            f('自动领取暂存的神兵符', 'rings.claimInbox', { dependsOn: 'rings.enabled' }) +
            f('攒够 300 枚自动兑换', 'rings.exchange', { dependsOn: 'rings.enabled',
              choices: [['off', '不兑换'], ['ring', '只换重楼戒'], ['jade', '只换重楼玉'], ['ringFirst', '先戒后玉'], ['jadeFirst', '先玉后戒']],
              help: '已有的那件不会重复兑换；兑换的装备获得即绑定' }) +
            f('状态刷新间隔', 'rings.refreshMinutes', { unit: '分钟', min: 1, max: 120, dependsOn: 'rings.enabled' }) +
            '<div class="rings-status">' + this.ringsHTML(status.rings) + '</div>', false, {
              help: '56 级开放。在楼兰何悦处从第一环打起，每环 5 枚神兵符，每环每天最多领 2 次；失败后从第一环重开。三环没有经验，双倍经验期间不开新一轮；自动使用天灵丹会等当天的三环打完。' }) +
            g('宵小入侵',
            f('自动参加宵小入侵', 'invasion.enabled') +
            f('结算后领取奖励', 'invasion.claim', { dependsOn: 'invasion.enabled' }) +
            f('回大理间隔', 'invasion.intervalMinutes', { min: 1, max: 120, unit: '分钟', dependsOn: 'invasion.enabled' }) +
            f('每次等待队伍', 'invasion.waitSeconds', { min: 0, max: 1800, unit: '秒（0 不等）', dependsOn: 'invasion.enabled',
              help: '没有能加入的队伍时，留在大理每 5 秒看一次，等这么久还没有就回去挂机' }) +
            f('每日参战上限', 'invasion.maxRunsPerDay', { min: 0, max: 200, unit: '场（0 不限）', dependsOn: 'invasion.enabled' }) +
            '<div class="invasion-status">' + this.invasionHTML(status.invasion) + '</div>', false, {
              fieldKeywords: '宵小入侵',
              help: '每两小时一轮，全服每轮 10 场。四人满员自动开战。服务器模拟战斗，开战时一次扣除整场药品。参加后可以照常挂机。脚本按间隔回大理，新一轮开始时立刻回去。本门派受袭时先带队，其他门派（或本轮带队被拒）就加入招募中的队伍。可在此查看残页。' });
        }
        if (this.section === 'growth')
          html =
            g('人物与技能',
            f('自动升级人物', 'growth.level') +
            f('人物目标等级', 'growth.maxLevel', { unit: '级', dependsOn: 'growth.level' }) +
            f('自动升级技能', 'growth.skills') +
            f('技能最高等级', 'growth.maxSkillLevel', { unit: '级', dependsOn: 'growth.skills' }) +
            f('技能优先于人物升级', 'growth.skillBeforeLevel', { dependsOn: 'growth.skills' }) +
            f('优先技能模板ID', 'growth.skillPriority', { help: '逗号分隔', dependsOn: 'growth.skills' }), true) +
            g('装备方案', '<div class="gear-profile-status">' + this.profileStatusHTML(status) + '</div>' +
            f('启用攻坚方案', 'gear.assault.enabled', { help: '挂机方案按挂机地图的怪物评分。三环方案按新三环的小怪和首领评分，浮屠方案按无相浮屠最近打到的高层敌人评分，生存权重更高。自动挑战新三环前换上三环装，结束后换回。脚本不会自动进塔，进塔前点“浮屠”，试炼结束自动换回。自动出售时各方案里评分高的都会保留。' })) +
            g('装备选择',
            f('按评分自动穿戴', 'gear.enabled') +
            f('最低评分增益', 'gear.minGainPercent', { step: 0.1, unit: '%' }) +
            f('允许穿戴后绑定', 'gear.allowBinding') +
            f('从仓库选择更好的装备', 'gear.fromWarehouse', { help: '自动穿戴时取出' }) +
            f('换装后用实测击杀核对', 'gear.fieldCheck', { help: ['变差自动换回', HELP.gear] }) +
            f('换装后最少战斗时长', 'gear.fieldMinutes', { min: 10, max: 180, step: 1, unit: '分钟', dependsOn: 'gear.fieldCheck' }) +
            f('换回的击杀降幅', 'gear.fieldDropPercent', { min: 1, max: 50, step: 0.1, unit: '%', help: '每小时击杀下降超过此值才换回', dependsOn: 'gear.fieldCheck' }) +
            '<div class="gear-check-status">' + this.gearCheckHTML(status.gear) + '</div>' +
            '<div class="actions"><button class="btn" type="button" data-action="clearGearRejected">清空换回名单</button></div>' +
            '<div class="actions"><button class="btn subtle" type="button" data-action="showScore">打开评分设置</button>' + this.help(HELP.scoreLink) + '</div>') +
            g('暗器养成',
            f('暗器养成', 'hidden.enabled', { help: '总开关' }) +
            f('自动领取暗器', 'hidden.claim', { help: '50 级，回洛阳找薛飞', dependsOn: 'hidden.enabled' }) +
            f('初始属攻', 'hidden.claimElement', { dependsOn: 'hidden.claim', help: ['领取时使用', HELP.hiddenClaim], choices: [
              ['auto', '自动（当前最高的属性攻击）'], ['ice', '冰攻'], ['fire', '火攻'],
              ['poison', '毒攻'], ['holy', '玄攻'],
            ] }) +
            f('自动洗炼属性', 'hidden.wash', { help: '5 砂/次', dependsOn: 'hidden.enabled' }) +
            f('自动洗炼品质', 'hidden.washQuality', { help: '1 玉/次', dependsOn: 'hidden.enabled' }) +
            f('领取暂存奖励', 'hidden.inbox', { dependsOn: 'hidden.enabled' }) +
            f('用人物经验喂养暗器', 'hidden.feed', { dependsOn: 'hidden.enabled' }) +
            f('暗器目标等级', 'hidden.maxLevel', { unit: '级', dependsOn: 'hidden.feed' }) +
            f('喂养后至少保留经验', 'hidden.keepExp', { dependsOn: 'hidden.feed' }) +
            f('暗器状态刷新间隔', 'hidden.refreshMinutes', { unit: '分钟', dependsOn: 'hidden.enabled' }) +
            '<div class="hidden-status">' + this.hiddenHTML(status.hidden) + '</div>', false, { help: HELP.hidden });
        if (this.section === 'pets')
          html = g('珍兽',
            f('珍兽托管', 'pets.enabled', { help: '总开关' }) +
            f('自动出战最强珍兽', 'pets.summon', { help: '没有出战珍兽时使用' }) +
            f('自动领取珍兽掉落', 'pets.claim') +
            f('自动孵蛋并筛选', 'pets.hatch') +
            f('保留的最低资质均值', 'pets.keepMinAverage', { step: 0.5, help: '宝宝满值 120', dependsOn: 'pets.hatch' }) +
            f('也孵化变异珍兽蛋', 'pets.hatchMutant', { dependsOn: 'pets.hatch' }) +
            f('用人物经验喂养出战珍兽', 'pets.feed') +
            f('喂养后至少保留经验', 'pets.feedKeepExp', { dependsOn: 'pets.feed' }) +
            f('珍兽状态刷新间隔', 'pets.refreshMinutes', { unit: '分钟' }) +
            '<div class="pets-status">' + this.petsHTML(status.pets) + '</div>', true, { help: HELP.pets }) +
            g('繁殖', f('繁殖完成后自动领取', 'pets.breedClaim', { help: '需回苏州找云飘飘' }) +
              f('自动到繁殖大厅找对象', 'pets.breed', { help: '宝宝须是 30 级以上、已鉴定、从未繁殖且未出战，并留有一个空栏位。每只宝宝一生只能繁殖一次，开始后不可取消' }) +
              f('对方宝宝的最低平均资质', 'pets.breedMinAverage', { unit: '%', min: 80, max: 120, step: 0.5,
                dependsOn: 'pets.breed', help: '也是自己发布时的择偶条件' }) +
              f('没有合适对象时发布自己的宝宝', 'pets.breedPublish', { dependsOn: 'pets.breed',
                help: '发布后满足条件的玩家可直接与它繁殖；脚本不会自动撤回' }), false,
            { help: '繁殖在苏州云飘飘处办理，会中断挂机。' });
        if (this.section === 'bagTools')
          html = g('显示',
            f('背包和仓库图标显示评分', 'market.bagScore') +
            f('背包仓库评分类型', 'market.bagScoreType', { dependsOn: 'market.bagScore', choices: [['combat', '实战评分'], ['power', '游戏内战力']] }) +
            f('背包和仓库显示部位筛选条', 'market.bagFilter', { help: '筛选条在背包和仓库窗口左侧，只调暗不匹配的装备，不会移动或隐藏；角标是套装名的第一个字，集齐为金色；套装列表里绿点是已穿戴，金点是在背包或仓库，空心是还缺。' }) +
            f('套装装备显示角标', 'market.setTag'), true) +
          g('存取',
            f('打开仓库时，背包“整理”顺便存入仓库已有的物品', 'convenience.sortDeposit', { help: '只存道具和材料里仓库已经有的种类，整组存入；回复气血和内力的药品不存' }) +
            f('右键整组存取道具或材料', 'convenience.ctrlDeposit', { help: '仓库打开时，按住下面的快捷键右键背包里的道具或材料整组存入，右键仓库里的道具或材料整组取出，不弹数量窗口' }) +
            f('整组存取快捷键', 'convenience.depositKeys', { dependsOn: 'convenience.ctrlDeposit', choices: warehouseKeyChoices }) +
            f('快捷出售仓库装备', 'convenience.sellWarehouse', { help: '仓库打开并在“装备”页时，按住快捷键右键装备：取出到背包并卖给商店，不可撤销。带宝石、强化、神器或换装方案里的装备先确认。默认关闭' }) +
            f('出售快捷键', 'convenience.sellKeys', { dependsOn: 'convenience.sellWarehouse', choices: warehouseKeyChoices }));
        if (this.section === 'gameTools')
          html = g('物品详情',
            f('详情和人物面板显示实战评分', 'market.tipScore', { help: '装备详情及人物面板' }) +
            f('物品详情显示绑定状态', 'market.tipBound', { help: '已绑定、未绑定、装备后绑定' }) +
            f('物品详情显示套装收集情况', 'market.tipSet'), true) +
          g('逛摊淘宝',
            f('逛摊淘宝显示装备评分', 'market.showScore') +
            f('逛摊评分类型', 'market.scoreType', { dependsOn: 'market.showScore', choices: [['combat', '实战评分'], ['power', '游戏内战力']] }) +
            f('逛摊按脚本排序', 'market.sort', { immediate: true, choices: [['off', '关'], ['power', '战斗力从高到低'], ['combat', '实战评分从高到低'], ['gain', '实战提升从高到低']] })) +
          g('工坊',
            f('显示“一键放入”按钮', 'fill.enabled', { help: '在游戏窗口显示' }) +
            f('完成后补回同种符和材料', 'fill.refill', { dependsOn: 'fill.enabled' }), false, { help: HELP.fill });
        if (this.section === 'craft')
          html =
            g('宝石策略',
            f('启用宝石托管', 'gems.enabled') +
            f('自动打孔', 'gems.drill') +
            f('每件装备目标孔数', 'gems.maxHoles', { max: 3, unit: '孔', dependsOn: 'gems.drill' }) +
            f('自动镶嵌', 'gems.inlay') +
            f('自动合成', 'gems.synth', { help: '每次5颗' }) +
            f('宝石目标等级', 'gems.maxLevel', { max: 6, unit: '级' }) +
            f('最低合成成功率', 'gems.minSynthSuccess', { max: 100, unit: '%', dependsOn: 'gems.synth' }) +
            f('智慧/魅力宝石雕琢', 'gems.polish') +
            f('摘除旧宝石后替换', 'gems.replace', { dependsOn: 'gems.inlay' }) +
            f('每日宝石操作上限', 'gems.maxPerDay', { unit: '次', help: '0 不限' }), true) +
            g('铁匠与神器',
            f('启用铁匠托管', 'smithy.enabled') +
            f('自动鉴定50级以上武器', 'smithy.appraisal') +
            f('自动强化穿戴装备', 'smithy.enhance') +
            f('目标强化等级', 'smithy.targetEnhance', { max: 9, unit: '级', dependsOn: 'smithy.enhance' }) +
            f('最低强化成功率', 'smithy.minEnhanceSuccess', { max: 100, unit: '%', dependsOn: 'smithy.enhance' }) +
            f('神器冶炼', 'smithy.smelt') +
            f('允许投入当前穿戴武器', 'smithy.allowSmeltEquipped', { dependsOn: 'smithy.smelt' }) +
            f('攒够多少经验投入一次', 'smithy.investChunk', { help: '挂机中直接投入，不回城', dependsOn: 'smithy.smelt' }) +
            f('神节与神符匹配修复', 'smithy.repair') +
            f('完整神节打造神器', 'smithy.forge') +
            f('目标神器ID', 'smithy.artifactIds', { help: '留空自动评分', dependsOn: 'smithy.forge' }) +
            f('每日铁匠操作上限', 'smithy.maxPerDay', { unit: '次', help: '0 不限' })) +
            g('裁缝与御赐套装',
            f('启用装备打造', 'craft.enabled') +
            f('棉布/秘银打造', 'craft.tailor') +
            f('万灵石兑换套装', 'craft.exchange') +
            f('目标装备ID', 'craft.targetIds', { help: '留空自动评分' }) +
            f('最低装备评分增益', 'craft.minGainPercent', { step: 0.1, unit: '%' }) +
            f('每日打造/兑换上限', 'craft.maxPerDay', { unit: '次', help: '0 不限' }) +
            '', false, { help: HELP.tailor });
        if (this.section === 'economy')
          html =
            g('装备回收',
            f('自动出售普通装备', 'sell.enabled') +
            f('出售最高品质', 'sell.maxQuality', {
              help: '≤此品质',
              choices: this.pending.sell.maxQuality === 0
                ? [[0, '不按品质出售（0）'], ...qualityChoices]
                : qualityChoices,
            }) +
            f('出售时排除套装装备', 'sell.keepSets') +
            f('保留尚未达到等级的装备', 'sell.keepFuture') +
            f('保留各部位最佳备用装', 'sell.keepBestBackup') +
            f('保留托管新打造装备', 'sell.keepCrafted') +
            f('保留已鉴定装备', 'sell.keepAppraised', { help: ['不勾选时只保留双完美武器', HELP.sellAppraised] }) +
            f('攒够几件再出售', 'sell.batchMin', { min: 1, max: 20, unit: '件', help: '1 = 有就卖' }) +
            f('永不出售的模板ID', 'sell.keepTemplateIds', { help: '可填预览里的模板ID，逗号分隔' }) +
            f('明确允许出售的材料ID', 'sell.materialIds') +
            f('每日出售操作上限', 'sell.maxPerDay', { unit: '次', help: '0 不限' }) +
            '<div class="sell-preview">' + this.sellPreview(s) + '</div>' +
            '', true, { help: HELP.sell }) +
            g('自动存入仓库',
            f('自动将装备存入仓库', 'warehouse.enabled') +
            f('存仓最低品质', 'warehouse.minQuality', {
              choices: qualityChoices, help: '≥此品质', dependsOn: 'warehouse.enabled',
            }) +
            f('套装装备一律存仓', 'warehouse.sets', { help: '无视品质', dependsOn: 'warehouse.enabled' }) +
            f('自动存入双完美资质装备', 'warehouse.perfect', { dependsOn: 'warehouse.enabled' }) +
            '', false, { help: HELP.warehouse }) +
            g('金币补药',
            f('金币购买等级适用药品', 'shop.enabled') +
            f('少于此数量时补充', 'shop.minimumStock', { unit: '个' }) +
            f('目标库存数量', 'shop.targetStock', { unit: '个' }) +
            f('单次购买最大数量', 'shop.maxBatch', { unit: '个' })) +
            g('自动回复',
            f('自动配置内置用药', 'potions.enabled') +
            f('生命回复阈值', 'potions.hpThreshold', { min: 10, max: 80, unit: '%' }) +
            f('内力回复阈值', 'potions.mpThreshold', { min: 10, max: 80, unit: '%' }) +
            f('按实测掉血抬高生命阈值', 'potions.autoThreshold') +
            f('自动按药效选择优先级', 'potions.autoChoose') +
            f('用药顺序', 'potions.order', {
              dependsOn: 'potions.autoChoose',
              choices: [
                ['fit', '按缺口智能选择（推荐）'],
                ['weak', '低级药优先（先清库存）'],
                ['strong', '药效优先'],
                ['smart', '智能（实测消耗下最省金币的药）'],
              ],
            }) +
            f('指定生命药模板ID', 'potions.hpPriority') +
            f('指定内力药模板ID', 'potions.mpPriority') +
            '', false, { help: [HELP.potions, HELP.potionOrder] });
        if (this.section === 'budget')
          html =
            g('资源预算',
            f('保留金币', 'budget.moneyReserve', { unit: '金币' }) +
            f('每日金币支出额度', 'budget.moneyPerDay', { unit: '金币' }) +
            f('保留经验', 'budget.expReserve') +
            f('每日技能经验额度', 'budget.skillExpPerDay') +
            f('每日冶炼经验额度', 'budget.smeltExpPerDay') +
            '<div class="legacy-experience"></div>', true, { help: [HELP.budget, HELP.limits] });
        if (this.section === 'settings')
          html =
            g('恢复与调度',
            f('页面刷新后恢复托管', 'resumeAfterReload') +
            f('托管时持有 Web Lock', 'keepAwake', { help: '防标签页睡眠' }) +
            f('连接恢复后继续托管', 'reconnect.enabled') +
            f('长时间断线时刷新页面', 'reconnect.autoReload') +
            f('断线多久后刷新', 'reconnect.reloadAfterSeconds', { unit: '秒', dependsOn: 'reconnect.autoReload' }) +
            f('每小时最多自动刷新', 'reconnect.maxReloadsPerHour', { unit: '次', dependsOn: 'reconnect.autoReload' }) +
            f('策略检查间隔', 'tickMs', { min: 700, unit: '毫秒' }) +
            f('动作响应超时', 'requestTimeoutMs', { min: 6000, unit: '毫秒' }), true) +
            g('配置保存', f('配置保存方式', 'roleConfig', {
              choices: [['shared', '所有角色共用一份'], ['per-role', '每个角色各存一份']],
              help: '同一个站点多开角色时，选“每个角色各存一份”后，保存只影响当前角色；改回共用时以这次保存的内容为准，并删除各角色单独的配置。其他已打开的页签刷新后生效',
            })) +
            g('配置', this.help(HELP.json) + '<input class="config-file" type="file" accept=".json" hidden>' +
            '<div class="info-bar tone-err" role="alert"><span aria-hidden="true">!</span><span class="error"></span></div><div class="actions">' +
            [['importConfig', '导入配置文件'], ['export', '导出精简配置'], ['exportFull', '导出全量配置'], ['reset', '重置配置'], ['diagnostics', '导出诊断']]
              .map(([action, label]) => '<button type="button" class="btn" data-action="' + action + '">' + label + '</button>').join('') + '</div>') +
            g('浏览器数据库', f('使用浏览器数据库保存日志', 'storage.indexedDB') +
            '<div class="database-data">' + this.databaseHTML() + '</div><button type="button" class="btn" data-action="clearDatabase">清理数据库</button>') +
            g('伪装', f('开启伪装', 'disguise.enabled') +
            f('快捷键', 'disguise.hotkey', { dependsOn: 'disguise.enabled' }) +
            f('伪装成', 'disguise.style', { choices: [['baidu', '百度'], ['google', '谷歌'], ['blank', '空白页']] }) +
            f('伪装时静音', 'disguise.mute') +
            '<button type="button" class="btn" data-action="tryDisguise"' + (this.pending.disguise.enabled ? '' : ' disabled') +
            '>试一下</button>' + this.help('再按一次快捷键恢复'), false, {
              help: '按下快捷键，游戏页面立刻变成搜索引擎首页的样子，标签页标题和图标也一起变；再按一次恢复。托管在后台照常运行。地址栏里的网址不会变。',
            });
        if (this.section === 'logs') {
          this.logKey = null;
          html = g('日志', f('显示等级', 'logs.level', { immediate: true, choices: [['all', '全部'], ['notice', '成功和警告'], ['warning', '仅警告']] }) +
            '<div class="actions"><button type="button" class="btn" data-action="exportLogs">导出日志</button><button type="button" class="btn" data-action="clearLogs">清空日志</button></div>' +
            f('保存日志天数', 'logs.keepDays', { min: 1, max: 90, step: 1, unit: '天' }) +
            f('面板显示条数', 'logs.showCount', { min: 20, max: 500, step: 1, unit: '条' }) +
            '<div class="info-bar tone-err" role="alert"><span aria-hidden="true">!</span><span class="error"></span></div><div class="live-logs"></div>', true, { extra: '<span class="log-usage">' + this.logUsageHTML() + '</span>' });
        }
        if (this.section === 'updates') {
          const u = status.updates || { currentVersion: status.version, error: '', notes: null };
          this.updateKey = JSON.stringify(u);
          html =
            g('版本与更新',
            f('开启自动更新', 'updates.checkDaily', { help: u.daily ? HELP.updatesDaily : HELP.updates }) +
            f('发现新版本时提醒', 'updates.remind') +
            f('新版本自动刷新启用', 'updates.autoApply'), true) +
            this.updateHTML(u);
        }
        return html;
      }
      renderBody(status = this.controller.status(), s = this.controller.bridge.state()) {
        this.bodyDirty = false;
        if (this.windowOpen && (this.indexPending !== this.pending || this.indexRole !== status.role?.id)) this.buildIndex(status, s);
        const html = this.query ? this.searchHTML() : this.buildPage(status, s);
        this.replaceBody(html);
        if (!this.query && this.section === 'status') this.paintSummary(status);
      }
      replaceBody(html) {
        this.summaryHTML = null;
        for (const button of this.confirmations?.keys() || []) this.resetConfirmation(button);
        this.hideTooltip();
        this.root.querySelector('.body').innerHTML = html;
        this.fragmentKeys = {};
        this.syncFields();
        if (this.section === 'logs') this.paintLogs();
        this.paintNavigation();
        this.paintDirty();
      }
      statusBudgetsHTML(status) {
        const fmt = (n) => Number(n || 0).toLocaleString('zh-CN'),
          usage = (used, limit) => (status.ledger ? '已用 ' + fmt(used) + ' / 上限 ' : '') + (limit > 0 ? fmt(limit) : '不限'),
          rows = [
            ['金币保留', fmt(status.budget.moneyReserve)],
            ['当日金币预算', usage(status.ledger?.money, status.budget.moneyPerDay)],
            ['当日技能经验预算', usage(status.experienceBudgets?.skill.used, status.budget.skillExpPerDay)],
            ['当日冶炼经验预算', usage(status.experienceBudgets?.smelt.used, status.budget.smeltExpPerDay)],
          ];
        if (status.ledger) rows.push(['今日经验总投入', fmt(status.ledger.exp)]);
        return rows.map(([label, value]) => this.statRow(label, value)).join('');
      }
      logsHTML(logs) {
        return logs.length
          ? logs
              .map(
                (l) =>
                  `<div class="log ${esc(l.level)}"><time>${esc(l.time)}</time>${esc(l.text)}</div>`,
              )
              .join('')
          : '<div class="empty-state">暂无动作记录。</div>';
      }
      sellPreview(s) {
        if (!s?.role || !TLPolicy.num(s.role.id)) return this.infoBar('登录角色后显示预览');
        const P = TLPolicy, p = P.config(this.pending),
          plan = P.sellPlan(this.controller.gearState?.(s) || s, p, this.controller.ledger),
          colors = ['', '白', '蓝', '紫', '橙', '红'], reasons = new Map(), count = plan.sell.length;
        for (const { reason } of plan.keep) reasons.set(reason, (reasons.get(reason) || 0) + 1);
        const rows = plan.sell.slice(0, 15).map((eq) => {
          const t = eq.equipTmpl, quality = P.equipQuality(eq);
          return [t.name || '装备', { html: '<span class="quality-dot quality-' + quality + '" aria-hidden="true"></span>' +
            esc(colors[quality] || '未知品质') }, P.num(t.reqLevel), Math.round(P.equipmentScore(eq, s, p)), P.num(eq.tmplId || t.id)];
        });
        if (count > 15) rows.push(['…还有 ' + (count - 15) + ' 件', '', '', '', '']);
        return '<div class="block-title">出售预览</div><div class="stat-grid">' + this.statTile('会卖', count + ' 件') +
          this.statTile('保留', plan.keep.length + ' 件') +
          (s.batchSell !== false && count > 0 && count < p.sell.batchMin ? this.statTile('还差', p.sell.batchMin - count + ' 件') : '') +
          '</div><div class="chips">' + [...reasons].map(([reason, n]) => this.chip(reason + ' ' + n)).join('') + '</div>' +
          this.scoreTableHTML(['名称', '品质', '等级', '评分', '模板ID'], rows);
      }
      ringsHTML(r) {
        if (!r) return '';
        if (!r.level56) return this.chip('56 级开放');
        if (r.at == null) return this.chip('未读取');
        const names = TLPolicy.RING_NAMES, last = r.lastSettlement;
        return this.statRow('今日奖励', '', { html: names.map((name, i) =>
          '<span>' + name + ' ' + TLPolicy.num(r.counts[i]) + '/2</span>').join(' · ') }) +
          this.statRow('神兵符', r.bound + ' 绑定 + ' + r.unbound + ' 不绑定') +
          (r.pending ? this.statRow('暂存', r.pending + ' 枚') : '') +
          this.statRow('本轮', r.run ? '第 ' + (r.run.stage + 1) + ' 环「' + names[r.run.stage] + '」' : '未进入',
            { chip: r.run ? this.chip('进行中', 'ok') : '' }) +
          this.statRow('今日轮数', (r.rounds ? '第 ' + r.rounds + ' 轮' : '未开始') + ' / 共 ' + r.roundsPerDay + ' 轮', {
            chip: r.done ? this.chip('今日已完成', 'ok') : r.stopped ? this.chip('今日轮数已用完', 'warn') :
              r.doubleExp ? this.chip('双倍经验结束后再打') : '' }) +
          (r.roundOpen ? this.statRow('本轮重试', r.retries + ' / ' + r.maxRetries + ' 次') : '') +
          this.statRow('最近结算', last ? names[last.stage] + ' · ' + last.reason + ' · ' +
            TLPolicy.num(last.bound) + ' 绑定 + ' + TLPolicy.num(last.unbound) + ' 不绑定' : '暂无');
      }
      invasionHTML(r) {
        if (r && !r.level20) return this.chip('20 级开放');
        if (r?.boardAt == null) return this.chip('等待数据');
        const time = at => new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const team = r.fighting ? '战斗中' : r.team?.status === 'PREPARING' ? '开战准备中' : r.team ?
          '招募中 ' + r.team.members + '/4' + (r.team.leader ? ' · 队长' : '') : '—';
        return this.statRow('本轮受袭门派', r.sectName || '—', { chip: r.ownSect ? this.chip('本门派', 'ok') : '' }) +
          this.statRow('全服剩余', r.remaining + ' / 10') + this.statRow('本轮结束', time(r.endsAt)) +
          this.statRow('我的队伍', team) + this.statRow('待领取', r.unclaimed + ' 场') +
          this.statRow('今日', '回城 ' + r.today.visits + ' 次 · 参加 ' + r.today.fights + ' 场 · 领取 ' + r.today.claimed + ' 次') +
          this.statRow('残页', r.fragments.map(f => f.name + ' × ' + f.count).join('、') || '—') +
          this.statRow('下次回大理', time(r.nextVisitAt));
      }
      gearCheckHTML(gear) {
        const check = gear?.check, fmt = (n) => n == null ? '—' : Number(n).toFixed(1),
          maps = this.controller?.bridge?.state?.()?.maps || [],
          outcome = (result) => result.state === 'ok' ? this.chip('保留', 'ok') :
            result.state === 'worse' ? (/已换回|已脱下/.test(result.text || '') ? this.chip('已换回', 'warn') : this.chip('保留', 'ok')) :
            this.chip(result.state === 'stale' ? '已过期' : '数据不足');
        const running = check ? this.statRow('装备', check.itemName) + this.statRow('地图', check.mapName) +
          this.progress(check.afterMinutes || 0, check.needMinutes, '战斗数据 ' + fmt(check.afterMinutes) + ' / ' + check.needMinutes + ' 分钟') +
          this.statRow('每小时击杀', '前 ' + fmt(check.beforeRate) + ' → 后 ' + fmt(check.afterRate)) +
          this.statRow('变化', check.change == null ? '—' : fmt(check.change) + '%', {
            tone: check.change > 0 ? 'ok' : check.change < 0 ? 'warn' : 'neutral',
            chip: check.state === 'worse' ? this.chip('等待换回', 'warn') : '',
          }) : this.chip('没有正在核对的换装');
        return '<div class="block-title">换装核对</div>' + running + '<div class="block-title">最近核对结果</div>' +
          this.scoreTableHTML(['装备', '地图', '每小时击杀 前→后', '变化', '结果'], (gear?.results || []).map((r) => [
            r.itemName || '—', maps.find((m) => Number(m.id) === r.mapId)?.name || r.mapId || '—',
            fmt(r.beforeRate) + ' → ' + fmt(r.afterRate), r.change == null ? '—' : fmt(r.change) + '%', { html: outcome(r) },
          ]));
      }
      welfareHTML(s, ledger, now = Date.now()) {
        const P = TLPolicy, state = s?.welfare, used = ledger?.welfare || {},
          status = P.welfareStatus(s, P.config(this.pending), ledger, now), fmt = (n) => P.num(n).toLocaleString('zh-CN'),
          open = state?.accepting && status.serverNow < state.closeAt,
          seconds = state ? Math.max(0, Math.ceil(((open ? state.closeAt : state.drawAt) - status.serverNow) / 1000)) : 0,
          last = P.array(s?.welfareHistory?.list).find((bet) => bet.hits != null),
          numbers = P.array(last?.drawNumbers || last?.winningNumbers || last?.numbers).join(', ') || '—',
          reason = status.reason === '自动投注已关闭' ? '已关闭' : status.reason || '运行中';
        let html = this.statRow('当前期次', '', { html: state ? '<span>第 ' + esc(state.period) + ' 期</span><span>' +
          Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒</span>' + this.chip(open ? '接受投注' : '停止接受投注', open ? 'ok' : 'neutral') : this.chip('未读取') });
        if (state) html += this.statRow('规则版本', state.rulesVersion || '未读取');
        html += this.statRow('今日投注', fmt(used.bets) + ' 注') + this.statRow('今日金币支出', fmt(used.gold)) +
          this.statRow('今日元宝支出', fmt(used.yuanbao)) + this.statRow('自动投注', '', {
            html: this.chip(reason, reason === '运行中' ? 'ok' : reason === '已关闭' ? 'neutral' : 'warn'),
          }) + this.statRow('最近开奖结果', last ? numbers : '—', {
            chip: last ? this.chip(P.num(last.prize) > 0 ? '中奖' : '未中奖', P.num(last.prize) > 0 ? 'ok' : 'neutral') : '',
          });
        if (s?.welfareHistory) {
          const list = P.array(s.welfareHistory.list),
            total = (currency, field) => list.filter((bet) => bet.currency === currency && (field !== 'prize' || bet.hits != null))
              .reduce((sum, bet) => sum + P.num(bet[field]), 0);
          html += '<div class="block-title">游戏返回的最近投注</div>' +
            this.statRow('投注', list.length + ' 注') + this.statRow('总投注额', '', { html: '<span>' + fmt(total('GOLD', 'cost')) +
              ' 金币</span><span>/ ' + fmt(total('YUANBAO', 'cost')) + ' 元宝</span>' }) +
            this.statRow('已开奖总奖金', '', { html: '<span>' + fmt(total('GOLD', 'prize')) + ' 金币</span><span>/ ' +
              fmt(total('YUANBAO', 'prize')) + ' 赠送元宝</span>' }) +
            this.statRow('未开奖', list.filter((bet) => bet.hits == null).length + ' 注');
        }
        return html;
      }
      arenaHTML(arena) {
        return arena ? this.statRow('当前名次', '第 ' + arena.rank + ' 名') +
          this.statRow('今日挑战', arena.attempts + ' / ' + (this.controller.prefs.arena.maxPerDay || '不限')) +
          this.statRow('今日点赞', '', { html: this.chip(arena.liked ? '已点赞' : '未点赞', arena.liked ? 'ok' : 'neutral') }) : '';
      }
      hiddenHTML(hidden) {
        return hidden ? this.statRow('等级', hidden.level) + this.statRow('品质', hidden.quality + '%') +
          this.statRow('砂 / 玉 / 印', hidden.sand + ' / ' + hidden.jade + ' / ' + hidden.seals) : '';
      }
      petsHTML(pets) {
        if (!pets || ![pets.count, pets.capacity, pets.active, pets.eggs].some((v) => v != null))
          return this.infoBar('尚未读取珍兽数据');
        return this.statRow('珍兽栏', (pets.count ?? '?') + ' / ' + (pets.capacity ?? '?')) +
          this.statRow('出战', pets.active ? pets.active.pet.name + ' Lv.' + pets.active.pet.level : '未出战') +
          (pets.eggs != null ? this.statRow('珍兽蛋', pets.eggs) : '') +
          (pets.breeding || []).map((entry) => this.statRow('繁殖 · ' + entry.name,
            entry.status === 'READY' ? '可领取' : entry.status === 'WAITING' ? '等待配对' :
              '繁殖中，约 ' + Math.ceil((entry.readyAt - pets.serverNow) / 60000) + ' 分钟后可领取')).join('') +
          this.scoreTableHTML(['名称', '类型', '等级', '资质', '品质', '战力', '状态'], (pets.list || []).map((entry) => [
            entry.pet.name, { BABY: '宝宝', SECOND: '二代', MUTANT: '变异' }[entry.pet.form] || '—',
            entry.pet.level, entry.average, entry.quality, entry.combatPower,
            { html: (pets.active?.pet.id === entry.pet.id ? this.chip('出战', 'ok') : '') + (entry.pet.locked ? this.chip('锁定') : '') },
          ]));
      }
      releaseNotesHTML(notes) {
        const itemHTML = value => {
          const item = TLUpdates.noteItem(value), text = esc(item.text);
          return '<li>' + (item.important ? '<strong class="tone-err">' + text + '</strong>' : text) + '</li>';
        };
        if (!Array.isArray(notes?.sections)) return '';
        return notes.sections.filter(section => Array.isArray(section?.items)).map(section =>
          '<div class="block-title">' + esc(section.title) + '</div><ul class="release-notes">' +
          section.items.map(itemHTML).join('') + '</ul>').join('');
      }
      updateDialogHTML(u) {
        const message = u.newer ? '当前版本 v' + u.currentVersion + '，建议尽快更新。' : '已更新到这个版本。';
        return this.dialogHTML('重要更新 v' + u.latestVersion, this.infoBar(message) + this.releaseNotesHTML(u.notes),
          u.newer ? ['安装新版本', '稍后'] : ['知道了'], 0);
      }
      dialogHTML(title, body, buttons, primaryIndex) {
        const button = (label, index) => '<button type="button" class="btn' +
          (index === primaryIndex ? ' primary' : '') + '">' + esc(label) + '</button>';
        return '<h2 id="important-update-title">' + esc(title) + '</h2>' + body +
          '<div class="actions">' + buttons.map(button).join('') + '</div>';
      }
      hideUpdateDialog() {
        if (!this.modal) return;
        this.modal.remove();
        this.modal = null;
        this.transfer = null;
        this.updateDialogKey = null;
        this.dialogReturnFocus?.focus({ preventScroll: true });
        this.dialogReturnFocus = null;
      }
      syncUpdateDialog(status) {
        if (this.transfer) return;
        const u = !this.cover && this.controller.prefs.updates.remind && (status ?? this.controller.updates?.status());
        if (!u?.dialog) return this.hideUpdateDialog();
        const key = JSON.stringify([u.latestVersion, u.currentVersion, u.notes]);
        if (key === this.updateDialogKey) return;
        this.hideUpdateDialog();
        this.updateDialogKey = key;
        const close = () => this.controller.updates.closeDialog(u.latestVersion);
        this.showDialog(this.updateDialogHTML(u), close, index => {
          if (!index && u.newer) window.open(u.installUrl, '_blank', 'noopener,noreferrer');
          close();
        });
      }
      showDialog(html, close, choose) {
        this.dialogReturnFocus = this.root.activeElement || document.activeElement;
        while (this.dialogReturnFocus?.shadowRoot?.activeElement)
          this.dialogReturnFocus = this.dialogReturnFocus.shadowRoot.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'update-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-labelledby', 'important-update-title');
        dialog.innerHTML = html;
        this.modal = this.root.appendChild(dialog);
        this.bindUpdateDialog(dialog, close, choose);
        // The top layer keeps it above the game, and the page behind it is inert, so focus stays inside.
        dialog.showModal();
        dialog.querySelector('button').focus();
      }
      bindUpdateDialog(dialog, close, choose) {
        const buttons = [...dialog.querySelectorAll('button')];
        dialog.addEventListener('click', event => {
          event.stopPropagation();
          const button = event.target.closest('button');
          if (!button) return;
          return choose(buttons.indexOf(button));
        });
        // Events inside the dialog still bubble to the game's listeners on the document.
        dialog.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key !== 'Escape') return;
          event.preventDefault();
          close();
        });
        // Other close requests, such as the Android back gesture.
        dialog.addEventListener('cancel', event => {
          event.preventDefault();
          close();
        });
        dialog.addEventListener('mousedown', event => {
          event.stopPropagation();
          if (!event.target.closest('button')) event.preventDefault();
        });
        for (const type of ['keyup', 'keypress', 'pointerdown', 'pointerup', 'mouseup', 'dblclick', 'wheel'])
          dialog.addEventListener(type, event => event.stopPropagation());
      }
      updateHTML(u) {
        const date = (value) => value ? new Date(value).toLocaleString() : '—';
        return '<div class="update-summary">' +
          this.statRow('当前版本', 'v' + u.currentVersion) + this.statRow('最新版本', u.latestVersion ? 'v' + u.latestVersion : '—', {
            chip: u.latestVersion ? this.chip(u.newer ? '可更新' : '已是最新', u.newer ? 'accent' : 'ok') : '',
          }) + this.statRow('最近检查', date(u.checkedAt)) + this.statRow('下次检查', date(u.nextCheckAt)) +
          (u.busy ? this.infoBar('正在读取公开版本信息') : u.error ? this.infoBar(u.error, 'err') :
            !u.checkedAt ? this.chip('尚未检查公开版本') : '') +
          (u.newer && u.apply?.exhausted ? this.infoBar('已自动刷新 5 次仍是旧版本，请点“安装新版本”。', 'warn') : '') +
          (u.notes ? this.sectionHTML(u.notes.title, this.releaseNotesHTML(u.notes),
            false, { id: 'release-notes' }) : u.newer ? this.infoBar('更新内容暂未读取，可在发布页查看。') : '') +
          '<div class="actions"><button type="button" class="btn" data-action="checkUpdate">检查更新</button><button type="button" class="btn' + (u.daily ? '' : ' primary') + '" data-action="openUpdate">GitHub 发布页</button>' +
          (u.greasyForkPage ? '<button type="button" class="btn' + (u.daily ? ' primary' : '') + '" data-action="openGreasyFork">Greasy Fork 页面</button>' : '') +
          (u.newer ? '<button type="button" class="btn" data-action="installUpdate">安装新版本</button><button type="button" class="btn" data-action="dismissUpdate">关闭本版提醒</button>' : '') +
          '</div>' + this.sectionHTML('自动安装', '', false, { help: HELP.install }) + '</div>';
      }
      profileButtons(attribute, choices, selected, disabled = () => false) {
        return '<div class="segmented" role="group" aria-label="装备方案">' + choices.map((name) =>
          '<button type="button" data-' + attribute + '="' + name + '" aria-pressed="' + (name === selected) + '"' +
          (disabled(name) ? ' disabled' : '') + '>' + (name === 'auto' ? '自动' : TLPolicy.profileLabel(name)) + '</button>').join('') + '</div>';
      }
      profileStatusHTML(status) {
        const g = status.gearProfile || {}, mode = g.mode || this.pending.gear.profile;
        const unavailable = (g.profiles || []).filter((profile) => !profile.available);
        return this.statRow('当前穿戴', TLPolicy.longLabel(g.worn), { chip: this.chip(mode === 'auto' ? '自动' : '手动') +
          (g.pending ? this.chip('切换中 ' + g.pending + ' 件') : '') }) +
          [...new Set(unavailable.map((profile) => profile.why))].map((why) => this.infoBar(why)).join('') +
          this.profileButtons('gear-profile', ['auto', ...TLPolicy.PROFILE_IDS], mode, (name) =>
            !(g.enabled ?? this.controller?.prefs?.gear.enabled ?? this.pending.gear.enabled) || (TLPolicy.ASSAULT_IDS.includes(name) &&
            !g.profiles?.some((profile) => profile.id === name && profile.available)));
      }
      profileScoreHTML(status, s) {
        const choices = (status.gearProfile?.profiles || []).filter((v) => v.available).map((v) => v.id);
        const switchable = choices.length > 1 && ['scoreStatus', 'scoreStats'].includes(this.section);
        const selected = this.scoreProfile || status.gearProfile?.worn;
        const name = switchable && choices.includes(selected) ? selected : 'farm';
        const view = TLPolicy.profileView(s, this.pending, name);
        const detail = this.indexing ? null : TLPolicy.scoringDetail(view.state, view.prefs);
        return (switchable ? this.profileButtons('score-profile', choices, name) : '') +
          this.scoreHTML(name === 'farm' ? status : { ...status, scoring: status.scoring.profiles[name] }, detail);
      }
      scoreHTML(status, detail) {
        if (this.section === 'scoreStatus') return this.scoreLiveHTML(status, detail);
        if (this.section === 'scoreStats') return this.scoreAttributesHTML(detail);
        if (this.section === 'scoreFormula') return this.scoreFormulaHTML(status);
        const f = (l, p, o) => this.field(l, p, o);
        return this.sectionHTML('评分设置',
          f('评分方式', 'gear.scoring', { choices: [['combat', '实战评分（按伤害公式，推荐）'], ['linear', '固定权重（同游戏战力）']] }) +
          f('评分参照怪物', 'gear.targets', { choices: [['pool', '可进入的最高 6 张挂机地图（推荐）'], ['map', '只看最近挂机的地图']] }) +
          f('自动调整生存权重', 'gear.autoDefense', { help: '按实测战况调整' }) +
          f('生存权重', 'gear.defenseWeight', { min: 0, max: 1, step: 0.1, help: '自动关闭或数据不足时使用；0 只看输出，1 输出与生存并重' }) +
          f('攻坚：自动调整生存权重', 'gear.assault.autoDefense', { dependsOn: 'gear.assault.enabled' }) +
          f('攻坚生存权重', 'gear.assault.defenseWeight', { min: 0, max: 1, step: 0.1, dependsOn: 'gear.assault.enabled', help: '自动关闭或数据不足时使用；默认 1，输出与生存并重' }), true);
      }
      smartMapHTML(smart, currentId) {
        if (!smart) return '';
        const states = { trial: '试打中', best: '当前最优', measured: '已测', weak: '较差', loss: '亏药费', blocked: '阵亡暂避' };
        const fmt = TLRuntime.statsNumber;
        const rate = (v, se) => v == null ? '—' : fmt(v) + ' ± ' + (Number.isFinite(se) ? fmt(2 * se) : '∞');
        return this.scoreTableHTML(['地图', '状态', '经验/时', '净金币/时', '实测'], smart.candidates.map(row => [
          { html: esc(row.name) + (row.id === Number(currentId) ? this.chip('所在地图') : '') }, states[row.state],
          rate(smart.goal === 'exp' ? row.rate : row.exp, smart.goal === 'exp' ? row.se : row.expSe),
          rate(row.net, row.netSe), Math.floor(row.minutes) + ' 分钟']));
      }
      scoreTableHTML(headers, rows, mapTable = false) {
        return '<div class="table-scroll"><table class="income-table"><thead><tr>' + headers.map((v) => '<th>' + esc(v) + '</th>').join('') +
          '</tr></thead><tbody>' + rows.map((row) => '<tr>' + row.map((v, i) => (mapTable && i === 0 ? '<td title="' + esc(v) + '">' : '<td>') + (v && typeof v === 'object' && 'html' in v ? v.html : esc(v)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      }
      scoreDangerHTML(v, isRings, settlement) {
        const percent = (n) => (Number(n || 0) * 100).toFixed(1) + '%',
          rows = [
            ['药费占收入', v ? percent(v.share) : '—', '0–100%', '—'],
            ['掉血占回血能力', v ? percent(v.ratio) + (v.healed > 0.02 ? '（另有 ' + percent(v.healed) + ' 的掉血由技能等回复，不计入）' : '') : '—', '安全线 50%', v ? Number(v.sustain).toFixed(2) : '—'],
            ['低血量时间', v ? percent(v.low) : '—', '5% 升满', v ? Number(v.burst).toFixed(2) : '—'],
            ['阵亡次数', v ? v.deaths + ' 次' : '—', '有阵亡时 0.5', v ? Number(v.death).toFixed(2) : '—'],
            ['战斗数据时长', v ? Number(v.hours).toFixed(1) + ' 小时' : '—', '至少 30 分钟', '—'],
          ];
        if (isRings) {
          rows[0] = ['最近挑战结果', settlement ? settlement.reason === '通关' ? '通关' : '失败' : '—', '失败时权重为 1', '—'];
          rows.splice(3, 2, ['战斗数据时长（至少 5 分钟）', v ? (v.hours * 60).toFixed(1) + ' 分钟' : '—', '至少 5 分钟', '—']);
        }
        return '<div class="block-title">危险度' + (v ? this.chip(Number(v.danger).toFixed(2), v.safe ? 'ok' : 'warn') : '') +
          '</div>' + this.scoreTableHTML(['指标', '当前', '标准', '危险度'], rows);
      }
      scoreLiveHTML(status, detail) {
        const score = status.scoring || {}, survival = score.survival, pending = !detail && this.pending.gear.scoring === 'combat';
        let html = '<div class="stat-grid">' + [
          ['人物实战评分', detail ? Math.round(detail.character) : '—'],
          ['每次行动输出', detail ? detail.parts.out.toFixed(0) : '—'],
          ['每次受击', detail ? detail.parts.taken.toFixed(1) : '—'],
          ['气血', detail ? detail.parts.hp.toFixed(0) : '—'],
        ].map(([label, value]) => this.statTile(label, value)).join('') + '</div>' +
          this.statRow('评分参照', '', { html: (score.mapNames || []).length ?
            score.mapNames.map((name) => this.chip(name)).join('') : this.chip('等待数据') }) +
          this.statRow('生存权重', score.weight ?? this.pending.gear.defenseWeight, {
            chip: this.chip(score.auto ? '自动' : '手动') +
              (score.source === 'tower' ? '' : survival ? this.chip(survival.safe ? '安全' : '有风险', survival.safe ? 'ok' : 'warn') : this.chip('等待数据')),
          }) + (score.source === 'tower' ? this.statRow('最高通关', (score.highestFloor ?? '—') + ' 层') +
            this.statRow('上次死亡', (score.lastDeathFloor ?? '—') + ' 层') :
            this.scoreDangerHTML(survival, score.source === 'rings', status.rings?.lastSettlement));
        if (pending) html += this.infoBar('实战评分等待战斗数据');
        if (score.autoDefense && !score.auto)
          html += this.infoBar(score.survivalReason === 'potions' ? '未读到生命药数据，用手动值；开始托管后自动读取' : '数据不足，用手动值');
        html += '<div class="actions"><button class="btn" type="button" data-action="resetScoring">重置评分数据</button>' + this.help(HELP.reset) + '</div>';
        if (status.scoring?.since != null) {
          const d = new Date(status.scoring.since), pad = n => String(n).padStart(2, '0');
          html += this.statRow('评分数据自', pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
        }
        if (detail) {
          const names = Object.fromEntries(TLPolicy.SCORE_ATTRIBUTES);
          if (Object.keys(detail.buffMult || {}).length)
            html += '<div class="block-title">技能倍数增益</div>' + Object.entries(detail.buffMult).map(([key, value]) =>
              this.statRow(names[key] || key, '× ' + value.toFixed(3))).join('');
          if (detail.parts.artifact)
            html += this.statRow('神器技能', detail.parts.artifact.skillName) +
              this.statRow('覆盖率', (detail.parts.artifact.uptime * 100).toFixed(1) + '%');
        }
        return this.sectionHTML('当前状态', html, true);
      }
      scoreAttributesHTML(detail) {
        const table = detail ? this.scoreTableHTML(['属性', '当前值', '+1 点', '+100 点'], detail.rows.map((r) =>
          [r.name, Math.round(r.current), r.one.toFixed(2), r.hundred.toFixed(1)])) :
          this.pending.gear.scoring === 'combat' ? this.infoBar('实战评分等待战斗数据') :
            this.scoreTableHTML(['属性', '每点分数'], Object.entries(this.pending.gear.weights).map(([k, v]) =>
              [Object.fromEntries(TLPolicy.SCORE_ATTRIBUTES)[k] || (k === 'mp' ? '真气' : k), v]));
        return this.sectionHTML('属性分数', table, true, {
          help: [HELP.points, HELP.attributes, ...(this.pending.gear.scoring === 'linear' ? [HELP.linear] : [])],
        });
      }
      scoreFormulaHTML(status) {
        const p = TLPolicy, percent = (v) => Math.round(v * 100) + '%',
          lines = [
          '实战值 = 每次行动输出 ×（气血 ÷ 每次受击伤害）^ 生存权重',
          `分数 = ${p.SCORE_UNIT} × ln（实战值之比）；每 100 分约等于 1%`,
          `单件装备分数 = ${p.SCORE_UNIT} × ln（穿上它的实战值 ÷ 该部位空着的实战值）`,
          `人物实战评分 = ${p.SCORE_UNIT} × ln（当前实战值 ÷ 不穿任何装备的实战值）`,
          '每次伤害 = 命中率 ×［主伤害 ×（1 +（会心倍率 − 1）× 会心率）+ 元素伤害］',
          `主伤害 =［外攻² ÷（${p.MAIN_SOFTCAP} × 外攻 + 对方外防）+ 内攻² ÷（${p.MAIN_SOFTCAP} × 内攻 + 对方内防）］×（1 + 0.005 × 等级差）`,
          '元素伤害 = Σ max(0, 元素攻击 − 对方抗性) × ' + TLPolicy.ELEMENT_RATE + ' ×（1 + 被动加成）',
          `命中率 = 命中 ÷（命中 + 对方闪避）；会心率 = 会心 ÷（会心 + 对方会防 + ${p.CRIT_CHANCE_OFFSET}），最高 ${percent(p.CRIT_CHANCE_CAP)}`,
          `会心伤害倍率 = ${p.CRIT_BASE} + ${p.CRIT_RATE} ×（会心 − 起点），最高 ${p.CRIT_MULT_CAP.toFixed(1)}；起点 = ${p.CRIT_FLOOR} 和“让会心率达到 ${p.CRIT_CHANCE_CAP * 100}% 所需的会心”（(${p.CRIT_DEF_OFFSET} + ${p.CRIT_DEF_RATE} × 对方会防) ÷ ${p.CRIT_DEF_DIVISOR}）两者中较大的一个`,
          '会心低于起点时，倍率按 1.5 计算；会心一击只放大主伤害',
          '会心率到 70% 以后，多出来的会心转成会心伤害；倍率到 2.0 后再堆会心没有收益',
          '对方防御被技能削弱、被眩晕的时间按“持续时间 ÷ 冷却”折算',
          '自身倍数增益在固定值增益后计算：属性 ×［1 +（技能倍数 − 1）× min(1, 持续时间 ÷ 冷却)］；对怪减益作用于双方伤害公式中的对应属性',
          `输出按技能轮转加权（冷却越短出手越多）；治疗技能不计入；多段技能按段数 × 每段比例计，群攻技能按当前平均在场怪物数（${status?.scoring?.aoeTargets === undefined ? '1' : status.scoring.aoeTargets.toFixed(1)}）计；对参照怪物取平均；受击伤害用同一组公式反过来算`,
          '神器技能：每次命中按触发率触发，额外伤害 = 触发率 × 额外比例；增益与减益按“持续时间内至少触发一次”的概率折算',
          '自动生存权重 = 生命药费 ÷（击杀金币 + 出售收入）+ 危险度',
          `危险度 = max（（掉血占回血能力 − ${percent(p.SUSTAIN_LINE)}）÷ ${percent(1 - p.SUSTAIN_LINE)}，低血量时间占比 ÷ ${percent(p.LOW_HP_SHARE)}，有阵亡时 0.5）`,
          `低血量 = 气血低于 ${percent(p.HP_LINE)}；回血能力 = 最强可用生命药回复量 ÷ 3 秒；掉血只算靠生命药补回的部分，技能和珍兽回复的不算`
        ],
          labels = ['实战值', '分数', '单件装备分数', '人物实战评分', '每次伤害', '主伤害', '元素伤害', '命中与会心率',
            '会心伤害倍率', '会心起点', '会心上限', '技能减益', '技能倍数', '技能轮转', '神器技能', '自动生存权重', '危险度', '低血量'];
        return this.sectionHTML('计算公式', '<div class="formula-table">' +
          this.scoreTableHTML(['项目', '公式'], lines.map((line, index) => [labels[index], line])) +
          '</div>' + this.infoBar('三环内按小怪和首领的总气血加权，每环等重。失败后生存权重为 1，其余按实测危险度调整，最低 0.5。浮屠按最近打到的高层敌人评分，自动生存权重为 1。'), true,
          { help: [HELP.reference, HELP.defense] });
      }
      rangeSwitch() {
        return '<div class="segmented" role="group" aria-label="统计范围">' +
          [['recent', '近 1 小时'], ['previous', '上一小时'], ['today', '今日'], ['day24', '近 24 小时']].map(([value, label]) =>
            '<button type="button" data-range="' + value + '" aria-pressed="' + (this.uiState().range === value) + '">' + label + '</button>').join('') + '</div>';
      }
      trendHTML(stats) {
        const metric = this.uiState().metric, fmt = TLRuntime.statsNumber,
          points = stats.series || [], end = points.at(-1)?.hour,
          values = points.map((p) => p.wall >= 300000 ? (metric === 'net' ? p.gold + p.sell - p.potion : p[metric]) * 3600000 / p.wall : null),
          valid = values.filter((value) => value !== null), range = this.uiState().range;
        const controls = '<div class="segmented" role="group" aria-label="曲线指标">' +
          [['exp', '经验/时'], ['net', '净金币/时'], ['kills', '击杀/时']].map(([key, label]) =>
            '<button type="button" data-metric="' + key + '" aria-pressed="' + (metric === key) + '">' + label + '</button>').join('') + '</div>';
        if (valid.length < 2) return controls + this.infoBar('数据不足，挂机满 2 小时后显示曲线');
        const width = 360, left = 44, right = 8, top = 12, bottom = 114,
          step = (width - left - right) / Math.max(1, points.length - 1),
          low = Math.min(0, ...valid), high = Math.max(1, ...valid),
          x = (index) => left + index * step, y = (value) => bottom - (value - low) / (high - low) * (bottom - top),
          date = new Date(end * 3600000).toDateString(),
          selected = (hour) => range === 'day24' || (range === 'previous' ? hour === end - 1 :
            range === 'today' ? new Date(hour * 3600000).toDateString() === date :
              hour === end || ((stats.summary.hour?.wall ?? stats.summary.recent.wall) < 600000 && hour === end - 1));
        let svg = '<svg class="trend" viewBox="0 0 360 140" role="group" aria-label="近 24 小时收益曲线">';
        for (let i = 0; i < points.length; i++) {
          if (selected(points[i].hour)) svg += '<rect class="chart-range" data-hour="' + points[i].hour + '" x="' +
            Math.max(left, x(i) - step / 2) + '" y="' + top + '" width="' + (i === 0 || i === points.length - 1 ? step / 2 : step) +
            '" height="' + (bottom - top) + '"></rect>';
        }
        for (const value of [high, (high + low) / 2, low]) {
          svg += '<line class="chart-grid" x1="' + left + '" x2="' + (width - right) + '" y1="' + y(value) + '" y2="' + y(value) + '"></line>' +
            '<text class="chart-label" x="' + (left - 4) + '" y="' + (y(value) + 4) + '" text-anchor="end">' + esc(fmt(value)) + '</text>';
        }
        const segments = [];
        let segment = [];
        values.forEach((value, index) => {
          if (value === null) { if (segment.length) segments.push(segment); segment = []; }
          else segment.push([x(index), y(value)]);
        });
        if (segment.length) segments.push(segment);
        for (const line of segments) {
          const coordinates = line.map(([px, py]) => px + ',' + py).join(' ');
          svg += '<path class="chart-area" d="M ' + line[0][0] + ',' + y(0) + ' L ' + coordinates + ' L ' +
            line.at(-1)[0] + ',' + y(0) + ' Z"></path><polyline class="chart-line" points="' + coordinates + '"></polyline>';
        }
        points.forEach((point, index) => {
          const hour = new Date(point.hour * 3600000).getHours(), label = String(hour).padStart(2, '0') + ':00';
          if (hour % 4 === 0) svg += '<text class="chart-label chart-hour-label" x="' + x(index) + '" y="133" text-anchor="middle">' + label + '</text>';
          if (values[index] === null) return;
          const tip = label + ' · ' + fmt(values[index]);
          svg += '<g class="chart-hour" tabindex="0" role="button" aria-label="' + esc(tip) + '" data-hour="' + point.hour + '" data-tip="' + esc(tip) + '">' +
            '<rect class="chart-hit" x="' + (x(index) - step / 2) + '" y="' + top + '" width="' + step + '" height="' + (bottom - top) + '"></rect>' +
            '<line class="chart-guide" x1="' + x(index) + '" x2="' + x(index) + '" y1="' + top + '" y2="' + bottom + '"></line>' +
            '<circle class="chart-dot" cx="' + x(index) + '" cy="' + y(values[index]) + '" r="3"></circle></g>';
        });
        return controls + svg + '</svg>';
      }
      consumptionHTML(stats, status) {
        const r = stats.rates || {}, fmt = TLRuntime.statsNumber, sampled = r.seconds >= 60;
        return this.statRow('每秒掉血', sampled ? fmt(r.hpLossPerSec) : '—') +
          this.statRow('每秒耗蓝', sampled ? fmt(r.mpUsePerSec) : '—') +
          this.statRow('10 秒最大掉血', sampled ? Math.round(r.worstLoss10Pct || 0) + '%' : '—') +
          this.statRow('样本时长', fmt(r.seconds) + ' 秒', { chip: sampled ? '' : this.chip('数据不足') }) +
          ['hp', 'mp'].map((key) => {
            const pick = status.potions?.[key];
            return this.statRow(key === 'hp' ? '生命药' : '内力药', '', {
              html: pick ? '<span>' + esc(pick.name) + '</span><span>回复 ' + fmt(pick.perSecond) + '/秒 · 需要 ' + (sampled ? fmt(pick.need) + '/秒' : '—') + '</span>' : '—',
              chip: sampled && pick ? this.chip(pick.perSecond >= pick.need ? '足够' : '不足', pick.perSecond >= pick.need ? 'ok' : 'warn') : this.chip('等待数据'),
            });
          }).join('') + (this.controller.prefs.potions.autoThreshold ? this.statRow('生命阈值', status.threshold + '%') : '');
      }
      statsHTML(stats, maps, status = this.controller.status()) {
        const help = { help: HELP.stats };
        if (!stats) return this.sectionHTML('收益统计', this.rangeSwitch() + this.infoBar('登录后显示'), true, help);
        const fmt = TLRuntime.statsNumber, duration = TLRuntime.statsDuration, range = this.uiState().range,
          rate = (n, time) => fmt(time ? n * 3600000 / time : 0),
          b = stats.summary[range] || {}, net = (b.gold || 0) + (b.sell || 0) - (b.potion || 0);
        const tiles = [
          ['经验', fmt(b.exp), rate(b.exp, b.wall) + '/时'], ['净金币', fmt(net), rate(net, b.wall) + '/时'],
          ['击杀金币', fmt(b.gold)], ['出售收入', fmt(b.sell)], ['药费', fmt(b.potion)],
          ['击杀', fmt(b.kills)], ['阵亡', fmt(b.deaths)], ['战斗占比', (b.wall ? b.battle / b.wall * 100 : 0).toFixed(1) + '%'],
          ['低血量', duration(b.low || 0)], ['用药', '生命 ' + fmt(b.hpPotions) + ' · 内力 ' + fmt(b.mpPotions)],
        ];
        const rows = stats.summary.maps.map((bucket) => [
          (maps || []).find((m) => Number(m.id) === bucket.mapId)?.name || bucket.mapId,
          duration(bucket.battle), rate(bucket.exp, bucket.battle), rate(bucket.expBase, bucket.battle),
          rate(bucket.gold + bucket.sell, bucket.battle), rate(bucket.potion, bucket.battle),
          rate(bucket.gold + bucket.sell - bucket.potion, bucket.battle), fmt(bucket.deaths),
        ]);
        return this.sectionHTML('收益统计', this.rangeSwitch() + '<div class="stat-grid">' +
          tiles.map(([label, value, sub]) => this.statTile(label, value, sub)).join('') + '</div>' + this.trendHTML(stats), true, help) +
          this.sectionHTML('按地图', this.scoreTableHTML(['地图', '战斗时长', '经验/时', '单倍经验/时', '金币/时', '药费/时', '净金币/时', '阵亡'], rows, true),
            false, { extra: this.chip('近 72 小时') }) +
          this.sectionHTML('当前消耗', this.consumptionHTML(stats, status) +
            '<button class="btn" type="button" data-action="clearStats">清空统计</button>');
      }
      paintUpdates(u) {
        const chip = this.versionChip, newer = !!u?.newer;
        if (chip) {
          const text = newer ? '可更新 v' + u.latestVersion : 'v' + (u?.currentVersion || '1.3.3'),
            title = newer ? '点击查看更新内容' : '';
          if (chip.textContent !== text) chip.textContent = text;
          if (chip.classList.contains('has-update') !== newer) chip.classList.toggle('has-update', newer);
          if (chip.disabled !== !newer) chip.disabled = !newer;
          if (chip.title !== title) {
            if (title) chip.title = title;
            else chip.removeAttribute('title');
          }
        }
        for (const [selector, name] of [['[data-group="system"]', '系统'], ['[data-tab="updates"]', '更新']]) {
          const tab = this.root.querySelector(selector), text = name + (u?.newer && name === '更新' ? ' · 新' : '');
          if (!tab) continue;
          if (tab.classList.contains('has-update') !== !!u?.newer) tab.classList.toggle('has-update', !!u?.newer);
          if (tab.textContent !== text) tab.textContent = text;
        }
      }
      paint() {
        if (!this.root || (typeof document !== 'undefined' && document.hidden)) return;
        this.paintHud();
        if (this.windowOpen === false) return this.syncUpdateDialog();
        const s = this.controller.status();
        const u = s.updates;
        this.syncUpdateDialog(u);
        const key = s.role?.id || '';
        if (this.roleKey != null && key !== this.roleKey) { this.roleKey = key; this.bodyDirty = true; }
        this.paintUpdates(u);
        if (this.bodyDirty) this.renderBody(s);
        if (!this.dirty && JSON.stringify(this.pending) !== JSON.stringify(this.controller.prefs)) {
          this.pending = TLPolicy.clone(this.controller.prefs);
          this.renderBody(s);
        }
        if (this.query) { this.paintDirty(); return; }
        if (this.section === 'updates' && !this.dirty && this.updateKey !== JSON.stringify(u))
          this.renderBody(s);
        if (this.section === 'stats' && !this.dirty && Date.now() - this.statsPaintAt >= 5000 &&
          this.statsKey !== this.liveContentKey(this.statsHTML(s.stats, this.controller.bridge.state()?.maps, s))) this.renderBody(s);
        if (['scoreStatus', 'scoreStats'].includes(this.section) && !this.dirty && Date.now() - this.scorePaintAt >= 5000 &&
          this.scoreKey !== this.liveContentKey(this.profileScoreHTML(s, this.controller.bridge.state()))) this.renderBody(s);
        if (this.section === 'battle') {
          this.paintFragment('.smart-map-status', this.smartMapHTML(s.smartMap, s.role?.mapId));
          this.paintFragment('.welfare-status', this.welfareHTML(this.controller.bridge.state(), s.ledger));
          this.paintFragment('.arena-status', this.arenaHTML(s.arena));
          this.paintFragment('.rings-status', this.ringsHTML(s.rings));
          this.paintFragment('.invasion-status', this.invasionHTML(s.invasion));
        }
        if (this.section === 'growth') {
          this.paintFragment('.gear-profile-status', this.profileStatusHTML(s));
          this.paintFragment('.gear-check-status', this.gearCheckHTML(s.gear));
          this.paintFragment('.hidden-status', this.hiddenHTML(s.hidden));
        }
        if (this.section === 'pets') this.paintFragment('.pets-status', this.petsHTML(s.pets));
        if (this.section === 'economy') {
          this.paintFragment('.sell-preview', this.sellPreview(this.controller.bridge.state()));
        }
        if (this.section === 'status') {
          this.paintFragment('.runtime-status', this.runtimeHTML(s));
          this.paintFragment('.login-status', !s.role?.id ? this.infoBar('请先在游戏里登录角色') : '');
          const budgets = this.root.querySelector('.status-budgets'), html = this.statusBudgetsHTML(s);
          if (budgets && html !== this.statusBudgetsKey) {
            this.hideTooltip();
            budgets.innerHTML = html;
            this.statusBudgetsKey = html;
          }
        }
        const run = this.root.querySelector('.run-toggle'), action = s.enabled ? 'pause' : 'start',
          runText = s.enabled ? '暂停托管' : '开始托管';
        if (run) {
          if (run.dataset.action !== action) run.setAttribute('data-action', action);
          if (run.textContent !== runText) run.textContent = runText;
        }
        if (this.section === 'status') this.paintSummary(s);
        if (this.section === 'budget') this.paintFragment('.legacy-experience', s.ledger?.unclassifiedExp ?
          this.statRow('旧版未分类投入', this.formatAmount(s.ledger.unclassifiedExp), {
            help: '旧版未分类投入 ' + this.formatAmount(s.ledger.unclassifiedExp) + '，已占用技能和冶炼预算；人物升级继续按等级目标执行。',
          }) : '');
        this.paintDirty();
        this.paintLogs();
        this.paintDatabase();
      }
      formatAmount(value) {
        const number = Number(value || 0);
        return Math.abs(number) >= 1e12 ? number.toExponential(2) : number.toLocaleString('zh-CN');
      }
      paintSummary(s) {
        const tone = this.statusTone({ ...s, pausedBySelf: s.pausedBySelf ?? (!s.enabled && this.controller.lastPause?.byUser === false && !!this.controller.lastPause.reason) });
        const fact = (label, value, detail = false, progress = null) => value == null || value === '' ? '' :
          `<div class="stat-row${detail ? ' fact-detail' : ''}"><dt class="stat-label">${label}</dt><dd class="stat-value${progress ? ' level-reason tone-' + (['paused', 'uncertain'].includes(progress.code) ? 'warn' : 'neutral') : ''}"${progress ? ' data-code="' + esc(progress.code) + '"' : ''}>${progress ? esc(value) : String(value).split(' · ').map((part) => '<span>' + esc(part) + '</span>').join('<span aria-hidden="true"> · </span>')}</dd></div>`;
        let summary = `<div class="status-line"><span class="status-label"><span class="dot ${tone}"></span><span>${s.enabled ? '托管运行中' : '已暂停'} · ${s.ready ? '角色在线' : s.connected ? '等待角色' : '等待连接'}</span></span>${s.role ? `<span class="role-name" title="${esc(s.role.nickname)} · Lv.${esc(s.role.level)}">${esc(s.role.nickname)} · Lv.${esc(s.role.level)}</span>` : ''}</div><div class="reason">${tone === 'on' ? '<div class="info-bar tone-neutral"><span>' + esc(s.reason) + '</span></div>' : this.infoBar(s.reason, tone)}</div>`;
        if (s.role) {
          const income = s.stats?.summary?.recent;
          if (income?.wall >= 60000) summary += '<div class="figures">' +
            [['经验 / 时', income.exp], ['金币 / 时', income.gold + income.sell], ['药费 / 时', income.potion]]
              .map(([label, value]) => `<div class="figure stat-tile"><span>${label}</span><strong>${esc(TLRuntime.statsNumber(value * 3600000 / income.wall))}</strong></div>`).join('') + '</div>';
          summary += '<dl class="facts">' +
            fact('地图', s.map) + fact('金币', s.role.money == null ? null : this.formatAmount(s.role.money)) +
            fact('升级', s.levelUp?.reason, true, s.levelUp) + fact('技能', s.skillUp?.reason, true, s.skillUp) +
            fact('比武', s.arena ? `第 ${s.arena.rank} 名 · 挑战 ${s.arena.attempts}/${this.controller.prefs.arena.maxPerDay || '不限'} · 点赞 ${s.arena.liked ? '已' : '未'}` : null, true) +
            fact('珍兽', s.pets && [s.pets.count, s.pets.capacity, s.pets.active, s.pets.eggs].some((v) => v != null) ? `${s.pets.count ?? '?'} / ${s.pets.capacity ?? '?'} · ${s.pets.active ? '出战 ' + s.pets.active.pet.name + ' Lv.' + s.pets.active.pet.level : '未出战'} · 蛋 ${s.pets.eggs ?? '?'}` : null, true) +
            fact('暗器', s.hidden ? `Lv.${s.hidden.level} · 品质 ${s.hidden.quality}% · 砂 ${s.hidden.sand} · 玉 ${s.hidden.jade} · 印 ${s.hidden.seals}` : null, true) + '</dl>';
        } else summary += '<div class="summary-login">登录后读取当前角色</div>';
        if (this.root.querySelector('.summary') && summary !== this.summaryHTML) {
          if (this.tipAnchor?.closest('.summary')) this.hideTooltip();
          this.root.querySelector('.summary').innerHTML = summary;
          this.summaryHTML = summary;
        }
      }
      download(name, value, type = 'application/json') {
        const url = URL.createObjectURL(
            new Blob([type === 'application/json' ? JSON.stringify(value, null, 2) : value], { type: type + ';charset=utf-8' }),
          ),
          a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    return { Panel };
  })();

  if (
    location.protocol === 'https:' &&
    ((location.hostname === 'tl.jayczee.top' && location.port === '1212') ||
      (location.hostname === 'tl2.jayczee.top' && location.port === '11212') ||
      (location.hostname === 'tl3.jayczee.top' && location.port === '11212')) &&
    window.top === window
  ) {
    if (window.__TL_AUTOPILOT_INSTALLED__) {
      TLRuntime.showConflictNotice(window, document);
      return;
    }
    window.__TL_AUTOPILOT_INSTALLED__ = true;
    const controller = new TLRuntime.Controller();
    controller.updates = new TLUpdates.Checker(controller);
    const panel = new TLPanel.Panel(controller);
    controller.filler = new TLRuntime.Filler(controller);
    controller.filler.start();
    controller.updates.onChange = () => controller.paint();
    controller.updates.start();
    window.TLAutopilot = Object.freeze({
      start: () => controller.start(),
      pause: () => controller.pause(undefined, true),
      stopBattle: () => controller.stopBattle(),
      preview: () => controller.preview(),
      status: () => controller.status(),
      getConfig: () => TLPolicy.clone(controller.prefs),
      setConfig: (v) => controller.updateConfig(v),
    });
  }
})();
