import { describe, expect, it } from 'vitest';
import { measureScrollEdges } from '../../src/ui/scrollEdges';

describe('measureScrollEdges', () => {
  it('содержимое помещается — продолжения нет', () => {
    expect(measureScrollEdges({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 })).toEqual({
      moreAbove: false,
      moreBelow: false,
    });
  });

  it('в начале длинной страницы продолжение только ниже', () => {
    expect(measureScrollEdges({ scrollTop: 0, scrollHeight: 488, clientHeight: 366 })).toEqual({
      moreAbove: false,
      moreBelow: true,
    });
  });

  it('в середине продолжение с обеих сторон', () => {
    expect(measureScrollEdges({ scrollTop: 60, scrollHeight: 488, clientHeight: 366 })).toEqual({
      moreAbove: true,
      moreBelow: true,
    });
  });

  it('в конце продолжение только выше', () => {
    expect(measureScrollEdges({ scrollTop: 122, scrollHeight: 488, clientHeight: 366 })).toEqual({
      moreAbove: true,
      moreBelow: false,
    });
  });

  it('дробные пиксели не считаются продолжением', () => {
    expect(measureScrollEdges({ scrollTop: 1.5, scrollHeight: 501.5, clientHeight: 500 })).toEqual({
      moreAbove: false,
      moreBelow: false,
    });
  });
});
