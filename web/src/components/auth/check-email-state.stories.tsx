import { CheckEmailState } from './check-email-state';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CheckEmailState> = {
  title: 'Auth/CheckEmailState',
  component: CheckEmailState,
  parameters: { layout: 'padded' },
  args: {
    email: 'parent@example.com',
    i18nNamespace: 'marketing.auth.signup',
    bodyKey: 'bodyMagic',
    onResend: () => {},
    onUseDifferent: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof CheckEmailState>;

export const SignupMagicLink: Story = {};
export const SignupPassword: Story = {
  args: { bodyKey: 'bodyPassword' },
};
export const Login: Story = {
  args: { i18nNamespace: 'marketing.auth.login', bodyKey: 'body' },
};
