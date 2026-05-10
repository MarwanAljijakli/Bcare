import { SpeakButton } from './speak-button';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof SpeakButton> = {
  component: SpeakButton,
  args: {
    speaking: false,
    disabled: false,
    quietMode: false,
    onClick: () => {},
    label: 'Speak',
    speakingLabel: 'Speaking…',
    emptyLabel: 'Add symbols to begin',
  },
};
export default meta;
type Story = StoryObj<typeof SpeakButton>;

export const Idle: Story = {};
export const Speaking: Story = { args: { speaking: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Quiet: Story = { args: { quietMode: true } };
