import { MockChildBoard } from './mock-child-board';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof MockChildBoard> = {
  title: 'Marketing/MockChildBoard',
  component: MockChildBoard,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof MockChildBoard>;

export const Default: Story = {
  render: () => <MockChildBoard className="max-w-3xl" />,
};
