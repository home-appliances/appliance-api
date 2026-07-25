/**
 * 参数值「按需入座」：
 * - 以 category_params.enum_values / boolean 选项为座位
 * - 能对上 → 写入标准值
 * - 对不上 → 不硬塞，返回例外供人工处理
 */

export type ParamDefMeta = {
  paramType: string;
  enumValues: string[] | null;
};

export type ParamException = {
  type: 'unknown_key' | 'value_mismatch' | 'value_invalid' | 'value_discarded';
  paramKey: string;
  rawValue: string;
  reason: string;
};

export type SeatChange = { key: string; from: string; to: string };

const BOOL_YES = new Set(['是', '有', '支持', 'true', 'yes', '1', 'y']);
const BOOL_NO = new Set(['否', '无', '不支持', 'false', 'no', '0', 'n']);

const CN_NUM: Record<string, string> = {
  一: '1', 二: '2', 两: '2', 三: '3', 四: '4',
  五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
};

/** 生成匹数候选（同时覆盖 P / 匹，方向由枚举决定） */
function horsepowerCandidates(raw: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
  };

  add(raw);
  let v = raw.trim().replace(/\s+/g, '');
  v = v.replace(/匹P+/gi, '匹');
  add(v);
  const stripped = v.replace(/^(超|正|约|近)/, '');
  if (stripped !== v) add(stripped);
  v = stripped;

  const m = v.match(/^([大小]?)(\d+(?:\.\d+)?)(?:P+|匹)$/i)
    || v.match(/^([大小]?)([一二三四五六七八九十两])匹$/);
  if (m) {
    let prefix = m[1] || '';
    let num = m[2];
    if (CN_NUM[num]) num = CN_NUM[num];
    num = num.replace(/\.0$/, '');
    add(`${prefix}${num}P`);
    add(`${prefix}${num}匹`);
    add(`${prefix}${num}.0P`);
    add(`${prefix}${num}.0匹`);
  }

  const cn = v.match(/^([大小]?)([一二三四五六七八九十两])匹$/);
  if (cn && CN_NUM[cn[2]]) {
    add(`${cn[1]}${CN_NUM[cn[2]]}P`);
    add(`${cn[1]}${CN_NUM[cn[2]]}匹`);
  }

  return [...out];
}

/** 能效候选 */
function energyCandidates(raw: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
  };
  add(raw);
  let v = raw.replace(/\s+/g, '');
  add(v);
  v = v.replace(/能效等级$/g, '').replace(/能效$/g, '');
  v = v.replace(/^新/, '').replace(/^超/, '');
  add(v);
  return [...out];
}

function coolHeatCandidates(raw: string): string[] {
  const v = raw.trim();
  const out = new Set<string>([v]);
  if (/冷暖电辅/.test(v)) out.add('电辅热');
  if (/冷暖/.test(v)) out.add('冷暖');
  if (/单冷/.test(v)) out.add('单冷');
  if (/单热/.test(v)) out.add('单热');
  return [...out];
}

function acTypeCandidates(raw: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
  };
  add(raw);
  let v = raw.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  add(v);
  if (/圆柱/.test(raw)) add('立柜式');
  if (/立柜式空调/.test(v)) add('立柜式');
  if (/壁挂式|分体挂壁|挂壁式/.test(v) || /分体挂壁/.test(raw)) {
    add('壁挂式空调');
  }
  if (/风管/.test(v) || /风管/.test(raw)) add('中央空调');
  if (/吸顶/.test(v) || /吸顶/.test(raw)) add('嵌入式空调');
  if (/工业/.test(v) || /工业/.test(raw)) add('工业空调');
  return [...out];
}

/** 明确丢弃的营销/脏值（不入库、不记 open 例外） */
function shouldDiscardValue(paramKey: string, raw: string): boolean {
  const v = raw.trim();
  if (paramKey === '空调类型') {
    return v === '智能空调' || v === '精密空调';
  }
  if (paramKey === '应用场景') {
    return /场景/.test(v) && (v.includes('，') || v.includes(','));
  }
  if (paramKey === '能效等级') {
    return v === '无' || v === '无能效' || v === '无能效等级' || /^\d+(\.\d+)?$/.test(v);
  }
  return false;
}

/** 精确或保守包含匹配到枚举 */
export function snapToEnum(
  candidates: string[],
  enumValues: string[] | null | undefined
): string | null {
  if (!enumValues?.length) return null;

  for (const c of candidates) {
    const exact = enumValues.find((o) => o === c);
    if (exact) return exact;
  }

  const sorted = [...enumValues].sort((a, b) => a.length - b.length);
  for (const c of candidates) {
    const hit = sorted.find((o) => c.includes(o) || o.includes(c));
    if (hit) return hit;
  }
  return null;
}

