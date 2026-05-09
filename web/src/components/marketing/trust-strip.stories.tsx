import { TrustStrip } from './trust-strip';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TrustStrip> = {
  title: 'Marketing/TrustStrip',
  component: TrustStrip,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof TrustStrip>;

export const Default: Story = {};
