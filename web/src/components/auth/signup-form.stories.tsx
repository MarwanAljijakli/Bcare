import { SignupForm } from './signup-form';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * The full signup form. Stories use the dev-mock backend for the submit
 * paths; the form itself drives the visual states the user requested.
 *
 * Six states described in the Module 2.A spec:
 *   1. Empty
 *   2. Filled-valid (interactive — fill it in)
 *   3. Filled-invalid (interactive — submit empty fields)
 *   4. Submitting (interactive — actual submit triggers the loading state)
 *   5. Success magic link (interactive — submit a clean form)
 *   6. Error rate-limited (interactive — submit "rate@example.com" in mock mode)
 */
const meta: Meta<typeof SignupForm> = {
  title: 'Auth/SignupForm',
  component: SignupForm,
  parameters: { layout: 'padded' },
  args: {
    consentVersion: '2026-05-09.1',
    consentTextHash: 'a'.repeat(64),
  },
};
export default meta;
type Story = StoryObj<typeof SignupForm>;

export const Empty: Story = {
  render: (args) => (
    <div className="mx-auto max-w-[480px]">
      <SignupForm {...args} />
    </div>
  ),
};

export const InteractiveDemo: Story = {
  name: 'Interactive (try mock triggers)',
  render: (args) => (
    <div className="mx-auto max-w-[480px]">
      <p className="text-fg-muted mb-4 text-xs">
        Try emails containing <code>exists</code>, <code>rate</code>, or <code>boom</code> to
        exercise the corresponding error path. Anything else hits the success state after ~800 ms
        (dev mock backend).
      </p>
      <SignupForm {...args} />
    </div>
  ),
};
