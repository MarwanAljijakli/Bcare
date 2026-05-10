import { SymbolTile } from './symbol-tile';
import type { BoardSymbol } from './types';
import type { Meta, StoryObj } from '@storybook/react';

const stub: BoardSymbol = {
  id: 'abc',
  label_en: 'apple',
  label_ar: 'تفاح',
  phonetic_en: null,
  phonetic_ar: 'tuf-faah',
  image_path: 'arasaac/2570.png',
  categories: ['food'],
  tags: ['arasaac:2570'],
};

const meta: Meta<typeof SymbolTile> = {
  component: SymbolTile,
  args: {
    symbol: stub,
    locale: 'en',
    imageUrl: () => 'https://static.arasaac.org/pictograms/2570/2570_300.png',
    onSelect: () => {},
    showPhonetic: false,
  },
};
export default meta;
type Story = StoryObj<typeof SymbolTile>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

export const Dimmed: Story = { args: { dimmed: true } };

export const Large: Story = { args: { size: 'large' } };

export const ExtraLarge: Story = { args: { size: 'extra-large' } };

export const ArabicWithPhonetic: Story = {
  args: { locale: 'ar', showPhonetic: true },
};
