import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InteractPrompt } from './InteractPrompt';

beforeEach(() => cleanup());

describe('InteractPrompt', () => {
  it('shows a circled E and the words Press E to interact', () => {
    render(<InteractPrompt target="ipod" onActivate={vi.fn()} />);
    expect(screen.getByText('E')).toBeTruthy();
    expect(screen.getByText('Press E to interact')).toBeTruthy();
  });

  it('has an accessible name that says which object it is for', () => {
    render(
      <>
        <InteractPrompt target="ipod" onActivate={vi.fn()} />
        <InteractPrompt target="computer" onActivate={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'iPod: press E to interact', hidden: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Computer: press E to interact', hidden: true })).toBeTruthy();
  });

  it('starts hidden and calls onActivate when clicked', () => {
    const onActivate = vi.fn();
    render(<InteractPrompt target="computer" onActivate={onActivate} />);
    const b = screen.getByRole('button', { hidden: true });
    expect(b.getAttribute('data-visible')).toBe('false');
    fireEvent.click(b);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('exposes its button through ref so the room can position it', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<InteractPrompt target="ipod" onActivate={vi.fn()} ref={ref} />);
    expect(ref.current?.dataset.prompt).toBe('ipod');
  });
});
