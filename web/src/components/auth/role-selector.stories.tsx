import { useState } from 'react';
import { RoleSelector } from './role-selector';
import type { SignupRole } from '@/lib/auth/zod';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof RoleSelector> = {
  title: 'Auth/RoleSelector',
  component: RoleSelector,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof RoleSelector>;

function Wrapper(args: Partial<React.ComponentProps<typeof RoleSelector>>) {
  const [value, setValue] = useState<SignupRole | undefined>(args.value);
  return <RoleSelector {...args} value={value} onChange={setValue} />;
}

export const Empty: Story = { render: (args) => <Wrapper {...args} /> };
export const FamilySelected: Story = {
  render: (args) => <Wrapper {...args} value="family" />,
};
export const TherapistSelected: Story = {
  render: (args) => <Wrapper {...args} value="therapist" />,
};
export const SchoolSelected: Story = {
  render: (args) => <Wrapper {...args} value="school" />,
};
export const Invalid: Story = {
  render: (args) => <Wrapper {...args} invalid />,
};
export const Disabled: Story = {
  render: (args) => <Wrapper {...args} disabled />,
};