function seatBoolean(raw: string): { value: string; ok: boolean } {
  const v = String(raw).trim();
  if (!v) return { value: '', ok: false };

  const lower = v.toLowerCase();
  if (BOOL_YES.has(v) || BOOL_YES.has(lower)) return { value: '是', ok: true };
  if (BOOL_NO.has(v) || BOOL_NO.has(lower)) return { value: '否', ok: true };
  if (/^不支持/.test(v) || /不支持$/.test(v)) return { value: '否', ok: true };
  if (/支持|自动清洁|自清洁|自清洗|净菌|APP/i.test(v)) return { value: '是', ok: true };

  if (/\d/.test(v) && /W/i.test(v)) return { value: '是', ok: true };

  return { value: '', ok: false };
}

/**
 * 单个字段按需入座
 * - enum/boolean：必须对上座位才写入
 * - text/number/date：原样写入（不做枚举约束）
 */
export function seatParamValue(
  paramKey: string,
  raw: string,
  def?: ParamDefMeta
): { value: string; exception?: ParamException; discarded?: boolean } {
  if (!raw?.trim()) {
    return { value: '' };
  }
  const type = def?.paramType || 'text';
  const rawTrim = String(raw).trim();

  if (shouldDiscardValue(paramKey, rawTrim)) {
    return { value: '', discarded: true };
  }

  if (type === 'boolean') {
    if (paramKey === '独立除湿' && /\d/.test(rawTrim) && /L\s*\/?\s*h/i.test(rawTrim)) {
      return { value: '是' };
    }
    const r = seatBoolean(rawTrim);
    if (r.ok) return { value: r.value };
    return {
      value: '',
      exception: {
        type: 'value_mismatch',
        paramKey,
        rawValue: rawTrim,
        reason: `布尔字段无法入座（仅接受是/否及等价说法），原值保留待人工处理`,
      },
    };
  }

  if (type === 'enum' && def?.enumValues?.length) {
    let candidates: string[];
    if (paramKey === '空调匹数') candidates = horsepowerCandidates(rawTrim);
    else if (paramKey === '能效等级') candidates = energyCandidates(rawTrim);
    else if (paramKey === '冷暖类型') candidates = coolHeatCandidates(rawTrim);
    else if (paramKey === '空调类型') candidates = acTypeCandidates(rawTrim);
    else if (paramKey === '应用场景') {
      candidates = [rawTrim];
      if (rawTrim === '办公') candidates.push('办公', '商用');
    } else candidates = [rawTrim, ...energyCandidates(rawTrim)];

    const seated = snapToEnum(candidates, def.enumValues);
    if (seated) return { value: seated };

    return {
      value: '',
      exception: {
        type: 'value_mismatch',
        paramKey,
        rawValue: rawTrim,
        reason: `无法入座到枚举 [${def.enumValues.slice(0, 8).join('/')}${def.enumValues.length > 8 ? '/…' : ''}]`,
      },
    };
  }

  return { value: rawTrim };
}

/**
 * 批量入座；返回可入库 params + 例外列表
 */
export function seatParams(
  params: Record<string, string>,
  defs: Map<string, ParamDefMeta>
): {
  params: Record<string, string>;
  changed: boolean;
  changes: SeatChange[];
  exceptions: ParamException[];
} {
  const result: Record<string, string> = {};
  const changes: SeatChange[] = [];
  const exceptions: ParamException[] = [];

  const working: Record<string, string> = { ...params };
  if (working['电辅加热'] && /\d/.test(working['电辅加热']) && /W/i.test(working['电辅加热'])) {
    const watt = working['电辅加热'].trim();
    if (!working['电辅加热功率']) {
      working['电辅加热功率'] = watt;
      changes.push({ key: '电辅加热功率', from: '(空)', to: watt });
    }
    working['电辅加热'] = '是';
    changes.push({ key: '电辅加热', from: params['电辅加热'], to: '是' });
  }

  if (working['独立除湿'] && /\d/.test(working['独立除湿']) && /L\s*\/?\s*h/i.test(working['独立除湿'])) {
    const rate = working['独立除湿'].trim();
    if (!working['除湿量']) {
      working['除湿量'] = rate;
      changes.push({ key: '除湿量', from: '(空)', to: rate });
    }
    working['独立除湿'] = '是';
    changes.push({ key: '独立除湿', from: params['独立除湿'], to: '是' });
  }

  for (const [key, value] of Object.entries(working)) {
    const { value: next, exception, discarded } = seatParamValue(key, value, defs.get(key));
    if (discarded) {
      exceptions.push({
        type: 'value_discarded',
        paramKey: key,
        rawValue: value,
        reason: '规则明确丢弃（营销/脏值），不入库；已留审计',
      });
      if (value) changes.push({ key, from: value, to: '(丢弃)' });
      continue;
    }
    if (exception) {
      exceptions.push(exception);
      continue;
    }
    if (next) {
      result[key] = next;
      if (next !== value) {
        changes.push({ key, from: value, to: next });
      }
    }
  }

  if (result['电辅加热功率'] && !result['电辅加热'] && !exceptions.some((e) => e.paramKey === '电辅加热')) {
    result['电辅加热'] = '是';
    changes.push({ key: '电辅加热', from: '(空)', to: '是' });
  }

  return {
    params: result,
    changed: changes.length > 0,
    changes,
    exceptions,
  };
}
