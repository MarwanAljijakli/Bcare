import { SentenceStrip } from './sentence-strip';
import type { BoardSymbol } from './types';
import type { Meta, StoryObj } from '@storybook/react';

const stubs: BoardSymbol[] = [
  {
    id: 'a',
    label_en: 'I want',
    label_ar: 'أريد',
    phonetic_en: null,
    phonetic_ar: null,
    image_path: 'arasaac/5455.png',
    categories: ['core'],
    tags: ['arasaac:5455'],
  },
  {
    id: 'b',
    label_en: 'water',
    label_ar: 'ماء',
    phonetic_en: null,
    phonetic_ar: null,
    image_path: 'arasaac/2554.png',
    categories: ['food'],
    tags: ['arasaac:2554'],
  },
];

const meta: Meta<typeof SentenceStrip> = {
  component: SentenceStrip,
  args: {
    tokens: stubs,
    locale: 'en',
    imageUrl: () => 'https://static.arasaac.org/pictograms/2554/2554_300.png',
    onRemove: () => {},
    onClear: () => {},
    speaking: false,
    highlightIndex: null,
    strings: { remove: 'Remove', clear: 'Clear', placeholder: 'Tap symbols to build a sentence.' },
  },
};
export default meta;
type Story = StoryObj<typeof SentenceStrip>;

export const TwoTokens: Story = {};
export const Empty: Story = { args: { tokens: [] } };
export const SpeakingFirst: Story = { args: { speaking: true, highlightIndex: 0 } };
