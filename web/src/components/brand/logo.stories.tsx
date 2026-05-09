import { Logo } from './logo';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Logo> = {
  title: 'Foundations/Logo',
  component: Logo,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const MarkOnly: Story = {
  args: { size: 'lg' },
};

export const Lockup: Story = {
  args: { size: 'lg', wordmark: 'auto' },
};

/**
 * Optical balance test — render the lockup at every size + both directions.
 * Use the locale toolbar in Storybook to flip; no asymmetry should appear.
 */
export const OpticalBalance: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div
          key={size}
          className="bg-bg-elevated text-fg-subtle border-border flex items-center gap-8 rounded-xl border p-6"
        >
          <span className="text-xs uppercase tracking-wide">{size}</span>
          <Logo size={size} />
          <Logo size={size} wordmark="auto" />
        </div>
      ))}
    </div>
  ),
};
