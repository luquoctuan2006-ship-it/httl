const IDENTIFIER_KEY = /[A-Za-z_$][\w$]*/;

function findJsonValue(text: string): string | undefined {
  let start: number | undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{' || character === '[') {
      if (start === undefined) start = index;
      depth += 1;
      continue;
    }

    if (character === '}' || character === ']') {
      if (start === undefined) continue;
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return undefined;
}

function quoteUnquotedKeys(json: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];

    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    const match = json.slice(index).match(IDENTIFIER_KEY);
    if (match && match.index === 0) {
      const key = match[0];
      const afterKey = json.slice(index + key.length);
      if (/^\s*:/.test(afterKey)) {
        result += `"${key}"`;
        index += key.length - 1;
        continue;
      }
    }

    result += character;
  }

  return result;
}

export function parseGeminiJson(text: string): unknown {
  const normalizedText = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const jsonValue = findJsonValue(normalizedText);

  if (!jsonValue) {
    throw new Error('Gemini không chứa một đối tượng JSON hợp lệ trong phản hồi.');
  }

  const repairedJson = quoteUnquotedKeys(jsonValue);

  try {
    return JSON.parse(repairedJson);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Không thể phân tích JSON';
    throw new Error(`Gemini trả về JSON không hợp lệ: ${detail}. Nội dung phản hồi: ${repairedJson.slice(0, 500)}`);
  }
}
