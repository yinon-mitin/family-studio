import { describe, expect, it } from 'vitest';
import { shortcutOf } from '../src/tools/my-family/shortcuts.ts';

const press = (key: string, code: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = { ctrlKey: true }) =>
  shortcutOf({ key, code, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('my-family shortcuts: undo and redo on any layout', () => {
  it('QWERTY', () => {
    expect(press('z', 'KeyZ')).toBe('undo');
    expect(press('Z', 'KeyZ', { ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(press('y', 'KeyY')).toBe('redo');
  });

  it('Mac: the Meta key works like Ctrl', () => {
    expect(press('z', 'KeyZ', { metaKey: true })).toBe('undo');
    expect(press('z', 'KeyZ', { metaKey: true, shiftKey: true })).toBe('redo');
  });

  it('Russian: the letter is Cyrillic, the physical key decides', () => {
    expect(press('я', 'KeyZ')).toBe('undo');
    expect(press('н', 'KeyY')).toBe('redo');
    expect(press('Я', 'KeyZ', { ctrlKey: true, shiftKey: true })).toBe('redo');
  });

  it('QWERTZ: the typed letter wins over the physical key', () => {
    expect(press('y', 'KeyZ')).toBe('redo'); // Ctrl+Y sits on the Z key
    expect(press('z', 'KeyY')).toBe('undo');
  });

  it('AZERTY: Ctrl+W (on the Z key) is left to the browser', () => {
    expect(press('w', 'KeyZ')).toBeNull();
  });

  it('Dvorak: other letters and punctuation on those keys are left alone', () => {
    expect(press('f', 'KeyY')).toBeNull(); // Ctrl+F, browser Find
    expect(press(';', 'KeyZ')).toBeNull();
    expect(press('z', 'Semicolon')).toBe('undo'); // the typed Latin z still counts
  });

  it('needs Ctrl or Meta', () => {
    expect(press('z', 'KeyZ', {})).toBeNull();
    expect(press('z', 'KeyZ', { shiftKey: true })).toBeNull();
  });

  it('other keys give nothing', () => {
    expect(press('1', 'Digit1')).toBeNull();
    expect(press('Delete', 'Delete')).toBeNull();
    expect(press('Dead', 'KeyZ')).toBeNull();
  });
});
