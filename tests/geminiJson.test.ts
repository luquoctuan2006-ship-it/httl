import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGeminiJson } from '../src/utils/geminiJson';

test('parses a valid JSON response wrapped in code fences', () => {
  const result = parseGeminiJson('```json\n{"tripCode":"DAD-HA-HUI-7D","title":"Hành trình"}\n```');

  assert.deepEqual(result, {
    tripCode: 'DAD-HA-HUI-7D',
    title: 'Hành trình',
  });
});

test('recovers unquoted property names emitted by Gemini', () => {
  const response = `
    Dưới đây là kết quả:
    {"tripCode":"DAD-HA-HUI-7D","budget":{"total":48000000,"breakdown":{"transportation":8500000,foodAndBeverage:12000000}}}
  `;

  const parsed = parseGeminiJson(response) as any;
  assert.equal(parsed.budget.breakdown.foodAndBeverage, 12000000);
});

test('ignores trailing prose after the JSON object', () => {
  const result = parseGeminiJson('{"tripCode":"DAD-HA-HUI-7D"}\nLý do: chưa hoàn tất') as any;

  assert.equal(result.tripCode, 'DAD-HA-HUI-7D');
});

test('rejects a response without a JSON object', () => {
  assert.throws(
    () => parseGeminiJson('Gemini chưa trả về dữ liệu JSON'),
    /không chứa một đối tượng JSON hợp lệ/i,
  );
});
