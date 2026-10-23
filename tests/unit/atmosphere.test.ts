import { describe, expect, it } from 'vitest';
import { parseAtmosphere } from '../../src/ui/Atmosphere';

describe('настройка атмосферных эффектов', () => {
  it('по умолчанию эффекты включены', () => {
    expect(parseAtmosphere(null)).toBe(true);
  });

  it('сохранённое выключение читается', () => {
    expect(parseAtmosphere('{"enabled":false}')).toBe(false);
    expect(parseAtmosphere('{"enabled":true}')).toBe(true);
  });

  it('повреждённая запись не выключает эффекты', () => {
    expect(parseAtmosphere('{не json')).toBe(true);
    expect(parseAtmosphere('"off"')).toBe(true);
    expect(parseAtmosphere('null')).toBe(true);
    expect(parseAtmosphere('{"enabled":"нет"}')).toBe(true);
  });
});
