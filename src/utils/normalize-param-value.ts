/**
 * 将爬虫原始参数值归一化为系统规范格式
 * （对齐管理后台 products.ts 中的 normalizeValue，并补充枚举吸附 / 布尔归一）
 */

export type ParamDefMeta = {
  paramType: string;
  enumValues: string[] | null;
};

const BOOL_YES = new Set(['是', '有', '支持', 'true', 'yes', '1', 'y']);
const BOOL_NO = new Set(['否', '无', '不支持', 'false', 'no', '0', 'n']);

/** 中文数字 → 阿拉伯数字（用于「大一匹」等） */
const CN_NUM: Record<string, string> = {
  一: '1',
  二: '2',
  两: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
  十: '10',
};

/** 通用字符串清洗（匹数单位、能效前后缀等） */
export function normalizeValue(raw: string): string {
  if (!raw) return '';
  let v = String(raw).trim();

  // 脏数据: 1匹P / 1.5匹P → 1匹 / 1.5匹
  v = v.replace(/匹P+\b/gi, '匹');
  // 1.5P / 1.5PP / 大1.0P → 1.5匹 / 大1.0匹
  v = v.replace(/(\d+(?:\.\d+)?)P+/gi, '$1匹');
  // 大一匹 / 小二匹 → 大1匹 / 小2匹
  v = v.replace(/([大小]?)([一二三四五六七八九十两])匹/g, (_, prefix: string, cn: string) => {
    const n = CN_NUM[cn];
    return n ? `${prefix}${n}匹` : `${prefix}${cn}匹`;
  });
  // 大1.0匹 → 大1匹
  v = v.replace(/(\d+)\.0(?=匹)/g, '$1');

  // 能效: 新一级能效 / 一级能效 → 一级
  v = v.replace(/\s+/g, '');
  v = v.replace(/能效等级$/g, '').replace(/能效$/g, '');
  v = v.replace(/^新/, '');
  v = v.replace(/^超/, '');

  return v.trim();
}

/** 布尔值 → 是/否；无法判断则返回清洗后的原值 */
export function normalizeBooleanValue(raw: string): string {
  const v = String(raw).trim();
  if (!v) return '';

  const lower = v.toLowerCase();
  if (BOOL_YES.has(v) || BOOL_YES.has(lower)) return '是';
  if (BOOL_NO.has(v) || BOOL_NO.has(lower)) return '否';

  // 不支持自动清洁 / 不支持xxx
  if (/^不支持/.test(v) || /不支持$/.test(v)) return '否';
  if (/支持|自动清洁|自清洁|自清洗|净菌|APP/i.test(v)) return '是';

  return v;
}

/** 冷暖类型常见别名 */
function normalizeCoolHeat(raw: string): string {
  const v = String(raw).trim();
  if (/冷暖电辅/.test(v)) return '电辅热';
  if (/冷暖/.test(v)) return '冷暖';
  if (/单冷/.test(v)) return '单冷';
  if (/单热/.test(v)) return '单热';
  return normalizeValue(v);
}

/** 空调类型：去掉括号说明后吸附枚举 */
function normalizeAcType(raw: string, enumValues: string[] | null): string {
  let v = String(raw).trim();
  // 立柜式（圆柱式设计） → 立柜式
  v = v.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  if (/圆柱/.test(raw) && !/立柜/.test(v)) v = '立柜式';
  if (/立柜式空调/.test(v)) v = '立柜式';
  if (/壁挂式空调/.test(v)) v = '壁挂式空调';
  return snapToEnum(v, enumValues) || v;
}

/** 将值吸附到枚举列表；失败返回 null */
export function snapToEnum(value: string, enumValues: string[] | null | undefined): string | null {
  if (!value || !enumValues?.length) return null;
  const exact = enumValues.find((o) => o === value);
  if (exact) return exact;

  // 包含关系（较短优先，避免误吸到更长项）
  const byInclude = [...enumValues]
    .sort((a, b) => a.length - b.length)
    .find((o) => value.includes(o) || o.includes(value));
  if (byInclude) return byInclude;

  const normalized = normalizeValue(value);
  if (normalized && normalized !== value) {
    const again = enumValues.find(
      (o) => o === normalized || normalized.includes(o) || o.includes(normalized)
    );
    if (again) return again;
  }
  return null;
}

/**
 * 按参数定义归一化单个值
 */
export function normalizeParamValue(
  paramKey: string,
  raw: string,
  def?: ParamDefMeta
): string {
  if (!raw) return '';
  const type = def?.paramType || 'text';

  if (type === 'boolean') {
    return normalizeBooleanValue(raw);
  }

  if (paramKey === '冷暖类型') {
    const v = normalizeCoolHeat(raw);
    return snapToEnum(v, def?.enumValues) || v;
  }

  if (paramKey === '空调类型') {
    return normalizeAcType(raw, def?.enumValues ?? null);
  }

  // 仅枚举 / 已知需清洗的 key 做通用归一；普通 text 保持原样
  const needsGeneralNormalize =
    type === 'enum' || paramKey === '空调匹数' || paramKey === '能效等级';

  if (!needsGeneralNormalize) {
    return String(raw).trim();
  }

  // 能效脏数据：无等级 / 误填成能效比数字 → 清空（不入库）
  if (paramKey === '能效等级') {
    const t = String(raw).trim();
    if (!t || t === '无' || t === '无能效' || t === '无能效等级') return '';
    if (/^\d+(\.\d+)?$/.test(t)) return '';
  }

  let v = normalizeValue(raw);
  if (type === 'enum' && def?.enumValues?.length) {
    const snapped = snapToEnum(v, def.enumValues) || snapToEnum(raw, def.enumValues);
    if (snapped) return snapped;
  }
  return v;
}

/**
 * 批量归一化 params 对象
 * @returns changed 是否有字段被改写
 */
export function normalizeParams(
  params: Record<string, string>,
  defs: Map<string, ParamDefMeta>
): { params: Record<string, string>; changed: boolean; changes: Array<{ key: string; from: string; to: string }> } {
  const result: Record<string, string> = {};
  const changes: Array<{ key: string; from: string; to: string }> = [];

  for (const [key, value] of Object.entries(params)) {
    // 电辅加热误填成功率（如 2100W）→ 挪到电辅加热功率，布尔记为「是」
    if (key === '电辅加热' && /\d/.test(value) && /W/i.test(value)) {
      if (!params['电辅加热功率'] && !result['电辅加热功率']) {
        result['电辅加热功率'] = value.trim();
        changes.push({ key: '电辅加热功率', from: '(空)', to: value.trim() });
      }
      result['电辅加热'] = '是';
      if (value !== '是') {
        changes.push({ key: '电辅加热', from: value, to: '是' });
      }
      continue;
    }

    const next = normalizeParamValue(key, value, defs.get(key));
    // 空值不保留（脏数据清空后从 params 移除）
    if (next) {
      result[key] = next;
    }
    if (next !== value) {
      changes.push({ key, from: value, to: next || '(清空)' });
    }
  }

  // 有电辅加热功率、无布尔字段 → 推断为「是」
  if (result['电辅加热功率'] && !result['电辅加热']) {
    result['电辅加热'] = '是';
    changes.push({ key: '电辅加热', from: '(空)', to: '是' });
  }

  return { params: result, changed: changes.length > 0, changes };
}
