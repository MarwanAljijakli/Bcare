import { useState } from 'react';
import { PasswordInput } from './password-input';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof PasswordInput> = {
  title: 'Auth/PasswordInput',
  component: PasswordInput,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof PasswordInput>;

function Wrapper(args: Partial<React.ComponentProps<typeof PasswordInput>>) {
  const [value, setValue] = useState(args.value ?? '');
  return (
    <div className="w-[420px]">
      <PasswordInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}

export const Empty: Story = { render: (a) => <Wrapper {...a} /> };
export const Weak: Story = { render: (a) => <Wrapper {...a} showStrength value="hello" /> };
export const Okay: Story = { render: (a) => <Wrapper {...a} showStrength value="password1234" /> };
export const Strong: Story = {
  render: (a) => <Wrapper {...a} showStrength value="strong-pass-2026" />,
};
export const Excellent: Story = {
  render: (a) => <Wrapper {...a} showStrength value="exc3llent-pass-w0rd-2026!" />,
};
export const WithError: Story = {
  render: (a) => (
    <Wrapper {...a} showStrength value="short" error="Password must be at least 12 characters." />
  ),
};
