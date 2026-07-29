/**
 * 后台新增/编辑产品时的参数值合法性校验
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

/** 计量类 text：功率/电流/尺寸/噪音等 */
const MEASURE_KEY_RE = /功率|电流|制冷量|制热量|循环风量|新风量|除湿量|尺寸|噪音|噪声|风量|面积|电压|频率|电源|能效比|质量|重量|耗电|水压|扬程|转速|压力/;

/** 型号/编码/冷媒代号类：偏字母数字 */
const MODEL_KEY_RE = /型号|货号|编码|SKU|sku|制冷剂/;

/** 系列名称：常含英文系列名，单独规则，勿与「中文描述」混用 */
const SERIES_KEY_RE = /系列/;

/** 质保/保修：常见「3年」「365天」「整机6年…」，勿当纯中文描述拦数字 */
const WARRANTY_KEY_RE = /质保|保修/;

/** 中文描述类（不含系列、质保） */
const CN_DESC_KEY_RE = /扫风|睡眠|方式|功能|材质|颜色|场景|特点|模式|清洁|换气|显示|控制|安装|外观|内胆|门体|面板|性能|配件/;

/**
 * 允许的计量单位（含复合单位归一后的别名）
 * m³h = m³/h；rpm 可来自 r/min
 */
const MEASURE_UNIT = 'kWh|kW|Wh|Hz|mm|cm|m³h|m3h|m³|m3|m²|㎡|dB|db|℃|°C|kg|g|mLh|mL|ml|Lh|L|rpm|Pa|bar|lx|%|匹|级|[WAV]|m';

/**
 * 单段计量：
 * - 普通：1000W、60dB、18kg
 * - 尺寸连写：宽800高290深190mm
 * - 可选前缀后可跟冒号：宽：800
 * 禁止 1000W123 这种单位后再贴数字
 */
const MEASURE_SEG_RE = new RegExp(
  `^(?:(?:宽|高|深|厚|长|直径|内|外|室|机)?\\s*[:：]?\\s*-?\\d+(?:\\.\\d+)?\\s*)+(?:\\(\\s*[A-Za-z]\\s*\\))?\\s*(?:${MEASURE_UNIT})?$`,
  'i'
);

/** 复合单位：拆分前先归一，避免 m³/h、r/min 被 / 拆成无数字孤段 */
function normalizeCompoundUnits(value: string): string {
  return value
    .replace(/m[³3]\s*[/／]\s*h/gi, 'm³h')
    .replace(/r\s*[/／]\s*min/gi, 'rpm')
    .replace(/mL\s*[/／]\s*h/gi, 'mLh')
    .replace(/L\s*[/／]\s*h/gi, 'Lh');
}

/**
 * 乱码英数：小写字母坨 + 数字，如 sfssfd1
 * 不拦正常英文词 Comfort、型号段 KFR-35
 */
function hasGarbledAlnum(value: string): boolean {
  return /[a-z]{4,}\d|\d[a-z]{4,}/.test(value);
}

/** 质保类：允许 365天 / 6年 / 整机6年，压缩机…，只拦明显乱码 */
function isValidWarrantyValue(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (
    !/^[\u4e00-\u9fffA-Za-z0-9\s\-–—，,、；;：:（）()及与和\/＋+.~～到至]+$/.test(t)
  ) {
    return false;
  }
  if (hasGarbledAlnum(t)) return false;
  return true;
}

/** 描述类字段中的无意义数字尾巴/夹杂（如 白色123123、遥控3213123）
 * 允许 PM2.5、WiFi 等，小数最多两位，更长小数尾巴视为乱输
 */
function hasDescDigitJunk(value: string): boolean {
  const withoutShortDecimals = value.replace(/\d+\.\d{1,2}(?!\d)/g, '');
  if (/\d{3,}/.test(withoutShortDecimals)) return true;
  if (/[\u4e00-\u9fff].*\d{2,}$/.test(withoutShortDecimals)) return true;
  if (/[\u4e00-\u9fff][a-z0-9]{3,}/.test(withoutShortDecimals)) return true;
  if (/\d+\.\d{3,}/.test(value)) return true;
  return false;
}

/**
 * 独立计量片段（如 1000W、380V），不匹配型号里的 3A / URHE3A
 * —— 单位前的数字须落在非字母数字边界上，单位后也不能紧跟字母数字
 */
function hasMeasureSnippet(value: string): boolean {
  return (
    /(?:^|[^A-Za-z0-9])\d+\s*(?:kWh|kW|Wh|Hz|mm|W|A|V|安|伏|瓦)(?![A-Za-z0-9])/i.test(
      value
    ) ||
    /(?:^|[^A-Za-z0-9])(?:kWh|kW|Wh|Hz|W|A|V|安|伏|瓦)\s*\d+(?![A-Za-z0-9])/i.test(
      value
    )
  );
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

/** 计量值：按 ;，/ ~ 等拆段，每段必须是「数字(+单位)」 */
export function isValidMeasureValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = normalizeCompoundUnits(trimmed);
  if (
    !/^[\d.\s\-–—*×xX/／~～+±()（）[\]【】,，;；:：°℃%WAakKvVmMhHzdbDBgGlLPxrpm³2²㎡匹级宽高深厚长直径内外室机]+$/iu.test(
      normalized
    )
  ) {
    return false;
  }
  const parts = normalized
    .split(/[,，;；/／~～\-–—+*×xX]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return false;
  return parts.every((p) => MEASURE_SEG_RE.test(p));
}

/**
 * 校验单个参数值；空值视为未填，通过
 */
export function validateAdminParamValue(
  def: AdminParamDef,
  raw: string
): ParamValidationError | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const haystack = `${def.paramKey} ${def.displayName || ''}`;
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

  if (MEASURE_KEY_RE.test(haystack)) {
    if (!isValidMeasureValue(value)) {
      return err(def, value, '应为计量值（如 1000W、60dB），不能夹杂无关文字或多余数字');
    }
    return null;
  }

  if (MODEL_KEY_RE.test(haystack)) {
    if (hasGarbledAlnum(value) && /[\u4e00-\u9fff]/.test(value)) {
      return err(def, value, '格式不正确（疑似乱码）');
    }
    if (!/^[\u4e00-\u9fffA-Za-z0-9\-_./+\s()（）]+$/.test(value)) {
      return err(def, value, '只能包含字母、数字、常见符号或中文');
    }
    return null;
  }

  if (SERIES_KEY_RE.test(haystack)) {
    if (!/^[\u4e00-\u9fffA-Za-z0-9\-_./+\s()（）·&]+$/.test(value)) {
      return err(def, value, '含非法字符');
    }
    if (hasGarbledAlnum(value)) {
      return err(def, value, '疑似乱码英文/数字，请改正');
    }
    return null;
  }

  if (WARRANTY_KEY_RE.test(haystack)) {
    if (!isValidWarrantyValue(value)) {
      return err(def, value, '质保说明格式不正确');
    }
    return null;
  }

  if (CN_DESC_KEY_RE.test(haystack)) {
    if (hasGarbledAlnum(value) || hasDescDigitJunk(value)) {
      return err(def, value, '请填写中文说明，不要夹杂无关数字或乱码');
    }
    if (hasMeasureSnippet(value)) {
      return err(def, value, '不应包含功率/电压等计量写法');
    }
    if (/[a-zA-Z]/.test(value) && !/[\u4e00-\u9fff]/.test(value)) {
      return err(def, value, '应以中文描述为主');
    }
    return null;
  }

  if (hasGarbledAlnum(value) && chineseRatio(value) > 0.3) {
    return err(def, value, '中英文混杂异常，请去掉乱码');
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
