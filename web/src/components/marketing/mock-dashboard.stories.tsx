import { MockDashboard } from './mock-dashboard';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof MockDashboard> = {
  title: 'Marketing/MockDashboard',
  component: MockDashboard,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof MockDashboard>;

export const Default: Story = {
  render: () => <MockDashboard className="max-w-4xl" />,
};
