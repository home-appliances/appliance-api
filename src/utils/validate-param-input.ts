/**
 * 后台新增/编辑产品参数校验
 * - 硬拦截：enum / boolean / number / date
 * - text：仅拦明显乱码
 */

export type AdminParamDef = {
  paramKey: string;
  paramType: string;
  enumValues?: string[] | null;
  displayName?: string;
};

export type ParamValidationError = {
  paramKey: string;
  displayName: string;
  value: string;
  message: string;
};

/** 如 sfssfd1；不拦 Comfort、KFR-35 */
function hasGarbledAlnum(value: string): boolean {
  return /[a-z]{4,}\d|\d[a-z]{4,}/.test(value);
}

function chineseRatio(value: string): number {
  const chars = [...value.replace(/\s/g, '')];
  if (!chars.length) return 0;
  const cn = chars.filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
  return cn / chars.length;
}

function labelOf(def: AdminParamDef): string {
  return def.displayName || def.paramKey;
}

function err(
  def: AdminParamDef,
  value: string,
  reason: string
): ParamValidationError {
  const name = labelOf(def);
  const shown = value.length > 40 ? `${value.slice(0, 40)}…` : value;
  return {
    paramKey: def.paramKey,
    displayName: name,
    value,
    message: `「${name}」当前值「${shown}」${reason}`,
  };
}

/** 空值视为未填，通过 */
export function validateAdminParamValue(
  def: AdminParamDef,
  raw: string
): ParamValidationError | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const type = (def.paramType || 'text').toLowerCase();

  if (type === 'enum') {
    const opts = Array.isArray(def.enumValues) ? def.enumValues.map(String) : [];
    if (opts.length && !opts.includes(value)) {
      return err(def, value, '不在规范枚举选项中');
    }
    return null;
  }

  if (type === 'boolean') {
    if (!['是', '否'].includes(value)) {
      return err(def, value, '只能选「是」或「否」');
    }
    return null;
  }

  if (type === 'number') {
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      return err(def, value, '只能填写纯数字');
    }
    return null;
  }

  if (type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && !/^\d{4}-\d{2}$/.test(value)) {
      return err(def, value, '请使用日期格式 YYYY-MM-DD');
    }
    return null;
  }

  if (hasGarbledAlnum(value) && chineseRatio(value) > 0.3) {
    return err(def, value, '疑似乱码，请改正后再保存');
  }
  if (hasGarbledAlnum(value) && !/[A-Z]/.test(value) && !/[\u4e00-\u9fff]/.test(value)) {
    return err(def, value, '疑似乱码，请改正后再保存');
  }

  return null;
}

export function validateAdminParams(
  defs: AdminParamDef[],
  params: Record<string, string>
): ParamValidationError[] {
  const errors: ParamValidationError[] = [];
  const byKey = new Map(defs.map((d) => [d.paramKey, d]));

  for (const [key, value] of Object.entries(params)) {
    const def = byKey.get(key) || {
      paramKey: key,
      paramType: 'text',
      displayName: key,
    };
    const errItem = validateAdminParamValue(def, value);
    if (errItem) errors.push(errItem);
  }
  return errors;
}
