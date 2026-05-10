import { FavoritesBar } from './favorites-bar';
import type { BoardSymbol } from './types';
import type { Meta, StoryObj } from '@storybook/react';

const symbols: BoardSymbol[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => ({
  id: k,
  label_en: ['eat', 'drink', 'water', 'mom', 'help', 'yes', 'no', 'more'][i] ?? k,
  label_ar: 'رمز',
  phonetic_en: null,
  phonetic_ar: null,
  image_path: `arasaac/${2540 + i}.png`,
  categories: ['core'],
  tags: [],
}));

const meta: Meta<typeof FavoritesBar> = {
  component: FavoritesBar,
  args: {
    favoriteIds: symbols.map((s) => s.id),
    symbols,
    locale: 'en',
    imageUrl: (p) =>
      `https://static.arasaac.org/pictograms/${p.replace('arasaac/', '').replace('.png', '')}/${p.replace('arasaac/', '').replace('.png', '')}_300.png`,
    size: 'standard',
    showPhonetic: false,
    onSelect: () => {},
    label: 'Favorites',
  },
};
export default meta;
type Story = StoryObj<typeof FavoritesBar>;

export const EightFavorites: Story = {};
export const Empty: Story = { args: { favoriteIds: [] } };
